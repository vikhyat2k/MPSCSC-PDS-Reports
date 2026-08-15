require('dotenv').config();
require('./scripts/pid-manager');

// Global Error Handling to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cron = require('node-cron');

const DatabaseManager = require('./server/database/db');
const SCMScraper = require('./server/automation/scraper_v2');
const MDMScraper = require('./server/automation/mdm_scraper');
const ICDSScraper = require('./server/automation/icds_scraper');
const DataProcessor = require('./server/services/dataProcessor');
const reportRestorer = require('./server/services/reportRestorer'); // Deep Restore for history
const MDMDataProcessor = require('./server/services/mdmDataProcessor');
const ICDSDataProcessor = require('./server/services/icdsDataProcessor');
const ExcelGenerator = require('./server/services/excelGenerator');
const MDMExcelGenerator = require('./server/services/mdmExcelGenerator');
const ICDSExcelGenerator = require('./server/services/icdsExcelGenerator');
const WelfareScraper = require('./server/automation/welfare_scraper');
const WelfareDataProcessor = require('./server/services/welfareDataProcessor');
const WelfareExcelGenerator = require('./server/services/welfareExcelGenerator');
const PDFGenerator = require('./server/services/pdfGenerator');
const MDMPDFGenerator = require('./server/services/mdmPdfGenerator');
const ICDSPDFGenerator = require('./server/services/icdsPdfGenerator');
const WelfarePDFGenerator = require('./server/services/welfarePdfGenerator');
const AnalyticsService = require('./server/services/analytics');
const reportValidator = require('./server/services/reportValidator');
const BalancesReportGenerator = require('./server/services/balancesReportGenerator');

// Date Range Specific Models
const NFSADaterangeScraper = require('./server/automation/nfsa_daterange_scraper');
const NFSADaterangeDataProcessor = require('./server/services/nfsaDaterangeDataProcessor');
const NFSADaterangeExcelGenerator = require('./server/services/nfsaDaterangeExcelGenerator');
const NFSADaterangePdfGenerator = require('./server/services/nfsaDaterangePdfGenerator');
const AdvancedAnalyticsCompute = require('./server/services/advancedAnalytics/advancedAnalyticsCompute');
const AdvancedAnalyticsChartRenderer = require('./server/services/advancedAnalytics/advancedAnalyticsChartRenderer');
const AdvancedAnalyticsExcelGenerator = require('./server/services/advancedAnalytics/advancedAnalyticsExcelGenerator');
const AdvancedAnalyticsPdfGenerator = require('./server/services/advancedAnalytics/advancedAnalyticsPdfGenerator');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVER_VERSION = '3.5-HEAL';

/**
 * Startup Routine: Cleanup Orphaned Chromium Processes
 * Kills any leftover headless Chrome instances launched by Puppeteer from previous crashes.
 */
const cleanupOrphanedBrowsers = () => {
    if (process.platform === 'win32') {
        console.log('🧹 Scanning for orphaned Puppeteer processes...');
        exec('wmic process where "name=\'chrome.exe\'" get processid,executablepath', (err, stdout) => {
            if (stdout) {
                const lines = stdout.split('\n');
                let count = 0;
                lines.forEach(line => {
                    if (line.toLowerCase().includes('puppeteer') || line.toLowerCase().includes('chrome-win')) {
                        const match = line.match(/\s+(\d+)\s*$/);
                        if (match) {
                            exec(`taskkill /F /PID ${match[1]}`, () => {});
                            count++;
                        }
                    }
                });
                if (count > 0) console.log(`✅ Cleaned up ${count} orphaned browser process(es).`);
            }
        });
    }
};
// Run cleanup on startup
cleanupOrphanedBrowsers();

// Global state for active report generations
const activeRequests = new Map();
const activeScrapers = new Map(); // Track actual browser instances for termination

const MAX_CONCURRENT_SCRAPERS = 3;

function checkConcurrencyLimit(res) {
    if (activeScrapers.size >= MAX_CONCURRENT_SCRAPERS) {
        console.warn(`⚠️ Rejecting generation request: Concurrency limit reached (${activeScrapers.size}/${MAX_CONCURRENT_SCRAPERS})`);
        res.status(429).json({
            error: 'Server is currently busy generating other reports. Please try again in a few minutes.'
        });
        return false;
    }
    return true;
}

// Utility: Cap percentages at 100%
const cap = val => (typeof val === 'number' && !isNaN(val)) ? Math.min(100, val) : 0;

// Trust proxy (behind Unified Portal and Ngrok)
app.set('trust proxy', 1);

// Session Configuration with Persistent Disk Storage (FileStore) for 30-day Remember Me
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    try { fs.mkdirSync(sessionsDir, { recursive: true }); } catch (e) {}
}

app.use(session({
    store: new FileStore({
        path: sessionsDir,
        ttl: 30 * 24 * 60 * 60, // 30 days session TTL
        retries: 2,
        logFn: () => {}
    }),
    secret: process.env.SESSION_SECRET || 'pds-lifting-dev-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset cookie expiration on active usage
    name: 'pds.sid',
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days default
        secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIE === 'true',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());

// ─────────────────────────────────────────────
// SECURITY GATEKEEPER
// ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    console.warn('\n⚠️⚠️⚠️ WARNING: DEVELOPMENT SECURITY GATEKEEPER ACTIVE ⚠️⚠️⚠️');
    console.warn('Auto-login to admin account enabled. Set NODE_ENV=production to enforce authentication.\n');
    app.use((req, res, next) => {
        // Automatically log in all requests with the default administrator account
        if (req.session && !req.session.user) {
            req.session.user = {
                id: 1,
                username: 'dmbetul',
                role: 'admin'
            };
        }
        return next();
    });
}

// ─────────────────────────────────────────────
// STATIC FILE SERVING
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// STATIC FILE SERVING
// ─────────────────────────────────────────────

// Protected reports folder
app.use('/reports', express.static('reports', {
    maxAge: '1d',
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff')
}));

// Public assets from 'public' folder
app.use(express.static('public', { index: false }));

// Explicit PWA routes for PWABuilder & Mobile APK Support
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

// Initialize services
const db = new DatabaseManager();

// Create Initial User (dmbetul)


const dataProcessor = new DataProcessor();
const mdmDataProcessor = new MDMDataProcessor();
const icdsDataProcessor = new ICDSDataProcessor();
const welfareDataProcessor = new WelfareDataProcessor();
const excelGenerator = new ExcelGenerator();
const mdmExcelGenerator = new MDMExcelGenerator();
const icdsExcelGenerator = new ICDSExcelGenerator();
const welfareExcelGenerator = new WelfareExcelGenerator();
const pdfGenerator = new PDFGenerator();
const mdmPdfGenerator = new MDMPDFGenerator();
const icdsPdfGenerator = new ICDSPDFGenerator();
const welfarePdfGenerator = new WelfarePDFGenerator();
const analyticsService = new AnalyticsService();
const balancesReportGenerator = new BalancesReportGenerator();

const nfsaDaterangeDataProcessor = new NFSADaterangeDataProcessor();
const nfsaDaterangeExcelGenerator = new NFSADaterangeExcelGenerator();
const nfsaDaterangePdfGenerator = new NFSADaterangePdfGenerator();
const advAnalyticsCompute = new AdvancedAnalyticsCompute();
const advAnalyticsChartRenderer = new AdvancedAnalyticsChartRenderer();
const advAnalyticsExcelGenerator = new AdvancedAnalyticsExcelGenerator();
const advAnalyticsPdfGenerator = new AdvancedAnalyticsPdfGenerator();
// Request tracking (already declared line 48)

/**
 * Authentication Middleware
 * Protects all /api/ routes except login and status
 */
const requireAuth = (req, res, next) => {
    // List of routes that do not require authentication
    const exemptRoutes = ['/api/auth/login', '/api/status'];
    
    // Allow non-API routes or exempt routes to pass through
    if (!req.path.startsWith('/api') || exemptRoutes.includes(req.path)) {
        return next();
    }
    
    // Check if session has a valid user
    if (req.session && req.session.user && req.session.user.id) {
        return next();
    }
    
    // Return unauthorized for protected routes
    return res.status(401).json({ error: 'Unauthorized', authenticated: false });
};

// Apply authentication middleware to all routes
app.use(requireAuth);

/**
 * Authentication Routes
 */
app.post('/api/auth/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    
    try {
        const user = await db.verifyAppUser(username, password);
        if (user) {
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role
            };
            
            if (rememberMe) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            } else {
                req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 day
            }
            
            req.session.save((err) => {
                if (err) console.error('Session save error:', err);
                res.json({ success: true, user: req.session.user });
            });
        } else {
            res.status(401).json({ error: 'invalid_credentials', message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'server_error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('pds.sid');
        res.json({ success: true });
    });
});

app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

/**
 * API Routes
 */

// Get system status
app.get('/api/status', async (req, res) => {
    const stats = await db.getStats();
    const tempScraper = new SCMScraper();
    res.json({
        status: 'online',
        version: SERVER_VERSION,
        scraperVersion: tempScraper.VERSION,
        database: stats,
        timestamp: new Date().toISOString()
    });
});

// Generate report
app.post('/api/generate-report', async (req, res) => {
    if (!checkConcurrencyLimit(res)) return;
    const { month, year } = req.body;
    const requestId = `nfsa_${Date.now()}`;
    
    console.log(`\n⚡ [REPORT] Generation Request: Month=${month}, Year=${year} [ID: ${requestId}]`);

    // Global Hang Safeguard (20m)
    const watchdog = setTimeout(() => {
        const req = activeRequests.get(requestId);
        if (req && req.status !== 'complete' && req.status !== 'error') {
            const lastStage = req.message || req.status || 'unknown';
            console.error(`🕒 [WATCHDOG] Request ${requestId} killed after 20m hang at stage: ${lastStage}`);
            activeRequests.set(requestId, { 
                status: 'error', 
                progress: 0, 
                error: `Govt portal response timed out at [${lastStage}]. Portal is unresponsive or blocked.` 
            });
        }
    }, 20 * 60 * 1000);

    try {
        if (!month || !year) {
            return res.status(400).json({
                error: 'Month and year are required'
            });
        }

        // Track request
        activeRequests.set(requestId, {
            status: 'initializing',
            progress: 0,
            startTime: Date.now()
        });

        res.json({
            requestId,
            message: 'Report generation started',
            status: 'processing'
        });

        // Run automation in background (Shared Browser Parallel Workers)
        (async () => {
            const startTime = Date.now();
            const roTypes = ['Regular', 'Extra', 'Portability'];
            const credentials = {
                username: process.env.SCM_USERNAME,
                password: process.env.SCM_PASSWORD
            };

            const isHeadless = req.body.headless !== undefined
                ? req.body.headless
                : (process.env.HEADLESS_MODE !== 'false');

            let sharedBrowser = null;

            try {
                // 3. State management for parallel workers
                const aggregatedRawData = [];
                const combinedVerificationTotals = {
                    alloted: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 },
                    dispatched: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 },
                    received: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 }
                };
                const expectedIssuePointTotals = {};

                // Track which categories were successfully processed
                const processedCategories = [];
                const expectedCategories = ['Regular', 'Extra', 'Portability'];

                const workerStatus = {
                    Regular: { status: 'pending', progress: 0 },
                    Extra: { status: 'pending', progress: 0 },
                    Portability: { status: 'pending', progress: 0 }
                };

                const updateGlobalProgress = (roType, workerProg, msg) => {
                    if (workerStatus[roType]) {
                        workerStatus[roType].progress = workerProg;
                        workerStatus[roType].status = msg;
                    }

                    const avgProg = (workerStatus.Regular.progress + workerStatus.Extra.progress + workerStatus.Portability.progress) / 3;
                    const finalProg = Math.min(90, 10 + (avgProg * 0.8));

                    activeRequests.set(requestId, {
                        ...activeRequests.get(requestId),
                        status: `extracting data: ${roType}`,
                        message: `[${roType}] ${msg}`,
                        progress: finalProg
                    });
                };

                // 2. Sequential extraction across all required RO categories
                // Single-Instance Sequential Scraper: Use ONE browser session for all 3 categories
                // This prevents session conflict ("Another person trying to login") and improves speed.

                const scraper = new SCMScraper();
                activeScrapers.set(requestId, scraper);
                let isBrowserInitialized = false;

                try {
                    console.log(`🚀 Starting Single-Instance Sequential Extraction...`);
                    updateGlobalProgress('Regular', 0, 'Initializing browser...');

                    // Initialize and Login ONCE
                    await scraper.init(isHeadless);
                    isBrowserInitialized = true;

                    updateGlobalProgress('Regular', 5, 'Logging in...');
                    const loginSuccess = await scraper.login(credentials.username, credentials.password, 5, (msg) => {
                        updateGlobalProgress('Regular', 5, msg);
                    });

                    if (!loginSuccess) {
                        throw new Error('Login failed. Check credentials or CAPTCHA.');
                    }

                    for (const roType of roTypes) {
                        console.log(`👉 Processing RO Type: ${roType}`);
                        updateGlobalProgress(roType, 10, 'Starting extraction...');

                        try {
                            const result = await scraper.extractRoTypeData(month, year, roType, (current, total, msg) => {
                                const percent = (current / total) * 100;
                                updateGlobalProgress(roType, percent, msg);
                            });

                            if (result && result.status !== 'failed') {
                                const { rawData, summaryTotals } = result;
                                const recordCount = rawData ? rawData.length : 0;
                                console.log(`✅ [${roType}] Finished with ${recordCount} records.`);

                                processedCategories.push(roType); // Mark as successfully processed

                                if (recordCount > 0) {
                                    const rawDataWithType = rawData.map(r => ({ ...r, roType }));
                                    aggregatedRawData.push(...rawDataWithType);
                                }

                                if (summaryTotals) {
                                    ['alloted', 'dispatched', 'received'].forEach(phase => {
                                        ['wheat', 'rice', 'sugar', 'salt', 'fSalt', 'maize', 'fortifiedRice'].forEach(comm => {
                                            combinedVerificationTotals[phase][comm] += (summaryTotals[phase]?.[comm] || 0);
                                        });
                                    });
                                }

                                if (result.issuePointTotals) {
                                    result.issuePointTotals.forEach(ip => {
                                        const name = String(ip.issuePoint || '').trim().toUpperCase();
                                        if (!expectedIssuePointTotals[name]) {
                                            expectedIssuePointTotals[name] = { nfsaAllocation: 0, totalAllocation: 0 };
                                        }
                                        expectedIssuePointTotals[name].nfsaAllocation += (ip.nfsaAllocation || 0);
                                        expectedIssuePointTotals[name].totalAllocation += (ip.totalAllocation || 0);
                                    });
                                }

                                workerStatus[roType].progress = 100;
                                workerStatus[roType].status = 'Completed';
                            } else {
                                console.warn(`⚠️ [${roType}] Returned empty/failed status.`);
                                workerStatus[roType].progress = 100;
                                workerStatus[roType].status = 'No Data';
                            }
                        } catch (err) {
                            console.error(`❌ Error processing [${roType}]:`, err.message);
                            workerStatus[roType].progress = 100;
                            workerStatus[roType].status = 'Failed';
                            // CRITICAL: Abort if 'Regular' or 'Extra' fails — both are primary NFSA categories.
                            const mandatoryCategories = ['Regular', 'Extra'];
                            if (mandatoryCategories.includes(roType)) {
                                throw new Error(`CRITICAL: ${roType} RO type extraction failed — ${err.message}. Cannot generate accurate report.`);
                            }
                            console.warn(`⚠️ [${roType}] extraction failed but continuing: ${err.message}`);
                        }
                    }

                } catch (globalErr) {
                    console.error('❌ Global Scraper Error:', globalErr.message);
                    // Mark all pending as failed
                    for (const roType of roTypes) {
                        if (workerStatus[roType].status === 'pending') {
                            workerStatus[roType].status = 'Failed (Global Error)';
                            workerStatus[roType].progress = 0;
                        }
                    }
                } finally {
                    activeScrapers.delete(requestId);
                    if (isBrowserInitialized) {
                        console.log('🛑 Closing browser session...');
                        await scraper.close().catch(() => { });
                    }
                }

                console.log(`📊 Aggregation complete. Total records: ${aggregatedRawData.length}`);



                if (aggregatedRawData.length === 0) {
                    throw new Error('NO_DATA: The portal currently shows "No data found" for this month/year.');
                }

                const extractionTimeSec = Math.floor((Date.now() - startTime) / 1000);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'verifying data accuracy',
                    progress: 75
                });

                // Process data with verification
                const processedResult = dataProcessor.processData(aggregatedRawData, combinedVerificationTotals, processedCategories, expectedCategories, expectedIssuePointTotals);

                // Validate Data before Generation
                await reportValidator.validate(processedResult, 'nfsa', month, year, db, {
                    expectedCategories,
                    processedCategories,
                    mandatoryCategories: ['Regular', 'Extra']
                });

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'generating Excel',
                    progress: 85,
                    verification: processedResult.verification,
                    generationTime: extractionTimeSec // Numeric seconds
                });

                // Generate Excel report
                const reportFile = await excelGenerator.generateReport(
                    processedResult,
                    month,
                    year
                );

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'saving to database',
                    progress: 95
                });

                // Save to database
                // Get previous report for comparison (MOVED UP FOR ANALYTICS)
                const monthReports = await db.getReportsByMonthYear(month, year);
                const previousReport = monthReports.length > 1 ? monthReports[1] : null;

                let previousSectorAnalytics = null;
                if (previousReport && previousReport.raw_data) {
                    try {
                        const prevRawData = JSON.parse(previousReport.raw_data);
                        const prevProcessed = dataProcessor.processData(prevRawData);
                        previousSectorAnalytics = prevProcessed.sectors.map(s => ({
                            name: s.sectorName,
                            sector: s.serialNo,
                            dispatchPercentage: s.dispatchPercentage,
                            receivingPercentage: s.receiptPercentage
                        }));
                    } catch (e) {
                        console.error('Failed to process previous report data:', e);
                    }
                }

                // Generate analytics first so we can save it
                const analytics = analyticsService.analyzeReport(processedResult, previousReport, previousSectorAnalytics);
                const aiInsights = await generateAiInsights(processedResult, 'nfsa', month, year);
                
                // Merge full analytics with summary for storage
                const fullInsights = { ...analytics, aiInsights };

                const reportId = await db.saveReport({
                    month,
                    year,
                    filename: reportFile.filename,
                    filepath: reportFile.filepath,
                    totalAllocation: processedResult.totals.totalAllocation,
                    totalDispatch: processedResult.totals.totalDispatch,
                    totalPOSReceipt: processedResult.totals.totalPOSReceipt,
                    dispatchPercentage: processedResult.totals.dispatchPercentage,
                    rawData: aggregatedRawData, // Pass raw object, DatabaseManager will stringify it
                    generatedAt: new Date().toISOString(),
                    scheme: 'nfsa',
                    insights: fullInsights
                });

                // Complete
                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'complete',
                    progress: 100,
                    generationTime: extractionTimeSec,
                    analytics: analytics,
                    report: {
                        id: reportId,
                        filename: reportFile.filename,
                        downloadUrl: `reports/${reportFile.filename}`,
                        month: month,
                        year: year
                    }
                });

                console.log('✅ Parallel report generation complete!');

            } catch (err) {
                console.error('❌ Parallel report generation failed:', err);
                const isNoData = err.message.includes('NO_DATA');
                const isIntegrityFail = err.message.includes('STRICT_INTEGRITY_FAILURE');
                
                let errorMsg = err.message;
                if (isNoData) errorMsg = 'NO_DATA: The portal currently shows "No data found" for this month/year.';
                if (isIntegrityFail) errorMsg = 'Data Integrity Failure: Some sectors failed to load for Regular RO. Please try again in 5 minutes after the portal session has reset.';

                activeRequests.set(requestId, {
                    status: 'error',
                    error: errorMsg,
                    progress: 0
                });
            } finally {
                clearTimeout(watchdog);
            }
        })();

    } catch (error) {
        console.error('Error starting report generation:', error);
        res.status(500).json({
            error: 'Failed to start report generation',
            message: error.message
        });
    }
});

