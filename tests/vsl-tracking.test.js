'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');
const SCRIPT_PATH = path.join(__dirname, '..', 'script.js');
const INDEX_SOURCE = fs.readFileSync(INDEX_PATH, 'utf8');
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');
const TRACKING_KEY = 'metodoexpress_vsl_fIDX2aD1TdQ_events';
const OFFER_KEY = 'mex_vsl_fIDX2aD1TdQ_watched_seconds';
// Fixture exclusivo da suíte: não representa o timestamp comercial da VSL.
const OFFER_TEST_SECONDS = 120;

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
    duration: options.duration || 149,
    playCalls: 0,
    pauseCalls: 0,
    getPlayerState() { return this.state; },
    getCurrentTime() { return this.currentTime; },
    getDuration() { return this.duration; },
    playVideo() { this.playCalls += 1; },
    pauseVideo() { this.pauseCalls += 1; }
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
  const toggle = createEventTarget({
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); }
  });
  const startOverlay = createEventTarget();
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
      if (id === 'vslStartOverlay') return startOverlay;
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

  const sourceUnderTest = options.offerSeconds
    ? SCRIPT_SOURCE.replace(
        'var VSL_OFFER_SECONDS = null;',
        `var VSL_OFFER_SECONDS = ${Number(options.offerSeconds)};`
      )
    : SCRIPT_SOURCE;
  vm.runInContext(sourceUnderTest, context, { filename: SCRIPT_PATH });
  document.dispatch('DOMContentLoaded');

  function clickVslWithoutReady() {
    startOverlay.dispatch('click');
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
    secondOverlayClick() { startOverlay.dispatch('click'); },
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

test('Thumbnail A/B — abre visível sem inicializar player ou VSL_Start', () => {
  const environment = createEnvironment();

  assert.match(INDEX_SOURCE, /id="vslStartOverlay"/);
  assert.match(INDEX_SOURCE, /i\.ytimg\.com\/vi\/fIDX2aD1TdQ\/hqdefault\.jpg/);
  assert.doesNotMatch(INDEX_SOURCE, /Ver o método funcionando|Com áudio/);
  assert.equal(environment.playerCount(), 0);
  assert.equal(environment.fakePlayer.playCalls, 0);
  assert.deepEqual(eventNames(environment), []);
});

test('Overlay C/F — clique e duplo clique criam somente um player', () => {
  const environment = createEnvironment();

  environment.clickVslWithoutReady();
  environment.secondOverlayClick();
  environment.secondOverlayClick();

  assert.equal(environment.playerCount(), 1);
  assert.deepEqual(eventNames(environment), []);
});

test('Overlay D/E — play parte de 0:00 e Start depende de PLAYING real', () => {
  const environment = createEnvironment();

  environment.clickVsl();
  assert.equal(environment.fakePlayer.currentTime, 0);
  assert.equal(environment.fakePlayer.playCalls, 1);
  assert.deepEqual(eventNames(environment), []);

  environment.emitState(1);
  environment.emitState(1);
  assert.deepEqual(eventNames(environment), ['VSL_Start']);
});

test('Player G/H — preserva 9:16 no mobile e desktop', () => {
  assert.match(INDEX_SOURCE, /\.vsl-player\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*16;/);
  assert.doesNotMatch(INDEX_SOURCE, /aspect-ratio:\s*16\s*\/\s*9;/);
  assert.match(INDEX_SOURCE, /\.vsl-launch,[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/);
});

test('Player I/J/K — landing segue aberta e Offer fica desativado sem timestamp', () => {
  const environment = createEnvironment();

  assert.equal(environment.isContentLocked(), false);
  startPlaying(environment);
  assert.equal(environment.isContentLocked(), false);
  environment.advance(149000);
  environment.emitState(0);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.match(SCRIPT_SOURCE, /var VSL_OFFER_SECONDS = null;/);
});

test('Overlay M/N — checkout, UTMs e WhatsApp permanecem intactos', () => {
  assert.equal((INDEX_SOURCE.match(/https:\/\/pay\.hotmart\.com\/G106758643C/g) || []).length, 2);
  assert.match(SCRIPT_SOURCE, /var HOTMART_CHECKOUT_URL = 'https:\/\/pay\.hotmart\.com\/G106758643C';/);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck']
    .forEach((name) => assert.match(SCRIPT_SOURCE, new RegExp(name)));
  assert.match(INDEX_SOURCE, /https:\/\/wa\.me\/554888742835/);
});

test('Overlay O — interação completa não gera exceção', () => {
  const environment = createEnvironment();

  assert.doesNotThrow(() => {
    environment.clickVsl();
    environment.secondOverlayClick();
    environment.emitState(1);
    environment.advance(1000);
  });
});

test('Página aberta 01 — nenhum mecanismo de content-locked permanece', () => {
  const environment = createEnvironment();

  assert.doesNotMatch(INDEX_SOURCE, /content-locked/);
  assert.doesNotMatch(SCRIPT_SOURCE, /content-locked/);
  assert.equal(environment.isContentLocked(), false);
});

test('Página aberta 02 — conteúdo comercial e 2 CTAs existem antes do play', () => {
  const environment = createEnvironment();

  assert.match(INDEX_SOURCE, /<main>/);
  assert.match(INDEX_SOURCE, /id="investimento"/);
  assert.match(INDEX_SOURCE, /id="faqList"/);
  assert.equal((INDEX_SOURCE.match(/https:\/\/pay\.hotmart\.com\/G106758643C/g) || []).length, 2);
  assert.equal(environment.playerCount(), 0);
  assert.deepEqual(eventNames(environment), []);
});

test('Página aberta 03 — reload antes de assistir segue aberto e sem Offer', () => {
  const first = createEnvironment();
  const reloaded = createEnvironment({ localMap: first.localMap });

  assert.equal(first.isContentLocked(), false);
  assert.equal(reloaded.isContentLocked(), false);
  assert.equal(eventNames(reloaded).includes('VSL_Offer'), false);
});

test('Página aberta 04 — storage legado não ativa Offer sem timestamp', () => {
  const localMap = new Map([['mex_content_unlocked', '1']]);
  const environment = createEnvironment({ localMap });

  assert.equal(environment.isContentLocked(), false);
  assert.deepEqual(eventNames(environment), []);
  startPlaying(environment);
  environment.advance(149000);
  environment.emitState(0);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Offer').length, 0);
  assert.equal(environment.localMap.get('mex_content_unlocked'), '1');
});

test('Página aberta 05 — ausência de mex_content_unlocked mantém tudo aberto', () => {
  const environment = createEnvironment();

  assert.equal(environment.localMap.has('mex_content_unlocked'), false);
  assert.equal(environment.isContentLocked(), false);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
});

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
  environment.fakePlayer.currentTime = 140;
  environment.advance(1000);
  assert.deepEqual(eventNames(environment), ['VSL_Start']);

  environment.fakePlayer.currentTime = 0;
  environment.advance(38000);
  assert.deepEqual(eventNames(environment), ['VSL_Start', 'VSL_25']);
});

