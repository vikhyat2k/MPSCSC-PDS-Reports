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

        console.log('✅ [MDM] Browser initialized with stealth identity.');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('🛑 [MDM] Browser closed.');
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
        await new Promise(r => setTimeout(r, 1000));
    }

    /**
     * Main extraction entry point.
     */
    async extractData(month, year, onProgress = null) {
        this.currentMonth = month;
        console.log(`\n📊 [MDM] Starting extraction for ${month}/${year}...\n`);

        try {
            // 1. Navigate to MDM page
            try {
                await this.page.goto(this.MDM_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
            } catch (err) {
                console.warn(`⚠️ Navigation warning (domcontentloaded): ${err.message}. Retrying with 'load'...`);
                await this.page.goto(this.MDM_URL, { waitUntil: 'load', timeout: 60000 });
            }
            console.log('✅ [MDM] Navigated to MDM allotment page.');

            // Save debug HTML
            const html = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'mdm_page_debug.html'), html);

            // 2. Select Month and Year
            await this._selectFilters(month, year);

            // 3. Click "Get Report"
            await this._clickGetReport();

            // 4. Find and click Betul district (page content changes in-place, no navigation)
            await this._clickDistrict();

            // 5. Save state after clicking district
            const districtHtml = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'mdm_district_debug.html'), districtHtml);

            // 6. Get list of depots
            const depots = await this._getDepotList();
            console.log(`📍 [MDM] Found ${depots.length} depots.`);

            if (depots.length === 0) {
                throw new Error('No depots found after clicking district. Check mdm_district_debug.html for table structure.');
            }

            const validDepots = depots.filter(d => !this.SKIP_DEPOT_SL.includes(d.slNo));
            console.log(`   Processing ${validDepots.length} depots (skipping SL ${this.SKIP_DEPOT_SL.join(',')}).`);

            const rawData = [];
            const summaryTotals = {
                wheat: { allotted: 0, dispatched: 0, received: 0 },
                fortifiedRice: { allotted: 0, dispatched: 0, received: 0 }
            };

            for (let i = 0; i < validDepots.length; i++) {
                const depot = validDepots[i];
                if (onProgress) onProgress(i + 1, validDepots.length, `Processing depot: ${depot.name}...`);
                console.log(`\n📦 [MDM] Processing depot ${i + 1}/${validDepots.length}: ${depot.name} (SL ${depot.slNo})`);

                // Click depot link — content changes in-place
                const shops = await this._extractDepotShops(depot, i);

                shops.forEach(shop => {
                    rawData.push(shop);
                    summaryTotals.wheat.allotted += shop.wheatAllotted;
                    summaryTotals.wheat.dispatched += shop.wheatDispatched;
                    summaryTotals.wheat.received += shop.wheatReceived;
                    summaryTotals.fortifiedRice.allotted += shop.fortifiedRiceAllotted;
                    summaryTotals.fortifiedRice.dispatched += shop.fortifiedRiceDispatched;
                    summaryTotals.fortifiedRice.received += shop.fortifiedRiceReceived;
                });

                console.log(`   ✅ Extracted ${shops.length} shops from ${depot.name}`);

                // Go back to depot list for next iteration (click "Back" or re-click district)
                if (i < validDepots.length - 1) {
                    await this._goBackToDepotList();
                }
            }

            console.log(`\n✅ [MDM] Extraction complete. Total shops: ${rawData.length}`);
            console.log(`   Wheat Allotted: ${summaryTotals.wheat.allotted.toFixed(2)} Qt`);
            console.log(`   Fortified Rice Allotted: ${summaryTotals.fortifiedRice.allotted.toFixed(2)} Qt`);

            return { rawData, summaryTotals, status: 'success' };

        } catch (err) {
            console.error('❌ [MDM] Extraction failed:', err.message);
            // Save error state HTML for debugging
            try {
                const errHtml = await this.page.content();
                fs.writeFileSync(path.join(this.logsDir, 'mdm_error_state.html'), errHtml);
            } catch (_) { }
            return { rawData: [], summaryTotals: null, status: 'failed', error: err.message };
        }
    }

    async _selectFilters(month, year) {
        console.log(`   Setting filters to Month: ${month}, Year: ${year}`);
        try {
            await this.page.evaluate((m, y) => {
                const ms = document.getElementById('month');
                const ys = document.getElementById('year');
                const ed = document.getElementById('detailsED');
                
                // Clear existing results to avoid stale data detection
                if (ed) ed.innerHTML = '';

                if (ms) {
                    ms.removeAttribute('onchange');
                    ms.value = m;
                    ms.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (ys) {
                    ys.removeAttribute('onchange');
                    ys.value = y;
                    ys.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, String(month), String(year));

            // Small wait for any internal portal scripts to react
            await new Promise(r => setTimeout(r, 500));

            // Re-verify the values
            const actualMonth = await this.page.$eval('#month', el => el.value);
            const actualYear = await this.page.$eval('#year', el => el.value);
            console.log(`   ✅ Filters verified in DOM: Month=${actualMonth}, Year=${actualYear}`);

        } catch (error) {
            console.error('⚠️ [MDM] Error setting filters:', error.message);
        }
    }

    async _waitForLoading() {
        // Wait for #loading to display block then none, or just wait a bit
        try {
            await this.page.waitForSelector('#loading', { visible: true, timeout: 2000 });
            await this.page.waitForSelector('#loading', { hidden: true, timeout: 30000 });
        } catch (e) {
            // Spinner might have been too fast or didn't trigger
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async _clickGetReport() {
        console.log('   Clicking "Get Report"...');

        // Use the specific button found in HTML
        const clicked = await this.page.evaluate(() => {
            const btn = document.querySelector('input[value="Get Report"]');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            console.log('   Retrying click with generic selector...');
            await this.page.click('input[type="button"][value="Get Report"]');
        }

        await this._waitForLoading();

        // Wait for specific district table or "No data found" for the CHOSEN month
        await this.page.waitForFunction((m) => {
            const dr = document.getElementById('distreport');
            if (!dr) return false;
            const text = dr.innerText;
            // Ensure the table header matches the month (e.g. "April-2026")
            const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const targetMonthName = monthNames[parseInt(m)];
            
            // The table MUST show the target month in the header before we consider it "loaded"
            if (text.includes(targetMonthName)) {
                // Once the header is correct, we wait for either the data table (Betul) or the actual empty message
                if (text.includes('Betul') || text.includes('No data found')) return true;
            }
            return false;
        }, { timeout: 30000 }, String(this.currentMonth)).catch(() => console.log('⚠️ Timed out waiting for Results table for ' + this.currentMonth));

        let noData = await this.page.evaluate((m) => {
            const dr = document.getElementById('distreport');
            if (!dr) return true;
            const text = dr.innerText;
            const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const targetMonthName = monthNames[parseInt(m)];
            
            return text.includes(targetMonthName) && text.includes('No data found');
        }, String(this.currentMonth));

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
            
            noData = await this.page.evaluate((m) => {
                const dr = document.getElementById('distreport');
                if (!dr) return true;
                const text = dr.innerText;
                const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const targetMonthName = monthNames[parseInt(m)];
                return text.includes(targetMonthName) && text.includes('No data found');
            }, String(this.currentMonth));
        }

        if (noData) {
            throw new Error('NO_DATA: The portal currently shows "No data found" for this month/year. Please try again after some time or check the portal manually.');
        }

        console.log('✅ [MDM] "Get Report" clicked & processed.');
    }

    async _clickDistrict() {
        console.log(`   Clicking District: ${this.DISTRICT_NAME} (SL No. 7)...`);

        // Click the district link: onclick="getreportdepot('447','Betul');"
        const clicked = await this.page.evaluate((districtName) => {
            const links = document.querySelectorAll('#distreport a');
            for (const link of links) {
                if (link.innerText.trim().toLowerCase() === districtName.toLowerCase()) {
                    link.click();
                    return `clicked: ${link.innerText.trim()}`;
                }
            }
            return null;
        }, this.DISTRICT_NAME);

        if (!clicked) throw new Error(`Could not find district "${this.DISTRICT_NAME}" in #distreport`);
        console.log(`   District click result: ${clicked}`);
        await this._waitForLoading();

        // Wait for #depotreport to appear (replaced #distreport content via AJAX)
        await this.page.waitForFunction(() => {
            const depot = document.getElementById('depotreport');
            return depot && depot.querySelectorAll('tr').length > 3;
        }, { timeout: 60000 }).catch(() =>
            console.warn('⚠️ Timed out waiting for #depotreport. Will try anyway.')
        );

        console.log(`✅ [MDM] #depotreport loaded with Betul's data`);
    }

    async _getDepotList() {
        console.log('   Using hardcoded MDM ISSUE_POINTS to avoid government portal depot list corruption...');
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
                        return isNaN(v) ? 0 : v / 100;
                    };

                    const parseNum = (td) => {
                        if (!td) return 0;
                        const v = parseInt((td.innerText || '0').replace(/,/g, '').trim(), 10);
                        return isNaN(v) ? 0 : v;
                    };

                    if (result.length === 0) {
                        sampleRow = Array.from(cells).map((c, idx) => `[${idx}]=${c.innerText.trim().substring(0, 20)} `);
                    }

                    result.push({
                        shopCode,
                        shopName: `MDM FPS ${shopCode}`,
                        issuePoint: depotNameStr,
                        columnCount: cells.length,
                        schoolsCount: parseNum(cells[2]),
                        inmatesCount: parseNum(cells[3]),
                        wheatAllotted: parseKg(cells[6]),
                        wheatDispatched: parseKg(cells[8]),
                        wheatReceived: parseKg(cells[9]),
                        fortifiedRiceAllotted: parseKg(cells[13]),
                        fortifiedRiceDispatched: parseKg(cells[15]),
                        fortifiedRiceReceived: parseKg(cells[16])
                    });
                }
                return { shops: result, tableFound: true, totalRows: rows.length, firstDataCols, sampleRow };
            }, depot.depotName || depot.name);

            extractedShops = Array.isArray(shopsResult) ? shopsResult : (shopsResult.shops || []);
            if (extractedShops.length > 0) break;

            console.warn(`   ⚠️ Attempt ${attempt}/3 for depot ${depot.name} returned 0 shops. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }

        // Always save debug HTML for first 2 depots to verify column structure
        if (depotIndex < 2) {
            try {
                const html = await this.page.content();
                fs.writeFileSync(path.join(this.logsDir, `mdm_fps_depot${depot.slNo}_debug.html`), html);
                console.log(`   Saved debug HTML: mdm_fps_depot${depot.slNo}_debug.html`);
            } catch (_) {}
        }

        console.log(`   Extracted ${extractedShops.length} shops for ${depot.depotName || depot.name}`);
        return extractedShops;
    }

    async _goBackToDepotList() {
        // The depot list (#depotreport) is still loaded in the DOM.
        // We just need to wait — the shop table (#shop_report) appears in-place,
        // but #depotreport stays in the DOM too. So no navigation is needed!
        // If the next iteration's ro_detailsShop call updates #shop_report directly,
        // we don't need to do anything special here.
        // But if it causes a page issue, re-click the district:
        const depotTableStillPresent = await this.page.evaluate(() => {
            const t = document.getElementById('depotreport');
            return t && t.querySelectorAll('tr').length > 3;
        });
        if (!depotTableStillPresent) {
            console.log('   #depotreport gone — re-clicking district...');
            await this._clickDistrict();
        }
        // Small wait to be safe
        await new Promise(r => setTimeout(r, 500));
    }
}

module.exports = MDMScraper;
