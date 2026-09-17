const fs = require('fs');
const puppeteer = require('puppeteer');
const { PDFParse } = require('pdf-parse');
const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');
const PDFGenerator = require('../server/services/pdfGenerator');

async function testMerging() {
    const db = new DatabaseManager();
    await db.init();
    const reports = await db.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);

    // Function to compute rowspan
    function buildMergedHtml(processedData, mergeBlockToo) {
        const pdfGen = new PDFGenerator();
        // Compute spans for column 2 (issue center / block)
        const sectors = processedData.sectors || [];
        const spans = [];
        let i = 0;
        while (i < sectors.length) {
            const val = sectors[i].block || 'बैतूल';
            let count = 1;
            while (i + count < sectors.length && (sectors[i + count].block || 'बैतूल') === val) {
                count++;
            }
            spans.push({ startIndex: i, count, val });
            i += count;
        }

        // Get base html
        let html = pdfGen.generateHtml(processedData, reports[0].month, reports[0].year);

        // Replace the tbody rows
        // Let's generate the custom tbody
        let rowsHtml = '';
        sectors.forEach((sector, idx) => {
            const shopCount = sector.totalShops || (sector.shops ? sector.shops.length : 0);
            const bal = (sector.allocation || 0) - (sector.dispatch || 0);
            const dispatchPct = sector.dispatchPercentage || 0;
            const receiptPct = sector.receiptPercentage || 0;
            const diffPct = sector.dispatchReceiptDiffPercentage !== undefined 
                ? sector.dispatchReceiptDiffPercentage 
                : (dispatchPct - receiptPct);
            
            // Diff badge
            const val = parseFloat(diffPct) || 0;
            let className = 'diff-normal';
            if (val > 15) className = 'diff-critical';
            else if (val > 5) className = 'diff-warning';
            else if (val < -0.01) className = 'diff-anomaly';
            const formatted = (val > 0 ? '+' : '') + val.toFixed(2) + '%';

            // Check if this row is start of a span
            const spanInfo = spans.find(s => s.startIndex === idx);
            let col2Html = '';
            if (spanInfo) {
                col2Html = `<td rowspan="${spanInfo.count}" style="vertical-align: middle; font-weight: bold; background: #fff;">${spanInfo.val}</td>`;
            }

            let col3Html = '';
            if (mergeBlockToo) {
                if (spanInfo) {
                    col3Html = `<td rowspan="${spanInfo.count}" style="vertical-align: middle;">${sector.block || ''}</td>`;
                }
            } else {
                col3Html = `<td>${sector.block || ''}</td>`;
            }

            rowsHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    ${col2Html}
                    ${col3Html}
                    <td>${shopCount}</td>
                    <td>${sector.sectorName || ''}</td>
                    <td>${(sector.allocation || 0).toFixed(2)}</td>
                    <td>${(sector.dispatch || 0).toFixed(2)}</td>
                    <td>${dispatchPct.toFixed(2)}%</td>
                    <td>${receiptPct.toFixed(2)}%</td>
                    <td class="${className}">${formatted}</td>
                    <td>${bal.toFixed(2)}</td>
                    <td>${sector.transporter || ''}</td>
                    <td>${sector.mobileNumber || ''}</td>
                </tr>
            `;
        });

        // Replace inside html
        // Replace tbody content from <tbody> to <tr class="total-row">
        html = html.replace(
            /<tbody>[\s\S]*?<tr class="total-row">/,
            `<tbody>\n${rowsHtml}\n<tr class="total-row">`
        );

        return html;
    }

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    // 1. Test merging ONLY column 2 (प्रदाय केंद्र का नाम)
    const htmlCol2Only = buildMergedHtml(processed, false);
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1123, height: 794 });
    await page1.setContent(htmlCol2Only, { waitUntil: 'networkidle0' });
    const pdfBuf1 = await page1.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    const parsed1 = await new PDFParse(new Uint8Array(pdfBuf1)).getText();
    console.log('Col2 only merged -> Pages:', parsed1.total);
    await page1.screenshot({ path: 'tests/merge_col2_only.png' });
    await page1.close();

    // 2. Test merging BOTH column 2 and column 3
    const htmlBoth = buildMergedHtml(processed, true);
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1123, height: 794 });
    await page2.setContent(htmlBoth, { waitUntil: 'networkidle0' });
    const pdfBuf2 = await page2.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    const parsed2 = await new PDFParse(new Uint8Array(pdfBuf2)).getText();
    console.log('Both Col2 & Col3 merged -> Pages:', parsed2.total);
    await page2.screenshot({ path: 'tests/merge_both.png' });
    await page2.close();

    await browser.close();
}

testMerging().catch(console.error);
