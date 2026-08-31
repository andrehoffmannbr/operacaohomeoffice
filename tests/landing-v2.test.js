'use strict';

/**
 * Regressões da Landing V2.
 *
 * A V2 mudou a arquitetura comercial da página (mecanismo no lugar do
 * calendário de 7 dias, suporte no lugar do botão flutuante). Estes testes
 * travam as decisões que, se voltarem atrás sem querer, quebram conversão
 * ou rastreamento — sem duplicar o que tests/vsl-tracking.test.js e
 * tests/meta-pixel.test.js já cobrem em profundidade.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'script.js');

const INDEX_SOURCE = fs.readFileSync(INDEX_PATH, 'utf8');
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');

// Copy visível: sem os comentários de HTML, que explicam decisões e citam
// termos ("7 dias", "ctaQuickOffer") que não podem contar como conteúdo.
const INDEX_VISIBLE = INDEX_SOURCE.replace(/<!--[\s\S]*?-->/g, '');

// Markup do <body>: assertivas estruturais não devem tropeçar nos
// comentários de CSS do <head>, que citam tags ("<h1>") em prosa.
const INDEX_BODY = INDEX_VISIBLE.slice(INDEX_VISIBLE.indexOf('<body'));
const STYLE_SOURCE = INDEX_SOURCE.match(/<style>([\s\S]*?)<\/style>/)[1];

const CHECKOUT_URL = 'https://pay.hotmart.com/G106758643C';
const WHATSAPP_NUMBER = '554888742835';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/* ============================================================
   Estrutura e semântica
   ============================================================ */

test('V2 — a página tem exatamente um <h1>', () => {
  assert.equal(countOccurrences(INDEX_BODY, '<h1'), 1);

  const h1 = INDEX_BODY.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1, '<h1> não encontrado');
  assert.match(h1[1], /Pegue um print de um Instagram/);
  assert.match(h1[1], /Mostre ao dono como o perfil dele poderia ficar/);
});

test('V2 — o H1 preserva a copy e destaca somente o benefício em teal', () => {
  const h1 = INDEX_BODY.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1, '<h1> não encontrado');

  const text = h1[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(
    text,
    'Pegue um print de um Instagram. Use um prompt. Mostre ao dono como o perfil dele poderia ficar.'
  );
  assert.match(
    h1[1],
    /Use um prompt\. <span class="hero-headline-accent">Mostre ao dono como o perfil dele poderia ficar\.<\/span>/
  );
  assert.match(
    STYLE_SOURCE,
    /\.hero-headline-accent\s*\{[^}]*color:\s*var\(--color-accent-darker\)/
  );
});

test('V2 — o herói apresenta o mecanismo: 1 celular, 1 print, 1 prompt', () => {
  const hero = INDEX_SOURCE.match(/<header class="hero">[\s\S]*?<\/header>/);
  assert.ok(hero, 'herói não encontrado');

  assert.match(hero[0], />\s*1 celular\s*</);
  assert.match(hero[0], />\s*1 print\s*</);
  assert.match(hero[0], />\s*1 prompt\s*</);
  assert.match(hero[0], /Uma transformação para mostrar/);
  assert.match(hero[0], /Você não começa tentando convencer alguém\. Começa mostrando\./);

  // A primeira dobra não vende: sem preço e sem link de checkout no herói.
  assert.doesNotMatch(hero[0], /R\$\s*97/);
  assert.equal(countOccurrences(hero[0], CHECKOUT_URL), 0);
});

