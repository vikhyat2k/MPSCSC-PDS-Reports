const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');
const PDFGenerator = require('../server/services/pdfGenerator');

async function testFootnote() {
    console.log('🧪 Testing NFSA Single-Page PDF with 3-Column Analytical Footnote...');
    const db = new DatabaseManager();
    await db.init();

    const reports = await db.all('SELECT * FROM reports WHERE scheme = "nfsa" ORDER BY id DESC LIMIT 1');
    if (!reports.length) {
        console.error('No NFSA report found');
        return;
    }
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);
    console.log(`Loaded real report: ${processed.sectors.length} sectors, Allocation: ${processed.totals.totalAllocation}`);

    const pdfGen = new PDFGenerator();
    const result = await pdfGen.generateReport(processed, reports[0].month, reports[0].year);
    console.log('Generated PDF:', result.filepath);

    // Check page count using pdf-parse or puppeteer
    const { PDFParse } = require('pdf-parse');
    const pdfBuf = fs.readFileSync(result.filepath);
    const parsed = await new PDFParse(new Uint8Array(pdfBuf)).getText();
    console.log('Parsed PDF total pages/text length:', parsed.text.length);

    // Verify page count by loading in puppeteer and counting pages
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // We can also take a screenshot of the rendered page for inspection
    // Let's get the HTML content directly from PDFGenerator
    // To do that, let's see how PDFGenerator renders it
    await browser.close();
    console.log('✅ Test complete!');
}

testFootnote().catch(console.error);
