# 👁️ 아이케어 파이 (EyeCare Pi)

> Pi Network 연동 눈 건강 관리 + PI 보상 앱

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Pi Network](https://img.shields.io/badge/Pi-Network-purple)](https://minepi.com)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)

---

## 📱 주요 기능

| 기능 | 설명 |
|------|------|
| 👁️ **눈 운동 루틴** | 20-20-20, 팔밍, 스트레칭, 초점 훈련 |
| 🔬 **시력 자가측정** | 스넬렌 시력표 + 난시 + 색각 검사 |
| 🔐 **Pi 로그인** | Pi SDK 인증 (KYC 연동) |
| 💰 **PI 보상** | 운동 완료 시 자동 PI 지급 (A2U) |
| 🌟 **Pro 구독** | Pi 결제 월정액 구독 (U2A) |
| 📊 **기록 관리** | 시력 변화 추이, 연속 달성 현황 |

---

## 🗂️ 폴더 구조

```
eye-health-pi/
├── api/                        ← Vercel Serverless Functions (백엔드)
│   ├── auth/verify.js          ← Pi 토큰 검증
│   ├── rewards/give.js         ← A2U 보상 지급
│   ├── payments/approve.js     ← U2A 결제 승인
│   ├── payments/complete.js    ← U2A 결제 완료
│   ├── payments/incomplete.js  ← 미완료 결제 복구
│   └── users/[uid].js          ← 사용자 통계
├── src/
│   ├── App.jsx                 ← 메인 앱 (홈·운동·완료·시력측정)
│   └── components/
│       └── VisionTestModule.jsx ← 시력 측정 모듈
├── public/
│   └── index.html              ← Pi SDK 스크립트 포함
├── backend/                    ← 로컬 개발용 Express 서버
│   ├── server.js
│   └── package.json
├── vercel.json                 ← Vercel 배포 설정
├── package.json
└── .env.example                ← 환경변수 템플릿
```

---

## 🚀 로컬 실행

```bash
# 1. 저장소 클론
git clone https://github.com/67kimswo-ai/eye-health-pi.git
cd eye-health-pi

# 2. 패키지 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env 파일에 PI_API_KEY 입력

# 4. 실행
npm start
# → http://localhost:3000
```

---

## ☁️ Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

Vercel 대시보드 → Environment Variables → `PI_API_KEY` 추가

---

## 🔌 Pi SDK 연동 흐름

```
[Pi 브라우저] Pi.authenticate()
      ↓
[백엔드] /api/auth/verify → Pi Platform API 검증
      ↓
[운동 완료] /api/rewards/give → A2U 자동 PI 지급
      ↓
[구독 결제] Pi.createPayment() → U2A 결제 흐름
```

---

## 🛠️ 기술 스택

- **프론트엔드**: React 18, Pi SDK
- **백엔드**: Vercel Serverless Functions (Node.js)
- **배포**: Vercel
- **인증**: Pi Network OAuth
- **결제**: Pi Platform API (A2U / U2A)

---

## ⚠️ 환경변수

```env
PI_API_KEY=Pi_개발자_포털에서_발급
```

> `.env` 파일은 절대 GitHub에 올리지 마세요! `.gitignore`에 포함되어 있습니다.

---

## 📄 라이선스

MIT License © 2025 67kimswo-ai
