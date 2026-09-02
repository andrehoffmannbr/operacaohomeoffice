(function () {
  'use strict';

  /* ============================================================
     CONSTANTES — troque os valores abaixo antes de publicar.
     Veja o README.md para a lista completa de placeholders.
     ============================================================ */

  // Nova VSL oficial: o mesmo vídeo vertical é usado em todos os dispositivos.
  var VSL_VIDEO_URL = 'https://www.youtube.com/embed/fIDX2aD1TdQ';

  function getVslVideoUrl() {
    return VSL_VIDEO_URL;
  }

  // Ponto da oferta — quantos SEGUNDOS DE VSL EFETIVAMENTE ASSISTIDA até
  // emitir VSL_Offer. A landing é sempre visível; este contador existe
  // somente para preservar a semântica do tracking da apresentação.
  //
  // A transcrição automática do novo vídeo ainda não fornece um timestamp
  // auditável para a fala “Continue descendo a página”. Enquanto esse ponto
  // não for confirmado por revisão humana, VSL_Offer fica deliberadamente
  // desativado. Não estimar nem usar o antigo marco de 415 segundos.
  var VSL_OFFER_SECONDS = null;
  // As chaves são específicas da nova VSL para que progresso e milestones
  // legítimos do vídeo antigo não sejam reaproveitados no novo conteúdo.
  // As chaves antigas não são removidas nem alteradas.
  var VSL_OFFER_KEY_WATCHED = 'mex_vsl_fIDX2aD1TdQ_watched_seconds';
  var VSL_TRACKING_KEY = 'metodoexpress_vsl_fIDX2aD1TdQ_events';

  function getVslOfferSeconds() {
    return VSL_OFFER_SECONDS;
  }

  // Link de checkout da Hotmart — usado em todos os botões de compra da
  // página (oferta rápida, Investimento e chamada final). O mesmo link já
  // está fixo no href de cada botão no HTML; aqui ele só é reescrito para
  // carregar os parâmetros de aquisição junto (ver withTrackingParams).
  var HOTMART_CHECKOUT_URL = 'https://pay.hotmart.com/G106758643C';

  // Host do checkout — usado pra decidir a quais links o rastreamento se
  // aplica. Só links da Hotmart recebem os parâmetros; WhatsApp e qualquer
  // outro link externo ficam intocados.
  var HOTMART_CHECKOUT_HOST = 'pay.hotmart.com';

  // Um link só é checkout da Hotmart quando o hostname bate exatamente.
  // indexOf() na URL inteira aceitaria coisas como
  // "pay.hotmart.com.outrodominio.com" ou "outro.com/?ref=pay.hotmart.com";
  // comparar hostname elimina esses casos — e também deixa de fora
  // hotmart.com e www.hotmart.com, que não são checkout.
  // URL inválida devolve false.
  function ehCheckoutHotmart(href) {
    try {
      if (typeof window.URL !== 'function') return false;
      return new window.URL(href, window.location.href).hostname === HOTMART_CHECKOUT_HOST;
    } catch (e) {
      return false;
    }
  }

  // Parâmetros de aquisição capturados da URL da landing e repassados ao
  // checkout. Sem isso a venda chega na Hotmart sem origem e não dá pra
  // atribuir faturamento a campanha/criativo.
  //
  // São os 7 parâmetros de rastreamento da Hotmart. Nada além disso é
  // capturado. s1/s2/s3 saíram na migração — eram da estratégia da Kiwify;
  // os IDs do Meta agora vão concatenados dentro de sck.
  //
  // Só dados de atribuição de marketing — nada de PII. Nunca acrescentar
  // nome, e-mail, telefone, documento, _fbc ou _fbp a esta lista.
  //
  // fbclid também NÃO entra aqui: ele é volátil e vive em
  // TRACKING_VOLATILE_PARAMS (logo abaixo), fora do storage.
  var TRACKING_PARAMS = [
    'src', 'sck',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
  ];

  // Só estes parâmetros caracterizam uma origem de campanha. A atribuição
  // salva só é substituída quando a URL traz pelo menos um deles — assim um
  // retorno direto não apaga a campanha paga anterior (last paid touch).
  //
  // Hoje é igual a TRACKING_PARAMS, porque todos os 7 declaram origem.
  // Segue como lista própria pra que um parâmetro futuro que não seja de
  // campanha não vire gatilho de substituição sem querer.
  var TRACKING_CAMPAIGN_PARAMS = [
    'src', 'sck',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
  ];

  // fbclid — o clique identificado do Facebook. Fica FORA de TRACKING_PARAMS
  // de propósito: é volátil, lido da URL da visita atual, propagado ao
  // checkout e NUNCA gravado no localStorage.
  //
  // Por que separado:
  //   1. Persistir por 30 dias devolveria um fbclid velho numa visita nova.
  //   2. Se entrasse na lista de campanha, uma chegada com só ?fbclid=...
  //      (link orgânico do Facebook/Instagram) substituiria atomicamente a
  //      atribuição paga anterior por um registro sem nenhuma UTM — quebrando
  //      a regra de last paid touch.
  // Fora do storage, ele acompanha a visita sem tocar na atribuição salva.
  var TRACKING_VOLATILE_PARAMS = ['fbclid'];

  // Valores voláteis desta visita. Preenchidos no boot por captureVolatile().
  var volatileParams = null;

  var TRACKING_STORAGE_KEY = 'metodoexpress_tracking';

  // Versão do formato salvo. Subiu de 1 pra 2 na migração Kiwify -> Hotmart:
  // registros v1 podiam conter s1/s2/s3, que não existem mais. Qualquer
  // registro com versão diferente é descartado na leitura, então nenhum dado
  // legado chega ao checkout da Hotmart.
  var TRACKING_STORAGE_VERSION = 2;
  var TRACKING_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 dias
  var TRACKING_VALUE_MAX = 200;                     // corta valor absurdo

  // Atribuição em uso nesta visita. Preenchida no boot por captureTracking().
  var trackingParams = null;

  // WhatsApp — número no formato internacional, só dígitos (ex: 5511999999999).
  var WHATSAPP_NUMERO = '554888742835';
  var WHATSAPP_MENSAGEM = 'Oi! Vi a página do Método Express e queria saber mais.';

  /* ============================================================
     Utilitários de rastreamento.
     ============================================================ */

  // Lê a atribuição salva. Devolve null se não existir, estiver corrompida
  // ou já tiver passado da validade (nesse caso também limpa a chave).
  function readStoredTracking() {
    try {
      var raw = window.localStorage.getItem(TRACKING_STORAGE_KEY);
      if (!raw) return null;

      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.params) return null;

      // Formato antigo (v1, era da Kiwify): descarta em vez de migrar.
      if (data.v !== TRACKING_STORAGE_VERSION) {
        window.localStorage.removeItem(TRACKING_STORAGE_KEY);
        return null;
      }

      var ts = Number(data.ts);
      if (!isFinite(ts) || ts <= 0 || (Date.now() - ts) > TRACKING_TTL_MS) {
        window.localStorage.removeItem(TRACKING_STORAGE_KEY);
        return null;
      }

      // Segunda linha de defesa: mesmo num registro com a versão certa, só
      // devolve chaves da whitelist atual. Se um s1/s2/s3 sobrar de qualquer
      // forma, ele morre aqui e nunca chega à Hotmart.
      var limpo = {};
      for (var i = 0; i < TRACKING_PARAMS.length; i++) {
        var nome = TRACKING_PARAMS[i];
        var valor = data.params[nome];
        if (typeof valor === 'string' && valor) limpo[nome] = valor;
      }

      return limpo;
    } catch (e) {
      return null;
    }
  }

  // Grava a atribuição junto com o carimbo de tempo que define a validade.
  // Sem localStorage (aba privada, cota cheia) segue sem persistir: a visita
  // atual continua funcionando, só não sobrevive ao reload.
  function writeStoredTracking(params) {
    try {
      window.localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify({
        v: TRACKING_STORAGE_VERSION,
        ts: Date.now(),
        params: params
      }));
    } catch (e) {
      // silêncio de propósito
    }
  }

  // Captura os parâmetros de rastreamento da URL de entrada.
  //
  // Regra de atribuição (last paid touch): a URL só substitui o que está
  // salvo quando traz pelo menos um parâmetro de campanha. A troca é atômica
  // — o conjunto inteiro é substituído de uma vez, nunca mesclado — pra não
  // misturar utm_source de uma campanha com utm_content de outra.
  //
  // Sem parâmetro de campanha na URL (retorno direto, reload), a atribuição
  // anterior é mantida intacta.
  function captureTracking() {
    var stored = readStoredTracking();

    try {
      if (typeof window.URLSearchParams !== 'function') return stored;

      var incoming = new window.URLSearchParams(window.location.search);
      var found = {};
      var temCampanha = false;

      for (var i = 0; i < TRACKING_PARAMS.length; i++) {
        var name = TRACKING_PARAMS[i];
        var value = incoming.get(name);
        if (value === null) continue;

        value = String(value).slice(0, TRACKING_VALUE_MAX);
        if (!value) continue;

        found[name] = value;
        if (TRACKING_CAMPAIGN_PARAMS.indexOf(name) !== -1) temCampanha = true;
      }

      if (!temCampanha) return stored;

      writeStoredTracking(found);
      return found;
    } catch (e) {
      return stored;
    }
  }

  // Lê da URL da visita atual os parâmetros voláteis (hoje só o fbclid).
  // Não toca no localStorage: nada aqui sobrevive ao fim da visita.
  function captureVolatile() {
    var found = {};
    try {
      if (typeof window.URLSearchParams !== 'function') return found;
      var incoming = new window.URLSearchParams(window.location.search);

      for (var i = 0; i < TRACKING_VOLATILE_PARAMS.length; i++) {
        var name = TRACKING_VOLATILE_PARAMS[i];
        var value = incoming.get(name);
        if (value === null) continue;

        value = String(value).slice(0, TRACKING_VALUE_MAX);
        if (!value) continue;

        found[name] = value;
      }
    } catch (e) {
      // silêncio de propósito
    }
    return found;
  }

  // Acrescenta a atribuição em uso à URL do checkout, sem nunca sobrescrever
  // um parâmetro que já venha no próprio link da Hotmart. É idempotente: se a
  // URL já tiver os parâmetros, nada é duplicado.
  //
  // Qualquer falha devolve a URL original — o CTA jamais quebra por causa de
  // rastreamento.
  function withTrackingParams(baseUrl) {
    try {
      if (typeof window.URL !== 'function' || typeof window.URLSearchParams !== 'function') {
        return baseUrl;
      }

      var params = trackingParams;
      var volateis = volatileParams;
      if (!params && !volateis) return baseUrl;

      var target = new window.URL(baseUrl, window.location.href);

      if (params) {
        for (var i = 0; i < TRACKING_PARAMS.length; i++) {
          var name = TRACKING_PARAMS[i];
          var value = params[name];
          if (!value) continue;
          if (target.searchParams.has(name)) continue;
          target.searchParams.set(name, value);
        }
      }

      if (volateis) {
        for (var v = 0; v < TRACKING_VOLATILE_PARAMS.length; v++) {
          var vName = TRACKING_VOLATILE_PARAMS[v];
          var vValue = volateis[vName];
          if (!vValue) continue;
          if (target.searchParams.has(vName)) continue;
          target.searchParams.set(vName, vValue);
        }
      }

      return target.toString();
    } catch (e) {
      return baseUrl;
    }
  }

  // Evento do Meta Pixel. O fbq é inicializado inline no <head> do index.html
  // e enfileira chamadas até o fbevents.js chegar, então basta checar se a
  // função existe. Um erro aqui nunca pode impedir o clique de seguir.
  function trackPixel(eventName) {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', eventName);
      }
    } catch (e) {
      // silêncio de propósito
    }
  }

  // Eventos de consumo da VSL são custom events: ficam separados do helper
  // de eventos padrão para não haver risco de transformar um milestone em
  // Purchase, Contact ou qualquer outro evento de otimização da campanha.
  function trackVslEvent(eventName, params) {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('trackCustom', eventName, params);
      }
    } catch (e) {
      // Tracking nunca pode afetar player, página ou checkout.
    }
  }

  function createVslTracking(offerProgress, getPlayer) {
    var milestoneDefinitions = [
      { eventName: 'VSL_25', percent: 25 },
      { eventName: 'VSL_50', percent: 50 },
      { eventName: 'VSL_75', percent: 75 },
      { eventName: 'VSL_90', percent: 90 }
    ];
    var allowedEvents = {
      VSL_Start: true,
      VSL_25: true,
      VSL_50: true,
      VSL_75: true,
      VSL_Offer: true,
      VSL_90: true
    };
    var sent = {};
    var effectiveSeconds = 0;
    var persistedEffectiveSeconds = 0;
    var playing = false;
    var countFromOwnClock = false;
    var ticker = null;
    var lastSampleAt = 0;
    var lastOfferWatched = getOfferWatchedSeconds();

    function getOfferWatchedSeconds() {
      if (!offerProgress || typeof offerProgress.getWatchedSeconds !== 'function') return null;
      var value = Number(offerProgress.getWatchedSeconds());
      return isFinite(value) && value >= 0 ? value : null;
    }

    function readState() {
      try {
        var raw = window.sessionStorage.getItem(VSL_TRACKING_KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        var events = parsed && Array.isArray(parsed.events) ? parsed.events : [];

        for (var i = 0; i < events.length; i++) {
          if (allowedEvents[events[i]]) sent[events[i]] = true;
        }

        var storedSeconds = Number(parsed && parsed.effective_seconds);
        if (isFinite(storedSeconds) && storedSeconds > 0) {
          effectiveSeconds = storedSeconds;
          persistedEffectiveSeconds = storedSeconds;
        }
      } catch (e) {
        // sessionStorage indisponível: deduplica em memória nesta carga.
      }
    }

    function persistState() {
      try {
        var events = [];
        for (var eventName in allowedEvents) {
          if (allowedEvents.hasOwnProperty(eventName) && sent[eventName]) {
            events.push(eventName);
          }
        }
        window.sessionStorage.setItem(VSL_TRACKING_KEY, JSON.stringify({
          events: events,
          effective_seconds: Math.round(effectiveSeconds * 10) / 10
        }));
        persistedEffectiveSeconds = effectiveSeconds;
      } catch (e) {
        // O Pixel e a VSL continuam funcionando sem storage.
      }
    }

    function playerNumber(methodName) {
      try {
        var currentPlayer = getPlayer();
        if (!currentPlayer || typeof currentPlayer[methodName] !== 'function') return 0;
        var value = Number(currentPlayer[methodName]());
        return isFinite(value) && value >= 0 ? value : 0;
      } catch (e) {
        return 0;
      }
    }

    function videoParams(percent) {
      var params = {
        video_time: Math.round(playerNumber('getCurrentTime')),
        video_duration: Math.round(playerNumber('getDuration'))
      };
      if (typeof percent === 'number') params.video_percent = percent;
      return params;
    }

    function emitOnce(eventName, params) {
      if (sent[eventName]) return;
      sent[eventName] = true;
      // Persiste antes do envio: callbacks repetidos ou um reload imediato não
      // conseguem enfileirar o mesmo evento duas vezes na mesma aba/sessão.
      persistState();
      trackVslEvent(eventName, params);
    }

    function checkMilestones() {
      var duration = playerNumber('getDuration');
      var currentTime = playerNumber('getCurrentTime');
      if (duration <= 0) return;

      for (var i = 0; i < milestoneDefinitions.length; i++) {
        var milestone = milestoneDefinitions[i];
        var threshold = duration * milestone.percent / 100;

        // Exige os dois sinais: playhead no ponto e tempo efetivamente tocado
        // suficiente. Assim, mesmo um seek externo não fabrica consumo.
        if (currentTime >= threshold && effectiveSeconds >= threshold) {
          emitOnce(milestone.eventName, videoParams(milestone.percent));
        }
      }
    }

    function sampleEffectiveTime() {
      if (!playing) return;

      var now = Date.now();
      var elapsed = lastSampleAt ? (now - lastSampleAt) / 1000 : 0;
      var offerWatched = getOfferWatchedSeconds();
      var offerDelta = offerWatched !== null && lastOfferWatched !== null
        ? offerWatched - lastOfferWatched
        : 0;

      // Reaproveita o contador seguro de reprodução. Quando houver um ponto
      // de oferta confirmado, esse contador para nele; os demais milestones
      // continuam pelo mesmo critério de PLAYING e relógio plausível.
      if (offerDelta > 0) {
        effectiveSeconds += offerDelta;
      } else if ((countFromOwnClock || (offerProgress && offerProgress.hasReached())) &&
                 elapsed > 0 && elapsed <= 5) {
        effectiveSeconds += elapsed;
      }

      lastSampleAt = now;
      lastOfferWatched = offerWatched;
      checkMilestones();

      if (effectiveSeconds - persistedEffectiveSeconds >= 5) persistState();
    }

    function stop() {
      if (playing) sampleEffectiveTime();
      playing = false;
      if (ticker) {
        clearInterval(ticker);
        ticker = null;
      }
      if (effectiveSeconds > persistedEffectiveSeconds) persistState();
    }

    function start() {
      if (playing) return;
      playing = true;
      lastSampleAt = Date.now();
      lastOfferWatched = getOfferWatchedSeconds();
      emitOnce('VSL_Start', videoParams());
      ticker = setInterval(sampleEffectiveTime, 1000);
    }

    readState();

    if (offerProgress && typeof offerProgress.onReached === 'function') {
      offerProgress.onReached(function (reason) {
        if (reason !== 'watched' && reason !== 'playhead' && reason !== 'ended') return;
        emitOnce('VSL_Offer', { gate_seconds: getVslOfferSeconds() });
      });
    }

    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      if (document.visibilityState !== 'visible') return;

      try {
        var currentPlayer = getPlayer();
        if (!currentPlayer || !window.YT || !window.YT.PlayerState ||
            typeof currentPlayer.getPlayerState !== 'function') return;

        if (currentPlayer.getPlayerState() === window.YT.PlayerState.PLAYING) {
          // O contador permanece parado. O tracking recomeça deste instante,
          // sem creditar o tempo em que a aba ficou escondida.
          countFromOwnClock = true;
          start();
        }
      } catch (e) {
        // Player/API indisponível nunca pode afetar a VSL.
      }
    });

    return {
      setPlaying: function (isPlaying) {
        countFromOwnClock = false;
        if (isPlaying) start();
        else stop();
      },
      ended: function () {
        stop();
        checkMilestones();
      }
    };
  }

  /* ============================================================
     Progresso do ponto da oferta. Acumula tempo REAL de reprodução e avisa
     o tracking apenas quando houver um timestamp confirmado. Não controla
     visibilidade, acesso ou layout da landing. Deixar a aba aberta não conta.
     ============================================================ */

  function createVslOfferProgress() {
    var configuredSeconds = Number(getVslOfferSeconds());
    var offerEnabled = isFinite(configuredSeconds) && configuredSeconds > 0;
    var required = offerEnabled ? configuredSeconds : Infinity;
    var watched = 0;
    var persisted = 0;
    var reached = false;
    var ticker = null;
    var lastTick = 0;
    var reachedListeners = [];
    var getPlayer = null;
    var lastPlayerTime = null;
    var confirmedPlayerSeconds = 0;
    var hiddenPlayerTime = null;
    var ignoredPlayerSeconds = 0;

    function readPlayer() {
      try {
        if (typeof getPlayer !== 'function' || !window.YT || !window.YT.PlayerState) {
          return null;
        }
        var currentPlayer = getPlayer();
        if (!currentPlayer || typeof currentPlayer.getPlayerState !== 'function' ||
            typeof currentPlayer.getCurrentTime !== 'function') return null;

        var currentTime = Number(currentPlayer.getCurrentTime());
        if (!isFinite(currentTime) || currentTime < 0) return null;
        return {
          currentTime: currentTime,
          state: currentPlayer.getPlayerState()
        };
      } catch (e) {
        return null;
      }
    }

    function read(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }

    function write(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        // O tracking continua em memória quando o storage está indisponível.
      }
    }

    watched = parseFloat(read(VSL_OFFER_KEY_WATCHED));
    if (!isFinite(watched) || watched < 0) watched = 0;
    persisted = watched;
    if (watched >= required) reached = true;

    function persist() {
      write(VSL_OFFER_KEY_WATCHED, String(Math.round(watched)));
      persisted = watched;
    }

    function stop() {
      if (!ticker) return;
      clearInterval(ticker);
      ticker = null;
      if (watched > persisted) persist();
    }

    function reach(reason) {
      if (!offerEnabled || reached) return;
      reached = true;
      stop();
      write(VSL_OFFER_KEY_WATCHED, String(required));

      for (var i = 0; i < reachedListeners.length; i++) {
        try { reachedListeners[i](reason); } catch (e) { /* tracking opcional */ }
      }
    }

    function tick() {
      var now = Date.now();
      var delta = (now - lastTick) / 1000;
      lastTick = now;
      var player = readPlayer();
      var playerDelta = 0;
      var isVisible = document.visibilityState !== 'hidden';

      if (player) {
        if (lastPlayerTime !== null) playerDelta = player.currentTime - lastPlayerTime;
        lastPlayerTime = player.currentTime;
      } else {
        lastPlayerTime = null;
      }

      // Evidência independente do contador principal: só aceita avanço do
      // playhead compatível com o tempo realmente decorrido em PLAYING+visible.
      // Um seek de centenas de segundos em um callback de 1s credita no máximo 1s.
      if (isVisible && delta > 0 && player &&
          player.state === window.YT.PlayerState.PLAYING && playerDelta > 0) {
        confirmedPlayerSeconds += Math.min(playerDelta, delta);
      }

      // No caminho normal preserva o contador existente. Se o callback atrasar
      // mais de 5s, só recupera o tempo confirmado pelo avanço real do player,
      // limitado ao wall clock: seek artificial nunca credita o salto inteiro.
      if (isVisible && delta > 0 && delta <= 5 &&
          (!player || player.state === window.YT.PlayerState.PLAYING)) {
        watched += delta;
      } else if (isVisible && delta > 5 && player &&
                 player.state === window.YT.PlayerState.PLAYING && playerDelta > 0) {
        watched += Math.min(playerDelta, delta);
      }

      if (watched >= required) {
        reach('watched');
        return;
      }

      // Segunda fonte de verdade comercial. Dois segundos de progressão real
      // observada bastam para rejeitar um salto instantâneo quando o timestamp
      // da oferta estiver configurado.
      // Qualquer avanço ocorrido em hidden é descontado do playhead elegível.
      if (isVisible && player && player.state === window.YT.PlayerState.PLAYING &&
          (player.currentTime - ignoredPlayerSeconds) >= required &&
          confirmedPlayerSeconds >= Math.min(required, 2)) {
        reach('playhead');
        return;
      }
      if (watched - persisted >= 5) persist();
    }

    function start() {
      if (reached || ticker) return;
      lastTick = Date.now();
      var player = readPlayer();
      lastPlayerTime = player ? player.currentTime : null;
      ticker = setInterval(tick, 1000);
    }

    // Fechar/esconder a aba não pode perder os segundos ainda não gravados.
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        var player = readPlayer();
        hiddenPlayerTime = player ? player.currentTime : null;
        stop();
        return;
      }
      if (document.visibilityState !== 'visible') return;

      var player = readPlayer();
      if (player && hiddenPlayerTime !== null && player.currentTime > hiddenPlayerTime) {
        ignoredPlayerSeconds += player.currentTime - hiddenPlayerTime;
      }
      hiddenPlayerTime = null;
      lastPlayerTime = player ? player.currentTime : null;

      // Não depende de um novo onStateChange depois que o browser retoma.
      if (player && player.state === window.YT.PlayerState.PLAYING) start();
    });

    return {
      setPlaying: function (isPlaying) {
        if (isPlaying) start();
        else stop();
      },
      reach: reach,
      hasReached: function () { return reached; },
      getWatchedSeconds: function () { return watched; },
      setPlayer: function (playerGetter) {
        if (typeof playerGetter === 'function') getPlayer = playerGetter;
      },
      onReached: function (listener) {
        if (typeof listener === 'function') reachedListeners.push(listener);
      }
    };
  }

  /* ============================================================
     VSL — carrega o player somente após o clique do usuário. Evita
     baixar a API pesada do YouTube (~500KB) na carga inicial.

     Antes do clique carrega somente o thumbnail oficial da VSL. A API e o
     player do YouTube continuam sendo criados apenas depois da interação
     explícita do usuário na própria superfície do player.

     A IFrame Player API preserva os eventos de consumo e deixa os controles
     nativos acessíveis, sem botão HTML ou tela intermediária sobre o vídeo.
     ============================================================ */

  function initVsl(offerProgress) {
    var player = document.getElementById('vslPlayer');
    if (!player) return;
    var startOverlay = document.getElementById('vslStartOverlay');
    if (!startOverlay) return;

    var loaded = false;

    function extractYouTubeId(url) {
      var match = url.match(/embed\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    }

    function loadYouTubeApi(onReady) {
      if (window.YT && window.YT.Player) {
        onReady();
        return;
      }
      var previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (previous) previous();
        onReady();
      };
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    function createYouTubePlayer(videoId) {
      player.innerHTML = '<div class="vsl-yt-target" id="ytTarget"></div>';
      player.removeAttribute('role');
      player.removeAttribute('tabindex');

      var ytPlayer = null;
      var vslTracking = createVslTracking(offerProgress, function () { return ytPlayer; });

      loadYouTubeApi(function () {
        var playerVars = {
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3
        };
        if (window.location.origin && window.location.origin !== 'null') {
          playerVars.origin = window.location.origin;
        }

        ytPlayer = new window.YT.Player('ytTarget', {
          videoId: videoId,
          playerVars: playerVars,
          events: {
            onReady: function (event) {
              // A criação começou em um clique real. A tentativa de play é
              // consequência direta dessa interação; se o navegador a negar,
              // os controles nativos permanecem visíveis para um novo toque.
              try { event.target.playVideo(); } catch (e) { /* play negado */ }
            },
            onStateChange: function (event) {
              var isPlaying = event.data === window.YT.PlayerState.PLAYING;
              // O ponto da oferta só acumula enquanto o vídeo está tocando.
              if (offerProgress) {
                offerProgress.setPlaying(isPlaying);
                if (event.data === window.YT.PlayerState.ENDED && getVslOfferSeconds() !== null) {
                  offerProgress.reach('ended');
                }
              }
              vslTracking.setPlaying(isPlaying);
              if (event.data === window.YT.PlayerState.ENDED) vslTracking.ended();
            }
          }
        });
        if (offerProgress && typeof offerProgress.setPlayer === 'function') {
          offerProgress.setPlayer(function () { return ytPlayer; });
        }
      });
    }

    function loadVideo(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (loaded) return;
      var videoUrl = getVslVideoUrl();
      if (!videoUrl) return;
      loaded = true;

      var isYouTube = videoUrl.indexOf('youtube.com') !== -1;
      var isVimeo = videoUrl.indexOf('vimeo.com') !== -1;

      if (isYouTube) {
        var videoId = extractYouTubeId(videoUrl);
        if (videoId) {
          createYouTubePlayer(videoId);
          return;
        }
      }

      var el;
      if (isYouTube || isVimeo) {
        el = document.createElement('iframe');
        el.src = videoUrl + (videoUrl.indexOf('?') === -1 ? '?' : '&') + 'rel=0';
        el.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        el.setAttribute('allowfullscreen', '');
        el.setAttribute('title', 'Vídeo: Método Express');
      } else {
        el = document.createElement('video');
        el.src = videoUrl;
        el.controls = true;
        el.playsInline = true;
        // Vídeo próprio: alimenta o contador do ponto da oferta pelos eventos nativos.
        el.addEventListener('play', function () { if (offerProgress) offerProgress.setPlaying(true); });
        el.addEventListener('pause', function () { if (offerProgress) offerProgress.setPlaying(false); });
        el.addEventListener('ended', function () { if (offerProgress) offerProgress.setPlaying(false); });
      }

      player.innerHTML = '';
      player.appendChild(el);
      player.removeAttribute('role');
      player.removeAttribute('tabindex');
      if (!isYouTube && !isVimeo && typeof el.play === 'function') {
        try { el.play(); } catch (e) { /* controles permanecem disponíveis */ }
      }
    }

    // O link cobre exatamente a área do player e exibe apenas a thumbnail
    // oficial. Clique ou Enter carregam um único player no mesmo espaço.
    startOverlay.addEventListener('click', loadVideo);
  }

  /* ============================================================
     FAQ — acordeão simples.
     ============================================================ */

  function initFaq() {
    var questions = document.querySelectorAll('.faq-question');
    var items = [];

    Array.prototype.forEach.call(questions, function (button) {
      var answer = button.nextElementSibling;
      // Sem a resposta ao lado não há o que abrir — evita quebrar tudo se
      // o HTML mudar de forma.
      if (!answer || !answer.classList || !answer.classList.contains('faq-answer')) return;

      button.addEventListener('click', function () {
        var isOpen = button.getAttribute('aria-expanded') === 'true';

        button.setAttribute('aria-expanded', String(!isOpen));
        answer.style.maxHeight = isOpen ? null : answer.scrollHeight + 'px';
      });

      items.push({ button: button, answer: answer });
    });

    if (!items.length) return;

    // Girar o celular com uma resposta aberta refluía o texto, mas o
    // max-height em pixels ficava congelado no valor do clique e cortava o
    // final da resposta. Recalcula depois que o resize assenta.
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        items.forEach(function (item) {
          if (item.button.getAttribute('aria-expanded') !== 'true') return;
          item.answer.style.maxHeight = 'none';
          var height = item.answer.scrollHeight;
          item.answer.style.maxHeight = height + 'px';
        });
      }, 150);
    });
  }

  /* ============================================================
     Links dinâmicos — checkout da Hotmart e WhatsApp.

     Os dois já nascem com o href real no HTML: se este arquivo falhar,
     os botões continuam levando pro lugar certo. Aqui só acrescentamos
     os parâmetros de aquisição e o evento Contact do Meta Pixel.

     Os CTAs de compra NÃO disparam InitiateCheckout. Quem é fonte oficial
     desse evento é a própria Hotmart, quando a página de pagamento carrega
     (configurado lá via WEB + API de Conversões). Disparar aqui também
     geraria dois eventos para uma única ida ao checkout.
     ============================================================ */

  function initLinks() {
    var checkoutUrl = withTrackingParams(HOTMART_CHECKOUT_URL);

    // Dois CTAs de compra na V2.1: o da oferta e o da chamada final.
    var ctaButtons = [
      document.getElementById('ctaInvestimento'),
      document.getElementById('ctaFinal')
    ];
    ctaButtons.forEach(function (btn) {
      if (!btn) return;
      btn.href = checkoutUrl;
    });

    // Suporte por WhatsApp. Na V2 não existe mais botão flutuante: é um link
    // discreto no fim da página, pra não competir com o CTA de compra. O
    // evento Contact continua saindo daqui — e só daqui, num clique real.
    var whatsappBtn = document.getElementById('whatsappSuporte');
    if (whatsappBtn) {
      whatsappBtn.href = 'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(WHATSAPP_MENSAGEM);
      whatsappBtn.addEventListener('click', function () {
        trackPixel('Contact');
      });
    }

    // Rede de segurança: reaplica a atribuição no instante do clique.
    //
    // Os dois CTAs já nascem com o href certo (acima), então isto é
    // redundante no caminho normal — existe pra cobrir o caso de um link de
    // checkout que apareça ou mude depois da carga.
    //
    // Fase de captura, pra rodar antes da navegação. Só toca em links da
    // Hotmart: WhatsApp e qualquer outro link externo ficam intocados.
    // withTrackingParams é idempotente, então reaplicar não duplica nada.
    document.addEventListener('click', function (event) {
      try {
        var el = event.target;
        if (!el || typeof el.closest !== 'function') return;

        var link = el.closest('a[href]');
        if (!link) return;
        if (!ehCheckoutHotmart(link.href)) return;

        var atualizado = withTrackingParams(link.href);
        if (atualizado !== link.href) link.href = atualizado;
      } catch (e) {
        // nunca impedir o clique de seguir
      }
    }, true);
  }

  /* ============================================================
     Rodapé — ano atual.
     ============================================================ */

  function initFooterYear() {
    var el = document.getElementById('anoAtual');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ============================================================
     Pôsteres dos depoimentos — carregados só perto da viewport.

     O atributo `poster` de um <video> NÃO é lazy: o navegador busca a
     imagem com prioridade Medium já na carga, mesmo com o vídeo no fim da
     página. Os dois pôsteres juntos (~61KB) disputavam banda com as fontes
     no caminho crítico e atrasavam o LCP do herói.

     Por isso eles nascem em data-poster e só viram poster de verdade quando
     a seção se aproxima da tela. Sem IntersectionObserver, promove na hora:
     melhor uma imagem cedo do que um retângulo preto.
     ============================================================ */

  function initLazyPosters() {
    var videos = document.querySelectorAll('video[data-poster]');
    if (!videos.length) return;

    function promote(video) {
      var src = video.getAttribute('data-poster');
      if (!src) return;
      video.setAttribute('poster', src);
      video.removeAttribute('data-poster');
    }

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(videos, promote);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        promote(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '400px 0px' });

    Array.prototype.forEach.call(videos, function (video) { observer.observe(video); });
  }

  /* ============================================================
     Boot — cada init isolado, pra que uma falha não derrube as outras
     (antes, um erro no primeiro init deixava os CTAs sem link).
     ============================================================ */

  function safeInit(name, fn) {
    try {
      fn();
    } catch (e) {
      if (window.console && window.console.error) {
        window.console.error('[Método Express] falha em ' + name, e);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var offerProgress = null;
    safeInit('createVslOfferProgress', function () {
      offerProgress = createVslOfferProgress();
    });

    // Precisa rodar antes de initLinks: é quem preenche trackingParams.
    safeInit('captureTracking', function () {
      trackingParams = captureTracking();
      volatileParams = captureVolatile();
    });

    safeInit('initVsl', function () { initVsl(offerProgress); });
    safeInit('initFaq', initFaq);
    safeInit('initLinks', initLinks);
    safeInit('initLazyPosters', initLazyPosters);
    safeInit('initFooterYear', initFooterYear);
  });
})();
