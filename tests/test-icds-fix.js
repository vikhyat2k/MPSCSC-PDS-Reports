const fs = require('fs');
const path = require('path');
const ICDSDataProcessor = require('../server/services/icdsDataProcessor');
const ICDSPDFGenerator = require('../server/services/icdsPdfGenerator');
const ICDSExcelGenerator = require('../server/services/icdsExcelGenerator');
const BalancesReportGenerator = require('../server/services/balancesReportGenerator');

async function testICDS() {
    console.log('🧪 Testing ICDS Processing, Analytics, Exports & Balances...');

    const sampleRawData = [
        {
            shopCode: '2331001001',
            shopName: 'ICDS AWC 2331001001',
            issuePoint: 'Betul',
            wheatAllotted: 10.5,
            wheatDispatched: 8.0,
            wheatReceived: 7.5,
            riceAllotted: 5.0,
            riceDispatched: 4.5,
            riceReceived: 4.0,
            fsaltAllotted: 1.0,
            fsaltDispatched: 1.0,
            fsaltReceived: 0.8
        },
        {
            shopCode: '2331002001',
            shopName: 'ICDS AWC 2331002001',
            issuePoint: 'Bhainsdehi',
            wheatAllotted: 15.0,
            wheatDispatched: 15.0,
            wheatReceived: 14.0,
            riceAllotted: 8.0,
            riceDispatched: 7.0,
            riceReceived: 6.5,
            fsaltAllotted: 2.0,
            fsaltDispatched: 1.5,
            fsaltReceived: 1.5
        }
    ];

    const processor = new ICDSDataProcessor();
    const processed = processor.processData(sampleRawData, {});

    console.log('✅ ICDS Processed Totals:', processed.totals);
    if (processed.totals.wheatAllotted !== 25.5 || processed.totals.riceAllotted !== 13.0 || processed.totals.fsaltAllotted !== 3.0) {
        throw new Error('Processed totals mismatched!');
    }

    // Test BalancesReportGenerator commodities for icds
    const balGen = new BalancesReportGenerator();
    const icdsComms = balGen.getCommodities('icds');
    console.log('✅ BalancesReport Commodities for ICDS:', icdsComms);
    if (!icdsComms.includes('salt')) {
        throw new Error('ICDS commodities in BalancesReportGenerator missing salt!');
    }

    // Test PDF generation
    const pdfGen = new ICDSPDFGenerator();
    const pdfResult = await pdfGen.generateReport(processed, 8, 2026);
    console.log('✅ Generated ICDS PDF:', pdfResult.filename);

    // Test Excel generation
    const excelGen = new ICDSExcelGenerator();
    const excelResult = await excelGen.generateReport(processed, 8, 2026);
    console.log('✅ Generated ICDS Excel:', excelResult.filename);

    // Cleanup test output files
    if (fs.existsSync(pdfResult.filepath)) fs.unlinkSync(pdfResult.filepath);
    if (fs.existsSync(excelResult.filepath)) fs.unlinkSync(excelResult.filepath);

    console.log('🎉 All ICDS Fix Tests PASSED successfully!');
}

testICDS().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
