'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');
const FBP_COOKIE = '_fbp=fb.1.1700000000000.1234567890';
const FBC_COOKIE = '_fbc=fb.1.1700000000000.ABC123';

function acceptedFetch() {
  return Promise.resolve({
    ok: true,
    json: async () => ({ accepted: true })
  });
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function readPixelBootstrap() {
  const source = fs.readFileSync(INDEX_PATH, 'utf8');
  const match = source.match(
    /<script>\s*(!function \(f, b, e, v, n, t, s\)[\s\S]*?)<\/script>/
  );

  assert.ok(match, 'bootstrap inline do Meta Pixel não encontrado');
  return match[1];
}

function createPixelEnvironment(options) {
  options = options || {};
  let now = 0;
  let nextTimerId = 1;
  let cookieHeader = options.cookie || '';
  const timers = new Map();
  const listeners = new Map();
  const documentListeners = new Map();
  const requests = [];
  const scripts = [];
  const cookieWrites = [];
  const fetchRequests = [];

  const firstScript = {
    parentNode: {
      insertBefore(script) {
        scripts.push(script);
        requests.push({
          at: now,
          async: script.async,
          src: script.src
        });
        if (options.insertThrows) throw new Error('script blocked');
      }
    }
  };

  const document = {
    readyState: options.readyState || 'loading',
    get cookie() {
      return cookieHeader;
    },
    set cookie(value) {
      cookieWrites.push(String(value));
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!documentListeners.has(type)) return;
      const remaining = documentListeners.get(type).filter((item) => item !== listener);
      if (remaining.length) documentListeners.set(type, remaining);
      else documentListeners.delete(type);
    },
    dispatch(type, init) {
      (documentListeners.get(type) || []).slice().forEach(
        (listener) => listener(Object.assign({ type }, init))
      );
    },
    createElement(tagName) {
      assert.equal(tagName, 'script');
      return { async: false, src: '' };
    },
    getElementsByTagName(tagName) {
      assert.equal(tagName, 'script');
      return [firstScript];
    }
  };

  const window = {
    document,
    crypto: require('node:crypto').webcrypto,
    location: {
      href: 'https://www.metodoexpress.com/' + (options.search || ''),
      search: options.search || ''
    },
    fetch: typeof options.fetch === 'function' ? function (url, fetchOptions) {
      fetchRequests.push({ at: now, url, options: fetchOptions });
      return options.fetch(url, fetchOptions);
    } : options.fetch,
    AbortController,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!listeners.has(type)) return;
      const remaining = listeners.get(type).filter((item) => item !== listener);
      if (remaining.length) listeners.set(type, remaining);
      else listeners.delete(type);
    },
    dispatch(type, init) {
      (listeners.get(type) || []).slice().forEach(
        (listener) => listener(Object.assign({ type }, init))
      );
    }
  };

  function setTimeoutFake(callback, delay) {
    const id = nextTimerId++;
    timers.set(id, { callback, at: now + Number(delay || 0) });
    return id;
  }

  function clearTimeoutFake(id) {
    timers.delete(id);
  }

  function advance(milliseconds) {
    const target = now + milliseconds;

    while (true) {
      const due = Array.from(timers.entries())
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0];

      if (!due) break;
      const [id, timer] = due;
      timers.delete(id);
      now = timer.at;
      timer.callback();
    }

    now = target;
  }

  const context = vm.createContext(window);
  context.window = window;
  context.document = document;
  context.setTimeout = setTimeoutFake;
  context.clearTimeout = clearTimeoutFake;
  vm.runInContext(readPixelBootstrap(), context);

  return {
    window,
    rerun() { vm.runInContext(readPixelBootstrap(), context); },
    advance,
    dispatch: window.dispatch.bind(window),
    dispatchDocument: document.dispatch.bind(document),
    documentListeners,
    listeners,
    requests,
    scripts,
    cookieWrites,
    fetchRequests,
    setCookie(value) {
      cookieHeader = String(value || '');
    },
    cookie() {
      return cookieHeader;
    },
    now() {
      return now;
    },
    callFbq() {
      window.fbq.apply(window, arguments);
    },
    pixelQueue() {
      return Array.from(window.fbq.queue, (args) => Array.from(args));
    }
  };
}

function pageViewCount(environment) {
  return environment.pixelQueue().filter(
    (args) => args[0] === 'track' && args[1] === 'PageView'
  ).length;
}