/**
 * Generate AI Insights from processed report data
 */
async function generateAiInsights(processedData, scheme, month, year) {
    try {
        const { sectors, totals } = processedData;
        const avgLifting = parseFloat(totals.totalDispatchPct || totals.dispatchPercentage || 0);

        // Sort for top/bottom
        const sorted = [...sectors].sort((a, b) => {
            const valA = parseFloat(a.dispatchPercentage || a.dispatchPercentage || a.dispatchPct || a.dispatch || 0);
            const valB = parseFloat(b.dispatchPercentage || b.dispatchPercentage || b.dispatchPct || b.dispatch || 0);
            return valB - valA;
        });

        const top = sorted[0];
        const bottom = sorted[sorted.length - 1];

        // Determine trend (Compare with previous generation of same scheme/month)
        let trend = 'neutral';
        const lastReport = await db.db.get(`
            SELECT dispatch_percentage FROM reports 
            WHERE scheme = ? AND month = ? AND year = ? 
            ORDER BY generated_at DESC LIMIT 1
        `, [scheme, month, year]);

        if (lastReport) {
            const prevPct = parseFloat(lastReport.dispatch_percentage);
            if (avgLifting > prevPct + 0.5) trend = 'up';
            else if (avgLifting < prevPct - 0.5) trend = 'down';
        }

        // Generate a smart summary
        let summary = `District administration has achieved ${avgLifting.toFixed(1)}% lifting. `;
        if (avgLifting > 80) summary += "Performance is excellent across major centers.";
        else if (avgLifting > 50) summary += "Steady progress observed, with some hotspots identified.";
        else summary += "Low lifting detected; urgent transporter follow-up is recommended.";

        return {
            score: avgLifting.toFixed(1),
            summary: summary,
            top_performer: top ? `${top.sectorName || top.districtOffice} (${(top.dispatchPercentage || top.dispatchPct || 100)}%)` : 'N/A',
            critical_area: bottom ? `${bottom.sectorName || bottom.districtOffice} (${(bottom.dispatchPercentage || bottom.dispatchPct || 0)}%)` : 'N/A',
            trend: trend,
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        console.error('Error generating AI insights:', err);
        return { score: 0, summary: "Analysis failed", top_performer: 'N/A', critical_area: 'N/A', trend: 'neutral' };
    }
}

/**
 * Compute NFSA Date Range analytics from processedResult
 */
function computeNFSADaterangeAnalytics(processedResult, fromDate, toDate, allotmentMapping = null, shopAllotmentMapping = null) {
    const { sectors, totals } = processedResult || {};
    const basePool = sectors ? [...sectors] : [];

    // Ensure basePool contains all 22 configured sectors FIRST so 0-dispatch sectors & transporters are fully analyzed
    if (Array.isArray(sectorsConfig) && sectorsConfig.length > 0) {
        const existingSectorNames = new Set(basePool.map(s => s.sectorName));
        sectorsConfig.forEach(cfg => {
            if (cfg.sectorName && !existingSectorNames.has(cfg.sectorName)) {
                basePool.push({
                    sectorName: cfg.sectorName,
                    serialNo: String(cfg.serialNo || ''),
                    transporter: cfg.transporter || '',
                    mobileNumber: cfg.mobile || '',
                    block: cfg.block || cfg.districtOffice || '',
                    dispatch: 0,
                    totalShops: cfg.totalShops || 0,
                    shops: []
                });
            }
        });
    }

    const activeSectorsCount = basePool.filter(s => parseFloat(s.dispatch || 0) > 0).length;
    
    // Sort all sectors by dispatch
    const sorted = [...basePool].sort((a, b) => parseFloat(b.dispatch || 0) - parseFloat(a.dispatch || 0));

    let fullLiftedShops = 0;
    let partialLiftedShops = 0;
    let totalLiftedShops = 0;
    
    const fullShopsList = [];
    const partialShopsList = [];

    // Group & deduplicate shops across sectors by shop code
    const uniqueShopsMap = {};
    basePool.forEach(sector => {
        if (sector.shops && Array.isArray(sector.shops)) {
            sector.shops.forEach(shop => {
                const code = shop.shopCode || shop.code;
                if (!code) return;
                if (!uniqueShopsMap[code]) {
                    uniqueShopsMap[code] = {
                        shopName: shop.shopName || shop.name,
                        shopCode: code,
                        dispatch: 0,
                        dispatchedComm: {}
                    };
                }
                const target = uniqueShopsMap[code];
                target.dispatch += (parseFloat(shop.dispatch) || 0);
                const commObj = shop.commodities || shop.dispatchedComm || shop.dispatchCommodities || {};
                if (typeof commObj === 'object' && commObj !== null) {
                    Object.keys(commObj).forEach(k => {
                        const val = parseFloat(commObj[k]) || 0;
                        if (val > 0) {
                            target.dispatchedComm[k] = (target.dispatchedComm[k] || 0) + val;
                        }
                    });
                }
            });
        }
    });

    Object.values(uniqueShopsMap).forEach(shop => {
        const totalShopDisp = shop.dispatch || 0;
        
        if (totalShopDisp > 0) {
            totalLiftedShops++;
            
            const allottedComms = shopAllotmentMapping ? shopAllotmentMapping[shop.shopCode] : null;
            let isFull = false;
            
            if (allottedComms) {
                const expectedKeys = Object.keys(allottedComms);
                const dispatchedKeys = Object.keys(shop.dispatchedComm || {}).filter(k => shop.dispatchedComm[k] > 0);
                
                if (expectedKeys.length > 0) {
                    isFull = expectedKeys.every(k => dispatchedKeys.includes(k));
                } else {
                    isFull = Object.keys(shop.dispatchedComm || {}).filter(k => shop.dispatchedComm[k] > 0).length > 1;
                }
            } else {
                isFull = Object.keys(shop.dispatchedComm || {}).filter(k => shop.dispatchedComm[k] > 0).length > 1;
            }
            
            if (isFull) {
                fullLiftedShops++;
                fullShopsList.push({ name: shop.shopName, code: shop.shopCode, dispatch: shop.dispatch, comms: shop.dispatchedComm });
            } else {
                partialLiftedShops++;
                partialShopsList.push({ name: shop.shopName, code: shop.shopCode, dispatch: shop.dispatch, comms: shop.dispatchedComm });
            }
        }
    });

    const groupPerformersHelper = (data, sortOrder = 'desc', limit = 5) => {
        const groups = {};
        
        data.forEach(s => {
            const t = s.transporter;
            if (!t || t === 'श्री - ') return;
            if (!groups[t]) {
                groups[t] = { dispatchQty: 0, sectorCount: 0 };
            }
            let rec = s.posReceipt;
            if (rec === undefined) rec = s.received;
            if (rec === undefined) rec = s.receipt;
            if (rec === undefined) rec = s.totalReceived;
            if (rec === undefined) rec = s.dispatch;
            groups[t].dispatchQty += (parseFloat(rec) || 0);
            groups[t].sectorCount += 1;
        });

        let pool = Object.keys(groups).map(t => ({
            name: t,
            transporter: t,
            dispatchQty: groups[t].dispatchQty,
            dispatchPercentage: groups[t].dispatchQty,
            sectorCount: groups[t].sectorCount
        }));

        if (sortOrder === 'desc') {
            pool = pool.filter(p => p.dispatchQty > 0);
        }

        pool.sort((a, b) => sortOrder === 'desc' ? b.dispatchQty - a.dispatchQty : a.dispatchQty - b.dispatchQty);

        return pool.slice(0, limit).map(p => ({
            name: p.name,
            transporter: p.transporter,
            dispatchPercentage: p.dispatchPercentage.toFixed(2), // Hijacked for grouping logic in UI
            dispatchQty: p.dispatchQty.toFixed(2),
            items: [{
                name: p.name,
                transporter: p.transporter,
                dispatchQty: p.dispatchQty.toFixed(2),
                sectorCount: p.sectorCount
            }]
        }));
    };

    const topPerformers = groupPerformersHelper(basePool, 'desc', 5);
    const bottomPerformers = groupPerformersHelper(basePool, 'asc', 10);

    let dateContext = "इस अवधि के दौरान";
    if (fromDate && toDate) {
        if (fromDate === toDate) {
            dateContext = `दिनांक ${fromDate} को`;
        } else {
            const partsFrom = fromDate.split('/');
            const partsTo = toDate.split('/');
            const d1 = new Date(partsFrom[2], partsFrom[1] - 1, partsFrom[0]);
            const d2 = new Date(partsTo[2], partsTo[1] - 1, partsTo[0]);
            const diffTime = Math.abs(d2 - d1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            dateContext = `दिनांक ${fromDate} से ${toDate} (${diffDays} दिन) के दौरान`;
        }
    }

    const insights = [];
    insights.push({ icon: '🚚', severity: 'success', message: `${dateContext} जिले भर में कुल ${parseFloat(totals.totalDispatch).toFixed(2)} क्विंटल सामग्री प्रेषित (dispatched) की गई।` });
    insights.push({ icon: '📋', severity: 'info', message: `${dateContext} कुल ${activeSectorsCount} सेक्टरों में डिस्पैच गतिविधि दर्ज की गई।` });
    
    if (allotmentMapping) {
        insights.push({ icon: '🎯', severity: 'info', message: 'प्रगति की गणना डेटाबेस में उपलब्ध मासिक आवंटन लक्ष्यों के आधार पर की जा रही है।' });
    }

    // Add insight for zero-dispatch transporters & sectors
    const zeroDispatchSectors = basePool.filter(s => parseFloat(s.dispatch || 0) === 0);
    if (zeroDispatchSectors.length > 0) {
        const zeroTransporters = [...new Set(zeroDispatchSectors.map(s => s.transporter).filter(t => t && t !== 'श्री - '))];
        if (zeroTransporters.length > 0) {
            insights.push({ 
                icon: '⚠️', 
                severity: 'warning', 
                message: `⚠️ 0 डिस्पैच / शून्य उठाओ: ${dateContext} ${zeroDispatchSectors.length} सेक्टरों (${zeroTransporters.length} परिवहनकर्ता) में कोई डिस्पैच दर्ज नहीं हुआ (${zeroTransporters.join(', ')})` 
            });
        } else {
            insights.push({ 
                icon: '⚠️', 
                severity: 'warning', 
                message: `⚠️ 0 डिस्पैच / शून्य उठाओ: ${dateContext} ${zeroDispatchSectors.length} सेक्टरों में कोई डिस्पैच दर्ज नहीं हुआ` 
            });
        }
    }

    const progressMatrix = basePool.map(s => {
        const name = s.sectorName;
        let wheatDisp = 0, riceDisp = 0;
        if (s.shops && Array.isArray(s.shops)) {
            s.shops.forEach(sh => {
                if (sh.dispatchedComm) {
                    wheatDisp += (sh.dispatchedComm.wheat || 0);
                    riceDisp += (sh.dispatchedComm.fortifiedRice || 0);
                }
            });
        }
        
        // Use mapping if available
        const mAllot = (allotmentMapping && allotmentMapping[name]) ? parseFloat(allotmentMapping[name]) : parseFloat(s.monthlyAllocation || 0);
        const disp = parseFloat(s.dispatch || 0);
        const dispPct = mAllot > 0 ? (disp / mAllot * 100).toFixed(2) : '0.00';

        return {
            name, block: s.block, transporter: s.transporter, shops: s.actualShopCount,
            dispatchPercentage: parseFloat(dispPct), receivingPercentage: 0,
            dispatchPerformancePct: parseFloat(dispPct),
            dispatchDelta: 0, receivingDelta: 0,
            wheatAllotted: 0, wheatDispatched: parseFloat(wheatDisp.toFixed(2)), wheatReceived: 0, wheatDispatchPct: 100, wheatReceiptPct: 0,
            riceAllotted: 0, riceDispatched: parseFloat(riceDisp.toFixed(2)), riceReceived: 0, riceDispatchPct: 100, riceReceiptPct: 0,
            totalAllotted: mAllot, totalDispatched: disp, totalReceived: 0,
            dispatchDates: s.dispatchDates
        };
    });

    // Calculate total allocation based on mapping if available
    let totalAllotted = parseFloat(totals.totalAllocation || 0);
    if (allotmentMapping) {
        totalAllotted = Object.values(allotmentMapping).reduce((sum, val) => sum + parseFloat(val), 0);
    }

    return {
        fromDate,
        toDate,
        metrics: {
            totalDispatch: parseFloat(totals.totalDispatch),
            totalAllocation: 0,
            dispatchPercentage: 0,
            totalShops: totalLiftedShops,
            fullLiftedShops: fullLiftedShops,
            partialLiftedShops: partialLiftedShops,
            activeSectors: activeSectorsCount,
            totalSectors: basePool.length
        },
        progressMatrix, 
        allSectors: progressMatrix,
        topTransporters: topPerformers, 
        bottomTransporters: bottomPerformers, 
        needsAttention: bottomPerformers, // Mirror for frontend robustness
        activeShopsDetails: {
            full: fullShopsList,
            partial: partialShopsList
        },
        insights
    };
}

// Generate Date Range Report
app.post('/api/generate-nfsa-daterange-report', async (req, res) => {
    if (!checkConcurrencyLimit(res)) return;
    const { month, year, fromDate, toDate, headless } = req.body;
    console.log(`\n⚡ [DATE-RANGE] Generation Request: ${fromDate} to ${toDate}`);
    const requestId = Date.now().toString();

    // Global Hang Safeguard (20m)
    const watchdog = setTimeout(() => {
        if (activeRequests.has(requestId) && activeRequests.get(requestId).status !== 'complete' && activeRequests.get(requestId).status !== 'error') {
            console.error(`🕒 [WATCHDOG] DateRange Request ${requestId} killed after 20m hang.`);
            activeRequests.set(requestId, { status: 'error', progress: 0, error: 'Govt portal response timed out.' });
        }
    }, 20 * 60 * 1000);

    if (!month || !year || !fromDate || !toDate) {
        return res.status(400).json({ error: 'Month, year, fromDate, and toDate are required' });
    }

    try {
        activeRequests.set(requestId, { status: 'initializing', progress: 0, startTime: Date.now() });
        res.json({ requestId, message: 'Date Range report generation started', status: 'processing' });

        (async () => {
            const startTime = Date.now();
            const credentials = { username: process.env.SCM_USERNAME, password: process.env.SCM_PASSWORD };
            const isHeadless = req.body.headless !== undefined ? req.body.headless : (process.env.HEADLESS_MODE !== 'false');
            const scraper = new NFSADaterangeScraper();
            activeScrapers.set(requestId, scraper);
            let isBrowserInitialized = false;

            try {
                await scraper.init(isHeadless);
                isBrowserInitialized = true;

                activeRequests.set(requestId, { ...activeRequests.get(requestId), status: 'extracting data', message: 'Logging in and navigating to report...' });

                const updateProgress = (msg) => {
                    activeRequests.set(requestId, { ...activeRequests.get(requestId), message: msg, progress: 40 });
                };

                const result = await scraper.extractData(fromDate, toDate, month, year, credentials.username, credentials.password, updateProgress);

                if (result.status === 'failed') throw new Error(result.error || 'Date Range extraction failed completely');

                activeRequests.set(requestId, { ...activeRequests.get(requestId), progress: 70, status: 'processing data', message: 'Generating Excel...' });

                // NO ALLOTMENT FOR DATE RANGE: User wants to see pure dispatch between dates.
                const allotmentMapping = null;

                // Fetch actual shop-level allotment from the base NFSA report for Full/Partial logic
                let shopAllotmentMapping = null;
                const monthReports = await db.getReportsByMonthYear(month, year);
                const nfsaReport = monthReports.find(r => r.scheme === 'nfsa');
                if (nfsaReport && nfsaReport.raw_data) {
                    shopAllotmentMapping = {};
                    const rData = typeof nfsaReport.raw_data === 'string' ? JSON.parse(nfsaReport.raw_data) : nfsaReport.raw_data;
                    const baseRawData = rData.rawData || rData;
                    if (Array.isArray(baseRawData)) {
                        baseRawData.forEach(shop => {
                            if (shop.shopCode && shop.commodities) {
                                if (!shopAllotmentMapping[shop.shopCode]) shopAllotmentMapping[shop.shopCode] = {};
                                Object.keys(shop.commodities).forEach(k => {
                                    if (shop.commodities[k] > 0) {
                                        let keyToSave = k;
                                        if (k === 'rice') keyToSave = 'fortifiedRice'; // Map to Date Range column name
                                        shopAllotmentMapping[shop.shopCode][keyToSave] = true;
                                    }
                                });
                            }
                        });
                    }
                }

                const processedResult = nfsaDaterangeDataProcessor.processData(result.rawData, result.summaryTotals, allotmentMapping);
                const reportFile = await nfsaDaterangeExcelGenerator.generateReport(processedResult, fromDate, toDate, month, year);

                const daterangeAnalytics = computeNFSADaterangeAnalytics(processedResult, fromDate, toDate, allotmentMapping, shopAllotmentMapping);

                const finalAllotted = 0; // Explicitly 0 for Date Range
                const finalDispatched = processedResult.totals.totalDispatch || 0;
                console.log(`[DateRange] Calculated Totals - Dispatched: ${finalDispatched} (Allotment intentionally omitted)`);
                const finalPercentage = "0.00";

                const reportId = await db.saveReport({
                    scheme: 'nfsa_daterange',
                    month: month,
                    year: year,
                    filename: reportFile.filename,
                    filepath: reportFile.filepath,
                    totalAllocation: finalAllotted,
                    totalDispatch: finalDispatched,
                    dispatchPercentage: finalPercentage,
                    fromDate: fromDate,
                    toDate: toDate,
                    rawData: {
                        ...result,
                        allotmentMapping
                    },
                    insights: daterangeAnalytics
                });

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId), status: 'complete', progress: 100,
                    generationTime: ((Date.now() - startTime) / 1000).toFixed(1),
                    analytics: { ...daterangeAnalytics, isDateRange: true },
                    report: { id: reportId, filename: reportFile.filename, downloadUrl: `reports/${reportFile.filename}` }
                });

                console.log('✅ Date range report complete!');
            } catch (error) {
                console.error('❌ Date range generation failed:', error);
                activeRequests.set(requestId, { status: 'error', progress: 0, error: error.message });
            } finally {
                activeScrapers.delete(requestId);
                if (isBrowserInitialized) {
                    await scraper.close().catch(() => {});
                }
                clearTimeout(watchdog);
            }
        })();
    } catch (error) {
        console.error('Error starting date range report:', error);
        res.status(500).json({ error: 'Failed to start date range report generation', message: error.message });
    }
});

