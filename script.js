/* Deep nebula background + 2D "3D-feel" bubbles
   - 6 main orbs with strong aura + dust orbiting them
   - orbs orbit a centered circle (alternating directions)
   - anchored, orbiting prompt on click; saves to localStorage
   - playlist embed (Spotify / SoundCloud)
*/

// ---------------------- setup canvas ----------------------
const canvas = document.getElementById("bubbles");
const ctx = canvas.getContext("2d", { alpha: true });

let W = 0, H = 0, DPR = window.devicePixelRatio || 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------------------- config / colors ----------------------
const GENRES = [
  { id: "techno", label: "Hard / Techno", color: "#9b7cff" },  // deep lilac
  { id: "house",  label: "House",        color: "#60a5fa" },  // sky blue
  { id: "dnb",    label: "Drum & Bass", color: "#14b8a6" },  // teal
  { id: "dub",    label: "Dubstep",      color: "#ff6b81" }, // rose
  { id: "elect",  label: "Electronic",   color: "#fbbf24" }, // amber
  { id: "main",   label: "Mainstream",   color: "#c084fc" }   // soft purple
];

const CENTER = { x: () => W/2, y: () => H/2 };
const ORBIT_BASE = Math.min(W, H) * 0.18; // central orbit radius base
const ORB_BASE_R = Math.max(56, Math.min(W,H) * 0.09); // orb radius base
const DUST_COUNT = 140; // dust particles per orb

// ---------------------- orbs data ----------------------
const orbs = GENRES.map((g, i) => {
  const orbit = ORBIT_BASE + i * (ORB_BASE_R * 0.14);
  const r = ORB_BASE_R * (1 - i*0.04);
  return {
    genre: g,
    orbit,
    radius: r,
    angle: (i/GENRES.length) * Math.PI*2 + Math.random()*0.12,
    speed: (0.00095 + Math.random()*0.0012) * (i % 2 === 0 ? 1 : -1),
    pulsePhase: Math.random()*Math.PI*2,
    dust: new Array(DUST_COUNT).fill(0).map(()=>({
      r: (Math.random()*0.9 + 0.6) * r * (0.9 + Math.random()*0.5),
      theta: Math.random()*Math.PI*2,
      speed: (0.0005 + Math.random()*0.001) * (Math.random()<0.5?1:-1),
      size: Math.random()*1.6 + 0.4,
      alpha: 0.05 + Math.random()*0.2
    }))
  };
});

