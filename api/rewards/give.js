// ── /api/rewards/give ────────────────────────────
// 눈 운동 완료 → Pi A2U 보상 지급
// ─────────────────────────────────────────────────
const axios = require('axios');

const userDB  = global.userDB  || (global.userDB  = {});
const PI_KEY  = process.env.PI_API_KEY;

const piClient = axios.create({
  baseURL: 'https://api.minepi.com',
  headers: { Authorization: `Key ${PI_KEY}`, 'Content-Type': 'application/json' },
});

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { uid, exerciseId, amount, memo } = req.body;

  if (!userDB[uid])
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });

  const user = userDB[uid];

  // 중복 완료 방지
  if (user.completedToday.includes(exerciseId))
    return res.status(400).json({ error: '오늘 이미 완료한 항목입니다' });

  try {
    // Step 1: A2U 결제 생성
    const { data: payment } = await piClient.post('/v2/payments', {
      payment: { amount, memo: memo || '눈 건강 활동 보상', metadata: { exerciseId, uid }, uid },
    });

    // Step 2: 결제 승인
    await piClient.post(`/v2/payments/${payment.identifier}/approve`);

    // Step 3: DB 업데이트
    user.completedToday.push(exerciseId);
    user.totalPi = +(user.totalPi + amount).toFixed(4);

    console.log(`🎁 보상: ${user.username} +π${amount}`);
    res.status(200).json({
      success:   true,
      paymentId: payment.identifier,
      totalPi:   user.totalPi,
      completed: user.completedToday,
    });

  } catch (err) {
    console.error('보상 실패:', err.response?.data || err.message);
    res.status(500).json({ error: '보상 지급 실패' });
  }
};
