// ─────────────────────────────────────────────────
//  아이케어 파이 - 프론트엔드
//  실제 Pi SDK + 백엔드 + 시력측정 모듈 연동
// ─────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import VisionTestModule from "./components/VisionTestModule";

// Vercel 배포 시 상대경로 사용 (프론트+백엔드 같은 도메인)
const API = axios.create({ baseURL: "/api" });

const EYE_EXERCISES = [
  { id: 1, title: "20-20-20 규칙",     desc: "20분마다 6m 거리를 20초간 바라보기", duration: 20, icon: "👁️", reward: 0.1,  color: "#00C9A7" },
  { id: 2, title: "눈 근육 스트레칭", desc: "눈동자를 상하좌우 천천히 움직이기",   duration: 30, icon: "🔄", reward: 0.15, color: "#4E9AF1" },
  { id: 3, title: "팔밍 휴식",         desc: "따뜻한 손바닥으로 눈을 가볍게 덮기", duration: 60, icon: "🤲", reward: 0.2,  color: "#A78BFA" },
  { id: 4, title: "원근 초점 훈련",   desc: "가까이/멀리 초점 교대로 맞추기",     duration: 45, icon: "🎯", reward: 0.15, color: "#F59E0B" },
];

// ── 원형 타이머 컴포넌트 ─────────────────────────
function CircleTimer({ duration, isRunning, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const ref = useRef();
  const R = 54, C = 2 * Math.PI * R;

  useEffect(() => { setTimeLeft(duration); }, [duration]);

  useEffect(() => {
    if (!isRunning) return;
    ref.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(ref.current); onComplete(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [isRunning]);

  const progress = ((duration - timeLeft) / duration) * C;

  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="65" cy="65" r={R} fill="none" stroke="#00C9A7" strokeWidth="8"
          strokeDasharray={C} strokeDashoffset={C - progress} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Orbitron',monospace" }}>{timeLeft}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>초</div>
      </div>
    </div>
  );
}

// ── 알림 컴포넌트 ────────────────────────────────
function Toast({ msg, type }) {
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "rgba(239,68,68,0.95)" : "rgba(0,201,167,0.95)",
      color: "#fff", padding: "12px 24px", borderRadius: 12,
      fontSize: 14, fontWeight: 500, zIndex: 9999,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
      animation: "slideDown 0.3s ease"
    }}>{msg}</div>
  );
}

