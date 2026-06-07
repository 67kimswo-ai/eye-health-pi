// ─────────────────────────────────────────────────
//  아이케어 파이 - 백엔드 서버 (Node.js + Express)
//  Pi Platform API 공식 연동
// ─────────────────────────────────────────────────
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// ── 환경변수 (.env 파일에 설정) ──────────────────
const PI_API_KEY  = process.env.PI_API_KEY  || 'YOUR_PI_API_KEY';
const PORT        = process.env.PORT        || 4000;

// ── Pi Platform API 클라이언트 ───────────────────
const piClient = axios.create({
  baseURL: 'https://api.minepi.com',
  timeout: 20000,
  headers: {
    'Authorization': `Key ${PI_API_KEY}`,
    'Content-Type':  'application/json',
  },
});

// ── 간단한 메모리 DB (실제 서비스는 MongoDB/Firebase 사용) ──
const userDB = {};  // uid → { username, totalPi, completedToday, streak, lastDate }

// ─────────────────────────────────────────────────
//  1) 사용자 인증 검증
//  POST /auth/verify
//  프론트에서 Pi.authenticate() 후 accessToken 전송
// ─────────────────────────────────────────────────
app.post('/auth/verify', async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken 이 없습니다' });
  }

  try {
    // Pi Platform API로 토큰 검증
    const response = await axios.get('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const piUser = response.data;  // { uid, username, ... }

    // DB에 사용자 없으면 초기화
    if (!userDB[piUser.uid]) {
      userDB[piUser.uid] = {
        username:       piUser.username,
        totalPi:        0,
        completedToday: [],
        streak:         0,
        lastDate:       null,
      };
    }

    // 날짜 바뀌면 completedToday 초기화
    const today = new Date().toDateString();
    const user  = userDB[piUser.uid];

    if (user.lastDate !== today) {
      if (user.lastDate === new Date(Date.now() - 86400000).toDateString()) {
        user.streak += 1;  // 연속 달성
      } else if (user.lastDate !== null) {
        user.streak = 1;   // 연속 끊김
      }
      user.completedToday = [];
      user.lastDate       = today;
    }

    console.log(`✅ 인증 성공: ${piUser.username}`);
    res.json({ success: true, user: { ...piUser, ...user } });

  } catch (err) {
    console.error('인증 실패:', err.response?.data || err.message);
    res.status(401).json({ error: '유효하지 않은 Pi 토큰입니다' });
  }
});

// ─────────────────────────────────────────────────
//  2) U2A 결제 승인 (사용자 → 앱 결제)
//  POST /payments/approve
//  프리미엄 구독 결제 서버 승인 단계
// ─────────────────────────────────────────────────
app.post('/payments/approve', async (req, res) => {
  const { paymentId } = req.body;

  try {
    const response = await piClient.post(`/v2/payments/${paymentId}/approve`);
    console.log(`💰 결제 승인: ${paymentId}`);
    res.json({ success: true, payment: response.data });
  } catch (err) {
    console.error('결제 승인 실패:', err.response?.data || err.message);
    res.status(500).json({ error: '결제 승인 실패' });
  }
});

// ─────────────────────────────────────────────────
//  3) U2A 결제 완료 (트랜잭션 ID 확인 후 완료 처리)
//  POST /payments/complete
// ─────────────────────────────────────────────────
app.post('/payments/complete', async (req, res) => {
  const { paymentId, txid, uid } = req.body;

  try {
    const response = await piClient.post(`/v2/payments/${paymentId}/complete`, { txid });

    // 구독 활성화
    if (userDB[uid]) {
      userDB[uid].isPremium   = true;
      userDB[uid].premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    console.log(`✅ 결제 완료: ${paymentId} / txid: ${txid}`);
    res.json({ success: true, payment: response.data });
  } catch (err) {
    console.error('결제 완료 실패:', err.response?.data || err.message);
    res.status(500).json({ error: '결제 완료 실패' });
  }
});

// ─────────────────────────────────────────────────
//  4) A2U 보상 지급 (앱 → 사용자 PI 지급)
//  POST /rewards/give
//  눈 운동 완료 후 PI 보상 지급
// ─────────────────────────────────────────────────
app.post('/rewards/give', async (req, res) => {
  const { uid, exerciseId, amount, memo } = req.body;

  if (!userDB[uid]) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  }

  const user = userDB[uid];

  // 중복 완료 방지
  if (user.completedToday.includes(exerciseId)) {
    return res.status(400).json({ error: '오늘 이미 완료한 운동입니다' });
  }

  try {
    // Step 1: Pi 서버에 A2U 결제 생성
    const createRes = await piClient.post('/v2/payments', {
      payment: {
        amount,
        memo:     memo || '눈 운동 완료 보상',
        metadata: { exerciseId, uid },
        uid,
      },
    });

    const paymentId = createRes.data.identifier;

    // Step 2: 결제 승인
    await piClient.post(`/v2/payments/${paymentId}/approve`);

    // Step 3: DB 업데이트
    user.completedToday.push(exerciseId);
    user.totalPi = +(user.totalPi + amount).toFixed(4);

    console.log(`🎁 보상 지급: ${user.username} → π${amount}`);
    res.json({
      success:   true,
      paymentId,
      totalPi:   user.totalPi,
      completed: user.completedToday,
    });

  } catch (err) {
    console.error('보상 지급 실패:', err.response?.data || err.message);
    res.status(500).json({ error: '보상 지급 실패' });
  }
});

// ─────────────────────────────────────────────────
//  5) 미완료 결제 처리 (앱 재시작 시 복구)
//  POST /payments/incomplete
// ─────────────────────────────────────────────────
app.post('/payments/incomplete', async (req, res) => {
  const { payment } = req.body;
  const paymentId   = payment.identifier;
  const txid        = payment.transaction?.txid;

  try {
    if (txid) {
      // 트랜잭션은 있지만 완료 안 된 경우 → 완료 처리
      await piClient.post(`/v2/payments/${paymentId}/complete`, { txid });
      console.log(`🔄 미완료 결제 복구 완료: ${paymentId}`);
    } else {
      // 트랜잭션 없는 경우 → 취소 처리
      await piClient.post(`/v2/payments/${paymentId}/cancel`);
      console.log(`❌ 미완료 결제 취소: ${paymentId}`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('미완료 결제 처리 실패:', err.response?.data || err.message);
    res.status(500).json({ error: '미완료 결제 처리 실패' });
  }
});

// ─────────────────────────────────────────────────
//  6) 사용자 통계 조회
//  GET /users/:uid/stats
// ─────────────────────────────────────────────────
app.get('/users/:uid/stats', (req, res) => {
  const user = userDB[req.params.uid];
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  res.json({ success: true, stats: user });
});

// ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
🚀 아이케어 파이 백엔드 서버 실행 중
📡 포트: ${PORT}
🔑 PI_API_KEY: ${PI_API_KEY.slice(0, 8)}...
  `);
});
