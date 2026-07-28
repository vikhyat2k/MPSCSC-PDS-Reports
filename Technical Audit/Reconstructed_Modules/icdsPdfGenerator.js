const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ICDSPDFGenerator {
    getMonthNameHindi(month) {
        const months = [
            'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
            'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
        ];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedData, month, year) {
        const monthName = this.getMonthNameHindi(month);
        
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
            <h2>मासिक आवंटन एवं परिवहन रिपोर्ट (ICDS) - ${monthName} ${year}</h2>
            <table>
                <thead>
                    <tr>
                        <th>स. क्र.</th>
                        <th>सेक्टर</th>
                        <th>ट्रांसपोर्टर</th>
                        <th>कुल आवंटन (Qt.)</th>
                        <th>कुल प्रेषण (Qt.)</th>
                        <th>POS प्राप्ति (Qt.)</th>
                        <th>प्रेषण %</th>
                        <th>प्राप्ति %</th>
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
                        <td>${(sector.allotted || 0).toFixed(2)}</td>
                        <td>${(sector.dispatched || 0).toFixed(2)}</td>
                        <td>${(sector.received || 0).toFixed(2)}</td>
                        <td>${(sector.dispatchPercentage || 0).toFixed(2)}%</td>
                        <td>${(sector.receiptPercentage || 0).toFixed(2)}%</td>
                    </tr>
                `;
            });

            const totals = processedData.totals || {};
            htmlContent += `
                <tr style="font-weight: bold;">
                    <td colspan="3">कुल योग</td>
                    <td>${(totals.totalAllotted || 0).toFixed(2)}</td>
                    <td>${(totals.totalDispatched || 0).toFixed(2)}</td>
                    <td>${(totals.totalReceived || 0).toFixed(2)}</td>
                    <td>${(totals.totalDispatchPct || 0).toFixed(2)}%</td>
                    <td></td>
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

        const filename = `ICDS_Report_${month}_${year}_${uuidv4().substring(0,8)}.pdf`;
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

module.exports = ICDSPDFGenerator;
