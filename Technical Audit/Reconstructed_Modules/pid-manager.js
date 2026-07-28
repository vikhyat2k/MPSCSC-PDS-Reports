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

// Also handle Ctrl+C and other termination signals gracefully to ensure 'exit' fires
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
        process.exit();
    });
});
