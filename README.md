# M & M — site do selo

Site estático do selo **M & M** (Tribal House): catálogo com players reais em WAV,
sets dos fundadores via widget oficial do SoundCloud, preço e carrinho.

## Como publicar (GitHub Pages)

O site é estático e roda direto da raiz do repositório. Para ficar no ar:

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
