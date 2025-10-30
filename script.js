/* Dream Bubbles - main script
   - 6 main orbs with matching auras
   - nebula animated background (canvas 2D)
   - anchored / orbiting prompt on click
   - playlist embed (Spotify / SoundCloud)
   - stores submissions in localStorage for now
*/

const CANVAS_ID = "bubbles";
const STORAGE_KEY = "codemq_votes_v_final";

const canvas = document.getElementById(CANVAS_ID);
const ctx = canvas.getContext("2d", { alpha: true });

// sizing
let W = 0, H = 0;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(W * ratio);
  canvas.height = Math.floor(H * ratio);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// configuration: 6 genres (colors chosen to be off-tones that blend nicely)
const GENRES = [
  { id: "techno", label: "Hard / Techno", color: "#8b5cf6" },  // violet
  { id: "house",  label: "House",        color: "#60a5fa" },  // blue
  { id: "dnb",    label: "Drum & Bass", color: "#14b8a6" },  // teal
  { id: "dub",    label: "Dubstep",      color: "#f472b6" },  // pink
  { id: "elect",  label: "Electronic",   color: "#eab308" },  // gold
  { id: "main",   label: "Mainstream",   color: "#c084fc" }   // lilac
];

const mainOrbs = []; // will store orb objects
const GROUP_RADIUS = Math.min(W, H) * 0.19; // central orbital radius
const BASE_RADIUS = Math.min(W, H) * 0.08; // visual size base (will scale per orb)

function createOrbs() {
  mainOrbs.length = 0;
  for (let i = 0; i < GENRES.length; i++) {
    const g = GENRES[i];
    const orbit = GROUP_RADIUS + i * (BASE_RADIUS * 0.18);
    const radius = Math.max(48, BASE_RADIUS * (0.9 - i * 0.05)); // px
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.002 + Math.random() * 0.0012;
    const direction = i % 2 === 0 ? 1 : -1; // alternate direction
    mainOrbs.push({ genre: g, orbit, radius, angle, speed, direction, pulse: 0, auraOff: Math.random()*Math.PI*2 });
  }
}
createOrbs();

// nebula animation parameters
let nebOffset = 0;