test('A/B — stub, init e PageView ficam disponíveis imediatamente sem interação', () => {
  const environment = createPixelEnvironment({ cookie: FBP_COOKIE });

  assert.deepEqual(environment.pixelQueue().map(args => args.slice(0, 2)), [
    ['init', '3401433073361667'],
    ['track', 'PageView']
  ]);
  assert.equal(pageViewCount(environment), 1);
  assert.equal(environment.requests.length, 0);
  assert.equal(environment.listeners.size, 0);
});

test('F — saídas em 500ms e 1s precedem o SDK; em 2s o request já iniciou', () => {
  for (const exitAt of [500, 1000, 2000]) {
    const environment = createPixelEnvironment();
    environment.advance(exitAt);
    const expectedRequests = exitAt >= 1500 ? 1 : 0;
    assert.equal(environment.requests.length, expectedRequests);
    if (expectedRequests) assert.equal(environment.requests[0].at, 1500);
    assert.equal(pageViewCount(environment), 1);
  }
});

test('C/D — interação imediata ou permanência de 5s não duplicam PageView', () => {
  const environment = createPixelEnvironment();

  environment.dispatch('click');
  environment.dispatch('scroll');
  environment.dispatch('touchstart');
  environment.dispatch('mousemove');
  environment.dispatch('visibilitychange');
  environment.advance(1499);
  assert.equal(environment.requests.length, 0);
  environment.advance(1);
  environment.dispatch('keydown');
  environment.advance(3500);

  assert.equal(environment.requests.length, 1);
  assert.deepEqual(environment.requests[0], {
      at: 1500,
      async: true,
      src: 'https://connect.facebook.net/en_US/fbevents.js'
  });
  assert.equal(pageViewCount(environment), 1);
});

test('E — VSL_Start permanece funcional sem criar um segundo PageView', () => {
  const environment = createPixelEnvironment();

  environment.callFbq('trackCustom', 'VSL_Start', { watched_seconds: 0 });

  assert.equal(pageViewCount(environment), 1);
  assert.equal(environment.pixelQueue().filter(
    (args) => args[0] === 'trackCustom' && args[1] === 'VSL_Start'
  ).length, 1);
});

test('Idempotência — timer e DOMContentLoaded em qualquer ordem inserem um script', () => {
  const scenarios = [
    { readyState: 'loading', domBeforeTimer: true },
    { readyState: 'loading', domBeforeTimer: false },
    { readyState: 'interactive', domBeforeTimer: true },
    { readyState: 'complete', domBeforeTimer: false }
  ];

  for (const scenario of scenarios) {
    const environment = createPixelEnvironment({ readyState: scenario.readyState });

    if (scenario.domBeforeTimer) {
      environment.dispatchDocument('DOMContentLoaded');
    }
    environment.dispatch('click');
    environment.advance(1500);
    if (!scenario.domBeforeTimer) {
      environment.dispatchDocument('DOMContentLoaded');
    }
    environment.dispatchDocument('DOMContentLoaded');
    environment.dispatch('scroll');
    environment.advance(5000);

    assert.equal(environment.documentListeners.size, 0);
    assert.equal(environment.listeners.size, 0);
    assert.equal(environment.requests.length, 1);
    assert.equal(environment.requests[0].at, 1500);
    assert.equal(pageViewCount(environment), 1);
  }
});

test('G — resposta lenta do fbevents.js mantém a fila e a landing operacional', () => {
  const environment = createPixelEnvironment();

  environment.advance(1500);
  environment.callFbq('trackCustom', 'VSL_25', { percent: 25 });
  assert.doesNotThrow(() => {
    environment.pixelQueue();
  });

  assert.equal(environment.requests.length, 1);
  assert.equal(pageViewCount(environment), 1);
});

test('H/I — falha de inserção ou bloqueio do Pixel não lança exceção', () => {
  const environment = createPixelEnvironment({ insertThrows: true });

  assert.doesNotThrow(() => environment.advance(1500));
  assert.equal(environment.requests.length, 1);
  assert.equal(pageViewCount(environment), 1);
});

test('J — cada reload cria um PageView novo, sem duplicar no carregamento', () => {
  const firstLoad = createPixelEnvironment();
  const reload = createPixelEnvironment();

  firstLoad.advance(5000);
  reload.advance(5000);

  assert.equal(pageViewCount(firstLoad), 1);
  assert.equal(pageViewCount(reload), 1);
  assert.equal(firstLoad.requests.length, 1);
  assert.equal(reload.requests.length, 1);
  assert.notEqual(firstLoad.window.__mexPageView.event_id, reload.window.__mexPageView.event_id);
});

