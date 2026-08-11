const puppeteer = require('puppeteer');

class AdvancedAnalyticsPdfGenerator {
    /**
     * Generates HTML string for the 6-Page MNC-Level Bilingual Executive Report
     * 
     * Page 1 — Executive Dashboard (KPIs + Findings + At-a-Glance)
     * Page 2 — Block-wise Performance (Charts + Block Table + Risk Thresholds)
     * Page 3 — POS Gap Integrity (Full Chart + Definition + Exceptions)
     * Page 4 — Transporter Operational Review (Full-page Table)
     * Page 5 — Priority Action Plan (All sectors, 48-hr SLA)
     * Page 6 — Full Sector Appendix + Management Priorities + Enhancements
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
        const reqYear  = computed.year  || (computed.report ? computed.report.year  : null) || 2026;
        const monthName      = monthNames[reqMonth - 1] || `Month ${reqMonth}`;
        const monthNameHindi = monthHindi[reqMonth - 1] || '';
        const reportPeriod   = `${monthNameHindi} ${reqYear} (${monthName} ${reqYear})`;

        const toDataUri = (buf) => buf
            ? (typeof buf === 'string' && buf.startsWith('data:') ? buf
                : `data:image/png;base64,${Buffer.isBuffer(buf) ? buf.toString('base64') : buf}`)
            : '';
        const blockBarUri      = toDataUri(chartBuffers.blockBar);
        const tierDonutUri     = toDataUri(chartBuffers.tierDonut);
        const sectorGroupedUri = toDataUri(chartBuffers.sectorGroupedBar);
        const posGapUri        = toDataUri(chartBuffers.posGapBar);

        const genDateStr = new Date(computed.generatedAt).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        return `
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="utf-8">
            <title>Executive Analytics Report — ${reportPeriod}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

                @page {
                    size: A4 portrait;
                    margin: 12mm 11mm 14mm 11mm;
                }

                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                body {
                    font-family: 'Inter', 'Noto Sans Devanagari', -apple-system, sans-serif;
                    color: #0F172A;
                    margin: 0; padding: 0;
                    background: #FFFFFF;
                    font-size: 9pt;
                    line-height: 1.5;
                }

                /* ── Page container ───────────────────────────── */
                .page {
                    page-break-after: always;
                    position: relative;
                    min-height: 268mm;
                    padding-bottom: 14mm;
                }
                .page:last-child { page-break-after: avoid; }

