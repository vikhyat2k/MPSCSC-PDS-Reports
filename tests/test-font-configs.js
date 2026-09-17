const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');
const PDFGenerator = require('../server/services/pdfGenerator');

async function testConfigs() {
    const db = new DatabaseManager();
    await db.init();
    const reports = await db.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);

    const pdfGen = new PDFGenerator();
    const origHtml = (await getBaseHtml(pdfGen, processed, reports[0].month, reports[0].year));

    // Test a range of font sizes from 10.5px to 13px
    const variations = [
        { label: 'Current Baseline', cardFont: '9.5px', titleFont: '10px', pad: '4px 6px', margin: '5px', lineH: '1.35' },
        { label: 'Option A (11px / 12px)', cardFont: '11px', titleFont: '12px', pad: '5px 8px', margin: '6px', lineH: '1.4' },
        { label: 'Option B (11.5px / 12.5px)', cardFont: '11.5px', titleFont: '12.5px', pad: '6px 8px', margin: '8px', lineH: '1.4' },
        { label: 'Option C (12px / 13px)', cardFont: '12px', titleFont: '13px', pad: '6px 10px', margin: '8px', lineH: '1.42' },
        { label: 'Option D (12.5px / 13.5px)', cardFont: '12.5px', titleFont: '13.5px', pad: '7px 10px', margin: '10px', lineH: '1.45' },
        { label: 'Option E (13px / 14px)', cardFont: '13px', titleFont: '14px', pad: '8px 10px', margin: '10px', lineH: '1.45' }
    ];

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const v of variations) {
        // Replace css in origHtml
        let modifiedHtml = origHtml.replace(
            /\.analytics-footer-strip \{[\s\S]*?\.analytics-card-item \{[\s\S]*?\}/,
            `.analytics-footer-strip {
                    margin-top: ${v.margin};
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
                    padding: ${v.pad};
                    font-size: ${v.cardFont};
                    line-height: ${v.lineH};
                }
                .analytics-card-title {
                    font-weight: bold;
                    color: #0f172a;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 3px;
                    margin-bottom: 4px;
                    font-size: ${v.titleFont};
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .analytics-card-item {
                    color: #334155;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                }`
        );

        const page = await browser.newPage();
        await page.setContent(modifiedHtml, { waitUntil: 'networkidle0' });

        const pdfPath = path.join(__dirname, `test_${v.label.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        const pdfBuf = await page.pdf({
            path: pdfPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: true
        });

        // Count pages
        const str = pdfBuf.toString('binary');
        const pageMatches = (str.match(/\/Type\s*\/Page[^s]/g) || []).length;

        // Screenshot
        await page.setViewport({ width: 1123, height: 794 });
        const imgPath = path.join(__dirname, `screenshot_${v.label.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
        await page.screenshot({ path: imgPath });

        console.log(`[${v.label}] -> Pages: ${pageMatches}, PDF: ${pdfPath}`);
        await page.close();
    }

    await browser.close();
    console.log('All tests completed.');
}

async function getBaseHtml(pdfGen, processed, month, year) {
    // Generate report temporarily to capture html
    const res = await pdfGen.generateReport(processed, month, year);
    // Read the source of pdfGenerator to reconstruct or get htmlContent
    // Or we can just read pdfGenerator.js and evaluate the template string
    const code = fs.readFileSync(path.join(__dirname, '../server/services/pdfGenerator.js'), 'utf8');
    // We can run generateReport with a mock or inspect
    return res;
}

// Simple extractor
const pdfGenCode = fs.readFileSync(path.join(__dirname, '../server/services/pdfGenerator.js'), 'utf8');
const dbMgr = new DatabaseManager();
dbMgr.init().then(async () => {
    const reports = await dbMgr.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);
    
    // Call generateReport
    const pdfGen = new PDFGenerator();
    // Temporarily replace page.setContent in puppeteer to get html
    let savedHtml = '';
    const origLaunch = puppeteer.launch;
    puppeteer.launch = async function(args) {
        const b = await origLaunch.call(puppeteer, args);
        const origNewPage = b.newPage;
        b.newPage = async function() {
            const p = await origNewPage.call(b);
            const origSet = p.setContent;
            p.setContent = async function(html, opts) {
                savedHtml = html;
                return origSet.call(p, html, opts);
            };
            return p;
        };
        return b;
    };
    
    await pdfGen.generateReport(processed, reports[0].month, reports[0].year);
    puppeteer.launch = origLaunch;
    
    // Now run tests
    const variations = [
        { label: 'Current_Baseline', cardFont: '9.5px', titleFont: '10px', pad: '4px 6px', margin: '5px', lineH: '1.35' },
        { label: 'Option_B_11_5px', cardFont: '11.5px', titleFont: '12.5px', pad: '6px 8px', margin: '8px', lineH: '1.4' },
        { label: 'Option_C_12px', cardFont: '12px', titleFont: '13px', pad: '6px 10px', margin: '8px', lineH: '1.42' },
        { label: 'Option_D_12_5px', cardFont: '12.5px', titleFont: '13.5px', pad: '7px 10px', margin: '10px', lineH: '1.45' },
        { label: 'Option_E_13px', cardFont: '13px', titleFont: '14px', pad: '8px 10px', margin: '10px', lineH: '1.45' }
    ];

    const browser = await origLaunch.call(puppeteer, { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const v of variations) {
        let modifiedHtml = savedHtml.replace(
            /\.analytics-footer-strip \{[\s\S]*?\.analytics-card-item \{[\s\S]*?\}/,
            `.analytics-footer-strip {
                    margin-top: ${v.margin};
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
                    padding: ${v.pad};
                    font-size: ${v.cardFont};
                    line-height: ${v.lineH};
                }
                .analytics-card-title {
                    font-weight: bold;
                    color: #0f172a;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 3px;
                    margin-bottom: 4px;
                    font-size: ${v.titleFont};
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .analytics-card-item {
                    color: #334155;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                }`
        );

        const page = await browser.newPage();
        await page.setContent(modifiedHtml, { waitUntil: 'networkidle0' });

        const pdfPath = path.join(__dirname, `test_${v.label}.pdf`);
        const pdfBuf = await page.pdf({
            path: pdfPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: true
        });

        const str = pdfBuf.toString('binary');
        const pageMatches = (str.match(/\/Type\s*\/Page[^s]/g) || []).length;

        await page.setViewport({ width: 1123, height: 794 });
        const imgPath = path.join(__dirname, `screenshot_${v.label}.png`);
        await page.screenshot({ path: imgPath });

        console.log(`[${v.label}] -> Pages: ${pageMatches}`);
        await page.close();
    }

    await browser.close();
    console.log('✅ Done testing all variations');
}).catch(console.error);
