'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const { createServer } = require('node:http');

const source = fs.readFileSync(path.join(__dirname, '../api/pageview.js'), 'utf8');
const now = Date.now();
const event = () => ({
  event_name: 'PageView', event_id: '12345678-1234-4234-8234-123456789abc',
  event_time: Math.floor(now / 1000), event_source_url: 'https://www.metodoexpress.com/'
});

function setup(options = {}) {
  const calls = [], logs = [];
  let timeout;
  const env = { VERCEL: '1', VERCEL_ENV: 'production', META_CAPI_ACCESS_TOKEN: 'test-private-sentinel', ...options.env };
  const context = vm.createContext({
    require, module: { exports: {} }, Buffer, AbortController,
    process: { env }, Date,
    console: { warn: (...args) => logs.push(args) },
    setTimeout: callback => { timeout = callback; return 1; }, clearTimeout: () => {},
    fetch: async (url, init) => {
      calls.push({ url, init, payload: JSON.parse(init.body) });
      if (options.fetch) return options.fetch(url, init, () => timeout());
      return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
    }
  });
  vm.runInContext(source, context);
  const handler = context.module.exports;
  async function invoke(body = event(), headers = {}, method = 'POST', raw = false) {
    const req = Readable.from(raw ? body : []);
    Object.assign(req, {
      method, socket: { remoteAddress: '127.0.0.1' },
      headers: {
        origin: 'https://www.metodoexpress.com', 'content-type': 'application/json',
        'user-agent': 'PageView test browser', 'x-vercel-forwarded-for': '203.0.113.42', ...headers
      }
    });
    if (!raw) req.body = body;
    const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
    await handler(req, res);
    return res;
  }
  return { handler, invoke, calls, logs };
}

test('Servidor envia PageView fixo, mesmo ID/tempo, IP Vercel e cookies reais sem hash', async () => {
  const api = setup();
  const fbp = 'fb.1.' + (now - 1000) + '.123456789';
  const fbc = 'fb.1.' + (now - 1000) + '.Real_Click-ID';
  const response = await api.invoke(event(), { cookie: '_fbp=' + fbp + '; _fbc=' + fbc, 'x-forwarded-for': '192.0.2.99' });
  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.body, { accepted: true });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url, 'https://graph.facebook.com/v25.0/3401433073361667/events');
  assert.equal(api.calls[0].init.headers.Authorization, 'Bearer test-private-sentinel');
  assert.deepEqual(api.calls[0].payload, { data: [{ ...event(), action_source: 'website', user_data: {
    client_ip_address: '203.0.113.42', client_user_agent: 'PageView test browser', fbp, fbc
  } }] });
  assert.equal(JSON.stringify([response, api.logs]).includes('test-private-sentinel'), false);
});

test('Payload, método, origem, tamanho, evento e destino arbitrários são rejeitados antes da Meta', async () => {
  const api = setup();
  for (const body of [null, [], 'bad json', {}, { ...event(), event_name: 'Purchase' },
    { ...event(), pixel_id: 'other' }, { ...event(), url: 'https://attacker.example' },
    { ...event(), user_data: { client_ip_address: '192.0.2.1' } },
    { ...event(), test_event_code: 'client-code' }, { ...event(), event_id: 'short' },
    { ...event(), event_time: Math.floor(now / 1000) - 301 },
    { ...event(), event_time: Math.floor(now / 1000) + 120 },
    { ...event(), event_source_url: 'https://www.metodoexpress.com/?email=private' }
  ]) assert.equal((await api.invoke(body)).statusCode, 400);
  assert.equal((await api.invoke(event(), {}, 'GET')).statusCode, 405);
  for (const origin of [undefined, 'null', 'https://attacker.example', 'https://www.metodoexpress.com.attacker.example']) {
    assert.equal((await api.invoke(event(), { origin })).statusCode, 403);
  }
  assert.equal((await api.invoke(event(), { 'sec-fetch-site': 'cross-site' })).statusCode, 403);
  assert.equal((await api.invoke(event(), { 'content-type': 'text/plain' })).statusCode, 415);
  assert.equal((await api.invoke(event(), { 'content-length': '2049' })).statusCode, 413);
  assert.equal((await api.invoke(' '.repeat(2049))).statusCode, 413);
  assert.equal((await api.invoke([' '.repeat(1024), ' '.repeat(1025)], {}, 'POST', true)).statusCode, 413);
  assert.equal(api.calls.length, 0);
});

