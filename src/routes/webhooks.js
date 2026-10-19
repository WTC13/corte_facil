const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { h } = require('../lib/http');
const abacate = require('../lib/abacatepay');
const billing = require('../services/billing.service');

const safeEq = (a = '', b = '') => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// No painel do AbacatePay, cadastre: https://SEU-DOMINIO/webhooks/abacatepay?webhookSecret=SEU_SEGREDO
router.post('/abacatepay', express.json(), h(async (req, res) => {
  if (!process.env.ABACATEPAY_WEBHOOK_SECRET || !safeEq(req.query.webhookSecret, process.env.ABACATEPAY_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  const evt = req.body || {};
  console.info('[webhook abacatepay]', evt.event);
  if (evt.event !== 'billing.paid') return res.json({ ignored: true });

  const id = evt.data?.billing?.id ?? evt.data?.pixQrCode?.id ?? evt.data?.id;
  if (!id) { console.warn('[webhook abacatepay] payload sem id', JSON.stringify(evt)); return res.status(400).json({ error: 'Sem id da cobrança.' }); }

  // Confere na API do gateway antes de liberar o plano
  const bill = await abacate.getBilling(id).catch(() => null);
  if (bill && bill.status !== 'PAID') return res.json({ ignored: 'não pago' });

  await billing.confirmPaid(id);
  res.json({ ok: true });
}));

module.exports = router;
