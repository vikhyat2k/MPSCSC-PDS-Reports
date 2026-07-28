const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class NFSADaterangeExcelGenerator {
    async generateReport(processedResult, fromDate, toDate) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NFSA Daterange Report');

        // Header
        worksheet.addRow(['म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल']);
        worksheet.addRow([`परिवहन रिपोर्ट (NFSA Date Range) - ${fromDate} to ${toDate}`]);
        worksheet.addRow([]);

        // Table Headers
        worksheet.addRow([
            'स. क्र.', 'सेक्टर', 'ट्रांसपोर्टर', 'कुल प्रेषण (Qt.)'
        ]);

        if (processedResult && processedResult.sectors) {
            processedResult.sectors.forEach((sector, i) => {
                worksheet.addRow([
                    i + 1,
                    sector.sectorName,
                    sector.transporter,
                    sector.dispatch.toFixed(2)
                ]);
            });

            worksheet.addRow([]);
            const totals = processedResult.totals || {};
            worksheet.addRow([
                '', 'कुल योग', '',
                (totals.totalDispatch || 0).toFixed(2)
            ]);
        }

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filename = `NFSADaterange_Report_${uuidv4().substring(0,8)}.xlsx`;
        const filepath = path.join(reportsDir, filename);

        await workbook.xlsx.writeFile(filepath);

        return { filename, filepath };
    }
}

module.exports = NFSADaterangeExcelGenerator;
