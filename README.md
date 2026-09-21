# M & M — site do selo

Site estático do selo **M & M** (Tribal House): catálogo com players reais em WAV,
sets dos fundadores via widget oficial do SoundCloud, preço e carrinho.

## Como publicar (três opções gratuitas)

### 1. Netlify Drop — mais rápido, sem conta

Abra <https://app.netlify.com/drop> e arraste a **pasta do site** (ou o zip dela)
para a área indicada. Em segundos sai um endereço no ar, do tipo
`https://algum-nome.netlify.app`. O endereço é temporário até você criar conta e
clicar em "Claim site" — aí ele fica seu e dá para trocar o nome.

### 2. Netlify ligado a este repositório — atualiza sozinho

Com conta na Netlify: **Add new site → Import an existing project → GitHub →
mmdjssite**. O arquivo `netlify.toml` já está aqui, então não precisa configurar
build: ele publica a raiz. Cada push na `main` gera um deploy novo.
O mesmo vale para a Vercel, que lê o `vercel.json`.

### 3. GitHub Pages

Também gratuito, e já está tudo pronto:

1. Abra **Settings → Pages** neste repositório.
2. Em **Source**, escolha **Deploy from a branch**.
3. Branch: `main`, pasta: `/ (root)`. Salve.
4. Em cerca de um minuto o endereço aparece na própria página de Settings,
   no formato `https://joseedson18jc.github.io/mmdjssite/`.

Para rodar local:

```sh
python3 -m http.server 8080
# abra http://localhost:8080
```

## Estrutura

```
index.html          página única, responsiva de 360px a 1440px
assets/styles.css   tokens de cor, tipografia e layout
assets/app.js       players, mini-player e carrinho
assets/tracks.json  metadados e picos de onda calculados dos arquivos
audio/              as 5 prévias em WAV
```

## O que já funciona

- **Cinco players reais.** Cada card toca o WAV correspondente. A forma de onda
  não é decorativa: foi calculada a partir das amostras de cada arquivo. Clicar
  nela avança para o ponto. Só uma faixa toca por vez.
- **Mini-player fixo**, que aparece quando algo começa a tocar e controla a faixa ativa.
- **Widgets oficiais do SoundCloud** para os dois sets dos fundadores, com
  atribuição preservada (`show_user=true`) e carregamento adiado.
- **Carrinho** com adicionar, remover, troca pelo pack e total.

## O que falta para virar loja de verdade

- **Checkout.** O botão hoje só avisa que não está conectado. Falta criar a
  Stripe Checkout Session no servidor, com Pix, cartão e boleto, e o webhook que
  só cumpre o pedido quando `payment_status === 'paid'`.
- **Entrega.** O WAV vendido não pode ficar público como está aqui. Precisa de
  storage privado e URL assinada de curta duração, com limite de downloads.
- **Prévias em MP3.** Os arquivos desta pasta somam cerca de 48 MB. Para produção,
  a prévia deve ser MP3 e o WAV só deve ser entregue após a compra.
- **Páginas legais.** Termos, privacidade (LGPD), licenciamento e reembolso.

A especificação completa desse backend está no repositório `new-project`, em
`soundcloud-style-tracks-landing-page-prompt.md`.

## Aviso sobre direitos

Três faixas do catálogo são versões de gravações comerciais de terceiros
(Beautiful People, Die With a Smile e Into You). Vender licença dessas versões
sem autorização do dono do fonograma e da editora é infração e expõe o selo a
notificação, retirada do ar e cobrança. Antes de cobrar por elas: obter
clearance, tratá-las como promo sem venda, ou substituí-las por material
autoral. As faixas Allan Natal e Love Tribal são originais do selo.

---

## Pagamentos com Stripe

O checkout já está ligado. O botão **Finalizar compra** chama `POST /api/checkout`,
que cria uma Stripe Checkout Session no servidor e redireciona o comprador.
Pix, cartão e boleto ficam disponíveis na própria tela da Stripe.

### Importante: o GitHub Pages não roda isso

O Pages serve só arquivos estáticos. Ele não guarda `STRIPE_SECRET_KEY` nem recebe
o POST do webhook, então **no Pages o botão vai responder 404**. As funções rodam
no Netlify (ou em qualquer host com serverless). O `netlify.toml` já está pronto —
conecte o repositório em netlify.com e o deploy sai sem configuração extra.

### Ligar em 4 passos

1. **Crie os preços na sua conta Stripe** (opcional, mas deixa o catálogo organizado):

   ```
   npm install
   STRIPE_SECRET_KEY=sk_test_... npm run stripe:seed
   ```

   O script imprime `STRIPE_PRICE_SINGLE` e `STRIPE_PRICE_PACK`. Rodar de novo é
   seguro: ele procura antes de criar. Sem essas variáveis o checkout monta o preço
   no servidor mesmo assim — R$ 80 a faixa, R$ 180 o pack.

2. **Crie o endpoint de webhook** no painel da Stripe
   (*Developers → Webhooks → Add endpoint*):

   - URL: `https://SEU-SITE.netlify.app/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   - Copie o *signing secret* (`whsec_...`).

3. **Cole as variáveis** em *Netlify → Site settings → Environment variables*.
   A lista completa está em `.env.example`. O mínimo é `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` e `SITE_URL`.

4. **Teste com cartão de teste** `4242 4242 4242 4242`, qualquer data futura e
   qualquer CVC. Para Pix, use as chaves de teste da Stripe.

### Como o dinheiro vira download

| Etapa | O que acontece |
|---|---|
| Carrinho | O navegador manda só `{kind, trackId}`. Nunca manda preço nem código de SKU. |
| `/api/checkout` | Lê o preço do catálogo do servidor (`netlify/functions/_catalog.mjs`) e cria a sessão. |
| Pagamento | Acontece no domínio da Stripe. Esta loja nunca vê o número do cartão. |
| `/api/stripe/webhook` | Confere a assinatura da Stripe no corpo cru. Só libera se `payment_status === 'paid'`. |
| Pix / boleto | Chegam primeiro como `unpaid` → o pedido fica `processing` e **nada é liberado**. A liberação só vem no `async_payment_succeeded`. |
| Reentrega | A Stripe reenvia eventos. O `event.id` é gravado antes do efeito, então processar duas vezes não duplica nada. |
| `sucesso.html` | Consulta `/api/order` e mostra os links assim que o pagamento confirma. Em Pix, fica checando sozinho. |
| Estorno | `charge.refunded` marca o pedido como `refunded`. |

### O que ainda não é uma loja completa

Seja honesto sobre o estado atual antes de divulgar:

- **Os WAVs estão públicos em `/audio/`.** Qualquer pessoa baixa sem pagar. O checkout
  cobra, mas não protege o arquivo. Para proteger de verdade: mover os WAVs para um
  bucket privado (Supabase Storage, S3, R2) e entregar por URL assinada de curta duração
  depois do webhook confirmar — é o desenho que está no prompt do repositório `new-project`.
  Enquanto isso não acontece, o que está no ar é uma vitrine com cobrança, não um cofre.
- **Os pedidos vivem no Netlify Blobs**, que é suficiente para começar mas não é um banco.
  Sem Blobs, o webhook valida e loga, mas não guarda histórico.
- **Licença em PDF** ainda não é gerada automaticamente.
- **Direitos:** três faixas do catálogo são versões de gravações comerciais. Vender
  licença delas sem autorização dos detentores é violação de direito autoral — e agora
  o site é público. Resolva a liberação antes de divulgar.
