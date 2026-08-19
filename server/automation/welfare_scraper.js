const path = require('path');
const fs = require('fs');

let _puppeteer = null;
function getPuppeteer() {
    if (!_puppeteer) {
        _puppeteer = require('puppeteer');
    }
    return _puppeteer;
}

/**
 * Welfare Scheme Scraper
 * Scrapes Welfare Institute commodity lifting data from public portal.
 * URL: https://scm.mp.gov.in/welfareInstituteroanddispatchnew.jsp
 * No login required. Scheme=ALL (value "00"). 
 * AJAX endpoint: welfareInstituteroanddispatchdistnew.jsp (POST month/year/scheme)
 * Navigation: Month/Year/Scheme → Get Report → #distreport District → #depotreport Depot → #fpsreport shops
 * 2 commodities: Wheat (गेहूँ) + Fortified Rice (फोर्टिफाइड चावल)
 */
class WelfareScraper {
    constructor() {
        this.VERSION = '1.0.0';
        this.browser = null;
        this.page = null;
        this.WELFARE_URL = 'https://scm.mp.gov.in/welfareInstituteroanddispatchnew.jsp';
        this.DISTRICT_NAME = 'Betul';
        this.SCHEME_VALUE = '00'; // ALL
        this.SKIP_DEPOT_SL = [];

        this.logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    async init(headless = true) {
        console.log(`🚀 [Welfare] Initializing browser (headless: ${headless})...`);
        const puppeteer = getPuppeteer();
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--hide-scrollbars', 
                '--mute-audio',
                '--disable-blink-features=AutomationControlled',
                '--ignore-certificate-errors'
            ],
            defaultViewport: { width: 1280, height: 900 }
        });
        this.page = await this.browser.newPage();
    
    // Auto-dismiss any javascript alerts to prevent Puppeteer from hanging
    this.page.on('dialog', async dialog => {
      console.log('⚠️ Handled alert dialog:', dialog.message());
      await dialog.accept().catch(() => {});
    });
        this.page.setDefaultTimeout(30000);

        // Intercept and abort unnecessary requests to speed up load
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        this.page.on('response', async response => {
            const url = response.url();
            if (url.includes('.jsp') && response.request().resourceType() === 'xhr') {
                console.log(`[Network] XHR Response: ${url} - Status: ${response.status()}`);
                if (url.includes('depotnew.jsp')) {
                    try {
                        const text = await response.text();
                        console.log(`[Network] XHR Body Length: ${text.length}`);
                        console.log(`[Network] XHR Body Preview: ${text.substring(0, 300)}`);
                    } catch (e) {
                        console.log(`[Network] Error reading XHR body:`, e.message);
                    }
                }
            }
        });
        
        // Set identity and headers
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        });

        console.log('✅ [Welfare] Browser initialized with stealth identity.');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('🛑 [Welfare] Browser closed.');
        }
    }

    async _waitForLoading() {
        try {
            await this.page.waitForSelector('#loading', { visible: true, timeout: 2000 });
            await this.page.waitForSelector('#loading', { hidden: true, timeout: 30000 });
        } catch (e) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async waitForTableContent(timeout = 10000) {
        try {
            await this.page.waitForFunction(
                () => {
                    const tables = document.querySelectorAll('table');
                    for (const t of tables) {
                        if (t.querySelectorAll('tr').length > 2) return true;
                    }
                    return false;
                },
                { timeout }
            );
        } catch (e) { /* continue */ }
        await new Promise(r => setTimeout(r, 1000));
    }

    /**
     * Main extraction entry point.
     */
    async extractData(month, year, onProgress = null) {
        console.log(`\n📊 [Welfare] Starting extraction for ${month}/${year}, Scheme=ALL...\n`);

        try {
            // 1. Navigate to Welfare page
            if (onProgress) onProgress(0, 100, 'Navigating to Welfare portal...');
            try {
                await this.page.goto(this.WELFARE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
            } catch (err) {
                console.warn(`⚠️ Navigation warning (domcontentloaded): ${err.message}. Retrying with 'load'...`);
                await this.page.goto(this.WELFARE_URL, { waitUntil: 'load', timeout: 60000 });
            }
            console.log('✅ [Welfare] Navigated to Welfare allotment page.');

            // Save debug HTML
            const html = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'welfare_page_debug.html'), html);

            // Wait for initial auto-loaded report to finish loading
            await this._waitForLoading();

            // Clear stale results and remove auto-AJAX trigger on dropdown change to prevent race conditions
            await this.page.evaluate(() => {
                const ed = document.getElementById('detailsED');
                if (ed) ed.innerHTML = '';
                const m = document.getElementById('month');
                if (m) m.removeAttribute('onchange');
                const y = document.getElementById('year');
                if (y) y.removeAttribute('onchange');
                const s = document.getElementById('scheme');
                if (s) s.removeAttribute('onchange');
            });

            // 2. Select Month, Year, Scheme
            if (onProgress) onProgress(2, 100, 'Applying filters (Month/Year/Scheme)...');
            await this._selectFilters(month, year);

            // 3. Click "Get Report"
            if (onProgress) onProgress(5, 100, 'Requesting report from portal...');
            await this._clickGetReport();

            // 4. Find and click Betul district
            if (onProgress) onProgress(8, 100, 'Navigating to District data (Betul)...');
            await this._clickDistrict();

            // 5. Save debug after district click
            const districtHtml = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'welfare_district_debug.html'), districtHtml);

            // 6. Get list of depots
            const depots = await this._getDepotList();
            console.log(`📍 [Welfare] Found ${depots.length} depots.`);

            if (depots.length === 0) {
                throw new Error('No depots found after clicking district. Check welfare_district_debug.html');
            }

            const validDepots = depots.filter(d => !this.SKIP_DEPOT_SL.includes(d.slNo));
            console.log(`   Processing ${validDepots.length} depots.`);

            const rawData = [];
            const summaryTotals = {
                wheat: { allotted: 0, dispatched: 0, received: 0 },
                rice: { allotted: 0, dispatched: 0, received: 0 }
            };

            for (let i = 0; i < validDepots.length; i++) {
                const depot = validDepots[i];
                if (onProgress) onProgress(i + 1, validDepots.length, `Processing depot: ${depot.name}...`);
                console.log(`\n📦 [Welfare] Processing depot ${i + 1}/${validDepots.length}: ${depot.name} (SL ${depot.slNo})`);

                const shops = await this._extractDepotShops(depot, i);

                shops.forEach(shop => {
                    rawData.push(shop);
                    summaryTotals.wheat.allotted += shop.wheatAllotted;
                    summaryTotals.wheat.dispatched += shop.wheatDispatched;
                    summaryTotals.wheat.received += shop.wheatReceived;
                    summaryTotals.rice.allotted += shop.riceAllotted;
                    summaryTotals.rice.dispatched += shop.riceDispatched;
                    summaryTotals.rice.received += shop.riceReceived;
                });

                console.log(`   ✅ Extracted ${shops.length} welfare institutes from ${depot.name}`);

                if (i < validDepots.length - 1) {
                    await this._goBackToDepotList();
                }
            }

            console.log(`\n✅ [Welfare] Extraction complete. Total institutes: ${rawData.length}`);
            console.log(`   Wheat Allotted:     ${summaryTotals.wheat.allotted.toFixed(2)} Qt`);
            console.log(`   Fort.Rice Allotted: ${summaryTotals.rice.allotted.toFixed(2)} Qt`);

            return { rawData, summaryTotals, status: 'success' };

        } catch (err) {
            console.error('❌ [Welfare] Extraction failed:', err.message);
            try {
                const errHtml = await this.page.content();
                fs.writeFileSync(path.join(this.logsDir, 'welfare_error_state.html'), errHtml);
            } catch (_) { }
            return { rawData: [], summaryTotals: null, status: 'failed', error: err.message };
        }
    }

    async _selectFilters(month, year) {
        try {
            console.log(`   Setting filters: Month=${month}, Year=${year}, Scheme=ALL(${this.SCHEME_VALUE})`);

            const monthSel = await this.page.$('#month');
            if (monthSel) {
                await this.page.select('#month', String(month));
                console.log(`   ✅ Selected month: ${month}`);
            } else {
                console.warn('⚠️ Could not find #month dropdown');
            }

            const yearSel = await this.page.$('#year');
            if (yearSel) {
                await this.page.select('#year', String(year));
                console.log(`   ✅ Selected year: ${year}`);
            } else {
                console.warn('⚠️ Could not find #year dropdown');
            }

            const schemeSel = await this.page.$('#scheme');
            if (schemeSel) {
                await this.page.select('#scheme', this.SCHEME_VALUE);
                console.log(`   ✅ Selected scheme: ALL (${this.SCHEME_VALUE})`);
            } else {
                // scheme might not have fired AJAX yet — try value "0" fallback
                console.warn('⚠️ Could not find #scheme dropdown — will proceed without it');
            }

        } catch (error) {
            console.error('Error setting filters:', error);
        }
    }

    async _clickGetReport() {
        console.log('   Clicking "Get Report"...');

        const clicked = await this.page.evaluate(() => {
            const btn = document.querySelector('input[value="Get Report"]');
            if (btn) { btn.click(); return true; }
            return false;
        });

        if (!clicked) {
            await this.page.click('input[type="button"][value="Get Report"]');
        }

        await this._waitForLoading();
        
        // Wait for #distreport or #detailsED or "No data found"
        await this.page.waitForFunction(() => {
            const dr = document.getElementById('distreport');
            const ed = document.getElementById('detailsED');
            if (dr && (dr.innerText.includes('Betul') || dr.innerText.includes('No data found'))) return true;
            if (ed && (ed.innerText.includes('Betul') || ed.innerText.includes('No data found'))) return true;
            return false;
        }, { timeout: 30000 }).catch(() => console.log('⚠️ Timed out waiting for Results table'));

        let noData = await this.page.evaluate(() => {
            const txt = document.body.innerText;
            return txt.includes('No data found');
        });

        // INTERMITTENT FIX: If portal says No data found, retry once
        if (noData) {
            console.log(`   ⚠️ Portal reported No Data for ${this.currentMonth}. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            await this.page.evaluate(() => {
                const btn = document.querySelector('input[value="Get Report"]');
                if (btn) btn.click();
            });
            await this._waitForLoading();
            await new Promise(r => setTimeout(r, 1000));
            
            noData = await this.page.evaluate(() => {
                const txt = document.body.innerText;
                return txt.includes('No data found');
            });
        }

        if (noData) {
            throw new Error('NO_DATA: The portal currently shows "No data found" for this month/year. Please try again after some time or check the portal manually.');
        }

        console.log('✅ [Welfare] "Get Report" clicked & processed.');
    }

    async _clickDistrict() {
        console.log(`   Clicking District: ${this.DISTRICT_NAME}...`);

        // Find district code and manually trigger AJAX
        const districtAction = await this.page.evaluate((districtName) => {
            const clean = t => t ? t.trim().toLowerCase() : '';
            const target = clean(districtName);

            let distCode = null;
            let clicked = false;
            let debugLog = [];

            // Ensure container exists for the native AJAX to populate into
            let container = document.getElementById('detailsEDdepot');
            if (!container) {
                container = document.createElement('div');
                container.id = 'detailsEDdepot';
                document.body.appendChild(container);
            }

            const links = document.querySelectorAll('#distreport a, #detailsED a');
            for (const link of links) {
                const text = clean(link.innerText);
                debugLog.push(`Text: ${text}`);
                if (text.includes(target)) {
                    const onclick = link.getAttribute('onclick');
                    debugLog.push(`Found target. onclick: ${onclick}`);
                    const match = onclick ? onclick.match(/getreportdepot\(['"]?(\d+)['"]?\)/) : null;
                    debugLog.push(`Match: ${match}`);
                    if (match) {
                        distCode = match[1];
                        link.click();
                        clicked = true;
                        debugLog.push('Clicked');
                        break;
                    }
                }
            }

            if (!clicked) return { success: false, msg: 'District link not found or could not be clicked', debug: debugLog };
            return { success: true, distCode, debug: debugLog };

        }, this.DISTRICT_NAME);

        console.log(`   Evaluate Debug:`, districtAction.debug);
        if (!districtAction.success) {
            throw new Error(`Failed to initiate district load for "${this.DISTRICT_NAME}": ${districtAction.msg}`);
        }

        console.log(`   Initiated manual AJAX for district code: ${districtAction.distCode}`);

        await this._waitForLoading();

        // Wait for #depotreport (likely inside #detailsEDdepot)
        try {
            await this.page.waitForFunction(() => {
                const depot = document.getElementById('depotreport');
                const container = document.getElementById('detailsEDdepot');
                // Check if table exists anywhere OR if container has substantial content
                return (depot && depot.querySelectorAll('tr').length > 1) ||
                    (container && container.innerText.includes('Depot'));
            }, { timeout: 90000 });
            console.log(`✅ [Welfare] #depotreport loaded with Betul's data`);
        } catch (e) {
            console.error('❌ Timed out waiting for #depotreport. Dumping content...');
            const html = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'welfare_click_fail_debug.html'), html);
            throw new Error('Timeout waiting for #depotreport after manual AJAX');
        }
    }

    async _getDepotList() {
        console.log('   Using hardcoded Welfare ISSUE_POINTS to avoid government portal depot list corruption...');
        const ISSUE_POINTS = [
            { id: '2331001',   name: 'Betul' },
            { id: '2331002',   name: 'Bhainsdehi' },
            { id: '2331003',   name: 'Athner' },
            { id: '2331004',   name: 'Multai' },
            { id: '233100401', name: 'Shahpur' },
            { id: '233100406', name: 'Ghoradongri' },
            { id: '2331005',   name: 'BHIMPUR' },
            { id: '2331006',   name: 'PATTAN' },
            { id: '2331007',   name: 'AMLA' }
        ];

        return ISSUE_POINTS.map((d, index) => ({
            slNo: index + 1,
            name: d.name,
            depotName: d.name,
            depotId: d.id,
            onclick: `getreportInst('${d.id}','${d.name}')`
        }));
    }

    async _extractDepotShops(depot, depotIndex) {
        console.log(`   Extracting institutes for depot: ${depot.depotName || depot.name} (SL ${depot.slNo})...`);

        // Clear any existing instreport to prevent extracting stale data
        let extractedShops = [];
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.page.evaluate(() => {
                const c1 = document.getElementById('detailsWelInst');
                if (c1) c1.innerHTML = '';
                const c2 = document.getElementById('detailsWelInstFPS');
                if (c2) c2.innerHTML = '';
            });

            await this.page.evaluate((onclickStr) => {
                if (!document.getElementById('detailsWelInst')) {
                    const c1 = document.createElement('div'); c1.id = 'detailsWelInst'; document.body.appendChild(c1);
                }
                if (!document.getElementById('detailsWelInstFPS')) {
                    const c2 = document.createElement('div'); c2.id = 'detailsWelInstFPS'; document.body.appendChild(c2);
                }
                try { eval(onclickStr); return true; } catch (e) { return false; }
            }, depot.onclick);

            await this._waitForLoading();

            await this.page.waitForFunction(() => {
                const t = document.getElementById('instreportdd');
                return t && t.querySelectorAll('tr').length > 1;
            }, { timeout: 35000 }).catch(() => {});

            const shopsResult = await this.page.evaluate((depotNameStr) => {
                const table = document.getElementById('instreportdd');
                if (!table) return { shops: [], tableFound: false };

                const rows = table.querySelectorAll('tr');
                const result = [];
                let firstDataCols = 0;
                let sampleRow = null;

                for (let i = 0; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td');
                    if (firstDataCols === 0 && cells.length > 5) firstDataCols = cells.length;
                    if (cells.length < 5) continue;

                    const shopCode = (cells[1] ? cells[1].innerText : '').trim();
                    if (!/^\d{4,}$/.test(shopCode)) continue;

                    const parseKg = (td) => {
                        if (!td) return 0;
                        const v = parseFloat((td.innerText || '0').replace(/,/g, '').trim());
                        return isNaN(v) ? 0 : v / 100;
                    };

                    if (result.length === 0) {
                        sampleRow = Array.from(cells).map((c, idx) => `[${idx}]=${c.innerText.trim().substring(0, 20)}`);
                    }

                    const colCount = cells.length;
                    let wA, wDi, wRe, rA, rDi, rRe;

                    if (colCount >= 23) {
                        // Rice First
                        rA = 9; rDi = 11; rRe = 12; // Receive (FPS) Qty
                        // Wheat Second
                        wA = 18; wDi = 20; wRe = 21; // Receive (FPS) Qty
                    } else if (colCount >= 18) {
                        wA = 6; wDi = 8; wRe = 9;
                        rA = 13; rDi = 15; rRe = 16;
                    } else {
                        continue;
                    }

                    result.push({
                        shopCode,
                        shopName: `Welfare Inst ${shopCode}`,
                        issuePoint: depotNameStr,
                        columnCount: colCount,
                        wheatAllotted: parseKg(cells[wA]),
                        wheatDispatched: parseKg(cells[wDi]),
                        wheatReceived: parseKg(cells[wRe]),
                        riceAllotted: parseKg(cells[rA]),
                        riceDispatched: parseKg(cells[rDi]),
                        riceReceived: parseKg(cells[rRe])
                    });
                }
                return { shops: result, tableFound: true, totalRows: rows.length, firstDataCols, sampleRow };
            }, depot.depotName || depot.name);

            extractedShops = Array.isArray(shopsResult) ? shopsResult : (shopsResult.shops || []);
            if (extractedShops.length > 0) break;

            console.warn(`   ⚠️ Attempt ${attempt}/3 for depot ${depot.name} returned 0 institutes. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }

        // Save debug HTML for first 2 depots
        if (depotIndex < 2) {
            try {
                const html = await this.page.content();
                fs.writeFileSync(path.join(this.logsDir, `welfare_fps_depot${depot.slNo}_debug.html`), html);
                console.log(`   Saved debug HTML: welfare_fps_depot${depot.slNo}_debug.html`);
            } catch (_) {}
        }

        console.log(`   Extracted ${extractedShops.length} institutes for ${depot.depotName || depot.name}`);
        return extractedShops;
    }

    async _goBackToDepotList() {
        const depotTableStillPresent = await this.page.evaluate(() => {
            const t = document.getElementById('depotreport');
            return t && t.querySelectorAll('tr').length > 3;
        });
        if (!depotTableStillPresent) {
            console.log('   #depotreport gone — re-clicking district...');
            await this._clickDistrict();
        }
        await new Promise(r => setTimeout(r, 500));
    }
}

module.exports = WelfareScraper;