// ---------------------- helpers ----------------------
function hexToRgba(hex, a=1){
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------- nebula background (deep) ----------------------
let nebPhase = 0;
function drawNebula(time){
  nebPhase += 0.0006;
  // layered deep gradients for 3D feel
  const g1 = ctx.createLinearGradient(0, 0, W, H);
  g1.addColorStop(0, "rgba(6,4,20,1)");
  g1.addColorStop(0.45 + Math.sin(nebPhase)*0.06, "rgba(28,6,60,0.94)");
  g1.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = g1;
  ctx.fillRect(0,0,W,H);

  // faint moving cloud bands (soft)
  ctx.globalCompositeOperation = "lighter";
  for(let i=0;i<3;i++){
    const off = Math.sin(time*0.0003 + i*1.2) * (W*0.08);
    const rg = ctx.createRadialGradient(CENTER.x()+off, CENTER.y()*0.7, 100, CENTER.x()+off*1.2, CENTER.y()*1.2, Math.max(W,H)*0.8);
    const alpha = 0.03 + i*0.02;
    if(i===0) rg.addColorStop(0, "rgba(150,30,200," + (alpha+0.02) + ")");
    else if(i===1) rg.addColorStop(0, "rgba(40,120,255," + (alpha+0.02) + ")");
    else rg.addColorStop(0, "rgba(255,180,60," + (alpha) + ")");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(CENTER.x(), CENTER.y(), Math.max(W,H), 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

// ---------------------- render loop ----------------------
let last = performance.now();
function render(now){
  const dt = now - last;
  last = now;

  // clear & nebula
  drawNebula(now);

  // draw each orb (aura -> dust -> core)
  orbs.forEach((o, idx) => {
    // advance orbit & pulse
    o.angle += o.speed * dt;
    o.pulsePhase += 0.003 * dt;

    // center point
    const cx = CENTER.x() + Math.cos(o.angle) * o.orbit;
    const cy = CENTER.y() + Math.sin(o.angle) * o.orbit * 0.72; // elliptical path for depth

    // aura
    const auraR = o.radius * (2.1 + 0.4 * Math.sin(o.pulsePhase * 0.9 + idx));
    const aura = ctx.createRadialGradient(cx, cy, o.radius*0.2, cx, cy, auraR);
    aura.addColorStop(0, hexToRgba(o.genre.color, 0.44));
    aura.addColorStop(0.35, hexToRgba(o.genre.color, 0.18));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI*2);
    ctx.fill();

    // dust particles (orbiting the orb)
    o.dust.forEach(d => {
      d.theta += d.speed * dt + (Math.sin(now*0.001 + d.theta)*0.0002);
      const dx = Math.cos(d.theta) * d.r;
      const dy = Math.sin(d.theta) * d.r * 0.78;
      const px = cx + dx;
      const py = cy + dy;
      const s = d.size * (0.6 + 0.4 * Math.sin(now*0.002 + d.theta));
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(o.genre.color, Math.max(0.02, d.alpha * 0.95));
      ctx.arc(px, py, s, 0, Math.PI*2);
      ctx.fill();
    });

    // core glossy sphere (2D illusion)
    const coreGrad = ctx.createRadialGradient(cx - o.radius*0.18, cy - o.radius*0.12, 1, cx, cy, o.radius);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    coreGrad.addColorStop(0.16, hexToRgba(o.genre.color, 1));
    coreGrad.addColorStop(1, hexToRgba(o.genre.color, 0.7));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = coreGrad;
    const coreSize = o.radius * (0.78 + 0.04 * Math.sin(o.pulsePhase + idx));
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI*2);
    ctx.fill();

    // faint rim
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI*2);
    ctx.stroke();

    // store for click detection & prompt anchoring
    o._cx = cx; o._cy = cy; o._core = coreSize;
  });

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ---------------------- click -> anchored prompt ----------------------
let activePrompt = null;
function closeActivePrompt(){ if(!activePrompt) return; try{ activePrompt.dom.remove(); }catch(e){} activePrompt=null; }
canvas.addEventListener("pointerdown", (ev)=>{
  const x = ev.clientX, y = ev.clientY;
  for(let i=0;i<orbs.length;i++){
    const o = orbs[i];
    const dx = x - o._cx, dy = y - o._cy;
    if(Math.sqrt(dx*dx + dy*dy) <= o._core * 0.95){
      openPromptAnchored(i); return;
    }
  }
});

function openPromptAnchored(index){
  closeActivePrompt();
  const o = orbs[index];
  const dom = document.createElement("div");
  dom.className = "prompt";
  dom.innerHTML = `
    <button class="closeX" aria-label="Close">✕</button>
    <h4>${o.genre.label}</h4>
    <p class="muted">Who's your favorite artist? (Dream B2B optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" />
    <input class="b2b" placeholder="Dream B2B (optional)" />
    <textarea class="why" rows="2" placeholder="Why (optional)"></textarea>
    <div class="actions">
      <button class="btn ghost cancel">Cancel</button>
      <button class="btn submit">Submit</button>
    </div>
  `;
  document.body.appendChild(dom);

  dom.querySelector(".closeX").addEventListener("click", closeActivePrompt);
  dom.querySelector(".cancel").addEventListener("click", closeActivePrompt);
  dom.querySelector(".submit").addEventListener("click", ()=>{
    const artist = dom.querySelector(".artist").value.trim();
    if(!artist){ dom.querySelector(".artist").focus(); return; }
    const b2b = dom.querySelector(".b2b").value.trim();
    const why = dom.querySelector(".why").value.trim();
    saveLocalVote(o.genre.id, artist, b2b, why);
    // small feedback
    dom.animate([{ transform:"scale(1)" }, { transform:"scale(0.98)" }, { transform:"scale(1)" }], { duration:180 });
    closeActivePrompt();
  });

  // place prompt near orb and set it to orbit around the orb
  const radius = o._core * 1.6 + 40;
  const angle = Math.random()*Math.PI*2;
  activePrompt = { dom, anchorIndex: index, angle, radius, raf: null };
  positionPrompt();
  setTimeout(()=> dom.querySelector(".artist").focus(), 120);
}

function positionPrompt(){
  if(!activePrompt) return;
  const p = activePrompt;
  const anchor = orbs[p.anchorIndex];
  p.angle += 0.012;
  const cx = anchor._cx, cy = anchor._cy;
  const x = cx + Math.cos(p.angle) * p.radius - p.dom.offsetWidth/2;
  const y = cy + Math.sin(p.angle) * p.radius - p.dom.offsetHeight/2;
  p.dom.style.left = Math.max(8, Math.min(W - p.dom.offsetWidth - 8, x)) + "px";
  p.dom.style.top  = Math.max(8, Math.min(H - p.dom.offsetHeight - 8, y)) + "px";
  p.raf = requestAnimationFrame(positionPrompt);
}
function cancelPromptLoop(){ if(activePrompt && activePrompt.raf) cancelAnimationFrame(activePrompt.raf); }

// ---------------------- local storage vote saving ----------------------
const STORAGE_KEY = "codemq_votes_vfinal";
function saveLocalVote(genreId, artist, b2b, why){
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    raw[genreId] = raw[genreId] || [];
    raw[genreId].push({ artist, b2b, why, ts: Date.now() });
    if(raw[genreId].length > 5000) raw[genreId].splice(0, raw[genreId].length-5000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    console.log("Saved vote locally:", genreId, artist);
  } catch(e){ console.error("saveLocalVote:", e); }
}

// ---------------------- playlist embed handling ----------------------
const loadBtn = document.getElementById("loadPlaylist");
const clearBtn = document.getElementById("clearPlaylist");
const inputEl = document.getElementById("playlistInput");
const embedWrap = document.getElementById("playlistEmbed");

loadBtn.addEventListener("click", ()=>{
  const url = (inputEl.value||"").trim();
  embedWrap.innerHTML = "";
  if(!url) return;
  if(url.includes("open.spotify.com")){
    const embed = url.includes("/embed/") ? url : url.replace("open.spotify.com","open.spotify.com/embed");
    embedWrap.innerHTML = `<iframe src="${embed}" frameborder="0" allow="encrypted-media" style="width:100%;height:360px;border-radius:8px"></iframe>`;
  } else if(url.includes("soundcloud.com")){
    const uc = encodeURIComponent(url);
    embedWrap.innerHTML = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${uc}"></iframe>`;
  } else {
    embedWrap.innerHTML = `<div style="color:#cfcfcf">Paste a full Spotify or SoundCloud link (open.spotify.com/... or soundcloud.com/...).</div>`;
  }
});
clearBtn.addEventListener("click", ()=>{ embedWrap.innerHTML=""; inputEl.value=""; });

// ---------------------- cleanup when closing prompt ----------------------
window.addEventListener("beforeunload", ()=> cancelPromptLoop());
document.addEventListener("keydown", (e)=> {
  if(e.key === "Escape") closeActivePrompt();
});
