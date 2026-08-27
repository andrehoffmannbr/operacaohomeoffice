'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'script.js');
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');
const TRACKING_KEY = 'metodoexpress_vsl_events';

function createStorage(existingMap, unavailable) {
  const values = existingMap || new Map();
  return {
    values,
    getItem(key) {
      if (unavailable) throw new Error('storage unavailable');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (unavailable) throw new Error('storage unavailable');
      values.set(key, String(value));
    },
    removeItem(key) {
      if (unavailable) throw new Error('storage unavailable');
      values.delete(key);
    }
  };
}

function createEventTarget(extra) {
  const listeners = {};
  return Object.assign({
    listeners,
    addEventListener(type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    removeEventListener(type, listener) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((item) => item !== listener);
    },
    dispatch(type, event) {
      (listeners[type] || []).slice().forEach((listener) => listener(event || {}));
    }
  }, extra || {});
}

function createClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
    toggle(value, force) {
      if (force === undefined ? !values.has(value) : force) values.add(value);
      else values.delete(value);
    }
  };
}

function createEnvironment(options) {
  options = options || {};

  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const pixelCalls = [];
  let playerConfig = null;
  let playerCount = 0;

  const localStorage = createStorage(options.localMap, options.localStorageUnavailable);
  const sessionStorage = createStorage(options.sessionMap, options.sessionStorageUnavailable);

  const fakePlayer = {
    state: -1,
    currentTime: 0,
    duration: options.duration || 500,
    getPlayerState() { return this.state; },
    getCurrentTime() { return this.currentTime; },
    getDuration() { return this.duration; },
    playVideo() {},
    pauseVideo() {}
  };

  function updatePlayerTime(targetTime) {
    if (fakePlayer.state === 1 && targetTime > now) {
      fakePlayer.currentTime = Math.min(
        fakePlayer.duration,
        fakePlayer.currentTime + (targetTime - now) / 1000
      );
    }
    now = targetTime;
  }

  function setTimeoutFake(callback, delay) {
    const id = nextTimerId++;
    timers.set(id, { id, callback, nextAt: now + Number(delay || 0), repeat: 0 });
    return id;
  }

  function setIntervalFake(callback, delay) {
    const id = nextTimerId++;
    const interval = Number(delay || 0);
    timers.set(id, { id, callback, nextAt: now + interval, repeat: interval });
    return id;
  }

  function clearTimerFake(id) {
    timers.delete(id);
  }

  function advance(milliseconds) {
    const target = now + milliseconds;

    while (true) {
      let next = null;
      for (const timer of timers.values()) {
        if (timer.nextAt > target) continue;
        if (!next || timer.nextAt < next.nextAt ||
            (timer.nextAt === next.nextAt && timer.id < next.id)) {
          next = timer;
        }
      }

      if (!next) break;
      updatePlayerTime(next.nextAt);

      if (next.repeat) next.nextAt += next.repeat;
      else timers.delete(next.id);

      next.callback();
    }

    updatePlayerTime(target);
  }

  // Simula o navegador deixando timers vencidos sem executar enquanto o
  // player (processo/iframe separado) continua avançando normalmente.
  function delayTimers(milliseconds) {
    updatePlayerTime(now + milliseconds);
    for (const timer of timers.values()) {
      if (timer.nextAt <= now) timer.nextAt = now;
    }
    advance(0);
  }

  const root = { classList: createClassList() };
  const initialWatched = Number(localStorage.values.get('mex_vsl_watched_seconds') || 0);
  if (!options.localStorageUnavailable &&
      localStorage.values.get('mex_content_unlocked') !== '1' &&
      initialWatched < 415) {
    root.classList.add('content-locked');
  }
  const toggle = createEventTarget({
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); }
  });
  const vslPlayer = createEventTarget({
    innerHTML: '',
    removeAttribute() {},
    appendChild() {}
  });

  const document = createEventTarget({
    documentElement: root,
    visibilityState: 'visible',
    head: { appendChild() {} },
    createElement() { return createEventTarget({ setAttribute() {} }); },
    getElementById(id) {
      if (id === 'vslPlayer') return vslPlayer;
      if (id === 'vslToggle') return toggle;
      return null;
    },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  });

  const NativeDate = Date;
  class FakeDate extends NativeDate {
    static now() { return now; }
  }

  const window = createEventTarget({
    document,
    localStorage,
    sessionStorage,
    location: {
      href: 'https://www.metodoexpress.com/',
      origin: 'https://www.metodoexpress.com',
      search: ''
    },
    URL,
    URLSearchParams,
    console,
    matchMedia(query) {
      return { matches: query === '(min-width: 640px)' ? options.desktop !== false : false };
    }
  });

  if (!options.pixelUnavailable) {
    window.fbq = function () {
      if (options.pixelThrows) throw new Error('pixel unavailable');
      pixelCalls.push(Array.from(arguments));
    };
  }

  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 },
    Player: function Player(targetId, config) {
      assert.equal(targetId, 'ytTarget');
      playerCount += 1;
      playerConfig = config;
      return fakePlayer;
    }
  };

  const context = vm.createContext({
    window,
    document,
    console,
    Date: FakeDate,
    URL,
    URLSearchParams,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimerFake,
    setInterval: setIntervalFake,
    clearInterval: clearTimerFake,
    encodeURIComponent
  });

  vm.runInContext(SCRIPT_SOURCE, context, { filename: SCRIPT_PATH });
  document.dispatch('DOMContentLoaded');

  function clickVslWithoutReady() {
    vslPlayer.dispatch('click');
    assert.ok(playerConfig, 'YT.Player deve ser criado após o clique');
  }

  function clickVsl() {
    clickVslWithoutReady();
    playerConfig.events.onReady({ target: fakePlayer });
  }

  function emitState(state) {
    fakePlayer.state = state;
    playerConfig.events.onStateChange({ data: state, target: fakePlayer });
  }

  function customEvents() {
    return pixelCalls
      .filter((call) => call[0] === 'trackCustom')
      .map((call) => ({ name: call[1], params: call[2] }));
  }

  return {
    advance,
    clickVsl,
    clickVslWithoutReady,
    customEvents,
    delayTimers,
    document,
    emitState,
    fakePlayer,
    isContentLocked: () => root.classList.contains('content-locked'),
    localMap: localStorage.values,
    pagehide() { window.dispatch('pagehide'); },
    playerConfig: () => playerConfig,
    playerCount: () => playerCount,
    sessionMap: sessionStorage.values,
    setVisibility(state) {
      document.visibilityState = state;
      document.dispatch('visibilitychange');
    },
    trackingState() {
      return JSON.parse(sessionStorage.getItem(TRACKING_KEY));
    }
  };
}

