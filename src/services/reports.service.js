const db = require('../lib/supabase');

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
function lastMonths(n) {
  const out = []; const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return out;
}
const label = (k) => new Date(`${k}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');

// ---------------- Dono ----------------
async function owner(enterpriseId, months = 6) {
  const keys = lastMonths(months);
  const thisMonth = keys[keys.length - 1];
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);

  const [rev, cuts, subs, todayCount, barbers] = await Promise.all([
    db.from('v_monthly_revenue').select('*').eq('enterprise_id', enterpriseId).gte('month', keys[0]),
    db.from('v_barber_cuts').select('*').eq('enterprise_id', enterpriseId).eq('month', thisMonth),
    db.from('subscriptions').select('status, plan:plans(name,type)').eq('enterprise_id', enterpriseId),
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId)
      .gte('starts_at', start.toISOString()).lt('starts_at', new Date(start.getTime() + 864e5).toISOString())
      .neq('status', 'canceled'),
    db.from('users').select('id,name').eq('enterprise_id', enterpriseId)
  ]);
  for (const r of [rev, cuts, subs, todayCount, barbers]) if (r.error) throw r.error;

  const series = { monthly: keys.map(() => 0), single: keys.map(() => 0) };
  for (const r of rev.data) {
    const i = keys.indexOf(r.month);
    if (i >= 0) series[r.plan_type][i] += Number(r.total);
  }
  const names = Object.fromEntries(barbers.data.map((b) => [b.id, b.name.split(' ')[0]]));
  const count = (status) => subs.data.filter((s) => s.status === status).length;
  const mix = {};
  for (const s of subs.data.filter((x) => x.status === 'active')) mix[s.plan.name] = (mix[s.plan.name] || 0) + 1;

  return {
    stats: {
      revenue_month: series.monthly[keys.length - 1] + series.single[keys.length - 1],
      active_subscribers: count('active'),
      overdue_subscribers: count('overdue'),
      appointments_today: todayCount.count || 0
    },
    revenue_chart: { labels: keys.map(label), monthly: series.monthly, single: series.single },
    mix_chart: { labels: Object.keys(mix), data: Object.values(mix) },
    barber_chart: { labels: cuts.data.map((c) => names[c.barber_id] || '—'), data: cuts.data.map((c) => c.cuts) }
  };
}

// ---------------- Assinante ----------------
async function client(enterpriseId, userId) {
  const yearStart = `${new Date().getUTCFullYear()}-01-01T00:00:00-03:00`;
  const [appts, pays] = await Promise.all([
    db.from('appointments').select('starts_at, barber:users!appointments_barber_id_fkey(name), service:services(name,price)')
      .eq('enterprise_id', enterpriseId).eq('client_id', userId).eq('status', 'done').order('starts_at', { ascending: false }),
    db.from('payments').select('amount').eq('enterprise_id', enterpriseId).eq('user_id', userId)
      .eq('status', 'paid').gte('paid_at', yearStart)
  ]);
  for (const r of [appts, pays]) if (r.error) throw r.error;

  const keys = lastMonths(6);
  const perMonth = keys.map(() => 0);
  const byBarber = {};
  let avoided = 0; let thisYear = 0;
  for (const a of appts.data) {
    const i = keys.indexOf(monthKey(new Date(a.starts_at)));
    if (i >= 0) perMonth[i] += 1;
    byBarber[a.barber.name] = (byBarber[a.barber.name] || 0) + 1;
    if (a.starts_at >= yearStart) { thisYear += 1; avoided += Number(a.service.price); }
  }
  const dates = appts.data.map((a) => new Date(a.starts_at).getTime());
  const gaps = dates.slice(0, -1).map((t, i) => (t - dates[i + 1]) / 864e5);
  const paid = pays.data.reduce((s, p) => s + Number(p.amount), 0);
  const top = Object.entries(byBarber).sort((a, b) => b[1] - a[1])[0];

  return {
    stats: {
      cuts_year: thisYear,
      savings: Math.max(0, avoided - paid),                      // quanto pagaria avulso - quanto pagou
      avg_days_between: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
      top_barber: top ? { name: top[0], cuts: top[1] } : null
    },
    cuts_chart: { labels: keys.map(label), data: perMonth },
    history: appts.data.slice(0, 10).map((a) => ({ date: a.starts_at, service: a.service.name, barber: a.barber.name }))
  };
}

module.exports = { owner, client };
