# Método Express — Landing Page V2.1

Landing page estática do curso **Método Express**, da marca **Operação Home Office**.
O projeto usa HTML5, CSS embutido e JavaScript vanilla, sem framework.

## Estrutura

```text
/
├── index.html
├── script.js
├── assets/
│   ├── fonts/
│   ├── icons/
│   ├── images/
│   └── videos/
├── tests/
└── screenshots/v2-1-final/   (artefatos locais ignorados pelo Git)
```

## Arquitetura comercial V2.1

A página vende o mecanismo de “mostrar primeiro”, sem calendário de estudo:

1. hero com headline, subheadline e VSL;
2. mecanismo — celular, print, prompt e transformação;
3. demonstração antes/depois;
4. comparação Jeito 1 / Jeito 2;
5. processo único — Encontrar, Criar, Mostrar, Abordar, Oferecer, Entregar;
6. dois depoimentos;
7. autoridade de André Hoffmann;
8. oferta de R$97;
9. garantia;
10. FAQ;
11. CTA final e suporte por WhatsApp.

Não há gate de conteúdo, mini-header fixo, oferta rápida, botão flutuante de
WhatsApp ou seção comercial organizada por dias.

## Rodar localmente

Sirva a raiz com qualquer servidor HTTP estático. Exemplo:

```bash
npx serve .
```

Abrir o arquivo diretamente funciona para leitura, mas um servidor local é mais
confiável para validar fontes, mídia, tracking e o player do YouTube.

## Constantes de produção

| Constante | Valor atual |
|---|---|
| `VSL_VIDEO_URL` | `https://www.youtube.com/embed/fIDX2aD1TdQ` |
| `VSL_OFFER_SECONDS` | `null` — aguarda timestamp humano confirmado |
| `HOTMART_CHECKOUT_URL` | `https://pay.hotmart.com/G106758643C` |
| `WHATSAPP_NUMERO` | `554888742835` |
| `WHATSAPP_MENSAGEM` | `Oi! Vi a página do Método Express e queria saber mais.` |
| Meta Pixel | `3401433073361667` |

Os dois links de compra e o link do WhatsApp já nascem com destinos funcionais no
HTML. O JavaScript acrescenta atribuição aos checkouts e registra `Contact` no
clique do suporte.

## VSL

Mobile e desktop usam o mesmo vídeo do YouTube (`fIDX2aD1TdQ`), com 2min29s. O
contêiner preserva 9:16, mede até 420px no desktop e ocupa aproximadamente 92% da
largura no mobile.

Antes da interação, a landing carrega somente a thumbnail oficial do YouTube em
`hqdefault.jpg`. A imagem tem preload e `fetchpriority="high"`; o player e a IFrame
API só são criados após clique ou Enter na própria superfície da VSL. Não há
autoplay declarado, botão HTML extra, poster customizado nem tela intermediária.

Os controles nativos do YouTube ficam disponíveis. Os eventos `VSL_Start`,
`VSL_25`, `VSL_50`, `VSL_75` e `VSL_90` são deduplicados na sessão.

### `VSL_Offer` pendente

Não foi possível confirmar com segurança, a partir das legendas disponíveis no
YouTube Studio, o segundo exato em que a nova VSL diz “Continue descendo a
página”. Por isso `VSL_OFFER_SECONDS` permanece `null` e **`VSL_Offer` não dispara
em produção** até revisão humana.

Quando o segundo for confirmado, altere somente `VSL_OFFER_SECONDS`. A lógica de
contagem efetiva, pausa, buffering, aba oculta, reload e deduplicação continua
testada com um valor injetado exclusivamente pela suíte.

Chaves versionadas da nova VSL:

```text
mex_vsl_fIDX2aD1TdQ_watched_seconds
metodoexpress_vsl_fIDX2aD1TdQ_events
```

Chaves antigas permanecem intocadas e não ativam eventos da nova VSL.

## Tracking preservado

- `PageView` é enfileirado uma vez no `<head>`.
- `fbevents.js` carrega uma vez, com atraso de 1500ms.
- `Contact` dispara somente no clique real do suporte.
- A landing não cria `InitiateCheckout` nem duplica `Purchase`.
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `src` e
  `sck` são persistidos por 30 dias na chave `metodoexpress_tracking` versão 2.
- `fbclid` acompanha apenas a visita atual até o checkout e nunca é persistido.
- A atribuição usa *last paid touch* atômico e não mistura campanhas.

Nunca adicionar PII a parâmetros de URL ou ao storage de atribuição.

## Performance

Auditoria mobile local com Lighthouse 12.8.2:

| Métrica | Resultado |
|---|---:|
| Performance | 98 |
| Accessibility | 100 |
| Best Practices | 79 |
| SEO | 100 |
| FCP | 1,1s |
| LCP | 2,2s |
| CLS | 0 |
| TBT | 80ms |
| Speed Index | 1,1s |

O resultado de Best Practices é afetado pelos cookies de terceiros e pelo issue
de cookie gerado pelo Meta Pixel obrigatório. O relatório bruto não é versionado.

## Testes

```bash
node --check script.js
node --test tests/landing-v2.test.js tests/vsl-tracking.test.js tests/meta-pixel.test.js
```

Total atual: **67 testes**.

As regressões cobrem arquitetura, copy, dois CTAs Hotmart, suporte, atribuição,
`fbclid` volátil, Pixel, player único, milestones, storage versionado e a lógica
de `VSL_Offer` quando um timestamp legítimo for configurado.

## Regras de conteúdo

- Não prometer renda, clientes, vendas ou resultados garantidos.
- Não usar urgência artificial, contador, vagas limitadas ou preço riscado sem
  lastro.
- “7 dias” aparece apenas no contexto da garantia e da informação junto ao CTA.
- Os únicos materiais anunciados são Prompt Raiz 1 e Prompt Raiz 2.
- Não atribuir falas ou números aos alunos sem validação do vídeo.
- Antes de tráfego pago, revisar a copy contra as políticas aplicáveis do Meta.
