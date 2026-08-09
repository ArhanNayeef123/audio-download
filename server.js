const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const youtubeDl = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

// Set up cookies file path
const cookiesPath = path.join(__dirname, 'cookies.txt');

// If cookies exist in environment variables (for safe deployment on Render), write them to file
if (process.env.YOUTUBE_COOKIES && !fs.existsSync(cookiesPath)) {
  fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES);
  console.log('Loaded cookies from environment variable.');
}

// Helper function to extract direct audio stream using yt-dlp & cookies
async function getAudioInfo(url) {
  try {
    const options = {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      format: 'bestaudio/best'
    };

    // Attach cookies if the file exists
    if (fs.existsSync(cookiesPath)) {
      options.cookies = cookiesPath;
    }

    const output = await youtubeDl(url, options);

    return {
      title: output.title || 'youtube_audio',
      streamUrl: output.url
    };
  } catch (err) {
    console.error('yt-dlp extraction error:', err.stderr || err.message);
    throw new Error('Could not extract YouTube audio.');
  }
}

// Health Check Route
app.get('/', (req, res) => res.send('Audio Extractor Backend Active with Cookies.'));

// ==========================================
// SECTION 1: STANDARD AUDIO DOWNLOAD
// ==========================================
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL using ?url=' });
  }

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    ffmpeg(streamUrl)
      .format('mp3')
      .on('error', (err) => console.error('FFmpeg Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Standard Route Error:', err.message);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// ==========================================
// SECTION 2: MODIFIED AUDIO FX (Slow, Pitch, Bass)
// ==========================================
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL using ?url=' });
  }

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    // Audio Filters: +40% Bass Boost, 0.5 Pitch, ~0.4x Speed
    ffmpeg(streamUrl)
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
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