// Get generation status
app.get('/api/generate-status/:requestId', (req, res) => {
    const { requestId } = req.params;
    const status = activeRequests.get(requestId);

    if (!status) {
        return res.status(404).json({
            error: 'Request not found'
        });
    }

    res.json(status);
});

// Get all reports (supports ?scheme=nfsa or ?scheme=mdm)
app.get('/api/reports', async (req, res) => {
    try {
        const scheme = req.query.scheme || null;
        console.log(`🔍 [GET] /api/reports?scheme=${scheme}`);
        let reports = await db.getAllReports(50, scheme);
        console.log(`✅ Found ${reports.length} reports for scheme: ${scheme}`);

        // Dynamically calculate receipt_percentage for the UI
        reports = reports.map(r => {
            const alloc = parseFloat(r.total_allocation) || 0;
            const receipt = parseFloat(r.total_pos_receipt) || 0;
            const pct = (alloc > 0) ? (receipt / alloc) * 100 : 0;
            const receiptPercentage = (!isNaN(pct) && isFinite(pct)) ? pct.toFixed(2) : "0.00";
            return {
                ...r,
                receipt_percentage: receiptPercentage
            };
        });

        res.json(reports);
    } catch (error) {
        console.error('❌ Error in /api/reports:', error);
        res.status(500).json({
            error: 'Failed to fetch reports',
            message: error.message
        });
    }
});

// Get report stats (total count)
app.get('/api/reports/stats', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        db.db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN generated_at >= ? THEN 1 ELSE 0 END) as thisMonth,
                MAX(generated_at) as lastGenerated
            FROM reports
        `, [startOfMonth], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error', message: err.message });
            }
            res.json({ 
                total: row ? row.total : 0,
                thisMonth: row ? (row.thisMonth || 0) : 0,
                lastGenerated: row ? row.lastGenerated : null
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * Get historical insights for a scheme
 */

/**
 * Get all available months, years, and schemes from the database
 */
app.get('/api/reports/insights/:scheme', async (req, res) => {
    try {
        const { scheme } = req.params;
        db.db.all(`
            SELECT id, month, year, insights, generated_at 
 FROM reports 
            WHERE scheme = ? AND insights IS NOT NULL 
            ORDER BY generated_at DESC 
            LIMIT 10
        `, [scheme], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error', message: err.message });
            }
            
            const insightsHistory = (rows || []).map(r => ({
                id: r.id,
                month: r.month,
                year: r.year,
                data: JSON.parse(r.insights),
                generated_at: r.generated_at
            }));
            
            res.json(insightsHistory);
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch insights', message: error.message });
    }
});

// Generate PDF from existing report
app.post('/api/generate-pdf/:id', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Parse raw data
        const rawData = JSON.parse(report.raw_data || '[]');

        let processedData;
        let pdfFile;
        const scheme = report.scheme || 'nfsa';

        if (scheme === 'mdm') {
            processedData = mdmDataProcessor.processData(rawData);
            pdfFile = await mdmPdfGenerator.generateReport(processedData, report.month, report.year);
        } else if (scheme === 'icds') {
            processedData = icdsDataProcessor.processData(rawData);
            pdfFile = await icdsPdfGenerator.generateReport(processedData, report.month, report.year);
        } else if (scheme === 'welfare') {
            processedData = welfareDataProcessor.processData(rawData);
            pdfFile = await welfarePdfGenerator.generateReport(processedData, report.month, report.year);
        } else if (scheme === 'nfsa_daterange') {
            let fromD = "Start", toD = "End";
            // Extract from filename: NFSA_DD-MM-YYYY_to_DD-MM-YYYY_timestamp.xlsx
            const match = report.filename.match(/NFSA_(\d{2}-\d{2}-\d{4})_to_(\d{2}-\d{2}-\d{4})/);
            if (match) {
                fromD = match[1].replace(/-/g, '/');
                toD = match[2].replace(/-/g, '/');
            }
            
            const rData = rawData.rawData || rawData;
            const summaryTotals = rawData.summaryTotals || null;
            const allotmentMapping = rawData.allotmentMapping || null;
            processedData = nfsaDaterangeDataProcessor.processData(rData, summaryTotals, allotmentMapping);
            pdfFile = await nfsaDaterangePdfGenerator.generateReport(processedData, fromD, toD, report.month, report.year);
        } else {
            // Default to NFSA
            processedData = dataProcessor.processData(rawData);
            pdfFile = await pdfGenerator.generateReport(processedData, report.month, report.year);
        }

        res.json({
            success: true,
            pdfUrl: `reports/${pdfFile.filename}`,
            filename: pdfFile.filename
        });
    } catch (error) {
        console.error('❌ PDF Generation Error:', error.message);
        console.error(error.stack);
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// Translation helper for date-range analytical insights
function translateInsightMessage(msg) {
    if (!msg) return msg;
    
    // Replace date contexts
    msg = msg.replace(/\bduring this period\b/gi, 'इस अवधि के दौरान');
    msg = msg.replace(/\bon (\d{2}\/\d{2}\/\d{4}) to (\d{2}\/\d{2}\/\d{4}) \((\d+)\s+days\)/gi, 'दिनांक $1 से $2 ($3 दिन) के दौरान');
    msg = msg.replace(/\bon (\d{2}\/\d{2}\/\d{4})\b/gi, 'दिनांक $1 को');
    
    // 1. Total commodities dispatched
    const totalMatch = msg.match(/(\d+\.?\d*)\s*Qt total commodities dispatched across the district (.*)\./i);
    if (totalMatch) {
        return `${totalMatch[2]} जिले भर में कुल ${totalMatch[1]} क्विंटल सामग्री प्रेषित (dispatched) की गई।`;
    }
    
    // 2. Sectors recorded dispatch activity
    const sectorMatch = msg.match(/(\d+)\s*sectors recorded dispatch activity (.*)\./i);
    if (sectorMatch) {
        return `${sectorMatch[2]} कुल ${sectorMatch[1]} सेक्टरों में डिस्पैच गतिविधि दर्ज की गई।`;
    }
    
    // 3. Progress measured
    if (msg.includes('Progress is being measured against existing Monthly Allotment targets')) {
        return 'प्रगति की गणना डेटाबेस में उपलब्ध मासिक आवंटन लक्ष्यों के आधार पर की जा रही है।';
    }
    
    // 4. Zero dispatch transporters
    const zeroMatch = msg.match(/Zero dispatch recorded for transporters (.*?):\s*(.*)/i);
    if (zeroMatch) {
        return `${zeroMatch[1]} निम्नलिखित परिवहनकर्ताओं के लिए शून्य उठाओ दर्ज किया गया: ${zeroMatch[2]}`;
    }
    
    return msg;
}

// Get report by ID (with automatic Deep Restore for legacy data)
app.get('/api/reports/:id', async (req, res) => {
    try {
        let report = await db.getReport(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        let insights = null;
        if (report.insights) {
            try {
                insights = typeof report.insights === 'string' ? JSON.parse(report.insights) : report.insights;
            } catch (e) {
                insights = null;
            }
        }

        // DEEP RESTORE: Re-compute analytics dynamically if insights are missing, incomplete, or for daterange
        if (report.scheme === 'nfsa_daterange' && report.raw_data) {
            try {
                const rawData = typeof report.raw_data === 'string' ? JSON.parse(report.raw_data) : report.raw_data;
                const rData = rawData.rawData || rawData;
                const summaryTotals = rawData.summaryTotals || null;
                const allotmentMap = rawData.allotmentMapping || null;
                const fromDate = report.fromDate || report.from_date || '';
                const toDate = report.toDate || report.to_date || '';
                const processedResult = nfsaDaterangeDataProcessor.processData(rData, summaryTotals, allotmentMap);
                insights = computeNFSADaterangeAnalytics(processedResult, fromDate, toDate, allotmentMap);
            } catch (e) {
                console.error('Error re-evaluating daterange insights:', e);
            }
        } else if (!insights || !insights.metrics || !insights.needsAttention || !insights.matrix) {
            if (report.raw_data) {
                const restoredInsights = await reportRestorer.restoreReport(report);
                if (restoredInsights) {
                    await db.db.run(`UPDATE reports SET insights = ? WHERE id = ?`, [JSON.stringify(restoredInsights), report.id]);
                    insights = restoredInsights; // Pass the fresh data back to frontend
                }
            }
        }

        // On-the-fly translate insights to Hindi if it is daterange
        if (report.scheme === 'nfsa_daterange' && insights && insights.insights && Array.isArray(insights.insights)) {
            insights.insights = insights.insights.map(item => ({
                ...item,
                message: translateInsightMessage(item.message)
            }));
        }

        report.insights = insights;

        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch report', message: error.message });
    }
});

// Get report analytics specifically for Messenger
app.get('/api/reports/:id/analytics', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        let insights = report.insights;
        if (typeof insights === 'string') {
            insights = JSON.parse(insights);
        }

        if (report.scheme === 'nfsa_daterange' && report.raw_data) {
            try {
                const rawData = typeof report.raw_data === 'string' ? JSON.parse(report.raw_data) : report.raw_data;
                const rData = rawData.rawData || rawData;
                const summaryTotals = rawData.summaryTotals || null;
                const allotmentMap = rawData.allotmentMapping || null;
                const fromDate = report.fromDate || report.from_date || '';
                const toDate = report.toDate || report.to_date || '';
                const processedResult = nfsaDaterangeDataProcessor.processData(rData, summaryTotals, allotmentMap);
                insights = computeNFSADaterangeAnalytics(processedResult, fromDate, toDate, allotmentMap);
            } catch (e) {
                console.error('Error re-evaluating daterange insights for messenger:', e);
            }
        }
        
        // Ensure format is what Messenger expects (has topPerformers, bottomPerformers, metrics)
        res.json(insights || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
    }
});

// Advanced Analytics Excel Download (NFSA Monthly only in v1)
app.get('/api/reports/:id/advanced-analytics/excel', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        if ((report.scheme || 'nfsa') !== 'nfsa') {
            return res.status(400).json({ error: 'Advanced Analytics is currently available only for NFSA Monthly reports.' });
        }

        const computed = advAnalyticsCompute.compute(report);
        const chartBuffers = await advAnalyticsChartRenderer.renderCharts(computed);
        const workbook = await advAnalyticsExcelGenerator.generateWorkbook(computed, chartBuffers);

        const filename = `Advanced_Analytics_NFSA_${computed.month}_${computed.year}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('❌ Advanced Analytics Excel Generation Error:', error.message);
        res.status(500).json({ error: 'Failed to generate Advanced Analytics Excel report', message: error.message });
    }
});

