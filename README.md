# Método Express — Landing Page

Página de vendas de página única do curso **Método Express** (marca **Operação Home Office**).
HTML5 + CSS + JavaScript vanilla, sem framework e sem nenhuma dependência externa (fontes self-hosted).

## Estrutura

```
/
├── index.html   (HTML da landing + CSS embutido no <head>)
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
| `HOTMART_CHECKOUT_URL` | `script.js` | `https://pay.hotmart.com/G106758643C` |
| `VSL_OFFER_SECONDS_MOBILE` | `script.js` | `415` (6min55s) — ponto legítimo do evento `VSL_Offer` no mobile |
| `VSL_OFFER_SECONDS_DESKTOP` | `script.js` | `415` (6min55s) — ponto legítimo do evento `VSL_Offer` no desktop |
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

## Página aberta e ponto da oferta

A landing inteira nasce visível. Headline, oferta, seções, rodapé, WhatsApp e os três CTAs da Hotmart não dependem do player, de tempo assistido ou de qualquer chave de storage.

O marco de **415 segundos de reprodução efetiva** continua existindo somente para o evento `VSL_Offer`. `createVslOfferProgress()` conta enquanto o YouTube está em `PLAYING` e a aba está visível, preserva callbacks atrasados com validação do playhead e não aceita um salto artificial como consumo legítimo.

O alvo é definido por dispositivo (`VSL_OFFER_SECONDS_MOBILE` / `_DESKTOP`) usando o mesmo breakpoint de 640px da VSL. Hoje ambos valem 415s.

Chaves de `localStorage`:

| Chave | Estado atual |
|---|---|
| `mex_vsl_watched_seconds` | preservada para acumular o progresso legítimo até `VSL_Offer` |
| `mex_content_unlocked` | chave legada ignorada; não controla visibilidade nem tracking |
| `mex_content_unlock_at` | chave legada ignorada |

O evento `VSL_Offer` não dispara no load, por scroll, CTA, página visível ou storage legado. Ele continua deduplicado em `sessionStorage` junto com os demais eventos da VSL.

## Rastreamento

### Meta Pixel (ativo)

O snippet no `<head>` do `index.html` disponibiliza `fbq()`, inicializa o Pixel e enfileira `PageView` imediatamente. O download async de `fbevents.js` começa 1500ms depois, sem depender de toque, scroll ou qualquer outra interação. Esse intervalo dá ao navegador tempo para concluir a pintura prioritária sem recriar a antiga janela de perda de 4s.

Eventos disparados (`trackPixel()` em `script.js`, sempre sob `typeof fbq === 'function'` e dentro de `try/catch`, pra nunca impedir a navegação):

| Evento | Quando |
|---|---|
| `PageView` | carga da página (snippet do `<head>`) |
| `Contact` | clique no botão flutuante de WhatsApp |

`InitiateCheckout` e `Purchase` **não** são disparados aqui — quem registra os dois é a Hotmart, que está configurada com o mesmo Pixel/Dataset (`3401433073361667`) via WEB + API de Conversões. A landing disparava `InitiateCheckout` no clique dos CTAs; isso foi removido na migração, porque a Hotmart já dispara o evento quando a página de pagamento carrega e os dois juntos contariam duas vezes a mesma ida ao checkout.

### Atribuição e repasse de UTMs para o checkout

A landing captura os parâmetros de aquisição da URL de entrada, guarda no `localStorage` e anexa ao link da Hotmart no momento do clique — pra venda não chegar lá sem origem mesmo quando a pessoa assiste 7 minutos de VSL, recarrega a página ou volta dias depois.

Parâmetros capturados (`TRACKING_PARAMS` em `script.js`):

```
utm_source  utm_medium  utm_campaign  utm_term  utm_content
src  sck
```

São os 7 parâmetros de rastreamento da Hotmart — nada além disso é capturado. `s1`/`s2`/`s3` saíram na migração Kiwify → Hotmart; os IDs do Meta agora vão concatenados dentro de `sck`.

