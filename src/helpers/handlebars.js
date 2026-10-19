// Helpers do Handlebars. Padrão: {{#if (eq a b)}} — nunca {{#if_eq}}.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

module.exports = {
  eq: (a, b) => a === b,
  formatMoney: (v) => brl.format(Number(v) || 0),
  formatData: (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');
  },
  initials: (name = '') =>
    String(name).trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
  hue: (str = '') => {
    let h = 0;
    for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  },
  json: (obj) => JSON.stringify(obj),
  slots: (used, total) => Array.from({ length: total }, (_, i) => i < used),
  pct: (a, b) => (b ? Math.round((a / b) * 100) : 0),
  statusLabel: (s) => ({
    active: 'Ativo', overdue: 'Em atraso', canceled: 'Cancelado',
    confirmed: 'Confirmado', waiting: 'Aguardando', done: 'Concluído', noshow: 'Faltou',
    paid: 'Pago', pending: 'Pendente', failed: 'Recusado'
  }[s] || s),
  statusTone: (s) => ({
    active: 'ok', confirmed: 'info', waiting: 'muted', done: 'ok', paid: 'ok',
    overdue: 'bad', noshow: 'bad', failed: 'bad', canceled: 'muted', pending: 'warn'
  }[s] || 'muted'),
  typeLabel: (t) => (t === 'monthly' ? 'Mensal' : 'Avulso')
};
