/**
 * Automatic Cloud Sync Service for Render.com
 * Automatically watches local source files and pushes changes to GitHub/Render seamlessly.
 * Zero-click background execution.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class AutoCloudSync {
    constructor() {
        this.rootDir = path.resolve(__dirname, '..');
        this.debounceTimer = null;
        this.isSyncing = false;
        this.watchDirs = ['server', 'public', 'config', 'scripts'];
        this.watchFiles = ['server.js', 'package.json', 'Dockerfile', 'render.yaml'];
        this.ignoreExtensions = ['.db', '.sqlite', '.log', '.tmp', '.png', '.jpg', '.pdf', '.xlsx', '.git'];
    }

    init() {
        // Only run locally when git is present and NODE_ENV is not production
        if (process.env.NODE_ENV === 'production') return;

        fs.access(path.join(this.rootDir, '.git'), fs.constants.F_OK, (err) => {
            if (err) return; // Not a git repo

            console.log('🔄 [Auto Cloud Sync] Background automatic sync watcher active!');
            
            // Watch key directories recursively
            this.watchDirs.forEach(dir => {
                const dirPath = path.join(this.rootDir, dir);
                if (fs.existsSync(dirPath)) {
                    fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                        this.handleFileChange(filename);
                    });
                }
            });

            // Watch root files
            this.watchFiles.forEach(file => {
                const filePath = path.join(this.rootDir, file);
                if (fs.existsSync(filePath)) {
                    fs.watch(filePath, (eventType, filename) => {
                        this.handleFileChange(filename || file);
                    });
                }
            });
        });
    }

    handleFileChange(filename) {
        if (!filename) return;

        // Skip ignored extensions & hidden files
        const ext = path.extname(filename).toLowerCase();
        if (this.ignoreExtensions.includes(ext) || filename.includes('.git') || filename.includes('node_modules')) {
            return;
        }

        // Debounce: Wait 8 seconds after editing stops before committing & pushing
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            this.syncToCloud(filename);
        }, 8000);
    }

    syncToCloud(triggerFile) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`☁️ [Auto Cloud Sync] ${timeStr} — Detected edit in '${triggerFile}'. Syncing to Render cloud...`);

        const cmd = 'git add . && git commit -m "Auto-sync update" && git push origin main';
        exec(cmd, { cwd: this.rootDir }, (error, stdout, stderr) => {
            this.isSyncing = false;
            if (error) {
                // If nothing to commit, silently ignore
                if (stdout.includes('nothing to commit') || stderr.includes('nothing to commit')) {
                    return;
                }
                console.warn('⚠️ [Auto Cloud Sync] Sync skipped or failed:', error.message);
            } else {
                console.log('✅ [Auto Cloud Sync] Pushed to GitHub! Render is auto-deploying your live website.');
            }
        });
    }
}

module.exports = new AutoCloudSync();
