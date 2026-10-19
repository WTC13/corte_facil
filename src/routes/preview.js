// Rotas de PREVIEW: renderizam as telas com dados fake.
// Quando a parte interna estiver pronta, troque o mock por consultas ao Supabase.
const router = require('express').Router();
const m = require('../mock/data');

const ownerNav = [
  { key: 'dashboard', label: 'Visão geral', icon: 'bi-speedometer2', href: '/owner/dashboard' },
  { key: 'agenda', label: 'Agenda', icon: 'bi-calendar3', href: '/owner/agenda' },
  { key: 'subscribers', label: 'Assinantes', icon: 'bi-people', href: '/owner/subscribers' },
  { key: 'plans', label: 'Planos', icon: 'bi-ticket-perforated', href: '/owner/plans' },
  { key: 'reports', label: 'Relatórios', icon: 'bi-bar-chart-line', href: '/owner/reports' }
];
const clientNav = [
  { key: 'book', label: 'Agendar corte', icon: 'bi-calendar-plus', href: '/client/book' },
  { key: 'subscription', label: 'Minha assinatura', icon: 'bi-credit-card-2-front', href: '/client/subscription' },
  { key: 'reports', label: 'Meus números', icon: 'bi-graph-up', href: '/client/reports' }
];

router.use((req, res, next) => {
  res.locals.prefix = '/preview';
  res.locals.enterprise = m.enterprise;
  next();
});

const owner = (active, title, extra = {}) => ({
  layout: 'panel', area: 'owner', nav: ownerNav, active, title,
  user: { name: 'Carlos Menezes', role: 'Dono' }, ...extra
});
const client = (active, title, extra = {}) => ({
  layout: 'panel', area: 'client', nav: clientNav, active, title,
  user: { name: 'Lucas Ferreira', role: 'Assinante' }, ...extra
});

// ---------- Auth ----------
router.get('/login', (req, res) => res.render('auth/login', { layout: 'auth', title: 'Entrar' }));
router.get('/register', (req, res) => res.render('auth/register', { layout: 'auth', title: 'Criar conta' }));

// ---------- Dono ----------
router.get('/owner/dashboard', (req, res) => {
  res.render('owner/dashboard', owner('dashboard', 'Visão geral', {
    dateLabel: 'Domingo, 18 de outubro',
    stats: [
      { label: 'Receita do mês', value: 'R$ 18.420', delta: '+12% vs. setembro', tone: 'up' },
      { label: 'Assinantes ativos', value: '164', delta: '+9 neste mês', tone: 'up' },
      { label: 'Cortes hoje', value: '5', delta: '2 concluídos', tone: 'flat' },
      { label: 'Em atraso', value: '7', delta: 'R$ 840 a recuperar', tone: 'down' }
    ],
    revenueChart: {
      type: 'line', money: true, labels: m.monthLabels,
      datasets: [
        { label: 'Mensal', data: [8200, 9100, 10400, 11800, 12900, 14200] },
        { label: 'Avulso', data: [3100, 3400, 3000, 3600, 3900, 4220] }
      ]
    },
    mixChart: { type: 'doughnut', labels: ['Clube corte', 'Clube corte + barba', 'Pacote 4 cortes', 'Corte avulso'], datasets: [{ data: [64, 41, 21, 38] }] },
    today: m.today,
    overdue: m.subscribers.filter((s) => s.status === 'overdue')
  }));
});

router.get('/owner/agenda', (req, res) => {
  const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const booked = {
    '09:00-1': { client: 'Lucas Ferreira', service: 'Corte', status: 'done' },
    '10:00-2': { client: 'André Souza', service: 'Corte + barba', status: 'done' },
    '11:00-1': { client: 'Felipe Rocha', service: 'Corte', status: 'confirmed' },
    '11:00-3': { client: 'Marcos Vinícius', service: 'Barba', status: 'confirmed' },
    '14:00-3': { client: 'Pedro Henrique', service: 'Barba', status: 'confirmed' },
    '15:00-2': { client: 'Caio Mendes', service: 'Corte', status: 'waiting' },
    '16:00-1': { client: 'Bruno Alves', service: 'Corte + barba', status: 'confirmed' }
  };
  const rows = hours.map((h) => ({
    hour: h,
    lunch: h === '12:00' || h === '13:00',
    cells: m.barbers.map((b) => booked[`${h}-${b.id}`] || null)
  }));
  const week = [
    { label: 'Seg', day: 12 }, { label: 'Ter', day: 13 }, { label: 'Qua', day: 14 },
    { label: 'Qui', day: 15 }, { label: 'Sex', day: 16 }, { label: 'Sáb', day: 17 }, { label: 'Dom', day: 18, active: true }
  ];
  res.render('owner/agenda', owner('agenda', 'Agenda', {
    barbers: m.barbers, rows, week, services: m.services
  }));
});

