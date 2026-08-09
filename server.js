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

const cookiesPath = path.resolve(__dirname, 'cookies.txt');

// Extract direct audio stream using yt-dlp
async function getAudioInfo(url) {
  const flags = {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    format: 'bestaudio/best',
    extractorArgs: 'youtube:player_client=ios,mweb,android'
  };

  // Automatically attach cookies if present
  if (fs.existsSync(cookiesPath)) {
    flags.cookies = cookiesPath;
  }

  try {
    const output = await youtubeDl(url, flags);
    return {
      title: output.title || 'youtube_audio',
      streamUrl: output.url
    };
  } catch (err) {
    console.error('Extraction attempt 1 failed, retrying with TV client fallback...');
    
    // Fallback client strategy if primary attempt fails
    flags.extractorArgs = 'youtube:player_client=tv_embedded';
    const output = await youtubeDl(url, flags);
    return {
      title: output.title || 'youtube_audio',
      streamUrl: output.url
    };
  }
}

// Health check endpoint
app.get('/', (req, res) => res.send('Audio Processing Server Active'));

// SECTION 1: Standard Audio Download Route
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Please enter a valid YouTube link using ?url=' });

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    ffmpeg(streamUrl)
      .format('mp3')
      .on('error', (err) => console.error('Standard Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Standard Route Error:', err.message);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// SECTION 2: Modified FX Audio Route (Bass Boost, Slow, Pitch)
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Please enter a valid YouTube link using ?url=' });

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
      .on('error', (err) => console.error('FX Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('FX Route Error:', err.message);
    res.status(500).json({ error: 'Failed to apply audio FX.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
      
