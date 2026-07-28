const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');

class BalancesReportGenerator {
    getCommodities(scheme) {
        if (scheme === 'nfsa') return ['wheat', 'rice', 'sugar', 'salt'];
        if (scheme === 'welfare') return ['wheat', 'rice'];
        return ['wheat', 'rice']; // MDM, ICDS
    }

    getSchemeLabelHindi(scheme) {
        const labels = {
            'nfsa': 'योजना: NFSA (मासिक)',
            'mdm': 'योजना: MDM',
            'icds': 'योजना: ICDS',
            'welfare': 'योजना: कल्याणकारी संस्था'
        };
        return labels[scheme] || scheme;
    }

    getMonthNameHindi(month) {
        const months = [
            'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
            'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
        ];
        return months[parseInt(month) - 1] || month;
    }

    // Helper to get Hindi translation for commodity
    getCommodityHindi(comm) {
        const mapping = {
            'wheat': 'गेहूं (Wheat)',
            'rice': 'चावल (Rice)',
            'sugar': 'शक्कर (Sugar)',
            'salt': 'नमक (Salt)'
        };
        return mapping[comm] || comm;
    }

    // Helper to group shops
    groupShops(processedResult, options) {
        let groups = {};
        
        if (!processedResult || !processedResult.sectors) return [];

        processedResult.sectors.forEach(sector => {
            if (options.type === 'issueCenter' || options.type === 'depot' || options.type === 'individual_depot') {
                sector.shops.forEach(shop => {
                    const depot = shop.issuePoint ? shop.issuePoint.trim() : sector.block;
                    if (options.type === 'individual_depot' && options.value && depot !== options.value) return;
                    
                    if (!groups[depot]) groups[depot] = { label: `प्रदाय केंद्र: ${depot}`, shops: [] };
                    groups[depot].shops.push(shop);
                });
            } else if (!options.type || options.type === 'sector' || options.type === 'transporter' || options.type === 'individual_transporter') {
                const tName = sector.transporter ? sector.transporter.trim() : '';
                if (options.type === 'individual_transporter' && options.value && tName !== options.value) return;

                const key = `${sector.sectorName} - ${tName}`;
                if (!groups[key]) groups[key] = { label: `सेक्टर: ${sector.sectorName} | परिवहनकर्ता: ${tName}`, shops: [] };
                groups[key].shops.push(...(sector.shops || []));
            }
        });

        // Convert object to array
        return Object.values(groups).map(g => {
            // Compute subtotals
            let totals = { allocation: 0, dispatch: 0, allotedComm: {}, dispatchedComm: {} };
            
            // Normalize shops
            g.shops = g.shops.map(shop => {
                const allotedComm = { ...(shop.allotedComm || {}) };
                const dispatchedComm = { ...(shop.dispatchedComm || {}) };

                if (shop.wheatAllotted !== undefined) allotedComm['wheat'] = shop.wheatAllotted;
                if (shop.wheatDispatched !== undefined) dispatchedComm['wheat'] = shop.wheatDispatched;
                if (shop.fortifiedRiceAllotted !== undefined) allotedComm['rice'] = shop.fortifiedRiceAllotted;
                if (shop.fortifiedRiceDispatched !== undefined) dispatchedComm['rice'] = shop.fortifiedRiceDispatched;
                if (shop.riceAllotted !== undefined) allotedComm['rice'] = shop.riceAllotted;
                if (shop.riceDispatched !== undefined) dispatchedComm['rice'] = shop.riceDispatched;

                let allocation = shop.allocation;
                let dispatch = shop.dispatch;
                if (allocation === undefined) {
                    allocation = Object.values(allotedComm).reduce((sum, v) => sum + v, 0);
                    dispatch = Object.values(dispatchedComm).reduce((sum, v) => sum + v, 0);
                }

                return { ...shop, allotedComm, dispatchedComm, allocation, dispatch };
            });

            g.shops.forEach(shop => {
                totals.allocation += (shop.allocation || 0);
                totals.dispatch += (shop.dispatch || 0);
                Object.keys(shop.allotedComm || {}).forEach(c => {
                    totals.allotedComm[c] = (totals.allotedComm[c] || 0) + shop.allotedComm[c];
                });
                Object.keys(shop.dispatchedComm || {}).forEach(c => {
                    totals.dispatchedComm[c] = (totals.dispatchedComm[c] || 0) + shop.dispatchedComm[c];
                });
            });
            g.totals = totals;
            return g;
        });
    }

