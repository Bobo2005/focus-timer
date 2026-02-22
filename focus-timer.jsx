import { useState, useEffect, useRef, useCallback } from "react";

const MODES = {
  focus: { label: "Focus", color: "#f59e0b", glow: "#f59e0b40", bg: "#1a1200", ring: "#f59e0b" },
  short: { label: "Short Break", color: "#06b6d4", glow: "#06b6d440", bg: "#00101a", ring: "#06b6d4" },
  long: { label: "Long Break", color: "#8b5cf6", glow: "#8b5cf640", bg: "#0d0014", ring: "#8b5cf6" },
};

const SOUNDS = [
  { id: "none", label: "Silent" },
  { id: "rain", label: "Rain" },
  { id: "forest", label: "Forest" },
  { id: "waves", label: "Ocean Waves" },
  { id: "white", label: "White Noise" },
  { id: "cafe", label: "Café" },
];

function useAudioEngine() {
  const ctxRef = useRef(null);
  const nodesRef = useRef([]);

  const stop = useCallback(() => {
    nodesRef.current.forEach((n) => { try { n.stop(); } catch (_) {} });
    nodesRef.current = [];
  }, []);

  const play = useCallback((soundId) => {
    stop();
    if (soundId === "none") return;

    const ctx = ctxRef.current || (ctxRef.current = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === "suspended") ctx.resume();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);

    const makeNoise = (type = "white") => {
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === "pink") {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
        } else {
          data[i] = white;
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      return src;
    };

    const makeOsc = (freq, type = "sine", gainVal = 0.05) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(gainVal, ctx.currentTime);
      osc.connect(g);
      g.connect(master);
      osc.start();
      nodesRef.current.push(osc);
      return osc;
    };

    if (soundId === "rain") {
      const noise = makeNoise("pink");
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(0.5, ctx.currentTime);
      noise.connect(filter);
      filter.connect(master);
      noise.start();
      nodesRef.current.push(noise);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.3, ctx.currentTime);
      lfoGain.gain.setValueAtTime(300, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      nodesRef.current.push(lfo);
    } else if (soundId === "forest") {
      const noise = makeNoise("pink");
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(200, ctx.currentTime);
      noise.connect(filter);
      filter.connect(master);
      noise.start();
      nodesRef.current.push(noise);
      [523, 659, 784, 1047].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        lfo.frequency.setValueAtTime(0.1 + i * 0.07, ctx.currentTime);
        lfoG.gain.setValueAtTime(0.015, ctx.currentTime);
        g.gain.setValueAtTime(0.008, ctx.currentTime);
        lfo.connect(lfoG);
        lfoG.connect(g.gain);
        osc.connect(g);
        g.connect(master);
        osc.start();
        lfo.start();
        nodesRef.current.push(osc, lfo);
      });
    } else if (soundId === "waves") {
      const noise = makeNoise("pink");
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.12, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      noise.connect(filter);
      filter.connect(master);
      noise.start();
      lfo.start();
      nodesRef.current.push(noise, lfo);
    } else if (soundId === "white") {
      const noise = makeNoise("white");
      noise.connect(master);
      noise.start();
      nodesRef.current.push(noise);
    } else if (soundId === "cafe") {
      const noise = makeNoise("pink");
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(0.8, ctx.currentTime);
      noise.connect(filter);
      filter.connect(master);
      noise.start();
      nodesRef.current.push(noise);
      [220, 330, 440].forEach((f) => makeOsc(f, "triangle", 0.006));
    }
  }, [stop]);

  return { play, stop };
}

function CircularTimer({ progress, mode, isRunning, timeLeft }) {
  const size = 280;
  const stroke = 6;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const m = MODES[mode];

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-1000"
        style={{
          boxShadow: isRunning ? `0 0 60px 20px ${m.glow}, 0 0 120px 40px ${m.glow}33` : "none",
        }}
      />
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#ffffff08"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={m.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.8s ease" }}
        />
      </svg>
      {/* Time display */}
      <div className="flex flex-col items-center z-10">
        <div
          className="font-mono text-6xl font-bold tracking-tight tabular-nums"
          style={{
            color: m.color,
            textShadow: `0 0 30px ${m.glow}`,
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          }}
        >
          {mins}:{secs}
        </div>
        <div className="text-xs uppercase tracking-[0.3em] mt-2 font-medium" style={{ color: `${m.color}99` }}>
          {m.label}
        </div>
        {isRunning && (
          <div className="flex gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{
                  backgroundColor: m.color,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: "#ffffff06", border: "1px solid #ffffff0d" }}
    >
      <div className="text-xs uppercase tracking-widest" style={{ color: "#ffffff40" }}>{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "#ffffff30" }}>{sub}</div>}
    </div>
  );
}

