import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';
import { arquivosDoPedido } from './_catalog.mjs';

// Só estes eventos mudam o estado do pedido. O resto a gente confirma e ignora.
const INTERESSAM = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'charge.refunded'
]);

function store(nome) {
  try {
    return getStore(nome);
  } catch {
    return null; // fora do Netlify (ou Blobs desligado) o webhook ainda valida e loga
  }
}

async function jaProcessado(id) {
  const eventos = store('stripe_events');
  if (!eventos) return false;
  const existente = await eventos.get(id);
  if (existente) return true;
  await eventos.set(id, new Date().toISOString());
  return false;
}

async function gravaPedido(sessao, status) {
  const pedidos = store('orders');
  if (!pedidos) {
    console.log('pedido', sessao.id, status, '(sem Blobs: nada persistido)');
    return;
  }
  await pedidos.setJSON(sessao.id, {
    id: sessao.id,
    status,
    email: (sessao.customer_details && sessao.customer_details.email) || null,
    total: sessao.amount_total,
    moeda: sessao.currency,
    arquivos: status === 'paid' ? arquivosDoPedido(sessao.metadata) : [],
    atualizado_em: new Date().toISOString()
  });
}

async function avisaPorEmail(sessao) {
  const chave = process.env.RESEND_API_KEY;
  const email = sessao.customer_details && sessao.customer_details.email;
  const de = process.env.MAIL_FROM;
  if (!chave || !email || !de) return;

  const base = process.env.SITE_URL || '';
  const linhas = arquivosDoPedido(sessao.metadata)
    .map((a) => '<li><a href="' + base + '/' + a.arquivo + '">' + a.titulo + '</a></li>')
    .join('');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: de,
        to: [email],
        subject: 'Seus arquivos — Selo M & M',
        html: '<p>Pagamento confirmado. Seus downloads:</p><ul>' + linhas + '</ul>'
      })
    });
    if (!r.ok) console.error('Resend respondeu', r.status, await r.text());
  } catch (e) {
    console.error('falha ao enviar e-mail:', e && e.message);
  }
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });

  const chave = process.env.STRIPE_SECRET_KEY;
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!chave || !segredo) return new Response('Webhook não configurado.', { status: 503 });

  const assinatura = req.headers.get('stripe-signature');
  const bruto = await req.text(); // precisa ser o corpo cru, sem parse

  const stripe = new Stripe(chave, { apiVersion: '2024-06-20' });
  let evento;
  try {
    evento = await stripe.webhooks.constructEventAsync(bruto, assinatura, segredo);
  } catch (e) {
    console.error('assinatura inválida:', e && e.message);
    return new Response('Assinatura inválida.', { status: 400 });
  }

  if (!INTERESSAM.has(evento.type)) return new Response('ok', { status: 200 });

  // Idempotência: a Stripe reentrega. Processar duas vezes não pode mudar nada.
  if (await jaProcessado(evento.id)) return new Response('ok (repetido)', { status: 200 });

  try {
    if (evento.type === 'charge.refunded') {
      const cobranca = evento.data.object;
      const pedidos = store('orders');
      if (pedidos && cobranca.payment_intent) {
        const lista = await stripe.checkout.sessions.list({ payment_intent: cobranca.payment_intent, limit: 1 });
        const sessao = lista.data[0];
        if (sessao) await gravaPedido(sessao, 'refunded');
      }
      return new Response('ok', { status: 200 });
    }

    const sessao = evento.data.object;

    if (evento.type === 'checkout.session.expired') {
      await gravaPedido(sessao, 'failed');
      return new Response('ok', { status: 200 });
    }
    if (evento.type === 'checkout.session.async_payment_failed') {
      await gravaPedido(sessao, 'failed');
      return new Response('ok', { status: 200 });
    }

    // completed + async_payment_succeeded caem aqui.
    // Pix e boleto chegam como `completed` com payment_status 'unpaid':
    // o dinheiro ainda não entrou, então NÃO libera nada.
    if (sessao.payment_status !== 'paid') {
      await gravaPedido(sessao, 'processing');
      return new Response('ok (aguardando pagamento)', { status: 200 });
    }

    await gravaPedido(sessao, 'paid');
    await avisaPorEmail(sessao);
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('falha ao processar', evento.type, e && e.message);
    // 500 faz a Stripe reentregar; a chave de idempotência já gravada impede
    // que a reentrega duplique efeitos já aplicados.
    return new Response('erro interno', { status: 500 });
  }
};

export const config = { path: '/api/stripe/webhook' };
