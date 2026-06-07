// ── /api/users/[uid] ─────────────────────────────
const userDB = global.userDB || (global.userDB = {});

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const uid  = req.query.uid;
  const user = userDB[uid];
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  res.status(200).json({ success: true, stats: user });
};
