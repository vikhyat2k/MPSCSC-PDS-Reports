const ExcelJS = require('exceljs');

class AdvancedAnalyticsExcelGenerator {
    /**
     * Generates a 5-sheet formula-driven Advanced Analytics Excel Workbook
     * 
     * @param {Object} computed Data computed from AdvancedAnalyticsCompute
     * @param {Object} chartBuffers PNG image buffers from AdvancedAnalyticsChartRenderer
     * @returns {Promise<ExcelJS.Workbook>} ExcelJS workbook instance
     */
    async generateWorkbook(computed, chartBuffers = {}) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MPSCSC Betul - Advanced Analytics System';
        workbook.lastModifiedBy = 'PDS Portal';
        workbook.created = new Date();

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[computed.month - 1] || `Month ${computed.month}`;
        const titlePeriod = `${monthName} ${computed.year}`;

        // Color Tokens
        const NAVY = '0B2545';
        const GOLD = 'C9A227';
        const LIGHT_ZEBRA = 'F4F6F8';
        const WHITE = 'FFFFFF';

        const TIER_COLORS = {
            Critical: { fill: 'B23A2E', font: 'FFFFFF' },
            Watch: { fill: 'D98E04', font: 'FFFFFF' },
            Good: { fill: '2E6F95', font: 'FFFFFF' },
            Excellent: { fill: '1E7B4D', font: 'FFFFFF' }
        };

        // ════════════════════════════════════════════════════════════════════════
        // SHEET 2: SECTOR DETAIL (Build first so Sheet 1 formulas can reference it)
        // ════════════════════════════════════════════════════════════════════════
        const wsSector = workbook.addWorksheet('Sector Detail');
        wsSector.views = [{ showGridLines: true }];

