/**
 * Parse JSON from LLM output — strips markdown fences and extracts object payloads.
 * Mirrors LearnGerman listening/generate parseJsonPayload pattern.
 */
function parseJsonObject(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty model response');
  }

  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = fenced ? [fenced[1].trim(), trimmed] : [trimmed];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // try next candidate
    }

    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // continue
      }
    }
  }

  throw new Error('Could not parse JSON from model response');
}

function parseTranslationPayload(raw) {
  const parsed = parseJsonObject(raw);
  const translation = typeof parsed.translation === 'string' ? parsed.translation.trim() : '';
  const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';

  if (!translation) {
    throw new Error('Model response missing translation field');
  }

  return { translation, note };
}

module.exports = {
  parseJsonObject,
  parseTranslationPayload,
};
