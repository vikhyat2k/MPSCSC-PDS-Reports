const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * ICDS Scraper
 * Scrapes Integrated Child Development Scheme (ICDS) lifting data from public portal.
 * URL: https://scm.mp.gov.in/ICDS_allotment.jsp
 * No login required. Navigation: Month/Year filters → Get Report → District → Depot → FPS shops
 * 3 commodities: Wheat, Rice, Fortified Salt (FSalt)
 */
class ICDSScraper {
    constructor() {
        this.VERSION = '1.0.0';
        this.browser = null;
        this.page = null;
        this.ICDS_URL = 'https://scm.mp.gov.in/ICDS_allotment.jsp';
        this.DISTRICT_NAME = 'Betul';
        this.SKIP_DEPOT_SL = []; // No depots to skip by default

        this.logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    async init(headless = true) {
        console.log(`🚀 [ICDS] Initializing browser (headless: ${headless})...`);
        this.browser = await puppeteer.launch({
            headless: headless ? 'new' : false,
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

        // Block unnecessary resources to speed up scraping
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
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

        console.log('✅ [ICDS] Browser initialized with stealth identity.');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('🛑 [ICDS] Browser closed.');
        }
    }

    /**
     * Wait for table content to appear/change after a click
     */
    async waitForTableContent(timeout = 10000) {
        try {
            await this.page.waitForFunction(
                () => {
                    const tables = document.querySelectorAll('table');
                    for (const t of tables) {
                        const rows = t.querySelectorAll('tr');
                        if (rows.length > 2) return true;
                    }
                    return false;
                },
                { timeout }
            );
        } catch (e) {
            // Timeout — continue anyway
        }
        await new Promise(r => setTimeout(r, ));
    }

    /**
     * Main extraction entry point.
     */
    async extractData(month, year, onProgress = null) {
        console.log(`\n📊 [ICDS] Starting extraction for ${month}/${year}...\n`);

        try {
            // 1. Navigate to ICDS page
            try {
                await this.page.goto(this.ICDS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
            } catch (err) {
                console.warn(`⚠️ Navigation warning (domcontentloaded): ${err.message}. Retrying with 'load'...`);
                await this.page.goto(this.ICDS_URL, { waitUntil: 'load', timeout: 60000 });
            }
            console.log('✅ [ICDS] Navigated to ICDS allotment page.');

            // Save debug HTML
            const html = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'icds_page_debug.html'), html);

            // 6. Get list of depots
            const depots = await this._getDepotList();
            console.log(`📍 [ICDS] Found ${depots.length} depots.`);

            if (depots.length === 0) {
                throw new Error('No depots found after clicking district. Check icds_district_debug.html for table structure.');
            }

            const validDepots = depots.filter(d => !this.SKIP_DEPOT_SL.includes(d.slNo));
            console.log(`   Processing ${validDepots.length} depots.`);

            const rawData = [];
            const summaryTotals = {
                wheat: { allotted: 0, dispatched: 0, received: 0 },
                rice: { allotted: 0, dispatched: 0, received: 0 },
                fsalt: { allotted: 0, dispatched: 0, received: 0 }
            };

            for (let i = 0; i < validDepots.length; i++) {
                const depot = validDepots[i];
                if (onProgress) onProgress(i + 1, validDepots.length, `Processing depot: ${depot.name}...`);
                console.log(`\n📦 [ICDS] Processing depot ${i + 1}/${validDepots.length}: ${depot.name} (SL ${depot.slNo})`);

                const shops = await this._extractDepotShops(depot, i);

                shops.forEach(shop => {
                    rawData.push(shop);
                    summaryTotals.wheat.allotted += shop.wheatAllotted;
                    summaryTotals.wheat.dispatched += shop.wheatDispatched;
                    summaryTotals.wheat.received += shop.wheatReceived;
                    summaryTotals.rice.allotted += shop.riceAllotted;
                    summaryTotals.rice.dispatched += shop.riceDispatched;
                    summaryTotals.rice.received += shop.riceReceived;
                    summaryTotals.fsalt.allotted += shop.fsaltAllotted;
                    summaryTotals.fsalt.dispatched += shop.fsaltDispatched;
                    summaryTotals.fsalt.received += shop.fsaltReceived;
                });

                console.log(`   ✅ Extracted ${shops.length} shops from ${depot.name}`);

                if (i < validDepots.length - 1) {
                    await this._goBackToDepotList();
                }
            }

            console.log(`\n✅ [ICDS] Extraction complete. Total shops: ${rawData.length}`);
            console.log(`   Wheat Allotted:  ${summaryTotals.wheat.allotted.toFixed(2)} Qt`);
            console.log(`   Rice Allotted:   ${summaryTotals.rice.allotted.toFixed(2)} Qt`);
            console.log(`   FSalt Allotted:  ${summaryTotals.fsalt.allotted.toFixed(2)} Qt`);

            return { rawData, summaryTotals, status: 'success' };

        } catch (err) {
            console.error('❌ [ICDS] Extraction failed:', err.message);
            try {
                const errHtml = await this.page.content();
                fs.writeFileSync(path.join(this.logsDir, 'icds_error_state.html'), errHtml);
            } catch (_) { }
            return { rawData: [], summaryTotals: null, status: 'failed', error: err.message };
        }
    }

    async _selectFilters(month, year) {
        try {
            console.log(`   Setting filters to Month: ${month}, Year: ${year}`);

            // Select Month
            const monthSelect = await this.page.$('#month');
            if (monthSelect) {
                await this.page.select('#month', String(month));
                console.log(`   ✅ Selected month: ${month}`);
                await this._waitForLoading();
            } else {
                console.warn('⚠️ Could not find #month dropdown');
            }

            // Select Year
            const yearSelect = await this.page.$('#year');
            if (yearSelect) {
                await this.page.select('#year', String(year));
                console.log(`   ✅ Selected year: ${year}`);
                await this._waitForLoading();
            } else {
                console.warn('⚠️ Could not find #year dropdown');
            }

        } catch (error) {
            console.error('Error setting filters:', error);
        }
    }

    async _waitForLoading() {
        try {
            await this.page.waitForSelector('#loading', { visible: true, timeout: 2000 });
            await this.page.waitForSelector('#loading', { hidden: true, timeout: 30000 });
        } catch (e) {
            await new Promise(r => setTimeout(r, ));
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

        // Wait up to 60s for district table or "No data found"
        await this.page.waitForFunction(() => {
            const dr = document.getElementById('distreport') || document.querySelector('#detailsED table');
            if (dr && (dr.innerText.includes('Betul') || dr.innerText.includes('No data found'))) return true;
            return false;
        }, { timeout: 60000 }).catch(() => console.log('⚠️ Timed out waiting for #distreport'));

        let noData = await this.page.evaluate(() => {
            const txt = document.body.innerText;
            return txt.includes('No data found');
        });

        // INTERMITTENT FIX: If portal says No data found, retry once
        if (noData) {
            console.log(`   ⚠️ Portal reported No Data for ${this.currentMonth}. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, ));
            await this.page.evaluate(() => {
                const btn = document.querySelector('input[value="Get Report"]');
                if (btn) btn.click();
            });
            await this._waitForLoading();
            await new Promise(r => setTimeout(r, ));
            
            noData = await this.page.evaluate(() => {
                const txt = document.body.innerText;
                return txt.includes('No data found');
            });
        }

        if (noData) {
            throw new Error('NO_DATA: The portal currently shows "No data found" for this month/year. Please try again after some time or check the portal manually.');
        }

        console.log('✅ [ICDS] "Get Report" clicked & processed.');
    }

    async _clickDistrict() {
        console.log(`   Clicking District: ${this.DISTRICT_NAME}...`);

        // Use partial, case-insensitive match so slight variations in spacing/case don't fail
        const clicked = await this.page.evaluate((districtName) => {
            const target = districtName.trim().toLowerCase();
            // Try #distreport first, then broader search for any district links
            const selectors = ['#distreport a', '#detailsED a', 'a'];
            for (const sel of selectors) {
                const links = document.querySelectorAll(sel);
                for (const link of links) {
                    const text = link.innerText.trim().toLowerCase();
                    if (text === target || text.includes(target)) {
                        const onclick = link.getAttribute('onclick') || '';
                        // Only click real district links (with onclick or href)
                        if (onclick || link.href !== 'javascript:void(0)') {
                            link.click();
                            return `clicked: ${link.innerText.trim()}`;
                        }
                    }
                }
            }
            // Last resort: list all links in distreport for debugging
            const allLinks = Array.from(document.querySelectorAll('#distreport a, #detailsED a')).map(a => a.innerText.trim());
            return { failed: true, available: allLinks.slice(0, 20) };
        }, this.DISTRICT_NAME);

        if (!clicked || (typeof clicked === 'object' && clicked.failed)) {
            const available = (typeof clicked === 'object' && clicked.available) ? clicked.available.join(', ') : 'none';
            throw new Error(`Could not find district "${this.DISTRICT_NAME}" in #distreport. Available: [${available}]`);
        }
        console.log(`   District click result: ${clicked}`);
        await this._waitForLoading();

        // Wait up to 60s for depot table (slow portal)
        await this.page.waitForFunction(() => {
            const depot = document.getElementById('depotreport');
            return depot && depot.querySelectorAll('tr').length > 3;
        }, { timeout: 60000 }).catch(() =>
            console.warn('⚠️ Timed out waiting for #depotreport. Will try anyway.')
        );

        console.log(`✅ [ICDS] #depotreport loaded with district data`);
    }

    async _getDepotList() {
        console.log('   Using hardcoded ICDS ISSUE_POINTS to avoid government portal depot list corruption...');
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
            onclick: `getreportfps('${d.id}','${d.name}')`
        }));
    }

