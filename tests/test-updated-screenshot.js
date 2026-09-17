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
    let html = pdfGen.generateHtml(processed, reports[0].month, reports[0].year);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true
    });

    const parsed = await new PDFParse(new Uint8Array(pdfBuf)).getText();
    console.log('Total PDF Pages with updated pdfGenerator.js:', parsed.total);

    await page.screenshot({ path: 'tests/final_verified_pdf.png' });
    console.log('Screenshot saved to tests/final_verified_pdf.png');

    await browser.close();
})();
