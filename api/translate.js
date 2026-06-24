const Anthropic = require('@anthropic-ai/sdk');

function createAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { source_language, text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Provide text to translate.' });
    }

    const language = source_language || 'English';
    const systemPrompt = `You are a friendly language learning assistant. Translate text from Kannada, Telugu, or English into clear, natural English. If the input is already English, keep the meaning and improve readability without changing the meaning. Respond in strict JSON with keys: \"translation\" and \"note\".`;
    const userPrompt = `Source language: ${language}
Text: ${text.trim()}`;

    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 400
    });

    const raw = response?.content?.[0]?.text?.trim() || '';
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parsed = {
        translation: raw,
        note: 'Translation generated. The server could not parse structured JSON from the model response.',
      };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ error: 'Translation failed. Please try again.' });
  }
};
