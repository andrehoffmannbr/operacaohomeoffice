# PageView — implementação e validação

## Diagnóstico

- HEAD inspecionado: `5eae1a248c1d6b324257a4cac65df5989d5f0d56`. Baseline: 71/71 testes. Nenhum AGENTS.md encontrado na raiz ou ancestrais aplicáveis; `.agents` vazio. Os dois documentos não versionados do usuário foram preservados.
- Confirmado no código atual: inicialização única do Pixel `3401433073361667`, um `fbq('track', 'PageView')` sem ID e fallback noscript. Não havia rota de servidor, chamada CAPI, GTM ou controle de consentimento/elegibilidade implementado. Os controles existentes permanecem como estavam.
- `script.js` contém atribuição, VSL e Contact; não emite PageView, InitiateCheckout ou Purchase. Não foi alterado. Os eventos de checkout/Purchase da integração externa Hotmart permanecem fora desta intervenção.
- Histórico: `0454633` (29/08) removeu dependência de interação/espera de 4s para carregar o SDK; `f1d514c` fixou espera de 1500ms. As mudanças próximas de 30–31/08 foram de landing/oferta. Não há evidência de CAPI da landing que tenha quebrado nesses commits.
- Confirmado por cabeçalhos HTTP e painel autenticado: Vercel, projeto `operacaohomeoffice`, preset Other, raiz do repositório, sem comandos customizados, Node 24, produção ligada a `main` e ao HEAD acima. Nenhuma variável própria nem compartilhada vinculada ao projeto; variáveis de sistema habilitadas. Não há token CAPI local disponível nem autenticação CLI utilizável.
- A origem dos 13 PageViews de servidor continua desconhecida. Checkout é hipótese; não foi possível atribuir a variação à origem do tráfego ou a um deploy. 470/13 são volumes recebidos por canal, não visitantes únicos nem fórmula da cobertura Meta. O déficit 457 e o dia com 121/0 são compatíveis com a ausência do emissor na landing, mas não identificam todos os emissores externos.

## Alteração mínima

`index.html` adapta o disparo existente: ID novo por documento, mesmo nome/ID nos dois canais, horário original em segundos, sem storage e sem retentativas. POST imediato com keepalive, independente do SDK atrasado. Interações e reexecução do bloco não criam outro PageView. O fallback noscript permanece somente no navegador (sem JavaScript não executa CAPI).

`api/pageview.js` é a única função nova. Destino fixo, Graph v25.0, apenas PageView, JSON até 2 KiB, origem exata, Fetch Metadata, tempo recente e campos estritos. URL de origem canônica sem query/fragmento; UTMs e fbclid do checkout não mudam. Aproveita `_fbp`/`_fbc` válidos já presentes nos cookies da requisição, sem fabricar valores ou persistir fbclid. Uma primeira visita pode não ter esses cookies ainda.

Na Vercel, IP vem exclusivamente de `x-vercel-forwarded-for`; fora dela usa o socket. User-agent vem da requisição. Sem hash nesses campos. Limite de 60 pedidos/minuto/IP por instância, chaves HMAC temporárias e mapa limitado. Esse controle não é um limite distribuído: o Firewall/DDoS nativo da Vercel complementa a proteção; a allowlist de origem não autentica clientes não navegador.

Timeout Meta de 4s e navegador de 5s. HTTP 202 com `accepted: true` somente após `events_received: 1` e resposta sem erro; falha retorna 502/504 e falta de configuração, 503. Logs contêm categoria fixa e status HTTP, sem corpo, token, cookies ou IP. A ausência do token preserva o Pixel e a landing.

`vercel.json` define duração máxima de 10s. `.vercelignore` exclui testes, documentos, screenshots e arquivos de ambiente do deploy; `.gitignore` protege `.env.*`. README e testes foram atualizados.

## Validação disponível

- 80/80 testes Node aprovados (71 anteriores adaptados + 9 novos), incluindo uma requisição HTTP real ao handler com resposta Meta simulada. Cobrem ID, reload, interações, falha/timeout, payload, Purchase rejeitado, origem/IP, cookies, segredos, preview e abuso.
- `node --check script.js` e `node --check api/pageview.js` aprovados; bootstrap inline executado pelos testes.
- `vercel build --non-interactive`, CLI 59.11.7: aprovado usando cópia local das configurações lidas no painel, sem credenciais. Artefato `.vercel/output/functions/api/pageview.func/.vc-config.json`: `runtime: nodejs24.x`, `handler: api/pageview.js`, `maxDuration: 10`. `/api/pageview` está no filesystem de funções, antes do fallback 404 de API. A função não é publicada como JavaScript estático.
- Diff revisado; fora do bloco de PageView, HTML é idêntico ao HEAD. `script.js` e assets não mudaram. Testes confirmam os dois CTAs, links Hotmart, UTMs/fbclid, VSL/player e Contact preservados. Nenhum Purchase artificial.
- **Status: local.** Build tem alvo preview, mas não houve deploy de preview ou produção. Aceitação pela API real, recebimento dos dois canais e deduplicação no painel Meta ainda não foram validados. Nenhuma compra de teste foi enviada.

Exemplo sanitizado (ilustrativo, não é evento recebido):

```js
fbq('track', 'PageView', {}, { eventID: '12345678-1234-4234-8234-123456789abc' });
// Mesmo Pixel, no payload do servidor:
{ event_name: 'PageView', event_id: '12345678-1234-4234-8234-123456789abc' }
```

## Configuração e próximo passo

No projeto Vercel `operacaohomeoffice` → Settings → Environment Variables:

1. Configurar **META_CAPI_ACCESS_TOKEN** como Secret no servidor, para Preview e Production, com acesso ao Pixel indicado. Não usar prefixo público, não colar na conversa e não versionar arquivo preenchido.
2. Para visita controlada, configurar **META_CAPI_TEST_EVENT_CODE** somente em Preview com o código de Eventos de teste do dataset. Nunca em Production: o endpoint recusa configuração de teste fora de Preview. `VERCEL`, `VERCEL_ENV` e `VERCEL_URL` são variáveis automáticas do provedor, não segredos a preencher.
3. Publicar a alteração revisada pelo fluxo Git/Vercel existente. Um push em `main` publica produção automaticamente; não foi realizado nesta tarefa. Preferir primeiro um preview da alteração e visitar sua URL exata de deployment (`VERCEL_URL`).
4. Em Eventos de teste, abrir uma visita controlada; conferir dataset, PageView, origem navegador/servidor, `eventID`/`event_id` idênticos, URL e horário. Na rede, `/api/pageview` deve responder 202 com `accepted: true`; isso confirma apenas aceitação pela API. Confirmar separadamente no painel as duas origens e a deduplicação como um único evento lógico. Recarregar gera outro ID; scroll, foco e play não geram PageView adicional.
5. Remover o código de teste do Preview e redeployar após o teste. Em produção, observar os próximos eventos e os diagnósticos; a média de cobertura de sete dias não muda necessariamente de imediato.

## Referências oficiais consultadas

- [Deduplicação por nome e ID](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events)
- [Parâmetros do cliente](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
- [Graph API v25.0, lançamento de 18/02/2026](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/)
- [Vercel Node Functions em /api](https://vercel.com/docs/functions/runtimes/node-js)
- [Cabeçalhos IP confiáveis na Vercel](https://vercel.com/docs/headers/request-headers)
