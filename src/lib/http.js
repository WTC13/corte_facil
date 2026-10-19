const httpError = (status, message) => Object.assign(new Error(message), { status });
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const need = (cond, message) => { if (!cond) throw httpError(400, message); };

// Traduz erros das funções SQL em respostas HTTP claras.
function mapRpcError(error) {
  const msg = error.message || '';
  if (error.code === '23P01') return httpError(409, 'Esse horário acabou de ser ocupado. Escolha outro.');
  if (msg.includes('NO_CREDITS')) return httpError(402, 'Você não tem créditos disponíveis. Assine ou renove um plano.');
  if (msg.includes('PAST_TIME')) return httpError(400, 'Escolha um horário no futuro.');
  if (msg.includes('SERVICE_NOT_FOUND')) return httpError(404, 'Serviço não encontrado.');
  if (msg.includes('BARBER_NOT_FOUND')) return httpError(404, 'Barbeiro não encontrado.');
  if (msg.includes('NOT_FOUND_OR_CLOSED')) return httpError(404, 'Agendamento não encontrado ou já encerrado.');
  return error;
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[erro]', err);
  res.status(status).json({ error: status >= 500 ? 'Erro interno. Tente novamente.' : err.message });
};

module.exports = { httpError, h, need, mapRpcError, errorHandler };