// Advanced Analytics PDF Download (NFSA Monthly only in v1)
app.get('/api/reports/:id/advanced-analytics/pdf', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        if ((report.scheme || 'nfsa') !== 'nfsa') {
            return res.status(400).json({ error: 'Advanced Analytics is currently available only for NFSA Monthly reports.' });
        }

        const computed = advAnalyticsCompute.compute(report);
        const chartBuffers = await advAnalyticsChartRenderer.renderCharts(computed);
        const pdfBuffer = await advAnalyticsPdfGenerator.generatePdf(computed, chartBuffers);

        const filename = `Executive_Analytics_Report_NFSA_${computed.month}_${computed.year}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(pdfBuffer));
    } catch (error) {
        console.error('❌ Advanced Analytics PDF Generation Error:', error.message);
        res.status(500).json({ error: 'Failed to generate Advanced Analytics PDF report', message: error.message });
    }
});

// Advanced Analytics HTML Preview (NFSA Monthly only in v1)
app.get('/api/reports/:id/advanced-analytics/html', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        if ((report.scheme || 'nfsa') !== 'nfsa') {
            return res.status(400).send('<h3>Advanced Analytics is currently available only for NFSA Monthly reports.</h3>');
        }

        const computed = advAnalyticsCompute.compute(report);
        const chartBuffers = await advAnalyticsChartRenderer.renderCharts(computed);
        const html = advAnalyticsPdfGenerator.generateHtml(computed, chartBuffers);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('❌ Advanced Analytics HTML Generation Error:', error.message);
        res.status(500).send(`<h3>Failed to generate Advanced Analytics HTML Preview: ${error.message}</h3>`);
    }
});

// Get unique filters (transporters, depots) for shop balances report
app.get('/api/reports/:id/balances/filters', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) {
            return res.json({ transporters: [], depots: [] });
        }
        
        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';
        
        let processedResult;
        if (scheme === 'nfsa') {
            processedResult = dataProcessor.processData(rawData);
        } else if (scheme === 'mdm') {
            processedResult = mdmDataProcessor.processData(rawData);
        } else if (scheme === 'icds') {
            processedResult = icdsDataProcessor.processData(rawData);
        } else if (scheme === 'welfare') {
            processedResult = welfareDataProcessor.processData(rawData);
        } else {
            return res.status(400).json({ error: 'Unsupported scheme' });
        }
        
        // Extract unique transporter names
        const transportersSet = new Set();
        processedResult.sectors.forEach(s => {
            if (s.transporter) transportersSet.add(s.transporter.trim());
        });
        
        // Extract unique depot/issue point names
        const depotsSet = new Set();
        processedResult.sectors.forEach(s => {
            (s.shops || []).forEach(shop => {
                if (shop.issuePoint) depotsSet.add(shop.issuePoint.trim());
            });
        });
        
        res.json({
            transporters: Array.from(transportersSet).sort(),
            depots: Array.from(depotsSet).sort()
        });
    } catch (error) {
        console.error('Error fetching balance filters:', error);
        res.status(500).json({ error: 'Failed to fetch filters', message: error.message });
    }
});

// Get shop balances report (Excel)
app.get('/api/reports/:id/balances/excel', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) {
            return res.status(400).json({ error: 'Raw data missing', message: 'दुकानवार उठाव शेष विवरण इस ऐतिहासिक रिपोर्ट के लिए अनुपलब्ध है।' });
        }
        
        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';
        
        let processedResult;
        if (scheme === 'nfsa') {
            processedResult = dataProcessor.processData(rawData);
        } else if (scheme === 'mdm') {
            processedResult = mdmDataProcessor.processData(rawData);
        } else if (scheme === 'icds') {
            processedResult = icdsDataProcessor.processData(rawData);
        } else if (scheme === 'welfare') {
            processedResult = welfareDataProcessor.processData(rawData);
        } else {
            return res.status(400).json({ error: 'Unsupported scheme for balances report' });
        }
        
        const { type, value } = req.query;
        await balancesReportGenerator.generateExcel(report, processedResult, res, { type, value });
    } catch (error) {
        console.error('Error generating balances Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel report', message: error.message });
    }
});

// Get shop balances report (PDF)
app.get('/api/reports/:id/balances/pdf', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) {
            return res.status(400).json({ error: 'Raw data missing', message: 'दुकानवार उठाव शेष विवरण इस ऐतिहासिक रिपोर्ट के लिए अनुपलब्ध है।' });
        }
        
        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';
        
        let processedResult;
        if (scheme === 'nfsa') {
            processedResult = dataProcessor.processData(rawData);
        } else if (scheme === 'mdm') {
            processedResult = mdmDataProcessor.processData(rawData);
        } else if (scheme === 'icds') {
            processedResult = icdsDataProcessor.processData(rawData);
        } else if (scheme === 'welfare') {
            processedResult = welfareDataProcessor.processData(rawData);
        } else {
            return res.status(400).json({ error: 'Unsupported scheme for balances report' });
        }
        
        const { type, value } = req.query;
        await balancesReportGenerator.generatePdf(report, processedResult, res, { type, value });
    } catch (error) {
        console.error('Error generating balances PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF report', message: error.message });
    }
});

// Get shop balances report (HTML Preview)
app.get('/api/reports/:id/balances/html', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) {
            return res.status(400).json({ error: 'Raw data missing', message: 'दुकानवार उठाव शेष विवरण इस ऐतिहासिक रिपोर्ट के लिए अनुपलब्ध है।' });
        }
        
        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';
        
        let processedResult;
        if (scheme === 'nfsa') {
            processedResult = dataProcessor.processData(rawData);
        } else if (scheme === 'mdm') {
            processedResult = mdmDataProcessor.processData(rawData);
        } else if (scheme === 'icds') {
            processedResult = icdsDataProcessor.processData(rawData);
        } else if (scheme === 'welfare') {
            processedResult = welfareDataProcessor.processData(rawData);
        } else {
            return res.status(400).json({ error: 'Unsupported scheme for balances report' });
        }
        
        const { type, value } = req.query;
        const commodities = balancesReportGenerator.getCommodities(scheme);
        const schemeLabel = balancesReportGenerator.getSchemeLabelHindi(scheme);
        const monthHindi = balancesReportGenerator.getMonthNameHindi(report.month);
        
        const html = balancesReportGenerator.generatePdfHtml(
            `दुकानवार उठाव हेतु शेष रिपोर्ट`,
            schemeLabel,
            monthHindi,
            report.year,
            processedResult,
            commodities,
            { type, value }
        );
        
        res.send(html);
    } catch (error) {
        console.error('Error generating balances HTML:', error);
        res.status(500).json({ error: 'Failed to generate HTML preview', message: error.message });
    }
});


// Get defaulters for smart warning messenger
app.get('/api/reports/:id/balances/defaulters', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report || !report.raw_data) return res.status(404).json({ error: 'Report or data not found' });
        
        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';
        
        let processedResult;
        if (scheme === 'nfsa') processedResult = dataProcessor.processData(rawData);
        else if (scheme === 'mdm') processedResult = mdmDataProcessor.processData(rawData);
        else if (scheme === 'icds') processedResult = icdsDataProcessor.processData(rawData);
        else if (scheme === 'welfare') processedResult = welfareDataProcessor.processData(rawData);
        else return res.status(400).json({ error: 'Unsupported scheme' });
        
        const { type, value } = req.query;
        const defaulters = balancesReportGenerator.extractDefaulters(processedResult, scheme, { type, value });
        
        res.json(defaulters);
    } catch (error) {
        console.error('Error fetching defaulters:', error);
        res.status(500).json({ error: 'Failed to fetch defaulters' });
    }
});

// ── Pending Dispatch Summary — JSON (Transporter/Issue Center analytics) ──────
app.get('/api/reports/:id/balances/pending-summary', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) return res.status(400).json({ error: 'Raw data missing' });

        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';

        let processedResult;
        if (scheme === 'nfsa') processedResult = dataProcessor.processData(rawData);
        else if (scheme === 'mdm') processedResult = mdmDataProcessor.processData(rawData);
        else if (scheme === 'icds') processedResult = icdsDataProcessor.processData(rawData);
        else if (scheme === 'welfare') processedResult = welfareDataProcessor.processData(rawData);
        else return res.status(400).json({ error: 'Unsupported scheme' });

        const { groupBy = 'transporter', sortBy = 'pendingQty', filterTransporter, filterIssueCenter } = req.query;
        const summary = balancesReportGenerator.computePendingSummary(processedResult, { groupBy, sortBy, filterTransporter, filterIssueCenter });
        res.json(summary);
    } catch (error) {
        console.error('Error computing pending summary:', error);
        res.status(500).json({ error: 'Failed to compute pending summary', message: error.message });
    }
});

// ── Pending Dispatch Summary — Excel export ────────────────────────────────────
app.get('/api/reports/:id/balances/pending-summary/excel', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) return res.status(400).json({ error: 'Raw data missing' });

        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';

        let processedResult;
        if (scheme === 'nfsa') processedResult = dataProcessor.processData(rawData);
        else if (scheme === 'mdm') processedResult = mdmDataProcessor.processData(rawData);
        else if (scheme === 'icds') processedResult = icdsDataProcessor.processData(rawData);
        else if (scheme === 'welfare') processedResult = welfareDataProcessor.processData(rawData);
        else return res.status(400).json({ error: 'Unsupported scheme' });

        const { groupBy = 'transporter', sortBy = 'pendingQty', filterTransporter, filterIssueCenter } = req.query;
        const summary = balancesReportGenerator.computePendingSummary(processedResult, { groupBy, sortBy, filterTransporter, filterIssueCenter });
        await balancesReportGenerator.generatePendingSummaryExcel(summary, report, res);
    } catch (error) {
        console.error('Error generating pending summary Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel', message: error.message });
    }
});

// ── Pending Dispatch Summary — PDF export ─────────────────────────────────────
app.get('/api/reports/:id/balances/pending-summary/pdf', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) return res.status(400).json({ error: 'Raw data missing' });

        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';

        let processedResult;
        if (scheme === 'nfsa') processedResult = dataProcessor.processData(rawData);
        else if (scheme === 'mdm') processedResult = mdmDataProcessor.processData(rawData);
        else if (scheme === 'icds') processedResult = icdsDataProcessor.processData(rawData);
        else if (scheme === 'welfare') processedResult = welfareDataProcessor.processData(rawData);
        else return res.status(400).json({ error: 'Unsupported scheme' });

        const { groupBy = 'transporter', sortBy = 'pendingQty', filterTransporter, filterIssueCenter } = req.query;
        const summary = balancesReportGenerator.computePendingSummary(processedResult, { groupBy, sortBy, filterTransporter, filterIssueCenter });
        await balancesReportGenerator.generatePendingSummaryPdf(summary, report, res);
    } catch (error) {
        console.error('Error generating pending summary PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
    }
});

// ── Pending Dispatch Summary — HTML preview ───────────────────────────────────
app.get('/api/reports/:id/balances/pending-summary/html', async (req, res) => {
    try {
        const report = await db.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (!report.raw_data) return res.status(400).json({ error: 'Raw data missing' });

        const rawData = JSON.parse(report.raw_data);
        const scheme = report.scheme || 'nfsa';

        let processedResult;
        if (scheme === 'nfsa') processedResult = dataProcessor.processData(rawData);
        else if (scheme === 'mdm') processedResult = mdmDataProcessor.processData(rawData);
        else if (scheme === 'icds') processedResult = icdsDataProcessor.processData(rawData);
        else if (scheme === 'welfare') processedResult = welfareDataProcessor.processData(rawData);
        else return res.status(400).json({ error: 'Unsupported scheme' });

        const { groupBy = 'transporter', sortBy = 'pendingQty', filterTransporter, filterIssueCenter } = req.query;
        const summary = balancesReportGenerator.computePendingSummary(processedResult, { groupBy, sortBy, filterTransporter, filterIssueCenter });
        const html = balancesReportGenerator.generatePendingSummaryHtml(summary, report);
        res.send(html);
    } catch (error) {
        console.error('Error generating pending summary HTML:', error);
        res.status(500).json({ error: 'Failed to generate HTML', message: error.message });
    }
});

// Terminate running report

app.post('/api/terminate-report', async (req, res) => {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Request ID is required' });

    console.log(`🛑 Termination requested for: ${requestId}`);
    
    try {
        const scraper = activeScrapers.get(requestId);
        if (scraper) {
            await scraper.close().catch(e => console.error('Error closing scraper:', e));
            activeScrapers.delete(requestId);
        }
        
        activeRequests.delete(requestId);
        res.json({ success: true, message: 'Report generation terminated' });
    } catch (error) {
        console.error('Termination error:', error);
        res.status(500).json({ error: 'Failed to terminate report' });
    }
});

// Delete report
app.delete('/api/reports/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const report = await db.getReport(id);

        await db.deleteReport(id);

        if (report && report.filepath) {
            // Asynchronously, defensively unlink Excel file
            fs.unlink(report.filepath, (err) => {
                if (err) console.warn(`⚠️ Defensive unlink failed for Excel file: ${report.filepath} (${err.message})`);
                else console.log(`🗑️ Successfully deleted Excel file: ${report.filepath}`);
            });

            // Asynchronously, defensively unlink PDF file
            const pdfPath = report.filepath.replace('.xlsx', '.pdf');
            fs.unlink(pdfPath, (err) => {
                if (err) console.warn(`⚠️ Defensive unlink failed for PDF file: ${pdfPath} (${err.message})`);
                else console.log(`🗑️ Successfully deleted PDF file: ${pdfPath}`);
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete report',
            message: error.message
        });
    }
});

// Update settings
app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        await db.saveSetting(key, value);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to save setting',
            message: error.message
        });
    }
});

// Get settings
app.get('/api/settings/:key', async (req, res) => {
    try {
        const value = await db.getSetting(req.params.key);
        res.json({ value });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch setting',
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────
// MDM SCHEME ENDPOINTS
// ─────────────────────────────────────────────

// Generate MDM report
/**
 * Compute MDM analytics from processedResult for client dashboard
 */
function computeMDMAnalytics(processedResult) {
    const { sectors, totals } = processedResult;

    // Filter sectors with any allotment
    const activeSectors = sectors.filter(s => s.totalAllotted > 0);

    // Grouping helper for Transporters
    const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
        const stats = {};
        data.forEach(s => {
            const name = s.transporter || 'N/A';
            if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
            const disp = (s.wheatDispatched || 0) + (s.fortifiedRiceDispatched || s.riceDispatched || 0);
            stats[name].dispatchSum += (parseFloat(disp) || (s.totalDispatched || 0));
            stats[name].allottedSum += (s.totalAllotted || 0);
            stats[name].count++;
        });

        const list = Object.values(stats).map(t => ({
            name: t.name,
            avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
            sectorCount: t.count
        }));

        const grouped = {};
        list.forEach(t => {
            const pct = t.avgDispatch.toFixed(2);
            if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [] };
            grouped[pct].transporters.push(t);
        });

        return Object.values(grouped)
            .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
            .slice(0, limit)
            .map(g => ({
                name: g.transporters.map(t => t.name).join(', '),
                dispatchPct: g.avgDispatch.toFixed(2),
                sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0)
            }));
    };

    const topTransporters = groupTransporters(activeSectors, 'desc', 5);
    const bottomTransporters = groupTransporters(activeSectors, 'asc', 10);

    // Auto-generate insights
    const insights = [];
    const wPct = totals.wheatDispatchPct;
    const rPct = totals.fortifiedRiceDispatchPct;
    const totalPct = totals.totalDispatchPct;

    if (totalPct >= 100) insights.push({ icon: '🎉', severity: 'success', message: '100% dispatch achieved for all commodities!' });
    else if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total dispatch achieved.` });
    else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
    else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

    const wheatBal = parseFloat((totals.wheatAllotted - totals.wheatDispatched).toFixed(2));
    const riceBal = parseFloat((totals.fortifiedRiceAllotted - totals.fortifiedRiceDispatched).toFixed(2));

    if (wheatBal > 0) insights.push({ icon: '🌾', severity: 'info', message: `Wheat balance pending dispatch: ${wheatBal} Qt (${(100 - wPct).toFixed(1)}% remaining).` });
    if (riceBal > 0) insights.push({ icon: '🍚', severity: 'info', message: `Fortified Rice balance pending: ${riceBal} Qt (${(100 - rPct).toFixed(1)}% remaining).` });

    const pendingSectors = activeSectors.filter(s => s.wheatDispatchPct < 100 || s.fortifiedRiceDispatchPct < 100);
    if (pendingSectors.length === 0) {
        insights.push({ icon: '🏆', severity: 'success', message: 'All sectors have completed 100% dispatch!' });
    } else {
        insights.push({ icon: '📋', severity: 'info', message: `${pendingSectors.length} of ${activeSectors.length} sectors have pending dispatch.` });
    }

    // Matrix for sector progress table
    const matrix = activeSectors.map(s => ({
        name: s.sectorName,
        block: s.block,
        transporter: s.transporter,
        mobile: s.mobile,
        shops: s.mdmShopCount,
        wheatAllotted: s.wheatAllotted,
        wheatDispatched: s.wheatDispatched,
        wheatReceived: s.wheatReceived,
        wheatDispatchPct: s.wheatDispatchPct,
        wheatReceiptPct: s.wheatReceiptPct,
        riceAllotted: s.fortifiedRiceAllotted,
        riceDispatched: s.fortifiedRiceDispatched,
        riceReceived: s.fortifiedRiceReceived,
        riceDispatchPct: s.fortifiedRiceDispatchPct,
        riceReceiptPct: s.fortifiedRiceReceiptPct,
        totalAllotted: s.totalAllotted,
        totalDispatched: s.totalDispatched,
        totalReceived: s.totalReceived
    }));

    const needsAttention = activeSectors
        .filter(s => s.wheatDispatchPct < 100 || s.fortifiedRiceDispatchPct < 100)
        .sort((a, b) => ((a.totalDispatched / a.totalAllotted) - (b.totalDispatched / b.totalAllotted)))
        .map(s => ({
            name: s.sectorName,
            transporter: s.transporter,
            mobile: s.mobile,
            shopsLeft: s.shopsLeft || 0,
            balance: parseFloat((s.totalAllotted - s.totalDispatched).toFixed(2)),
            shops: s.shops || []
        }));

    return {
        metrics: {
            wheatAllotted: totals.wheatAllotted,
            wheatDispatched: Math.min(totals.wheatDispatched, totals.wheatAllotted),
            wheatReceived: Math.min(totals.wheatReceived, totals.wheatAllotted),
            wheatDispatchPct: Math.min(100, totals.wheatDispatchPct),
            wheatReceiptPct: totals.wheatAllotted > 0
                ? Math.min(100, parseFloat(((Math.min(totals.wheatReceived, totals.wheatAllotted) / totals.wheatAllotted) * 100).toFixed(2))) : 0,
            riceAllotted: totals.fortifiedRiceAllotted,
            riceDispatched: Math.min(totals.fortifiedRiceDispatched, totals.fortifiedRiceAllotted),
            riceReceived: Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted),
            riceDispatchPct: Math.min(100, totals.fortifiedRiceDispatchPct),
            riceReceiptPct: totals.fortifiedRiceAllotted > 0
                ? Math.min(100, parseFloat(((Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted) / totals.fortifiedRiceAllotted) * 100).toFixed(2))) : 0,
            totalAllotted: totals.totalAllotted,
            totalDispatched: parseFloat((Math.min(totals.wheatDispatched, totals.wheatAllotted) + Math.min(totals.fortifiedRiceDispatched, totals.fortifiedRiceAllotted)).toFixed(2)),
            totalReceived: parseFloat((Math.min(totals.wheatReceived, totals.wheatAllotted) + Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted)).toFixed(2)),
            totalDispatchPct: Math.min(100, totals.totalDispatchPct),
            totalReceiptPct: Math.min(100, totals.totalReceiptPct),

            totalShops: totals.totalMdmShops, totalShopsLeft: totals.totalShopsLeft || 0,
            activeSectors: activeSectors.length
        },
        matrix,
        topTransporters,
        bottomTransporters,
        needsAttention,
        insights
    };
}

