const DatabaseManager = require('../server/database/db');
const AdvancedAnalyticsCompute = require('../server/services/advancedAnalytics/advancedAnalyticsCompute');
const AdvancedAnalyticsChartRenderer = require('../server/services/advancedAnalytics/advancedAnalyticsChartRenderer');
const AdvancedAnalyticsPdfGenerator = require('../server/services/advancedAnalytics/advancedAnalyticsPdfGenerator');
const path = require('path');
const fs = require('fs');

async function testPdfGeneration() {
    console.log('🧪 Testing Advanced Analytics PDF Generation...');
    const db = new DatabaseManager();
    await db.init();

    const reports = await db.all("SELECT id, scheme, month, year, generated_at, raw_data, insights FROM reports WHERE scheme = 'nfsa' LIMIT 1");
    if (reports.length === 0) {
        console.log('No report found.');
        process.exit(0);
    }

    const compute = new AdvancedAnalyticsCompute();
    const result = compute.compute(reports[0]);

    console.log('🖼️ Rendering charts via Puppeteer...');
    const chartRenderer = new AdvancedAnalyticsChartRenderer();
    const chartBuffers = await chartRenderer.renderCharts(result);
    console.log('✅ Charts rendered:', Object.keys(chartBuffers).map(k => `${k}: ${chartBuffers[k] ? chartBuffers[k].length : 0} bytes`));

    console.log('📄 Rendering PDF via Puppeteer...');
    const pdfGen = new AdvancedAnalyticsPdfGenerator();
    const pdfBuffer = await pdfGen.generatePdf(result, chartBuffers);

    const pdfOutPath = path.join(__dirname, 'test_adv_analytics.pdf');
    fs.writeFileSync(pdfOutPath, pdfBuffer);
    console.log(`✅ PDF written successfully (${pdfBuffer.length} bytes) to: ${pdfOutPath}`);
    process.exit(0);
}

testPdfGeneration().catch(err => {
    console.error('❌ PDF Test Error:', err);
    process.exit(1);
});
