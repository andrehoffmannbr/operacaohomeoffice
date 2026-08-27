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

  const root = { classList: createClassList() };
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

  function clickVsl() {
    vslPlayer.dispatch('click');
    assert.ok(playerConfig, 'YT.Player deve ser criado após o clique');
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
    customEvents,
    document,
    emitState,
    fakePlayer,
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