app.post('/api/generate-mdm-report', async (req, res) => {
    if (!checkConcurrencyLimit(res)) return;
    const { month, year, headless } = req.body;
    console.log(`\n⚡ [MDM] Generation Request: Month=${month}, Year=${year}`);
    const requestId = `mdm_${Date.now()}`;

    // Global Hang Safeguard (10m)
    const watchdog = setTimeout(() => {
        if (activeRequests.has(requestId) && activeRequests.get(requestId).status !== 'complete' && activeRequests.get(requestId).status !== 'error') {
            console.error(`🕒 [WATCHDOG] MDM Request ${requestId} killed after 10m hang.`);
            activeRequests.set(requestId, { status: 'error', progress: 0, error: 'Govt portal response timed out.' });
        }
    }, 10 * 60 * 1000);

    if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
    }

    try {
        activeRequests.set(requestId, { status: 'initializing', progress: 0, startTime: Date.now(), scheme: 'mdm' });
        res.json({ requestId, message: 'MDM report generation started', status: 'processing' });

        (async () => {
            const startTime = Date.now();
            const isHeadless = headless !== undefined ? headless : (process.env.HEADLESS_MODE !== 'false');
            const scraper = new MDMScraper();
            activeScrapers.set(requestId, scraper);

            try {
                await scraper.init(isHeadless);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'extracting MDM data from portal...'
                });

                const result = await scraper.extractData(month, year, (current, total, msg) => {
                    const pct = Math.round((current / total) * 80);
                    activeRequests.set(requestId, {
                        ...activeRequests.get(requestId),
                        progress: 10 + pct,
                        message: msg
                    });
                });

                if (!result || result.status === 'failed') {
                    throw new Error(result?.error || 'MDM extraction failed');
                }

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'processing MDM data...', progress: 85
                });

                const processedResult = mdmDataProcessor.processData(result.rawData, result.summaryTotals);

                // Validate Data before Generation
                await reportValidator.validate(processedResult, 'mdm', month, year, db);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'generating Excel...', progress: 90,
                    verification: processedResult.verification
                });

                const reportFile = await mdmExcelGenerator.generateReport(processedResult, month, year);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'saving to database...', progress: 95
                });

                // Generate MDM analytics before saving
                const mdmAnalytics = computeMDMAnalytics(processedResult);
                const aiInsights = await generateAiInsights(processedResult, 'mdm', month, year);
                const fullInsights = { ...mdmAnalytics, aiInsights };

                const reportId = await db.saveReport({
                    month, year,
                    filename: reportFile.filename,
                    filepath: reportFile.filepath,
                    totalAllocation: processedResult.totals.totalAllotted,
                    totalDispatch: processedResult.totals.totalDispatched,
                    totalPOSReceipt: processedResult.totals.totalReceived,
                    dispatchPercentage: processedResult.totals.totalDispatchPct,
                    rawData: result.rawData,
                    scheme: 'mdm',
                    insights: fullInsights
                });

                const extractionTimeSec = Math.floor((Date.now() - startTime) / 1000);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'complete', progress: 100,
                    generationTime: extractionTimeSec,
                    scheme: 'mdm',
                    verification: processedResult.verification,
                    analytics: mdmAnalytics,
                    report: {
                        id: reportId,
                        filename: reportFile.filename,
                        downloadUrl: `reports/${reportFile.filename}`,
                        month: month,
                        year: year
                    }
                });

                console.log('✅ MDM report generation complete!');

            } catch (err) {
                console.error('❌ MDM report generation failed:', err);
                const isNoData = err.message.includes('NO_DATA');
                activeRequests.set(requestId, {
                    status: 'error',
                    progress: 0,
                    error: isNoData ? 'NO_DATA: The portal currently shows "No data found" for this month/year.' : err.message
                });
            } finally {
                activeScrapers.delete(requestId);
                await scraper.close().catch(() => { });
                clearTimeout(watchdog);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: 'Failed to start MDM report generation', message: error.message });
    }
});

// MDM generation status
app.get('/api/generate-mdm-status/:requestId', (req, res) => {
    const status = activeRequests.get(req.params.requestId);
    if (!status) return res.status(404).json({ error: 'Request not found' });
    res.json(status);
});

// ─────────────────────────────────────────────
// ICDS SCHEME ENDPOINTS
// ─────────────────────────────────────────────

// icdsExcelGenerator already initialized at top

/**
 * Compute ICDS analytics (3 commodities) from processedResult for client dashboard
 */
function computeICDSAnalytics(processedResult) {
    const { sectors, totals } = processedResult;
    const activeSectors = sectors.filter(s => s.totalAllotted > 0);
    // Grouping helper for Transporters
    const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
        const stats = {};
        // Filter out zero performance for Top list
        const filteredData = sortOrder === 'desc' ? data.filter(s => (s.wheatDispatched + s.riceDispatched + (s.fsaltDispatched || 0)) > 0) : data;

        filteredData.forEach(s => {
            const name = s.transporter || 'N/A';
            if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
            const disp = (s.wheatDispatched || 0) + (s.riceDispatched || 0) + (s.fsaltDispatched || 0);
            stats[name].dispatchSum += (parseFloat(disp) || (s.totalDispatched || 0));
            stats[name].allottedSum += (s.totalAllotted || 0);
            stats[name].count++;
        });

        const list = Object.values(stats).map(t => ({
            name: t.name,
            avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
            sectorCount: t.count
        }));

        const grouped = {};
        list.forEach(t => {
            const pct = t.avgDispatch.toFixed(2);
            if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [] };
            grouped[pct].transporters.push(t);
        });

        return Object.values(grouped)
            .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
            .slice(0, limit)
            .map(g => {
                g.transporters.sort((a, b) => a.name.localeCompare(b.name, 'hi'));
                return {
                    name: g.transporters.map(t => t.name).join(', '),
                    dispatchPct: g.avgDispatch.toFixed(2),
                    sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0),
                    items: g.transporters
                };
            });
    };

    const topTransporters = groupTransporters(activeSectors, 'desc', 5);
    const bottomTransporters = groupTransporters(activeSectors, 'asc', 10);

    // All sectors with pending items for "Needs Attention" list
    const needsAttention = activeSectors
        .filter(s => s.totalDispatchPct < 100)
        .sort((a, b) => (a.totalDispatchPct - b.totalDispatchPct))
        .map(s => ({
            name: s.sectorName,
            transporter: s.transporter,
            mobile: s.mobile,
            shopsLeft: s.shopsLeft || 0,
            balance: parseFloat((s.totalAllotted - s.totalDispatched).toFixed(2)),
            shops: s.icdsShops || []
        }));

    // Matrix
    const matrix = activeSectors.map(s => ({
        name: s.sectorName, block: s.block, transporter: s.transporter, mobile: s.mobile, shops: s.icdsShopCount,
        wheatAllotted: s.wheatAllotted, wheatDispatched: s.wheatDispatched, wheatReceived: s.wheatReceived,
        wheatDispatchPct: cap(s.wheatDispatchPct), wheatReceiptPct: cap(s.wheatReceiptPct),
        riceAllotted: s.riceAllotted, riceDispatched: s.riceDispatched, riceReceived: s.riceReceived,
        riceDispatchPct: cap(s.riceDispatchPct), riceReceiptPct: cap(s.riceReceiptPct),
        fsaltAllotted: s.fsaltAllotted, fsaltDispatched: s.fsaltDispatched, fsaltReceived: s.fsaltReceived,
        fsaltDispatchPct: cap(s.fsaltDispatchPct), fsaltReceiptPct: cap(s.fsaltReceiptPct),
        totalAllotted: s.totalAllotted, totalDispatched: s.totalDispatched, totalReceived: s.totalReceived,
        totalDispatchPct: s.totalAllotted > 0
            ? cap(parseFloat(((s.totalDispatched / s.totalAllotted) * 100).toFixed(2))) : 0,
        totalReceiptPct: s.totalDispatched > 0
            ? cap(parseFloat(((s.totalReceived / s.totalDispatched) * 100).toFixed(2))) : 0
    }));


    // Insights logic
    const insights = [];
    const totalPct = cap(totals.totalDispatchPct);
    if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total ICDS dispatch achieved.` });
    else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
    else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

    return {
        metrics: {
            wheatAllotted: totals.wheatAllotted,
            wheatDispatched: totals.wheatDispatched,
            wheatReceived: totals.wheatReceived || 0,
            wheatDispatchPct: cap(totals.wheatDispatchPct),
            wheatReceiptPct: totals.wheatDispatched > 0 ? cap(parseFloat((((totals.wheatReceived || 0) / totals.wheatDispatched) * 100).toFixed(2))) : 0,
            riceAllotted: totals.riceAllotted,
            riceDispatched: totals.riceDispatched,
            riceReceived: totals.riceReceived || 0,
            riceDispatchPct: cap(totals.riceDispatchPct),
            riceReceiptPct: totals.riceDispatched > 0 ? cap(parseFloat((((totals.riceReceived || 0) / totals.riceDispatched) * 100).toFixed(2))) : 0,
            fsaltAllotted: totals.fsaltAllotted,
            fsaltDispatched: totals.fsaltDispatched,
            fsaltReceived: totals.fsaltReceived || 0,
            fsaltDispatchPct: cap(totals.fsaltDispatchPct),
            fsaltReceiptPct: totals.fsaltDispatched > 0 ? cap(parseFloat((((totals.fsaltReceived || 0) / totals.fsaltDispatched) * 100).toFixed(2))) : 0,
            totalAllotted: totals.totalAllotted,
            totalDispatched: totals.totalDispatched,
            totalReceived: totals.totalReceived || 0,
            totalDispatchPct: cap(totals.totalDispatchPct),
            totalReceiptPct: totals.totalDispatched > 0 ? cap(parseFloat((((totals.totalReceived || 0) / totals.totalDispatched) * 100).toFixed(2))) : 0,
            totalShops: totals.totalIcdsShops,
            totalShopsLeft: totals.totalShopsLeft || 0,
            activeSectors: activeSectors.length
        },
        matrix,
        topTransporters,
        bottomTransporters,
        needsAttention,
        insights
    };
}

app.post('/api/generate-icds-report', async (req, res) => {
    if (!checkConcurrencyLimit(res)) return;
    const { month, year, headless } = req.body;
    const requestId = `icds_${Date.now()}`;

    if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
    }

    try {
        activeRequests.set(requestId, { status: 'initializing', progress: 0, startTime: Date.now(), scheme: 'icds' });
        res.json({ requestId, message: 'ICDS report generation started', status: 'processing' });

        (async () => {
            const startTime = Date.now();
            const isHeadless = headless !== undefined ? headless : (process.env.HEADLESS_MODE !== 'false');
            const scraper = new ICDSScraper();
            activeScrapers.set(requestId, scraper);

            try {
                await scraper.init(isHeadless);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'extracting ICDS data from portal...'
                });

                const result = await scraper.extractData(month, year, (current, total, msg) => {
                    const pct = Math.round((current / total) * 80);
                    activeRequests.set(requestId, {
                        ...activeRequests.get(requestId),
                        progress: 10 + pct,
                        message: msg
                    });
                });

                if (!result || result.status === 'failed') {
                    throw new Error(result?.error || 'ICDS extraction failed');
                }

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'processing ICDS data...', progress: 85
                });

                const processedResult = icdsDataProcessor.processData(result.rawData, result.summaryTotals);

                // Validate Data before Generation
                await reportValidator.validate(processedResult, 'icds', month, year, db);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'generating Excel...', progress: 90,
                    verification: processedResult.verification
                });

                const reportFile = await icdsExcelGenerator.generateReport(processedResult, month, year);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'saving to database...', progress: 95
                });

                // Generate ICDS analytics before saving
                const icdsAnalytics = computeICDSAnalytics(processedResult);
                const aiInsights = await generateAiInsights(processedResult, 'icds', month, year);
                const fullInsights = { ...icdsAnalytics, aiInsights };

                const reportId = await db.saveReport({
                    month, year,
                    filename: reportFile.filename,
                    filepath: reportFile.filepath,
                    totalAllocation: processedResult.totals.totalAllotted,
                    totalDispatch: processedResult.totals.totalDispatched,
                    totalPOSReceipt: processedResult.totals.totalReceived || 0,
                    dispatchPercentage: processedResult.totals.totalDispatchPct,
                    rawData: result.rawData,
                    scheme: 'icds',
                    insights: fullInsights
                });

                const extractionTimeSec = Math.floor((Date.now() - startTime) / 1000);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'complete', progress: 100,
                    generationTime: extractionTimeSec,
                    scheme: 'icds',
                    verification: processedResult.verification,
                    analytics: icdsAnalytics,
                    report: {
                        id: reportId,
                        filename: reportFile.filename,
                        downloadUrl: `reports/${reportFile.filename}`,
                        month: month,
                        year: year
                    }
                });

                console.log('✅ ICDS report generation complete!');

            } catch (err) {
                console.error('❌ ICDS report generation failed:', err);
                const isNoData = err.message.includes('NO_DATA');
                activeRequests.set(requestId, {
                    status: 'error',
                    progress: 0,
                    error: isNoData ? 'NO_DATA: The portal currently shows "No data found" for this month/year.' : err.message
                });
            } finally {
                activeScrapers.delete(requestId);
                await scraper.close().catch(() => { });
            }
        })();

    } catch (error) {
        res.status(500).json({ error: 'Failed to start ICDS report generation', message: error.message });
    }
});

// ICDS generation status
app.get('/api/generate-icds-status/:requestId', (req, res) => {
    const status = activeRequests.get(req.params.requestId);
    if (!status) return res.status(404).json({ error: 'Request not found' });
    res.json(status);
});

// ─────────────────────────────────────────────
// WELFARE SCHEME ENDPOINTS
// ─────────────────────────────────────────────

// welfareExcelGenerator already initialized at top

/**
 * Compute Welfare analytics (2 commodities) from processedResult for client dashboard.
 */
function computeWelfareAnalytics(processedResult) {
    const { sectors, totals } = processedResult;
    const activeSectors = sectors.filter(s => s.totalAllotted > 0);
    // Grouping helper for Transporters
    const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
        const stats = {};
        // Filter out zero performance for Top list
        const filteredData = sortOrder === 'desc' ? data.filter(s => (s.wheatDispatched + s.riceDispatched) > 0) : data;

        filteredData.forEach(s => {
            const name = s.transporter || 'N/A';
            if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
            const disp = (s.wheatDispatched || 0) + (s.riceDispatched || 0);
            stats[name].dispatchSum += (parseFloat(disp) || (s.totalDispatched || 0));
            stats[name].allottedSum += (s.totalAllotted || 0);
            stats[name].count++;
        });

        const list = Object.values(stats).map(t => ({
            name: t.name,
            avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
            sectorCount: t.count
        }));

        const grouped = {};
        list.forEach(t => {
            const pct = t.avgDispatch.toFixed(2);
            if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [] };
            grouped[pct].transporters.push(t);
        });

        return Object.values(grouped)
            .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
            .slice(0, limit)
            .map(g => {
                g.transporters.sort((a, b) => a.name.localeCompare(b.name, 'hi'));
                return {
                    name: g.transporters.map(t => t.name).join(', '),
                    dispatchPct: g.avgDispatch.toFixed(2),
                    sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0),
                    items: g.transporters
                };
            });
    };

    const topTransporters = groupTransporters(activeSectors, 'desc', 5);
    const bottomTransporters = groupTransporters(activeSectors, 'asc', 10);

    // All sectors with pending items for "Needs Attention" list
    const needsAttention = activeSectors
        .filter(s => s.totalDispatchPct < 100)
        .sort((a, b) => (a.totalDispatchPct - b.totalDispatchPct))
        .map(s => ({
            name: s.sectorName, transporter: s.transporter,
            mobile: s.mobile,
            shopsLeft: s.shopsLeft || 0,
            balance: parseFloat((s.totalAllotted - s.totalDispatched).toFixed(2)),
            shops: s.welfareShops || []
        }));

    // Matrix
    const matrix = activeSectors.map(s => ({
        name: s.sectorName, block: s.block, transporter: s.transporter, mobile: s.mobile, shops: s.welfareShopCount,
        wheatAllotted: s.wheatAllotted, wheatDispatched: s.wheatDispatched, wheatReceived: s.wheatReceived,
        wheatDispatchPct: cap(s.wheatDispatchPct), wheatReceiptPct: cap(s.wheatReceiptPct),
        riceAllotted: s.riceAllotted, riceDispatched: s.riceDispatched, riceReceived: s.riceReceived,
        riceDispatchPct: cap(s.riceDispatchPct), riceReceiptPct: cap(s.riceReceiptPct),
        totalAllotted: s.totalAllotted, totalDispatched: s.totalDispatched, totalReceived: s.totalReceived,
        totalDispatchPct: s.totalAllotted > 0 ? cap(parseFloat(((s.totalDispatched / s.totalAllotted) * 100).toFixed(2))) : 0,
        totalReceiptPct: s.totalDispatched > 0 ? cap(parseFloat(((s.totalReceived / s.totalDispatched) * 100).toFixed(2))) : 0
    }));

    const insights = [];
    const totalPct = cap(totals.totalDispatchPct);
    if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total Welfare dispatch achieved.` });
    else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
    else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

    return {
        metrics: {
            wheatAllotted: totals.wheatAllotted,
            wheatDispatched: totals.wheatDispatched,
            wheatReceived: totals.wheatReceived || 0,
            wheatDispatchPct: cap(totals.wheatDispatchPct),
            wheatReceiptPct: totals.wheatDispatched > 0 ? cap(parseFloat((((totals.wheatReceived || 0) / totals.wheatDispatched) * 100).toFixed(2))) : 0,
            riceAllotted: totals.riceAllotted,
            riceDispatched: totals.riceDispatched,
            riceReceived: totals.riceReceived || 0,
            riceDispatchPct: cap(totals.riceDispatchPct),
            riceReceiptPct: totals.riceDispatched > 0 ? cap(parseFloat((((totals.riceReceived || 0) / totals.riceDispatched) * 100).toFixed(2))) : 0,
            totalAllotted: totals.totalAllotted,
            totalDispatched: totals.totalDispatched,
            totalReceived: totals.totalReceived || 0,
            totalDispatchPct: cap(totals.totalDispatchPct),
            totalReceiptPct: totals.totalDispatched > 0 ? cap(parseFloat((((totals.totalReceived || 0) / totals.totalDispatched) * 100).toFixed(2))) : 0,
            totalShops: totals.totalWelfareShops,
            totalShopsLeft: totals.totalShopsLeft || 0,
            activeSectors: activeSectors.length
        },
        matrix,
        topTransporters,
        bottomTransporters,
        needsAttention,
        insights
    };
}

