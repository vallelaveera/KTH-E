const { SonioxNodeClient } = require('@soniox/node');
const { resolveSourceLanguage } = require('./languages');

function createSonioxClient() {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY is not configured');
  }
  return new SonioxNodeClient({ api_key: apiKey });
}

function audioFilename(mimeType) {
  const mime = mimeType || 'audio/webm';
  if (mime.includes('mp4')) return 'recording.mp4';
  if (mime.includes('wav')) return 'recording.wav';
  return 'recording.webm';
}

function buildLearningNote(sourceLanguage, original, translation) {
  if (sourceLanguage === 'English') {
    return 'You spoke in English. Listen to the natural pronunciation of your phrase.';
  }
  return `You said: "${original}". In English: "${translation}". Try repeating the English phrase aloud.`;
}

function sonioxErrorMessage(err) {
  const body = err?.bodyText || '';
  const message = err?.message || String(err || '');
  const combined = `${message} ${body}`.toLowerCase();
  if (combined.includes('audio duration') || combined.includes('invalid audio')) {
    return 'Could not read the recording. Speak for at least one second, then stop.';
  }
  return message || 'Speech processing failed.';
}

async function translateAudioToEnglish(audioB64, mimeType, sourceLanguage) {
  const audioBuffer = Buffer.from(audioB64, 'base64');
  if (audioBuffer.length < 1024) {
    throw new Error('Recording too short. Speak for at least one second.');
  }
  const { code } = resolveSourceLanguage(sourceLanguage);
  const client = createSonioxClient();

  let job;
  try {
    job = await client.stt.translate({
      file: audioBuffer,
      filename: audioFilename(mimeType),
      from: code,
      to: 'en',
      model: 'stt-async-v5',
      wait: true,
      cleanup: ['file', 'transcription'],
      wait_options: { timeout_ms: 120000 },
    });
  } catch (err) {
    throw new Error(sonioxErrorMessage(err));
  }

  if (job.status === 'error') {
    throw new Error(sonioxErrorMessage({ message: job.error_message }));
  }

  const result = job.translation || (await job.getTranslation());
  if (!result || result.mode !== 'one_way') {
    throw new Error('Translation result unavailable.');
  }

  const text = result.original_text?.trim() || '';
  const translation = result.translation_text?.trim() || '';
  if (!text && !translation) {
    throw new Error('No speech detected. Try speaking again.');
  }

  return {
    text,
    translation: translation || text,
    note: buildLearningNote(sourceLanguage, text, translation || text),
  };
}

async function transcribeAudioBase64(audioB64, mimeType, sourceLanguage) {
  const audioBuffer = Buffer.from(audioB64, 'base64');
  const client = createSonioxClient();

  const transcription = await client.stt.transcribeFromFile(audioBuffer, {
    filename: audioFilename(mimeType),
    model: 'stt-async-v5',
    language_hints: resolveSourceLanguage(sourceLanguage).hints,
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
  translateAudioToEnglish,
  synthesizeEnglishSpeech,
};
