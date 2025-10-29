:root{
  --panel-bg: rgba(12,14,22,0.72);
  --glass: rgba(255,255,255,0.04);
  --accent: #6df0ff;
  --radius: 12px;
  --font: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
}
*{box-sizing:border-box}
html,body{height:100%;margin:0;background:#000;color:#eaf6ff;font-family:var(--font);-webkit-font-smoothing:antialiased}
#bgCanvas{position:fixed;inset:0;z-index:0;display:block}

/* orb layer (DOM orbs) */
#orbLayer{position:fixed;inset:0;z-index:6;pointer-events:none}

/* base orb style (overridden per-orb) */
.orb {
  position:absolute;
  pointer-events:auto;
  border-radius:50%;
  width:128px;
  height:128px;
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:700;text-align:center;
  box-shadow:0 22px 60px rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  transition: transform .22s ease, box-shadow .22s ease;
  cursor:pointer;
  user-select:none;
}
.orb .label { z-index:2; position:relative; font-size:13px; text-shadow:0 3px 14px rgba(0,0,0,0.7) }

/* glass highlight */
.orb .glass {
  position:absolute; inset:10%; border-radius:50%;
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.72), rgba(255,255,255,0.06) 28%, transparent 55%);
  mix-blend-mode:screen; pointer-events:none;
}

/* wisps: two pseudo elements rotate with CSS animation */
.orb::before, .orb::after {
  content:"";
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  border-radius:50%;
  pointer-events:none; mix-blend-mode:screen;
}
.orb::before {
  width:240px; height:240px; filter:blur(22px); opacity:0.18; animation:spinSlow 16s linear infinite;
}
.orb::after {
  width:320px; height:320px; filter:blur(40px); opacity:0.08; animation:spinReverse 26s linear infinite;
}
@keyframes spinSlow { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
@keyframes spinReverse { from{transform:translate(-50%,-50%) rotate(360deg)} to{transform:translate(-50%,-50%) rotate(0deg)} }

/* hover */
.orb:hover{ transform:scale(1.06) translateY(-6px); box-shadow: 0 32px 90px rgba(0,0,0,0.65) }

/* left panel */
.panel { position:fixed; z-index:20; background:var(--panel-bg); padding:12px; border-radius:var(--radius); border:1px solid rgba(255,255,255,0.03); width:320px; }
#leftUI { left:18px; top:18px; }
#leftContent.hidden { display:none; }
.smallBtn { background:transparent; color:#eaf6ff; border:1px solid rgba(255,255,255,0.04); padding:8px 10px; border-radius:10px; cursor:pointer; }
.smallBtn:hover{ background: rgba(255,255,255,0.02) }

/* right panel (playlist) */
#rightUI { right:18px; top:18px; z-index:20; width:320px; }
#playlistInput{width:100%; padding:8px; border-radius:8px; border:none; background:rgba(255,255,255,0.03); color:#fff}
#embedWrap iframe{width:100%; height:92px; border-radius:8px; border:none}

/* legend */
#legend { right:18px; bottom:18px; position:fixed; z-index:20; width:240px; padding:10px; border-radius:12px; text-align:left; }
.genreTag { display:inline-block; padding:6px 10px; border-radius:999px; margin:6px 6px 0 0; font-weight:700; color:#000; }

/* top list rows */
.topList .row { display:flex; justify-content:space-between; padding:8px 4px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:14px; }

/* modal */
.modal{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:80; background:linear-gradient(180deg, rgba(0,0,0,0.36), rgba(0,0,0,0.6)); }
.modal.hidden{ display:none }
.modalCard { width:420px; background: rgba(8,10,14,0.96); padding:18px; border-radius:12px; border:1px solid rgba(255,255,255,0.04); position:relative }
.modalX { position:absolute; right:10px; top:8px; background:transparent; border:none; color:#dfefff; font-size:18px; cursor:pointer }
.modalCard input { width:100%; padding:10px; border-radius:10px; border:none; margin-top:8px; background:rgba(255,255,255,0.03); color:#fff }

/* primary button */
.primaryBtn { background:#19b56a; border:none; padding:8px 12px; border-radius:8px; color:white; cursor:pointer }

/* small responsive */
@media (max-width:760px){
  #leftUI, #rightUI { width:88vw; left:6vw; right:6vw }
  .modalCard { width:92vw }
  #legend { display:none }
}
