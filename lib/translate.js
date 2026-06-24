const Anthropic = require('@anthropic-ai/sdk');
const { parseTranslationPayload } = require('./parse-json');

const MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are a friendly language learning assistant for Indian language learners.
Translate speech or text from Kannada, Telugu, Hindi, or English into clear, natural English.
If the input is already English, keep the meaning and lightly improve readability without changing intent.
Respond with ONLY valid JSON — no markdown fences, no commentary — using exactly these keys:
{"translation": "...", "note": "..."}
The note should be one short learning tip (grammar, vocabulary, or pronunciation) for the learner.`;

function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

async function translateToEnglish(sourceLanguage, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('Provide text to translate.');
  }

  const language = sourceLanguage || 'English';
  if (!hasAnthropicKey()) {
    if (language === 'English') {
      return {
        translation: trimmed,
        note: 'Your phrase is already in English. Use voice input for Soniox translation from Indian languages.',
      };
    }
    throw new Error('Text translation needs ANTHROPIC_API_KEY. Use voice input — Soniox handles speech translation.');
  }
  const userPrompt = `Source language: ${language}
Text: ${trimmed}`;

  const anthropic = createAnthropicClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response?.content?.[0]?.text?.trim() || '';

  try {
    return parseTranslationPayload(raw);
  } catch (err) {
    return {
      translation: raw.replace(/^```(?:json)?|```$/g, '').trim() || trimmed,
      note: 'Translation generated. Structured JSON parsing failed — showing raw model output.',
      parseWarning: err.message,
    };
  }
}

module.exports = {
  translateToEnglish,
};