test('V2 — o antes/depois é vertical no mobile e lado a lado a partir de 640px', () => {
  assert.match(STYLE_SOURCE, /\.ba\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(
    STYLE_SOURCE,
    /@media \(min-width: 640px\)[\s\S]*?\.ba\s*\{[^}]*grid-template-columns:\s*1fr auto 1fr;/
  );
  assert.match(STYLE_SOURCE, /\.ba-shot\s*\{[^}]*width:\s*min\(100%, 260px\)/);

  const demonstracao = INDEX_SOURCE.match(/<section[^>]*id="demonstracao"[\s\S]*?<\/section>/);
  assert.ok(demonstracao, 'seção de demonstração não encontrada');
  assert.equal(countOccurrences(demonstracao[0], 'class="ba-shot'), 2, 'as imagens não podem ser duplicadas');
  assert.equal(countOccurrences(demonstracao[0], '<img '), 2, 'esperadas somente as imagens de antes e depois');
});

test('V2 — o mini-header fixo foi removido por completo', () => {
  assert.doesNotMatch(INDEX_SOURCE, /stickyNav/);
  assert.doesNotMatch(INDEX_SOURCE, /sticky-nav/);
  assert.doesNotMatch(SCRIPT_SOURCE, /initStickyNav/);
});

test('V2 — os dois mapas de execução mantêm a sequência aprovada', () => {
  const explicacao = INDEX_SOURCE.match(/<ol class="explain-flow"[\s\S]*?<\/ol>/);
  assert.ok(explicacao, 'mapa de 20 segundos não encontrado');

  let anterior = -1;
  for (const etapa of ['Encontre', 'Print', 'Prompt', 'Crie', 'Mostre']) {
    const posicao = explicacao[0].indexOf(`>${etapa}</h3>`);
    assert.ok(posicao > anterior, `etapa ausente ou fora de ordem: ${etapa}`);
    anterior = posicao;
  }

  const processo = INDEX_SOURCE.match(/<ul class="process-grid">[\s\S]*?<\/ul>/);
  assert.ok(processo, 'mapa de execução não encontrado');
  assert.equal(countOccurrences(processo[0], 'class="process-card"'), 6);
  assert.equal(countOccurrences(processo[0], 'class="process-number"'), 6);

  anterior = -1;
  for (const etapa of ['Encontrar', 'Criar', 'Mostrar', 'Abordar', 'Oferecer', 'Entregar']) {
    const posicao = processo[0].indexOf(`>${etapa}</h3>`);
    assert.ok(posicao > anterior, `processo ausente ou fora de ordem: ${etapa}`);
    anterior = posicao;
  }
});

test('V2 — a lapidação inclui transformação, portfólio e oportunidades sem nova etapa', () => {
  for (const trecho of [
    'O que muda nessa transformação?',
    'Bio mais clara',
    'Identidade visual mais consistente',
    'Destaques mais organizados',
    'Feed com aparência mais profissional',
    'Você não precisa esperar ter um portfólio completo',
    'Barbearias', 'Salões', 'Hamburguerias', 'Cafeterias', 'Lojas', 'Imobiliárias'
  ]) {
    assert.match(INDEX_VISIBLE, new RegExp(trecho), `texto estratégico ausente: ${trecho}`);
  }

  assert.ok(
    INDEX_SOURCE.indexOf('id="oportunidades-titulo"') < INDEX_SOURCE.indexOf('id="explicacao-titulo"'),
    'a faixa de oportunidades precisa aparecer antes do mapa de 20 segundos'
  );

  const explicacao = INDEX_SOURCE.match(/<ol class="explain-flow"[\s\S]*?<\/ol>/)[0];
  assert.equal(countOccurrences(explicacao, 'class="explain-step"'), 5, 'nenhuma etapa nova deve ser criada');
});

test('V2 — as seções aparecem na ordem especificada', () => {
  const ordem = [
    'id="demonstracao"',      // 2. antes/depois
    'id="vsl"',               // 3. VSL
    'id="explicacao-titulo"', // 4. como funciona
    'id="diferente-titulo"',  // 5. por que é diferente
    'id="ia-titulo"',         // 6. não precisa dominar IA
    'id="processo-titulo"',   // 7. você não recebe só aulas
    'id="depoimento1-titulo"',// 8. depoimento 1
    'id="autor-titulo"',      // 9. autoridade
    'id="depoimento2-titulo"',// 10. depoimento 2
    'id="investimento"',      // 11. oferta
    'id="garantia-titulo"',   // 12. garantia
    'id="faq-titulo"',        // 13. FAQ
    'id="final-titulo"'       // 14. CTA final
  ];

  let anterior = -1;
  for (const marcador of ordem) {
    const posicao = INDEX_SOURCE.indexOf(marcador);
    assert.notEqual(posicao, -1, `marcador ausente: ${marcador}`);
    assert.ok(posicao > anterior, `fora de ordem: ${marcador}`);
    anterior = posicao;
  }
});

/* ============================================================
   Promessa: mecanismo, não calendário
   ============================================================ */

test('V2 — "7 dias" aparece só na garantia, nunca como tempo de aprendizado', () => {
  assert.equal(countOccurrences(INDEX_VISIBLE, '7 dias'), 1);
  assert.match(INDEX_VISIBLE, /Você tem 7 dias para conhecer o Método Express\./);

  for (const proibido of [
    /em 7 dias/i,
    /7 dias de missões/i,
    /curso de 7 dias/i,
    /primeira renda/i,
    /renda garantida/i,
    /resultado garantido/i,
    /liberdade financeira/i
  ]) {
    assert.doesNotMatch(INDEX_VISIBLE, proibido, `copy proibida presente: ${proibido}`);
  }
});

test('V2 — a estrutura comercial por dias não voltou', () => {
  assert.doesNotMatch(INDEX_VISIBLE, /Dia\s*[1-7]\s*[—-]/);
  assert.doesNotMatch(INDEX_VISIBLE, /Os 7 dias/i);
  assert.doesNotMatch(INDEX_VISIBLE, /missão por dia/i);
});

test('V2 — só Prompt Raiz 1 e 2 são anunciados como material entregue', () => {
  assert.match(INDEX_VISIBLE, /Prompt Raiz 1/);
  assert.match(INDEX_VISIBLE, /Prompt Raiz 2/);

  // Nada de material inventado pra inflar valor percebido.
  for (const inventado of [/comunidade/i, /checklist/i, /\bbônus\b/i, /\bPDF\b/, /planilha/i]) {
    assert.doesNotMatch(INDEX_VISIBLE, inventado, `material não confirmado anunciado: ${inventado}`);
  }
});

test('V2 — não há urgência artificial nem âncora de preço', () => {
  assert.match(INDEX_VISIBLE, /R\$97/);
  assert.match(INDEX_VISIBLE, /Preço atual de acesso/);

  for (const proibido of [/últimas vagas/i, /vagas limitadas/i, /countdown/i, /<s>/, /<del>/, /de R\$\s*\d/i]) {
    assert.doesNotMatch(INDEX_VISIBLE, proibido, `urgência/âncora presente: ${proibido}`);
  }
});

test('V2 — a oferta explicita tudo o que está incluído antes do preço', () => {
  const oferta = INDEX_SOURCE.match(/<section[^>]*id="investimento"[\s\S]*?<\/section>/);
  assert.ok(oferta, 'oferta não encontrada');
  assert.match(
    oferta[0],
    /Você não está pagando para aprender “sobre IA”\. Está aprendendo a usar a IA para criar algo concreto/
  );

  const incluidos = oferta[0].match(/<ul class="offer-includes">[\s\S]*?<\/ul>/);
  assert.ok(incluidos, 'lista de itens incluídos não encontrada');
  assert.equal(countOccurrences(incluidos[0], '<li'), 7);

  for (const item of [
    'Processo completo', 'Prompt Raiz 1', 'Prompt Raiz 2',
    'Encontrar oportunidades', 'Criar e apresentar a transformação',
    'Abordar e oferecer', 'Entrega'
  ]) {
    assert.match(incluidos[0], new RegExp(item), `item ausente da oferta: ${item}`);
  }

  assert.ok(
    oferta[0].indexOf('<ul class="offer-includes">') < oferta[0].indexOf('R$97'),
    'os itens incluídos precisam aparecer antes do preço'
  );
});

/* ============================================================
   CTAs, WhatsApp e checkout
   ============================================================ */

test('V2 — exatamente 2 CTAs de compra da Hotmart', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, CHECKOUT_URL), 2);
  assert.match(INDEX_SOURCE, /id="ctaInvestimento"/);
  assert.match(INDEX_SOURCE, /id="ctaFinal"/);
});

