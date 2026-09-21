import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';
import { arquivosDoPedido } from './_catalog.mjs';

const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export default async (req) => {
  const id = new URL(req.url).searchParams.get('session_id');
  if (!id || !id.startsWith('cs_')) {
    return new Response(JSON.stringify({ error: 'session_id ausente.' }), { status: 400, headers: H });
  }

  // Primeiro o que o webhook gravou; é a fonte de verdade do pedido.
  try {
    const registro = await getStore('orders').get(id, { type: 'json' });
    if (registro) return new Response(JSON.stringify(registro), { status: 200, headers: H });
  } catch { /* Blobs indisponível: cai na consulta direta abaixo */ }

  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) return new Response(JSON.stringify({ status: 'processing' }), { status: 200, headers: H });

  try {
    const stripe = new Stripe(chave, { apiVersion: '2024-06-20' });
    const sessao = await stripe.checkout.sessions.retrieve(id);
    const pago = sessao.payment_status === 'paid';
    return new Response(JSON.stringify({
      id: sessao.id,
      status: pago ? 'paid' : 'processing',
      email: (sessao.customer_details && sessao.customer_details.email) || null,
      total: sessao.amount_total,
      moeda: sessao.currency,
      arquivos: pago ? arquivosDoPedido(sessao.metadata) : []
    }), { status: 200, headers: H });
  } catch {
    return new Response(JSON.stringify({ error: 'Pedido não encontrado.' }), { status: 404, headers: H });
  }
};

export const config = { path: '/api/order' };
