'use strict';

/** Regressões estruturais e comerciais da landing Método Express V2.1. */
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
const INDEX_VISIBLE = INDEX_SOURCE.replace(/<!--[\s\S]*?-->/g, '');
const INDEX_BODY = INDEX_VISIBLE.slice(INDEX_VISIBLE.indexOf('<body'));
const STYLE_SOURCE = INDEX_SOURCE.match(/<style>([\s\S]*?)<\/style>/)[1];

const CHECKOUT_URL = 'https://pay.hotmart.com/G106758643C';
const WHATSAPP_NUMBER = '554888742835';
const VSL_ID = 'fIDX2aD1TdQ';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('V2.1 — hero segue a ordem H1, VSL e microcopy', () => {
  const hero = INDEX_BODY.match(/<header class="hero"[\s\S]*?<\/header>/);
  assert.ok(hero, 'hero não encontrado');
  assert.equal(countOccurrences(hero[0], '<h1'), 1);
  const h1 = hero[0].match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  const text = h1.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(text, 'Veja como um simples print pode virar algo concreto para mostrar a um negócio.');
  assert.match(h1, /<span class="accent">algo concreto<\/span>/);
  assert.match(hero[0], /Em menos de 3 minutos/);
  assert.match(hero[0], /id="vslPlayer"/);
  assert.ok(hero[0].indexOf('<h1') < hero[0].indexOf('id="vslPlayer"'));
  assert.ok(hero[0].indexOf('id="vslPlayer"') < hero[0].indexOf('class="hero-sub"'));
  assert.match(hero[0], /<span class="hero-sub-lead">Em menos de 3 minutos,<\/span>/);
  assert.match(STYLE_SOURCE, /\.hero-sub\s*\{[^}]*max-width:\s*680px;[^}]*font-size:\s*clamp\(0\.84rem,[^}]*text-align:\s*center;/);
  assert.doesNotMatch(hero[0], /1 celular|1 prompt|R\$97|wa\.me/);
  assert.equal(countOccurrences(hero[0], CHECKOUT_URL), 0);
});

test('V2.1 — VSL usa um único vídeo vertical e poster local otimizado', () => {
  assert.match(INDEX_SOURCE, new RegExp(`youtube\\.com/watch\\?v=${VSL_ID}`));
  assert.match(INDEX_SOURCE, /assets\/images\/vsl-poster\.webp/);
  assert.doesNotMatch(INDEX_SOURCE, /i\.ytimg\.com/);
  assert.match(SCRIPT_SOURCE, new RegExp(`youtube\\.com/embed/${VSL_ID}`));
  assert.equal(countOccurrences(SCRIPT_SOURCE, `embed/${VSL_ID}`), 1);
  assert.match(STYLE_SOURCE, /\.vsl-player\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*16/);
  assert.doesNotMatch(STYLE_SOURCE, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.doesNotMatch(INDEX_VISIBLE, /Ver o método funcionando|Com áudio/);
  assert.doesNotMatch(INDEX_SOURCE, /<(video|iframe)[^>]*\bautoplay\b/i);
  assert.doesNotMatch(SCRIPT_SOURCE, /\bautoplay\b/i);
  assert.doesNotMatch(INDEX_SOURCE + SCRIPT_SOURCE, /zyZgphLLg-Y|a4tbLBVzkOs/);
});

test('V2.1 — mecanismo separado apresenta a sequência em quatro passos', () => {
  const section = INDEX_SOURCE.match(/<section[^>]*id="mecanismo"[\s\S]*?<\/section>/);
  assert.ok(section);
  assert.match(section[0], /Pegue um print de um Instagram\. Use um prompt\./);
  assert.equal(countOccurrences(section[0], 'class="mechanism-card"'), 4);
  let previous = -1;
  for (const step of ['1 celular', '1 print', '1 prompt', 'Uma transformação para mostrar']) {
    const position = section[0].indexOf(step);
    assert.ok(position > previous, `passo ausente ou fora de ordem: ${step}`);
    previous = position;
  }
});

test('V2.1 — antes/depois empilha no mobile e fica lado a lado a partir de 640px', () => {
  assert.match(STYLE_SOURCE, /\.ba\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(STYLE_SOURCE, /@media \(min-width: 640px\)[\s\S]*?\.ba\s*\{[^}]*grid-template-columns:\s*1fr auto 1fr;/);
  const section = INDEX_SOURCE.match(/<section[^>]*id="demonstracao"[\s\S]*?<\/section>/);
  assert.ok(section);
  assert.equal(countOccurrences(section[0], 'class="ba-shot'), 2);
  assert.equal(countOccurrences(section[0], '<img '), 2);
  assert.match(section[0], /Simulação visual\. Não representa crescimento de seguidores, vendas ou faturamento\./);
});

test('V2.1 — há somente um fluxo de execução com seis etapas', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, 'class="process-flow"'), 1);
  const process = INDEX_SOURCE.match(/<ol class="process-flow"[\s\S]*?<\/ol>/);
  assert.ok(process);
  assert.equal(countOccurrences(process[0], '<li>'), 6);
  let previous = -1;
  for (const step of ['Encontrar', 'Criar', 'Mostrar', 'Abordar', 'Oferecer', 'Entregar']) {
    const position = process[0].indexOf(`>${step}</li>`);
    assert.ok(position > previous, `etapa ausente ou fora de ordem: ${step}`);
    previous = position;
  }
  const section = INDEX_SOURCE.match(/<section[^>]*id="processo"[\s\S]*?<\/section>/)[0];
  for (const niche of ['Barbearias', 'Salões', 'Hamburguerias', 'Cafeterias', 'Lojas', 'Imobiliárias']) {
    assert.match(section, new RegExp(niche));
  }
});

