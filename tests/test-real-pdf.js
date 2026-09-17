const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PDFParse } = require('pdf-parse');
const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');
const PDFGenerator = require('../server/services/pdfGenerator');

async function testWithRealPDF() {
    const db = new DatabaseManager();
    await db.init();
    const reports = await db.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);

    // Let's test font sizes in PDFGenerator
    const pdfGen = new PDFGenerator();
    const result = await pdfGen.generateReport(processed, reports[0].month, reports[0].year);

    const pdfBuf = fs.readFileSync(result.filepath);
    const parsed = await new PDFParse(new Uint8Array(pdfBuf)).getText();
    console.log('Original PDF total pages:', parsed.total);

    // Now let's test with 11.5px and 12px
    const tests = [
        { cardFont: '11.5px', titleFont: '12.5px', padding: '6px 10px', margin: '8px', lineH: '1.4' },
        { cardFont: '12px', titleFont: '13px', padding: '7px 10px', margin: '8px', lineH: '1.42' }
    ];

    // Let's load the generated PDF or HTML
    // We can extract the HTML from pdfGenerator
}
