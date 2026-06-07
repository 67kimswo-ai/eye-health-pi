// ── /api/payments/incomplete ──────────────────────
const axios = require('axios');
const piClient = () => axios.create({
  baseURL: 'https://api.minepi.com',
  headers: { Authorization: `Key ${process.env.PI_API_KEY}`, 'Content-Type': 'application/json' },
});

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { payment } = req.body;
  const paymentId   = payment.identifier;
  const txid        = payment.transaction?.txid;
  try {
    if (txid) {
      await piClient().post(`/v2/payments/${paymentId}/complete`, { txid });
    } else {
      await piClient().post(`/v2/payments/${paymentId}/cancel`);
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '미완료 결제 처리 실패' });
  }
};
