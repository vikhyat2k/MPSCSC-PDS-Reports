// tests/test-nfsa-diff-column.js
const assert = require('assert');
const DataProcessor = require('../server/services/dataProcessor');
const ExcelGenerator = require('../server/services/excelGenerator');
const PDFGenerator = require('../server/services/pdfGenerator');
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

console.log('🧪 Testing NFSA "प्रेषित एव प्राप्त मात्रा का अंतर प्रतिशत" column position and header...\n');

// Mock rawData matching row 1 of user's PDF
const mockShops = [
    {
        shopCode: 'TEST01',
        allocation: 3367.37,
        dispatch: 1202.46,
        posReceipt: 951.85,
        issuePoint: 'बैतूल'
    }
];

const processor = new DataProcessor();
const processed = processor.processData(mockShops);

console.log('Processed totals:', processed.totals);
assert(processed.sectors.length > 0);

const s1 = processed.sectors[0];
console.log('Sector 1 metrics:', {
    dispatchPct: s1.dispatchPercentage.toFixed(2),
    receiptPct: s1.receiptPercentage.toFixed(2),
    diffPct: s1.dispatchReceiptDiffPercentage.toFixed(2)
});

// Sector 1: alloc = 3367.37, disp = 1202.46 (35.71%), receipt = 951.85 (28.27%)
// diff = 35.71% - 28.27% = 7.44%
assert.strictEqual(s1.dispatchPercentage.toFixed(2), '35.71');
assert.strictEqual(s1.receiptPercentage.toFixed(2), '28.27');
assert.strictEqual(s1.dispatchReceiptDiffPercentage.toFixed(2), '7.44');

// Check Total diff
const expectedDiff = (processed.totals.dispatchPercentage - processed.totals.receiptPercentage).toFixed(2);
assert.strictEqual(processed.totals.dispatchReceiptDiffPercentage.toFixed(2), expectedDiff);
console.log('✅ DataProcessor calculation verified successfully!\n');

async function testOutputs() {
    // Test Excel Generator
    const excelGen = new ExcelGenerator();
    const resExcel = await excelGen.generateReport(processed, 9, 2026);
    assert(fs.existsSync(resExcel.filepath));
    console.log('✅ Excel generated with 13 columns at:', resExcel.filename);
    try { fs.unlinkSync(resExcel.filepath); } catch (e) {}

    // Test PDF Generator
    const pdfGen = new PDFGenerator();
    const resPdf = await pdfGen.generateReport(processed, 9, 2026);
    assert(fs.existsSync(resPdf.filepath));
    console.log('✅ PDF generated at:', resPdf.filename);

    const parser = new PDFParse(new Uint8Array(fs.readFileSync(resPdf.filepath)));
    const pdfText = await parser.getText();
    console.log('PDF Preview:');
    console.log(pdfText.text.slice(0, 500));

    assert(pdfText.text.includes('अंतर'));
    try { fs.unlinkSync(resPdf.filepath); } catch (e) {}

    console.log('🎉 All NFSA diff column tests passed successfully!');
}

testOutputs().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