test('V2.1 — seções seguem a arquitetura final', () => {
  const order = [
    'id="vsl"', 'id="mecanismo"', 'id="demonstracao"', 'id="mostrar-primeiro"',
    'id="prova-mecanismo"', 'id="processo"', 'id="depoimentos"', 'id="autoridade"', 'id="investimento"',
    'id="garantia"', 'id="faq"', 'id="cta-final"'
  ];
  let previous = -1;
  for (const marker of order) {
    const position = INDEX_SOURCE.indexOf(marker);
    assert.notEqual(position, -1, `marcador ausente: ${marker}`);
    assert.ok(position > previous, `fora de ordem: ${marker}`);
    previous = position;
  }
});

test('V2.1 — promessa não usa calendário, renda ou urgência artificial', () => {
  assert.match(INDEX_VISIBLE, /Você tem 7 dias para conhecer o Método Express\./);
  assert.match(INDEX_VISIBLE, /7 dias de garantia/);
  for (const prohibited of [
    /\bem 7 dias\b/i, /7 dias de missões/i, /curso de 7 dias/i, /Dia\s*[1-7]\s*[—-]/,
    /primeira renda/i, /renda garantida/i, /resultado garantido/i,
    /liberdade financeira/i, /últimas vagas/i, /vagas limitadas/i, /countdown/i,
    /só hoje/i, /termina em \d/i, /preço subindo/i, /\[DATA\]/,
    /<s>/, /<del>/, /de R\$\s*\d/i
  ]) assert.doesNotMatch(INDEX_VISIBLE, prohibited, `promessa proibida: ${prohibited}`);
});

test('V2.1 — prova do mecanismo usa os dois prints reais e vem após Mostrar primeiro', () => {
  const proof = INDEX_SOURCE.match(/<section[^>]*id="prova-mecanismo"[\s\S]*?<\/section>/);
  assert.ok(proof, 'prova do mecanismo não encontrada');
  assert.ok(INDEX_SOURCE.indexOf('id="mostrar-primeiro"') < INDEX_SOURCE.indexOf('id="prova-mecanismo"'));
  assert.ok(INDEX_SOURCE.indexOf('id="prova-mecanismo"') < INDEX_SOURCE.indexOf('id="processo"'));
  for (const name of ['conversa1.png', 'conversa2.png']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'images', name)));
    const tag = proof[0].match(new RegExp(`<img[^>]*src="assets/images/${name.replace('.', '\\.')}"[^>]*>`));
    assert.ok(tag, `imagem ausente: ${name}`);
    assert.match(tag[0], /loading="lazy"/);
    assert.match(tag[0], /width="941"/);
    assert.match(tag[0], /height="1672"/);
  }
  assert.match(STYLE_SOURCE, /\.proof-grid\s*\{[^}]*display:\s*grid;/);
  assert.match(STYLE_SOURCE, /@media \(min-width: 640px\)[\s\S]*?\.proof-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.match(proof[0], /Conversas reais após o envio de uma simulação visual\./);
  assert.match(proof[0], /não representam garantia de contratação, venda ou resultado\./);
  for (const prohibited of [/cliente fechado/i, /venda garantida/i, /contratação garantida/i, /resultado financeiro/i]) {
    assert.doesNotMatch(proof[0], prohibited);
  }
});