export default function FocusTimer() {
  const [mode, setMode] = useState("focus");
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [activeSound, setActiveSound] = useState("none");
  const [settings, setSettings] = useState({ focus: 25, short: 5, long: 15 });
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [totalFocusToday, setTotalFocusToday] = useState(0);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSessionElapsed, setCurrentSessionElapsed] = useState(0);
  const intervalRef = useRef(null);
  const { play, stop } = useAudioEngine();

  const totalTime = settings[mode] * 60;
  const progress = (totalTime - timeLeft) / totalTime;

  const resetTimer = useCallback((m, s) => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setTimeLeft((s || settings)[m || mode] * 60);
    setCurrentSessionElapsed(0);
  }, [settings, mode]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            // Session complete
            if (mode === "focus") {
              const dur = settings.focus;
              setSessionsToday((s) => s + 1);
              setTotalFocusToday((t) => t + dur);
              setPomodoroCount((c) => c + 1);
              setSessionHistory((h) => [
                { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), duration: dur },
                ...h.slice(0, 9),
              ]);
            }
            return 0;
          }
          setCurrentSessionElapsed((e) => e + 1);
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, mode, settings]);

  const handleModeSwitch = (m) => {
    setMode(m);
    resetTimer(m);
    stop();
    setActiveSound("none");
  };

  const handleSoundToggle = (id) => {
    if (activeSound === id) {
      stop();
      setActiveSound("none");
    } else {
      play(id);
      setActiveSound(id);
    }
  };

  const handleSettingSave = (key, val) => {
    const v = Math.max(1, Math.min(99, parseInt(val) || 1));
    setSettings((s) => ({ ...s, [key]: v }));
    if (key === mode) {
      setTimeLeft(v * 60);
      setIsRunning(false);
      clearInterval(intervalRef.current);
    }
  };

  const m = MODES[mode];
  const hoursToday = Math.floor(totalFocusToday / 60);
  const minsToday = totalFocusToday % 60;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ffffff15; border-radius: 2px; }
      `}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${m.bg} 0%, #080808 70%)`,
          transition: "background 0.8s ease",
          fontFamily: "'Syne', sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full max-w-sm mb-8">
          <div>
            <div className="text-white text-lg font-bold tracking-tight">FlowState</div>
            <div className="text-xs" style={{ color: "#ffffff30" }}>Day {new Date().toLocaleDateString('en', {weekday:'long'})}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowStats(!showStats); setShowSettings(false); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: showStats ? `${m.color}20` : "#ffffff08",
                color: showStats ? m.color : "#ffffff50",
                border: `1px solid ${showStats ? m.color + "40" : "#ffffff10"}`,
              }}
            >
              Stats
            </button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowStats(false); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: showSettings ? `${m.color}20` : "#ffffff08",
                color: showSettings ? m.color : "#ffffff50",
                border: `1px solid ${showSettings ? m.color + "40" : "#ffffff10"}`,
              }}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl mb-10"
          style={{ background: "#ffffff08", border: "1px solid #ffffff08" }}
        >
          {Object.entries(MODES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => handleModeSwitch(key)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: mode === key ? val.color : "transparent",
                color: mode === key ? "#000" : "#ffffff40",
              }}
            >
              {val.label}
            </button>
          ))}
        </div>

        {/* Timer */}
        <CircularTimer progress={progress} mode={mode} isRunning={isRunning} timeLeft={timeLeft} />

        {/* Controls */}
        <div className="flex items-center gap-4 mt-10">
          <button
            onClick={() => resetTimer()}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{ background: "#ffffff08", border: "1px solid #ffffff10", color: "#ffffff40" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.77"/>
            </svg>
          </button>

          <button
            onClick={() => setIsRunning((r) => !r)}
            className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-sm transition-all"
            style={{
              background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)`,
              boxShadow: `0 0 30px ${m.glow}, 0 8px 32px rgba(0,0,0,0.4)`,
              color: "#000",
              transform: isRunning ? "scale(0.96)" : "scale(1)",
            }}
          >
            {isRunning ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          <button
            onClick={() => { setMode(m => m === "focus" ? "short" : "focus"); resetTimer(); }}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{ background: "#ffffff08", border: "1px solid #ffffff10", color: "#ffffff40" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.77"/>
            </svg>
          </button>
        </div>

        {/* Pomodoro dots */}
        <div className="flex gap-2 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i < (pomodoroCount % 4) ? m.color : "#ffffff15",
                boxShadow: i < (pomodoroCount % 4) ? `0 0 8px ${m.color}` : "none",
              }}
            />
          ))}
        </div>
        <div className="text-xs mt-2" style={{ color: "#ffffff25" }}>
          {pomodoroCount % 4 === 0 && pomodoroCount > 0 ? "Take a long break! 🎉" : `${4 - (pomodoroCount % 4)} sessions to long break`}
        </div>

        {/* Sound Panel */}
        <div className="mt-8 w-full max-w-sm">
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#ffffff25" }}>Ambient Sound</div>
          <div className="flex flex-wrap gap-2">
            {SOUNDS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSoundToggle(s.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: activeSound === s.id ? `${m.color}20` : "#ffffff06",
                  color: activeSound === s.id ? m.color : "#ffffff40",
                  border: `1px solid ${activeSound === s.id ? m.color + "50" : "#ffffff08"}`,
                }}
              >
                {s.id === "none" ? "🔇" : s.id === "rain" ? "🌧️" : s.id === "forest" ? "🌿" : s.id === "waves" ? "🌊" : s.id === "white" ? "📡" : "☕"} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Panel */}
        {showStats && (
          <div className="mt-6 w-full max-w-sm fade-in">
            <div
              className="rounded-2xl p-5"
              style={{ background: "#ffffff06", border: "1px solid #ffffff0d" }}
            >
              <div className="text-sm font-bold text-white mb-4">Today's Stats</div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatCard label="Sessions" value={sessionsToday} color={m.color} />
                <StatCard
                  label="Focus Time"
                  value={hoursToday > 0 ? `${hoursToday}h ${minsToday}m` : `${minsToday}m`}
                  color={m.color}
                />
                <StatCard label="Pomodoros" value={pomodoroCount} sub="total" color={m.color} />
              </div>
              {sessionHistory.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#ffffff25" }}>Session Log</div>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {sessionHistory.map((s, i) => (
                      <div key={i} className="flex justify-between text-xs py-1.5 px-2 rounded-lg" style={{ background: "#ffffff05" }}>
                        <span style={{ color: "#ffffff50" }}>{s.time}</span>
                        <span style={{ color: m.color }}>{s.duration} min focus</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {sessionHistory.length === 0 && (
                <div className="text-center py-4 text-xs" style={{ color: "#ffffff20" }}>
                  Complete a focus session to see your stats
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-6 w-full max-w-sm fade-in">
            <div
              className="rounded-2xl p-5"
              style={{ background: "#ffffff06", border: "1px solid #ffffff0d" }}
            >
              <div className="text-sm font-bold text-white mb-4">Custom Durations</div>
              {[
                { key: "focus", label: "Focus Session" },
                { key: "short", label: "Short Break" },
                { key: "long", label: "Long Break" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-white font-medium">{label}</div>
                    <div className="text-xs" style={{ color: "#ffffff30" }}>minutes</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSettingSave(key, settings[key] - 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all"
                      style={{ background: "#ffffff0a", color: "#ffffff50" }}
                    >
                      −
                    </button>
                    <div
                      className="w-12 text-center font-mono font-bold text-lg"
                      style={{ color: MODES[key].color, fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {settings[key]}
                    </div>
                    <button
                      onClick={() => handleSettingSave(key, settings[key] + 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all"
                      style={{ background: "#ffffff0a", color: "#ffffff50" }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-xs" style={{ color: "#ffffff15" }}>
          FlowState · Day 01 of 30
        </div>
      </div>
    </>
  );
}