function eventNames(environment) {
  return environment.customEvents().map((event) => event.name);
}

function startPlaying(environment) {
  environment.clickVsl();
  environment.emitState(1);
}

test('A — carregamento e ready não disparam evento VSL', () => {
  const environment = createEnvironment();
  assert.deepEqual(eventNames(environment), []);
  environment.clickVsl();
  assert.deepEqual(eventNames(environment), []);
  assert.equal(environment.playerCount(), 1);
  assert.equal(environment.playerConfig().playerVars.origin, 'https://www.metodoexpress.com');
});

test('B — Start ocorre no primeiro PLAYING e somente uma vez', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.emitState(2);
  environment.emitState(1);
  assert.deepEqual(eventNames(environment), ['VSL_Start']);
});

test('C — 25% exige playhead e consumo efetivo', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.fakePlayer.currentTime = 450;
  environment.advance(1000);
  assert.deepEqual(eventNames(environment), ['VSL_Start']);

  environment.fakePlayer.currentTime = 0;
  environment.advance(125000);
  assert.deepEqual(eventNames(environment), ['VSL_Start', 'VSL_25']);
});

test('D — 50% ocorre uma vez', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(250000);
  environment.emitState(2);
  environment.emitState(1);
  environment.advance(2000);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_50').length, 1);
});

test('E — 75% ocorre uma vez', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(375000);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_75').length, 1);
});

test('F — Offer observa a liberação natural do gate de 415s', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(415000);

  const offer = environment.customEvents().find((event) => event.name === 'VSL_Offer');
  assert.equal(offer.params.gate_seconds, 415);
  assert.equal(environment.localMap.get('mex_content_unlocked'), '1');
  assert.equal(environment.localMap.get('mex_vsl_watched_seconds'), '415');

  environment.advance(20000);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Offer').length, 1);
});

