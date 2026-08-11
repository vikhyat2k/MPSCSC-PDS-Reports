const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');

let shopsDetailsCache = {};
try {
    const detailsPath = path.join(__dirname, '../../config/shops-details.json');
    shopsDetailsCache = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
} catch (e) { /* shops-details not available */ }

let sectorsConfig = [];
try {
    const sectorsPath = path.join(__dirname, '../../config/sectors.json');
    sectorsConfig = JSON.parse(fs.readFileSync(sectorsPath, 'utf8'));
} catch (e) { /* sectors.json not available */ }

class BalancesReportGenerator {
    getCommodities(scheme) {
        if (scheme === 'nfsa') return ['wheat', 'rice', 'sugar', 'salt'];
        if (scheme === 'welfare') return ['wheat', 'rice'];
        if (scheme === 'icds') return ['wheat', 'rice', 'salt'];
        return ['wheat', 'rice']; // MDM
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
            const sectorShops = sector.shops || sector.mdmShops || sector.icdsShops || sector.welfareShops || [];
            if (options.type === 'issueCenter' || options.type === 'depot' || options.type === 'individual_depot') {
                sectorShops.forEach(shop => {
                    const depot = shop.issuePoint ? shop.issuePoint.trim() : (shop.block || sector.block || 'Unknown');
                    if (options.type === 'individual_depot' && options.value && depot !== options.value) return;
                    
                    if (!groups[depot]) groups[depot] = { label: `प्रदाय केंद्र: ${depot}`, shops: [] };
                    groups[depot].shops.push(shop);
                });
            } else if (!options.type || options.type === 'sector' || options.type === 'transporter' || options.type === 'individual_transporter') {
                const tName = sector.transporter ? sector.transporter.trim() : '';
                if (options.type === 'individual_transporter' && options.value && tName !== options.value) return;

                const key = `${sector.sectorName} - ${tName}`;
                if (!groups[key]) groups[key] = { label: `सेक्टर: ${sector.sectorName} | परिवहनकर्ता: ${tName}`, shops: [] };
                groups[key].shops.push(...sectorShops);
            }
        });

        // Convert object to array
        return Object.values(groups).map(g => {
            // Compute subtotals
            let totals = { allocation: 0, dispatch: 0, allotedComm: {}, dispatchedComm: {} };
            
            // Normalize shops
            g.shops = g.shops.map(shop => {
                const allotedComm = { ...(shop.allotedComm || shop.commodities || {}) };
                const dispatchedComm = { ...(shop.dispatchedComm || shop.dispatchCommodities || {}) };

                if (shop.wheatAllotted !== undefined) allotedComm['wheat'] = shop.wheatAllotted;
                if (shop.wheatDispatched !== undefined) dispatchedComm['wheat'] = shop.wheatDispatched;
                if (shop.fortifiedRiceAllotted !== undefined) allotedComm['rice'] = (allotedComm['rice'] || 0) + shop.fortifiedRiceAllotted;
                if (shop.fortifiedRiceDispatched !== undefined) dispatchedComm['rice'] = (dispatchedComm['rice'] || 0) + shop.fortifiedRiceDispatched;
                if (shop.riceAllotted !== undefined) allotedComm['rice'] = (allotedComm['rice'] || 0) + shop.riceAllotted;
                if (shop.riceDispatched !== undefined) dispatchedComm['rice'] = (dispatchedComm['rice'] || 0) + shop.riceDispatched;
                if (shop.sugarAllotted !== undefined) allotedComm['sugar'] = (allotedComm['sugar'] || 0) + shop.sugarAllotted;
                if (shop.sugarDispatched !== undefined) dispatchedComm['sugar'] = (dispatchedComm['sugar'] || 0) + shop.sugarDispatched;
                if (shop.fsaltAllotted !== undefined) allotedComm['salt'] = (allotedComm['salt'] || 0) + shop.fsaltAllotted;
                if (shop.fsaltDispatched !== undefined) dispatchedComm['salt'] = (dispatchedComm['salt'] || 0) + shop.fsaltDispatched;
                if (shop.saltAllotted !== undefined) allotedComm['salt'] = (allotedComm['salt'] || 0) + shop.saltAllotted;
                if (shop.saltDispatched !== undefined) dispatchedComm['salt'] = (dispatchedComm['salt'] || 0) + shop.saltDispatched;

                // For NFSA raw commodities data which uses 'fortifiedRice' and 'fSalt'
                if (allotedComm['fortifiedRice']) {
                    allotedComm['rice'] = (allotedComm['rice'] || 0) + (typeof allotedComm['fortifiedRice'] === 'number' ? allotedComm['fortifiedRice'] : (allotedComm['fortifiedRice'].allotted || 0));
                    delete allotedComm['fortifiedRice'];
                }
                if (dispatchedComm['fortifiedRice']) {
                    dispatchedComm['rice'] = (dispatchedComm['rice'] || 0) + (typeof dispatchedComm['fortifiedRice'] === 'number' ? dispatchedComm['fortifiedRice'] : (dispatchedComm['fortifiedRice'].dispatched || 0));
                    delete dispatchedComm['fortifiedRice'];
                }
                if (allotedComm['fSalt']) {
                    allotedComm['salt'] = (allotedComm['salt'] || 0) + (typeof allotedComm['fSalt'] === 'number' ? allotedComm['fSalt'] : (allotedComm['fSalt'].allotted || 0));
                    delete allotedComm['fSalt'];
                }
                if (dispatchedComm['fSalt']) {
                    dispatchedComm['salt'] = (dispatchedComm['salt'] || 0) + (typeof dispatchedComm['fSalt'] === 'number' ? dispatchedComm['fSalt'] : (dispatchedComm['fSalt'].dispatched || 0));
                    delete dispatchedComm['fSalt'];
                }

                let balance = shop.balance;
                let allocation = shop.allocation;
                let dispatch = shop.dispatch;

                if (balance !== undefined && !isNaN(balance)) {
                    balance = parseFloat(balance);
                } else if (allocation !== undefined && dispatch !== undefined) {
                    balance = parseFloat(allocation) - parseFloat(dispatch);
                } else {
                    let sumAlloc = 0;
                    let sumDisp = 0;
                    let commBalSum = 0;
                    Object.values(allotedComm).forEach(v => {
                        if (typeof v === 'number') sumAlloc += v;
                        else if (v && typeof v.balance === 'number') commBalSum += v.balance;
                    });
                    Object.values(dispatchedComm).forEach(v => {
                        if (typeof v === 'number') sumDisp += v;
                    });
                    allocation = sumAlloc;
                    dispatch = sumDisp;
                    balance = commBalSum > 0 ? commBalSum : Math.max(0, sumAlloc - sumDisp);
                }

                return { ...shop, allotedComm, dispatchedComm, allocation, dispatch, balance };
            }).filter(shop => {
                const b = (shop.balance !== undefined && !isNaN(shop.balance)) ? shop.balance : ((shop.allocation || 0) - (shop.dispatch || 0));
                return b > 0;
            });

            if (g.shops.length === 0) return null;

            g.shops.forEach(shop => {
                totals.allocation += (shop.allocation || 0);
                totals.dispatch += (shop.dispatch || 0);
                Object.keys(shop.allotedComm || {}).forEach(c => {
                    const val = shop.allotedComm[c];
                    const num = typeof val === 'number' ? val : (val && val.balance) || 0;
                    totals.allotedComm[c] = (totals.allotedComm[c] || 0) + num;
                });
                Object.keys(shop.dispatchedComm || {}).forEach(c => {
                    const val = shop.dispatchedComm[c];
                    const num = typeof val === 'number' ? val : (val && val.balance) || 0;
                    totals.dispatchedComm[c] = (totals.dispatchedComm[c] || 0) + num;
                });
            });
            g.totals = totals;
            return g;
        }).filter(g => g !== null);
    }

    extractDefaulters(processedResult, scheme, options) {
        const groups = this.groupShops(processedResult, options);
        let defaulters = [];

        groups.forEach(group => {
            if (!group.shops || group.shops.length === 0) return;

            let totalBalance = 0;
            let pendingShopsCount = group.shops.length;
            let centerBreakdownMap = {};

            group.shops.forEach(shop => {
                const bal = parseFloat((shop.balance !== undefined && !isNaN(shop.balance) ? shop.balance : ((shop.allocation || 0) - (shop.dispatch || 0))).toFixed(2));
                if (bal > 0) {
                    totalBalance += bal;
                    const centerName = shop.issuePoint ? shop.issuePoint.trim() : (shop.depot || shop.block || 'प्रदाय केंद्र');
                    if (!centerBreakdownMap[centerName]) {
                        centerBreakdownMap[centerName] = { center: centerName, pendingShops: 0, balance: 0 };
                    }
                    centerBreakdownMap[centerName].pendingShops += 1;
                    centerBreakdownMap[centerName].balance += bal;
                }
            });

            if (totalBalance > 0 && pendingShopsCount > 0) {
                defaulters.push({
                    role: group.label,
                    pendingShops: pendingShopsCount,
                    totalBalance: parseFloat(totalBalance.toFixed(2)),
                    centerBreakdown: Object.values(centerBreakdownMap).map(c => ({
                        ...c,
                        balance: parseFloat(c.balance.toFixed(2))
                    }))
                });
            }
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
            // Calculate colspan for the group-header: 3 fixed + (commodities * 3) + 3 total
            const totalCols = 3 + (commodities.length * 3) + 3;

            html += `
            <h4 style="color: #000080; border-left: 4px solid #000080; padding-left: 10px;">
                ${groupIndex + 1}. ${options.type === 'issueCenter' ? 'व्यक्तिगत प्रदाय केन्द्र' : 'सेक्टर एवं परिवहनकर्तावार'} दुकान उठाव शेष विवरण - ${options.value || group.label.replace(/.*: /, '')}
            </h4>
            <table>
                <thead>
                    <tr class="group-header">
                        <td colspan="${totalCols}" style="text-align:left; padding: 6px 8px; font-size:13px;">${group.label}</td>
                    </tr>
                    <tr>
                        <th rowspan="2" width="30">क्र.</th>
                        <th rowspan="2" width="60">दुकान कोड</th>
                        <th rowspan="2" width="150">दुकान का नाम</th>
                        ${commHeaders}
                    </tr>
                    <tr>
                        ${subHeaders}
                    </tr>
                    <tr class="group-header" style="background:#d0e8ff;">
                        <td colspan="3" style="text-align:right; font-weight:bold;">कुल योग</td>`;
            
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
            html += `<td>${tAllot}</td><td>${tDisp}</td><td class="${tBal > 0 ? 'balance-red' : ''}">${tBal}</td></tr>`;
            html += `</thead><tbody>`;

            group.shops.forEach((shop, sIdx) => {
                // Resolve actual name from shops-details.json, fall back to processor-built name
                const details = shopsDetailsCache[shop.shopCode] || {};
                const resolvedName = details.shopName
                    ? `${details.shopName} (${shop.shopCode})`
                    : (shop.shopName || shop.shopCode);

                html += `<tr>
                    <td>${sIdx + 1}</td>
                    <td>${shop.shopCode}</td>
                    <td class="shop-name" title="${resolvedName}">${resolvedName}</td>`;
                
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
                html += `<td>${sAllot}</td><td>${sDisp}</td><td class="${sBal > 0 ? 'balance-red' : ''}">${sBal}</td>
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

            const schemeName = (report.scheme || 'report').toUpperCase();
            const monthName = this.getMonthName(report.month);
            const year = report.year || new Date().getFullYear();
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `Balance_Shops_${schemeName}_${monthName}_${year}_${dateStr}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
            res.send(Buffer.from(pdfBuffer));
        } catch (error) {
            console.error(error);
            if (browser) await browser.close();
            res.status(500).send('Error generating PDF');
        }
    }

    getMonthName(monthInput) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        if (monthInput === null || monthInput === undefined || monthInput === '') {
            return 'Month';
        }
        const m = parseInt(monthInput, 10);
        if (!isNaN(m) && m >= 1 && m <= 12) {
            return months[m - 1];
        }
        const str = String(monthInput).trim();
        const lower = str.toLowerCase();
        const found = months.find(name => name.toLowerCase() === lower || name.toLowerCase().startsWith(lower));
        if (found) return found;
        return str;
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

        const schemeName = (report.scheme || 'report').toUpperCase();
        const monthName = this.getMonthName(report.month);
        const year = report.year || new Date().getFullYear();
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Balance_Shops_${schemeName}_${monthName}_${year}_${dateStr}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        
        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Compute pending dispatch summary grouped by transporter/sector or issue center.
     * Works off processedResult (already-processed sector+shop data).
     */
    computePendingSummary(processedResult, options = {}) {
        const { groupBy = 'transporter', filterTransporter, filterIssueCenter, sortBy = 'pendingQty' } = options;

        const groups = {};

        // Helper to normalize strings for robust comparison
        const norm = (s) => (s || '').toString().trim().toLowerCase();
        const targetIC = norm(filterIssueCenter);

        // Helper to check if a sector is linked to filterIssueCenter
        const isSectorLinkedToIC = (sec) => {
            if (!targetIC) return true; // No filter: all linked
            const dOffice = norm(sec.districtOffice);
            const blk = norm(sec.block);
            const sName = norm(sec.sectorName);
            const ic = norm(sec.issueCenter || sec.issuePoint);

            return Boolean(
                (dOffice && (dOffice === targetIC || dOffice.includes(targetIC) || targetIC.includes(dOffice))) ||
                (blk && (blk === targetIC || blk.includes(targetIC) || targetIC.includes(blk))) ||
                (ic && (ic === targetIC || ic.includes(targetIC) || targetIC.includes(ic))) ||
                (sName && (sName.includes(targetIC) || (sName.startsWith(targetIC))))
            );
        };

        // Collect sectors in processedResult that actually contain shops matching targetIC
        const sectorsWithMatchingShops = new Set();
        (processedResult.sectors || []).forEach(sector => {
            const sNo = String(sector.serialNo || '');
            const tName = (sector.transporter || '').trim() || 'अज्ञात';
            const key = `${tName}___${sNo}`;
            (sector.shops || []).forEach(shop => {
                const issueCenter = (shop.issuePoint || shop.issueCenter || sector.block || 'अज्ञात').trim();
                const shopICNorm = norm(issueCenter);
                if (!targetIC || shopICNorm === targetIC || shopICNorm.includes(targetIC) || targetIC.includes(shopICNorm)) {
                    sectorsWithMatchingShops.add(key);
                }
            });
        });

        // Seed sectors when groupBy === 'transporter'
        if (groupBy === 'transporter') {
            const allSectorsMap = new Map();
            sectorsConfig.forEach(s => {
                const sNo = String(s.serialNo || '');
                const tName = (s.transporter || '').trim() || 'अज्ञात';
                const sName = (s.sectorName || `सेक्टर क्र ${sNo}`).trim();
                const key = `${tName}___${sNo}`;
                if (!allSectorsMap.has(key)) {
                    allSectorsMap.set(key, {
                        key,
                        transporter: tName,
                        sectorName: sName,
                        serialNo: sNo,
                        districtOffice: s.districtOffice,
                        block: s.block
                    });
                }
            });
            (processedResult.sectors || []).forEach(s => {
                const sNo = String(s.serialNo || '');
                const tName = (s.transporter || '').trim() || 'अज्ञात';
                const sName = (s.sectorName || `सेक्टर क्र ${sNo}`).trim();
                const key = `${tName}___${sNo}`;
                if (!allSectorsMap.has(key)) {
                    allSectorsMap.set(key, {
                        key,
                        transporter: tName,
                        sectorName: sName,
                        serialNo: sNo,
                        districtOffice: s.districtOffice || s.block,
                        block: s.block
                    });
                }
            });

            allSectorsMap.forEach((sec, key) => {
                if (filterTransporter && sec.transporter !== filterTransporter) return;

                // When Issue Center filter is active, only include transporters/sectors linked to that Issue Center
                if (targetIC) {
                    const linked = isSectorLinkedToIC(sec) || sectorsWithMatchingShops.has(key);
                    if (!linked) return;
                }

                groups[key] = {
                    group: key,
                    transporter: sec.transporter,
                    sectorName: sec.sectorName,
                    districtOffice: sec.districtOffice,
                    block: sec.block,
                    displayLabel: `${sec.transporter} (${sec.sectorName})`,
                    pendingShops: 0,
                    pendingQty: 0,
                    rice: { shops: 0, qty: 0 },
                    wheat: { shops: 0, qty: 0 },
                    salt: { shops: 0, qty: 0 }
                };
            });
        }

        processedResult.sectors.forEach(sector => {
            const sectorTransporter = (sector.transporter || '').trim() || 'अज्ञात';
            const sectorName = (sector.sectorName || `सेक्टर क्र ${sector.serialNo}`).trim();
            const serialNo = String(sector.serialNo || '');

            // Apply transporter filter if groupBy === 'transporter'
            if (filterTransporter && sectorTransporter !== filterTransporter) return;

            (sector.shops || []).forEach(shop => {
                // Resolve issue center
                const issueCenter = (shop.issuePoint || shop.issueCenter || sector.block || 'अज्ञात').trim();

                // Apply issue center filter
                if (targetIC) {
                    const shopICNorm = norm(issueCenter);
                    if (shopICNorm !== targetIC && !shopICNorm.includes(targetIC) && !targetIC.includes(shopICNorm)) {
                        return;
                    }
                }

                // Unique group key
                const groupKey = groupBy === 'issuecenter' ? issueCenter : `${sectorTransporter}___${serialNo}`;

                // Normalize commodity maps
                const allotedComm = { ...(shop.allotedComm || shop.commodities || {}) };
                const dispatchedComm = { ...(shop.dispatchedComm || shop.dispatchCommodities || {}) };

                if (shop.wheatAllotted !== undefined) allotedComm.wheat = shop.wheatAllotted;
                if (shop.wheatDispatched !== undefined) dispatchedComm.wheat = shop.wheatDispatched;
                if (shop.riceAllotted !== undefined) allotedComm.rice = (allotedComm.rice || 0) + shop.riceAllotted;
                if (shop.riceDispatched !== undefined) dispatchedComm.rice = (dispatchedComm.rice || 0) + shop.riceDispatched;
                if (shop.fortifiedRiceAllotted !== undefined) allotedComm.rice = (allotedComm.rice || 0) + shop.fortifiedRiceAllotted;
                if (shop.fortifiedRiceDispatched !== undefined) dispatchedComm.rice = (dispatchedComm.rice || 0) + shop.fortifiedRiceDispatched;
                if (shop.saltAllotted !== undefined) allotedComm.salt = (allotedComm.salt || 0) + shop.saltAllotted;
                if (shop.saltDispatched !== undefined) dispatchedComm.salt = (dispatchedComm.salt || 0) + shop.saltDispatched;
                if (shop.fsaltAllotted !== undefined) allotedComm.salt = (allotedComm.salt || 0) + shop.fsaltAllotted;
                if (shop.fsaltDispatched !== undefined) dispatchedComm.salt = (dispatchedComm.salt || 0) + shop.fsaltDispatched;
                if (allotedComm.fortifiedRice) { allotedComm.rice = (allotedComm.rice || 0) + allotedComm.fortifiedRice; delete allotedComm.fortifiedRice; }
                if (dispatchedComm.fortifiedRice) { dispatchedComm.rice = (dispatchedComm.rice || 0) + dispatchedComm.fortifiedRice; delete dispatchedComm.fortifiedRice; }
                if (allotedComm.fSalt) { allotedComm.salt = (allotedComm.salt || 0) + allotedComm.fSalt; delete allotedComm.fSalt; }
                if (dispatchedComm.fSalt) { dispatchedComm.salt = (dispatchedComm.salt || 0) + dispatchedComm.fSalt; delete dispatchedComm.fSalt; }

                let allocation = shop.allocation;
                let dispatch = shop.dispatch;
                if (allocation === undefined) {
                    allocation = Object.values(allotedComm).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                    dispatch = Object.values(dispatchedComm).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                }
                allocation = parseFloat(allocation) || 0;
                dispatch = parseFloat(dispatch) || 0;

                const totalBal = parseFloat((allocation - dispatch).toFixed(4));
                if (totalBal <= 0.001) return; // shop is fully lifted

                if (!groups[groupKey]) {
                    const displayLabel = groupBy === 'issuecenter'
                        ? issueCenter
                        : `${sectorTransporter} (${sectorName})`;

                    groups[groupKey] = {
                        group: groupKey,
                        transporter: sectorTransporter,
                        sectorName: sectorName,
                        districtOffice: sector.districtOffice || shop.districtOffice,
                        block: sector.block || shop.block,
                        issueCenter: issueCenter,
                        displayLabel: displayLabel,
                        pendingShops: 0,
                        pendingQty: 0,
                        rice: { shops: 0, qty: 0 },
                        wheat: { shops: 0, qty: 0 },
                        salt: { shops: 0, qty: 0 }
                    };
                }
                const g = groups[groupKey];
                g.pendingShops += 1;
                g.pendingQty += totalBal;

                // Per-commodity pending
                ['rice', 'wheat', 'salt'].forEach(comm => {
                    const allot = parseFloat(allotedComm[comm] || 0);
                    const disp = parseFloat(dispatchedComm[comm] || 0);
                    const bal = allot - disp;
                    if (bal > 0.001) {
                        g[comm].shops += 1;
                        g[comm].qty += bal;
                    }
                });
            });
        });

        // Convert groups to array
        let rows = Object.values(groups);

        // If filterIssueCenter is set, filter out any row that has 0 pending shops AND is NOT linked to targetIC
        if (targetIC) {
            rows = rows.filter(r => {
                if (r.pendingShops > 0) return true;
                return isSectorLinkedToIC(r);
            });
        }

        // Sort
        if (sortBy === 'pendingShops') {
            rows.sort((a, b) => b.pendingShops - a.pendingShops);
        } else {
            rows.sort((a, b) => b.pendingQty - a.pendingQty);
        }

        // Round quantities
        rows = rows.map(r => ({
            ...r,
            pendingQty: parseFloat(r.pendingQty.toFixed(2)),
            rice: { shops: r.rice.shops, qty: parseFloat(r.rice.qty.toFixed(2)) },
            wheat: { shops: r.wheat.shops, qty: parseFloat(r.wheat.qty.toFixed(2)) },
            salt: { shops: r.salt.shops, qty: parseFloat(r.salt.qty.toFixed(2)) }
        }));

        // Grand total
        const grandTotal = {
            pendingShops: rows.reduce((s, r) => s + r.pendingShops, 0),
            pendingQty: parseFloat(rows.reduce((s, r) => s + r.pendingQty, 0).toFixed(2)),
            rice: {
                shops: rows.reduce((s, r) => s + r.rice.shops, 0),
                qty: parseFloat(rows.reduce((s, r) => s + r.rice.qty, 0).toFixed(2))
            },
            wheat: {
                shops: rows.reduce((s, r) => s + r.wheat.shops, 0),
                qty: parseFloat(rows.reduce((s, r) => s + r.wheat.qty, 0).toFixed(2))
            },
            salt: {
                shops: rows.reduce((s, r) => s + r.salt.shops, 0),
                qty: parseFloat(rows.reduce((s, r) => s + (r.salt ? r.salt.qty : 0), 0).toFixed(2))
            }
        };

        return { groupBy, rows, grandTotal, filterIssueCenter, filterTransporter };
    }

    /**
     * Generate Excel export for the pending summary report.
     */
    async generatePendingSummaryExcel(summaryData, report, res) {
        const { groupBy, rows, grandTotal, filterIssueCenter } = summaryData;
        const groupLabel = groupBy === 'issuecenter' ? 'प्रदाय केंद्र' : 'परिवहनकर्ता (सेक्टर क्र. एवं नाम)';
        const monthHindi = this.getMonthNameHindi(report.month);
        const monthEn = this.getMonthName(report.month);
        const year = report.year || new Date().getFullYear();

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Pending Summary');

        // Header rows
        const icText = filterIssueCenter ? ` (प्रदाय केंद्र: ${filterIssueCenter})` : '';
        const title = `दुकान उठाव शेष रिपोर्ट — ${groupLabel}वार विश्लेषण${icText}`;
        const subTitle = `माह: ${monthHindi} ${year}${filterIssueCenter ? '  |  प्रदाय केंद्र: ' + filterIssueCenter : ''}  |  दिनांक: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

        ws.mergeCells('A1:J1');
        ws.getCell('A1').value = title;
        ws.getCell('A1').font = { bold: true, size: 13, name: 'Arial' };
        ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 24;

        ws.mergeCells('A2:J2');
        ws.getCell('A2').value = subTitle;
        ws.getCell('A2').font = { size: 10, name: 'Arial', italic: true };
        ws.getCell('A2').alignment = { horizontal: 'center' };

        // Column headers row 3 (merged)
        const headerRow3 = ws.getRow(3);
        headerRow3.values = ['क्र.', groupLabel, 'कुल लंबित दुकान संख्या', 'कुल मात्रा क्विंटल में',
            'चावल (Rice)', '', 'गेहूं (Wheat)', '', 'नमक (Salt)', ''];
        ws.mergeCells('E3:F3');
        ws.mergeCells('G3:H3');
        ws.mergeCells('I3:J3');

        const headerRow4 = ws.getRow(4);
        headerRow4.values = ['', '', '', '', 'लंबित दुकानें', 'मात्रा (क्विंटल)', 'लंबित दुकानें', 'मात्रा (क्विंटल)', 'लंबित दुकानें', 'मात्रा (क्विंटल)'];

        [3, 4].forEach(rn => {
            const row = ws.getRow(rn);
            row.eachCell(cell => {
                cell.font = { bold: true, size: 10, name: 'Arial' };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
                cell.border = {
                    top: { style: 'thin' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' }
                };
            });
            row.height = 22;
        });

        // Data rows
        rows.forEach((r, idx) => {
            const row = ws.addRow([
                idx + 1, r.displayLabel || r.group, r.pendingShops, r.pendingQty,
                r.rice.shops, r.rice.qty,
                r.wheat.shops, r.wheat.qty,
                r.salt.shops, r.salt.qty
            ]);
            row.eachCell(cell => {
                cell.font = { size: 10, name: 'Arial' };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' }
                };
            });
            // Group name left-aligned
            row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
            // Highlight pending shops in orange if > 5
            if (r.pendingShops > 5) {
                row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
                row.getCell(3).font = { size: 10, name: 'Arial', bold: true, color: { argb: 'FFC00000' } };
            }
        });

        // Grand total row
        const totalRow = ws.addRow([
            '', 'कुल योग (Grand Total)', grandTotal.pendingShops, grandTotal.pendingQty,
            grandTotal.rice.shops, grandTotal.rice.qty,
            grandTotal.wheat.shops, grandTotal.wheat.qty,
            grandTotal.salt.shops, grandTotal.salt.qty
        ]);
        totalRow.eachCell(cell => {
            cell.font = { bold: true, size: 10, name: 'Arial' };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
            cell.border = {
                top: { style: 'medium' }, bottom: { style: 'medium' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        });
        totalRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

        // Column widths - compact group column so it doesn't leave blank space
        ws.getColumn(1).width = 5;
        ws.getColumn(2).width = 42;
        ws.getColumn(3).width = 16;
        ws.getColumn(4).width = 18;
        [5, 6, 7, 8, 9, 10].forEach(i => { ws.getColumn(i).width = 16; });

        const groupTag = groupBy === 'issuecenter' ? 'IC' : 'Transporter';
        const fileName = `Pending_Summary_${groupTag}_${monthEn}_${year}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Generate HTML for the pending summary PDF (also used for HTML preview).
     */
    generatePendingSummaryHtml(summaryData, report) {
        const { groupBy, rows, grandTotal, filterIssueCenter } = summaryData;
        const groupLabel = groupBy === 'issuecenter' ? 'प्रदाय केंद्र' : 'परिवहनकर्ता (सेक्टर क्र. एवं नाम)';
        const monthHindi = this.getMonthNameHindi(report.month);
        const year = report.year || new Date().getFullYear();

        const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        const icTitleText = filterIssueCenter ? ` (${filterIssueCenter})` : '';
        const icSubText = filterIssueCenter ? ` &nbsp;|&nbsp; प्रदाय केंद्र: ${filterIssueCenter}` : '';

        const rowsHtml = rows.map((r, idx) => `
            <tr>
                <td style="width:30px;">${idx + 1}</td>
                <td class="group-col">${r.displayLabel || r.group}</td>
                <td class="${r.pendingShops > 5 ? 'high' : ''}">${r.pendingShops}</td>
                <td class="bal-red">${(r.pendingQty || 0).toFixed(2)}</td>
                <td>${r.rice?.shops || 0}</td>
                <td>${(r.rice?.qty || 0).toFixed(2)}</td>
                <td>${r.wheat?.shops || 0}</td>
                <td>${(r.wheat?.qty || 0).toFixed(2)}</td>
                <td>${r.salt?.shops || 0}</td>
                <td>${(r.salt?.qty || 0).toFixed(2)}</td>
            </tr>`).join('');

        return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>दुकान उठाव शेष — ${groupLabel}वार${icTitleText}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 15px; font-size: 10px; color: #111; }
    h2 { text-align:center; font-size:14px; margin:3px 0; }
    h3 { text-align:center; font-size:11px; color:#555; margin:2px 0 10px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; table-layout: fixed; }
    th, td { border:1px solid #aaa; padding:4px 3px; text-align:center; word-wrap: break-word; white-space: normal; line-height: 1.2; }
    th { background:#dce6f1; font-weight:bold; font-size:9.5px; vertical-align: middle; }
    .col-sr { width: 4%; }
    .group-col { text-align:left; width: 25%; font-weight:600; padding-left: 6px; }
    .col-hdr { width: 10%; }
    .col-comm { width: 9%; }
    .bal-red { color:#c00; font-weight:bold; }
    .high { background:#ffe4d6; color:#c00; font-weight:bold; }
    .total-row { background:#ffd966; font-weight:bold; }
    .stamp { text-align:right; font-size:9px; color:#777; margin-top:6px; }
  </style>
</head>
<body>
  <h2>म.प्र. स्टेट सिविल सप्लाईज़ कार्पो. लि. — जिला कार्यालय बैतूल</h2>
  <h3>दुकान उठाव शेष रिपोर्ट — ${groupLabel}वार विश्लेषण &nbsp;|&nbsp; माह: ${monthHindi} ${year}${icSubText}</h3>
  <table>
    <thead>
      <tr>
        <th rowspan="2" class="col-sr">क्र.</th>
        <th rowspan="2" class="group-col">${groupLabel}</th>
        <th rowspan="2" class="col-hdr">कुल लंबित<br>दुकान संख्या</th>
        <th rowspan="2" class="col-hdr">कुल मात्रा<br>क्विंटल में</th>
        <th colspan="2">चावल (Rice)</th>
        <th colspan="2">गेहूं (Wheat)</th>
        <th colspan="2">नमक (Salt)</th>
      </tr>
      <tr>
        <th class="col-comm">लंबित दुकानें</th><th class="col-comm">मात्रा (क्विंटल)</th>
        <th class="col-comm">लंबित दुकानें</th><th class="col-comm">मात्रा (क्विंटल)</th>
        <th class="col-comm">लंबित दुकानें</th><th class="col-comm">मात्रा (क्विंटल)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="2" style="text-align:right;">कुल योग (Grand Total)</td>
        <td>${grandTotal.pendingShops}</td>
        <td>${grandTotal.pendingQty.toFixed(2)}</td>
        <td>${grandTotal.rice.shops}</td>
        <td>${grandTotal.rice.qty.toFixed(2)}</td>
        <td>${grandTotal.wheat.shops}</td>
        <td>${grandTotal.wheat.qty.toFixed(2)}</td>
        <td>${grandTotal.salt.shops}</td>
        <td>${grandTotal.salt.qty.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <p class="stamp">Generated: ${dateStr}</p>
</body>
</html>`;
    }

    /**
     * Generate PDF export for the pending summary report.
     */
    async generatePendingSummaryPdf(summaryData, report, res) {
        const htmlContent = this.generatePendingSummaryHtml(summaryData, report);

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

            const groupTag = (summaryData.groupBy === 'issuecenter') ? 'IC' : 'Transporter';
            const monthEn = this.getMonthName(report.month);
            const year = report.year || new Date().getFullYear();
            const fileName = `Pending_Summary_${groupTag}_${monthEn}_${year}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(Buffer.from(pdfBuffer));
        } catch (err) {
            if (browser) await browser.close();
            throw err;
        }
    }
}

module.exports = BalancesReportGenerator;
