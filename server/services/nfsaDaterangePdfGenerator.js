const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class NFSADaterangePdfGenerator {
    getMonthNameHindi(month) {
        const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedData, fromD, toD, month, year) {
        // Fallback/Parsing if not provided
        if (!month || !year) {
            if (fromD && fromD.includes('/')) {
                const parts = fromD.split('/');
                if (parts.length === 3) {
                    month = month || parseInt(parts[1]);
                    year = year || parseInt(parts[2]);
                }
            }
        }
        if (!month) month = new Date().getMonth() + 1;
        if (!year) year = new Date().getFullYear();

        const dateStr = new Date().toLocaleDateString('en-GB');
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        let htmlContent = `
        <html>
        <head>
            <style>
                @page { size: A4 landscape; margin: 5mm; }
                body { font-family: Arial, Helvetica, sans-serif; padding: 2px; font-size: 11px; -webkit-font-smoothing: antialiased; }
                /* Ensure numbers render correctly */
                td, th { font-variant-numeric: tabular-nums; letter-spacing: 0; border: 1px solid #000; padding: 3px; text-align: center; font-size: 11px; }
                h2 { text-align: center; margin: 3px 0; font-size: 15px; }
                h3 { text-align: center; margin: 3px 0; font-size: 13px; }
                h4 { text-align: center; margin: 3px 0; font-size: 11px; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: auto; }
                th { background-color: #ffffe0; font-weight: bold; }
                tr { page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <h2>म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल</h2>
            <h3>NFSA DateRange NFSA (DateRange) दिनांक ${fromD} से ${toD} रेगुलर/अतिरिक्त/पोर्टेबिलिटी , आवंटन उठाव</h3>
            <h4 style="text-align: center; margin: 5px 0; font-weight: normal;">दिनांक: ${dateStr} समय: ${timeStr}</h4>
            <table>
                <thead>
                    <tr>
                        <th>क्रमांक</th>
                        <th>प्रदाय केंद्र का नाम</th>
                        <th>विकासखंड</th>
                        <th>कुल उचित मूल्य की दुकान</th>
                        <th>सेक्टर का नाम व सेक्टर क्रमांक</th>
                        <th>मासिक आवंटन NFSA DateRange (Qt.)</th>
                        <th>आवंटन उठाव NFSA DateRange (Qt.)</th>
                        <th>उठाव का प्रतिशत</th>
                        <th>POS मशीन में प्राप्ति (%)</th>
                        <th>आवंटन उठाव शेष (Qt.)</th>
                        <th>परिवहनकर्ता का नाम</th>
                        <th>मोबाइल नंबर</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (processedData && processedData.sectors) {
            let totalShops = 0;
            processedData.sectors.forEach((sector, i) => {
                const shopCount = sector.totalShops || (sector.shops ? sector.shops.length : 0);
                totalShops += shopCount;
                const bal = (sector.allocation || 0) - (sector.dispatch || 0);
                htmlContent += `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${sector.block || 'बैतूल'}</td>
                        <td>${sector.block || ''}</td>
                        <td>${shopCount}</td>
                        <td>${sector.sectorName || ''}</td>
                        <td>${(sector.allocation || 0).toFixed(2)}</td>
                        <td>${(sector.dispatch || 0).toFixed(2)}</td>
                        <td>${(sector.dispatchPercentage || 0).toFixed(2)}%</td>
                        <td>${(sector.receiptPercentage || 0).toFixed(2)}%</td>
                        <td>${bal.toFixed(2)}</td>
                        <td>${sector.transporter || ''}</td>
                        <td>${sector.mobileNumber || ''}</td>
                    </tr>
                `;
            });

            const totals = processedData.totals || {};
            const tBal = (totals.totalAllocation || 0) - (totals.totalDispatch || 0);
            htmlContent += `
                <tr style="font-weight: bold;">
                    <td colspan="3">योग</td>
                    <td>${totalShops}</td>
                    <td></td>
                    <td>${(totals.totalAllocation || 0).toFixed(2)}</td>
                    <td>${(totals.totalDispatch || 0).toFixed(2)}</td>
                    <td>${(totals.dispatchPercentage || 0).toFixed(2)}%</td>
                    <td>${(totals.receiptPercentage || 0).toFixed(2) || '0.00'}%</td>
                    <td>${tBal.toFixed(2)}</td>
                    <td colspan="2"></td>
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

        const monthNameStr = this.getMonthName(month);
        const filename = `NFSA DateRange_Report_${monthNameStr}_${year}_${uuidv4().substring(0,8)}.pdf`;
        const filepath = path.join(reportsDir, filename);

        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            await page.pdf({ path: filepath, format: 'A4', landscape: true, printBackground: true });
            await browser.close();
            return { filename, filepath };
        } catch (error) {
            await browser.close().catch(() => {});
            throw error;
        }
    }

    getMonthName(monthInput) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        if (!monthInput) return 'Month';
        const m = parseInt(monthInput, 10);
        if (!isNaN(m) && m >= 1 && m <= 12) return months[m - 1];
        const str = String(monthInput).trim();
        const found = months.find(name => name.toLowerCase() === str.toLowerCase() || name.toLowerCase().startsWith(str.toLowerCase()));
        return found || str;
    }
}

module.exports = NFSADaterangePdfGenerator;
