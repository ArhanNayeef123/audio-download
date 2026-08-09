const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set static FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();

// Enable Cross-Origin Request Sharing
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('Server is online and running.');
});

// ROUTE 1: Standard Audio Download (Shorts / Long)
app.get('/download-standard', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl || !ytdl.validateURL(videoUrl)) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const cleanTitle = info.videoDetails.title.replace(/[^\w\s.-]/gi, '');

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_standard.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
    }).pipe(res);

  } catch (err) {
    console.error('Standard download error:', err);
    res.status(500).json({ error: 'Failed to extract YouTube audio.' });
  }
});

// ROUTE 2: Modified Audio (0.4x Speed, 0.5 Pitch, +40% Bass Boost)
app.get('/download-fx', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl || !ytdl.validateURL(videoUrl)) {
    return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const cleanTitle = info.videoDetails.title.replace(/[^\w\s.-]/gi, '');

    res.header('Content-Disposition', `attachment; filename="${cleanTitle}_modded.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const audioStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
    });

    /**
     * FFmpeg Filters:
     * - equalizer=f=60:width_type=h:width=50:g=4  => Bass Boost (+40% gain around 60Hz)
     * - asetrate=44100*0.5                       => Pitch shift to 0.5x
     * - atempo=0.8                               => Overall speed adjustment to 0.4x
     */
    ffmpeg(audioStream)
      .audioFilters([
        'equalizer=f=60:width_type=h:width=50:g=4',
        'asetrate=44100*0.5',
        'atempo=0.8'
      ])
      .format('mp3')
      .on('error', (err) => {
        console.error('FFmpeg processing error:', err);
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error('FX processing error:', err);
    res.status(500).json({ error: 'Failed to process custom audio effects.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
