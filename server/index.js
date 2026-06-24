require('dotenv').config();

const express = require('express');
const path = require('path');
const { translateToEnglish } = require('../lib/translate');
const { transcribeAudioBase64, synthesizeEnglishSpeech } = require('../lib/soniox');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../browser')));

app.post('/api/translate', async (req, res) => {
  try {
    const { source_language, text } = req.body;
    const result = await translateToEnglish(source_language, text);
    return res.json(result);
  } catch (err) {
    console.error('Translate error:', err);
    const message = err.message || 'Translation failed. Please try again.';
    const status = message.includes('Provide text') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post('/api/stt', async (req, res) => {
  try {
    const { audio_b64, mime_type, source_language } = req.body;
    if (!audio_b64 || typeof audio_b64 !== 'string') {
      return res.status(400).json({ error: 'Provide audio_b64 for speech transcription.' });
    }
    const result = await transcribeAudioBase64(audio_b64, mime_type, source_language);
    return res.json(result);
  } catch (err) {
    console.error('STT error:', err);
    const message = err.message || 'Speech transcription failed.';
    const status = message.includes('Provide') || message.includes('No speech') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    const result = await synthesizeEnglishSpeech(text);
    return res.json(result);
  } catch (err) {
    console.error('TTS error:', err);
    const message = err.message || 'Text-to-speech generation failed.';
    const status = message.includes('Provide') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../browser/index.html'));
});

app.listen(PORT, () => {
  console.log(`KTH-E voice learner running at http://localhost:${PORT}`);
});