test('D — 50% ocorre uma vez', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(75000);
  environment.emitState(2);
  environment.emitState(1);
  environment.advance(2000);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_50').length, 1);
});

test('E — 75% ocorre uma vez', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(112000);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_75').length, 1);
});

test('F — Offer não é fabricado enquanto o timestamp comercial estiver pendente', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(149000);
  environment.emitState(0);

  assert.equal(environment.customEvents().find((event) => event.name === 'VSL_Offer'), undefined);
  assert.equal(environment.localMap.has('mex_content_unlocked'), false);
  assert.equal(environment.localMap.has('mex_vsl_watched_seconds'), false);

  environment.advance(20000);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Offer').length, 0);
});

test('G — 90% ocorre uma vez e ENDED não cria VSL_100', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(135000);
  environment.emitState(0);
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_90').length, 1);
  assert.equal(eventNames(environment).includes('VSL_100'), false);
});

test('H — pause, resume e buffering não duplicam milestones', () => {
  const environment = createEnvironment();
  startPlaying(environment);
  environment.advance(38000);
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
  first.advance(135000);
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
  environment.advance(135000);
  assert.deepEqual(eventNames(environment), [
    'VSL_Start', 'VSL_25', 'VSL_50', 'VSL_75', 'VSL_90'
  ]);
});

