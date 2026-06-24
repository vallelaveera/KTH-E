require('../lib/load-env').loadEnv();

const { synthesizeEnglishSpeech } = require('../lib/soniox');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    const result = await synthesizeEnglishSpeech(text);
    return res.status(200).json(result);
  } catch (err) {
    console.error('TTS error:', err?.bodyText || err.message || err);
    const message = err.message || 'Text-to-speech generation failed.';
    const status = message.includes('Provide') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
};
