const puppeteer = require('puppeteer');

class AdvancedAnalyticsPdfGenerator {
    /**
     * Generates HTML string for the MNC-Level Executive Report (5-Page Board-Room Quality)
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
        const reqMonth = computed.month || (computed.report ? computed.report.month : null) || 9;
        const reqYear = computed.year || (computed.report ? computed.report.year : null) || 2026;
        const monthName = monthNames[reqMonth - 1] || `Month ${reqMonth}`;
        const monthNameHindi = monthHindi[reqMonth - 1] || '';
        const reportPeriod = `${monthNameHindi} ${reqYear} (${monthName} ${reqYear})`;

        // Base64 helper for embedded chart images
        const toDataUri = (buf) => buf ? (typeof buf === 'string' && buf.startsWith('data:') ? buf : `data:image/png;base64,${Buffer.isBuffer(buf) ? buf.toString('base64') : buf}`) : '';
        const blockBarUri = toDataUri(chartBuffers.blockBar);
        const tierDonutUri = toDataUri(chartBuffers.tierDonut);
        const sectorGroupedUri = toDataUri(chartBuffers.sectorGroupedBar);
        const posGapUri = toDataUri(chartBuffers.posGapBar);

        const genDateStr = new Date(computed.generatedAt).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        return `
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="utf-8">
            <title>Executive Analytics Report - ${reportPeriod}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');
                
                @page {
                    size: A4 portrait;
                    margin: 10mm 10mm 12mm 10mm;
                }

                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                body {
                    font-family: 'Inter', 'Noto Sans Devanagari', -apple-system, sans-serif;
                    color: #0F172A;
                    margin: 0;
                    padding: 0;
                    background: #FFFFFF;
                    font-size: 8.5pt;
                    line-height: 1.4;
                }

                .page {
                    page-break-after: always;
                    position: relative;
                    height: 272mm;
                    box-sizing: border-box;
                    padding-bottom: 12mm;
                }
                
                .page:last-child {
                    page-break-after: avoid;
                }

                /* Header & Running Bar */
                .top-branding-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #0B192C;
                    color: #FFFFFF;
                    padding: 8px 14px;
                    border-radius: 6px;
                    margin-bottom: 10px;
                    border-bottom: 3px solid #D97706;
                }

                .brand-title {
                    font-size: 11pt;
                    font-weight: 800;
                    letter-spacing: 0.3px;
                }

                .brand-subtitle {
                    font-size: 8pt;
                    color: #94A3B8;
                    font-weight: 500;
                }

                .doc-type-tag {
                    background: rgba(217, 119, 6, 0.2);
                    color: #FBBF24;
                    border: 1px solid rgba(251, 191, 36, 0.4);
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 7.5pt;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Section Titles */
                .section-header {
                    background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%);
                    color: #FFFFFF;
                    padding: 7px 12px;
                    border-radius: 5px;
                    font-size: 10pt;
                    font-weight: 700;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-left: 4px solid #D97706;
                }

                .section-header-accent {
                    color: #FBBF24;
                    font-size: 8pt;
                    font-weight: 600;
                }

                /* KPI Cards Grid */
                .kpi-grid-main {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 8px;
                    margin-bottom: 10px;
                }

                .kpi-card-exec {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-top: 3px solid #0B192C;
                    border-radius: 6px;
                    padding: 8px 6px;
                    text-align: center;
                }

                .kpi-card-exec.kpi-critical { border-top-color: #DC2626; background: #FEF2F2; }
                .kpi-card-exec.kpi-warning { border-top-color: #D97706; background: #FFFBEB; }
                .kpi-card-exec.kpi-success { border-top-color: #059669; background: #ECFDF5; }

                .kpi-lbl {
                    font-size: 7pt;
                    font-weight: 700;
                    color: #64748B;
                    text-transform: uppercase;
                    letter-spacing: 0.2px;
                    margin-bottom: 2px;
                }

                .kpi-val {
                    font-size: 13pt;
                    font-weight: 800;
                    color: #0F172A;
                    line-height: 1.1;
                }

                .kpi-sub {
                    font-size: 6.5pt;
                    color: #475569;
                    margin-top: 2px;
                }

                /* Executive Narrative Banner */
                .exec-narrative-box {
                    background: #F1F5F9;
                    border: 1px solid #CBD5E1;
                    border-left: 4px solid #0B192C;
                    border-radius: 6px;
                    padding: 9px 12px;
                    margin-bottom: 10px;
                    font-size: 8.5pt;
                    line-height: 1.45;
                }

                .exec-narrative-title {
                    font-weight: 800;
                    color: #0B192C;
                    margin-bottom: 4px;
                    font-size: 9pt;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                /* 2-Column Dashboard Cards Grid */
                .findings-cards-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-bottom: 10px;
                }

                .finding-card {
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    padding: 8px 10px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                }

                .finding-card-title {
                    font-size: 7.5pt;
                    font-weight: 700;
                    color: #64748B;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }

                .finding-card-val {
                    font-size: 10.5pt;
                    font-weight: 800;
                    color: #0B192C;
                }

                .finding-card-desc {
                    font-size: 7.5pt;
                    color: #475569;
                    margin-top: 2px;
                }

                /* At-a-Glance Matrix */
                .at-a-glance-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    margin-bottom: 10px;
                }

                .glance-box {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    padding: 8px 10px;
                }

                .glance-head {
                    font-size: 7.5pt;
                    font-weight: 800;
                    color: #0B192C;
                    border-bottom: 2px solid #E2E8F0;
                    padding-bottom: 3px;
                    margin-bottom: 5px;
                }

                .glance-body {
                    font-size: 7.5pt;
                    color: #334155;
                    line-height: 1.35;
                }

                /* Tables */
                table.report-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    font-size: 8pt;
                }

                table.report-table th {
                    background-color: #0B192C;
                    color: #FFFFFF;
                    font-weight: 700;
                    padding: 5px 6px;
                    border: 1px solid #1E293B;
                    text-align: center;
                    font-size: 7.5pt;
                }

                table.report-table td {
                    padding: 4px 6px;
                    border: 1px solid #E2E8F0;
                    vertical-align: middle;
                }

                table.report-table tr:nth-child(even) {
                    background-color: #F8FAFC;
                }

                .badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 7pt;
                    font-weight: 700;
                    text-align: center;
                    line-height: 1.2;
                }

                .badge-critical { background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; }
                .badge-watch { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
                .badge-good { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }
                .badge-excellent { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }

                /* Chart Containers */
                .charts-row-dual {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .chart-box-half {
                    width: 50%;
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    padding: 6px;
                    text-align: center;
                }

                .chart-img-fitted {
                    max-width: 100%;
                    max-height: 185px;
                    height: auto;
                    display: block;
                    margin: 0 auto;
                }

                .info-callout-box {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-left: 4px solid #D97706;
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-size: 8pt;
                    line-height: 1.45;
                    margin-bottom: 8px;
                }

                .urgent-callout-banner {
                    background: #FEF2F2;
                    border: 1px solid #FCA5A5;
                    border-left: 4px solid #DC2626;
                    color: #991B1B;
                    padding: 6px 10px;
                    border-radius: 5px;
                    font-size: 8pt;
                    font-weight: 700;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                /* Footer */
                .page-footer {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: space-between;
                    font-size: 7.5pt;
                    color: #64748B;
                    border-top: 1px solid #E2E8F0;
                    padding-top: 4px;
                }
            </style>
        </head>
        <body>

            <!-- PAGE 1: EXECUTIVE COVER & HIGH-LEVEL DASHBOARD -->
            <div class="page">
                <div class="top-branding-bar">
                    <div>
                        <div class="brand-title">मध्य प्रदेश राज्य नागरिक आपूर्ति निगम लिमिटेड</div>
                        <div class="brand-subtitle">District Office Betul, Madhya Pradesh | PDS Lifting Intelligence Portal</div>
                    </div>
                    <div class="doc-type-tag">Executive Board Report</div>
                </div>

                <div style="background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%); color: #FFFFFF; padding: 14px 18px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 14pt; font-weight: 800; color: #FFFFFF;">उन्नत विश्लेषण एवं कार्यकारी रिपोर्ट</div>
                        <div style="font-size: 9pt; color: #FBBF24; font-weight: 600;">ADVANCED ANALYTICAL EXECUTIVE REPORT — PDS LIFTING MANAGEMENT</div>
                    </div>
                    <div style="text-align: right; font-size: 8pt; color: #94A3B8;">
                        <div>रिपोर्ट अवधि: <strong style="color:#FFFFFF;">${reportPeriod}</strong></div>
                        <div>जनरेशन दिनांक: <strong style="color:#FFFFFF;">${genDateStr}</strong></div>
                    </div>
                </div>

                <!-- 6 Main KPI Cards -->
                <div class="kpi-grid-main">
                    <div class="kpi-card-exec">
                        <div class="kpi-lbl">कुल आवंटन</div>
                        <div class="kpi-val">${computed.kpis.totalAllocation.toLocaleString('en-IN', {maximumFractionDigits:1})}</div>
                        <div class="kpi-sub">Total Allocation (Qt)</div>
                    </div>
                    <div class="kpi-card-exec">
                        <div class="kpi-lbl">कुल प्रेषित उठाव</div>
                        <div class="kpi-val">${computed.kpis.totalDispatch.toLocaleString('en-IN', {maximumFractionDigits:1})}</div>
                        <div class="kpi-sub">Total Dispatch (Qt)</div>
                    </div>
                    <div class="kpi-card-exec kpi-critical">
                        <div class="kpi-lbl">जिला उठाव %</div>
                        <div class="kpi-val" style="color:#DC2626;">${(computed.kpis.districtLiftPct * 100).toFixed(2)}%</div>
                        <div class="kpi-sub">District Lift Rate</div>
                    </div>
                    <div class="kpi-card-exec kpi-critical">
                        <div class="kpi-lbl">लंबित खाद्यान्न</div>
                        <div class="kpi-val" style="color:#DC2626;">${computed.kpis.pendingQty.toLocaleString('en-IN', {maximumFractionDigits:1})}</div>
                        <div class="kpi-sub">Pending Quantity (Qt)</div>
                    </div>
                    <div class="kpi-card-exec">
                        <div class="kpi-lbl">POS प्राप्ति %</div>
                        <div class="kpi-val">${(computed.kpis.avgPosReceiptPct * 100).toFixed(2)}%</div>
                        <div class="kpi-sub">Average POS Receipt</div>
                    </div>
                    <div class="kpi-card-exec kpi-critical">
                        <div class="kpi-lbl">गंभीर सेक्टर (<70%)</div>
                        <div class="kpi-val" style="color:#DC2626;">${computed.kpis.criticalSectorsCount} / ${computed.kpis.totalSectorsCount}</div>
                        <div class="kpi-sub">Critical Sectors</div>
                    </div>
                </div>

                <!-- Executive Narrative Banner -->
                <div class="exec-narrative-box">
                    <div class="exec-narrative-title">📋 कार्यकारी सारांश / Executive Summary Snapshot:</div>
                    माह <strong>${reportPeriod}</strong> के दौरान राष्ट्रीय खाद्य सुरक्षा अधिनियम (NFSA) के अंतर्गत बैतूल जिले के कुल <strong>${computed.kpis.totalSectorsCount} सेक्टरों</strong> में कुल <strong>${computed.kpis.totalAllocation.toLocaleString('en-IN', {minimumFractionDigits:2})} क्विंटल</strong> खाद्यान्न का आवंटन किया गया था। डिपो स्तर से केवल <strong>${computed.kpis.totalDispatch.toLocaleString('en-IN', {minimumFractionDigits:2})} क्विंटल</strong> सामग्री प्रेषित की गई, जिससे जिला स्तर पर समग्र उठाव निष्पादन <strong>${(computed.kpis.districtLiftPct * 100).toFixed(2)}%</strong> दर्ज किया गया। वर्तमान में जिले में कुल <strong>${computed.kpis.pendingQty.toLocaleString('en-IN', {minimumFractionDigits:2})} क्विंटल</strong> सामग्री का प्रदाय लंबित है, जिसे त्वरित प्रबंधकीय हस्तक्षेप द्वारा पूर्ण किया जाना आवश्यक है।
                </div>

                <!-- 6 Key Finding Cards -->
                <div class="findings-cards-grid">
                    <div class="finding-card" style="border-left: 3px solid #059669;">
                        <div class="finding-card-title">🏆 सर्वश्रेष्ठ प्रदर्शनकर्ता ब्लॉक</div>
                        <div class="finding-card-val">${computed.findings.bestBlock ? computed.findings.bestBlock.block : 'N/A'}</div>
                        <div class="finding-card-desc">उठाव निष्पादन: <strong>${(computed.findings.bestBlock ? computed.findings.bestBlock.liftPct * 100 : 0).toFixed(2)}%</strong></div>
                    </div>
                    <div class="finding-card" style="border-left: 3px solid #DC2626;">
                        <div class="finding-card-title">⚠️ न्यूनतम प्रदर्शनकर्ता ब्लॉक</div>
                        <div class="finding-card-val">${computed.findings.worstBlock ? computed.findings.worstBlock.block : 'N/A'}</div>
                        <div class="finding-card-desc">उठाव निष्पादन: <strong>${(computed.findings.worstBlock ? computed.findings.worstBlock.liftPct * 100 : 0).toFixed(2)}%</strong></div>
                    </div>
                    <div class="finding-card" style="border-left: 3px solid #DC2626;">
                        <div class="finding-card-title">🚨 सर्वाधिक लंबित सेक्टर</div>
                        <div class="finding-card-val">${computed.findings.worstSector ? computed.findings.worstSector.sectorName : 'N/A'}</div>
                        <div class="finding-card-desc">उठाव: <strong>${(computed.findings.worstSector ? computed.findings.worstSector.liftPct * 100 : 0).toFixed(2)}%</strong> | लंबित: <strong>${computed.findings.worstSector ? computed.findings.worstSector.remaining.toFixed(1) : 0} Qt</strong></div>
                    </div>
                    <div class="finding-card" style="border-left: 3px solid #D97706;">
                        <div class="finding-card-title">⏱️ POS फीडिंग विलंब विसंगति</div>
                        <div class="finding-card-val">${computed.findings.biggestLagSector ? computed.findings.biggestLagSector.sectorName : 'N/A'}</div>
                        <div class="finding-card-desc">POS प्रविष्टि में <strong>+${computed.findings.biggestLagSector ? computed.findings.biggestLagSector.posGapPP.toFixed(1) : 0}%</strong> का विलंब दर्ज हुआ है।</div>
                    </div>
                    <div class="finding-card" style="border-left: 3px solid #2563EB;">
                        <div class="finding-card-title">🚚 एकाधिक सेक्टर परिवहनकर्ता</div>
                        <div class="finding-card-val">${computed.findings.multiSectorTransporters.length} परिवहनकर्ता</div>
                        <div class="finding-card-desc">1 से अधिक सेक्टर का प्रभार (क्षमता समीक्षा आवश्यक)।</div>
                    </div>
                    <div class="finding-card" style="border-left: 3px solid #DC2626;">
                        <div class="finding-card-title">📢 त्वरित समीक्षा आवश्यक</div>
                        <div class="finding-card-val">${computed.findings.sub85Count} सेक्टर</div>
                        <div class="finding-card-desc">कुल 22 में से 22 सेक्टरों में उठाव 85% से कम है।</div>
                    </div>
                </div>

                <!-- Management At-a-Glance Matrix -->
                <div class="at-a-glance-grid">
                    <div class="glance-box">
                        <div class="glance-head">1. वर्तमान स्थिति (What)</div>
                        <div class="glance-body">समग्र जिला उठाव <strong>${(computed.kpis.districtLiftPct * 100).toFixed(2)}%</strong> है। डिपो प्रदाय गति अति-लंबित है।</div>
                    </div>
                    <div class="glance-box">
                        <div class="glance-head">2. समस्या क्षेत्र (Where)</div>
                        <div class="glance-body">आठनेर (4.70%) एवं आमला (5.35%) ब्लॉक में न्यूनतम उठाव निष्पादन दर्ज हुआ है।</div>
                    </div>
                    <div class="glance-box">
                        <div class="glance-head">3. डेटा विसंगति (POS Gap)</div>
                        <div class="glance-body">घोड़ाडोंगरी सेक्टर 7 में POS फीडिंग विलंब <strong>+17.3%</strong> है (दुकान स्तर एंट्री लंबित)।</div>
                    </div>
                    <div class="glance-box">
                        <div class="glance-head">4. त्वरित निर्देश (Action)</div>
                        <div class="glance-body">सभी 22 सेक्टरों में 48 घंटे के भीतर परिवहन समीक्षा एवं डिपो डिस्पैच गति बढ़ाने के निर्देश जारी।</div>
                    </div>
                </div>

                <div class="page-footer">
                    <span>MPSCSC District Office Betul | PDS Lifting Intelligence</span>
                    <span>Page 1 of 5</span>
                </div>
            </div>

            <!-- PAGE 2: BLOCK PERFORMANCE & RISK MATRIX -->
            <div class="page">
                <div class="section-header">
                    <span>1. ब्लॉक-वार निष्पादन एवं जोखिम विश्लेषण / Block-wise Performance & Risk Matrix</span>
                    <span class="section-header-accent">Block Matrix & Risk Distribution</span>
                </div>

                <div class="charts-row-dual">
                    <div class="chart-box-half">
                        <div style="font-size: 8pt; font-weight: 700; color: #0B192C; margin-bottom: 4px;">ब्लॉक-वार उठाव प्रतिशत / Block-wise Lift %</div>
                        ${blockBarUri ? `<img src="${blockBarUri}" class="chart-img-fitted" />` : ''}
                    </div>
                    <div class="chart-box-half">
                        <div style="font-size: 8pt; font-weight: 700; color: #0B192C; margin-bottom: 4px;">जोखिम श्रेणी विभाजन / Risk Tier Distribution</div>
                        ${tierDonutUri ? `<img src="${tierDonutUri}" class="chart-img-fitted" />` : ''}
                    </div>
                </div>

                <!-- Block-wise Performance Table -->
                <div style="font-size: 8.5pt; font-weight: 800; color: #0B192C; margin-bottom: 4px;">📊 ब्लॉक-वार निष्पादन तालिका / Block Performance Summary Table:</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width:7%;">रैंक</th>
                            <th style="width:25%;">ब्लॉक नाम</th>
                            <th style="width:10%;">सेक्टर count</th>
                            <th style="width:16%;">आवंटन (Qt)</th>
                            <th style="width:16%;">उठाव (Qt)</th>
                            <th style="width:12%;">उठाव %</th>
                            <th style="width:14%;">लंबित (Qt)</th>
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
                                <td style="text-align:center; font-weight:700; color: ${b.liftPct >= 0.85 ? '#059669' : (b.liftPct >= 0.70 ? '#D97706' : '#DC2626')};">${(b.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:right; font-weight:600; color:#DC2626;">${b.remaining.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="info-callout-box" style="margin-top: 6px;">
                    <strong>ℹ️ जोखिम वर्गीकरण मानक / Risk Classification Standard:</strong><br/>
                    • <span class="badge badge-excellent">उत्कृष्ट (Green)</span>: lift &ge; 95% | 
                    • <span class="badge badge-good">अच्छा (Blue)</span>: 85% &le; lift &lt; 95% | 
                    • <span class="badge badge-watch">निगरानी (Amber)</span>: 70% &le; lift &lt; 85% | 
                    • <span class="badge badge-critical">गंभीर (Red)</span>: lift &lt; 70%<br/>
                    <em>वर्तमान में जिले के सभी 22 सेक्टर <span style="color:#DC2626; font-weight:700;">गंभीर (Critical < 70%)</span> श्रेणी में हैं।</em>
                </div>

                <div class="page-footer">
                    <span>MPSCSC District Office Betul | PDS Lifting Intelligence</span>
                    <span>Page 2 of 5</span>
                </div>
            </div>

            <!-- PAGE 3: POS GAP INTEGRITY & TRANSPORTER PERFORMANCE -->
            <div class="page">
                <div class="section-header">
                    <span>2. POS अंतर एवं परिवहनकर्ता प्रदर्शन समीक्षा / POS Gap Analysis & Transporter Performance</span>
                    <span class="section-header-accent">POS Integrity & Transporters</span>
                </div>

                <!-- POS Gap Section -->
                <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                    <div style="width: 55%; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 6px; text-align: center;">
                        <div style="font-size: 8pt; font-weight: 700; color: #0B192C; margin-bottom: 4px;">शीर्ष POS अंतर विसंगतियां / Top POS Gap Anomalies (%)</div>
                        ${posGapUri ? `<img src="${posGapUri}" class="chart-img-fitted" style="max-height: 160px;" />` : ''}
                    </div>
                    <div style="width: 45%; background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #D97706; border-radius: 6px; padding: 8px 10px; font-size: 7.8pt; line-height: 1.4;">
                        <div style="font-weight: 800; color: #0B192C; margin-bottom: 4px; font-size: 8.5pt;">ℹ️ POS अंतर (POS Gap) व्याख्या:</div>
                        POS Gap सूत्र: <code>(डिपो उठाव % - POS प्राप्ति %) * 100</code><br/><br/>
                        <strong style="color:#D97706;">1. POS फीडिंग विलंब (Gap > +15%):</strong> डिपो से प्रेषित हो चुका है, लेकिन FPS स्तर मशीनों में एंट्री लंबित है।<br/>
                        <em>घोड़ाडोंगरी सेक्टर क्र 7 में +17.3% का फीडिंग विलंब दर्ज है।</em><br/><br/>
                        <strong style="color:#7C3AED;">2. POS ओवर-रिसीट विसंगति (Gap < -15%):</strong> डिपो प्रेषण से अधिक POS प्रविष्टि दर्ज।
                    </div>
                </div>

                <!-- Transporter Table -->
                <div style="font-size: 8.5pt; font-weight: 800; color: #0B192C; margin-bottom: 4px;">🚚 परिवहनकर्ता प्रदर्शन एवं क्षमता समीक्षा तालिका / Transporter Operational Review:</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width:5%;">क्र.</th>
                            <th style="width:24%;">परिवहनकर्ता का नाम</th>
                            <th style="width:10%;">आवंटित सेक्टर</th>
                            <th style="width:14%;">आवंटन (Qt)</th>
                            <th style="width:14%;">उठाव (Qt)</th>
                            <th style="width:10%;">उठाव %</th>
                            <th style="width:12%;">लंबित (Qt)</th>
                            <th style="width:11%;">क्षमता टिप्पणी</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.transporters.map(t => `
                            <tr ${t.hasMultiple ? 'style="background-color:#FFFBEB;"' : ''}>
                                <td style="text-align:center;">${t.srNo}</td>
                                <td style="font-weight:600;">${t.transporter}</td>
                                <td style="text-align:center; font-weight:700;">${t.sectorsCount}</td>
                                <td style="text-align:right;">${t.allocation.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="text-align:right;">${t.dispatch.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="text-align:center; font-weight:700; color: ${t.liftPct >= 0.85 ? '#059669' : (t.liftPct >= 0.70 ? '#D97706' : '#DC2626')};">${(t.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:right; font-weight:600;">${t.remaining.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                <td style="font-size:7.5pt; ${t.hasMultiple ? 'color:#D97706; font-weight:700;' : ''}">${t.remark}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="page-footer">
                    <span>MPSCSC District Office Betul | PDS Lifting Intelligence</span>
                    <span>Page 3 of 5</span>
                </div>
            </div>

            <!-- PAGE 4: PRIORITY ACTION PLAN (ALL 22 SECTORS) -->
            <div class="page">
                <div class="section-header" style="background: linear-gradient(135deg, #7F1D1D 0%, #B91C1C 100%);">
                    <span>3. प्राथमिकता कार्रवाई योजना (उठाव < 85%) / Priority Action Plan (All 22 Sectors)</span>
                    <span class="section-header-accent" style="color:#FEE2E2;">Urgent Interventions Required</span>
                </div>

                <div class="urgent-callout-banner">
                    <span>🚨 प्राथमिकता कार्रवाई निर्देश: सभी 22 सेक्टरों में उठाव 85% से कम है। 48 घंटे के भीतर प्रदाय सुनिश्चित करें एवं समीक्षा करें।</span>
                    <span style="background:#DC2626; color:#FFFFFF; padding:2px 6px; border-radius:3px; font-size:7pt;">48-Hour SLA</span>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width:4%;">क्र.</th>
                            <th style="width:14%;">सेक्टर नाम</th>
                            <th style="width:11%;">ब्लॉक</th>
                            <th style="width:9%;">उठाव %</th>
                            <th style="width:11%;">लंबित (Qt)</th>
                            <th style="width:9%;">श्रेणी</th>
                            <th style="width:42%;">अनुशंसित त्वरित कार्रवाई (Recommended Action Plan)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.actionPlan.map(ap => `
                            <tr>
                                <td style="text-align:center; font-weight:700;">${ap.srNo}</td>
                                <td style="font-weight:600;">${ap.sectorName}</td>
                                <td>${ap.block}</td>
                                <td style="text-align:center; font-weight:700; color:#DC2626;">${(ap.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:right; font-weight:600;">${ap.remaining.toFixed(2)}</td>
                                <td style="text-align:center;"><span class="badge badge-${ap.riskTier.toLowerCase()}">${ap.riskTierHindi}</span></td>
                                <td style="font-size:7.5pt; line-height:1.25; white-space:pre-line;">${ap.recommendedAction}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="page-footer">
                    <span>MPSCSC District Office Betul | PDS Lifting Intelligence</span>
                    <span>Page 4 of 5</span>
                </div>
            </div>

            <!-- PAGE 5: FULL SECTOR APPENDIX & STRATEGIC RECOMMENDATIONS -->
            <div class="page">
                <div class="section-header">
                    <span>4. परिशिष्ट: पूर्ण सेक्टर डेटाबेस एवं प्रबंधकीय प्राथमिकताएं / Full Sector Appendix & Management Priorities</span>
                    <span class="section-header-accent">Master Database & Strategic Roadmap</span>
                </div>

                <!-- Complete 22 Sector Table -->
                <div style="font-size: 8pt; font-weight: 800; color: #0B192C; margin-bottom: 3px;">📖 पूर्ण सेक्टर मास्टर डेटाबेस (Full 22-Sector Master Database):</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width:4%;">रैंक</th>
                            <th style="width:9%;">ब्लॉक</th>
                            <th style="width:13%;">सेक्टर नाम</th>
                            <th style="width:9%;">आवंटन</th>
                            <th style="width:9%;">उठाव</th>
                            <th style="width:8%;">उठाव %</th>
                            <th style="width:8%;">POS %</th>
                            <th style="width:9%;">POS Gap (%)</th>
                            <th style="width:8%;">श्रेणी</th>
                            <th style="width:23%;">परिवहनकर्ता</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${computed.sectors.map(s => `
                            <tr>
                                <td style="text-align:center; font-weight:700;">#${s.districtRank}</td>
                                <td>${s.block}</td>
                                <td style="font-weight:600;">${s.sectorName}</td>
                                <td style="text-align:right;">${s.allocation.toFixed(1)}</td>
                                <td style="text-align:right;">${s.dispatch.toFixed(1)}</td>
                                <td style="text-align:center; font-weight:700; color:${s.liftPct >= 0.85 ? '#059669' : (s.liftPct >= 0.70 ? '#D97706' : '#DC2626')};">${(s.liftPct * 100).toFixed(2)}%</td>
                                <td style="text-align:center;">${(s.posReceiptPct * 100).toFixed(2)}%</td>
                                <td style="text-align:center; ${Math.abs(s.posGapPP) > 15 ? (s.posGapPP > 0 ? 'color:#D97706; font-weight:700;' : 'color:#7C3AED; font-weight:700;') : ''}">${s.posGapPP > 0 ? '+' : ''}${s.posGapPP.toFixed(1)}%</td>
                                <td style="text-align:center;"><span class="badge badge-${s.riskTier.toLowerCase()}">${s.riskTierHindi}</span></td>
                                <td>${s.transporter}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- Section 5: Executive Management Priorities & Report Enhancements -->
                <div style="display: flex; gap: 8px; margin-top: 6px;">
                    <div style="width: 50%; background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 3px solid #0B192C; border-radius: 5px; padding: 6px 8px; font-size: 7.5pt;">
                        <div style="font-weight: 800; color: #0B192C; margin-bottom: 3px; font-size: 8pt;">🎯 प्रबंधकीय प्राथमिकताएं / Executive Management Priorities:</div>
                        <table style="width:100%; border-collapse:collapse; font-size:7pt;">
                            <tr style="border-bottom:1px solid #CBD5E1; font-weight:700; color:#475569;">
                                <th>मुद्दा (Issue)</th>
                                <th>अनुशंसित कार्रवाई</th>
                                <th>Urgency</th>
                            </tr>
                            <tr style="border-bottom:1px solid #E2E8F0;">
                                <td><strong>0% डिपो उठाव</strong></td>
                                <td>आठनेर #15 व आमला #21 हेतु तत्काल वाहन आवंटन आदेश</td>
                                <td style="color:#DC2626; font-weight:700;">24-Hours</td>
                            </tr>
                            <tr style="border-bottom:1px solid #E2E8F0;">
                                <td><strong>POS फीडिंग विलंब</strong></td>
                                <td>घोड़ाडोंगरी #7 में उचित मूल्य दुकानों की भौतिक एंट्री जांच</td>
                                <td style="color:#D97706; font-weight:700;">48-Hours</td>
                            </tr>
                            <tr>
                                <td><strong>बहु-सेक्टर प्रभार</strong></td>
                                <td>श्री पीयूष आर्य के प्रभार क्षेत्र में अतिरिक्त वाहन तैनाती</td>
                                <td style="color:#2563EB; font-weight:700;">72-Hours</td>
                            </tr>
                        </table>
                    </div>

                    <div style="width: 50%; background: #F8FAFC; border: 1px solid #CBD5E1; border-top: 3px solid #D97706; border-radius: 5px; padding: 6px 8px; font-size: 7.5pt;">
                        <div style="font-weight: 800; color: #0B192C; margin-bottom: 3px; font-size: 8pt;">💡 रिपोर्ट संवर्धन अवसर / Report Enhancement Opportunities:</div>
                        <ul style="margin: 0; padding-left: 14px; line-height: 1.35; color: #334155;">
                            <li><strong>डेटा फ्रेशनेस एवं SLA मॉनिटरिंग:</strong> दैनिक स्वचलित वेब-स्क्रैपिंग द्वारा वास्तविक समय उठाव स्थिति ट्रैकिंग।</li>
                            <li><strong>परिवहनकर्ता क्षमता एनालिटिक्स:</strong> वाहन बेड़े एवं मार्ग-वार आवंटन क्षमता की विसंगति विश्लेषण।</li>
                            <li><strong>भौगोलिक मानचित्रण (GIS):</strong> ब्लॉक एवं सेक्टर स्तर पर विजुअल मैप डैशबोर्ड एकीकरण।</li>
                        </ul>
                    </div>
                </div>

                <div class="page-footer">
                    <span>MPSCSC District Office Betul | PDS Lifting Intelligence</span>
                    <span>Page 5 of 5</span>
                </div>
            </div>

        </body>
        </html>
        `;
    }

    /**
     * Generates a 5-page MNC-Level Executive PDF Report via Puppeteer
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
                margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' }
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
