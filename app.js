/* ===============================
   GLOBAL STATE
================================ */

let player;
let currentGenre = "ambient";
let playbackProgress = 0;
let isPlaying = false;

/* ===============================
   GENRES → YOUTUBE MUSIC PLAYLISTS
   (Use real playlist IDs)
================================ */

const GENRES = {
  ambient: {
    color: "#7aa2ff",
    playlistId: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI"
  },
  techno: {
    color: "#ff4fd8",
    playlistId: "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj"
  },
  classical: {
    color: "#f2d398",
    playlistId: "PLRbjoNpE_9bV_JZpRZj3Uu1Y6A4YqEJ0A"
  }
};

window.__activeGenreColorHex = GENRES[currentGenre].color;

/* ===============================
   YOUTUBE IFRAME API
================================ */

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("ytPlayer", {
    height: "0",
    width: "0",
    playerVars: {
      listType: "playlist",
      list: GENRES[currentGenre].playlistId,
      autoplay: 1,
      controls: 0,
      mute: 0
    },
    events: {
      onReady: () => {
        isPlaying = true;
        player.playVideo();
      },
      onStateChange: e => {
        isPlaying = e.data === YT.PlayerState.PLAYING;
      }
    }
  });
};

/* ===============================
   GENRE SWITCH
================================ */

function switchGenre(genre) {
  if (!GENRES[genre] || !player) return;

  currentGenre = genre;
  window.__activeGenreColorHex = GENRES[genre].color;

  player.loadPlaylist({
    listType: "playlist",
    list: GENRES[genre].playlistId
  });

  updateGenreCSS();
}

function updateGenreCSS() {
  const hex = GENRES[currentGenre].color;
  const hue = hexToHue(hex);
  document.documentElement.style.setProperty("--genre-hue", hue);
}

/* ===============================
   VISUAL TIME DRIVER
================================ */

function updatePlaybackProgress() {
  if (!player || !isPlaying) return;

  const duration = player.getDuration() || 1;
  const current = player.getCurrentTime() || 0;

  playbackProgress = current / duration;
}

/* ===============================
   THREE.JS LOOP (HOOK POINT)
================================ */

// inside your existing animate() loop:
function animate() {
  requestAnimationFrame(animate);

  updatePlaybackProgress();

  // Use playbackProgress to drive visuals
  // example:
  // ribbon.material.uniforms.uTime.value += 0.01 + playbackProgress * 0.02;

  renderer.render(scene, camera);
}

animate();

/* ===============================
   UTILS
================================ */

function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;

  if (max === min) h = 0;
  else if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
  else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
  else h = 60 * ((r - g) / (max - min)) + 240;

  return Math.round(h);
}

/* ===============================
   UI BINDINGS
================================ */

document.getElementById("genreSelect").addEventListener("change", e => {
  switchGenre(e.target.value);
});
