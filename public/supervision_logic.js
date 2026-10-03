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
    initDefaultDates();
    renderStockVerificationRows();
    renderCheckpoints();
    renderSurpriseChecklist();
    selectProtocolDay('mon');
    selectCoordAgency('MPWLC');
    selectReviewCategory('ic_operators');
    
    await Promise.all([
        fetchDirectoryData(),
        fetchSupervisionStats(),
        fetchInspections(),
        fetchSurpriseVisits(),
        fetchRoster()
    ]);

    renderDashboard();
    renderRosterTable();
    renderArchivesTable();
    renderSurpriseTable();
});

function initDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const formDate = document.getElementById('formInspectionDate');
    const surpDate = document.getElementById('surpDate');
    const meetDate = document.getElementById('meetingDate');
    if (formDate) formDate.value = today;
    if (surpDate) surpDate.value = today;
    if (meetDate) meetDate.value = today;
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
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;" data-sp-id="${p.id}">
            <span style="font-size:12px; color:var(--text-main); flex:1;"><strong>${p.id}.</strong> ${p.text}</span>
            <div class="toggle-btn-group">
                <button type="button" class="toggle-opt yes active" onclick="toggleSurpriseItem(${p.id}, true)">मानक अनुरूप (Pass)</button>
                <button type="button" class="toggle-opt no" onclick="toggleSurpriseItem(${p.id}, false)">कमी (Defect)</button>
            </div>
        </div>
    `).join('');
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
}

function openSurpriseModal() {
    initDefaultDates();
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
    window.print();
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
    const sb = document.getElementById('appSidebar');
    if (sb) sb.classList.toggle('collapsed');
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
