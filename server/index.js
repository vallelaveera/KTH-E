require('dotenv').config();

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '50mb' }));
app.use(express.static('../browser'));

app.post('/api/translate', async (req, res) => {
  try {
    const { source_language, text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Please provide text to translate.' });
    }

    const language = source_language || 'English';
    const systemPrompt = `You are a friendly language learning assistant. Translate text from Kannada, Telugu, or English into clear, natural English. If the input is already English, keep the meaning and improve readability without changing the meaning. Respond in JSON with two keys: "translation" and "note".`;
    const userPrompt = `Source language: ${language}
Text: ${text.trim()}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 400,
    });

    const raw = response?.content?.[0]?.text?.trim() || '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parsed = {
        translation: raw,
        note: 'Translation generated. If the output is not valid JSON, check the server logs.',
      };
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ error: 'Translation failed. Please try again.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '../browser' });
});

app.listen(PORT, () => {
  console.log(`
Language learning server running at http://localhost:${PORT}`);
});