    extractDefaulters(processedResult, scheme, options) {
        const groups = this.groupShops(processedResult, options);
        let defaulters = [];

        groups.forEach(group => {
            group.shops.forEach(shop => {
                const balance = (shop.allocation || 0) - (shop.dispatch || 0);
                if (balance > 0) {
                    defaulters.push({
                        shopCode: shop.shopCode,
                        shopName: shop.shopName,
                        balance: balance,
                        groupLabel: group.label
                    });
                }
            });
        });

        return defaulters;
    }

    generatePdfHtml(title, schemeLabel, monthHindi, year, processedResult, commodities, options) {
        const groups = this.groupShops(processedResult, options);
        
        // Build table headers dynamically based on commodities
        let commHeaders = '';
        let subHeaders = '';
        commodities.forEach(c => {
            commHeaders += `<th colspan="3">${this.getCommodityHindi(c)}</th>`;
            subHeaders += `<th>आवंटन</th><th>उठाव</th><th>शेष</th>`;
        });
        
        commHeaders += `<th colspan="3">कुल योग (Qt.)</th>`;
        subHeaders += `<th>आवंटन</th><th>उठाव</th><th>शेष</th>`;

        let html = `
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                h2, h3 { text-align: center; margin: 5px 0; color: #333; }
                .report-header { margin-bottom: 20px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #999; padding: 4px; text-align: center; }
                th { background-color: #f0f0f0; font-weight: bold; }
                .group-header { background-color: #e6f2ff; font-weight: bold; text-align: left; color: #0056b3; }
                .balance-red { color: red; font-weight: bold; }
                .shop-name { text-align: left; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h2>म०प्र० स्टेट सिविल सप्लाईज़ कार्पो लि० जिला कार्यालय बैतूल</h2>
                <h3>दुकानवार उठाव हेतु शेष रिपोर्ट (${schemeLabel}) माह: ${monthHindi} ${year}</h3>
                <div style="text-align: center; color: #666; font-size: 10px;">
                    दिनांक: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
            </div>`;

        groups.forEach((group, groupIndex) => {
            html += `
            <h4 style="color: #000080; border-left: 4px solid #000080; padding-left: 10px;">
                ${groupIndex + 1}. ${options.type === 'issueCenter' ? 'व्यक्तिगत प्रदाय केन्द्र' : 'सेक्टर एवं परिवहनकर्तावार'} दुकान उठाव शेष विवरण - ${options.value || group.label.replace(/.*: /, '')}
            </h4>
            <table>
                <thead>
                    <tr>
                        <th rowspan="2" width="30">क्र.</th>
                        <th rowspan="2" width="60">दुकान कोड</th>
                        <th rowspan="2" width="150">दुकान का नाम</th>
                        ${commHeaders}
                        <th rowspan="2" width="120">परिवहनकर्ता</th>
                    </tr>
                    <tr>
                        ${subHeaders}
                    </tr>
                    <tr class="group-header">
                        <td colspan="3">${group.label}</td>`;
            
            // Group totals header row
            commodities.forEach(c => {
                const allot = (group.totals.allotedComm[c] || 0).toFixed(2);
                const disp = (group.totals.dispatchedComm[c] || 0).toFixed(2);
                const bal = (allot - disp).toFixed(2);
                html += `<td>${allot}</td><td>${disp}</td><td class="${bal > 0 ? 'balance-red' : ''}">${bal}</td>`;
            });
            const tAllot = group.totals.allocation.toFixed(2);
            const tDisp = group.totals.dispatch.toFixed(2);
            const tBal = (tAllot - tDisp).toFixed(2);
            html += `<td>${tAllot}</td><td>${tDisp}</td><td class="${tBal > 0 ? 'balance-red' : ''}">${tBal}</td><td></td></tr>`;
            html += `</thead><tbody>`;

            group.shops.forEach((shop, sIdx) => {
                html += `<tr>
                    <td>${sIdx + 1}</td>
                    <td>${shop.shopCode}</td>
                    <td class="shop-name" title="${shop.shopName}">${shop.shopName}</td>`;
                
                commodities.forEach(c => {
                    const allot = ((shop.allotedComm && shop.allotedComm[c]) || 0).toFixed(2);
                    const disp = ((shop.dispatchedComm && shop.dispatchedComm[c]) || 0).toFixed(2);
                    const bal = (allot - disp).toFixed(2);
                    html += `<td>${allot}</td><td>${disp}</td><td class="${bal > 0 ? 'balance-red' : ''}">${bal}</td>`;
                });
                
                const sAllot = (shop.allocation || 0).toFixed(2);
                const sDisp = (shop.dispatch || 0).toFixed(2);
                const sBal = (sAllot - sDisp).toFixed(2);
                
                // Assuming transporter is known via sector or just blank if shop level
                // We'll leave it blank for now, or use options.value
                html += `<td>${sAllot}</td><td>${sDisp}</td><td class="${sBal > 0 ? 'balance-red' : ''}">${sBal}</td><td></td>
                </tr>`;
            });

            html += `</tbody></table>`;
        });

        html += `</body></html>`;
        return html;
    }

