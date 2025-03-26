/*********************************************
 * app.js — Lecture audio en mémoire (solution #2)
 * - On fetch() l'audio depuis /api/audio?url=...
 * - On décode en AudioBuffer avec decodeAudioData()
 * - On gère la lecture via AudioBufferSourceNode
 * - On n'utilise plus <audio> ni createMediaElementSource()
 *********************************************/

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Petit helper pour formater l'affichage mm:ss
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Structure interne pour chaque Deck
 * On stocke :
 *  - audioBuffer     : le contenu décodé
 *  - sourceNode      : la source en lecture (ou null si aucune lecture)
 *  - isPlaying       : booléen (lecture en cours ?)
 *  - playOffset      : position actuelle (en secondes)
 *  - startTime       : date/heure (en audioContext.currentTime) du dernier lancement
 *  - nodes (gain, EQ)
 */
function createDeck(deckId) {
  // Sélecteurs DOM
  const loadBtn       = document.getElementById(`load${deckId}`);
  const urlInput      = document.getElementById(`url${deckId}`);
  const statusLabel   = document.getElementById(`status${deckId}`);
  const seek          = document.getElementById(`seek${deckId}`);
  const progressContainer = document.getElementById(`progressContainer${deckId}`);
  const currentTimeEl = document.getElementById(`currentTime${deckId}`);
  const durationEl    = document.getElementById(`duration${deckId}`);
  const playBtn       = document.getElementById(`playPause${deckId}`);
  const muteBtn       = document.getElementById(`mute${deckId}`);
  const volumeControl = document.getElementById(`volume${deckId}`);

  // Création des filtres / noeuds
  const gainNode  = audioContext.createGain();
  const bassEQ    = audioContext.createBiquadFilter();
  const midEQ     = audioContext.createBiquadFilter();
  const trebleEQ  = audioContext.createBiquadFilter();

  // Configuration des filtres
  bassEQ.type       = 'lowshelf';
  bassEQ.frequency.value  = 200;

  midEQ.type        = 'peaking';
  midEQ.frequency.value   = 1000;

  trebleEQ.type     = 'highshelf';
  trebleEQ.frequency.value= 4000;

  // Chaînage final : source -> bassEQ -> midEQ -> trebleEQ -> gainNode -> destination
  // (mais attention : la source n'est créée qu'au moment de la lecture)

  // État interne du deck
  let audioBuffer = null;    // Stocke le buffer décodé
  let sourceNode  = null;    // Le BufferSource en cours
  let isPlaying   = false;
  let isMuted     = false;
  let lastVolume  = 1.0;

  let playOffset  = 0;       // position de lecture en secondes
  let startTime   = 0;       // quand on a lancé la lecture (audioContext.currentTime)
  let durationSec = 0;       // durée totale du buffer

  // Désactiver certains boutons tant qu'on n'a rien chargé
  playBtn.disabled = true;
  muteBtn.disabled = true;
  volumeControl.disabled = true;

  /********************************************
   * Fonctions internes
   ********************************************/

  // Crée un nouveau BufferSource, connecte la chaîne d'effets, et démarre la lecture
  function startPlayback(offsetSec) {
    if (!audioBuffer) return;

    // S'il y avait déjà une source en lecture, on l'arrête
    stopPlayback();

    // On recrée une source
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Chaînage
    sourceNode.connect(bassEQ)
              .connect(midEQ)
              .connect(trebleEQ)
              .connect(gainNode)
              .connect(audioContext.destination);

    // On démarre à offsetSec
    sourceNode.start(0, offsetSec);

    // On stocke le moment où on a démarré (en "audioContext.currentTime")
    startTime = audioContext.currentTime;
    playOffset = offsetSec; 
    isPlaying = true;

    // Quand la lecture arrive à la fin du buffer
    sourceNode.onended = () => {
      // La lecture est terminée
      stopPlayback(true); // onStop complet => param pour "lecture terminée"
    };
  }

  // Arrête la source en cours
  function stopPlayback(ended = false) {
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch (e) {
        // ignore error if already stopped
      }
      sourceNode.disconnect();
      sourceNode = null;
    }
    isPlaying = false;
    // Force UI update to reflect paused state
    playBtn.textContent = '▶ Play';
  }

  // Met à jour l'affichage (barre de progression, currentTime)
  // Appelé régulièrement via requestAnimationFrame ou setInterval
  function updateUI() {
    if (isPlaying && sourceNode) {
      // Update current time while playing
      const elapsed = audioContext.currentTime - startTime;
      const nowSec = playOffset + elapsed;
      if (nowSec >= durationSec) {
        currentTimeEl.textContent = formatTime(durationSec);
        seek.value = 100;
      } else {
        currentTimeEl.textContent = formatTime(nowSec);
        seek.value = (nowSec / durationSec) * 100;
      }
    } else {
      // Update to paused state
      playBtn.textContent = '▶ Play';
      currentTimeEl.textContent = formatTime(playOffset);
      seek.value = (playOffset / durationSec) * 100;
    }
    requestAnimationFrame(updateUI);
  }

  // Lance la boucle d'UI
  requestAnimationFrame(updateUI);

  /********************************************
   * Gestion des événements
   ********************************************/

  // ----- BOUTON LOAD -----
  loadBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) return;

    // Reset l'état précédent
    stopPlayback();
    audioBuffer = null;
    isPlaying   = false;
    playOffset  = 0;
    startTime   = 0;
    durationSec = 0;
    playBtn.disabled = true;
    muteBtn.disabled = true;
    volumeControl.disabled = true;
    seek.value = 0;
    currentTimeEl.textContent = '0:00';
    durationEl.textContent    = '0:00';
    statusLabel.classList.remove('hidden');
    statusLabel.textContent = 'Loading...';

    // On fetch le flux audio
    fetch(`/api/audio?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server error: ${res.status} - ${res.statusText}`);
        }
        return res.arrayBuffer();
      })
      .then((arrayBuf) => {
        // Décodage en AudioBuffer
        return audioContext.decodeAudioData(arrayBuf);
      })
      .then((decodedBuffer) => {
        audioBuffer = decodedBuffer;
        durationSec = audioBuffer.duration;

        // Mise à jour de l'UI
        progressContainer.classList.remove('hidden');
        durationEl.textContent = formatTime(durationSec);
        statusLabel.classList.add('hidden');

        // Active les contrôles
        playBtn.disabled = false;
        muteBtn.disabled = false;
        volumeControl.disabled = false;
      })
      .catch((err) => {
        console.error('Error loading audio:', err);
        statusLabel.textContent = `❌ Error: ${err.message}`;
      });
  });

  // ----- BOUTON PLAY/PAUSE -----
  playBtn.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    if (!audioBuffer) return; // Rien à jouer

    if (!isPlaying) {
      // On démarre/relance la lecture
      startPlayback(playOffset);
      playBtn.textContent = '⏸️ Pause';
    } else {
      // On met en pause
      stopPlayback();
      playBtn.textContent = '▶ Play';
    }
  });

  // ----- BOUTON MUTE -----
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      lastVolume = gainNode.gain.value;
      gainNode.gain.value = 0;
      muteBtn.textContent = '🔊 Unmute';
    } else {
      gainNode.gain.value = lastVolume;
      muteBtn.textContent = '🔇 Mute';
    }
  });

  // ----- SLIDER SEEK -----
  seek.addEventListener('input', (e) => {
    if (!audioBuffer) return;
    const seekPercent = parseFloat(e.target.value);
    const newTime = (seekPercent / 100) * durationSec;

    const wasPlaying = isPlaying;
    stopPlayback();
    playOffset = newTime;

    if (wasPlaying) {
        // Restart playback and update state
        startPlayback(playOffset);
        playBtn.textContent = '⏸️ Pause';
    }
    // UI will update through requestAnimationFrame
  });

  // ----- SLIDER VOLUME -----
  volumeControl.addEventListener('input', (e) => {
    gainNode.gain.value = e.target.value;
    lastVolume = gainNode.gain.value;
  });

  // ----- SLIDERS EQ -----
  ['bass', 'mid', 'treble'].forEach((type) => {
    const eqSlider = document.getElementById(`${type}${deckId}`);
    eqSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (type === 'bass') {
        bassEQ.gain.value = value;
      } else if (type === 'mid') {
        midEQ.gain.value = value;
      } else if (type === 'treble') {
        trebleEQ.gain.value = value;
      }
    });
  });

  // On renvoie le gainNode pour le crossfader
  return gainNode;
}

// Création des deux decks
const deckA = createDeck('A');
const deckB = createDeck('B');

// Crossfader : ajuster le gain respectif
document.getElementById('crossfader').addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  deckA.gain.value = 1 - value;
  deckB.gain.value = value;
});