// ── 메인 앱 ──────────────────────────────────────
export default function App() {
  const [screen,      setScreen]      = useState("home");  // home|exercise|complete|vision
  const [piUser,      setPiUser]      = useState(null);
  const [userStats,   setUserStats]   = useState(null);
  const [selExercise, setSelExercise] = useState(null);
  const [isRunning,   setIsRunning]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState(null);
  const [rewardInfo,  setRewardInfo]  = useState(null);
  const [isPiBrowser, setIsPiBrowser] = useState(false);
  const [currentUrl,  setCurrentUrl]  = useState("");

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const copyAppUrl = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      notify('Pi Browser에서 열 수 있도록 URL이 복사되었습니다.');
    } catch (err) {
      console.error('URL 복사 실패', err);
      notify('URL 복사에 실패했습니다.', 'error');
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('piAccount');
    if (!stored) return;
    try {
      const { piUser: savedUser, userStats: savedStats } = JSON.parse(stored);
      if (savedUser?.uid) {
        setPiUser(savedUser);
        setUserStats(savedStats);
      }
    } catch (err) {
      console.warn('로컬 저장된 Pi 계정 정보를 불러오지 못했습니다.', err);
      localStorage.removeItem('piAccount');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCurrentUrl(window.location.href);
    setIsPiBrowser(!!window.Pi && typeof window.Pi.authenticate === 'function');
  }, []);

  useEffect(() => {
    if (!piUser) {
      localStorage.removeItem('piAccount');
      return;
    }
    localStorage.setItem('piAccount', JSON.stringify({ piUser, userStats }));
  }, [piUser, userStats]);

  const handleLogout = () => {
    setPiUser(null);
    setUserStats(null);
    setRewardInfo(null);
    localStorage.removeItem('piAccount');
    notify('Pi 계정 연동이 해제되었습니다.', 'success');
  };

  const refreshUserStats = async () => {
    if (!piUser?.uid) return;
    try {
      const res = await API.get(`/users/${piUser.uid}`);
      if (res.data?.stats) {
        setUserStats(res.data.stats);
      }
    } catch (err) {
      console.warn('사용자 통계 갱신 실패', err);
    }
  };

  const handleDevLogin = () => {
    const devUser = { uid: "dev-user", username: "DevTester" };
    const devStats = {
      totalPi: 0,
      completedToday: [],
      streak: 0,
      lastDate: new Date().toDateString(),
      isPremium: false,
    };
    setPiUser(devUser);
    setUserStats(devStats);
    notify('개발 환경 로그인으로 실행합니다. Pi 연동 기능은 Pi Browser에서만 활성화됩니다.');
  };

  // ── Pi SDK 초기화 & 로그인 ───────────────────
  const handlePiLogin = useCallback(async () => {
    const Pi = window.Pi;
    if (Pi && isPiBrowser) {
      setLoading(true);
      try {
        // 미완료 결제 처리 콜백
        const onIncompletePayment = async (payment) => {
          try {
            await API.post("/payments/incomplete", { payment });
          } catch (e) { console.error("미완료 결제 처리 실패", e); }
        };

        // Pi SDK 인증 (username + payments 스코프 요청)
        const authResult = await Pi.authenticate(
          ["username", "payments"],
          onIncompletePayment
        );

        // 백엔드에서 토큰 검증 + 사용자 정보 조회
        const res = await API.post("/auth/verify", {
          accessToken: authResult.accessToken,
        });

        setPiUser(res.data.user);
        setUserStats(res.data.user);
        notify(`환영합니다, ${res.data.user.username}! 👋`);

      } catch (err) {
        console.error("로그인 실패:", err);
        notify("로그인에 실패했습니다. 다시 시도해 주세요.", "error");
      } finally {
        setLoading(false);
      }
    } else {
      handleDevLogin();
    }
  }, [handleDevLogin, isPiBrowser]);

  // ── 운동 시작 ────────────────────────────────
  const startExercise = (ex) => {
    if (!piUser) { notify("먼저 로그인해 주세요!", "error"); return; }
    if (userStats?.completedToday?.includes(ex.id)) {
      notify("오늘 이미 완료한 운동입니다 ✅"); return;
    }
    setSelExercise(ex);
    setIsRunning(false);
    setScreen("exercise");
  };

  // ── 운동 완료 → 백엔드 보상 지급 요청 ───────
  const handleExerciseDone = async () => {
    setIsRunning(false);
    setLoading(true);
    try {
      const res = await API.post("/rewards/give", {
        uid:        piUser.uid,
        exerciseId: selExercise.id,
        amount:     selExercise.reward,
        memo:       `${selExercise.title} 완료 보상`,
      });

      setRewardInfo({
        reward:    selExercise.reward,
        totalPi:   res.data.totalPi,
        completed: res.data.completed,
      });
      setUserStats(prev => ({
        ...prev,
        totalPi:        res.data.totalPi,
        completedToday: res.data.completed,
      }));
      setScreen("complete");

    } catch (err) {
      const msg = err.response?.data?.error || "보상 지급에 실패했습니다.";
      notify(msg, "error");
      setScreen("home");
    } finally {
      setLoading(false);
    }
  };

  // ── 프리미엄 구독 결제 (U2A) ─────────────────
  const handleSubscribe = async () => {
    const Pi = window.Pi;
    if (!Pi || !piUser) return;

    try {
      const payment = await Pi.createPayment({
        amount:   5,
        memo:     "아이케어 파이 Pro 월간 구독",
        metadata: { plan: "pro", uid: piUser.uid },
      }, {
        // 결제 준비 완료 → 백엔드 승인
        onReadyForServerApproval: async (paymentId) => {
          await API.post("/payments/approve", { paymentId });
        },
        // 블록체인 완료 → 백엔드 완료 처리
        onReadyForServerCompletion: async (paymentId, txid) => {
          await API.post("/payments/complete", {
            paymentId, txid, uid: piUser.uid,
          });
          notify("Pro 구독 활성화 완료! 🎉");
          setUserStats(prev => ({ ...prev, isPremium: true }));
        },
        onCancel: () => notify("결제가 취소되었습니다.", "error"),
        onError:  (err) => notify("결제 오류: " + err.message, "error"),
      });

    } catch (err) {
      notify("결제 시작 실패", "error");
    }
  };

  // ── 공통 스타일 ──────────────────────────────
  const bg = {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0a0e1a 0%,#0d1b2a 50%,#0a1628 100%)",
    fontFamily: "'Noto Sans KR',sans-serif",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
  };
  const orb = (top, left, color, size = 300) => ({
    position: "fixed", top, left, width: size, height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle,${color}18 0%,transparent 70%)`,
    pointerEvents: "none", zIndex: 0,
  });
  const card = (extra = {}) => ({
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 18, ...extra,
  });
  const btn = (bg_, extra = {}) => ({
    width: "100%", padding: "15px 0", border: "none",
    borderRadius: 14, color: "#fff", fontSize: 15,
    fontWeight: 700, cursor: "pointer", background: bg_,
    transition: "opacity 0.2s", ...extra,
  });

  // ════════════════════════════════════════════════
  //  HOME
  // ════════════════════════════════════════════════
  if (screen === "home") return (
    <div style={bg}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Noto+Sans+KR:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={orb("-80px","-80px","#00C9A7")} />
      <div style={orb("55%","65%","#4E9AF1",220)} />
      <div style={orb("35%","-60px","#A78BFA",180)} />
      {toast && <Toast {...toast} />}

      <div style={{ position:"relative", zIndex:1, maxWidth:420, margin:"0 auto", padding:"0 20px 60px" }}>

        {/* 헤더 */}
        <div style={{ paddingTop:48, textAlign:"center", marginBottom:28 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:7,
            background:"rgba(0,201,167,0.1)", border:"1px solid rgba(0,201,167,0.25)",
            borderRadius:20, padding:"5px 14px", marginBottom:18
          }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:"#00C9A7",animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:11,color:"#00C9A7",letterSpacing:1 }}>PI NETWORK 실제 연동</span>
          </div>
          <div style={{ fontSize:46,marginBottom:6 }}>👁️</div>
          <h1 style={{
            fontSize:26,fontWeight:700,margin:"0 0 6px",
            background:"linear-gradient(135deg,#fff 0%,#00C9A7 100%)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"
          }}>아이케어 파이</h1>
          <p style={{ color:"rgba(255,255,255,0.45)",fontSize:13,margin:0 }}>
            눈 건강을 지키고 PI를 받으세요
          </p>
        </div>

        {/* 로그인 / 유저 카드 */}
        {!piUser && !isPiBrowser && (
          <div style={{ ...card({ padding:20, marginBottom:18, textAlign:"center", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)" }) }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:"#ffb3b3" }}>
              Pi Browser가 아닙니다
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.6, marginBottom:14 }}>
              현재 개발 환경에서는 테스트 로그인을 사용합니다. 실제 Pi 로그인은 Pi Browser에서 가능합니다.
            </div>
            <button onClick={handleDevLogin}
              style={btn("linear-gradient(135deg,#00C9A7,#0094d4)", { fontSize:12, padding:"12px 0" })}>
              개발 환경 로그인
            </button>
          </div>
        )}
        {!piUser ? (
          <div style={{ ...card({ padding:24,marginBottom:22,textAlign:"center" }) }}>
            <p style={{ color:"rgba(255,255,255,0.55)",fontSize:13,marginBottom:18,lineHeight:1.6 }}>
              Pi 계정으로 로그인하면<br />눈 운동 완료 시 PI가 자동 지급됩니다
            </p>
            <button onClick={handlePiLogin} disabled={loading}
              style={btn("linear-gradient(135deg,#00C9A7,#0094d4)", { opacity: loading ? 0.6 : 1 })}>
              {loading ? "⏳ 로그인 중..." : "🔐 Pi 계정으로 로그인"}
            </button>
            <p style={{ fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:10 }}>
              Pi 브라우저 필요 · KYC 인증 계정
            </p>
          </div>
        ) : (
          <div style={{
            background:"linear-gradient(135deg,rgba(0,201,167,0.12),rgba(78,154,241,0.08))",
            border:"1px solid rgba(0,201,167,0.25)",
            borderRadius:18,padding:18,marginBottom:22,
            display:"flex",alignItems:"center",justifyContent:"space-between"
          }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{
                width:40,height:40,borderRadius:"50%",
                background:"linear-gradient(135deg,#00C9A7,#4E9AF1)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18
              }}>👤</div>
              <div>
                <div style={{ fontSize:13,fontWeight:600 }}>{piUser.username}</div>
                <div style={{ fontSize:10,color:"rgba(255,255,255,0.4)" }}>
                  Pi 계정 연동됨 · KYC ✓ {userStats?.isPremium ? "· Pro 🌟" : ""}
                </div>
              </div>
            </div>
            <div style={{ textAlign:"right", display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
              <div style={{ fontSize:18,fontWeight:700,color:"#00C9A7",fontFamily:"'Orbitron',monospace" }}>
                π {userStats?.totalPi?.toFixed(2) ?? "0.00"}
              </div>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.4)" }}>누적 보상</div>
              <div style={{ display:"flex",gap:8,marginTop:8 }}>
                <button onClick={refreshUserStats} style={{ border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"#fff",borderRadius:12,padding:"8px 12px",fontSize:10,cursor:"pointer" }}>
                  새로고침
                </button>
                <button onClick={handleLogout} style={{ border:"1px solid rgba(239,68,68,0.25)",background:"rgba(239,68,68,0.12)",color:"#fff",borderRadius:12,padding:"8px 12px",fontSize:10,cursor:"pointer" }}>
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 통계 */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:22 }}>
          {[
            { label:"연속 달성", value:`${userStats?.streak ?? 0}일`, icon:"🔥" },
            { label:"오늘 완료", value:`${userStats?.completedToday?.length ?? 0}/4`, icon:"✅" },
            { label:"눈 건강",   value:"양호",                                         icon:"💚" },
          ].map((s,i) => (
            <div key={i} style={{ ...card({ padding:"14px 8px",textAlign:"center" }) }}>
              <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:15,fontWeight:700 }}>{s.value}</div>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 시력 측정 배너 */}
        <div onClick={() => setScreen("vision")} style={{
          background:"linear-gradient(135deg,rgba(167,139,250,0.14),rgba(78,154,241,0.08))",
          border:"1px solid rgba(167,139,250,0.25)",
          borderRadius:18,padding:"16px 20px",marginBottom:22,
          display:"flex",alignItems:"center",gap:14,cursor:"pointer",
          transition:"all 0.2s"
        }}>
          <div style={{
            width:46,height:46,borderRadius:14,flexShrink:0,
            background:"rgba(167,139,250,0.2)",border:"1px solid rgba(167,139,250,0.3)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22
          }}>🔬</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:2}}>시력 자가 측정</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>스넬렌 · 난시 · 색각 검사 · 약 3분</div>
          </div>
          <div style={{fontSize:18,color:"rgba(255,255,255,0.3)"}}>→</div>
        </div>

        {/* 운동 목록 */}
        <h2 style={{ fontSize:15,fontWeight:600,marginBottom:14,color:"rgba(255,255,255,0.7)" }}>
          오늘의 눈 운동
        </h2>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:20 }}>
          {EYE_EXERCISES.map(ex => {
            const done = userStats?.completedToday?.includes(ex.id);
            return (
              <div key={ex.id} onClick={() => startExercise(ex)} style={{
                ...card({
                  padding:"15px 18px",
                  display:"flex",alignItems:"center",gap:12,
                  cursor: done ? "default" : "pointer",
                  opacity: done ? 0.6 : 1,
                  border: done ? "1px solid rgba(0,201,167,0.25)" : "1px solid rgba(255,255,255,0.08)",
                  background: done ? "rgba(0,201,167,0.06)" : "rgba(255,255,255,0.04)",
                  transition:"all 0.2s",
                })
              }}>
                <div style={{
                  width:44,height:44,borderRadius:13,flexShrink:0,
                  background:`${ex.color}22`,border:`1px solid ${ex.color}44`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:20
                }}>{done ? "✅" : ex.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:600,marginBottom:2 }}>{ex.title}</div>
                  <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.4 }}>{ex.desc}</div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#00C9A7",fontFamily:"'Orbitron',monospace" }}>+π{ex.reward}</div>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>{ex.duration}초</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 프리미엄 구독 */}
        {piUser && !userStats?.isPremium && (
          <div style={{
            background:"linear-gradient(135deg,rgba(167,139,250,0.12),rgba(78,154,241,0.08))",
            border:"1px solid rgba(167,139,250,0.25)",
            borderRadius:18,padding:18,textAlign:"center"
          }}>
            <div style={{ fontSize:22,marginBottom:6 }}>🌟</div>
            <div style={{ fontSize:14,fontWeight:600,marginBottom:4 }}>Pro 구독으로 업그레이드</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:14 }}>
              광고 제거 · AI 맞춤 루틴 · 상세 리포트
            </div>
            <button onClick={handleSubscribe}
              style={btn("linear-gradient(135deg,#A78BFA,#4E9AF1)", { padding:"12px 0",fontSize:13 })}>
              π 5 / 월 구독하기
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideDown { from{opacity:0;transform:translateX(-50%) translateY(-12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>
    </div>
  );

  // ════════════════════════════════════════════════
  //  EXERCISE
  // ════════════════════════════════════════════════
  if (screen === "exercise") return (
    <div style={{ ...bg, display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Noto+Sans+KR:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={orb("15%","15%",selExercise.color,400)} />
      {toast && <Toast {...toast} />}

      <div style={{ position:"relative",zIndex:1,maxWidth:420,width:"100%",padding:"0 20px",textAlign:"center" }}>
        <button onClick={() => setScreen("home")} style={{
          background:"none",border:"none",color:"rgba(255,255,255,0.45)",
          fontSize:14,cursor:"pointer",marginBottom:36,
          display:"flex",alignItems:"center",gap:6
        }}>← 뒤로</button>

        <div style={{ fontSize:60,marginBottom:14 }}>{selExercise.icon}</div>
        <h2 style={{ fontSize:22,fontWeight:700,marginBottom:8 }}>{selExercise.title}</h2>
        <p style={{ color:"rgba(255,255,255,0.45)",fontSize:13,marginBottom:44,lineHeight:1.7 }}>
          {selExercise.desc}
        </p>

        <div style={{ display:"flex",justifyContent:"center",marginBottom:44 }}>
          <CircleTimer
            duration={selExercise.duration}
            isRunning={isRunning}
            onComplete={handleExerciseDone}
          />
        </div>

        <button
          onClick={() => setIsRunning(r => !r)}
          disabled={loading}
          style={btn(
            isRunning ? "rgba(239,68,68,0.2)" : `linear-gradient(135deg,${selExercise.color},#4E9AF1)`,
            isRunning ? { border:"1px solid rgba(239,68,68,0.35)" } : {}
          )}>
          {loading ? "⏳ 보상 처리 중..." : isRunning ? "⏸ 일시정지" : "▶ 시작하기"}
        </button>

        <div style={{
          marginTop:20,padding:"10px 18px",display:"inline-flex",
          alignItems:"center",gap:8,
          background:"rgba(0,201,167,0.08)",
          border:"1px solid rgba(0,201,167,0.18)",borderRadius:10
        }}>
          <span style={{ fontSize:12,color:"rgba(255,255,255,0.5)" }}>완료 보상</span>
          <span style={{ fontSize:15,fontWeight:700,color:"#00C9A7",fontFamily:"'Orbitron',monospace" }}>
            +π {selExercise.reward}
          </span>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════
  //  COMPLETE
  // ════════════════════════════════════════════════
  if (screen === "complete") return (
    <div style={{ ...bg, display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Noto+Sans+KR:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={orb("25%","25%","#00C9A7",500)} />

      <div style={{ position:"relative",zIndex:1,maxWidth:420,width:"100%",padding:"0 20px",textAlign:"center" }}>
        <div style={{ fontSize:76,marginBottom:20,animation:"pop 0.5s ease" }}>🎉</div>
        <h2 style={{
          fontSize:24,fontWeight:700,marginBottom:6,
          background:"linear-gradient(135deg,#fff,#00C9A7)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"
        }}>운동 완료!</h2>
        <p style={{ color:"rgba(255,255,255,0.45)",fontSize:13,marginBottom:36 }}>
          {selExercise?.title} 완료 · PI 보상이 지급되었습니다
        </p>

        <div style={{
          background:"linear-gradient(135deg,rgba(0,201,167,0.14),rgba(78,154,241,0.08))",
          border:"1px solid rgba(0,201,167,0.28)",
          borderRadius:20,padding:28,marginBottom:28
        }}>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6 }}>획득한 PI</div>
          <div style={{ fontSize:46,fontWeight:700,color:"#00C9A7",fontFamily:"'Orbitron',monospace" }}>
            +π {rewardInfo?.reward ?? selExercise?.reward}
          </div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:8 }}>
            누적 합계: π {rewardInfo?.totalPi?.toFixed(2) ?? "0.00"}
          </div>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:28 }}>
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14 }}>
            <div style={{ fontSize:22,marginBottom:4 }}>🔥</div>
            <div style={{ fontSize:17,fontWeight:700 }}>{userStats?.streak ?? 0}일</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>연속 달성</div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:14 }}>
            <div style={{ fontSize:22,marginBottom:4 }}>✅</div>
            <div style={{ fontSize:17,fontWeight:700 }}>{rewardInfo?.completed?.length ?? 0}/4</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>오늘 완료</div>
          </div>
        </div>

        <button onClick={() => setScreen("home")}
          style={btn("linear-gradient(135deg,#00C9A7,#4E9AF1)")}>
          홈으로 돌아가기
        </button>
      </div>

      <style>{`@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.25)}100%{transform:scale(1)}}`}</style>
    </div>
  );

  // ════════════════════════════════════════════════
  //  VISION TEST
  // ════════════════════════════════════════════════
  if (screen === "vision") return (
    <VisionTestModule
      piUser={piUser}
      onComplete={(record) => {
        // 시력 측정 완료 시 PI 소액 보상 지급
        if (piUser && record) {
          fetch("/api/rewards/give", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid:        piUser.uid,
              exerciseId: "vision_test",
              amount:     0.3,
              memo:       "시력 측정 완료 보상",
            }),
          }).catch(() => {});
          setUserStats(prev => prev ? ({ ...prev, totalPi: +(prev.totalPi + 0.3).toFixed(2) }) : prev);
        }
        setScreen("home");
      }}
    />
  );
}
