/**
 * ══════════════════════════════════════════════════════════
 * SUPERVISION & INSPECTION MODULE LOGIC (ORDERS 3/1 & 3/2)
 * Madhya Pradesh State Civil Supplies Corporation Ltd.
 * District Office Betul
 * ══════════════════════════════════════════════════════════
 */

// Global Module State
const SupervState = {
    mode: 'dm', // 'dm' or 'rm'
    currentView: 'dashboard',
    stats: {},
    inspections: [],
    surpriseVisits: [],
    roster: [],
    meetings: [],
    issueCentersDirectory: [],
    branchesDirectory: [],
    riceInspections: [],
    currentRiceSheetId: null,
    tasks: [],
    taskSummary: {},
    taskFilterDept: '',
    checkpoints: [

        { id: 'chk_1_computer', num: '01', text: 'कंप्यूटर कार्यरत अवस्था में है?' },
        { id: 'chk_2_printer', num: '02', text: 'प्रिंटर कार्यरत अवस्था में है?' },
        { id: 'chk_3_ups', num: '03', text: 'यूपीएस कार्यरत अवस्था में है?' },
        { id: 'chk_4_internet', num: '04', text: 'इन्टरनेट कार्य कर रहा है?' },
        { id: 'chk_5_deo_format', num: '05', text: 'डाटा एंट्री ऑपरेटर को निर्धारित प्रारूप में जानकारी दी जा रही है?' },
        { id: 'chk_6_doorstep_receipts', num: '06', text: 'द्वार प्रदाय योजना अंतर्गत परिवहनकर्ताओं से प्राप्त पावतियां जिला कार्यालय प्रेषित की गईं?' },
        { id: 'chk_7_stock_quality', num: '07', text: 'क्या भंडारित स्कंध की गुणवत्ता निर्धारित मापदंडों के अनुसार है?' },
        { id: 'chk_8_stack_criteria', num: '08', text: 'भंडारित स्कंध स्टेकों में निर्धारित मापदंडों (दिवार से 1m, स्टेक ऊंचाई) अनुसार लगाये गए हैं?' },
        { id: 'chk_9_stack_cards', num: '09', text: 'स्टेकों में स्टेक कार्ड लगाये गए हैं एवं अद्यतन हैं?' },
        { id: 'chk_10_sweepage_handling', num: '10', text: 'स्वीपेज स्कंध का प्रक्रियानुसार संग्रह, पृथक्करण, निराकरण एवं लेखांकन हो रहा है?' },
        { id: 'chk_11_records_reconciliation', num: '11', text: 'गोदाम पासबुक, WLC के रिकॉर्ड्स एवं CSMS सॉफ्टवेयर से प्राप्त जानकारी का आपस में मिलान हो रहा है?' },
        { id: 'chk_12_stack_killing', num: '12', text: 'स्टेक नियमानुसार प्राथमिकता क्रम से किल (Kill/De-stack) किये जा रहे हैं?' },
        { id: 'chk_13_loss_gain_cert', num: '13', text: 'स्टेक वार लास / गेन प्रमाण-पत्र जारी किया जा रहा है?' },
        { id: 'chk_14_damaged_dcc', num: '14', text: 'क्षतिग्रस्त खाद्यान्न का DCC (Demaged Commodity Certificate) कर लिया गया है?' },
        { id: 'chk_15_transport_order', num: '15', text: 'द्वार प्रदाय योजना का परिवहन आदेश जारी कर दिया गया है?' },
        { id: 'chk_16_fumigation_schedule', num: '16', text: 'स्टेकों का कीटोपचार / धूमीकरण (Fumigation / Spraying) निर्धारित समय पर किया गया है?' },
        { id: 'chk_17_hq_compliance', num: '17', text: 'क्या जिला प्रबंधक द्वारा मुख्यालय के निर्देशानुसार मासिक रोस्टर निरीक्षण पूर्ण किए जा रहे हैं?' }
    ],
    surprisePoints: [
        { id: 1, text: 'प्रदाय केन्द्र पर आवंटन के मान से विभिन्न जिंस की उपलब्धता की स्थिति' },
        { id: 2, text: 'प्रदाय केन्द्र पर स्थान उपलब्धता की स्थिति (Godown Space Vacancy)' },
        { id: 3, text: 'हार्डवेयर / साफ्टवेयर के संचालन एवं विभिन्न साफ्टवेयर में एन्ट्री की स्थिति (CSMS/IRRS)' },
        { id: 4, text: 'भंडारित स्कंध के रख-रखाव एवं स्टेक व्यवस्था की स्थिति' },
        { id: 5, text: 'स्वीपेज / क्षतिग्रस्त स्टाक / अपग्रेडेशन योग्य स्टाक की समीक्षा' },
        { id: 6, text: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर किये जाने की स्थिति' },
        { id: 7, text: 'द्वार प्रदाय योजना अन्तर्गत परिवहनकर्ताओं से प्राप्त पावतियों की एन्ट्री साफ्टवेयर में करने की स्थिति' },
        { id: 8, text: 'निरीक्षण दिनांक को केन्द्रवार विकी के०डी०डी० / देयक जिला कार्यालय प्रेषित करने की स्थिति' },
        { id: 9, text: 'प्रथम आगम प्रथम निर्गम (FIFO) पद्धति से स्कंध का निराकरण होने की स्थिति' },
        { id: 10, text: 'केन्द्र प्रभारी / कम्प्यूटर आपरेटर के नियमित रूप से उपस्थित रहने की स्थिति' }
    ],
    commoditiesList: [
        'गेहूं (Wheat)',
        'चावल (Rice)',
        'धान (Paddy)',
        'शक्कर (Sugar)',
        'मक्का (Maize)',
        'नमक (Salt)',
        'ज्वार (Jowar)',
        'बाजरा (Bajra)'
    ]
};

// ── Initial Boot ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initSidebarState();
    initDefaultDates();
    renderStockVerificationRows();
    renderCheckpoints();
    renderSurpriseChecklist();
    selectProtocolDay('mon');
    selectCoordAgency('MPWLC');
    selectReviewCategory('ic_operators');
    initDefaultRiceSheet();
    
    await Promise.all([
        fetchDirectoryData(),
        fetchSupervisionStats(),
        fetchInspections(),
        fetchSurpriseVisits(),
        fetchRoster(),
        fetchRiceInspections(),
        loadSupervisionTasks()
    ]);

    renderDashboard();
    renderRosterTable();
    renderArchivesTable();
    renderSurpriseTable();
    renderRiceSavedSheetsTable();

    if (window.location.search.includes('gmail=connected')) {
        showSupervView('tasks', document.getElementById('superv-nav-tasks'));
        alert('🎉 शासकीय Gmail खाता सफलतापूर्वक अधिकृत एवं कनेक्ट कर लिया गया है!');
        history.replaceState(null, '', window.location.pathname);
    }
});


function initDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const formDate = document.getElementById('formInspectionDate');
    const surpDate = document.getElementById('surpDate');
    const meetDate = document.getElementById('meetingDate');
    const riceDate = document.getElementById('riceAnalysisDate');
    if (formDate) formDate.value = today;
    if (surpDate) surpDate.value = today;
    if (meetDate) meetDate.value = today;
    if (riceDate) riceDate.value = today;
}

// ── Mode Switcher (DM vs RM) ──────────────────────────────
function setSupervisionMode(mode) {
    SupervState.mode = mode;
    const btnDM = document.getElementById('btnModeDM');
    const btnRM = document.getElementById('btnModeRM');
    const badge = document.getElementById('inspFormModeBadge');

    if (mode === 'dm') {
        btnDM.classList.add('active');
        btnRM.classList.remove('active');
        if (badge) badge.textContent = 'परिशिष्ट-02 (DM Betul)';
    } else {
        btnRM.classList.add('active');
        btnDM.classList.remove('active');
        if (badge) badge.textContent = 'परिशिष्ट-03 (RM Office)';
    }

    renderDashboard();
    renderRosterTable();
    selectProtocolDay('mon');
}

// ── Navigation Tab Switcher ───────────────────────────────
function showSupervView(viewId, navEl) {
    SupervState.currentView = viewId;
    document.querySelectorAll('.superv-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById('view-' + viewId);
    if (targetView) targetView.classList.add('active');

    if (navEl) {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
        navEl.classList.add('active');
    }

    if (viewId === 'compliance') {
        renderMonthlyComplianceLetter();
    }
    if (viewId === 'tasks') {
        loadSupervisionTasks();
    }
}


// ── API Fetchers ──────────────────────────────────────────
async function fetchSupervisionStats() {
    try {
        const res = await fetch('/api/supervision/stats');
        if (res.ok) {
            SupervState.stats = await res.json();
            updateKpiCards();
        }
    } catch (e) {
        console.warn('Failed to load supervision stats:', e);
    }
}

async function fetchInspections() {
    try {
        const res = await fetch('/api/supervision/inspections');
        if (res.ok) {
            SupervState.inspections = await res.json();
        }
    } catch (e) {
        console.warn('Failed to load inspections:', e);
    }
}

async function fetchSurpriseVisits() {
    try {
        const res = await fetch('/api/supervision/surprise');
        if (res.ok) {
            SupervState.surpriseVisits = await res.json();
        }
    } catch (e) {
        console.warn('Failed to load surprise visits:', e);
    }
}

async function fetchRoster() {
    try {
        const res = await fetch('/api/supervision/roster?year=2026');
        if (res.ok) {
            SupervState.roster = await res.json();
        }
    } catch (e) {
        console.warn('Failed to load roster:', e);
    }
}

async function fetchDirectoryData() {
    try {
        const [icRes, brRes] = await Promise.all([
            fetch('/api/directory/issue-centers'),
            fetch('/api/directory/branches')
        ]);
        if (icRes.ok) SupervState.issueCentersDirectory = await icRes.json();
        if (brRes.ok) SupervState.branchesDirectory = await brRes.json();
    } catch (e) {
        console.warn('Directory fetch error:', e);
    }
}

// ── KPI Dashboard Rendering ───────────────────────────────
function updateKpiCards() {
    const s = SupervState.stats;
    const kpiMonth = document.getElementById('kpiMonthInspections');
    const kpiScore = document.getElementById('kpiAvgScore');
    const kpiRoster = document.getElementById('kpiRosterCompleted');
    const kpiSurp = document.getElementById('kpiSurpriseAndMeetings');

    if (kpiMonth) kpiMonth.textContent = s.inspectionsThisMonth || 0;
    if (kpiScore) kpiScore.textContent = (s.averageComplianceScore || 94) + '%';
    if (kpiRoster) kpiRoster.textContent = `${s.rosterCompleted || 0} / ${s.totalRosterPlanned || 0}`;
    if (kpiSurp) kpiSurp.textContent = `${s.totalSurpriseVisits || 0} / ${s.totalMeetingsRecorded || 0}`;
}

function renderDashboard() {
    updateKpiCards();
    const tbody = document.getElementById('dashboardRecentInspTable');
    const badge = document.getElementById('inspCountBadge');
    if (badge) badge.textContent = `${SupervState.inspections.length} Reports`;

    if (!tbody) return;

    if (SupervState.inspections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">कोई निरीक्षण अभिलेख उपलब्ध नहीं है। "नया निरीक्षण" बटन दबाकर प्रविष्टि करें।</td></tr>`;
        return;
    }

    tbody.innerHTML = SupervState.inspections.slice(0, 5).map(insp => {
        const scoreColor = insp.compliance_score >= 85 ? 'var(--superv-success)' : (insp.compliance_score >= 70 ? 'var(--superv-warning)' : 'var(--superv-danger)');
        return `
            <tr>
                <td style="font-family:monospace; font-weight:600;">${escapeHtml(insp.id)}</td>
                <td><strong style="color:var(--text-main);">${escapeHtml(insp.issue_center)}</strong></td>
                <td>${escapeHtml(insp.inspection_date)}</td>
                <td>${escapeHtml(insp.officer_name || '-')}</td>
                <td style="text-align:center;">${insp.godowns_count || 1}</td>
                <td>
                    <span style="font-weight:700; color:${scoreColor}; background:rgba(0,0,0,0.2); padding:3px 8px; border-radius:6px;">
                        ${insp.compliance_score}%
                    </span>
                </td>
                <td>
                    <span style="font-size:12px; color:${insp.deficiencies_count > 0 ? 'var(--superv-warning)' : 'var(--superv-success)'};">
                        ${insp.deficiencies_count > 0 ? `⚠️ ${insp.deficiencies_count} कमियां दर्ज` : '✅ पूर्णतः संतुष्ट'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="viewInspectionReport('${insp.id}')">🖨️ देखें / प्रिंट</button>
                </td>
            </tr>
        `;
    }).join('');

    // Render Surprise items on Dashboard
    const surpList = document.getElementById('dashboardSurpriseList');
    if (surpList) {
        if (SupervState.surpriseVisits.length === 0) {
            surpList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted);">कोई औचक निरीक्षण प्रविष्टि नहीं है।</div>`;
        } else {
            surpList.innerHTML = SupervState.surpriseVisits.slice(0, 3).map(sv => `
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:700; font-size:13px; color:var(--text-main);">${escapeHtml(sv.issue_center)} — ${escapeHtml(sv.inspection_date)}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(sv.officer_name)} · कमियां: ${sv.defects_count || 0}</div>
                    </div>
                    <div style="font-weight:700; color:${sv.score >= 80 ? 'var(--superv-success)' : 'var(--superv-warning)'}; font-size:14px;">
                        ${sv.score}%
                    </div>
                </div>
            `).join('');
        }
    }
}

// ── Physical Stock Verification Table Form ────────────────
function renderStockVerificationRows() {
    const tbody = document.getElementById('stockVerifyTableBody');
    if (!tbody) return;

    tbody.innerHTML = SupervState.commoditiesList.map((comm, i) => `
        <tr data-commodity="${comm}">
            <td><strong>${comm}</strong></td>
            <td><input type="number" class="superv-input stk-sound-bags" value="0" min="0" oninput="recalculateStockTotals()" style="width:90px;"></td>
            <td><input type="number" step="0.01" class="superv-input stk-sound-qty" value="0.00" min="0" oninput="recalculateStockTotals()" style="width:110px;"></td>
            <td><input type="number" class="superv-input stk-dam-bags" value="0" min="0" oninput="recalculateStockTotals()" style="width:90px;"></td>
            <td><input type="number" step="0.01" class="superv-input stk-dam-qty" value="0.00" min="0" oninput="recalculateStockTotals()" style="width:110px;"></td>
            <td><input type="number" class="superv-input stk-swp-bags" value="0" min="0" oninput="recalculateStockTotals()" style="width:90px;"></td>
            <td><input type="number" step="0.01" class="superv-input stk-swp-qty" value="0.00" min="0" oninput="recalculateStockTotals()" style="width:110px;"></td>
            <td class="stk-tot-bags" style="font-weight:700; text-align:center; background:rgba(14,165,233,0.06);">0</td>
            <td class="stk-tot-qty" style="font-weight:700; text-align:right; background:rgba(14,165,233,0.06);">0.00</td>
        </tr>
    `).join('');
}

function recalculateStockTotals() {
    const rows = document.querySelectorAll('#stockVerifyTableBody tr');
    let grandSoundBags = 0, grandSoundQty = 0;
    let grandDamBags = 0, grandDamQty = 0;
    let grandSwpBags = 0, grandSwpQty = 0;
    let grandTotalBags = 0, grandTotalQty = 0;

    rows.forEach(r => {
        const sBags = parseInt(r.querySelector('.stk-sound-bags')?.value || 0, 10);
        const sQty = parseFloat(r.querySelector('.stk-sound-qty')?.value || 0);
        const dBags = parseInt(r.querySelector('.stk-dam-bags')?.value || 0, 10);
        const dQty = parseFloat(r.querySelector('.stk-dam-qty')?.value || 0);
        const wBags = parseInt(r.querySelector('.stk-swp-bags')?.value || 0, 10);
        const wQty = parseFloat(r.querySelector('.stk-swp-qty')?.value || 0);

        const rowTotBags = sBags + dBags + wBags;
        const rowTotQty = sQty + dQty + wQty;

        const cellTotBags = r.querySelector('.stk-tot-bags');
        const cellTotQty = r.querySelector('.stk-tot-qty');
        if (cellTotBags) cellTotBags.textContent = rowTotBags;
        if (cellTotQty) cellTotQty.textContent = rowTotQty.toFixed(2);

        grandSoundBags += sBags;
        grandSoundQty += sQty;
        grandDamBags += dBags;
        grandDamQty += dQty;
        grandSwpBags += wBags;
        grandSwpQty += wQty;
        grandTotalBags += rowTotBags;
        grandTotalQty += rowTotQty;
    });

    const elTotSBags = document.getElementById('totSoundBags');
    const elTotSQty = document.getElementById('totSoundQty');
    const elTotDBags = document.getElementById('totDamBags');
    const elTotDQty = document.getElementById('totDamQty');
    const elTotWBags = document.getElementById('totSwpBags');
    const elTotWQty = document.getElementById('totSwpQty');
    const elGrandBags = document.getElementById('grandTotalBags');
    const elGrandQty = document.getElementById('grandTotalQty');

    if (elTotSBags) elTotSBags.textContent = grandSoundBags;
    if (elTotSQty) elTotSQty.textContent = grandSoundQty.toFixed(2);
    if (elTotDBags) elTotDBags.textContent = grandDamBags;
    if (elTotDQty) elTotDQty.textContent = grandDamQty.toFixed(2);
    if (elTotWBags) elTotWBags.textContent = grandSwpBags;
    if (elTotWQty) elTotWQty.textContent = grandSwpQty.toFixed(2);
    if (elGrandBags) elGrandBags.textContent = grandTotalBags;
    if (elGrandQty) elGrandQty.textContent = grandTotalQty.toFixed(2);
}

function recalcGunnyBags() {
    const jB = parseInt(document.getElementById('gbJuteNewBags')?.value || 0, 10);
    const jU = parseInt(document.getElementById('gbJuteNewUnusable')?.value || 0, 10);
    const hB = parseInt(document.getElementById('gbHdpeBags')?.value || 0, 10);
    const hU = parseInt(document.getElementById('gbHdpeUnusable')?.value || 0, 10);
    const oB = parseInt(document.getElementById('gbJuteOldBags')?.value || 0, 10);
    const oU = parseInt(document.getElementById('gbJuteOldUnusable')?.value || 0, 10);

    const elJTot = document.getElementById('gbJuteNewTotal');
    const elHTot = document.getElementById('gbHdpeTotal');
    const elOTot = document.getElementById('gbJuteOldTotal');

    if (elJTot) elJTot.textContent = jB + jU;
    if (elHTot) elHTot.textContent = hB + hU;
    if (elOTot) elOTot.textContent = oB + oU;
}

// ── 16-17 Checklist Checkpoints ───────────────────────────
function renderCheckpoints() {
    const container = document.getElementById('inspectionChecklistContainer');
    if (!container) return;

    container.innerHTML = SupervState.checkpoints.map(chk => `
        <div class="check-item" data-id="${chk.id}">
            <div class="check-item-info">
                <span class="check-item-num">${chk.num}</span>
                <span class="check-item-text">${chk.text}</span>
            </div>
            <div class="toggle-btn-group">
                <button type="button" class="toggle-opt yes active" onclick="toggleCheckpoint('${chk.id}', true)">हाँ</button>
                <button type="button" class="toggle-opt no" onclick="toggleCheckpoint('${chk.id}', false)">नहीं</button>
            </div>
        </div>
    `).join('');
}

function toggleCheckpoint(id, isYes) {
    const item = document.querySelector(`.check-item[data-id="${id}"]`);
    if (!item) return;
    const btnYes = item.querySelector('.toggle-opt.yes');
    const btnNo = item.querySelector('.toggle-opt.no');
    if (isYes) {
        btnYes.classList.add('active');
        btnNo.classList.remove('active');
    } else {
        btnNo.classList.add('active');
        btnYes.classList.remove('active');
    }
}

function setAllCheckpoints(isYes) {
    SupervState.checkpoints.forEach(chk => toggleCheckpoint(chk.id, isYes));
}

