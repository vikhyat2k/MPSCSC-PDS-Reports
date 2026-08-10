const fs = require('fs');
const path = require('path');
const MDMDataProcessor = require('../server/services/mdmDataProcessor');
const MDMPDFGenerator = require('../server/services/mdmPdfGenerator');
const MDMExcelGenerator = require('../server/services/mdmExcelGenerator');
const WelfareDataProcessor = require('../server/services/welfareDataProcessor');
const WelfarePDFGenerator = require('../server/services/welfarePdfGenerator');
const WelfareExcelGenerator = require('../server/services/welfareExcelGenerator');

async function testMDMAndWelfare() {
    console.log('🧪 Testing MDM & Welfare Processing, PDF & Excel generators...');

    // 1. MDM Test
    const sampleMdmData = [
        {
            shopCode: '2331001001',
            shopName: 'MDM School 2331001001',
            issuePoint: 'Betul',
            wheatAllotted: 50.0,
            wheatDispatched: 48.0,
            wheatReceived: 45.0,
            fortifiedRiceAllotted: 30.0,
            fortifiedRiceDispatched: 28.0,
            fortifiedRiceReceived: 27.0
        }
    ];

    const mdmProcessor = new MDMDataProcessor();
    const mdmProcessed = mdmProcessor.processData(sampleMdmData, {});
    console.log('✅ MDM Processed Totals:', mdmProcessed.totals);

    const mdmPdfGen = new MDMPDFGenerator();
    const mdmPdf = await mdmPdfGen.generateReport(mdmProcessed, 7, 2026);
    console.log('✅ MDM PDF Generated:', mdmPdf.filename);

    const mdmExcelGen = new MDMExcelGenerator();
    const mdmExcel = await mdmExcelGen.generateReport(mdmProcessed, 7, 2026);
    console.log('✅ MDM Excel Generated:', mdmExcel.filename);

    // 2. Welfare Test
    const sampleWelfareData = [
        {
            shopCode: '2331001002',
            shopName: 'Welfare Hostel 2331001002',
            issuePoint: 'Betul',
            wheatAllotted: 20.0,
            wheatDispatched: 19.0,
            wheatReceived: 18.0,
            riceAllotted: 15.0,
            riceDispatched: 14.0,
            riceReceived: 13.0
        }
    ];

    const welfareProcessor = new WelfareDataProcessor();
    const welfareProcessed = welfareProcessor.processData(sampleWelfareData, {});
    console.log('✅ Welfare Processed Totals:', welfareProcessed.totals);

    const welfarePdfGen = new WelfarePDFGenerator();
    const welfarePdf = await welfarePdfGen.generateReport(welfareProcessed, 7, 2026);
    console.log('✅ Welfare PDF Generated:', welfarePdf.filename);

    const welfareExcelGen = new WelfareExcelGenerator();
    const welfareExcel = await welfareExcelGen.generateReport(welfareProcessed, 7, 2026);
    console.log('✅ Welfare Excel Generated:', welfareExcel.filename);

    // Cleanup generated test files
    if (fs.existsSync(mdmPdf.filepath)) fs.unlinkSync(mdmPdf.filepath);
    if (fs.existsSync(mdmExcel.filepath)) fs.unlinkSync(mdmExcel.filepath);
    if (fs.existsSync(welfarePdf.filepath)) fs.unlinkSync(welfarePdf.filepath);
    if (fs.existsSync(welfareExcel.filepath)) fs.unlinkSync(welfareExcel.filepath);

    console.log('🎉 All MDM & Welfare Fix Tests PASSED successfully!');
}

testMDMAndWelfare().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
