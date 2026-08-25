# Método Express — Landing Page

Página de vendas de página única do curso **Método Express** (marca **Operação Home Office**).
HTML5 + CSS + JavaScript vanilla, sem framework e sem nenhuma dependência externa (fontes self-hosted).

## Estrutura

```
/
├── index.html   (CSS embutido no <head> + script síncrono do content gate)
├── script.js
├── og-template.html   (template 1200×630 usado pra renderizar assets/images/og-image.jpg)
├── /assets
│   ├── /images
│   ├── /icons      (favicon.svg)
│   └── /fonts      (inter-var.woff2, sora-var.woff2)
├── README.md
└── .gitignore
```

## Rodar localmente

Como é HTML estático puro, basta abrir `index.html` no navegador. Se preferir um servidor local (recomendado para testar o carregamento de fontes/CORS):

```bash
npx serve .
```

## Constantes e valores em produção

Todas as constantes de JS ficam nas primeiras linhas de `script.js`.

| Constante | Onde | Valor atual |
|---|---|---|
| `VSL_VIDEO_URL_MOBILE` | `script.js` | `https://www.youtube.com/embed/zyZgphLLg-Y` — corte **quadrado (1:1)**, usado abaixo de 640px |
| `VSL_VIDEO_URL_DESKTOP` | `script.js` | `https://www.youtube.com/embed/a4tbLBVzkOs` — corte **16:9**, usado a partir de 640px |
| `VSL_DESKTOP_BREAKPOINT` | `script.js` | `(min-width: 640px)` — precisa bater com o breakpoint do CSS |
| `KIWIFY_CHECKOUT_URL` | `script.js` | `https://pay.kiwify.com.br/kuEkae8` |
| `CONTENT_GATE_SECONDS_MOBILE` | `script.js` **e** `index.html` | `415` (6min55s) — ver "Content gate" abaixo |
| `CONTENT_GATE_SECONDS_DESKTOP` | `script.js` **e** `index.html` | `415` (6min55s) — separado do mobile pra poder ajustar um sem o outro |
| `WHATSAPP_NUMERO` | `script.js` | `5548988430812` |
| `WHATSAPP_MENSAGEM` | `script.js` | "Oi! Vi a página do Método Express e queria saber mais." |
| Meta Pixel | `index.html` (`<head>`) | **ATIVO** — ID `3401433073361667` |
| TikTok Pixel | `index.html` (`<head>`, bloco comentado) | **não ativado** — cole o snippet do TikTok Ads Manager quando a conta existir |
| `og:url` / `canonical` | `index.html` (`<head>`) | `https://operacaohomeoffice.vercel.app/` |

> Os links de checkout e do WhatsApp **também estão fixos no `href` de cada botão no HTML**. Isso é proposital: se o `script.js` falhar, os botões continuam funcionando. O JS só reescreve o link pra acrescentar os parâmetros de rastreamento.

## Vídeo (VSL)

São **dois vídeos**, um por dispositivo, porque o corte de mobile é quadrado e o de desktop é 16:9. A escolha usa o mesmo breakpoint de 640px do CSS (`getVslVideoUrl()` em `script.js`), e o card `.vsl-player` troca de `aspect-ratio` no mesmo ponto — casando exato com o formato de cada arquivo, sem cortar nem sobrar barra preta.

O player do YouTube só carrega **depois do clique do usuário** — evita baixar a IFrame API (~500 KB) na primeira carga.

**Antes do clique não carrega mídia nenhuma.** O card é só fundo teal escuro (`--color-accent-darker`), botão de play e a legenda "Assista: como funciona o Método Express". Já existiu ali um clipe curto em loop, mas o arquivo era um placeholder inadequado (abertura de estúdio de cinema) e foi removido junto com o poster extraído dele.

Depois do clique, o player usa a **IFrame Player API** com `controls: 0`, `disablekb: 1` e `fs: 0` — sem barra de progresso, sem seek. Dá pra pausar e retomar só pelo botão transparente que cobre o vídeo. Legendas do YouTube ficam ligadas (`cc_load_policy: 1`) quando o vídeo tiver legenda cadastrada.

### Quando o clipe de preview real for gravado

Pra devolver a sensação de "vídeo já ligado", grave um clipe curto (~5s, mudo) **da própria VSL**, já quadrado e sem barras pretas queimadas, e recoloque dentro do `.vsl-player` no `index.html`:

```html
<video class="vsl-preview" src="assets/videos/vsl-loop.mp4"
       poster="assets/images/vsl-loop-poster.webp"
       autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>
<div class="vsl-preview-overlay" aria-hidden="true"></div>
```

As regras CSS `.vsl-preview` e `.vsl-preview-overlay` também foram removidas — reponha-as junto (`position:absolute; inset:0; object-fit:cover` no vídeo, e um véu escuro de ~45% no overlay, pra legenda continuar legível).

O arquivo precisa ser leve, porque entra em toda carga de página, no herói. Comprima assim:

