// API autenticada. Espera que o middleware de auth já tenha preenchido req.user (ver middleware/context.js).
const router = require('express').Router();
const db = require('../lib/supabase');
const { h, need, httpError } = require('../lib/http');
const { ROLES, ctx, requireRole } = require('../middleware/context');
const billing = require('../services/billing.service');
const appts = require('../services/appointments.service');
const reports = require('../services/reports.service');

const owner = requireRole(ROLES.owner);
const staff = requireRole(ROLES.owner, ROLES.barber);
const client = requireRole(ROLES.client);

// ---------- Catálogo ----------
router.get('/services', h(async (req, res) => {
  const { data, error } = await db.from('services').select('*').eq('enterprise_id', ctx(req).enterpriseId).eq('active', true).order('name');
  if (error) throw error; res.json(data);
}));

router.get('/barbers', h(async (req, res) => {
  const { data, error } = await db.from('users').select('id,name')
    .eq('enterprise_id', ctx(req).enterpriseId).eq('role', ROLES.barber).order('name');
  if (error) throw error; res.json(data);
}));

// ---------- Planos ----------
function planFields(b) {
  need(b.name && String(b.name).trim(), 'Informe o nome do plano.');
  need(['single', 'monthly'].includes(b.type), 'Tipo deve ser "single" ou "monthly".');
  need(Number(b.price) >= 0, 'Preço inválido.');
  need(Number.isInteger(Number(b.cuts_included)) && Number(b.cuts_included) > 0, 'Informe quantos cortes o plano inclui.');
  return {
    name: String(b.name).trim(), description: b.description || null, type: b.type, price: Number(b.price),
    cuts_included: Number(b.cuts_included), validity_days: Number(b.validity_days) || 30
  };
}

router.get('/plans', h(async (req, res) => {
  const { data, error } = await db.from('plans').select('*')
    .eq('enterprise_id', ctx(req).enterpriseId).eq('active', true).order('type').order('price');
  if (error) throw error; res.json(data);
}));

router.post('/plans', owner, h(async (req, res) => {
  const { data, error } = await db.from('plans').insert({ ...planFields(req.body), enterprise_id: ctx(req).enterpriseId }).select().single();
  if (error) throw error; res.status(201).json(data);
}));

router.put('/plans/:id', owner, h(async (req, res) => {
  const { data, error } = await db.from('plans').update(planFields(req.body))
    .eq('id', req.params.id).eq('enterprise_id', ctx(req).enterpriseId).select().maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(404, 'Plano não encontrado.');
  res.json(data);
}));

// Arquivar (quem já assinou continua com o plano)
router.delete('/plans/:id', owner, h(async (req, res) => {
  const { error } = await db.from('plans').update({ active: false })
    .eq('id', req.params.id).eq('enterprise_id', ctx(req).enterpriseId);
  if (error) throw error; res.status(204).end();
}));

// ---------- Assinaturas ----------
router.post('/subscriptions/checkout', client, h(async (req, res) => {
  const { enterpriseId, userId } = ctx(req);
  need(req.body.plan_id, 'Informe o plano.');
  res.status(201).json(await billing.startCheckout({ enterpriseId, userId, planId: req.body.plan_id }));
}));

router.get('/subscriptions/me', client, h(async (req, res) => {
  const { enterpriseId, userId } = ctx(req);
  const [subs, pays] = await Promise.all([
    db.from('subscriptions').select('*, plan:plans(name,type,price)')
      .eq('enterprise_id', enterpriseId).eq('user_id', userId).in('status', ['active', 'overdue', 'pending'])
      .order('created_at', { ascending: false }),
    db.from('payments').select('id,amount,method,status,paid_at,created_at,checkout_url')
      .eq('enterprise_id', enterpriseId).eq('user_id', userId).order('created_at', { ascending: false }).limit(12)
  ]);
  if (subs.error) throw subs.error; if (pays.error) throw pays.error;
  res.json({ subscriptions: subs.data, payments: pays.data });
}));

// Cancelar = não renova mais; os cortes restantes valem até o fim do período já pago.
router.post('/subscriptions/:id/cancel', client, h(async (req, res) => {
  const { enterpriseId, userId } = ctx(req);
  const { data, error } = await db.from('subscriptions').update({ renew: false, canceled_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('enterprise_id', enterpriseId).eq('user_id', userId).select().maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(404, 'Assinatura não encontrada.');
  res.json(data);
}));

router.get('/subscribers', owner, h(async (req, res) => {
  const { enterpriseId } = ctx(req);
  const { data, error } = await db.from('subscriptions')
    .select('id,user_id,status,cuts_total,cuts_used,current_period_end, plan:plans(name,type), user:users!subscriptions_user_id_fkey(name,phone_number)')
    .eq('enterprise_id', enterpriseId).neq('status', 'pending').order('created_at', { ascending: false });
  if (error) throw error;

  const { data: last } = await db.from('appointments').select('client_id,starts_at')
    .eq('enterprise_id', enterpriseId).eq('status', 'done').order('starts_at', { ascending: false });
  const lastVisit = {};
  for (const a of last || []) if (!lastVisit[a.client_id]) lastVisit[a.client_id] = a.starts_at;

  res.json(data.map((s) => ({
    id: s.id, name: s.user.name, phone: s.user.phone_number, plan: s.plan.name, type: s.plan.type, status: s.status,
    used: s.cuts_used, total: s.cuts_total,
    next_charge: s.plan.type === 'monthly' && s.status !== 'canceled' ? s.current_period_end : null,
    last_visit: lastVisit[s.user_id] || null
  })));
}));

// ---------- Agenda ----------
router.get('/availability', h(async (req, res) => {
  const { barber_id: barberId, service_id: serviceId, date } = req.query;
  need(barberId && serviceId && date, 'Informe barber_id, service_id e date.');
  res.json(await appts.availability({ enterpriseId: ctx(req).enterpriseId, barberId, serviceId, date }));
}));

router.post('/appointments', h(async (req, res) => {
  const { enterpriseId, userId, role } = ctx(req);
  const clientId = role === ROLES.client ? userId : req.body.client_id;      // dono/barbeiro agenda para um cliente
  need(clientId, 'Informe o cliente.');
  res.status(201).json(await appts.book({
    enterpriseId, clientId, barberId: req.body.barber_id, serviceId: req.body.service_id, startsAt: req.body.starts_at
  }));
}));

router.get('/appointments', staff, h(async (req, res) => {
  const { enterpriseId, userId, role } = ctx(req);
  res.json(await appts.listDay({
    enterpriseId, date: req.query.date, barberId: role === ROLES.barber ? userId : req.query.barber_id
  }));
}));

router.get('/appointments/me', client, h(async (req, res) => {
  const { enterpriseId, userId } = ctx(req);
  res.json(await appts.listMine({ enterpriseId, clientId: userId }));
}));

router.patch('/appointments/:id/status', h(async (req, res) => {
  const { enterpriseId, userId, role } = ctx(req);
  const { status } = req.body;
  if (role === ROLES.client && status !== 'canceled') throw httpError(403, 'Você só pode cancelar o seu agendamento.');
  res.json(await appts.setStatus({
    enterpriseId, id: req.params.id, status, clientId: role === ROLES.client ? userId : null
  }));
}));

// ---------- Relatórios ----------
router.get('/reports/owner', owner, h(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 12);
  res.json(await reports.owner(ctx(req).enterpriseId, months));
}));

router.get('/reports/me', client, h(async (req, res) => {
  const { enterpriseId, userId } = ctx(req);
  res.json(await reports.client(enterpriseId, userId));
}));

module.exports = router;