    async _extractDepotShops(depot, depotIndex) {
        console.log(`   Extracting shops for depot: ${depot.depotName || depot.name} (SL ${depot.slNo})...`);
        let extractedShops = [];
        for (let attempt = 1; attempt <= 3; attempt++) {
            // Clear any existing fpsreport to prevent extracting stale data
            await this.page.evaluate(() => {
                const container = document.getElementById('detailsEDfps');
                if (container) container.innerHTML = '';
            });

            await this.page.evaluate((onclickStr) => {
                try { eval(onclickStr); return true; } catch (e) { return false; }
            }, depot.onclick);

            await this._waitForLoading();

            await this.page.waitForFunction(() => {
                const t = document.getElementById('fpsreport');
                return t && t.querySelectorAll('tr').length > 5;
            }, { timeout: 35000 }).catch(() => {});

            const shopsResult = await this.page.evaluate((depotNameStr) => {
                const table = document.getElementById('fpsreport');
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
                    if (!/^\d{5,}$/.test(shopCode)) continue;

                    const parseKg = (td) => {
                        if (!td) return 0;
                        const v = parseFloat((td.innerText || '0').replace(/,/g, '').trim());
                        return isNaN(v) ? 0 : v / 100; // Kg → Quintal
                    };

                    const parseNum = (td) => {
                        if (!td) return 0;
                        const v = parseInt((td.innerText || '0').replace(/,/g, '').trim(), 10);
                        return isNaN(v) ? 0 : v;
                    };

                    if (result.length === 0) {
                        sampleRow = Array.from(cells).map((c, idx) => `[${idx}]=${c.innerText.trim().substring(0, 20)}`);
                    }

                    // Column mapping for ICDS #fpsreport:
                    // [0]=SL, [1]=FPS/AWC, [2]=Centres, [3]=Beneficiaries
                    // Wheat:  [4]=Required, [5]=CB, [6]=Allotted, [7]=RO, [8]=Dispatch, [9]=ReceivedFPS, [10]=Issued
                    // FSalt:  [11]=Required, [12]=CB, [13]=Allotted, [14]=RO, [15]=Dispatch, [16]=ReceivedFPS, [17]=Issued
                    // Rice:   [18]=Required, [19]=CB, [20]=Allotted, [21]=RO, [22]=Dispatch, [23]=ReceivedFPS, [24]=Issued
                    const colCount = cells.length;
                    const hasRiceBlock = colCount >= 24;

                    result.push({
                        shopCode,
                        shopName: `ICDS AWC ${shopCode}`,
                        issuePoint: depotNameStr,
                        columnCount: colCount,
                        awcCount: parseNum(cells[2]),
                        inmatesCount: parseNum(cells[3]),
                        wheatAllotted: parseKg(cells[6]),
                        wheatDispatched: parseKg(cells[8]),
                        wheatReceived: parseKg(cells[9]),
                        fsaltAllotted: parseKg(cells[13]),
                        fsaltDispatched: parseKg(cells[15]),
                        fsaltReceived: parseKg(cells[16]),
                        riceAllotted: hasRiceBlock ? parseKg(cells[20]) : 0,
                        riceDispatched: hasRiceBlock ? parseKg(cells[22]) : 0,
                        riceReceived: hasRiceBlock ? parseKg(cells[23]) : 0
                    });
                }
                return { shops: result, tableFound: true, totalRows: rows.length, firstDataCols, sampleRow };
            }, depot.depotName || depot.name);

            extractedShops = Array.isArray(shopsResult) ? shopsResult : (shopsResult.shops || []);
            if (extractedShops.length > 0) break;

            console.warn(`   ⚠️ Attempt ${attempt}/3 for depot ${depot.name} returned 0 shops. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }

        // Save debug HTML for first 2 depots
        if (depotIndex < 2) {
            try {
                const html = await this.page.content();
                fs.writeFileSync(path.join(this.logsDir, `icds_fps_depot${depot.slNo}_debug.html`), html);
                console.log(`   Saved debug HTML: icds_fps_depot${depot.slNo}_debug.html`);
            } catch (_) {}
        }

        console.log(`   Extracted ${extractedShops.length} shops for ${depot.depotName || depot.name}`);
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
        await new Promise(r => setTimeout(r, ));
    }
}

module.exports = ICDSScraper;
