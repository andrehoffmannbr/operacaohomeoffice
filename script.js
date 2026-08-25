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

  function getContentGateSeconds() {
    var isDesktop = window.matchMedia && window.matchMedia(VSL_DESKTOP_BREAKPOINT).matches;
    return isDesktop ? CONTENT_GATE_SECONDS_DESKTOP : CONTENT_GATE_SECONDS_MOBILE;
  }

  // Link de checkout do Kiwify — usado em todos os botões de compra da
  // página (oferta rápida, Investimento e chamada final). O mesmo link já
  // está fixo no href de cada botão no HTML; aqui ele só é reescrito para
  // carregar os parâmetros de aquisição junto (ver withTrackingParams).
  var KIWIFY_CHECKOUT_URL = 'https://pay.kiwify.com.br/kuEkae8';

  // Parâmetros de aquisição repassados da URL da landing para o checkout.
  // Sem isso a venda chega no Kiwify sem origem e não dá pra atribuir
  // faturamento a campanha/criativo.
  var CHECKOUT_PASSTHROUGH_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'src'
  ];

  // WhatsApp — número no formato internacional, só dígitos (ex: 5511999999999).
  var WHATSAPP_NUMERO = '5548988430812';
  var WHATSAPP_MENSAGEM = 'Oi! Vi a página do Método Express e queria saber mais.';

  /* ============================================================
     Utilitários de rastreamento.
     ============================================================ */

  // Repassa os parâmetros de aquisição da URL atual para o checkout, sem
  // nunca sobrescrever um parâmetro que já venha no próprio link do Kiwify.
  // Qualquer falha devolve a URL original — o CTA jamais quebra por causa
  // de rastreamento.
  function withTrackingParams(baseUrl) {
    try {
      if (typeof window.URL !== 'function' || typeof window.URLSearchParams !== 'function') {
        return baseUrl;
      }

      var incoming = new window.URLSearchParams(window.location.search);
      var target = new window.URL(baseUrl, window.location.href);

      for (var i = 0; i < CHECKOUT_PASSTHROUGH_PARAMS.length; i++) {
        var name = CHECKOUT_PASSTHROUGH_PARAMS[i];
        var value = incoming.get(name);
        if (value && !target.searchParams.has(name)) {
          target.searchParams.set(name, value);
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

    function release() {
      if (unlocked) return;
      unlocked = true;
      stop();
      write(CONTENT_GATE_KEY_UNLOCKED, '1');
      write(CONTENT_GATE_KEY_WATCHED, String(required));
      root.classList.remove('content-locked');
    }

    function tick() {
      var now = Date.now();
      var delta = (now - lastTick) / 1000;
      lastTick = now;

      // Só credita intervalos plausíveis. Um salto grande significa aba em
      // segundo plano com timer estrangulado, ou máquina que dormiu — nada
      // disso é vídeo assistido, então não conta.
      if (delta > 0 && delta <= 5) watched += delta;

      if (watched >= required) {
        release();
        return;
      }
      if (watched - persisted >= 5) persist();
    }

    function start() {
      if (unlocked || ticker) return;
      lastTick = Date.now();
      ticker = setInterval(tick, 1000);
    }

    // Fechar/esconder a aba não pode perder os segundos ainda não gravados.
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') stop();
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
      isUnlocked: function () { return unlocked; }
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
        ytPlayer = new window.YT.Player('ytTarget', {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            cc_load_policy: 1
          },
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
              if (gate) gate.setPlaying(isPlaying);
            }
          }
        });
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
     Links dinâmicos — checkout do Kiwify e WhatsApp.

     Os dois já nascem com o href real no HTML: se este arquivo falhar,
     os botões continuam levando pro lugar certo. Aqui só acrescentamos
     os parâmetros de aquisição e os eventos do Meta Pixel.
     ============================================================ */

  function initLinks() {
    var checkoutUrl = withTrackingParams(KIWIFY_CHECKOUT_URL);

    var ctaButtons = [
      document.getElementById('ctaQuickOffer'),
      document.getElementById('ctaInvestimento'),
      document.getElementById('ctaFinal')
    ];
    ctaButtons.forEach(function (btn) {
      if (!btn) return;
      btn.href = checkoutUrl;
      btn.addEventListener('click', function () {
        trackPixel('InitiateCheckout');
      });
    });

    var whatsappBtn = document.getElementById('whatsappFloat');
    if (whatsappBtn) {
      whatsappBtn.href = 'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(WHATSAPP_MENSAGEM);
      whatsappBtn.addEventListener('click', function () {
        trackPixel('Contact');
      });
    }
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

    safeInit('initVsl', function () { initVsl(gate); });
    safeInit('initFaq', initFaq);
    safeInit('initLinks', initLinks);
    safeInit('initFooterYear', initFooterYear);
    safeInit('initScrollReveal', initScrollReveal);
    safeInit('initStickyNav', initStickyNav);
  });
})();