test('V2 — a oferta rápida não voltou', () => {
  assert.doesNotMatch(INDEX_SOURCE, /ctaQuickOffer/);
  assert.doesNotMatch(SCRIPT_SOURCE, /getElementById\(['"]ctaQuickOffer['"]\)/);
});

test('V2 — o botão flutuante de WhatsApp foi removido', () => {
  assert.doesNotMatch(INDEX_SOURCE, /whatsappFloat/);
  assert.doesNotMatch(INDEX_SOURCE, /whatsapp-float/);
  assert.doesNotMatch(INDEX_SOURCE, /whatsapp-pulse/);
  assert.doesNotMatch(SCRIPT_SOURCE, /whatsappFloat/);
});

test('V2 — o suporte por WhatsApp existe, discreto, com o número correto', () => {
  assert.match(INDEX_SOURCE, /id="whatsappSuporte"/);
  assert.match(INDEX_SOURCE, new RegExp(`https://wa\\.me/${WHATSAPP_NUMBER}`));
  assert.match(INDEX_VISIBLE, /Ficou com alguma dúvida sobre acesso ou pagamento\?/);
  assert.match(INDEX_VISIBLE, /Fale com o suporte\./);
  assert.match(SCRIPT_SOURCE, new RegExp(`WHATSAPP_NUMERO = '${WHATSAPP_NUMBER}'`));
});

/* ============================================================
   Página aberta / VSL / Pixel
   ============================================================ */

test('V2 — nenhum gate de conteúdo permanece', () => {
  assert.doesNotMatch(INDEX_SOURCE, /content-locked/);
  assert.doesNotMatch(SCRIPT_SOURCE, /content-locked/);
});

test('V2 — o overlay da VSL não faz autoplay e mantém o player intacto', () => {
  assert.match(INDEX_SOURCE, /id="vslPlayer"/);
  assert.match(INDEX_SOURCE, /id="vslStartOverlay"/);
  assert.match(INDEX_SOURCE, />Ver o método funcionando</);
  assert.match(INDEX_SOURCE, /Com áudio\s*<\/span>/);

  // O <video>/<iframe> da VSL só nasce depois do clique, então não pode
  // existir atributo autoplay no HTML servido.
  assert.doesNotMatch(INDEX_SOURCE, /<(video|iframe)[^>]*\bautoplay\b/);
});

test('V2 — os milestones e o ponto de 415s da VSL continuam intactos', () => {
  for (const evento of ['VSL_Start', 'VSL_25', 'VSL_50', 'VSL_75', 'VSL_Offer', 'VSL_90']) {
    assert.match(SCRIPT_SOURCE, new RegExp(`'${evento}'`), `evento ausente: ${evento}`);
  }

  assert.match(SCRIPT_SOURCE, /VSL_OFFER_SECONDS_MOBILE = 415/);
  assert.match(SCRIPT_SOURCE, /VSL_OFFER_SECONDS_DESKTOP = 415/);
  assert.match(SCRIPT_SOURCE, /mex_vsl_watched_seconds/);

  // IDs do YouTube e breakpoint — a VSL V2 é outra tarefa.
  assert.match(SCRIPT_SOURCE, /youtube\.com\/embed\/zyZgphLLg-Y/);
  assert.match(SCRIPT_SOURCE, /youtube\.com\/embed\/a4tbLBVzkOs/);
  assert.match(SCRIPT_SOURCE, /VSL_DESKTOP_BREAKPOINT = '\(min-width: 640px\)'/);
});

test('V2 — o Meta Pixel dispara um PageView e carrega um fbevents.js', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, "fbq('track', 'PageView')"), 1);
  assert.equal(countOccurrences(INDEX_SOURCE, 'connect.facebook.net/en_US/fbevents.js'), 1);
  assert.equal(countOccurrences(INDEX_SOURCE, 'setTimeout(start, 1500)'), 1);
  assert.equal(countOccurrences(INDEX_SOURCE, "fbq('init', '3401433073361667')"), 1);
});

