# Prompt para Claude Code — Landing page Método Express

Cole este documento inteiro como prompt no Claude Code (extensão do VS Code), num repositório vazio.

---

## Contexto

Construa uma landing page de vendas de página única para o curso "Método Express", parte da marca "Operação Home Office". É uma página de conversão: vídeo de vendas (VSL) no topo, copy estruturada em seções, botão de WhatsApp fixo, e botão de compra levando ao checkout do Hotmart. Vai ser hospedada no GitHub e implantada na Vercel.

**Prioridade número um: velocidade de carregamento.** A página vai receber tráfego de redes sociais e, futuramente, anúncios pagos — cada segundo de carregamento a mais derruba conversão.

## Stack técnico

HTML5 + CSS + JavaScript vanilla. **Sem framework** (nada de React/Next.js/Vue) e sem dependências externas além de fontes do Google Fonts. Justificativa: é uma página única, sem necessidade de roteamento ou build complexo — HTML estático puro carrega mais rápido que qualquer alternativa e implanta na Vercel com zero configuração.

## Estrutura de arquivos

```
/
├── index.html
├── styles.css
├── script.js
├── /assets
│   ├── /images
│   └── /icons
├── README.md
└── .gitignore
```

## Diretrizes de design

- Cor de acento: `#0F766E` (teal — cor já usada em todo o material da marca)
- Fundo claro, texto escuro, alto contraste
- **Mobile-first obrigatório** — o público majoritário do curso acessa só pelo celular, então desenhe primeiro pra tela pequena e depois expanda pro desktop
- Tipografia sans-serif limpa (sugestão: Inter ou similar via Google Fonts, com `font-display: swap`)
- Sem popups, sem autoplay de vídeo com som, sem contador regressivo falso

## Requisitos de performance

- Alvo: Lighthouse 90+ em mobile
- Imagens em WebP com `loading="lazy"` em tudo que estiver abaixo da primeira dobra
- CSS e JS minificados na versão final
- Nenhuma dependência pesada (sem jQuery, sem UI kit)
- Favicon incluso
- Meta tags Open Graph e Twitter Card completas (a página vai ser compartilhada em live e redes sociais — precisa gerar preview bonito no link)

## Seções da página, nesta ordem exata

### 1. Vídeo (VSL) + headline
Topo da página. Player de vídeo responsivo (usar tag `<video>` com atributo `poster`, ou iframe se for hospedado no YouTube/Vimeo — deixe as duas opções comentadas no código, com uma constante `VSL_VIDEO_URL` fácil de trocar no topo do arquivo, porque o vídeo ainda não foi gravado). Sem autoplay.

Abaixo do vídeo:
```
Sua primeira renda extra em 7 dias — só com o celular que você já tem
Sem anúncio pago, sem CNPJ, sem computador. Assista o vídeo acima e entenda como funciona.
```

### 2. Isso é pra você se...
```
Você quer ter mais controle do seu tempo, sem depender só de um emprego fixo
Você tem vontade de aprender algo novo, mas não sabe por onde começar
Você já pensou em trabalhar com internet, mas achou que precisava saber muito de tecnologia
Você não tem dinheiro pra investir em computador, anúncio ou ferramenta paga agora
```

### 3. O que você constrói em 7 dias
```
Um serviço definido que você já sabe, ou aprende rápido, a entregar
Um perfil profissional publicado, com exemplos prontos pra mostrar
Uma oferta escrita em uma frase, fácil de explicar pra qualquer pessoa
10 abordagens reais enviadas pra negócios de verdade
```

### 4. Como funciona o método
```
5 módulos, 20 aulas curtas — de 6 a 12 minutos cada, feitas pra assistir e executar no mesmo dia.
Cada aula termina numa ação. Não é curso pra só assistir — é pra fazer.
```

### 5. O que isso não é
```
Não é promessa de renda garantida
Não é fórmula mágica nem trabalho sem esforço
Não é curso de programação nem de design avançado
É estrutura, execução e acompanhamento — o resto depende de você
```

