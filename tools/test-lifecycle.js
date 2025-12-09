const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const serverFile = path.resolve(__dirname, '../src/server.js');
const RESTART_DELAY = 15000;
const SHUTDOWN_DELAY = 15000;

console.log('[TestLifecycle] Script started.');

setTimeout(() => {
  // 1. Trigger Restart by appending a comment
  console.log('[TestLifecycle] Modifying src/server.js to trigger restart...');
  try {
    const content = fs.readFileSync(serverFile, 'utf8');
    fs.writeFileSync(serverFile, content + '\n// touch');
    console.log('[TestLifecycle] File modified.');

    // Cleanup the comment after a bit to prevent accumulation
    setTimeout(() => {
      fs.writeFileSync(serverFile, content);
    }, 2000);
  } catch (err) {
    console.error('[TestLifecycle] Failed to modify file:', err);
  }

  setTimeout(() => {
    // 2. Trigger Shutdown
    console.log('[TestLifecycle] Finding process on port 3000 to kill...');
    exec('lsof -i :3000 -t', (err, stdout) => {
      const pids = stdout.trim().split('\n');
      if (pids.length > 0 && pids[0]) {
        console.log(`[TestLifecycle] Killing PIDs: ${pids.join(', ')}`);
        exec(`kill -SIGINT ${pids.join(' ')}`);
      } else {
        console.error('[TestLifecycle] No process found on port 3000');
      }
    });
  }, SHUTDOWN_DELAY);
}, RESTART_DELAY);
