const puppeteer = require('puppeteer');
const path = require('path');

async function testRicePrint() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });

        // Open Rice Print modal
        await page.evaluate(() => {
            const list = SupervState.riceInspections || [];
            if (list.length > 0) {
                viewRiceInspectionPrint(list[0].id);
            } else {
                printCurrentRiceSheet();
            }
        });

        await new Promise(r => setTimeout(r, 600));

        // Evaluate print content
        const printInfo = await page.evaluate(() => {
            const area = document.getElementById('printableRiceSheetArea');
            if (!area) return null;

            const table = area.querySelector('.official-table');
            const ths = table ? Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim()) : [];
            const sigs = Array.from(area.querySelectorAll('.sig-box, .signatures-section > div')).map(s => s.innerText.trim());
            const footerNote = area.querySelector('div[style*="border-top"]')?.innerText || '';

            return {
                hasArea: true,
                columnCount: ths.length,
                signatures: sigs,
                footerNote
            };
        });

        console.log('Rice Print Information:', JSON.stringify(printInfo, null, 2));

        // Generate PDF in A4 Landscape
        const pdfPath = path.join(__dirname, 'rice_inspection_landscape.pdf');
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: { top: '5mm', bottom: '5mm', left: '6mm', right: '6mm' }
        });
        console.log('✅ Generated A4 Landscape PDF successfully at:', pdfPath);

    } finally {
        await browser.close();
    }
}

testRicePrint().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