test('K — storage legado não dispara Offer no carregamento', () => {
  const localMap = new Map([
    ['mex_content_unlocked', '1'],
    ['mex_vsl_watched_seconds', '415']
  ]);
  const environment = createEnvironment({ localMap });
  assert.equal(environment.isContentLocked(), false);
  assert.deepEqual(eventNames(environment), []);
  startPlaying(environment);
  environment.advance(10000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
});

test('L — Pixel indisponível falha silenciosamente', () => {
  const environment = createEnvironment({ pixelUnavailable: true });
  assert.doesNotThrow(() => {
    startPlaying(environment);
    environment.advance(149000);
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

function assertOfferReached(environment) {
  assert.equal(environment.isContentLocked(), false);
  assert.equal(environment.localMap.has('mex_content_unlocked'), false);
  assert.equal(environment.localMap.get(OFFER_KEY), String(OFFER_TEST_SECONDS));
  assert.equal(eventNames(environment).filter((name) => name === 'VSL_Offer').length, 1);
}

function watchWithDelayedCallbacks(delaySeconds) {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);

  for (let elapsed = 0; elapsed < 125; elapsed += delaySeconds) {
    environment.delayTimers(delaySeconds * 1000);
  }

  return environment;
}

test('Oferta 01 — PLAYING contínuo alcança o ponto configurado', () => {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  assert.equal(environment.isContentLocked(), false);
  startPlaying(environment);
  environment.advance(OFFER_TEST_SECONDS * 1000);
  assertOfferReached(environment);
});

test('Oferta 02 — callback atrasado 6s preserva tempo legítimo', () => {
  assertOfferReached(watchWithDelayedCallbacks(6));
});

test('Oferta 03 — callback atrasado 10s preserva tempo legítimo', () => {
  assertOfferReached(watchWithDelayedCallbacks(10));
});

test('Oferta 04 — callback atrasado 30s preserva tempo legítimo', () => {
  assertOfferReached(watchWithDelayedCallbacks(30));
});

test('Oferta 05 — playhead configurado alcança contador previamente atrasado', () => {
  const localMap = new Map([[OFFER_KEY, '90']]);
  const environment = createEnvironment({ localMap, offerSeconds: OFFER_TEST_SECONDS });
  environment.fakePlayer.currentTime = 118;
  startPlaying(environment);
  environment.delayTimers(2000);

  assert.equal(environment.fakePlayer.currentTime, OFFER_TEST_SECONDS);
  assertOfferReached(environment);
});

test('Oferta 06 — ENDED confirma o ponto quando ele está configurado', () => {
  const localMap = new Map([[OFFER_KEY, '100']]);
  const environment = createEnvironment({ localMap, offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  environment.fakePlayer.currentTime = 149;
  environment.emitState(0);

  assertOfferReached(environment);
});

test('Oferta 07 — PAUSED não conta e depois retoma', () => {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  environment.advance(60000);
  environment.emitState(2);
  environment.delayTimers(30000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.equal(environment.isContentLocked(), false);

  environment.emitState(1);
  environment.advance(59000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.equal(environment.isContentLocked(), false);
  environment.advance(1000);
  assertOfferReached(environment);
});

test('Oferta 08 — BUFFERING não conta e depois retoma', () => {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  environment.advance(60000);
  environment.emitState(3);
  environment.delayTimers(30000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.equal(environment.isContentLocked(), false);

  environment.emitState(1);
  environment.advance(59000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.equal(environment.isContentLocked(), false);
  environment.advance(1000);
  assertOfferReached(environment);
});

test('Oferta 09 — hidden não conta automaticamente', () => {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  environment.advance(30000);
  environment.setVisibility('hidden');
  const watchedBeforeHidden = environment.localMap.get(OFFER_KEY);
  environment.delayTimers(30000);

  assert.equal(environment.localMap.get(OFFER_KEY), watchedBeforeHidden);
  environment.setVisibility('visible');
  environment.advance(89000);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.equal(environment.isContentLocked(), false);
  environment.advance(1000);
  assertOfferReached(environment);
});

test('Oferta 10 — visible recupera PLAYING sem novo onStateChange', () => {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  environment.advance(30000);
  environment.setVisibility('hidden');
  environment.delayTimers(30000);
  environment.setVisibility('visible');

  // getPlayerState continua PLAYING; nenhum callback do YouTube é emitido.
  environment.advance(90000);
  assertOfferReached(environment);
});

test('Oferta 11 — reload preserva progresso e completa o ponto configurado', () => {
  const first = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(first);
  first.advance(80000);
  first.pagehide();

  const reloaded = createEnvironment({
    localMap: first.localMap,
    offerSeconds: OFFER_TEST_SECONDS
  });
  assert.equal(reloaded.isContentLocked(), false);
  startPlaying(reloaded);
  reloaded.advance(40000);
  assertOfferReached(reloaded);
});

test('Oferta 12 — localStorage indisponível mantém página aberta', () => {
  const environment = createEnvironment({
    localStorageUnavailable: true,
    offerSeconds: OFFER_TEST_SECONDS
  });
  assert.equal(environment.isContentLocked(), false);
  assert.doesNotThrow(() => {
    startPlaying(environment);
    environment.advance(OFFER_TEST_SECONDS * 1000);
  });
  assert.equal(environment.isContentLocked(), false);
});

test('Oferta 13 — player sem ready mantém página aberta e não fabrica Offer', () => {
  const environment = createEnvironment({ offerSeconds: OFFER_TEST_SECONDS });
  environment.clickVslWithoutReady();
  environment.delayTimers(15000);
  assert.equal(environment.isContentLocked(), false);
  assert.equal(eventNames(environment).includes('VSL_Offer'), false);
  assert.equal(environment.localMap.has('mex_content_unlocked'), false);
});

test('Oferta 14 — mobile usa a VSL única e alcança o ponto configurado', () => {
  const environment = createEnvironment({ desktop: false, offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  assert.equal(environment.playerConfig().videoId, 'fIDX2aD1TdQ');
  environment.advance(OFFER_TEST_SECONDS * 1000);
  assertOfferReached(environment);
});

test('Oferta 15 — desktop usa a mesma VSL e alcança o ponto configurado', () => {
  const environment = createEnvironment({ desktop: true, offerSeconds: OFFER_TEST_SECONDS });
  startPlaying(environment);
  assert.equal(environment.playerConfig().videoId, 'fIDX2aD1TdQ');
  environment.advance(OFFER_TEST_SECONDS * 1000);
  assertOfferReached(environment);
});