test('V2.1 — materiais centrais, informações de acesso e bônus aparecem antes do preço', () => {
  const process = INDEX_SOURCE.match(/<section[^>]*id="processo"[\s\S]*?<\/section>/)[0];
  assert.match(process, /Prompt Raiz 1/);
  assert.match(process, /Prompt Raiz 2/);
  assert.doesNotMatch(process, /\bbônus\b/i);
  const offer = INDEX_SOURCE.match(/<section[^>]*id="investimento"[\s\S]*?<\/section>/)[0];
  assert.equal(countOccurrences(offer, 'class="offer-product"'), 3);
  assert.match(offer, /Processo completo/);
  assert.match(offer, /Encontrar → Criar → Mostrar → Abordar → Oferecer → Entregar/);
  assert.match(offer, /Prompt Raiz 1/);
  assert.match(offer, /Prompt Raiz 2/);
  assert.match(offer, /7 aulas práticas · cerca de 2h de conteúdo · acesso vitalício · suporte \+ comunidade/);
  assert.equal(countOccurrences(offer, 'class="bonus-card"'), 3);
  for (const bonus of ['Kit de Abordagem Express', 'Pack de Prompts por Nicho', 'Fechamento Express']) {
    assert.match(offer, new RegExp(bonus));
  }
  assert.match(offer, /Como conduzir a conversa quando o negócio demonstra interesse, montar uma proposta, definir o preço do serviço, apresentar o valor, responder objeções e encaminhar para o fechamento\./);
  assert.ok(offer.indexOf('class="offer-stack"') < offer.indexOf('R$97'));
  assert.ok(offer.indexOf('class="bonus-block"') < offer.indexOf('R$97'));
  assert.doesNotMatch(offer, /R\$997|valor de R\$|<s>|<del>|de R\$\s*\d/i);
});

test('V2.1 — autoridade prioriza aplicação prática sem alegações financeiras', () => {
  const author = INDEX_SOURCE.match(/<section[^>]*id="autoridade"[\s\S]*?<\/section>/)[0];
  assert.match(author, /André Hoffmann/);
  assert.match(author, /Criador do Método Express/);
  assert.match(author, /testei a lógica na prática/);
  assert.match(author, /Peguei perfis reais, criei simulações e apresentei a ideia diretamente aos negócios/);
  assert.match(author, /Formado em Análise e Desenvolvimento de Sistemas e Marketing/);
  assert.match(author, /transformar tecnologia e comunicação em um processo claro para executar/);
  assert.doesNotMatch(author, /faturamento|R\$|\d+ clientes/i);
});

test('V2.1 — FAQ responde ferramentas, conteúdo, acesso e suporte', () => {
  const faq = INDEX_SOURCE.match(/<section[^>]*id="faq"[\s\S]*?<\/section>/)[0];
  for (const copy of [
    'Qual ferramenta de inteligência artificial é usada?', 'ChatGPT', 'Grok',
    'Preciso pagar ferramentas extras para começar?', 'Quanto conteúdo eu recebo?',
    '7 aulas práticas', 'cerca de 2 horas', 'Por quanto tempo tenho acesso?',
    'O acesso é vitalício.', 'Existe suporte?', 'suporte e comunidade'
  ]) assert.match(faq, new RegExp(copy.replace(/[?+.]/g, '\\$&'), 'i'), `copy ausente: ${copy}`);
  assert.doesNotMatch(faq, /100% grátis|nunca vai pagar nada/i);
});

test('V2.1 — favicon oficial usa somente o novo asset ME', () => {
  const icon = INDEX_SOURCE.match(/<link rel="icon"[^>]*>/);
  assert.ok(icon);
  assert.match(icon[0], /type="image\/png"/);
  assert.match(icon[0], /href="assets\/images\/favicon\.png"/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'images', 'favicon.png')));
  assert.equal(countOccurrences(INDEX_BODY, 'assets/images/favicon.png'), 0);
});

test('V2.1 — dois CTAs Hotmart e suporte final mantêm os destinos aprovados', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, CHECKOUT_URL), 2);
  assert.match(INDEX_SOURCE, /id="ctaInvestimento"/);
  assert.match(INDEX_SOURCE, /id="ctaFinal"/);
  assert.doesNotMatch(INDEX_SOURCE + SCRIPT_SOURCE, /ctaQuickOffer|whatsappFloat|whatsapp-float/);
  assert.match(INDEX_SOURCE, /id="whatsappSuporte"/);
  assert.match(INDEX_SOURCE, new RegExp(`https://wa\\.me/${WHATSAPP_NUMBER}`));
  assert.match(INDEX_VISIBLE, /Ficou com alguma dúvida sobre acesso ou pagamento\?/);
  assert.match(SCRIPT_SOURCE, new RegExp(`WHATSAPP_NUMERO = '${WHATSAPP_NUMBER}'`));
});

