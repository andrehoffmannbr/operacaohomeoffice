'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function readPixelBootstrap() {
  const source = fs.readFileSync(INDEX_PATH, 'utf8');
  const match = source.match(
    /<script>\s*(!function \(f, b, e, v, n, t, s\)[\s\S]*?fbq\('track', 'PageView'\);\s*)<\/script>/
  );

  assert.ok(match, 'bootstrap inline do Meta Pixel não encontrado');
  return match[1];
}

function createPixelEnvironment(options) {
  options = options || {};
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const listeners = new Map();
  const documentListeners = new Map();
  const requests = [];
  const scripts = [];

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
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!documentListeners.has(type)) return;
      documentListeners.set(
        type,
        documentListeners.get(type).filter((item) => item !== listener)
      );
    },
    dispatch(type) {
      (documentListeners.get(type) || []).slice().forEach(
        (listener) => listener({ type })
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
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!listeners.has(type)) return;
      listeners.set(type, listeners.get(type).filter((item) => item !== listener));
    },
    dispatch(type) {
      (listeners.get(type) || []).slice().forEach((listener) => listener({ type }));
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
    advance,
    dispatch: window.dispatch.bind(window),
    dispatchDocument: document.dispatch.bind(document),
    documentListeners,
    listeners,
    requests,
    scripts,
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
  const environment = createPixelEnvironment();

  assert.deepEqual(environment.pixelQueue(), [
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
});
