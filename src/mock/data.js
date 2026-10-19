// Dados fake só para visualizar as telas. As chaves já seguem o banco em inglês.
const enterprise = { name: 'Barbearia Vila Rica', slug: 'vila-rica' };

const barbers = [
  { id: 1, name: 'Rafael Nunes' },
  { id: 2, name: 'Diego Prado' },
  { id: 3, name: 'Thiago Maia' }
];

const services = [
  { id: 1, name: 'Corte', minutes: 40, price: 45 },
  { id: 2, name: 'Barba', minutes: 30, price: 35 },
  { id: 3, name: 'Corte + barba', minutes: 60, price: 70 }
];

const plans = [
  { id: 1, name: 'Corte avulso', type: 'single', price: 45, cuts: 1, validity_days: 30, subscribers: 38,
    description: 'Um corte, pago na hora. Sem renovação automática.' },
  { id: 2, name: 'Pacote 4 cortes', type: 'single', price: 150, cuts: 4, validity_days: 90, subscribers: 21,
    description: 'Pagamento único. Use os 4 cortes em até 90 dias.' },
  { id: 3, name: 'Clube corte', type: 'monthly', price: 119.9, cuts: 4, validity_days: 30, subscribers: 64,
    description: '4 cortes por mês. Renova sozinho no cartão ou Pix recorrente.' },
  { id: 4, name: 'Clube corte + barba', type: 'monthly', price: 169.9, cuts: 4, validity_days: 30, subscribers: 41,
    description: '4 cortes e 4 barbas por mês, com prioridade na agenda.' }
];

const subscribers = [
  { id: 1, name: 'Lucas Ferreira', phone: '(11) 98812-4410', plan: 'Clube corte', type: 'monthly', status: 'active', used: 2, total: 4, next_charge: '2026-10-27', last_visit: '2026-10-11' },
  { id: 2, name: 'André Souza', phone: '(11) 97745-1203', plan: 'Clube corte + barba', type: 'monthly', status: 'active', used: 4, total: 4, next_charge: '2026-10-22', last_visit: '2026-10-16' },
  { id: 3, name: 'Marcos Vinícius', phone: '(11) 99120-8877', plan: 'Clube corte', type: 'monthly', status: 'overdue', used: 0, total: 4, next_charge: '2026-10-09', last_visit: '2026-09-14' },
  { id: 4, name: 'Pedro Henrique', phone: '(11) 96633-2051', plan: 'Pacote 4 cortes', type: 'single', status: 'active', used: 1, total: 4, next_charge: null, last_visit: '2026-10-02' },
  { id: 5, name: 'Caio Mendes', phone: '(11) 98001-7765', plan: 'Corte avulso', type: 'single', status: 'active', used: 0, total: 1, next_charge: null, last_visit: '2026-08-30' },
  { id: 6, name: 'Bruno Alves', phone: '(11) 94410-3398', plan: 'Clube corte + barba', type: 'monthly', status: 'canceled', used: 1, total: 4, next_charge: null, last_visit: '2026-09-05' },
  { id: 7, name: 'Felipe Rocha', phone: '(11) 97289-6642', plan: 'Clube corte', type: 'monthly', status: 'active', used: 3, total: 4, next_charge: '2026-11-02', last_visit: '2026-10-15' }
];

const today = [
  { time: '09:00', client: 'Lucas Ferreira', service: 'Corte', barber: 'Rafael', status: 'done' },
  { time: '10:00', client: 'André Souza', service: 'Corte + barba', barber: 'Diego', status: 'done' },
  { time: '11:00', client: 'Felipe Rocha', service: 'Corte', barber: 'Rafael', status: 'confirmed' },
  { time: '14:00', client: 'Pedro Henrique', service: 'Barba', barber: 'Thiago', status: 'confirmed' },
  { time: '15:00', client: 'Caio Mendes', service: 'Corte', barber: 'Diego', status: 'waiting' }
];

const invoices = [
  { date: '2026-10-01', description: 'Clube corte — outubro', amount: 119.9, method: 'Cartão •••• 4242', status: 'paid' },
  { date: '2026-09-01', description: 'Clube corte — setembro', amount: 119.9, method: 'Cartão •••• 4242', status: 'paid' },
  { date: '2026-08-01', description: 'Clube corte — agosto', amount: 119.9, method: 'Pix', status: 'paid' }
];

const monthLabels = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];

module.exports = { enterprise, barbers, services, plans, subscribers, today, invoices, monthLabels };