// ── Issues & Recommendations Table Rows ───────────────────
function addIssueRow() {
    const tbody = document.getElementById('issuesTableBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><textarea class="superv-textarea" rows="2" style="width:100%;" placeholder="कमी का विवरण..."></textarea></td>
        <td><textarea class="superv-textarea" rows="2" style="width:100%;" placeholder="सुझाव एवं समय सीमा..."></textarea></td>
        <td><button type="button" class="btn btn-danger btn-sm" onclick="removeIssueRow(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
}

function removeIssueRow(btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
}

// ── Issue Center Change Auto-Fill ─────────────────────────
function onIssueCenterChanged(icName) {
    if (!icName) return;
    // Find IC in directory
    const dir = SupervState.issueCentersDirectory.find(i => (i.name || '').toLowerCase().includes(icName.toLowerCase()));
    if (dir) {
        const inchargeEl = document.getElementById('formInchargeName');
        const inchargeMob = document.getElementById('formInchargeMobile');
        const bmEl = document.getElementById('formBranchManager');
        const godownsEl = document.getElementById('formGodownsCount');

        if (inchargeEl && dir.incharge) inchargeEl.value = dir.incharge;
        if (inchargeMob && dir.mobile) inchargeMob.value = dir.mobile;
        if (bmEl && dir.branchManager) bmEl.value = dir.branchManager;
        if (godownsEl && dir.godownsCount) godownsEl.value = dir.godownsCount;
    }
}

function prefillInspectionWithDirectoryData() {
    const ic = document.getElementById('formIssueCenter')?.value;
    if (!ic) {
        alert('कृपया पहले कोई प्रदाय केंद्र चुनें।');
        return;
    }
    onIssueCenterChanged(ic);
    alert(`${ic} प्रदाय केंद्र के संपर्क एवं गोदाम विवरण निर्देशिका से स्वतः भर दिए गए हैं।`);
}

// ── Save Inspection ───────────────────────────────────────
async function handleSaveInspection(e) {
    e.preventDefault();

    const ic = document.getElementById('formIssueCenter').value;
    const date = document.getElementById('formInspectionDate').value;
    const month = document.getElementById('formInspectionMonth').value;
    const officer = document.getElementById('formOfficerName').value;
    const officerMob = document.getElementById('formOfficerMobile').value;
    const incharge = document.getElementById('formInchargeName').value;
    const inchargeMob = document.getElementById('formInchargeMobile').value;
    const bm = document.getElementById('formBranchManager').value;
    const godowns = parseInt(document.getElementById('formGodownsCount').value || 1, 10);
    const remarks = document.getElementById('formOverallRemarks').value;

    // Collect reservations
    const reservation = {
        wheat: parseFloat(document.getElementById('resWheat')?.value || 0),
        rice: parseFloat(document.getElementById('resRice')?.value || 0),
        sugar: parseFloat(document.getElementById('resSugar')?.value || 0),
        salt: parseFloat(document.getElementById('resSalt')?.value || 0)
    };

    // Collect physical stock
    const stock = [];
    document.querySelectorAll('#stockVerifyTableBody tr').forEach(r => {
        const comm = r.getAttribute('data-commodity');
        const soundBags = parseInt(r.querySelector('.stk-sound-bags')?.value || 0, 10);
        const soundQty = parseFloat(r.querySelector('.stk-sound-qty')?.value || 0);
        const damagedBags = parseInt(r.querySelector('.stk-dam-bags')?.value || 0, 10);
        const damagedQty = parseFloat(r.querySelector('.stk-dam-qty')?.value || 0);
        const sweepageBags = parseInt(r.querySelector('.stk-swp-bags')?.value || 0, 10);
        const sweepageQty = parseFloat(r.querySelector('.stk-swp-qty')?.value || 0);

        if (soundBags > 0 || soundQty > 0 || damagedBags > 0 || sweepageBags > 0) {
            stock.push({
                commodity: comm,
                soundBags, soundQty,
                damagedBags, damagedQty,
                sweepageBags, sweepageQty
            });
        }
    });

    // Collect gunny bags
    const gunnyBags = {
        juteNew: {
            usableBales: parseInt(document.getElementById('gbJuteNewBales')?.value || 0, 10),
            usableBags: parseInt(document.getElementById('gbJuteNewBags')?.value || 0, 10),
            unusableBags: parseInt(document.getElementById('gbJuteNewUnusable')?.value || 0, 10)
        },
        hdpe: {
            usableBales: parseInt(document.getElementById('gbHdpeBales')?.value || 0, 10),
            usableBags: parseInt(document.getElementById('gbHdpeBags')?.value || 0, 10),
            unusableBags: parseInt(document.getElementById('gbHdpeUnusable')?.value || 0, 10)
        },
        juteOld: {
            usableBales: parseInt(document.getElementById('gbJuteOldBales')?.value || 0, 10),
            usableBags: parseInt(document.getElementById('gbJuteOldBags')?.value || 0, 10),
            unusableBags: parseInt(document.getElementById('gbJuteOldUnusable')?.value || 0, 10)
        }
    };

    // Collect Doorstep delivery
    const doorstepDelivery = {
        wheatLifted: parseFloat(document.getElementById('ddWheat')?.value || 0),
        riceLifted: parseFloat(document.getElementById('ddRice')?.value || 0),
        sugarLifted: parseFloat(document.getElementById('ddSugar')?.value || 0),
        saltLifted: parseFloat(document.getElementById('ddSalt')?.value || 0),
        fpsDeliveredCount: parseInt(document.getElementById('ddFpsCount')?.value || 0, 10),
        transporterReceiptDate: document.getElementById('ddTransDate')?.value || '',
        receiptSentToDO: document.getElementById('ddDoDate')?.value || '',
        enteredInSoftwareDate: document.getElementById('ddSoftwareDate')?.value || ''
    };

    // Collect Checkpoints
    const checkpoints = {};
    let passedCount = 0;
    SupervState.checkpoints.forEach(chk => {
        const item = document.querySelector(`.check-item[data-id="${chk.id}"]`);
        const isYes = item?.querySelector('.toggle-opt.yes')?.classList.contains('active');
        checkpoints[chk.id] = !!isYes;
        if (isYes) passedCount++;
    });

    const complianceScore = Math.round((passedCount / SupervState.checkpoints.length) * 100);

    // Collect issues
    const issuesAndSuggestions = [];
    document.querySelectorAll('#issuesTableBody tr').forEach(r => {
        const textareas = r.querySelectorAll('textarea');
        const issue = (textareas[0]?.value || '').trim();
        const suggestion = (textareas[1]?.value || '').trim();
        if (issue || suggestion) {
            issuesAndSuggestions.push({ issue, suggestion });
        }
    });

    const deficienciesCount = (SupervState.checkpoints.length - passedCount) + issuesAndSuggestions.length;

    const payload = {
        reservation,
        stock,
        gunnyBags,
        doorstepDelivery,
        checkpoints,
        issuesAndSuggestions,
        remarks
    };

    const record = {
        mode: SupervState.mode,
        issueCenter: ic,
        inspectionMonth: month,
        inspectionDate: date,
        officerName: officer,
        officerDesignation: SupervState.mode === 'dm' ? 'District Manager (MPSCSC)' : 'Regional Manager (MPSCSC)',
        officerMobile: officerMob,
        inchargeName: incharge,
        inchargeMobile: inchargeMob,
        branchManager: bm,
        godownsCount: godowns,
        complianceScore,
        deficienciesCount,
        payload
    };

    try {
        const res = await fetch('/api/supervision/inspections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        if (res.ok) {
            const data = await res.json();
            alert(`✅ निरीक्षण प्रतिवेदन सफलतापूर्वक सुरक्षित किया गया!\nआईडी: ${data.id}\nअनुपालन स्तर: ${complianceScore}%`);
            await fetchInspections();
            await fetchSupervisionStats();
            renderDashboard();
            renderArchivesTable();
            showSupervView('archives', document.getElementById('superv-nav-archives'));
        } else {
            alert('सुरक्षित करने में त्रुटि आई। कृपया पुनः प्रयास करें।');
        }
    } catch (err) {
        console.error(err);
        alert('सर्वर से संपर्क नहीं हो सका: ' + err.message);
    }
}

function resetInspectionForm() {
    if (confirm('क्या आप फॉर्म रीसेट करना चाहते हैं?')) {
        document.getElementById('detailedInspectionForm').reset();
        initDefaultDates();
        setAllCheckpoints(true);
        recalculateStockTotals();
        recalcGunnyBags();
    }
}

// ── Surprise Inspection Logic ─────────────────────────────
function renderSurpriseChecklist() {
    const container = document.getElementById('surpriseChecklistGrid');
    if (!container) return;

    container.innerHTML = SupervState.surprisePoints.map(p => `
        <div class="surprise-checklist-row" data-sp-id="${p.id}">
            <div class="sp-text-wrapper">
                <span class="sp-num">${p.id}</span>
                <span class="sp-text">${p.text}</span>
            </div>
            <div class="toggle-btn-group">
                <button type="button" class="toggle-opt yes active" onclick="toggleSurpriseItem(${p.id}, true)">मानक अनुरूप (Pass)</button>
                <button type="button" class="toggle-opt no" onclick="toggleSurpriseItem(${p.id}, false)">कमी (Defect)</button>
            </div>
        </div>
    `).join('');
    updateSurpriseLiveScore();
}

function toggleSurpriseItem(id, isPass) {
    const row = document.querySelector(`[data-sp-id="${id}"]`);
    if (!row) return;
    const btnY = row.querySelector('.toggle-opt.yes');
    const btnN = row.querySelector('.toggle-opt.no');
    if (isPass) {
        btnY.classList.add('active');
        btnN.classList.remove('active');
    } else {
        btnN.classList.add('active');
        btnY.classList.remove('active');
    }
    updateSurpriseLiveScore();
}

function setAllSurpriseItems(isPass) {
    SupervState.surprisePoints.forEach(p => {
        const row = document.querySelector(`[data-sp-id="${p.id}"]`);
        if (!row) return;
        const btnY = row.querySelector('.toggle-opt.yes');
        const btnN = row.querySelector('.toggle-opt.no');
        if (isPass) {
            btnY.classList.add('active');
            btnN.classList.remove('active');
        } else {
            btnN.classList.add('active');
            btnY.classList.remove('active');
        }
    });
    updateSurpriseLiveScore();
}

function updateSurpriseLiveScore() {
    let passCount = 0;
    const total = SupervState.surprisePoints.length;
    SupervState.surprisePoints.forEach(p => {
        const row = document.querySelector(`[data-sp-id="${p.id}"]`);
        if (row && row.querySelector('.toggle-opt.yes')?.classList.contains('active')) {
            passCount++;
        }
    });
    const percent = Math.round((passCount / total) * 100);
    const badge = document.getElementById('surpLiveScorePill');
    if (badge) {
        if (percent === 100) {
            badge.style.background = 'rgba(34,197,94,0.15)';
            badge.style.color = '#22c55e';
            badge.style.border = '1px solid rgba(34,197,94,0.3)';
            badge.innerHTML = `🟢 अनुपालन: ${percent}% (${passCount}/${total} पास)`;
        } else if (percent >= 70) {
            badge.style.background = 'rgba(234,179,8,0.15)';
            badge.style.color = '#eab308';
            badge.style.border = '1px solid rgba(234,179,8,0.3)';
            badge.innerHTML = `🟡 अनुपालन: ${percent}% (${passCount}/${total} पास, ${total - passCount} कमी)`;
        } else {
            badge.style.background = 'rgba(239,68,68,0.15)';
            badge.style.color = '#ef4444';
            badge.style.border = '1px solid rgba(239,68,68,0.3)';
            badge.innerHTML = `🔴 अनुपालन: ${percent}% (${passCount}/${total} पास, ${total - passCount} कमियां)`;
        }
    }
}

function openSurpriseModal() {
    initDefaultDates();
    const officerInput = document.getElementById('surpOfficer');
    if (officerInput && !officerInput.value) {
        officerInput.value = SupervState.mode === 'dm' ? 'District Manager, MPSCSC Betul' : 'Regional Manager, MPSCSC Bhopal';
    }
    updateSurpriseLiveScore();
    openModal('modalSurprise');
}

async function handleSaveSurprise(e) {
    e.preventDefault();
    const ic = document.getElementById('surpIssueCenter').value;
    const date = document.getElementById('surpDate').value;
    const officer = document.getElementById('surpOfficer').value;
    const remark = document.getElementById('surpOverallRemark').value;

    let passCount = 0;
    const points = SupervState.surprisePoints.map(p => {
        const row = document.querySelector(`[data-sp-id="${p.id}"]`);
        const isPass = row?.querySelector('.toggle-opt.yes')?.classList.contains('active');
        if (isPass) passCount++;
        return {
            id: p.id,
            label: p.text,
            compliant: !!isPass
        };
    });

    const score = Math.round((passCount / SupervState.surprisePoints.length) * 100);
    const defectsCount = SupervState.surprisePoints.length - passCount;

    const record = {
        mode: SupervState.mode,
        issueCenter: ic,
        inspectionDate: date,
        officerName: officer,
        officerDesignation: SupervState.mode === 'dm' ? 'District Manager' : 'Regional Manager',
        score,
        defectsCount,
        payload: {
            points,
            overallRemark: remark
        }
    };

    try {
        const res = await fetch('/api/supervision/surprise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        if (res.ok) {
            alert(`⚡ औचक निरीक्षण सुरक्षित किया गया!\nस्कोर: ${score}%\nकमियां: ${defectsCount}`);
            closeModal('modalSurprise');
            await fetchSurpriseVisits();
            await fetchSupervisionStats();
            renderDashboard();
            renderSurpriseTable();
        }
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

function renderSurpriseTable() {
    const tbody = document.getElementById('surpriseFullTableBody');
    if (!tbody) return;

    if (SupervState.surpriseVisits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">कोई औचक निरीक्षण प्रविष्टि नहीं है।</td></tr>`;
        return;
    }

    tbody.innerHTML = SupervState.surpriseVisits.map(sv => `
        <tr>
            <td>${escapeHtml(sv.inspection_date)}</td>
            <td><strong>${escapeHtml(sv.issue_center)}</strong></td>
            <td>${escapeHtml(sv.officer_name || '-')}</td>
            <td><span style="color:${sv.defects_count > 0 ? 'var(--superv-warning)' : 'var(--superv-success)'}; font-weight:700;">${sv.defects_count || 0}</span></td>
            <td><span style="font-weight:700; color:${sv.score >= 80 ? 'var(--superv-success)' : 'var(--superv-danger)'};">${sv.score}%</span></td>
            <td>${escapeHtml(sv.payload?.overallRemark || 'व्यवस्थाएं परखी गईं।')}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="deleteSurpriseVisit('${sv.id}')">🗑️ हटाएं</button>
            </td>
        </tr>
    `).join('');
}

async function deleteSurpriseVisit(id) {
    if (confirm('क्या आप इस औचक निरीक्षण प्रविष्टि को हटाना चाहते हैं?')) {
        await fetch('/api/supervision/surprise/' + id, { method: 'DELETE' });
        await fetchSurpriseVisits();
        renderSurpriseTable();
        renderDashboard();
    }
}

// ── Annual Roster Logic (परिशिष्ट 01) ──────────────────────
function renderRosterTable() {
    const tbody = document.getElementById('rosterTableBody');
    if (!tbody) return;

    const filterMonth = document.getElementById('rosterFilterMonth')?.value || 'ALL';
    let rows = SupervState.roster;
    if (filterMonth !== 'ALL') {
        rows = rows.filter(r => r.month === filterMonth);
    }

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">कोई रोस्टर डेटा उपलब्ध नहीं है। "+ नया रोस्टर लक्ष्य" जोड़ें।</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const isComp = r.status === 'completed';
        const stBadge = isComp 
            ? '<span style="background:rgba(16,185,129,0.15); color:var(--superv-success); padding:3px 8px; border-radius:4px; font-weight:700;">पूर्ण (Completed)</span>'
            : '<span style="background:rgba(245,158,11,0.15); color:var(--superv-warning); padding:3px 8px; border-radius:4px; font-weight:700;">लंबित (Pending)</span>';

        return `
            <tr>
                <td><strong>${escapeHtml(r.month)}</strong></td>
                <td><strong style="color:var(--text-main);">${escapeHtml(r.issue_center)}</strong></td>
                <td style="text-align:center;">${r.target_godowns || 1}</td>
                <td>${escapeHtml(r.planned_date || '-')}</td>
                <td>${escapeHtml(r.completed_date || '-')}</td>
                <td>${escapeHtml(r.officer_name || 'DM')}</td>
                <td>${stBadge}</td>
                <td>${escapeHtml(r.remarks || '-')}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="editRosterItem('${r.id}')">संशोधित</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteRosterItem('${r.id}')">✕</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterRosterTable() {
    renderRosterTable();
}

function openAddRosterModal() {
    document.getElementById('rosterItemForm').reset();
    document.getElementById('rosterEditId').value = '';
    openModal('modalRoster');
}

function editRosterItem(id) {
    const item = SupervState.roster.find(r => r.id === id);
    if (!item) return;

    document.getElementById('rosterEditId').value = item.id;
    document.getElementById('rosterMonth').value = item.month;
    document.getElementById('rosterIC').value = item.issue_center;
    document.getElementById('rosterGodowns').value = item.target_godowns || 1;
    document.getElementById('rosterPlannedDate').value = item.planned_date || '';
    document.getElementById('rosterCompletedDate').value = item.completed_date || '';
    document.getElementById('rosterStatus').value = item.status || 'pending';
    document.getElementById('rosterOfficer').value = item.officer_name || '';
    document.getElementById('rosterRemarks').value = item.remarks || '';

    openModal('modalRoster');
}

async function handleSaveRosterItem(e) {
    e.preventDefault();
    const id = document.getElementById('rosterEditId').value || ('ROST_' + Date.now());
    const month = document.getElementById('rosterMonth').value;
    const ic = document.getElementById('rosterIC').value;
    const godowns = parseInt(document.getElementById('rosterGodowns').value || 1, 10);
    const planned = document.getElementById('rosterPlannedDate').value;
    const completed = document.getElementById('rosterCompletedDate').value;
    const status = document.getElementById('rosterStatus').value;
    const officer = document.getElementById('rosterOfficer').value;
    const remarks = document.getElementById('rosterRemarks').value;

    const payload = {
        id,
        year: 2026,
        month,
        issueCenter: ic,
        targetGodowns: godowns,
        plannedDate: planned,
        completedDate: completed,
        status,
        officerName: officer,
        remarks
    };

    try {
        const res = await fetch('/api/supervision/roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal('modalRoster');
            await fetchRoster();
            await fetchSupervisionStats();
            renderRosterTable();
            renderDashboard();
        }
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

async function deleteRosterItem(id) {
    if (confirm('क्या आप इस रोस्टर लक्ष्य को हटाना चाहते हैं?')) {
        await fetch('/api/supervision/roster/' + id, { method: 'DELETE' });
        await fetchRoster();
        renderRosterTable();
    }
}

// ── Day-Wise Weekly Activity Protocol ─────────────────────
const ProtocolGuidelines = {
    mon: {
        title: 'सोमवार — जिला मुख्यालय पर प्रबंधकीय व्यवस्था',
        points: [
            'प्रथम सप्ताह में गत माह की कमियों का समग्र आंकलन एवं समीक्षा।',
            'साप्ताहिक सा०वि०प्र० की स्कंध उपलब्धता एवं वितरण की सी०एस०एम०एस० (CSMS) सॉफ्टवेयर से गहन समीक्षा।',
            'अतिशेष खाद्यान्न / मिलिंग की साप्ताहिक कार्य योजना (FCI / GOI परिदान)।',
            'उपार्जन कार्य की समीक्षा — भुगतान, परिवहन योग्य स्कंध का समितिवार आंकलन।',
            'मासिक लक्ष्यों का साप्ताहिक वर्गीकरण, कार्य निर्धारण एवं प्रगति आंकलन।',
            'वी०सी० (Video Conference) हेतु जानकारी प्रत्येक सोमवार को क्षेत्रीय कार्यालय / मुख्यालय प्रेषण।',
            'गत सप्ताह की गई व्यवस्थाओं की प्रगति की समीक्षा।'
        ]
    },
    tue: {
        title: 'मंगलवार — आधे दिवस भ्रमण एवं वित्तीय प्रबंधकीय कार्य',
        points: [
            'आधे दिवस क्षेत्रीय भ्रमण एवं प्रदाय केन्द्रों / गोदामों का औचक निरीक्षण।',
            'आधा दिवस प्रबंधकीय व्यवस्था — वित्तीय कार्य (रिकवरी विशेषकर विक्रय से प्राप्त राशि एवं सब्सिडी क्लेम की जानकारी)।',
            'द्वार प्रदाय सामग्री एवं परिवहन के साप्ताहिक देयकों का परीक्षण, निपटान एवं भुगतान समीक्षा।',
            'स्थापना संबंधी कार्य — डाटा एन्ट्री ऑपरेटर्स की समस्याओं का निवारण।',
            'वी०सी० (Video Conference) की समीक्षा एवं आगामी एजेंडा तैयारी।',
            'कमिश्नर, कलेक्टर, सहकारिता एवं केन्द्रीय सहकारी बैंक अधिकारियों से संपर्क।'
        ]
    },
    wed: {
        title: 'बुधवार — आधा दिवस वी०सी० एवं द्वार प्रदाय समीक्षा',
        points: [
            'आधा दिवस प्रबंध संचालक महोदय एवं मुख्यालय स्तर से आयोजित वीडियो कान्फ्रेंसिंग (VC) में सहभागिता।',
            'आधा दिवस द्वार प्रदाय की समीक्षा एवं परिवहनकर्ताओं के साथ समन्वय बैठक।',
            'परिवहन अनुबंध संबंधी समस्याओं का त्वरित निराकरण।',
            'प्रदाय केन्द्रवार खाद्यान्न की आवंटन अनुसार पूर्ति हेतु द्वार प्रदाय योजना का कैलेण्डर पालन सुनिश्चित करना।',
            'गत माह विक्रय की राशि प्राप्ति की पुष्टि एवं चालान मिलान।'
        ]
    },
    thu: {
        title: 'गुरुवार — पूर्ण दिवस प्रदाय केन्द्रों / गोदामों का सघन निरीक्षण',
        points: [
            'पूर्ण दिवस भ्रमण — माह में कम से कम 3 से 5 गोदामों का विस्तृत सत्यापन निरीक्षण।',
            'प्रदाय केन्द्र पर रिकॉर्ड संधारण एवं डाटा एन्ट्री (IRRS तथा CSMS) की नियमितता एवं रिलायबिलिटी की जांच।',
            'द्वार प्रदाय कार्य का क्रियान्वयन, परिवहन की स्थिति एवं पावती संकलन।',
            'भंडारित स्कंध की उपलब्धता, वैज्ञानिक गुणवत्ता, कीटोपचार एवं स्टेक कार्ड सत्यापन।',
            'उपार्जन अवधि में उपार्जन केन्द्रों का निरीक्षण एवं छाया/पानी/उपकरण व्यवस्था।'
        ]
    },
    fri: {
        title: 'शुक्रवार — समन्वय बैठक एवं कक्षवार प्रबंधकीय समीक्षा',
        points: [
            'आधा दिवस विभिन्न संस्थाओं के साथ समन्वय बैठक:',
            '  • भा०खा०नि० (FCI) समन्वय बैठक — अतिशेष स्टॉक निराकरण एवं केंद्रीय पूल परिदान।',
            '  • प्रथम सप्ताह खाद्य, ग्रामीण विकास तथा आई०सी०डी०एस० (WCD) विभाग से समन्वय।',
            '  • द्वितीय सप्ताह म०प्र० वेयरहाउसिंग कार्पोरेशन (MPWLC/SWC) के साथ समन्वय बैठक।',
            '  • तृतीय सप्ताह मार्कफेड (Markfed) के साथ धान मिलिंग व सीएमआर परिदान बैठक।',
            '  • चतुर्थ सप्ताह जिला सहकारी केंद्रीय बैंक (DCCB) के साथ समिति देयक बैठक।',
            'आधा दिवस कक्षवार समीक्षा — उपार्जन लेखा, अंकेक्षण आपत्तियों का निराकरण, वसूली, डाक पत्रों का निपटान, परिवहन देयक।'
        ]
    },
    sat: {
        title: 'शनिवार — प्रदाय केन्द्र प्रभारियों की मासिक बैठक / निरीक्षण',
        points: [
            'प्रथम सप्ताह — पूर्ण दिवस प्रदाय केन्द्र प्रभारियों एवं कार्यालय कर्मियों की मासिक समीक्षा बैठक।',
            'चतुर्थ सप्ताह — पूर्ण दिवस प्रदाय केन्द्र एवं संबद्ध गोदामों का निरीक्षण एवं माह भर के लक्ष्यों की पूर्ति का सत्यापन।'
        ]
    }
};

function selectProtocolDay(dayKey, el) {
    if (el) {
        document.querySelectorAll('#daysNavPills .day-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
    }

    const data = ProtocolGuidelines[dayKey];
    const container = document.getElementById('protocolDayContent');
    if (!container || !data) return;

    container.innerHTML = `
        <div class="day-duty-card">
            <h4>${data.title}</h4>
            <ul>
                ${data.points.map(pt => `<li>${pt}</li>`).join('')}
            </ul>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; margin-top:14px;">
            <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:8px;">📌 आज के मुख्य दायित्व अनुपालन चेकलिस्ट (Today's Checklist)</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${data.points.slice(0, 4).map((pt, i) => `
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text-muted); cursor:pointer;">
                        <input type="checkbox" style="width:16px; height:16px;">
                        <span>${pt}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

// ── Inter-Agency Coordination Agendas (परिशिष्ट 06) ────────
const AgencyAgendas = {
    MPWLC: {
        title: 'म.प्र. वेयरहाउसिंग एवं लॉजिस्टिक कार्पोरेशन (MPWLC) — 10 विचारणीय बिंदु',
        points: [
            '1. हार्डवेयर / नेट कनेक्शन, आपरेटर्स के माध्यम से कम्प्यूटराईज्ड कार्य संपादन की स्थिति।',
            '2. साविप्र भण्डारण हेतु स्थान की उपलब्धता एवं जमा स्कंध के निकासी के लिए गोदामों का क्रम निर्धारण।',
            '3. वैज्ञानिक भंडारण एवं गुणवत्ता की स्थिति की समीक्षा (धूमीकरण एवं रासायनिक उपचार)।',
            '4. स्टेक किल करने में आ रही कठिनाईयों के संबंध में समीक्षा।',
            '5. मासिक आधार पर लॉस / गेन पत्रक एवं भंडारण शुल्क के देयकों की प्रस्तुति की स्थिति समीक्षा।',
            '6. स्टेक लोडिंग / अनलोडिंग संबंधी समस्याएं एवं हम्माली व्यवस्था।',
            '7. स्टेक की सुरक्षा हेतु वांछित कीटनाशक रसायनों की उपलब्धता।',
            '8. भंडारण कमी के दावों का निराकरण एवं जांच।',
            '9. गेहूं में 1 प्रतिशत से कम प्राप्त आधिक्य के दावों का निराकरण।',
            '10. भंडारण शुल्क देयकों के भुगतान एवं समायोजन की स्थिति।'
        ]
    },
    Markfed: {
        title: 'मार्कफेड (Markfed) — 5 विचारणीय बिंदु',
        points: [
            '1. गेहूं / धान उपार्जन भंडारण संबंधी बिंदु।',
            '2. धान मिलिंग एवं चावल जमा की समीक्षा (KMS 2025-26 / 2026-27 CMR)।',
            '3. देय लंबित भुगतानों की समीक्षा।',
            '4. बारदाना प्रदाय / बारदानों का मिलान एवं भुगतान की समीक्षा।',
            '5. मार्कफेड के गोदामों में आई कमी / आधिक्य के संबंध में प्रस्तुत दावों के निराकरण की स्थिति।'
        ]
    },
    FCI: {
        title: 'भारतीय खाद्य निगम (FCI) — 5 विचारणीय बिंदु',
        points: [
            '1. केन्द्रीय पूल में शीघ्र परिदान हेतु गेहूँ / चावल विक्रय / प्रदाय के संबंध में चर्चा।',
            '2. प्रदाय मात्रा के विरूद्ध गोदाम रसीद / स्वीकृति पत्रक प्राप्ति की समीक्षा।',
            '3. प्रदाय के विरूद्ध दायर क्लेम एवं लंबित भुगतान की समीक्षा।',
            '4. विवादास्पद बिंदुओं के कटोत्रे संबंध में चर्चा एवं निराकरण।',
            '5. बारदाना क्वालिटी कट (टेक्सचर) आदि की मद में काटी गई राशियों के भुगतान की समीक्षा।'
        ]
    },
    DCCB: {
        title: 'जिला सहकारी केन्द्रीय बैंक (DCCB) — 3 विचारणीय बिंदु',
        points: [
            '1. उपार्जन पश्चात् जमा गेहूं / बारदाना के मिलान एवं अंकेक्षित देयकों के प्रस्तुतीकरण की समीक्षा।',
            '2. भाखानि को केन्द्रीय पूल में परिदान किए जा रहे स्टाक पर विभिन्न विपरीत रिमार्क के कारण कटोत्रा एवं समायोजन।',
            '3. द्वार प्रदाय योजना के प्रस्तुत देयकों के भुगतान एवं वित्तीय समायोजन की समीक्षा।'
        ]
    }
};

function selectCoordAgency(agencyKey, el) {
    if (el) {
        document.querySelectorAll('#coordAgencyPills .day-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
    }

    const ag = AgencyAgendas[agencyKey];
    const container = document.getElementById('coordAgencyContent');
    if (!container || !ag) return;

    container.innerHTML = `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px; margin-bottom:16px;">
            <h4 style="margin:0 0 12px; font-size:15px; color:var(--text-main); font-weight:700;">${ag.title}</h4>
            <ol style="margin:0 0 16px; padding-left:20px; font-size:13px; color:var(--text-muted); line-height:1.6;">
                ${ag.points.map(pt => `<li>${pt}</li>`).join('')}
            </ol>
            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-primary btn-sm" onclick="openAgencyMeetingEditor('${agencyKey}')">📝 इस बैठक का कार्यवृत्त दर्ज करें</button>
            </div>
        </div>
    `;
}

function openAgencyMeetingEditor(agency) {
    document.getElementById('meetingAgency').value = agency;
    document.getElementById('meetingTypeHidden').value = 'coordination';
    document.getElementById('modalMeetingTitle').textContent = `${agency} समन्वय बैठक कार्यवृत्त`;
    openModal('modalMeeting');
}

// ── Internal Review Agendas (परिशिष्ट 05/07) ────────────────
const ReviewAgendas = {
    ic_operators: {
        title: 'केन्द्र प्रभारियों एवं कम्प्यूटर आपरेटर्स की मासिक बैठक का एजेंडा (12 बिंदु)',
        points: [
            '1. गत माह के आवंटन के विरूद्ध प्रदायित मात्रा के समितियों को जारी देयकों हेतु आवश्यक विवरण साफ्टवेयर में फीड करने की स्थिति (CSMS/IRRS)।',
            '2. केन्द्र पर जारी माह में अग्रिम रूप से प्रदाय की जाने वाली आवंटित मात्रा के विरूद्ध वितरण योग्य स्कंध उपलब्धता की स्थिति।',
            '3. केन्द्र पर द्वार प्रदाय योजना अंतर्गत नियुक्त परिवहनकर्त्ता के परिवहन कार्य की स्थिति।',
            '4. स्कंध के वितरण पूर्व स्थानीय चयन समिति द्वारा स्कंध का चयन नियमित रूप से किया जा रहा है अथवा नहीं।',
            '5. गतमाह के अंतिम दिवस के बचत स्कंध को दोनों संस्थाओं (MPWLC एवं MPSCSC) के आंकड़ों से आपसी मिलान संबंधी संयुक्त हस्ताक्षरित प्रमाण पत्र।',
            '6. गतमाह में आवंटित मात्रा के विरूद्ध प्रदाय संबंधी समस्या सुझाव पर बेहतरी हेतु चर्चा।',
            '7. एक माह पूर्व उधार विक्रय पर संस्थाओं को प्रदाय किए गए स्कंध के भुगतान प्राप्ति की स्थिति।',
            '8. भंडारण संस्थाओं द्वारा प्रस्तुत किए जाने वाले देयकों की मात्रा का स्कंध पंजी से प्रमाणीकरण की स्थिति।',
            '9. केन्द्र पर भंडारित स्कंध खाद्यान्न की किस्म तथा कीटग्रस्तता संबंधी स्थिति पर प्रभारी तथा शाखा प्रबंधक की संयुक्त हस्ताक्षरित रिपोर्ट।',
            '10. भंडारण एजेंसी / परिवहनकर्त्ता उचित मूल्य दुकानों से संबंधित कोई समस्या एवं सुझाव।',
            '11. क्षतिग्रस्त, स्वीपेज स्कन्ध के निराकरण की स्थिति।',
            '12. अन्य सामयिक स्थिति अनुसार बिंदु।'
        ]
    },
    finance_admin: {
        title: 'जिला कार्यालय के कक्ष प्रभारियों / कर्मियों की मासिक समीक्षा बैठक का एजेंडा (11 बिंदु)',
        points: [
            '1. मासिक आधार पर एक माह पूर्व तक की अवधि का स्कंध पंजी के आंकड़ों / व्यवहारों का लेखा कक्ष के संधारित रिकार्ड से मिलान।',
            '2. द्वार प्रदाय योजना अंतर्गत गत माह में केन्द्रों से उधार पर प्रदाय स्कंध के देयकों के लेखांकन हेतु जिला कार्यालय को प्राप्ति एवं समायोजन।',
            '3. साविप्र कक्ष प्रभारी स्तर से मुख्यालय / क्षेत्रीय कार्यालय को मासिक आधार पर विभिन्न योजनाओं के अंतर्गत निर्धारित प्रारूप में प्रेषित जानकारी।',
            '4. समितियों द्वारा उपार्जित गेहूं / धान / मोटे अनाज के प्रस्तुत अंतिम देयकों के भुगतान / निराकरण एवं बारदाना मिलान।',
            '5. मुख्यालय निर्देशानुसार प्रदायकर्ताओं द्वारा गतमाह प्रदाय शक्कर / नमक की अंतरिम/अंतिम पावतियां प्रेषण।',
            '6. लेखा / वित्त आयकर / विक्रय कर आदि के मासिक आधार पर मुख्यालय / क्षेत्रीय कार्यालय को पत्रकों के प्रेषण की स्थिति।',
            '7. गेहूं / धान / मोटे अनाज के उपार्जन / भाखानि को किए गए परिदान के विरूद्ध प्रस्तुत देयकों के भुगतान, पारित देयकों एवं लंबित देयकों की समीक्षा।',
            '8. जिला पंचायत / महिला बाल विकास एवं अन्य संस्थाओं को प्रदाय स्कंध के मूल्य एवं परिवहन व्यय के देयकों की प्रस्तुति एवं राशि प्राप्ति।',
            '9. भंडारण संस्थाओं से लॉसगेन पत्रक प्राप्ति तथा भंडारण कमी क्लेम प्रस्तुति, निराकरण की स्थिति।',
            '10. भंडारण संस्थाओं तथा परिवहनकर्ताओं आदि के देयक जिला कार्यालय को प्रस्तुतीकरण एवं पारित / भुगतान की स्थिति।',
            '11. भारत शासन को प्रेषित किये जाने वाले दावों से संबंधित जानकारी साफ्टवेयर के माध्यम से मुख्यालय भेजने की स्थिति।'
        ]
    }
};

function selectReviewCategory(catKey, el) {
    if (el) {
        document.querySelectorAll('#reviewPills .day-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
    }

    const cat = ReviewAgendas[catKey];
    const container = document.getElementById('reviewCategoryContent');
    if (!container || !cat) return;

    container.innerHTML = `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px; margin-bottom:16px;">
            <h4 style="margin:0 0 12px; font-size:15px; color:var(--text-main); font-weight:700;">${cat.title}</h4>
            <ol style="margin:0 0 16px; padding-left:20px; font-size:13px; color:var(--text-muted); line-height:1.6;">
                ${cat.points.map(pt => `<li>${pt}</li>`).join('')}
            </ol>
            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-primary btn-sm" onclick="openReviewMeetingEditor('${catKey}')">📝 समीक्षा बैठक कार्यवृत्त दर्ज करें</button>
            </div>
        </div>
    `;
}

function openReviewMeetingEditor(catKey) {
    document.getElementById('meetingAgency').value = catKey === 'ic_operators' ? 'IC_Incharges' : 'Sectional';
    document.getElementById('meetingTypeHidden').value = 'internal_review';
    document.getElementById('modalMeetingTitle').textContent = `आंतरिक समीक्षा बैठक कार्यवृत्त`;
    openModal('modalMeeting');
}

async function handleSaveMeeting(e) {
    e.preventDefault();
    const type = document.getElementById('meetingTypeHidden').value;
    const agency = document.getElementById('meetingAgency').value;
    const date = document.getElementById('meetingDate').value;
    const chair = document.getElementById('meetingChairperson').value;
    const attendees = document.getElementById('meetingAttendees').value;
    const minutes = document.getElementById('meetingMinutes').value;
    const action = document.getElementById('meetingActionPoints').value;

    const payload = {
        meetingType: type,
        agency,
        meetingDate: date,
        chairperson: chair,
        attendees,
        minutes,
        actionPoints: [action]
    };

    try {
        const res = await fetch('/api/supervision/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('✅ बैठक कार्यवृत्त सफलतापूर्वक सुरक्षित किया गया!');
            closeModal('modalMeeting');
            await fetchSupervisionStats();
            renderDashboard();
        }
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

function openMeetingModal(type) {
    document.getElementById('meetingForm').reset();
    initDefaultDates();
    document.getElementById('meetingTypeHidden').value = type;
    openModal('modalMeeting');
}

// ── Monthly Compliance Letter (परिशिष्ट 04/05) ─────────────
function renderMonthlyComplianceLetter() {
    const container = document.getElementById('complianceLetterPreviewArea');
    if (!container) return;

    const now = new Date();
    const curMonth = now.toLocaleString('hi-IN', { month: 'long' });
    const curYear = now.getFullYear();

    container.innerHTML = `
        <div class="official-print-document" id="complianceOfficialDoc">
            <div class="official-header">
                <h2>मध्य प्रदेश स्टेट सिविल सप्लाईज कार्पोरेशन लिमिटेड</h2>
                <h3>जिला कार्यालय बैतूल (म.प्र.)</h3>
                <p>मुख्यालयीन स्थायी निर्देश क्र. 3/1 (समन्वय/2014-15/684) एवं क्र. 179 दिनांक 05-01-2019 के पालन में</p>
                <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:12px; font-weight:600;">
                    <span>क्रमांक: निग./बैतूल/निगरानी/${curYear}/____</span>
                    <span>बैतूल, दिनांक: ${now.toLocaleDateString('hi-IN')}</span>
                </div>
            </div>

            <div style="margin-bottom:16px; font-size:13px;">
                <strong>प्रति,</strong><br>
                प्रबंध संचालक महोदय,<br>
                म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन लिमिटेड,<br>
                मुख्यालय, भोपाल (ई-मेल: mdmpscsc@gmail.com)
            </div>

            <div style="margin-bottom:16px; font-size:13px; font-weight:700;">
                विषय: मासिक अनुपालन प्रतिवेदन — माह ${curMonth} ${curYear} के दौरे एवं बैठकों का विवरण तथा आगामी माह का प्रस्तावित कार्यक्रम।
            </div>

            <div style="margin-bottom:12px; font-weight:700; font-size:13px;">1. विगत माह के दौरे एवं बैठकों का विवरण:</div>
            <table class="official-table">
                <thead>
                    <tr>
                        <th>विगत माह के प्रस्तावित औचक निरीक्षण दौरे</th>
                        <th>किये गए दौरे की संख्या / स्थान</th>
                        <th>किये गए दौरों की रिपोर्ट प्रेषण की स्थिति</th>
                        <th>रोस्टर निरीक्षण पूर्णता स्थिति</th>
                        <th>भा.खा.नि. (FCI) के साथ सम्पन्न बैठक दिनांक</th>
                        <th>MPWLC के साथ सम्पन्न बैठक दिनांक</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align:center;">05 दौरे</td>
                        <td style="text-align:center;">${SupervState.surpriseVisits.length} दौरे (मुलताई, बैतूल)</td>
                        <td style="text-align:center;">प्रतिवेदन तैयार / नस्तीबद्ध</td>
                        <td style="text-align:center;">${SupervState.stats.rosterCompleted || 12} प्रदाय केंद्र पूर्ण</td>
                        <td style="text-align:center;">18-09-2026</td>
                        <td style="text-align:center;">22-09-2026</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-bottom:12px; margin-top:20px; font-weight:700; font-size:13px;">2. आगामी माह प्रदाय केन्द्रों का प्रस्तावित निरीक्षण कार्यक्रम:</div>
            <table class="official-table">
                <thead>
                    <tr>
                        <th>क्रमांक</th>
                        <th>प्रस्तावित निरीक्षण दिनांक</th>
                        <th>दौरा किए जाने वाले प्रदाय केंद्र एवं संबद्ध गोदामों के नाम</th>
                        <th>निरीक्षणकर्ता अधिकारी का नाम एवं पद</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align:center;">1</td>
                        <td style="text-align:center;">12-10-2026</td>
                        <td>प्रदाय केन्द्र आमला (Amla) — संबद्ध 3 गोदाम (MPWLC आमला)</td>
                        <td>District Manager (MPSCSC Betul)</td>
                    </tr>
                    <tr>
                        <td style="text-align:center;">2</td>
                        <td style="text-align:center;">24-10-2026</td>
                        <td>प्रदाय केन्द्र भैंसदेही (Bhainsdehi) — संबद्ध 2 गोदाम</td>
                        <td>Manager (Finance), MPSCSC Betul</td>
                    </tr>
                </tbody>
            </table>

            <div class="official-sig-block">
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div>प्रबंधक (वित्त / साविप्र)</div>
                    <div>MPSCSC जिला कार्यालय बैतूल</div>
                </div>
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div>जिला प्रबंधक</div>
                    <div>MPSCSC जिला कार्यालय बैतूल</div>
                </div>
            </div>
        </div>
    `;
}

function printMonthlyComplianceLetter() {
    renderMonthlyComplianceLetter();
    const content = document.getElementById('complianceLetterPreviewArea').innerHTML;
    const printArea = document.getElementById('printableReportArea');
    if (printArea) {
        printArea.innerHTML = content;
        openModal('modalInspectionView');
    }
}

// ── Official Print & View Modal Logic ─────────────────────
function viewInspectionReport(id) {
    const insp = SupervState.inspections.find(i => i.id === id);
    if (!insp) return;

    const p = insp.payload || {};
    const res = p.reservation || {};
    const stock = p.stock || [];
    const gb = p.gunnyBags || {};
    const dd = p.doorstepDelivery || {};
    const chk = p.checkpoints || {};
    const issues = p.issuesAndSuggestions || [];

    const printArea = document.getElementById('printableReportArea');
    if (!printArea) return;

    printArea.innerHTML = `
        <div class="official-print-document">
            <div class="official-header">
                <h2>मध्य प्रदेश स्टेट सिविल सप्लाईज कार्पोरेशन लिमिटेड</h2>
                <h3>जिला कार्यालय बैतूल (म.प्र.)</h3>
                <p>प्रदाय केन्द्र / भंडारगृह विस्तृत निरीक्षण प्रतिवेदन (परिशिष्ट — 02 / 03)</p>
            </div>

            <table class="official-table">
                <tr>
                    <td style="width:25%;"><strong>प्रदाय केन्द्र:</strong> ${escapeHtml(insp.issue_center)}</td>
                    <td style="width:25%;"><strong>निरीक्षण माह:</strong> ${escapeHtml(insp.inspection_month || '')}</td>
                    <td style="width:25%;"><strong>निरीक्षण दिनांक:</strong> ${escapeHtml(insp.inspection_date)}</td>
                    <td style="width:25%;"><strong>संबद्ध गोदाम:</strong> ${insp.godowns_count || 1}</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>निरीक्षणकर्ता अधिकारी:</strong> ${escapeHtml(insp.officer_name || '')} (${escapeHtml(insp.officer_designation || '')})</td>
                    <td colspan="2"><strong>प्रदाय केन्द्र प्रभारी:</strong> ${escapeHtml(insp.incharge_name || '')} (मो. ${escapeHtml(insp.incharge_mobile || '-')})</td>
                </tr>
                <tr>
                    <td colspan="4"><strong>WLC / MPWLC शाखा प्रबंधक:</strong> ${escapeHtml(insp.branch_manager || '')}</td>
                </tr>
            </table>

            <h4 style="margin:12px 0 6px; font-size:12px;">1. गोदाम में आरक्षण की स्थिति (MT):</h4>
            <table class="official-table">
                <tr>
                    <th>गेहूं</th><td>${res.wheat || 0} MT</td>
                    <th>चावल</th><td>${res.rice || 0} MT</td>
                    <th>शक्कर</th><td>${res.sugar || 0} MT</td>
                    <th>नमक</th><td>${res.salt || 0} MT</td>
                </tr>
            </table>

            <h4 style="margin:12px 0 6px; font-size:12px;">2. निरीक्षण दिनांक को गोदाम पर शेष अंतिम स्कंध की भौतिक स्थिति:</h4>
            <table class="official-table">
                <thead>
                    <tr>
                        <th rowspan="2">कमोडिटी</th>
                        <th colspan="2">प्रदाय योग्य</th>
                        <th colspan="2">क्षतिग्रस्त</th>
                        <th colspan="2">स्वीपेज</th>
                        <th colspan="2">कुल योग</th>
                    </tr>
                    <tr>
                        <th>बोरे</th><th>मात्रा (Qtl)</th>
                        <th>बोरे</th><th>मात्रा (Qtl)</th>
                        <th>बोरे</th><th>मात्रा (Qtl)</th>
                        <th>बोरे</th><th>मात्रा (Qtl)</th>
                    </tr>
                </thead>
                <tbody>
                    ${stock.map(s => {
                        const totB = (s.soundBags||0) + (s.damagedBags||0) + (s.sweepageBags||0);
                        const totQ = ((s.soundQty||0) + (s.damagedQty||0) + (s.sweepageQty||0)).toFixed(2);
                        return `
                            <tr>
                                <td><strong>${s.commodity}</strong></td>
                                <td style="text-align:right;">${s.soundBags||0}</td><td style="text-align:right;">${(s.soundQty||0).toFixed(2)}</td>
                                <td style="text-align:right;">${s.damagedBags||0}</td><td style="text-align:right;">${(s.damagedQty||0).toFixed(2)}</td>
                                <td style="text-align:right;">${s.sweepageBags||0}</td><td style="text-align:right;">${(s.sweepageQty||0).toFixed(2)}</td>
                                <td style="text-align:right; font-weight:700;">${totB}</td><td style="text-align:right; font-weight:700;">${totQ}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <h4 style="margin:12px 0 6px; font-size:12px;">3. द्वार प्रदाय योजना उठाव एवं पावती संकलन स्थिति:</h4>
            <table class="official-table">
                <tr>
                    <td><strong>गेहूं उठाव:</strong> ${dd.wheatLifted||0} Qtl</td>
                    <td><strong>चावल उठाव:</strong> ${dd.riceLifted||0} Qtl</td>
                    <td><strong>शक्कर उठाव:</strong> ${dd.sugarLifted||0} Qtl</td>
                    <td><strong>नमक उठाव:</strong> ${dd.saltLifted||0} Qtl</td>
                </tr>
                <tr>
                    <td><strong>प्रदाय उ०मू०दु० संख्या:</strong> ${dd.fpsDeliveredCount||0}</td>
                    <td><strong>परिवहनकर्ता पावती दिनांक:</strong> ${dd.transporterReceiptDate||'-'}</td>
                    <td><strong>जि०का० प्रेषण दिनांक:</strong> ${dd.receiptSentToDO||'-'}</td>
                    <td><strong>सॉफ्टवेयर प्रविष्टि दिनांक:</strong> ${dd.enteredInSoftwareDate||'-'}</td>
                </tr>
            </table>

            <h4 style="margin:12px 0 6px; font-size:12px;">4. 16-17 बिंदु निरीक्षण चैकलिस्ट अनुपालन स्तर: ${insp.compliance_score}%</h4>
            <table class="official-table">
                <thead>
                    <tr><th>क्र.</th><th>निरीक्षण बिंदु विवरण</th><th>स्थिति</th></tr>
                </thead>
                <tbody>
                    ${SupervState.checkpoints.map(c => `
                        <tr>
                            <td style="text-align:center; width:30px;">${c.num}</td>
                            <td>${c.text}</td>
                            <td style="text-align:center; font-weight:700; color:${chk[c.id] ? '#059669' : '#dc2626'};">
                                ${chk[c.id] ? 'हाँ (Pass)' : 'नहीं (Defect)'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h4 style="margin:12px 0 6px; font-size:12px;">5. पाई गई कमियां एवं सुधारात्मक निर्देश:</h4>
            <table class="official-table">
                <thead>
                    <tr><th style="width:50%;">निरीक्षण में पाई गई समस्या / कमी</th><th style="width:50%;">सुझाव / निराकरण हेतु निर्देश</th></tr>
                </thead>
                <tbody>
                    ${issues.length > 0 ? issues.map(it => `
                        <tr>
                            <td>${escapeHtml(it.issue || '-')}</td>
                            <td>${escapeHtml(it.suggestion || '-')}</td>
                        </tr>
                    `).join('') : `<tr><td colspan="2" style="text-align:center; color:#666;">कोई विशेष कमी नहीं पाई गई। व्यवस्था संतोषप्रद है।</td></tr>`}
                </tbody>
            </table>

            ${p.remarks ? `<div style="margin:10px 0; font-size:12px;"><strong>समग्र टीप:</strong> ${escapeHtml(p.remarks)}</div>` : ''}

            <div class="official-sig-block">
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div>हस्ताक्षर केन्द्र प्रभारी</div>
                    <div>म०प्र० स्टेट सिविल सप्लाईज कार्पो.</div>
                </div>
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div>हस्ताक्षर शाखा प्रबंधक</div>
                    <div>म०प्र० वेयरहाउसिंग कार्पोरेशन</div>
                </div>
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <div>हस्ताक्षर निरीक्षणकर्ता अधिकारी</div>
                    <div>${escapeHtml(insp.officer_name || 'District Manager')}</div>
                </div>
            </div>
        </div>
    `;

    openModal('modalInspectionView');
}

function previewCurrentFormPrint() {
    alert('कृपया पहले फॉर्म सुरक्षित करें, जिसके बाद तत्काल पूर्ण अधिकृत A4 प्रिंट पूर्वावलोकन उपलब्ध हो जाएगा।');
}

function printOfficialReport() {
    printElementDirectly('printableReportArea', 'Supervision Inspection Report - MPSCSC Betul', 'landscape');
}

// ── Archives View & Table ─────────────────────────────────
function renderArchivesTable() {
    const tbody = document.getElementById('archivesTableBody');
    if (!tbody) return;

    const search = (document.getElementById('archiveSearchInput')?.value || '').toLowerCase();
    let list = SupervState.inspections;
    if (search) {
        list = list.filter(i => (i.issue_center||'').toLowerCase().includes(search) || (i.officer_name||'').toLowerCase().includes(search));
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">कोई निरीक्षण अभिलेख प्राप्त नहीं हुआ।</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(insp => `
        <tr>
            <td style="font-family:monospace; font-size:12px;">${escapeHtml(insp.id)}</td>
            <td><span style="font-size:11px; padding:2px 6px; border-radius:4px; background:rgba(14,165,233,0.15); color:var(--superv-accent); font-weight:700;">${(insp.mode || 'DM').toUpperCase()}</span></td>
            <td><strong>${escapeHtml(insp.issue_center)}</strong></td>
            <td>${escapeHtml(insp.inspection_date)}</td>
            <td>${escapeHtml(insp.officer_name || '-')}</td>
            <td style="text-align:center;">${insp.godowns_count || 1}</td>
            <td><span style="font-weight:700; color:${insp.compliance_score >= 80 ? 'var(--superv-success)' : 'var(--superv-warning)'};">${insp.compliance_score}%</span></td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="viewInspectionReport('${insp.id}')">🖨️ देखें / प्रिंट</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteInspection('${insp.id}')">🗑️ हटाएं</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterArchivesTable() {
    renderArchivesTable();
}

async function deleteInspection(id) {
    if (confirm('क्या आप इस निरीक्षण प्रतिवेदन को हमेशा के लिए हटाना चाहते हैं?')) {
        await fetch('/api/supervision/inspections/' + id, { method: 'DELETE' });
        await fetchInspections();
        await fetchSupervisionStats();
        renderDashboard();
        renderArchivesTable();
    }
}

/* ═════════════════════════════════════════════════════════
 * RICE QUALITY INSPECTION (KMS 2025-26) MODULE LOGIC
 * ═════════════════════════════════════════════════════════ */

function initDefaultRiceSheet() {
    const tbody = document.getElementById('riceLotsTableBody');
    if (!tbody) return;

    // Default template data matching the 6 rows of the Betul official sheet
    const defaultLots = [
        {
            sno: 1,
            millerName: 'M/s Betul Modern Rice Mill',
            stackNo: 'S-04',
            lotNo: 'LOT-25/101',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: new Date().toISOString().split('T')[0],
            brokenSmall: 0.80,
            brokenBig: 18.20,
            brokenTotal: 19.00,
            fmInorg: 0.10,
            fmOrg: 0.20,
            fmTotal: 0.30,
            damaged: 2.10,
            admixture: 'NA',
            redKernels: 1.20,
            chalky: 3.00,
            discoloured: 2.00,
            dehusked: 8.50,
            frk: 1.02,
            testResult: 'Positive (1.02% FRK)',
            result: 'Within Specification'
        },
        {
            sno: 2,
            millerName: 'M/s Satpura Agro Mills, Shahpur',
            stackNo: 'S-05',
            lotNo: 'LOT-25/102',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: new Date().toISOString().split('T')[0],
            brokenSmall: 0.90,
            brokenBig: 19.10,
            brokenTotal: 20.00,
            fmInorg: 0.15,
            fmOrg: 0.25,
            fmTotal: 0.40,
            damaged: 2.50,
            admixture: 'NA',
            redKernels: 1.50,
            chalky: 3.80,
            discoloured: 2.20,
            dehusked: 9.20,
            frk: 0.98,
            testResult: 'Positive (0.98% FRK)',
            result: 'Within Specification'
        },
        {
            sno: 3,
            millerName: 'M/s Narmada Grain Processing, Multai',
            stackNo: 'S-06',
            lotNo: 'LOT-25/103',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: new Date().toISOString().split('T')[0],
            brokenSmall: 0.65,
            brokenBig: 17.80,
            brokenTotal: 18.45,
            fmInorg: 0.08,
            fmOrg: 0.18,
            fmTotal: 0.26,
            damaged: 1.90,
            admixture: 'NA',
            redKernels: 1.10,
            chalky: 2.90,
            discoloured: 1.70,
            dehusked: 8.00,
            frk: 1.05,
            testResult: 'Positive (1.05% FRK)',
            result: 'Within Specification'
        },
        {
            sno: 4,
            millerName: 'M/s Betul Modern Rice Mill',
            stackNo: 'S-07',
            lotNo: 'LOT-25/104',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: new Date().toISOString().split('T')[0],
            brokenSmall: 0.70,
            brokenBig: 17.50,
            brokenTotal: 18.20,
            fmInorg: 0.08,
            fmOrg: 0.15,
            fmTotal: 0.23,
            damaged: 1.80,
            admixture: 'NA',
            redKernels: 1.00,
            chalky: 2.50,
            discoloured: 1.50,
            dehusked: 7.80,
            frk: 1.00,
            testResult: 'Positive (1.0% FRK)',
            result: 'Within Specification'
        },
        {
            sno: 5,
            millerName: 'M/s Satpura Agro Mills, Shahpur',
            stackNo: 'S-08',
            lotNo: 'LOT-25/105',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: new Date().toISOString().split('T')[0],
            brokenSmall: 0.85,
            brokenBig: 19.00,
            brokenTotal: 19.85,
            fmInorg: 0.12,
            fmOrg: 0.22,
            fmTotal: 0.34,
            damaged: 2.40,
            admixture: 'NA',
            redKernels: 1.40,
            chalky: 3.20,
            discoloured: 2.10,
            dehusked: 8.90,
            frk: 1.05,
            testResult: 'Positive (1.05% FRK)',
            result: 'Within Specification'
        },
        {
            sno: 6,
            millerName: 'M/s Narmada Grain Processing, Multai',
            stackNo: 'S-09',
            lotNo: 'LOT-25/106',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: new Date().toISOString().split('T')[0],
            brokenSmall: 0.75,
            brokenBig: 18.00,
            brokenTotal: 18.75,
            fmInorg: 0.10,
            fmOrg: 0.18,
            fmTotal: 0.28,
            damaged: 2.00,
            admixture: 'NA',
            redKernels: 1.10,
            chalky: 2.80,
            discoloured: 1.80,
            dehusked: 8.10,
            frk: 1.00,
            testResult: 'Positive (1.0% FRK)',
            result: 'Within Specification'
        }
    ];

    renderRiceLotsTable(defaultLots);
}

function renderRiceLotsTable(lots) {
    const tbody = document.getElementById('riceLotsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (lots || []).forEach((lot, idx) => {
        addRiceLotRow(lot, idx + 1);
    });
    recalculateRiceTotals();
}

function addRiceLotRow(lot = null, snoOverride = null) {
    const tbody = document.getElementById('riceLotsTableBody');
    if (!tbody) return;

    const rowCount = tbody.querySelectorAll('tr').length;
    const sno = snoOverride || (rowCount + 1);
    const today = new Date().toISOString().split('T')[0];

    const d = lot || {
        sno: sno,
        millerName: '',
        stackNo: '',
        lotNo: '',
        quantityMt: '',
        noOfBags: '',
        receiptDate: today,
        brokenSmall: '',
        brokenBig: '',
        brokenTotal: '',
        fmInorg: '',
        fmOrg: '',
        fmTotal: '',
        damaged: '',
        admixture: '',
        redKernels: '',
        chalky: '',
        discoloured: '',
        dehusked: '',
        frk: '',
        testResult: 'Positive',
        result: 'Within Specification'
    };

    const tr = document.createElement('tr');
    tr.className = 'rice-lot-row';
    tr.innerHTML = `
        <td class="rice-sno" style="font-weight:700; text-align:center;">${sno}</td>
        <td><input type="text" class="superv-input miller-name-input rice-miller" value="${escapeHtml(d.millerName)}" placeholder="Miller Name" style="width:100%; min-width:160px; text-align:left;"></td>
        <td><input type="text" class="superv-input rice-stack" value="${escapeHtml(d.stackNo)}" placeholder="S-01" style="width:100%; min-width:60px;"></td>
        <td><input type="text" class="superv-input rice-lot" value="${escapeHtml(d.lotNo)}" placeholder="LOT-01" style="width:100%; min-width:80px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-qty" value="${d.quantityMt !== '' ? d.quantityMt : ''}" placeholder="29.00" oninput="recalculateRiceTotals()" style="width:100%; min-width:75px;"></td>
        <td><input type="number" step="1" class="superv-input rice-bags" value="${d.noOfBags !== '' ? d.noOfBags : ''}" placeholder="580" oninput="recalculateRiceTotals()" style="width:100%; min-width:65px;"></td>
        <td><input type="date" class="superv-input rice-receipt-date" value="${d.receiptDate || today}" style="width:100%; min-width:100px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-broken-small" value="${d.brokenSmall !== '' ? d.brokenSmall : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:60px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-broken-big" value="${d.brokenBig !== '' ? d.brokenBig : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:60px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-broken-total" value="${d.brokenTotal !== '' ? d.brokenTotal : ''}" placeholder="0.00" readonly style="width:100%; min-width:65px; background:rgba(15,46,90,0.08); font-weight:700;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-fm-inorg" value="${d.fmInorg !== '' ? d.fmInorg : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:60px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-fm-org" value="${d.fmOrg !== '' ? d.fmOrg : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:60px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-fm-total" value="${d.fmTotal !== '' ? d.fmTotal : ''}" placeholder="0.00" readonly style="width:100%; min-width:65px; background:rgba(15,46,90,0.08); font-weight:700;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-damaged" value="${d.damaged !== '' ? d.damaged : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:65px;"></td>
        <td><input type="text" class="superv-input rice-admixture" value="${d.admixture !== '' ? d.admixture : ''}" placeholder="NA" title="Common चावल हेतु अधोवर्ग अपमिश्रण लागू नहीं (NA)" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:65px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-red" value="${d.redKernels !== '' ? d.redKernels : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:65px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-chalky" value="${d.chalky !== '' ? d.chalky : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:65px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-discoloured" value="${d.discoloured !== '' ? d.discoloured : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:65px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-dehusked" value="${d.dehusked !== '' ? d.dehusked : ''}" placeholder="0.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:65px;"></td>
        <td><input type="number" step="0.01" class="superv-input rice-frk" value="${d.frk !== '' ? d.frk : ''}" placeholder="1.00" oninput="recalculateRiceRow(this.closest('tr'))" style="width:100%; min-width:60px;"></td>
        <td><input type="text" class="superv-input rice-test-result" value="${escapeHtml(d.testResult || 'Positive')}" placeholder="Positive" style="width:100%; min-width:85px;"></td>
        <td>
            <select class="superv-select rice-result" style="width:100%; min-width:130px; font-size:11px; padding:4px;">
                <option value="Within Specification" ${d.result === 'Within Specification' ? 'selected' : ''}>Within Specification</option>
                <option value="BRL" ${d.result === 'BRL' ? 'selected' : ''}>BRL (Beyond Rejection Limit)</option>
                <option value="Beyond FSSAI" ${d.result === 'Beyond FSSAI' ? 'selected' : ''}>Beyond FSSAI (Rejected)</option>
            </select>
        </td>
        <td style="text-align:center;">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeRiceLotRow(this)" title="Delete Row" style="padding:2px 6px; font-size:11px;">✕</button>
        </td>
    `;

    tbody.appendChild(tr);
    recalculateRiceRow(tr);
    recalculateRiceTotals();
}

function removeRiceLotRow(btn) {
    const tr = btn.closest('tr');
    if (tr) {
        tr.remove();
        // Renumber remaining rows
        const rows = document.querySelectorAll('#riceLotsTableBody tr');
        rows.forEach((r, idx) => {
            const snoTd = r.querySelector('.rice-sno');
            if (snoTd) snoTd.textContent = idx + 1;
        });
        recalculateRiceTotals();
    }
}

// ─────────────────────────────────────────────────────────────
// UNIFORM SPECIFICATION SCHEDULE FOR COMMON RICE (KMS 2025-26)
// Official Government Prescribed Maximum Limits
// ─────────────────────────────────────────────────────────────
const COMMON_RICE_SPEC_2025_26 = {
    brokenTotalMax: 25.0,    // Item 1: Broken Total Max 25.0% (Raw Common Rice)
    brokenSmallMax: 1.0,     // Footnote (*): Small broken shall not exceed 1% by weight
    fmTotalMax: 0.50,        // Item 2: Foreign Matter Total Max 0.5%
    fmInorgMax: 0.20,        // Footnote (**): Mineral/inorganic matter max 0.20% by weight
    damagedMax: 3.0,         // Item 3: Damaged/Slightly Damaged Max 3.0% (Raw Common, incl. pinpoint)
    discolouredMax: 3.0,     // Item 4: Discolored Grains Max 3.0% (Raw Common Rice)
    chalkyMax: 5.0,          // Item 5: Chalky Grains Max 5.0% (Raw Common Rice)
    redKernelsMax: 3.0,      // Item 6: Red Grains Max 3.0%
    admixtureLowerClass: 'NA', // Item 7: Admixture of lower class is NA for Common Rice
    dehuskedMax: 13.0,       // Item 8: Dehusked Grains Max 13.0%
    moistureStandardMax: 14.0, // Item 9: Moisture Max 14.0% without cut (up to 15.0% with full value cut)
    frkBlendingTarget: 1.0,  // Item 10: 1% FRK (w/w)
    frkMin: 0.90,            // Footnote (@@): Permissible blending range 0.90% to 1.20%
    frkMax: 1.20
};

function markSpecCellStatus(inputEl, isViolation, limitNote) {
    if (!inputEl) return;
    if (isViolation) {
        inputEl.classList.add('spec-violation');
        inputEl.title = `⚠️ सीमा उल्लंघन: विनिर्देश अनुसार अधिकतम सीमा ${limitNote} (Uniform Spec KMS 2025-26 Common Rice)`;
    } else {
        inputEl.classList.remove('spec-violation');
        inputEl.title = '';
    }
}

function recalculateRiceRow(tr) {
    if (!tr) return;

    // 1. Broken Calculations
    const smallInput = tr.querySelector('.rice-broken-small');
    const bigInput = tr.querySelector('.rice-broken-big');
    const totBrokenInput = tr.querySelector('.rice-broken-total');
    const small = parseFloat(smallInput?.value) || 0;
    const big = parseFloat(bigInput?.value) || 0;
    const totalBroken = small + big;
    if (totBrokenInput) {
        totBrokenInput.value = (smallInput?.value !== '' || bigInput?.value !== '') && totalBroken > 0 ? totalBroken.toFixed(2) : (totalBroken > 0 ? totalBroken.toFixed(2) : '');
    }

    // 2. Foreign Matter Calculations
    const inorgInput = tr.querySelector('.rice-fm-inorg');
    const orgInput = tr.querySelector('.rice-fm-org');
    const totFmInput = tr.querySelector('.rice-fm-total');
    const inorg = parseFloat(inorgInput?.value) || 0;
    const org = parseFloat(orgInput?.value) || 0;
    const totalFm = inorg + org;
    if (totFmInput) {
        totFmInput.value = (inorgInput?.value !== '' || orgInput?.value !== '') && totalFm > 0 ? totalFm.toFixed(2) : (totalFm > 0 ? totalFm.toFixed(2) : '');
    }

    // 3. Additional Refractions
    const damagedInput = tr.querySelector('.rice-damaged');
    const damaged = parseFloat(damagedInput?.value) || 0;

    const discolouredInput = tr.querySelector('.rice-discoloured');
    const discoloured = parseFloat(discolouredInput?.value) || 0;

    const chalkyInput = tr.querySelector('.rice-chalky');
    const chalky = parseFloat(chalkyInput?.value) || 0;

    const redInput = tr.querySelector('.rice-red');
    const redKernels = parseFloat(redInput?.value) || 0;

    const dehuskedInput = tr.querySelector('.rice-dehusked');
    const dehusked = parseFloat(dehuskedInput?.value) || 0;

    const frkInput = tr.querySelector('.rice-frk');
    const frkVal = frkInput?.value !== '' ? parseFloat(frkInput?.value) : null;

    // 4. Strict Validation against Official KMS 2025-26 Common Rice Limits
    const smallBrokenViolated = small > COMMON_RICE_SPEC_2025_26.brokenSmallMax;
    const totalBrokenViolated = totalBroken > COMMON_RICE_SPEC_2025_26.brokenTotalMax;
    const inorgFmViolated = inorg > COMMON_RICE_SPEC_2025_26.fmInorgMax;
    const totalFmViolated = totalFm > COMMON_RICE_SPEC_2025_26.fmTotalMax;
    const damagedViolated = damaged > COMMON_RICE_SPEC_2025_26.damagedMax;
    const discolouredViolated = discoloured > COMMON_RICE_SPEC_2025_26.discolouredMax;
    const chalkyViolated = chalky > COMMON_RICE_SPEC_2025_26.chalkyMax;
    const redKernelsViolated = redKernels > COMMON_RICE_SPEC_2025_26.redKernelsMax;
    const dehuskedViolated = dehusked > COMMON_RICE_SPEC_2025_26.dehuskedMax;
    const frkViolated = frkVal !== null && !isNaN(frkVal) && (frkVal < COMMON_RICE_SPEC_2025_26.frkMin || frkVal > COMMON_RICE_SPEC_2025_26.frkMax);

    // Apply visual violation highlights to specific input elements
    markSpecCellStatus(smallInput, smallBrokenViolated, '1.0% (Small Broken)');
    markSpecCellStatus(totBrokenInput, totalBrokenViolated, '25.0% (Total Broken)');
    markSpecCellStatus(inorgInput, inorgFmViolated, '0.20% (Inorganic FM)');
    markSpecCellStatus(totFmInput, totalFmViolated, '0.50% (Total FM)');
    markSpecCellStatus(damagedInput, damagedViolated, '3.0% (Damaged)');
    markSpecCellStatus(discolouredInput, discolouredViolated, '3.0% (Discoloured)');
    markSpecCellStatus(chalkyInput, chalkyViolated, '5.0% (Chalky)');
    markSpecCellStatus(redInput, redKernelsViolated, '3.0% (Red Kernels)');
    markSpecCellStatus(dehuskedInput, dehuskedViolated, '13.0% (Dehusked)');
    markSpecCellStatus(frkInput, frkViolated, '0.90% - 1.20% (FRK Blending)');

    // 5. Automatic Quality Status Determination (BRL vs Within Specification)
    const resultSelect = tr.querySelector('.rice-result');
    if (resultSelect && !resultSelect.dataset.userOverridden) {
        const hasViolations = smallBrokenViolated || totalBrokenViolated || inorgFmViolated || totalFmViolated ||
                              damagedViolated || discolouredViolated || chalkyViolated || redKernelsViolated ||
                              dehuskedViolated || frkViolated;

        const hasAnyData = totalBroken > 0 || totalFm > 0 || damaged > 0 || discoloured > 0 ||
                           chalky > 0 || redKernels > 0 || dehusked > 0 || (frkVal !== null && !isNaN(frkVal));

        if (hasViolations) {
            resultSelect.value = 'BRL';
            resultSelect.style.color = '#ef4444';
            resultSelect.style.fontWeight = '700';
        } else if (hasAnyData) {
            resultSelect.value = 'Within Specification';
            resultSelect.style.color = '#10b981';
            resultSelect.style.fontWeight = '600';
        }
    }
}

function recalculateRiceTotals() {
    let totQty = 0;
    let totBags = 0;

    document.querySelectorAll('#riceLotsTableBody tr').forEach(tr => {
        const qty = parseFloat(tr.querySelector('.rice-qty')?.value) || 0;
        const bags = parseInt(tr.querySelector('.rice-bags')?.value, 10) || 0;
        totQty += qty;
        totBags += bags;
    });

    const qtyEl = document.getElementById('riceTotQuantity');
    const bagsEl = document.getElementById('riceTotBags');
    if (qtyEl) qtyEl.textContent = totQty.toFixed(2) + ' MT';
    if (bagsEl) bagsEl.textContent = totBags.toLocaleString('en-IN');
}

function collectRiceSheetData() {
    const warehouseName = document.getElementById('riceWarehouseName')?.value.trim() || 'MPWLC Warehouse Betul';
    const analysisDate = document.getElementById('riceAnalysisDate')?.value || new Date().toISOString().split('T')[0];
    const branchManager = document.getElementById('riceBranchManager')?.value.trim() || 'MPWLC Betul';
    const centreIncharge = document.getElementById('riceCentreIncharge')?.value.trim() || 'MPSCSC Betul';
    const districtManager = document.getElementById('riceDistrictManager')?.value.trim() || 'MPSCSC बैतूल';

    const lots = [];
    document.querySelectorAll('#riceLotsTableBody tr').forEach((tr, idx) => {
        lots.push({
            sno: idx + 1,
            millerName: tr.querySelector('.rice-miller')?.value.trim() || '',
            stackNo: tr.querySelector('.rice-stack')?.value.trim() || '',
            lotNo: tr.querySelector('.rice-lot')?.value.trim() || '',
            quantityMt: parseFloat(tr.querySelector('.rice-qty')?.value) || 0,
            noOfBags: parseInt(tr.querySelector('.rice-bags')?.value, 10) || 0,
            receiptDate: tr.querySelector('.rice-receipt-date')?.value || analysisDate,
            brokenSmall: parseFloat(tr.querySelector('.rice-broken-small')?.value) || 0,
            brokenBig: parseFloat(tr.querySelector('.rice-broken-big')?.value) || 0,
            brokenTotal: parseFloat(tr.querySelector('.rice-broken-total')?.value) || 0,
            fmInorg: parseFloat(tr.querySelector('.rice-fm-inorg')?.value) || 0,
            fmOrg: parseFloat(tr.querySelector('.rice-fm-org')?.value) || 0,
            fmTotal: parseFloat(tr.querySelector('.rice-fm-total')?.value) || 0,
            damaged: parseFloat(tr.querySelector('.rice-damaged')?.value) || 0,
            admixture: parseFloat(tr.querySelector('.rice-admixture')?.value) || 0,
            redKernels: parseFloat(tr.querySelector('.rice-red')?.value) || 0,
            chalky: parseFloat(tr.querySelector('.rice-chalky')?.value) || 0,
            discoloured: parseFloat(tr.querySelector('.rice-discoloured')?.value) || 0,
            dehusked: parseFloat(tr.querySelector('.rice-dehusked')?.value) || 0,
            frk: parseFloat(tr.querySelector('.rice-frk')?.value) || 1.0,
            testResult: tr.querySelector('.rice-test-result')?.value.trim() || 'Positive (1.0% FRK)',
            result: tr.querySelector('.rice-result')?.value || 'Within Specification'
        });
    });

    return {
        id: SupervState.currentRiceSheetId,
        warehouseName,
        analysisDate,
        branchManager,
        centreIncharge,
        districtManager,
        lots
    };
}

async function saveCurrentRiceSheet() {
    const sheetData = collectRiceSheetData();
    if (!sheetData.warehouseName) {
        alert('कृपया भंडारगृह का नाम (Warehouse Name) दर्ज करें।');
        return;
    }
    if (sheetData.lots.length === 0) {
        alert('कम से कम एक लॉट विवरण दर्ज करें।');
        return;
    }

    try {
        const res = await fetch('/api/supervision/rice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sheetData)
        });

        if (res.ok) {
            const saved = await res.json();
            SupervState.currentRiceSheetId = saved.id;
            alert('✅ चावल गुणवत्ता विश्लेषण पत्रक (KMS 2025-26) सफलतापूर्वक सुरक्षित कर लिया गया है!');
            await fetchRiceInspections();
            renderRiceSavedSheetsTable();
        } else {
            alert('❌ पत्रक सुरक्षित करने में त्रुटि आई। कृपया पुनः प्रयास करें।');
        }
    } catch (err) {
        console.error('Error saving rice inspection sheet:', err);
        alert('नेटवर्क अथवा सर्वर त्रुटि: ' + err.message);
    }
}

async function fetchRiceInspections() {
    try {
        const res = await fetch('/api/supervision/rice');
        if (res.ok) {
            SupervState.riceInspections = await res.json();
        }
    } catch (err) {
        console.warn('Failed to load rice inspections:', err);
    }
}

function renderRiceSavedSheetsTable() {
    const tbody = document.getElementById('riceSavedSheetsTableBody');
    if (!tbody) return;

    const list = SupervState.riceInspections || [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">कोई सहेजा गया पत्रक उपलब्ध नहीं है।</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => `
        <tr>
            <td style="font-family:monospace; font-size:12px;">${escapeHtml(item.id)}</td>
            <td><strong>${escapeHtml(item.warehouse_name)}</strong></td>
            <td>${escapeHtml(item.analysis_date)}</td>
            <td style="text-align:center;">${item.total_lots} लॉट</td>
            <td style="text-align:center; font-weight:700; color:var(--superv-accent);">${Number(item.total_quantity_mt || 0).toFixed(2)} MT</td>
            <td style="text-align:center;">${Number(item.total_bags || 0).toLocaleString('en-IN')}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="viewRiceInspectionPrint('${item.id}')">🖨️ देखें / प्रिंट</button>
                    <button class="btn btn-secondary btn-sm" onclick="loadRiceInspectionToEditor('${item.id}')">✏️ लोड करें</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRiceInspectionSheet('${item.id}')">🗑️ हटाएं</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function loadRiceInspectionToEditor(id) {
    const sheet = (SupervState.riceInspections || []).find(s => s.id === id);
    if (!sheet) return;

    SupervState.currentRiceSheetId = sheet.id;
    const p = sheet.payload || {};

    const whEl = document.getElementById('riceWarehouseName');
    const dtEl = document.getElementById('riceAnalysisDate');
    const bmEl = document.getElementById('riceBranchManager');
    const ciEl = document.getElementById('riceCentreIncharge');
    const dmEl = document.getElementById('riceDistrictManager');

    if (whEl) whEl.value = sheet.warehouse_name || p.warehouseName || '';
    if (dtEl) dtEl.value = sheet.analysis_date || p.analysisDate || '';
    if (bmEl) bmEl.value = sheet.branch_manager || p.branchManager || '';
    if (ciEl) ciEl.value = sheet.centre_incharge || p.centreIncharge || '';
    if (dmEl) dmEl.value = sheet.district_manager || p.districtManager || '';

    const lots = p.lots || [];
    renderRiceLotsTable(lots);

    // Switch view to rice if not active
    showSupervView('rice', document.getElementById('superv-nav-rice'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteRiceInspectionSheet(id) {
    if (confirm('क्या आप इस चावल गुणवत्ता पत्रक को हटाना चाहते हैं?')) {
        await fetch('/api/supervision/rice/' + id, { method: 'DELETE' });
        if (SupervState.currentRiceSheetId === id) {
            SupervState.currentRiceSheetId = null;
        }
        await fetchRiceInspections();
        renderRiceSavedSheetsTable();
    }
}

function generateRiceOfficialPrintHtml(data) {
    const wh = escapeHtml(data.warehouseName || '_______________________________________________');
    const dt = escapeHtml(data.analysisDate || '_______________________');
    const bm = escapeHtml(data.branchManager || '...........................');
    const ci = escapeHtml(data.centreIncharge || '...........................');
    const dm = escapeHtml(data.districtManager || 'MPSCSC बैतूल');

    const lots = data.lots || [];
    let totQty = 0;
    let totBags = 0;

    const rowsHtml = lots.map((l, i) => {
        totQty += parseFloat(l.quantityMt || 0);
        totBags += parseInt(l.noOfBags || 0, 10);

        return `
            <tr>
                <td style="text-align:center; padding:5px 2px; font-weight:600;">${i + 1}</td>
                <td style="text-align:left; padding:5px 4px; font-size:10px;">${escapeHtml(l.millerName || '-')}</td>
                <td style="text-align:center; padding:5px 2px;">${escapeHtml(l.stackNo || '-')}</td>
                <td style="text-align:center; padding:5px 2px; font-size:10px;">${escapeHtml(l.lotNo || '-')}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.quantityMt || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.noOfBags || 0)}</td>
                <td style="text-align:center; padding:5px 2px; font-size:10px;">${escapeHtml(l.receiptDate || '-')}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.brokenSmall || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.brokenBig || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px; font-weight:700; background:#f0f4f8;">${Number(l.brokenTotal || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.fmInorg || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.fmOrg || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px; font-weight:700; background:#f0f4f8;">${Number(l.fmTotal || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.damaged || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.admixture || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.redKernels || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.chalky || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.discoloured || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.dehusked || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px;">${Number(l.frk || 0).toFixed(2)}</td>
                <td style="text-align:center; padding:5px 2px; font-size:9.5px;">${escapeHtml(l.testResult || 'Positive')}</td>
                <td style="text-align:center; padding:5px 2px; font-size:9.5px; font-weight:600;">${escapeHtml(l.result || 'Within Specification')}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="official-print-document" style="padding:10px 15px; font-family:'Inter', 'Noto Sans Devanagari', sans-serif; background:#fff; color:#000;">
            <!-- Top Subtitle -->
            <div style="font-size:10px; color:#444; margin-bottom:3px;">
                MPSCSC District Office Betul | Inspection of Rice (KMS 2025-26)
            </div>

            <!-- Main Heading Banner -->
            <div style="text-align:center; border-bottom:2px solid #0f2e5a; padding-bottom:5px; margin-bottom:10px;">
                <h2 style="font-size:16px; font-weight:800; color:#0f2e5a; margin:0 0 2px; letter-spacing:0.5px;">
                    MADHYA PRADESH STATE CIVIL SUPPLIES CORPORATION
                </h2>
                <div style="font-size:12px; font-weight:600; color:#333; margin-bottom:3px;">
                    District Office Betul
                </div>
                <div style="display:inline-block; font-size:13px; font-weight:800; color:#0f2e5a; border-top:1.5px solid #0f2e5a; border-bottom:1.5px solid #0f2e5a; padding:2px 20px; letter-spacing:0.8px; text-transform:uppercase;">
                    INSPECTION OF RICE (KMS 2025-26)
                </div>
            </div>

            <!-- Metadata Row -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:12px;">
                <div>
                    <strong>Name of the Warehouse:</strong> <u>&nbsp;${wh}&nbsp;</u>
                </div>
                <div>
                    <strong>Date of Analysis:</strong> <u>&nbsp;${dt}&nbsp;</u>
                </div>
            </div>

            <!-- Table Layout matching PDF -->
            <table class="official-table" style="font-size:9.5px; width:100%; border-collapse:collapse; margin-bottom:24px; border:1px solid #0f2e5a;">
                <thead>
                    <tr style="background:#0f2e5a; color:#fff;">
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px; width:25px;">Sl.<br>No.</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 4px; min-width:140px;">Name of Miller</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Stack<br>No.</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Lot No.</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Quantity<br>(MT)</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">No. of<br>Bags</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Date of<br>Receipt</th>
                        <th colspan="3" style="background:#133c70; color:#fff; text-align:center; padding:3px 2px;">Broken (%)</th>
                        <th colspan="3" style="background:#133c70; color:#fff; text-align:center; padding:3px 2px;">Foreign Matter (%)</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Damaged<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤3%)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Admixture<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(NA)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Red<br>Kernels<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤3%)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Chalky<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤5%)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Discoloured<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤3%)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Dehusked<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤13%)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">FRK<br>(%)<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(0.9-1.2%)</span></th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px;">Test Result<br>(Mix Ind.)</th>
                        <th rowspan="2" style="background:#0f2e5a; color:#fff; text-align:center; padding:4px 2px; min-width:110px;">Result<br>(Within Specification /<br>BRL / Beyond FSSAI)</th>
                    </tr>
                    <tr style="background:#133c70; color:#fff;">
                        <th style="background:#133c70; color:#fff; text-align:center; padding:2px;">Small<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤1%)</span></th>
                        <th style="background:#133c70; color:#fff; text-align:center; padding:2px;">Big</th>
                        <th style="background:#1b4a85; color:#fff; text-align:center; padding:2px; font-weight:700;">Total<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤25%)</span></th>
                        <th style="background:#133c70; color:#fff; text-align:center; padding:2px;">Inorg.<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤0.2%)</span></th>
                        <th style="background:#133c70; color:#fff; text-align:center; padding:2px;">Org.</th>
                        <th style="background:#1b4a85; color:#fff; text-align:center; padding:2px; font-weight:700;">Total<br><span style="font-size:7.5pt; font-weight:normal; opacity:0.85;">(≤0.5%)</span></th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background:#f4f6f9; font-weight:700;">
                        <td colspan="4" style="text-align:right; padding:6px 8px;">कुल योग (Total):</td>
                        <td style="text-align:center; padding:6px 2px; color:#0f2e5a;">${totQty.toFixed(2)}</td>
                        <td style="text-align:center; padding:6px 2px; color:#0f2e5a;">${totBags.toLocaleString('en-IN')}</td>
                        <td colspan="15"></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Uniform Specification Schedule for Common Rice (KMS 2025-2026) -->
            <div style="margin-top:8px; margin-bottom:18px; border:1px solid #0f2e5a; border-radius:4px; padding:6px 8px; font-size:7pt; background:#f8fafc; line-height:1.35; page-break-inside:avoid;">
                <div style="font-weight:700; color:#0f2e5a; margin-bottom:3px; font-size:7.5pt;">
                    📌 विनिर्देश अनुसूची — Uniform Specification for Common Rice (KMS 2025-2026) Maximum Limits:
                </div>
                <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:3px 8px; color:#111;">
                    <div><strong>1. Broken (खंडित):</strong> Max 25.0% <br><span style="color:#555;">(Small broken: Max 1.0%)</span></div>
                    <div><strong>2. Foreign Matter:</strong> Max 0.5% <br><span style="color:#555;">(Inorganic: Max 0.20%)</span></div>
                    <div><strong>3. Damaged:</strong> Max 3.0% <br><span style="color:#555;">(Raw Common, incl. pinpoint)</span></div>
                    <div><strong>4. Discolored:</strong> Max 3.0% <br><span style="color:#555;">(Raw Common Rice limit)</span></div>
                    <div><strong>5. Chalky:</strong> Max 5.0% <br><span style="color:#555;">(Raw Common Rice limit)</span></div>
                    <div><strong>6. Red Grains:</strong> Max 3.0%</div>
                    <div><strong>7. Admixture:</strong> NA <br><span style="color:#555;">(अधोवर्ग अपमिश्रण लागू नहीं)</span></div>
                    <div><strong>8. Dehusked:</strong> Max 13.0%</div>
                    <div><strong>9. Moisture Content:</strong> Max 14.0% <br><span style="color:#555;">(14-15% मान कटौती सहित)</span></div>
                    <div><strong>10. FRK Blending:</strong> 1.0% <br><span style="color:#555;">(अनुमेय परास: 0.90% - 1.20%)</span></div>
                </div>
            </div>

            <!-- Signatures Section matching PDF -->
            <div style="display:flex; justify-content:space-around; align-items:flex-end; margin-top:30px; text-align:center; page-break-inside:avoid;">
                <div style="width:28%;">
                    <div style="font-weight:700; font-size:13px; color:#111;">शाखा प्रबंधक</div>
                    <div style="margin-top:2px; font-size:11px; color:#444;">MPWLC ${bm}</div>
                    <div style="font-size:11px; color:#666;">Branch Manager</div>
                </div>
                <div style="width:28%;">
                    <div style="font-weight:700; font-size:13px; color:#111;">केंद्र प्रभारी</div>
                    <div style="margin-top:2px; font-size:11px; color:#444;">MPSCSC ${ci}</div>
                    <div style="font-size:11px; color:#666;">Centre In-charge</div>
                </div>
                <div style="width:28%;">
                    <div style="font-weight:700; font-size:13px; color:#111;">जिला प्रबंधक</div>
                    <div style="margin-top:2px; font-size:11px; color:#444;">${dm}</div>
                    <div style="font-size:11px; color:#666;">District Manager</div>
                </div>
            </div>

            <!-- Footer note matching PDF -->
            <div style="text-align:center; margin-top:35px; font-size:9.5px; color:#777; border-top:1px solid #ddd; padding-top:6px;">
                MPSCSC District Office Betul | Inspection of Rice (KMS 2025-26)
            </div>
        </div>
    `;
}

function printCurrentRiceSheet() {
    const sheetData = collectRiceSheetData();
    const html = generateRiceOfficialPrintHtml(sheetData);

    const printArea = document.getElementById('printableRiceSheetArea');
    if (printArea) {
        printArea.innerHTML = html;
        openModal('modalRicePrintView');
    }
}

function viewRiceInspectionPrint(id) {
    const sheet = (SupervState.riceInspections || []).find(s => s.id === id);
    if (!sheet) return;

    const p = sheet.payload || {};
    const sheetData = {
        warehouseName: sheet.warehouse_name || p.warehouseName,
        analysisDate: sheet.analysis_date || p.analysisDate,
        branchManager: sheet.branch_manager || p.branchManager,
        centreIncharge: sheet.centre_incharge || p.centreIncharge,
        districtManager: sheet.district_manager || p.districtManager,
        lots: p.lots || []
    };

    const html = generateRiceOfficialPrintHtml(sheetData);
    const printArea = document.getElementById('printableRiceSheetArea');
    if (printArea) {
        printArea.innerHTML = html;
        openModal('modalRicePrintView');
    }
}

function printElementDirectly(elementId, title = 'Official Report', orientation = 'landscape') {
    const el = document.getElementById(elementId);
    if (!el) {
        window.print();
        return;
    }

    let iframe = document.getElementById('superv-print-iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'superv-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 ${orientation};
            margin: 5mm 6mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff !important;
            color: #000 !important;
            font-family: 'Inter', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
            font-size: 8.5pt;
            line-height: 1.3;
        }
        .official-print-document {
            width: 100% !important;
            max-width: 100% !important;
            padding: 2mm 3mm !important;
            margin: 0 !important;
        }
        table {
            width: 100% !important;
            border-collapse: collapse !important;
        }
        table, th, td {
            border: 1px solid #0f2e5a;
        }
        th, td {
            padding: 3.5px 2px;
        }
        thead {
            display: table-header-group;
        }
        tfoot {
            display: table-footer-group;
        }
        tr {
            page-break-inside: avoid;
        }
        .signatures-section, .official-sig-block {
            page-break-inside: avoid !important;
            margin-top: 25px;
        }
    </style>
</head>
<body>
    ${el.innerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.warn('Iframe print fallback to window.print():', e);
            window.print();
        }
    }, 350);
}

function printOfficialRiceDocument() {
    printElementDirectly('printableRiceSheetArea', 'INSPECTION OF RICE (KMS 2025-26) - MPSCSC Betul', 'landscape');
}

// ── Generic Modal Helpers ─────────────────────────────────
function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('open');
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('open');
}

function openNewInspectionForm() {
    showSupervView('detailed', document.getElementById('superv-nav-detailed'));
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'light' ? 'dark' : 'light';
    if (target === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('pds-theme', target);
}

function toggleSidebar() {
    const wrapper = document.getElementById('appWrapper') || document.querySelector('.app-wrapper');
    const sb = document.getElementById('appSidebar');
    if (!wrapper) return;

    if (window.innerWidth <= 768) {
        wrapper.classList.toggle('sidebar-open');
    } else {
        const isCollapsed = wrapper.classList.toggle('sidebar-collapsed');
        if (sb) {
            if (isCollapsed) sb.classList.add('collapsed');
            else sb.classList.remove('collapsed');
        }
        localStorage.setItem('sidebar-collapsed', isCollapsed ? '1' : '0');
    }
}

function closeMobileSidebar() {
    const wrapper = document.getElementById('appWrapper') || document.querySelector('.app-wrapper');
    if (wrapper) wrapper.classList.remove('sidebar-open');
}

function initSidebarState() {
    const wrapper = document.getElementById('appWrapper') || document.querySelector('.app-wrapper');
    const sb = document.getElementById('appSidebar');
    if (!wrapper) return;

    const saved = localStorage.getItem('sidebar-collapsed');
    // Auto-shrink behavior:
    // 1) Explicit user preference saved as '1'
    // 2) Or medium screen (768px < width <= 1100px) and no explicit preference saved
    if (saved === '1' || (saved === null && window.innerWidth > 768 && window.innerWidth <= 1100)) {
        wrapper.classList.add('sidebar-collapsed');
        if (sb) sb.classList.add('collapsed');
    } else if (saved === '0') {
        wrapper.classList.remove('sidebar-collapsed');
        if (sb) sb.classList.remove('collapsed');
    }

    // Responsive auto-shrink on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            wrapper.classList.remove('sidebar-collapsed');
            if (sb) sb.classList.remove('collapsed');
        } else {
            wrapper.classList.remove('sidebar-open');
            const currentPref = localStorage.getItem('sidebar-collapsed');
            if (currentPref === '1' || (currentPref === null && window.innerWidth <= 1100)) {
                wrapper.classList.add('sidebar-collapsed');
                if (sb) sb.classList.add('collapsed');
            } else if (currentPref === '0') {
                wrapper.classList.remove('sidebar-collapsed');
                if (sb) sb.classList.remove('collapsed');
            }
        }
    });

    // Close mobile drawer on outside click or nav item click
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (sb && !sb.contains(e.target) && !e.target.closest('.header-toggle-btn')) {
                wrapper.classList.remove('sidebar-open');
            }
            if (e.target.closest('.app-sidebar .nav-item')) {
                wrapper.classList.remove('sidebar-open');
            }
        }
    });

    // Tooltip for icon-only collapsed sidebar
    const tip = document.getElementById('nav-hover-tooltip');
    if (tip) {
        document.addEventListener('mouseover', (e) => {
            if (!wrapper.classList.contains('sidebar-collapsed')) {
                tip.classList.remove('tip-visible');
                return;
            }
            const navItem = e.target.closest('.app-sidebar .nav-item');
            if (!navItem) return;
            const label = navItem.querySelector('.nav-label');
            if (!label) return;
            const rect = navItem.getBoundingClientRect();
            tip.textContent = label.textContent.trim();
            tip.style.left = (rect.right + 12) + 'px';
            tip.style.top = (rect.top + rect.height / 2) + 'px';
            tip.classList.add('tip-visible');
        });

        document.addEventListener('mouseout', (e) => {
            const navItem = e.target.closest('.app-sidebar .nav-item');
            if (navItem && !navItem.contains(e.relatedTarget)) {
                tip.classList.remove('tip-visible');
            }
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Test & Dummy Data Management Sandbox ──────────────────
let activeTestDataState = { total: 0, counts: {}, records: {} };

async function openTestDataModal() {
    await loadTestDataStatus();
    openModal('modalTestData');
}

async function loadTestDataStatus() {
    try {
        const res = await fetch('/api/supervision/test-data/status');
        const data = await res.json();
        if (!data.success) {
            console.error('Failed to load test data status:', data);
            return;
        }

        activeTestDataState = {
            total: data.totalTestRecords || 0,
            counts: data.counts || {},
            records: data.records || {}
        };

        // Update Counter Pills
        const cntInsp = document.getElementById('cntTestInspections');
        const cntSurp = document.getElementById('cntTestSurprise');
        const cntRost = document.getElementById('cntTestRoster');
        const cntMeet = document.getElementById('cntTestMeetings');
        const cntRice = document.getElementById('cntTestRice');
        const cntTasks = document.getElementById('cntTestTasks');
        const cntTot = document.getElementById('cntTestTotal');

        if (cntInsp) cntInsp.textContent = activeTestDataState.counts.inspections || 0;
        if (cntSurp) cntSurp.textContent = activeTestDataState.counts.surprise || 0;
        if (cntRost) cntRost.textContent = activeTestDataState.counts.roster || 0;
        if (cntMeet) cntMeet.textContent = activeTestDataState.counts.meetings || 0;
        if (cntRice) cntRice.textContent = activeTestDataState.counts.rice || 0;
        if (cntTasks) cntTasks.textContent = activeTestDataState.counts.tasks || 0;
        if (cntTot) cntTot.textContent = activeTestDataState.total || 0;

        // Render Test Records Table
        const tbody = document.getElementById('testDataRecordsTableBody');
        if (!tbody) return;

        const allRows = [];

        // Detailed Inspections
        (data.records.inspections || []).forEach(r => {
            allRows.push(`
                <tr>
                    <td><span style="font-weight:600; color:var(--primary);">📋 सघन निरीक्षण</span></td>
                    <td><code>${escapeHtml(r.id)}</code></td>
                    <td>${escapeHtml(r.issue_center_name || 'N/A')}</td>
                    <td>${escapeHtml(r.inspection_date || 'N/A')}</td>
                    <td><span class="superv-badge badge-info">अनुपालन ${r.compliance_percentage || 0}%</span></td>
                </tr>
            `);
        });

        // Surprise Visits
        (data.records.surprise || []).forEach(r => {
            allRows.push(`
                <tr>
                    <td><span style="font-weight:600; color:var(--superv-warning);">⚡ औचक दौरा</span></td>
                    <td><code>${escapeHtml(r.id)}</code></td>
                    <td>${escapeHtml(r.issue_center_name || 'N/A')}</td>
                    <td>${escapeHtml(r.inspection_date || 'N/A')}</td>
                    <td><span class="superv-badge badge-warning">${r.passed_points || 0}/${r.total_points || 10} पास</span></td>
                </tr>
            `);
        });

        // Roster Targets
        (data.records.roster || []).forEach(r => {
            allRows.push(`
                <tr>
                    <td><span style="font-weight:600; color:#3b82f6;">📅 रोस्टर लक्ष्य</span></td>
                    <td><code>${escapeHtml(r.id)}</code></td>
                    <td>${escapeHtml(r.issue_center_name || 'N/A')} (${escapeHtml(r.month || '')})</td>
                    <td>${escapeHtml(r.target_date || 'N/A')}</td>
                    <td><span class="superv-badge ${r.status === 'Completed' ? 'badge-success' : 'badge-danger'}">${escapeHtml(r.status || 'Pending')}</span></td>
                </tr>
            `);
        });

        // Meetings
        (data.records.meetings || []).forEach(r => {
            allRows.push(`
                <tr>
                    <td><span style="font-weight:600; color:#a855f7;">🤝 समन्वय बैठक</span></td>
                    <td><code>${escapeHtml(r.id)}</code></td>
                    <td>${escapeHtml(r.agency_name || 'N/A')}</td>
                    <td>${escapeHtml(r.meeting_date || 'N/A')}</td>
                    <td><span class="superv-badge badge-info">कार्यवृत्त दर्ज</span></td>
                </tr>
            `);
        });

        // Rice Inspections
        (data.records.rice || []).forEach(r => {
            allRows.push(`
                <tr>
                    <td><span style="font-weight:600; color:#10b981;">🌾 चावल परीक्षण</span></td>
                    <td><code>${escapeHtml(r.id)}</code></td>
                    <td>${escapeHtml(r.center_name || 'N/A')} · ${escapeHtml(r.mill_name || '')}</td>
                    <td>${escapeHtml(r.inspection_date || 'N/A')}</td>
                    <td><span class="superv-badge ${r.overall_result === 'PASSED' ? 'badge-success' : 'badge-danger'}">${escapeHtml(r.overall_result || 'PENDING')}</span></td>
                </tr>
            `);
        });

        // Tasks / Orders
        (data.records.tasks || []).forEach(r => {
            allRows.push(`
                <tr>
                    <td><span style="font-weight:600; color:#ec4899;">📬 आदेश एवं कार्य</span></td>
                    <td><code>${escapeHtml(r.id)}</code></td>
                    <td>${escapeHtml(r.subject || r.issue_center_name || 'N/A')}</td>
                    <td>${escapeHtml(r.inspection_date ? String(r.inspection_date).slice(0, 10) : 'N/A')}</td>
                    <td><span class="superv-badge badge-warning">${escapeHtml(r.status || 'NEW')}</span></td>
                </tr>
            `);
        });

        if (allRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">डेटाबेस में वर्तमान में कोई टेस्ट/डमी डेटा नहीं है। (डेटाबेस पूरी तरह स्वच्छ है)</td></tr>`;
        } else {
            tbody.innerHTML = allRows.join('');
        }
    } catch (err) {
        console.error('Error in loadTestDataStatus:', err);
    }
}

async function seedTestDataFromUI() {
    if (!confirm('क्या आप 22 विविध परिदृश्यों (Edge cases, pass/fail, multiple dates/centers) वाले डमी टेस्ट रिकॉर्ड्स डेटाबेस में लोड करना चाहते हैं?\n\n(यह मूल उत्पादन डेटा को प्रभावित नहीं करेगा)')) {
        return;
    }

    try {
        const res = await fetch('/api/supervision/test-data/seed', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            // Re-fetch all application states
            await Promise.all([
                fetchInspections(),
                fetchSurpriseVisits(),
                fetchRoster(),
                fetchMeetings(),
                fetchRiceInspections(),
                fetchSupervisionStats(),
                loadSupervisionTasks()
            ]);

            renderDashboard();
            renderArchivesTable();
            renderSurpriseTable();
            renderRosterTable();
            renderMeetingsList();
            renderRiceInspectionsTable();

            await loadTestDataStatus();
            alert(`✅ ${data.seededCount} डमी टेस्ट रिकॉर्ड्स सफलतापूर्वक लोड कर दिए गए हैं!\nसभी मॉड्यूल, फ़िल्टर एवं डैशबोर्ड में डमी डेटा सक्रिय है।`);
        } else {
            alert('डमी डेटा लोड करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

async function cleanupTestDataFromUI() {
    const total = activeTestDataState.total || 0;
    if (total === 0) {
        alert('वर्तमान में डेटाबेस में कोई डमी/टेस्ट डेटा उपलब्ध नहीं है। सफाई की आवश्यकता नहीं है।');
        return;
    }

    const confirmMsg = `⚠️ महत्वपूर्ण चेतावनी (Strict Safe Deletion):\n\nयह कार्रवाई केवल TEST/DUMMY के रूप में चिह्नित कुल ${total} रिकॉर्ड्स को डेटाबेस से स्थायी रूप से हटाएगी।\n\n• सघन निरीक्षण: ${activeTestDataState.counts.inspections || 0}\n• औचक दौरे: ${activeTestDataState.counts.surprise || 0}\n• वार्षिक रोस्टर: ${activeTestDataState.counts.roster || 0}\n• समन्वय बैठकें: ${activeTestDataState.counts.meetings || 0}\n• चावल परीक्षण: ${activeTestDataState.counts.rice || 0}\n• आदेश एवं कार्य: ${activeTestDataState.counts.tasks || 0}\n\nमूल एवं वास्तविक उत्पादन डेटा (DEMO_01, ROST_2026_.. आदि) 100% सुरक्षित रहेंगे।\n\nक्या आप इन सभी ${total} टेस्ट रिकॉर्ड्स को हटाना चाहते हैं?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const res = await fetch('/api/supervision/test-data/cleanup', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            // Re-fetch all application states
            await Promise.all([
                fetchInspections(),
                fetchSurpriseVisits(),
                fetchRoster(),
                fetchMeetings(),
                fetchRiceInspections(),
                fetchSupervisionStats(),
                loadSupervisionTasks()
            ]);

            renderDashboard();
            renderArchivesTable();
            renderSurpriseTable();
            renderRosterTable();
            renderMeetingsList();
            renderRiceInspectionsTable();

            await loadTestDataStatus();
            alert(`✅ टेस्ट डेटा सफलतापूर्वक हटा दिया गया!\n\nकुल हटाए गए टेस्ट रिकॉर्ड्स: ${data.totalDeleted}\n• सघन निरीक्षण: ${data.deleted.inspections || 0}\n• औचक दौरे: ${data.deleted.surprise || 0}\n• रोस्टर लक्ष्य: ${data.deleted.roster || 0}\n• समन्वय बैठकें: ${data.deleted.meetings || 0}\n• चावल प्रपत्र: ${data.deleted.rice || 0}\n• आदेश एवं कार्य: ${data.deleted.tasks || 0}\n\nडेटाबेस अब स्वच्छ है और मूल डेटा पूरी तरह सुरक्षित है।`);
        } else {
            alert('टेस्ट डेटा हटाने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

/**
 * 1-Click Safe Cleanup of Dummy Tasks specifically from Orders & Tasks Module
 */
async function deleteDummyTasksFromUI() {
    if (!confirm('क्या आप "आदेश एवं कार्य अनुश्रवण" से सभी डमी/परीक्षण टास्क स्थायी रूप से हटाना चाहते हैं?\n\n(वास्तविक शासकीय ईमेल से सिंक किए गए आदेश पूर्णतः सुरक्षित रहेंगे)')) {
        return;
    }

    try {
        const res = await fetch('/api/supervision/tasks/delete-dummy', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            await loadSupervisionTasks();
            alert(`✅ ${data.message || 'डमी टास्क सफलतापूर्वक हटा दिए गए।'}`);
        } else {
            alert('त्रुटि: ' + (data.error || 'डमी डेटा हटाने में विफल'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

// ════════════════════════════════════════════════════════════
// OFFICIAL ORDERS & TASKS MODULE LOGIC
// ════════════════════════════════════════════════════════════

async function loadSupervisionTasks() {
    try {
        const statusFilter = document.getElementById('taskStatusFilter')?.value || '';
        const sectionFilter = document.getElementById('taskSectionFilter')?.value || '';
        let url = `/api/supervision/tasks?`;
        if (SupervState.taskFilterDept) url += `department=${encodeURIComponent(SupervState.taskFilterDept)}&`;
        if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
        if (sectionFilter) url += `section=${encodeURIComponent(sectionFilter)}&`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            SupervState.tasks = data.tasks || [];
            SupervState.taskSummary = data.summary || {};

            // Update Metric Counters
            const sm = SupervState.taskSummary;
            const elTotal = document.getElementById('taskStatTotal');
            const elOverdue = document.getElementById('taskStatOverdue');
            const elDueToday = document.getElementById('taskStatDueToday');
            const elDue3Days = document.getElementById('taskStatDue3Days');
            const elReqConfirm = document.getElementById('taskStatRequiresConfirm');
            const elCompleted = document.getElementById('taskStatCompleted');

            if (elTotal) elTotal.textContent = sm.total || 0;
            if (elOverdue) elOverdue.textContent = sm.overdue || 0;
            if (elDueToday) elDueToday.textContent = sm.dueToday || 0;
            if (elDue3Days) elDue3Days.textContent = sm.dueIn3Days || 0;
            if (elReqConfirm) elReqConfirm.textContent = sm.requiresConfirmation || 0;
            if (elCompleted) elCompleted.textContent = sm.completed || 0;

            // Sync Gemini AI Status Badge
            updateGeminiBadges();

            renderTasksTable(SupervState.tasks);
        }
    } catch (err) {
        console.warn('Failed to load supervision tasks:', err);
    }
}

function renderTasksTable(tasks) {
    const tbody = document.getElementById('supervisionTasksTableBody');
    if (!tbody) return;

    if (!tasks || tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">कोई शासकीय आदेश या कार्य दर्ज नहीं है। 'ईमेल सिंक करें' या 'नया कार्य जोड़ें' पर क्लिक करें।</td></tr>`;
        return;
    }

    const priorityBadges = {
        CRITICAL: `<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);">🔴 अति-महत्वपूर्ण (TL)</span>`,
        HIGH: `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);">🟠 उच्च (High)</span>`,
        MEDIUM: `<span class="badge" style="background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3);">🟡 सामान्य (Medium)</span>`,
        LOW: `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3);">⚪ सामान्य सूचना</span>`
    };

    const statusBadges = {
        NEW: `<span class="badge" style="background:rgba(59,130,246,0.15); color:#3b82f6;">नवीन (New)</span>`,
        IN_PROGRESS: `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b;">प्रगतिरत</span>`,
        COMPLETED: `<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981;">✅ पूर्ण</span>`,
        ESCALATED: `<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444;">🚨 टी.एल. विलंबित</span>`
    };

    let html = '';
    for (const t of tasks) {
        // Priority
        const pBadge = priorityBadges[t.priority] || priorityBadges.MEDIUM;
        const sBadge = statusBadges[t.status] || statusBadges.NEW;

        // Deadline & Distinction
        let deadlineHtml = '';
        if (t.due_date) {
            const d = new Date(t.due_date);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            
            if (t.deadline_type === 'OFFICIAL_EXPLICIT') {
                deadlineHtml = `<div style="font-weight:600; color:var(--text-main); font-size:12px;">📅 ${dateStr}</div>
                                <div style="font-size:10px; color:#10b981; font-weight:600;">🟢 राजकीय समय-सीमा</div>`;
            } else {
                deadlineHtml = `<div style="font-weight:600; color:var(--text-main); font-size:12px;">📅 ${dateStr}</div>
                                <div style="font-size:10px; color:#d97706; font-weight:600;">🟡 AI अनुमानित</div>`;
            }

            if (t.isOverdue) {
                deadlineHtml += `<div style="font-size:10px; color:#ef4444; font-weight:700; margin-top:2px;">⚠️ समय-सीमा समाप्त (${Math.abs(t.daysToDue)} दिन पूर्व)</div>`;
            } else if (t.isDueToday) {
                deadlineHtml += `<div style="font-size:10px; color:#f59e0b; font-weight:700; margin-top:2px;">⏳ आज अंतिम तिथि है!</div>`;
            }
        } else {
            deadlineHtml = `<div style="font-size:11px; color:var(--text-muted);">समय-सीमा अनिर्णित</div>`;
        }

        // If requires confirmation, offer one-click confirmation
        if (t.requires_confirmation && t.status !== 'COMPLETED') {
            deadlineHtml += `<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px; padding:2px 6px; margin-top:4px; color:#d97706; border-color:#d97706;" onclick="confirmTaskTimeline('${t.id}', '${t.due_date || ''}')">
                ✓ समय-सीमा पुष्टि करें
            </button>`;
        }

        const emailUrl = t.source_email_url || `https://mail.google.com/mail/u/0/#inbox/${t.gmail_message_id}`;

        html += `
            <tr style="${t.isOverdue ? 'background:rgba(239,68,68,0.03);' : ''}">
                <td>
                    <div style="font-weight:700; font-size:12px; color:var(--text-main);">${t.id}</div>
                    <div style="margin-top:4px;">${pBadge}</div>
                </td>
                <td>
                    <div style="font-weight:600; font-size:12px; color:var(--text-main);">${t.letter_ref_no || '—'}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">दिनांक: ${t.letter_date || '—'}</div>
                </td>
                <td>
                    <div style="font-size:12px; font-weight:600; color:var(--text-main);">${t.issuing_authority}</div>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">श्रेणी: ${t.department_category || 'HO'}</div>
                </td>
                <td>
                    <div style="font-weight:600; font-size:12.5px; color:var(--text-main);">${t.subject}</div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px; max-height:42px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                        ${t.task_description}
                    </div>
                </td>
                <td>
                    <div>${formatSectionBadge(t.assigned_section)}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">${t.responsible_person || '—'}</div>
                </td>
                <td>
                    ${deadlineHtml}
                </td>
                <td>
                    ${sBadge}
                </td>
                <td style="text-align:center;">
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
                        <a href="${emailUrl}" target="_blank" class="btn btn-secondary btn-sm" style="width:100%; text-align:center; font-size:11px; padding:3px 6px; text-decoration:none;" title="मूल ईमेल Gmail में खोलें">
                            📨 ईमेल खोलें
                        </a>
                        <div style="display:flex; gap:4px; width:100%;">
                            <button type="button" class="btn btn-secondary btn-sm" style="flex:1; font-size:11px; padding:3px 4px;" onclick="viewTaskDetails('${t.id}')" title="विस्तार से देखें">
                                👁️ विवरण
                            </button>
                            ${t.status !== 'COMPLETED' ? `
                            <button type="button" class="btn btn-sm" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:11px; padding:3px 4px;" onclick="markTaskComplete('${t.id}')" title="कार्य पूर्ण चिह्नित करें">
                                ✓ पूर्ण
                            </button>
                            ` : ''}
                        </div>
                        <div style="display:flex; gap:4px; width:100%;">
                            <button type="button" class="btn btn-secondary btn-sm" style="flex:1; font-size:10px; padding:2px 4px;" onclick="openEditTaskModal('${t.id}')">
                                ✏️ संपादन
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" style="font-size:10px; padding:2px 4px; color:#ef4444;" onclick="deleteTask('${t.id}')">
                                🗑️
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
}

function filterTasksByDept(dept) {
    SupervState.taskFilterDept = dept;
    const btnAll = document.getElementById('btnFilterDeptAll');
    const btnHO = document.getElementById('btnFilterDeptHO');
    const btnDist = document.getElementById('btnFilterDeptDist');
    const btnRO = document.getElementById('btnFilterDeptRO');

    [btnAll, btnHO, btnDist, btnRO].forEach(b => b?.classList.remove('active'));

    if (!dept && btnAll) btnAll.classList.add('active');
    if (dept === 'HO' && btnHO) btnHO.classList.add('active');
    if (dept === 'DISTRICT_ADMIN' && btnDist) btnDist.classList.add('active');
    if (dept === 'RO' && btnRO) btnRO.classList.add('active');

    loadSupervisionTasks();
}

function filterTasksLocally() {
    const q = (document.getElementById('taskSearchInput')?.value || '').toLowerCase().trim();
    if (!q) {
        renderTasksTable(SupervState.tasks);
        return;
    }

    const filtered = SupervState.tasks.filter(t => 
        (t.subject && t.subject.toLowerCase().includes(q)) ||
        (t.letter_ref_no && t.letter_ref_no.toLowerCase().includes(q)) ||
        (t.issuing_authority && t.issuing_authority.toLowerCase().includes(q)) ||
        (t.task_description && t.task_description.toLowerCase().includes(q)) ||
        (t.assigned_section && t.assigned_section.toLowerCase().includes(q)) ||
        (formatSectionLabel(t.assigned_section).toLowerCase().includes(q))
    );

    renderTasksTable(filtered);
}

function formatSectionBadge(sec) {
    const labels = {
        'PDS': { name: 'PDS (उठाव/वितरण)', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        'Milling': { name: 'मिलिंग (Milling)', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        'Procurement': { name: 'उपार्जन (Procurement)', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        'Storage': { name: 'भंडारण (Storage)', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        'Quality': { name: 'गुणवत्ता नियंत्रण (QC)', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
        'Finance': { name: 'वित्त एवं लेखा', color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
        'Admin': { name: 'सामान्य प्रशासन', color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
    };
    const s = labels[sec] || { name: sec || 'PDS', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
    return `<span style="display:inline-block; font-size:11px; font-weight:600; padding:2px 7px; border-radius:4px; background:${s.bg}; color:${s.color}; border:1px solid ${s.color}33;">${s.name}</span>`;
}

function formatSectionLabel(sec) {
    const labels = {
        'PDS': 'PDS (उठाव एवं वितरण)',
        'Milling': 'मिलिंग (Milling)',
        'Procurement': 'उपार्जन (Procurement)',
        'Storage': 'भंडारण एवं वेयरहाउसिंग',
        'Quality': 'गुणवत्ता नियंत्रण (QC)',
        'Finance': 'वित्त एवं लेखा',
        'Admin': 'सामान्य प्रशासन'
    };
    return labels[sec] || sec || 'PDS';
}

function openNewTaskModal() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('modalTaskFormTitle').textContent = '➕ नवीन शासकीय कार्य / आदेश प्रविष्टि';
    document.getElementById('taskFormId').value = '';
    document.getElementById('taskFormRefNo').value = '';
    document.getElementById('taskFormLetterDate').value = today;
    document.getElementById('taskFormAuthority').value = 'प्रबंध संचालक, म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन, भोपाल';
    document.getElementById('taskFormCategory').value = 'HO';
    document.getElementById('taskFormSubject').value = '';
    document.getElementById('taskFormDescription').value = '';
    document.getElementById('taskFormSection').value = 'PDS';
    document.getElementById('taskFormResponsible').value = 'जिला प्रबंधक बैतूल';
    document.getElementById('taskFormPriority').value = 'HIGH';
    document.getElementById('taskFormDueDate').value = '';
    document.getElementById('taskFormDeadlineType').value = 'OFFICIAL_EXPLICIT';
    document.getElementById('taskFormRequiresConfirm').checked = false;
    document.getElementById('taskFormRemarks').value = '';
    document.getElementById('taskFormStatus').value = 'NEW';

    openModal('modalTaskForm');
}

function openEditTaskModal(taskId) {
    const task = SupervState.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('modalTaskFormTitle').textContent = `✏️ कार्य संपादन: ${task.id}`;
    document.getElementById('taskFormId').value = task.id;
    document.getElementById('taskFormRefNo').value = task.letter_ref_no || '';
    document.getElementById('taskFormLetterDate').value = task.letter_date || '';
    document.getElementById('taskFormAuthority').value = task.issuing_authority || '';
    document.getElementById('taskFormCategory').value = task.department_category || 'HO';
    document.getElementById('taskFormSubject').value = task.subject || '';
    document.getElementById('taskFormDescription').value = task.task_description || '';
    document.getElementById('taskFormSection').value = task.assigned_section || 'PDS';
    document.getElementById('taskFormResponsible').value = task.responsible_person || '';
    document.getElementById('taskFormPriority').value = task.priority || 'MEDIUM';
    
    if (task.due_date) {
        document.getElementById('taskFormDueDate').value = task.due_date.substring(0, 16);
    } else {
        document.getElementById('taskFormDueDate').value = '';
    }

    document.getElementById('taskFormDeadlineType').value = task.deadline_type || 'OFFICIAL_EXPLICIT';
    document.getElementById('taskFormRequiresConfirm').checked = Boolean(task.requires_confirmation);
    document.getElementById('taskFormRemarks').value = task.compliance_remarks || '';
    document.getElementById('taskFormStatus').value = task.status || 'NEW';

    openModal('modalTaskForm');
}

function toggleConfirmCheckbox(type) {
    const chk = document.getElementById('taskFormRequiresConfirm');
    if (chk) {
        chk.checked = (type === 'AI_SUGGESTED');
    }
}

async function handleSaveTask(event) {
    event.preventDefault();

    const id = document.getElementById('taskFormId').value;
    const taskPayload = {
        id: id || undefined,
        letter_ref_no: document.getElementById('taskFormRefNo').value,
        letter_date: document.getElementById('taskFormLetterDate').value,
        issuing_authority: document.getElementById('taskFormAuthority').value,
        department_category: document.getElementById('taskFormCategory').value,
        subject: document.getElementById('taskFormSubject').value,
        task_description: document.getElementById('taskFormDescription').value,
        assigned_section: document.getElementById('taskFormSection').value,
        responsible_person: document.getElementById('taskFormResponsible').value,
        priority: document.getElementById('taskFormPriority').value,
        due_date: document.getElementById('taskFormDueDate').value ? new Date(document.getElementById('taskFormDueDate').value).toISOString() : null,
        deadline_type: document.getElementById('taskFormDeadlineType').value,
        requires_confirmation: document.getElementById('taskFormRequiresConfirm').checked ? 1 : 0,
        compliance_remarks: document.getElementById('taskFormRemarks').value,
        status: document.getElementById('taskFormStatus').value
    };

    try {
        const method = id ? 'PATCH' : 'POST';
        const url = id ? `/api/supervision/tasks/${id}` : '/api/supervision/tasks';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskPayload)
        });

        const data = await res.json();
        if (data.success) {
            closeModal('modalTaskForm');
            await loadSupervisionTasks();
            alert('✅ कार्य सफलतापूर्वक सुरक्षित कर लिया गया है!');
        } else {
            alert('त्रुटि: ' + (data.error || 'अज्ञात समस्या'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

async function markTaskComplete(taskId) {
    const remarks = prompt('कार्य पूर्ण करने संबंधी टिप्पणी दर्ज करें (वैकल्पिक):', 'आदेश का पालन सुनिश्चित किया गया।');
    if (remarks === null) return;

    try {
        const res = await fetch(`/api/supervision/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'COMPLETED',
                compliance_remarks: remarks,
                completion_date: new Date().toISOString()
            })
        });

        const data = await res.json();
        if (data.success) {
            await loadSupervisionTasks();
        } else {
            alert('कार्य पूर्ण अद्यतन करने में विफल: ' + (data.error || ''));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

async function confirmTaskTimeline(taskId, currentDueDate) {
    const newDateStr = prompt('अधिकारी द्वारा अनुमोदित समय-सीमा दर्ज करें (YYYY-MM-DD):', currentDueDate ? currentDueDate.split('T')[0] : '');
    if (!newDateStr) return;

    const parsedDate = new Date(newDateStr + 'T18:00:00');
    if (isNaN(parsedDate.getTime())) {
        alert('अमान्य दिनांक प्रारूप। कृपया YYYY-MM-DD प्रारूप में दर्ज करें।');
        return;
    }

    try {
        const res = await fetch(`/api/supervision/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                due_date: parsedDate.toISOString(),
                deadline_type: 'OFFICIAL_EXPLICIT',
                requires_confirmation: 0,
                suggested_timeline: `अनुमोदित समय-सीमा: ${newDateStr}`
            })
        });

        const data = await res.json();
        if (data.success) {
            await loadSupervisionTasks();
            alert('✅ समय-सीमा की पुष्टि कर ली गई है!');
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

async function deleteTask(taskId) {
    if (!confirm(`क्या आप कार्य ${taskId} को हटाना चाहते हैं?`)) return;

    try {
        const res = await fetch(`/api/supervision/tasks/${taskId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            await loadSupervisionTasks();
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

async function viewTaskDetails(taskId) {
    try {
        const res = await fetch(`/api/supervision/tasks/${taskId}`);
        const task = await res.json();
        if (!task || task.error) {
            alert('कार्य विवरण लोड करने में असमर्थ');
            return;
        }

        document.getElementById('taskDetailTitle').textContent = `शासकीय आदेश: ${task.id} (${task.letter_ref_no || 'बिना क्रमांक'})`;
        
        let attachHtml = '<div style="font-size:12px; color:var(--text-muted);">कोई संलग्नक नहीं।</div>';
        if (task.attachments && task.attachments.length > 0) {
            attachHtml = task.attachments.map(a => `
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:8px 12px; margin-top:6px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:12px; font-weight:600; color:var(--text-main);">📎 ${a.filename}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${(a.file_size_bytes / 1024).toFixed(1)} KB · ${a.mime_type}</div>
                    </div>
                </div>
            `).join('');
        }

        const dDate = task.due_date ? new Date(task.due_date).toLocaleString('hi-IN') : 'अनिर्णित';

        document.getElementById('taskDetailBody').innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px;">
                    <div style="font-size:11px; color:var(--text-muted);">जारीकर्ता प्राधिकारी</div>
                    <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-top:2px;">${task.issuing_authority}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">पत्र क्रमांक एवं दिनांक</div>
                    <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-top:2px;">${task.letter_ref_no || '—'} (दिनांक: ${task.letter_date || '—'})</div>
                </div>
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px;">
                    <div style="font-size:11px; color:var(--text-muted);">समय-सीमा (Due Date)</div>
                    <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-top:2px;">${dDate}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">प्रभारी शाखा एवं अधिकारी</div>
                    <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-top:2px;">${formatSectionLabel(task.assigned_section)} — ${task.responsible_person || 'प्रभारी'}</div>
                </div>
            </div>

            <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:var(--text-muted);">विषय (Subject):</div>
                <div style="font-size:14px; font-weight:700; color:var(--text-main); margin-top:4px;">${task.subject}</div>
            </div>

            <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:var(--text-muted);">कार्य विवरण एवं निर्देश बिंदु:</div>
                <div style="font-size:13px; color:var(--text-main); line-height:1.7; margin-top:6px; white-space:pre-wrap;">${task.task_description}</div>
            </div>

            <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:var(--text-muted);">संलग्न आदेश प्रतियां (Attachments):</div>
                ${attachHtml}
            </div>

            ${task.ai_priority_reason ? `
            <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.25); border-radius:8px; padding:12px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:700; color:#818cf8;">🤖 Gemini AI प्रशासनिक विश्लेषण (AI Priority Assessment)</span>
                    <span class="superv-badge" style="background:rgba(99,102,241,0.2); color:#818cf8; font-size:10.5px; border:1px solid rgba(99,102,241,0.3);">प्राथमिकता: ${task.priority}</span>
                </div>
                <div style="font-size:12px; color:var(--text-main); margin-top:5px; line-height:1.5;">${task.ai_priority_reason}</div>
            </div>
            ` : ''}

            ${task.draft_compliance_response ? `
            <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.25); border-radius:8px; padding:14px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:#10b981;">📝 एआई स्वतः जनरेटेड पालन प्रतिवेदन प्रारूप (Draft Compliance Note)</span>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="copyDraftCompliance('${task.id}')" id="btnCopyCompliance_${task.id}" style="font-size:11px; padding:3px 8px;">📋 कॉपी करें</button>
                </div>
                <pre id="textDraftCompliance_${task.id}" style="font-size:11.5px; color:var(--text-main); background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; white-space:pre-wrap; font-family:inherit; line-height:1.6; margin:0;">${task.draft_compliance_response}</pre>
            </div>
            ` : `
            <div style="margin-bottom:16px; text-align:right;">
                <button type="button" class="btn btn-sm btn-secondary" onclick="generateDraftCompliance('${task.id}')" id="btnGenDraft_${task.id}" style="font-size:11.5px;">
                    🤖 Gemini AI से पालन प्रतिवेदन ड्राफ्ट तैयार करवाएं
                </button>
            </div>
            `}

            ${task.compliance_remarks ? `
            <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:8px; padding:12px;">
                <div style="font-size:11px; font-weight:600; color:#10b981;">अनुपालन टिप्पणी / पालन प्रतिवेदन स्थिति:</div>
                <div style="font-size:12.5px; color:var(--text-main); margin-top:4px;">${task.compliance_remarks}</div>
            </div>
            ` : ''}
        `;

        const linkUrl = task.source_email_url || `https://mail.google.com/mail/u/0/#inbox/${task.gmail_message_id}`;
        document.getElementById('taskDetailEmailLinkContainer').innerHTML = `
            <a href="${linkUrl}" target="_blank" class="btn btn-primary btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                📨 Gmail में मूल पत्र खोलें (Open Email)
            </a>
        `;

        openModal('modalTaskDetail');
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

async function copyDraftCompliance(taskId) {
    const el = document.getElementById(`textDraftCompliance_${taskId}`);
    const btn = document.getElementById(`btnCopyCompliance_${taskId}`);
    if (!el) return;
    try {
        await navigator.clipboard.writeText(el.innerText || el.textContent);
        if (btn) {
            const orig = btn.innerText;
            btn.innerText = '✓ कॉपी हो गया!';
            btn.style.color = '#10b981';
            setTimeout(() => {
                btn.innerText = orig;
                btn.style.color = '';
            }, 2000);
        }
    } catch (e) {
        alert('टेक्स्ट का चयन करके कॉपी करें।');
    }
}

async function generateDraftCompliance(taskId) {
    const btn = document.getElementById(`btnGenDraft_${taskId}`);
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ AI द्वारा तैयार हो रहा है...';
    }
    try {
        const res = await fetch(`/api/tasks/${taskId}/draft-compliance`);
        const data = await res.json();
        if (data.success && data.task) {
            await openTaskDetailModal(taskId);
        } else {
            alert('ड्राफ्ट तैयार करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
            if (btn) btn.disabled = false;
        }
    } catch (e) {
        alert('त्रुटि: ' + e.message);
        if (btn) btn.disabled = false;
    }
}

// ── Gmail Account Management & Sync ──────────────────────────

function switchGmailLinkTab(tabName) {
    const tabs = ['quick', 'oauth', 'apppw', 'gemini', 'sync'];
    const tabBtns = {
        quick: document.getElementById('btnTabQuickLink'),
        oauth: document.getElementById('btnTabOAuth'),
        apppw: document.getElementById('btnTabAppPassword'),
        gemini: document.getElementById('btnTabGemini'),
        sync: document.getElementById('btnTabSyncSettings')
    };
    const tabPanels = {
        quick: document.getElementById('panelGmailQuickLink'),
        oauth: document.getElementById('panelGmailOAuth'),
        apppw: document.getElementById('panelGmailAppPassword'),
        gemini: document.getElementById('panelGmailGemini'),
        sync: document.getElementById('panelGmailSyncSettings')
    };

    tabs.forEach(t => {
        const btn = tabBtns[t];
        const panel = tabPanels[t];
        const isActive = t === tabName;
        if (btn) {
            if (t === 'gemini') {
                // Gemini has a special active style
                btn.style.background = isActive ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)';
                btn.style.color = isActive ? '#a5b4fc' : '#818cf8';
                btn.style.border = isActive ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(99,102,241,0.35)';
            } else {
                btn.style.background = isActive ? 'var(--primary)' : 'transparent';
                btn.style.color = isActive ? '#fff' : 'var(--text-muted)';
            }
        }
        if (panel) {
            panel.style.display = isActive ? 'block' : 'none';
        }
    });

    // Load sync settings when switching to sync tab
    if (tabName === 'sync') {
        loadSyncSettings();
    }
}

// ── Sync Settings Functions ────────────────────────────────────────────────

let _syncIntervalSelected = 5; // default 5 minutes

function setSyncInterval(minutes) {
    _syncIntervalSelected = minutes;
    const display = document.getElementById('syncIntervalDisplay');
    if (display) display.textContent = minutes + ' मिनट';
    document.querySelectorAll('.sync-interval-btn').forEach(btn => {
        const val = parseInt(btn.getAttribute('data-val'));
        const isActive = val === minutes;
        btn.style.background = isActive ? 'rgba(99,102,241,0.15)' : 'transparent';
        btn.style.color = isActive ? 'var(--primary)' : 'var(--text-muted)';
        btn.style.border = isActive ? '1px solid var(--primary)' : '1px solid var(--border)';
        btn.style.fontWeight = isActive ? '700' : '600';
    });
}

async function loadSyncSettings() {
    try {
        const [bgRes, manRes, twRes, intRes] = await Promise.all([
            fetch('/api/settings/sync_limit_bg').then(r => r.json()).catch(() => ({ value: null })),
            fetch('/api/settings/sync_limit_manual').then(r => r.json()).catch(() => ({ value: null })),
            fetch('/api/settings/sync_time_window_days').then(r => r.json()).catch(() => ({ value: null })),
            fetch('/api/settings/sync_poll_interval_min').then(r => r.json()).catch(() => ({ value: null }))
        ]);

        const bgLimit = parseInt(bgRes.value) || 10;
        const manLimit = parseInt(manRes.value) || 20;
        const timeWindow = parseInt(twRes.value) || 14;
        const pollInterval = parseInt(intRes.value) || 5;

        const bgSlider = document.getElementById('syncLimitBgSlider');
        const manSlider = document.getElementById('syncLimitManualSlider');
        const twSlider = document.getElementById('syncTimeWindowSlider');
        const bgDisplay = document.getElementById('syncLimitBgDisplay');
        const manDisplay = document.getElementById('syncLimitManualDisplay');
        const twDisplay = document.getElementById('syncTimeWindowDisplay');

        if (bgSlider) { bgSlider.value = bgLimit; }
        if (bgDisplay) { bgDisplay.textContent = bgLimit + ' ईमेल'; }
        if (manSlider) { manSlider.value = manLimit; }
        if (manDisplay) { manDisplay.textContent = manLimit + ' ईमेल'; }
        if (twSlider) { twSlider.value = timeWindow; }
        if (twDisplay) { twDisplay.textContent = timeWindow + ' दिन'; }

        setSyncInterval(pollInterval);

        // Show summary
        const summaryEl = document.getElementById('syncSettingsSummary');
        const summaryText = document.getElementById('syncSettingsSummaryText');
        if (summaryEl && summaryText) {
            summaryEl.style.display = 'block';
            summaryText.innerHTML = `
                🔄 पृष्ठभूमि: <strong>${bgLimit} ईमेल</strong> हर <strong>${pollInterval} मिनट</strong> &nbsp;|
                📥 मैनुअल: <strong>${manLimit} ईमेल</strong> &nbsp;|
                📅 समय-सीमा: <strong>पिछले ${timeWindow} दिन</strong>`;
        }
    } catch (e) {
        console.warn('Sync settings load failed:', e);
    }
}

async function saveSyncSettings() {
    const btn = document.getElementById('btnSaveSyncSettings');
    const bgLimit = parseInt(document.getElementById('syncLimitBgSlider')?.value) || 10;
    const manLimit = parseInt(document.getElementById('syncLimitManualSlider')?.value) || 20;
    const timeWindow = parseInt(document.getElementById('syncTimeWindowSlider')?.value) || 14;
    const pollInterval = _syncIntervalSelected || 5;

    if (btn) {
        btn.innerHTML = '⏳ सुरक्षित हो रहा है...';
        btn.disabled = true;
    }

    try {
        const saves = await Promise.all([
            fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sync_limit_bg', value: String(bgLimit) }) }),
            fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sync_limit_manual', value: String(manLimit) }) }),
            fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sync_time_window_days', value: String(timeWindow) }) }),
            fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sync_poll_interval_min', value: String(pollInterval) }) })
        ]);

        const allOk = saves.every(r => r.ok);
        if (allOk) {
            if (btn) {
                btn.innerHTML = '✅ सेटिंग्स सुरक्षित!';
                btn.style.background = '#10b981';
            }
            // Update summary
            const summaryEl = document.getElementById('syncSettingsSummary');
            const summaryText = document.getElementById('syncSettingsSummaryText');
            if (summaryEl && summaryText) {
                summaryEl.style.display = 'block';
                summaryText.innerHTML = `
                    🔄 पृष्ठभूमि: <strong>${bgLimit} ईमेल</strong> हर <strong>${pollInterval} मिनट</strong> &nbsp;|
                    📥 मैनुअल: <strong>${manLimit} ईमेल</strong> &nbsp;|
                    📅 समय-सीमा: <strong>पिछले ${timeWindow} दिन</strong>`;
            }
            setTimeout(() => {
                if (btn) {
                    btn.innerHTML = '💾 सेटिंग्स सुरक्षित करें';
                    btn.style.background = '';
                    btn.disabled = false;
                }
            }, 2500);
        } else {
            throw new Error('कुछ सेटिंग्स सुरक्षित नहीं हुईं।');
        }
    } catch (e) {
        if (btn) {
            btn.innerHTML = '❌ त्रुटि: ' + e.message;
            btn.style.background = '#ef4444';
            setTimeout(() => {
                btn.innerHTML = '💾 सेटिंग्स सुरक्षित करें';
                btn.style.background = '';
                btn.disabled = false;
            }, 3000);
        }
    }
}

// ── End Sync Settings Functions ────────────────────────────────────────────

function toggleOAuthEditForm() {
    const readyBox = document.getElementById('oauthReadyBox');
    const formBox = document.getElementById('oauthConfigForm');
    if (!formBox) return;
    if (formBox.style.display === 'none') {
        formBox.style.display = 'block';
        if (readyBox) readyBox.style.display = 'none';
    } else {
        formBox.style.display = 'none';
        if (readyBox) readyBox.style.display = 'block';
    }
}

function toggleSecretVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}

function copyRedirectUri() {
    const input = document.getElementById('txtGoogleRedirectUri');
    const btn = document.getElementById('btnCopyRedirectUri');
    if (!input) return;
    
    const textToCopy = input.value || (window.location.origin + '/api/gmail/oauth/callback');
    navigator.clipboard.writeText(textToCopy).then(() => {
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✓ कॉपी हो गया!';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#10b981';
            setTimeout(() => {
                btn.innerHTML = orig;
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 2500);
        }
    }).catch(err => {
        alert('URI कॉपी करने के लिए टेक्स्ट का चयन करें: ' + textToCopy);
    });
}

function openGeminiModal() {
    openModal('modalGmailStatus');
    switchGmailLinkTab('gemini');
    openGmailStatusModal();
}

function openGeminiModalFromNav(navEl) {
    const tasksNav = document.getElementById('superv-nav-tasks');
    showSupervView('tasks', tasksNav || navEl);
    setTimeout(() => {
        openGeminiModal();
    }, 100);
}

async function updateGeminiBadges() {
    try {
        const res = await fetch('/api/gemini/status');
        const aiData = await res.json();
        const headerBadge = document.getElementById('geminiHeaderBadge');
        const bannerBadge = document.getElementById('geminiBannerBadge');
        const modalBadge = document.getElementById('geminiStatusBadge');
        const sarvamBadge = document.getElementById('sarvamStatusBadge');

        const isGeminiActive = Boolean(aiData.active);
        const isSarvamActive = Boolean(aiData.sarvam && aiData.sarvam.active);
        const isSarvamQuota = Boolean(aiData.sarvam && aiData.sarvam.quotaExhausted);

        if (isGeminiActive) {
            if (headerBadge) {
                headerBadge.style.background = '#10b981';
                headerBadge.textContent = 'Active';
            }
            if (bannerBadge) {
                bannerBadge.className = 'superv-badge badge-success';
                bannerBadge.textContent = `🟢 Gemini सक्रिय (${aiData.model || 'gemini-3.5-flash'})`;
            }
            if (modalBadge) {
                modalBadge.className = 'superv-badge badge-success';
                modalBadge.textContent = `सक्रिय (Active: ${aiData.model || 'gemini-3.5-flash'})`;
            }
        } else if (isSarvamActive) {
            if (headerBadge) {
                headerBadge.style.background = '#059669';
                headerBadge.textContent = 'Sarvam AI';
            }
            if (bannerBadge) {
                bannerBadge.className = 'superv-badge badge-success';
                bannerBadge.textContent = `🇮🇳 Sarvam AI सक्रिय (फॉलबैक)`;
            }
            if (modalBadge) {
                modalBadge.className = 'superv-badge badge-warning';
                modalBadge.textContent = aiData.rateLimited ? 'दर सीमा (Rate Limit) — Sarvam सक्रिय' : 'अपुष्ट (Unverified)';
            }
        } else if (aiData.rateLimited) {
            if (headerBadge) {
                headerBadge.style.background = '#f59e0b';
                headerBadge.textContent = 'Rate Limit';
            }
            if (bannerBadge) {
                bannerBadge.className = 'superv-badge badge-warning';
                bannerBadge.textContent = '🟡 Gemini दर सीमा (Rate Limit)';
            }
            if (modalBadge) {
                modalBadge.className = 'superv-badge badge-warning';
                modalBadge.textContent = 'दर सीमा (429 Rate Limit)';
            }
        } else if (aiData.configured) {
            if (headerBadge) {
                headerBadge.style.background = '#f59e0b';
                headerBadge.textContent = 'Pending';
            }
            if (bannerBadge) {
                bannerBadge.className = 'superv-badge badge-warning';
                bannerBadge.textContent = '🟡 अपुष्ट';
            }
            if (modalBadge) {
                modalBadge.className = 'superv-badge badge-warning';
                modalBadge.textContent = 'अपुष्ट (Unverified)';
            }
        }

        // Update Sarvam Badge
        if (sarvamBadge) {
            if (isSarvamActive) {
                sarvamBadge.className = 'superv-badge badge-success';
                sarvamBadge.textContent = '🟢 सक्रिय (sarvam-105b)';
            } else if (isSarvamQuota) {
                sarvamBadge.className = 'superv-badge badge-warning';
                sarvamBadge.textContent = '🟡 कोटा समाप्त (0 Credits)';
            } else if (aiData.sarvam && aiData.sarvam.configured) {
                sarvamBadge.className = 'superv-badge badge-warning';
                sarvamBadge.textContent = '🟡 स्टैंडबाय (Standby)';
            } else {
                sarvamBadge.className = 'superv-badge';
                sarvamBadge.textContent = 'असंरचित (Setup Required)';
            }
        }
    } catch (e) {}
}

async function openGmailStatusModal() {
    openModal('modalGmailStatus');
    const dot = document.getElementById('gmailStatusDot');
    const heading = document.getElementById('gmailStatusHeading');
    const emailEl = document.getElementById('gmailAccountEmail');
    const alertBox = document.getElementById('gmailConfigAlert');
    const btnConnect = document.getElementById('btnConnectGmail');
    const btnDisconnect = document.getElementById('btnDisconnectGmail');
    const txtEmail = document.getElementById('txtLinkGmailEmail');
    const txtName = document.getElementById('txtLinkGmailName');
    const txtAppEmail = document.getElementById('txtAppPwEmail');
    const txtOAuthClientId = document.getElementById('txtGoogleClientId');
    const txtOAuthRedirect = document.getElementById('txtGoogleRedirectUri');
    const btnSubmitText = document.getElementById('btnSubmitLinkDirectText');
    const btnSubmitIcon = document.getElementById('btnSubmitLinkDirectIcon');
    const oauthBadge = document.getElementById('oauthStatusBadge');
    const oauthReadyBox = document.getElementById('oauthReadyBox');
    const oauthConfigForm = document.getElementById('oauthConfigForm');

    // Auto-fill origin redirect URI if empty
    const currentOriginRedirect = window.location.origin + '/api/gmail/oauth/callback';
    if (txtOAuthRedirect && !txtOAuthRedirect.value) {
        txtOAuthRedirect.value = currentOriginRedirect;
    }

    try {
        // 1. Fetch current Gmail linkage status and AI status
        const [statusRes, oauthRes, geminiRes] = await Promise.allSettled([
            fetch('/api/gmail/status'),
            fetch('/api/gmail/oauth/config'),
            fetch('/api/gemini/status')
        ]);

        let data = {};
        if (statusRes.status === 'fulfilled') {
            data = await statusRes.value.json();
        }

        let oauthConfig = {};
        if (oauthRes.status === 'fulfilled') {
            oauthConfig = await oauthRes.value.json();
        }

        // Configure Dual-Engine AI indicators across Header, OAuth panel, App PW panel, and Gemini tab
        let geminiData = {};
        if (geminiRes.status === 'fulfilled') {
            try {
                geminiData = await geminiRes.value.json();
            } catch (e) {}
        }

        const isGeminiActive = Boolean(geminiData && geminiData.active);
        const isGeminiConfigured = Boolean(geminiData && geminiData.geminiConfigured);
        const geminiModel = (geminiData && geminiData.model) || 'gemini-3.5-flash';
        const maskedKey = (geminiData && geminiData.maskedKey) || (isGeminiConfigured ? '••••••••••••' : 'असंरचित (Setup Required)');

        // Sarvam details
        const sarvam = geminiData.sarvam || {};
        const isSarvamActive = Boolean(sarvam.active);
        const isSarvamQuota = Boolean(sarvam.quotaExhausted);
        const isSarvamConfigured = Boolean(sarvam.configured);
        const maskedSarvamKey = sarvam.maskedKey || (isSarvamConfigured ? '••••••••••••' : '');

        // 1. Gemini AI Tab badge & key input
        const badge = document.getElementById('geminiStatusBadge');
        const txtKey = document.getElementById('txtGeminiApiKey');
        if (badge) {
            if (isGeminiActive) {
                badge.className = 'superv-badge badge-success';
                badge.textContent = `सक्रिय (Active: ${geminiModel})`;
            } else if (geminiData.rateLimited) {
                badge.className = 'superv-badge badge-warning';
                badge.textContent = `दर सीमा (429 Rate Limit)`;
            } else if (isGeminiConfigured) {
                badge.className = 'superv-badge badge-warning';
                badge.textContent = `अपुष्ट (Unverified)`;
            } else {
                badge.className = 'superv-badge';
                badge.textContent = `असंरचित (Setup Required)`;
            }
        }
        if (txtKey && !txtKey.value && geminiData.maskedKey) {
            txtKey.value = geminiData.maskedKey;
        }

        // 1b. Sarvam AI Tab badge & key input
        const sarvamBadge = document.getElementById('sarvamStatusBadge');
        const txtSarvamKey = document.getElementById('txtSarvamApiKey');
        if (sarvamBadge) {
            if (isSarvamActive) {
                sarvamBadge.className = 'superv-badge badge-success';
                sarvamBadge.textContent = `सक्रिय (sarvam-105b)`;
            } else if (isSarvamQuota) {
                sarvamBadge.className = 'superv-badge badge-warning';
                sarvamBadge.textContent = `कोटा समाप्त (0 Credits)`;
            } else if (isSarvamConfigured) {
                sarvamBadge.className = 'superv-badge badge-warning';
                sarvamBadge.textContent = `स्टैंडबाय (Standby)`;
            } else {
                sarvamBadge.className = 'superv-badge';
                sarvamBadge.textContent = `असंरचित (Setup Required)`;
            }
        }
        if (txtSarvamKey && !txtSarvamKey.value && maskedSarvamKey) {
            txtSarvamKey.value = maskedSarvamKey;
        }

        // 2. Dual Pipeline Header Pill
        const pillGemini = document.getElementById('headerPillGemini');
        if (pillGemini) {
            if (isGeminiActive) {
                const fallbackLabel = isSarvamConfigured ? ' + Sarvam 🛡️' : '';
                pillGemini.className = 'superv-badge badge-success';
                pillGemini.textContent = `🤖 Gemini AI: सक्रिय (${geminiModel})${fallbackLabel}`;
            } else if (isSarvamActive) {
                pillGemini.className = 'superv-badge badge-success';
                pillGemini.textContent = `🇮🇳 Sarvam AI: सक्रिय (फॉलबैक)`;
            } else if (geminiData.rateLimited) {
                pillGemini.className = 'superv-badge badge-warning';
                pillGemini.textContent = `⚠️ Gemini AI: दर सीमा (Rate Limit)`;
            } else {
                pillGemini.className = 'superv-badge badge-warning';
                pillGemini.textContent = `🤖 AI इंजन: असंरचित`;
            }
        }

        // 3. OAuth Tab Integrated Gemini Card
        const oauthGeminiBadge = document.getElementById('oauthGeminiStatusBadge');
        const oauthGeminiKeyMasked = document.getElementById('oauthGeminiKeyMasked');
        if (oauthGeminiBadge) {
            if (isGeminiActive) {
                oauthGeminiBadge.className = 'superv-badge badge-success';
                oauthGeminiBadge.textContent = `✓ Gemini AI सक्रिय (${geminiModel})`;
            } else {
                oauthGeminiBadge.className = 'superv-badge badge-warning';
                oauthGeminiBadge.textContent = `⚠️ Gemini AI असंरचित`;
            }
        }
        if (oauthGeminiKeyMasked) {
            oauthGeminiKeyMasked.textContent = maskedKey;
        }

        // 4. App Password Tab Integrated Gemini Card
        const appPwGeminiBadge = document.getElementById('appPwGeminiStatusBadge');
        const appPwGeminiKeyMasked = document.getElementById('appPwGeminiKeyMasked');
        if (appPwGeminiBadge) {
            if (isGeminiActive) {
                appPwGeminiBadge.className = 'superv-badge badge-success';
                appPwGeminiBadge.textContent = `✓ Gemini AI सक्रिय (${geminiModel})`;
            } else {
                appPwGeminiBadge.className = 'superv-badge badge-warning';
                appPwGeminiBadge.textContent = `⚠️ Gemini AI असंरचित`;
            }
        }
        if (appPwGeminiKeyMasked) {
            appPwGeminiKeyMasked.textContent = maskedKey;
        }

        // Configure OAuth UI tab
        const isOAuthConfigured = Boolean(oauthConfig.configured);
        if (oauthBadge) {
            if (isOAuthConfigured) {
                oauthBadge.className = 'superv-badge badge-success';
                oauthBadge.textContent = 'सक्रिय (Configured)';
                if (oauthReadyBox) oauthReadyBox.style.display = 'block';
                if (oauthConfigForm) oauthConfigForm.style.display = 'none';
            } else {
                oauthBadge.className = 'superv-badge badge-warning';
                oauthBadge.textContent = 'असंरचित (Setup Required)';
                if (oauthReadyBox) oauthReadyBox.style.display = 'none';
                if (oauthConfigForm) oauthConfigForm.style.display = 'block';
            }
        }

        if (txtOAuthClientId && oauthConfig.clientId) {
            txtOAuthClientId.value = oauthConfig.clientId;
        }
        if (txtOAuthRedirect && oauthConfig.redirectUri) {
            txtOAuthRedirect.value = oauthConfig.redirectUri;
        }

        if (btnConnect) {
            btnConnect.style.display = 'flex';
        }

        // Configure Linked Account Header & Pipeline Transport Pill
        const pillTransport = document.getElementById('headerPillTransport');
        if (data.connected && data.account) {
            if (dot) dot.style.background = '#10b981';
            if (heading) heading.textContent = `सक्रिय एवं अधिकृत: ${data.account.displayName || data.account.email}`;
            if (emailEl) emailEl.innerHTML = `<strong>${data.account.email}</strong> (${data.account.accountType === 'gmail_workspace' ? 'Google Workspace' : 'Standard Gmail'})<br><span style="color:#10b981; font-weight:600;">● शासकीय ईमेल संबद्ध एवं सक्रिय</span> · कनेक्टेड: ${new Date(data.account.connectedAt).toLocaleDateString('hi-IN')}`;
            if (btnDisconnect) btnDisconnect.style.display = 'inline-block';
            if (txtEmail) txtEmail.value = data.account.email;
            if (txtAppEmail) txtAppEmail.value = data.account.email;
            if (txtName && !txtName.value) txtName.value = data.account.displayName || 'जिला कार्यालय बैतूल (District Office Betul)';
            if (btnSubmitIcon) btnSubmitIcon.textContent = '🔄';
            if (btnSubmitText) btnSubmitText.textContent = 'संबद्ध खाता अद्यतन / पुनः लिंक करें (Update Linked Account)';

            if (pillTransport) {
                const isAppPw = Boolean(data.account.appPassword);
                const isOAuth = data.account.accountType === 'gmail_oauth';
                const methodLabel = isOAuth ? '🌐 Google OAuth 2.0' : (isAppPw ? '🔑 App Password' : '⚡ 1-क्लिक लिंक');
                pillTransport.className = 'superv-badge badge-success';
                pillTransport.textContent = `📥 ${methodLabel} (सक्रिय)`;
            }

            if (alertBox) {
                alertBox.style.display = 'none';
            }
        } else {
            if (dot) dot.style.background = '#f59e0b';
            if (heading) heading.textContent = 'कोई शासकीय खाता संबद्ध नहीं है';
            if (emailEl) emailEl.textContent = 'शासकीय ईमेल से स्वतः आदेश ट्रेक करने के लिए नीचे दिए गए 3 विकल्पों में से किसी एक से खाता लिंक करें।';
            if (btnDisconnect) btnDisconnect.style.display = 'none';
            if (txtEmail && !txtEmail.value) txtEmail.value = 'dmnanbetul1@gmail.com';
            if (txtAppEmail && !txtAppEmail.value) txtAppEmail.value = 'dmnanbetul1@gmail.com';
            if (txtName && !txtName.value) txtName.value = 'जिला कार्यालय बैतूल (District Office Betul)';
            if (btnSubmitIcon) btnSubmitIcon.textContent = '🔗';
            if (btnSubmitText) btnSubmitText.textContent = 'यह शासकीय खाता लिंक एवं सक्रिय करें (Link Account)';

            if (pillTransport) {
                pillTransport.className = 'superv-badge badge-warning';
                pillTransport.textContent = '📥 असंबंधित (Not Connected)';
            }

            if (alertBox) {
                alertBox.style.display = 'none';
            }
        }
    } catch (err) {
        console.warn('Failed to check Gmail status:', err);
    }
}

async function linkGmailAccountDirect() {
    const emailInput = document.getElementById('txtLinkGmailEmail');
    const nameInput = document.getElementById('txtLinkGmailName');
    const email = emailInput ? emailInput.value.trim() : '';
    const displayName = nameInput ? nameInput.value.trim() : '';

    if (!email || !email.includes('@')) {
        alert('कृपया वैध शासकीय ईमेल पता प्रविष्ट करें (उदा. dmnanbetul1@gmail.com)');
        if (emailInput) emailInput.focus();
        return;
    }

    const btn = document.getElementById('btnSubmitLinkDirect');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> <span>संबद्ध किया जा रहा है...</span>';
    }

    try {
        const res = await fetch('/api/gmail/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, displayName })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ शासकीय जीमेल खाता "${email}" सफलतापूर्वक लिंक हो गया है!`);
            await openGmailStatusModal();
            await loadSupervisionTasks();
        } else {
            alert('खाता लिंक करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

async function saveGoogleOAuthCredentials() {
    const idInput = document.getElementById('txtGoogleClientId');
    const secretInput = document.getElementById('txtGoogleClientSecret');
    const redirectInput = document.getElementById('txtGoogleRedirectUri');

    const clientId = idInput ? idInput.value.trim() : '';
    const clientSecret = secretInput ? secretInput.value.trim() : '';
    const redirectUri = redirectInput ? redirectInput.value.trim() : (window.location.origin + '/api/gmail/oauth/callback');

    if (!clientId) {
        alert('कृपया Google Cloud Console से प्राप्त Client ID प्रविष्ट करें।\n(उदा. xxxxx.apps.googleusercontent.com)');
        if (idInput) idInput.focus();
        return;
    }
    if (!clientSecret) {
        alert('कृपया Google Cloud Console से प्राप्त Client Secret प्रविष्ट करें।\n(उदा. GOCSPX-xxxxx)');
        if (secretInput) secretInput.focus();
        return;
    }

    const btn = document.getElementById('btnSaveOAuthAndConnect');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> <span>क्रेडेंशियल सुरक्षित हो रहे हैं...</span>';
    }

    try {
        const res = await fetch('/api/gmail/oauth/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, clientSecret, redirectUri })
        });
        const data = await res.json();

        if (data.success) {
            alert('✅ Google OAuth 2.0 क्रेडेंशियल सुरक्षित कर दिए गए हैं!\n\nअब आपको Google Sign-In पृष्ठ पर पुनर्निर्देशित किया जा रहा है...');
            if (data.url) {
                window.location.href = data.url;
            } else {
                await initiateGmailConnect();
            }
        } else {
            alert('क्रेडेंशियल सुरक्षित करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

async function linkWithAppPassword() {
    const emailInput = document.getElementById('txtAppPwEmail');
    const pwInput = document.getElementById('txtAppPwKey');

    const email = emailInput ? emailInput.value.trim() : '';
    const appPassword = pwInput ? pwInput.value.trim().replace(/\s+/g, '') : '';

    if (!email || !email.includes('@')) {
        alert('कृपया वैध शासकीय ईमेल पता प्रविष्ट करें (उदा. dmnanbetul1@gmail.com)');
        if (emailInput) emailInput.focus();
        return;
    }
    if (!appPassword || appPassword.length < 8) {
        alert('कृपया वैध 16-अक्षरीय Google App Password प्रविष्ट करें।\n(Google Account > Security > App Passwords में जनरेट किया गया)');
        if (pwInput) pwInput.focus();
        return;
    }

    const btn = document.getElementById('btnSubmitAppPw');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> <span>सुरक्षित किया जा रहा है...</span>';
    }

    try {
        const res = await fetch('/api/gmail/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                displayName: 'जिला कार्यालय बैतूल (District Office Betul)',
                appPassword
            })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ Google App Password सुरक्षित हो गया एवं शासकीय ईमेल "${email}" सफलतापूर्वक लिंक हो गया!`);
            await openGmailStatusModal();
            await loadSupervisionTasks();
        } else {
            alert('ऐप पासवर्ड से लिंक करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

async function initiateGmailConnect() {
    try {
        const res = await fetch('/api/gmail/oauth/url');
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            // Show clear front-end guidance and switch to the OAuth setup tab directly
            switchGmailLinkTab('oauth');
            alert('ℹ️ Google Cloud OAuth 2.0 प्रमाणीकरण सूचना:\n\n' + (data.error || 'Google OAuth क्रेडेंशियल कॉन्फ़िगर नहीं हैं।') + '\n\nहमने आपके लिए Google OAuth सेटअप टैब खोल दिया है। आप ऊपर दिए गए फॉर्म में Client ID और Secret भरकर तुरंत सुरक्षित कर सकते हैं!');
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    }
}

async function disconnectGmailAccount() {
    if (!confirm('क्या आप शासकीय Gmail खाते का अधिकृत कनेक्शन विच्छेद करना चाहते हैं?')) return;

    try {
        const res = await fetch('/api/gmail/disconnect', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('जीमेल खाता सफलतापूर्वक विच्छेदित कर दिया गया।');
            await openGmailStatusModal();
            await loadSupervisionTasks();
        }
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

async function syncGmailOrders() {
    const btn = document.getElementById('btnSyncGmail');
    const spinner = document.getElementById('syncSpinner');

    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'inline';

    try {
        const res = await fetch('/api/gmail/sync', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            const r = data.result || {};
            await loadSupervisionTasks();
            alert(`📥 ईमेल सिंक पूर्ण!\n\n• जांचे गए ईमेल: ${r.checked || 0}\n• नवीन कार्य निर्मित: ${r.actionableCreated || 0}\n• गैर-कार्रवाई योग्य / सूचना ईमेल: ${r.ignoredNoise || 0}`);
        } else {
            if (data.error && data.error.includes('No active Gmail account')) {
                openGmailStatusModal();
            } else {
                alert('सिंक विफल: ' + (data.error || 'अज्ञात त्रुटि'));
            }
        }
    } catch (err) {
        alert('सर्वर त्रुटि: ' + err.message);
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

// ── Gemini AI Administrative Intelligence Handlers ────────────

async function testGeminiConnectionUI() {
    const btn = document.getElementById('btnTestGemini');
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ टेस्ट हो रहा है...';
    }

    try {
        const res = await fetch('/api/gemini/status?force=true');
        const data = await res.json();
        if (data.active) {
            alert(`✅ Gemini AI कनेक्शन सफल एवं सक्रिय है!\n\n• मॉडल: ${data.model}\n• स्थिति: ऑनलाइन एवं शासकीय विश्लेषण हेतु तैयार`);
        } else if (data.rateLimited) {
            alert(`⚠️ Gemini API दर सीमा (Rate Limit):\n${data.error}\n\n💡 सूचना: यदि आपने Sarvam AI Key कॉन्फ़िगर की है, तो सिस्टम बिना किसी रुकावट के स्वचालित रूप से Sarvam AI पर स्विच होकर सभी ईमेल का विश्लेषण करेगा!`);
        } else {
            alert(`⚠️ Gemini AI कनेक्शन चेतावनी: ${data.error || 'सत्यापन विफल'}`);
        }
    } catch (e) {
        alert('सर्वर त्रुटि: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '⚡ Gemini टेस्ट करें';
        }
    }
}

async function saveGeminiApiKeyUI() {
    const input = document.getElementById('txtGeminiApiKey');
    const apiKey = input ? input.value.trim() : '';
    if (!apiKey) {
        alert('कृपया वैध Gemini API Key प्रविष्ट करें।');
        if (input) input.focus();
        return;
    }

    const btn = document.getElementById('btnSaveGeminiKey');
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ सुरक्षित हो रहा है...';
    }

    try {
        const res = await fetch('/api/gemini/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        });
        const data = await res.json();
        if (data.success) {
            alert(`🎉 ${data.message}\n\nसक्रिय मॉडल: ${data.model}\nअब आने वाले सभी शासकीय ईमेल का विश्लेषण Gemini AI द्वारा स्वचालित होगा!`);
            await openGmailStatusModal();
        } else {
            alert('सुरक्षित करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (e) {
        alert('सर्वर त्रुटि: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '💾 Gemini Key सुरक्षित करें';
        }
    }
}

// ── Sarvam AI Sovereign Fallback Handlers ──────────────────────

async function testSarvamConnectionUI() {
    const btn = document.getElementById('btnTestSarvam');
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ टेस्ट हो रहा है...';
    }

    try {
        const res = await fetch('/api/sarvam/status');
        const data = await res.json();
        if (data.active) {
            alert(`✅ Sarvam AI कनेक्शन सफल एवं सक्रिय है!\n\n• मॉडल: ${data.model}\n• स्थिति: ऑनलाइन एवं शासकीय विश्लेषण हेतु तैयार\n• यह इंजन Gemini AI की दर सीमा पर स्वतः फॉलबैक का कार्य करेगा।`);
        } else if (data.quotaExhausted) {
            alert(`⚠️ Sarvam AI स्थिति सूचना:\n\n• मॉडल: sarvam-105b\n• परिणाम: API Key वैध है, परंतु खाते में 0 क्रेडिट उपलब्ध हैं (No credits available)।\n\n💡 समाधान: कृपया Sarvam AI डैशबोर्ड (dashboard.sarvam.ai) पर जाकर वॉलेट रिचार्ज करें ताकि Gemini 429 दर सीमा होने पर यह फॉलबैक स्वचालित कार्य कर सके।`);
        } else {
            alert(`⚠️ Sarvam AI स्थिति:\n${data.error || 'कनेक्शन सत्यापन विफल'}`);
        }
    } catch (e) {
        alert('सर्वर त्रुटि: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '⚡ Sarvam AI टेस्ट करें';
        }
    }
}

async function saveSarvamApiKeyUI() {
    const input = document.getElementById('txtSarvamApiKey');
    const apiKey = input ? input.value.trim() : '';
    if (!apiKey) {
        alert('कृपया वैध Sarvam AI API Subscription Key प्रविष्ट करें।');
        if (input) input.focus();
        return;
    }

    const btn = document.getElementById('btnSaveSarvamKey');
    if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳ सुरक्षित हो रहा है...';
    }

    try {
        const res = await fetch('/api/sarvam/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        });
        const data = await res.json();
        if (data.success) {
            alert(`🎉 ${data.message}\n\nमॉडल: ${data.model}\nGemini AI की दर सीमा होने पर सिस्टम स्वचालित रूप से Sarvam AI पर स्विच हो जाएगा!`);
            await openGmailStatusModal();
        } else {
            alert('सुरक्षित करने में विफल: ' + (data.error || 'अज्ञात त्रुटि'));
        }
    } catch (e) {
        alert('सर्वर त्रुटि: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '💾 Sarvam Key सुरक्षित करें';
        }
    }
}