app.post('/api/generate-welfare-report', async (req, res) => {
    if (!checkConcurrencyLimit(res)) return;
    const { month, year, headless } = req.body;
    const requestId = `welfare_${Date.now()}`;

    if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
    }

    try {
        activeRequests.set(requestId, { status: 'initializing', progress: 0, startTime: Date.now(), scheme: 'welfare' });
        res.json({ requestId, message: 'Welfare report generation started', status: 'processing' });

        (async () => {
            const startTime = Date.now();
            const isHeadless = headless !== undefined ? headless : (process.env.HEADLESS_MODE !== 'false');
            const scraper = new WelfareScraper();
            activeScrapers.set(requestId, scraper);

            try {
                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'launching browser...', progress: 2
                });
                await scraper.init(isHeadless);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'connecting to Welfare portal...', progress: 5
                });

                const result = await scraper.extractData(month, year, (current, total, msg) => {
                    const pct = Math.round((current / total) * 80);
                    activeRequests.set(requestId, {
                        ...activeRequests.get(requestId),
                        progress: 10 + pct,
                        message: msg
                    });
                });

                if (!result || result.status === 'failed') {
                    throw new Error(result?.error || 'Welfare extraction failed');
                }

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'processing Welfare data...', progress: 85
                });

                const processedResult = welfareDataProcessor.processData(result.rawData, result.summaryTotals);

                // Validation: Prevent saving empty reports
                if ((!result.rawData || result.rawData.length === 0) && (!processedResult.totals || processedResult.totals.totalAllotted === 0)) {
                    throw new Error('NO_DATA: Welfare data extraction returned zero allotment and no records.');
                }

                // Validate Data before Generation
                await reportValidator.validate(processedResult, 'welfare', month, year, db);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'generating Excel...', progress: 90,
                    verification: processedResult.verification
                });

                const reportFile = await welfareExcelGenerator.generateReport(processedResult, month, year);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'saving to database...', progress: 95
                });

                // Generate Welfare analytics before saving
                const welfareAnalytics = computeWelfareAnalytics(processedResult);
                const aiInsights = await generateAiInsights(processedResult, 'welfare', month, year);
                const fullInsights = { ...welfareAnalytics, aiInsights };

                const reportId = await db.saveReport({
                    month, year,
                    filename: reportFile.filename,
                    filepath: reportFile.filepath,
                    totalAllocation: processedResult.totals.totalAllotted,
                    totalDispatch: processedResult.totals.totalDispatched,
                    totalPOSReceipt: processedResult.totals.totalReceived || 0,
                    dispatchPercentage: processedResult.totals.totalDispatchPct,
                    rawData: result.rawData,
                    scheme: 'welfare',
                    insights: fullInsights
                });

                const extractionTimeSec = Math.floor((Date.now() - startTime) / 1000);

                activeRequests.set(requestId, {
                    ...activeRequests.get(requestId),
                    status: 'complete', progress: 100,
                    generationTime: extractionTimeSec,
                    scheme: 'welfare',
                    verification: processedResult.verification,
                    analytics: welfareAnalytics,
                    report: {
                        id: reportId,
                        filename: reportFile.filename,
                        downloadUrl: `reports/${reportFile.filename}`,
                        month: month,
                        year: year
                    }
                });

                console.log('✅ Welfare report generation complete!');

            } catch (err) {
                console.error('❌ Welfare report generation failed:', err);
                const isNoData = err.message.includes('NO_DATA');
                activeRequests.set(requestId, {
                    status: 'error',
                    progress: 0,
                    error: isNoData ? 'NO_DATA: The portal currently shows "No data found" for this month/year.' : err.message
                });
            } finally {
                activeScrapers.delete(requestId);
                await scraper.close().catch(() => { });
            }
        })();

    } catch (error) {
        res.status(500).json({ error: 'Failed to start Welfare report generation', message: error.message });
    }
});

// Welfare generation status
app.get('/api/generate-welfare-status/:requestId', (req, res) => {
    const status = activeRequests.get(req.params.requestId);
    if (!status) return res.status(404).json({ error: 'Request not found' });
    res.json(status);
});

// ─────────────────────────────────────────────
// LIVE GOOGLE SHEET STOCK POSITION ENDPOINT
// ─────────────────────────────────────────────
function parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c !== '')) {
                lines.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
            lines.push(currentRow);
        }
    }
    return lines;
}

const DEFAULT_BETUL_STOCK_SHEET_URL = 'https://docs.google.com/spreadsheets/d/13lEnaakk6idsNkAV--RH5cr2PAiwXQEjeNEP836tRa8/edit?gid=519497993#gid=519497993';

