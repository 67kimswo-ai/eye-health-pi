import { useState, useEffect, useRef } from "react";

// ── 시력 측정 데이터 ──────────────────────────────────────────
const SNELLEN_ROWS = [
  { size: 72, letters: ["E"],               vision: "0.1", label: "0.1" },
  { size: 58, letters: ["F", "P"],          vision: "0.2", label: "0.2" },
  { size: 46, letters: ["T", "O", "Z"],     vision: "0.3", label: "0.3" },
  { size: 36, letters: ["L", "P", "E", "D"],vision: "0.4", label: "0.4" },
  { size: 28, letters: ["P","E","C","F","D"],vision: "0.5", label: "0.5" },
  { size: 22, letters: ["E","D","F","C","Z","P"], vision: "0.6", label: "0.6" },
  { size: 17, letters: ["F","E","L","O","P","Z","D"], vision: "0.7", label: "0.7" },
  { size: 14, letters: ["D","E","F","P","O","T","E","C"], vision: "0.8", label: "0.8" },
  { size: 11, letters: ["L","E","F","O","D","P","C","T"], vision: "0.9", label: "0.9" },
  { size: 9,  letters: ["F","D","P","L","T","C","E","O"], vision: "1.0", label: "1.0" },
  { size: 7,  letters: ["P","E","Z","O","L","C","F","T"], vision: "1.2", label: "1.2" },
  { size: 6,  letters: ["D","E","F","P","O","T","L","C"], vision: "1.5", label: "1.5" },
];

const ASTIGMATISM_LINES = [
  { angle: 0,   length: 120 },
  { angle: 30,  length: 120 },
  { angle: 60,  length: 120 },
  { angle: 90,  length: 120 },
  { angle: 120, length: 120 },
  { angle: 150, length: 120 },
];

const DIGIT_PATTERNS = {
  "7": [
    "#####",
    "....#",
    "...#.",
    "..#..",
    ".#...",
    ".#...",
    ".#..."
  ],
  "4": [
    "#...#",
    "#...#",
    "#...#",
    "#####",
    "....#",
    "....#",
    "....#"
  ],
  "8": [
    ".###.",
    "#...#",
    "#...#",
    ".###.",
    "#...#",
    "#...#",
    ".###."
  ],
  "3": [
    ".###.",
    "#...#",
    "....#",
    "..##.",
    "....#",
    "#...#",
    ".###."
  ],
};

function buildDigitDots(digit, xOffset, yOffset, color) {
  const pattern = DIGIT_PATTERNS[digit] || [];
  const dots = [];
  const spacing = 9;
  const radius = 3.6;

  pattern.forEach((row, rowIndex) => {
    row.split("").forEach((value, colIndex) => {
      if (value === "#") {
        dots.push([xOffset + colIndex * spacing, yOffset + rowIndex * spacing, radius, color]);
      }
    });
  });

  return dots;
}

function buildNumberDots(number, color) {
  const digits = String(number).split("");
  const result = [];
  const baseX = digits.length === 1 ? 30 : 12;

  digits.forEach((digit, index) => {
    const xOffset = baseX + index * 42;
    const yOffset = 22;
    result.push(...buildDigitDots(digit, xOffset, yOffset, color));
  });

  return result;
}

const COLOR_TESTS = [
  {
    id: 1,
    dots: generateIshihara(74,
      buildNumberDots("74", "#D94035"),
      "#A8D5A2",
      300
    ),
    answer: "74",
    label: "숫자가 보이시나요?",
  },
  {
    id: 2,
    dots: generateIshihara(8,
      buildNumberDots("8", "#2F73C9"),
      "#D4885A",
      220
    ),
    answer: "8",
    label: "숫자가 보이시나요?",
  },
];

function generateIshihara(number, numberDots, bgColor, seed) {
  const allDots = [];
  const rng = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
  for (let i = 0; i < 280; i++) {
    allDots.push({
      x: rng(seed + i * 3.1) * 96 + 2,
      y: rng(seed + i * 7.3) * 96 + 2,
      r: rng(seed + i * 2.7) * 3 + 2.5,
      color: bgColor,
    });
  }
  numberDots.forEach((d, i) => allDots.push({ x: d[0], y: d[1], r: d[2], color: d[3] }));
  return allDots;
}

