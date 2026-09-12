# Validação local — correção do LCP mobile do Agente Express

Execução: 11–12/09/2026.

- Estado investigado: `03ec07eba0cc8585725e616d558fc7e7b2122f4d`.
- Baseline solicitado: `9f45645389961c6b1448033e21e6ddb026beb660`
  (`8046fb8^`).
- Lighthouse 13.4.1, Chrome 153, mesma máquina, mesmo servidor estático,
  cache frio e simulação padrão mobile/desktop em todas as comparações.
- Nenhum push, deploy, checkout, Pix, compra ou acesso ao Gerenciador de
  Eventos da Meta foi realizado. A URL publicada recebeu somente inspeções
  HTTP e Lighthouse de leitura.

## Resultado

A correção final reduziu o LCP mobile mediano controlado de **2.663,6 ms para
2.342,0 ms** (menos 321,6 ms, ou 12,1%) e elevou a mediana de Performance de
96 para 98. CLS permaneceu 0 e TBT caiu de 90 para 12,5 ms. A meta de LCP de
até 2,5 s foi atendida nas três execuções finais.

O relatório PageSpeed informado para a versão publicada marcou 84 e LCP de
4,2 s. Essa regressão absoluta não foi reproduzida localmente: sob condições
idênticas, `03ec07e` ficou 41,8 ms mais rápido em LCP que `8046fb8^`. Um
diagnóstico único e controlado da URL publicada também marcou Performance 99 e
LCP 1.886,1 ms. Portanto, não há base para atribuir os 4,2 s a uma única
mudança do commit. O A/B local comprovou, porém, duas fontes de trabalho
evitável na versão atual e o ganho causal da correção aplicada.

Copy, ordem, layout aprovado, IDs, destinos, `script.js`, `api/pageview.js` e
ativos permaneceram inalterados.

## Elemento LCP identificado

No mobile, em todas as execuções do estado atual e da correção, o LCP é texto:

```text
div.container > div.hero-layout > div.hero-copy > h1#hero-titulo
```

```html
<h1 id="hero-titulo">Tenha uma IA personalizada que encontra oportunidades, cria a transformação e prepara o serviço para você <span class="accent">oferecer pelo celular.</span></h1>
```

No trace mobile, o retângulo foi 372 × 197 px, de `top: 117` a `bottom: 314`.
O H1 tem `display: block`; ele e seus ancestrais permanecem visíveis, com
`visibility: visible` e `opacity: 1`. O título tem `animation-name: none` e sem
transição. Não há classe reveal, espera por JavaScript, IntersectionObserver ou
gate da VSL no hero.

No desktop final, o LCP continua sendo o poster semântico da VSL:

```text
div.vsl-wrap > div#vslPlayer > a#vslStartOverlay > img
```

```html
<img src="assets/images/vsl-poster.webp" alt="Thumbnail oficial da apresentação em vídeo do Método Express" width="720" height="1279" loading="eager" fetchpriority="low" decoding="async">
```

O preload com `media="(min-width: 900px)"` antecipa esse poster somente quando
o layout desktop é usado. A requisição foi `Low` no mobile e `High` no desktop.
No baseline `8046fb8^`, o poster também era o LCP mobile; a nova arquitetura do
hero deslocou o LCP mobile para o título.

## Decomposição do LCP mobile

O run mediano por LCP foi `current-mobile-3.json` antes e
`final-safe-mobile-2.json` depois:

| Fase | `03ec07e` | Correção final |
|---|---:|---:|
| LCP simulado usado no score | 2.663,6 ms | 2.342,0 ms |
| TTFB observado | 3,870 ms | 3,279 ms |
| Atraso até requisição | não aplicável | não aplicável |
| Duração do download | não aplicável | não aplicável |
| Atraso de renderização observado | 188,058 ms | 97,683 ms |
| LCP observado no trace | 191,928 ms | 100,962 ms |

O LCP é texto, por isso não possui fases de requisição e download próprias. O
Lighthouse usa Lantern para o valor simulado que alimenta o score, enquanto o
breakdown expõe os tempos observados do trace; por isso os subtempos não somam
2.663,6 ou 2.342,0 ms.

No run desktop final mediano, o poster teve TTFB 3,288 ms, atraso de requisição
4,896 ms, download 4,523 ms e atraso de renderização 112,714 ms.

## Causa comprovada e correção

1. O poster de 59.948 bytes era preloaded e marcado `fetchpriority="high"` em
   todas as larguras, embora não fosse o LCP mobile. No waterfall atual ele
   apareceu como `High` e `isLinkPreload: true`, concorrendo com as fontes do
   título. Condicionar somente o preload ao desktop e deixar o `<img>` em
   prioridade baixa reduziu o LCP mediano em 112,4 ms, de 2.663,6 para
   2.551,2 ms. O isolamento comprovou o efeito, mas ainda não atingiu a meta.