app.post(['/api/stock-position/fetch-sheet', '/stock-position/fetch-sheet'], async (req, res) => {
    try {
        let sheetUrl = (req.body && req.body.sheetUrl) ? req.body.sheetUrl.trim() : '';
        if (!sheetUrl) {
            sheetUrl = DEFAULT_BETUL_STOCK_SHEET_URL;
        }

        let sheetId = sheetUrl;
        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            sheetId = match[1];
        }

        // STRICTLY target View_LiveRollup tab only as requested
        const sheetParam = 'sheet=View_LiveRollup';

        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=3&${sheetParam}`;
        
        const response = await fetch(csvUrl);
        if (!response.ok) {
            return res.status(400).json({ 
                error: `Failed to fetch Google Sheet (${response.status} ${response.statusText}). Please verify the sheet permissions are set to "Anyone with the link can view".` 
            });
        }

        const rawCsv = await response.text();
        const rows = parseCSV(rawCsv);

        if (rows.length === 0) {
            return res.status(400).json({ error: 'The Google Sheet appears to be empty.' });
        }

        let headers = rows[0] || [];
        const dataRows = rows.slice(1);

        // Clean headers for View_LiveRollup
        if (headers[0] && headers[0].includes('Live District Rollup')) {
            headers[0] = 'IC Code';
        }
        if (headers[1] && headers[1].includes('Issue Center')) {
            headers[1] = 'Issue Center (इश्यू सेंटर)';
        }
        for (let i = 2; i < headers.length; i++) {
            let h = headers[i] || '';
            h = h.replace(/\(always today - no manual entry needed\)/gi, '').replace(/\r?\n/g, ' ').trim();
            if (h === 'IC Total') h = 'IC Total (Quintals)';
            headers[i] = h;
        }

        // Omit IC Code (column 0) to show only ONE Issue Center column; filter out commodity columns with Total === 0
        const totalRow = dataRows.find(r => (r[1] && r[1].includes('योग')) || (r[0] && r[0].includes('Total'))) || dataRows[dataRows.length - 1];
        const parseVal = (v) => parseFloat((v || '').replace(/,/g, '')) || 0;

        const activeColIndices = [];
        headers.forEach((h, colIdx) => {
            // Omit IC Code (colIdx 0)
            if (colIdx === 0) return;

            // Always keep Issue Center (1) and IC Total (last column)
            if (colIdx === 1 || colIdx === headers.length - 1) {
                activeColIndices.push(colIdx);
                return;
            }

            let colTotal = 0;
            if (totalRow) {
                colTotal = Math.abs(parseVal(totalRow[colIdx]));
            } else {
                dataRows.forEach(r => { colTotal += Math.abs(parseVal(r[colIdx])); });
            }

            if (colTotal > 0.001) {
                activeColIndices.push(colIdx);
            }
        });

        const filteredHeaders = activeColIndices.map(i => headers[i]);
        const filteredRows = dataRows.map(r => activeColIndices.map(i => r[i]));

        res.json({
            success: true,
            sheetId,
            sheetName: 'View_LiveRollup',
            headers: filteredHeaders,
            dataRows: filteredRows,
            totalRows: filteredRows.length,
            fetchedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error fetching Google Sheet stock position:', err);
        res.status(500).json({
            error: `Error accessing Google Sheet: ${err.message}. Please verify the link and public view permissions.`
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// STOCK SHORTFALL ANALYSIS ENDPOINT (v2)
// Returns commodity-wise (Wheat, Rice, F.Salt) allocations per Issue Center
// aggregated from the latest report for each scheme (NFSA, MDM, ICDS, Welfare).
// Rice = regular rice + fortified rice combined.
// The frontend overlays these allocations against live Google Sheet stock data
// to calculate true shortfall/excess per commodity per IC.
// ─────────────────────────────────────────────────────────────────────────────

app.get(['/api/stock-position/shortfall', '/stock-position/shortfall'], async (req, res) => {
    try {
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        // Helper: normalize and extract canonical Hindi IC name from any sector/block string
        function sectorToIC(name) {
            if (!name) return '';
            let clean = name.toString().split('(')[0].split(' सेक्टर')[0].split(' क्र')[0].split('-')[0].trim().toUpperCase();
            
            if (clean.includes('BETUL') || clean.includes('बैतूल') || clean.includes('बैतुल')) return 'बैतूल';
            if (clean.includes('SHAHPUR') || clean.includes('शाहपुर')) return 'शाहपुर';
            if (clean.includes('AMLA') || clean.includes('आमला')) return 'आमला';
            if (clean.includes('GHORA') || clean.includes('GHODA') || clean.includes('घोड़ा') || clean.includes('घोडा') || clean.includes('घोड़ा')) return 'घोड़ाडोंगरी';
            if (clean.includes('MULTAI') || clean.includes('मुलताई')) return 'मुलताई';
            if (clean.includes('PATTAN') || clean.includes('पट्टन') || clean.includes('पटटन')) return 'प्रभातपट्टन';
            if (clean.includes('ATHNER') || clean.includes('आठनेर')) return 'आठनेर';
            if (clean.includes('BHAINS') || clean.includes('भैंस') || clean.includes('भैस')) return 'भैंसदेही';
            if (clean.includes('CHICHOLI') || clean.includes('चिचोली')) return 'भीमपुर';
            if (clean.includes('BHIMPUR') || clean.includes('भीमपुर')) return 'भीमपुर';
            
            return clean;
        }

        // Fetch latest report per scheme from DB
        async function latestReport(scheme) {
            try {
                if (db && typeof db.get === 'function') {
                    const r = db.get(`SELECT * FROM reports WHERE scheme = ? ORDER BY year DESC, month DESC, generated_at DESC LIMIT 1`, [scheme]);
                    if (r && typeof r.then === 'function') return await r;
                }
                if (db && db.db && typeof db.db.get === 'function') {
                    return new Promise((resolve) => {
                        db.db.get(
                            `SELECT * FROM reports WHERE scheme = ? ORDER BY year DESC, month DESC, generated_at DESC LIMIT 1`,
                            [scheme],
                            (err, row) => resolve(row || null)
                        );
                    });
                }
            } catch (err) {
                console.error(`Error fetching latest report for ${scheme}:`, err);
            }
            return null;
        }

        const [nfsaRow, mdmRow, icdsRow, welfareRow] = await Promise.all([
            latestReport('nfsa'),
            latestReport('mdm'),
            latestReport('icds'),
            latestReport('welfare'),
        ]);

        // ── Helper: Build commodity Quantity Left for Dispatch map per IC from matrix rows ──
        function aggregateMatrixCommodities(row) {
            if (!row) return { data: {}, meta: null };
            const ins = JSON.parse(row.insights || '{}');
            const data = {}; // ic → { wheat, rice, fSalt, allocWheat, allocRice, allocFSalt }
            (ins.matrix || []).forEach(r => {
                const ic = sectorToIC(r.block || r.name);
                if (!ic) return;
                if (!data[ic]) data[ic] = { 
                    wheat: 0, rice: 0, fSalt: 0,
                    allocWheat: 0, allocRice: 0, allocFSalt: 0 
                };

                const wAlloc = r.wheatAllotted || 0;
                const rAlloc = (r.riceAllotted || 0) + (r.fortifiedRiceAllotted || 0);
                const sAlloc = r.fsaltAllotted || 0;

                const wDisp = r.wheatDispatched || 0;
                const rDisp = (r.riceDispatched || 0) + (r.fortifiedRiceDispatched || 0);
                const sDisp = r.fsaltDispatched || 0;

                // Quantity Left for Dispatch = Allotted - Dispatched
                data[ic].wheat += Math.max(0, wAlloc - wDisp);
                data[ic].rice  += Math.max(0, rAlloc - rDisp);
                data[ic].fSalt += Math.max(0, sAlloc - sDisp);

                data[ic].allocWheat += wAlloc;
                data[ic].allocRice  += rAlloc;
                data[ic].allocFSalt += sAlloc;
            });
            const meta = { month: row.month, year: row.year, label: MONTH_NAMES[(row.month - 1) % 12] + ' ' + row.year };
            return { data, meta };
        }

        // ── NFSA: aggregate Quantity Left for Dispatch by IC block ──
        let nfsaIC = {};
        let nfsaMeta = null;
        if (nfsaRow) {
            nfsaMeta = { month: nfsaRow.month, year: nfsaRow.year, label: MONTH_NAMES[(nfsaRow.month - 1) % 12] + ' ' + nfsaRow.year };
            if (nfsaRow.raw_data) {
                try {
                    const raw = JSON.parse(nfsaRow.raw_data);
                    const rawList = Array.isArray(raw) ? raw : Object.values(raw);
                    rawList.forEach(item => {
                        const ic = sectorToIC(item.issuePoint || item.sectorName || item.sector || '');
                        if (!ic) return;
                        if (!nfsaIC[ic]) nfsaIC[ic] = { wheat: 0, rice: 0, fSalt: 0, allocWheat: 0, allocRice: 0, allocFSalt: 0 };
                        
                        const c = item.commodities || {};
                        const dc = item.dispatchCommodities || {};
                        
                        const wAlloc = (c.wheat || 0);
                        const rAlloc = (c.rice || 0) + (c.fortifiedRice || 0);
                        const sAlloc = (c.fSalt || c.salt || 0);
                        
                        const wDisp = (dc.wheat || 0);
                        const rDisp = (dc.rice || 0) + (dc.fortifiedRice || 0);
                        const sDisp = (dc.fSalt || dc.salt || 0);
                        
                        // Quantity Left for Dispatch = Allotted - Dispatched
                        nfsaIC[ic].wheat += Math.max(0, wAlloc - wDisp);
                        nfsaIC[ic].rice  += Math.max(0, rAlloc - rDisp);
                        nfsaIC[ic].fSalt += Math.max(0, sAlloc - sDisp);

                        nfsaIC[ic].allocWheat += wAlloc;
                        nfsaIC[ic].allocRice  += rAlloc;
                        nfsaIC[ic].allocFSalt += sAlloc;
                    });
                } catch(e) {
                    console.error('Error parsing NFSA raw_data:', e);
                }
            } else {
                const ins = JSON.parse(nfsaRow.insights || '{}');
                if (ins.needsAttention && ins.needsAttention.length > 0) {
                    ins.needsAttention.forEach(shop => {
                        const ic = sectorToIC(shop.sectorName || shop.sector || '');
                        if (!ic) return;
                        if (!nfsaIC[ic]) nfsaIC[ic] = { wheat: 0, rice: 0, fSalt: 0, allocWheat: 0, allocRice: 0, allocFSalt: 0 };
                        const c = shop.commodities || {};
                        nfsaIC[ic].wheat += (c.wheat || 0);
                        nfsaIC[ic].rice  += (c.rice || 0) + (c.fortifiedRice || 0);
                        nfsaIC[ic].fSalt += (c.fSalt || c.fsalt || 0);
                    });
                }
            }
        }

        const mdmResult     = aggregateMatrixCommodities(mdmRow);
        const icdsResult    = aggregateMatrixCommodities(icdsRow);
        const welfareResult = aggregateMatrixCommodities(welfareRow);

        const standard9ICs = ['बैतूल', 'भीमपुर', 'शाहपुर', 'घोड़ाडोंगरी', 'मुलताई', 'प्रभातपट्टन', 'आमला', 'आठनेर', 'भैंसदेही'];

        // ── Build unified IC list ──
        const allICs = new Set([
            ...standard9ICs,
            ...Object.keys(nfsaIC),
            ...Object.keys(mdmResult.data),
            ...Object.keys(icdsResult.data),
            ...Object.keys(welfareResult.data),
        ]);

        const issueCenters = [];
        allICs.forEach(ic => {
            const nfsa    = nfsaIC[ic]             || { wheat: 0, rice: 0, fSalt: 0, allocWheat: 0, allocRice: 0, allocFSalt: 0 };
            const mdm     = mdmResult.data[ic]     || { wheat: 0, rice: 0, fSalt: 0, allocWheat: 0, allocRice: 0, allocFSalt: 0 };
            const icds    = icdsResult.data[ic]    || { wheat: 0, rice: 0, fSalt: 0, allocWheat: 0, allocRice: 0, allocFSalt: 0 };
            const welfare = welfareResult.data[ic] || { wheat: 0, rice: 0, fSalt: 0, allocWheat: 0, allocRice: 0, allocFSalt: 0 };

            // Total Quantity Left for Dispatch across all schemes (Balance)
            const totalLeft = {
                wheat: +(nfsa.wheat + mdm.wheat + icds.wheat + welfare.wheat).toFixed(2),
                rice:  +(nfsa.rice  + mdm.rice  + icds.rice  + welfare.rice).toFixed(2),
                fSalt: +(nfsa.fSalt + mdm.fSalt + icds.fSalt + welfare.fSalt).toFixed(2),
            };

            // Total Allocation across all schemes
            const totalAlloc = {
                wheat: +(nfsa.allocWheat + mdm.allocWheat + icds.allocWheat + welfare.allocWheat).toFixed(2),
                rice:  +(nfsa.allocRice  + mdm.allocRice  + icds.allocRice  + welfare.allocRice).toFixed(2),
                fSalt: +(nfsa.allocFSalt + mdm.allocFSalt + icds.allocFSalt + welfare.allocFSalt).toFixed(2),
            };

            issueCenters.push({
                ic,
                schemes: {
                    nfsa:    { wheat: +nfsa.wheat.toFixed(2),    rice: +nfsa.rice.toFixed(2),    fSalt: +nfsa.fSalt.toFixed(2),    allocWheat: +nfsa.allocWheat.toFixed(2), allocRice: +nfsa.allocRice.toFixed(2), allocFSalt: +nfsa.allocFSalt.toFixed(2) },
                    mdm:     { wheat: +mdm.wheat.toFixed(2),     rice: +mdm.rice.toFixed(2),     fSalt: +mdm.fSalt.toFixed(2),     allocWheat: +mdm.allocWheat.toFixed(2), allocRice: +mdm.allocRice.toFixed(2), allocFSalt: +mdm.allocFSalt.toFixed(2) },
                    icds:    { wheat: +icds.wheat.toFixed(2),    rice: +icds.rice.toFixed(2),    fSalt: +icds.fSalt.toFixed(2),    allocWheat: +icds.allocWheat.toFixed(2), allocRice: +icds.allocRice.toFixed(2), allocFSalt: +icds.allocFSalt.toFixed(2) },
                    welfare: { wheat: +welfare.wheat.toFixed(2), rice: +welfare.rice.toFixed(2), fSalt: +welfare.fSalt.toFixed(2), allocWheat: +welfare.allocWheat.toFixed(2), allocRice: +welfare.allocRice.toFixed(2), allocFSalt: +welfare.allocFSalt.toFixed(2) },
                },
                totalLeft,
                totalAlloc,
                // Backward compatibility: provide totalDemand as totalLeft
                totalDemand: totalLeft
            });
        });

        // Sort by total wheat Quantity Left for Dispatch descending
        issueCenters.sort((a, b) => b.totalLeft.wheat - a.totalLeft.wheat);

        res.json({
            success: true,
            meta: {
                nfsa:    nfsaMeta,
                mdm:     mdmResult.meta,
                icds:    icdsResult.meta,
                welfare: welfareResult.meta,
            },
            issueCenters,
        });
    } catch (err) {
        console.error('Error computing stock shortfall:', err);
        res.status(500).json({ error: err.message });
    }
});



/**
 * Small helper: normalizes a comma/semicolon separated string of recipient
 * emails (or an array of emails) into a single comma-separated string
 * suitable for nodemailer's `cc`/`to` fields. Returns undefined if empty.
 */
function parseEmailList(input) {
    if (!input) return undefined;
    const raw = Array.isArray(input) ? input.join(',') : String(input);
    const emails = raw.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    return emails.length > 0 ? emails.join(', ') : undefined;
}

/**
 * Custom error type carrying an HTTP status code, used by
 * runEmailBundleJob() so both the API route and the cron job can
 * distinguish validation errors (400/404) from unexpected failures (500).
 */
class ApiError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
    }
}

app.post('/api/email-report', async (req, res) => {
    const { reportId, scheme, emailTo, cc, format } = req.body;

    if (!reportId || !emailTo || !format) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const report = await db.getReport(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const attachments = [];
        
        // Add Excel attached if requested
        if (format === 'excel' || format === 'both') {
            if (fs.existsSync(report.filepath)) {
                attachments.push({
                    filename: report.filename,
                    path: report.filepath
                });
            } else {
                return res.status(404).json({ error: 'Excel file not found on server' });
            }
        }

        // Add PDF attached if requested
        if (format === 'pdf' || format === 'both') {
            const pdfFilename = report.filename.replace('.xlsx', '.pdf');
            let finalPdfPath = path.join(__dirname, 'reports', pdfFilename);
            let finalPdfFilename = pdfFilename;
            
            // If PDF doesn't exist yet, we must generate it (similar to GET /api/generate-pdf/:id)
            if (!fs.existsSync(finalPdfPath)) {
                let rData = report.raw_data;
                if (typeof rData === 'string') {
                    rData = JSON.parse(rData);
                }
                
                const repScheme = report.scheme || 'nfsa';
                let pdfGen;
                let procData;
                let pdfResult;
                
                if (repScheme === 'nfsa_daterange') {
                    pdfGen = new NFSADaterangePdfGenerator();
                    const daterangeProcessor = new NFSADaterangeDataProcessor();
                    
                    const actualRData = rData.rawData || rData;
                    const summaryTotals = rData.summaryTotals || null;
                    const allotmentMapping = rData.allotmentMapping || null;
                    procData = daterangeProcessor.processData(actualRData, summaryTotals, allotmentMapping);
                    
                    // Extract actual fromDate and toDate from filename for DR PDF header
                    const match = report.filename.match(/NFSA_(\d{2}-\d{2}-\d{4})_to_(\d{2}-\d{2}-\d{4})/);
                    let actualFromDate = "Start";
                    let actualToDate = "End";
                    if (match) {
                        actualFromDate = match[1].replace(/-/g, '/');
                        actualToDate = match[2].replace(/-/g, '/');
                    }
                    pdfResult = await pdfGen.generateReport(procData, actualFromDate, actualToDate);
                } else if (repScheme === 'mdm') {
                    pdfGen = new MDMPDFGenerator();
                    procData = mdmDataProcessor.processData(rData);
                    pdfResult = await pdfGen.generateReport(procData, report.month, report.year);
                } else if (repScheme === 'icds') {
                    pdfGen = new ICDSPDFGenerator();
                    procData = icdsDataProcessor.processData(rData);
                    pdfResult = await pdfGen.generateReport(procData, report.month, report.year);
                } else if (repScheme === 'welfare') {
                    pdfGen = new WelfarePDFGenerator();
                    procData = welfareDataProcessor.processData(rData);
                    pdfResult = await pdfGen.generateReport(procData, report.month, report.year);
                } else {
                    pdfGen = new PDFGenerator();
                    procData = dataProcessor.processData(rData);
                    pdfResult = await pdfGen.generateReport(procData, report.month, report.year, report.ro_type);
                }
                
                finalPdfPath = pdfResult.filepath;
                finalPdfFilename = pdfResult.filename;
            }
            
            attachments.push({
                filename: finalPdfFilename,
                path: finalPdfPath
            });
        }

        // Configure Nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_PORT == 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        // Send Email
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"PDS Report System" <no-reply@example.com>',
            to: emailTo,
            subject: `PDS Report: ${report.filename.replace('.xlsx', '')}`,
            text: `Please find attached the requested PDS Lifting Report for ${report.month}/${report.year}.\n\nScheme: ${report.scheme === 'nfsa_daterange' ? 'NFSA Date Range' : (report.scheme || 'NFSA').toUpperCase()}\n\nBest Regards,\nPDS Automation System`,
            attachments: attachments
        };
        const ccList = parseEmailList(cc);
        if (ccList) mailOptions.cc = ccList;

        const info = await transporter.sendMail(mailOptions);
        
        // Log it
        if (db.logEmail) {
            await db.logEmail(reportId, emailTo, mailOptions.subject, 'success');
        }

        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('Error sending email:', error);
        if (db.logEmail && reportId && emailTo) {
            await db.logEmail(reportId, emailTo, `PDS Report: ID ${reportId}`, 'failed', error.message).catch(()=>console.error('Error logging email error'));
        }
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

/**
 * Get Email Audit Logs
 */
app.get('/api/email-logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '100', 10);
        const logs = await db.getEmailLogs(limit);
        res.json({ success: true, logs: logs || [] });
    } catch (error) {
        console.error('Error fetching email logs:', error);
        res.status(500).json({ error: 'Failed to fetch email logs', details: error.message });
    }
});

/**
 * Clear Email Audit Logs
 */
app.delete('/api/email-logs', async (req, res) => {
    try {
        await db.clearEmailLogs();
        res.json({ success: true, message: 'Email logs cleared' });
    } catch (error) {
        console.error('Error clearing email logs:', error);
        res.status(500).json({ error: 'Failed to clear email logs', details: error.message });
    }
});


/**
 * Get all available months, years, and schemes from the database
 */
app.get('/api/auth/available-periods', async (req, res) => {
    try {
        db.db.all(`
            SELECT DISTINCT month, year, scheme 
            FROM reports 
            WHERE LOWER(scheme) NOT IN ('nfsa_daterange', 'daterange')
            ORDER BY year DESC, month DESC, scheme ASC
        `, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error', message: err.message });
            }
            res.json(rows || []);
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

/**
 * Core bundle-building + emailing logic, shared by the /api/email-bundle
 * route (interactive "Generate & Send" button) and the daily cron job
 * triggered by the Automated Daily Emails scheduler.
 *
 * Throws ApiError on validation/processing failures; the HTTP route
 * catches these and maps them to the appropriate status code, while the
 * cron job just logs them.
 */
async function runEmailBundleJob({ selectedSchemes, emailTo, cc, format, forceRefresh }) {
    {
        if (!selectedSchemes || !Array.isArray(selectedSchemes) || selectedSchemes.length === 0) {
            throw new ApiError('Please select at least one scheme.', 400);
        }

        const attachments = [];
        const schemesFound = new Set();
        const monthsFound = new Set();
        const yearsFound = new Set();
        let reportsProcessed = 0;
        const generationErrors = [];

        for (const selection of selectedSchemes) {
            const { scheme, month, year } = selection;

            let report = null;

            // 1. Check if report already exists in DB
            let existingReports = await db.all(`
                SELECT * FROM reports 
                WHERE scheme = ? AND month = ? AND year = ?
                ORDER BY generated_at DESC LIMIT 1
            `, [scheme, month, year]);
            let existingReport = existingReports && existingReports.length > 0 ? existingReports[0] : null;

            if (existingReport && !forceRefresh) {
                report = existingReport;
                console.log(`✅ [email-bundle] Using existing report for ${scheme} ${month}/${year}`);
            }

            // 2. If report doesn't exist (or forced refresh), auto-generate it
            if (!report) {
                console.log(`🔍 ${forceRefresh ? 'Forcing fresh generation' : 'Report not found'} for ${scheme} ${month}/${year}. Generating...`);
                let scraper = null;
                try {
                    if (scheme === 'nfsa') {
                        scraper = new SCMScraper();
                        
                        const scmUser = process.env.SCM_USERNAME;
                        const scmPass = process.env.SCM_PASSWORD;

                        if (!scmUser || !scmPass) {
                            throw new Error('SCM credentials not found in environment variables (SCM_USERNAME/SCM_PASSWORD).');
                        }
                        
                        await scraper.init(true);
                        // Reduce retries for background email generation to avoid hanging the API request
                        const loginSuccess = await scraper.login(scmUser, scmPass, 1);
                        if (!loginSuccess) {
                            throw new Error('Login to SCM Portal failed during background email generation.');
                        }

                        const roTypes = ['Regular', 'Portability', 'Extra'];
                        const aggregatedRawData = [];
                        let combinedVerificationTotals = {
                            alloted: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 },
                            dispatched: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 },
                            received: { wheat: 0, rice: 0, sugar: 0, salt: 0, fSalt: 0, maize: 0, fortifiedRice: 0 }
                        };
                        const processedCategories = [];

                        for (const roType of roTypes) {
                            try {
                                const result = await scraper.extractRoTypeData(month, year, roType);
                                if (result && result.status !== 'failed') {
                                    const { rawData, summaryTotals } = result;
                                    const recordCount = rawData ? rawData.length : 0;
                                    
                                    processedCategories.push(roType);
                                    
                                    if (recordCount > 0) {
                                        aggregatedRawData.push(...rawData.map(r => ({ ...r, roType })));
                                    }
                                    
                                    if (summaryTotals) {
                                        ['alloted', 'dispatched', 'received'].forEach(phase => {
                                            ['wheat', 'rice', 'sugar', 'salt', 'fSalt', 'maize', 'fortifiedRice'].forEach(comm => {
                                                combinedVerificationTotals[phase][comm] += (summaryTotals[phase]?.[comm] || 0);
                                            });
                                        });
                                    }
                                }
                            } catch (err) {
                                console.error(`[email-bundle] Error extracting ${roType}:`, err.message);
                                if (roType === 'Regular' || roType === 'Extra') {
                                    throw new Error(`CRITICAL: ${roType} RO extraction failed - ${err.message}`);
                                }
                            }
                        }

                        if (aggregatedRawData.length > 0) {
                            const processedResult = dataProcessor.processData(aggregatedRawData, combinedVerificationTotals, processedCategories, roTypes);
                            const excelFile = await excelGenerator.generateReport(processedResult, month, year);
                            const reportId = await db.saveReport({
                                month, year, filename: excelFile.filename, filepath: excelFile.filepath,
                                totalAllocation: processedResult.totals.totalAllocation,
                                totalDispatch: processedResult.totals.totalDispatch,
                                totalPOSReceipt: processedResult.totals.totalPOSReceipt,
                                dispatchPercentage: processedResult.totals.dispatchPercentage,
                                rawData: aggregatedRawData, scheme: 'nfsa'
                            });
                            report = await db.getReport(reportId);
                        } else {
                            throw new Error('No data found across all RO types during background refresh.');
                        }
                    } else if (scheme === 'mdm') {
                        scraper = new MDMScraper();
                        await scraper.init(true);
                        const result = await scraper.extractData(month, year);
                        if (result && result.status === 'success') {
                            const processedResult = mdmDataProcessor.processData(result.rawData);
                            const excelFile = await mdmExcelGenerator.generateReport(processedResult, month, year);
                            const reportId = await db.saveReport({
                                month, year, filename: excelFile.filename, filepath: excelFile.filepath,
                                totalAllocation: processedResult.totals.totalAllotted,
                                totalDispatch: processedResult.totals.totalDispatched,
                                totalPOSReceipt: processedResult.totals.totalReceived,
                                dispatchPercentage: processedResult.totals.totalDispatchPct,
                                rawData: result.rawData, scheme: 'mdm'
                            });
                            report = await db.getReport(reportId);
                        }
                    } else if (scheme === 'icds') {
                        scraper = new ICDSScraper();
                        await scraper.init(true);
                        const result = await scraper.extractData(month, year);
                        if (result && result.status === 'success') {
                            const processedResult = icdsDataProcessor.processData(result.rawData, result.summaryTotals);
                            const excelFile = await icdsExcelGenerator.generateReport(processedResult, month, year);
                            const reportId = await db.saveReport({
                                month, year, filename: excelFile.filename, filepath: excelFile.filepath,
                                totalAllocation: processedResult.totals.totalAllotted,
                                totalDispatch: processedResult.totals.totalDispatched,
                                totalPOSReceipt: processedResult.totals.totalReceived,
                                dispatchPercentage: processedResult.totals.totalDispatchPct,
                                rawData: result.rawData, scheme: 'icds'
                            });
                            report = await db.getReport(reportId);
                        }
                    } else if (scheme === 'welfare') {
                        scraper = new WelfareScraper();
                        await scraper.init(true);
                        const result = await scraper.extractData(month, year);
                        if (result && result.status === 'success') {
                            const processedResult = welfareDataProcessor.processData(result.rawData);
                            const excelFile = await welfareExcelGenerator.generateReport(processedResult, month, year);
                            const reportId = await db.saveReport({
                                month, year, filename: excelFile.filename, filepath: excelFile.filepath,
                                totalAllocation: processedResult.totals.totalAllotted,
                                totalDispatch: processedResult.totals.totalDispatched,
                                totalPOSReceipt: processedResult.totals.totalReceived,
                                dispatchPercentage: processedResult.totals.totalDispatchPct,
                                rawData: result.rawData, scheme: 'welfare'
                            });
                            report = await db.getReport(reportId);
                        }
                    }
                } catch (genErr) {
                    console.error(`❌ Auto-generation failed for ${scheme} ${month}/${year}:`, genErr.message);
                    generationErrors.push(`[${scheme.toUpperCase()} ${month}/${year}] ${genErr.message}`);
                    if (forceRefresh || !report) {
                        console.log(`⚠️ Scraping failed for ${scheme}, falling back to cached DB report...`);
                        try {
                            const cached = await db.all(`
                                SELECT * FROM reports 
                                WHERE scheme = ? AND month = ? AND year = ?
                                ORDER BY generated_at DESC LIMIT 1
                            `, [scheme, month, year]);
                            if (cached && cached.length > 0) {
                                report = cached[0];
                                console.log(`✅ Using cached report: ${report.filename}`);
                            }
                        } catch (dbErr) {
                            console.error(`❌ DB fallback also failed for ${scheme}:`, dbErr);
                        }
                    }
                } finally {
                    if (scraper && typeof scraper.close === 'function') {
                        await scraper.close().catch(() => {});
                    }
                }
            }

            if (!report) continue;

            reportsProcessed++;
            schemesFound.add(scheme.toUpperCase());
            monthsFound.add(month);
            yearsFound.add(year);

                // 3. Attach Excel
                if (format === 'excel' || format === 'both') {
                    if (fs.existsSync(report.filepath)) {
                        attachments.push({ filename: report.filename, path: report.filepath });
                    }
                }

                // 4. Attach PDF (Generate if missing or forced)
                if (format === 'pdf' || format === 'both') {
                    const pdfFilename = report.filename.replace('.xlsx', '.pdf');
                    let finalPdfPath = path.join(__dirname, 'reports', pdfFilename);
                    let finalPdfFilename = pdfFilename;

                    if (!fs.existsSync(finalPdfPath) || forceRefresh) {
                        try {
                            if (forceRefresh && fs.existsSync(finalPdfPath)) {
                                console.log(`🔄 Force-refreshing existing PDF: ${finalPdfFilename}`);
                            }
                            let rData = typeof report.raw_data === 'string' ? JSON.parse(report.raw_data) : report.raw_data;
                            let pdfResult = null;

                            // Determine which PDF generator to use based on scheme
                            // Note: For NFSA, the default PDFGenerator is used.
                            if (scheme === 'nfsa_daterange') {
                                const daterangeProcessor = new NFSADaterangeDataProcessor();
                                const actualRData = rData.rawData || rData;
                                const summaryTotals = rData.summaryTotals || null;
                                const allotmentMapping = rData.allotmentMapping || null;
                                const procData = daterangeProcessor.processData(actualRData, summaryTotals, allotmentMapping);
                                
                                const match = report.filename.match(/NFSA_(\d{2}-\d{2}-\d{4})_to_(\d{2}-\d{2}-\d{4})/);
                                let actualFromDate = "Start";
                                let actualToDate = "End";
                                if (match) {
                                    actualFromDate = match[1].replace(/-/g, '/');
                                    actualToDate = match[2].replace(/-/g, '/');
                                }
                                pdfResult = await new NFSADaterangePdfGenerator().generateReport(procData, actualFromDate, actualToDate, report.month, report.year);
                            } else if (scheme === 'mdm') {
                                const procData = mdmDataProcessor.processData(rData);
                                pdfResult = await new MDMPDFGenerator().generateReport(procData, report.month, report.year);
                            } else if (scheme === 'icds') {
                                const procData = icdsDataProcessor.processData(rData);
                                pdfResult = await new ICDSPDFGenerator().generateReport(procData, report.month, report.year);
                            } else if (scheme === 'welfare') {
                                const procData = welfareDataProcessor.processData(rData);
                                pdfResult = await new WelfarePDFGenerator().generateReport(procData, report.month, report.year);
                            } else { // Default to NFSA/general PDF generator
                                const procData = dataProcessor.processData(rData);
                                pdfResult = await new PDFGenerator().generateReport(procData, report.month, report.year, report.ro_type || 'All');
                            }
                            
                            if (pdfResult && pdfResult.filepath) {
                                finalPdfPath = pdfResult.filepath;
                                finalPdfFilename = pdfResult.filename;
                            }
                        } catch (pdfErr) {
                            console.error(`❌ PDF conversion failed for ${report.filename}:`, pdfErr);
                            generationErrors.push(`[${scheme.toUpperCase()} ${month}/${year}] PDF conversion failed: ${pdfErr.message}`);
                        }
                    }

                    if (fs.existsSync(finalPdfPath)) {
                        attachments.push({ filename: finalPdfFilename, path: finalPdfPath });
                    }
                }
            }

        if (attachments.length === 0) {
            let errorMsg = 'No reports could be found or generated for the selection.';
            if (generationErrors.length > 0) {
                errorMsg += '\nDetails: ' + generationErrors.join(' | ');
            }
            throw new ApiError(errorMsg, 404);
        }

        // Configure Nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_PORT == 465,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
        });

        // Dynamic Subject
        const schemeList = Array.from(schemesFound).join(', ');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthLabel = Array.from(monthsFound).sort((a,b)=>a-b).map(m => monthNames[m-1] || m).join('/');
        const yearLabel = Array.from(yearsFound).sort((a,b)=>a-b).join('/');
        const finalSubject = `PDS Reports Bundle: ${schemeList} ${monthLabel ? '('+monthLabel+')' : ''} ${yearLabel}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"PDS Report System" <no-reply@example.com>',
            to: emailTo,
            subject: finalSubject,
            attachments: attachments
        };
        const ccList = parseEmailList(cc);
        if (ccList) mailOptions.cc = ccList;

        try {
            const info = await transporter.sendMail(mailOptions);

            if (db && db.logEmail) {
                await db.logEmail(null, emailTo, finalSubject, 'success', null).catch(err => console.error('Error logging email bundle success:', err.message));
            }

            return { success: true, messageId: info.messageId, count: reportsProcessed };
        } catch (mailErr) {
            console.error('❌ Nodemailer error sending bundle:', mailErr);
            if (db && db.logEmail) {
                await db.logEmail(null, emailTo, finalSubject, 'failed', mailErr.message).catch(err => console.error('Error logging email bundle failure:', err.message));
            }
            throw new ApiError('Email delivery failed: ' + mailErr.message, 500);
        }
    }
}

