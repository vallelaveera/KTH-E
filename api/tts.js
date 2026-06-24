const { SonioxNodeClient } = require('@soniox/node');

function createSonioxClient() {
  return new SonioxNodeClient({ apiKey: process.env.SONIOX_API_KEY });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Provide text to generate speech.' });
    }

    const sonioxClient = createSonioxClient();
    const audio = await sonioxClient.tts.generate({
      text: text.trim(),
      voice: 'Adrian',
      model: 'tts-rt-v1',
      language: 'en',
      audio_format: 'wav',
      sample_rate: 24000
    });

    const audioBuffer = Buffer.from(audio);
    return res.status(200).json({ audio_b64: audioBuffer.toString('base64') });
  } catch (err) {
    console.error('TTS error:', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Text-to-speech generation failed.' });
  }
};
