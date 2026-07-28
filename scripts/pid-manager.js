const fs = require('fs');
const path = require('path');

const pidFile = path.join(__dirname, '../logs/server.pid');
const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

if (fs.existsSync(pidFile)) {
    const oldPid = fs.readFileSync(pidFile, 'utf8');
    console.warn(`[PID Manager] Found stale server.pid file indicating a previous crash (PID: ${oldPid.trim()}). Overwriting.`);
}

fs.writeFileSync(pidFile, process.pid.toString(), 'utf8');

process.on('exit', () => {
    try {
        if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
        }
    } catch (e) {
        console.error('[PID Manager] Failed to remove pid file on exit', e);
    }
});

// Note: no custom SIGINT/SIGTERM/SIGQUIT handlers here on purpose — Node's default behavior for these
// signals already terminates the process and fires 'exit' (which cleans up the pidfile above). Adding our
// own handlers here, since this file loads first in server.js, would run before any graceful-shutdown logic
// server.js registers for its own DB/browser cleanup, and could cut that cleanup off.
