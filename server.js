const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const youtubeDl = require('yt-dlp-exec');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

const cookiesPath = path.resolve(__dirname, 'cookies.txt');

// Extract Video ID helper
function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// Fallback extraction method using Invidious API (No bot check issue)
async function getFallbackAudioUrl(videoId) {
  const instances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.drgns.space',
    'https://yt.artemislena.eu'
  ];

  for (const instance of instances) {
    try {
      const res = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: 5000 });
      if (res.data && res.data.adaptiveFormats) {
        const audioStreams = res.data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
        if (audioStreams.length > 0) {
          audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          return {
            title: res.data.title || 'youtube_audio',
            streamUrl: audioStreams[0].url
          };
        }
      }
    } catch (e) {
      console.log(`Fallback ${instance} failed, trying next...`);
    }
  }
  throw new Error('All fallback extraction servers failed.');
}

// Main Audio Info Extractor
async function getAudioInfo(url) {
  // Method A: Try yt-dlp with Desktop Chrome User-Agent + Cookies
  try {
    const flags = {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      format: 'bestaudio/best',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
    };

    if (fs.existsSync(cookiesPath)) {
      flags.cookies = cookiesPath;
    }

    const output = await youtubeDl(url, flags);
    return {
      title: output.title || 'youtube_audio',
      streamUrl: output.url
    };
  } catch (err) {
    console.warn('yt-dlp failed or blocked. Switching to Fallback API Engine...');
    
    // Method B: Automatic Fallback
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error('Invalid YouTube URL');
    return await getFallbackAudioUrl(videoId);
  }
}

app.get('/', (req, res) => res.send('YouTube Audio Processing Engine Live'));

// ROUTE 1: Standard Download
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Please pass ?url=' });

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    ffmpeg(streamUrl)
      .format('mp3')
      .on('error', (err) => console.error('FFmpeg Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Standard Route Error:', err.message);
    res.status(500).json({ error: 'Failed to extract YouTube audio stream.' });
  }
});

// ROUTE 2: Modified FX Audio (Bass, Speed, Pitch)
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Please pass ?url=' });

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    ffmpeg(streamUrl)
      .audioFilters([
        'equalizer=f=60:width_type=h:width=50:g=4',
        'asetrate=44100*0.5',
        'atempo=0.8'
      ])
      .format('mp3')
      .on('error', (err) => console.error('FX FFmpeg Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('FX Route Error:', err.message);
    res.status(500).json({ error: 'Failed to process modified audio.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
      