        // Title Header Banner
        wsSector.mergeCells('A1:N1');
        const s2Title = wsSector.getCell('A1');
        s2Title.value = `उन्नत सेक्टर विश्लेषण डेटाबेस / Sector Detailed Analytics Database — ${titlePeriod}`;
        s2Title.font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } };
        s2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        s2Title.alignment = { vertical: 'middle', horizontal: 'center' };

        // Subtitle
        wsSector.mergeCells('A2:N2');
        const s2Sub = wsSector.getCell('A2');
        s2Sub.value = `जिला कार्यालय बैतूल · म.प्र. राज्य नागरिक आपूर्ति निगम | Report Date: ${new Date(computed.generatedAt).toLocaleDateString('en-GB')}`;
        s2Sub.font = { name: 'Arial', size: 10, italic: true, color: { argb: '333333' } };
        s2Sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6ECF5' } };
        s2Sub.alignment = { vertical: 'middle', horizontal: 'center' };

        // Table Headers (Row 3)
        const sectorHeaders = [
            'Sr.No\nक्र.',
            'Block\nब्लॉक',
            'Sector Name\nसेक्टर नाम',
            'Shops\nदुकाने',
            'Allocation (Qt)\nआवंटन',
            'Dispatch (Qt)\nउठाव',
            'Lift %\nउठाव %',
            'POS Receipt %\nPOS प्राप्ति %',
            'POS Gap (pp)\nPOS अंतर',
            'Remaining (Qt)\nलंबित मात्रा',
            'Risk Tier\nजोखिम श्रेणी',
            'District Rank\nजिला रैंक',
            'Transporter Name\nपरिवहनकर्ता',
            'Mobile Number\nमोबाइल नंबर'
        ];

        wsSector.getRow(3).values = sectorHeaders;
        wsSector.getRow(3).height = 36;
        wsSector.getRow(3).eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
        });

        // Add Sector Data Rows
        let rowIdx = 4;
        computed.sectors.forEach((sec) => {
            const row = wsSector.getRow(rowIdx);
            
            // Formulas for Sheet 2:
            // Lift % = F{row}/E{row}
            // POS Receipt % = raw value / E{row} or posReceiptPct
            // POS Gap pp = (F{row}/E{row} - H{row}) * 100
            // Remaining = E{row} - F{row}
            // Risk Tier = IF(G{row}>=0.95,"Excellent",IF(G{row}>=0.85,"Good",IF(G{row}>=0.70,"Watch","Critical")))
            // District Rank = RANK(G{row},$G$4:$G${lastRow},0)

            const liftFormula = `F${rowIdx}/E${rowIdx}`;
            const posPctFormula = `${sec.posReceipt}/E${rowIdx}`;
            const gapFormula = `(F${rowIdx}/E${rowIdx} - H${rowIdx})*100`;
            const remFormula = `E${rowIdx}-F${rowIdx}`;
            const tierFormula = `IF(G${rowIdx}>=0.95,"Excellent",IF(G${rowIdx}>=0.85,"Good",IF(G${rowIdx}>=0.70,"Watch","Critical")))`;

            row.getCell(1).value = sec.srNo;
            row.getCell(2).value = sec.block;
            row.getCell(3).value = sec.sectorName;
            row.getCell(4).value = sec.shopsCount;
            row.getCell(5).value = sec.allocation;
            row.getCell(6).value = sec.dispatch;
            row.getCell(7).value = { formula: liftFormula };
            row.getCell(8).value = { formula: posPctFormula };
            row.getCell(9).value = { formula: gapFormula };
            row.getCell(10).value = { formula: remFormula };
            row.getCell(11).value = { formula: tierFormula };
            // District Rank formula dynamically filled after finding total rows
            row.getCell(13).value = sec.transporter;
            row.getCell(14).value = sec.mobile;

            // Formats
            row.getCell(4).numberFormat = '#,##0';
            row.getCell(5).numberFormat = '#,##0.00';
            row.getCell(6).numberFormat = '#,##0.00';
            row.getCell(7).numberFormat = '0.00%';
            row.getCell(8).numberFormat = '0.00%';
            row.getCell(9).numberFormat = '0.00';
            row.getCell(10).numberFormat = '#,##0.00';

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Arial', size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: [1, 4, 7, 8, 9, 11, 12].includes(colNumber) ? 'center' : ([5, 6, 10].includes(colNumber) ? 'right' : 'left') };
                if (rowIdx % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ZEBRA } };
                }
            });

            rowIdx++;
        });

        const lastSectorRow = rowIdx - 1;

        // Apply District Rank formula to column L
        for (let r = 4; r <= lastSectorRow; r++) {
            const rankFormula = `RANK(G${r},$G$4:$G$${lastSectorRow},0)`; // 0 = Descending
            wsSector.getCell(`L${r}`).value = { formula: rankFormula };
            wsSector.getCell(`L${r}`).numberFormat = '#,##0';
        }

        // District Total Summary Row
        const totalRowIdx = rowIdx;
        const totalRow = wsSector.getRow(totalRowIdx);
        totalRow.getCell(1).value = '';
        totalRow.getCell(2).value = 'जिला कुल (DISTRICT TOTAL)';
        wsSector.mergeCells(`B${totalRowIdx}:D${totalRowIdx}`);
        totalRow.getCell(5).value = { formula: `SUM(E4:E${lastSectorRow})` };
        totalRow.getCell(6).value = { formula: `SUM(F4:F${lastSectorRow})` };
        totalRow.getCell(7).value = { formula: `F${totalRowIdx}/E${totalRowIdx}` };
        totalRow.getCell(8).value = { formula: `SUMPRODUCT(E4:E${lastSectorRow},H4:H${lastSectorRow})/E${totalRowIdx}` };
        totalRow.getCell(9).value = { formula: `(G${totalRowIdx}-H${totalRowIdx})*100` };
        totalRow.getCell(10).value = { formula: `E${totalRowIdx}-F${totalRowIdx}` };
        totalRow.getCell(11).value = 'TOTAL';
        totalRow.getCell(12).value = '-';

        totalRow.getCell(5).numberFormat = '#,##0.00';
        totalRow.getCell(6).numberFormat = '#,##0.00';
        totalRow.getCell(7).numberFormat = '0.00%';
        totalRow.getCell(8).numberFormat = '0.00%';
        totalRow.getCell(9).numberFormat = '0.00';
        totalRow.getCell(10).numberFormat = '#,##0.00';

        totalRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: NAVY } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
            cell.border = {
                top: { style: 'thin', color: { argb: GOLD } },
                bottom: { style: 'double', color: { argb: NAVY } }
            };
        });

        // ── Hidden Helper Aggregate Block on Sheet 2 (Cols P & Q) ──
        wsSector.getCell('P1').value = 'KEY';
        wsSector.getCell('Q1').value = 'FORMULA_VALUE';

        wsSector.getCell('P2').value = 'Total Allocation';
        wsSector.getCell('Q2').value = { formula: `E${totalRowIdx}` };

        wsSector.getCell('P3').value = 'Total Dispatch';
        wsSector.getCell('Q3').value = { formula: `F${totalRowIdx}` };

        wsSector.getCell('P4').value = 'District Lift Pct';
        wsSector.getCell('Q4').value = { formula: `G${totalRowIdx}` };

        wsSector.getCell('P5').value = 'Pending Qty';
        wsSector.getCell('Q5').value = { formula: `J${totalRowIdx}` };

        wsSector.getCell('P6').value = 'Avg POS Receipt Pct';
        wsSector.getCell('Q6').value = { formula: `H${totalRowIdx}` };

        wsSector.getCell('P7').value = 'Critical Sectors';
        wsSector.getCell('Q7').value = { formula: `COUNTIF(K4:K${lastSectorRow},"Critical")` };

        wsSector.getCell('P8').value = 'Watch Sectors';
        wsSector.getCell('Q8').value = { formula: `COUNTIF(K4:K${lastSectorRow},"Watch")` };

        wsSector.getCell('P9').value = 'Excellent Sectors';
        wsSector.getCell('Q9').value = { formula: `COUNTIF(K4:K${lastSectorRow},"Excellent")` };

        // Hide columns P, Q, R
        wsSector.getColumn('P').hidden = true;
        wsSector.getColumn('Q').hidden = true;
        wsSector.getColumn('R').hidden = true;

        // Auto-fit Column Widths
        wsSector.columns.forEach((col, idx) => {
            if (idx < 14) {
                col.width = [6, 16, 24, 10, 16, 16, 12, 14, 14, 16, 14, 12, 22, 14][idx] || 15;
            }
        });


        // ════════════════════════════════════════════════════════════════════════
        // SHEET 1: DASHBOARD
        // ════════════════════════════════════════════════════════════════════════
        const wsDash = workbook.addWorksheet('Dashboard');
        wsDash.views = [{ showGridLines: true }];

        // Header Title
        wsDash.mergeCells('A1:H1');
        const dashTitle = wsDash.getCell('A1');
        dashTitle.value = `📊 कार्यकारी डैशबोर्ड / Executive Analytics Dashboard — ${titlePeriod}`;
        dashTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: WHITE } };
        dashTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        dashTitle.alignment = { vertical: 'middle', horizontal: 'center' };

        wsDash.mergeCells('A2:H2');
        const dashSub = wsDash.getCell('A2');
        dashSub.value = `मध्य प्रदेश राज्य नागरिक आपूर्ति निगम, जिला कार्यालय बैतूल | NFSA मासिक उठाव एवं POS समीक्षा`;
        dashSub.font = { name: 'Arial', size: 11, italic: true, color: { argb: '444444' } };
        dashSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6ECF5' } };
        dashSub.alignment = { vertical: 'middle', horizontal: 'center' };

        // Helper to format KPI Cards
        const createKPICard = (ws, startCol, startRow, label, formulaRef, isPct = false, accentColor = NAVY) => {
            const endColIndex = ws.getColumn(startCol).number + 1;
            const endCol = ws.getColumn(endColIndex).letter;
            
            const r1 = startRow;
            const r2 = startRow + 1;
            const r3 = startRow + 2;

            // Accent bar
            ws.mergeCells(`${startCol}${r1}:${endCol}${r1}`);
            const accent = ws.getCell(`${startCol}${r1}`);
            accent.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentColor } };
            
            // Label
            ws.mergeCells(`${startCol}${r2}:${endCol}${r2}`);
            const lbl = ws.getCell(`${startCol}${r2}`);
            lbl.value = label;
            lbl.font = { name: 'Arial', size: 9, bold: true, color: { argb: '555555' } };
            lbl.alignment = { vertical: 'middle', horizontal: 'center' };
            lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ZEBRA } };

            // Value (FORMULA REFERENCE)
            ws.mergeCells(`${startCol}${r3}:${endCol}${r3}`);
            const val = ws.getCell(`${startCol}${r3}`);
            val.value = { formula: formulaRef };
            val.font = { name: 'Arial', size: 16, bold: true, color: { argb: NAVY } };
            val.alignment = { vertical: 'middle', horizontal: 'center' };
            val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
            if (isPct) val.numberFormat = '0.00%';
            else val.numberFormat = '#,##0.00';

            // Border surrounding the card
            for (let r = r1; r <= r3; r++) {
                for (let c = ws.getColumn(startCol).number; c <= endColIndex; c++) {
                    const cell = ws.getCell(r, c);
                    cell.border = {
                        top: r === r1 ? { style: 'thin', color: { argb: accentColor } } : undefined,
                        bottom: r === r3 ? { style: 'thin', color: { argb: 'CCCCCC' } } : undefined,
                        left: c === ws.getColumn(startCol).number ? { style: 'thin', color: { argb: 'CCCCCC' } } : undefined,
                        right: c === endColIndex ? { style: 'thin', color: { argb: 'CCCCCC' } } : undefined
                    };
                }
            }
        };

        // Row 4-6: KPI Cards Row 1
        createKPICard(wsDash, 'A', 4, 'कुल आवंटन / Total Allocation (Qt)', "='Sector Detail'!Q2", false, NAVY);
        createKPICard(wsDash, 'C', 4, 'कुल उठाव / Total Dispatch (Qt)', "='Sector Detail'!Q3", false, '1E7B4D');
        createKPICard(wsDash, 'E', 4, 'जिला उठाव % / District Lift %', "='Sector Detail'!Q4", true, '0B2545');
        createKPICard(wsDash, 'G', 4, 'लंबित मात्रा / Pending Quantity (Qt)', "='Sector Detail'!Q5", false, 'B23A2E');

        // Row 8-10: KPI Cards Row 2
        createKPICard(wsDash, 'A', 8, 'औसत POS प्राप्ति % / Avg POS Receipt %', "='Sector Detail'!Q6", true, '2E6F95');
        createKPICard(wsDash, 'C', 8, 'गंभीर सेक्टर / Critical Sectors (<70%)', "='Sector Detail'!Q7", false, 'B23A2E');
        createKPICard(wsDash, 'E', 8, 'निगरानी सेक्टर / Watch Sectors (70-85%)', "='Sector Detail'!Q8", false, 'D98E04');
        createKPICard(wsDash, 'G', 8, 'उत्कृष्ट सेक्टर / Excellent Sectors (>=95%)', "='Sector Detail'!Q9", false, '1E7B4D');

        // Embed Charts into Dashboard if buffers are present
        if (chartBuffers.blockBar) {
            const imageId1 = workbook.addImage({
                buffer: chartBuffers.blockBar,
                extension: 'png'
            });
            wsDash.addImage(imageId1, {
                tl: { col: 0, row: 12 },
                ext: { width: 500, height: 300 }
            });
        }

        if (chartBuffers.tierDonut) {
            const imageId2 = workbook.addImage({
                buffer: chartBuffers.tierDonut,
                extension: 'png'
            });
            wsDash.addImage(imageId2, {
                tl: { col: 4, row: 12 },
                ext: { width: 420, height: 300 }
            });
        }

        // Set column widths for Dashboard
        wsDash.columns.forEach((col) => { col.width = 18; });


        // ════════════════════════════════════════════════════════════════════════
        // SHEET 3: BLOCK SUMMARY
        // ════════════════════════════════════════════════════════════════════════
        const wsBlock = workbook.addWorksheet('Block Summary');
        wsBlock.views = [{ showGridLines: true }];

        wsBlock.mergeCells('A1:H1');
        const bTitle = wsBlock.getCell('A1');
        bTitle.value = `ब्लॉक-वार उठाव प्रदर्शन सारांश / Block-wise Lifting Performance Summary — ${titlePeriod}`;
        bTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } };
        bTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        bTitle.alignment = { vertical: 'middle', horizontal: 'center' };

        const blockHeaders = [
            'Sr.No\nक्र.',
            'Block Name\nब्लॉक नाम',
            'Sectors Count\nसेक्टर संख्या',
            'Allocation (Qt)\nकुल आवंटन',
            'Dispatch (Qt)\nकुल उठाव',
            'Lift %\nउठाव %',
            'Remaining (Qt)\nलंबित मात्रा',
            'Block Rank\nब्लॉक रैंक'
        ];

        wsBlock.getRow(3).values = blockHeaders;
        wsBlock.getRow(3).height = 32;
        wsBlock.getRow(3).eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
        });

        let bRowIdx = 4;
        computed.blocks.forEach((b, idx) => {
            const row = wsBlock.getRow(bRowIdx);
            
            // SUMIF / COUNTIF formulas referencing Sheet 2
            const countFormula = `COUNTIF('Sector Detail'!$B$4:$B$${lastSectorRow}, B${bRowIdx})`;
            const allocFormula = `SUMIF('Sector Detail'!$B$4:$B$${lastSectorRow}, B${bRowIdx}, 'Sector Detail'!$E$4:$E$${lastSectorRow})`;
            const dispFormula = `SUMIF('Sector Detail'!$B$4:$B$${lastSectorRow}, B${bRowIdx}, 'Sector Detail'!$F$4:$F$${lastSectorRow})`;
            const liftFormula = `E${bRowIdx}/D${bRowIdx}`;
            const remFormula = `D${bRowIdx}-E${bRowIdx}`;

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = b.block;
            row.getCell(3).value = { formula: countFormula };
            row.getCell(4).value = { formula: allocFormula };
            row.getCell(5).value = { formula: dispFormula };
            row.getCell(6).value = { formula: liftFormula };
            row.getCell(7).value = { formula: remFormula };

            row.getCell(3).numberFormat = '#,##0';
            row.getCell(4).numberFormat = '#,##0.00';
            row.getCell(5).numberFormat = '#,##0.00';
            row.getCell(6).numberFormat = '0.00%';
            row.getCell(7).numberFormat = '#,##0.00';

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Arial', size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: [1, 3, 6, 8].includes(colNumber) ? 'center' : ([4, 5, 7].includes(colNumber) ? 'right' : 'left') };
                if (bRowIdx % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ZEBRA } };
                }
            });

            bRowIdx++;
        });

        const lastBlockRow = bRowIdx - 1;

        // Apply Rank formula to Column H on Block Summary
        for (let r = 4; r <= lastBlockRow; r++) {
            const rankFormula = `RANK(F${r},$F$4:$F$${lastBlockRow},0)`;
            wsBlock.getCell(`H${r}`).value = { formula: rankFormula };
            wsBlock.getCell(`H${r}`).numberFormat = '#,##0';
        }

        // Block Summary Total Row
        const bTotalRow = wsBlock.getRow(bRowIdx);
        bTotalRow.getCell(2).value = 'कुल योग (TOTAL)';
        bTotalRow.getCell(3).value = { formula: `SUM(C4:C${lastBlockRow})` };
        bTotalRow.getCell(4).value = { formula: `SUM(D4:D${lastBlockRow})` };
        bTotalRow.getCell(5).value = { formula: `SUM(E4:E${lastBlockRow})` };
        bTotalRow.getCell(6).value = { formula: `E${bRowIdx}/D${bRowIdx}` };
        bTotalRow.getCell(7).value = { formula: `D${bRowIdx}-E${bRowIdx}` };
        bTotalRow.getCell(8).value = '-';

        bTotalRow.getCell(3).numberFormat = '#,##0';
        bTotalRow.getCell(4).numberFormat = '#,##0.00';
        bTotalRow.getCell(5).numberFormat = '#,##0.00';
        bTotalRow.getCell(6).numberFormat = '0.00%';
        bTotalRow.getCell(7).numberFormat = '#,##0.00';

        bTotalRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: NAVY } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
            cell.border = { top: { style: 'thin', color: { argb: GOLD } }, bottom: { style: 'double', color: { argb: NAVY } } };
        });

        wsBlock.columns.forEach((col, idx) => {
            col.width = [6, 20, 14, 18, 18, 14, 18, 14][idx] || 15;
        });


        // ════════════════════════════════════════════════════════════════════════
        // SHEET 4: TRANSPORTER ANALYSIS
        // ════════════════════════════════════════════════════════════════════════
        const wsTrans = workbook.addWorksheet('Transporter Analysis');
        wsTrans.views = [{ showGridLines: true }];

        wsTrans.mergeCells('A1:H1');
        const tTitle = wsTrans.getCell('A1');
        tTitle.value = `परिवहनकर्ता कार्यक्षमता एवं क्षमता समीक्षा / Transporter Performance & Capacity Analysis — ${titlePeriod}`;
        tTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } };
        tTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        tTitle.alignment = { vertical: 'middle', horizontal: 'center' };

        const transHeaders = [
            'Sr.No\nक्र.',
            'Transporter Name\nपरिवहनकर्ता नाम',
            'Sector / Block\nसेक्टर / ब्लॉक',
            'Allocation (Qt)\nकुल आवंटन',
            'Dispatch (Qt)\nकुल उठाव',
            'Lift %\nउठाव %',
            'Remaining (Qt)\nलंबित मात्रा',
            'Capacity Remark\nक्षमता टिप्पणी'
        ];

        wsTrans.getRow(3).values = transHeaders;
        wsTrans.getRow(3).height = 32;
        wsTrans.getRow(3).eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
        });

        let tRowIdx = 4;
        computed.transporters.forEach((t, idx) => {
            const row = wsTrans.getRow(tRowIdx);
            
            const allocFormula = `SUMIF('Sector Detail'!$M$4:$M$${lastSectorRow}, B${tRowIdx}, 'Sector Detail'!$E$4:$E$${lastSectorRow})`;
            const dispFormula = `SUMIF('Sector Detail'!$M$4:$M$${lastSectorRow}, B${tRowIdx}, 'Sector Detail'!$F$4:$F$${lastSectorRow})`;
            const liftFormula = `E${tRowIdx}/D${tRowIdx}`;
            const remFormula = `D${tRowIdx}-E${tRowIdx}`;
            const remarkFormula = `IF(ISNUMBER(SEARCH(",", C${tRowIdx})), "एकाधिक सेक्टर — क्षमता जांचें / Multiple sectors — verify capacity", "सामान्य / Normal")`;

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = t.transporter;
            row.getCell(3).value = t.sectorsList || '-';
            row.getCell(4).value = { formula: allocFormula };
            row.getCell(5).value = { formula: dispFormula };
            row.getCell(6).value = { formula: liftFormula };
            row.getCell(7).value = { formula: remFormula };
            row.getCell(8).value = { formula: remarkFormula };

            row.getCell(3).numberFormat = '#,##0';
            row.getCell(4).numberFormat = '#,##0.00';
            row.getCell(5).numberFormat = '#,##0.00';
            row.getCell(6).numberFormat = '0.00%';
            row.getCell(7).numberFormat = '#,##0.00';

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Arial', size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: [1, 3, 6].includes(colNumber) ? 'center' : ([4, 5, 7].includes(colNumber) ? 'right' : 'left') };
                
                // Amber fill for multi-sector transporters
                if (colNumber === 8 && t.hasMultiple) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
                    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: '92400E' } };
                } else if (tRowIdx % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ZEBRA } };
                }
            });

            tRowIdx++;
        });

        wsTrans.columns.forEach((col, idx) => {
            col.width = [6, 26, 16, 18, 18, 14, 18, 42][idx] || 15;
        });


        // ════════════════════════════════════════════════════════════════════════
        // SHEET 5: ACTION PLAN
        // ════════════════════════════════════════════════════════════════════════
        const wsAction = workbook.addWorksheet('Action Plan');
        wsAction.views = [{ showGridLines: true }];

        wsAction.mergeCells('A1:H1');
        const aTitle = wsAction.getCell('A1');
        aTitle.value = `🎯 प्राथमिकता कार्रवाई योजना / Priority Action Plan (Lift % < 85%) — ${titlePeriod}`;
        aTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } };
        aTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'B23A2E' } };
        aTitle.alignment = { vertical: 'middle', horizontal: 'center' };

        const actionHeaders = [
            'Sr.No\nक्र.',
            'Sector Name\nसेक्टर नाम',
            'Block\nब्लॉक',
            'Lift %\nउठाव %',
            'Remaining (Qt)\nलंबित मात्रा',
            'Risk Tier\nजोखिम श्रेणी',
            'Transporter & Mobile\nपरिवहनकर्ता एवं संपर्क',
            'Recommended Action\nअनुशंसित त्वरित कार्रवाई'
        ];

        wsAction.getRow(3).values = actionHeaders;
        wsAction.getRow(3).height = 32;
        wsAction.getRow(3).eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
        });

        let aRowIdx = 4;
        computed.actionPlan.forEach((ap, idx) => {
            const row = wsAction.getRow(aRowIdx);

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = ap.sectorName;
            row.getCell(3).value = ap.block;
            row.getCell(4).value = ap.liftPct;
            row.getCell(5).value = ap.remaining;
            row.getCell(6).value = ap.riskTierHindi || ap.riskTier;
            row.getCell(7).value = ap.transporterInfo;
            row.getCell(8).value = ap.recommendedAction;

            row.getCell(4).numberFormat = '0.00%';
            row.getCell(5).numberFormat = '#,##0.00';

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Arial', size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: [1, 4, 6].includes(colNumber) ? 'center' : ([5].includes(colNumber) ? 'right' : 'left'), wrapText: colNumber === 8 };
                
                if (colNumber === 6) {
                    const colorCfg = TIER_COLORS[ap.riskTier] || TIER_COLORS.Watch;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorCfg.fill } };
                    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: colorCfg.font } };
                } else if (aRowIdx % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ZEBRA } };
                }
            });

            aRowIdx++;
        });

        if (computed.actionPlan.length === 0) {
            const row = wsAction.getRow(4);
            row.getCell(1).value = 1;
            wsAction.mergeCells('B4:H4');
            row.getCell(2).value = '🎉 सभी सेक्टरों में उठाव प्रगति 85% से अधिक है। कोई अति-लंबित सेक्टर नहीं। / All sectors above 85% lift.';
            row.getCell(2).font = { name: 'Arial', size: 10, italic: true, color: { argb: '1E7B4D' } };
        }

        wsAction.columns.forEach((col, idx) => {
            col.width = [6, 22, 16, 12, 16, 14, 26, 48][idx] || 15;
        });

        return workbook;
    }
}

module.exports = AdvancedAnalyticsExcelGenerator;
