import { useState, useEffect, useRef, useCallback } from "react";

const MODES = {
  focus: { label: "Focus", color: "#FF6B35", dim: "#FF6B3520", track: "#FF6B3515", text: "#FF6B35" },
  short: { label: "Short Break", color: "#00D9A3", dim: "#00D9A320", track: "#00D9A315", text: "#00D9A3" },
  long:  { label: "Long Break",  color: "#9B8BFF", dim: "#9B8BFF20", track: "#9B8BFF15", text: "#9B8BFF" },
};

const SOUNDS = [
  { id: "none",   label: "Silent",      icon: "○" },
  { id: "rain",   label: "Rain",        icon: "⌁" },
  { id: "forest", label: "Forest",      icon: "⋇" },
  { id: "waves",  label: "Waves",       icon: "∿" },
  { id: "white",  label: "White Noise", icon: "≋" },
  { id: "cafe",   label: "Café",        icon: "◎" },
];

function useAudio() {
  const ctx = useRef(null);
  const nodes = useRef([]);
  const stop = useCallback(() => {
    nodes.current.forEach(n => { try { n.stop(); } catch(_){} });
    nodes.current = [];
  }, []);
  const play = useCallback((id) => {
    stop();
    if (id === "none") return;
    const ac = ctx.current || (ctx.current = new (window.AudioContext || window.webkitAudioContext)());
    if (ac.state === "suspended") ac.resume();
    const master = ac.createGain();
    master.gain.value = 0.15;
    master.connect(ac.destination);
    const mkNoise = (type) => {
      const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
      const d = buf.getChannelData(0);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
      for (let i=0;i<d.length;i++) {
        const w = Math.random()*2-1;
        if (type==="pink") { b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898; d[i]=(b0+b1+b2+b3+b4+b5+w*.5362)*.11; }
        else d[i]=w;
      }
      const s = ac.createBufferSource(); s.buffer=buf; s.loop=true; return s;
    };
    const mkOsc = (f,type="sine",g=0.05) => {
      const o=ac.createOscillator(),gn=ac.createGain();
      o.type=type; o.frequency.value=f; gn.gain.value=g;
      o.connect(gn); gn.connect(master); o.start();
      nodes.current.push(o); return o;
    };
    if (id==="rain") {
      const n=mkNoise("pink"),f=ac.createBiquadFilter();
      f.type="bandpass"; f.frequency.value=800; f.Q.value=0.5;
      n.connect(f); f.connect(master); n.start(); nodes.current.push(n);
      const lfo=ac.createOscillator(),lg=ac.createGain();
      lfo.frequency.value=0.3; lg.gain.value=300;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start(); nodes.current.push(lfo);
    } else if (id==="forest") {
      const n=mkNoise("pink"),f=ac.createBiquadFilter();
      f.type="highpass"; f.frequency.value=200;
      n.connect(f); f.connect(master); n.start(); nodes.current.push(n);
      [523,659,784,1047].forEach(fr=>mkOsc(fr,"sine",0.006));
    } else if (id==="waves") {
      const n=mkNoise("pink"),f=ac.createBiquadFilter();
      f.type="lowpass"; f.frequency.value=600;
      const lfo=ac.createOscillator(),lg=ac.createGain();
      lfo.frequency.value=0.12; lg.gain.value=0.12;
      lfo.connect(lg); lg.connect(master.gain);
      n.connect(f); f.connect(master); n.start(); lfo.start();
      nodes.current.push(n,lfo);
    } else if (id==="white") {
      const n=mkNoise("white"); n.connect(master); n.start(); nodes.current.push(n);
    } else if (id==="cafe") {
      const n=mkNoise("pink"),f=ac.createBiquadFilter();
      f.type="bandpass"; f.frequency.value=1200; f.Q.value=0.8;
      n.connect(f); f.connect(master); n.start(); nodes.current.push(n);
      [220,330].forEach(fr=>mkOsc(fr,"triangle",0.004));
    }
  }, [stop]);
  return { play, stop };
}

