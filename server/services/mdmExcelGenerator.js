const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class MDMExcelGenerator {
    getMonthNameHindi(month) {
        const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedResult, month, year) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('MDM Monthly Report');
        const monthName = this.getMonthNameHindi(month);

        // Title rows
        worksheet.addRow(['म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल']);
        worksheet.addRow([`MDM (मध्यान्ह भोजन) खाद्यान्न माह ${monthName} ${year} आवंटन / उठाव / रिसिविंग`]);
        worksheet.addRow([]);

        // Column header row — 17 data columns (MDM दुकान shop-count is retained)
        worksheet.addRow([
            'क्रमांक', 'प्रदाय केंद्र का नाम', 'विकासखंड', 'MDM दुकान', 'सेक्टर का नाम व सेक्टर क्रमांक',
            'गेहूं आवंटन (Qt.)', 'गेहूं उठाव (Qt.)', 'गेहूं उठाव %', 'गेहूं प्राप्ति (Qt.)', 'गेहूं प्राप्ति %',
            'फो.चावल आवंटन (Qt.)', 'फो.चावल उठाव (Qt.)', 'फो.चावल उठाव %', 'फो.चावल प्राप्ति (Qt.)', 'फो.चावल प्राप्ति %',
            'परिवहनकर्ता का नाम', 'मोबाइल नंबर'
        ]);
        worksheet.addRow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);

        const sectors = (processedResult && processedResult.sectors) ? processedResult.sectors : [];

        let totWA=0, totWD=0, totWR=0, totRA=0, totRD=0, totRR=0;
        let totalShops = 0;

        sectors.forEach((sector, i) => {
            let wA = sector.wheatAllotted !== undefined ? sector.wheatAllotted : 0;
            let wD = sector.wheatDispatched !== undefined ? sector.wheatDispatched : 0;
            let wR = sector.wheatReceived !== undefined ? sector.wheatReceived : 0;

            let rA = (sector.fortifiedRiceAllotted !== undefined ? sector.fortifiedRiceAllotted : sector.riceAllotted) || 0;
            let rD = (sector.fortifiedRiceDispatched !== undefined ? sector.fortifiedRiceDispatched : sector.riceDispatched) || 0;
            let rR = (sector.fortifiedRiceReceived !== undefined ? sector.fortifiedRiceReceived : sector.riceReceived) || 0;

            // Fallback to summing shops if sector-level metrics are missing
            if (wA === 0 && wD === 0 && rA === 0 && rD === 0 && (sector.shops && sector.shops.length > 0)) {
                (sector.shops || []).forEach(shop => {
                    wA += shop.wheatAllotted              || 0;
                    wD += shop.wheatDispatched             || 0;
                    wR += shop.wheatReceived               || 0;
                    rA += shop.fortifiedRiceAllotted       || shop.riceAllotted     || 0;
                    rD += shop.fortifiedRiceDispatched     || shop.riceDispatched   || 0;
                    rR += shop.fortifiedRiceReceived       || shop.riceReceived     || 0;
                });
            }
            totWA+=wA; totWD+=wD; totWR+=wR;
            totRA+=rA; totRD+=rD; totRR+=rR;

            const shopCount = sector.totalShops || (sector.shops ? sector.shops.length : 0);
            totalShops += shopCount;

            const pct = (a, b) => b > 0 ? parseFloat(((a / b) * 100).toFixed(2)) + '%' : '0.00%';

            worksheet.addRow([
                i + 1,
                'बैतूल',
                sector.block || '',
                shopCount,
                sector.sectorName || '',
                parseFloat(wA.toFixed(2)), parseFloat(wD.toFixed(2)), pct(wD, wA), parseFloat(wR.toFixed(2)), pct(wR, wA),
                parseFloat(rA.toFixed(2)), parseFloat(rD.toFixed(2)), pct(rD, rA), parseFloat(rR.toFixed(2)), pct(rR, rA),
                sector.transporter || '',
                sector.mobileNumber || ''
            ]);
        });

        // Totals row
        worksheet.addRow([]);
        const pct = (a, b) => b > 0 ? parseFloat(((a / b) * 100).toFixed(2)) + '%' : '0.00%';
        worksheet.addRow([
            '', 'योग', '', totalShops, '',
            parseFloat(totWA.toFixed(2)), parseFloat(totWD.toFixed(2)), pct(totWD, totWA), parseFloat(totWR.toFixed(2)), pct(totWR, totWA),
            parseFloat(totRA.toFixed(2)), parseFloat(totRD.toFixed(2)), pct(totRD, totRA), parseFloat(totRR.toFixed(2)), pct(totRR, totRA),
            '', ''
        ]);

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const monthNameStr = this.getMonthName(month);
        const filename = `MDM_Report_${monthNameStr}_${year}_${uuidv4().substring(0,8)}.xlsx`;
        const filepath = path.join(reportsDir, filename);
        await workbook.xlsx.writeFile(filepath);
        return { filename, filepath };
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

module.exports = MDMExcelGenerator;