test('CAPI recebe o mesmo ID e horário uma vez, independente do SDK e das interações', async () => {
  const requests = [];
  const env = createPixelEnvironment({ cookie: FBP_COOKIE, insertThrows: true, fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ accepted: true }) };
  } });
  const event = JSON.parse(requests[0].options.body);
  assert.equal(requests[0].url, '/api/pageview');
  assert.equal(requests[0].options.keepalive, true);
  assert.equal(event.event_id, env.pixelQueue()[1][3].eventID);
  assert.equal(event.event_time, env.window.__mexPageView.event_time);
  assert.equal(event.event_source_url, 'https://www.metodoexpress.com/');
  for (const type of ['click', 'scroll', 'play', 'focus', 'visibilitychange']) env.dispatch(type);
  env.rerun();
  env.advance(1500);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(pageViewCount(env), 1);
  assert.equal(env.window.__mexPageViewStatus, 'accepted');
});

test('CAPI rejeitada, indisponível ou com timeout não afeta Pixel nem gera retentativas', async () => {
  const cases = [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({ accepted: false }) }),
    async () => { throw new Error('network'); },
    () => { throw new Error('synchronous failure'); },
    (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))))
  ];
  for (const fetch of cases) {
    let calls = 0;
    const env = createPixelEnvironment({ cookie: FBP_COOKIE, fetch: (...args) => { calls++; return fetch(...args); } });
    env.advance(6000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(env.window.__mexPageViewStatus, 'failed');
    assert.equal(pageViewCount(env), 1);
    assert.equal(calls, 1);
    env.callFbq('track', 'Contact');
    assert.equal(env.pixelQueue().at(-1)[1], 'Contact');
  }
});

test('_fbp preexistente envia CAPI imediatamente, uma vez e com o contrato original', async () => {
  const environment = createPixelEnvironment({
    cookie: FBP_COOKIE,
    fetch: acceptedFetch
  });

  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(environment.fetchRequests[0].at, 0);
  assert.equal(pageViewCount(environment), 1);

  const pixelPageView = environment.pixelQueue().find(
    (args) => args[0] === 'track' && args[1] === 'PageView'
  );
  const request = environment.fetchRequests[0];
  const body = JSON.parse(request.options.body);

  assert.equal(request.url, '/api/pageview');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.keepalive, true);
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(Object.keys(body).sort(), [
    'event_id',
    'event_name',
    'event_source_url',
    'event_time'
  ]);
  assert.equal(body.event_name, 'PageView');
  assert.equal(body.event_id, environment.window.__mexPageView.event_id);
  assert.equal(body.event_id, pixelPageView[3].eventID);
  assert.equal(body.event_time, environment.window.__mexPageView.event_time);
  assert.equal(body.event_source_url, 'https://www.metodoexpress.com/');

  await flushPromises();
  environment.advance(10000);
  environment.dispatch('pagehide');
  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(environment.listeners.has('pagehide'), false);
});

test('primeira visita sem _fbp espera e usa o fallback único em aproximadamente 4s', async () => {
  const environment = createPixelEnvironment({
    insertThrows: true,
    fetch: acceptedFetch
  });

  assert.equal(pageViewCount(environment), 1, 'PageView do navegador deve ser imediato');
  assert.equal(environment.fetchRequests.length, 0, 'CAPI não deve sair imediatamente');
  environment.advance(3900);
  assert.equal(environment.fetchRequests.length, 0);
  environment.advance(200);
  assert.equal(environment.fetchRequests.length, 1);
  assert.ok(environment.fetchRequests[0].at >= 3900);
  assert.ok(environment.fetchRequests[0].at <= 4100);

  await flushPromises();
  environment.advance(6000);
  environment.dispatch('pagehide');
  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(environment.listeners.has('pagehide'), false);
});

test('_fbp que surge durante a espera libera imediatamente um único POST', async () => {
  const environment = createPixelEnvironment({ fetch: acceptedFetch });
  const originalEvent = Object.assign({}, environment.window.__mexPageView);

  environment.advance(2050);
  assert.equal(environment.fetchRequests.length, 0);
  environment.setCookie(FBP_COOKIE);
  environment.advance(50);

  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(environment.fetchRequests[0].at, 2100);
  assert.deepEqual(JSON.parse(environment.fetchRequests[0].options.body), originalEvent);

  await flushPromises();
  environment.advance(10000);
  environment.dispatch('pagehide');
  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(environment.listeners.has('pagehide'), false);
});

