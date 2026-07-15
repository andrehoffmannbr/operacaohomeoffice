(function () {
  'use strict';

  /* ============================================================
     CONSTANTES — troque os valores abaixo antes de publicar.
     Veja o README.md para a lista completa de placeholders.
     ============================================================ */

  // URL do vídeo (VSL). Ainda não gravado — deixe vazio até ter o vídeo pronto.
  // Exemplos de formato aceito:
  //   YouTube: 'https://www.youtube.com/embed/SEU_ID'
  //   Vimeo:   'https://player.vimeo.com/video/SEU_ID'
  //   Arquivo próprio: 'assets/videos/vsl.mp4'
  var VSL_VIDEO_URL = '';

  // Link de checkout do Hotmart.
  var HOTMART_CHECKOUT_URL = 'https://pay.hotmart.com/SEU_CODIGO_AQUI';

  // WhatsApp — número no formato internacional, só dígitos (ex: 5511999999999).
  var WHATSAPP_NUMERO = '5548988430812';
  var WHATSAPP_MENSAGEM = 'Oi! Vi a página do Método Express e queria saber mais.';

  /* ============================================================
     VSL — carrega o player somente após o clique do usuário.
     Evita baixar o script pesado do YouTube/Vimeo na carga inicial
     da página e garante que nunca haja autoplay.
     ============================================================ */

  function initVsl() {
    var player = document.getElementById('vslPlayer');
    if (!player) return;

    function loadVideo() {
      if (!VSL_VIDEO_URL) return;

      var isEmbed = VSL_VIDEO_URL.indexOf('youtube.com') !== -1 || VSL_VIDEO_URL.indexOf('vimeo.com') !== -1;
      var el;

      if (isEmbed) {
        el = document.createElement('iframe');
        el.src = VSL_VIDEO_URL + (VSL_VIDEO_URL.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1&rel=0';
        el.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        el.setAttribute('allowfullscreen', '');
        el.setAttribute('title', 'Vídeo: Método Express');
      } else {
        el = document.createElement('video');
        el.src = VSL_VIDEO_URL;
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
    var ctaButtons = [document.getElementById('ctaInvestimento'), document.getElementById('ctaFinal')];
    ctaButtons.forEach(function (btn) {
      if (btn) btn.href = HOTMART_CHECKOUT_URL;
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
    initVsl();
    initFaq();
    initLinks();
    initFooterYear();
    initScrollReveal();
    initStickyNav();
  });
})();
