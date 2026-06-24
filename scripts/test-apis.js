require('../lib/load-env').loadEnv();

const { synthesizeEnglishSpeech, translateAudioToEnglish } = require('../lib/soniox');
const { SonioxNodeClient } = require('@soniox/node');

async function main() {
  console.log('SONIOX_API_KEY:', process.env.SONIOX_API_KEY ? 'set' : 'MISSING');

  console.log('\n1) TTS test...');
  const tts = await synthesizeEnglishSpeech('Hello from KTH-E local test.');
  console.log('TTS ok:', tts.mime_type, 'bytes', tts.audio_b64.length);

  console.log('\n2) Voice translate test (Soniox sample audio)...');
  const client = new SonioxNodeClient({ api_key: process.env.SONIOX_API_KEY });
  const job = await client.stt.translate({
    audio_url: 'https://soniox.com/media/examples/coffee_shop.mp3',
    from: 'en',
    to: 'en',
    wait: true,
    wait_options: { timeout_ms: 120000 },
  });
  const translation = job.translation || (await job.getTranslation());
  console.log('Sample original:', translation?.original_text?.slice(0, 80));
  console.log('Sample english:', translation?.translation_text?.slice(0, 80));

  console.log('\nAll API checks passed.');
}

main().catch((err) => {
  console.error('TEST FAILED:', err.message || err);
  process.exit(1);
});
