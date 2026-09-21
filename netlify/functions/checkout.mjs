import Stripe from 'stripe';
import { montaLineItems, CURRENCY } from './_catalog.mjs';

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function erro(status, mensagem) {
  return new Response(JSON.stringify({ error: mensagem }), { status, headers: CORS });
}

export default async (req) => {
  if (req.method !== 'POST') return erro(405, 'Use POST.');

  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) return erro(503, 'Checkout ainda não configurado: falta STRIPE_SECRET_KEY no ambiente.');

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, 'JSON inválido.');
  }

  let lineItems, metadata;
  try {
    ({ lineItems, metadata } = montaLineItems(corpo && corpo.items));
  } catch (e) {
    return erro(e.status || 400, e.message);
  }

  const origem = process.env.SITE_URL || req.headers.get('origin') || new URL(req.url).origin;
  const stripe = new Stripe(chave, { apiVersion: '2024-06-20' });

  // Pix e boleto só existem em conta brasileira cobrando em BRL.
  const metodos = ['card'];
  if (CURRENCY === 'brl' && process.env.STRIPE_ENABLE_PIX !== 'false') metodos.push('pix');
  if (CURRENCY === 'brl' && process.env.STRIPE_ENABLE_BOLETO === 'true') metodos.push('boleto');

  try {
    const sessao = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      payment_method_types: metodos,
      customer_creation: 'always',
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      allow_promotion_codes: true,
      locale: 'pt-BR',
      metadata,
      payment_intent_data: { metadata },
      success_url: origem + '/sucesso.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origem + '/?checkout=cancelado'
    }, {
      idempotencyKey: corpo && typeof corpo.idempotencyKey === 'string'
        ? corpo.idempotencyKey.slice(0, 200)
        : undefined
    });

    return new Response(JSON.stringify({ id: sessao.id, url: sessao.url }), { status: 200, headers: CORS });
  } catch (e) {
    console.error('checkout falhou:', e && e.message);
    return erro(502, 'A Stripe recusou a criação da sessão. Tente de novo em instantes.');
  }
};

export const config = { path: '/api/checkout' };
