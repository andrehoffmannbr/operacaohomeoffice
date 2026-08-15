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

  // Gate de conteúdo — quantos segundos de visita até liberar tudo abaixo do
  // vídeo (headline, oferta rápida, resto da página). 415s = 6min55s.
  var CONTENT_GATE_SECONDS = 415;
  var CONTENT_GATE_STORAGE_KEY = 'mex_content_unlock_at';

  // Link de checkout do Kiwify — usado em todos os botões de compra da
  // página (oferta rápida, Investimento e chamada final).
  var KIWIFY_CHECKOUT_URL = 'https://pay.kiwify.com.br/kuEkae8';

  // WhatsApp — número no formato internacional, só dígitos (ex: 5511999999999).
  var WHATSAPP_NUMERO = '5548988430812';
  var WHATSAPP_MENSAGEM = 'Oi! Vi a página do Método Express e queria saber mais.';

  /* ============================================================
     VSL — carrega o player somente após o clique do usuário. Evita
     baixar a API pesada do YouTube (~500KB) na carga inicial — testamos
     autoplay mudo por JS e o custo de performance foi grande demais
     (Total Blocking Time e "Práticas recomendadas" do PageSpeed caíram
     bastante, e adiar o autoplay só piorava outras métricas).

     Sensação de "vídeo já ligado" fica por conta só da animação leve
     (zoom lento) na thumbnail, via CSS puro — ver .vsl-player::before
     mais abaixo no <style>. Se um clipe curto em loop (mudo, poucos
     segundos) for gravado depois, dá pra trocar essa animação por um
     <video autoplay muted loop> de verdade, ainda mais convincente e
     tão leve quanto (sem JavaScript pesado, só um arquivo de mídia).

     Para YouTube especificamente, usa a IFrame Player API (em vez de
     um <iframe> comum) para desligar os controles nativos — sem barra
     de progresso, só dá pra pausar/retomar pelo botão que cobre o
     vídeo, nunca avançar o tempo. Vimeo e vídeo próprio (self-hosted)
     continuam com o fallback simples de iframe/<video>.
     ============================================================ */

  function initVsl() {
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
      player.innerHTML =
        '<div class="vsl-yt-target" id="ytTarget"></div>' +
        '<button type="button" class="vsl-toggle-overlay" id="vslToggle" data-state="playing" aria-label="Pausar vídeo">' +
          '<span class="vsl-toggle-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</span>' +
        '</button>';
      player.removeAttribute('role');
      player.removeAttribute('tabindex');

      var toggle = document.getElementById('vslToggle');
      var ytPlayer = null;

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
            cc_load_policy: 0
          },
          events: {
            onStateChange: function (event) {
              var isPaused = event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.CUED;
              toggle.setAttribute('data-state', isPaused ? 'paused' : 'playing');
              toggle.setAttribute('aria-label', isPaused ? 'Retomar vídeo' : 'Pausar vídeo');
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
      } else {
        el = document.createElement('video');
        el.src = videoUrl;
        el.controls = true;
        el.autoplay = true;
        el.playsInline = true;
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
     Gate de conteúdo — tudo abaixo do vídeo fica escondido até
     CONTENT_GATE_SECONDS de visita. O horário de liberação é salvo
     no localStorage, então persiste se a pessoa sair e voltar.
     Se o localStorage não estiver disponível, libera direto (fail-open).
     ============================================================ */

  function initContentGate() {
    try {
      var gateMs = CONTENT_GATE_SECONDS * 1000;
      var unlockAt = Number(localStorage.getItem(CONTENT_GATE_STORAGE_KEY));

      if (!unlockAt) {
        unlockAt = Date.now() + gateMs;
        localStorage.setItem(CONTENT_GATE_STORAGE_KEY, String(unlockAt));
      }

      var remaining = unlockAt - Date.now();
      if (remaining <= 0) return;

      document.body.classList.add('content-locked');
      setTimeout(function () {
        document.body.classList.remove('content-locked');
      }, remaining);
    } catch (e) {
      // localStorage indisponível (ex: modo privado) — não bloqueia o conteúdo.
    }
  }

  /* ============================================================
     FAQ — acordeão simples.
     ============================================================ */

  function initFaq() {
    var questions = document.querySelectorAll('.faq-question');

    questions.forEach(function (button) {
      var answer = button.nextElementSibling;

      button.addEventListener('click', function () {
        var isOpen = button.getAttribute('aria-expanded') === 'true';

        button.setAttribute('aria-expanded', String(!isOpen));
        answer.style.maxHeight = isOpen ? null : answer.scrollHeight + 'px';
      });
    });
  }

  /* ============================================================
     Links dinâmicos — Hotmart e WhatsApp.
     ============================================================ */

  function initLinks() {
    var ctaButtons = [
      document.getElementById('ctaQuickOffer'),
      document.getElementById('ctaInvestimento'),
      document.getElementById('ctaFinal')
    ];
    ctaButtons.forEach(function (btn) {
      if (btn) btn.href = KIWIFY_CHECKOUT_URL;
    });

    var whatsappBtn = document.getElementById('whatsappFloat');
    if (whatsappBtn) {
      whatsappBtn.href = 'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(WHATSAPP_MENSAGEM);
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

  document.addEventListener('DOMContentLoaded', function () {
    initContentGate();
    initVsl();
    initFaq();
    initLinks();
    initFooterYear();
    initScrollReveal();
    initStickyNav();
  });
})();
