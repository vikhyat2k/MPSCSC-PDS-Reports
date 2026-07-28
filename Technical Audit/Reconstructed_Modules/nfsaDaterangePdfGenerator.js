const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class NFSADaterangePdfGenerator {
    async generateReport(processedData, fromDate, toDate) {
        let htmlContent = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1, h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल</h1>
            <h2>परिवहन रिपोर्ट (NFSA Date Range) - ${fromDate} to ${toDate}</h2>
            <table>
                <thead>
                    <tr>
                        <th>स. क्र.</th>
                        <th>सेक्टर</th>
                        <th>ट्रांसपोर्टर</th>
                        <th>कुल प्रेषण (Qt.)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (processedData && processedData.sectors) {
            processedData.sectors.forEach((sector, i) => {
                htmlContent += `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${sector.sectorName || ''}</td>
                        <td>${sector.transporter || ''}</td>
                        <td>${(sector.dispatch || 0).toFixed(2)}</td>
                    </tr>
                `;
            });

            const totals = processedData.totals || {};
            htmlContent += `
                <tr style="font-weight: bold;">
                    <td colspan="3">कुल योग</td>
                    <td>${(totals.totalDispatch || 0).toFixed(2)}</td>
                </tr>
            `;
        }

        htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
        `;

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filename = `NFSADaterange_Report_${uuidv4().substring(0,8)}.pdf`;
        const filepath = path.join(reportsDir, filename);

        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            await page.pdf({
                path: filepath,
                format: 'A4',
                landscape: true,
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
            });
            
            await browser.close();
        } catch (error) {
            if (browser) await browser.close();
            throw error;
        }

        return { filename, filepath };
    }
}

module.exports = NFSADaterangePdfGenerator;