/**
 * HTTP route wrapper around runEmailBundleJob() — used by the "Generate &
 * Send" button in the Global Email Modal.
 */
app.post('/api/email-bundle', async (req, res) => {
    req.setTimeout(300000); // 5-minute socket timeout for multi-RO fresh bundle scraping
    try {
        const result = await runEmailBundleJob(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error sending email bundle:', error);
        const status = error instanceof ApiError ? error.status : 500;
        res.status(status).json({ error: error.message || 'Bundle processing failed', details: error.message });
    }
});

/**
 * In-memory handle to the currently-active cron job, so it can be
 * stopped and re-created whenever the schedule is changed via
 * POST /api/email-schedule.
 */
let scheduledEmailTask = null;

/**
 * Reads AUTO_SCHEDULE_ENABLED / SCHEDULE_TIME / EMAIL_TO / EMAIL_CC from
 * process.env and (re)starts the daily cron job accordingly. Safe to call
 * repeatedly — it always tears down any previously running job first.
 */
function initEmailSchedule() {
    if (scheduledEmailTask) {
        scheduledEmailTask.stop();
        scheduledEmailTask = null;
    }

    const enabled = process.env.AUTO_SCHEDULE_ENABLED === 'true';
    if (!enabled) {
        console.log('⏰ Automated daily report email is disabled.');
        return;
    }

    const time = process.env.SCHEDULE_TIME || '09:00';
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) {
        console.error(`⏰ Invalid SCHEDULE_TIME "${time}" — automated email NOT scheduled.`);
        return;
    }
    const [, hh, mm] = match;
    const cronExpr = `${parseInt(mm, 10)} ${parseInt(hh, 10)} * * *`;

    if (!process.env.EMAIL_TO) {
        console.error('⏰ AUTO_SCHEDULE_ENABLED is true but EMAIL_TO is empty — automated email NOT scheduled.');
        return;
    }

    scheduledEmailTask = cron.schedule(cronExpr, async () => {
        console.log('⏰ Running automated daily PDS report email job...');
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const selectedSchemes = ['nfsa', 'mdm', 'icds', 'welfare'].map(scheme => ({ scheme, month, year }));

            const result = await runEmailBundleJob({
                selectedSchemes,
                emailTo: process.env.EMAIL_TO,
                cc: process.env.EMAIL_CC,
                format: 'pdf',
                forceRefresh: true
            });
            console.log(`✅ Automated email sent successfully (${result.count} report(s)).`);
        } catch (err) {
            console.error('❌ Automated email job failed:', err.message);
        }
    });

    console.log(`⏰ Automated daily report email scheduled for ${time} (server local time).`);
}

/**
 * Persists a set of key/value pairs into the .env file (updating existing
 * keys in place, appending any that don't yet exist) and mirrors the
 * change into process.env immediately so it takes effect without a
 * server restart.
 */
function updateEnvFile(kvPairs) {
    const envPath = path.join(__dirname, '.env');
    let lines = [];
    if (fs.existsSync(envPath)) {
        lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    }

    const remainingKeys = new Set(Object.keys(kvPairs));
    lines = lines.map(line => {
        const match = /^([A-Za-z0-9_]+)=/.exec(line);
        if (match && remainingKeys.has(match[1])) {
            remainingKeys.delete(match[1]);
            return `${match[1]}=${kvPairs[match[1]]}`;
        }
        return line;
    });
    remainingKeys.forEach(key => {
        lines.push(`${key}=${kvPairs[key]}`);
    });

    fs.writeFileSync(envPath, lines.join('\n'));
    Object.entries(kvPairs).forEach(([key, value]) => { process.env[key] = value; });
}

/**
 * GET current automated-scheduling preferences (used to prefill the
 * Global Email Modal's "Automated Daily Emails" panel).
 */
app.get('/api/email-schedule', (req, res) => {
    res.json({
        enabled: process.env.AUTO_SCHEDULE_ENABLED === 'true',
        time: process.env.SCHEDULE_TIME || '09:00',
        emailTo: process.env.EMAIL_TO || '',
        emailCc: process.env.EMAIL_CC || ''
    });
});

/**
 * Update automated-scheduling preferences and re-initialize the cron job.
 */
app.post('/api/email-schedule', (req, res) => {
    try {
        const { enabled, time, emailTo, emailCc } = req.body;

        if (enabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) {
            return res.status(400).json({ error: 'Invalid time format. Please use HH:MM (24-hour).' });
        }
        if (enabled && !emailTo) {
            return res.status(400).json({ error: 'A default recipient email is required to enable automated scheduling.' });
        }

        updateEnvFile({
            AUTO_SCHEDULE_ENABLED: enabled ? 'true' : 'false',
            SCHEDULE_TIME: time || '09:00',
            EMAIL_TO: emailTo || '',
            EMAIL_CC: emailCc || ''
        });

        initEmailSchedule();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating email schedule:', error);
        res.status(500).json({ error: 'Failed to update schedule', details: error.message });
    }
});

// ─────────────────────────────────────────────
// DIRECTORY API ENDPOINTS
// ─────────────────────────────────────────────

app.get('/api/directory/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const records = await db.getDirRecords(type);
        res.json(records);
    } catch (err) {
        console.error('Error fetching directory records:', err);
        res.status(500).json({ error: 'Failed to fetch directory records' });
    }
});

app.post('/api/directory/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const data = req.body;
        if (!data || !data.id) return res.status(400).json({ error: 'Missing record data or ID' });
        await db.saveDirRecord(data.id, type, data);
        res.json({ success: true, id: data.id });
    } catch (err) {
        console.error('Error saving directory record:', err);
        res.status(500).json({ error: 'Failed to save directory record' });
    }
});

app.put('/api/directory/:type/:id', async (req, res) => {
    try {
        const type = req.params.type;
        const id = req.params.id;
        const data = req.body;
        if (!data || !id) return res.status(400).json({ error: 'Missing record data or ID' });
        // Make sure data has id
        data.id = id;
        await db.saveDirRecord(id, type, data);
        res.json({ success: true, id });
    } catch (err) {
        console.error('Error updating directory record:', err);
        res.status(500).json({ error: 'Failed to update directory record' });
    }
});

app.delete('/api/directory/:type/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.deleteDirRecord(id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting directory record:', err);
        res.status(500).json({ error: 'Failed to delete directory record' });
    }
});

// Serve index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Restart Server Endpoint
app.post('/api/server/restart', (req, res) => {
    console.log('🔄 Quick close/restart triggered via API');
    res.json({ message: 'Server restarting...' });
    
    // Give response time to be sent before terminating
    setTimeout(() => {
        // Exit with 1 triggers most process managers (nodemon, pm2) to restart.
        // If run manually, this will just cleanly exit the application.
        process.exit(1);
    }, 500);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
(async () => {
    try {
        console.log('🏁 Initializing Database...');
        await db.init();
        
        if (process.env.ADMIN_BOOTSTRAP === 'true') {
            try {
                const adminUser = process.env.ADMIN_USER || 'dmbetul';
                const adminPass = process.env.ADMIN_PASSWORD;
                
                if (!adminPass) {
                    console.warn('⚠️ ADMIN_BOOTSTRAP is true but ADMIN_PASSWORD is not set. Skipping.');
                } else {
                    const existingUser = await db.getAppUser(adminUser);
                    if (!existingUser) {
                        console.log(`👤 Creating initial administrator: ${adminUser}`);
                        await db.createAppUser(adminUser, adminPass, 'admin');
                    }
                }
            } catch (err) {
                console.error('Error creating initial user:', err);
            }
        }

        console.log('🔍 Running Health Check...');
        const health = await db.checkHealth();
        if (!health.healthy) {
            console.error('⚠️ Database is in an unhealthy state (possibly locked). Attempting to proceed but expect failures.');
        } else {
            console.log('✅ System Health: GOOD');
        }

        app.listen(PORT, () => {
            console.log(`\n🚀 PDS Lifting Report Automation Server [V${SERVER_VERSION}]`);
            console.log(`📡 Server running on http://localhost:${PORT}`);
            console.log(`📊 Open your browser and navigate to the URL above\n`);
        });

        console.log('⏰ Initializing automated email schedule...');
        initEmailSchedule();

        try {
            require('./scripts/autoCloudSync').init();
        } catch (syncErr) {
            // Silently ignore if not available
        }
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
})();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    if (scheduledEmailTask) scheduledEmailTask.stop();
    db.close();
    process.exit(0);
});
