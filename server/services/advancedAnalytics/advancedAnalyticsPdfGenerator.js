const puppeteer = require('puppeteer');

class AdvancedAnalyticsPdfGenerator {
    /**
     * Generates HTML string for the 9-page bilingual Executive Report
     * 
     * @param {Object} computed Data computed from AdvancedAnalyticsCompute
     * @param {Object} chartBuffers PNG image buffers from AdvancedAnalyticsChartRenderer
     * @returns {String} HTML String
     */
    generateHtml(computed, chartBuffers = {}) {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthHindi = [
            'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
            'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
        ];
        const monthName = monthNames[computed.month - 1] || `Month ${computed.month}`;
        const monthNameHindi = monthHindi[computed.month - 1] || '';
        const reportPeriod = `${monthNameHindi} ${computed.year} (${monthName} ${computed.year})`;

        // Base64 helper for embedded chart images
        const toDataUri = (buf) => buf ? (typeof buf === 'string' && buf.startsWith('data:') ? buf : `data:image/png;base64,${Buffer.isBuffer(buf) ? buf.toString('base64') : buf}`) : '';
        const blockBarUri = toDataUri(chartBuffers.blockBar);
        const tierDonutUri = toDataUri(chartBuffers.tierDonut);
        const sectorGroupedUri = toDataUri(chartBuffers.sectorGroupedBar);
        const posGapUri = toDataUri(chartBuffers.posGapBar);

        return `
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="utf-8">
            <title>Advanced Analytics Executive Report - ${reportPeriod}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
                
                @page {
                    size: A4 portrait;
                    margin: 14mm 12mm 16mm 12mm;
                }

                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                body {
                    font-family: 'Noto Sans Devanagari', 'Inter', Arial, sans-serif;
                    color: #1e293b;
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                    font-size: 10.5pt;
                    line-height: 1.5;
                }

                .page {
                    page-break-after: always;
                    position: relative;
                    min-height: 265mm;
                    padding-bottom: 25px;
                    margin-bottom: 20px;
                }
                
                .page:last-child {
                    page-break-after: avoid;
                }

                /* Cover Page Styles */
                .cover-header {
                    text-align: center;
                    border-bottom: 3px solid #C9A227;
                    padding-bottom: 15px;
                    margin-bottom: 25px;
                }

                .cover-logo-title {
                    font-size: 20pt;
                    font-weight: 800;
                    color: #0B2545;
                    margin: 0 0 5px 0;
                }

                .cover-sub-agency {
                    font-size: 11pt;
                    font-weight: 600;
                    color: #475569;
                }

                .cover-main-box {
                    background: linear-gradient(135deg, #0B2545 0%, #1e3a8a 100%);
                    color: #ffffff;
                    padding: 30px;
                    border-radius: 12px;
                    text-align: center;
                    margin: 30px 0;
                    box-shadow: 0 10px 25px rgba(11,37,69,0.2);
                }

                .cover-report-title {
                    font-size: 22pt;
                    font-weight: 800;
                    margin: 0 0 10px 0;
                    color: #F8FAFC;
                }

                .cover-report-subtitle {
                    font-size: 13pt;
                    color: #C9A227;
                    font-weight: 600;
                }

                .cover-chips-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin: 30px 0;
                }

                .cover-chip {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-left: 5px solid #0B2545;
                    border-radius: 8px;
                    padding: 15px;
                }

                .cover-chip-val {
                    font-size: 20pt;
                    font-weight: 800;
                    color: #0B2545;
                }

                .cover-chip-lbl {
                    font-size: 9pt;
                    font-weight: 700;
                    color: #64748B;
                }

                /* Header / Footer */
                .section-header {
                    background: #0B2545;
                    color: #ffffff;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-size: 13pt;
                    font-weight: 700;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .section-header-accent {
                    color: #C9A227;
                }

                /* Tables */
                table.report-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                    font-size: 9pt;
                }

                table.report-table th {
                    background-color: #0B2545;
                    color: #ffffff;
                    font-weight: 700;
                    padding: 8px 6px;
                    border: 1px solid #1E293B;
                    text-align: center;
                }

                table.report-table td {
                    padding: 6px;
                    border: 1px solid #E2E8F0;
                    vertical-align: middle;
                }

                table.report-table tr:nth-child(even) {
                    background-color: #F8FAFC;
                }

                .badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 8pt;
                    font-weight: 700;
                    color: #ffffff;
                    text-align: center;
                }

                .badge-critical { background-color: #B23A2E; }
                .badge-watch { background-color: #D98E04; }
                .badge-good { background-color: #2E6F95; }
                .badge-excellent { background-color: #1E7B4D; }

                /* KPI Grid */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .kpi-card {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                }

                .kpi-title { font-size: 8.5pt; font-weight: 600; color: #64748B; margin-bottom: 4px; }
                .kpi-value { font-size: 15pt; font-weight: 800; color: #0B2545; }

                .findings-box {
                    background: #F1F5F9;
                    border-left: 4px solid #0B2545;
                    padding: 14px 18px;
                    border-radius: 0 8px 8px 0;
                    margin-top: 15px;
                }

                .findings-box li {
                    margin-bottom: 8px;
                    font-weight: 500;
                }

                .chart-img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 0 auto 15px auto;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                }

                .page-footer {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8pt;
                    color: #94A3B8;
                    border-top: 1px solid #E2E8F0;
                    padding-top: 6px;
                }
            </style>
        </head>
        <body>

            <!-- PAGE 1: COVER -->
            <div class="page">
                <div class="cover-header">
                    <h1 class="cover-logo-title">मध्य प्रदेश राज्य नागरिक आपूर्ति निगम लिमिटेड</h1>
                    <div class="cover-sub-agency">जिला कार्यालय बैतूल, मध्य प्रदेश | MP State Civil Supplies Corporation Ltd.</div>
                </div>

                <div class="cover-main-box">
                    <div class="cover-report-title">उन्नत विश्लेषण एवं कार्यकारी रिपोर्ट</div>
                    <div class="cover-report-subtitle">ADVANCED ANALYTICAL EXECUTIVE REPORT</div>
                    <div style="margin-top: 15px; font-size: 14pt; font-weight: 700; color: #ffffff;">
                        अवधि: ${reportPeriod}
                    </div>
                </div>

                <div class="cover-chips-grid">
                    <div class="cover-chip">
                        <div class="cover-chip-lbl">कुल आवंटन (TOTAL ALLOCATION)</div>
                        <div class="cover-chip-val">${computed.kpis.totalAllocation.toLocaleString('en-IN', {minimumFractionDigits:2})} Qt.</div>
                    </div>
                    <div class="cover-chip">
                        <div class="cover-chip-lbl">कुल प्रेषित उठाव (TOTAL DISPATCH)</div>
                        <div class="cover-chip-val">${computed.kpis.totalDispatch.toLocaleString('en-IN', {minimumFractionDigits:2})} Qt.</div>
                    </div>
                    <div class="cover-chip">
                        <div class="cover-chip-lbl">जिला उठाव प्रतिशत (DISTRICT LIFT %)</div>
                        <div class="cover-chip-val" style="color: #1E7B4D;">${(computed.kpis.districtLiftPct * 100).toFixed(2)}%</div>
                    </div>
                    <div class="cover-chip">
                        <div class="cover-chip-lbl">लंबित खाद्यान्न (PENDING QTY)</div>
                        <div class="cover-chip-val" style="color: #B23A2E;">${computed.kpis.pendingQty.toLocaleString('en-IN', {minimumFractionDigits:2})} Qt.</div>
                    </div>
                </div>

                <div style="margin-top: 40px; text-align: center; font-size: 9pt; color: #64748B;">
                    <div>रिपोर्ट जनरेशन तिथि एवं समय: <strong>${new Date(computed.generatedAt).toLocaleString('en-GB')}</strong></div>
                    <div>स्रोत डेटा: MP SCM पोर्टल स्वचालित डेटा निष्कर्षण (SQLite इंटेलिजेंस डेटाबेस)</div>
                </div>

                <div class="page-footer">
                    <span>MPSCSC District Office Betul</span>
                    <span>Page 1 of 9</span>
                </div>
            </div>

            <!-- PAGE 2: EXECUTIVE SUMMARY -->
            <div class="page">
                <div class="section-header">
                    <span>1. कार्यकारी सारांश / Executive Summary</span>
                    <span class="section-header-accent">${monthName} ${computed.year}</span>
                </div>

                <p style="font-size: 10pt; line-height: 1.6; text-align: justify; text-justify: inter-word;">
                    माह <strong>${reportPeriod}</strong> के दौरान राष्ट्रीय खाद्य सुरक्षा अधिनियम (NFSA) के अंतर्गत बैतूल जिले के कुल <strong>${computed.kpis.totalSectorsCount}</strong> सेक्टरों में कुल <strong>${computed.kpis.totalAllocation.toLocaleString('en-IN', {minimumFractionDigits:2})} क्विंटल</strong> खाद्यान्न का आवंटन किया गया था। डिपो स्तर से कुल <strong>${computed.kpis.totalDispatch.toLocaleString('en-IN', {minimumFractionDigits:2})} क्विंटल</strong> सामग्री प्रेषित की गई, जिससे जिला स्तर पर समग्र उठाव निष्पादन <strong>${(computed.kpis.districtLiftPct * 100).toFixed(2)}%</strong> दर्ज किया गया। वर्तमान में जिले में कुल <strong>${computed.kpis.pendingQty.toLocaleString('en-IN', {minimumFractionDigits:2})} क्विंटल</strong> सामग्री का प्रदाय लंबित है।
                </p>

                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-title">कुल आवंटन</div><div class="kpi-value">${computed.kpis.totalAllocation.toFixed(1)}</div></div>
                    <div class="kpi-card"><div class="kpi-title">कुल उठाव</div><div class="kpi-value">${computed.kpis.totalDispatch.toFixed(1)}</div></div>
                    <div class="kpi-card"><div class="kpi-title">उठाव %</div><div class="kpi-value" style="color:#1E7B4D;">${(computed.kpis.districtLiftPct * 100).toFixed(1)}%</div></div>
                    <div class="kpi-card"><div class="kpi-title">लंबित (Qt)</div><div class="kpi-value" style="color:#B23A2E;">${computed.kpis.pendingQty.toFixed(1)}</div></div>
                    <div class="kpi-card"><div class="kpi-title">POS प्राप्ति %</div><div class="kpi-value">${(computed.kpis.avgPosReceiptPct * 100).toFixed(1)}%</div></div>
                    <div class="kpi-card"><div class="kpi-title">Critical (<70%)</div><div class="kpi-value" style="color:#B23A2E;">${computed.kpis.criticalSectorsCount}</div></div>
                    <div class="kpi-card"><div class="kpi-title">Watch (70-85%)</div><div class="kpi-value" style="color:#D98E04;">${computed.kpis.watchSectorsCount}</div></div>
                    <div class="kpi-card"><div class="kpi-title">Excellent (>=95%)</div><div class="kpi-value" style="color:#1E7B4D;">${computed.kpis.excellentSectorsCount}</div></div>
                </div>

                <div class="findings-box">
                    <h4 style="margin: 0 0 10px 0; color: #0B2545; font-size: 11pt;">📌 मुख्य निष्कर्ष एवं विश्लेषण बिंदु (Key Findings):</h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 9.5pt;">
                        <li><strong>सर्वश्रेष्ठ प्रदर्शनकर्ता ब्लॉक:</strong> <strong>${computed.findings.bestBlock ? computed.findings.bestBlock.block : 'N/A'}</strong> (उठाव: ${(computed.findings.bestBlock ? computed.findings.bestBlock.liftPct * 100 : 0).toFixed(2)}%)</li>
                        <li><strong>न्यूनतम प्रदर्शनकर्ता ब्लॉक:</strong> <strong>${computed.findings.worstBlock ? computed.findings.worstBlock.block : 'N/A'}</strong> (उठाव: ${(computed.findings.worstBlock ? computed.findings.worstBlock.liftPct * 100 : 0).toFixed(2)}%)</li>
                        <li><strong>सर्वाधिक लंबित सेक्टर:</strong> <strong>${computed.findings.worstSector ? computed.findings.worstSector.sectorName : 'N/A'}</strong> (उठाव: ${(computed.findings.worstSector ? computed.findings.worstSector.liftPct * 100 : 0).toFixed(2)}%, लंबित: ${computed.findings.worstSector ? computed.findings.worstSector.remaining.toFixed(2) : 0} Qt)</li>
                        ${computed.findings.biggestLagSector ? `<li><strong>POS फीडिंग विलंब विसंगति:</strong> सेक्टर <strong>${computed.findings.biggestLagSector.sectorName}</strong> में POS फीडिंग में +${computed.findings.biggestLagSector.posGapPP.toFixed(1)} pp का विलंब दर्ज किया गया है।</li>` : ''}
                        ${computed.findings.biggestOverReceiptSector ? `<li><strong>POS ओवर-रिसीट विसंगति:</strong> सेक्टर <strong>${computed.findings.biggestOverReceiptSector.sectorName}</strong> में दुकान स्तर POS प्राप्ति प्रेषित उठाव से ${computed.findings.biggestOverReceiptSector.posGapPP.toFixed(1)} pp अधिक दर्शाई गई है।</li>` : ''}
                        <li><strong>एकाधिक सेक्टर परिवहनकर्ता:</strong> कुल <strong>${computed.findings.multiSectorTransporters.length}</strong> परिवहनकर्ताओं के पास 1 से अधिक सेक्टर का प्रभार है।</li>
                        <li><strong>त्वरित समीक्षा आवश्यक:</strong> कुल <strong>${computed.findings.sub85Count}</strong> सेक्टरों में उठाव प्रगति 85% से कम है।</li>
                    </ul>
                </div>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 2 of 9</span></div>
            </div>

            <!-- PAGE 3: BLOCK-WISE PERFORMANCE -->
            <div class="page">
                <div class="section-header">
                    <span>2. ब्लॉक-वार निष्पादन विश्लेषण / Block-wise Performance</span>
                    <span class="section-header-accent">Block Matrix</span>
                </div>

                ${blockBarUri ? `<img src="${blockBarUri}" class="chart-img" style="max-height: 240px;" />` : ''}

                <table class="report-table">
                    <thead>
                        <tr>
                            <th>रैंक</th>
                            <th>ब्लॉक नाम</th>
                            <th>सेक्टर</th>
                            <th>आवंटन (Qt)</th>
                            <th>उठाव (Qt)</th>
                            <th>उठाव %</th>
                            <th>लंबित (Qt)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.blocks.map(b => `
                            <tr>
                                <td style="text-align:center; font-weight:700;">#${b.rank}</td>
                                <td style="font-weight:600;">${b.block}</td>
                                <td style="text-align:center;">${b.sectorsCount}</td>
                                <td style="text-align:right;">${b.allocation.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="text-align:right;">${b.dispatch.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="text-align:center; font-weight:700; color: ${b.liftPct >= 0.85 ? '#1E7B4D' : (b.liftPct >= 0.70 ? '#D98E04' : '#B23A2E')};">${(b.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:right;">${b.remaining.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 3 of 9</span></div>
            </div>

            <!-- PAGE 4: RISK CLASSIFICATION -->
            <div class="page">
                <div class="section-header">
                    <span>3. जोखिम श्रेणी विभाजन एवं सेक्टर तुलना / Risk Classification</span>
                    <span class="section-header-accent">Risk Matrix</span>
                </div>

                <div style="display:flex; gap:10px; align-items:center;">
                    ${tierDonutUri ? `<img src="${tierDonutUri}" class="chart-img" style="width:48%; height:auto;" />` : ''}
                    ${sectorGroupedUri ? `<img src="${sectorGroupedUri}" class="chart-img" style="width:48%; height:auto;" />` : ''}
                </div>

                <p style="font-size: 9pt; color: #475569; margin-top: 10px; text-align: justify;">
                    जोखिम वर्गीकरण के अंतर्गत 95% से अधिक उठाव वाले सेक्टरों को <strong>उत्कृष्ट (Green)</strong>, 85-95% उठाव वाले सेक्टरों को <strong>अच्छा (Blue)</strong>, 70-85% उठाव वाले सेक्टरों को <strong>निगरानी (Amber)</strong> एवं 70% से कम उठाव वाले सेक्टरों को <strong>गंभीर (Red)</strong> श्रेणी में विभाजित किया गया है।
                </p>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 4 of 9</span></div>
            </div>

            <!-- PAGE 5: POS GAP ANALYSIS -->
            <div class="page">
                <div class="section-header">
                    <span>4. POS अंतर एवं डेटा विसंगति विश्लेषण / POS Gap Analysis</span>
                    <span class="section-header-accent">POS Integrity</span>
                </div>

                ${posGapUri ? `<img src="${posGapUri}" class="chart-img" style="max-height: 250px;" />` : ''}

                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:15px; border-radius:8px; font-size:9pt; line-height:1.6;">
                    <h4 style="margin:0 0 8px 0; color:#0B2545;">ℹ️ POS अंतर (POS Gap) व्याख्या एवं निर्देश:</h4>
                    <p style="margin:0 0 10px 0;">
                        POS अंतर की गणना <code>(डिपो उठाव % - POS प्राप्ति %) * 100</code> के रूप में की जाती है।
                    </p>
                    <div style="margin-bottom:8px;">
                        <strong style="color:#D98E04;">1. POS फीडिंग विलंब (Gap > +15 pp):</strong> डिपो से सामग्री जारी कर दी गई है, लेकिन उचित मूल्य दुकानों द्वारा मशीनों में प्रविष्टि में विलंब किया गया है।
                    </div>
                    <div>
                        <strong style="color:#6B4C93;">2. POS ओवर-रिसीट विसंगति (Gap < -15 pp):</strong> दुकान स्तर POS में डिपो द्वारा जारी प्रेषित मात्रा से अधिक प्राप्ति दर्ज हुई है। यह डिपो डिस्पैच एवं POS डेटा के मध्य विसंगति को दर्शाता है जिसकी त्वरित तकनीकी जांच आवश्यक है।
                    </div>
                </div>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 5 of 9</span></div>
            </div>

            <!-- PAGE 6: PRIORITY ACTION PLAN -->
            <div class="page">
                <div class="section-header" style="background:#B23A2E;">
                    <span>5. प्राथमिकता कार्रवाई योजना (उठाव < 85%) / Priority Action Plan</span>
                    <span class="section-header-accent" style="color:#ffffff;">Action Items</span>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width:5%;">क्र.</th>
                            <th style="width:20%;">सेक्टर नाम</th>
                            <th style="width:12%;">ब्लॉक</th>
                            <th style="width:10%;">उठाव %</th>
                            <th style="width:12%;">लंबित (Qt)</th>
                            <th style="width:12%;">श्रेणी</th>
                            <th style="width:29%;">अनुशंसित त्वरित कार्रवाई</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.actionPlan.map(ap => `
                            <tr>
                                <td style="text-align:center;">${ap.srNo}</td>
                                <td style="font-weight:600;">${ap.sectorName}</td>
                                <td>${ap.block}</td>
                                <td style="text-align:center; font-weight:700; color:#B23A2E;">${(ap.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:right;">${ap.remaining.toFixed(2)}</td>
                                <td style="text-align:center;"><span class="badge badge-${ap.riskTier.toLowerCase()}">${ap.riskTierHindi}</span></td>
                                <td style="font-size:8pt; white-space:pre-line;">${ap.recommendedAction}</td>
                            </tr>
                        `).join('')}
                        ${computed.actionPlan.length === 0 ? '<tr><td colspan="7" style="text-align:center; color:#1E7B4D; padding:20px;">🎉 सभी सेक्टरों में उठाव प्रगति 85% से अधिक है।</td></tr>' : ''}
                    </tbody>
                </table>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 6 of 9</span></div>
            </div>

            <!-- PAGE 7: TRANSPORTER ANALYSIS -->
            <div class="page">
                <div class="section-header">
                    <span>6. परिवहनकर्ता प्रदर्शन एवं क्षमता समीक्षा / Transporter Analysis</span>
                    <span class="section-header-accent">Transporters</span>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th>क्र.</th>
                            <th>परिवहनकर्ता का नाम</th>
                            <th>आवंटित सेक्टर</th>
                            <th>आवंटन (Qt)</th>
                            <th>उठाव (Qt)</th>
                            <th>उठाव %</th>
                            <th>लंबित (Qt)</th>
                            <th>क्षमता टिप्पणी</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.transporters.map(t => `
                            <tr ${t.hasMultiple ? 'style="background-color:#FEF3C7;"' : ''}>
                                <td style="text-align:center;">${t.srNo}</td>
                                <td style="font-weight:600;">${t.transporter}</td>
                                <td style="text-align:center; font-weight:700;">${t.sectorsCount}</td>
                                <td style="text-align:right;">${t.allocation.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="text-align:right;">${t.dispatch.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="text-align:center; font-weight:700;">${(t.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:right;">${t.remaining.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="font-size:8pt; ${t.hasMultiple ? 'color:#92400E; font-weight:700;' : ''}">${t.remark}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 7 of 9</span></div>
            </div>

            <!-- PAGE 8 & 9: APPENDIX - FULL SECTOR DATA -->
            <div class="page">
                <div class="section-header">
                    <span>7. परिशिष्ट: पूर्ण सेक्टर डेटाबेस (भाग 1) / Full Sector Appendix</span>
                    <span class="section-header-accent">Page 8</span>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th>रैंक</th>
                            <th>ब्लॉक</th>
                            <th>सेक्टर नाम</th>
                            <th>आवंटन</th>
                            <th>उठाव</th>
                            <th>उठाव %</th>
                            <th>POS %</th>
                            <th>POS Gap</th>
                            <th>श्रेणी</th>
                            <th>परिवहनकर्ता</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.sectors.slice(0, 14).map(s => `
                            <tr>
                                <td style="text-align:center; font-weight:700;">#${s.districtRank}</td>
                                <td>${s.block}</td>
                                <td style="font-weight:600;">${s.sectorName}</td>
                                <td style="text-align:right;">${s.allocation.toFixed(1)}</td>
                                <td style="text-align:right;">${s.dispatch.toFixed(1)}</td>
                                <td style="text-align:center; font-weight:700;">${(s.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:center;">${(s.posReceiptPct * 100).toFixed(2)}%</td>
                                <td style="text-align:center; ${Math.abs(s.posGapPP) > 15 ? (s.posGapPP > 0 ? 'color:#D98E04; font-weight:700;' : 'color:#6B4C93; font-weight:700;') : ''}">${s.posGapPP > 0 ? '+' : ''}${s.posGapPP.toFixed(1)} pp</td>
                                <td style="text-align:center;"><span class="badge badge-${s.riskTier.toLowerCase()}">${s.riskTierHindi}</span></td>
                                <td>${s.transporter}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 8 of 9</span></div>
            </div>

            <div class="page">
                <div class="section-header">
                    <span>7. परिशिष्ट: पूर्ण सेक्टर डेटाबेस (भाग 2) / Full Sector Appendix</span>
                    <span class="section-header-accent">Page 9</span>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th>रैंक</th>
                            <th>ब्लॉक</th>
                            <th>सेक्टर नाम</th>
                            <th>आवंटन</th>
                            <th>उठाव</th>
                            <th>उठाव %</th>
                            <th>POS %</th>
                            <th>POS Gap</th>
                            <th>श्रेणी</th>
                            <th>परिवहनकर्ता</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.sectors.slice(14).map(s => `
                            <tr>
                                <td style="text-align:center; font-weight:700;">#${s.districtRank}</td>
                                <td>${s.block}</td>
                                <td style="font-weight:600;">${s.sectorName}</td>
                                <td style="text-align:right;">${s.allocation.toFixed(1)}</td>
                                <td style="text-align:right;">${s.dispatch.toFixed(1)}</td>
                                <td style="text-align:center; font-weight:700;">${(s.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:center;">${(s.posReceiptPct * 100).toFixed(2)}%</td>
                                <td style="text-align:center; ${Math.abs(s.posGapPP) > 15 ? (s.posGapPP > 0 ? 'color:#D98E04; font-weight:700;' : 'color:#6B4C93; font-weight:700;') : ''}">${s.posGapPP > 0 ? '+' : ''}${s.posGapPP.toFixed(1)} pp</td>
                                <td style="text-align:center;"><span class="badge badge-${s.riskTier.toLowerCase()}">${s.riskTierHindi}</span></td>
                                <td>${s.transporter}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="page-footer"><span>MPSCSC District Office Betul</span><span>Page 9 of 9</span></div>
            </div>

        </body>
        </html>
        `;
    }

    /**
     * Generates a 9-page bilingual PDF Executive Report via Puppeteer
     * 
     * @param {Object} computed Data computed from AdvancedAnalyticsCompute
     * @param {Object} chartBuffers PNG image buffers from AdvancedAnalyticsChartRenderer
     * @returns {Promise<Buffer>} PDF Buffer
     */
    async generatePdf(computed, chartBuffers = {}) {
        let browser = null;
        try {
            const html = this.generateHtml(computed, chartBuffers);

            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '14mm', right: '12mm', bottom: '16mm', left: '12mm' }
            });

            return Buffer.from(pdfBuffer);
        } catch (error) {
            console.error('Failed to generate advanced analytics PDF:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }
}

module.exports = AdvancedAnalyticsPdfGenerator;
