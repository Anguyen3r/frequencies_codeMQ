<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Orbiting Genres — Mobile-First</title>
<style>
  :root{
    --bg:#02020a;
    --glass: rgba(0,0,0,0.32);
    --font-sz: 13px;
    --rounded: 12px;
  }
  html,body{height:100%;margin:0;background:var(--bg);color:#eaf1ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Helvetica Neue",Arial;overflow:hidden}
  #wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;touch-action:none}
  canvas{display:block;width:100%;height:100%;}
  .top-right{position:fixed;right:12px;top:12px;width:92px;z-index:30;display:flex;flex-direction:column;gap:8px;align-items:center}
  .playlist{width:92px;height:86px;border-radius:10px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);box-shadow:0 6px 18px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:6px;backdrop-filter:blur(6px)}
  .genre-grid{margin-top:6px;display:flex;flex-direction:column;gap:6px;width:100%;}
  .genre-box{height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;cursor:pointer;user-select:none;}
  .top50{position:fixed;right:12px;top:110px;width:200px;max-height:44vh;overflow:auto;z-index:30;background:rgba(255,255,255,0.02);border-radius:10px;padding:8px;font-size:12px;line-height:1.2;box-shadow:0 10px 30px rgba(0,0,0,0.6);backdrop-filter:blur(8px);}
  .top50 .row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 4px;border-radius:6px;}
  .top50 .artist{font-weight:600;font-size:12px;}
  .top50 .count{color:rgba(255,255,255,0.35);font-size:11px;}
  .bottom-nav{position:fixed;left:12px;right:12px;bottom:12px;height:56px;z-index:40;background:rgba(255,255,255,0.02);border-radius:18px;display:flex;align-items:center;justify-content:space-around;padding:8px 14px;gap:12px;box-shadow:0 18px 40px rgba(0,0,0,0.7);backdrop-filter:blur(10px);}
  .btn-nav{flex:1;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;cursor:pointer;}
  .hud{position:fixed;left:12px;top:12px;z-index:30;display:flex;gap:8px;align-items:center;pointer-events:none;}
  .hud .chip{padding:6px 10px;border-radius:10px;backdrop-filter:blur(6px);background:rgba(0,0,0,0.25);font-size:12px;font-weight:700;}
  #three-canvas{position:fixed;inset:0;z-index:1;display:block;}
</style>
</head>
<body>

<div id="wrap"><canvas id="three-canvas"></canvas></div>
<div class="hud" id="hud" style="display:none"><div class="chip" id="hudText">Genre</div></div>

<div class="top-right">
  <div class="playlist" id="playlistWrap"><div style="font-size:11px;color:rgba(255,255,255,0.22);text-align:center">Playlist</div></div>
  <div class="genre-grid" id="genreGrid"></div>
  <small style="opacity:0.9">Tap a genre to load</small>
</div>

<div class="top50" id="top50Wrap"><div style="font-weight:800;margin-bottom:6px;font-size:13px">Top 50 (sample)</div><div id="topRows"></div></div>

<div class="bottom-nav" id="bottomNav">
  <div class="btn-nav" id="btnHome">Home</div>
  <div class="btn-nav" id="btnGenres">Genres</div>
  <div class="btn-nav" id="btnMap">Map</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/three.min.js"></script>
<script>
function toCssHex(num){ return '#'+('000000'+num.toString(16)).slice(-6); }

/* === shortened initial parts already provided === */
/* keep all your existing scene/orb setup above this comment */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (ev)=>{
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const intersects = raycaster.intersectObjects(
    Object.values(ORB_MESHES).map(o => o.core),
    true
  );
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const found = Object.values(ORB_MESHES).find(o => o.core === hit);
    if (found) selectGenre(found.id);
  }
});

/* ---------- resize ---------- */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setSize(window.innerWidth, window.innerHeight);

/* ---------- animation ---------- */
function animate(t){
  requestAnimationFrame(animate);

  starsFar.rotation.y += 0.0001;
  starsNear.rotation.y += 0.0002;

  Object.values(ORB_MESHES).forEach(o=>{
    o.container.rotation.z += 0.0015 * (o.idx%2 ? 1 : -1);
    o.ring.rotation.z += o.ring.userData.rotationSpeed;
  });

  if(selectedGenre){
    camera.position.lerp({x:0,y:18,z:CAMERA_Z*0.94},0.04);
  } else {
    camera.position.lerp({x:0,y:18,z:CAMERA_Z},0.04);
  }

  renderer.render(scene,camera);
}
animate();

</script>
</body>
</html>