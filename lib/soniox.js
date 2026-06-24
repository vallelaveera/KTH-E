const { SonioxNodeClient } = require('@soniox/node');
const { languageHintsFor } = require('./languages');

function createSonioxClient() {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY is not configured');
  }
  return new SonioxNodeClient({ api_key: apiKey });
}

async function transcribeAudioBase64(audioB64, mimeType, sourceLanguage) {
  const audioBuffer = Buffer.from(audioB64, 'base64');
  const ext = (mimeType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
  const client = createSonioxClient();

  const transcription = await client.stt.transcribeFromFile(audioBuffer, {
    filename: `recording.${ext}`,
    model: 'stt-async-v5',
    language_hints: languageHintsFor(sourceLanguage),
    wait: true,
    cleanup: ['file', 'transcription'],
    wait_options: { timeout_ms: 120000 },
  });

  if (transcription.status === 'error') {
    throw new Error(transcription.error_message || 'Speech transcription failed.');
  }

  const transcript = transcription.transcript || (await transcription.getTranscript());
  const text = transcript?.text?.trim() || '';
  if (!text) {
    throw new Error('No speech detected. Try speaking again.');
  }

  return { text };
}

async function synthesizeEnglishSpeech(text) {
  const spoken = String(text || '').trim();
  if (!spoken) {
    throw new Error('Provide text to generate speech.');
  }

  const client = createSonioxClient();
  const audio = await client.tts.generate({
    text: spoken,
    voice: 'Adrian',
    model: 'tts-rt-v1',
    language: 'en',
    audio_format: 'mp3',
  });

  const audioBuffer = Buffer.from(audio);
  return {
    audio_b64: audioBuffer.toString('base64'),
    mime_type: 'audio/mpeg',
  };
}

module.exports = {
  createSonioxClient,
  transcribeAudioBase64,
  synthesizeEnglishSpeech,
};