// ── 결과 등급 ───────────────────────────────────────────────
function getVisionGrade(v) {
  const n = parseFloat(v);
  if (n >= 1.2) return { label: "최상", color: "#00C9A7", emoji: "🌟" };
  if (n >= 0.8) return { label: "정상", color: "#4E9AF1", emoji: "✅" };
  if (n >= 0.5) return { label: "약시 주의", color: "#F59E0B", emoji: "⚠️" };
  return { label: "안과 방문 권장", color: "#EF4444", emoji: "🏥" };
}

// ── 메인 컴포넌트 ───────────────────────────────────────────
export default function VisionTestModule({ onComplete, piUser }) {
  const [step, setStep]         = useState("intro");    // intro|distance|snellen|astigmatism|color|result
  const [eye, setEye]           = useState("right");    // right|left
  const [rowIdx, setRowIdx]     = useState(0);
  const [lastPassed, setLastPassed] = useState(0);
  const [results, setResults]   = useState({ right: null, left: null });
  const [astigResult, setAstigResult] = useState(null);
  const [colorIdx, setColorIdx] = useState(0);
  const [colorResults, setColorResults] = useState([]);
  const [history, setHistory]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("visionHistory") || "[]"); } catch { return []; }
  });
  const [distanceOk, setDistanceOk] = useState(false);
  const timerRef = useRef();

  // 거리 확인 타이머
  useEffect(() => {
    if (step === "distance") {
      let t = 3;
      timerRef.current = setInterval(() => {
        t--;
        if (t <= 0) { clearInterval(timerRef.current); setDistanceOk(true); }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step]);

  const startSnellen = (eyeSide) => {
    setEye(eyeSide);
    setRowIdx(0);
    setLastPassed(0);
    setStep("snellen");
  };

  const handleSnellenAnswer = (passed) => {
    if (passed) {
      setLastPassed(rowIdx);
      if (rowIdx < SNELLEN_ROWS.length - 1) {
        setRowIdx(r => r + 1);
      } else {
        finishSnellen(rowIdx);
      }
    } else {
      finishSnellen(lastPassed);
    }
  };

  const finishSnellen = (finalIdx) => {
    const vision = SNELLEN_ROWS[finalIdx].vision;
    setResults(prev => ({ ...prev, [eye]: vision }));
    if (eye === "right") {
      startSnellen("left");
    } else {
      setStep("astigmatism");
    }
  };

  const handleAstig = (result) => {
    setAstigResult(result);
    setColorIdx(0);
    setColorResults([]);
    setStep("color");
  };

  const handleColor = (correct) => {
    const updated = [...colorResults, correct];
    setColorResults(updated);
    if (colorIdx < COLOR_TESTS.length - 1) {
      setColorIdx(i => i + 1);
    } else {
      saveAndFinish(updated);
    }
  };

  const saveAndFinish = (colorRes) => {
    const record = {
      date:      new Date().toLocaleDateString("ko-KR"),
      time:      new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      right:     results.right,
      left:      results.left,
      astig:     astigResult,
      colorPass: colorRes.every(Boolean),
    };
    const updated = [record, ...history].slice(0, 10);
    setHistory(updated);
    try { localStorage.setItem("visionHistory", JSON.stringify(updated)); } catch {}
    setStep("result");
    if (onComplete) onComplete(record);
  };

  // ── 공통 스타일 ─────────────────────────────────────────
  const bg = {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#060d18 0%,#0b1829 60%,#071220 100%)",
    fontFamily: "'Noto Sans KR',sans-serif",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
  };
  const panel = (extra={}) => ({
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    ...extra,
  });
  const primaryBtn = (extra={}) => ({
    padding: "14px 32px", border: "none", borderRadius: 14,
    background: "linear-gradient(135deg,#00C9A7,#0094d4)",
    color: "#fff", fontSize: 15, fontWeight: 700,
    cursor: "pointer", transition: "opacity 0.2s", ...extra,
  });
  const outlineBtn = (extra={}) => ({
    padding: "12px 24px", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent", color: "rgba(255,255,255,0.7)",
    fontSize: 14, cursor: "pointer", ...extra,
  });

  const orb = (t,l,c,s=280) => (
    <div style={{
      position:"fixed",top:t,left:l,width:s,height:s,borderRadius:"50%",
      background:`radial-gradient(circle,${c}15 0%,transparent 70%)`,
      pointerEvents:"none",zIndex:0
    }}/>
  );

  const wrap = (content) => (
    <div style={bg}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet"/>
      {orb("-60px","-60px","#00C9A7")}
      {orb("60%","70%","#4E9AF1",200)}
      {orb("30%","-40px","#A78BFA",160)}
      <div style={{ position:"relative",zIndex:1,maxWidth:480,margin:"0 auto",padding:"0 20px 60px" }}>
        {content}
      </div>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse2{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp 0.4s ease both}
      `}</style>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  INTRO
  // ════════════════════════════════════════════════════════
  if (step === "intro") return wrap(
    <div style={{ paddingTop:50,textAlign:"center" }}>
      <div style={{
        display:"inline-flex",alignItems:"center",gap:8,
        background:"rgba(0,201,167,0.1)",border:"1px solid rgba(0,201,167,0.25)",
        borderRadius:20,padding:"5px 16px",marginBottom:24
      }}>
        <div style={{width:7,height:7,borderRadius:"50%",background:"#00C9A7",animation:"pulse2 2s infinite"}}/>
        <span style={{fontSize:11,color:"#00C9A7",letterSpacing:1}}>AI 시력 측정 모듈</span>
      </div>

      <div style={{fontSize:56,marginBottom:12}}>🔬</div>
      <h1 style={{
        fontSize:26,fontWeight:700,margin:"0 0 10px",
        background:"linear-gradient(135deg,#fff 0%,#00C9A7 100%)",
        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"
      }}>시력 자가 측정</h1>
      <p style={{color:"rgba(255,255,255,0.45)",fontSize:13,lineHeight:1.8,marginBottom:36}}>
        스넬렌 시력표 · 난시 검사 · 색각 검사<br/>
        약 3~5분 소요 · 결과는 기기에 저장됩니다
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:32}}>
        {[
          {icon:"👁️",label:"시력 측정",desc:"스넬렌 시력표"},
          {icon:"🎯",label:"난시 검사",desc:"방사선 패턴"},
          {icon:"🌈",label:"색각 검사",desc:"이시하라 도표"},
        ].map((c,i)=>(
          <div key={i} style={{...panel({padding:"16px 10px",textAlign:"center"})}}>
            <div style={{fontSize:26,marginBottom:6}}>{c.icon}</div>
            <div style={{fontSize:12,fontWeight:600,marginBottom:3}}>{c.label}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{...panel({padding:16,marginBottom:28,textAlign:"left"})}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.9}}>
          ⚠️ <strong style={{color:"rgba(255,255,255,0.7)"}}>주의사항</strong><br/>
          • 화면에서 <strong>40~50cm</strong> 거리를 유지하세요<br/>
          • 밝은 곳에서 측정하세요<br/>
          • 안경·렌즈 착용 상태로 측정 가능합니다<br/>
          • 이 결과는 참고용이며 의학적 진단이 아닙니다
        </div>
      </div>

      {history.length > 0 && (
        <div style={{...panel({padding:16,marginBottom:24})}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:10}}>📊 최근 측정 기록</div>
          {history.slice(0,3).map((h,i)=>(
            <div key={i} style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"8px 0",
              borderBottom: i<2 && i<history.slice(0,3).length-1 ? "1px solid rgba(255,255,255,0.06)" : "none"
            }}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{h.date} {h.time}</span>
              <div style={{display:"flex",gap:12}}>
                <span style={{fontSize:12,color:"#4E9AF1"}}>우 {h.right}</span>
                <span style={{fontSize:12,color:"#00C9A7"}}>좌 {h.left}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setStep("distance")} style={{...primaryBtn({width:"100%",padding:"16px 0",fontSize:16})}}>
        측정 시작하기 →
      </button>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  DISTANCE CHECK
  // ════════════════════════════════════════════════════════
  if (step === "distance") return wrap(
    <div style={{paddingTop:60,textAlign:"center"}}>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>측정 거리 확인</h2>
      <p style={{color:"rgba(255,255,255,0.45)",fontSize:13,marginBottom:48}}>
        화면에서 40~50cm 거리를 유지해 주세요
      </p>

      <div style={{
        width:160,height:160,margin:"0 auto 40px",
        borderRadius:"50%",position:"relative",
        display:"flex",alignItems:"center",justifyContent:"center"
      }}>
        <div style={{
          position:"absolute",inset:0,borderRadius:"50%",
          border:"3px solid rgba(0,201,167,0.2)",
          animation: distanceOk ? "none" : "spin 3s linear infinite"
        }}/>
        <div style={{
          position:"absolute",inset:8,borderRadius:"50%",
          border:"2px solid rgba(0,201,167,0.4)",
        }}/>
        <div style={{
          fontSize:56,
          animation: distanceOk ? "none" : "pulse2 1.5s infinite"
        }}>
          {distanceOk ? "✅" : "📏"}
        </div>
      </div>

      {!distanceOk ? (
        <div style={{color:"rgba(255,255,255,0.5)",fontSize:14}}>
          거리를 조정하는 중...
        </div>
      ) : (
        <div className="fade-up">
          <div style={{
            display:"inline-block",
            background:"rgba(0,201,167,0.1)",border:"1px solid rgba(0,201,167,0.3)",
            borderRadius:12,padding:"8px 20px",marginBottom:32,
            fontSize:13,color:"#00C9A7"
          }}>
            준비 완료! 측정을 시작합니다
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center"}}>
            <button onClick={() => startSnellen("right")}
              style={primaryBtn({fontSize:15,padding:"14px 28px"})}>
              우안부터 시작 →
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  SNELLEN TEST
  // ════════════════════════════════════════════════════════
  if (step === "snellen") {
    const row = SNELLEN_ROWS[rowIdx];
    const eyeLabel = eye === "right" ? "우안 (오른쪽 눈)" : "좌안 (왼쪽 눈)";
    const eyeColor = eye === "right" ? "#4E9AF1" : "#00C9A7";
    const progress = (rowIdx / SNELLEN_ROWS.length) * 100;

    return wrap(
      <div style={{paddingTop:40}}>
        {/* 진행 */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
            <span style={{color:eyeColor,fontWeight:600}}>{eyeLabel}</span>
            <span style={{color:"rgba(255,255,255,0.4)"}}>시력 {row.label}</span>
          </div>
          <div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:4}}>
            <div style={{
              height:"100%",background:`linear-gradient(90deg,${eyeColor},#00C9A7)`,
              borderRadius:4,width:`${progress}%`,transition:"width 0.4s ease"
            }}/>
          </div>
        </div>

        {/* 한 쪽 눈 가리기 안내 */}
        <div style={{
          ...panel({padding:"10px 16px",marginBottom:20,
          display:"flex",alignItems:"center",gap:10})
        }}>
          <span style={{fontSize:20}}>{eye==="right"?"🫲":"🫱"}</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>
            {eye==="right" ? "왼쪽 눈을 가리고" : "오른쪽 눈을 가리고"} 오른쪽 눈으로 읽으세요
          </span>
        </div>

        {/* 시력표 */}
        <div style={{
          ...panel({
            padding:"32px 20px",marginBottom:24,textAlign:"center",
            minHeight:180,display:"flex",alignItems:"center",justifyContent:"center",
            background:"rgba(255,255,255,0.02)"
          })
        }}>
          <div style={{
            fontFamily:"'Courier New',monospace",
            fontSize: Math.min(row.size, 68),
            fontWeight:700,letterSpacing:8,
            color:"#fff",
            textShadow:`0 0 30px ${eyeColor}40`,
            lineHeight:1.2,
            wordBreak:"break-all",maxWidth:"100%"
          }}>
            {row.letters.join("  ")}
          </div>
        </div>

        <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:24}}>
          위 글자가 잘 보이시나요?
        </p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <button onClick={() => handleSnellenAnswer(true)}
            style={{
              padding:"15px 0",border:"none",borderRadius:14,
              background:"linear-gradient(135deg,#00C9A7,#0094d4)",
              color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"
            }}>
            ✅ 잘 보여요
          </button>
          <button onClick={() => handleSnellenAnswer(false)}
            style={{
              padding:"15px 0",border:"1px solid rgba(239,68,68,0.4)",borderRadius:14,
              background:"rgba(239,68,68,0.1)",
              color:"rgba(255,255,255,0.8)",fontSize:15,fontWeight:700,cursor:"pointer"
            }}>
            ❌ 안 보여요
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  //  ASTIGMATISM TEST
  // ════════════════════════════════════════════════════════
  if (step === "astigmatism") return wrap(
    <div style={{paddingTop:40}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:11,color:"#F59E0B",letterSpacing:1,marginBottom:8}}>2단계 · 난시 검사</div>
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>방사선 패턴 검사</h2>
        <p style={{color:"rgba(255,255,255,0.45)",fontSize:12,lineHeight:1.7}}>
          아래 선들이 <strong style={{color:"#fff"}}>모두 같은 진하기</strong>로 보이면 정상입니다<br/>
          일부 선이 더 진하거나 흐리게 보이면 난시 의심
        </p>
      </div>

      {/* 방사선 패턴 */}
      <div style={{
        ...panel({padding:32,marginBottom:28,textAlign:"center",
        display:"flex",alignItems:"center",justifyContent:"center"})
      }}>
        <svg width="200" height="200" viewBox="-110 -110 220 220">
          {ASTIGMATISM_LINES.map((line, i) => {
            const rad = (line.angle * Math.PI) / 180;
            const x1 = Math.cos(rad) * 100;
            const y1 = Math.sin(rad) * 100;
            return (
              <line key={i}
                x1={-x1} y1={-y1} x2={x1} y2={y1}
                stroke="rgba(255,255,255,0.9)" strokeWidth="2"
              />
            );
          })}
          <circle cx="0" cy="0" r="3" fill="#00C9A7"/>
          <circle cx="0" cy="0" r="80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        </svg>
      </div>

      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:20}}>
        선들이 모두 균일하게 보이나요?
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <button onClick={() => handleAstig("정상")} style={{
          padding:"15px 0",border:"none",borderRadius:14,
          background:"linear-gradient(135deg,#00C9A7,#0094d4)",
          color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"
        }}>✅ 모두 균일해요</button>
        <button onClick={() => handleAstig("난시 의심")} style={{
          padding:"15px 0",border:"1px solid rgba(245,158,11,0.4)",borderRadius:14,
          background:"rgba(245,158,11,0.1)",
          color:"rgba(255,255,255,0.8)",fontSize:14,fontWeight:700,cursor:"pointer"
        }}>⚠️ 일부가 달라요</button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  COLOR TEST
  // ════════════════════════════════════════════════════════
  if (step === "color") {
    const test = COLOR_TESTS[colorIdx];
    return wrap(
      <div style={{paddingTop:40}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:11,color:"#A78BFA",letterSpacing:1,marginBottom:8}}>
            3단계 · 색각 검사 ({colorIdx+1}/{COLOR_TESTS.length})
          </div>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>이시하라 색각 검사</h2>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:12}}>{test.label}</p>
        </div>

        {/* 이시하라 도표 */}
        <div style={{
          ...panel({
            marginBottom:24,overflow:"hidden",
            display:"flex",alignItems:"center",justifyContent:"center",
            padding:20
          })
        }}>
          <div style={{
            width:200,height:200,borderRadius:"50%",
            overflow:"hidden",position:"relative",
            background:"#2a2a2a"
          }}>
            <svg width="200" height="200" viewBox="0 0 100 100">
              {test.dots.map((d,i) => (
                <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity="0.92"/>
              ))}
            </svg>
          </div>
        </div>

        <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:20}}>
          원 안에서 숫자가 보이시나요?
        </p>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {["안 보여요", test.answer, test.answer === "74" ? "7" : "3", "다른 숫자"].slice(0,4).map((opt,i) => (
            <button key={i}
              onClick={() => handleColor(opt === test.answer)}
              style={{
                padding:"13px 0",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,
                background:"rgba(255,255,255,0.04)",
                color:"rgba(255,255,255,0.8)",fontSize:14,cursor:"pointer",
                transition:"all 0.2s",
                fontWeight: opt === test.answer ? 600 : 400,
              }}>
              {opt === "안 보여요" ? "👁️‍🗨️ 안 보여요" : `🔢 ${opt}`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  //  RESULT
  // ════════════════════════════════════════════════════════
  if (step === "result") {
    const rightGrade = getVisionGrade(results.right || "0");
    const leftGrade  = getVisionGrade(results.left  || "0");
    const colorPass  = colorResults.every(Boolean);

    return wrap(
      <div style={{paddingTop:40}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:10,animation:"fadeUp 0.5s ease"}}>📋</div>
          <h2 style={{
            fontSize:24,fontWeight:700,marginBottom:6,
            background:"linear-gradient(135deg,#fff,#00C9A7)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"
          }}>측정 완료!</h2>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>
            {new Date().toLocaleDateString("ko-KR")} 측정 결과
          </p>
        </div>

        {/* 시력 결과 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          {[
            {label:"우안 (오른쪽)", value:results.right, grade:rightGrade, color:"#4E9AF1"},
            {label:"좌안 (왼쪽)",   value:results.left,  grade:leftGrade,  color:"#00C9A7"},
          ].map((eye,i)=>(
            <div key={i} style={{
              background:`linear-gradient(135deg,${eye.color}12,${eye.color}06)`,
              border:`1px solid ${eye.color}30`,
              borderRadius:18,padding:"20px 14px",textAlign:"center"
            }}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:6}}>{eye.label}</div>
              <div style={{
                fontSize:36,fontWeight:700,color:eye.color,
                fontFamily:"'Orbitron',monospace",marginBottom:4
              }}>{eye.value}</div>
              <div style={{
                display:"inline-flex",alignItems:"center",gap:4,
                background:`${eye.grade.color}20`,border:`1px solid ${eye.grade.color}30`,
                borderRadius:8,padding:"3px 10px",
                fontSize:11,color:eye.grade.color
              }}>
                {eye.grade.emoji} {eye.grade.label}
              </div>
            </div>
          ))}
        </div>

        {/* 난시·색각 결과 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <div style={{...panel({padding:"14px",textAlign:"center"})}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:6}}>난시 검사</div>
            <div style={{fontSize:20,marginBottom:4}}>{astigResult==="정상"?"✅":"⚠️"}</div>
            <div style={{
              fontSize:13,fontWeight:600,
              color: astigResult==="정상" ? "#00C9A7" : "#F59E0B"
            }}>{astigResult}</div>
          </div>
          <div style={{...panel({padding:"14px",textAlign:"center"})}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:6}}>색각 검사</div>
            <div style={{fontSize:20,marginBottom:4}}>{colorPass?"✅":"⚠️"}</div>
            <div style={{
              fontSize:13,fontWeight:600,
              color: colorPass ? "#00C9A7" : "#F59E0B"
            }}>{colorPass?"정상":"이상 의심"}</div>
          </div>
        </div>

        {/* 권고사항 */}
        <div style={{...panel({padding:16,marginBottom:20})}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:"rgba(255,255,255,0.7)"}}>
            💡 권고사항
          </div>
          {[
            parseFloat(results.right)<0.5 || parseFloat(results.left)<0.5
              ? "시력이 낮습니다. 안과 방문을 권장합니다."
              : "시력이 양호합니다. 꾸준한 눈 운동을 유지하세요.",
            astigResult === "난시 의심"
              ? "난시 증상이 의심됩니다. 안과에서 정밀 검사를 받아보세요."
              : null,
            !colorPass ? "색각 이상이 의심됩니다. 전문의 상담을 권장합니다." : null,
          ].filter(Boolean).map((msg,i) => (
            <div key={i} style={{
              fontSize:12,color:"rgba(255,255,255,0.5)",
              padding:"6px 0",
              borderBottom: i<1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              lineHeight:1.6
            }}>• {msg}</div>
          ))}
          <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:10}}>
            ※ 본 결과는 참고용이며 의학적 진단이 아닙니다
          </div>
        </div>

        {/* 기록 */}
        {history.length > 1 && (
          <div style={{...panel({padding:16,marginBottom:20})}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:12}}>📈 시력 변화 추이</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {history.slice(0,5).map((h,i)=>(
                <div key={i} style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"6px 0",
                  borderBottom: i<Math.min(4,history.length-1) ? "1px solid rgba(255,255,255,0.05)" : "none"
                }}>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{h.date}</span>
                  <div style={{display:"flex",gap:16}}>
                    <span style={{fontSize:12,color:"#4E9AF1",fontFamily:"'Orbitron',monospace"}}>우 {h.right}</span>
                    <span style={{fontSize:12,color:"#00C9A7",fontFamily:"'Orbitron',monospace"}}>좌 {h.left}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <button onClick={() => setStep("intro")} style={{
            padding:"14px 0",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,
            background:"transparent",color:"rgba(255,255,255,0.7)",fontSize:13,
            fontWeight:600,cursor:"pointer"
          }}>🔄 다시 측정</button>
          <button onClick={() => onComplete && onComplete(history[0])} style={{
            ...primaryBtn({padding:"14px 0",fontSize:13})
          }}>홈으로 →</button>
        </div>
      </div>
    );
  }

  return null;
}