test('IP encaminhado só é confiável na Vercel; identificadores inválidos são omitidos', async () => {
  const api = setup();
  for (const ip of [undefined, 'not-ip', '192.0.2.1, 192.0.2.2']) {
    assert.equal((await api.invoke(event(), { 'x-vercel-forwarded-for': ip })).statusCode, 400);
  }
  assert.equal((await api.invoke(event(), { 'user-agent': '' })).statusCode, 400);
  await api.invoke(event(), { cookie: '_fbp=made-up; _fbc=fb.1.9999999999999.fake' });
  assert.deepEqual(Object.keys(api.calls[0].payload.data[0].user_data), ['client_ip_address', 'client_user_agent']);
  const local = setup({ env: { VERCEL: undefined } });
  await local.invoke();
  assert.equal(local.calls[0].payload.data[0].user_data.client_ip_address, '127.0.0.1');
});

test('Falha, rejeição e timeout da Meta nunca retornam aceitação ou vazam resposta privada', async () => {
  const responses = [
    async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'test-private-sentinel visitor-private' } }) }),
    async () => ({ ok: true, status: 200, json: async () => ({ events_received: 0 }) }),
    async () => ({ ok: true, status: 200, json: async () => { throw new Error('private upstream body'); } }),
    async () => { throw new Error('test-private-sentinel visitor-private'); },
    async (url, init, expire) => { expire(); init.signal.throwIfAborted(); }
  ];
  for (let i = 0; i < responses.length; i++) {
    const api = setup({ fetch: responses[i] });
    const result = await api.invoke();
    assert.equal(result.statusCode, i === responses.length - 1 ? 504 : 502);
    assert.equal(result.body.accepted, false);
    assert.equal(api.calls.length, 1);
    assert.equal(api.logs.length, 1);
    assert.doesNotMatch(JSON.stringify([result, api.logs]), /test-private-sentinel|visitor-private|private upstream body/);
  }
});

test('Configuração ausente falha fechada; código de teste é exclusivo do preview no servidor', async () => {
  for (const env of [{ META_CAPI_ACCESS_TOKEN: '' }, { META_CAPI_TEST_EVENT_CODE: 'TEST_ONLY' }]) {
    const api = setup({ env });
    assert.equal((await api.invoke()).statusCode, 503);
    assert.equal(api.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(api.logs), /TEST_ONLY|test-private-sentinel/);
  }
  const preview = setup({ env: { VERCEL_ENV: 'preview', VERCEL_URL: 'this-preview.vercel.app', META_CAPI_TEST_EVENT_CODE: 'TEST_ONLY' } });
  assert.equal((await preview.invoke(event(), { origin: 'https://this-preview.vercel.app' })).statusCode, 202);
  assert.equal(preview.calls[0].payload.test_event_code, 'TEST_ONLY');
  assert.equal((await preview.invoke(event(), { origin: 'https://other-preview.vercel.app' })).statusCode, 403);
});

test('Limite de abuso bloqueia excesso sem novo envio à Meta', async () => {
  const api = setup();
  for (let i = 0; i < 60; i++) assert.equal((await api.invoke()).statusCode, 202);
  assert.equal((await api.invoke()).statusCode, 429);
  assert.equal(api.calls.length, 60);
});

test('Handler funciona via HTTP Node real com leitura do corpo e resposta simulada da Meta', async t => {
  const api = setup({ env: { VERCEL: undefined } });
  const server = createServer(api.handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/pageview', {
    method: 'POST', headers: { origin: 'https://www.metodoexpress.com', 'Content-Type': 'application/json' },
    body: JSON.stringify(event())
  });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(api.calls[0].payload.data[0].event_id, event().event_id);
  const publicFiles = ['index.html', 'script.js'].map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(publicFiles, /META_CAPI_ACCESS_TOKEN|META_CAPI_TEST_EVENT_CODE|test-private-sentinel|Authorization|graph\.facebook\.com/);
});
