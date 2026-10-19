// Adaptador do AbacatePay (Pix). Se trocar de gateway, só este arquivo muda.
const BASE = 'https://api.abacatepay.com/v1';

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`, 'Content-Type': 'application/json' }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = new Error(typeof json.error === 'string' ? json.error : `AbacatePay respondeu ${res.status}`);
    err.status = 502;
    throw err;
  }
  return json.data;
}

// Cria a cobrança Pix e devolve { id, url } (url = página de pagamento).
async function createBilling({ plan, user }) {
  const app = process.env.APP_URL;
  return call('/billing/create', {
    method: 'POST',
    body: JSON.stringify({
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      products: [{
        externalId: `plan-${plan.id}`,
        name: plan.name,
        description: `${plan.cuts_included} corte(s) — válido por ${plan.validity_days} dias`,
        quantity: 1,
        price: Math.round(Number(plan.price) * 100)          // centavos
      }],
      returnUrl: `${app}/client/subscription`,
      completionUrl: `${app}/client/subscription?paid=1`,
      customer: { name: user.name, email: user.email, cellphone: user.phone_number }
    })
  });
}

async function getBilling(id) {
  const list = await call('/billing/list');
  return (Array.isArray(list) ? list : []).find((b) => b.id === id) || null;
}

module.exports = { createBilling, getBilling };
