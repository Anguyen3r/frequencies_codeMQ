/* app.js — integrated build: orbs + ribbon + AR UI + SoundCloud embed swapping
   Drop this file alongside index.html and style.css.
*/

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null;

/* ---------- small helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- minimal DOM helpers ---------- */
function byId(id){ return document.getElementById(id); }
function safe(tag,id,attrs={}){ let el = byId(id); if(!el){ el = document.createElement(tag); el.id = id; Object.keys(attrs).forEach(k=>el.setAttribute(k, attrs[k])); document.body.appendChild(el);} return el; }

/* ensure minimal DOM nodes exist (index.html already provides them) */
const uiWrap = safe('div','ui');
const legendList = safe('ul','legendList');
const genreSelect = safe('select','genreSelect');
const topList = safe('div','topList');
const toggleTop = safe('button','toggleTop');
const leftPanel = safe('div','leftPanel');
const spotifyEmbed = safe('div','spotifyEmbed');
const playerWrap = safe('div','playerWrap');

/* ---------- GENRES, EMBEDS and TOP ARTISTS (curated real names) ---------- */
const GENRES = [
  { id:'techno', name:'Hard / Techno', color:0xff4f79, class:'genre-techno' },
  { id:'house', name:'House', color:0xffbf5f, class:'genre-house' },
  { id:'dnb', name:'Drum & Bass', color:0x5fff85, class:'genre-dnb' },
  { id:'dubstep', name:'Dubstep', color:0x5fc9ff, class:'genre-dubstep' },
  { id:'electronic', name:'Electronic', color:0x9f5fff, class:'genre-electronic' },
  { id:'pop', name:'Pop', color:0xffffff, class:'genre-pop' }
];

/* SoundCloud embed HTML for each genre (player uses iframe embeds).
   Note: browser autoplay policies may block auto_play; users can press play in iframe.
   You can replace the `url=` values with any SoundCloud playlist URL you prefer.
*/
const GENRE_EMBEDS = {
  'techno': `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/TechnoSetExample/sets/top-50-techno&color=%23ff4f79&auto_play=false&hide_related=false&show_user=true&show_comments=true"></iframe>`,
  'house': `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/dylanjsounds/sets/top-50-house&color=%23ffbf5f&auto_play=false&hide_related=false&show_user=true&show_comments=true"></iframe>`,
  'dnb': `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/cyber-nuclear-sound/sets/top-50-drum-bass&color=%2300ff66&auto_play=false&hide_related=false&show_user=true&show_comments=true"></iframe>`,
  'dubstep': `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/claus-phorcksen-592630349/sets/top-50-dubstep&color=%235fc9ff&auto_play=false&hide_related=false&show_user=true&show_comments=true"></iframe>`,
  'electronic': `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/user-30575533/sets/top-50-dance-edm&color=%239f5fff&auto_play=false&hide_related=false&show_user=true&show_comments=true"></iframe>`,
  'pop': `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
      src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/various-artists/sets/top-50-pop&color=%23ffc0e8&auto_play=false&hide_related=false&show_user=true&show_comments=true"></iframe>`
};

/* Curated top artist lists (real names), trimmed to 30 per genre — used in Top panel.
   These are representative top artists, not ranked scientific charts — adjust as desired.
*/
const TOP_ARTISTS = {
  techno: [
    "Charlotte de Witte","Amelie Lens","Adam Beyer","Nina Kraviz","Dax J","ANNA","Rebekah","Perc","Jeff Mills","Pan-Pot",
    "Maceo Plex","Richie Hawtin","Ben Klock","DVS1","Sven Väth","Tale Of Us","Nastia","Joseph Capriati","Len Faki","Kobosil",
    "Sam Paganini","Chris Liebing","Marcel Dettmann","I Hate Models","Monika Kruse","Charlotte OC","Öona Dahl","Slam","Function","Rødhåd"
  ],
  house: [
    "Peggy Gou","Black Coffee","Mall Grab","The Martinez Brothers","Kerri Chandler","Jamie Jones","Diplo","Duke Dumont",
    "Hot Since 82","Fisher","Solomun","Dennis Ferrer","Green Velvet","MK","Disclosure","Lane 8","Gorgon City",
    "Claptone","Dombresky","KASP","John Summit","Catz 'n Dogz","Purple Disco Machine","Shiba San","Chris Lake","David Guetta","Sonny Fodera","Chris Stussy","DJ Seinfeld","Todd Terry"
  ],
  dnb: [
    "Goldie","LTJ Bukem","Andy C","Noisia","Roni Size","Netsky","Pendulum","Calibre","S.P.Y","High Contrast",
    "Shy FX","Sub Focus","Chase & Status","Koven","Beatport","Danny Byrd","Loadstar","Bad Company UK","DJ Marky","Wilkinson",
    "Sigma","Center","Dimension","Hybrid Minds","Metrik","Frankee","Total Science","Alix Perez","Break","Icicle"
  ],
  dubstep: [
    "Skrillex","Flux Pavilion","Zeds Dead","Subtronics","Rusko","Skream","Benga","Excision","Nero","Coki",
    "Mala","Caspa","Koan Sound","Savant","Doctor P","Knife Party","Borgore","Virtual Riot","Zomboy","Ill.Gates",
    "Datsik","Kryder","Funtcase","Adventure Club","Kill The Noise","Mitis","Mele","Truth","Ganja White Night","Sully"
  ],
  electronic: [
    "Daft Punk","The Chemical Brothers","Deadmau5","Calvin Harris","Kygo","Depeche Mode","Moby","The Prodigy","Underworld","Kraftwerk",
    "Orbital","Eric Prydz","Four Tet","Bonobo","Armin van Buuren","Above & Beyond","Sia (EDM collabs)","Paul van Dyk","Tiësto","Skrillex",
    "Porter Robinson","Madeon","ODESZA","Flume","Jon Hopkins","Jamie xx","SBTRKT","Giorgio Moroder","Aphex Twin","Bicep"
  ],
  pop: [
    "Beyoncé","Taylor Swift","The Weeknd","Ariana Grande","Dua Lipa","Ed Sheeran","Billie Eilish","Harry Styles","Rihanna","Bruno Mars",
    "Post Malone","Lady Gaga","Katy Perry","Coldplay","Shawn Mendes","Adele","Lizzo","Justin Bieber","Khalid","Camila Cabello",
    "Sia","Dua Lipa","Sam Smith","Halsey","Marshmello (pop collabs)","Charlie Puth","Meghan Trainor","Ellie Goulding","Normani","Zayn"
  ]
};