test('G — 90% ocorre uma vez e ENDED não cria VSL_100', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(450000);
  environment.emitState(0);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_90').length, 1);
  assert.equal(eventNames(environment).includes('VSL_100'), false);
});

test('H — pause, resume e buffering não duplicam milestones', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(130000);
  environment.emitState(2);
  environment.emitState(1);
  environment.emitState(3);
  environment.emitState(1);
  environment.advance(5000);

  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Start').length, 1);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_25').length, 1);
});

test('I — reload na mesma aba mantém deduplicação', () => {
  const first = createEnvironment();
  startPlaying(first);
  first.advance(450000);
  first.pagehide();

  const reloaded = createEnvironment({
    localMap: first.localMap,
    sessionMap: first.sessionMap
  });
  startPlaying(reloaded);
  reloaded.advance(20000);
  assert.deepEqual(eventNames(reloaded), []);
  assert.ok(reloaded.sessionMap.has(TRACKING_KEY));
});

test('J — nova sessão produz todos os eventos novamente', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(450000);
  assert.deepEqual(eventNames(environment), [
    'VSL_Start', 'VSL_25', 'VSL_50', 'VSL_75', 'VSL_Offer', 'VSL_90'
  ]);
});

test('K — gate persistido não dispara Offer no carregamento', () => {
  const localMap = new Map([
    ['mex_content_unlocked', '1'],
    ['mex_vsl_watched_seconds', '415']
  ]);
  const environment = createEnvironment({ localMap });
  assert.deepEqual(eventNames(environment), []);
  startPlaying(environment);
  environment.advance(10000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
});

test('L — Pixel indisponível falha silenciosamente', () => {
  const environment = createEnvironment({ pixelUnavailable: true });
  assert.doesNotThrow(() => {
    startPlaying(environment);
    environment.advance(450000);
    environment.emitState(0);
  });
  assert.deepEqual(eventNames(environment), []);
});

test('M — hidden/visible retoma somente se o player continuar PLAYING', () => {
  const environment = createEnvironment({ duration: 40 });
  startPlaying(environment);
  environment.advance(5000);

  environment.setVisibility('hidden');
  const effectiveAtHidden = environment.trackingState().effective_seconds;
  environment.advance(20000);
  assert.equal(environment.trackingState().effective_seconds, effectiveAtHidden);

  environment.setVisibility('visible');
  environment.advance(5000);
  const effectiveAfterResume = environment.trackingState().effective_seconds;
  assert.ok(effectiveAfterResume >= effectiveAtHidden + 5);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_25').length, 1);

  environment.emitState(2);
  environment.setVisibility('hidden');
  const effectiveWhilePaused = environment.trackingState().effective_seconds;
  environment.advance(20000);
  environment.setVisibility('visible');
  environment.advance(10000);

  assert.equal(environment.trackingState().effective_seconds, effectiveWhilePaused);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_25').length, 1);
});

function assertGateReleased(environment) {
  assert.equal(environment.isContentLocked(), false);
  assert.equal(environment.localMap.get('mex_content_unlocked'), '1');
  assert.equal(environment.localMap.get('mex_vsl_watched_seconds'), '415');
}

function watchWithDelayedCallbacks(delaySeconds) {
  const environment = createEnvironment();
  startPlaying(environment);

  for (let elapsed = 0; elapsed < 420; elapsed += delaySeconds) {
    environment.delayTimers(delaySeconds * 1000);
  }

  return environment;
}

test('Gate 01 — PLAYING contínuo libera em 415s', () => {
  const environment = createEnvironment();
  assert.equal(environment.isContentLocked(), true);
  startPlaying(environment);
  environment.advance(415000);
  assertGateReleased(environment);
});

test('Gate 02 — callback atrasado 6s preserva tempo legítimo', () => {
  assertGateReleased(watchWithDelayedCallbacks(6));
});

test('Gate 03 — callback atrasado 10s preserva tempo legítimo', () => {
  assertGateReleased(watchWithDelayedCallbacks(10));
});

test('Gate 04 — callback atrasado 30s preserva tempo legítimo', () => {
  assertGateReleased(watchWithDelayedCallbacks(30));
});

test('Gate 05 — playhead em 415 libera contador previamente atrasado', () => {
  const localMap = new Map([['mex_vsl_watched_seconds', '385']]);
  const environment = createEnvironment({ localMap });
  environment.fakePlayer.currentTime = 413;
  startPlaying(environment);
  environment.delayTimers(2000);

  assert.equal(environment.fakePlayer.currentTime, 415);
  assertGateReleased(environment);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Offer').length, 1);
});

test('Gate 06 — ENDED libera mesmo com contador em 395s', () => {
  const localMap = new Map([['mex_vsl_watched_seconds', '395']]);
  const environment = createEnvironment({ localMap });
  startPlaying(environment);
  environment.fakePlayer.currentTime = 500;
  environment.emitState(0);

  assertGateReleased(environment);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Offer').length, 1);
});

test('Gate 07 — PAUSED não conta e depois retoma', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(200000);
  environment.emitState(2);
  environment.delayTimers(30000);
  assert.equal(environment.isContentLocked(), true);

  environment.emitState(1);
  environment.advance(214000);
  assert.equal(environment.isContentLocked(), true);
  environment.advance(1000);
  assertGateReleased(environment);
});

