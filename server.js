const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Innertube, UniversalCache } = require('youtubei.js');

// Set static FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

let yt;

// Initialize YouTube Client with iOS settings to bypass cloud IP blocks
(async () => {
  try {
    yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
      client_type: 'IOS'
    });
    console.log('YouTube client successfully initialized!');
  } catch (err) {
    console.error('Failed to initialize YouTube client:', err);
  }
})();

// Helper to extract YouTube Video ID from standard, mobile, or shorts links
function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// Health Check Endpoint
app.get('/', (req, res) => res.send('Server is active and ready.'));

// ROUTE 1: Standard Audio Download (Shorts / Long)
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }

  try {
    const info = await yt.getBasicInfo(videoId);
    const cleanTitle = info.basic_info.title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    // Download audio stream using youtubei.js
    const stream = await yt.download(videoId, {
      type: 'audio',
      quality: 'best',
      client: 'IOS'
    });

    // Pipe stream through FFmpeg to format as standard MP3
    ffmpeg(stream)
      .format('mp3')
      .on('error', (err) => console.error('Streaming error:', err))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Standard route error:', err);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// ROUTE 2: Modified Audio (0.4x Speed, 0.5 Pitch, +40% Bass Boost)
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }

  try {
    const info = await yt.getBasicInfo(videoId);
    const cleanTitle = info.basic_info.title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const stream = await yt.download(videoId, {
      type: 'audio',
      quality: 'best',
      client: 'IOS'
    });

    // Apply FFmpeg filters: +40% gain bass boost, 0.5x pitch, 0.4x speed
    ffmpeg(stream)
      .audioFilters([
        'equalizer=f=60:width_type=h:width=50:g=4',
        'asetrate=44100*0.5',
        'atempo=0.8'
      ])
      .format('mp3')
      .on('error', (err) => console.error('FX streaming error:', err))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('FX route error:', err);
    res.status(500).json({ error: 'Failed to apply audio effects.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

