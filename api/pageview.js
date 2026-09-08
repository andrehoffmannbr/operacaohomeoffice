'use strict';

const { isIP } = require('node:net');
const { createHmac, randomBytes } = require('node:crypto');

const LANDING = 'https://www.metodoexpress.com/';
const META_URL = 'https://graph.facebook.com/v25.0/3401433073361667/events';
const MAX_BYTES = 2048;
// Defesa local limitada por instância; o Firewall Vercel complementa entre instâncias.
const buckets = new Map();
const salt = randomBytes(32);

function authenticationDiagnostic(token, error) {
  // Apenas indicadores; nunca normalizar silenciosamente a credencial usada.
  const diagnostic = {
    production: process.env.VERCEL_ENV === 'production',
    credential_format: {
      bearer_prefix: /^\s*["']?Bearer\b/i.test(token),
      contains_quotes: /["']/.test(token),
      contains_whitespace: /\s/.test(token)
    }
  };
  if (error && typeof error === 'object') {
    diagnostic.meta_error = {};
    const secret = token.trim().replace(/^["']?Bearer\s+/i, '').replace(/^["']|["']$/g, '');
    for (const key of ['type', 'fbtrace_id']) {
      const value = error[key];
      if (typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) &&
          !(secret && value.includes(secret))) diagnostic.meta_error[key] = value;
    }
    for (const key of ['code', 'error_subcode']) {
      if (Number.isSafeInteger(error[key])) diagnostic.meta_error[key] = error[key];
    }
  }
  return diagnostic;
}

function allowedOrigin(origin) {
  if (origin === 'https://www.metodoexpress.com' || origin === 'https://metodoexpress.com') return true;
  return process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL &&
    origin === 'https://' + process.env.VERCEL_URL;
}

function limited(ip, now) {
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const key = createHmac('sha256', salt).update(ip).digest('hex');
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= 10000) return true;
    bucket = { until: now + 60000, count: 0 };
    buckets.set(key, bucket);
  }
  return ++bucket.count > 60;
}

function cookie(header, name, now) {
  if (typeof header !== 'string') return undefined;
  const entry = header.split(';').map(part => part.trim()).find(part => part.startsWith(name + '='));
  if (!entry) return undefined;
  const value = entry.slice(name.length + 1);
  const pattern = name === '_fbp' ? /^fb\.[0-2]\.(\d{13})\.\d{1,30}$/ : /^fb\.[0-2]\.(\d{13})\.[A-Za-z0-9_-]{1,500}$/;
  const match = value.match(pattern);
  return match && Number(match[1]) > 0 && Number(match[1]) <= now + 60000 ? value : undefined;
}

async function readBody(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('too_large');
    return JSON.parse(raw.toString());
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BYTES) throw new Error('too_large');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async function pageview(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, accepted = false) => {
    res.statusCode = status;
    res.end(JSON.stringify({ accepted }));
  };
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405);
  }
  if (!allowedOrigin(req.headers.origin) ||
      (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) return reply(403);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415);
  if (Number(req.headers['content-length']) > MAX_BYTES) return reply(413);

  // Vercel sobrescreve este cabeçalho. Fora dela, confiar somente no socket.
  const ip = process.env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  const ua = req.headers['user-agent'];
  if (typeof ip !== 'string' || !isIP(ip) || typeof ua !== 'string' || !ua.trim() || ua.length > 1024) return reply(400);
  const now = Date.now();
  if (limited(ip, now)) return reply(429);

  let body;
  try { body = await readBody(req); } catch (error) { return reply(error.message === 'too_large' ? 413 : 400); }
  const fields = ['event_name', 'event_id', 'event_time', 'event_source_url'];
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
      Object.keys(body).some(key => !fields.includes(key)) ||
      body.event_name !== 'PageView' ||
      typeof body.event_id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(body.event_id) ||
      !Number.isInteger(body.event_time) || body.event_time > Math.floor(now / 1000) + 60 ||
      body.event_time < Math.floor(now / 1000) - 300 ||
      body.event_source_url !== LANDING) return reply(400);

  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token || (process.env.META_CAPI_TEST_EVENT_CODE && process.env.VERCEL_ENV !== 'preview')) {
    console.warn('pageview_capi: configuration_unavailable');
    return reply(503);
  }
  const userData = { client_ip_address: ip, client_user_agent: ua };
  for (const name of ['fbp', 'fbc']) {
    const value = cookie(req.headers.cookie, '_' + name, now);
    if (value) userData[name] = value;
  }
  const payload = { data: [{
    event_name: 'PageView', event_id: body.event_id, event_time: body.event_time,
    action_source: 'website', event_source_url: LANDING, user_data: userData
  }] };
  if (process.env.VERCEL_ENV === 'preview' && process.env.META_CAPI_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(META_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload), signal: controller.signal, redirect: 'error'
    });
    const result = await response.json();
    if (!response.ok || result.error || result.events_received !== 1) {
      // Nunca registrar corpo, mensagem da Meta, token ou dados do visitante.
      console.warn('pageview_capi: upstream_rejected', response.status,
        JSON.stringify(authenticationDiagnostic(token, result.error)));
      return reply(502);
    }
    console.info('pageview_capi: accepted', JSON.stringify(authenticationDiagnostic(token)));
    return reply(202, true);
  } catch (error) {
    console.warn(controller.signal.aborted ? 'pageview_capi: timeout' : 'pageview_capi: upstream_failed');
    return reply(controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timeout); }
};