test('Gate 08 — BUFFERING não conta e depois retoma', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(200000);
  environment.emitState(3);
  environment.delayTimers(30000);
  assert.equal(environment.isContentLocked(), true);

  environment.emitState(1);
  environment.advance(214000);
  assert.equal(environment.isContentLocked(), true);
  environment.advance(1000);
  assertGateReleased(environment);
});

test('Gate 09 — hidden não conta automaticamente', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(100000);
  environment.setVisibility('hidden');
  const watchedBeforeHidden = environment.localMap.get('mex_vsl_watched_seconds');
  environment.delayTimers(30000);

  assert.equal(environment.localMap.get('mex_vsl_watched_seconds'), watchedBeforeHidden);
  environment.setVisibility('visible');
  environment.advance(314000);
  assert.equal(environment.isContentLocked(), true);
  environment.advance(1000);
  assertGateReleased(environment);
});

test('Gate 10 — visible recupera PLAYING sem novo onStateChange', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(100000);
  environment.setVisibility('hidden');
  environment.delayTimers(30000);
  environment.setVisibility('visible');

  // getPlayerState continua PLAYING; nenhum callback do YouTube é emitido.
  environment.advance(315000);
  assertGateReleased(environment);
});

test('Gate 11 — reload preserva 300s e libera após mais 115s', () => {
  const first = createEnvironment();
  startPlaying(first);
  first.advance(300000);
  first.pagehide();

  const reloaded = createEnvironment({ localMap: first.localMap });
  assert.equal(reloaded.isContentLocked(), true);
  startPlaying(reloaded);
  reloaded.advance(115000);
  assertGateReleased(reloaded);
});

test('Gate 12 — localStorage indisponível permanece fail-open', () => {
  const environment = createEnvironment({ localStorageUnavailable: true });
  assert.equal(environment.isContentLocked(), false);
  assert.doesNotThrow(() => {
    startPlaying(environment);
    environment.advance(415000);
  });
  assert.equal(environment.isContentLocked(), false);
});

test('Gate 13 — player sem ready preserva watchdog fail-open', () => {
  const environment = createEnvironment();
  environment.clickVslWithoutReady();
  environment.delayTimers(15000);
  assertGateReleased(environment);
});

test('Gate 14 — mobile usa vídeo correto e libera em 415s', () => {
  const environment = createEnvironment({ desktop: false });
  startPlaying(environment);
  assert.equal(environment.playerConfig().videoId, 'zyZgphLLg-Y');
  environment.advance(415000);
  assertGateReleased(environment);
});

test('Gate 15 — desktop usa vídeo correto e libera em 415s', () => {
  const environment = createEnvironment({ desktop: true });
  startPlaying(environment);
  assert.equal(environment.playerConfig().videoId, 'a4tbLBVzkOs');
  environment.advance(415000);
  assertGateReleased(environment);
});
