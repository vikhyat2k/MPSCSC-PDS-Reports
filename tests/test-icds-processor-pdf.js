const fs = require('fs');
const path = require('path');
const ICDSDataProcessor = require('../server/services/icdsDataProcessor');
const ICDSPDFGenerator = require('../server/services/icdsPdfGenerator');

async function testProcessorAndPdf() {
    console.log('🧪 Testing ICDSDataProcessor and ICDSPDFGenerator with live scraped raw data...');
    const rawDataPath = path.join(__dirname, 'icds_raw_scraped.json');
    if (!fs.existsSync(rawDataPath)) {
        console.error('Raw data file not found!');
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
    console.log(`Loaded ${rawData.length} raw shop rows.`);

    const processor = new ICDSDataProcessor();
    const processed = processor.processData(rawData, {});

    console.log('\n📊 Processed Data Totals:');
    console.log(JSON.stringify(processed.totals, null, 2));

    console.log('\nSectors Summary:');
    let totalShopsInSectors = 0;
    let totalAwcInSectors = 0;
    processed.sectors.forEach(s => {
        console.log(`Sector: ${s.sectorName} (${s.serialNo}), Block: ${s.block}, Shops: ${s.icdsShopCount}, Awc: ${s.awcCount}, WheatAllot: ${s.wheatAllotted.toFixed(2)}, WheatDisp: ${s.wheatDispatched.toFixed(2)}, WheatRec: ${s.wheatReceived.toFixed(2)}`);
        totalShopsInSectors += s.icdsShopCount;
        totalAwcInSectors += s.awcCount;
    });

    console.log(`\nTotal Shops across sectors: ${totalShopsInSectors}`);
    console.log(`Total AWCs across sectors: ${totalAwcInSectors}`);

    // Generate PDF
    const pdfGen = new ICDSPDFGenerator();
    const pdfResult = await pdfGen.generateReport(processed, 7, 2026);
    console.log('\n📄 Generated PDF:', pdfResult.filepath);
}

testProcessorAndPdf();
