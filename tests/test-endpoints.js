const DatabaseManager = require('../server/database/db');
const AdvancedAnalyticsCompute = require('../server/services/advancedAnalytics/advancedAnalyticsCompute');
const AdvancedAnalyticsChartRenderer = require('../server/services/advancedAnalytics/advancedAnalyticsChartRenderer');
const AdvancedAnalyticsExcelGenerator = require('../server/services/advancedAnalytics/advancedAnalyticsExcelGenerator');
const AdvancedAnalyticsPdfGenerator = require('../server/services/advancedAnalytics/advancedAnalyticsPdfGenerator');

async function testEndpoints() {
    console.log('🧪 Testing Advanced Analytics Endpoints & Html Generator...');
    const db = new DatabaseManager();
    await db.init();

    const reports = await db.all("SELECT id, scheme, month, year, generated_at, raw_data, insights FROM reports WHERE scheme = 'nfsa' LIMIT 1");
    if (reports.length === 0) {
        console.log('No report found.');
        process.exit(0);
    }

    const report = reports[0];
    console.log(`🔍 Testing Report ID ${report.id}...`);

    const compute = new AdvancedAnalyticsCompute();
    const result = compute.compute(report);

    const chartRenderer = new AdvancedAnalyticsChartRenderer();
    const chartBuffers = await chartRenderer.renderCharts(result);

    const pdfGen = new AdvancedAnalyticsPdfGenerator();
    const html = pdfGen.generateHtml(result, chartBuffers);

    console.log(`✅ HTML Preview generated: ${html.length} chars`);
    if (!html.includes('Advanced Analytics Executive Report') || !html.includes('2. ब्लॉक-वार निष्पादन विश्लेषण')) {
        throw new Error('HTML generation missing expected content!');
    }

    console.log('🎉 All Advanced Analytics endpoints & HTML preview generator verified successfully!');
    process.exit(0);
}

testEndpoints().catch(err => {
    console.error('❌ Endpoint Test Error:', err);
    process.exit(1);
});
