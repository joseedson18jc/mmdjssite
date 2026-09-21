// Catálogo autoritativo do servidor.
// O cliente NUNCA manda preço nem código de SKU — manda só `kind` e `trackId`.
// Preço e SKU saem daqui ou das Prices criadas na Stripe por scripts/stripe-seed.mjs.

export const CURRENCY = 'brl';

export const PRECO_FAIXA_CENTAVOS = 8000;   // R$ 80,00
export const PRECO_PACK_CENTAVOS = 18000;   // R$ 180,00

export const TRACKS = {
  'allan-natal': { titulo: 'Allan Natal', artista: 'M & M', arquivo: 'audio/allan-natal.wav' },
  'beautiful-people': { titulo: 'Beautiful People (Tribal Mix)', artista: 'Maycon Reis & M & M', arquivo: 'audio/beautiful-people.wav' },
  'die-with-a-smile': { titulo: 'Die With a Smile (Tribal Version)', artista: 'Maycon Reis & M & M', arquivo: 'audio/die-with-a-smile.wav' },
  'into-you': { titulo: 'Into You (Tribal Mix)', artista: 'M & M', arquivo: 'audio/into-you.wav' },
  'love-tribal': { titulo: 'Love Tribal', artista: 'Urlan & M & M', arquivo: 'audio/love-tribal.wav' }
};

export const PACK = {
  id: 'pack',
  titulo: 'Pack Tribal M & M',
  descricao: 'Todas as faixas do pack em WAV + MP3 320 kbps, com licença em PDF.'
};

// Price IDs vindos do ambiente (criados por scripts/stripe-seed.mjs).
// Se não existirem, o checkout cai em price_data — também montado no servidor.
export function priceIdFaixa() { return process.env.STRIPE_PRICE_SINGLE || null; }
export function priceIdPack() { return process.env.STRIPE_PRICE_PACK || null; }

/**
 * Converte o carrinho do cliente em line_items da Stripe.
 * Retorna { lineItems, metadata } ou lança Error com .status.
 */
export function montaLineItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const e = new Error('Carrinho vazio.'); e.status = 400; throw e;
  }
  if (items.length > 20) {
    const e = new Error('Carrinho grande demais.'); e.status = 400; throw e;
  }

  const temPack = items.some((i) => i && i.kind === 'pack');
  if (temPack) {
    const price = priceIdPack();
    return {
      lineItems: [price
        ? { price, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: CURRENCY,
              unit_amount: PRECO_PACK_CENTAVOS,
              product_data: { name: PACK.titulo, description: PACK.descricao }
            }
          }],
      metadata: { sku: 'pack', tracks: 'pack' }
    };
  }

  const ids = [];
  for (const item of items) {
    if (!item || item.kind !== 'track') {
      const e = new Error('Item inválido no carrinho.'); e.status = 400; throw e;
    }
    const track = TRACKS[item.trackId];
    if (!track) {
      const e = new Error('Faixa desconhecida: ' + String(item.trackId)); e.status = 400; throw e;
    }
    if (ids.includes(item.trackId)) continue; // faixa avulsa não repete
    ids.push(item.trackId);
  }

  const price = priceIdFaixa();
  const lineItems = ids.map((id) => (price
    ? { price, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: PRECO_FAIXA_CENTAVOS,
          product_data: {
            name: TRACKS[id].titulo,
            description: TRACKS[id].artista + ' · WAV + MP3 320 kbps'
          }
        }
      }));

  // Com Price fixa não dá pra nomear a faixa no line_item, então o vínculo
  // vive no metadata da sessão — é ele que o webhook lê para liberar.
  return { lineItems, metadata: { sku: 'single', tracks: ids.join(',') } };
}

export function arquivosDoPedido(metadata) {
  if (!metadata) return [];
  if (metadata.tracks === 'pack') {
    return Object.entries(TRACKS).map(([id, t]) => ({ id, titulo: t.titulo, arquivo: t.arquivo }));
  }
  return String(metadata.tracks || '')
    .split(',')
    .filter((id) => TRACKS[id])
    .map((id) => ({ id, titulo: TRACKS[id].titulo, arquivo: TRACKS[id].arquivo }));
}
