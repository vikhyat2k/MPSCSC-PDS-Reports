const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ICDSPDFGenerator {
    getMonthNameHindi(month) {
        const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedData, month, year) {
        const monthName = this.getMonthNameHindi(month);
        const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        // Aggregate per-grain totals from all shops across all sectors
        let totWheatAllot = 0, totWheatDisp = 0, totWheatRec = 0;
        let totRiceAllot  = 0, totRiceDisp  = 0, totRiceRec  = 0;
        let totSaltAllot  = 0, totSaltDisp  = 0, totSaltRec  = 0;

        const sectors = (processedData && processedData.sectors) ? processedData.sectors : [];

        // Per-sector grain aggregation — use sector-level totals directly from data processor
        const sectorGrains = sectors.map(s => {
            let wA = s.wheatAllotted !== undefined ? s.wheatAllotted : 0;
            let wD = s.wheatDispatched !== undefined ? s.wheatDispatched : 0;
            let wR = s.wheatReceived !== undefined ? s.wheatReceived : 0;

            let rA = s.riceAllotted !== undefined ? s.riceAllotted : 0;
            let rD = s.riceDispatched !== undefined ? s.riceDispatched : 0;
            let rR = s.riceReceived !== undefined ? s.riceReceived : 0;

            let sA = s.fsaltAllotted !== undefined ? s.fsaltAllotted : 0;
            let sD = s.fsaltDispatched !== undefined ? s.fsaltDispatched : 0;
            let sR = s.fsaltReceived !== undefined ? s.fsaltReceived : 0;

            // Fallback to summing shops if sector-level metrics are missing
            if (wA === 0 && wD === 0 && rA === 0 && rD === 0 && (s.shops && s.shops.length > 0)) {
                (s.shops || []).forEach(shop => {
                    wA += shop.wheatAllotted    || 0;
                    wD += shop.wheatDispatched  || 0;
                    wR += shop.wheatReceived    || 0;
                    rA += shop.riceAllotted     || 0;
                    rD += shop.riceDispatched   || 0;
                    rR += shop.riceReceived     || 0;
                    sA += shop.fsaltAllotted    || 0;
                    sD += shop.fsaltDispatched  || 0;
                    sR += shop.fsaltReceived    || 0;
                });
            }

            totWheatAllot += wA; totWheatDisp += wD; totWheatRec += wR;
            totRiceAllot  += rA; totRiceDisp  += rD; totRiceRec  += rR;
            totSaltAllot  += sA; totSaltDisp  += sD; totSaltRec  += sR;
            return { ...s, wA, wD, wR, rA, rD, rR, sA, sD, sR };
        });

        const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0.0%';
        const fmt = v => (v || 0).toFixed(2);

        // ICDS has 22 data columns total (added shop-count)
        let rows = '';
        let totalShops = 0;
        sectorGrains.forEach((s, i) => {
            const shopCount = s.totalShops || (s.shops ? s.shops.length : 0);
            totalShops += shopCount;
            rows += `
                <tr>
                    <td class="nowrap">${i + 1}</td>
                    <td>${s.block || 'बैतूल'}</td>
                    <td>${s.block || ''}</td>
                    <td class="nowrap">${shopCount}</td>
                    <td>${s.sectorName || ''}</td>
                    <td class="nowrap">${fmt(s.wA)}</td>
                    <td class="nowrap">${fmt(s.wD)}</td>
                    <td class="nowrap">${pct(s.wD, s.wA)}</td>
                    <td class="nowrap">${fmt(s.wR)}</td>
                    <td class="nowrap">${pct(s.wR, s.wA)}</td>
                    <td class="nowrap">${fmt(s.rA)}</td>
                    <td class="nowrap">${fmt(s.rD)}</td>
                    <td class="nowrap">${pct(s.rD, s.rA)}</td>
                    <td class="nowrap">${fmt(s.rR)}</td>
                    <td class="nowrap">${pct(s.rR, s.rA)}</td>
                    <td class="nowrap">${fmt(s.sA)}</td>
                    <td class="nowrap">${fmt(s.sD)}</td>
                    <td class="nowrap">${pct(s.sD, s.sA)}</td>
                    <td class="nowrap">${fmt(s.sR)}</td>
                    <td class="nowrap">${pct(s.sR, s.sA)}</td>
                    <td>${s.transporter || ''}</td>
                    <td class="nowrap">${s.mobileNumber || ''}</td>
                </tr>`;
        });

        // Totals row — 22 data columns, colspan="3" covers क्र.सं.+प्रदाय+विकासखंड
        rows += `
            <tr style="font-weight:bold; background-color:#fff3cd;">
                <td colspan="3">योग</td>
                <td class="nowrap">${totalShops}</td>
                <td></td>
                <td class="nowrap">${fmt(totWheatAllot)}</td>
                <td class="nowrap">${fmt(totWheatDisp)}</td>
                <td class="nowrap">${pct(totWheatDisp, totWheatAllot)}</td>
                <td class="nowrap">${fmt(totWheatRec)}</td>
                <td class="nowrap">${pct(totWheatRec, totWheatAllot)}</td>
                <td class="nowrap">${fmt(totRiceAllot)}</td>
                <td class="nowrap">${fmt(totRiceDisp)}</td>
                <td class="nowrap">${pct(totRiceDisp, totRiceAllot)}</td>
                <td class="nowrap">${fmt(totRiceRec)}</td>
                <td class="nowrap">${pct(totRiceRec, totRiceAllot)}</td>
                <td class="nowrap">${fmt(totSaltAllot)}</td>
                <td class="nowrap">${fmt(totSaltDisp)}</td>
                <td class="nowrap">${pct(totSaltDisp, totSaltAllot)}</td>
                <td class="nowrap">${fmt(totSaltRec)}</td>
                <td class="nowrap">${pct(totSaltRec, totSaltAllot)}</td>
                <td colspan="2"></td>
            </tr>`;

        const htmlContent = `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page { size: A4 landscape; margin: 5mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; font-size: 10.5px; -webkit-font-smoothing: antialiased; }
                /* Ensure numbers render correctly */
                td, th {
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0;
                }
                h2 { text-align: center; margin: 0 0 2px 0; font-size: 14px; font-weight: bold; }
                h3 { text-align: center; margin: 0 0 2px 0; font-size: 12px; font-weight: bold; }
                h4 { text-align: center; margin: 0 0 3px 0; font-size: 10px; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; margin-top: 4px; table-layout: fixed; }
                th { border: 1px solid #000; padding: 2px 2px; text-align: center; font-size: 9px;
                     background-color: #ffffe0; font-weight: bold; word-wrap: break-word;
                     white-space: normal; line-height: 1.2; vertical-align: middle; }
                td { border: 1px solid #000; padding: 2px 2px; text-align: center; font-size: 9px;
                     word-wrap: break-word; white-space: normal; vertical-align: middle; }
                td.nowrap, th.nowrap { white-space: nowrap; }
                .group-header { background-color: #e8f4f8; }
                tr:nth-child(even) td { background-color: #f9f9f9; }
                tr { page-break-inside: avoid; }
                col.c1  { width: 2.2%; }  /* क्र.सं. */
                col.c2  { width: 5.5%; }  /* प्रदाय केंद्र */
                col.c3  { width: 5.5%; }  /* विकासखंड */
                col.c_shop { width: 3.5%; } /* ICDS दुकान */
                col.c4  { width: 11%; }   /* सेक्टर */
                col.c5  { width: 4.5%; }  /* wheat allot */
                col.c6  { width: 4.5%; }  /* wheat disp */
                col.c7  { width: 3.5%; }  /* wheat disp% */
                col.c8  { width: 4.5%; }  /* wheat rec Qt */
                col.c9  { width: 3.5%; }  /* wheat rec% */
                col.c10 { width: 4.5%; }  /* rice allot */
                col.c11 { width: 4.5%; }  /* rice disp */
                col.c12 { width: 3.5%; }  /* rice disp% */
                col.c13 { width: 4.5%; }  /* rice rec Qt */
                col.c14 { width: 3.5%; }  /* rice rec% */
                col.c15 { width: 4.5%; }  /* salt allot */
                col.c16 { width: 4.5%; }  /* salt disp */
                col.c17 { width: 3.5%; }  /* salt disp% */
                col.c18 { width: 4.5%; }  /* salt rec Qt */
                col.c19 { width: 3.5%; }  /* salt rec% */
                col.c20 { width: 8%; }    /* transporter */
                col.c21 { width: 6%; }    /* mobile */
            </style>
        </head>
        <body>
            <h2>म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल</h2>
            <h3>ICDS (आंगनवाड़ी) खाद्यान्न माह ${monthName} ${year} आवंटन / उठाव / रिसिविंग</h3>
            <h4>दिनांक: ${dateStr} समय: ${timeStr}</h4>
            <table>
                <colgroup>
                    <col class="c1"><col class="c2"><col class="c3"><col class="c_shop"><col class="c4">
                    <col class="c5"><col class="c6"><col class="c7"><col class="c8"><col class="c9">
                    <col class="c10"><col class="c11"><col class="c12"><col class="c13"><col class="c14">
                    <col class="c15"><col class="c16"><col class="c17"><col class="c18"><col class="c19">
                    <col class="c20"><col class="c21">
                </colgroup>
                <thead>
                    <tr>
                        <th rowspan="2">क्र.सं.</th>
                        <th rowspan="2">प्रदाय केंद्र का नाम</th>
                        <th rowspan="2">विकासखंड</th>
                        <th rowspan="2">ICDS दुकान</th>
                        <th rowspan="2">सेक्टर का नाम व सेक्टर क्रमांक</th>
                        <th colspan="5" class="group-header">गेहूं (Wheat)</th>
                        <th colspan="5" class="group-header">चावल (Rice)</th>
                        <th colspan="5" class="group-header">डबल फो. नमक (Salt)</th>
                        <th rowspan="2">परिवहन&shy;कर्ता का नाम</th>
                        <th rowspan="2">मोबाइल नंबर</th>
                    </tr>
                    <tr>
                        <th>आवंटन (Qt.)</th><th>उठाव (Qt.)</th><th>उठाव %</th><th>प्राप्ति (Qt.)</th><th>प्राप्ति %</th>
                        <th>आवंटन (Qt.)</th><th>उठाव (Qt.)</th><th>उठाव %</th><th>प्राप्ति (Qt.)</th><th>प्राप्ति %</th>
                        <th>आवंटन (Qt.)</th><th>उठाव (Qt.)</th><th>उठाव %</th><th>प्राप्ति (Qt.)</th><th>प्राप्ति %</th>
                    </tr>
                    <tr>
                        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
                        <th>6</th><th>7</th><th>8</th><th>9</th><th>10</th>
                        <th>11</th><th>12</th><th>13</th><th>14</th><th>15</th>
                        <th>16</th><th>17</th><th>18</th><th>19</th><th>20</th>
                        <th>21</th><th>22</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </body>
        </html>`;

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const monthNameStr = this.getMonthName(month);
        const filename = `ICDS_Report_${monthNameStr}_${year}_${uuidv4().substring(0,8)}.pdf`;
        const filepath = path.join(reportsDir, filename);

        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            await page.pdf({ path: filepath, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
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

module.exports = ICDSPDFGenerator;
