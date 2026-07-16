# Método Express — Landing Page

Página de vendas de página única do curso **Método Express** (marca **Operação Home Office**).
HTML5 + CSS + JavaScript vanilla, sem framework e sem nenhuma dependência externa (fontes self-hosted).

## Estrutura

```
/
├── index.html   (CSS embutido no <head>)
├── script.js
├── /assets
│   ├── /images
│   ├── /icons      (favicon.svg)
│   └── /videos     (vídeo próprio, se optar por self-hosted)
├── README.md
└── .gitignore
```

## Rodar localmente

Como é HTML estático puro, basta abrir `index.html` no navegador. Se preferir um servidor local (recomendado para testar o carregamento de fontes/CORS):

```bash
npx serve .
```

## Placeholders a preencher antes de publicar

Todos ficam centralizados nas primeiras linhas de `script.js`, exceto os dois últimos (meta/tiktok pixel), que ficam comentados no `<head>` de `index.html`.

| Placeholder | Onde | O que fazer |
|---|---|---|
| `VSL_VIDEO_URL` | `script.js` | Cole a URL do vídeo (YouTube/Vimeo/arquivo próprio) quando a VSL estiver gravada. Enquanto vazio, mostra o quadro de destaque com botão de play sem vídeo real. |
| `HOTMART_CHECKOUT_URL` | `script.js` | Cole o link de checkout real do Hotmart. |
| `WHATSAPP_NUMERO` | `script.js` | Número no formato internacional, só dígitos (ex: `5511999999999`). |
| `WHATSAPP_MENSAGEM` | `script.js` | Mensagem pré-preenchida do WhatsApp (já vem com um texto padrão). |
| Meta Pixel | `index.html` (`<head>`, bloco comentado) | Cole o snippet oficial do Gerenciador de Eventos quando a conta de anúncio estiver pronta. |
| TikTok Pixel | `index.html` (`<head>`, bloco comentado) | Cole o snippet oficial do TikTok Ads Manager quando a conta estiver pronta. |
| `og:image` / `twitter:image` | `index.html` (`<head>`) | Aponta pra `assets/images/og-image.jpg` (1200×630px) — adicione essa imagem antes de compartilhar o link. |
| `og:url` / `canonical` | `index.html` (`<head>`) | Troque `https://exemplo.com.br/` pelo domínio real depois do deploy. |

## Vídeo (VSL)

O player só carrega o iframe do YouTube/Vimeo (ou o `<video>`, se for arquivo próprio) **depois do clique do usuário** — isso evita baixar o script pesado do player na primeira carga da página (melhora o Lighthouse) e garante que nunca haja autoplay. A lógica está em `initVsl()` dentro de `script.js`.

## Performance

- Fontes self-hosted (`assets/fonts`) com `preload` + `font-display: swap` — zero conexão externa.
- CSS embutido no `<head>` de `index.html` — elimina a requisição que bloqueava a renderização (Lighthouse). Para editar estilos, edite o bloco `<style>` do `index.html`.
- JS carregado com `defer`.
- Nenhuma dependência externa.
- Vídeo carregado sob demanda (ver seção acima).
- Se for adicionar imagens (fotos de exemplo de perfil, etc.), use **WebP** e `loading="lazy"` em tudo que estiver abaixo da primeira dobra.
- Antes de publicar, rode `script.js` por um minificador (ex: [minify-cli](https://www.npmjs.com/package/minify) ou a própria otimização automática da Vercel) para reduzir o peso final.

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
- Manter a garantia exatamente como está descrita (execução, não resultado).
- Não adicionar contador regressivo, "vagas limitadas" ou qualquer urgência artificial.
- Antes de rodar tráfego pago no Meta, revisar o texto contra a política de categoria especial de Emprego.