```bash
ffmpeg -i entrada.mp4 \
  -an \
  -c:v libx264 -preset slow -crf 28 \
  -vf "scale=640:640:flags=lanczos" \
  -pix_fmt yuv420p -profile:v high -level 4.0 -g 60 \
  -movflags +faststart \
  assets/videos/vsl-loop.mp4
```

`-an` remove o áudio (o clipe toca mudo), e `-movflags +faststart` põe o índice `moov` no começo do arquivo — sem isso o navegador precisa baixar o arquivo quase inteiro antes de mostrar o primeiro quadro.

Depois, extraia o poster do **primeiro frame** (pra imagem e vídeo casarem sem salto):

```bash
ffmpeg -i assets/videos/vsl-loop.mp4 -frames:v 1 \
  -c:v libwebp -quality 80 assets/images/vsl-loop-poster.webp
```

## Content gate

Tudo abaixo do vídeo (headline, oferta, seções, rodapé, botão de WhatsApp) fica escondido até a pessoa assistir **415 segundos de VSL**. Na primeira tela só aparece o vídeo, com fundo preto — sem cara de página de vendas.

São **415 segundos de reprodução efetiva, não de página aberta**: o contador só corre enquanto o player do YouTube está em `PLAYING` e para quando o vídeo é pausado. Deixar a aba aberta não libera nada.

O alvo é definido **por dispositivo** (`CONTENT_GATE_SECONDS_MOBILE` / `_DESKTOP`), usando o mesmo breakpoint de 640px que escolhe a VSL. Hoje os dois valem 415s; a separação existe porque são dois cortes diferentes do vídeo e podem divergir de duração.

A implementação está em duas partes, de propósito:

1. **`index.html`, `<script>` síncrono no `<head>`** — decide se trava, aplicando `.content-locked` no `<html>` **antes do primeiro paint**. Se isso ficasse a cargo do `script.js` (que é `defer`), o navegador chegaria a pintar a página de vendas inteira antes de escondê-la.
2. **`script.js`, `createContentGate()`** — acumula o tempo assistido e destrava.

Chaves de `localStorage`:

| Chave | O que guarda |
|---|---|
| `mex_vsl_watched_seconds` | segundos de VSL já assistidos (gravado a cada ~5s) |
| `mex_content_unlocked` | `'1'` depois de liberado — a partir daí a página abre normal, sem flash preto |
| `mex_content_unlock_at` | **chave antiga**, do gate por relógio. Só é lida pra migração: quem já tinha passado do prazo continua liberado |

**Fail-open em quatro camadas** — uma landing travada não vende nada:

- `localStorage` indisponível (modo privado, cookies bloqueados) → libera;
- exceção no script do `<head>` ou no `createContentGate()` → libera;
- **watchdog**: se o `script.js` não assumir o gate em 10s (arquivo não carregou, erro de sintaxe, bloqueador) → libera sozinho;
- se a API do YouTube não subir em 15s, ou se o player for um iframe genérico cujo estado não dá pra observar → libera.

> Não é antifraude. Qualquer pessoa limpa o `localStorage` e recomeça, e isso está ok — é controle de experiência da VSL, não proteção de conteúdo.

Pra mudar a duração, altere `CONTENT_GATE_SECONDS_MOBILE` / `_DESKTOP` em `script.js` **e** `REQUIRED_SECONDS_MOBILE` / `_DESKTOP` no script do `<head>` do `index.html`. Os dois pares precisam bater.

## Rastreamento

### Meta Pixel (ativo)

O snippet no `<head>` do `index.html` é uma versão otimizada do oficial: o `fbq()` fica disponível na hora (chamadas antes do carregamento entram na fila), mas o `fbevents.js` só é buscado no primeiro toque/scroll/movimento do visitante — ou depois de 4s, o que vier primeiro. Isso tira ~170 KB do caminho crítico.

> Efeito colateral conhecido: quem sai em menos de 4s **sem nenhuma interação** não gera PageView. Se a subnotificação atrapalhar a otimização de campanha, baixe o `setTimeout(start, 4000)` pra 1500–2000ms.

Eventos disparados (`trackPixel()` em `script.js`, sempre sob `typeof fbq === 'function'` e dentro de `try/catch`, pra nunca impedir a navegação):

| Evento | Quando |
|---|---|
| `PageView` | carga da página (snippet do `<head>`) |
| `InitiateCheckout` | clique em qualquer um dos 3 botões de compra |
| `Contact` | clique no botão flutuante de WhatsApp |

`Purchase` **não** é disparado aqui — quem registra a compra é o Kiwify.

### Atribuição e repasse de UTMs para o checkout

A landing captura os parâmetros de aquisição da URL de entrada, guarda no `localStorage` e anexa ao link do Kiwify no momento do clique — pra venda não chegar lá sem origem mesmo quando a pessoa assiste 7 minutos de VSL, recarrega a página ou volta dias depois.

Parâmetros capturados (`TRACKING_PARAMS` em `script.js`):

```
utm_source  utm_medium  utm_campaign  utm_term  utm_content
src  sck  s1  s2  s3
```

