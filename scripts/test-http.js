async function main() {
  console.log('1) TTS endpoint...');
  const ttsRes = await fetch('http://localhost:3000/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Local server test.' }),
  });
  const ttsRaw = await ttsRes.text();
  let ttsData;
  try { ttsData = JSON.parse(ttsRaw); } catch { throw new Error('TTS not JSON: ' + ttsRaw.slice(0, 120)); }
  if (!ttsRes.ok) throw new Error(ttsData.error || 'TTS failed');
  console.log('TTS ok, audio bytes:', ttsData.audio_b64.length);

  console.log('2) Voice endpoint (invalid audio expects JSON error)...');
  const voiceRes = await fetch('http://localhost:3000/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_b64: 'AAAA', mime_type: 'audio/webm', source_language: 'English' }),
  });
  const voiceRaw = await voiceRes.text();
  let voiceData;
  try { voiceData = JSON.parse(voiceRaw); } catch { throw new Error('Voice not JSON: ' + voiceRaw.slice(0, 120)); }
  console.log('Voice status:', voiceRes.status, voiceData.error || voiceData.translation?.slice(0, 40));

  console.log('3) Index page...');
  const pageRes = await fetch('http://localhost:3000/');
  console.log('Page status:', pageRes.status, pageRes.headers.get('content-type'));

  console.log('\nHTTP checks passed.');
}

main().catch((err) => {
  console.error('HTTP TEST FAILED:', err.message);
  process.exit(1);
});