test('pagehide em saída rápida envia uma vez e limpa a espera', async () => {
  const environment = createPixelEnvironment({ fetch: acceptedFetch });

  environment.advance(250);
  assert.equal(environment.fetchRequests.length, 0);
  environment.dispatch('pagehide');
  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(environment.fetchRequests[0].at, 250);
  assert.equal(environment.listeners.has('pagehide'), false);

  await flushPromises();
  environment.advance(10000);
  environment.dispatch('pagehide');
  assert.equal(environment.fetchRequests.length, 1);
});

test('corridas entre cookie, deadline e pagehide permanecem atômicas', async () => {
  const cookieFirst = createPixelEnvironment({ fetch: acceptedFetch });
  cookieFirst.advance(3850);
  cookieFirst.setCookie(FBP_COOKIE);
  cookieFirst.advance(50);
  cookieFirst.dispatch('pagehide');
  cookieFirst.advance(200);
  assert.equal(cookieFirst.fetchRequests.length, 1);
  assert.equal(cookieFirst.fetchRequests[0].at, 3900);

  const pagehideFirst = createPixelEnvironment({ fetch: acceptedFetch });
  pagehideFirst.advance(3999);
  pagehideFirst.dispatch('pagehide');
  pagehideFirst.setCookie(FBP_COOKIE);
  pagehideFirst.advance(1);
  assert.equal(pagehideFirst.fetchRequests.length, 1);
  assert.equal(pagehideFirst.fetchRequests[0].at, 3999);

  const deadlineFirst = createPixelEnvironment({ fetch: acceptedFetch });
  deadlineFirst.advance(4000);
  deadlineFirst.setCookie(FBP_COOKIE);
  deadlineFirst.dispatch('pagehide');
  assert.equal(deadlineFirst.fetchRequests.length, 1);
  assert.equal(deadlineFirst.fetchRequests[0].at, 4000);

  await flushPromises();
  for (const environment of [cookieFirst, pagehideFirst, deadlineFirst]) {
    environment.advance(6000);
    environment.dispatch('pagehide');
    assert.equal(environment.fetchRequests.length, 1);
    assert.equal(environment.listeners.has('pagehide'), false);
  }
});

test('_fbc não é aguardado e fbclid não cria cookies nem amplia o payload', async () => {
  const withoutFbc = createPixelEnvironment({
    cookie: FBP_COOKIE,
    fetch: acceptedFetch
  });
  assert.equal(withoutFbc.fetchRequests.length, 1);
  assert.equal(withoutFbc.fetchRequests[0].at, 0);

  const onlyFbc = createPixelEnvironment({
    cookie: FBC_COOKIE,
    fetch: acceptedFetch
  });
  assert.equal(onlyFbc.fetchRequests.length, 0, '_fbc não deve ser tratado como _fbp');
  onlyFbc.advance(4000);
  assert.equal(onlyFbc.fetchRequests.length, 1);

  const withFbclid = createPixelEnvironment({
    search: '?utm_source=facebook&fbclid=LEGITIMATE_CLICK_ID',
    fetch: acceptedFetch
  });
  assert.equal(withFbclid.fetchRequests.length, 0);
  assert.equal(withFbclid.cookie(), '');
  assert.deepEqual(withFbclid.cookieWrites, []);
  withFbclid.advance(4000);
  assert.equal(withFbclid.fetchRequests.length, 1);
  assert.equal(withFbclid.cookie(), '');
  assert.deepEqual(withFbclid.cookieWrites, []);

  const body = JSON.parse(withFbclid.fetchRequests[0].options.body);
  for (const forbidden of [
    '_fbp', '_fbc', 'fbp', 'fbc', 'fbclid', 'email', 'phone',
    'external_id', 'facebook_login_id'
  ]) {
    assert.equal(Object.hasOwn(body, forbidden), false);
  }

  await flushPromises();
});

test('BFCache e reexecução no mesmo documento não duplicam CAPI nem Pixel', async () => {
  const environment = createPixelEnvironment({ fetch: acceptedFetch });
  const originalId = environment.window.__mexPageView.event_id;

  environment.advance(500);
  environment.dispatch('pagehide', { persisted: true });
  environment.dispatch('pageshow', { persisted: true });
  environment.rerun();
  environment.dispatch('pagehide', { persisted: true });
  environment.advance(10000);

  assert.equal(environment.fetchRequests.length, 1);
  assert.equal(pageViewCount(environment), 1);
  assert.equal(environment.window.__mexPageView.event_id, originalId);
  assert.equal(JSON.parse(environment.fetchRequests[0].options.body).event_id, originalId);

  await flushPromises();
});
