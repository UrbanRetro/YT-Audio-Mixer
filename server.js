const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.static('public'));

app.get('/api/audio', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing URL parameter');

    try {
        // Get video duration
        const info = await new Promise((resolve, reject) => {
            exec(`yt-dlp --dump-json ${url}`, { timeout: 30000 }, (error, stdout) => {
                error ? reject(error) : resolve(JSON.parse(stdout));
            });
        });

        const durationMinutes = Math.floor(info.duration / 60);
        if (durationMinutes > 20) {
            return res.status(403).send('Video exceeds 20 minute limit');
        }

        // Generate unique filename
        const filename = `audio_${Date.now()}.mp3`;
        const outputPath = path.join(__dirname, 'tmp', filename);

        // Download audio with improved error handling
        await new Promise((resolve, reject) => {
            const child = exec(
                `yt-dlp -x --audio-format mp3 -o "${outputPath}.%(ext)s" "${url}"`, 
                {
                    timeout: 120000,
                    shell: '/bin/bash'
                }
            );

            // Handle process cleanup
            child.on('error', reject);
            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp exited with code ${code}`));
                } else {
                    resolve();
                }
            });

            // Handle EPIPE specifically
            child.stdout.on('error', error => {
                if (error.code !== 'EPIPE') reject(error);
            });
            child.stderr.on('error', error => {
                if (error.code !== 'EPIPE') reject(error);
            });
        });

        // Stream file and delete after sending
        res.sendFile(outputPath, () => {
            fs.unlink(outputPath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        });

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send(error.message);
    }
});

// Create tmp directory if not exists
if (!fs.existsSync('tmp')) {
    fs.mkdirSync('tmp');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});