const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ExcelGenerator {
    getMonthNameHindi(month) {
        const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
        return months[parseInt(month) - 1] || month;
    }

    async generateReport(processedResult, month, year) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NFSA Monthly Report');
        const monthName = this.getMonthNameHindi(month);
        
        worksheet.addRow(['म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल']);
        worksheet.addRow([`NFSA गेहूं, चावल, शक्कर, नमक माह ${monthName} ${year} रेगुलर/अतिरिक्त/पोर्टेबिलिटी , आवंटन उठाव`]);
        worksheet.addRow([]);

        worksheet.addRow([
            'क्रमांक', 'प्रदाय केंद्र का नाम', 'विकासखंड', 'कुल उचित मूल्य की दुकान', 
            'सेक्टर का नाम व सेक्टर क्रमांक', 'मासिक आवंटन NFSA (Qt.)', 'आवंटन उठाव NFSA (Qt.)', 
            'उठाव का प्रतिशत', 'POS मशीन में प्राप्ति (%)', 'प्रेषित एव प्राप्त मात्रा का अंतर प्रतिशत', 'आवंटन उठाव शेष (Qt.)', 
            'परिवहनकर्ता का नाम', 'मोबाइल नंबर'
        ]);

        // Helper to determine color coding style and formatted display for Excel diff percentage
        const getExcelDiffStyle = (diff) => {
            const val = parseFloat(diff) || 0;
            if (val > 15) {
                return {
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, // Soft Coral Red
                    font: { color: { argb: 'FF991B1B' }, bold: true, name: 'Calibri', size: 10 },
                    formatted: (val > 0 ? '+' : '') + val.toFixed(2) + '%'
                };
            } else if (val > 5) {
                return {
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }, // Soft Amber
                    font: { color: { argb: 'FF92400E' }, bold: true, name: 'Calibri', size: 10 },
                    formatted: (val > 0 ? '+' : '') + val.toFixed(2) + '%'
                };
            } else if (val < -0.01) {
                return {
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }, // Soft Purple
                    font: { color: { argb: 'FF6B21A8' }, bold: true, name: 'Calibri', size: 10 },
                    formatted: val.toFixed(2) + '%'
                };
            } else {
                return {
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, // Soft Emerald Green
                    font: { color: { argb: 'FF065F46' }, bold: false, name: 'Calibri', size: 10 },
                    formatted: (val > 0 ? '+' : '') + val.toFixed(2) + '%'
                };
            }
        };

        if (processedResult && processedResult.sectors) {
            let totalShops = 0;
            processedResult.sectors.forEach((sector, i) => {
                const shopCount = sector.totalShops || (sector.shops ? sector.shops.length : 0);
                totalShops += shopCount;
                const bal = (sector.allocation || 0) - (sector.dispatch || 0);
                const dispatchPct = sector.dispatchPercentage || 0;
                const receiptPct = sector.receiptPercentage || 0;
                const diffPct = sector.dispatchReceiptDiffPercentage !== undefined
                    ? sector.dispatchReceiptDiffPercentage
                    : (dispatchPct - receiptPct);
                const diffStyle = getExcelDiffStyle(diffPct);
                const row = worksheet.addRow([
                    i + 1,
                    'बैतूल',
                    sector.block || '',
                    shopCount,
                    sector.sectorName,
                    parseFloat((sector.allocation || 0).toFixed(2)),
                    parseFloat((sector.dispatch || 0).toFixed(2)),
                    (dispatchPct || 0).toFixed(2) + '%',
                    (receiptPct || 0).toFixed(2) + '%',
                    diffStyle.formatted,
                    parseFloat(bal.toFixed(2)),
                    sector.transporter || '',
                    sector.mobileNumber || ''
                ]);

                // Apply color coding fill and font to Column 10 (प्रेषित एव प्राप्त मात्रा का अंतर प्रतिशत)
                const diffCell = row.getCell(10);
                diffCell.fill = diffStyle.fill;
                diffCell.font = diffStyle.font;
                diffCell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            worksheet.addRow([]);
            const totals = processedResult.totals || {};
            const tBal = (totals.totalAllocation || 0) - (totals.totalDispatch || 0);
            const totalDispatchPct = totals.dispatchPercentage || 0;
            const totalReceiptPct = totals.receiptPercentage !== undefined
                ? totals.receiptPercentage
                : ((totals.totalAllocation || 0) > 0 ? ((totals.totalPOSReceipt || 0) / totals.totalAllocation * 100) : 0);
            const totalDiffPct = totals.dispatchReceiptDiffPercentage !== undefined
                ? totals.dispatchReceiptDiffPercentage
                : (parseFloat(totalDispatchPct) - parseFloat(totalReceiptPct));
            const totalDiffStyle = getExcelDiffStyle(totalDiffPct);

            const totalRow = worksheet.addRow([
                '', 'योग', '', totalShops, '',
                parseFloat((totals.totalAllocation || 0).toFixed(2)),
                parseFloat((totals.totalDispatch || 0).toFixed(2)),
                (parseFloat(totalDispatchPct) || 0).toFixed(2) + '%',
                (parseFloat(totalReceiptPct) || 0).toFixed(2) + '%',
                totalDiffStyle.formatted,
                parseFloat(tBal.toFixed(2)),
                '', ''
            ]);

            const totalDiffCell = totalRow.getCell(10);
            totalDiffCell.fill = totalDiffStyle.fill;
            totalDiffCell.font = totalDiffStyle.font;
            totalDiffCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Compute Executive Analytics for Excel Footnote
            const now = new Date();
            const rMonth = parseInt(month, 10) || (now.getMonth() + 1);
            const rYear = parseInt(year, 10) || now.getFullYear();
            const daysInMonth = new Date(rYear, rMonth, 0).getDate();
            let remainingDays = 1;
            if (now.getFullYear() === rYear && (now.getMonth() + 1) === rMonth) {
                remainingDays = Math.max(1, daysInMonth - now.getDate());
            } else if (new Date(rYear, rMonth - 1, 1) > now) {
                remainingDays = daysInMonth;
            }

            const requiredDailyRate = (tBal > 0 && remainingDays > 0) ? (tBal / remainingDays).toFixed(2) : '0.00';
            const inTransitQty = Math.max(0, (totals.totalDispatch || 0) - (totals.totalPOSReceipt || 0));
            const inTransitPct = (totals.totalAllocation || 0) > 0 ? ((inTransitQty / totals.totalAllocation) * 100).toFixed(2) : '0.00';

            let sectorsInSync = 0;
            let sectorsModerateLag = 0;
            let sectorsHighLag = 0;
            let sectorsCompleted = 0;

            const sectorList = processedResult.sectors || [];
            sectorList.forEach(s => {
                const dPct = s.dispatchPercentage || 0;
                const rPct = s.receiptPercentage || 0;
                const diff = s.dispatchReceiptDiffPercentage !== undefined ? s.dispatchReceiptDiffPercentage : (dPct - rPct);
                if (dPct >= 100) sectorsCompleted++;
                if (diff > 5) sectorsHighLag++;
                else if (diff >= 0) sectorsInSync++;
            });

            const activeSectors = sectorList.filter(s => (s.allocation || 0) > 0);
            const sortedByDisp = [...activeSectors].sort((a, b) => (b.dispatchPercentage || 0) - (a.dispatchPercentage || 0));
            const topSector = sortedByDisp[0];
            const bottomSector = sortedByDisp[sortedByDisp.length - 1];

            worksheet.addRow([]);
            
            // Header for Analytical Summary
            const fnHeaderRow = worksheet.addRow(['📊 विश्लेषणात्मक सारांश (Analytical Executive Summary)']);
            fnHeaderRow.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };

            // 3 Rows of Analytical Notes
            const fnRow1 = worksheet.addRow([
                '📈 उठाव प्रगति एवं दैनिक लक्ष्य दर:',
                `• कुल उठाव: ${(parseFloat(totalDispatchPct) || 0).toFixed(2)}% (शेष: ${tBal.toFixed(2)} Qt.)`,
                `• 100% लक्ष्य हेतु आवश्यक दैनिक दर: ${requiredDailyRate} Qt./दिन (शेष दिन: ${remainingDays})`,
                `• पूर्ण उठाव सेक्टर: ${sectorsCompleted}/${sectorList.length} | कुल उचित मूल्य दुकानें: ${totalShops}`
            ]);
            fnRow1.font = { size: 10, color: { argb: 'FF334155' } };

            const fnRow2 = worksheet.addRow([
                '🚚 मार्गस्थ एवं POS प्रविष्टि स्थिति:',
                `• मार्गस्थ / प्रविष्टि शेष: ${inTransitQty.toFixed(2)} Qt. (${inTransitPct}%)`,
                `• POS मशीन प्राप्ति: ${(parseFloat(totalReceiptPct) || 0).toFixed(2)}% | इन-सिंक (0-5%): ${sectorsInSync}/${sectorList.length}`,
                `• उच्च विलंब (>5% Lag): ${sectorsHighLag} सेक्टर ${sectorsHighLag > 0 ? '(समीक्षा अपेक्षित)' : '(संतोषजनक)'}`
            ]);
            fnRow2.font = { size: 10, color: { argb: 'FF334155' } };

            const fnRow3 = worksheet.addRow([
                '🎯 सेक्टर समीक्षा एवं निगरानी अलर्ट:',
                `• सर्वोत्तम उठाव: ${topSector ? `${topSector.sectorName} (${(topSector.dispatchPercentage || 0).toFixed(2)}%)` : 'N/A'}`,
                `• न्यूनतम उठाव: ${bottomSector ? `${bottomSector.sectorName} (${(bottomSector.dispatchPercentage || 0).toFixed(2)}%, शेष ${Math.max(0, (bottomSector.allocation || 0) - (bottomSector.dispatch || 0)).toFixed(2)} Qt.)` : 'N/A'}`,
                `• परिवहनकर्ता निगरानी: ${bottomSector && bottomSector.transporter ? bottomSector.transporter : 'N/A'}`
            ]);
            fnRow3.font = { size: 10, color: { argb: 'FF334155' } };
        }

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const monthNameStr = this.getMonthName(month);
        const filename = `NFSA_Report_${monthNameStr}_${year}_${uuidv4().substring(0,8)}.xlsx`;
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

module.exports = ExcelGenerator;
