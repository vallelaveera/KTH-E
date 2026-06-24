require('../lib/load-env').loadEnv();

const { translateToEnglish } = require('../lib/translate');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { source_language, text } = req.body;
    const result = await translateToEnglish(source_language, text);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Translate error:', err);
    const message = err.message || 'Translation failed. Please try again.';
    const status = message.includes('Provide text') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
};