/* ============================================================
   Mídia e performance
   ============================================================ */

test('V2 — os vídeos de depoimento existem e ficam fora do caminho crítico', () => {
  for (const nome of ['depoimento-naldo.mp4', 'depoimento-amanda.mp4']) {
    const arquivo = path.join(ROOT, 'assets', 'videos', nome);
    assert.ok(fs.existsSync(arquivo), `asset ausente: assets/videos/${nome}`);
    assert.match(INDEX_SOURCE, new RegExp(`assets/videos/${nome.replace('.', '\\.')}`));
  }

  for (const nome of ['depoimento-naldo-poster.webp', 'depoimento-amanda-poster.webp']) {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'assets', 'images', nome)),
      `pôster ausente: assets/images/${nome}`
    );
  }

  assert.match(SCRIPT_SOURCE, /function initLazyPosters\(\)/);
  assert.match(SCRIPT_SOURCE, /safeInit\('initLazyPosters', initLazyPosters\)/);

  const videos = INDEX_SOURCE.match(/<video[^>]*>/g) || [];
  assert.equal(videos.length, 2, 'esperado exatamente 2 <video> de depoimento');

  for (const tag of videos) {
    assert.match(tag, /preload="none"/, `<video> sem preload="none": ${tag}`);
    // O atributo `poster` não é lazy: o navegador o busca com prioridade
    // Medium já na carga e isso atrasava o LCP do herói em ~120ms. Ele
    // precisa nascer em data-poster e ser promovido por initLazyPosters().
    assert.doesNotMatch(tag, /\sposter=/, `<video> com poster ansioso: ${tag}`);
    assert.match(tag, /data-poster="assets\/images\/[^"]+\.webp"/, `<video> sem data-poster: ${tag}`);
    assert.match(tag, /playsinline/, `<video> sem playsinline: ${tag}`);
    assert.match(tag, /controls/, `<video> sem controls: ${tag}`);
    assert.doesNotMatch(tag, /\bautoplay\b/, `<video> com autoplay: ${tag}`);
    // width/height explícitos: sem salto de layout quando o vídeo carrega.
    assert.match(tag, /width="\d+"/, `<video> sem width: ${tag}`);
    assert.match(tag, /height="\d+"/, `<video> sem height: ${tag}`);
  }
});

