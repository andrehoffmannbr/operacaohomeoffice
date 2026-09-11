# Método Express + Agente Express

Landing estática da Operação Home Office, com HTML, CSS embutido e JavaScript
vanilla. A nova proposta coloca o Agente Express no centro: ele prepara pesquisa,
transformação, mensagens e materiais; o Método Express orienta a execução do
serviço pelo celular. O aluno escolhe, revisa, envia e negocia.

## Arquitetura da landing

1. Hero com VSL e âncora interna para conhecer o agente.
2. Antes/depois real e mecanismo de mostrar primeiro.
3. Quatro resultados do agente e espaço para gravação real.
4. Conversas existentes, case de R$700 e depoimentos de Naldo e Amanda.
5. Processo: escolher, mostrar, conversar e entregar.
6. Pacote oferecido ao negócio.
7. Perfil profissional sem aparecer.
8. Apoio à conversa em outros idiomas.
9. Oferta e primeiro CTA de compra.
10. História do criador.
11. Garantia e dez perguntas frequentes.
12. Fechamento, segundo CTA de compra e suporte.

Oferta e preço estão disponíveis desde o carregamento, sem gate da VSL. O hero
usa uma âncora interna, mantendo exatamente dois links de checkout. A oferta
preserva R$97 e a indicação de parcelamento no checkout. Condições comerciais e
novas demonstrações precisam ser confirmadas antes de qualquer publicação.

## Prévia local para revisão

Requer Node.js e Git. Na raiz:

```sh
node tools/preview-local.mjs
```

- Nova página: http://127.0.0.1:4173/
- Página anterior: http://127.0.0.1:4173/before/

O servidor escuta somente na interface local. Simula o SDK do Pixel e a resposta
de `/api/pageview`, bloqueia requests Meta e impede os cliques externos de
checkout/suporte. Não carrega segredos nem executa a função CAPI de produção.
YouTube permanece habilitado para a verificação do player. O HTTP 202 desta
prévia é uma simulação, não comprova aceitação pela Meta.

A comparação anterior usa o HTML do commit
`8046fb8f739f414ca0b332bb555aa2458c1c42c6`, com scripts e ativos preservados. A
instrumentação existe apenas na resposta do servidor de revisão. `tools/`,
`screenshots/`, testes e Markdown são excluídos do artefato Vercel.

## Tracking e integrações

| Item | Comportamento preservado |
|---|---|
| Checkout | `https://pay.hotmart.com/G106758643C` |
| IDs dos CTAs | `ctaInvestimento` e `ctaFinal` |
| Meta Pixel | `3401433073361667` |
| PageView | Um por documento; `eventID` do Pixel igual a `event_id` CAPI |
| SDK do Pixel | Carregamento adiado 1.500 ms |
| Espera por `_fbp` | Polling de 100 ms; limite de 4 s; fallback `pagehide` |
| Fetch CAPI | `credentials: same-origin`, `keepalive: true`, proteção contra reenvio |
| Scroll | `Scroll_50` e `Scroll_90`, uma vez por documento |
| Offer_View | 50% do bloco compacto do preço visível por 1 s contínuo, aba visível |
| Contact | Somente clique real no suporte |
| Compra | A landing não emite `InitiateCheckout` ou `Purchase` |

Scroll continua medindo a fração do percurso rolável atual. Seus nomes foram
mantidos para continuidade histórica; os percentuais agora se referem ao novo
comprimento da página. `Offer_View` mantém um único `[data-offer-price]` no preço,
independente da VSL, com proteção de visibilidade e BFCache.

Atribuição mantém `src`, `sck` e as cinco UTMs (`utm_source`, `utm_medium`,
`utm_campaign`, `utm_term`, `utm_content`), com persistência de 30 dias,
versão 2 e atualização atômica por campanha. `fbclid` é volátil, acompanha apenas
a visita atual. `s1/s2/s3` já haviam sido removidos na migração para Hotmart e
continuam fora da whitelist. Não adicionar dados pessoais à URL ou ao storage.

Igualdade dos IDs e testes locais não comprovam deduplicação na interface da
Meta. O endpoint e `script.js` não foram alterados nesta implementação.

## VSL e mídia

O vídeo `fIDX2aD1TdQ` e a capa local `assets/images/vsl-poster.webp` foram
preservados. Contêiner 9:16, imagem com prioridade alta e player/API YouTube
carregados somente após clique ou Enter. Controles nativos disponíveis. A copy
identifica o vídeo como apresentação do mecanismo original; a compatibilidade
com a nova oferta ainda precisa de revisão e VSL atualizada.

`VSL_Start`, `VSL_25`, `VSL_50`, `VSL_75` e `VSL_90` mantêm a deduplicação de
sessão. `VSL_OFFER_SECONDS` continua `null`: `VSL_Offer` permanece desativado até
existir um timestamp confirmado. Isso não bloqueia a oferta.

Imagens abaixo da dobra têm carregamento tardio e dimensões declaradas. Naldo e
Amanda mantêm `preload="none"`, controles e posters carregados perto da tela.
Nenhum ativo real foi alterado ou apresentado como resultado do agente novo.

## Validação

```sh
node --check script.js
node --check api/pageview.js
node --check tools/preview-local.mjs
node --test tests/landing-v2.test.js tests/vsl-tracking.test.js tests/meta-pixel.test.js tests/pageview-api.test.js
```

A suíte atual tem 99 testes. Cobre estrutura/copy, responsividade, CTAs, atribuição, cookies,
PageView, prazo/fallback, player, scroll, preço visível, aba e BFCache.
Build usa a configuração existente da Vercel (`vercel build --prod`), localmente;
essa operação não publica. O projeto não possui formatter dedicado; usar
`git diff --check` e as verificações de sintaxe.

Resultados e pendências: [VALIDACAO-AGENTE-EXPRESS-LOCAL.md](VALIDACAO-AGENTE-EXPRESS-LOCAL.md).
Capturas do polimento ficam em `screenshots/agente-express-polimento-final/`,
ignoradas pelo Git.