test('V2.1 — nenhum gate, reveal ou cabeçalho fixo foi reintroduzido', () => {
  for (const prohibited of [/content-locked/, /stickyNav/, /sticky-nav/, /initStickyNav/, /initScrollReveal/]) {
    assert.doesNotMatch(INDEX_SOURCE + SCRIPT_SOURCE, prohibited);
  }
});

test('V2.1 — milestones permanecem; VSL_Offer aguarda timestamp humano', () => {
  for (const event of ['VSL_Start', 'VSL_25', 'VSL_50', 'VSL_75', 'VSL_90', 'VSL_Offer']) {
    assert.match(SCRIPT_SOURCE, new RegExp(`'${event}'`));
  }
  assert.match(SCRIPT_SOURCE, /var VSL_OFFER_SECONDS = null;/);
  assert.match(SCRIPT_SOURCE, /mex_vsl_fIDX2aD1TdQ_watched_seconds/);
  assert.match(SCRIPT_SOURCE, /metodoexpress_vsl_fIDX2aD1TdQ_events/);
  assert.doesNotMatch(SCRIPT_SOURCE, /VSL_OFFER_SECONDS_(MOBILE|DESKTOP)\s*=\s*415/);
});

test('V2.1 — Meta Pixel dispara um PageView e carrega fbevents uma vez', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, "fbq('track', 'PageView')"), 1);
  assert.equal(countOccurrences(INDEX_SOURCE, 'connect.facebook.net/en_US/fbevents.js'), 1);
  assert.equal(countOccurrences(INDEX_SOURCE, 'setTimeout(start, 1500)'), 1);
  assert.equal(countOccurrences(INDEX_SOURCE, "fbq('init', '3401433073361667')"), 1);
});

test('V2.1 — depoimentos ficam lado a lado no desktop e fora do caminho crítico', () => {
  for (const name of ['depoimento-naldo.mp4', 'depoimento-amanda.mp4']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'videos', name)));
    assert.match(INDEX_SOURCE, new RegExp(`assets/videos/${name.replace('.', '\\.')}`));
  }
  for (const name of ['depoimento-naldo-poster.webp', 'depoimento-amanda-poster.webp']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'images', name)));
  }
  assert.match(STYLE_SOURCE, /@media \(min-width: 640px\)[\s\S]*?\.testimonials\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/);
  assert.match(SCRIPT_SOURCE, /function initLazyPosters\(\)/);
  const videos = INDEX_SOURCE.match(/<video[^>]*>/g) || [];
  assert.equal(videos.length, 2);
  for (const tag of videos) {
    assert.match(tag, /preload="none"/);
    assert.doesNotMatch(tag, /\sposter=/);
    assert.match(tag, /data-poster="assets\/images\/[^" ]+\.webp"/);
    assert.match(tag, /playsinline/);
    assert.match(tag, /controls/);
    assert.doesNotMatch(tag, /\bautoplay\b/);
    assert.match(tag, /width="\d+"/);
    assert.match(tag, /height="\d+"/);
  }
  assert.doesNotMatch(INDEX_VISIBLE, /\bPIX\b|R\$\s*3[.]?500/i);
});

test('V2.1 — imagens abaixo da dobra são lazy e poster local da VSL tem prioridade alta', () => {
  const images = INDEX_SOURCE.match(/<img[^>]*>/g) || [];
  const local = images.filter((tag) => /src="assets\//.test(tag));
  assert.equal(local.length, 6);
  for (const tag of local.filter((tag) => !tag.includes('vsl-poster.webp'))) {
    assert.match(tag, /loading="lazy"/);
    assert.match(tag, /width="\d+"/);
    assert.match(tag, /height="\d+"/);
  }
  const thumbnail = images.find((tag) => tag.includes('assets/images/vsl-poster.webp'));
  assert.ok(thumbnail);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'images', 'vsl-poster.webp')));
  assert.match(thumbnail, /width="720"/);
  assert.match(thumbnail, /height="1279"/);
  assert.match(thumbnail, /loading="eager"/);
  assert.match(thumbnail, /fetchpriority="high"/);
  assert.doesNotMatch(thumbnail, /loading="lazy"/);
});