test('V2 — imagens abaixo da dobra são lazy e têm dimensões explícitas', () => {
  const imgs = INDEX_SOURCE.match(/<img[^>]*>/g) || [];
  const locais = imgs.filter((tag) => /src="assets\//.test(tag));
  assert.equal(locais.length, 4, 'esperado 4 imagens locais: antes, depois, pôster da VSL e foto do autor');

  for (const tag of locais) {
    assert.match(tag, /loading="lazy"/, `imagem sem lazy: ${tag}`);
    assert.match(tag, /width="\d+"/, `imagem sem width: ${tag}`);
    assert.match(tag, /height="\d+"/, `imagem sem height: ${tag}`);
  }

  // Na V2 o LCP é o <h1>: nenhuma imagem disputa prioridade no caminho crítico.
  assert.doesNotMatch(INDEX_SOURCE, /fetchpriority="high"/);
});

test('V2 — nenhuma dependência, framework ou CDN novo foi introduzido', () => {
  const scripts = INDEX_SOURCE.match(/<script[^>]*\bsrc=["'][^"']+["']/g) || [];
  assert.deepEqual(scripts.map((s) => s.match(/src=["']([^"']+)["']/)[1]), ['script.js']);

  assert.doesNotMatch(INDEX_SOURCE, /<link[^>]*rel=["']stylesheet["']/);

  for (const proibido of [
    /cdn\.jsdelivr/i, /cdnjs\./i, /unpkg\.com/i, /code\.jquery/i,
    /fonts\.googleapis/i, /fonts\.gstatic/i,
    /\breact\b/i, /\bvue\b/i, /\bangular\b/i, /tailwind/i, /bootstrap/i, /jquery/i, /\bgsap\b/i
  ]) {
    assert.doesNotMatch(INDEX_SOURCE, proibido, `dependência proibida: ${proibido}`);
  }

  // Fontes continuam self-hosted.
  assert.match(INDEX_SOURCE, /assets\/fonts\/inter-var\.woff2/);
  assert.match(INDEX_SOURCE, /assets\/fonts\/sora-var\.woff2/);

  assert.ok(!fs.existsSync(path.join(ROOT, 'package.json')), 'package.json não deve existir');
  assert.ok(!fs.existsSync(path.join(ROOT, 'node_modules')), 'node_modules não deve existir');
});

/* ============================================================
   Comportamento: o evento Contact
   ============================================================ */

function createEl(extra) {
  const listeners = {};
  return Object.assign({
    href: '',
    textContent: '',
    listeners,
    setAttribute() {},
    removeAttribute() {},
    addEventListener(type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    removeEventListener() {},
    dispatch(type, event) {
      (listeners[type] || []).slice().forEach((listener) => listener(event || {}));
    }
  }, extra || {});
}

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: (k) => (values.has(k) ? values.get(k) : null),
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k)
  };
}

/**
 * Sobe o script.js num DOM mínimo e devolve o que foi disparado no Pixel.
 * Só os elementos que a V2 realmente tem são resolvidos por getElementById.
 */
function bootLanding(options) {
  options = options || {};
  const pixelCalls = [];
  const elements = {
    ctaInvestimento: createEl({ href: CHECKOUT_URL }),
    ctaFinal: createEl({ href: CHECKOUT_URL }),
    whatsappSuporte: createEl(),
    anoAtual: createEl()
  };

  const documentListeners = {};
  const document = {
    documentElement: { classList: { add() {}, remove() {}, contains: () => false, toggle() {} } },
    visibilityState: 'visible',
    head: { appendChild() {} },
    createElement: () => createEl(),
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(type, listener) {
      if (!documentListeners[type]) documentListeners[type] = [];
      documentListeners[type].push(listener);
    },
    removeEventListener() {},
    dispatch(type, event) {
      (documentListeners[type] || []).slice().forEach((listener) => listener(event || {}));
    }
  };

  const window = {
    document,
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    location: {
      href: 'https://www.metodoexpress.com/' + (options.search || ''),
      origin: 'https://www.metodoexpress.com',
      search: options.search || ''
    },
    URL,
    URLSearchParams,
    console,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    fbq(...args) { pixelCalls.push(args); }
  };

  const context = vm.createContext({
    window, document, console, URL, URLSearchParams, encodeURIComponent,
    Date, setTimeout, clearTimeout, setInterval, clearInterval
  });

  vm.runInContext(SCRIPT_SOURCE, context, { filename: SCRIPT_PATH });
  document.dispatch('DOMContentLoaded');

  return {
    elements,
    storage: window.localStorage,
    contactCount: () => pixelCalls.filter((c) => c[0] === 'track' && c[1] === 'Contact').length,
    pixelCalls
  };
}

test('V2 — nenhum Contact no carregamento da página', () => {
  const landing = bootLanding();
  assert.equal(landing.contactCount(), 0);
  assert.deepEqual(landing.pixelCalls, []);
});

test('V2 — um clique no suporte gera exatamente um Contact', () => {
  const landing = bootLanding();

  landing.elements.whatsappSuporte.dispatch('click');
  assert.equal(landing.contactCount(), 1);

  // O href do suporte é remontado a partir das constantes do script.
  assert.match(
    landing.elements.whatsappSuporte.href,
    new RegExp(`^https://wa\\.me/${WHATSAPP_NUMBER}\\?text=`)
  );

  // Clicar nos CTAs de compra não gera Contact.
  landing.elements.ctaInvestimento.dispatch('click');
  landing.elements.ctaFinal.dispatch('click');
  assert.equal(landing.contactCount(), 1);
});

test('V2 — UTMs, src/sck e fbclid chegam ao checkout', () => {
  const landing = bootLanding({
    search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=teste' +
            '&utm_term=adset&utm_content=criativo&src=meta_ads&sck=1_2_3&fbclid=ABC123'
  });

  const href = landing.elements.ctaInvestimento.href;
  const params = new URL(href).searchParams;

  assert.equal(new URL(href).hostname, 'pay.hotmart.com');
  assert.equal(params.get('utm_source'), 'facebook');
  assert.equal(params.get('utm_medium'), 'paid_social');
  assert.equal(params.get('utm_campaign'), 'teste');
  assert.equal(params.get('utm_term'), 'adset');
  assert.equal(params.get('utm_content'), 'criativo');
  assert.equal(params.get('src'), 'meta_ads');
  assert.equal(params.get('sck'), '1_2_3');
  assert.equal(params.get('fbclid'), 'ABC123');

  assert.equal(landing.elements.ctaFinal.href, href);
});

test('V2 — fbclid é volátil: nunca é gravado no localStorage', () => {
  const landing = bootLanding({ search: '?utm_source=facebook&fbclid=ABC123' });

  // A atribuição salva é o único registro que a landing grava.
  const bruto = landing.storage.getItem('metodoexpress_tracking');
  assert.ok(bruto, 'atribuição de campanha deveria ter sido salva');

  const salvo = JSON.parse(bruto);
  assert.equal(salvo.v, 2);
  assert.equal(salvo.params.utm_source, 'facebook');
  assert.equal(salvo.params.fbclid, undefined, 'fbclid não pode ser persistido');

  // Mesmo fora do storage, ele acompanha a visita até o checkout.
  assert.equal(
    new URL(landing.elements.ctaInvestimento.href).searchParams.get('fbclid'),
    'ABC123'
  );
});
