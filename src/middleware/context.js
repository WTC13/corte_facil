// ÚNICO ponto que conhece o formato do seu middleware de autenticação.
// Ajuste aqui se o seu req.user tiver outros nomes ou se os valores de role forem diferentes.
const ROLES = { owner: 'owner', barber: 'barber', client: 'client' };

function ctx(req) {
  const u = req.user || {};
  return {
    userId: u.id || u.sub,
    role: u.role || u.app_role,
    enterpriseId: u.enterpriseId || u.enterprise_id
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(ctx(req).role)) return res.status(403).json({ error: 'Sem permissão.' });
    next();
  };
}

module.exports = { ROLES, ctx, requireRole };