/* ---------- populate UI: genre boxes & select ---------- */
function populateGenreUI(){
  const list = legendList;
  list.innerHTML = '';
  const sel = genreSelect;
  sel.innerHTML = '';
  GENRES.forEach(g=>{
    // li box
    const li = document.createElement('li');
    li.className = `genre-${g.id} ${g.class}`;
    li.textContent = g.name.split(' ')[0]; // keep text compact
    li.dataset.genre = g.id;
    li.style.boxShadow = `0 8px 30px ${toCssHex(g.color)}33, inset 0 1px 0 rgba(255,255,255,0.02)`;
    li.addEventListener('click', ()=> {
      setActiveGenre(g.id);
    });
    list.appendChild(li);

    // select option
    const opt = document.createElement('option');
    opt.value = g.id; opt.textContent = g.name;
    sel.appendChild(opt);
  });

  if (sel){
    sel.addEventListener('change', ()=> setActiveGenre(sel.value));
  }
}
populateGenreUI();

/* ---------- helper to set active genre: swap embed, tint ribbon, load top list ---------- */
function setActiveGenre(genreId){
  // swap player embed
  const html = GENRE_EMBEDS[genreId] || `<div class="player-placeholder">Playlist not available</div>`;
  playerWrap.innerHTML = html;

  // update top list with artists
  const arr = TOP_ARTISTS[genreId] || [];
  let out = '';
  for (let i=0;i<arr.length && i<50;i++){
    out += `<div class="row"><strong>${i+1}. ${escapeHtml(arr[i])}</strong><span class="score">—</span></div>`;
  }
  topList.innerHTML = out;

  // set select to value (if present)
  if (genreSelect) genreSelect.value = genreId;

  // tell the 3D ribbon to tint (we emit a custom event so the 3D app can pick up)
  const ev = new CustomEvent('genre-change', { detail: { genreId }});
  window.dispatchEvent(ev);
}

/* ---------- wire a listener to tint ribbon & update currentGenreId in 3D code ---------- */
window.addEventListener('genre-change', (e)=>{
  try {
    const gid = e.detail.genreId;
    // attempt to call a function if present (the 3D code expects playGenreAudio)
    if (typeof playGenreAudio === 'function'){
      playGenreAudio(gid).catch(()=>{});
    } else {
      // fallback: just set a global var used by the ribbon if present
      window.currentGenreId = gid;
    }
  } catch(err){}
});

/* ---------- small UI niceties on first click show UI (keeps screen clean) ---------- */
let firstInteraction = false;
function revealUi(){
  if (firstInteraction) return;
  firstInteraction = true;
  const ui = byId('ui');
  if (ui){ ui.style.opacity = '1'; ui.style.pointerEvents = 'auto'; }
}
window.addEventListener('pointerdown', revealUi, { once:true });

/* ---------- small accessibility: announce genre switch ---------- */
window.addEventListener('genre-change', (e)=>{
  const s = byId('ariaStatus');
  if (s) s.textContent = `Switched to ${e.detail.genreId}`;
});

/* ---------- initialize default state: pick first genre ---------- */
if (GENRES.length) setTimeout(()=> setActiveGenre(GENRES[0].id), 420);

/* ---------- The rest of the file (3D engine) should be your existing orbit + ribbon code.
   If you already have working Three.js code (or the earlier long app.js you pasted),
   this file expects a function `playGenreAudio(genreId)` to exist that:
     - tints the ribbon to the genre color
     - optionally tries to load an audio file (if a direct audio URL is available)
   The long Three.js file you provided earlier already contains `playGenreAudio()` and the ribbon/orb logic.
*/

/* If your existing app.js is the long Three.js script we worked on previously,
   you can keep that full script and simply append this file's UI logic at the top
   (or copy the populateGenreUI(), setActiveGenre() and GENRE_EMBEDS/TOP_ARTISTS blocks into it).
*/

/* ---------- End of app.js UI glue. ---------- */
console.log('UI glue loaded — genre boxes, embed swapping and Top lists ready.');
