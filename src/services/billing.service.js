const db = require('../lib/supabase');
const abacate = require('../lib/abacatepay');
const { httpError } = require('../lib/http');

// Cria a cobrança Pix para uma assinatura e registra o pagamento como pendente.
async function charge({ sub, plan, user }) {
  const { data: pay, error } = await db.from('payments').insert({
    enterprise_id: sub.enterprise_id, user_id: sub.user_id, subscription_id: sub.id,
    amount: plan.price, method: 'pix', status: 'pending', gateway: 'abacatepay'
  }).select().single();
  if (error) throw error;

  try {
    const bill = await abacate.createBilling({ plan, user });
    await db.from('payments').update({ gateway_id: bill.id, checkout_url: bill.url }).eq('id', pay.id);
    return { payment_id: pay.id, url: bill.url };
  } catch (e) {
    await db.from('payments').update({ status: 'failed' }).eq('id', pay.id);
    throw e;
  }
}

// Cliente escolhe um plano: cria assinatura "pending" + cobrança. A ativação vem pelo webhook.
async function startCheckout({ enterpriseId, userId, planId }) {
  const { data: plan } = await db.from('plans').select('*')
    .eq('id', planId).eq('enterprise_id', enterpriseId).eq('active', true).maybeSingle();
  if (!plan) throw httpError(404, 'Plano não encontrado.');

  const { data: user } = await db.from('users').select('name,email,phone_number').eq('id', userId).single();
  const { data: sub, error } = await db.from('subscriptions').insert({
    enterprise_id: enterpriseId, user_id: userId, plan_id: plan.id, status: 'pending', cuts_total: plan.cuts_included
  }).select().single();
  if (error) throw error;

  return charge({ sub, plan, user });
}

// Chamado pelo webhook. Idempotente: pagar duas vezes o mesmo aviso não duplica nada.
async function confirmPaid(gatewayId) {
  const { data, error } = await db.rpc('mark_payment_paid', { p_gateway_id: gatewayId });
  if (error) throw error;
  return data;
}

// Rodada diária: cobra mensais que vencem em até 3 dias e atualiza vencidas.
async function runRenewals() {
  const soon = new Date(Date.now() + 3 * 864e5).toISOString();
  const { data: subs, error } = await db.from('subscriptions')
    .select('*, plan:plans!inner(*), user:users!subscriptions_user_id_fkey(name,email,phone_number), payments(status)')
    .eq('status', 'active').eq('renew', true).eq('plan.type', 'monthly').lte('current_period_end', soon);
  if (error) throw error;

  const links = [];
  for (const s of subs || []) {
    if ((s.payments || []).some((p) => p.status === 'pending')) continue;     // já tem cobrança aberta
    try {
      const { url } = await charge({ sub: s, plan: s.plan, user: s.user });
      links.push({ user: s.user.name, phone: s.user.phone_number, url });      // use para avisar por WhatsApp
    } catch (e) { console.error('[renovação]', s.id, e.message); }
  }
  const { data: expired } = await db.rpc('expire_subscriptions');
  return { charged: links.length, expired: expired || 0, links };
}

module.exports = { startCheckout, confirmPaid, runRenewals };
