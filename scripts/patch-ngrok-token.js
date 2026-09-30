// Expo's CLI hardcodes a shared ngrok authtoken for `expo start --tunnel`,
// used by every Expo developer worldwide. It regularly hits ngrok's global
// session cap (ERR_NGROK_108) and fails with a cryptic TypeError.
// This lets a personal token (set as EXPO_NGROK_AUTHTOKEN in .env.local) override it.
// Runs on postinstall since the target file lives in node_modules and gets wiped on reinstall.
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js',
);

if (!fs.existsSync(target)) {
  console.warn('[patch-ngrok-token] AsyncNgrok.js not found, skipping (expo version may have changed).');
  process.exit(0);
}

const original = "authToken: '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8',";
const patched = "authToken: process.env.EXPO_NGROK_AUTHTOKEN || '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8',";

const content = fs.readFileSync(target, 'utf8');
if (content.includes(patched)) {
  console.log('[patch-ngrok-token] Already patched.');
} else if (content.includes(original)) {
  fs.writeFileSync(target, content.replace(original, patched));
  console.log('[patch-ngrok-token] Patched AsyncNgrok.js to allow EXPO_NGROK_AUTHTOKEN override.');
} else {
  console.warn('[patch-ngrok-token] Expected code not found, skipping (expo version may have changed).');
}
