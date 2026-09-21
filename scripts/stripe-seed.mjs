#!/usr/bin/env node
// Cria (uma vez) os dois Produtos e Preços na conta Stripe e imprime os IDs
// para colar em STRIPE_PRICE_SINGLE e STRIPE_PRICE_PACK.
//
//   STRIPE_SECRET_KEY=sk_test_... npm run stripe:seed
//
// Reexecutar é seguro: procura pelo metadata.sku antes de criar.

import Stripe from 'stripe';
import { PRECO_FAIXA_CENTAVOS, PRECO_PACK_CENTAVOS, PACK, CURRENCY } from '../netlify/functions/_catalog.mjs';

const chave = process.env.STRIPE_SECRET_KEY;
if (!chave) {
  console.error('Falta STRIPE_SECRET_KEY no ambiente.');
  process.exit(1);
}
const stripe = new Stripe(chave, { apiVersion: '2024-06-20' });

async function garante(sku, nome, descricao, centavos) {
  const achados = await stripe.products.search({ query: `metadata['sku']:'${sku}'`, limit: 1 });
  let produto = achados.data[0];
  if (!produto) {
    produto = await stripe.products.create({ name: nome, description: descricao, metadata: { sku } });
    console.log('produto criado:', produto.id);
  } else {
    console.log('produto ja existia:', produto.id);
  }

  const precos = await stripe.prices.list({ product: produto.id, active: true, limit: 100 });
  const existente = precos.data.find((p) => p.unit_amount === centavos && p.currency === CURRENCY);
  if (existente) {
    console.log('preco ja existia:', existente.id);
    return existente.id;
  }
  const preco = await stripe.prices.create({
    product: produto.id,
    currency: CURRENCY,
    unit_amount: centavos,
    metadata: { sku }
  });
  console.log('preco criado:', preco.id);
  return preco.id;
}

const single = await garante(
  'single',
  'Track avulsa — Selo M & M',
  'Uma faixa em WAV 24-bit + MP3 320 kbps, com licenca em PDF.',
  PRECO_FAIXA_CENTAVOS
);
const pack = await garante('pack', PACK.titulo, PACK.descricao, PRECO_PACK_CENTAVOS);

console.log('\nCole no ambiente do host:\n');
console.log('STRIPE_PRICE_SINGLE=' + single);
console.log('STRIPE_PRICE_PACK=' + pack);
