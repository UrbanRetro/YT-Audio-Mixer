// app.js

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function createDeck(deckId) {
    const player = document.getElementById(`player${deckId}`);
    const status = document.getElementById(`status${deckId}`);
    // Replace progress with seek control
    const seek = document.getElementById(`seek${deckId}`);
    const progressContainer = document.getElementById(`progressContainer${deckId}`);
    const currentTime = document.getElementById(`currentTime${deckId}`);
    const duration = document.getElementById(`duration${deckId}`);

    // Audio nodes
    const gainNode = audioContext.createGain();
    const bassEQ = audioContext.createBiquadFilter();
    const midEQ = audioContext.createBiquadFilter();
    const trebleEQ = audioContext.createBiquadFilter();

    // EQ setup
    bassEQ.type = 'lowshelf';
    bassEQ.frequency.value = 200;
    midEQ.type = 'peaking';
    midEQ.frequency.value = 1000;
    trebleEQ.type = 'highshelf';
    trebleEQ.frequency.value = 4000;

    // Connect nodes
    const source = audioContext.createMediaElementSource(player);
    source.connect(bassEQ)
         .connect(midEQ)
         .connect(trebleEQ)
         .connect(gainNode)
         .connect(audioContext.destination);

    // Event handlers
    document.getElementById(`load${deckId}`).addEventListener('click', () => {
        const url = document.getElementById(`url${deckId}`).value;
        if (url) {
            player.src = `/api/audio?url=${encodeURIComponent(url)}`;
            status.classList.remove('hidden');
            status.innerHTML = '<div class="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> Loading...';
        }
    });

    player.addEventListener('timeupdate', () => {
        // Update seek value instead of progress bar width
        const progressPercent = (player.currentTime / player.duration) * 100;
        seek.value = progressPercent;
        currentTime.textContent = formatTime(player.currentTime);
    });

    // Dans la fonction createDeck, modifier l'événement loadedmetadata
    player.addEventListener('loadedmetadata', () => {
        progressContainer.classList.remove('hidden');
        duration.textContent = formatTime(player.duration);
    });
    
    // Modifier les gestionnaires de seek en bas du fichier
    // In createDeck function, after getting the seek element
    seek.addEventListener('input', (e) => {
        const seekPercent = e.target.value;
        const seekTime = (seekPercent / 100) * player.duration;
        player.currentTime = seekTime;
    });

    // In createDeck function, add these variables
    const playBtn = document.getElementById(`playPause${deckId}`);
    let isPlaying = false;

    // Add play/pause handler
    playBtn.addEventListener('click', () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        if (!isPlaying) {
            player.play();
            playBtn.textContent = '⏸️ Pause';
        } else {
            player.pause();
            playBtn.textContent = '▶ Play';
        }
        isPlaying = !isPlaying;
    });
    
    // Update the canplaythrough handler
    player.addEventListener('canplaythrough', () => {
        status.classList.add('hidden');
        playBtn.disabled = false;
    });
    
    // Add error handling
    player.addEventListener('error', () => {
        status.innerHTML = '❌ Error loading audio';
        playBtn.disabled = true;
    });
    
    // Add pause handler
    player.addEventListener('pause', () => {
        isPlaying = false;
        playBtn.textContent = '▶ Play';
    });

    // Volume and EQ controls
    const volumeControl = document.getElementById(`volume${deckId}`);
    if (!volumeControl) {
        console.error(`Volume control not found for deck ${deckId}`);
        return;
    }

    volumeControl.addEventListener('input', (e) => {
        gainNode.gain.value = e.target.value;
    });

    ['bass', 'mid', 'treble'].forEach(type => {
        document.getElementById(`${type}${deckId}`).addEventListener('input', (e) => {
            eval(`${type}EQ`).gain.value = e.target.value;
        });
    });

    return gainNode;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Initialize decks
const deckA = createDeck('A');
const deckB = createDeck('B');

// Crossfader
document.getElementById('crossfader').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    deckA.gain.value = 1 - value;
    deckB.gain.value = value;
});