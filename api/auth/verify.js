// ── /api/auth/verify ─────────────────────────────
// Pi accessToken 검증 + 사용자 초기화
// ─────────────────────────────────────────────────
const axios = require('axios');

// 간단한 메모리 스토어 (실서비스는 Vercel KV / PlanetScale 사용)
const userDB = global.userDB || (global.userDB = {});

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { accessToken } = req.body;
  if (!accessToken)
    return res.status(400).json({ error: 'accessToken 이 없습니다' });

  try {
    // Pi Platform API로 토큰 검증
    const { data: piUser } = await axios.get('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 신규 사용자 초기화
    if (!userDB[piUser.uid]) {
      userDB[piUser.uid] = {
        username:       piUser.username,
        totalPi:        0,
        completedToday: [],
        streak:         0,
        lastDate:       null,
        isPremium:      false,
      };
    }

    // 날짜 갱신 처리
    const today    = new Date().toDateString();
    const yesterday= new Date(Date.now() - 86400000).toDateString();
    const user     = userDB[piUser.uid];

    if (user.lastDate !== today) {
      user.streak         = user.lastDate === yesterday ? user.streak + 1 : (user.lastDate ? 1 : 0);
      user.completedToday = [];
      user.lastDate       = today;
    }

    console.log(`✅ 인증: ${piUser.username}`);
    res.status(200).json({ success: true, user: { ...piUser, ...user } });

  } catch (err) {
    console.error('인증 실패:', err.response?.data || err.message);
    res.status(401).json({ error: '유효하지 않은 Pi 토큰' });
  }
};
