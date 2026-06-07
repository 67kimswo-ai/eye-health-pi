// ── /api/payments/complete ────────────────────────
const axios = require('axios');
const userDB = global.userDB || (global.userDB = {});
const piClient = () => axios.create({
  baseURL: 'https://api.minepi.com',
  headers: { Authorization: `Key ${process.env.PI_API_KEY}`, 'Content-Type': 'application/json' },
});

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { paymentId, txid, uid } = req.body;
  try {
    const { data } = await piClient().post(`/v2/payments/${paymentId}/complete`, { txid });
    if (uid && userDB[uid]) {
      userDB[uid].isPremium    = true;
      userDB[uid].premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    res.status(200).json({ success: true, payment: data });
  } catch (err) {
    res.status(500).json({ error: '결제 완료 처리 실패' });
  }
};
