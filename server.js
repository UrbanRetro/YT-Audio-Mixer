const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.static('public'));

app.get('/api/audio', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('URL invalide');

  res.setHeader('Content-Type', 'audio/webm');

  const process = spawn('yt-dlp', [
    '-f', 'bestaudio',
    '--no-playlist',
    '-o', '-',
    url
  ]);

  process.stdout.pipe(res);

  process.stderr.on('data', data => {
    console.error('yt-dlp stderr:', data.toString());
  });

  process.on('error', err => {
    console.error('yt-dlp error:', err.message);
    if (!res.headersSent) res.status(500).send('Erreur lors du téléchargement de la vidéo');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));