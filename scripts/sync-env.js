#!/usr/bin/env node
/**
 * Copy SONIOX_API_KEY (and ANTHROPIC_API_KEY if present) from LearnGerman into KTH-E/.env
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join('C:', 'Users', 'veera', 'learn_german', 'apps', 'web', '.env.local');
const DEST = path.join(__dirname, '..', '.env');
const KEYS = ['SONIOX_API_KEY', 'ANTHROPIC_API_KEY'];

if (!fs.existsSync(SOURCE)) {
  console.error('LearnGerman env not found at', SOURCE);
  process.exit(1);
}

const found = new Map();
for (const line of fs.readFileSync(SOURCE, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  if (KEYS.includes(match[1]) && match[2].trim()) {
    found.set(match[1], match[2].trim());
  }
}

if (!found.has('SONIOX_API_KEY')) {
  console.error('SONIOX_API_KEY not found in LearnGerman .env.local');
  process.exit(1);
}

const lines = KEYS.filter((key) => found.has(key)).map((key) => `${key}=${found.get(key)}`);
fs.writeFileSync(DEST, `${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} key(s) to ${DEST}`);
