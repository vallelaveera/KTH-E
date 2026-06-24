/** Source language labels → Soniox ISO codes */
const SOURCE_LANGUAGES = {
  Kannada: { code: 'kn', hints: ['kn', 'en'] },
  Telugu: { code: 'te', hints: ['te', 'en'] },
  Hindi: { code: 'hi', hints: ['hi', 'en'] },
  English: { code: 'en', hints: ['en'] },
};

function resolveSourceLanguage(label) {
  return SOURCE_LANGUAGES[label] || SOURCE_LANGUAGES.English;
}

function languageHintsFor(label) {
  return resolveSourceLanguage(label).hints;
}

module.exports = {
  SOURCE_LANGUAGES,
  resolveSourceLanguage,
  languageHintsFor,
};
