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
        const parseD = (d) => (d && d !== 'Start' && d !== 'End' && String(d).trim() !== '') ? String(d).trim().replace(/-/g, '/') : null;
        fromD = parseD(fromD);
        toD = parseD(toD);

        if (!month || !year) {
            if (fromD && fromD.includes('/')) {
                const parts = fromD.split('/');
                if (parts.length === 3) {
                    month = month || parseInt(parts[1], 10);
                    year = year || parseInt(parts[2], 10);
                }
            }
        }
        if (!month) month = new Date().getMonth() + 1;
        if (!year) year = new Date().getFullYear();

        if (!fromD) fromD = `01/${String(month).padStart(2, '0')}/${year}`;
        if (!toD) {
            const lastDay = new Date(year, month, 0).getDate();
            toD = `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        }

        const dateStr = new Date().toLocaleDateString('en-GB');
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        let htmlContent = `
        <html>
        <head>
            <style>
                @page { size: A4 landscape; margin: 6mm 5mm 5mm 5mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; font-size: 11px; -webkit-font-smoothing: antialiased; }
                /* Ensure numbers render correctly */
                td, th { font-variant-numeric: tabular-nums; letter-spacing: 0; }
                h2 { text-align: center; margin: 0 0 2px 0; font-size: 15px; font-weight: bold; }
                h3 { text-align: center; margin: 0 0 2px 0; font-size: 12px; font-weight: bold; }
                h4 { text-align: center; margin: 0 0 3px 0; font-size: 11px; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; margin-top: 3px; table-layout: fixed; }
                th { border: 1px solid #000; padding: 4px 3px; text-align: center; font-size: 11px; background-color: #ffffe0; font-weight: bold; word-wrap: break-word; white-space: normal; line-height: 1.3; vertical-align: middle; }
                td { border: 1px solid #000; padding: 4px 3px; text-align: center; font-size: 11px; word-wrap: break-word; white-space: normal; line-height: 1.3; vertical-align: middle; }
                /* Column widths — total must = 100% */
                col.c1 { width: 5%;  }   /* क्रमांक */
                col.c2 { width: 11%; }   /* प्रदाय केंद्र का नाम */
                col.c3 { width: 11%; }   /* विकासखंड */
                col.c4 { width: 9%;  }   /* कुल उचित मूल्य की दुकान */
                col.c5 { width: 22%; }   /* सेक्टर का नाम व सेक्टर क्रमांक */
                col.c6 { width: 14%; }   /* आवंटन उठाव (Qt.) */
                col.c7 { width: 16%; }   /* परिवहनकर्ता का नाम */
                col.c8 { width: 12%; }   /* मोबाइल नंबर */
                tr:nth-child(even) td { background-color: #f9f9f9; }
                tr.total-row td { font-weight: bold; background-color: #fff3cd; }
                tr { page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <h2>म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल</h2>
            <h3>NFSA दिनांक ${fromD} से ${toD} रेगुलर/अतिरिक्त/पोर्टेबिलिटी , आवंटन उठाव</h3>
            <h4>दिनांक: ${dateStr} &nbsp;&nbsp; समय: ${timeStr}</h4>
            <table>
                <colgroup>
                    <col class="c1"><col class="c2"><col class="c3"><col class="c4">
                    <col class="c5"><col class="c6"><col class="c7"><col class="c8">
                </colgroup>
                <thead>
                    <tr>
                        <th>क्रमांक</th>
                        <th>प्रदाय केंद्र का नाम</th>
                        <th>विकासखंड</th>
                        <th>कुल उचित मूल्य की दुकान</th>
                        <th>सेक्टर का नाम व सेक्टर क्रमांक</th>
                        <th>आवंटन उठाव (Qt.)</th>
                        <th>परिवहनकर्ता का नाम</th>
                        <th>मोबाइल नंबर</th>
                    </tr>
                    <tr>
                        <th>1</th>
                        <th>2</th>
                        <th>3</th>
                        <th>4</th>
                        <th>5</th>
                        <th>6</th>
                        <th>7</th>
                        <th>8</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (processedData && processedData.sectors) {
            let totalShops = 0;
            processedData.sectors.forEach((sector, i) => {
                const shopCount = sector.totalShops || (sector.shops ? sector.shops.length : 0);
                totalShops += shopCount;
                htmlContent += `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${sector.block || 'बैतूल'}</td>
                        <td>${sector.block || ''}</td>
                        <td>${shopCount}</td>
                        <td>${sector.sectorName || ''}</td>
                        <td>${(sector.dispatch || 0).toFixed(2)}</td>
                        <td>${sector.transporter || ''}</td>
                        <td>${sector.mobileNumber || ''}</td>
                    </tr>
                `;
            });

            const totals = processedData.totals || {};
            htmlContent += `
                <tr class="total-row">
                    <td colspan="3">योग</td>
                    <td>${totalShops}</td>
                    <td></td>
                    <td>${(totals.totalDispatch || 0).toFixed(2)}</td>
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
