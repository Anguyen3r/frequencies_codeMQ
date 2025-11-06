/* app.js — Full integrated (Part 1 / 3) */

/* ---------- CONFIG ---------- */
const FIREBASE_CONFIG = null;

/* ---------- Small Helpers ---------- */
function toCssHex(n){ return '#'+('000000'+(n.toString(16))).slice(-6); }
function toCssRgba(hex,a=1){const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;return`rgba(${r},${g},${b},${a})`;}

/* ---------- Persistence ---------- */
let dbRef=null,useFirebase=false;
if(FIREBASE_CONFIG){try{firebase.initializeApp(FIREBASE_CONFIG);
const d=firebase.database();dbRef=d.ref('codemq/arts');useFirebase=true;}catch(e){useFirebase=false;}}
async function saveVote(g,a,b){const r={artist:(a||'').trim(),b2b:(b||'').trim(),ts:Date.now()};
if(useFirebase&&dbRef)await dbRef.child(g).push(r);else{const K='codemq_votes',d=JSON.parse(localStorage.getItem(K)||'{}');
d[g]=d[g]||[];d[g].push(r);localStorage.setItem(K,JSON.stringify(d));window.dispatchEvent(new CustomEvent('codemq_local_update'));}}
async function readAllVotesOnce(){if(useFirebase&&dbRef){const s=await dbRef.get();return s.exists()?s.val():{}}
return JSON.parse(localStorage.getItem('codemq_votes')||'{}');}
if(!useFirebase)window.addEventListener('codemq_local_update',()=>computeAndRenderTop());

/* ---------- UI refs ---------- */
const uiWrap=document.getElementById('ui'),
legendWrap=document.getElementById('legend'),
genreSelect=document.getElementById('genreSelect'),
topList=document.getElementById('topList'),
toggleTop=document.getElementById('toggleTop'),
leftPanel=document.getElementById('leftPanel'),
spotifyInput=document.getElementById('spotifyInput'),
loadSpotify=document.getElementById('loadSpotify'),
spotifyEmbed=document.getElementById('spotifyEmbed'),
legendList=document.getElementById('legendList'),
playlistPanel=document.getElementById('playlistPanel');

if(uiWrap){uiWrap.style.opacity='1';uiWrap.style.pointerEvents='auto';}
if(legendWrap){legendWrap.style.opacity='1';legendWrap.style.pointerEvents='auto';}

