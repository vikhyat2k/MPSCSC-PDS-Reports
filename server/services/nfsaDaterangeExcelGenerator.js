const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class NFSADaterangeExcelGenerator {
    getMonthNameHindi(month) {
        const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedResult, fromD, toD, month, year) {
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

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NFSA DateRange Monthly Report');
        
        worksheet.addRow(['म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल']);
        worksheet.addRow([`NFSA DateRange NFSA (DateRange) दिनांक ${fromD} से ${toD} रेगुलर/अतिरिक्त/पोर्टेबिलिटी , आवंटन उठाव`]);
        worksheet.addRow([]);

        worksheet.addRow([
            'क्रमांक', 'प्रदाय केंद्र का नाम', 'विकासखंड', 'कुल उचित मूल्य की दुकान', 
            'सेक्टर का नाम व सेक्टर क्रमांक', 'मासिक आवंटन NFSA DateRange (Qt.)', 'आवंटन उठाव NFSA DateRange (Qt.)', 
            'उठाव का प्रतिशत', 'POS मशीन में प्राप्ति (%)', 'आवंटन उठाव शेष (Qt.)', 
            'परिवहनकर्ता का नाम', 'मोबाइल नंबर'
        ]);

        if (processedResult && processedResult.sectors) {
            let totalShops = 0;
            processedResult.sectors.forEach((sector, i) => {
                const shopCount = sector.totalShops || (sector.shops ? sector.shops.length : 0);
                totalShops += shopCount;
                const bal = (sector.allocation || 0) - (sector.dispatch || 0);
                worksheet.addRow([
                    i + 1,
                    'बैतूल',
                    sector.block || '',
                    shopCount,
                    sector.sectorName,
                    parseFloat((sector.allocation || 0).toFixed(2)),
                    parseFloat((sector.dispatch || 0).toFixed(2)),
                    (sector.dispatchPercentage || 0).toFixed(2) + '%',
                    (sector.receiptPercentage || 0).toFixed(2) + '%',
                    parseFloat(bal.toFixed(2)),
                    sector.transporter || '',
                    sector.mobileNumber || ''
                ]);
            });

            worksheet.addRow([]);
            const totals = processedResult.totals || {};
            const tBal = (totals.totalAllocation || 0) - (totals.totalDispatch || 0);
            worksheet.addRow([
                '', 'योग', '', totalShops, '',
                parseFloat((totals.totalAllocation || 0).toFixed(2)),
                parseFloat((totals.totalDispatch || 0).toFixed(2)),
                (totals.dispatchPercentage || 0).toFixed(2) + '%',
                (totals.receiptPercentage || 0).toFixed(2) + '%',
                parseFloat(tBal.toFixed(2)),
                '', ''
            ]);
        }

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const monthNameStr = this.getMonthName(month);
        const filename = `NFSA DateRange_Report_${monthNameStr}_${year}_${uuidv4().substring(0,8)}.xlsx`;
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

module.exports = NFSADaterangeExcelGenerator;
