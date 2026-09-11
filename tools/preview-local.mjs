// Local review only: no production CAPI handler or Meta requests are used.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '8046fb8f739f414ca0b332bb555aa2458c1c42c6';
const before = execFileSync('git', ['show', `${baseline}:index.html`], { cwd: root, encoding: 'utf8' });
const port = Number(process.env.LOCAL_PREVIEW_PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

const instrumentation = String.raw`(function () {
  var data = { mode: 'local-simulation', pageViews: 0, capi: [], events: [], errors: [], lcpMs: null, cls: 0 };
  var originalFetch = window.fetch.bind(window);
  function present(name) { return document.cookie.split(';').some(function (v) { return v.trim().indexOf(name + '=') === 0; }); }
  data.fbpAtInit = present('_fbp');
  window.__localReview = {
    recordPixel: function (args) {
      if (args[0] !== 'track' && args[0] !== 'trackCustom') return;
      data.events.push(args[1]);
      if (args[1] === 'PageView') {
        data.pageViews++;
        data.pixelIdMatchesCapi = !!(args[3] && window.__mexPageView && args[3].eventID === window.__mexPageView.event_id);
      }
    }
  };
  window.fetch = function (url, options) {
    if (url !== '/api/pageview') return originalFetch(url, options);
    var event = JSON.parse(options.body);
    var entry = { atMs: Math.round(performance.now()), fbpPresent: present('_fbp'), eventName: event.event_name, keys: Object.keys(event).sort(), idMatchesOriginal: event.event_id === window.__mexPageView.event_id, timeMatchesOriginal: event.event_time === window.__mexPageView.event_time, credentials: options.credentials, keepalive: options.keepalive };
    data.capi.push(entry);
    return originalFetch(url, options).then(function (response) { entry.status = response.status; return response; });
  };
  window.addEventListener('error', function (event) { data.errors.push(event.message || 'resource-error'); });
  window.addEventListener('unhandledrejection', function () { data.errors.push('unhandled-rejection'); });
  try {
    new PerformanceObserver(function (list) { list.getEntries().forEach(function (entry) { data.lcpMs = Math.round(entry.startTime); }); }).observe({type:'largest-contentful-paint', buffered:true});
    new PerformanceObserver(function (list) { list.getEntries().forEach(function (entry) { if (!entry.hadRecentInput) data.cls += entry.value; }); }).observe({type:'layout-shift', buffered:true});
  } catch (_) {}
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a');
    if (link && /^(https:\/\/pay\.hotmart\.com\/|https:\/\/wa\.me\/)/.test(link.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  function refresh() {
    if (!document.body) return;
    var node = document.getElementById('local-review-diagnostics');
    if (!node) { node = document.createElement('script'); node.id = 'local-review-diagnostics'; node.type = 'application/json'; document.body.appendChild(node); }
    var width = document.documentElement.clientWidth;
    var resources = performance.getEntriesByType('resource');
    data.viewport = { width: width, height: window.innerHeight, documentHeight: document.documentElement.scrollHeight, horizontalOverflow: document.documentElement.scrollWidth > width };
    data.overflowElements = Array.from(document.querySelectorAll('body *')).filter(function (el) { var r = el.getBoundingClientRect(); return r.width > 0 && (r.right > width + 1 || r.left < -1); }).slice(0,10).map(function (el) { return el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''); });
    data.ctas = ['ctaInvestimento','ctaFinal'].map(function (id) { var el = document.getElementById(id); var u = el && new URL(el.href); return { id:id, present:!!el, checkoutMatches:!!u && u.origin === 'https://pay.hotmart.com' && u.pathname === '/G106758643C', parameters:u ? Array.from(u.searchParams.keys()).sort() : [] }; });
    data.offerVisibleWithoutVideo = !!document.querySelector('[data-offer-price]') && document.querySelector('[data-offer-price]').getBoundingClientRect().height > 0;
    data.metaNetworkResources = resources.filter(function (entry) { return /facebook\.com|facebook\.net/.test(entry.name); }).length;
    data.resourceBytes = resources.reduce(function (sum, entry) { return sum + entry.transferSize; },0);
    data.resources = resources.length;
    data.imageFailures = Array.from(document.images).filter(function (img) { return img.complete && img.naturalWidth === 0; }).map(function (img) { return img.getAttribute('src'); });
    var mainTextSelector = '.hero-lead,.hero-barriers,.hero-territory,.vsl-caption,.asset-caption,.agent-result>p,.agent-io-label,.agent-io-value,.media-pending p,.proof-result,.founder-case-story>p,.process-flow span,.package-components p,.pending-note,.profile-list li,.language-step-label,.language-step p,.offer-intro,.offer-product p,.offer-value,.offer-price-label,.offer-price-alt,.btn,.secure-note,.access-note,.author-copy .prose,.author-role,.guarantee-card p,.faq-answer p,.final-copy,.final-reinforcement,.support';
    data.mainTextBelow16 = Array.from(document.querySelectorAll(mainTextSelector)).filter(function (el) { return el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16; }).map(function (el) { return { selector: el.className || el.tagName.toLowerCase(), fontSize: getComputedStyle(el).fontSize }; });
    var heroCopy = document.querySelector('.hero-copy');
    var heroMedia = document.querySelector('.hero-media');
    var columnCount = function (selector) { var value = getComputedStyle(document.querySelector(selector)).gridTemplateColumns; return value === 'none' ? 1 : value.split(' ').length; };
    data.layout = { innerWidth: window.innerWidth, visualViewportWidth: window.visualViewport ? window.visualViewport.width : null, heroColumns: columnCount('.hero-layout'), beforeAfterColumns: columnCount('.ba'), agentColumns: columnCount('.agent-results'), proofColumns: columnCount('.proof-grid'), offerColumns: columnCount('.offer-card'), heroMediaBelowCopy: heroMedia.getBoundingClientRect().top >= heroCopy.getBoundingClientRect().bottom - 1 };
    node.textContent = JSON.stringify(data);
  }
  setInterval(refresh, 300);
  document.addEventListener('DOMContentLoaded', refresh);
}());`;

const pixelStub = `var q=window.fbq.queue.slice();window.fbq.callMethod=function(){window.__localReview.recordPixel(Array.from(arguments));};q.forEach(function(a){window.__localReview.recordPixel(Array.from(a));});window.fbq.queue=[];`;

function prepare(html, old, captureY) {
  const captureSetup = Number.isInteger(captureY)
    ? `<style>html{scroll-behavior:auto!important}</style><script>addEventListener('load',function(){scrollTo(0,${captureY});},{once:true});</script>`
    : '';
  return html.replace('<head>', `<head><script src="/_review/instrumentation.js"></script>${captureSetup}`)
    .replace('https://connect.facebook.net/en_US/fbevents.js', '/_review/pixel.js')
    .replace('<body>', '<body data-local-preview="' + (old ? 'before' : 'after') + '">');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const headers = {
      'Cache-Control': 'no-store',
      'X-Local-Preview': 'Meta and CAPI simulated; checkout disabled',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com https://img.youtube.com; font-src 'self'; media-src 'self' blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https://www.youtube.com; object-src 'none'; base-uri 'self'"
    };
    if (url.pathname === '/api/pageview' && req.method === 'POST') {
      let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 2048) { res.writeHead(413, headers).end(); return; } }
      res.writeHead(202, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ accepted: true, simulation: true }));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers).end(); return; }
    if (url.pathname === '/_review/instrumentation.js' || url.pathname === '/_review/pixel.js') {
      res.writeHead(200, { ...headers, 'Content-Type': mime['.js'] }).end(url.pathname.endsWith('pixel.js') ? pixelStub : instrumentation); return;
    }
    const old = url.pathname === '/before/' || url.pathname === '/before/index.html';
    if (url.pathname === '/' || url.pathname === '/index.html' || old) {
      const html = old ? before : await readFile(path.join(root, 'index.html'), 'utf8');
      const captureY = url.searchParams.has('_capture_y')
        ? Math.max(0, Math.min(100000, Math.round(Number(url.searchParams.get('_capture_y')) || 0)))
        : null;
      res.writeHead(200, { ...headers, 'Content-Type': mime['.html'] }).end(prepare(html, old, captureY)); return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/before\//, '/').replace(/^\//, '');
    if (relative !== 'script.js' && !relative.startsWith('assets/')) { res.writeHead(404, headers).end(); return; }
    const target = path.resolve(root, relative);
    const assetsRoot = path.join(root, 'assets') + path.sep;
    if (relative !== 'script.js' && !target.startsWith(assetsRoot)) { res.writeHead(403, headers).end(); return; }
    const info = await stat(target);
    if (!info.isFile()) { res.writeHead(404, headers).end(); return; }
    const content = await readFile(target);
    res.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (_) { res.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Local review: http://127.0.0.1:${port}/ | before: http://127.0.0.1:${port}/before/`);
  console.log('Meta/CAPI are local simulations. Checkout and contact clicks are disabled. No secrets are loaded.');
});
