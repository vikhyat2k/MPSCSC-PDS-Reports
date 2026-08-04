const DatabaseManager = require('../server/database/db');
const AdvancedAnalyticsCompute = require('../server/services/advancedAnalytics/advancedAnalyticsCompute');
const AdvancedAnalyticsExcelGenerator = require('../server/services/advancedAnalytics/advancedAnalyticsExcelGenerator');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function testAdvancedAnalytics() {
    console.log('🧪 Starting Advanced Analytics Verification Test...');

    const db = new DatabaseManager();
    await db.init();

    // Get reports from DB
    const reports = await db.all("SELECT id, scheme, month, year, generated_at, raw_data, insights FROM reports WHERE scheme = 'nfsa' LIMIT 5");
    console.log(`📊 Found ${reports.length} NFSA reports in database.`);

    if (reports.length === 0) {
        console.log('⚠️ No NFSA report in database. Testing with synthetic data...');
        const syntheticReport = {
            id: 999,
            scheme: 'nfsa',
            month: 8,
            year: 2026,
            created_at: new Date().toISOString(),
            raw_data: JSON.stringify([
                { shopCode: '1001', allocation: 100, dispatch: 80, posReceipt: 60, issuePoint: 'बैतूल' },
                { shopCode: '1002', allocation: 200, dispatch: 190, posReceipt: 210, issuePoint: 'बैतूल' } // Over-receipt case
            ])
        };
        reports.push(syntheticReport);
    }

    const testReport = reports[0];
    console.log(`🔍 Testing report ID ${testReport.id} (${testReport.month}/${testReport.year})...`);

    const compute = new AdvancedAnalyticsCompute();
    const result = compute.compute(testReport);

    console.log('✅ Compute Summary:');
    console.log(`   Total Allocation: ${result.kpis.totalAllocation}`);
    console.log(`   Total Dispatch: ${result.kpis.totalDispatch}`);
    console.log(`   District Lift %: ${(result.kpis.districtLiftPct * 100).toFixed(2)}%`);
    console.log(`   Critical Sectors: ${result.kpis.criticalSectorsCount}`);
    console.log(`   Watch Sectors: ${result.kpis.watchSectorsCount}`);
    console.log(`   Good Sectors: ${result.kpis.goodSectorsCount}`);
    console.log(`   Excellent Sectors: ${result.kpis.excellentSectorsCount}`);

    // Check rank direction
    const bestSector = [...result.sectors].sort((a, b) => a.districtRank - b.districtRank)[0];
    console.log(`   Rank 1 Sector: ${bestSector.sectorName} (Lift: ${(bestSector.liftPct * 100).toFixed(2)}%, Rank: ${bestSector.districtRank})`);

    // Generate Excel
    const excelGen = new AdvancedAnalyticsExcelGenerator();
    const workbook = await excelGen.generateWorkbook(result);

    const testOutPath = path.join(__dirname, 'test_adv_analytics.xlsx');
    await workbook.xlsx.writeFile(testOutPath);
    console.log(`✅ Excel written successfully to: ${testOutPath}`);

    // Inspect formulas in Excel
    const checkWorkbook = new ExcelJS.Workbook();
    await checkWorkbook.xlsx.readFile(testOutPath);
    const wsSector = checkWorkbook.getWorksheet('Sector Detail');
    const wsDash = checkWorkbook.getWorksheet('Dashboard');

    console.log('✅ Formula Checks:');
    console.log(`   Sector Detail Lift % cell G4 formula:`, wsSector.getCell('G4').value);
    console.log(`   Sector Detail District Rank cell L4 formula:`, wsSector.getCell('L4').value);
    console.log(`   Dashboard Card 1 formula:`, wsDash.getCell('A6').value);

    console.log('🎉 Advanced Analytics Verification Complete!');
    process.exit(0);
}

testAdvancedAnalytics().catch(err => {
    console.error('❌ Test Error:', err);
    process.exit(1);
});
