require('../lib/load-env').loadEnv();

const { transcribeAudioBase64 } = require('../lib/soniox');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio_b64, mime_type, source_language } = req.body;
    if (!audio_b64 || typeof audio_b64 !== 'string') {
      return res.status(400).json({ error: 'Provide audio_b64 for speech transcription.' });
    }

    const result = await transcribeAudioBase64(audio_b64, mime_type, source_language);
    return res.status(200).json(result);
  } catch (err) {
    console.error('STT error:', err?.bodyText || err.message || err);
    const message = err.message || 'Speech transcription failed.';
    const status = message.includes('Provide') || message.includes('No speech') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
};
