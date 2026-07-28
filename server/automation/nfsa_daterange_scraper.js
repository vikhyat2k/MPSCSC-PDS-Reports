const SCMScraper = require('./scraper_v2');
const path = require('path');
const fs = require('fs');

/**
 * Scraper for "Dispatch/Receive Details (Between Dates)" functionality
 * Reuses SCMScraper for robust login, then navigates to the specific URL
 */
class NFSADateRangeScraper {
    constructor() {
        this.VERSION = '1.0.0';
        this.baseScraper = new SCMScraper();
        this.TARGET_URL = 'https://scm.mp.gov.in/dispatch_details_between_dates_int.jsp';

        this.logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    async init(headless = null) {
        await this.baseScraper.init(headless);
        this.browser = this.baseScraper.browser;
        this.page = this.baseScraper.page;
    }

    /**
     * Main Extraction Method
     */
    async extractData(fromDate, toDate, month, year, username, password, onProgress = null) {
        try {
            if (onProgress) onProgress('Navigating to SCM Portal...');

            // Portal URL is publicly accessible — no login required
            console.log(`[DateRange] 🌐 Navigating directly to ${this.TARGET_URL}...`);
            // Set a modern User-Agent to avoid bot detection
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            
            // Add extra headers to look more like a real browser
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Cache-Control': 'max-age=0'
            });

            console.log('✅ Page initialized with stealth headers');

            try {
                await this.page.goto(this.TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
            } catch (err) {
                console.warn(`⚠️ Navigation warning (domcontentloaded): ${err.message}. Retrying with 'load'...`);
                await this.page.goto(this.TARGET_URL, { waitUntil: 'load', timeout: 60000 });
            }
            console.log(`[DateRange] ✅ Arrived at Dispatch details b/w dates`);

            await new Promise(r => setTimeout(r, ));

            // Portal expects DD-MM-YYYY format
            const fmtFrom = fromDate.replace(/\//g, '-');
            const fmtTo   = toDate.replace(/\//g, '-');
            console.log(`[DateRange] 📅 From: ${fmtFrom}  To: ${fmtTo}  Month: ${month}  Year: ${year}`);

            await this.page.screenshot({ path: path.join(this.logsDir, `dr_before_submit_${Date.now()}.png`), fullPage: true });

            if (onProgress) onProgress('Submitting date range query to portal...');

            // Trigger the portal's own detailreport() AJAX call
            const ajaxResult = await this.page.evaluate(({ fromDate, toDate, month, year }) => {
                return new Promise((resolve, reject) => {
                    if (typeof $ === 'undefined') {
                        reject(new Error('jQuery not available — page may not have loaded correctly or login may be required'));
                        return;
                    }

                    const dist_code  = '447';
                    const dist_name  = 'Betul';
                    const remarks    = "'1','2','5'";
                    const remarksname = 'Dispatched';
                    const ro_type    = 'ALL';

                    const dataval = "from_date=" + fromDate + "&to_date=" + toDate
                        + "&month=" + month + "&year=" + year
                        + "&dist_code=" + dist_code + "&dist_name=" + dist_name
                        + "&remarks=" + remarks + "&remarksname=" + remarksname + "&ro_type=" + ro_type;

                    $.ajax({
                        type: "post",
                        url: "dispatch_details_Load.jsp",
                        data: dataval,
                        cache: false,
                        success: function (html) {
                            $("#detailsER").html(html);
                            resolve({ html: html, length: html.length });
                        },
                        error: function (xhr, status, err) {
                            reject(new Error("AJAX call failed: " + status + " - " + err));
                        }
                    });
                });
            }, { fromDate: fmtFrom, toDate: fmtTo, month: month.toString(), year: year.toString() });

            const ajaxHtml = ajaxResult.html;
            console.log(`[DateRange] 📨 AJAX response received: ${ajaxResult.length} bytes`);
            fs.writeFileSync(path.join(this.logsDir, 'dr_ajax_response.html'), ajaxHtml);

            // Give the DOM a moment to fully render
            await new Promise(r => setTimeout(r, ));

            const rawHtml = await this.page.content();
            fs.writeFileSync(path.join(this.logsDir, 'dr_initial_result.html'), rawHtml);

            // Check if server returned a "no data" message instead of a table
            if (ajaxHtml.trim().length < 100) {
                throw new Error(`NO_DATA: Portal returned empty response (${ajaxHtml.length} bytes). No dispatch data found for the selected date range.`);
            }

            // Now parse the table
            const data = await this.page.evaluate(() => {
                const table = document.querySelector('#detailsER table');
                if (!table) return null;

                const headers = [];
                // The headers are spread across row 1 (Titles) and row 2 (Commodities)
                // Let's just grab the commodities from row 2 as our subset headers, or just use fixed mapping in processor
                // For now, let's just grab the raw row arrays and let the processor handle them.

                const rowsData = [];
                const trs = table.querySelectorAll('tbody tr, tr');
                
                // Skip header rows by starting at index 2 or checking structure
                trs.forEach((tr, index) => {
                    if (index < 2) return; // Skip title and commodity header rows
                    
                    const cells = tr.querySelectorAll('td, th');
                    if (cells.length > 5) { // Data rows have 14 columns usually
                        const row = [];
                        cells.forEach(c => row.push(c.innerText.trim().replace(/\s+/g, ' ')));
                        rowsData.push(row);
                    }
                });

                return { headers, rowsData };
            });

            if (!data) {
                throw new Error("Target table not found in AJAX response.");
            }

            console.log(`[DateRange] Successfully extracted ${data.rowsData.length} raw rows.`);

            // Map the arrays to structured objects
            // Columns: 0:#, 1:Issue Point Name, 2:Fps Id, 3:Fps Name, 4:RO No, 5:Truck No, 6:Truck Chit No
            // 7:Wheat, 8:Sugar, 9:Salt, 10:FSalt, 11:Jowar, 12:Fortified Rice
            // 13:Dispatched Date, 14:Received Date
            const mappedData = data.rowsData.map(row => {
                const shopCode = row[2] || '';
                const shopName = row[3] || '';
                const roNo = row[4] || '';
                const truckNo = row[5] || '';
                const truckChitNo = row[6] || '';
                
                // Actual columns in Date Range report: 
                // 7:Wheat, 8:Salt, 9:FSalt, 10:Fortified Rice, 11:Dispatched Date, 12:Received Date
                const wheat = (parseFloat(row[7]) || 0) / 100;
                const salt = (parseFloat(row[8]) || 0) / 100;
                const fsalt = (parseFloat(row[9]) || 0) / 100;
                const fortifiedRice = (parseFloat(row[10]) || 0) / 100;
                const dispatchedDate = row[11] || '';
                
                // Total dispatch = ALL commodities (matching portal's TOTAL row)
                // Note: Date range report currently shows these 4 commodities only
                const nfsaDispatch = wheat + salt + fsalt + fortifiedRice;

                return {
                    shopCode,
                    shopName,
                    roNo,
                    truckNo,
                    truckChitNo,
                    allocation: 0,
                    dispatch: nfsaDispatch,
                    posReceipt: 0,
                    nfsaAllocation: 0,
                    nfsaDispatch: nfsaDispatch,
                    nfsaReceipt: 0,
                    commodities: {}, // No allocation
                    dispatchCommodities: { wheat, salt, fSalt: fsalt, fortifiedRice },
                    receivedCommodities: {}, // No receipt breakdown
                    dispatchedDate
                };
            }).filter(item => item.shopCode && item.shopCode !== '');

            console.log(`[DateRange] Successfully mapped ${mappedData.length} records.`);
            fs.writeFileSync(path.join(this.logsDir, 'dr_extracted_data.json'), JSON.stringify(mappedData, null, 2));

            // We will return a dummy success for now while developing structure.
            return {
                status: 'success',
                rawData: mappedData, 
                summaryTotals: {}
            };

        } catch (error) {
            console.error('[DateRange] Original Error:', error);
            try { await this.page.screenshot({ path: path.join(this.logsDir, `dr_error_${Date.now()}.png`), fullPage: true }); } catch (screenshotErr) { }
            return {
                status: 'failed',
                error: error.message
            };
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

module.exports = NFSADateRangeScraper;