// drawing helpers
function hexToRgba(hex, alpha = 1) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// compute top counts from localStorage
function readVotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch(e){ return {}; }
}
function saveLocalVote(genreId, artist, b2b, why) {
  const raw = readVotes();
  raw[genreId] = raw[genreId] || [];
  raw[genreId].push({ artist, b2b, why, ts: Date.now() });
  if (raw[genreId].length > 5000) raw[genreId].splice(0, raw[genreId].length - 5000);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

// anchored prompt state
let activePrompt = null; // {dom, anchorOrbIndex, angle, radius, raf}

// Draw frame
function render(now) {
  // now in ms
  nebOffset += 0.0005 * (now % 10000);

  // clear
  ctx.clearRect(0, 0, W, H);

  // draw moving nebula gradient background
  const g = ctx.createLinearGradient(0, 0, W, H);
  // subtle animated stops using nebOffset for motion
  g.addColorStop(0, `rgba(10,8,30,0.95)`);
  g.addColorStop(0.45, `rgba(28,18,60,0.78)`);
  g.addColorStop(0.9, `rgba(6,6,12,0.95)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // soft luminous hazes (per-genre subtle clouds) behind orbs
  mainOrbs.forEach((o, idx) => {
    // update angle & pulse
    o.angle += o.speed * o.direction;
    o.pulse = 0.5 + Math.sin(now * 0.002 + idx) * 0.25;
    const cx = W/2 + Math.cos(o.angle) * o.orbit;
    const cy = H/2 + Math.sin(o.angle) * o.orbit * 0.65; // slight ellipse to add depth

    // aura / gas cloud
    const auraR = o.radius * (2.0 + o.pulse * 0.6);
    const aura = ctx.createRadialGradient(cx, cy, o.radius*0.2, cx, cy, auraR);
    aura.addColorStop(0, hexToRgba(o.genre.color, 0.38 + o.pulse*0.08));
    aura.addColorStop(0.4, hexToRgba(o.genre.color, 0.18 + o.pulse*0.05));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI*2);
    ctx.fill();

    // soft rim (slightly brighter)
    const rim = ctx.createRadialGradient(cx - o.radius*0.2, cy - o.radius*0.2, o.radius*0.2, cx, cy, o.radius*0.9);
    rim.addColorStop(0, "rgba(255,255,255,0.85)");
    rim.addColorStop(0.08, hexToRgba(o.genre.color, 0.95));
    rim.addColorStop(1, hexToRgba(o.genre.color, 0.35));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, o.radius * (0.95 + o.pulse*0.03), 0, Math.PI*2);
    ctx.fill();

    // glossy core highlight
    const core = ctx.createRadialGradient(cx - o.radius*0.15, cy - o.radius*0.18, 1, cx, cy, o.radius*0.8);
    core.addColorStop(0, "rgba(255,255,255,0.95)");
    core.addColorStop(0.2, hexToRgba(o.genre.color, 1.0));
    core.addColorStop(1, hexToRgba(o.genre.color, 0.65));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, o.radius * (0.7 + o.pulse*0.02), 0, Math.PI*2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";

    // store current screen center to allow click detection
    o._screenX = cx;
    o._screenY = cy;
  });

  // animate anchored prompt if active
  if (activePrompt) {
    const p = activePrompt;
    p.angle += 0.012; // orbit speed for the prompt around anchor orb
    const anchor = mainOrbs[p.anchorOrbIndex];
    if (anchor) {
      const cx = W/2 + Math.cos(anchor.angle) * anchor.orbit;
      const cy = H/2 + Math.sin(anchor.angle) * anchor.orbit * 0.65;
      const x = cx + Math.cos(p.angle) * p.radius - (p.dom.offsetWidth / 2);
      const y = cy + Math.sin(p.angle) * p.radius - (p.dom.offsetHeight / 2);
      p.dom.style.left = Math.max(8, Math.min(W - p.dom.offsetWidth - 8, x)) + "px";
      p.dom.style.top  = Math.max(8, Math.min(H - p.dom.offsetHeight - 8, y)) + "px";
    }
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// click detection for orbs -> open anchored prompt
canvas.addEventListener("pointerdown", (ev) => {
  const x = ev.clientX;
  const y = ev.clientY;
  // find the nearest orb within click radius
  for (let i = 0; i < mainOrbs.length; i++) {
    const o = mainOrbs[i];
    const dx = x - o._screenX;
    const dy = y - o._screenY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist <= o.radius * 1.05) {
      openAnchoredPrompt(i);
      return;
    }
  }
});

// create anchored prompt
function openAnchoredPrompt(orbIndex) {
  closeActivePrompt(); // only 1 at a time

  const orb = mainOrbs[orbIndex];
  const dom = document.createElement("div");
  dom.className = "prompt";
  dom.innerHTML = `
    <button class="closeX" aria-label="Close">✕</button>
    <h4>${orb.genre.label}</h4>
    <p class="muted">Who's your favorite artist? (and dream B2B — optional)</p>
    <input class="artist" placeholder="Favorite artist (required)" />
    <input class="b2b" placeholder="Dream B2B (optional)" />
    <textarea class="why" rows="2" placeholder="Why (optional)"></textarea>
    <div class="actions">
      <button class="btn ghost cancel">Cancel</button>
      <button class="btn submit">Submit</button>
    </div>
  `;
  document.body.appendChild(dom);

  // wire controls
  dom.querySelector(".closeX").addEventListener("click", closeActivePrompt);
  dom.querySelector(".cancel").addEventListener("click", closeActivePrompt);
  dom.querySelector(".submit").addEventListener("click", () => {
    const artist = dom.querySelector(".artist").value.trim();
    if (!artist) { dom.querySelector(".artist").focus(); return; }
    const b2b = dom.querySelector(".b2b").value.trim();
    const why = dom.querySelector(".why").value.trim();
    saveLocalVote(orb.genre.id, artist, b2b, why);
    // optional small feedback (pulse)
    dom.animate([{ transform: "scale(1)" }, { transform: "scale(0.98)" }, { transform: "scale(1)" }], { duration: 200 });
    closeActivePrompt();
  });

  // position initial near orb
  const radius = orb.radius * 1.6;
  const angle = Math.random() * Math.PI * 2;
  activePrompt = { dom, anchorOrbIndex: orbIndex, angle, radius, raf: null };

  // ensure input focused
  setTimeout(()=> dom.querySelector(".artist").focus(), 80);
}

// close & cleanup prompt
function closeActivePrompt() {
  if (!activePrompt) return;
  try { activePrompt.dom.remove(); } catch(e) {}
  activePrompt = null;
}

// Playlist embed handling
const playlistInput = document.getElementById("playlistInput");
const loadPlaylist = document.getElementById("loadPlaylist");
const clearPlaylist = document.getElementById("clearPlaylist");
const playlistEmbed = document.getElementById("playlistEmbed");

loadPlaylist.addEventListener("click", () => {
  const url = (playlistInput.value || "").trim();
  playlistEmbed.innerHTML = "";
  if (!url) return;
  // Spotify embed
  if (url.includes("open.spotify.com")) {
    const embed = url.includes("/embed/") ? url : url.replace("open.spotify.com", "open.spotify.com/embed");
    playlistEmbed.innerHTML = `<iframe src="${embed}" frameborder="0" allow="encrypted-media; clipboard-write" style="width:100%;height:360px;border-radius:10px"></iframe>`;
  } else if (url.includes("soundcloud.com")) {
    // SoundCloud embed endpoint - use player widget URL
    const uc = encodeURIComponent(url);
    const sc = `https://w.soundcloud.com/player/?url=${uc}&color=%23ff5500&auto_play=false`;
    playlistEmbed.innerHTML = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="${sc}" style="border-radius:10px"></iframe>`;
  } else {
    playlistEmbed.innerHTML = `<div style="color:#cfcfcf">Paste a Spotify or SoundCloud URL (must be the full open.spotify.com/... link or soundcloud.com link).</div>`;
  }
});
clearPlaylist.addEventListener("click", ()=> { playlistEmbed.innerHTML = ""; playlistInput.value = ""; });

// init top UI (no heavy logic here)
document.getElementById("topToggle").addEventListener("click", ()=> {
  alert("Top Artists panel will be implemented next — this prototype stores locally in your browser.");
});

// simple accessibility: ESC closes prompt
document.addEventListener("keydown", (e)=> {
  if (e.key === "Escape") closeActivePrompt();
});

// Recompute sizes on orientation change / initial
window.addEventListener("orientationchange", ()=> {
  resize();
  createOrbs();
});
