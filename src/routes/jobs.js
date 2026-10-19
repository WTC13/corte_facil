const router = require('express').Router();
const { h } = require('../lib/http');
const billing = require('../services/billing.service');

// Vercel Cron chama com "Authorization: Bearer CRON_SECRET" (defina CRON_SECRET nas variáveis de ambiente).
router.get('/renewals', h(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Não autorizado.' });
  const { charged, expired } = await billing.runRenewals();
  res.json({ charged, expired });
}));

module.exports = router;
