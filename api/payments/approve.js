// ── /api/payments/approve ─────────────────────────
const axios = require('axios');
const piClient = () => axios.create({
  baseURL: 'https://api.minepi.com',
  headers: { Authorization: `Key ${process.env.PI_API_KEY}`, 'Content-Type': 'application/json' },
});

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { paymentId } = req.body;
  try {
    const { data } = await piClient().post(`/v2/payments/${paymentId}/approve`);
    res.status(200).json({ success: true, payment: data });
  } catch (err) {
    res.status(500).json({ error: '결제 승인 실패' });
  }
};
