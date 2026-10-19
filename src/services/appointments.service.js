const db = require('../lib/supabase');
const { httpError, mapRpcError } = require('../lib/http');

const SLOT_HOURS = [9, 10, 11, 14, 15, 16, 17, 18];       // horários de início (ajuste por barbearia depois)
const TZ = '-03:00';                                       // America/Sao_Paulo
const pad = (n) => String(n).padStart(2, '0');
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

async function availability({ enterpriseId, barberId, serviceId, date }) {
  if (!isDate(date)) throw httpError(400, 'Informe a data no formato AAAA-MM-DD.');
  const { data: svc } = await db.from('services').select('minutes')
    .eq('id', serviceId).eq('enterprise_id', enterpriseId).maybeSingle();
  if (!svc) throw httpError(404, 'Serviço não encontrado.');

  const { data: busy, error } = await db.from('appointments').select('starts_at,ends_at')
    .eq('enterprise_id', enterpriseId).eq('barber_id', barberId).eq('status', 'confirmed')
    .gte('starts_at', `${date}T00:00:00${TZ}`).lte('starts_at', `${date}T23:59:59${TZ}`);
  if (error) throw error;

  const now = Date.now();
  return SLOT_HOURS.map((h) => {
    const start = new Date(`${date}T${pad(h)}:00:00${TZ}`);
    const end = new Date(start.getTime() + svc.minutes * 60000);
    const clash = (busy || []).some((a) => start < new Date(a.ends_at) && end > new Date(a.starts_at));
    return { time: `${pad(h)}:00`, starts_at: start.toISOString(), free: start.getTime() > now && !clash };
  });
}

async function book({ enterpriseId, clientId, barberId, serviceId, startsAt }) {
  if (!barberId || !serviceId || !startsAt) throw httpError(400, 'Informe barbeiro, serviço e horário.');
  const { data, error } = await db.rpc('book_appointment', {
    p_enterprise: enterpriseId, p_client: clientId, p_barber: barberId, p_service: serviceId, p_starts: startsAt
  });
  if (error) throw mapRpcError(error);
  return data;
}

const SELECT = '*, client:users!appointments_client_id_fkey(name,phone_number), barber:users!appointments_barber_id_fkey(name), service:services(name,price)';

async function listDay({ enterpriseId, date, barberId }) {
  if (!isDate(date)) throw httpError(400, 'Informe a data no formato AAAA-MM-DD.');
  let q = db.from('appointments').select(SELECT).eq('enterprise_id', enterpriseId)
    .gte('starts_at', `${date}T00:00:00${TZ}`).lte('starts_at', `${date}T23:59:59${TZ}`).order('starts_at');
  if (barberId) q = q.eq('barber_id', barberId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function listMine({ enterpriseId, clientId }) {
  const { data, error } = await db.from('appointments').select(SELECT)
    .eq('enterprise_id', enterpriseId).eq('client_id', clientId).order('starts_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data;
}

// done consome crédito; noshow/canceled liberam a reserva.
async function setStatus({ enterpriseId, id, status, clientId }) {
  if (!['done', 'noshow', 'canceled'].includes(status)) throw httpError(400, 'Status inválido.');
  if (status === 'done') {
    const { data, error } = await db.rpc('complete_appointment', { p_enterprise: enterpriseId, p_id: id });
    if (error) throw mapRpcError(error);
    return data;
  }
  let q = db.from('appointments').update({ status })
    .eq('id', id).eq('enterprise_id', enterpriseId).eq('status', 'confirmed');
  if (clientId) q = q.eq('client_id', clientId);                 // cliente só mexe nos próprios
  const { data, error } = await q.select().maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(404, 'Agendamento não encontrado ou já encerrado.');
  return data;
}

module.exports = { availability, book, listDay, listMine, setStatus };
