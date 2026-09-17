const fs = require('fs');
const puppeteer = require('puppeteer');
const { PDFParse } = require('pdf-parse');
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
    const res = await pdfGen.generateReport(processed, reports[0].month, reports[0].year);

    console.log('Generated PDF at:', res.filepath);

    const pdfBuf = fs.readFileSync(res.filepath);
    const parsed = await new PDFParse(new Uint8Array(pdfBuf)).getText();
    console.log('Total PDF Pages:', parsed.total);

    // Also take screenshot of the HTML
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794 });
    const html = pdfGen.generateHtml(processed, reports[0].month, reports[0].year);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'tests/merged_praday_kendra_pdf.png' });
    console.log('Saved screenshot to tests/merged_praday_kendra_pdf.png');
    await browser.close();
})();
