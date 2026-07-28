const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class WelfareExcelGenerator {
    getMonthNameHindi(month) {
        const months = [
            'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
            'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
        ];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedResult, month, year) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Welfare Monthly Report');

        const monthName = this.getMonthNameHindi(month);
        
        // Header
        worksheet.addRow(['म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल']);
        worksheet.addRow([`मासिक आवंटन एवं परिवहन रिपोर्ट (Welfare) - ${monthName} ${year}`]);
        worksheet.addRow([]);

        // Table Headers
        worksheet.addRow([
            'स. क्र.', 'सेक्टर', 'ट्रांसपोर्टर', 'कुल आवंटन (Qt.)', 'कुल प्रेषण (Qt.)', 
            'POS प्राप्ति (Qt.)', 'प्रेषण %', 'प्राप्ति %'
        ]);

        if (processedResult && processedResult.sectors) {
            processedResult.sectors.forEach((sector, i) => {
                worksheet.addRow([
                    i + 1,
                    sector.sectorName,
                    sector.transporter,
                    sector.allotted.toFixed(2),
                    sector.dispatched.toFixed(2),
                    sector.received.toFixed(2),
                    sector.dispatchPercentage.toFixed(2) + '%',
                    sector.receiptPercentage.toFixed(2) + '%'
                ]);
            });

            worksheet.addRow([]);
            const totals = processedResult.totals || {};
            worksheet.addRow([
                '', 'कुल योग', '',
                (totals.totalAllotted || 0).toFixed(2),
                (totals.totalDispatched || 0).toFixed(2),
                (totals.totalReceived || 0).toFixed(2),
                (totals.totalDispatchPct || 0).toFixed(2) + '%',
                ''
            ]);
        }

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filename = `Welfare_Report_${month}_${year}_${uuidv4().substring(0,8)}.xlsx`;
        const filepath = path.join(reportsDir, filename);

        await workbook.xlsx.writeFile(filepath);

        return { filename, filepath };
    }
}

module.exports = WelfareExcelGenerator;
