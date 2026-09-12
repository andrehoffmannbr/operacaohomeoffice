'use strict';

/** Regressões estruturais e comerciais da landing Método Express + Agente Express. */
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

function visibleText(fragment) {
  return fragment.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function cssAtRule(marker) {
  const start = STYLE_SOURCE.indexOf(marker);
  assert.notEqual(start, -1, `regra CSS ausente: ${marker}`);
  const brace = STYLE_SOURCE.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < STYLE_SOURCE.length; index++) {
    if (STYLE_SOURCE[index] === '{') depth++;
    if (STYLE_SOURCE[index] === '}' && --depth === 0) return STYLE_SOURCE.slice(brace + 1, index);
  }
  assert.fail(`regra CSS sem fechamento: ${marker}`);
}

test('Agente Express — hero apresenta a IA, o serviço e uma âncora interna', () => {
  const hero = INDEX_BODY.match(/<header class="hero"[\s\S]*?<\/header>/);
  assert.ok(hero, 'hero não encontrado');
  assert.equal(countOccurrences(hero[0], '<h1'), 1);
  const h1 = hero[0].match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.equal(visibleText(h1), 'Tenha uma IA personalizada que encontra oportunidades, cria a transformação e prepara o serviço para você oferecer pelo celular.');
  const text = visibleText(hero[0]);
  assert.match(text, /MÉTODO EXPRESS \+ AGENTE EXPRESS/);
  assert.match(text, /Você escolhe o negócio, revisa e envia\./);
  assert.match(text, /Sem aparecer\. Sem saber design\. Sem dominar IA\. Sem precisar falar outro idioma\./);
  assert.match(text, /Brasil ou do exterior/);
  assert.match(hero[0], /id="vslPlayer"/);
  assert.ok(hero[0].indexOf('<h1') < hero[0].indexOf('id="vslPlayer"'));
  assert.match(hero[0], /<a\b[^>]*href="#agente-express"[^>]*>\s*QUERO CONHECER O AGENTE EXPRESS\s*<\/a>/);
  assert.doesNotMatch(hero[0], /Em menos de 3 minutos|1 prompt|wa\.me/);
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

test('Agente Express — apresenta quatro resultados e a participação do aluno', () => {
  const section = INDEX_SOURCE.match(/<section[^>]*id="agente-express"[\s\S]*?<\/section>/);
  assert.ok(section);
  const text = visibleText(section[0]);
  assert.match(text, /Agente Express prepara o que mostrar, o que dizer e o que entregar/);
  assert.match(text, /Você escolhe a oportunidade, confere o resultado e faz o material chegar ao negócio/);
  let previous = -1;
  for (const step of ['Encontra', 'Transforma', 'Conversa', 'Entrega']) {
    const position = text.indexOf(step);
    assert.ok(position > previous, `passo ausente ou fora de ordem: ${step}`);
    previous = position;
  }
  assert.match(text, /Veja o fluxo do Agente Express/);
  assert.equal(countOccurrences(section[0], 'class="agent-io"'), 4);
  assert.equal(countOccurrences(section[0], 'class="agent-io-row"'), 8);
  assert.equal(countOccurrences(section[0], 'role="listitem"'), 4);
  for (const flow of ['Cidade + segmento', 'Negócios para analisar', 'Link ou print do perfil', 'Demonstração visual', 'Mensagem recebida', 'Resposta preparada', 'Direção aprovada', 'Materiais do pacote']) {
    assert.ok(text.includes(flow), `entrada ou resultado ausente: ${flow}`);
  }
  assert.match(STYLE_SOURCE, /\.agent-results\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(cssAtRule('@media(min-width:640px)'), /\.agent-results\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.doesNotMatch(cssAtRule('@media(min-width:900px)'), /\.agent-results\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
  assert.match(cssAtRule('@media(min-width:1200px)'), /\.agent-results\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
});

test('Agente Express — antes/depois real apresenta o mecanismo e mantém imagens responsivas', () => {
  assert.match(STYLE_SOURCE, /\.ba\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\);/);
  assert.doesNotMatch(cssAtRule('@media(min-width:640px)'), /\.ba\s*\{/);
  assert.match(cssAtRule('@media(min-width:768px)'), /\.ba\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto minmax\(0,1fr\);/);
  const section = INDEX_SOURCE.match(/<section[^>]*id="demonstracao"[\s\S]*?<\/section>/);
  assert.ok(section);
  assert.equal(countOccurrences(section[0], 'class="ba-shot'), 2);
  assert.equal(countOccurrences(section[0], '<img '), 2);
  assert.equal(countOccurrences(section[0], 'class="media-link"'), 2);
  assert.equal(countOccurrences(section[0], 'class="image-action"'), 2);
  assert.equal(countOccurrences(section[0], 'target="_blank" rel="noopener"'), 2);
  const text = visibleText(section[0]);
  assert.match(text, /Perfil atual/);
  assert.match(text, /Simulação de transformação/);
  assert.match(text, /A maioria tenta vender primeiro\. Aqui, você mostra primeiro\./);
  assert.match(visibleText(INDEX_BODY), /Enquanto a maioria envia mensagens genéricas oferecendo social media, você chega mostrando uma transformação criada para aquele negócio\./);
  for (const asset of ['perfil-antes-480.webp', 'perfil-depois-480.webp']) {
    assert.ok(section[0].includes(asset), `ativo real ausente: ${asset}`);
  }
  assert.doesNotMatch(section[0], /crescimento de seguidores|vendas ou faturamento/i);
});

test('Agente Express — há somente um fluxo de execução com quatro etapas', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, 'class="process-flow"'), 1);
  const process = INDEX_SOURCE.match(/<ol class="process-flow"[\s\S]*?<\/ol>/);
  assert.ok(process);
  assert.equal(countOccurrences(process[0], '<li>'), 4);
  let previous = -1;
  for (const step of [
    'Escolher', 'Mostrar', 'Conversar', 'Entregar'
  ]) {
    const position = process[0].indexOf(`>${step}</strong>`);
    assert.ok(position > previous, `etapa ausente ou fora de ordem: ${step}`);
    previous = position;
  }
  const text = visibleText(process[0]);
  assert.match(text, /Você escolhe uma oportunidade/i);
  assert.match(text, /Você confere e envia/i);
  assert.match(text, /Você decide as condições/i);
  assert.match(text, /Você confere, solicita ajustes e envia/i);
});

test('Agente Express — seções seguem a arquitetura autorizada', () => {
  const order = [
    'id="vsl"', 'id="demonstracao"', 'id="agente-express"', 'id="prova-mecanismo"',
    'id="depoimentos"', 'id="processo"', 'id="pacote"', 'id="perfil-profissional"',
    'id="idiomas"', 'id="investimento"', 'id="autoridade"',
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

test('Polimento final — layouts móveis ficam em uma coluna e textos principais não são reduzidos', () => {
  assert.match(STYLE_SOURCE, /\.hero-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(cssAtRule('@media(min-width:900px)'), /\.hero-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,1\.55fr\) minmax\(0,1fr\)/);
  assert.match(cssAtRule('@media(max-height:700px)'), /\.vsl-wrap\s*\{[^}]*width:\s*min\(100%,250px\)/);
  const mainTextSelectors = [
    '.hero-barriers', '.hero-territory', '.vsl-caption', '.ba-label', '.asset-caption',
    '.agent-result>p', '.agent-io-label', '.media-pending p', '.proof-result', '.disclaimer',
    '.package-components p', '.pending-note', '.language-step-label', '.offer-product p',
    '.offer-value', '.offer-price-label', '.offer-price-alt', '.btn', '.secure-note',
    '.access-note', '.author-role', '.support'
  ];
  for (const selector of mainTextSelectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = STYLE_SOURCE.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `regra ausente: ${selector}`);
    const size = rule[1].match(/font-size:\s*([\d.]+)(rem|px)/);
    assert.ok(size, `font-size ausente: ${selector}`);
    const pixels = Number(size[1]) * (size[2] === 'rem' ? 16 : 1);
    assert.ok(pixels >= 16, `texto principal abaixo de 16px: ${selector} (${size[0]})`);
  }
  assert.match(STYLE_SOURCE, /\.btn\s*\{[^}]*min-height:\s*58px/);
});

test('Agente Express — garantia não vira prazo de resultado nem urgência fictícia', () => {
  const pageText = visibleText(INDEX_BODY);
  assert.match(pageText, /Você tem sete dias para conhecer o Método Express por dentro\./);
  assert.match(pageText, /sete dias de garantia/i);
  assert.doesNotMatch(INDEX_VISIBLE, /15\/09|10\/09|2026-09-15|acesso vitalício|imagens ilimitadas/i);
  for (const prohibited of [
    /\bem 7 dias\b/i, /7 dias de missões/i, /curso de 7 dias/i, /Dia\s*[1-7]\s*[—-]/,
    /primeira renda/i, /renda garantida/i, /resultado garantido/i,
    /liberdade financeira/i, /últimas vagas/i, /vagas limitadas/i, /countdown/i,
    /só hoje/i, /termina em \d/i, /preço subindo/i, /\[DATA\]/,
    /<s>/, /<del>/, /clientes prontos para comprar/i, /fecha clientes sozinho/i,
    /ganhe em dólar sem esforço/i, /qualquer pessoa consegue/i, /ChatGPT incluso/i,
    /identidade visual completa/i, /somos os únicos/i, /mercado sem concorrência/i
  ]) assert.doesNotMatch(INDEX_VISIBLE, prohibited, `promessa proibida: ${prohibited}`);
});

test('Agente Express — provas existentes sustentam o mecanismo e precedem o processo', () => {
  const proof = INDEX_SOURCE.match(/<section[^>]*id="prova-mecanismo"[\s\S]*?<\/section>/);
  assert.ok(proof, 'prova do mecanismo não encontrada');
  assert.ok(INDEX_SOURCE.indexOf('id="agente-express"') < INDEX_SOURCE.indexOf('id="prova-mecanismo"'));
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
  assert.match(cssAtRule('@media(min-width:768px)'), /\.proof-grid\s*,\s*\.testimonials\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  const text = visibleText(proof[0]);
  assert.match(text, /Quando você mostra algo feito para o negócio, a conversa muda\./);
  assert.equal(countOccurrences(proof[0], 'class="proof-result"'), 2);
  assert.equal(countOccurrences(proof[0], 'class="proof-sequence"'), 1);
  assert.equal(countOccurrences(proof[0], '<li>'), 4);
  assert.equal(countOccurrences(proof[0], 'Ampliar registro'), 2);
  assert.equal(countOccurrences(proof[0], 'class="founder-case"'), 1);
  assert.match(text, /Na primeira semana aplicando essa lógica, André abordou cerca de dez negócios\./);
  assert.match(text, /Um deles se tornou seu primeiro cliente por R\$700\./);
  assert.match(text, /Ele encontrou o negócio, mostrou a transformação e conduziu a conversa\./);
  assert.equal(countOccurrences(text, 'Relato específico da aplicação do método. Resultados variam conforme execução, abordagem e negociação.'), 1);
  for (const prohibited of [/cliente fechado/i, /venda garantida/i, /contratação garantida/i, /resultado financeiro/i]) {
    assert.doesNotMatch(proof[0], prohibited);
  }
});

test('Agente Express — oferta reúne ferramenta, método, acesso e condições antes da compra', () => {
  const offer = INDEX_SOURCE.match(/<section[^>]*id="investimento"[\s\S]*?<\/section>/)[0];
  const text = visibleText(offer);
  for (const component of [
    'Agente Express', 'Método Express', 'Perfil Profissional Express',
    'Kit de Abordagem', 'Pack por Nicho', 'Fechamento Express',
    'Suporte direto e comunidade'
  ]) {
    assert.ok(text.includes(component), `componente ausente: ${component}`);
    assert.ok(offer.indexOf(component) < offer.indexOf('id="ctaInvestimento"'));
  }
  assert.match(text, /Suporte via WhatsApp e acesso à comunidade/);
  assert.match(text, /R\$97/);
  assert.match(text, /Parcelamento disponível no checkout/);
  assert.match(text, /um serviço de R\$700 representou mais de sete vezes o valor de acesso de R\$97/);
  assert.match(text, /As aulas e os materiais ficam na Hotmart/);
  assert.match(text, /ChatGPT com a conta do próprio aluno/);
  assert.match(text, /compra não inclui uma assinatura do ChatGPT/i);
  assert.match(text, /limites de mensagens e imagens dependem do plano/i);
  assert.ok(offer.indexOf('Agente Express') < offer.indexOf('data-offer-price'));
  assert.doesNotMatch(offer, /R\$997|<s>|<del>|Prompt Raiz|vitalício|15\/09/i);
});

test('Agente Express — pacote, perfil e idiomas diferenciam entrega e ações do aluno', () => {
  const packageSection = INDEX_SOURCE.match(/<section[^>]*id="pacote"[\s\S]*?<\/section>/)[0];
  const packageText = visibleText(packageSection);
  for (const component of ['dez imagens individuais', 'logo', 'bio', 'capas', 'direção visual']) {
    assert.ok(packageText.toLowerCase().includes(component), `entrega ausente: ${component}`);
  }
  assert.match(packageText, /A demonstração abre a conversa/);
  assert.match(packageText, /Você confere, pede os ajustes e entrega tudo pelo celular/);
  assert.match(packageText, /Você não oferece “inteligência artificial”/);
  assert.ok(packageSection.indexOf('</ul>') < packageSection.indexOf('data-pending-asset="pacote-express-arquivos"'), 'lista do pacote deve preceder a pendência visual');
  const profile = visibleText(INDEX_SOURCE.match(/<section[^>]*id="perfil-profissional"[\s\S]*?<\/section>/)[0]);
  assert.match(profile, /Seu trabalho aparece\. Seu rosto não precisa\./);
  assert.match(profile, /perfil de marca/);
  assert.match(profile, /sem gravar vídeos ou expor sua vida pessoal/);
  const languages = visibleText(INDEX_SOURCE.match(/<section[^>]*id="idiomas"[\s\S]*?<\/section>/)[0]);
  assert.match(languages, /Você fala com o agente em português/);
  assert.match(languages, /Copie a mensagem e leve ao Agente Express/);
  assert.match(languages, /real, dólar ou euro/);
  assert.doesNotMatch(languages, /participa de chamadas|recebe pagamentos|garante clientes/i);
});

test('Agente Express — história mantém a aplicação real sem credencial acadêmica não confirmada', () => {
  const author = INDEX_SOURCE.match(/<section[^>]*id="autoridade"[\s\S]*?<\/section>/)[0];
  assert.match(author, /André Hoffmann/);
  assert.match(author, /Criador do Método Express/);
  assert.match(visibleText(author), /Quando testei essa ideia com negócios reais/);
  assert.match(visibleText(author), /primeiro serviço por R\$700/);
  assert.match(author, /Agente Express/);
  assert.doesNotMatch(author, /Formado em|Análise e Desenvolvimento de Sistemas|\d+ clientes/i);
});

test('Agente Express — FAQ responde às dez dúvidas obrigatórias sem promessa automática', () => {
  const faq = INDEX_SOURCE.match(/<section[^>]*id="faq"[\s\S]*?<\/section>/)[0];
  for (const copy of [
    'Consigo fazer tudo pelo celular?', 'Preciso aparecer ou gravar vídeos?',
    'Preciso saber design ou inteligência artificial?',
    'Preciso falar inglês para abordar negócios de outros países?',
    'A IA envia as mensagens automaticamente?',
    'Preciso ter perfil profissional ou portfólio pronto?',
    'Preciso de conta no ChatGPT?', 'O método garante clientes ou renda?',
    'O que está incluído no pacote que posso oferecer?', 'Como funciona a garantia?'
  ]) assert.match(faq, new RegExp(copy.replace(/[?+.]/g, '\\$&'), 'i'), `copy ausente: ${copy}`);
  assert.equal(countOccurrences(faq, 'class="faq-item"'), 10);
  assert.match(visibleText(faq), /revisa e envia/);
  assert.match(visibleText(faq), /limites[\s\S]*plano/i);
  assert.doesNotMatch(faq, /O resultado é garantido|100% grátis|nunca vai pagar nada|acesso é vitalício/i);
});

test('V2.1 — favicon oficial usa somente o novo asset ME', () => {
  const icon = INDEX_SOURCE.match(/<link rel="icon"[^>]*>/);
  assert.ok(icon);
  assert.match(icon[0], /type="image\/png"/);
  assert.match(icon[0], /href="assets\/images\/favicon\.png"/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'images', 'favicon.png')));
  assert.equal(countOccurrences(INDEX_BODY, 'assets/images/favicon.png'), 0);
});

test('Agente Express — somente dois CTAs Hotmart e suporte final mantêm os destinos aprovados', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, CHECKOUT_URL), 2);
  assert.match(INDEX_SOURCE, /id="ctaInvestimento"/);
  assert.match(INDEX_SOURCE, /id="ctaFinal"/);
  assert.doesNotMatch(INDEX_SOURCE + SCRIPT_SOURCE, /ctaQuickOffer|whatsappFloat|whatsapp-float/);
  assert.match(INDEX_SOURCE, /id="whatsappSuporte"/);
  assert.match(INDEX_SOURCE, new RegExp(`https://wa\\.me/${WHATSAPP_NUMBER}`));
  assert.match(INDEX_VISIBLE, /Ficou com alguma dúvida sobre acesso ou pagamento\?/);
  const final = INDEX_SOURCE.match(/<section[^>]*id="cta-final"[\s\S]*?<\/section>/)[0];
  assert.match(visibleText(final), /Você não precisa chegar pronto\. Precisa de um celular e de algo concreto para mostrar\./);
  assert.match(visibleText(final), /O Agente Express pesquisa oportunidades, cria a transformação, prepara a conversa e produz o pacote/);
  assert.match(visibleText(final), /Você escolhe, revisa, envia e combina as condições com o cliente/);
  const checkoutLinks = INDEX_VISIBLE.match(/<a\b[^>]*href="https:\/\/pay\.hotmart\.com\/G106758643C"[^>]*>[\s\S]*?<\/a>/g) || [];
  assert.equal(checkoutLinks.length, 2);
  for (const link of checkoutLinks) {
    assert.equal(visibleText(link), 'QUERO ACESSAR O AGENTE EXPRESS');
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener"/);
  }
  assert.match(SCRIPT_SOURCE, new RegExp(`WHATSAPP_NUMERO = '${WHATSAPP_NUMBER}'`));
});

test('V2.1 — nenhum gate, reveal ou cabeçalho fixo foi reintroduzido', () => {
  for (const prohibited of [/content-locked/, /stickyNav/, /sticky-nav/, /initStickyNav/, /initScrollReveal/]) {
    assert.doesNotMatch(INDEX_SOURCE + SCRIPT_SOURCE, prohibited);
  }
  for (const id of ['investimento', 'ctaInvestimento', 'ctaFinal']) {
    const openingTag = INDEX_VISIBLE.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
    assert.ok(openingTag, `oferta precisa existir no HTML inicial: ${id}`);
    assert.doesNotMatch(openingTag[0], /\bhidden\b|aria-hidden="true"|display\s*:\s*none|visibility\s*:\s*hidden/);
  }
  assert.doesNotMatch(SCRIPT_SOURCE, /(?:getElementById\(['"]investimento['"]\)|ctaInvestimento|ctaFinal)[^;]*\.hidden\s*=\s*true/);
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

test('Tracking de oferta observa somente o bloco compacto que contém o preço real', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, 'data-offer-price'), 1);
  assert.match(INDEX_SOURCE, /<div class="offer-price-block" data-offer-price>[\s\S]*?R\$97[\s\S]*?<\/div>/);
  for (const event of ['Scroll_50', 'Scroll_90', 'Offer_View']) {
    assert.match(SCRIPT_SOURCE, new RegExp(`'${event}'`));
  }
});

test('V2.1 — Meta Pixel dispara um PageView e carrega fbevents uma vez', () => {
  assert.equal(countOccurrences(INDEX_SOURCE, "fbq('track', 'PageView', {}, { eventID: id })"), 1);
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
  assert.match(cssAtRule('@media(min-width:768px)'), /\.testimonials\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
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
  const proof = INDEX_SOURCE.match(/<section[^>]*id="prova-mecanismo"[\s\S]*?<\/section>/)[0];
  assert.ok(proof.includes('id="depoimentos"'));
  const testimonials = proof.slice(proof.indexOf('id="depoimentos"'));
  assert.match(testimonials, /Naldo/);
  assert.match(testimonials, /Amanda/);
  assert.doesNotMatch(testimonials, /Cada experiência é individual|não garante clientes, vendas ou renda/i);
  assert.doesNotMatch(INDEX_VISIBLE, /\bPIX\b|R\$\s*3[.]?500/i);
});

test('V2.1 — rota crítica prioriza o poster só no desktop e mantém o FAQ fora da contenção', () => {
  const images = INDEX_SOURCE.match(/<img[^>]*>/g) || [];
  const local = images.filter((tag) => /src="assets\//.test(tag));
  assert.ok(local.length >= 6, 'ativos reais essenciais devem permanecer');
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
  assert.match(thumbnail, /fetchpriority="low"/);
  assert.doesNotMatch(thumbnail, /loading="lazy"/);
  const posterPreload = INDEX_SOURCE.match(/<link[^>]*rel="preload"[^>]*href="assets\/images\/vsl-poster\.webp"[^>]*>/);
  assert.ok(posterPreload);
  assert.match(posterPreload[0], /as="image"/);
  assert.match(posterPreload[0], /fetchpriority="high"/);
  assert.match(posterPreload[0], /media="\(min-width: 900px\)"/);
  assert.equal((INDEX_SOURCE.match(/fetchpriority="high"/g) || []).length, 1);
  assert.match(STYLE_SOURCE, /main>\.section:not\(#faq\)\s*\{[^}]*content-visibility:\s*auto;[^}]*contain-intrinsic-size:\s*auto 900px/);
  assert.doesNotMatch(STYLE_SOURCE, /#faq\s*\{[^}]*content-visibility:\s*auto/);
  assert.doesNotMatch(STYLE_SOURCE, /\.hero[^{}]*\{[^}]*content-visibility:\s*auto/);
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
  assert.equal(landing.pixelCalls.filter((call) => ['Purchase', 'InitiateCheckout'].includes(call[1])).length, 0);
});

test('Agente Express — cinco UTMs, src, sck e fbclid chegam aos dois checkouts antes do play', () => {
  const landing = bootLanding({
    search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=teste' +
            '&utm_term=adset&utm_content=criativo&src=meta_ads&sck=1_2_3&fbclid=ABC123' +
            '&s1=legado1&s2=legado2&s3=legado3'
  });
  const href = landing.elements.ctaInvestimento.href;
  for (const id of ['ctaInvestimento', 'ctaFinal']) {
    const url = new URL(landing.elements[id].href);
    assert.equal(url.origin + url.pathname, CHECKOUT_URL);
    for (const [key, value] of [
      ['utm_source', 'facebook'], ['utm_medium', 'paid_social'], ['utm_campaign', 'teste'],
      ['utm_term', 'adset'], ['utm_content', 'criativo'], ['src', 'meta_ads'],
      ['sck', '1_2_3'], ['fbclid', 'ABC123']
    ]) assert.equal(url.searchParams.get(key), value, `${id}: ${key}`);
    // Política já vigente na migração para Hotmart: os campos da Kiwify não voltam.
    for (const legacy of ['s1', 's2', 's3']) assert.equal(url.searchParams.has(legacy), false);
  }
  assert.equal(landing.elements.ctaFinal.href, href);
  const saved = JSON.parse(landing.storage.getItem('metodoexpress_tracking'));
  for (const legacy of ['s1', 's2', 's3']) assert.equal(saved.params[legacy], undefined);
  assert.deepEqual(landing.pixelCalls, []);
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