test('V2.1 — continua em HTML, CSS e JS puros, com fontes self-hosted', () => {
  const scripts = INDEX_SOURCE.match(/<script[^>]*\bsrc=["'][^"']+["']/g) || [];
  assert.deepEqual(scripts.map((s) => s.match(/src=["']([^"']+)["']/)[1]), ['script.js']);
  assert.doesNotMatch(INDEX_SOURCE, /<link[^>]*rel=["']stylesheet["']/);
  for (const prohibited of [
    /cdn\.jsdelivr/i, /cdnjs\./i, /unpkg\.com/i, /code\.jquery/i,
    /fonts\.googleapis/i, /fonts\.gstatic/i, /\breact\b/i, /\bvue\b/i,
    /\bangular\b/i, /tailwind/i, /bootstrap/i, /jquery/i, /\bgsap\b/i
  ]) assert.doesNotMatch(INDEX_SOURCE, prohibited);
  assert.match(INDEX_SOURCE, /assets\/fonts\/inter-var\.woff2/);
  assert.match(INDEX_SOURCE, /assets\/fonts\/sora-var\.woff2/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'package.json')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'node_modules')));
});

function createEl(extra) {
  const listeners = {};
  return Object.assign({
    href: '', textContent: '', listeners,
    setAttribute() {}, removeAttribute() {},
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
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function bootLanding(options) {
  options = options || {};
  const pixelCalls = [];
  const elements = {
    ctaInvestimento: createEl({ href: CHECKOUT_URL }),
    ctaFinal: createEl({ href: CHECKOUT_URL }),
    whatsappSuporte: createEl(), anoAtual: createEl()
  };
  const documentListeners = {};
  const document = {
    documentElement: { classList: { add() {}, remove() {}, contains: () => false, toggle() {} } },
    visibilityState: 'visible', head: { appendChild() {} },
    createElement: () => createEl(), getElementById: (id) => elements[id] || null,
    querySelector: () => null, querySelectorAll: () => [],
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
    document, localStorage: createStorage(), sessionStorage: createStorage(),
    location: {
      href: 'https://www.metodoexpress.com/' + (options.search || ''),
      origin: 'https://www.metodoexpress.com', search: options.search || ''
    },
    URL, URLSearchParams, console, matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {},
    fbq(...args) { pixelCalls.push(args); }
  };
  const context = vm.createContext({
    window, document, console, URL, URLSearchParams, encodeURIComponent,
    Date, setTimeout, clearTimeout, setInterval, clearInterval
  });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: SCRIPT_PATH });
  document.dispatch('DOMContentLoaded');
  return {
    elements, storage: window.localStorage,
    contactCount: () => pixelCalls.filter((call) => call[0] === 'track' && call[1] === 'Contact').length,
    pixelCalls
  };
}

test('V2.1 — nenhum Contact dispara no carregamento', () => {
  const landing = bootLanding();
  assert.equal(landing.contactCount(), 0);
  assert.deepEqual(landing.pixelCalls, []);
});

test('V2.1 — clique no suporte dispara exatamente um Contact', () => {
  const landing = bootLanding();
  landing.elements.whatsappSuporte.dispatch('click');
  assert.equal(landing.contactCount(), 1);
  assert.match(landing.elements.whatsappSuporte.href, new RegExp(`^https://wa\\.me/${WHATSAPP_NUMBER}\\?text=`));
  landing.elements.ctaInvestimento.dispatch('click');
  landing.elements.ctaFinal.dispatch('click');
  assert.equal(landing.contactCount(), 1);
});

test('V2.1 — UTMs, src, sck e fbclid chegam aos dois checkouts', () => {
  const landing = bootLanding({
    search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=teste' +
            '&utm_term=adset&utm_content=criativo&src=meta_ads&sck=1_2_3&fbclid=ABC123'
  });
  const href = landing.elements.ctaInvestimento.href;
  const params = new URL(href).searchParams;
  assert.equal(new URL(href).hostname, 'pay.hotmart.com');
  for (const [key, value] of [
    ['utm_source', 'facebook'], ['utm_medium', 'paid_social'], ['utm_campaign', 'teste'],
    ['utm_term', 'adset'], ['utm_content', 'criativo'], ['src', 'meta_ads'],
    ['sck', '1_2_3'], ['fbclid', 'ABC123']
  ]) assert.equal(params.get(key), value);
  assert.equal(landing.elements.ctaFinal.href, href);
});

test('V2.1 — fbclid acompanha a sessão, mas nunca é persistido', () => {
  const landing = bootLanding({ search: '?utm_source=facebook&fbclid=ABC123' });
  const raw = landing.storage.getItem('metodoexpress_tracking');
  assert.ok(raw);
  const saved = JSON.parse(raw);
  assert.equal(saved.v, 2);
  assert.equal(saved.params.utm_source, 'facebook');
  assert.equal(saved.params.fbclid, undefined);
  assert.equal(new URL(landing.elements.ctaInvestimento.href).searchParams.get('fbclid'), 'ABC123');
});
