// Pixel-AR Music Atlas (v2)
// 7 Genres | Spotify Top 50 | Toggle + UI System

const genres = [
  {
    name: "Hard Techno",
    color: "#ff0000",
    playlist: "https://open.spotify.com/embed/playlist/0FDNSowO1e6HHMGQqsQR8e"
  },
  {
    name: "Techno",
    color: "#ff4500",
    playlist: "https://open.spotify.com/embed/playlist/3he7OajxdzoUoNzD44SVg3"
  },
  {
    name: "House",
    color: "#ffa500",
    playlist: "https://open.spotify.com/embed/playlist/37i9dQZF1DX2TRYkJECvfC"
  },
  {
    name: "Drum & Bass",
    color: "#00ff00",
    playlist: "https://open.spotify.com/embed/playlist/37i9dQZF1DWZjqjZMudx9T"
  },
  {
    name: "Dubstep",
    color: "#8000ff",
    playlist: "https://open.spotify.com/embed/playlist/37i9dQZF1DX3bH0P2uDnWA"
  },
  {
    name: "Electronic / Dance",
    color: "#0099ff",
    playlist: "https://open.spotify.com/embed/playlist/37i9dQZF1DX4dyzvuaRJ0n"
  },
  {
    name: "Pop / International",
    color: "#ff66aa",
    playlist: "https://open.spotify.com/embed/playlist/37i9dQZF1DWUa8ZRTfalHk"
  }
];

const genreContainer = document.getElementById("genre-container");
const playlistFrame = document.getElementById("playlist-frame");
const artistList = document.getElementById("artist-list");

// Create Genre Toggles
genres.forEach((genre, index) => {
  const box = document.createElement("div");
  box.classList.add("genre-box");
  box.style.backgroundColor = genre.color;
  box.innerText = genre.name;
  box.onclick = () => selectGenre(index);
  genreContainer.appendChild(box);
});

// Default selection
let currentGenre = 0;
updateInterface();

function selectGenre(index) {
  currentGenre = index;
  updateInterface();
}

function updateInterface() {
  const genre = genres[currentGenre];
  playlistFrame.src = genre.playlist;
  document.body.style.setProperty("--accent-color", genre.color);

  // Load artists dynamically
  loadArtists(genre.name);
}

function loadArtists(genreName) {
  const mockArtists = {
    "Hard Techno": ["Sara Landry", "I Hate Models", "999999999", "Paula Temple", "Parfait", "SPFDJ"],
    "Techno": ["Charlotte de Witte", "Amelie Lens", "Adam Beyer", "Rebūke", "Layton Giordani"],
    "House": ["Chris Lake", "Dom Dolla", "John Summit", "Diplo", "Fisher"],
    "Drum & Bass": ["Dimension", "Sub Focus", "Andy C", "Wilkinson", "Noisia"],
    "Dubstep": ["Excision", "Skrillex", "Zeds Dead", "Virtual Riot", "Eptic"],
    "Electronic / Dance": ["Calvin Harris", "Fred again..", "ODESZA", "ZHU", "Disclosure"],
    "Pop / International": ["Dua Lipa", "Bad Bunny", "Rema", "Rosalía", "The Weeknd"]
  };

  artistList.innerHTML = "";
  mockArtists[genreName].forEach((artist) => {
    const li = document.createElement("li");
    li.innerText = artist;
    artistList.appendChild(li);
  });
}
