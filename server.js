const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const youtubeDl = require('yt-dlp-exec');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to extract direct audio URL & Title using yt-dlp
async function getAudioInfo(url) {
  try {
    const output = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      format: 'bestaudio/best',
      youtubeSkipDashManifest: true
    });

    return {
      title: output.title || 'youtube_audio',
      streamUrl: output.url
    };
  } catch (err) {
    console.error('yt-dlp extraction error:', err.stderr || err.message);
    throw new Error('Could not extract YouTube video info.');
  }
}

app.get('/', (req, res) => res.send('Audio Server Active (yt-dlp engine)'));

// ROUTE 1: Standard Audio Download (Shorts / Long)
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Please enter a YouTube URL using ?url=' });
  }

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    // Stream directly from raw GoogleVideo audio link into FFmpeg MP3 output
    ffmpeg(streamUrl)
      .format('mp3')
      .on('error', (err) => console.error('FFmpeg Stream Error:', err.message))
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Standard Route Error:', err.message);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// ROUTE 2: Modified Audio (0.4x Speed, 0.5 Pitch, +40% Bass Boost)
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Please enter a YouTube URL using ?url=' });
  }

  try {
    const { title, streamUrl } = await getAudioInfo(videoUrl);
    const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'audio';

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    // Apply FFmpeg filters: +40% Bass, 0.5 Pitch, ~0.4x Speed
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