2. O documento novo fazia style/layout e descoberta de mídia de toda a página
   antes da primeira dobra. No run mediano, `Style & Layout` caiu de 568,1 para
   219,5 ms, trabalho total da main thread de 791,0 para 380,8 ms, requisições
   iniciais de 15 para 9 e long tasks de 280 para 76 ms. A correção aplica
   `content-visibility: auto` somente às seções abaixo do hero, reserva 900 px
   e exclui o FAQ interativo.

O ganho adicional do adiamento abaixo da dobra foi 209,1 ms em relação ao
poster isolado. As duas mudanças são pequenas, diretamente ligadas às medições
e foram validadas separadamente antes de serem mantidas.

As fontes Sora e Inter já são locais, usam `font-display: swap` e ambas aparecem
acima da dobra: Sora no título e Inter nos demais textos. Elas permaneceram
preloaded e `High`; não houve benefício consistente em alterar ou embutir as
fontes. O iframe e a API do YouTube continuam ausentes até interação. Pixel e
CAPI não foram removidos nem condicionados ao Lighthouse.

### Cache

HTML, Sora, Inter e poster publicados responderam `200`, `X-Vercel-Cache: HIT`
e `Cache-Control: public, max-age=0, must-revalidate`. Esses arquivos são
próprios, mas seus nomes não têm hash ou versão na URL; marcar as URLs atuais
como `immutable` criaria risco de conteúdo antigo após um deploy futuro. Por
isso nenhum TTL foi alterado nesta correção. Cache de YouTube e Meta ficou fora
do escopo por pertencer a terceiros.

## Comparação pedida: `8046fb8^` × `03ec07e`

Três execuções mobile comparáveis:

| Versão | Run | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `8046fb8^` | 1 | 97 | 1.047,0 | 2.631,0 | 0 | 0 | 1.047,0 |
| `8046fb8^` | 2 | 95 | 1.400,5 | 2.706,5 | 99,5 | 0 | 1.400,5 |
| `8046fb8^` | 3 | 95 | 1.373,4 | 2.705,4 | 93,5 | 0 | 1.457,7 |
| `03ec07e` | 1 | 97 | 1.117,9 | 2.638,8 | 0 | 0 | 1.117,9 |
| `03ec07e` | 2 | 94 | 1.515,3 | 2.753,3 | 142,5 | 0 | 1.567,2 |
| `03ec07e` | 3 | 96 | 1.419,1 | 2.663,6 | 90 | 0 | 1.456,4 |

| Mediana | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `8046fb8^` | 95 | 1.373,4 | 2.705,4 | 93,5 | 0 | 1.400,5 |
| `03ec07e` | 96 | 1.419,1 | 2.663,6 | 90 | 0 | 1.456,4 |

Essa comparação comprova a troca do elemento LCP de poster para título e uma
piora pequena de FCP/Speed Index, mas não reproduz elevação de LCP nem o valor
de 4,2 s observado no PageSpeed.

## Lighthouse antes × depois

### Mobile

| Estado | Run | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `03ec07e` | 1 | 97 | 1.117,9 | 2.638,8 | 0 | 0 | 1.117,9 |
| `03ec07e` | 2 | 94 | 1.515,3 | 2.753,3 | 142,5 | 0 | 1.567,2 |
| `03ec07e` | 3 | 96 | 1.419,1 | 2.663,6 | 90 | 0 | 1.456,4 |
| final | 1 | 98 | 1.279,9 | 2.342,4 | 12,5 | 0 | 1.279,9 |
| final | 2 | 98 | 1.280,0 | 2.342,0 | 13 | 0 | 1.280,0 |
| final | 3 | 98 | 1.276,1 | 2.338,1 | 11 | 0 | 1.276,1 |

| Mediana mobile | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `03ec07e` | 96 | 1.419,1 | 2.663,6 | 90 | 0 | 1.456,4 |
| final | 98 | 1.279,9 | 2.342,0 | 12,5 | 0 | 1.279,9 |

Uma auditoria completa adicional da árvore final marcou Performance 98,
Acessibilidade 100, Práticas Recomendadas 100 e SEO 100, sem `runtimeError` ou
warning de navegação.

### Desktop

| Estado | Run | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `03ec07e` | 1 | 100 | 335,6 | 590,6 | 0 | 0 | 424,2 |
| `03ec07e` | 2 | 100 | 337,2 | 591,2 | 1 | 0 | 425,4 |
| `03ec07e` | 3 | 100 | 336,5 | 590,5 | 1 | 0 | 422,6 |
| final | 1 | 100 | 300,8 | 564,8 | 0 | 0 | 300,8 |
| final | 2 | 100 | 304,8 | 565,8 | 0 | 0 | 304,8 |
| final | 3 | 100 | 303,2 | 564,2 | 0 | 0 | 303,2 |

