(function () {
  'use strict';

  /* ============================================================
     CONSTANTES — troque os valores abaixo antes de publicar.
     Veja o README.md para a lista completa de placeholders.
     ============================================================ */

  // URL do vídeo (VSL) — um por dispositivo, já que o vídeo do mobile é
  // quadrado (1:1) e o do desktop é 16:9. A escolha entre os dois usa o
  // mesmo breakpoint (640px) do CSS — ver getVslVideoUrl() logo abaixo.
  // Exemplos de formato aceito pra cada constante:
  //   YouTube: 'https://www.youtube.com/embed/SEU_ID'
  //   Vimeo:   'https://player.vimeo.com/video/SEU_ID'
  //   Arquivo próprio: 'assets/videos/vsl.mp4'
  var VSL_VIDEO_URL_MOBILE = 'https://www.youtube.com/embed/zyZgphLLg-Y';
  var VSL_VIDEO_URL_DESKTOP = 'https://www.youtube.com/embed/a4tbLBVzkOs';
  var VSL_DESKTOP_BREAKPOINT = '(min-width: 640px)';

  function getVslVideoUrl() {
    var isDesktop = window.matchMedia && window.matchMedia(VSL_DESKTOP_BREAKPOINT).matches;
    return isDesktop ? VSL_VIDEO_URL_DESKTOP : VSL_VIDEO_URL_MOBILE;
  }

  // Gate de conteúdo — quantos SEGUNDOS DE VSL EFETIVAMENTE ASSISTIDA até
  // liberar tudo abaixo do vídeo (headline, oferta rápida, resto da página).
  // Conta só enquanto o player está de fato em PLAYING: deixar a aba aberta
  // sem assistir não libera nada. O progresso é acumulado no localStorage,
  // então recarregar a página continua de onde parou.
  //
  // Um valor por dispositivo, porque são dois cortes diferentes da VSL e
  // eles podem divergir de duração. Hoje os dois são iguais (415s = 6min55s);
  // a separação existe pra dar pra ajustar um sem mexer no outro. A escolha
  // usa o MESMO breakpoint da VSL (VSL_DESKTOP_BREAKPOINT).
  //
  // ATENÇÃO: os mesmos valores estão no script síncrono do <head> do
  // index.html (REQUIRED_SECONDS_MOBILE / REQUIRED_SECONDS_DESKTOP).
  // Se mudar aqui, mude lá também.
  var CONTENT_GATE_SECONDS_MOBILE = 415;
  var CONTENT_GATE_SECONDS_DESKTOP = 415;
  var CONTENT_GATE_KEY_WATCHED = 'mex_vsl_watched_seconds';
  var CONTENT_GATE_KEY_UNLOCKED = 'mex_content_unlocked';
  var VSL_TRACKING_KEY = 'metodoexpress_vsl_events';

  function getContentGateSeconds() {
    var isDesktop = window.matchMedia && window.matchMedia(VSL_DESKTOP_BREAKPOINT).matches;
    return isDesktop ? CONTENT_GATE_SECONDS_DESKTOP : CONTENT_GATE_SECONDS_MOBILE;
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
  // nome, e-mail, telefone, documento, fbclid, _fbc ou _fbp a esta lista.
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
  var WHATSAPP_NUMERO = '5548988430812';
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
      if (!params) return baseUrl;

      var target = new window.URL(baseUrl, window.location.href);

      for (var i = 0; i < TRACKING_PARAMS.length; i++) {
        var name = TRACKING_PARAMS[i];
        var value = params[name];
        if (!value) continue;
        if (target.searchParams.has(name)) continue;
        target.searchParams.set(name, value);
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
      // Tracking nunca pode afetar player, gate, página ou checkout.
    }
  }

  function createVslTracking(gate, getPlayer) {
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
    var lastGateWatched = getGateWatchedSeconds();

    function getGateWatchedSeconds() {
      if (!gate || typeof gate.getWatchedSeconds !== 'function') return null;
      var value = Number(gate.getWatchedSeconds());
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
      var gateWatched = getGateWatchedSeconds();
      var gateDelta = gateWatched !== null && lastGateWatched !== null
        ? gateWatched - lastGateWatched
        : 0;

      // Enquanto o gate está ativo, reaproveita exatamente o contador dele.
      // Depois de liberado ele para por design; para novas sessões com oferta
      // já aberta, mantém o mesmo critério PLAYING e relógio plausível.
      if (gateDelta > 0) {
        effectiveSeconds += gateDelta;
      } else if ((countFromOwnClock || (gate && gate.isUnlocked())) &&
                 elapsed > 0 && elapsed <= 5) {
        effectiveSeconds += elapsed;
      }

      lastSampleAt = now;
      lastGateWatched = gateWatched;
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
      lastGateWatched = getGateWatchedSeconds();
      emitOnce('VSL_Start', videoParams());
      ticker = setInterval(sampleEffectiveTime, 1000);
    }

    readState();

    if (gate && typeof gate.onRelease === 'function') {
      gate.onRelease(function (reason) {
        // Watchdogs e fallbacks continuam fail-open, mas não representam que
        // a pessoa chegou efetivamente ao ponto da oferta.
        if (reason !== 'watched' && reason !== 'playhead' && reason !== 'ended') return;
        emitOnce('VSL_Offer', { gate_seconds: getContentGateSeconds() });
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
          // O gate permanece parado. O tracking recomeça deste instante,
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
     Gate de conteúdo — parte 2 de 2. A parte 1 é o script síncrono no
     <head> do index.html, que aplica .content-locked no <html> antes do
     primeiro paint (sem ele, a página de vendas inteira piscava antes de
     travar).

     Aqui só acumulamos tempo REAL de reprodução da VSL e destravamos
     quando passa do alvo do dispositivo (getContentGateSeconds()).
     Deixar a aba aberta não conta.

     Não é antifraude — qualquer pessoa limpa o localStorage e recomeça.
     É controle de experiência da VSL, só isso.
     ============================================================ */

  function createContentGate() {
    var root = document.documentElement;
    var required = getContentGateSeconds();
    var storageOk = true;
    var watched = 0;
    var persisted = 0;
    var unlocked = false;
    var ticker = null;
    var lastTick = 0;
    var releaseListeners = [];
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
        storageOk = false;
        return null;
      }
    }

    function write(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        storageOk = false;
      }
    }

    // Avisa o <head> que assumimos o gate — desarma o watchdog de fail-open.
    if (typeof window.__mexGateTakeover === 'function') {
      window.__mexGateTakeover();
    }

    if (read(CONTENT_GATE_KEY_UNLOCKED) === '1' || !storageOk) {
      // Sem localStorage não há como acumular progresso: libera (fail-open).
      unlocked = true;
    } else {
      watched = parseFloat(read(CONTENT_GATE_KEY_WATCHED));
      if (!isFinite(watched) || watched < 0) watched = 0;
      persisted = watched;
      if (watched >= required) unlocked = true;
    }

    if (unlocked) root.classList.remove('content-locked');

    function persist() {
      write(CONTENT_GATE_KEY_WATCHED, String(Math.round(watched)));
      persisted = watched;
    }

    function stop() {
      if (!ticker) return;
      clearInterval(ticker);
      ticker = null;
      if (watched > persisted) persist();
    }

    function release(reason) {
      if (unlocked) return;
      unlocked = true;
      stop();
      write(CONTENT_GATE_KEY_UNLOCKED, '1');
      write(CONTENT_GATE_KEY_WATCHED, String(required));
      root.classList.remove('content-locked');

      for (var i = 0; i < releaseListeners.length; i++) {
        try { releaseListeners[i](reason); } catch (e) { /* tracking opcional */ }
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
        release('watched');
        return;
      }

      // Segunda fonte de verdade comercial. Como o player não oferece seek
      // manual, 2s de progressão real observada bastam para rejeitar um salto
      // instantâneo sem deixar um contador atrasado prender quem chegou a 415s.
      // Qualquer avanço ocorrido em hidden é descontado do playhead elegível.
      if (isVisible && player && player.state === window.YT.PlayerState.PLAYING &&
          (player.currentTime - ignoredPlayerSeconds) >= required &&
          confirmedPlayerSeconds >= Math.min(required, 2)) {
        release('playhead');
        return;
      }
      if (watched - persisted >= 5) persist();
    }

    function start() {
      if (unlocked || ticker) return;
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
      // Usado quando não há como observar a reprodução (player alternativo,
      // API do YouTube que não subiu). Melhor liberar do que deixar a
      // landing travada pra sempre.
      release: release,
      isUnlocked: function () { return unlocked; },
      getWatchedSeconds: function () { return watched; },
      setPlayer: function (playerGetter) {
        if (typeof playerGetter === 'function') getPlayer = playerGetter;
      },
      onRelease: function (listener) {
        if (typeof listener === 'function') releaseListeners.push(listener);
      }
    };
  }

  /* ============================================================
     VSL — carrega o player somente após o clique do usuário. Evita
     baixar a API pesada do YouTube (~500KB) na carga inicial — testamos
     autoplay mudo por JS e o custo de performance foi grande demais
     (Total Blocking Time e "Práticas recomendadas" do PageSpeed caíram
     bastante, e adiar o autoplay só piorava outras métricas).

     Antes do clique o card não carrega mídia nenhuma: é só fundo teal
     escuro, botão de play e legenda. Quando o clipe de preview real da
     VSL for gravado, ele volta como <video muted loop playsinline> com
     poster dentro do .vsl-player no index.html.

     Para YouTube especificamente, usa a IFrame Player API (em vez de
     um <iframe> comum) para desligar os controles nativos — sem barra
     de progresso, só dá pra pausar/retomar pelo botão que cobre o
     vídeo, nunca avançar o tempo. Vimeo e vídeo próprio (self-hosted)
     continuam com o fallback simples de iframe/<video>.
     ============================================================ */

  function initVsl(gate) {
    var player = document.getElementById('vslPlayer');
    if (!player) return;

    var loaded = false;

    function extractYouTubeId(url) {
      var match = url.match(/embed\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    }

    function togglePlayback(ytPlayer) {
      if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
      if (ytPlayer.getPlayerState() === window.YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
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
      // Nasce em "paused": o ícone de play fica visível até termos
      // CONFIRMAÇÃO de que o vídeo está tocando. Antes assumia "playing"
      // de cara e, quando o Safari/iOS recusava o autoplay, sobrava um
      // retângulo preto sem nenhuma indicação de que era pra clicar.
      player.innerHTML =
        '<div class="vsl-yt-target" id="ytTarget"></div>' +
        '<button type="button" class="vsl-toggle-overlay" id="vslToggle" data-state="paused" aria-label="Reproduzir vídeo">' +
          '<span class="vsl-toggle-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</span>' +
        '</button>';
      player.removeAttribute('role');
      player.removeAttribute('tabindex');

      var toggle = document.getElementById('vslToggle');
      var ytPlayer = null;
      var vslTracking = createVslTracking(gate, function () { return ytPlayer; });

      // Se a API do YouTube não subir (bloqueador, rede corporativa), o gate
      // nunca receberia tempo assistido e a página ficaria travada pra
      // sempre. Depois de 15s sem player pronto, libera o conteúdo.
      var apiWatchdog = setTimeout(function () {
        if (gate) gate.release();
      }, 15000);

      function setToggleState(isPlaying) {
        toggle.setAttribute('data-state', isPlaying ? 'playing' : 'paused');
        toggle.setAttribute('aria-label', isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo');
      }

      toggle.addEventListener('click', function (event) {
        event.stopPropagation();
        togglePlayback(ytPlayer);
      });

      loadYouTubeApi(function () {
        var playerVars = {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 1
        };
        if (window.location.origin && window.location.origin !== 'null') {
          playerVars.origin = window.location.origin;
        }

        ytPlayer = new window.YT.Player('ytTarget', {
          videoId: videoId,
          playerVars: playerVars,
          events: {
            onReady: function (event) {
              clearTimeout(apiWatchdog);

              // O player nasce dentro de um callback assíncrono, ou seja,
              // fora do gesto de clique — Safari/iOS podem recusar o
              // autoplay. Tentamos, e se em ~1,2s não estiver tocando,
              // deixamos o botão de play aparecendo pra pessoa clicar.
              try { event.target.playVideo(); } catch (e) { /* autoplay negado */ }

              setTimeout(function () {
                var state = -1;
                try { state = event.target.getPlayerState(); } catch (e) { /* ignora */ }
                setToggleState(state === window.YT.PlayerState.PLAYING);
              }, 1200);
            },
            onStateChange: function (event) {
              var isPlaying = event.data === window.YT.PlayerState.PLAYING;
              setToggleState(isPlaying);
              // O gate só acumula enquanto o vídeo está realmente tocando.
              if (gate) {
                gate.setPlaying(isPlaying);
                // Um ENDED emitido pelo player real é o último fail-safe:
                // quem terminou a VSL nunca pode continuar preso no gate.
                if (event.data === window.YT.PlayerState.ENDED) gate.release('ended');
              }
              vslTracking.setPlaying(isPlaying);
              if (event.data === window.YT.PlayerState.ENDED) vslTracking.ended();
            }
          }
        });
        if (gate && typeof gate.setPlayer === 'function') {
          gate.setPlayer(function () { return ytPlayer; });
        }
      });
    }

    function loadVideo() {
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
        el.src = videoUrl + (videoUrl.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1&rel=0';
        el.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        el.setAttribute('allowfullscreen', '');
        el.setAttribute('title', 'Vídeo: Método Express');
        // Num iframe genérico não dá pra observar o estado de reprodução,
        // então o gate não teria como avançar nunca. Libera o conteúdo.
        if (gate) gate.release();
      } else {
        el = document.createElement('video');
        el.src = videoUrl;
        el.controls = true;
        el.autoplay = true;
        el.playsInline = true;
        // Vídeo próprio: dá pra alimentar o gate direto pelos eventos nativos.
        el.addEventListener('play', function () { if (gate) gate.setPlaying(true); });
        el.addEventListener('pause', function () { if (gate) gate.setPlaying(false); });
        el.addEventListener('ended', function () { if (gate) gate.setPlaying(false); });
      }

      player.innerHTML = '';
      player.appendChild(el);
      player.removeAttribute('role');
      player.removeAttribute('tabindex');
    }

    player.addEventListener('click', loadVideo);
    player.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadVideo();
      }
    });
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

    var ctaButtons = [
      document.getElementById('ctaQuickOffer'),
      document.getElementById('ctaInvestimento'),
      document.getElementById('ctaFinal')
    ];
    ctaButtons.forEach(function (btn) {
      if (!btn) return;
      btn.href = checkoutUrl;
    });

    var whatsappBtn = document.getElementById('whatsappFloat');
    if (whatsappBtn) {
      whatsappBtn.href = 'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(WHATSAPP_MENSAGEM);
      whatsappBtn.addEventListener('click', function () {
        trackPixel('Contact');
      });
    }

    // Rede de segurança: reaplica a atribuição no instante do clique.
    //
    // Os três CTAs já nascem com o href certo (acima), então isto é
    // redundante no caminho normal — existe pra cobrir o caso de um link de
    // checkout que apareça ou mude depois da carga, já que a oferta só é
    // liberada minutos depois, quando o gate destrava.
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
     Scroll reveal — fade-in leve nas seções ao entrar na tela.
     ============================================================ */

  function initScrollReveal() {
    var targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================================
     Mini-header fixo — aparece só depois que passa do herói.
     ============================================================ */

  function initStickyNav() {
    var nav = document.getElementById('stickyNav');
    var hero = document.querySelector('.hero');
    if (!nav || !hero || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        nav.classList.toggle('is-visible', !entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-1px 0px 0px 0px' });

    observer.observe(hero);
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
    var gate;
    try {
      gate = createContentGate();
    } catch (e) {
      // Um gate quebrado nunca pode deixar a landing travada.
      document.documentElement.classList.remove('content-locked');
      gate = {
        setPlaying: function () {},
        release: function () {},
        isUnlocked: function () { return true; }
      };
    }

    // Precisa rodar antes de initLinks: é quem preenche trackingParams.
    safeInit('captureTracking', function () { trackingParams = captureTracking(); });

    safeInit('initVsl', function () { initVsl(gate); });
    safeInit('initFaq', initFaq);
    safeInit('initLinks', initLinks);
    safeInit('initFooterYear', initFooterYear);
    safeInit('initScrollReveal', initScrollReveal);
    safeInit('initStickyNav', initStickyNav);
  });
})();
