const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

// Helper to extract YouTube Video ID
function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// Helper to fetch direct stream URL via Cobalt Extractor Engine
async function getAudioStreamUrl(videoUrl) {
  try {
    const response = await axios.post('https://api.cobalt.tools/api/json', {
      url: videoUrl,
      downloadMode: 'audio',
      audioFormat: 'mp3'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.url) {
      return response.data.url;
    }
    throw new Error('No audio URL returned');
  } catch (err) {
    console.error('Cobalt engine fetch failed:', err.message);
    throw err;
  }
}

app.get('/', (req, res) => res.send('Audio Server Active'));

// ROUTE 1: Standard Download (Shorts / Long)
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: 'Please enter a valid YouTube link.' });
  }

  try {
    const directAudioUrl = await getAudioStreamUrl(videoUrl);

    res.header('Content-Disposition', `attachment; filename="youtube_audio_${videoId}.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    // Stream directly from clean source to client
    const audioResponse = await axios({
      method: 'get',
      url: directAudioUrl,
      responseType: 'stream'
    });

    audioResponse.data.pipe(res);

  } catch (err) {
    console.error('Standard Route Error:', err.message);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// ROUTE 2: Modified Audio (0.4x Speed, 0.5 Pitch, +40% Bass Boost)
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: 'Please enter a valid YouTube link.' });
  }

  try {
    const directAudioUrl = await getAudioStreamUrl(videoUrl);

    res.header('Content-Disposition', `attachment; filename="youtube_modded_${videoId}.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const audioResponse = await axios({
      method: 'get',
      url: directAudioUrl,
      responseType: 'stream'
    });

    // Apply FFmpeg Filters (+40% Bass, 0.5 Pitch, 0.4x Speed)
    ffmpeg(audioResponse.data)
      .audioFilters([
        'equalizer=f=60:width_type=h:width=50:g=4',
        'asetrate=44100*0.5',
        'atempo=0.8'
      ])
      .format('mp3')
      .on('error', (err) => console.error('FFmpeg Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('FX Route Error:', err.message);
    res.status(500).json({ error: 'Failed to apply custom audio FX.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