É o mesmo conjunto configurado em **Parâmetros da URL** do Meta Ads, algo como:

```
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}
&utm_term={{adset.name}}&utm_content={{ad.name}}
&src=meta_ads&sck={{campaign.id}}_{{adset.id}}_{{ad.id}}
```

Os placeholders ficam **só lá** — o site nunca os tem hardcoded, apenas recebe os valores já resolvidos. As UTMs carregam os nomes legíveis para análise; `sck` carrega os três IDs para auditoria precisa.

`fbclid` **não** faz parte deste módulo. Quem cuida do clique identificado do Facebook é o próprio Meta Pixel, via cookies `_fbc`/`_fbp` — fora do escopo daqui.

> Só dados de atribuição de marketing. **Nunca acrescentar PII** (nome, e-mail, telefone, documento) a essa lista nem a URLs de rastreamento.

**Persistência** — chave `metodoexpress_tracking`, versão **2**, validade de **30 dias**:

```json
{ "v": 2, "ts": 1770000000000, "params": { "utm_source": "facebook", "…": "…" } }
```

Passada a validade, a chave é descartada na leitura seguinte e o checkout volta a ser a URL limpa.

A versão subiu de 1 para 2 na migração: registros `v1` podiam conter `s1`/`s2`/`s3`, que não existem mais. Qualquer registro com versão diferente de 2 é **descartado** na leitura, e mesmo num registro `v2` só as chaves da whitelist atual são devolvidas — dupla garantia de que nada legado chega à Hotmart.

**Atribuição — last paid touch.** A URL só substitui o que está salvo quando traz pelo menos um parâmetro de campanha (`TRACKING_CAMPAIGN_PARAMS`: os cinco `utm_*`, `src`, `sck`). A troca é **atômica** — o conjunto inteiro de uma vez, nunca mesclado — pra não misturar `utm_source` de uma campanha com `utm_content` de outra. Retorno direto e reload **não apagam** a campanha anterior.

**Anexação ao checkout** (`withTrackingParams()`): usa `URL`/`URLSearchParams`, então o encoding é correto por construção e não há `??` nem `&&`. Nunca sobrescreve um parâmetro que já venha no link da Hotmart, e é idempotente — reaplicar não duplica nada. Qualquer erro devolve a URL original intacta: o CTA nunca quebra por causa de rastreamento.

Além do `href` definido na carga, um listener delegado em fase de captura reaplica a atribuição no instante do clique. O filtro compara `new URL(href).hostname === 'pay.hotmart.com'` — hostname exato, não `indexOf`, pra que domínios como `pay.hotmart.com.outrodominio.com` não sejam aceitos (e `hotmart.com`/`www.hotmart.com` também ficam de fora, já que não são checkout). WhatsApp, redes sociais e qualquer outro link externo ficam intocados.

Pra testar, abra a página com `?src=meta_ads&sck=111_222_333&utm_source=teste&utm_campaign=x` e confira o `href` dos botões e a chave `metodoexpress_tracking` no DevTools.

## Performance

- Fontes self-hosted (`assets/fonts`) com `font-display: swap` — zero conexão externa. Só a Inter tem `preload`, preservando a prioridade do pôster da VSL no caminho crítico.
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
- **Não adicionar contador regressivo, "vagas limitadas", preço riscado sem lastro ou qualquer urgência artificial.** A oferta mostra só `R$97 à vista` + "Parcelamento disponível no checkout." — sem âncora de preço anterior e sem número de parcelas na página, porque o parcelamento exato não foi confirmado contra a Hotmart.
- Usar linguagem de processo ("aprende", "monta", "faz abordagens"), nunca de resultado garantido ("fecha cliente", "primeira renda", "receita recorrente").
- Antes de rodar tráfego pago no Meta, revisar o texto contra a política de categoria especial de Emprego.
