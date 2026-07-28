const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class PDFGenerator {
    getMonthNameHindi(month) {
        const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedData, month, year) {
        const monthName = this.getMonthNameHindi(month);
        const dateStr = new Date().toLocaleDateString('en-GB');
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        let htmlContent = `
        <html>
        <head>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 6mm 5mm 5mm 5mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    margin: 0;
                    padding: 0;
                    font-size: 12px;
                    -webkit-font-smoothing: antialiased;
                }
                /* Ensure numbers render correctly */
                td, th {
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0;
                }
                h2 {
                    text-align: center;
                    margin: 0 0 2px 0;
                    font-size: 15px;
                    font-weight: bold;
                }
                h3 {
                    text-align: center;
                    margin: 0 0 2px 0;
                    font-size: 12px;
                    font-weight: bold;
                }
                h4 {
                    text-align: center;
                    margin: 0 0 3px 0;
                    font-size: 11px;
                    font-weight: normal;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 3px;
                    table-layout: fixed;
                }
                th {
                    border: 1px solid #000;
                    padding: 3px 2px;
                    text-align: center;
                    font-size: 11px;
                    background-color: #ffffe0;
                    font-weight: bold;
                    word-wrap: break-word;
                    white-space: normal;
                    line-height: 1.3;
                    vertical-align: middle;
                }
                td {
                    border: 1px solid #000;
                    padding: 3px 2px;
                    text-align: center;
                    font-size: 12px;
                    word-wrap: break-word;
                    white-space: normal;
                    line-height: 1.3;
                    vertical-align: middle;
                }
                /* Column widths — total must = 100% */
                col.c1  { width: 3%;  }   /* क्रमांक */
                col.c2  { width: 8%;  }   /* प्रदाय केंद्र का नाम */
                col.c3  { width: 8%;  }   /* विकासखंड */
                col.c4  { width: 5%;  }   /* कुल दुकान */
                col.c5  { width: 14%; }   /* सेक्टर नाम */
                col.c6  { width: 8%;  }   /* मासिक आवंटन */
                col.c7  { width: 8%;  }   /* आवंटन उठाव */
                col.c8  { width: 6%;  }   /* उठाव % */
                col.c9  { width: 7%;  }   /* POS % */
                col.c10 { width: 7%;  }   /* शेष */
                col.c11 { width: 15%; }   /* परिवहनकर्ता */
                col.c12 { width: 11%; }   /* मोबाइल */
                tr:nth-child(even) td { background-color: #f9f9f9; }
                tr.total-row td { font-weight: bold; background-color: #fff3cd; }
                tr { page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <h2>म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल</h2>
            <h3>NFSA गेहूं, चावल, शक्कर, नमक माह ${monthName} ${year} रेगुलर/अतिरिक्त/पोर्टेबिलिटी , आवंटन उठाव</h3>
            <h4>दिनांक: ${dateStr} &nbsp;&nbsp; समय: ${timeStr}</h4>
            <table>
                <colgroup>
                    <col class="c1"><col class="c2"><col class="c3"><col class="c4">
                    <col class="c5"><col class="c6"><col class="c7"><col class="c8">
                    <col class="c9"><col class="c10"><col class="c11"><col class="c12">
                </colgroup>
                <thead>
                    <tr>
                        <th>क्र.&shy;मांक</th>
                        <th>प्रदाय केंद्र का नाम</th>
                        <th>विकास&shy;खंड</th>
                        <th>कुल उचित मूल्य की दुकान</th>
                        <th>सेक्टर का नाम व सेक्टर क्रमांक</th>
                        <th>मासिक आवंटन NFSA (Qt.)</th>
                        <th>आवंटन उठाव NFSA (Qt.)</th>
                        <th>उठाव का प्रति&shy;शत</th>
                        <th>POS मशीन में प्राप्ति (%)</th>
                        <th>आवंटन उठाव शेष (Qt.)</th>
                        <th>परिवहन&shy;कर्ता का नाम</th>
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
            // receiptPercentage is not pre-computed in totals — calculate it here
            const totalReceiptPct = (totals.totalAllocation || 0) > 0
                ? ((totals.totalPOSReceipt || 0) / totals.totalAllocation * 100).toFixed(2)
                : (totals.dispatchPercentage || 0).toFixed(2);
            htmlContent += `
                <tr class="total-row">
                    <td colspan="3">योग</td>
                    <td>${totalShops}</td>
                    <td></td>
                    <td>${(totals.totalAllocation || 0).toFixed(2)}</td>
                    <td>${(totals.totalDispatch || 0).toFixed(2)}</td>
                    <td>${(totals.dispatchPercentage || 0).toFixed(2)}%</td>
                    <td>${totalReceiptPct}%</td>
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
        const filename = `NFSA_Report_${monthNameStr}_${year}_${uuidv4().substring(0,8)}.pdf`;
        const filepath = path.join(reportsDir, filename);

        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            await page.pdf({
                path: filepath,
                format: 'A4',
                landscape: true,
                printBackground: true,
                preferCSSPageSize: true
            });
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

module.exports = PDFGenerator;
