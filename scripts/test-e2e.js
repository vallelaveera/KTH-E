async function main() {
  console.log('Fetching sample audio...');
  const audioRes = await fetch('https://soniox.com/media/examples/coffee_shop.mp3');
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  const audio_b64 = buffer.toString('base64');

  console.log('POST /api/voice (English source)...');
  const voiceRes = await fetch('http://localhost:3000/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_b64,
      mime_type: 'audio/mpeg',
      source_language: 'English',
    }),
  });
  const voiceRaw = await voiceRes.text();
  const voiceData = JSON.parse(voiceRaw);
  if (!voiceRes.ok) throw new Error(voiceData.error || 'voice failed');
  console.log('text:', voiceData.text?.slice(0, 100));
  console.log('translation:', voiceData.translation?.slice(0, 100));
  console.log('note:', voiceData.note?.slice(0, 100));

  console.log('POST /api/tts...');
  const ttsRes = await fetch('http://localhost:3000/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: voiceData.translation }),
  });
  const ttsData = JSON.parse(await ttsRes.text());
  if (!ttsRes.ok) throw new Error(ttsData.error || 'tts failed');
  console.log('tts bytes:', ttsData.audio_b64.length);

  console.log('\nEnd-to-end voice pipeline OK');
}

main().catch((err) => {
  console.error('E2E FAILED:', err.message);
  process.exit(1);
});
