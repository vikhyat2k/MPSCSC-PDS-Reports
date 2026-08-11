const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const DatabaseManager = require('../server/database/db');
const AdvancedAnalyticsCompute = require('../server/services/advancedAnalytics/advancedAnalyticsCompute');
const AdvancedAnalyticsChartRenderer = require('../server/services/advancedAnalytics/advancedAnalyticsChartRenderer');
const AdvancedAnalyticsPdfGenerator = require('../server/services/advancedAnalytics/advancedAnalyticsPdfGenerator');

async function testPdfGen() {
    console.log('📄 Testing PDF Generator Redesign...');
    const db = new DatabaseManager();
    await db.init();

    const reports = await db.all('SELECT id, month, year FROM reports WHERE scheme = "nfsa" ORDER BY id DESC LIMIT 1');
    if (!reports.length) {
        console.error('No NFSA reports found.');
        return;
    }
    const r = reports[0];
    const fullReport = await db.getReport(r.id);
    const rawData = JSON.parse(fullReport.raw_data);

    const compute = new AdvancedAnalyticsCompute();
    const computed = compute.compute(rawData, fullReport.month, fullReport.year, fullReport.created_at);

    const chartRenderer = new AdvancedAnalyticsChartRenderer();
    const chartBuffers = await chartRenderer.renderCharts(computed);

    const pdfGen = new AdvancedAnalyticsPdfGenerator();
    const pdfBuf = await pdfGen.generatePdf(computed, chartBuffers);

    const outPdf = path.join(__dirname, 'redesigned_report.pdf');
    fs.writeFileSync(outPdf, pdfBuf);
    console.log(`✅ Redesigned PDF written to ${outPdf}`);

    // Render PDF pages as PNG images for visual audit
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const htmlContent = pdfGen.generateHtml(computed, chartBuffers);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pages = await page.$$('.page');
    console.log(`📊 Generated HTML has ${pages.length} page containers.`);

    for (let i = 0; i < pages.length; i++) {
        const imgPath = path.join(__dirname, `redesigned_page_${i + 1}.png`);
        await pages[i].screenshot({ path: imgPath });
        console.log(`📸 Page ${i + 1} screenshot saved to ${imgPath}`);
    }

    await browser.close();
    console.log('🎉 PDF Redesign Test Complete!');
}

testPdfGen().catch(err => console.error('Error testing PDF:', err));