| Mediana desktop | Performance | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `03ec07e` | 100 | 336,5 | 590,6 | 1 | 0 | 424,2 |
| final | 100 | 303,2 | 564,8 | 0 | 0 | 303,2 |

O Lighthouse gerou JSONs íntegros, sem runtime error ou warning. Em algumas
execuções, a CLI emitiu `EBUSY` somente ao tentar apagar o perfil temporário do
Chrome depois de salvar o relatório; essa falha de limpeza não pertence à
página nem invalida os arquivos gerados.

## Arquivos alterados

| Arquivo | Alteração desta correção |
|---|---|
| `index.html` | preload responsivo do poster, prioridade baixa no `<img>` e contenção das seções abaixo da dobra, exceto FAQ |
| `tests/landing-v2.test.js` | regressões para prioridade única/responsiva, dimensões, lazy loading, hero e contenção |
| `tools/preview-local.mjs` | baseline corrigido de `8046fb8` para `8046fb8^` |
| `README.md` | comportamento de mídia, contenção e baseline documentados |
| `VALIDACAO-AGENTE-EXPRESS-LOCAL.md` | investigação, métricas e QA desta rodada |

`script.js`, `api/pageview.js`, fontes, imagens e vídeos não foram alterados. Os
três documentos locais não rastreados do usuário foram preservados e ficaram
fora do commit.

## Testes, build e QA renderizado

- Suíte completa: **99/99 testes passaram**.
- `node --check` passou para `script.js`, `api/pageview.js` e
  `tools/preview-local.mjs`.
- `git diff --check`: aprovado.
- `vercel build --prod --non-interactive`: artefato local criado com `status:
  ok`; nenhum deploy foi executado.
- Viewports validados: 360×800, 390×844, 430×932, 768×1024, 899×900,
  900×900, 1024×768 e 1440×1000.
- Não houve overflow horizontal, texto principal abaixo de 16 px, imagem
  quebrada, erro ou warning da página no console.
- O Lighthouse manteve CLS 0; um salto automatizado do topo ao CTA final,
  renderizando as seções adiadas, acumulou CLS 0,0087, ainda abaixo da meta de
  0,1.
- O breakpoint 899/900 manteve uma coluna antes de 900 e duas colunas a partir
  de 900; o preload do poster só corresponde ao segundo caso.
- O hero permaneceu visível no HTML inicial, sem observer ou animação. Em uma
  cópia de auditoria com `script-src 'none'`, título e CTA ficaram visíveis,
  oferta e exatamente dois checkouts permaneceram no HTML e nenhum script foi
  executado.
- FAQ abriu por clique, preservou ARIA/foco visível e fechou por Enter.
- As duas ampliações abriram os WebP locais corretos em nova aba.
- A VSL criou somente o iframe `fIDX2aD1TdQ` após clique e registrou
  `VSL_Start` uma vez.
- Os dois CTAs foram clicados no preview sanitizado, sem abrir a Hotmart. A
  oferta continuou disponível sem iniciar a VSL.
- `Scroll_50`, `Scroll_90` e `Offer_View` ocorreram uma vez durante a travessia
  controlada; as seções adiadas foram renderizadas normalmente.

## Checkout, atribuição e tracking

Foram encontrados exatamente dois links para
`https://pay.hotmart.com/G106758643C`, IDs `ctaInvestimento` e `ctaFinal`. Ambos
receberam `src`, `sck`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`,
`utm_content` e `fbclid`; `s1/s2/s3` não foram reintroduzidos.

O preview registrou um PageView do Pixel e um POST CAPI por documento, HTTP 202
simulado, com `eventID`/`event_id` correspondentes, `credentials: same-origin`,
`keepalive: true` e nenhum recurso Meta. Não houve `Purchase` ou
`InitiateCheckout`. Os testes automatizados preservam `_fbp`, prazo, `pagehide`,
BFCache, deduplicação, scroll, oferta e VSL. A simulação local comprova o
contrato do código, não a aceitação externa pela Meta.

## Capturas finais do hero

- [Hero mobile — viewport de 390 px](screenshots/lcp-audit/final/hero-mobile-390.png)
- [Hero desktop — viewport de 1440 px](screenshots/lcp-audit/final/hero-desktop-1440.png)

O Chrome reservou 15 px para a barra vertical nas capturas. O hero móvel foi
capturado com altura suficiente para mostrar copy, CTA, poster e legenda; o
desktop foi capturado em 1440×1000. Não houve alteração visual relevante.

## Pendências externas preservadas

Continuam pendentes a confirmação das condições reais da Hotmart, o teste de
acesso ao agente com conta de aluno, a revisão integral/atualização da VSL e os
ativos reais já listados na rodada de polimento. Nada disso foi tratado como
resolvido nesta correção local de desempenho.