    async generatePdf(report, processedResult, res, options) {
        const commodities = this.getCommodities(report.scheme);
        const schemeLabel = this.getSchemeLabelHindi(report.scheme);
        const monthHindi = this.getMonthNameHindi(report.month);
        
        const htmlContent = this.generatePdfHtml(
            `Balances Report`,
            schemeLabel,
            monthHindi,
            report.year,
            processedResult,
            commodities,
            options
        );

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            const pdfBuffer = await page.pdf({
                format: 'A4',
                landscape: true,
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
            });
            
            await browser.close();

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Balances_Report_${report.scheme}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            console.error(error);
            if (browser) await browser.close();
            res.status(500).send('Error generating PDF');
        }
    }

    async generateExcel(report, processedResult, res, options) {
        const commodities = this.getCommodities(report.scheme);
        const groups = this.groupShops(processedResult, options);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Balances Report');

        // Simple header
        worksheet.addRow(['दुकानवार उठाव शेष रिपोर्ट']);
        worksheet.addRow(['क्र.', 'दुकान कोड', 'दुकान का नाम', ...commodities.map(c => this.getCommodityHindi(c)), 'कुल योग (Qt.)']);
        
        groups.forEach(group => {
            worksheet.addRow([group.label]);
            group.shops.forEach((shop, i) => {
                let row = [
                    i + 1, 
                    shop.shopCode, 
                    shop.shopName
                ];
                commodities.forEach(c => {
                    const allot = ((shop.allotedComm && shop.allotedComm[c]) || 0).toFixed(2);
                    const disp = ((shop.dispatchedComm && shop.dispatchedComm[c]) || 0).toFixed(2);
                    row.push(`${allot} / ${disp} / ${(allot-disp).toFixed(2)}`);
                });
                
                const sAllot = (shop.allocation || 0).toFixed(2);
                const sDisp = (shop.dispatch || 0).toFixed(2);
                row.push(`${sAllot} / ${sDisp} / ${(sAllot-sDisp).toFixed(2)}`);
                
                worksheet.addRow(row);
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Balances_Report.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    }
}

module.exports = BalancesReportGenerator;