                /* ── Top branding bar ─────────────────────────── */
                .top-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #0B192C;
                    color: #fff;
                    padding: 9px 16px;
                    border-radius: 7px;
                    margin-bottom: 14px;
                    border-bottom: 3px solid #D97706;
                }
                .top-bar-title   { font-size: 11.5pt; font-weight: 800; letter-spacing: 0.3px; }
                .top-bar-sub     { font-size: 8.5pt; color: #94A3B8; margin-top: 1px; }
                .top-bar-tag {
                    background: rgba(217,119,6,.18);
                    color: #FBBF24;
                    border: 1px solid rgba(251,191,36,.4);
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 8pt;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }

                /* ── Section header ───────────────────────────── */
                .section-header {
                    background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%);
                    color: #fff;
                    padding: 9px 14px;
                    border-radius: 6px;
                    font-size: 10.5pt;
                    font-weight: 700;
                    margin-bottom: 14px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-left: 4px solid #D97706;
                }
                .section-header-accent { color: #FBBF24; font-size: 8.5pt; font-weight: 600; }

                /* ── KPI Grid ─────────────────────────────────── */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(6,1fr);
                    gap: 10px;
                    margin-bottom: 14px;
                }
                .kpi-card {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-top: 3px solid #0B192C;
                    border-radius: 7px;
                    padding: 10px 8px;
                    text-align: center;
                }
                .kpi-card.c-red    { border-top-color:#DC2626; background:#FEF2F2; }
                .kpi-card.c-amber  { border-top-color:#D97706; background:#FFFBEB; }
                .kpi-card.c-green  { border-top-color:#059669; background:#ECFDF5; }
                .kpi-lbl { font-size:7.5pt; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:.2px; margin-bottom:3px; }
                .kpi-val { font-size:14pt; font-weight:800; color:#0F172A; line-height:1.1; }
                .kpi-sub { font-size:7pt; color:#475569; margin-top:3px; }

                /* ── Executive narrative box ──────────────────── */
                .exec-box {
                    background:#F1F5F9;
                    border:1px solid #CBD5E1;
                    border-left:4px solid #0B192C;
                    border-radius:7px;
                    padding:11px 14px;
                    margin-bottom:14px;
                    font-size:9pt;
                    line-height:1.55;
                }
                .exec-box-title { font-weight:800; color:#0B192C; margin-bottom:5px; font-size:9.5pt; }

                /* ── Finding cards grid ───────────────────────── */
                .finding-grid {
                    display:grid;
                    grid-template-columns:repeat(3,1fr);
                    gap:10px;
                    margin-bottom:14px;
                }
                .finding-card {
                    background:#FFFFFF;
                    border:1px solid #E2E8F0;
                    border-radius:7px;
                    padding:10px 12px;
                    box-shadow:0 1px 3px rgba(0,0,0,.04);
                }
                .fc-title { font-size:8pt; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:5px; }
                .fc-val   { font-size:11pt; font-weight:800; color:#0B192C; }
                .fc-desc  { font-size:8pt; color:#475569; margin-top:3px; line-height:1.35; }

                /* ── At-a-Glance grid ─────────────────────────── */
                .glance-grid {
                    display:grid;
                    grid-template-columns:repeat(4,1fr);
                    gap:10px;
                }
                .glance-box {
                    background:#F8FAFC;
                    border:1px solid #E2E8F0;
                    border-radius:7px;
                    padding:10px 12px;
                }
                .glance-head { font-size:8.5pt; font-weight:800; color:#0B192C; border-bottom:2px solid #E2E8F0; padding-bottom:4px; margin-bottom:6px; }
                .glance-body { font-size:8.5pt; color:#334155; line-height:1.45; }

                /* ── Charts layout ────────────────────────────── */
                .chart-row-dual { display:flex; gap:14px; margin-bottom:14px; align-items:stretch; }
                .chart-half {
                    width:50%;
                    background:#FFFFFF;
                    border:1px solid #E2E8F0;
                    border-radius:7px;
                    padding:10px;
                    text-align:center;
                    display:flex; flex-direction:column; justify-content:center;
                }
                .chart-half-title { font-size:8.5pt; font-weight:700; color:#0B192C; margin-bottom:8px; }
                .chart-img-fitted { max-width:100%; max-height:210px; height:auto; display:block; margin:0 auto; }

                /* ── POS Gap full layout ──────────────────────── */
                .pos-row { display:flex; gap:14px; margin-bottom:16px; align-items:stretch; }
                .pos-chart-box {
                    width:58%;
                    background:#FFFFFF;
                    border:1px solid #E2E8F0;
                    border-radius:7px;
                    padding:12px;
                    text-align:center;
                    display:flex; flex-direction:column; justify-content:center;
                }
                .pos-chart-title { font-size:9pt; font-weight:700; color:#0B192C; margin-bottom:8px; }
                .pos-def-box {
                    width:42%;
                    background:#F8FAFC;
                    border:1px solid #E2E8F0;
                    border-left:4px solid #D97706;
                    border-radius:7px;
                    padding:14px 16px;
                    font-size:8.5pt;
                    line-height:1.55;
                    display:flex; flex-direction:column; justify-content:space-between;
                }

                /* ── Tables ───────────────────────────────────── */
                table.rt {
                    width:100%;
                    border-collapse:collapse;
                    margin-bottom:10px;
                    font-size:8.5pt;
                }
                table.rt th {
                    background:#0B192C;
                    color:#fff;
                    font-weight:700;
                    padding:6px 8px;
                    border:1px solid #1E293B;
                    text-align:center;
                    font-size:8pt;
                }
                table.rt td {
                    padding:5px 8px;
                    border:1px solid #E2E8F0;
                    vertical-align:middle;
                }
                table.rt tr:nth-child(even) { background:#F8FAFC; }

                /* ── Badges ───────────────────────────────────── */
                .badge {
                    display:inline-block;
                    padding:2px 7px;
                    border-radius:4px;
                    font-size:7.5pt;
                    font-weight:700;
                    text-align:center;
                    line-height:1.3;
                }
                .badge-critical { background:#FEF2F2; color:#DC2626; border:1px solid #FCA5A5; }
                .badge-watch    { background:#FFFBEB; color:#D97706; border:1px solid #FDE68A; }
                .badge-good     { background:#EFF6FF; color:#2563EB; border:1px solid #BFDBFE; }
                .badge-excellent{ background:#ECFDF5; color:#059669; border:1px solid #A7F3D0; }

                /* ── Info callout ─────────────────────────────── */
                .info-callout {
                    background:#F8FAFC;
                    border:1px solid #E2E8F0;
                    border-left:4px solid #2563EB;
                    border-radius:6px;
                    padding:10px 14px;
                    font-size:8.5pt;
                    line-height:1.5;
                    margin-bottom:12px;
                }

                /* ── Urgent banner ────────────────────────────── */
                .urgent-banner {
                    background:#FEF2F2;
                    border:1px solid #FCA5A5;
                    border-left:4px solid #DC2626;
                    color:#991B1B;
                    padding:8px 12px;
                    border-radius:6px;
                    font-size:8.5pt;
                    font-weight:700;
                    margin-bottom:12px;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                }
                .sla-tag { background:#DC2626; color:#fff; padding:3px 8px; border-radius:4px; font-size:7.5pt; white-space:nowrap; }

                /* ── Section sub-label ────────────────────────── */
                .sub-label {
                    font-size:9pt;
                    font-weight:800;
                    color:#0B192C;
                    margin-bottom:6px;
                    padding-bottom:5px;
                    border-bottom:2px solid #E2E8F0;
                }

                /* ── Footer ───────────────────────────────────── */
                .page-footer {
                    position:absolute;
                    bottom:0; left:0; right:0;
                    display:flex;
                    justify-content:space-between;
                    font-size:8pt;
                    color:#64748B;
                    border-top:1px solid #E2E8F0;
                    padding-top:5px;
                }
            </style>
        </head>
        <body>

        <!-- ════════════════════════════════════════════════════
             PAGE 1 — EXECUTIVE DASHBOARD
        ════════════════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">मध्य प्रदेश राज्य नागरिक आपूर्ति निगम लिमिटेड</div>
                    <div class="top-bar-sub">District Office Betul, Madhya Pradesh &nbsp;|&nbsp; PDS Lifting Intelligence Portal</div>
                </div>
                <div class="top-bar-tag">Executive Board Report</div>
            </div>

            <!-- Report title banner -->
            <div style="background:linear-gradient(135deg,#0B192C 0%,#1E3E62 100%);color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:15pt;font-weight:800;">उन्नत विश्लेषण एवं कार्यकारी रिपोर्ट</div>
                    <div style="font-size:9.5pt;color:#FBBF24;font-weight:600;margin-top:2px;">ADVANCED ANALYTICAL EXECUTIVE REPORT — PDS LIFTING MANAGEMENT</div>
                </div>
                <div style="text-align:right;font-size:8.5pt;color:#94A3B8;">
                    <div>रिपोर्ट अवधि: <strong style="color:#fff;">${reportPeriod}</strong></div>
                    <div style="margin-top:3px;">जनरेशन दिनांक: <strong style="color:#fff;">${genDateStr}</strong></div>
                </div>
            </div>

            <!-- 6-KPI Grid -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-lbl">कुल आवंटन</div>
                    <div class="kpi-val">${computed.kpis.totalAllocation.toLocaleString('en-IN',{maximumFractionDigits:1})}</div>
                    <div class="kpi-sub">Total Allocation (Qt)</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-lbl">कुल प्रेषित उठाव</div>
                    <div class="kpi-val">${computed.kpis.totalDispatch.toLocaleString('en-IN',{maximumFractionDigits:1})}</div>
                    <div class="kpi-sub">Total Dispatch (Qt)</div>
                </div>
                <div class="kpi-card c-red">
                    <div class="kpi-lbl">जिला उठाव %</div>
                    <div class="kpi-val" style="color:#DC2626;">${(computed.kpis.districtLiftPct*100).toFixed(2)}%</div>
                    <div class="kpi-sub">District Lift Rate</div>
                </div>
                <div class="kpi-card c-red">
                    <div class="kpi-lbl">लंबित खाद्यान्न</div>
                    <div class="kpi-val" style="color:#DC2626;">${computed.kpis.pendingQty.toLocaleString('en-IN',{maximumFractionDigits:1})}</div>
                    <div class="kpi-sub">Pending Quantity (Qt)</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-lbl">POS प्राप्ति %</div>
                    <div class="kpi-val">${(computed.kpis.avgPosReceiptPct*100).toFixed(2)}%</div>
                    <div class="kpi-sub">Average POS Receipt</div>
                </div>
                <div class="kpi-card c-red">
                    <div class="kpi-lbl">गंभीर सेक्टर (&lt;70%)</div>
                    <div class="kpi-val" style="color:#DC2626;">${computed.kpis.criticalSectorsCount}&thinsp;/&thinsp;${computed.kpis.totalSectorsCount}</div>
                    <div class="kpi-sub">Critical Sectors</div>
                </div>
            </div>

            <!-- Executive Narrative -->
            <div class="exec-box">
                <div class="exec-box-title">📋 कार्यकारी सारांश / Executive Summary Snapshot</div>
                माह <strong>${reportPeriod}</strong> के दौरान राष्ट्रीय खाद्य सुरक्षा अधिनियम (NFSA) के अंतर्गत बैतूल जिले के कुल <strong>${computed.kpis.totalSectorsCount} सेक्टरों</strong> में कुल <strong>${computed.kpis.totalAllocation.toLocaleString('en-IN',{minimumFractionDigits:2})} क्विंटल</strong> खाद्यान्न का आवंटन किया गया था। डिपो स्तर से केवल <strong>${computed.kpis.totalDispatch.toLocaleString('en-IN',{minimumFractionDigits:2})} क्विंटल</strong> सामग्री प्रेषित की गई, जिससे जिला स्तर पर समग्र उठाव निष्पादन <strong>${(computed.kpis.districtLiftPct*100).toFixed(2)}%</strong> दर्ज किया गया। वर्तमान में जिले में कुल <strong>${computed.kpis.pendingQty.toLocaleString('en-IN',{minimumFractionDigits:2})} क्विंटल</strong> सामग्री का प्रदाय लंबित है, जिसे त्वरित प्रबंधकीय हस्तक्षेप द्वारा पूर्ण किया जाना आवश्यक है।
            </div>

            <!-- Key Finding Cards -->
            <div class="finding-grid">
                <div class="finding-card" style="border-left:3px solid #059669;">
                    <div class="fc-title">🏆 सर्वश्रेष्ठ प्रदर्शनकर्ता ब्लॉक</div>
                    <div class="fc-val">${computed.findings.bestBlock ? computed.findings.bestBlock.block : 'N/A'}</div>
                    <div class="fc-desc">उठाव निष्पादन: <strong>${(computed.findings.bestBlock ? computed.findings.bestBlock.liftPct*100 : 0).toFixed(2)}%</strong></div>
                </div>
                <div class="finding-card" style="border-left:3px solid #DC2626;">
                    <div class="fc-title">⚠️ न्यूनतम प्रदर्शनकर्ता ब्लॉक</div>
                    <div class="fc-val">${computed.findings.worstBlock ? computed.findings.worstBlock.block : 'N/A'}</div>
                    <div class="fc-desc">उठाव निष्पादन: <strong>${(computed.findings.worstBlock ? computed.findings.worstBlock.liftPct*100 : 0).toFixed(2)}%</strong></div>
                </div>
                <div class="finding-card" style="border-left:3px solid #DC2626;">
                    <div class="fc-title">🚨 सर्वाधिक लंबित सेक्टर</div>
                    <div class="fc-val">${computed.findings.worstSector ? computed.findings.worstSector.sectorName : 'N/A'}</div>
                    <div class="fc-desc">उठाव: <strong>${(computed.findings.worstSector ? computed.findings.worstSector.liftPct*100 : 0).toFixed(2)}%</strong> &nbsp;|&nbsp; लंबित: <strong>${computed.findings.worstSector ? computed.findings.worstSector.remaining.toFixed(1) : 0} Qt</strong></div>
                </div>
                <div class="finding-card" style="border-left:3px solid #D97706;">
                    <div class="fc-title">⏱️ POS फीडिंग विलंब विसंगति</div>
                    <div class="fc-val">${computed.findings.biggestLagSector ? computed.findings.biggestLagSector.sectorName : 'N/A'}</div>
                    <div class="fc-desc">POS प्रविष्टि में <strong>+${computed.findings.biggestLagSector ? computed.findings.biggestLagSector.posGapPP.toFixed(1) : 0}%</strong> का विलंब दर्ज हुआ है।</div>
                </div>
                <div class="finding-card" style="border-left:3px solid #2563EB;">
                    <div class="fc-title">🚚 एकाधिक सेक्टर परिवहनकर्ता</div>
                    <div class="fc-val">${computed.findings.multiSectorTransporters.length} परिवहनकर्ता</div>
                    <div class="fc-desc">1 से अधिक सेक्टर का प्रभार — क्षमता समीक्षा आवश्यक।</div>
                </div>
                <div class="finding-card" style="border-left:3px solid #DC2626;">
                    <div class="fc-title">📢 त्वरित समीक्षा आवश्यक</div>
                    <div class="fc-val">${computed.findings.sub85Count} सेक्टर</div>
                    <div class="fc-desc">कुल ${computed.kpis.totalSectorsCount} में से ${computed.findings.sub85Count} सेक्टरों में उठाव 85% से कम है।</div>
                </div>
            </div>

            <!-- At-a-Glance Matrix -->
            <div class="glance-grid">
                <div class="glance-box">
                    <div class="glance-head">1. वर्तमान स्थिति (What)</div>
                    <div class="glance-body">समग्र जिला उठाव <strong>${(computed.kpis.districtLiftPct*100).toFixed(2)}%</strong> है। डिपो प्रदाय गति अति-लंबित है।</div>
                </div>
                <div class="glance-box">
                    <div class="glance-head">2. समस्या क्षेत्र (Where)</div>
                    <div class="glance-body">${computed.findings.worstBlock ? computed.findings.worstBlock.block : 'N/A'} (${(computed.findings.worstBlock ? computed.findings.worstBlock.liftPct*100 : 0).toFixed(2)}%) ब्लॉक में न्यूनतम उठाव निष्पादन दर्ज हुआ है।</div>
                </div>
                <div class="glance-box">
                    <div class="glance-head">3. डेटा विसंगति (POS Gap)</div>
                    <div class="glance-body">${computed.findings.biggestLagSector ? computed.findings.biggestLagSector.sectorName : 'N/A'} में POS फीडिंग विलंब <strong>+${computed.findings.biggestLagSector ? computed.findings.biggestLagSector.posGapPP.toFixed(1) : 0}%</strong> दर्ज है (दुकान स्तर एंट्री लंबित)।</div>
                </div>
                <div class="glance-box">
                    <div class="glance-head">4. त्वरित निर्देश (Action)</div>
                    <div class="glance-body">सभी ${computed.findings.sub85Count} सेक्टरों में 48 घंटे के भीतर परिवहन समीक्षा एवं डिपो डिस्पैच गति बढ़ाने के निर्देश जारी।</div>
                </div>
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 1 of 6</span>
            </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             PAGE 2 — BLOCK-WISE PERFORMANCE & RISK MATRIX
        ════════════════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Advanced Analytical Executive Report &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Block Performance</div>
            </div>

            <div class="section-header">
                <span>1. ब्लॉक-वार निष्पादन एवं जोखिम विश्लेषण / Block-wise Performance &amp; Risk Matrix</span>
                <span class="section-header-accent">Block Analysis</span>
            </div>

            <!-- Dual charts -->
            <div class="chart-row-dual">
                <div class="chart-half">
                    <div class="chart-half-title">ब्लॉक-वार उठाव प्रतिशत / Block-wise Lift %</div>
                    ${blockBarUri ? `<img src="${blockBarUri}" class="chart-img-fitted" />` : ''}
                </div>
                <div class="chart-half">
                    <div class="chart-half-title">जोखिम श्रेणी विभाजन / Risk Tier Distribution</div>
                    ${tierDonutUri ? `<img src="${tierDonutUri}" class="chart-img-fitted" />` : ''}
                </div>
            </div>

            <!-- Block table -->
            <div class="sub-label">📊 ब्लॉक-वार निष्पादन सारणी / Block Performance Summary Table</div>
            <table class="rt">
                <thead>
                    <tr>
                        <th style="width:7%;">रैंक</th>
                        <th style="width:26%;">ब्लॉक नाम</th>
                        <th style="width:11%;">सेक्टर</th>
                        <th style="width:16%;">आवंटन (Qt)</th>
                        <th style="width:16%;">उठाव (Qt)</th>
                        <th style="width:11%;">उठाव %</th>
                        <th style="width:13%;">लंबित (Qt)</th>
                    </tr>
                </thead>
                <tbody>
                    ${computed.blocks.map(b => `
                    <tr>
                        <td style="text-align:center;font-weight:700;">#${b.rank}</td>
                        <td style="font-weight:600;">${b.block}</td>
                        <td style="text-align:center;">${b.sectorsCount}</td>
                        <td style="text-align:right;">${b.allocation.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                        <td style="text-align:right;">${b.dispatch.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                        <td style="text-align:center;font-weight:700;color:${b.liftPct>=0.85?'#059669':(b.liftPct>=0.70?'#D97706':'#DC2626')};">${(b.liftPct*100).toFixed(2)}%</td>
                        <td style="text-align:right;font-weight:600;color:#DC2626;">${b.remaining.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <!-- Risk classification legend -->
            <div class="info-callout">
                <strong>ℹ️ जोखिम वर्गीकरण मानक / Risk Classification Standard:</strong><br/><br/>
                <span class="badge badge-excellent">उत्कृष्ट / Excellent</span> &nbsp; lift ≥ 95% &nbsp;&nbsp;&nbsp;
                <span class="badge badge-good">अच्छा / Good</span> &nbsp; 85% ≤ lift &lt; 95% &nbsp;&nbsp;&nbsp;
                <span class="badge badge-watch">निगरानी / Watch</span> &nbsp; 70% ≤ lift &lt; 85% &nbsp;&nbsp;&nbsp;
                <span class="badge badge-critical">गंभीर / Critical</span> &nbsp; lift &lt; 70%
                <br/><br/>
                <span style="color:#DC2626;font-weight:700;">⚠️ वर्तमान में जिले के सभी ${computed.kpis.totalSectorsCount} सेक्टर <em>गंभीर (Critical &lt; 70%)</em> श्रेणी में हैं। तत्काल प्रबंधकीय हस्तक्षेप आवश्यक है।</span>
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 2 of 6</span>
            </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             PAGE 3 — POS GAP INTEGRITY ANALYSIS
        ════════════════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Advanced Analytical Executive Report &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">POS Integrity</div>
            </div>

            <div class="section-header">
                <span>2. POS अंतर एवं डेटा विसंगति विश्लेषण / POS Gap &amp; Data Integrity Analysis</span>
                <span class="section-header-accent">POS Gap Analysis</span>
            </div>

            <!-- POS chart + definition side by side -->
            <div class="pos-row">
                <div class="pos-chart-box">
                    <div class="pos-chart-title">शीर्ष POS अंतर विसंगतियां / Top POS Gap Anomalies (%)</div>
                    ${posGapUri ? `<img src="${posGapUri}" class="chart-img-fitted" style="max-height:230px;" />` : ''}
                </div>
                <div class="pos-def-box">
                    <div>
                        <div style="font-weight:800;color:#0B192C;font-size:10pt;margin-bottom:10px;">ℹ️ POS अंतर व्याख्या / POS Gap Definition</div>
                        <div style="background:#F1F5F9;border-radius:5px;padding:8px 10px;margin-bottom:12px;font-size:8.5pt;">
                            <strong>सूत्र / Formula:</strong><br/>
                            <code style="font-size:8pt;">(डिपो उठाव % − POS प्राप्ति %) × 100</code>
                        </div>
                    </div>
                    <div>
                        <div style="background:#FFFBEB;border-left:4px solid #D97706;padding:10px 12px;border-radius:0 6px 6px 0;margin-bottom:12px;font-size:8.5pt;line-height:1.5;">
                            <strong style="color:#D97706;">1. POS फीडिंग विलंब (Gap &gt; +15%)</strong><br/>
                            डिपो से सामग्री जारी कर दी गई है, लेकिन उचित मूल्य दुकानों द्वारा POS मशीनों में प्रविष्टि में विलंब हुआ है।<br/>
                            <em style="color:#92400E;font-size:8pt;">घोड़ाडोंगरी सेक्टर क्र 7 में +17.3% का फीडिंग विलंब दर्ज है।</em>
                        </div>
                        <div style="background:#F5F3FF;border-left:4px solid #7C3AED;padding:10px 12px;border-radius:0 6px 6px 0;font-size:8.5pt;line-height:1.5;">
                            <strong style="color:#7C3AED;">2. POS ओवर-रिसीट विसंगति (Gap &lt; -15%)</strong><br/>
                            दुकान स्तर POS में डिपो द्वारा जारी प्रेषित मात्रा से अधिक प्राप्ति दर्ज हुई है। यह डिपो डिस्पैच एवं POS डेटा के मध्य विसंगति को दर्शाता है — त्वरित तकनीकी जांच आवश्यक है।
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sector-grouped chart if available -->
            ${sectorGroupedUri ? `
            <div class="sub-label" style="margin-top:4px;">📊 सेक्टर-वार तुलनात्मक प्रदर्शन / Sector-wise Comparative Performance</div>
            <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:7px;padding:12px;text-align:center;">
                <img src="${sectorGroupedUri}" class="chart-img-fitted" style="max-height:190px;" />
            </div>` : ''}

            <!-- POS Exception summary cards -->
            <div style="display:flex;gap:12px;margin-top:14px;">
                ${computed.findings.biggestLagSector ? `
                <div style="flex:1;background:#FFFBEB;border:1px solid #FDE68A;border-left:4px solid #D97706;border-radius:6px;padding:10px 14px;font-size:8.5pt;">
                    <div style="font-weight:700;color:#92400E;margin-bottom:4px;">⚠️ POS फीडिंग विलंब — उच्चतम विसंगति</div>
                    <div><strong>${computed.findings.biggestLagSector.sectorName}</strong> में POS फीडिंग में <strong>+${computed.findings.biggestLagSector.posGapPP.toFixed(1)}%</strong> का विलंब दर्ज किया गया है। उचित मूल्य दुकान स्तर प्रविष्टि तत्काल सत्यापित करें।</div>
                </div>` : ''}
                ${computed.findings.biggestOverReceiptSector ? `
                <div style="flex:1;background:#F5F3FF;border:1px solid #DDD6FE;border-left:4px solid #7C3AED;border-radius:6px;padding:10px 14px;font-size:8.5pt;">
                    <div style="font-weight:700;color:#5B21B6;margin-bottom:4px;">🔍 POS ओवर-रिसीट — उच्चतम विसंगति</div>
                    <div><strong>${computed.findings.biggestOverReceiptSector.sectorName}</strong> में दुकान स्तर POS प्राप्ति प्रेषित उठाव से <strong>${computed.findings.biggestOverReceiptSector.posGapPP.toFixed(1)}%</strong> अधिक दर्शाई गई है।</div>
                </div>` : ''}
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 3 of 6</span>
            </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             PAGE 4 — TRANSPORTER OPERATIONAL REVIEW
        ════════════════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Advanced Analytical Executive Report &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Transporter Review</div>
            </div>

            <div class="section-header">
                <span>3. परिवहनकर्ता प्रदर्शन एवं क्षमता समीक्षा / Transporter Performance &amp; Capacity Review</span>
                <span class="section-header-accent">Operational Analytics</span>
            </div>

            <div class="info-callout" style="border-left-color:#D97706;">
                <strong>📌 समीक्षा नोट / Review Note:</strong> &nbsp;एकाधिक सेक्टर प्रभार वाले परिवहनकर्ताओं की पंक्तियाँ <span style="background:#FFFBEB;border:1px solid #FDE68A;padding:1px 5px;border-radius:3px;color:#D97706;font-weight:700;">हाइलाइट</span> की गई हैं। ऐसे परिवहनकर्ताओं की क्षमता का मूल्यांकन करें एवं अतिरिक्त वाहन तैनात करने पर विचार करें।
            </div>

            <div class="sub-label">🚚 परिवहनकर्ता प्रदर्शन तालिका / Transporter Performance Table</div>
            <table class="rt">
                <thead>
                    <tr>
                        <th style="width:5%;">क्र.</th>
                        <th style="width:26%;">परिवहनकर्ता का नाम</th>
                        <th style="width:10%;">आवंटित सेक्टर</th>
                        <th style="width:14%;">आवंटन (Qt)</th>
                        <th style="width:14%;">उठाव (Qt)</th>
                        <th style="width:10%;">उठाव %</th>
                        <th style="width:12%;">लंबित (Qt)</th>
                        <th style="width:9%;">टिप्पणी</th>
                    </tr>
                </thead>
                <tbody>
                    ${computed.transporters.map(t => `
                    <tr ${t.hasMultiple ? 'style="background-color:#FFFBEB;"' : ''}>
                        <td style="text-align:center;">${t.srNo}</td>
                        <td style="font-weight:600;">${t.transporter}</td>
                        <td style="text-align:center;font-weight:700;">${t.sectorsCount}</td>
                        <td style="text-align:right;">${t.allocation.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                        <td style="text-align:right;">${t.dispatch.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                        <td style="text-align:center;font-weight:700;color:${t.liftPct>=0.85?'#059669':(t.liftPct>=0.70?'#D97706':'#DC2626')};">${(t.liftPct*100).toFixed(2)}%</td>
                        <td style="text-align:right;font-weight:600;">${t.remaining.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                        <td style="font-size:8pt;${t.hasMultiple?'color:#D97706;font-weight:700;':''}">${t.remark}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 4 of 6</span>
            </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             PAGE 5 — PRIORITY ACTION PLAN (ALL SECTORS)
        ════════════════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Advanced Analytical Executive Report &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Action Plan</div>
            </div>

            <div class="section-header" style="background:linear-gradient(135deg,#7F1D1D 0%,#B91C1C 100%);">
                <span>4. प्राथमिकता कार्रवाई योजना (उठाव &lt; 85%) / Priority Action Plan — All ${computed.actionPlan.length} Sectors</span>
                <span class="section-header-accent" style="color:#FEE2E2;">Urgent Interventions Required</span>
            </div>

            <div class="urgent-banner">
                <span>🚨 प्राथमिकता कार्रवाई निर्देश: सभी ${computed.actionPlan.length} सेक्टरों में उठाव 85% से कम है। 48 घंटे के भीतर प्रदाय सुनिश्चित करें एवं समीक्षा करें।</span>
                <span class="sla-tag">48-Hour SLA</span>
            </div>

            <table class="rt">
                <thead>
                    <tr>
                        <th style="width:4%;">क्र.</th>
                        <th style="width:16%;">सेक्टर नाम</th>
                        <th style="width:12%;">ब्लॉक</th>
                        <th style="width:9%;">उठाव %</th>
                        <th style="width:12%;">लंबित (Qt)</th>
                        <th style="width:9%;">श्रेणी</th>
                        <th style="width:38%;">अनुशंसित कार्रवाई / Recommended Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${computed.actionPlan.map(ap => `
                    <tr>
                        <td style="text-align:center;font-weight:700;">${ap.srNo}</td>
                        <td style="font-weight:600;">${ap.sectorName}</td>
                        <td>${ap.block}</td>
                        <td style="text-align:center;font-weight:700;color:#DC2626;">${(ap.liftPct*100).toFixed(2)}%</td>
                        <td style="text-align:right;font-weight:600;">${ap.remaining.toFixed(2)}</td>
                        <td style="text-align:center;"><span class="badge badge-${ap.riskTier.toLowerCase()}">${ap.riskTierHindi}</span></td>
                        <td style="font-size:8pt;line-height:1.3;white-space:pre-line;">${ap.recommendedAction}</td>
                    </tr>`).join('')}
                    ${computed.actionPlan.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:#059669;padding:20px;font-weight:700;">🎉 सभी सेक्टरों में उठाव प्रगति 85% से अधिक है।</td></tr>` : ''}
                </tbody>
            </table>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 5 of 6</span>
            </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             PAGE 6 — FULL SECTOR APPENDIX + MANAGEMENT PRIORITIES
        ════════════════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Advanced Analytical Executive Report &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Appendix &amp; Priorities</div>
            </div>

            <div class="section-header">
                <span>5. परिशिष्ट: पूर्ण सेक्टर डेटाबेस एवं प्रबंधकीय प्राथमिकताएं / Full Sector Appendix &amp; Management Priorities</span>
                <span class="section-header-accent">Master Database</span>
            </div>

            <!-- Full 22-sector table -->
            <div class="sub-label">📖 पूर्ण सेक्टर मास्टर डेटाबेस (All ${computed.sectors.length} Sectors)</div>
            <table class="rt">
                <thead>
                    <tr>
                        <th style="width:4%;">रैंक</th>
                        <th style="width:9%;">ब्लॉक</th>
                        <th style="width:14%;">सेक्टर नाम</th>
                        <th style="width:9%;">आवंटन</th>
                        <th style="width:9%;">उठाव</th>
                        <th style="width:8%;">उठाव %</th>
                        <th style="width:8%;">POS %</th>
                        <th style="width:9%;">POS Gap (%)</th>
                        <th style="width:8%;">श्रेणी</th>
                        <th style="width:22%;">परिवहनकर्ता</th>
                    </tr>
                </thead>
                <tbody>
                    ${computed.sectors.map(s => `
                    <tr>
                        <td style="text-align:center;font-weight:700;">#${s.districtRank}</td>
                        <td>${s.block}</td>
                        <td style="font-weight:600;">${s.sectorName}</td>
                        <td style="text-align:right;">${s.allocation.toFixed(1)}</td>
                        <td style="text-align:right;">${s.dispatch.toFixed(1)}</td>
                        <td style="text-align:center;font-weight:700;color:${s.liftPct>=0.85?'#059669':(s.liftPct>=0.70?'#D97706':'#DC2626')};">${(s.liftPct*100).toFixed(2)}%</td>
                        <td style="text-align:center;">${(s.posReceiptPct*100).toFixed(2)}%</td>
                        <td style="text-align:center;${Math.abs(s.posGapPP)>15?(s.posGapPP>0?'color:#D97706;font-weight:700;':'color:#7C3AED;font-weight:700;'):''}">${s.posGapPP>0?'+':''}${s.posGapPP.toFixed(1)}%</td>
                        <td style="text-align:center;"><span class="badge badge-${s.riskTier.toLowerCase()}">${s.riskTierHindi}</span></td>
                        <td>${s.transporter}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <!-- Management Priorities + Enhancement Opportunities -->
            <div style="display:flex;gap:12px;margin-top:12px;">
                <div style="width:50%;background:#F8FAFC;border:1px solid #CBD5E1;border-top:3px solid #0B192C;border-radius:6px;padding:10px 12px;">
                    <div style="font-weight:800;color:#0B192C;margin-bottom:8px;font-size:9.5pt;">🎯 प्रबंधकीय प्राथमिकताएं / Management Priorities</div>
                    <table style="width:100%;border-collapse:collapse;font-size:8.5pt;">
                        <tr style="border-bottom:1px solid #CBD5E1;font-weight:700;color:#475569;padding-bottom:4px;">
                            <th style="text-align:left;padding:4px 0;">मुद्दा</th>
                            <th style="text-align:left;padding:4px 0;">अनुशंसित कार्रवाई</th>
                            <th style="text-align:center;padding:4px 0;">Urgency</th>
                        </tr>
                        <tr style="border-bottom:1px solid #E2E8F0;">
                            <td style="padding:5px 0;"><strong>0% डिपो उठाव</strong></td>
                            <td style="padding:5px 0;">आठनेर #15 व आमला #21 हेतु तत्काल वाहन आवंटन आदेश</td>
                            <td style="text-align:center;color:#DC2626;font-weight:700;padding:5px 0;">24-Hours</td>
                        </tr>
                        <tr style="border-bottom:1px solid #E2E8F0;">
                            <td style="padding:5px 0;"><strong>POS फीडिंग विलंब</strong></td>
                            <td style="padding:5px 0;">घोड़ाडोंगरी #7 में उचित मूल्य दुकानों की भौतिक एंट्री जांच</td>
                            <td style="text-align:center;color:#D97706;font-weight:700;padding:5px 0;">48-Hours</td>
                        </tr>
                        <tr>
                            <td style="padding:5px 0;"><strong>बहु-सेक्टर प्रभार</strong></td>
                            <td style="padding:5px 0;">एकाधिक सेक्टर परिवहनकर्ताओं में अतिरिक्त वाहन तैनाती</td>
                            <td style="text-align:center;color:#2563EB;font-weight:700;padding:5px 0;">72-Hours</td>
                        </tr>
                    </table>
                </div>

                <div style="width:50%;background:#F8FAFC;border:1px solid #CBD5E1;border-top:3px solid #D97706;border-radius:6px;padding:10px 12px;">
                    <div style="font-weight:800;color:#0B192C;margin-bottom:8px;font-size:9.5pt;">💡 रिपोर्ट संवर्धन अवसर / Report Enhancement Opportunities</div>
                    <ul style="margin:0;padding-left:16px;line-height:1.6;color:#334155;font-size:8.5pt;">
                        <li><strong>डेटा फ्रेशनेस एवं SLA मॉनिटरिंग:</strong> दैनिक स्वचलित वेब-स्क्रैपिंग द्वारा वास्तविक समय उठाव स्थिति ट्रैकिंग।</li>
                        <li><strong>परिवहनकर्ता क्षमता एनालिटिक्स:</strong> वाहन बेड़े एवं मार्ग-वार आवंटन क्षमता की विसंगति विश्लेषण।</li>
                        <li><strong>ऐतिहासिक तुलना (Trend Analysis):</strong> पिछले 3-6 माह के उठाव रुझान एवं लक्ष्य बनाम वास्तविक तुलना।</li>
                        <li><strong>भौगोलिक मानचित्रण (GIS):</strong> ब्लॉक एवं सेक्टर स्तर पर विजुअल मैप डैशबोर्ड एकीकरण।</li>
                    </ul>
                </div>
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 6 of 6</span>
            </div>
        </div>

        </body>
        </html>
        `;
    }

    /**
     * Generates a 6-page MNC-Level Executive PDF Report via Puppeteer
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
                margin: { top: '12mm', right: '11mm', bottom: '14mm', left: '11mm' }
            });
            return Buffer.from(pdfBuffer);
        } catch (error) {
            console.error('Failed to generate advanced analytics PDF:', error);
            throw error;
        } finally {
            if (browser) await browser.close().catch(() => {});
        }
    }
}

module.exports = AdvancedAnalyticsPdfGenerator;
