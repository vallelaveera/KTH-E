const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio_b64, mime_type } = req.body;
    if (!audio_b64 || typeof audio_b64 !== 'string') {
      return res.status(400).json({ error: 'Provide audio_b64 for speech transcription.' });
    }

    const audioBuffer = Buffer.from(audio_b64, 'base64');
    const response = await axios.post(
      'https://api.soniox.com/v1/speech/transcribe',
      audioBuffer,
      {
        headers: {
          Authorization: `Bearer ${process.env.SONIOX_API_KEY}`,
          'Content-Type': mime_type || 'audio/webm'
        },
        responseType: 'json'
      }
    );

    const text = response.data?.text || response.data?.transcript || '';
    return res.status(200).json({ text });
  } catch (err) {
    console.error('STT error:', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Speech transcription failed.' });
  }
};
