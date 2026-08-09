const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

// Piped API Public Instances (Automatic Failover)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.video',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.adminforge.de'
];

// Extract YouTube Video ID
function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// Fetch direct audio stream URL from Piped API
async function getAudioStreamDetails(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await axios.get(`${instance}/streams/${videoId}`, { timeout: 5000 });
      if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
        // Sort streams to get highest quality audio
        const sortedAudio = response.data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        return {
          title: response.data.title || 'audio',
          downloadUrl: sortedAudio[0].url
        };
      }
    } catch (err) {
      console.log(`Instance ${instance} failed, trying next...`);
    }
  }
  throw new Error('All Piped instances failed to fetch stream.');
}

app.get('/', (req, res) => res.send('Backend Engine Online'));

// ROUTE 1: Standard Audio Download (Shorts / Long)
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: 'Please enter a valid YouTube link.' });
  }

  try {
    const { title, downloadUrl } = await getAudioStreamDetails(videoId);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    // Download stream & convert to MP3 via FFmpeg
    const audioStream = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream'
    });

    ffmpeg(audioStream.data)
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
  const videoUrl = req.query.url;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: 'Please enter a valid YouTube link.' });
  }

  try {
    const { title, downloadUrl } = await getAudioStreamDetails(videoId);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const audioStream = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream'
    });

    // Apply FFmpeg filters: +40% Bass Boost, 0.5 Pitch, 0.4x Speed
    ffmpeg(audioStream.data)
      .audioFilters([
        'equalizer=f=60:width_type=h:width=50:g=4',
        'asetrate=44100*0.5',
        'atempo=0.8'
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

