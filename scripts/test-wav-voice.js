const fs = require('fs');
const path = require('path');

// Minimal WAV encoder for Node test (simulates browser upload)
function encodeWavFromPcm16(pcmBuffer, sampleRate = 16000, channels = 1) {
  const samples = pcmBuffer.length / 2;
  const buffer = Buffer.alloc(44 + pcmBuffer.length);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}

async function main() {
  require('../lib/load-env').loadEnv();

  const res = await fetch('https://soniox.com/media/examples/coffee_shop.mp3');
  const mp3 = Buffer.from(await res.arrayBuffer());

  // Send mp3 directly first (known good)
  console.log('Test 1: MP3 sample via /api/voice...');
  let voiceRes = await fetch('http://localhost:3000/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_b64: mp3.toString('base64'),
      mime_type: 'audio/mpeg',
      source_language: 'English',
    }),
  });
  let data = JSON.parse(await voiceRes.text());
  if (!voiceRes.ok) throw new Error(data.error || 'mp3 voice failed');
  console.log('MP3 ok:', data.text.slice(0, 60));

  // Tiny invalid blob should fail gracefully
  console.log('Test 2: short blob rejected...');
  voiceRes = await fetch('http://localhost:3000/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_b64: Buffer.from('abc').toString('base64'),
      mime_type: 'audio/wav',
      source_language: 'English',
    }),
  });
  data = JSON.parse(await voiceRes.text());
  console.log('Short blob status:', voiceRes.status, data.error);

  console.log('\nWAV path tests passed.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
