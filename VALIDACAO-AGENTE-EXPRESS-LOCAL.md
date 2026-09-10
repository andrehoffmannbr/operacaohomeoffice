# Validação local — Método Express + Agente Express

Data: 10/09/2026. Base de comparação: `9f45645389961c6b1448033e21e6ddb026beb660`.
Implementação autorizada pelo arquivo `prompt-codex-implementar-nova-landing-agente-express.md`
e pela confirmação expressa do usuário. Nenhum deploy ou push foi realizado.

## Resultado implementado

Nova hierarquia centrada no Agente Express, no serviço concreto de transformação
de Instagram e no papel do aluno: escolher, revisar, enviar e negociar.
Hero, antes/depois, quatro resultados do agente, provas, processo em quatro
passos, pacote, perfil profissional, idiomas, oferta, criador, garantia, FAQ e
fechamento seguem a ordem solicitada. Alguns títulos foram encurtados para leitura.

Identidade verde escuro/turquesa, fundos claros alternados, fontes locais,
componentes responsivos, foco visível, dimensões de mídia e carregamento tardio
foram preservados ou ajustados. Uma sobreposição do número R$700 no mini-case
foi identificada visualmente e corrigida. Os arquivos de mídia originais não
foram modificados. As conversas demonstram interesse/avanço, sem serem rotuladas
como vendas. Naldo e Amanda mantêm apenas suas identificações.

Oferta disponível desde o carregamento; não havia gate ativo a remover.
Exatamente dois CTAs abrem o checkout existente. O hero contém apenas a âncora
interna para conhecer o agente. Foram retirados da copy o foco em prompts,
a urgência vencida, a extensão não confirmada de acesso vitalício ao agente e
a credencial acadêmica não validada.

## Arquivos da implementação

| Arquivo | Alteração |
|---|---|
| `index.html` | Copy, hierarquia, CSS e espaços de mídia pendente |
| `tests/landing-v2.test.js` | Regressões de estrutura, oferta e conteúdo autorizado |
| `tests/vsl-tracking.test.js` | Aceita a última declaração CSS sem ponto e vírgula |
| `tools/preview-local.mjs` | Prévia anterior/nova, isolamento Meta e diagnóstico local sanitizado |
| `.vercelignore` | Exclui a ferramenta local do artefato |
| `README.md` | Arquitetura, execução e tracking atuais |
| `VALIDACAO-AGENTE-EXPRESS-LOCAL.md` | Este relatório |

`script.js`, `api/pageview.js`, os testes específicos de Pixel/CAPI e todos os
ativos permaneceram inalterados. O bootstrap inline do PageView foi comparado
com a base e é idêntico. Os três documentos locais preexistentes do usuário
permaneceram fora desta implementação e do commit.

## Validação efetivamente executada

- Suíte completa: **98 testes passaram, zero falhas**.
- Sintaxe de `script.js`, `api/pageview.js`, ferramenta de prévia e script inline:
  aprovada. `git diff --check`: sem erros; não há formatter dedicado no projeto.
- `vercel build --prod --non-interactive`: concluído localmente, saída
  `.vercel/output`, código 0. O atualizador da CLI avisou de falta de permissão
  em seu cache externo; isso não impediu o build. Nenhuma publicação foi feita.
- Artefato inspecionado: contém a landing; não inclui ferramenta de revisão,
  Markdown, testes ou capturas.
- Navegador: 360×800, 390×844, 430×932, 768×1024 e 1440×1000. Sem overflow
  horizontal; conferência visual de hero, antes/depois, provas, oferta e FAQ.
  A barra vertical ocupa 15 px nas medições normais do desktop emulado.
- Corpo base de 16 px; CTAs com pelo menos 58 px de altura; FAQ e suporte com
  áreas de interação adequadas. Não foi executada auditoria completa por leitor
  de tela nem navegação integral por teclado.
- Âncora do hero clicada: seção do agente alcançada, com margem superior de
  24 px. FAQ de conta no ChatGPT aberto e fechado; resposta expandida sem corte.
- Console: sem erros ou avisos da página nas conferências realizadas.
- VSL YouTube real carregou após o clique e reproduziu: frames diferentes foram
  observados; `VSL_Start` e `VSL_25` chegaram ao coletor local. Não foi assistida
  integralmente nem validada sua aderência completa à nova oferta.
- Capturas completas anteriores e novas, desktop e mobile, salvas. A captura
  única mobile falhou no navegador; foram capturadas duas regiões consecutivas
  de 390×10000 e 390×9784, com todas as imagens carregadas. O SVG de revisão
  posiciona essas capturas sem alterar seu conteúdo, cobrindo a página inteira.

## Tracking e checkout: alcance da evidência

A prévia substitui apenas no HTML servido o SDK Meta por um coletor local;
`/api/pageview` retorna HTTP 202 simulado. CSP bloqueia requests Meta, nenhum
segredo é carregado e os cliques de checkout/suporte são bloqueados nessa prévia.
O arquivo da landing e o endpoint real não recebem essa instrumentação.

Observado no navegador: um `PageView` e uma chamada local a `/api/pageview` por
documento; nomes e IDs correspondentes; `credentials: same-origin` e
`keepalive: true`. Somente presença/ausência de cookie e igualdade dos IDs foram
registradas, sem valores completos. O perfil local já possuía `_fbp`.
`Scroll_50`, `Scroll_90` e `Offer_View` foram observados uma vez cada no percurso
mobile/desktop. Nenhum `Purchase` ou `InitiateCheckout` foi observado ou emitido.
Não houve visita de produção, abertura do checkout, Pix ou compra.

