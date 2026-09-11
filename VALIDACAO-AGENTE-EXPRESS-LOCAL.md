# Validação local — polimento final do Agente Express

Data: 11/09/2026. Base: `8046fb8f739f414ca0b332bb555aa2458c1c42c6`.
Escopo executado conforme `prompt-codex-polimento-final-landing-agente-express.md`.
Nenhum push, deploy, acesso à produção, checkout real ou Gerenciador de Eventos
da Meta foi realizado.

## Resultado do polimento

A arquitetura aprovada foi preservada. O trabalho ficou restrito à leitura no
celular, demonstração textual do fluxo do Agente Express, legibilidade dos ativos
reais, organização da oferta e verificações locais.

- Hero explicitamente em uma coluna até 899 px, com texto antes da VSL, título
  mais equilibrado no celular, corpo de pelo menos 16 px e CTA interno de 58 px
  ou mais de altura.
- Antes/depois empilhado até 767 px, imagens na largura útil e links locais
  acessíveis para ampliar os dois arquivos reais.
- Fluxo do agente em uma coluna no celular, duas em tablet e quatro apenas a
  partir de 1200 px. Cada etapa mostra entrada e resultado sem simular uma tela
  ou gravação inexistente.
- Provas organizadas como transformação, conversa, interesse/proposta e case
  real de R$700. Conversas podem ser ampliadas; o número R$700 usa escala
  responsiva. Interesse não foi renomeado como venda nem atribuído ao agente novo.
- Componentes do pacote aparecem antes do aviso de mídia pendente. Nenhuma
  colagem ou arquivo de entrega foi fabricado.
- Oferta mobile em uma coluna, com lista completa antes da comparação e bloco
  próprio para R$97, CTA, garantia e condições de acesso. A comparação de R$700
  aparece uma vez.
- Chamada da VSL descreve o conteúdo preservado como mecanismo de mostrar uma
  transformação antes de oferecer o serviço; não diz que o vídeo demonstra o
  Agente Express.
- Verbos vagos foram substituídos por ações específicas onde havia suporte na
  oferta: pesquisa, organiza, analisa, cria, prepara e gera. A página continua
  dizendo que o aluno escolhe, revisa, envia e combina as condições.

## Arquivos alterados nesta rodada

| Arquivo | Alteração |
|---|---|
| `index.html` | CSS responsivo, hierarquia visual, fluxo entrada/resultado, ampliação de imagens e ajustes pontuais de copy |
| `tests/landing-v2.test.js` | Regressões do polimento e limite mínimo de 16 px nas regras principais |
| `tools/preview-local.mjs` | Base `8046fb8`, diagnóstico responsivo sanitizado e suporte local para capturas segmentadas |
| `README.md` | Base, total de testes e caminhos atuais |
| `VALIDACAO-AGENTE-EXPRESS-LOCAL.md` | Este relatório |

`script.js`, `api/pageview.js`, testes técnicos de Pixel/CAPI/VSL e todos os
ativos permaneceram idênticos à base `8046fb8`. Os três documentos locais
preexistentes do usuário ficaram fora do escopo e do commit.

## Testes, build e inspeção renderizada

- Suíte completa: **99/99 testes passaram**.
- `node --check` passou para `script.js`, `api/pageview.js` e
  `tools/preview-local.mjs`.
- `git diff --check`: aprovado.
- `vercel build --prod --non-interactive`: código 0 e artefato criado em
  `.vercel/output`. O verificador de atualização da CLI não conseguiu gravar no
  cache externo por `EPERM`; o build terminou com `status: ok`.
- Console do navegador: nenhum erro ou aviso da página na inspeção final.
- Larguras verificadas: 360×800, 390×844, 430×932, 768×1024, 1024×768 e
  1440×1000. Alturas adicionais: 360×640 e 1024×600. A transição 639/640 px
  também foi medida.
- Nenhum overflow horizontal, elemento excedendo a largura ou texto principal
  computado abaixo de 16 px foi encontrado nas seis larguras.
- Em 360/390/430 px, hero, antes/depois, fluxo, provas e oferta ficaram em uma
  coluna. Em 768 px, fluxo e provas ficaram em duas; em 1440 px, o fluxo ficou
  em quatro. O hero passou a duas colunas somente a partir de 900 px.
- O antes/depois mediu 305 px de largura por imagem em 360, 335 px em 390 e
  375 px em 430. O CTA do hero mediu 79 px em 360/390 e 58 px nas demais
  larguras testadas.
- A oferta estava visível e mensurável sem iniciar a VSL.
- FAQ “Preciso de conta no ChatGPT?” abriu, manteve a associação ARIA, exibiu
  foco de 3 px e fechou com Enter.
- A VSL real do YouTube foi iniciada no preview: o iframe correto apareceu e
  `VSL_Start` foi registrado uma vez. Não houve revisão integral do conteúdo.

