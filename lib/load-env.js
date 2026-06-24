const fs = require('fs');
const path = require('path');

let loaded = false;

function loadEnv() {
  if (loaded) return;

  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    require('dotenv').config({ path: file });
    loaded = true;
    return file;
  }
}

module.exports = { loadEnv };