### 6. Bônus incluso
```
Cofre Financeiro do Operador
5 aulas curtas ensinando a administrar o dinheiro que já for entrando, pra você não desistir por causa de caixa vazio.
```

### 7. Investimento
```
R$97 à vista ou 3x de R$37
Garantia de execução: complete as missões da primeira semana e, se mesmo assim achar que não é pra você, devolvemos seu dinheiro.
```
Botão de compra principal nesta seção — ver "Botão de compra" abaixo.

### 8. Perguntas frequentes
Usar componente de acordeão (expande/recolhe ao clicar), em JS vanilla simples:
```
Preciso saber alguma coisa de tecnologia?
Não. As aulas te ensinam a usar as ferramentas do zero, passo a passo.

Preciso ter computador?
Não. Todo o Método Express funciona 100% pelo celular.

Em quanto tempo eu vejo resultado?
Em 7 dias você sai com perfil, oferta e propostas enviadas. Fechar cliente depende de execução e do mercado — por isso o método não promete prazo pra isso.

Funciona pra mim mesmo sendo menor de idade?
Sim, com algumas adaptações. O bônus Cofre Financeiro tem uma aula específica sobre como cobrar e receber pagamento sendo menor de idade.
```

### 9. Chamada final
```
Você não precisa estar pronto pra começar. Precisa só dar o primeiro passo.
[BOTÃO] Quero começar meu Método Express
```

## Botão de WhatsApp

Botão flutuante fixo (`position: fixed`), canto inferior direito, visível durante toda a rolagem, em mobile e desktop. Ícone de WhatsApp em SVG inline (não usar dependência externa nem ícone via imagem). Link:
```
https://wa.me/55SEUNUMERO?text=MENSAGEM_PREENCHIDA
```
Deixe `SEUNUMERO` e `MENSAGEM_PREENCHIDA` como constantes no topo do `script.js`, com a mensagem de exemplo: "Oi! Vi a página do Método Express e queria saber mais."

## Botão de compra (CTA principal)

Aparece na seção 7 (Investimento) e novamente na seção 9 (Chamada final). Link para o checkout do Hotmart — usar constante `HOTMART_CHECKOUT_URL` como placeholder fácil de substituir depois.

## Rastreamento (preparado, não ativado)

Deixe no `<head>` um bloco HTML comentado, documentado, pronto para colar o Meta Pixel e o TikTok Pixel quando estiverem disponíveis. Não ative nada agora — é só o espaço reservado. Adicione um comentário explicando onde cada um entra.

## SEO básico

- `<title>`, meta description, `lang="pt-BR"`
- Favicon
- Como é página única, a URL raiz (`/`) já resolve tudo — não precisa de rotas

## Regras de conteúdo — não altere ao gerar o código

- Não adicione nenhum print de saldo, PIX ou valor de faturamento em nenhum lugar da página
- Mantenha a garantia exatamente como está descrita acima (execução, não resultado)
- Não adicione contador regressivo, "vagas limitadas" ou qualquer urgência artificial que não esteja no texto fornecido

## Deploy

1. Inicialize um repositório git local e crie um `.gitignore` padrão
2. Crie um `README.md` com instruções de deploy manual: criar repositório no GitHub, `git remote add origin`, push, depois importar o repositório direto na Vercel — é site estático, não precisa de comando de build nem configuração
3. Não é necessário `vercel.json` a menos que precise de redirects específicos

## Placeholders que preciso substituir depois de gerado

- `VSL_VIDEO_URL` (o vídeo ainda não foi gravado)
- `HOTMART_CHECKOUT_URL`
- `SEUNUMERO` e `MENSAGEM_PREENCHIDA` (WhatsApp)
- Códigos do Meta Pixel e TikTok Pixel (ainda não criados)

Ao final, liste em um bloco separado todos os placeholders que ainda precisam ser preenchidos, pra eu não esquecer nenhum antes de publicar.