São exatamente os 10 parâmetros de rastreamento que a Kiwify documenta — nada além disso é capturado. É o mesmo conjunto configurado em **Parâmetros da URL** do Meta Ads; os placeholders (`{{campaign.name}}` etc.) ficam **só lá**, o site nunca os tem hardcoded e apenas recebe os valores já resolvidos.

`fbclid` **não** faz parte deste módulo. Quem cuida do clique identificado do Facebook é o próprio Meta Pixel, via cookies `_fbc`/`_fbp` — fora do escopo daqui.

> Só dados de atribuição de marketing. **Nunca acrescentar PII** (nome, e-mail, telefone, documento) a essa lista nem a URLs de rastreamento.

**Persistência** — chave `metodoexpress_tracking`, validade de **30 dias**:

```json
{ "v": 1, "ts": 1770000000000, "params": { "utm_source": "facebook", "…": "…" } }
```

Passada a validade, a chave é descartada na leitura seguinte e o checkout volta a ser a URL limpa.

**Atribuição — last paid touch.** A URL só substitui o que está salvo quando traz pelo menos um parâmetro de campanha (`TRACKING_CAMPAIGN_PARAMS`: os cinco `utm_*`, `src`, `sck`). A troca é **atômica** — o conjunto inteiro de uma vez, nunca mesclado — pra não misturar `utm_source` de uma campanha com `utm_content` de outra. Retorno direto e reload **não apagam** a campanha anterior. `s1`/`s2`/`s3` ficam fora dos gatilhos de propósito: sozinhos são só IDs numéricos do Meta, sem origem declarada.

**Anexação ao checkout** (`withTrackingParams()`): usa `URL`/`URLSearchParams`, então o encoding é correto por construção e não há `??` nem `&&`. Nunca sobrescreve um parâmetro que já venha no link do Kiwify, e é idempotente — reaplicar não duplica nada. Qualquer erro devolve a URL original intacta: o CTA nunca quebra por causa de rastreamento.

Além do `href` definido na carga, um listener delegado em fase de captura reaplica a atribuição no instante do clique. O filtro compara `new URL(href).hostname === 'pay.kiwify.com.br'` — hostname exato, não `indexOf`, pra que domínios como `pay.kiwify.com.br.outrodominio.com` não sejam aceitos. WhatsApp, redes sociais e qualquer outro link externo ficam intocados.

Pra testar, abra a página com `?src=meta_ads&sck=teste01&utm_source=teste&utm_campaign=x&s1=123` e confira o `href` dos botões e a chave `metodoexpress_tracking` no DevTools.

## Performance

- Fontes self-hosted (`assets/fonts`) com `font-display: swap` — zero conexão externa. Só a Inter tem `preload`: nenhum texto em Sora fica visível antes do gate liberar.
- CSS embutido no `<head>` de `index.html` — elimina a requisição que bloqueava a renderização. Para editar estilos, edite o bloco `<style>` do `index.html`.
- JS carregado com `defer`.
- Nenhuma dependência externa.
- Player do YouTube carregado sob demanda; herói sem mídia antes do clique.
- Imagens em **WebP** com `srcset`, `width`/`height` explícitos e `loading="lazy"` abaixo da primeira dobra.

## Deploy (GitHub + Vercel)

1. Inicialize o repositório local (se ainda não tiver feito):
   ```bash
   git init
   git add .
   git commit -m "Landing page Método Express"
   ```
2. Crie um repositório vazio no GitHub e conecte:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git branch -M main
   git push -u origin main
   ```
3. Entre em [vercel.com](https://vercel.com), clique em **Add New → Project** e importe o repositório do GitHub.
4. Como é site estático, **não precisa configurar build command nem output directory** — a Vercel detecta e publica direto.

Não é necessário `vercel.json`, a menos que você precise de redirects específicos no futuro.

## Regras de conteúdo (não alterar)

- Não adicionar prints de saldo, PIX recebido ou valores de faturamento em nenhum lugar da página.
- **Garantia: 7 dias, sem condição de execução.** A redação na página é "Garantia de 7 dias: você tem
  7 dias para conhecer o Método Express. Se entender que não é para você dentro desse período, pode
  solicitar o reembolso." Não condicionar o reembolso a completar missões nem a qualquer outra tarefa —
  o direito de arrependimento do CDC (art. 49) é incondicional. Não prometer garantia de resultado,
  devolução depois dos 7 dias, "sem perguntas" ou "sem burocracia".
- **Não adicionar contador regressivo, "vagas limitadas", preço riscado sem lastro ou qualquer urgência artificial.** A oferta mostra só `R$97 à vista` + "Parcelamento disponível no checkout." — sem âncora de preço anterior e sem número de parcelas na página, porque o parcelamento exato não foi confirmado contra o Kiwify.
- Usar linguagem de processo ("aprende", "monta", "faz abordagens"), nunca de resultado garantido ("fecha cliente", "primeira renda", "receita recorrente").
- Antes de rodar tráfego pago no Meta, revisar o texto contra a política de categoria especial de Emprego.