A suíte verifica também o navegador inicialmente sem `_fbp`, aparecimento do
cookie, deadline de 4 s, fallback `pagehide`, ausência de reenvio, aba oculta e
BFCache. Esses cenários adicionais são evidência de testes automatizados, não
visitas reais com cada condição.

Os dois CTAs conservam `https://pay.hotmart.com/G106758643C`. A propagação de
`src`, `sck` e cinco UTMs foi observada em ambos os links e testada na suíte.
`fbclid` volátil, persistência de 30 dias e atualização atômica por campanha
foram verificados nos testes. Não foi inventado `fbclid` no navegador.
**`s1/s2/s3` já estavam excluídos da whitelist pela migração para Hotmart**;
continuam assim, preservando o comportamento existente.

`Scroll_50/90` continuam medindo a porcentagem do percurso rolável atual. A
página ficou mais longa; o conteúdo associado a cada percentual mudou, e
comparações históricas devem considerar a nova estrutura. Não foi necessário
alterar o cálculo. `Offer_View` mantém um único marcador no bloco compacto do
preço, 50% visível por um segundo, independente da VSL. `VSL_Offer` continua
inativo (`null`), aguardando timestamp confirmado.

**Aceitação real pela Meta não foi revalidada nesta etapa. Deduplicação na Meta
continua pendente de evidência no Gerenciador de Eventos.** Os mocks e os IDs
correspondentes não comprovam esses resultados externos.

## Desempenho comparativo local

Mesma máquina, servidor de revisão e instrumentação; sem limitação de rede/CPU,
sem YouTube iniciado e sem SDK real Meta. São amostras locais, não Lighthouse,
CrUX ou métricas de produção. LCP foi coletado por PerformanceObserver, antes
da interação; bytes são a soma de transferSize dos recursos, sem o documento.

| Medição | Anterior | Nova |
|---|---:|---:|
| LCP local mobile 390 | 136 ms | 140 ms |
| CLS inicial mobile | 0 | 0 |
| Recursos iniciais mobile | 199.530 bytes | 240.340 bytes |
| LCP local desktop 1440 | 124 ms | 140 ms |
| CLS inicial desktop | 0 | 0 |
| Recursos iniciais desktop | 307.324 bytes | 291.068 bytes |
| HTML em UTF-8, normalizado LF | 59.235 bytes | 51.457 bytes |
| HTML gzip local | 13.616 bytes | 13.484 bytes |

Não se observou regressão material de LCP/CLS nessas amostras. Houve aumento de
40.810 bytes nos recursos iniciais mobile, e redução de 16.256 no desktop. A
seleção/carregamento das imagens responsivas depende da nova geometria; o
registro agregado não isola a contribuição individual de cada recurso. A
legibilidade do antes/depois foi priorizada, com os ativos existentes. Não se
atribui à página nova uma pontuação Lighthouse antiga.

As conversas PNG continuam somando cerca de 3,06 MB abaixo da dobra; vídeos
permanecem com preload none. Não foi introduzida nova biblioteca de frontend.

## Pendências antes de publicar

Estas condições bloqueiam a publicação, mas não a revisão local entregue:

| Pendência | Próxima ação/ativo necessário |
|---|---|
| Acesso externo ao agente | Validar o link publicado com uma conta de aluno sem privilégios do criador |
| Geração de imagens e limites | Testar as condições mínimas da conta/plano anunciado e informar eventuais limites reais |
| Pacote completo | Produzir dez arquivos individuais em `assets/images/pacote-express/arte-01.webp` a `arte-10.webp`, `logo.webp`, `bio.webp` e `capas.webp`; nomes sugeridos para futura integração |
| Gravação mobile do agente | Inserir `assets/videos/agente-express-demonstracao-mobile.mp4` e poster correspondente, mostrando uso real |
| Perfil profissional de demonstração | Inserir `assets/images/perfil-profissional-express-demo.webp`, identificado como demonstração |
| Idiomas | Validar o fluxo real e fornecer registro sanitizado, por exemplo `assets/images/agente-express-idiomas-demo.webp`; hoje existe apenas exemplo textual didático rotulado |
| VSL nova | Revisar/substituir o vídeo e a capa para a oferta atual; o vídeo preservado apresenta o mecanismo original, não comprova o agente novo |
| Acesso ao agente | Confirmar duração, entrega, conta necessária e políticas aplicáveis, sem estender acesso vitalício automaticamente |
| Hotmart | Confirmar R$97, parcelamento, suporte, comunidade e garantia na oferta/checkout; referência de 12× R$10,03 não foi validada nem acrescentada |

Os espaços pendentes não simulam uma interface funcional nem atribuem ao agente
resultados anteriores à sua criação. A informação de uso do ChatGPT com conta
própria e limites do plano está perto do CTA e no FAQ.

## Revisão visual

- Prévia: http://127.0.0.1:4173/
- Versão anterior: http://127.0.0.1:4173/before/
- [Comparação visual](screenshots/agente-express-local/comparacao.html)
- [Desktop completo](screenshots/agente-express-local/depois-desktop-1440.jpg)
- [Mobile completo](screenshots/agente-express-local/depois-mobile-390-completa.svg)
- [Mobile parte 1](screenshots/agente-express-local/depois-mobile-390-parte-1.jpg) /
  [parte 2](screenshots/agente-express-local/depois-mobile-390-parte-2.jpg)
- [VSL em reprodução](screenshots/agente-express-local/vsl-reproducao.jpg)

Capturas e diagnósticos locais estão ignorados pelo Git. Para reabrir a prévia,
execute `node tools/preview-local.mjs`. Não houve alteração de variáveis de
ambiente, credenciais, configuração de produção, checkout ou integração Hotmart.