const puppeteer = require('puppeteer');

class AdvancedAnalyticsPdfGenerator {
    /**
     * Generates HTML for the Redesigned 5-Page Action-Oriented Executive Report.
     *
     * Principles:
     *  - Strictly 5 Pages (Page 1: Dashboard, Page 2: Priority Sectors, Page 3: Blocks & Transporters,
     *    Page 4: POS Integrity, Page 5: Appendix & System Opportunities).
     *  - "Less data on main pages, more intelligence."
     *  - No 22-row repetition; exception-based management tables.
     *  - Clear separation: FACT → PROBLEM → ROOT CAUSE → ACTION → SLA.
     */
    generateHtml(computed, chartBuffers = {}) {
        const monthNames = [
            'January','February','March','April','May','June',
            'July','August','September','October','November','December'
        ];
        const monthHindi = [
            'जनवरी','फरवरी','मार्च','अप्रैल','मई','जून',
            'जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'
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
        const posGapUri        = toDataUri(chartBuffers.posGapBar);

        const genDateStr = new Date(computed.generatedAt).toLocaleString('en-GB', {
            day:'2-digit',month:'2-digit',year:'numeric',
            hour:'2-digit',minute:'2-digit'
        });

        // Top Priority Interventions (8 critical sectors)
        const prioritySectors = computed.priorityInterventions || [];

        // Transporter intelligence groups
        const multiSectorTransporters = (computed.transporterIntelligence && computed.transporterIntelligence.multiSector) 
            || computed.transporters.filter(t => t.hasMultiple) || [];
        const lowLiftingTransporters = (computed.transporterIntelligence && computed.transporterIntelligence.lowPerformers) 
            || computed.transporters.filter(t => !t.hasMultiple && t.liftPct < 0.30) || [];
        const normalPerformers = (computed.transporterIntelligence && computed.transporterIntelligence.normalPerformers) 
            || { count: computed.transporters.filter(t => t.liftPct >= 0.50).length };

        // Material POS Anomalies
        const materialPosAnomalies = computed.materialPosAnomalies || [];

        // Top 5 Management Concerns & 4 Immediate Actions
        const concerns = computed.managementConcerns || [];
        const actions = computed.immediateActions || [];

        return `
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="utf-8">
            <title>Executive Decision Dashboard — ${reportPeriod}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

                @page {
                    size: A4 portrait;
                    margin: 0;
                }

                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                * { box-sizing: border-box; }

                body {
                    font-family: 'Inter', 'Noto Sans Devanagari', 'Nirmala UI', -apple-system, sans-serif;
                    color: #0F172A;
                    margin: 0;
                    padding: 0;
                    background: #334155;
                    font-size: 8pt;
                    line-height: 1.35;
                }

                .document-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 24px 0;
                    width: 100%;
                    min-height: 100vh;
                    box-sizing: border-box;
                    transition: transform 0.2s ease;
                }

                .page {
                    width: 210mm;
                    min-width: 210mm;
                    height: 297mm;
                    max-height: 297mm;
                    padding: 8mm 9mm 10mm 9mm;
                    box-sizing: border-box;
                    position: relative;
                    overflow: hidden;
                    page-break-after: always;
                    break-after: page;
                    background: #FFFFFF;
                    margin: 0 auto 24px auto;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
                    border-radius: 2px;
                }
                .page:last-child {
                    margin-bottom: 0;
                    page-break-after: avoid;
                    break-after: avoid;
                }

                @media print {
                    body {
                        background: #FFFFFF !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .document-container {
                        padding: 0 !important;
                        margin: 0 !important;
                        display: block !important;
                    }
                    .page {
                        margin: 0 !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        max-height: 297mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                }

                /* Top Navigation & Sub-Header */
                .top-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #0B192C;
                    color: #fff;
                    padding: 7px 14px;
                    border-radius: 6px;
                    margin-bottom: 9px;
                    border-bottom: 2.5px solid #D97706;
                }
                .top-bar-title { font-size: 9.5pt; font-weight: 800; letter-spacing: .2px; }
                .top-bar-sub   { font-size: 7.2pt; color: #94A3B8; margin-top: 1px; }
                .top-bar-tag {
                    background: rgba(217,119,6,.2); color: #FBBF24;
                    border: 1px solid rgba(251,191,36,.4);
                    padding: 3px 8px; border-radius: 4px;
                    font-size: 7.2pt; font-weight: 800; letter-spacing: .4px; text-transform: uppercase;
                }

                .section-header {
                    background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%);
                    color: #fff; padding: 7px 12px; border-radius: 5px;
                    font-size: 9pt; font-weight: 700; margin-bottom: 9px;
                    display: flex; justify-content: space-between; align-items: center;
                    border-left: 3.5px solid #D97706;
                }
                .section-header-accent { color: #FBBF24; font-size: 7.5pt; font-weight: 600; }

                /* KPI Grid */
                .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 9px; }
                .kpi-card {
                    background: #F8FAFC; border: 1px solid #E2E8F0;
                    border-top: 3px solid #0B192C; border-radius: 6px;
                    padding: 7px 6px; text-align: center;
                }
                .kpi-card.c-red   { border-top-color: #DC2626; background: #FEF2F2; }
                .kpi-card.c-amber { border-top-color: #D97706; background: #FFFBEB; }
                .kpi-card.c-green { border-top-color: #059669; background: #ECFDF5; }
                .kpi-lbl { font-size: 6.8pt; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .2px; margin-bottom: 2px; }
                .kpi-val { font-size: 12.5pt; font-weight: 800; color: #0F172A; line-height: 1.1; }
                .kpi-sub { font-size: 6.5pt; color: #475569; margin-top: 2px; }

                /* Executive Narrative Box */
                .exec-box {
                    background: #F8FAFC; border: 1px solid #CBD5E1;
                    border-left: 3.5px solid #0B192C; border-radius: 6px;
                    padding: 8px 12px; margin-bottom: 9px;
                    font-size: 7.8pt; line-height: 1.45;
                }
                .exec-box-title { font-weight: 800; color: #0B192C; margin-bottom: 3px; font-size: 8.5pt; }

                /* Alert / Concerns Container */
                .concerns-box {
                    background: #FFFBEB; border: 1px solid #FDE68A;
                    border-left: 3.5px solid #D97706; border-radius: 6px;
                    padding: 8px 12px; margin-bottom: 9px;
                }
                .concerns-title { font-size: 8.2pt; font-weight: 800; color: #92400E; margin-bottom: 5px; }
                .concern-item {
                    display: flex; align-items: flex-start; gap: 6px;
                    margin-bottom: 4px; font-size: 7.6pt; color: #78350F; line-height: 1.35;
                }
                .concern-item:last-child { margin-bottom: 0; }
                .concern-bullet { color: #D97706; font-weight: 800; }

                /* Immediate Actions Container */
                .actions-box {
                    background: #FEF2F2; border: 1px solid #FCA5A5;
                    border-left: 3.5px solid #DC2626; border-radius: 6px;
                    padding: 8px 12px; margin-bottom: 9px;
                }
                .actions-title { font-size: 8.2pt; font-weight: 800; color: #991B1B; margin-bottom: 5px; }

                /* Standard Tables */
                table.rt { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 7.5pt; }
                table.rt th {
                    background: #0B192C; color: #fff; font-weight: 700;
                    padding: 5px 6px; border: 1px solid #1E293B;
                    text-align: center; font-size: 7.2pt;
                }
                table.rt td { padding: 4.5px 6px; border: 1px solid #E2E8F0; vertical-align: middle; }
                table.rt tr:nth-child(even):not([style*="background"]) { background: #F8FAFC; }

                /* SLA Tags & Badges */
                .sla-tag {
                    display: inline-block; padding: 2px 6px; border-radius: 3px;
                    font-size: 6.8pt; font-weight: 800; text-align: center; white-space: nowrap;
                }
                .sla-24 { background: #DC2626; color: #FFFFFF; }
                .sla-36 { background: #D97706; color: #FFFFFF; }
                .sla-48 { background: #2563EB; color: #FFFFFF; }
                .sla-72 { background: #475569; color: #FFFFFF; }
                .sla-daily { background: #059669; color: #FFFFFF; }

                .badge { display: inline-block; padding: 1.5px 5px; border-radius: 3px; font-size: 6.8pt; font-weight: 700; line-height: 1.2; text-align: center; }
                .badge-critical { background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; }
                .badge-watch    { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
                .badge-good     { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }
                .badge-excellent{ background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }

                /* Banner */
                .urgent-banner {
                    background: #FEF2F2; border: 1px solid #FCA5A5;
                    border-left: 3.5px solid #DC2626; color: #991B1B;
                    padding: 6px 10px; border-radius: 5px; font-size: 7.5pt; font-weight: 700;
                    margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;
                }

                .page-footer {
                    position: absolute; bottom: 3mm; left: 9mm; right: 9mm;
                    display: flex; justify-content: space-between;
                    font-size: 7.2pt; color: #64748B;
                    border-top: 1px solid #E2E8F0; padding-top: 4px;
                }
            </style>
        </head>
        <body>
        <div class="document-container">

        <!-- ══════════════════════════════════════════
             PAGE 1 — EXECUTIVE DASHBOARD
        ══════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">मध्यप्रदेश स्टेट सिविल सप्लाइज कारपोरेशन</div>
                    <div class="top-bar-sub">District Office Betul, Madhya Pradesh &nbsp;|&nbsp; PDS Lifting Intelligence Portal</div>
                </div>
                <div class="top-bar-tag">Executive Board Report</div>
            </div>

            <!-- Header Banner -->
            <div style="background:linear-gradient(135deg,#0B192C 0%,#1E3E62 100%);color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:13pt;font-weight:800;">उन्नत विश्लेषण एवं कार्यकारी डैशबोर्ड</div>
                    <div style="font-size:8pt;color:#FBBF24;font-weight:600;margin-top:2px;">EXECUTIVE DECISION DASHBOARD — PDS LIFTING MANAGEMENT</div>
                </div>
                <div style="text-align:right;font-size:7.5pt;color:#94A3B8;">
                    <div>रिपोर्ट अवधि: <strong style="color:#fff;">${reportPeriod}</strong></div>
                    <div style="margin-top:2px;">जनरेशन: <strong style="color:#fff;">${genDateStr}</strong></div>
                </div>
            </div>

            <!-- 5 Core KPIs -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-lbl">कुल आवंटन</div>
                    <div class="kpi-val">${computed.kpis.totalAllocation.toLocaleString('en-IN',{maximumFractionDigits:1})}</div>
                    <div class="kpi-sub">Allocation (Qt)</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-lbl">कुल प्रेषित उठाव</div>
                    <div class="kpi-val">${computed.kpis.totalDispatch.toLocaleString('en-IN',{maximumFractionDigits:1})}</div>
                    <div class="kpi-sub">Dispatch (Qt)</div>
                </div>
                <div class="kpi-card c-red">
                    <div class="kpi-lbl">जिला उठाव %</div>
                    <div class="kpi-val" style="color:#DC2626;">${(computed.kpis.districtLiftPct*100).toFixed(2)}%</div>
                    <div class="kpi-sub">District Lift Rate</div>
                </div>
                <div class="kpi-card c-red">
                    <div class="kpi-lbl">लंबित खाद्यान्न</div>
                    <div class="kpi-val" style="color:#DC2626;">${computed.kpis.pendingQty.toLocaleString('en-IN',{maximumFractionDigits:1})}</div>
                    <div class="kpi-sub">Pending (Qt)</div>
                </div>
                <div class="kpi-card c-red">
                    <div class="kpi-lbl">गंभीर सेक्टर (&lt;70%)</div>
                    <div class="kpi-val" style="color:#DC2626;">${computed.kpis.criticalSectorsCount}&thinsp;/&thinsp;${computed.kpis.totalSectorsCount}</div>
                    <div class="kpi-sub">Critical / Total</div>
                </div>
            </div>

            <!-- Crisp 2-Sentence Snapshot -->
            <div class="exec-box">
                <div class="exec-box-title">📋 कार्यकारी सारांश / Executive Summary Snapshot</div>
                माह <strong>${reportPeriod}</strong> में बैतूल जिले के <strong>${computed.kpis.totalSectorsCount} सेक्टरों</strong> में <strong>${computed.kpis.totalAllocation.toLocaleString('en-IN',{maximumFractionDigits:1})} क्विंटल</strong> आवंटन के विरुद्ध केवल <strong>${computed.kpis.totalDispatch.toLocaleString('en-IN',{maximumFractionDigits:1})} क्विंटल (${(computed.kpis.districtLiftPct*100).toFixed(2)}%)</strong> सामग्री प्रेषित की गई है। वर्तमान में <strong>${computed.kpis.pendingQty.toLocaleString('en-IN',{maximumFractionDigits:1})} क्विंटल</strong> खाद्यान्न का प्रदाय लंबित है और जिले के शत-प्रतिशत सेक्टर गंभीर श्रेणी (&lt;70%) में चल रहे हैं।
            </div>

            <!-- Top 5 Management Concerns -->
            <div class="concerns-box">
                <div class="concerns-title">⚠️ शीर्ष 5 प्रबंधकीय चिंताएं / Top 5 Management Concerns (What &amp; Where)</div>
                ${concerns.map((c, i) => `
                <div class="concern-item">
                    <span class="concern-bullet">#${i + 1}</span>
                    <span>${c}</span>
                </div>`).join('')}
            </div>

            <!-- 4 Immediate Management Directives -->
            <div class="actions-box">
                <div class="actions-title">🚨 तत्काल प्रबंधकीय निर्देश / Immediate Management Actions (Who, What, By When)</div>
                <table style="width:100%;border-collapse:collapse;font-size:7.4pt;margin-top:4px;">
                    <thead>
                        <tr style="border-bottom:1.5px solid #FCA5A5;color:#7F1D1D;font-weight:700;">
                            <th style="text-align:left;padding:3px 4px;width:60%;">कार्रवाई निर्देश / Action Directive</th>
                            <th style="text-align:left;padding:3px 4px;width:25%;">उत्तरदायी अधिकारी / Responsible</th>
                            <th style="text-align:center;padding:3px 4px;width:15%;">समय-सीमा / SLA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actions.map(act => `
                        <tr style="border-bottom:1px solid #FEE2E2;">
                            <td style="padding:4px 4px;color:#991B1B;font-weight:600;">• ${act.action}</td>
                            <td style="padding:4px 4px;color:#4B5563;">${act.officer}</td>
                            <td style="padding:4px 4px;text-align:center;"><span class="sla-tag ${act.sla.includes('24')?'sla-24':(act.sla.includes('36')?'sla-36':'sla-48')}">${act.sla}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 1 of 5</span>
            </div>
        </div>

        <!-- ══════════════════════════════════════════
             PAGE 2 — PRIORITY SECTOR INTERVENTION
        ══════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Executive Decision Dashboard &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Priority Interventions</div>
            </div>

            <div class="section-header" style="background:linear-gradient(135deg,#7F1D1D 0%,#B91C1C 100%);border-left-color:#FCA5A5;">
                <span>1. प्राथमिकता सेक्टर हस्तक्षेप योजना / Priority Sector Intervention Plan</span>
                <span class="section-header-accent" style="color:#FEE2E2;">Urgent Interventions Only</span>
            </div>

            <div class="urgent-banner">
                <span>🚨 अपवाद-आधारित हस्तक्षेप: जिले के 22 में से केवल सर्वोच्च तात्कालिकता (Urgency) वाले 8 सेक्टरों को प्राथमिकता कार्रवाई हेतु सूचीबद्ध किया गया है। शेष 14 सामान्य सेक्टर परिशिष्ट (Page 5) में उपलब्ध हैं।</span>
                <span class="sla-tag sla-24">Top 8 Exceptions</span>
            </div>

            <table class="rt">
                <thead>
                    <tr>
                        <th style="width:4%;">क्र.</th>
                        <th style="width:14%;">सेक्टर एवं ब्लॉक</th>
                        <th style="width:8%;">उठाव %</th>
                        <th style="width:9%;">लंबित (Qt)</th>
                        <th style="width:8%;">POS अंतर</th>
                        <th style="width:23%;">समस्या एवं जड़ कारण / Root Cause</th>
                        <th style="width:26%;">विशिष्ट प्रबंधन कार्रवाई / Required Action</th>
                        <th style="width:8%;">SLA</th>
                    </tr>
                </thead>
                <tbody>
                    ${prioritySectors.map(s => `
                    <tr>
                        <td style="text-align:center;font-weight:800;color:#DC2626;">#${s.priorityRank}</td>
                        <td>
                            <strong style="color:#0B192C;">${s.sectorName}</strong><br/>
                            <span style="font-size:6.8pt;color:#64748B;">${s.block} · ${s.transporter}</span>
                        </td>
                        <td style="text-align:center;font-weight:800;color:#DC2626;">${(s.liftPct*100).toFixed(1)}%</td>
                        <td style="text-align:right;font-weight:700;color:#991B1B;">${s.remaining.toLocaleString('en-IN',{maximumFractionDigits:1})}</td>
                        <td style="text-align:center;font-weight:700;color:${s.posGapPP>15?'#D97706':'#475569'};">
                            ${s.posGapPP>0?'+':''}${s.posGapPP.toFixed(1)}%
                        </td>
                        <td style="font-size:7.2pt;color:#334155;">${s.rootCause}</td>
                        <td style="font-size:7.2pt;color:#0F172A;font-weight:600;">${s.specificAction}</td>
                        <td style="text-align:center;"><span class="sla-tag ${s.sla==='24h'?'sla-24':(s.sla==='36h'?'sla-36':'sla-48')}">${s.sla}</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <!-- Analytical Decision Rule -->
            <div style="background:#F1F5F9;border:1px solid #CBD5E1;border-left:3.5px solid #2563EB;border-radius:5px;padding:8px 12px;font-size:7.4pt;margin-top:8px;line-height:1.45;">
                <strong style="color:#1E3E62;">📌 विश्लेषणात्मक हस्तक्षेप मानक (FACT → PROBLEM → ROOT CAUSE → ACTION → SLA):</strong><br/>
                • <strong>उठाव &lt; 20% अथवा POS अंतर &ge; 30%:</strong> अति-गंभीर तात्कालिकता। 24 घंटे के भीतर वाहन पुनरावंटन व भौतिक दुकान सत्यापन अनिवार्य।<br/>
                • <strong>उठाव 20%–30% अथवा पेंडिंग &ge; 2,800 Qt:</strong> गंभीर गतिरोध। 36 घंटे के भीतर प्रदाय केंद्र से ट्रिप फेरा दोगुना करना एवं नोटिस जारी करना।<br/>
                • <strong>दूरस्थ आदिवासी सेक्टर (+50 किमी):</strong> 48 घंटे में ऑफलाइन POS सिंक व मार्ग पर अतिरिक्त वाहन फेरे सुनिश्चित करना।
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 2 of 5</span>
            </div>
        </div>

        <!-- ══════════════════════════════════════════
             PAGE 3 — BLOCK & TRANSPORTER CAPACITY
        ══════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Executive Decision Dashboard &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Block &amp; Transporter</div>
            </div>

            <div class="section-header">
                <span>2. ब्लॉक निष्पादन एवं परिवहन क्षमता विश्लेषण / Block &amp; Transporter Capacity Analysis</span>
                <span class="section-header-accent">Capacity Exceptions</span>
            </div>

            <!-- Top Row: Block Chart & Table -->
            <div style="display:flex;gap:10px;margin-bottom:10px;align-items:stretch;">
                <div style="width:45%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:6px;padding:6px;display:flex;align-items:center;justify-content:center;">
                    ${blockBarUri ? `<img src="${blockBarUri}" style="max-width:100%;max-height:190px;height:auto;display:block;margin:0 auto;" />` : ''}
                </div>
                <div style="width:55%;">
                    <div style="font-size:7.8pt;font-weight:800;color:#0B192C;margin-bottom:4px;">📊 ब्लॉक निष्पादन रैंकिंग / Block Performance Summary</div>
                    <table class="rt" style="font-size:7.2pt;margin-bottom:0;">
                        <thead>
                            <tr>
                                <th style="width:8%;">रैंक</th>
                                <th style="width:28%;">ब्लॉक नाम</th>
                                <th style="width:10%;">सेक्टर</th>
                                <th style="width:18%;">आवंटन (Qt)</th>
                                <th style="width:18%;">उठाव (Qt)</th>
                                <th style="width:18%;">उठाव %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${computed.blocks.map(b => `
                            <tr>
                                <td style="text-align:center;font-weight:700;">#${b.rank}</td>
                                <td style="font-weight:600;">${b.block}</td>
                                <td style="text-align:center;">${b.sectorsCount}</td>
                                <td style="text-align:right;">${b.allocation.toLocaleString('en-IN',{maximumFractionDigits:1})}</td>
                                <td style="text-align:right;">${b.dispatch.toLocaleString('en-IN',{maximumFractionDigits:1})}</td>
                                <td style="text-align:center;font-weight:700;color:${b.liftPct>=0.50?'#059669':(b.liftPct>=0.30?'#D97706':'#DC2626')};">${(b.liftPct*100).toFixed(1)}%</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Consolidated Transporter Analysis in 3 Executive Cards -->
            <div style="font-size:8pt;font-weight:800;color:#0B192C;margin-bottom:5px;border-bottom:1.5px solid #E2E8F0;padding-bottom:3px;">
                🚚 परिवहनकर्ता क्षमता अपवाद एवं निष्पादन समीक्षा / Transporter Capacity Exceptions
            </div>

            <!-- 1. Multi-Sector Risk -->
            ${multiSectorTransporters.map(mt => `
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-left:3.5px solid #D97706;border-radius:5px;padding:7px 10px;margin-bottom:7px;font-size:7.4pt;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <strong style="color:#92400E;font-size:7.8pt;">⚠️ बहु-सेक्टर क्षमता समीक्षा: ${mt.transporter} (${mt.sectorsCount} सेक्टर प्रभार)</strong>
                    <span class="sla-tag sla-72">SLA: 72h क्षमता वृद्धि</span>
                </div>
                <div style="color:#78350F;line-height:1.4;">
                    • <strong>कुल लंबित भार:</strong> ${mt.remaining.toLocaleString('en-IN',{maximumFractionDigits:1})} Qt (उठाव: ${(mt.liftPct*100).toFixed(1)}% | आवंटन: ${mt.allocation.toLocaleString('en-IN',{maximumFractionDigits:1})} Qt) — <em>जिले का सबसे भारी लंबित दायित्व</em>。<br/>
                    • <strong>सेक्टर विभाजन:</strong> ${(mt.sectorsData || []).map(sd => `${sd.sectorName} (${sd.block}: ${(sd.liftPct*100).toFixed(1)}% उठाव, ${sd.remaining.toFixed(1)} Qt लंबित)`).join(' | ')}<br/>
                    • <strong>प्रबंधकीय निर्देश:</strong> एक ही ठेकेदार पर दो अलग-अलग विकासखंडों का भार होने से फेरे विलंबित हो रहे हैं। 72 घंटे में 1 अतिरिक्त वाहन अनुबंध कर उठाव गति 50% से ऊपर लाएं।
                </div>
            </div>`).join('')}

            <!-- 2. Low-Lifting Transporters (<30% Lift) -->
            <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-left:3.5px solid #DC2626;border-radius:5px;padding:7px 10px;margin-bottom:7px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <strong style="color:#991B1B;font-size:7.8pt;">🚨 गंभीर कम उठाव परिवहनकर्ता (&lt;30% Lift — ${lowLiftingTransporters.length} परिवहनकर्ता)</strong>
                    <span class="sla-tag sla-36">SLA: 36h नोटिस</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;font-size:7.2pt;color:#7F1D1D;">
                    ${lowLiftingTransporters.map(t => `
                    <div style="background:#FFFFFF;border:1px solid #FECACA;border-radius:4px;padding:4px 6px;">
                        <strong>${t.transporter}</strong><br/>
                        ${t.sectorsList}: <span style="font-weight:800;color:#DC2626;">${(t.liftPct*100).toFixed(1)}%</span><br/>
                        लंबित: ${t.remaining.toFixed(1)} Qt
                    </div>`).join('')}
                </div>
            </div>

            <!-- 3. Normal / Top Performers Benchmark -->
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-left:3.5px solid #059669;border-radius:5px;padding:6px 10px;font-size:7.4pt;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong style="color:#065F46;">✅ सामान्य व उत्कृष्ट निष्पादक:</strong>
                    <span style="color:#047857;">जिले के ${normalPerformers.count} परिवहनकर्ता (अभिषेक मालवीय 66.7%, अंकित राठौर 65.7%, दिनेश लिखितकर 64.8%, मुकेश राठौर 57.4%) संतोषजनक प्रगति पर हैं।</span>
                </div>
                <span class="badge badge-excellent">Normal Benchmark</span>
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 3 of 5</span>
            </div>
        </div>

        <!-- ══════════════════════════════════════════
             PAGE 4 — POS/DATA INTEGRITY AUDIT
        ══════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Executive Decision Dashboard &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">POS Integrity Audit</div>
            </div>

            <div class="section-header">
                <span>3. POS अंतर एवं डेटा विसंगति विश्लेषण / POS Discrepancy &amp; Data Integrity Audit</span>
                <span class="section-header-accent">Material Exceptions Only</span>
            </div>

            <!-- Top Visual: Chart + Formula & Materiality -->
            <div style="display:flex;gap:10px;margin-bottom:10px;align-items:stretch;">
                <div style="width:52%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:6px;padding:6px;display:flex;align-items:center;justify-content:center;">
                    ${posGapUri ? `<img src="${posGapUri}" style="max-width:100%;max-height:170px;height:auto;display:block;margin:0 auto;" />` : ''}
                </div>
                <div style="width:48%;background:#F8FAFC;border:1px solid #CBD5E1;border-left:3.5px solid #D97706;border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;justify-content:space-between;font-size:7.3pt;line-height:1.45;">
                    <div>
                        <strong style="color:#0B192C;font-size:8pt;">ℹ️ POS अंतर एवं सामग्री प्रासंगिकता मानक / Materiality Standard</strong>
                        <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:4px;padding:4px 6px;margin:5px 0;font-size:7.2pt;">
                            <strong>सूत्र:</strong> <code>(प्रदाय केंद्र प्रेषित % − FPS POS प्राप्ति %) × 100</code>
                        </div>
                        • <strong>सार्थक विसंगति (Material Gap &gt; +15%):</strong> सामग्री प्रदाय केंद्र से रवाना हो चुकी है, परंतु दुकानों ने POS में पावती दर्ज नहीं की।<br/>
                        • <strong>अति-गंभीर विसंगति (Lag &ge; +30%):</strong> दुकान स्तर पर भौतिक स्टॉक दबाने या बायोमेट्रिक सिंकिंग बंद होने का तीव्र संदेह।
                    </div>
                    <div style="background:#ECFDF5;border:1px solid #A7F3D0;padding:4px 8px;border-radius:4px;color:#065F46;font-weight:600;font-size:7pt;">
                        ✅ ओवर-रिसीट शून्य: जिले के किसी भी सेक्टर में -15% से कम का विसंगतिपूर्ण ऋणात्मक अंतर नहीं है।
                    </div>
                </div>
            </div>

            <!-- Material Exceptions Table -->
            <div style="font-size:7.8pt;font-weight:800;color:#0B192C;margin-bottom:4px;">
                📋 केवल सार्थक विसंगतियां / Material POS Discrepancies Table (|अंतर| &gt; 15 pp)
            </div>
            <table class="rt">
                <thead>
                    <tr>
                        <th style="width:4%;">क्र.</th>
                        <th style="width:16%;">सेक्टर एवं ब्लॉक</th>
                        <th style="width:8%;">प्रेषित %</th>
                        <th style="width:8%;">POS %</th>
                        <th style="width:9%;">अंतर (pp)</th>
                        <th style="width:23%;">विसंगति का स्वरूप / Nature</th>
                        <th style="width:22%;">अनिवार्य सत्यापन कार्रवाई / Action</th>
                        <th style="width:10%;">SLA</th>
                    </tr>
                </thead>
                <tbody>
                    ${materialPosAnomalies.map((m, idx) => `
                    <tr>
                        <td style="text-align:center;font-weight:700;">#${idx + 1}</td>
                        <td>
                            <strong>${m.sectorName}</strong><br/>
                            <span style="font-size:6.8pt;color:#64748B;">${m.block} · ${m.transporter}</span>
                        </td>
                        <td style="text-align:center;">${(m.dispatchPct*100).toFixed(1)}%</td>
                        <td style="text-align:center;">${(m.posReceiptPct*100).toFixed(1)}%</td>
                        <td style="text-align:center;font-weight:800;color:#DC2626;">+${m.posGapPP.toFixed(1)}%</td>
                        <td style="font-size:7.2pt;color:#334155;">${m.nature}</td>
                        <td style="font-size:7.2pt;color:#0F172A;">${m.action}</td>
                        <td style="text-align:center;"><span class="sla-tag ${m.sla==='24h'?'sla-24':'sla-48'}">${m.sla}</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 4 of 5</span>
            </div>
        </div>

        <!-- ══════════════════════════════════════════
             PAGE 5 — APPENDIX & SYSTEM ENHANCEMENTS
        ══════════════════════════════════════════ -->
        <div class="page">
            <div class="top-bar">
                <div>
                    <div class="top-bar-title">MPSCSC — District Office Betul</div>
                    <div class="top-bar-sub">Executive Decision Dashboard &nbsp;|&nbsp; ${reportPeriod}</div>
                </div>
                <div class="top-bar-tag">Appendix &amp; Systems</div>
            </div>

            <div class="section-header">
                <span>4. परिशिष्ट: पूर्ण सेक्टर डेटाबेस एवं प्रणाली संवर्धन / Full Appendix &amp; System Enhancements</span>
                <span class="section-header-accent">Reference &amp; Opportunities</span>
            </div>

            <!-- Complete 22-Sector Compact Reference Table -->
            <div style="font-size:7.6pt;font-weight:800;color:#0B192C;margin-bottom:3px;">
                📖 पूर्ण सेक्टर मास्टर डेटाबेस / Complete Sector Reference Table (All ${computed.sectors.length} Sectors)
            </div>
            <table class="rt" style="font-size:6.8pt;margin-bottom:6px;">
                <thead>
                    <tr style="background:#0B192C;">
                        <th style="width:4%;padding:3px;">रैंक</th>
                        <th style="width:10%;padding:3px;">ब्लॉक</th>
                        <th style="width:16%;padding:3px;">सेक्टर नाम</th>
                        <th style="width:9%;padding:3px;">आवंटन</th>
                        <th style="width:9%;padding:3px;">प्रेषित</th>
                        <th style="width:7%;padding:3px;">उठाव %</th>
                        <th style="width:7%;padding:3px;">POS %</th>
                        <th style="width:7%;padding:3px;">अंतर %</th>
                        <th style="width:8%;padding:3px;">श्रेणी</th>
                        <th style="width:23%;padding:3px;">परिवहनकर्ता</th>
                    </tr>
                </thead>
                <tbody>
                    ${computed.sectors.map(s => `
                    <tr>
                        <td style="text-align:center;font-weight:700;padding:2px 3px;">#${s.districtRank}</td>
                        <td style="padding:2px 3px;">${s.block}</td>
                        <td style="font-weight:600;padding:2px 3px;">${s.sectorName}</td>
                        <td style="text-align:right;padding:2px 3px;">${s.allocation.toFixed(1)}</td>
                        <td style="text-align:right;padding:2px 3px;">${s.dispatch.toFixed(1)}</td>
                        <td style="text-align:center;font-weight:700;color:${s.liftPct>=0.50?'#059669':(s.liftPct>=0.30?'#D97706':'#DC2626')};padding:2px 3px;">${(s.liftPct*100).toFixed(1)}%</td>
                        <td style="text-align:center;padding:2px 3px;">${(s.posReceiptPct*100).toFixed(1)}%</td>
                        <td style="text-align:center;${Math.abs(s.posGapPP)>15?'color:#DC2626;font-weight:700;':''};padding:2px 3px;">${s.posGapPP>0?'+':''}${s.posGapPP.toFixed(1)}%</td>
                        <td style="text-align:center;padding:2px 3px;"><span class="badge badge-${s.riskTier.toLowerCase()}">${s.riskTierHindi}</span></td>
                        <td style="font-size:6.5pt;padding:2px 3px;">${s.transporter}</td>
                    </tr>`).join('')}
                    <!-- Total District Row -->
                    <tr style="background:#ECFDF5;font-weight:800;border-top:1.5px solid #059669;">
                        <td style="text-align:center;padding:3px;">योग</td>
                        <td style="padding:3px;">10 ब्लॉक</td>
                        <td style="padding:3px;">22 सेक्टर (जिले का कुल योग)</td>
                        <td style="text-align:right;padding:3px;">${computed.kpis.totalAllocation.toFixed(1)}</td>
                        <td style="text-align:right;padding:3px;">${computed.kpis.totalDispatch.toFixed(1)}</td>
                        <td style="text-align:center;color:#DC2626;padding:3px;">${(computed.kpis.districtLiftPct*100).toFixed(1)}%</td>
                        <td style="text-align:center;padding:3px;">${(computed.kpis.avgPosReceiptPct*100).toFixed(1)}%</td>
                        <td style="text-align:center;padding:3px;">+${((computed.kpis.districtLiftPct - computed.kpis.avgPosReceiptPct)*100).toFixed(1)}%</td>
                        <td style="text-align:center;padding:3px;">${computed.kpis.criticalSectorsCount} गंभीर</td>
                        <td style="font-size:6.5pt;padding:3px;">21 परिवहनकर्ता</td>
                    </tr>
                </tbody>
            </table>

            <!-- Bottom Row: Methodology & Strategic Opportunities -->
            <div style="display:flex;gap:8px;align-items:stretch;">
                <!-- Methodology Box -->
                <div style="width:40%;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:5px;padding:6px 9px;font-size:6.8pt;line-height:1.4;">
                    <strong style="color:#0B192C;font-size:7.2pt;">📐 परिभाषाएं एवं गणना पद्धति / Methodology</strong>
                    <div style="margin-top:3px;">
                        • <strong>उठाव %:</strong> <code>(कुल प्रेषित / आवंटन) × 100</code> (प्रदाय केंद्र से डिस्पैच, सदा &le; 100%)।<br/>
                        • <strong>POS अंतर (pp):</strong> <code>उठाव % − POS प्राप्ति %</code> (+ अंतर = दुकान में पावती विलंब)।<br/>
                        • <strong>जोखिम मानक:</strong> गंभीर (&lt;70%), निगरानी (70-85%), अच्छा (85-95%), उत्कृष्ट (&ge;95%)।
                    </div>
                </div>

                <!-- Strategic System Improvements -->
                <div style="width:60%;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:5px;padding:6px 9px;font-size:6.8pt;line-height:1.35;">
                    <strong style="color:#0B192C;font-size:7.2pt;">💡 प्रणाली संवर्धन अवसर / System Improvement Opportunities</strong>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:3px;">
                        <div style="background:#EFF6FF;border-left:2px solid #2563EB;padding:3px 5px;border-radius:3px;">
                            <strong style="color:#1D4ED8;">1. रियल-टाइम SLA डैशबोर्ड:</strong> क्रॉन जॉब से हर 6h पर डेटा स्क्रैप कर WhatsApp/SMS अलर्ट।
                        </div>
                        <div style="background:#ECFDF5;border-left:2px solid #059669;padding:3px 5px;border-radius:3px;">
                            <strong style="color:#065F46;">2. ट्रिप-लॉग एनालिटिक्स:</strong> वाहन फेरों व प्रति ट्रिप क्षमता का ऐतिहासिक टर्नअराउंड विश्लेषण।
                        </div>
                        <div style="background:#FFFBEB;border-left:2px solid #D97706;padding:3px 5px;border-radius:3px;">
                            <strong style="color:#92400E;">3. MoM ट्रेंड ट्रैकिंग:</strong> पिछले 6 माह के उठाव रुझान व मौसमी गिरावट पैटर्न की पहचान।
                        </div>
                        <div style="background:#F5F3FF;border-left:2px solid #7C3AED;padding:3px 5px;border-radius:3px;">
                            <strong style="color:#5B21B6;">4. स्वचालित क्रॉस-ऑडिट:</strong> प्रदाय केंद्र चालान व POS एंट्री का स्वचालित मिलान तंत्र।
                        </div>
                    </div>
                </div>
            </div>

            <div class="page-footer">
                <span>MPSCSC District Office Betul &nbsp;|&nbsp; PDS Lifting Intelligence</span>
                <span>Page 5 of 5</span>
            </div>
        </div>
        </div>

        </body>
        </html>
        `;
    }

    /**
     * Generates the strict 5-page PDF via Puppeteer
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
                margin: { top: 0, right: 0, bottom: 0, left: 0 }
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