## Checkout, atribuição e tracking

A prévia substitui o SDK Meta por coletor local, responde `/api/pageview` com
HTTP 202 simulado, bloqueia Meta e impede cliques externos de checkout e suporte.
Essa evidência não representa aceitação externa pela Meta.

No navegador foram observados exatamente dois links para
`https://pay.hotmart.com/G106758643C`, com IDs `ctaInvestimento` e `ctaFinal`.
Ambos conservaram `src`, `sck`, `utm_source`, `utm_medium`, `utm_campaign`,
`utm_term`, `utm_content` e o `fbclid` da visita de teste local. O hero continuou
como âncora `#agente-express`, chegando à seção com margem superior de 24 px.

`s1/s2/s3` já estavam ausentes da whitelist no commit-base após a migração para
Hotmart. Eles não foram reintroduzidos, preservando o comportamento atual.

A simulação local registrou um PageView do Pixel e um POST CAPI por documento,
HTTP 202, IDs correspondentes, `credentials: same-origin` e nenhum recurso da
Meta. Nenhum `Purchase` ou `InitiateCheckout` foi emitido. A suíte preserva os
cenários de `_fbp`, prazo, `pagehide`, BFCache, scroll, `Offer_View`, VSL e trava
de duplicação.

`script.js` e o endpoint CAPI não foram alterados. Igualdade de IDs e simulação
local não comprovam deduplicação nem aceitação pela Meta; essas verificações
externas não faziam parte da autorização desta rodada.

## Desempenho comparativo local

Medição no mesmo preview, em 390×844, sem iniciar YouTube e com Meta isolada:

| Métrica | `8046fb8` | Polimento |
|---|---:|---:|
| LCP observado | 164 ms | 132 ms |
| CLS | 0 | 0 |
| Recursos | 9 | 9 |
| Bytes de recursos | 241.943 | 241.943 |
| Falhas de imagem/console | 0 | 0 |

É uma comparação local de regressão, não uma medição de produção. O polimento
não adicionou biblioteca, mídia ou bytes de recurso ao carregamento inicial.

## Capturas finais em resolução original

- [Mobile completo — viewport 390](screenshots/agente-express-polimento-final/final-mobile-390-completo.png)
- [Hero mobile](screenshots/agente-express-polimento-final/final-mobile-390-hero.png)
- [Antes/depois mobile](screenshots/agente-express-polimento-final/final-mobile-390-antes-depois.png)
- [Oferta mobile](screenshots/agente-express-polimento-final/final-mobile-390-oferta.png)
- [Desktop completo — viewport 1440](screenshots/agente-express-polimento-final/final-desktop-1440-completo.png)
- [Hero desktop](screenshots/agente-express-polimento-final/final-desktop-1440-hero.png)
- [Oferta desktop](screenshots/agente-express-polimento-final/final-desktop-1440-oferta.png)

O Chrome reservou 15 px para a barra vertical: as imagens resultantes têm
375 px de conteúdo no viewport validado em 390 e 1425 px no viewport de 1440.
As capturas completas foram compostas com segmentos consecutivos na escala
original, sem redimensionar o conteúdo.

Comparado ao `8046fb8`, o hero mobile deixou de quebrar “encontra” como linha
isolada, a VSL permaneceu abaixo da copy, antes/depois e provas ganharam leitura
e ampliação, o fluxo passou a mostrar entradas e resultados e o preço ganhou um
grupo de compra inequívoco. Em desktop, a largura do texto e da VSL foi
preservada, enquanto quatro cartões do agente só aparecem quando há espaço.

## Ativos reais ainda necessários antes de publicar

1. Gravação mobile verdadeira do Agente Express em uso e respectivo poster.
2. Dez imagens individuais do mesmo pacote, mais logo, bio e capas de destaque
   reais do mesmo negócio.
3. Perfil profissional de demonstração criado com o processo atual, identificado
   como demonstração.
4. Registro sanitizado de uma conversa real em outro idioma feita com o agente.
5. Nova VSL ou revisão completa do vídeo atual para refletir a oferta do Agente
   Express; o vídeo preservado é apresentado como explicação do mecanismo
   original, e sua aderência completa permanece pendente.

Até esses arquivos existirem, os espaços pendentes permanecem identificados e
nenhuma interface, entrega ou gravação é simulada como real.

Também permanecem as validações não visuais registradas na base: testar o acesso
externo ao agente com uma conta de aluno, confirmar conta/plano mínimo e limites
de mensagens e imagens, definir duração e condições de acesso ao agente e
conferir na Hotmart preço, parcelamento, suporte, comunidade e garantia. Nada
disso foi tratado como resolvido nesta rodada local.

Prévia local: `http://127.0.0.1:4173/`. Base para comparação:
`http://127.0.0.1:4173/before/`. Nenhuma variável de ambiente ou credencial foi
carregada ou alterada.
