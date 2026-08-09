const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytdl = require('@distube/ytdl-core');

// Set static binary path for FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

// Custom headers to prevent YouTube from blocking Render server requests
const ytdlOptions = {
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  }
};

// Helper function to validate and extract video URL
function cleanUrl(url) {
  if (!url) return null;
  return ytdl.validateURL(url) ? url : null;
}

// Health Check Route
app.get('/', (req, res) => res.send('Audio Server Active and Running.'));

// ROUTE 1: Standard Audio Download (Shorts / Long)
app.get('/download-standard', async (req, res) => {
  const videoUrl = cleanUrl(req.query.url);

  if (!videoUrl) {
    return res.status(400).json({ error: 'Please provide a valid YouTube link using ?url=' });
  }

  try {
    const info = await ytdl.getInfo(videoUrl, ytdlOptions);
    const title = info.videoDetails.title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${title}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const audioStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
      ...ytdlOptions
    });

    ffmpeg(audioStream)
      .format('mp3')
      .on('error', (err) => console.error('Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Standard Route Error:', err.message);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// ROUTE 2: Modified Audio (0.4x Speed, 0.5 Pitch, +40% Bass Boost)
app.get('/download-fx', async (req, res) => {
  const videoUrl = cleanUrl(req.query.url);

  if (!videoUrl) {
    return res.status(400).json({ error: 'Please provide a valid YouTube link using ?url=' });
  }

  try {
    const info = await ytdl.getInfo(videoUrl, ytdlOptions);
    const title = info.videoDetails.title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${title}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const audioStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
      ...ytdlOptions
    });

    ffmpeg(audioStream)
      .audioFilters([
        'equalizer=f=60:width_type=h:width=50:g=4', // +40% Bass Boost (+4dB around 60Hz)
        'asetrate=44100*0.5',                       // 0.5x Pitch Shift
        'atempo=0.8'                                // ~0.4x Speed Adjustment
      ])
      .format('mp3')
      .on('error', (err) => console.error('FX Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('FX Route Error:', err.message);
    res.status(500).json({ error: 'Failed to apply audio FX.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