/* ---------- GENRES & COLORS ---------- */
const GENRES=[
{id:'hard-techno',name:'Hard Techno',color:0xff2b6a,spotify:'https://open.spotify.com/playlist/37i9dQZF1DX9sIqqvKsjG8'},
{id:'techno',name:'Techno',color:0x8a5fff,spotify:'https://open.spotify.com/playlist/37i9dQZF1DX6f9r4Vf1D3K'},
{id:'house',name:'House',color:0xff9b3f,spotify:'https://open.spotify.com/playlist/37i9dQZF1DXa2PvUpywmrr'},
{id:'dnb',name:'Drum & Bass',color:0x4cff7b,spotify:'https://open.spotify.com/playlist/37i9dQZF1DX8FmtpqvLJtY'},
{id:'electronic',name:'Electronic / Dance',color:0x3f7bff,spotify:'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n'},
{id:'dubstep',name:'Dubstep',color:0x5fc9ff,spotify:'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY'},
{id:'pop',name:'Pop',color:0xff89d9,spotify:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'}];

/* ---------- populate legend ---------- */
if(genreSelect&&legendList){
  legendList.innerHTML='';
  GENRES.forEach(g=>{
    const opt=document.createElement('option');opt.value=g.id;opt.textContent=g.name;genreSelect.appendChild(opt);
    const li=document.createElement('li');
    li.className='legend-row';
    li.innerHTML=`<span class="swatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:middle;background:${toCssHex(g.color)}"></span>${g.name}`;
    li.style.padding='6px 10px';li.style.marginBottom='6px';li.style.borderRadius='8px';
    legendList.appendChild(li);
    li.addEventListener('click',()=>{playGenreAudio(g.id);highlightLegend(g.id);});
  });
  genreSelect.addEventListener('change',()=>computeAndRenderTop());
}
function highlightLegend(id){
  if(!legendList)return;
  Array.from(legendList.children).forEach((li,i)=>{li.style.boxShadow=(GENRES[i].id===id)?'0 6px 18px rgba(0,0,0,0.45)':'none';});
}

/* ---------- Three.js setup ---------- */
const wrap=document.getElementById('canvasWrap')||document.body;
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x00000c,0.00009);
const CAMERA_Z=850;
const camera=new THREE.PerspectiveCamera(46,window.innerWidth/window.innerHeight,0.1,10000);
camera.position.set(0,18,CAMERA_Z);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setClearColor(0x000010,0);wrap.appendChild(renderer.domElement);
renderer.domElement.style.position='fixed';renderer.domElement.style.inset='0';renderer.domElement.style.zIndex='0';
const amb=new THREE.AmbientLight(0xffffff,0.45);scene.add(amb);
const dir=new THREE.DirectionalLight(0xffffff,0.9);dir.position.set(10,20,10);scene.add(dir);

/* ---------- Spotify Embed (height fix 60vh) ---------- */
function clearSpotifyEmbed(){if(spotifyEmbed)spotifyEmbed.innerHTML='';}
function embedSpotify(uri){
  if(!spotifyEmbed)return;spotifyEmbed.innerHTML='';
  try{
    const u=new URL(uri);
    if(u.hostname.includes('spotify')){
      const p=u.pathname.split('/').filter(Boolean);
      if(p.length>=2){
        const iframe=document.createElement('iframe');
        iframe.src=`https://open.spotify.com/embed/${p[0]}/${p[1]}`;
        iframe.style.width='100%';
        iframe.style.height='60vh';   // ✅ taller vertical panel
        iframe.style.border='none';
        iframe.allow='encrypted-media; clipboard-write';
        iframe.style.borderRadius='12px';
        spotifyEmbed.appendChild(iframe);
        return;
      }
    }
  }catch(e){}
  const iframe=document.createElement('iframe');
  iframe.src=uri;
  iframe.style.width='100%';
  iframe.style.height='60vh';        // ✅ match vertical height
  iframe.frameBorder='0';
  iframe.allow='encrypted-media; clipboard-write';
  iframe.style.borderRadius='12px';
  spotifyEmbed.appendChild(iframe);
}
/* ---------- Play selected genre audio ---------- */
const GENRE_SPOTIFY = {};
GENRES.forEach(g => GENRE_SPOTIFY[g.id] = g.spotify || null);
let currentGenreId = null;

async function playGenreAudio(genreId){
  currentGenreId = genreId;
  const uri = GENRE_SPOTIFY[genreId];
  if(uri && spotifyEmbed){
    try{audioController.stop();}catch(e){}
    clearSpotifyEmbed();
    embedSpotify(uri);
  }
  const g = GENRES.find(x=>x.id===genreId);
  if(!g || !RIBBON.geometry) return;
  const colors = RIBBON.geometry.attributes.color.array;
  const tr=((g.color>>16)&255)/255, tg=((g.color>>8)&255)/255, tb=(g.color&255)/255;
  for(let i=0;i<RIBBON.points;i++){
    const idx=i*3;
    colors[idx]=0.14+tr*0.86; colors[idx+1]=0.14+tg*0.86; colors[idx+2]=0.14+tb*0.86;
  }
  RIBBON.geometry.attributes.color.needsUpdate=true;
  if(RIBBON.sprite&&RIBBON.sprite.material){
    RIBBON.sprite.material.color=new THREE.Color(g.color);
    RIBBON.sprite.material.opacity=0.62;
  }
  const foundIdx=GENRES.findIndex(x=>x.id===genreId);
  PILLAR_RIBBONS.forEach((p,i)=>p.mesh.material.opacity=(i===foundIdx)?0.34:0.16);
  highlightLegend(genreId);
}

/* ---------- Audio visual controls injection ---------- */
function injectAudioVisualControls(){
  if(!playlistPanel)return;
  if(playlistPanel.querySelector('.visual-controls'))return;
  const wrap=document.createElement('div');
  wrap.className='visual-controls';
  wrap.style.marginTop='10px';wrap.style.display='flex';wrap.style.gap='8px';
  wrap.style.alignItems='center';wrap.style.justifyContent='space-between';
  wrap.innerHTML=`
    <input id="visualAudioUrl" placeholder="Paste MP3/OGG URL" style="width:60%;padding:8px;border-radius:8px;border:none;background:rgba(255,255,255,0.03);color:#fff;font-size:13px" />
    <button id="loadVisualUrl" style="padding:8px;border-radius:8px;border:none;background:#1db954;color:#fff;cursor:pointer">Load</button>
  `;
  playlistPanel.appendChild(wrap);
  const loadBtn=wrap.querySelector('#loadVisualUrl'),urlIn=wrap.querySelector('#visualAudioUrl');
  loadBtn.addEventListener('click',async()=>{
    const url=urlIn.value.trim(); if(!url)return;
    await audioController.loadUrl(url,{loop:true});
  });
}
injectAudioVisualControls();

/* ---------- Audio controller ---------- */
const audioController=(function(){
  let ctx,analyser,src,fd,td,audioEl,active=false;
  async function ensure(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();analyser=ctx.createAnalyser();analyser.fftSize=4096;fd=new Uint8Array(analyser.frequencyBinCount);td=new Uint8Array(analyser.frequencyBinCount);}}
  async function loadUrl(url,{loop=true}={}){
    await ensure();
    if(!audioEl){audioEl=document.createElement('audio');audioEl.crossOrigin='anonymous';audioEl.controls=true;audioEl.style.width='100%';}
    audioEl.src=url;audioEl.loop=loop;audioEl.play().catch(()=>{});
    if(src)try{src.disconnect();}catch(e){}
    src=ctx.createMediaElementSource(audioEl);src.connect(analyser);analyser.connect(ctx.destination);active=true;
    if(spotifyEmbed){spotifyEmbed.innerHTML='';spotifyEmbed.appendChild(audioEl);}
  }
  function stop(){if(audioEl)audioEl.pause();active=false;}
  function getAmps(){if(!analyser)return null;analyser.getByteFrequencyData(fd);let b=0;for(let i=0;i<fd.length*0.02;i++)b+=fd[i];b/=fd.length*0.02*255;let s=0;for(let i=0;i<fd.length;i++)s+=fd[i]*fd[i];const rms=Math.sqrt(s/fd.length)/255;return{bass:b,rms};}
  function getTimeDomain(){if(!analyser)return null;analyser.getByteTimeDomainData(td);return td;}
  return{loadUrl,stop,getAmps,getTimeDomain,isActive:()=>active};
})();

