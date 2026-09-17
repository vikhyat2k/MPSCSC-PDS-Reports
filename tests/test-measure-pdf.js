const fs = require('fs');
const puppeteer = require('puppeteer');
const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');
const PDFGenerator = require('../server/services/pdfGenerator');

(async () => {
    const db = new DatabaseManager();
    await db.init();
    const reports = await db.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);
    
    const pdfGen = new PDFGenerator();
    let capturedHtml = '';
    const origSetContent = puppeteer.Page.prototype.setContent;
    puppeteer.Page.prototype.setContent = async function(html, opts) {
        capturedHtml = html;
        return origSetContent.call(this, html, opts);
    };

    await pdfGen.generateReport(processed, reports[0].month, reports[0].year);
    puppeteer.Page.prototype.setContent = origSetContent;

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(capturedHtml, { waitUntil: 'networkidle0' });

    const data = await page.evaluate(() => {
        const toObj = r => ({ top: r.top, bottom: r.bottom, height: r.height, left: r.left, width: r.width });
        const h2 = document.querySelector('h2');
        const table = document.querySelector('table');
        const footer = document.querySelector('.analytics-footer-strip');
        return {
            h2: toObj(h2.getBoundingClientRect()),
            table: toObj(table.getBoundingClientRect()),
            footer: toObj(footer.getBoundingClientRect()),
            docHeight: document.documentElement.scrollHeight
        };
    });

    console.log('Detailed metrics:', data);
    await browser.close();
})();