router.get('/owner/subscribers', (req, res) => {
  res.render('owner/subscribers', owner('subscribers', 'Assinantes', { subscribers: m.subscribers }));
});

router.get('/owner/plans', (req, res) => {
  res.render('owner/plans', owner('plans', 'Planos', {
    plans: m.plans,
    monthly: m.plans.filter((p) => p.type === 'monthly'),
    single: m.plans.filter((p) => p.type === 'single')
  }));
});

router.get('/owner/reports', (req, res) => {
  res.render('owner/reports', owner('reports', 'Relatórios', {
    stats: [
      { label: 'Receita recorrente', value: 'R$ 14.200', delta: '+9% em 30 dias', tone: 'up' },
      { label: 'Ticket médio', value: 'R$ 112', delta: '+R$ 6', tone: 'up' },
      { label: 'Cancelamentos', value: '3,1%', delta: '-0,8 p.p.', tone: 'up' },
      { label: 'Faltas sem aviso', value: '6,4%', delta: '+1,2 p.p.', tone: 'down' }
    ],
    revenueChart: {
      type: 'bar', money: true, labels: m.monthLabels,
      datasets: [{ label: 'Receita', data: [11300, 12500, 13400, 15400, 16800, 18420] }]
    },
    typeChart: { type: 'doughnut', labels: ['Mensal', 'Avulso'], datasets: [{ data: [14200, 4220] }] },
    barberChart: {
      type: 'bar', labels: m.barbers.map((b) => b.name.split(' ')[0]),
      datasets: [{ label: 'Cortes no mês', data: [96, 88, 71] }]
    },
    atRisk: m.subscribers.filter((s) => s.status === 'overdue' || s.used === 0)
  }));
});

// ---------- Assinante ----------
router.get('/client/book', (req, res) => {
  const days = ['Dom 18', 'Seg 19', 'Ter 20', 'Qua 21', 'Qui 22', 'Sex 23', 'Sáb 24'].map((label, i) => ({
    label, key: `d${i}`, active: i === 0,
    slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00']
      .map((time, j) => ({ time, free: (i + j) % 3 !== 0 }))
  }));
  res.render('client/book', client('book', 'Agendar corte', {
    services: m.services, barbers: m.barbers, days,
    credits: { used: 2, total: 4, plan: 'Clube corte', renews: '2026-10-27' }
  }));
});

router.get('/client/subscription', (req, res) => {
  res.render('client/subscription', client('subscription', 'Minha assinatura', {
    current: { name: 'Clube corte', type: 'monthly', status: 'active', price: 119.9, used: 2, total: 4, renews: '2026-10-27', method: 'Cartão •••• 4242' },
    invoices: m.invoices,
    plans: m.plans
  }));
});

router.get('/client/reports', (req, res) => {
  res.render('client/reports', client('reports', 'Meus números', {
    stats: [
      { label: 'Cortes em 2026', value: '23', delta: '2 por mês, em média', tone: 'flat' },
      { label: 'Economia no clube', value: 'R$ 312', delta: 'vs. pagar avulso', tone: 'up' },
      { label: 'Intervalo entre cortes', value: '16 dias', delta: 'meta: 15 dias', tone: 'flat' },
      { label: 'Barbeiro mais visitado', value: 'Rafael', delta: '14 de 23 cortes', tone: 'flat' }
    ],
    cutsChart: { type: 'bar', labels: m.monthLabels, datasets: [{ label: 'Cortes', data: [3, 4, 4, 3, 4, 2] }] },
    history: [
      { date: '2026-10-11', service: 'Corte', barber: 'Rafael', status: 'done' },
      { date: '2026-09-27', service: 'Corte + barba', barber: 'Rafael', status: 'done' },
      { date: '2026-09-12', service: 'Corte', barber: 'Diego', status: 'done' },
      { date: '2026-08-29', service: 'Corte', barber: 'Rafael', status: 'noshow' }
    ]
  }));
});

module.exports = router;