/* ---------- Animation Loop ---------- */
let start=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const t=(performance.now()-start)*0.001;
  const amps=audioController.getAmps();const bass=amps?amps.bass:0;const rms=amps?amps.rms:0.05;
  starsNear.points.rotation.z+=0.0005;starsFar.points.rotation.z-=0.0003;
  dustPlane.rotation.z+=0.0001;
  GENRES.forEach((g,idx)=>{
    const o=ORB_MESHES[g.id];if(!o)return;
    const a=t*(0.12+bass*0.4)+o.baseAngle;
    const ex=CLUSTER_RADIUS*(0.85+Math.sin(idx+t*0.1)*0.02);
    const ey=CLUSTER_RADIUS*0.5*(0.9+Math.cos(idx+t*0.1)*0.02);
    o.container.position.x=Math.cos(a)*ex;
    o.container.position.y=Math.sin(a)*ey;
    o.container.rotation.y+=0.002;
    o.ringObj.group.rotation.z+=o.ringObj.rotationSpeed*(1+bass*0.8);
  });
  renderer.render(scene,camera);
}
animate();
/* ---------- Responsive handling ---------- */
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

/* ---------- Match genre panel colors to orb colors ---------- */
function syncGenrePanelColors(){
  const bar=document.getElementById('genreBar');
  if(!bar)return;
  GENRES.forEach(g=>{
    const el=bar.querySelector(`[data-genre="${g.id}"]`);
    if(el) el.style.color = `#${g.color.toString(16).padStart(6,'0')}`;
  });
}
syncGenrePanelColors();

/* ---------- Ensure Spotify iframe is taller (60vh) ---------- */
function adjustSpotifyIframeHeight(){
  const iframe=document.getElementById('spotifyPlayer');
  if(iframe) iframe.style.height='60vh';
}
adjustSpotifyIframeHeight();

/* ---------- Highlight active genre pill ---------- */
function highlightLegend(activeId){
  const bar=document.getElementById('genreBar');
  if(!bar)return;
  const spans=bar.querySelectorAll('span[data-genre]');
  spans.forEach(s=>{
    if(s.dataset.genre===activeId) s.classList.add('active');
    else s.classList.remove('active');
  });
}

/* ---------- Ambient idle animation for ribbon ---------- */
const ribbonEl=document.getElementById('ribbon');
if(ribbonEl) ribbonEl.classList.add('idle');

/* ---------- Initialize defaults ---------- */
(function initDefaults(){
  playGenreAudio('techno');      // Default genre on load
  highlightLegend('techno');
  syncGenrePanelColors();         // Make sure UI colors match bubbles
  adjustSpotifyIframeHeight();    // Resize the embed
})();