export default function FocusTimer() {
  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [panel, setPanel] = useState(null);
  const [sound, setSound] = useState("none");
  const [settings, setSettings] = useState({ focus: 25, short: 5, long: 15 });
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [sessions, setSessions] = useState(0);
  const [totalMins, setTotalMins] = useState(0);
  const [pomCount, setPomCount] = useState(0);
  const [log, setLog] = useState([]);
  const intervalRef = useRef(null);
  const { play, stop } = useAudio();
  const m = MODES[mode];
  const total = settings[mode] * 60;
  const progress = (total - timeLeft) / total;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2,"0");
  const secs = String(timeLeft % 60).padStart(2,"0");
  const SIZE = 300, SW = 8, R = (SIZE - SW*2)/2;
  const CIRC = 2*Math.PI*R;

  const reset = useCallback((nm, ns) => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setTimeLeft(((ns||settings)[nm||mode]) * 60);
  }, [settings, mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (mode==="focus") {
              setSessions(s=>s+1);
              setTotalMins(t=>t+settings.focus);
              setPomCount(c=>c+1);
              setLog(l=>[{time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),dur:settings.focus},...l.slice(0,9)]);
            }
            return 0;
          }
          return t-1;
        });
      }, 1000);
    } else clearInterval(intervalRef.current);
    return ()=>clearInterval(intervalRef.current);
  }, [running, mode, settings]);

  const switchMode = (nm) => { setMode(nm); reset(nm); stop(); setSound("none"); };
  const toggleSound = (id) => { if(sound===id){stop();setSound("none");}else{play(id);setSound(id);} };
  const adjSetting = (key,delta) => {
    const v=Math.max(1,Math.min(99,settings[key]+delta));
    setSettings(s=>({...s,[key]:v}));
    if(key===mode){setTimeLeft(v*60);setRunning(false);clearInterval(intervalRef.current);}
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; background: #080808; }
        button { font-family: inherit; cursor: pointer; }
        button:active { transform: scale(0.96); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #ffffff15; border-radius: 2px; }
        @keyframes breathe { 0%,100%{opacity:0.4;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .panel-enter { animation: fadeSlide 0.25s ease forwards; }
      `}</style>

      <div style={{
        minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        background:`radial-gradient(ellipse at 50% 0%, ${m.dim} 0%, #080808 55%)`,
        fontFamily:"'DM Sans', system-ui, sans-serif",
        padding:"32px 20px", transition:"background 0.8s ease",
      }}>
        <div style={{ width:"100%", maxWidth:"420px", display:"flex", flexDirection:"column", alignItems:"center" }}>

          {/* Header */}
          <div style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"36px" }}>
            <div>
              <div style={{ fontSize:"20px", fontWeight:"800", color:"#fff", letterSpacing:"-0.5px" }}>FlowState</div>
              <div style={{ fontSize:"11px", color:"#ffffff28", letterSpacing:"2px", textTransform:"uppercase", marginTop:"2px" }}>
                {new Date().toLocaleDateString('en',{weekday:'long', month:'short', day:'numeric'})}
              </div>
            </div>
            <div style={{ display:"flex", gap:"8px" }}>
              {["stats","settings"].map(p=>(
                <button key={p} onClick={()=>setPanel(prev=>prev===p?null:p)} style={{
                  padding:"8px 18px", borderRadius:"12px",
                  border:`1px solid ${panel===p?"#ffffff20":"#ffffff0d"}`,
                  background:panel===p?"#ffffff10":"transparent",
                  color:panel===p?"#ffffff80":"#ffffff30",
                  fontSize:"12px", fontWeight:"700", letterSpacing:"0.5px",
                  textTransform:"capitalize", transition:"all 0.2s",
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Tabs */}
          <div style={{
            display:"flex", gap:"2px", background:"#ffffff07",
            borderRadius:"18px", padding:"4px", marginBottom:"48px",
            border:"1px solid #ffffff08", width:"100%",
          }}>
            {Object.entries(MODES).map(([k,v])=>(
              <button key={k} onClick={()=>switchMode(k)} style={{
                flex:1, padding:"10px 8px", borderRadius:"14px", border:"none",
                background:mode===k?v.color:"transparent",
                color:mode===k?"#000":"#ffffff35",
                fontSize:"12px", fontWeight:"700", transition:"all 0.25s",
                letterSpacing:"0.2px",
              }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Timer */}
          <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", width:`${SIZE}px`, height:`${SIZE}px`, marginBottom:"44px" }}>
            {/* Ambient glow */}
            <div style={{
              position:"absolute", inset:"30px", borderRadius:"50%",
              background:`radial-gradient(circle, ${m.color}25 0%, transparent 65%)`,
              transition:"all 0.8s ease",
              filter:"blur(20px)",
              opacity: running ? 1 : 0.5,
            }}/>
            {/* SVG Ring */}
            <svg width={SIZE} height={SIZE} style={{ transform:"rotate(-90deg)", position:"absolute" }}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#ffffff05" strokeWidth={SW}/>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={m.color} strokeWidth={SW}
                strokeLinecap="round" strokeDasharray={CIRC}
                strokeDashoffset={CIRC*(1-progress)}
                filter="url(#glow)"
                style={{ transition:"stroke-dashoffset 1s linear, stroke 0.8s ease" }}
              />
            </svg>
            {/* Time Text */}
            <div style={{ position:"absolute", display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{
                fontSize:"72px", fontWeight:"800", letterSpacing:"-4px",
                color:"#ffffff", lineHeight:1, fontVariantNumeric:"tabular-nums",
              }}>
                {mins}<span style={{ color:`${m.color}50` }}>:</span>{secs}
              </div>
              <div style={{ fontSize:"11px", color:`${m.color}80`, letterSpacing:"4px", textTransform:"uppercase", marginTop:"10px", fontWeight:"600" }}>
                {m.label}
              </div>
              {running && (
                <div style={{ display:"flex", gap:"6px", marginTop:"14px" }}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{
                      width:"5px", height:"5px", borderRadius:"50%", background:m.color,
                      animation:`breathe 1.4s ease ${i*0.2}s infinite`,
                    }}/>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display:"flex", alignItems:"center", gap:"20px", marginBottom:"40px" }}>
            <button onClick={()=>reset()} style={{
              width:"52px", height:"52px", borderRadius:"50%",
              border:"1px solid #ffffff0d", background:"#ffffff06",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#ffffff35", transition:"all 0.2s",
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.77"/>
              </svg>
            </button>

            <button onClick={()=>setRunning(r=>!r)} style={{
              width:"88px", height:"88px", borderRadius:"50%", border:"none",
              background:m.color, display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 0 50px ${m.color}60, 0 12px 40px rgba(0,0,0,0.6)`,
              transform:running?"scale(0.95)":"scale(1)", transition:"all 0.2s",
            }}>
              {running
                ? <svg width="26" height="26" viewBox="0 0 24 24" fill="#000"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                : <svg width="26" height="26" viewBox="0 0 24 24" fill="#000"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              }
            </button>

            <button onClick={()=>switchMode(mode==="focus"?"short":"focus")} style={{
              width:"52px", height:"52px", borderRadius:"50%",
              border:"1px solid #ffffff0d", background:"#ffffff06",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#ffffff35", transition:"all 0.2s",
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.77"/>
              </svg>
            </button>
          </div>

          {/* Pomodoro Dots */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", marginBottom:"40px" }}>
            <div style={{ display:"flex", gap:"10px" }}>
              {Array.from({length:4}).map((_,i)=>(
                <div key={i} style={{
                  width:"10px", height:"10px", borderRadius:"50%",
                  background:i<(pomCount%4)?m.color:"#ffffff10",
                  boxShadow:i<(pomCount%4)?`0 0 12px ${m.color}`:"none",
                  transition:"all 0.4s",
                }}/>
              ))}
            </div>
            <div style={{ fontSize:"11px", color:"#ffffff20", letterSpacing:"1.5px", textTransform:"uppercase" }}>
              {pomCount%4===0&&pomCount>0 ? "Long break earned 🎉" : `${4-(pomCount%4)} sessions to long break`}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width:"100%", height:"1px", background:"linear-gradient(90deg,transparent,#ffffff0d,transparent)", marginBottom:"32px" }}/>

          {/* Ambient Sound */}
          <div style={{ width:"100%", marginBottom:"8px" }}>
            <div style={{ fontSize:"10px", color:"#ffffff20", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"14px" }}>
              Ambient Sound
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
              {SOUNDS.map(sd=>(
                <button key={sd.id} onClick={()=>toggleSound(sd.id)} style={{
                  display:"flex", alignItems:"center", gap:"7px",
                  padding:"9px 16px", borderRadius:"14px",
                  border:`1px solid ${sound===sd.id?m.color+"60":"#ffffff0a"}`,
                  background:sound===sd.id?m.dim:"#ffffff04",
                  color:sound===sd.id?m.color:"#ffffff35",
                  fontSize:"12px", fontWeight:"600", transition:"all 0.2s",
                }}>
                  <span style={{ fontSize:"15px" }}>{sd.icon}</span>
                  {sd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Panel */}
          {panel==="stats" && (
            <div className="panel-enter" style={{
              width:"100%", marginTop:"24px", background:"#0d0d0d",
              borderRadius:"24px", border:"1px solid #ffffff0d", overflow:"hidden",
            }}>
              <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #ffffff08", fontSize:"13px", fontWeight:"700", color:"#ffffff50", letterSpacing:"0.5px" }}>
                Today's Performance
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"1px", background:"#ffffff08" }}>
                {[
                  {label:"Sessions", val:sessions},
                  {label:"Focus Time", val:totalMins<60?`${totalMins}m`:`${Math.floor(totalMins/60)}h ${totalMins%60}m`},
                  {label:"Pomodoros", val:pomCount},
                ].map(({label,val})=>(
                  <div key={label} style={{ background:"#0d0d0d", padding:"20px 16px" }}>
                    <div style={{ fontSize:"26px", fontWeight:"800", color:m.color, fontVariantNumeric:"tabular-nums" }}>{val}</div>
                    <div style={{ fontSize:"10px", color:"#ffffff25", letterSpacing:"2px", textTransform:"uppercase", marginTop:"4px" }}>{label}</div>
                  </div>
                ))}
              </div>
              {log.length>0 ? (
                <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:"6px", maxHeight:"180px", overflowY:"auto" }}>
                  {log.map((l,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#ffffff04", borderRadius:"12px" }}>
                      <span style={{ fontSize:"12px", color:"#ffffff30" }}>{l.time}</span>
                      <span style={{ fontSize:"12px", color:m.color, fontWeight:"700" }}>{l.dur} min focus</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding:"28px", textAlign:"center", fontSize:"12px", color:"#ffffff20" }}>
                  Complete a session to see your log
                </div>
              )}
            </div>
          )}

          {/* Settings Panel */}
          {panel==="settings" && (
            <div className="panel-enter" style={{
              width:"100%", marginTop:"24px", background:"#0d0d0d",
              borderRadius:"24px", border:"1px solid #ffffff0d", overflow:"hidden",
            }}>
              <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #ffffff08", fontSize:"13px", fontWeight:"700", color:"#ffffff50", letterSpacing:"0.5px" }}>
                Custom Durations
              </div>
              <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"24px" }}>
                {[["focus","Focus Session"],["short","Short Break"],["long","Long Break"]].map(([key,label])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:"14px", color:"#ffffff60", fontWeight:"600" }}>{label}</div>
                      <div style={{ fontSize:"11px", color:"#ffffff25", marginTop:"2px" }}>minutes</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                      <button onClick={()=>adjSetting(key,-1)} style={{
                        width:"38px", height:"38px", borderRadius:"12px",
                        border:"1px solid #ffffff0d", background:"#ffffff06",
                        color:"#ffffff50", fontSize:"20px", lineHeight:1,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>−</button>
                      <div style={{ width:"40px", textAlign:"center", fontSize:"24px", fontWeight:"800", color:MODES[key].color, fontVariantNumeric:"tabular-nums" }}>
                        {settings[key]}
                      </div>
                      <button onClick={()=>adjSetting(key,1)} style={{
                        width:"38px", height:"38px", borderRadius:"12px",
                        border:"1px solid #ffffff0d", background:"#ffffff06",
                        color:"#ffffff50", fontSize:"20px", lineHeight:1,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop:"36px", fontSize:"11px", color:"#ffffff12", letterSpacing:"3px", textTransform:"uppercase" }}>
            FlowState · Day 01 of 30
          </div>
        </div>
      </div>
    </>
  );
}