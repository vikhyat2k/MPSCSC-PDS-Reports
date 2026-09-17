const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PDFParse } = require('pdf-parse');
const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');
const PDFGenerator = require('../server/services/pdfGenerator');

async function run() {
    const db = new DatabaseManager();
    await db.init();
    const reports = await db.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);

    const pdfGen = new PDFGenerator();
    
    // We can capture html by overriding newPage
    let capturedHtml = '';
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    
    // Generate standard report first to capture html
    const origLaunch = puppeteer.launch;
    puppeteer.launch = async () => browser;
    // Actually simpler: just mock browser.newPage inside generateReport
    const origNewPage = browser.newPage.bind(browser);
    browser.newPage = async () => {
        const page = await origNewPage();
        const origSet = page.setContent.bind(page);
        page.setContent = async (html, opts) => {
            capturedHtml = html;
            return origSet(html, opts);
        };
        return page;
    };
    
    await pdfGen.generateReport(processed, reports[0].month, reports[0].year);
    browser.newPage = origNewPage;
    puppeteer.launch = origLaunch;

    console.log('Captured HTML length:', capturedHtml.length);

    // Let's test configurations
    const configs = [
        {
            name: 'v1_11px_nowrap',
            fontSize: '11px',
            titleSize: '12px',
            wrap: 'nowrap',
            padding: '6px 8px',
            margin: '8px'
        },
        {
            name: 'v2_11.5px_nowrap',
            fontSize: '11.5px',
            titleSize: '12.5px',
            wrap: 'nowrap',
            padding: '6px 9px',
            margin: '8px'
        },
        {
            name: 'v3_12px_nowrap',
            fontSize: '12px',
            titleSize: '13px',
            wrap: 'nowrap',
            padding: '7px 10px',
            margin: '9px'
        },
        {
            name: 'v4_11.5px_wrap',
            fontSize: '11.5px',
            titleSize: '12.5px',
            wrap: 'normal',
            padding: '6px 9px',
            margin: '8px'
        },
        {
            name: 'v5_12px_wrap',
            fontSize: '12px',
            titleSize: '13px',
            wrap: 'normal',
            padding: '7px 10px',
            margin: '9px'
        }
    ];

    for (const c of configs) {
        let html = capturedHtml.replace(
            /\.analytics-footer-strip \{[\s\S]*?\.analytics-card-item \{[\s\S]*?\}/,
            `.analytics-footer-strip {
                    margin-top: ${c.margin};
                    display: flex;
                    gap: 8px;
                    justify-content: space-between;
                    width: 100%;
                }
                .analytics-card {
                    flex: 1;
                    background: #f8fafc;
                    border: 1px solid #94a3b8;
                    border-radius: 4px;
                    padding: ${c.padding};
                    font-size: ${c.fontSize};
                    line-height: 1.4;
                }
                .analytics-card-title {
                    font-weight: bold;
                    color: #0f172a;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 3px;
                    margin-bottom: 4px;
                    font-size: ${c.titleSize};
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .analytics-card-item {
                    color: #334155;
                    white-space: ${c.wrap};
                    ${c.wrap === 'nowrap' ? 'overflow: hidden; text-overflow: ellipsis;' : 'word-break: break-word;'}
                    margin-bottom: 2px;
                }`
        );

        const page = await browser.newPage();
        await page.setViewport({ width: 1123, height: 794 });
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfFile = path.join(__dirname, `test_${c.name}.pdf`);
        const pdfBuf = await page.pdf({
            path: pdfFile,
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: true
        });

        const parsed = await new PDFParse(new Uint8Array(pdfBuf)).getText();
        const ssFile = path.join(__dirname, `ss_${c.name}.png`);
        await page.screenshot({ path: ssFile, fullPage: false });

        console.log(`[${c.name}] => Total Pages: ${parsed.total}`);
        await page.close();
    }

    await browser.close();
}

run().catch(console.error);
