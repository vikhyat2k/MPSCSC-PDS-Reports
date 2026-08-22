const pColor = (pct) => pct >= 90 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626';
/**
 * Premium Portal Logic v3.4 [Auto-Restart & Color-Coding]
 */
console.log('%c Premium Portal Logic v3.4 Initialized', 'background: #0f172a; color: #10b981; padding: 5px; border-radius: 5px; font-weight: bold;');

// API Base URL
const API_BASE = '';

// State
let currentRequestId = null;
let pollingInterval = null;
let timerInterval = null;
let startTime = null;
let currentReportMode = 'monthly'; // 'monthly' or 'daterange'
let currentDRDates = { from: '', to: '' };
let currentScheme = 'nfsa'; // Track active scheme tab
let lastAnalyticsData = null; // Store for summary generation
let lastParams = null; // Store for auto-restart
let loggingStartTime = null; // Track how long "Logging in" takes
let restartCount = 0; // Prevent infinite loops

// 0.1 Global Error Logger
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorBox = document.getElementById('criticalUIError');
    if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = `⚠️ <strong>UI Crash:</strong> ${msg} (Line: ${lineNo})`;
    }
    return false;
};

/**
 * Authentication Helper
 */
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.status === 401) {
        window.location.href = 'login.html';
    }
    return response;
};

async function logout() {
    try {
        const response = await fetch('api/auth/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = 'login.html';
    }
}

// Hindi Month Names
function getHindiMonthName(monthNumber) {
    const months = [
        'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
        'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
    ];
    return months[monthNumber - 1] || '';
}

function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || '';
}

// Global Date Formatter
function formatDateToDMY(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// XSS Prevention
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Utility: Copy Text to Clipboard
 */
function copyTextToClipboard(text, btn) {
    if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            if (btn) {
                const oldContent = btn.innerHTML;
                btn.innerHTML = '✅ Copied!';
                setTimeout(() => { btn.innerHTML = oldContent; }, 2000);
            }
        } catch (err) { console.error('Fallback copy failed', err); }
        document.body.removeChild(textArea);
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            const oldContent = btn.innerHTML;
            btn.innerHTML = '✅ Copied!';
            setTimeout(() => { btn.innerHTML = oldContent; }, 2000);
        }
    }, (err) => { console.error('Async copy failed', err); });
}

// WhatsApp Message Templates
const MESSAGE_TEMPLATES = [
    {
        name: "Standard Direct",
        text: (avg, list, period) => `*विषय: खाद्यान्न उठाव (Lifting) प्रगति रिपोर्ट - ${period}*\n\nजिले का वर्तमान औसत उठाव *${avg}%* है।\n\nसमीक्षा के दौरान निम्नलिखित सेक्टरों का प्रदर्शन जिले के औसत से काफी कम पाया गया है:\n\n${list}\n\n*निर्देश:* संबंधित ट्रांसपोर्टर तत्काल अतिरिक्त वाहन लगाना सुनिश्चित करें और उठाव में सुधार करें। कार्य पूर्ण न होने की स्थिति में आगामी प्रशासनिक कार्रवाई के लिए आप स्वयं उत्तरदायी होंगे।\n\n🕒 _रिपोर्ट दिनांक: ${new Date().toLocaleString('en-IN')}_`
    },
    {
        name: "Urgent Formal",
        text: (avg, list, period) => `*अति आवश्यक: खाद्यान्न उठाव (Lifting) की समीक्षा रिपोर्ट (${period})*\n\nजिले का कुल उठाव औसत *${avg}%* पर स्थिर है\n\nनिम्न ट्रांसपोर्टर का उठाव औसत से बहुत कम पाया गया है:\n\n${list}\n\n*चेतावनी:* कृपया इसे अंतिम चेतावनी समझें। खाद्यान्न उठाव (Lifting) की समय-सीमा समाप्त होने वाली है। कार्य में देरी के लिए संबंधित पर कठोर कार्रवाई की जाएगी।\n\n🕒 _रिपोर्ट दिनांक: ${new Date().toLocaleString('en-IN')}_`
    },
    {
        name: "Admin Follow-up",
        text: (avg, list, period) => `*कलेक्टर एवं जिला प्रबंधक की साप्ताहिक समीक्षा - ${period}*\n\nकुल औसत उठाव: *${avg}%*\n\n*कम उठाव वाले ट्रांसपोर्टर की सूची:*\n${list}\n\nउपरोक्त ट्रांसपोर्टर तत्काल जिला कार्यालय में उपस्थित होकर अपना स्पष्टीकरण प्रस्तुत करें। उठाव में तेजी न आने की स्थिति में अनुबंध विखंडन की कार्रवाई प्रस्तावित की जाएगी।\n\n🕒 _रिपोर्ट दिनांक: ${new Date().toLocaleString('en-IN')}_`
    },
    {
        name: "Strict Notice (3-Day Review)",
        text: (avg, list, period) => `*🛑 सख्त चेतावनी: पिछले 3 दिनों के उठाव (Lifting) की समीक्षा - ${period} 🛑*\n\nबार-बार दिए गए सख्त निर्देशों के बावजूद, आपके संबंधित सेक्टरों में उठाव की स्थिति अत्यंत निराशाजनक बनी हुई है। जिले का औसत उठाव *${avg}%* है, जबकि आपकी प्रगति निम्नवत है:\n\n${list}\n\n*अंतिम निर्देश:* यदि अगले 24 घंटों में उठाव में उल्लेखनीय सुधार नहीं हुआ, तो पेनाल्टी अधिरोपित की जाएगी। इसे अंतिम चेतावनी समझें।\n\n🕒 _रिपोर्ट दिनांक: ${new Date().toLocaleString('en-IN')}_`
    },
    {
        name: "POS अंतर Alert (Hindi)",
        text: (avg, list, period, avgPos, avgDiff) => `*⚠️ विषय: POS प्राप्ति अंतर चेतावनी - ${period}*\n\nजिले का वर्तमान औसत उठाव: *${avg}%*\nPOS मशीन में औसत प्राप्ति: *${avgPos || 'N/A'}%*\n\nनिम्नलिखित सेक्टरों में *प्रेषित मात्रा एवं POS प्राप्ति के बीच अंतर* अधिक पाया गया है — अर्थात् गोदाम से खाद्यान्न प्रेषित हो चुका है, परंतु उचित मूल्य दुकान पर POS मशीन में प्राप्ति दर्ज नहीं हुई है:\n\n${list}\n\n*निर्देश:* संबंधित ट्रांसपोर्टर तत्काल दुकानों पर  POS प्राप्ति करवाना सुनिश्चित करें । अन्यथा यह माना जायेगा की आपके द्वारा खाद्यान उचित मूल्य दुकान पर नहीं पहुचाया गया है।POS की प्राप्ति खाद्यान की डिलीवरी के समय ही करवाना सुनिश्चित करें अगर विक्रेता प्राप्ति नहीं करता है तो तत्काल अपने क्षेत्र के ASO/JSO को अवगत कराएं |\n\n🕒 _रिपोर्ट दिनांक: ${new Date().toLocaleString('en-IN')}_`
    },
    {
        name: "POS अंतर Strict Notice (Hindi)",
        text: (avg, list, period, avgPos, avgDiff) => `*🚨 सख्त चेतावनी: POS प्राप्ति में गंभीर विसंगति - ${period} 🚨*\n\nजिला प्रबंधक, म.प्र. स्टेट सिविल सप्लाईज़ कॉर्पो. लि., बैतूल\n\nउठाव औसत: *${avg}%* | POS प्राप्ति औसत: *${avgPos || 'N/A'}%*\n\n*निम्न सेक्टरों में प्रेषित मात्रा एवं POS प्राप्ति का अंतर अस्वीकार्य स्तर पर है:*\n\n${list}\n\n⚠️ यह स्थिति खाद्यान्न के दुरुपयोग/देरी की संभावना को दर्शाती है।\n\n*अंतिम निर्देश:*\n1. तत्काल संबंधित दुकानदारों से संपर्क कर POS प्राप्ति दर्ज करावें।\n2. 24 घंटे में अंतर कम न होने पर लिखित स्पष्टीकरण प्रस्तुत करें।\n3. बार-बार अंतर पाए जाने पर अनुबंध निरस्तीकरण की कार्रवाई प्रस्तावित की जाएगी।\n\n🕒 _रिपोर्ट दिनांक: ${new Date().toLocaleString('en-IN')}_`
    }
];

/**
 * Messenger Logic - Uncapped & Auto-Attention
 */

/**
 * Populate the Messenger report dropdown with reports from ALL schemes:
 * NFSA (monthly + daterange), MDM, ICDS, Welfare.
 */
async function populateMessengerReportDropdown() {
    const select = document.getElementById('messengerReportSelect');
    if (!select) return;

    try {
        const schemes = ['nfsa', 'nfsa_daterange', 'mdm', 'icds', 'welfare'];
        const allReports = [];

        await Promise.allSettled(schemes.map(async scheme => {
            try {
                const res = await fetch(`api/reports?scheme=${scheme}`);
                if (!res.ok) return;
                const reports = await res.json();
                reports.forEach(r => allReports.push(r));
            } catch(e) { /* skip failed scheme */ }
        }));

        // Sort by generated_at descending (newest first)
        allReports.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));

        const currentVal = select.value;
        const schemeEmoji = { nfsa: '📊', nfsa_daterange: '📅', mdm: '🥣', icds: '👶', welfare: '🎓' };

        select.innerHTML = '<option value="">-- Choose a report --</option>' +
            allReports.map(r => {
                const dateObj = new Date(r.generated_at);
                const isValid = !isNaN(dateObj.getTime());
                const dateStr = isValid ? formatDateToDMY(r.generated_at) : '';
                const timeStr = isValid ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const ts = isValid ? ` (${dateStr} ${timeStr})` : '';
                const emoji = schemeEmoji[r.scheme] || '📋';
                const schemeLabel = (r.scheme === 'nfsa_daterange' ? 'NFSA DR' : (r.scheme || 'NFSA').toUpperCase());
                const periodLabel = r.from_date && r.to_date
                    ? `${r.from_date} – ${r.to_date}`
                    : `${getMonthName(r.month)} ${r.year}`;
                return `<option value="${r.id}" ${r.id == currentVal ? 'selected' : ''}>${emoji} ${schemeLabel} - ${periodLabel}${ts}</option>`;
            }).join('');

        // If previously selected value still exists, keep it and reload
        if (currentVal && allReports.some(r => r.id == currentVal)) {
            select.value = currentVal;
        }
    } catch (e) {
        console.error('Error populating messenger dropdown:', e);
    }
}

async function loadMessengerTransporters() {
    const reportId = document.getElementById('messengerReportSelect').value;
    if (!reportId) return;

    const listContainer = document.getElementById('messengerTransporterList');
    listContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading-spinner"></div><p>Analyzing transporters...</p></div>';

    // Show/hide threshold input based on filter mode
    const filterMode = document.getElementById('messengerFilterMode') ? document.getElementById('messengerFilterMode').value : 'dispatch';
    const thresholdGroup = document.getElementById('messengerDiffThresholdGroup');
    if (thresholdGroup) thresholdGroup.style.display = filterMode === 'diff' ? '' : 'none';

    try {
        const response = await fetch(`api/reports/${reportId}/analytics`);
        if (!response.ok) throw new Error('Failed to load report analytics');
        const analytics = await response.json();
        window.currentMessengerAnalytics = analytics;

        const metrics = analytics.metrics || {};
        const districtAvg = parseFloat(
            metrics.dispatchPercentage ||
            metrics.totalDispatchPct ||
            0
        );
        const districtPOS = parseFloat(metrics.totalPOSReceipt && metrics.totalAllocation > 0
            ? ((metrics.totalPOSReceipt / metrics.totalAllocation) * 100)
            : 0).toFixed(2);

        document.getElementById('messengerAvgLifting').innerText = districtAvg.toFixed(2) + '%';
        if (document.getElementById('messengerAvgPOS')) document.getElementById('messengerAvgPOS').innerText = districtPOS + '%';
        if (document.getElementById('messengerAvgDiff')) document.getElementById('messengerAvgDiff').innerText = (districtAvg - parseFloat(districtPOS)).toFixed(2) + '%';

        // Build a flat list of transporters from analytics regardless of scheme
        let transporters = [];

        if (analytics.allTransporters && analytics.allTransporters.length > 0) {
            // NFSA: has a flat allTransporters array with posReceiptPct, diffPct, posDiffQty
            transporters = analytics.allTransporters;
        } else {
            // MDM / ICDS / Welfare: extract from topTransporters + bottomTransporters items
            const seen = new Set();
            const groups = [
                ...(analytics.topTransporters || []),
                ...(analytics.bottomTransporters || [])
            ];
            groups.forEach(g => {
                const items = g.items || [];
                if (items.length === 0 && g.name) {
                    const key = g.name;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const dSum = parseFloat(g.dispatchSum || g.dispatch || 0);
                        const pSum = parseFloat(g.posReceiptSum || g.posReceipt || 0);
                        const pDiff = g.posDiffQty !== undefined ? parseFloat(g.posDiffQty) : Math.max(0, parseFloat((dSum - pSum).toFixed(2)));
                        transporters.push({
                            name: g.name,
                            avgDispatch: parseFloat(g.dispatchPct || g.avgDispatch || 0),
                            dispatchPct: parseFloat(g.dispatchPct || g.avgDispatch || 0),
                            posReceiptPct: parseFloat(g.posReceiptPct || 0),
                            diffPct: parseFloat(g.diffPct || 0),
                            sectorCount: g.sectorCount || 1,
                            balance: g.balance || '0.00',
                            posDiffQty: pDiff,
                            dispatchSum: dSum,
                            posReceiptSum: pSum
                        });
                    }
                } else {
                    items.forEach(t => {
                        const key = t.name;
                        if (!seen.has(key)) {
                            seen.add(key);
                            transporters.push(t);
                        }
                    });
                }
            });
        }

        // Apply filter based on selected mode
        const diffThreshold = parseFloat((document.getElementById('messengerDiffThreshold') || {}).value || 5);
        if (filterMode === 'dispatch') {
            transporters = transporters.filter(t => {
                const rate = parseFloat(t.avgDispatch !== undefined ? t.avgDispatch : (t.dispatchPct || 0));
                return rate < districtAvg;
            });
        } else if (filterMode === 'diff') {
            transporters = transporters.filter(t => {
                const diff = parseFloat(t.diffPct !== undefined ? t.diffPct : 0);
                return diff > diffThreshold;
            });
        }
        // 'all' shows everything

        if (transporters.length === 0) {
            const modeLabel = filterMode === 'diff'
                ? `कोई सेक्टर नहीं जहाँ POS अंतर >${diffThreshold}% हो ✅`
                : 'No transporters below average! ✅';
            listContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #475569;"><p>${modeLabel}</p></div>`;
            return;
        }
        renderMessengerTransporterList(transporters, districtAvg, filterMode);
        updateMessengerPreview();
    } catch (error) {
        console.error('Messenger load error:', error);
        listContainer.innerHTML = '<div class="alert alert-error">Failed to load transporters.</div>';
    }
}

function renderMessengerTransporterList(transporters, districtAvg, filterMode) {
    const listContainer = document.getElementById('messengerTransporterList');
    listContainer.innerHTML = '';
    const isDiffMode = filterMode === 'diff';

    // Sort: diff mode → by diffPct desc; dispatch mode → by dispatchPct asc
    transporters.sort((a, b) => {
        if (isDiffMode) {
            return (parseFloat(b.diffPct) || 0) - (parseFloat(a.diffPct) || 0);
        }
        const rateA = parseFloat(a.avgDispatch !== undefined ? a.avgDispatch : (a.dispatchPct || 0));
        const rateB = parseFloat(b.avgDispatch !== undefined ? b.avgDispatch : (b.dispatchPct || 0));
        return rateA - rateB;
    });

    transporters.forEach(t => {
        const rate = parseFloat(t.avgDispatch !== undefined ? t.avgDispatch : (t.dispatchPct || 0));
        const posRate = parseFloat(t.posReceiptPct !== undefined ? t.posReceiptPct : 0);
        const diff = parseFloat(t.diffPct !== undefined ? t.diffPct : (rate - posRate));
        const isBelow = rate < districtAvg;
        const isHighLag = diff > 5;
        const balance = t.balance !== undefined && t.balance !== null ? t.balance : 'N/A';
        const sectorCount = t.sectorCount !== undefined ? t.sectorCount : '-';

        // Calculate POS difference quantity (quantity dispatched - quantity received on POS)
        let posDiffQty = 0;
        if (t.posDiffQty !== undefined && t.posDiffQty !== null) {
            posDiffQty = parseFloat(t.posDiffQty);
        } else if (t.dispatchSum !== undefined && t.posReceiptSum !== undefined) {
            posDiffQty = Math.max(0, parseFloat((t.dispatchSum - t.posReceiptSum).toFixed(2)));
        } else if (t.dispatch !== undefined && t.posReceipt !== undefined) {
            posDiffQty = Math.max(0, parseFloat((t.dispatch - t.posReceipt).toFixed(2)));
        } else if (t.allottedSum || t.allocation) {
            const alloc = parseFloat(t.allottedSum || t.allocation || 0);
            posDiffQty = Math.max(0, parseFloat((diff * alloc / 100).toFixed(2)));
        }

        // Diff color coding
        const diffColor = diff > 15 ? '#dc2626' : diff > 5 ? '#d97706' : '#059669';
        const lagBadge = diff > 0 ? `<span style="font-size:11px;font-weight:700;background:${diffColor}20;color:${diffColor};border:1px solid ${diffColor}40;border-radius:6px;padding:2px 6px;">अंतर: +${diff.toFixed(1)}%</span>` : '';

        const hasPOSData = t.posReceiptPct !== undefined;
        const metricsHtml = hasPOSData
            ? `<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:11px;color:#64748b;">उठाव: <b style="color:${pColor(rate)}">${rate.toFixed(1)}%</b></span>
                <span style="font-size:11px;color:#64748b;">POS: <b style="color:#6366f1">${posRate.toFixed(1)}%</b></span>
                ${lagBadge}
               </div>`
            : `<div style="font-size:11px;color:#475569;margin-top:2px;">${sectorCount} Sectors | शेष: ${balance} Qt</div>`;

        const row = document.createElement('div');
        row.className = 'messenger-row';
        const rowBg = isDiffMode && isHighLag ? 'rgba(239,68,68,0.04)' : (isBelow ? 'rgba(239,68,68,0.02)' : 'transparent');
        row.style = `display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f1f5f9;cursor:pointer;background:${rowBg};`;
        row.innerHTML = `
            <input type="checkbox" class="messenger-check"
                data-name="${escapeHtml(t.name)}"
                data-rate="${rate.toFixed(2)}"
                data-pos="${posRate.toFixed(2)}"
                data-diff="${diff.toFixed(2)}"
                data-bal="${balance}"
                data-pos-diff-qty="${posDiffQty.toFixed(2)}"
                ${isDiffMode && isHighLag ? 'checked' : (!isDiffMode && isBelow ? 'checked' : '')}
                style="width:18px;height:18px;accent-color:#075e54;flex-shrink:0;"
                onchange="updateMessengerPreview()">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <span style="font-weight:600;font-size:13px;white-space:normal;line-height:1.3;">${escapeHtml(t.name)}</span>
                    <span style="font-weight:800;font-size:13px;color:${pColor(rate)};flex-shrink:0;">${rate.toFixed(1)}%</span>
                </div>
                ${metricsHtml}
            </div>`;
        row.onclick = (e) => { if (e.target.type !== 'checkbox') { const cb = row.querySelector('.messenger-check'); cb.checked = !cb.checked; updateMessengerPreview(); } };
        listContainer.appendChild(row);
    });
}

function updateMessengerPreview() {
    const analytics = window.currentMessengerAnalytics;
    if (!analytics) return;
    const selectedChecks = document.querySelectorAll('.messenger-check:checked');
    document.getElementById('messengerSelectedCount').innerText = selectedChecks.length;
    const preview = document.getElementById('messengerTextPreview');
    if (selectedChecks.length === 0) { preview.innerText = 'Select transporters to preview message...'; return; }
    const templateIndex = parseInt(document.getElementById('messengerTemplateSelect').value) || 0;
    const template = MESSAGE_TEMPLATES[templateIndex];
    const metrics = analytics.metrics || {};
    const districtAvg = parseFloat(metrics.dispatchPercentage || metrics.totalDispatchPct || 0).toFixed(2);
    const districtPOSAvg = metrics.totalPOSReceipt && metrics.totalAllocation > 0
        ? ((metrics.totalPOSReceipt / metrics.totalAllocation) * 100).toFixed(2)
        : '—';
    const districtDiff = (parseFloat(districtAvg) - parseFloat(districtPOSAvg === '—' ? 0 : districtPOSAvg)).toFixed(2);

    let period = 'Month';
    const reportSelect = document.getElementById('messengerReportSelect');
    const selectedOption = reportSelect.options[reportSelect.selectedIndex];
    if (selectedOption) {
        const rawPeriod = selectedOption.text.split(' - ')[1] || 'Month';
        period = rawPeriod.replace(/\s*\(.*\)/, '').trim();
    }

    const isDiffTemplate = templateIndex >= 4;
    let checksArr = Array.from(selectedChecks);

    // For POS difference templates: exclude sectors with diff ≤ 0% from the message
    if (isDiffTemplate) {
        checksArr = checksArr.filter(cb => parseFloat(cb.getAttribute('data-diff') || 0) > 0);
    }

    if (checksArr.length === 0) {
        preview.innerText = 'चुने गए सेक्टरों में POS अंतर 0% है। कृपया अन्य सेक्टर चुनें।';
        return;
    }

    // Build list string—include POS & diff data for diff templates; renumber from 1
    const listString = checksArr.map((cb, index) => {
        const name = cb.getAttribute('data-name');
        const rate = cb.getAttribute('data-rate');
        const pos = cb.getAttribute('data-pos');
        const diff = cb.getAttribute('data-diff');
        const bal = cb.getAttribute('data-bal');
        const posDiffQty = cb.getAttribute('data-pos-diff-qty') || cb.getAttribute('data-bal');
        if (isDiffTemplate && pos && diff) {
            return `${index + 1}. *${name}*\n   उठाव: ${rate}% | POS प्राप्ति: ${pos}% | अंतर: *+${diff}%*\n   शेष मात्रा: ${posDiffQty} Qt`;
        }
        return `${index + 1}. *${name}:* ${rate}% (शेष मात्रा: ${bal} Qt)`;
    }).join('\n');

    // Update Avg अंतर & POS cards (based on actually included checks)
    const avgSelectedDiff = checksArr.length > 0 ? (checksArr.reduce((s, cb) => s + (parseFloat(cb.getAttribute('data-diff')) || 0), 0) / checksArr.length).toFixed(2) : '0.00';
    const avgSelectedPOS  = checksArr.length > 0 ? (checksArr.reduce((s, cb) => s + (parseFloat(cb.getAttribute('data-pos'))  || 0), 0) / checksArr.length).toFixed(2) : '0.00';
    if (document.getElementById('messengerAvgDiff')) document.getElementById('messengerAvgDiff').innerText = avgSelectedDiff + '%';
    if (document.getElementById('messengerAvgPOS'))  document.getElementById('messengerAvgPOS').innerText  = avgSelectedPOS + '%';

    preview.innerText = template.text(districtAvg, listString, period, districtPOSAvg, districtDiff);
}

function selectAllTransporters(checked) {
    const filterMode = document.getElementById('messengerFilterMode') ? document.getElementById('messengerFilterMode').value : 'dispatch';
    const templateIndex = parseInt((document.getElementById('messengerTemplateSelect') || {}).value || 0);
    const isDiffContext = filterMode === 'diff' || templateIndex >= 4;
    document.querySelectorAll('.messenger-check').forEach(cb => {
        if (checked && isDiffContext) {
            // In diff mode, "✓ All" only selects sectors with actual diff > 0
            cb.checked = parseFloat(cb.getAttribute('data-diff') || 0) > 0;
        } else {
            cb.checked = checked;
        }
    });
    updateMessengerPreview();
}

function sendMessengerWhatsApp() {
    const preview = document.getElementById('messengerTextPreview').innerText;
    if (preview.includes('Select transporters')) return alert('Please select transporters.');
    window.open(`https://wa.me/?text=${encodeURIComponent(preview)}`, '_blank');
}

function copyMessengerToClipboard() {
    const preview = document.getElementById('messengerTextPreview').innerText;
    copyTextToClipboard(preview, document.getElementById('messengerCopyBtn'), '📋 Copy All');
}

/**
 * Core Generation Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[v3.3] Initializing Dashboard...');
    const init = async () => {
        try {
            await Promise.allSettled([loadReports(), loadDaterangeReports(), loadStats(), loadMDMReports(), loadICDSReports(), loadWelfareReports()]);
        } catch (e) { console.error('Init error:', e); }
    };
    init();

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    ['year', 'drYear', 'mdmYear', 'icdsYear', 'welfareYear'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = currentYear.toString(); });
    ['month', 'drMonth', 'mdmMonth', 'icdsMonth', 'welfareMonth'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = currentMonth.toString(); });

    const forms = [
        { id: 'generateForm', handler: handleGenerateReport },
        { id: 'generateDateRangeForm', handler: handleGenerateDateRangeReport },
        { id: 'mdmGenerateForm', handler: handleMDMGenerateReport },
        { id: 'icdsGenerateForm', handler: handleICDSGenerateReport },
        { id: 'welfareGenerateForm', handler: handleWelfareGenerateReport }
    ];
    forms.forEach(f => { if (document.getElementById(f.id)) document.getElementById(f.id).addEventListener('submit', f.handler); });

    if (typeof flatpickr !== 'undefined') flatpickr(".date-picker", { dateFormat: "d/m/Y", allowInput: true });
    setInterval(() => { if (!currentRequestId) refreshAllReportsSilent(); }, 30000);
    setTimeout(() => switchScheme('nfsa'), 50);
});

async function handleGenerateReport(e) {
    e.preventDefault();
    const month = document.getElementById('month').value;
    const year = document.getElementById('year').value;
    lastParams = { month: parseInt(month), year: parseInt(year), scheme: 'nfsa', mode: 'monthly' };
    currentScheme = 'nfsa'; currentReportMode = 'monthly'; hideAllMessages(); showProgress();
    const btn = document.getElementById('generateBtn');
    btn.disabled = true; btn.innerHTML = '⏳ Starting...';
    try {
        const response = await fetch('api/generate-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: parseInt(month), year: parseInt(year) }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        currentRequestId = data.requestId;
        startTime = Date.now(); startTimer(); startPolling();
    } catch (error) { showError(error.message); resetForm(); }
}

async function handleGenerateDateRangeReport(e) {
    e.preventDefault();
    const month = document.getElementById('drMonth').value;
    const year = document.getElementById('drYear').value;
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    currentScheme = 'nfsa'; currentReportMode = 'daterange'; currentDRDates = { from: fromDate, to: toDate };
    hideAllMessages(); showProgress();
    try {
        const response = await fetch('api/generate-nfsa-daterange-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: parseInt(month), year: parseInt(year), fromDate, toDate }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        currentRequestId = data.requestId;
        startTime = Date.now(); startTimer(); startPolling();
    } catch (error) { showError(error.message); resetForm(); }
}

async function handleMDMGenerateReport(e) {
    e.preventDefault();
    const m = document.getElementById('mdmMonth').value; const y = document.getElementById('mdmYear').value;
    currentScheme = 'mdm'; hideAllMessages(); showProgress();
    try {
        const response = await fetch('api/generate-mdm-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: parseInt(m), year: parseInt(y) }) });
        const data = await response.json();
        currentRequestId = data.requestId;
        startTime = Date.now(); startTimer(); startPolling();
    } catch (e) { showError(e.message); resetForm(); }
}

async function handleICDSGenerateReport(e) {
    e.preventDefault();
    const m = document.getElementById('icdsMonth').value; const y = document.getElementById('icdsYear').value;
    currentScheme = 'icds'; hideAllMessages(); showProgress();
    try {
        const response = await fetch('api/generate-icds-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: parseInt(m), year: parseInt(y) }) });
        const data = await response.json();
        currentRequestId = data.requestId;
        startTime = Date.now(); startTimer(); startPolling();
    } catch (e) { showError(e.message); resetForm(); }
}

async function handleWelfareGenerateReport(e) {
    e.preventDefault();
    const m = document.getElementById('welfareMonth').value; const y = document.getElementById('welfareYear').value;
    currentScheme = 'welfare'; hideAllMessages(); showProgress();
    try {
        const response = await fetch('api/generate-welfare-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: parseInt(m), year: parseInt(y) }) });
        const data = await response.json();
        currentRequestId = data.requestId;
        startTime = Date.now(); startTimer(); startPolling();
    } catch (e) { showError(e.message); resetForm(); }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        try {
            let endpoint = `api/generate-status/${currentRequestId}`;
            if (currentScheme !== 'nfsa') endpoint = `api/generate-${currentScheme}-status/${currentRequestId}`;
            
            const res = await fetch(endpoint);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                if (res.status === 404) {
                    clearInterval(pollingInterval);
                    showError("Report generation session lost (Server may have restarted). Please try again.");
                    resetForm();
                }
                return;
            }

            const data = await res.json();
            if (data) {
                updateProgress(data.status || 'processing', data.progress || 0, data.message || data.status);

                // Manual CAPTCHA Trigger (For Cloud / Render or local fallback)
                if (data.status === 'captcha_required' || data.captchaImage) {
                    openManualCaptchaModal(data.captchaImage, currentRequestId, data.message);
                } else if (data.status !== 'initializing') {
                    closeManualCaptchaModal();
                }

                if (data.status === 'complete') { 
                    clearInterval(pollingInterval); 
                    closeManualCaptchaModal();
                    showSuccess(data); 
                    refreshAllReportsSilent(); 
                    resetForm(); 
                }
                else if (data.status === 'error') { 
                    clearInterval(pollingInterval); 
                    closeManualCaptchaModal();
                    showError(data.error || 'Extraction failed'); 
                    resetForm(); 
                }
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    }, 1500);
}

function updateProgress(status, progress, message) {
    const prefix = currentScheme === 'nfsa' ? 'progress' : `${currentScheme}Progress`;
    const p = Math.round(progress || 0);
    
    if (document.getElementById(`${prefix}Status`)) {
        document.getElementById(`${prefix}Status`).innerText = status || 'Processing...';
    }
    if (document.getElementById(`${prefix}Percent`)) {
        document.getElementById(`${prefix}Percent`).innerText = `${p}%`;
    }
    if (document.getElementById(`${prefix}Fill`)) {
        document.getElementById(`${prefix}Fill`).style.width = `${p}%`;
    }
    if (document.getElementById(`${prefix}Detail`)) {
        document.getElementById(`${prefix}Detail`).innerText = message || status || 'Updating...';
    }
}

function showSuccess(data) {
    hideProgress();
    const prefix = currentScheme === 'nfsa' ? '' : currentScheme;
    
    const msg = document.getElementById(prefix ? `${prefix}SuccessMessage` : 'successMessage');
    const detail = document.getElementById(prefix ? `${prefix}SuccessDetail` : 'successDetail');
    const timeText = document.getElementById(prefix ? `${prefix}GenerationTimeText` : 'generationTimeText');
    const link = document.getElementById(prefix ? `${prefix}DownloadLink` : 'downloadLink');

    if (link && data.report) {
        link.href = data.report.downloadUrl;
        link.download = data.report.filename;
        
        // Prompt user to download report
        setTimeout(() => {
            const confirmDownload = confirm("Report generated successfully! Would you like to download the Excel report?");
            if (confirmDownload) {
                link.click();
            }
        }, 500);
    }

    if (msg) msg.style.display = 'flex';

    // Render Advanced Analytics button on success card for NFSA Monthly reports
    const advBtnContainer = document.getElementById('advAnalyticsSuccessBtnContainer');
    if (advBtnContainer) {
        const reportId = data.report ? data.report.id : null;
        if (currentScheme === 'nfsa' && currentReportMode === 'monthly' && reportId) {
            advBtnContainer.style.display = 'block';
            advBtnContainer.innerHTML = `
                <button class="btn btn-sm" onclick="showAdvancedAnalyticsModal('${reportId}')" style="background:linear-gradient(135deg,#0b2545,#1e3a8a);color:#fff;border:none;cursor:pointer;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;">
                    📊 उन्नत विश्लेषण / Advanced Analytics
                </button>
            `;
        } else {
            advBtnContainer.style.display = 'none';
        }
    }

    const timeVal = data.generationTime || (startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
    const mins = Math.floor(timeVal / 60);
    const secs = timeVal % 60;
    const formattedTime = (mins > 0 ? mins + "m " : "") + secs + "s";

    if (detail) {
        detail.innerHTML = "Report Generated in <strong>" + formattedTime + "</strong>!";
    }
    if (timeText) {
        timeText.textContent = "Generated in " + formattedTime;
    }

    if (data.analytics) {
        const reportId = data.report ? data.report.id : null;
        window.currentReportAnalytics = { 
            ...data.analytics, 
            id: reportId,
            month: data.report ? data.report.month : (data.analytics.month || null), 
            year: data.report ? data.report.year : (data.analytics.year || null),
            scheme: currentScheme,
            fromDate: data.report ? data.report.from_date : (data.analytics.fromDate || (currentDRDates ? currentDRDates.from : null)),
            toDate: data.report ? data.report.to_date : (data.analytics.toDate || (currentDRDates ? currentDRDates.to : null))
        };
        // Initialize balance report controls on successful generation
        if (reportId && ['nfsa', 'mdm', 'icds', 'welfare'].includes(currentScheme)) {
            initBalanceReportControls(reportId, currentScheme);
        }
        if (currentScheme === 'nfsa') {
            if (currentReportMode === 'daterange') {
                displayNfsaDaterangeAnalytics(data.analytics, data.generationTime);
            } else {
                displayAnalytics(data.analytics, data.generationTime);
            }
        }
        else if (window[`display${currentScheme.toUpperCase()}Analytics`]) window[`display${currentScheme.toUpperCase()}Analytics`](data.analytics, null, data.generationTime);
    }
}

function showError(msg) {
    hideProgress();
    const prefix = currentScheme === 'nfsa' ? '' : currentScheme;
    const box = document.getElementById(prefix ? `${prefix}ErrorMessage` : 'errorMessage');
    const text = document.getElementById(prefix ? `${prefix}ErrorText` : 'errorText');
    
    const isNoDataError = msg && (msg.includes('NO_DATA') || msg.toLowerCase().includes('no data found on portal'));

    if (box && text) {
        if (isNoDataError) {
            const cleanMsg = msg.replace(/^NO_DATA:\s*/i, '').trim();
            text.innerText = cleanMsg;
            box.classList.remove('alert-error');
            box.classList.add('alert-warning');
            const icon = box.querySelector('.alert-icon');
            if(icon) icon.innerText = '⚠️';
            const title = box.querySelector('strong');
            if(title) title.innerText = 'No Data Published';
        } else {
            text.innerText = msg || 'An unknown error occurred during report generation.';
            box.classList.remove('alert-warning');
            box.classList.add('alert-error');
            const icon = box.querySelector('.alert-icon');
            if(icon) icon.innerText = '❌';
            const title = box.querySelector('strong');
            if(title) title.innerText = 'Error';
        }
        box.style.display = 'flex';
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        if (isNoDataError) {
            alert('Notice: ' + msg.replace(/^NO_DATA:\s*/i, '').trim());
        } else {
            alert('Error: ' + msg);
        }
    }
}

function resetForm() {
    const schemes = ['nfsa', 'mdm', 'icds', 'welfare'];
    schemes.forEach(s => {
        const btnId = (s === 'nfsa') ? 'generateBtn' : (s + 'GenerateBtn');
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = false;
            const icons = { nfsa: '🚀', mdm: '🥣', icds: '👶', welfare: '🎓' };
            btn.innerHTML = '<span class="btn-icon">' + (icons[s] || '🚀') + '</span> Generate Report';
        }
    });
}


/**
 * Analytics Displays
 */
function displayAnalytics(analytics, genTime) {
    document.getElementById('analyticsSection').style.display = 'block';
    const metrics = analytics.metrics || {};
    
    // Summary metrics
    document.getElementById('metricsGrid').innerHTML = `
        <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">📦</div><div class="stat-content"><div class="stat-label">Dispatch</div><div class="stat-value">${(metrics.dispatchPercentage || 0).toFixed(2)}%</div></div></div>
        <div class="stat-card" onclick="toggleShopsLeftDetails()"><div class="stat-icon">🏪</div><div class="stat-content"><div class="stat-label">Pending</div><div class="stat-value">${metrics.totalShopsLeft || metrics.totalPendingShops || 0}</div></div></div>
    `;

    // Compute and Render 3-Column Executive Summary Strip in Web UI
    const allSectors = analytics.allSectors || analytics.sectors || [];
    const tAlloc = parseFloat(metrics.totalAllocation || 0);
    const tDisp = parseFloat(metrics.totalDispatch || 0);
    const tRec = parseFloat(metrics.totalPOSReceipt || 0);
    const tBal = Math.max(0, tAlloc - tDisp);
    const inTransit = Math.max(0, tDisp - tRec);
    const inTransitPct = tAlloc > 0 ? ((inTransit / tAlloc) * 100).toFixed(2) : '0.00';

    const now = new Date();
    const rMonth = parseInt(analytics.month || (window.currentReportAnalytics && window.currentReportAnalytics.month) || (now.getMonth() + 1), 10);
    const rYear = parseInt(analytics.year || (window.currentReportAnalytics && window.currentReportAnalytics.year) || now.getFullYear(), 10);
    const daysInMonth = new Date(rYear, rMonth, 0).getDate();
    let remainingDays = 1;
    if (now.getFullYear() === rYear && (now.getMonth() + 1) === rMonth) {
        remainingDays = Math.max(1, daysInMonth - now.getDate());
    } else if (new Date(rYear, rMonth - 1, 1) > now) {
        remainingDays = daysInMonth;
    }
    const requiredDailyRate = (tBal > 0 && remainingDays > 0) ? (tBal / remainingDays).toFixed(2) : '0.00';

    let sectorsInSync = 0;
    let sectorsHighLag = 0;
    let sectorsCompleted = 0;

    allSectors.forEach(s => {
        const dPct = parseFloat(s.dispatchPercentage || 0);
        const rPct = parseFloat(s.receivingPercentage || s.receiptPercentage || 0);
        const diff = dPct - rPct;
        if (dPct >= 100) sectorsCompleted++;
        if (diff > 5) sectorsHighLag++;
        else if (diff >= 0 && diff <= 5) sectorsInSync++;
    });

    const sorted = [...allSectors].sort((a, b) => (parseFloat(b.dispatchPercentage || 0)) - (parseFloat(a.dispatchPercentage || 0)));
    const topSec = sorted[0];
    const botSec = sorted[sorted.length - 1];

    let summaryStripEl = document.getElementById('nfsaExecutiveSummaryStrip');
    if (!summaryStripEl) {
        summaryStripEl = document.createElement('div');
        summaryStripEl.id = 'nfsaExecutiveSummaryStrip';
        const metricsGridEl = document.getElementById('metricsGrid');
        if (metricsGridEl && metricsGridEl.parentNode) {
            metricsGridEl.parentNode.insertBefore(summaryStripEl, metricsGridEl.nextSibling);
        }
    }

    if (summaryStripEl) {
        summaryStripEl.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; margin: 18px 0 20px 0;">
                <div style="background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.25); border-radius:10px; padding:12px 14px;">
                    <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:8px; display:flex; align-items:center; gap:6px;">📈 उठाव प्रगति एवं दैनिक लक्ष्य दर</div>
                    <div style="font-size:12px; color:var(--text-muted); line-height:1.6;">
                        <div>• कुल उठाव: <b style="color:var(--text-main);">${(metrics.dispatchPercentage || 0).toFixed(2)}%</b> (शेष: <b style="color:var(--text-main);">${tBal.toFixed(2)} Qt.</b>)</div>
                        <div>• 100% लक्ष्य हेतु दैनिक दर: <b style="color:var(--primary);">${requiredDailyRate} Qt./दिन</b> (शेष दिन: ${remainingDays})</div>
                        <div>• पूर्ण उठाव सेक्टर: <b style="color:var(--success);">${sectorsCompleted}/${allSectors.length}</b></div>
                    </div>
                </div>
                <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.25); border-radius:10px; padding:12px 14px;">
                    <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:8px; display:flex; align-items:center; gap:6px;">🚚 मार्गस्थ एवं POS प्रविष्टि स्थिति</div>
                    <div style="font-size:12px; color:var(--text-muted); line-height:1.6;">
                        <div>• मार्गस्थ / प्रविष्टि शेष: <b style="color:var(--text-main);">${inTransit.toFixed(2)} Qt.</b> (${inTransitPct}%)</div>
                        <div>• POS मशीन प्राप्ति: <b style="color:var(--text-main);">${(parseFloat(metrics.receiptPercentage || 0)).toFixed(2)}%</b> | इन-सिंक: <b>${sectorsInSync}/${allSectors.length}</b></div>
                        <div>• उच्च विलंब (>5% Lag): <b style="color:${sectorsHighLag > 0 ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)'};">${sectorsHighLag} सेक्टर</b> ${sectorsHighLag > 0 ? '(समीक्षा अपेक्षित)' : '(संतोषजनक)'}</div>
                    </div>
                </div>
                <div style="background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:12px 14px;">
                    <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:8px; display:flex; align-items:center; gap:6px;">🎯 सेक्टर समीक्षा एवं निगरानी अलर्ट</div>
                    <div style="font-size:12px; color:var(--text-muted); line-height:1.6;">
                        <div>• सर्वोत्तम उठाव: <b style="color:var(--text-main);">${topSec ? `${escapeHtml(topSec.name)} (${parseFloat(topSec.dispatchPercentage || 0).toFixed(2)}%)` : 'N/A'}</b></div>
                        <div>• न्यूनतम उठाव: <b style="color:var(--text-main);">${botSec ? `${escapeHtml(botSec.name)} (${parseFloat(botSec.dispatchPercentage || 0).toFixed(2)}%)` : 'N/A'}</b></div>
                        <div>• परिवहनकर्ता निगरानी: <b style="color:var(--text-main);">${botSec && botSec.transporter ? escapeHtml(botSec.transporter) : 'N/A'}</b></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Transporters
    renderPerformerList('topTransportersList', analytics.topTransporters, true);
    renderPerformerList('bottomTransportersList', analytics.bottomTransporters, false);
    
    if (document.getElementById('transporterSection')) document.getElementById('transporterSection').style.display = 'block';

    // AI Insights Restored
    if (analytics.insights) {
        renderInsightsList('insightsList', analytics.insights, analytics.topTransporters, analytics.bottomTransporters);
        document.getElementById('insightsSection').style.display = 'block';
    }
}

function renderInsightsList(id, insights, topTransporters = [], bottomTransporters = []) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let displayInsights = [...(insights || [])];

    const isDateRange = (id === 'drInsightsList') || 
                        (topTransporters && topTransporters.length > 0 && topTransporters[0].dispatchQty !== undefined) ||
                        (bottomTransporters && bottomTransporters.length > 0 && bottomTransporters[0].dispatchQty !== undefined);

    if (topTransporters && topTransporters.length > 0) {
        if (isDateRange) {
            displayInsights.push({
                icon: '🏆', 
                severity: 'success', 
                message: `🏆 शीर्ष परिवहनकर्ता (दिनांक अनुसार कुल उठाव मात्रा): ${topTransporters.map(t => {
                    const qty = t.dispatchQty !== undefined ? parseFloat(t.dispatchQty).toFixed(2) : parseFloat(t.dispatchPercentage || 0).toFixed(2);
                    return `${escapeHtml(t.name || t.sectorName || 'N/A')} (${qty} Qt)`;
                }).join(', ')}`
            });
        } else {
            displayInsights.push({
                icon: '🏆', 
                severity: 'success', 
                message: `🏆 शीर्ष प्रदर्शनकर्ता (Dispatch % के अनुसार): ${topTransporters.map(t => {
                    const pct = t.dispatchPct || t.avgDispatch || t.dispatchPercentage || 0;
                    return `${escapeHtml(t.name || t.sectorName || 'N/A')} (${pct}%)`;
                }).join(', ')}`
            });
        }
    }

    if (bottomTransporters && bottomTransporters.length > 0) {
        const topNames = (topTransporters || []).map(t => (t.name || t.sectorName || '').trim()).sort().join('|');
        const bottomNames = bottomTransporters.map(t => (t.name || t.sectorName || '').trim()).sort().join('|');

        if (!topNames || topNames !== bottomNames) {
            if (isDateRange) {
                displayInsights.push({
                    icon: '⚠️', 
                    severity: 'warning', 
                    message: `⚠️ न्यूनतम / शून्य उठाव परिवहनकर्ता (कुल उठाव मात्रा): ${bottomTransporters.map(t => {
                        const qty = t.dispatchQty !== undefined ? parseFloat(t.dispatchQty).toFixed(2) : parseFloat(t.dispatchPercentage || 0).toFixed(2);
                        return `${escapeHtml(t.name || t.sectorName || 'N/A')} (${qty} Qt)`;
                    }).join(', ')}`
                });
            } else {
                displayInsights.push({
                    icon: '⚠️', 
                    severity: 'warning', 
                    message: `⚠️ कम प्रदर्शनकर्ता (Dispatch % के अनुसार): ${bottomTransporters.map(t => {
                        const pct = t.dispatchPct || t.avgDispatch || t.dispatchPercentage || 0;
                        return `${escapeHtml(t.name || t.sectorName || 'N/A')} (${pct}%)`;
                    }).join(', ')}`
                });
            }
        }
    }

    if (displayInsights.length === 0) {
        el.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">No specific insights for this period.</div>';
        return;
    }
    el.innerHTML = displayInsights.map(ins => `
        <div class="insight-item ${ins.severity || 'info'}">
            <div class="insight-icon">${ins.icon || '🤖'}</div>
            <div class="insight-content">
                <div class="insight-message">${ins.message}</div>
                ${ins.details ? `<div class="insight-details">${ins.details.join(', ')}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function renderPerformerList(id, list, isTop) {
    const el = document.getElementById(id);
    if (!el || !list) return;

    // 1. Group items by percentage to handle cases where backend might send raw list
    const groups = {};
    list.forEach(item => {
        // Handle various property names used across schemes
        const pctVal = item.dispatchPercentage !== undefined ? item.dispatchPercentage : (item.dispatchPct || 0);
        const pct = parseFloat(pctVal).toFixed(2);
        
        if (!groups[pct]) {
            groups[pct] = {
                pct: pct,
                items: []
            };
        }
        groups[pct].items.push(item);
    });

    // 2. Sort groups by percentage
    const sortedGroups = Object.values(groups).sort((a, b) => {
        return isTop ? b.pct - a.pct : a.pct - b.pct;
    });

    // 3. Take limit groups and render
    const limit = isTop ? 5 : 10;
    const top5Groups = sortedGroups.slice(0, limit);
    
    if (top5Groups.length === 0) {
        el.innerHTML = '<div class="text-muted" style="font-size:12px;text-align:center;padding:10px;">No performance data available</div>';
        return;
    }

    el.innerHTML = top5Groups.map((group, idx) => {
        const maxNames = 5;
        let namesArr = [];
        
        // Extract individual names from group items
        group.items.forEach(item => {
            if (item.items && Array.isArray(item.items)) {
                // Handle new 'items' array passed from backend
                namesArr = namesArr.concat(item.items.map(i => i.name || i.sectorName));
            } else {
                // Fallback for older backend versions or joined strings
                const splitNames = (item.name || '').split(',').map(s => s.trim()).filter(s => s);
                namesArr = namesArr.concat(splitNames);
            }
        });
        
        // Remove duplicates if any
        namesArr = [...new Set(namesArr)];

        const totalNames = namesArr.length;
        let namesDisplay = "";
        
        if (totalNames > maxNames) {
            const truncated = namesArr.slice(0, maxNames).map(n => escapeHtml(n)).join(', ');
            const full = namesArr.map(n => escapeHtml(n)).join(', ');
            namesDisplay = `
                <span class="names-wrapper">
                    <span class="truncated-names">${truncated}</span>
                    <span class="full-names" style="display:none;">${full}</span>
                    <span class="more-link" style="color:#2563eb; cursor:pointer; font-style:italic; font-size:11px; margin-left:4px; font-weight:600;" 
                          onclick="togglePerformerNames(this)" data-count="${totalNames - maxNames}">
                        (+ ${totalNames - maxNames} more)
                    </span>
                </span>`;
        } else {
            namesDisplay = namesArr.map(n => escapeHtml(n)).join(', ');
        }
        
        // Use quantity if available (for Top Performers in DR), otherwise show percentage
        const firstItem = group.items[0];
        const displayValue = firstItem.dispatchQty !== undefined 
            ? `${parseFloat(firstItem.dispatchQty).toFixed(2)} Qt.` 
            : `${group.pct}%`;
            
        // Calculate total sectors in this group
        const totalSectors = group.items.reduce((sum, item) => sum + (item.sectorCount || 1), 0);
        const sectorSuffix = totalSectors > 1 ? ` <span style="color:var(--text-muted); font-size:11px;">(${totalSectors} Sectors)</span>` : '';

        return `
            <div class="messenger-row" style="padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                    <span style="font-size:13px; line-height:1.4;">
                        <strong style="color:var(--text-muted); font-size:11px; margin-right:4px;">${idx + 1}.</strong>
                        ${namesDisplay}${sectorSuffix}
                    </span>
                    <strong style="font-size:13px; color: ${isTop ? '#059669' : '#dc2626'}; white-space: nowrap;">${displayValue}</strong>
                </div>
            </div>`;
    }).join('');
}

/**
 * Toggle between truncated and full names in performer lists
 */
function togglePerformerNames(btn) {
    const wrapper = btn.closest('.names-wrapper');
    if (!wrapper) return;
    
    const truncated = wrapper.querySelector('.truncated-names');
    const full = wrapper.querySelector('.full-names');
    const isExpanded = full.style.display !== 'none';
    
    if (isExpanded) {
        full.style.display = 'none';
        truncated.style.display = 'inline';
        btn.innerText = `(+ ${btn.dataset.count} more)`;
    } else {
        full.style.display = 'inline';
        truncated.style.display = 'none';
        btn.innerText = ' (show less)';
    }
}

function toggleShopsLeftDetails() {
    const scheme = (window.currentReportAnalytics && window.currentReportAnalytics.scheme) || currentScheme || 'nfsa';
    let targetScheme = scheme === 'nfsa_daterange' ? 'nfsa' : scheme;
    
    const section = document.getElementById(targetScheme === 'nfsa' ? 'shopsDetailSection' : `${targetScheme}ShopsDetailSection`);
    const listEl = document.getElementById(targetScheme === 'nfsa' ? 'shopsDetailList' : `${targetScheme}ShopsDetailList`);
    
    if (section && section.style.display === 'block') {
        section.style.display = 'none';
        return;
    }
    
    const analytics = window.currentReportAnalytics;

    // Dynamically update the section title based on report type
    const titleEl = document.getElementById(`${targetScheme}ShopsDetailTitle`) || document.getElementById('nfsaShopsDetailTitle');
    if (titleEl && analytics) {
        if (analytics.isDateRange || analytics.fromDate) {
            const from = analytics.fromDate || '';
            const to = analytics.toDate || '';
            titleEl.textContent = from && to && from !== to
                ? `🏪 Pending Sector Details (${from} to ${to})`
                : `🏪 Pending Sector Details (${from || 'Date Range'})`;
        } else if (analytics.month) {
            const monthName = getMonthName(analytics.month);
            titleEl.textContent = `🏪 Pending Sector Details for Month of ${monthName}`;
        }
    }

    // Primary: shop-level detail (NFSA monthly → needsAttention, other schemes → bottomPerformers / matrix / sectors / allSectors)
    let rawData = null;
    if (analytics) {
        if (Array.isArray(analytics.needsAttention) && analytics.needsAttention.length > 0) {
            rawData = analytics.needsAttention;
        } else if (Array.isArray(analytics.allSectors) && analytics.allSectors.length > 0) {
            rawData = analytics.allSectors;
        } else if (Array.isArray(analytics.matrix) && analytics.matrix.length > 0) {
            rawData = analytics.matrix;
        } else if (Array.isArray(analytics.sectors) && analytics.sectors.length > 0) {
            rawData = analytics.sectors;
        } else if (Array.isArray(analytics.bottomPerformers) && analytics.bottomPerformers.length > 0 && (analytics.bottomPerformers[0].shops || analytics.bottomPerformers[0].pendingShops || analytics.bottomPerformers[0].icdsShops || analytics.bottomPerformers[0].mdmShops || analytics.bottomPerformers[0].welfareShops || analytics.bottomPerformers[0].shopsLeft)) {
            rawData = analytics.bottomPerformers;
        }
    }
    
    let sourceData = [];
    if (rawData && rawData.length > 0) {
        if (rawData[0].shopCode) {
            // NFSA Monthly: flat list of shops. Group by sector.
            const grouped = {};
            rawData.forEach(shop => {
                const sec = shop.sectorName || 'Unknown Sector';
                if (!grouped[sec]) grouped[sec] = { name: sec, transporter: shop.transporter, balance: 0, pendingShops: [] };
                grouped[sec].balance += (shop.balance || 0);
                grouped[sec].pendingShops.push({
                    name: shop.shopName || shop.shopCode,
                    totalBalance: shop.balance,
                    commodities: shop.commodities || {}
                });
            });
            sourceData = Object.values(grouped).map(g => ({ ...g, shopsLeft: g.pendingShops.length }));
        } else {
            // DateRange or MDM/ICDS/Welfare / matrix / sectors
            sourceData = rawData.map(s => {
                const pendingArr = s.icdsShops || s.mdmShops || s.welfareShops || s.pendingShops || (Array.isArray(s.shops) ? s.shops.filter(sh => {
                    const wA = sh.wheatAllotted || sh.allocation || 0;
                    const wD = sh.wheatDispatched || sh.dispatch || 0;
                    const rA = sh.riceAllotted || 0;
                    const rD = sh.riceDispatched || 0;
                    const sA = sh.fsaltAllotted || 0;
                    const sD = sh.fsaltDispatched || 0;
                    const bal = sh.balance !== undefined ? sh.balance : ((wA - wD) + (rA - rD) + (sA - sD));
                    return bal > 0.01;
                }) : []);

                const count = pendingArr.length > 0 ? pendingArr.length : (s.shopsLeft || s.mdmShopCount || s.icdsShopCount || s.welfareShopCount || (s.shops ? s.shops.length : 0));
                const bal = s.balance !== undefined ? s.balance : parseFloat(Math.max(0, (s.totalAllotted || s.allotted || 0) - (s.totalDispatched || s.dispatched || 0)).toFixed(2));

                return {
                    name: s.name || s.sectorName || 'Unknown',
                    transporter: s.transporter || s.transporter_name || 'N/A',
                    balance: bal,
                    shopsLeft: count,
                    pendingShops: pendingArr
                };
            });
        }
    }

    if (section && listEl) {
        section.style.display = 'block';
        
        const filteredSourceData = sourceData.filter(s => s.shopsLeft > 0 || s.balance > 0.01);

        if (filteredSourceData.length === 0) {
            listEl.innerHTML = `
                <div style="grid-column:1/-1; padding:24px; text-align:center; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:12px; color:var(--success);">
                    <div style="font-size:28px; margin-bottom:8px;">🎉</div>
                    <div style="font-size:15px; font-weight:700;">All Sectors Completed</div>
                    <div style="font-size:12px; opacity:0.8; margin-top:4px;">100% lifting completed across all sectors for this report.</div>
                </div>`;
        } else {
            listEl.innerHTML = filteredSourceData.map((s, idx) => {
                const count = s.shopsLeft;
                const bal = s.balance;
                const shops = s.pendingShops;
                
                const shopListHtml = shops.length > 0 
                    ? `<div id="shops-${idx}" class="pending-shops-container" style="display:none;">
                        <div style="font-size:14px; font-weight:800; color:var(--text-main); margin-bottom:12px;">Pending Shops / Institutes:</div>
                        ${shops.map(sh => {
                            const commList = sh.commodities ? Object.entries(sh.commodities)
                                .map(([k, v]) => {
                                    let val = 0;
                                    if (typeof v === 'number') {
                                        val = v;
                                    } else if (v && typeof v === 'object') {
                                        val = v.balance !== undefined ? parseFloat(v.balance) : parseFloat((v.allotted || 0) - (v.dispatched || 0));
                                    } else {
                                        val = parseFloat(v);
                                    }
                                    if (isNaN(val) || val <= 0.001) return null;
                                    let displayVal = Number.isInteger(val) ? val : parseFloat(val.toFixed(2));
                                    return `<span style="background:var(--primary-light); color:var(--primary); padding:2px 6px; border-radius:4px; font-size:11px; border:1px solid var(--primary); margin-right:4px; font-weight:700;">${k}: ${displayVal}</span>`;
                                })
                                .filter(Boolean)
                                .join('') : '';
                            
                            const shopBal = sh.totalBalance !== undefined ? sh.totalBalance : (sh.balance !== undefined ? sh.balance : 0);

                            return `
                            <div class="shop-item">
                                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                    <span style="color:var(--text-main); font-weight:700; font-size:15px;">${escapeHtml(sh.name || sh.shopName || sh.shopCode || 'Unknown Shop')}</span>
                                    <span style="color:var(--error); font-weight:800;">${parseFloat(shopBal).toFixed(2)} Qt</span>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                                    ${commList}
                                </div>
                            </div>`;
                        }).join('')}
                       </div>`
                    : '';

                return `
                <div class="sector-detail-card" onclick="toggleSectorShops('${idx}')">
                    <div class="card-header-row" style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong class="sector-name">${escapeHtml(s.name)}</strong>
                            <span class="badge-details">Details</span>
                        </div>
                        <div style="display:flex; gap: 4px;">
                            <button class="btn-action" onclick="event.stopPropagation(); exportSectorCard(this, '${count}', '${escapeHtml(s.name).replace(/'/g, "\\'")}', '${escapeHtml(s.transporter || '').replace(/'/g, "\\'")}', 'image')" style="background:#4f46e5; color:#fff; padding:2px 6px; font-size:11px; border-radius:4px; border:none; display:flex; align-items:center; gap:2px; box-shadow:0 1px 2px rgba(0,0,0,0.1);" title="Export as Image">
                                📷 Image
                            </button>
                            <button class="btn-action" onclick="event.stopPropagation(); exportSectorCard(this, '${count}', '${escapeHtml(s.name).replace(/'/g, "\\'")}', '${escapeHtml(s.transporter || '').replace(/'/g, "\\'")}', 'pdf')" style="background:#dc2626; color:#fff; padding:2px 6px; font-size:11px; border-radius:4px; border:none; display:flex; align-items:center; gap:2px; box-shadow:0 1px 2px rgba(0,0,0,0.1);" title="Export as PDF">
                                📄 PDF
                            </button>
                        </div>
                    </div>
                    <div class="transporter-name">Transporter: ${escapeHtml(s.transporter)}</div>
                    <div class="stats-row">
                        <span style="color:var(--text-secondary);">${count} shops left</span>
                        <span style="color:var(--error);">Bal: ${bal.toFixed(2)} Qt</span>
                    </div>
                    ${shopListHtml}
                </div>`;
            }).join('');
        }
        
        // Scroll to the details section
        setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } else {
        alert('Analytics data is not yet available for this report.');
    }
}

async function exportSectorCard(btn, count, secName, transporterName, type) {
    if (!window.html2canvas || (type === 'pdf' && !window.jspdf)) {
        alert('Required libraries (html2canvas / jspdf) are not loaded yet. Please wait a moment and try again.');
        return;
    }
    const card = btn.closest('.sector-detail-card');
    if (!card) return;
    
    // Ensure shops list is expanded
    const shopsContainer = card.querySelector('.pending-shops-container');
    const wasHidden = shopsContainer && shopsContainer.style.display === 'none';
    if (wasHidden) {
        shopsContainer.style.display = 'block';
    }

    // Hide the export buttons container temporarily
    const btnContainer = btn.parentElement;
    const originalDisplay = btnContainer.style.display;
    btnContainer.style.display = 'none';

    try {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const canvas = await html2canvas(card, {
            scale: 2,
            useCORS: true,
            backgroundColor: isLight ? '#ffffff' : '#0d1526'
        });
        
        const safeSec = (secName || 'Sector').replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
        const safeTrans = (transporterName || 'Transporter').replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
        const fileName = `${count}_${safeSec}_${safeTrans}`;

        if (type === 'image') {
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = imgData;
            link.click();
        } else if (type === 'pdf') {
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            let pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, pdfHeight);
            pdf.save(`${fileName}.pdf`);
        }
    } catch (e) {
        console.error('Failed to export card:', e);
        alert('Failed to generate export.');
    } finally {
        btnContainer.style.display = originalDisplay;
        if (wasHidden && shopsContainer) {
            shopsContainer.style.display = 'none';
        }
    }
}

function toggleSectorShops(idx) {
    const el = document.getElementById(`shops-${idx}`);
    if (el) {
        const current = el.style.display;
        el.style.display = current === 'none' ? 'block' : 'none';
    }
}

function toggleActiveShopsDetails() {
    const section = document.getElementById('drActiveShopsDetailSection');
    const listEl = document.getElementById('drActiveShopsDetailList');
    
    if (section && section.style.display === 'block') {
        section.style.display = 'none';
        return;
    }
    
    const details = window.currentReportAnalytics && window.currentReportAnalytics.activeShopsDetails;
    const sectors = window.currentReportAnalytics && (window.currentReportAnalytics.allSectors || window.currentReportAnalytics.sectors || window.currentReportAnalytics.progressMatrix);

    // Build shopCode -> commodities lookup map from sectors as fallback
    const sectorCommoditiesMap = {};
    if (sectors && Array.isArray(sectors)) {
        sectors.forEach(sec => {
            if (sec.shops && Array.isArray(sec.shops)) {
                sec.shops.forEach(sh => {
                    const code = sh.shopCode || sh.code;
                    if (!code) return;
                    if (!sectorCommoditiesMap[code]) sectorCommoditiesMap[code] = {};
                    const commsObj = sh.commodities || sh.dispatchedComm || sh.dispatchCommodities || {};
                    if (typeof commsObj === 'object' && commsObj !== null) {
                        Object.keys(commsObj).forEach(k => {
                            const val = parseFloat(commsObj[k]) || 0;
                            if (val > 0) sectorCommoditiesMap[code][k] = (sectorCommoditiesMap[code][k] || 0) + val;
                        });
                    }
                });
            }
        });
    }

    if (section && listEl && details) {
        section.style.display = 'block';
        
        let html = '';
        
        const extractShopComms = (sh) => {
            const comms = {};
            const objSources = [sh.comms, sh.dispatchedComm, sh.dispatchCommodities, sh.commodities];
            objSources.forEach(src => {
                if (typeof src === 'object' && src !== null) {
                    Object.keys(src).forEach(k => {
                        const val = parseFloat(src[k]);
                        if (val > 0) comms[k] = (comms[k] || 0) + val;
                    });
                }
            });

            if (parseFloat(sh.wheatDispatched || sh.wheat || 0) > 0) comms['wheat'] = (comms['wheat'] || 0) + parseFloat(sh.wheatDispatched || sh.wheat);
            if (parseFloat(sh.riceDispatched || sh.rice || 0) > 0) comms['rice'] = (comms['rice'] || 0) + parseFloat(sh.riceDispatched || sh.rice);
            if (parseFloat(sh.fortifiedRiceDispatched || sh.fortifiedRice || 0) > 0) comms['fortifiedRice'] = (comms['fortifiedRice'] || 0) + parseFloat(sh.fortifiedRiceDispatched || sh.fortifiedRice);
            if (parseFloat(sh.sugarDispatched || sh.sugar || 0) > 0) comms['sugar'] = (comms['sugar'] || 0) + parseFloat(sh.sugarDispatched || sh.sugar);
            if (parseFloat(sh.saltDispatched || sh.salt || sh.fsaltDispatched || 0) > 0) comms['salt'] = (comms['salt'] || 0) + parseFloat(sh.saltDispatched || sh.salt || sh.fsaltDispatched);
            if (parseFloat(sh.keroseneDispatched || sh.kerosene || 0) > 0) comms['kerosene'] = (comms['kerosene'] || 0) + parseFloat(sh.keroseneDispatched || sh.kerosene);

            return comms;
        };

        const renderShopList = (shops, title, colorClass) => {
            if (!shops || shops.length === 0) return '';
            
            // Deduplicate shops by shop code and merge all commodity breakdowns
            const shopMap = {};
            shops.forEach(sh => {
                const code = sh.code || sh.shopCode;
                if (!code) return;
                if (!shopMap[code]) {
                    shopMap[code] = {
                        name: sh.name || sh.shopName,
                        code: code,
                        dispatch: 0,
                        comms: {}
                    };
                }
                const target = shopMap[code];
                target.dispatch += (parseFloat(sh.dispatch) || 0);
                
                const c = extractShopComms(sh);
                // Fallback to sectorCommoditiesMap if extractShopComms returned empty object
                if (Object.keys(c).length === 0 && sectorCommoditiesMap[code]) {
                    Object.assign(c, sectorCommoditiesMap[code]);
                }
                Object.keys(c).forEach(k => {
                    target.comms[k] = (target.comms[k] || 0) + c[k];
                });
            });
            
            const uniqueShops = Object.values(shopMap);
            
            return `
                <div class="card" style="border:1px solid #e2e8f0; box-shadow:none; margin-bottom:15px; grid-column: 1 / -1;">
                    <div class="card-header" style="background:#f8fafc; border-bottom:1px solid #e2e8f0; font-weight:700; color:#0f172a; font-size:15px;">${title} (${uniqueShops.length} Shops)</div>
                    <div class="card-body" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:15px; padding:15px;">
                        ${uniqueShops.map(sh => {
                            const commEntries = Object.entries(sh.comms).filter(([_, v]) => parseFloat(v) > 0);
                            let commList = '';
                            
                            const getCommLabel = (key) => {
                                const k = key.toLowerCase();
                                if (k === 'wheat') return 'Wheat';
                                if (k === 'rice') return 'Rice';
                                if (k === 'fortifiedrice' || k === 'frice') return 'Fortified Rice';
                                if (k === 'fsalt' || k === 'fortifiedsalt') return 'Fortified Salt';
                                if (k === 'salt') return 'Salt';
                                if (k === 'sugar') return 'Sugar';
                                if (k === 'kerosene') return 'Kerosene';
                                if (k === 'jowar') return 'Jowar';
                                if (k === 'bajra') return 'Bajra';
                                if (k === 'maize') return 'Maize';
                                return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                            };

                            if (commEntries.length > 0) {
                                commList = commEntries.map(([k, v]) => {
                                    const label = getCommLabel(k);
                                    return `<span style="background:#f1f5f9; color:#1e293b; padding:4px 10px; border-radius:6px; font-size:12px; border:1px solid #cbd5e1; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                                        <span style="font-size:13px;">📦</span> <span>${label}:</span> <strong style="color:#2563eb;">${parseFloat(v).toFixed(2)} Qt</strong>
                                    </span>`;
                                }).join('');
                            } else {
                                commList = `<span style="background:#eff6ff; color:#1e40af; padding:4px 10px; border-radius:6px; font-size:12px; border:1px solid #bfdbfe; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                                    <span style="font-size:13px;">📦</span> <span>Dispatched Grain:</span> <strong>${parseFloat(sh.dispatch).toFixed(2)} Qt</strong>
                                </span>`;
                            }

                            return `
                                <div style="border:1px solid #e2e8f0; padding:12px; border-radius:8px; background:white;">
                                    <div style="font-weight:700; color:#1e293b; margin-bottom:8px; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(sh.name)}">${escapeHtml(sh.name)}</div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
                                        <span style="font-size:12px; color:#64748b;">Code: ${sh.code}</span>
                                        <div style="display:flex; gap:6px; align-items:center;">
                                            <span style="font-weight:800; color:#2563eb; background:#eff6ff; padding:2px 8px; border-radius:10px; font-size:12px;" title="Dispatched / Lifted Quantity">Lifted: ${(parseFloat(sh.dispatch)||0).toFixed(2)} Qt</span>
                                            <span style="font-weight:800; color:${colorClass}; background:#f1f5f9; padding:2px 8px; border-radius:10px; font-size:12px;" title="Total Quantity">Total: ${(parseFloat(sh.dispatch)||0).toFixed(2)} Qt</span>
                                        </div>
                                    </div>
                                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${commList}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        };
        
        html += renderShopList(details.full, '✅ Full Lifted Shops (All allotted commodities lifted)', '#16a34a');
        html += renderShopList(details.partial, '⚠️ Partial Lifted Shops (Some commodities left pending)', '#ea580c');
        
        listEl.innerHTML = html;
        setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
        alert('Detailed active shop list is not available for this report. Please regenerate the report.');
    }
}

function renderTransporterInsights(id, list, isTop) {
    const el = document.getElementById(id);
    if (!el || !list) return;
    el.innerHTML = list.map(t => {
        const pct = t.avgDispatch !== undefined ? t.avgDispatch : (t.dispatchPct || 0);
        return `<div style="padding:10px; border-bottom:1px solid #eee;"><strong>${escapeHtml(t.name)}</strong>: ${pct}%</div>`;
    }).join('');
}

function displayMDMAnalytics(analytics, v, genTime) {
    if (!document.getElementById('mdmAnalyticsSection')) return;
    document.getElementById('mdmAnalyticsSection').style.display = 'block';
    const m = analytics.metrics || analytics.totals || {}; 
    const fmtPct = (val) => parseFloat(val || 0).toFixed(2);
    
    // Update Detailed Labels
    if (m.wheatAllotted !== undefined) {
        if (document.getElementById('mdm-wheat-allotted')) document.getElementById('mdm-wheat-allotted').innerText = `${m.wheatAllotted} Qt`;
        if (document.getElementById('mdm-wheat-dispatched')) document.getElementById('mdm-wheat-dispatched').innerText = `${m.wheatDispatched} Qt`;
        if (document.getElementById('mdm-wheat-received')) document.getElementById('mdm-wheat-received').innerText = `${m.wheatReceived} Qt`;
        if (document.getElementById('mdm-wheat-dispatch-pct-label')) document.getElementById('mdm-wheat-dispatch-pct-label').innerText = `${fmtPct(m.wheatDispatchPct)}%`;
        if (document.getElementById('mdm-wheat-receipt-pct-label')) document.getElementById('mdm-wheat-receipt-pct-label').innerText = `${fmtPct(m.wheatReceiptPct)}%`;
        
        if (document.getElementById('mdm-rice-allotted')) document.getElementById('mdm-rice-allotted').innerText = `${m.riceAllotted} Qt`;
        if (document.getElementById('mdm-rice-dispatched')) document.getElementById('mdm-rice-dispatched').innerText = `${m.riceDispatched} Qt`;
        if (document.getElementById('mdm-rice-received')) document.getElementById('mdm-rice-received').innerText = `${m.riceReceived} Qt`;
        if (document.getElementById('mdm-rice-dispatch-pct-label')) document.getElementById('mdm-rice-dispatch-pct-label').innerText = `${fmtPct(m.riceDispatchPct)}%`;
        if (document.getElementById('mdm-rice-receipt-pct-label')) document.getElementById('mdm-rice-receipt-pct-label').innerText = `${fmtPct(m.riceReceiptPct)}%`;
    }

    // Commodities bars
    const wDisp = m.wheatDispatchPct !== undefined ? m.wheatDispatchPct : 0;
    const wRcpt = m.wheatReceiptPct !== undefined ? m.wheatReceiptPct : 0;
    const rDisp = m.riceDispatchPct !== undefined ? m.riceDispatchPct : 0;
    const rRcpt = m.riceReceiptPct !== undefined ? m.riceReceiptPct : 0;

    if (document.getElementById('mdm-wheat-dispatch-bar')) document.getElementById('mdm-wheat-dispatch-bar').style.width = `${wDisp}%`;
    if (document.getElementById('mdm-wheat-receipt-bar')) document.getElementById('mdm-wheat-receipt-bar').style.width = `${wRcpt}%`;
    if (document.getElementById('mdm-rice-dispatch-bar')) document.getElementById('mdm-rice-dispatch-bar').style.width = `${rDisp}%`;
    if (document.getElementById('mdm-rice-receipt-bar')) document.getElementById('mdm-rice-receipt-bar').style.width = `${rRcpt}%`;

    // Summary metrics
    if (document.getElementById('mdmMetricsGrid')) {
        const dispatchPct = m.totalDispatchPct !== undefined ? m.totalDispatchPct : (m.dispatchPercentage || 0);
        const receiptPct = m.totalReceiptPct !== undefined ? m.totalReceiptPct : (m.receipt_percentage || 0);
        
        document.getElementById('mdmMetricsGrid').innerHTML = `
            <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">📦</div><div class="stat-content"><div class="stat-label">Dispatch</div><div class="stat-value">${parseFloat(dispatchPct).toFixed(2)}%</div></div></div>
            <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">✅</div><div class="stat-content"><div class="stat-label">Received</div><div class="stat-value">${parseFloat(receiptPct).toFixed(2)}%</div></div></div>
            <div class="stat-card" onclick="toggleShopsLeftDetails()"><div class="stat-icon">🏪</div><div class="stat-content"><div class="stat-label">Pending</div><div class="stat-value">${m.totalShopsLeft || m.totalPendingShops || 0}</div></div></div>
        `;
    }

    // Transporters
    renderPerformerList('mdmTopTransportersList', analytics.topTransporters, true);
    renderPerformerList('mdmBottomTransportersList', analytics.bottomTransporters, false);
    if (document.getElementById('mdmTransporterSection')) document.getElementById('mdmTransporterSection').style.display = 'block';

    // AI Insights
    if (analytics.insights) {
        renderInsightsList('mdmInsightsList', analytics.insights, analytics.topTransporters, analytics.bottomTransporters);
        document.getElementById('mdmInsightsSection').style.display = 'block';
    }
}

function displayICDSAnalytics(analytics, v, genTime) {
    if (!document.getElementById('icdsAnalyticsSection')) return;
    document.getElementById('icdsAnalyticsSection').style.display = 'block';
    
    const m = analytics.metrics || analytics.totals || {};
    const fmtPct = (val) => parseFloat(val || 0).toFixed(2);
    
    // Update labels if exist
    if (m.wheatAllotted !== undefined) {
        if (document.getElementById('icds-wheat-allotted')) document.getElementById('icds-wheat-allotted').innerText = `${m.wheatAllotted} Qt`;
        if (document.getElementById('icds-wheat-dispatched')) document.getElementById('icds-wheat-dispatched').innerText = `${m.wheatDispatched} Qt`;
        if (document.getElementById('icds-wheat-received')) document.getElementById('icds-wheat-received').innerText = `${m.wheatReceived} Qt`;
        if (document.getElementById('icds-wheat-dispatch-pct-label')) document.getElementById('icds-wheat-dispatch-pct-label').innerText = `${fmtPct(m.wheatDispatchPct)}%`;
        if (document.getElementById('icds-wheat-receipt-pct-label')) document.getElementById('icds-wheat-receipt-pct-label').innerText = `${fmtPct(m.wheatReceiptPct)}%`;
        if (document.getElementById('icds-wheat-dispatch-bar')) document.getElementById('icds-wheat-dispatch-bar').style.width = `${m.wheatDispatchPct}%`;
        if (document.getElementById('icds-wheat-receipt-bar')) document.getElementById('icds-wheat-receipt-bar').style.width = `${m.wheatReceiptPct}%`;

        if (document.getElementById('icds-rice-allotted')) document.getElementById('icds-rice-allotted').innerText = `${m.riceAllotted} Qt`;
        if (document.getElementById('icds-rice-dispatched')) document.getElementById('icds-rice-dispatched').innerText = `${m.riceDispatched} Qt`;
        if (document.getElementById('icds-rice-received')) document.getElementById('icds-rice-received').innerText = `${m.riceReceived} Qt`;
        if (document.getElementById('icds-rice-dispatch-pct-label')) document.getElementById('icds-rice-dispatch-pct-label').innerText = `${fmtPct(m.riceDispatchPct)}%`;
        if (document.getElementById('icds-rice-receipt-pct-label')) document.getElementById('icds-rice-receipt-pct-label').innerText = `${fmtPct(m.riceReceiptPct)}%`;
        if (document.getElementById('icds-rice-dispatch-bar')) document.getElementById('icds-rice-dispatch-bar').style.width = `${m.riceDispatchPct}%`;
        if (document.getElementById('icds-rice-receipt-bar')) document.getElementById('icds-rice-receipt-bar').style.width = `${m.riceReceiptPct}%`;

        if (document.getElementById('icds-fsalt-allotted')) document.getElementById('icds-fsalt-allotted').innerText = `${m.fsaltAllotted} Qt`;
        if (document.getElementById('icds-fsalt-dispatched')) document.getElementById('icds-fsalt-dispatched').innerText = `${m.fsaltDispatched} Qt`;
        if (document.getElementById('icds-fsalt-received')) document.getElementById('icds-fsalt-received').innerText = `${m.fsaltReceived} Qt`;
        if (document.getElementById('icds-fsalt-dispatch-pct-label')) document.getElementById('icds-fsalt-dispatch-pct-label').innerText = `${fmtPct(m.fsaltDispatchPct)}%`;
        if (document.getElementById('icds-fsalt-receipt-pct-label')) document.getElementById('icds-fsalt-receipt-pct-label').innerText = `${fmtPct(m.fsaltReceiptPct)}%`;
        if (document.getElementById('icds-fsalt-dispatch-bar')) document.getElementById('icds-fsalt-dispatch-bar').style.width = `${m.fsaltDispatchPct}%`;
        if (document.getElementById('icds-fsalt-receipt-bar')) document.getElementById('icds-fsalt-receipt-bar').style.width = `${m.fsaltReceiptPct}%`;
    }

    if (document.getElementById('icdsMetricsGrid')) {
        const dispatchPct = m.totalDispatchPct !== undefined ? m.totalDispatchPct : (m.dispatchPercentage || 0);
        const receiptPct = m.totalReceiptPct !== undefined ? m.totalReceiptPct : (m.receipt_percentage || 0);
        
        document.getElementById('icdsMetricsGrid').innerHTML = `
            <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">📦</div><div class="stat-content"><div class="stat-label">Dispatch</div><div class="stat-value">${parseFloat(dispatchPct).toFixed(2)}%</div></div></div>
            <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">✅</div><div class="stat-content"><div class="stat-label">Received</div><div class="stat-value">${parseFloat(receiptPct).toFixed(2)}%</div></div></div>
            <div class="stat-card" onclick="toggleShopsLeftDetails()"><div class="stat-icon">🏪</div><div class="stat-content"><div class="stat-label">Pending</div><div class="stat-value">${m.totalShopsLeft || m.totalPendingShops || 0}</div></div></div>
        `;
    }
    
    // Transporters
    renderPerformerList('icdsTopTransportersList', analytics.topTransporters, true);
    renderPerformerList('icdsBottomTransportersList', analytics.bottomTransporters, false);
    if (document.getElementById('icdsTransporterSection')) document.getElementById('icdsTransporterSection').style.display = 'block';

    // AI Insights
    if (analytics.insights) {
        renderInsightsList('icdsInsightsList', analytics.insights, analytics.topTransporters, analytics.bottomTransporters);
        document.getElementById('icdsInsightsSection').style.display = 'block';
    }
}

function displayWELFAREAnalytics(analytics, v, genTime) {
    if (!document.getElementById('welfareAnalyticsSection')) return;
    document.getElementById('welfareAnalyticsSection').style.display = 'block';
    
    const m = analytics.metrics || analytics.totals || {};
    const fmtPct = (val) => parseFloat(val || 0).toFixed(2);
    
    // Update labels
    if (m.wheatAllotted !== undefined) {
        if (document.getElementById('welfareWheatAllotted')) document.getElementById('welfareWheatAllotted').innerText = `${m.wheatAllotted} Qt`;
        if (document.getElementById('welfareWheatDispatched')) document.getElementById('welfareWheatDispatched').innerText = `${m.wheatDispatched} Qt`;
        if (document.getElementById('welfareWheatReceived')) document.getElementById('welfareWheatReceived').innerText = `${m.wheatReceived} Qt`;
        if (document.getElementById('welfareWheatDispPct')) document.getElementById('welfareWheatDispPct').innerText = `${fmtPct(m.wheatDispatchPct)}%`;
        if (document.getElementById('welfareWheatRcptPct')) document.getElementById('welfareWheatRcptPct').innerText = `${fmtPct(m.wheatReceiptPct)}%`;
        
        if (document.getElementById('welfareRiceAllotted')) document.getElementById('welfareRiceAllotted').innerText = `${m.riceAllotted} Qt`;
        if (document.getElementById('welfareRiceDispatched')) document.getElementById('welfareRiceDispatched').innerText = `${m.riceDispatched} Qt`;
        if (document.getElementById('welfareRiceReceived')) document.getElementById('welfareRiceReceived').innerText = `${m.riceReceived} Qt`;
        if (document.getElementById('welfareRiceDispPct')) document.getElementById('welfareRiceDispPct').innerText = `${fmtPct(m.riceDispatchPct)}%`;
        if (document.getElementById('welfareRiceRcptPct')) document.getElementById('welfareRiceRcptPct').innerText = `${fmtPct(m.riceReceiptPct)}%`;

        if (document.getElementById('welfareWheatDispBar')) document.getElementById('welfareWheatDispBar').style.width = `${m.wheatDispatchPct}%`;
        if (document.getElementById('welfareWheatRcptBar')) document.getElementById('welfareWheatRcptBar').style.width = `${m.wheatReceiptPct}%`;
        if (document.getElementById('welfareRiceDispBar')) document.getElementById('welfareRiceDispBar').style.width = `${m.riceDispatchPct}%`;
        if (document.getElementById('welfareRiceRcptBar')) document.getElementById('welfareRiceRcptBar').style.width = `${m.riceReceiptPct}%`;
    }

    if (document.getElementById('welfareMetricsGrid')) {
        const dispatchPct = m.totalDispatchPct !== undefined ? m.totalDispatchPct : (m.dispatchPercentage || 0);
        const receiptPct = m.totalReceiptPct !== undefined ? m.totalReceiptPct : (m.receipt_percentage || 0);
        
        document.getElementById('welfareMetricsGrid').innerHTML = `
            <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">📦</div><div class="stat-content"><div class="stat-label">Dispatch</div><div class="stat-value">${parseFloat(dispatchPct).toFixed(2)}%</div></div></div>
            <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">✅</div><div class="stat-content"><div class="stat-label">Received</div><div class="stat-value">${parseFloat(receiptPct).toFixed(2)}%</div></div></div>
            <div class="stat-card" onclick="toggleShopsLeftDetails()"><div class="stat-icon">🏪</div><div class="stat-content"><div class="stat-label">Pending</div><div class="stat-value">${m.totalShopsLeft || m.totalPendingShops || 0}</div></div></div>
        `;
    }
    
    // Transporters
    renderPerformerList('welfareTopTransportersList', analytics.topTransporters, true);
    renderPerformerList('welfareBottomTransportersList', analytics.bottomTransporters, false);
    if (document.getElementById('welfareTransporterSection')) document.getElementById('welfareTransporterSection').style.display = 'block';

    // AI Insights
    if (analytics.insights) {
        renderInsightsList('welfareInsightsList', analytics.insights, analytics.topTransporters, analytics.bottomTransporters);
        document.getElementById('welfareInsightsSection').style.display = 'block';
    }
}

function displayNfsaDaterangeAnalytics(analytics) {
    if (!document.getElementById('drAnalyticsSection')) return;
    document.getElementById('drAnalyticsSection').style.display = 'block';
    
    // Set subtitle/dates
    const subtitleEl = document.getElementById('drAnalyticsSubtitle');
    if (subtitleEl && analytics.fromDate && analytics.toDate) {
        subtitleEl.innerHTML = `📅 तिथि सीमा (Date Range): <strong>${analytics.fromDate} से ${analytics.toDate}</strong>`;
        subtitleEl.style.color = '#4f46e5';
    }
    
    // Set sector matrix heading date range
    const drRangeEl = document.getElementById('drMatrixDateRange');
    if (drRangeEl && analytics.fromDate && analytics.toDate) {
        drRangeEl.textContent = `(दिनांक ${analytics.fromDate} से ${analytics.toDate})`;
    } else if (drRangeEl) {
        drRangeEl.textContent = '';
    }

    // Hide transporter section for Date Range (Not aggregated by default)
    if (document.getElementById('drTransporterSection')) document.getElementById('drTransporterSection').style.display = 'none';
    if (document.getElementById('transporterSection')) document.getElementById('transporterSection').style.display = 'none';
    
    const m = analytics.metrics || {};
    
    // Compute deduplicated shop counts dynamically from activeShopsDetails for perfect consistency with the expanded list
    let fullCount = m.fullLiftedShops || 0;
    let partialCount = m.partialLiftedShops || 0;
    let totalCount = m.totalShops || 0;

    if (analytics.activeShopsDetails) {
        const fullSet = new Set();
        (analytics.activeShopsDetails.full || []).forEach(sh => {
            const c = sh.code || sh.shopCode;
            if (c) fullSet.add(c);
        });
        const partialSet = new Set();
        (analytics.activeShopsDetails.partial || []).forEach(sh => {
            const c = sh.code || sh.shopCode;
            if (c && !fullSet.has(c)) partialSet.add(c);
        });
        
        if (fullSet.size > 0 || partialSet.size > 0) {
            fullCount = fullSet.size;
            partialCount = partialSet.size;
            totalCount = fullCount + partialCount;
        }
    }

    document.getElementById('drMetricsGrid').innerHTML = `
        <div class="stat-card" onclick="toggleMatrix()"><div class="stat-icon">📦</div><div class="stat-content"><div class="stat-label">Total Dispatch</div><div class="stat-value">${(parseFloat(m.totalDispatch) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} Qt.</div></div></div>
        <div class="stat-card" onclick="toggleActiveShopsDetails()" style="cursor:pointer;"><div class="stat-icon">🏪</div><div class="stat-content"><div class="stat-label">Active Shops (Lifted)</div><div class="stat-value" style="font-size:16px; margin-top:2px; display:flex; align-items:baseline; gap:6px;">${totalCount} <span style="font-size:12px; color:#64748b; font-weight:500;">(${fullCount} Full / ${partialCount} Partial)</span></div></div></div>
    `;

    // Transporters (DR)
    if (analytics.topTransporters && analytics.topTransporters.length > 0) {
        renderPerformerList('drTopTransportersList', analytics.topTransporters, true);
        renderPerformerList('drBottomTransportersList', analytics.bottomTransporters, false);
        if (document.getElementById('drTransporterSection')) document.getElementById('drTransporterSection').style.display = 'block';
    } else {
        if (document.getElementById('drTransporterSection')) document.getElementById('drTransporterSection').style.display = 'none';
    }

    if (analytics.insights) {
        renderInsightsList('drInsightsList', analytics.insights, analytics.topTransporters, analytics.bottomTransporters);
        document.getElementById('drInsightsSection').style.display = 'block';
    }
}

// Global Sub-View Checker
function isSubViewActive() {
    const stock = document.getElementById('stockPositionSection');
    const comp  = document.getElementById('comparisonSection');
    if (stock && stock.style.display !== 'none' && stock.style.display !== '') return true;
    if (comp  && comp.style.display  !== 'none' && comp.style.display  !== '') return true;
    return false;
}
window.isSubViewActive = isSubViewActive;

function switchScheme(scheme) {
    currentScheme = scheme;
    document.querySelectorAll('.scheme-tab').forEach(t => t.classList.remove('active-tab'));
    const tab = document.querySelector(`.scheme-tab[onclick*="${scheme}"]`);
    if (tab) tab.classList.add('active-tab');
    
    // Toggle Panels
    ['nfsaPanel', 'mdmPanel', 'icdsPanel', 'welfarePanel', 'messengerPanel'].forEach(id => {
        const el = document.getElementById(id); 
        if (el) el.style.display = (id.startsWith(scheme)) ? 'block' : 'none';
    });

    // Toggle History Sections
    const historyMapping = {
        'nfsa': 'nfsaReportHistorySection',
        'mdm': 'mdmHistory',
        'icds': 'icdsHistory',
        'welfare': 'welfareHistory'
    };
    
    const subActive = isSubViewActive();

    Object.keys(historyMapping).forEach(key => {
        const el = document.getElementById(historyMapping[key]);
        if (el) {
            if (subActive) {
                el.style.display = 'none';
            } else if (key === 'nfsa' && scheme === 'nfsa') {
                el.style.display = (currentReportMode === 'monthly') ? 'block' : 'none';
            } else {
                el.style.display = (key === scheme) ? 'block' : 'none';
            }
        }
    });

    // Explicitly toggle Date Range history section visibility
    const drEl = document.getElementById('daterangeHistory');
    if (drEl) {
        drEl.style.display = (!subActive && scheme === 'nfsa' && currentReportMode === 'daterange') ? 'block' : 'none';
    }

    // Load data for the selected scheme
    if (scheme === 'nfsa') {
        if (currentReportMode === 'monthly') loadReports();
        else loadDaterangeReports();
    }
    else if (scheme === 'mdm') loadMDMReports();
    else if (scheme === 'icds') loadICDSReports();
    else if (scheme === 'welfare') loadWelfareReports();
    else if (scheme === 'messenger') {
        // Populate the messenger dropdown with reports from all schemes
        populateMessengerReportDropdown();
    }
}

function refreshReports() {
    if (currentScheme === 'nfsa') {
        loadReports();
        loadDaterangeReports();
    }
    else if (currentScheme === 'mdm') loadMDMReports();
    else if (currentScheme === 'icds') loadICDSReports();
    else if (currentScheme === 'welfare') loadWelfareReports();
}

/**
 * Utility Functions
 */
/**
 * Utility: Get color based on performance percentage
 */
function getStatusColor(p) {
    const val = parseFloat(p);
    if (val >= 95) return "#059669"; // Green
    if (val >= 80) return "#2563eb"; // Blue
    if (val >= 60) return "#d97706"; // Amber
    return "#dc2626"; // Red
}

async function loadReports() {
    try {
        const res = await fetch('api/reports?scheme=nfsa');
        const reports = await res.json();
        const tbody = document.getElementById('reportsTableBody');
        const section = document.getElementById('nfsaReportHistorySection');
        if (!tbody) return;
        
        // Only show if we are in monthly mode AND NFSA is active AND sub-view is not active
        if (section && currentScheme === 'nfsa') {
            section.style.display = (!isSubViewActive() && currentReportMode === 'monthly') ? 'block' : 'none';
        }
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;
        updateDeleteButtonVisibility('nfsa');

        if (!Array.isArray(reports) || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted, #94a3b8);">No reports found. Generate one to see it here!</td></tr>';
            setupHistoryExpansion('nfsa', 0);
            return;
        }

        tbody.innerHTML = reports.map(r => {
            const schemeLabel = r.scheme === 'nfsa_daterange' ? 'NFSA DR' : (r.scheme || 'NFSA').toUpperCase();

            return `
            <tr data-id="${r.id}" class="report-row">
                <td class="text-center">
                    <input type="checkbox" class="report-checkbox custom-checkbox" value="${r.id}" onchange="updateDeleteButtonVisibility('nfsa')">
                </td>
                <td>
                    <span class="badge-premium">${schemeLabel}</span>
                </td>
                <td style="font-weight: 600; color: var(--text-main, #eef2ff);">
                    ${getMonthName(r.month)} ${r.year}
                </td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-main, #eef2ff);">
                    ${parseFloat(r.total_allocation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td style="color:${getStatusColor(r.dispatch_percentage)}; font-weight: 800;">
                    ${(parseFloat(r.dispatch_percentage) || 0).toFixed(2)}%
                </td>
                <td style="color: var(--text-main, #eef2ff); font-weight: 600;">
                    ${(parseFloat(r.receipt_percentage || 0)).toFixed(2)}%
                </td>
                <td style="font-size: 13px; color: var(--text-muted, #94a3b8); line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-main, #eef2ff);">${new Date(r.generated_at).toLocaleDateString('en-GB')}</div>
                    <div style="opacity: 0.8; font-size: 11px;">${new Date(r.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-action btn-action-view" onclick="viewReport('${r.id}')" title="View Details">
                            <span>👁️</span> View
                        </button>
                        <a href="${r.downloadUrl || `/reports/${r.filename}`}" class="btn-action btn-action-excel" title="Download Excel" download>
                            <span>📥</span> Excel
                        </a>
                        <button class="btn-action btn-action-pdf" onclick="generatePDF('${r.id}', event)" title="Export PDF">
                            <span>📄</span> PDF
                        </button>
                        ${(r.scheme || 'nfsa') === 'nfsa' ? `
                        <button class="btn-action" onclick="showAdvancedAnalyticsModal('${r.id}')" title="Advanced Analytics / उन्नत विश्लेषण" style="background:linear-gradient(135deg,#0b2545,#1e3a8a);color:#fff;">
                            <span>📊</span> विश्लेषण
                        </button>` : ''}
                        <button class="btn-action" onclick="openEmailModal('${r.id}', '${r.scheme || 'nfsa'}')" title="Email Report" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;">
                            <span>✉️</span> Email
                        </button>
                        <button class="btn-action btn-action-delete" onclick="deleteReport('${r.id}')" title="Remove Report">
                            <span>🗑️</span> Delete
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        setupHistoryExpansion('nfsa', reports.length);

    } catch (error) {
        console.error('Failed to load reports:', error);
    }
}

async function loadDaterangeReports() {
    try {
        const res = await fetch(`api/reports?scheme=nfsa_daterange&t=${Date.now()}`);
        const reports = await res.json();
        const tbody = document.getElementById('daterangeReportsTableBody');
        const section = document.getElementById('daterangeHistory');
        
        if (!tbody) return;
        
        // Only show if we are in daterange mode AND NFSA is active AND sub-view is not active
        if (section) {
            section.style.display = (!isSubViewActive() && currentScheme === 'nfsa' && currentReportMode === 'daterange') ? 'block' : 'none';
        }
        
        // Reset "Select All" checkbox
        const selectAll = document.getElementById('nfsa_daterangeSelectAll') || document.getElementById('daterangeSelectAll');
        if (selectAll) selectAll.checked = false;
        updateDeleteButtonVisibility('nfsa_daterange');

        if (!Array.isArray(reports) || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 40px; color: var(--text-muted, #94a3b8);">No Date Range reports found. Generate one to see it here!</td></tr>';
            setupHistoryExpansion('nfsa_daterange', 0);
            return;
        }

        tbody.innerHTML = reports.map(r => {
            const dateStr = formatDateToDMY(r.generated_at);
            return `
            <tr data-id="${r.id}" class="report-row">
                <td class="text-center">
                    <input type="checkbox" class="nfsa_daterange-report-checkbox custom-checkbox" value="${r.id}" onchange="updateDeleteButtonVisibility('nfsa_daterange')">
                </td>
                <td>
                    <span class="badge-premium" style="background:#4f46e5;">NFSA DR</span>
                </td>
                <td style="font-weight: 600; color: var(--text-main, #eef2ff);">
                    ${r.from_date && r.to_date ? `${r.from_date} - ${r.to_date}` : `${getMonthName(r.month)} ${r.year}`}
                </td>
                <td style="color: #4f46e5; font-weight: 800;">
                    ${(parseFloat(r.total_dispatch) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} Qt.
                </td>
                <td style="font-size: 13px; color: var(--text-muted, #94a3b8); line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-main, #eef2ff);">${new Date(r.generated_at).toLocaleDateString('en-GB')}</div>
                    <div style="opacity: 0.8; font-size: 11px;">${new Date(r.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-action btn-action-view" onclick="viewReport('${r.id}')" title="View Details">
                            <span>👁️</span> View
                        </button>
                        <a href="/reports/${r.filename}" class="btn-action btn-action-excel" title="Download Excel" download>
                            <span>📥</span> Excel
                        </a>
                        <button class="btn-action btn-action-pdf" onclick="generatePDF('${r.id}', event)" title="Export PDF">
                            <span>📄</span> PDF
                        </button>
                        <button class="btn-action btn-action-delete" onclick="deleteReport('${r.id}')" title="Remove Report">
                            <span>🗑️</span> Delete
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        setupHistoryExpansion('nfsa_daterange', reports.length);
    } catch (error) {
        console.error('Error loading daterange reports:', error);
    }
}

async function loadMDMReports() {
    try {
        const response = await fetch('api/reports?scheme=mdm');
        const reports = await response.json();
        const tbody = document.getElementById('mdmReportsTableBody');
        const section = document.getElementById('mdmHistory');
        if (!tbody) return;

        if (section && currentScheme === 'mdm') {
            section.style.display = !isSubViewActive() ? 'block' : 'none';
        }

        const selectAll = document.getElementById('mdmSelectAll');
        if (selectAll) selectAll.checked = false;
        updateDeleteButtonVisibility('mdm');

        if (!Array.isArray(reports) || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted, #94a3b8);">No MDM reports found. Generate one to see it here!</td></tr>';
            setupHistoryExpansion('mdm', 0);
            return;
        }

        tbody.innerHTML = reports.map(r => `
            <tr data-id="${r.id}" class="report-row">
                <td class="text-center"><input type="checkbox" class="mdm-report-checkbox custom-checkbox" value="${r.id}" onchange="updateDeleteButtonVisibility('mdm')"></td>
                <td><span class="badge-premium">MDM</span></td>
                <td style="font-weight: 600; color: var(--text-main, #eef2ff);">${getMonthName(r.month)} ${r.year}</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-main, #eef2ff);">${parseFloat(r.total_allocation || 0).toFixed(2)}</td>
                <td style="color:${getStatusColor(r.dispatch_percentage)}; font-weight: 800;">${parseFloat(r.dispatch_percentage || 0).toFixed(2)}%</td>
                <td style="color: var(--text-main, #eef2ff); font-weight: 600;">${parseFloat(r.receipt_percentage || 0).toFixed(2)}%</td>
                <td style="font-size: 13px; color: var(--text-muted, #94a3b8); line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-main, #eef2ff);">${new Date(r.generated_at).toLocaleDateString('en-GB')}</div>
                    <div style="opacity: 0.8; font-size: 11px;">${new Date(r.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-action btn-action-view" onclick="viewReport('${r.id}')" title="View Details"><span>👁️</span> View</button>
                        <a href="/reports/${r.filename}" class="btn-action btn-action-excel" download><span>📥</span> Excel</a>
                        <button class="btn-action btn-action-pdf" onclick="generatePDF('${r.id}', event)"><span>📄</span> PDF</button>
                        <button class="btn-action" onclick="openEmailModal('${r.id}', 'mdm')" title="Email Report" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;"><span>✉️</span> Email</button>
                        <button class="btn-action btn-action-delete" onclick="deleteReport('${r.id}')" title="Remove Report"><span>🗑️</span> Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
        setupHistoryExpansion('mdm', reports.length);
    } catch (e) { console.error('MDM load error:', e); }
}

async function loadICDSReports() {
    try {
        const response = await fetch('api/reports?scheme=icds');
        const reports = await response.json();
        const tbody = document.getElementById('icdsReportsTableBody');
        const section = document.getElementById('icdsHistory');
        if (!tbody) return;

        if (section && currentScheme === 'icds') {
            section.style.display = !isSubViewActive() ? 'block' : 'none';
        }

        const selectAll = document.getElementById('icdsSelectAll');
        if (selectAll) selectAll.checked = false;
        updateDeleteButtonVisibility('icds');

        if (!Array.isArray(reports) || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted, #94a3b8);">No ICDS reports found. Generate one to see it here!</td></tr>';
            setupHistoryExpansion('icds', 0);
            return;
        }

        tbody.innerHTML = reports.map(r => `
            <tr data-id="${r.id}" class="report-row">
                <td class="text-center"><input type="checkbox" class="icds-report-checkbox custom-checkbox" value="${r.id}" onchange="updateDeleteButtonVisibility('icds')"></td>
                <td><span class="badge-premium">ICDS</span></td>
                <td style="font-weight: 600; color: var(--text-main, #eef2ff);">${getMonthName(r.month)} ${r.year}</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-main, #eef2ff);">${parseFloat(r.total_allocation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style="color:${getStatusColor(r.dispatch_percentage)}; font-weight: 800;">${(parseFloat(r.dispatch_percentage) || 0).toFixed(2)}%</td>
                <td style="color: var(--text-main, #eef2ff); font-weight: 600;">${(parseFloat(r.receipt_percentage || 0)).toFixed(2)}%</td>
                <td style="font-size: 13px; color: var(--text-muted, #94a3b8); line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-main, #eef2ff);">${new Date(r.generated_at).toLocaleDateString('en-GB')}</div>
                    <div style="opacity: 0.8; font-size: 11px;">${new Date(r.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-action btn-action-view" onclick="viewReport('${r.id}')" title="View Details"><span>👁️</span> View</button>
                        <a href="/reports/${r.filename}" class="btn-action btn-action-excel" download><span>📥</span> Excel</a>
                        <button class="btn-action btn-action-pdf" onclick="generatePDF('${r.id}', event)"><span>📄</span> PDF</button>
                        <button class="btn-action" onclick="openEmailModal('${r.id}', 'icds')" title="Email Report" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;"><span>✉️</span> Email</button>
                        <button class="btn-action btn-action-delete" onclick="deleteReport('${r.id}')" title="Remove Report"><span>🗑️</span> Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
        setupHistoryExpansion('icds', reports.length);
    } catch (e) { console.error('ICDS load error:', e); }
}

async function loadWelfareReports() {
    try {
        const response = await fetch('api/reports?scheme=welfare');
        const reports = await response.json();
        const tbody = document.getElementById('welfareReportsTableBody');
        const section = document.getElementById('welfareHistory');
        if (!tbody) return;

        if (section && currentScheme === 'welfare') {
            section.style.display = !isSubViewActive() ? 'block' : 'none';
        }

        const selectAll = document.getElementById('welfareSelectAll');
        if (selectAll) selectAll.checked = false;
        updateDeleteButtonVisibility('welfare');

        if (!Array.isArray(reports) || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted, #94a3b8);">No Welfare reports found. Generate one to see it here!</td></tr>';
            setupHistoryExpansion('welfare', 0);
            return;
        }

        tbody.innerHTML = reports.map(r => `
            <tr data-id="${r.id}" class="report-row">
                <td class="text-center">
                    <input type="checkbox" class="welfare-report-checkbox custom-checkbox" value="${r.id}" onchange="updateDeleteButtonVisibility('welfare')">
                </td>
                <td><span class="badge-premium">WELFARE</span></td>
                <td style="font-weight: 600; color: var(--text-main, #eef2ff);">${getMonthName(r.month)} ${r.year}</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-main, #eef2ff);">${parseFloat(r.total_allocation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style="color:${getStatusColor(r.dispatch_percentage)}; font-weight: 800;">${(parseFloat(r.dispatch_percentage) || 0).toFixed(2)}%</td>
                <td style="color: var(--text-main, #eef2ff); font-weight: 600;">${(parseFloat(r.receipt_percentage || 0)).toFixed(2)}%</td>
                <td style="font-size: 13px; color: var(--text-muted, #94a3b8); line-height: 1.4;">
                    <div style="font-weight: 600; color: var(--text-main, #eef2ff);">${new Date(r.generated_at).toLocaleDateString('en-GB')}</div>
                    <div style="opacity: 0.8; font-size: 11px;">${new Date(r.generated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-action btn-action-view" onclick="viewReport('${r.id}')" title="View Details"><span>👁️</span> View</button>
                        <a href="/reports/${r.filename}" class="btn-action btn-action-excel" download><span>📥</span> Excel</a>
                        <button class="btn-action btn-action-pdf" onclick="generatePDF('${r.id}', event)"><span>📄</span> PDF</button>
                        <button class="btn-action" onclick="openEmailModal('${r.id}', 'welfare')" title="Email Report" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;"><span>✉️</span> Email</button>
                        <button class="btn-action btn-action-delete" onclick="deleteReport('${r.id}')" title="Remove Report"><span>🗑️</span> Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
        setupHistoryExpansion('welfare', reports.length);
    } catch (e) { console.error('Welfare load error:', e); }
}

async function loadStats() {
    try {
        const res = await fetch('api/reports/stats');
        const stats = await res.json();
        
        if (document.getElementById('stats-total-reports')) document.getElementById('stats-total-reports').innerText = stats.total || 0;
        if (document.getElementById('thisMonthReports')) document.getElementById('thisMonthReports').innerText = stats.thisMonth || 0;
        
        if (document.getElementById('stats-last-generated')) {
            if (stats.lastGenerated) {
                const date = new Date(stats.lastGenerated);
                document.getElementById('stats-last-generated').innerText = date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase().replace(',', '');
            } else {
                document.getElementById('stats-last-generated').innerText = '-';
            }
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

function refreshAllReportsSilent() { loadReports(); loadDaterangeReports(); loadStats(); }
function hideAllMessages() { document.querySelectorAll('.alert').forEach(el => el.style.display = 'none'); }
function showProgress() { document.getElementById(currentScheme === 'nfsa' ? 'progressSection' : currentScheme + 'ProgressSection').style.display = 'block'; }
function hideProgress() { document.querySelectorAll('.progress-section').forEach(el => el.style.display = 'none'); }
function startTimer() {
    const scheme = currentScheme || "nfsa";
    const timerId = (scheme === "nfsa") ? "generationTimer" : (scheme + "GenerationTimer");
    const timerElement = document.getElementById(timerId);
    if (!timerElement) return;

    timerElement.style.display = "block";
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timerElement.textContent = "Time: " + mins + "m " + secs + "s";
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    const scheme = currentScheme || "nfsa";
    const timerId = (scheme === "nfsa") ? "generationTimer" : (scheme + "GenerationTimer");
    const timerElement = document.getElementById(timerId);
    if (timerElement) {
        timerElement.style.display = "none";
        timerElement.textContent = "Time: 0m 0s";
    }
}

// Re-hooking Messenger Report Select
document.getElementById('messengerReportSelect')?.addEventListener('change', loadMessengerTransporters);


/**
 * Global Email Modal Functions
 */
function openGlobalEmailModal() {
    const modal = document.getElementById('globalEmailModal');
    if (modal) {
        modal.style.display = 'flex';
        populateEmailPresets();
        loadEmailSchemeGrid();
        switchEmailTab('send');
        loadEmailScheduleSettings();
    }
}

function closeGlobalEmailModal() {
    const modal = document.getElementById('globalEmailModal');
    if (modal) modal.style.display = 'none';
    
    // Clear status and timers
    if (window.emailCountdownInterval) {
        clearInterval(window.emailCountdownInterval);
        window.emailCountdownInterval = null;
    }

    const statusDiv = document.getElementById('globalEmailStatus');
    if (statusDiv) {
        statusDiv.style.display = 'none';
        statusDiv.innerHTML = '';
    }

    const timer = document.getElementById('emailHeaderTimer');
    if (timer) timer.style.display = 'none';
}

/**
 * Switch between "Send Now", "Automation", and "Email Logs" tabs inside the Global
 * Email Modal.
 */
function switchEmailTab(tab) {
    const sendPanel = document.getElementById('emailSendPanel');
    const schedulePanel = document.getElementById('emailSchedulePanel');
    const logsPanel = document.getElementById('emailLogsPanel');

    const sendBtn = document.getElementById('emailTabBtnSend');
    const scheduleBtn = document.getElementById('emailTabBtnSchedule');
    const logsBtn = document.getElementById('emailTabBtnLogs');

    const sendActionBtn = document.getElementById('globalEmailBtn');
    const timer = document.getElementById('emailHeaderTimer');

    const isAlreadySendPanelActive = sendPanel && sendPanel.style.display !== 'none';

    // Reset visibility
    if (sendPanel) sendPanel.style.display = 'none';
    if (schedulePanel) schedulePanel.style.display = 'none';
    if (logsPanel) logsPanel.style.display = 'none';

    if (sendBtn) { sendBtn.classList.remove('active'); sendBtn.style.background = 'transparent'; sendBtn.style.color = 'var(--text-muted)'; }
    if (scheduleBtn) { scheduleBtn.classList.remove('active'); scheduleBtn.style.background = 'transparent'; scheduleBtn.style.color = 'var(--text-muted)'; }
    if (logsBtn) { logsBtn.classList.remove('active'); logsBtn.style.background = 'transparent'; logsBtn.style.color = 'var(--text-muted)'; }

    if (tab === 'schedule') {
        if (schedulePanel) schedulePanel.style.display = 'block';
        if (scheduleBtn) { scheduleBtn.classList.add('active'); scheduleBtn.style.background = 'var(--primary)'; scheduleBtn.style.color = '#fff'; }
        if (sendActionBtn) sendActionBtn.style.display = 'none';
        if (timer) timer.style.display = 'none';
    } else if (tab === 'logs') {
        if (logsPanel) logsPanel.style.display = 'block';
        if (logsBtn) { logsBtn.classList.add('active'); logsBtn.style.background = 'var(--primary)'; logsBtn.style.color = '#fff'; }
        if (sendActionBtn) sendActionBtn.style.display = 'none';
        if (timer) timer.style.display = 'none';
        loadEmailLogs();
    } else {
        if (sendPanel) sendPanel.style.display = 'block';
        if (sendBtn) { sendBtn.classList.add('active'); sendBtn.style.background = 'var(--primary)'; sendBtn.style.color = '#fff'; }
        if (sendActionBtn) sendActionBtn.style.display = '';

        // If Send panel was ALREADY active when user clicked "Send Now" button, trigger email submission!
        if (isAlreadySendPanelActive && typeof submitGlobalEmail === 'function') {
            submitGlobalEmail();
        }
    }
}

/**
 * Fetch and render email audit logs table
 */
async function loadEmailLogs() {
    const listEl = document.getElementById('emailLogsList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;"><div class="loading-spinner" style="margin:0 auto 10px;"></div> Loading email audit trail...</div>';

    try {
        let res = await fetch('/api/email-logs').catch(() => null);
        if (!res || !res.ok) res = await fetch('api/email-logs');
        if (!res.ok) throw new Error('Failed to load logs');
        const data = await res.json();
        const logs = data.logs || [];

        if (logs.length === 0) {
            listEl.innerHTML = `
                <div style="padding:30px; text-align:center; color:var(--text-muted); font-size:13px;">
                    📭 No email logs recorded yet.<br>Emails sent via single or global dispatch will appear here.
                </div>
            `;
            return;
        }

        let html = `
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr style="background:var(--bg-input); color:var(--text-muted); text-align:left; border-bottom:1px solid var(--border);">
                        <th style="padding:10px 14px;">Date & Time</th>
                        <th style="padding:10px 14px;">Recipient (To)</th>
                        <th style="padding:10px 14px;">Subject / Report</th>
                        <th style="padding:10px 14px;">Status</th>
                        <th style="padding:10px 14px;">Details</th>
                    </tr>
                </thead>
                <tbody>
        `;

        logs.forEach(log => {
            const dateStr = log.sent_at ? new Date(log.sent_at).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            }) : 'N/A';

            const isSuccess = log.status === 'success';
            const badgeStyle = isSuccess 
                ? 'background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);'
                : 'background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);';

            const statusText = isSuccess ? '✅ Delivered' : '❌ Failed';
            const detailText = isSuccess ? 'Delivered via SMTP' : (log.error_message || 'Delivery error');

            html += `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px 14px; color:var(--text-muted); font-weight:500; white-space:nowrap;">${dateStr}</td>
                    <td style="padding:10px 14px; font-weight:600; color:var(--text-main);">${log.recipient || 'N/A'}</td>
                    <td style="padding:10px 14px; color:var(--text-main); font-weight:500;">
                        ${log.subject || (log.filename ? log.filename : 'Report Email')}
                    </td>
                    <td style="padding:10px 14px;">
                        <span style="padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700; ${badgeStyle}">
                            ${statusText}
                        </span>
                    </td>
                    <td style="padding:10px 14px; color:${isSuccess ? 'var(--text-muted)' : '#ef4444'}; font-size:11px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${detailText}">
                        ${detailText}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listEl.innerHTML = html;

    } catch (err) {
        listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444; font-size:13px;">❌ Error loading logs: ${err.message}</div>`;
    }
}

/**
 * Clear all email logs from DB
 */
async function clearEmailLogsUI() {
    if (!confirm('Are you sure you want to clear all email delivery logs?')) return;
    try {
        const res = await fetch('api/email-logs', { method: 'DELETE' });
        if (res.ok) {
            showToast('🗑️ Email logs cleared', 'success');
            loadEmailLogs();
        } else {
            throw new Error('Failed to clear');
        }
    } catch (err) {
        alert('Could not clear logs: ' + err.message);
    }
}

function openEmailLogsModal() {
    const modal = document.getElementById('globalEmailModal');
    if (modal) {
        modal.style.display = 'flex';
        switchEmailTab('logs');
    }
}
window.openEmailLogsModal = openEmailLogsModal;
window.loadEmailLogs = loadEmailLogs;
window.clearEmailLogsUI = clearEmailLogsUI;

/**
 * Fetch current automated-scheduling preferences from the backend and
 * populate the Automation tab fields.
 */
async function loadEmailScheduleSettings() {
    try {
        const res = await fetch('api/email-schedule');
        if (!res.ok) return;
        const data = await res.json();

        const enableToggle = document.getElementById('scheduleEnableToggle');
        const timeInput = document.getElementById('scheduleTimeInput');
        const toInput = document.getElementById('scheduleToInput');
        const ccInput = document.getElementById('scheduleCcInput');

        if (enableToggle) enableToggle.checked = !!data.enabled;
        if (timeInput) timeInput.value = data.time || '09:00';
        if (toInput) toInput.value = data.emailTo || '';
        if (ccInput) ccInput.value = data.emailCc || '';
    } catch (err) {
        console.warn('Failed to load email schedule settings:', err.message);
    }
}

/**
 * Purely visual feedback when the automation toggle is flipped
 * (no request is sent until "Save Schedule" is clicked).
 */
function onScheduleToggleChange() {
    const statusMsg = document.getElementById('scheduleStatusMsg');
    if (statusMsg) statusMsg.innerHTML = '';
}

/**
 * Persist automation schedule preferences to the backend.
 */
async function saveEmailSchedule() {
    const enabled = document.getElementById('scheduleEnableToggle').checked;
    const time = document.getElementById('scheduleTimeInput').value;
    const emailTo = document.getElementById('scheduleToInput').value.trim();
    const emailCc = document.getElementById('scheduleCcInput').value.trim();
    const statusMsg = document.getElementById('scheduleStatusMsg');
    const btn = document.getElementById('saveScheduleBtn');

    if (enabled && !emailTo) {
        alert('Please enter a default recipient email to enable automated scheduling.');
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Saving...'; }
    if (statusMsg) { statusMsg.style.color = 'var(--text-muted)'; statusMsg.innerHTML = 'Saving...'; }

    try {
        const res = await fetch('api/email-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled, time, emailTo, emailCc })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (statusMsg) { statusMsg.style.color = '#166534'; statusMsg.innerHTML = '✅ Schedule saved'; }
        } else {
            throw new Error(data.error || 'Failed to save schedule');
        }
    } catch (err) {
        if (statusMsg) { statusMsg.style.color = '#991b1b'; statusMsg.innerHTML = '❌ ' + err.message; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '💾 Save Schedule'; }
    }
}

/**
 * Populate Quick Select Presets Grid
 * Dynamically shows the previous 2 months, current month, and next 2
 * months (5 total) for each scheme, so the window always stays current
 * regardless of when the app is opened. Users can multi-select via
 * checkboxes styled as pills.
 */
function populateEmailPresets() {
    const container = document.getElementById('emailQuickSelectPresets');
    if (!container) return;

    const now = new Date();
    const currMonth = now.getMonth() + 1;
    const currYear = now.getFullYear();

    // Helper to get month/year object for a given offset from current month
    const getPeriod = (offset) => {
        let m = currMonth + offset;
        let y = currYear;
        while (m > 12) { m -= 12; y++; }
        while (m < 1) { m += 12; y--; }
        return { month: m, year: y };
    };

    // -2, -1, 0 (current), +1, +2
    const offsets = [-2, -1, 0, 1, 2];
    const periods = offsets.map(offset => {
        const p = getPeriod(offset);
        let label = 'Current';
        if (offset < 0) label = offset === -1 ? 'Previous' : `${Math.abs(offset)} Mo. Ago`;
        if (offset > 0) label = offset === 1 ? 'Next' : `In ${offset} Mo.`;
        return { ...p, label };
    });

    const schemes = [
        { id: 'nfsa', name: 'NFSA' },
        { id: 'mdm', name: 'MDM' },
        { id: 'icds', name: 'ICDS' },
        { id: 'welfare', name: 'Welfare' }
    ];

    container.innerHTML = schemes.map(s => `
        <div class="email-scheme-row">
            <div class="email-scheme-label">${s.name}</div>
            <div class="email-month-cells">
                ${periods.map(p => `
                    <label class="email-month-pill">
                        <input type="checkbox" class="email-period-check preset-check" onchange="this.closest('.email-month-pill').classList.toggle('checked', this.checked); updateEmailEstimate()"
                            data-month="${p.month}" data-year="${p.year}" data-scheme="${s.id}">
                        <span class="mp-month">${getMonthName(p.month)}</span>
                        <span class="mp-year">${p.year}</span>
                        <span class="mp-tag">${p.label}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function loadEmailSchemeGrid() {
    const grid = document.getElementById('schemeMonthGrid');
    if (!grid) return;

    // Fetch unique months from existing reports
    fetch('api/auth/available-periods')
        .then(res => res.json())
        .then(data => {
            grid.innerHTML = ''; // Clear first
            // Filter out NFSA_DATERANGE strictly (case-insensitive)
            const filteredData = data.filter(p => 
                p.scheme && 
                p.scheme.toLowerCase() !== 'nfsa_daterange' && 
                p.scheme.toLowerCase() !== 'daterange'
            );
            
            grid.innerHTML = filteredData.map(p => `
                <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="email-period-check history-check" onchange="updateEmailEstimate()" data-month="${p.month}" data-year="${p.year}" data-scheme="${p.scheme}">
                    <div style="flex:1;">
                        <div style="font-weight:700; font-size:12px; color:#1e293b;">${p.scheme.toUpperCase()}</div>
                        <div style="font-size:11px; color:#475569;">${getMonthName(p.month)} ${p.year}</div>
                    </div>
                </div>
            `).join('');
            updateEmailEstimate();
        })
        .catch(err => {
            grid.innerHTML = '<div style="color:#dc2626; font-size:12px;">Failed to load available reports.</div>';
        });
}

async function generateFreshSchemeForEmail(item, statusDiv, index, total) {
    let endpoint = 'api/generate-report';
    let body = { month: parseInt(item.month), year: parseInt(item.year) };

    if (item.scheme === 'nfsa_daterange') {
        endpoint = 'api/generate-nfsa-daterange-report';
        body.fromDate = item.fromDate;
        body.toDate = item.toDate;
    } else if (item.scheme !== 'nfsa') {
        endpoint = `api/generate-${item.scheme}-report`;
    }

    const startRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!startRes.ok) {
        let errTxt = '';
        try {
            const errData = await startRes.json();
            errTxt = errData.error || errData.message || '';
        } catch (e) {
            errTxt = `HTTP ${startRes.status}`;
        }
        throw new Error(`Failed to start ${item.scheme.toUpperCase()} generation: ${errTxt}`);
    }

    const startData = await startRes.json();
    const requestId = startData.requestId;
    if (!requestId) throw new Error(`No request ID returned for ${item.scheme.toUpperCase()}`);

    return new Promise((resolve, reject) => {
        const pollInt = setInterval(async () => {
            try {
                const statusRes = await fetch(`api/generate-status/${requestId}`);
                if (!statusRes.ok) return;
                const statusData = await statusRes.json();
                if (!statusData) return;

                const pct = statusData.progress || 0;
                const msg = statusData.message || statusData.status || 'processing';

                // Manual CAPTCHA Trigger (For Cloud / Render or local fallback)
                if (statusData.status === 'captcha_required' || statusData.captchaImage) {
                    openManualCaptchaModal(statusData.captchaImage, requestId, statusData.message);
                } else if (statusData.status !== 'initializing') {
                    closeManualCaptchaModal();
                }

                if (statusDiv) {
                    statusDiv.innerHTML = `🔄 [${index}/${total}] Fresh ${item.scheme.toUpperCase()} (${pct}%): ${msg}`;
                }

                if (statusData.status === 'complete') {
                    clearInterval(pollInt);
                    closeManualCaptchaModal();
                    resolve(statusData);
                } else if (statusData.status === 'error') {
                    clearInterval(pollInt);
                    closeManualCaptchaModal();
                    reject(new Error(statusData.error || `${item.scheme.toUpperCase()} extraction failed`));
                }
            } catch (e) {
                console.error(`Poll error for ${requestId}:`, e);
            }
        }, 1500);
    });
}

async function submitGlobalEmail(event) {
    if (event) event.preventDefault();
    
    const to = document.getElementById('globalEmailTo').value;
    const cc = document.getElementById('globalEmailCc') ? document.getElementById('globalEmailCc').value.trim() : '';
    const format = document.getElementById('globalEmailFormat').value;
    const allChecks = document.querySelectorAll('.email-period-check:checked');
    const statusDiv = document.getElementById('globalEmailStatus');
    
    if (!to) { alert('Please enter recipient email.'); return; }
    if (allChecks.length === 0) { alert('Please select at least one report.'); return; }

    // Separate history (cached) vs preset (fresh scrape) selections
    const historySchemes = [];
    const freshSchemes = [];
    
    allChecks.forEach(c => {
        const entry = { month: parseInt(c.dataset.month), year: parseInt(c.dataset.year), scheme: c.dataset.scheme };
        
        // If explicitly checked from History grid, use history; if checked from Preset pills, ALWAYS trigger fresh live scrape!
        if (c.classList.contains('history-check')) {
            historySchemes.push(entry);
        } else {
            freshSchemes.push(entry);
        }
    });

    const btn = document.getElementById('globalEmailBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-icon">⏳</span> Processing...'; }
    
    if (statusDiv) {
        statusDiv.style.display = 'flex';
        statusDiv.style.background = 'rgba(6,182,212,0.1)';
        statusDiv.style.color = 'var(--accent)';
        statusDiv.style.border = '1px solid rgba(6,182,212,0.2)';
    }

    // Estimate time: history reports are instant, fresh scrapes take ~120s each
    const freshCount = freshSchemes.length;
    const histCount = historySchemes.length;
    const estSeconds = (freshCount * 120) + (histCount * 3);
    if (freshCount > 0) {
        startLiveCountdown(estSeconds);
    }

    try {
        let successCount = 0;
        let errors = [];

        // Step 1: Send history reports instantly (no scraping)
        if (historySchemes.length > 0) {
            if (statusDiv) statusDiv.innerHTML = `📂 Sending ${histCount} cached report(s) from history to ${to}...`;
            const res = await fetch('/api/email-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailTo: to, cc, format, selectedSchemes: historySchemes, forceRefresh: false })
            });
            if (res.ok) {
                successCount++;
            } else {
                let errText = '';
                try {
                    const errData = await res.json();
                    errText = errData.error || errData.message || '';
                } catch (e) {
                    const rawText = await res.text().catch(() => '');
                    errText = rawText ? rawText.substring(0, 120) : `HTTP ${res.status} ${res.statusText}`;
                }
                console.warn('History batch failed:', errText);
                errors.push('History reports failed: ' + errText);
            }
        }

        if (freshSchemes.length > 0) {
            if (statusDiv) {
                statusDiv.style.display = 'flex';
                statusDiv.innerHTML = `🔄 Generating ${freshCount} fresh report(s) live from portal...`;
            }

            for (let i = 0; i < freshSchemes.length; i++) {
                const item = freshSchemes[i];
                try {
                    await generateFreshSchemeForEmail(item, statusDiv, i + 1, freshCount);
                } catch (genErr) {
                    console.warn(`Fresh generation failed for ${item.scheme}:`, genErr.message);
                    errors.push(`${item.scheme.toUpperCase()} fresh generation failed: ${genErr.message}`);
                }
            }

            if (statusDiv) statusDiv.innerHTML = `✉️ Emailing freshly generated report(s) to ${to}...`;
            const res = await fetch('/api/email-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailTo: to, cc, format, selectedSchemes: freshSchemes, forceRefresh: false })
            });
            if (res.ok) {
                successCount++;
            } else {
                let errText = '';
                try {
                    const errData = await res.json();
                    errText = errData.error || errData.message || '';
                } catch (e) {
                    const rawText = await res.text().catch(() => '');
                    errText = rawText ? rawText.substring(0, 120) : `HTTP ${res.status} ${res.statusText}`;
                }
                errors.push('Fresh bundle email delivery failed: ' + errText);
            }
        }

        if (window.emailCountdownInterval) clearInterval(window.emailCountdownInterval);
        
        if (successCount === 0 && errors.length > 0) {
            throw new Error(errors.join(' | '));
        } else if (successCount > 0 && errors.length > 0) {
            const warnText = `Email sent, but with errors: ${errors.join(' | ')}`;
            if (statusDiv) {
                statusDiv.style.background = 'rgba(245, 158, 11, 0.15)';
                statusDiv.style.color = '#b45309';
                statusDiv.style.border = '1px solid rgba(245, 158, 11, 0.3)';
                statusDiv.innerHTML = `⚠️ ${warnText}`;
            }
            showToast(`⚠️ Mail Task Warning: ${warnText}`, 'warning', 7000);
        } else if (successCount > 0) {
            const successText = `Mail sending task completed! Report(s) delivered to ${to}`;
            if (statusDiv) {
                statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
                statusDiv.style.color = '#047857';
                statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                statusDiv.innerHTML = `<div style="display:flex; align-items:center; gap:8px; font-weight:600;"><span style="font-size:16px;">🎉</span> ${successText}</div>`;
            }
            showToast(`📧 ${successText}`, 'success', 7000);
        }

        // Auto-refresh email logs table
        setTimeout(() => { loadEmailLogs(); }, 500);

    } catch (err) {
        if (window.emailCountdownInterval) clearInterval(window.emailCountdownInterval);
        let errorMsg = err.message || 'Unknown error';
        if (errorMsg.includes('Unexpected end of JSON input') || errorMsg.includes('Unexpected token')) {
            errorMsg = 'Server proxy / connection timed out during fresh live scraping. Please select a cached report from history or generate on main dashboard.';
        } else if (errorMsg === 'Failed to fetch') {
            errorMsg = 'Network response timed out while generating fresh reports live from portal. Please select cached reports or try again.';
        }
        if (statusDiv) {
            statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            statusDiv.style.color = '#b91c1c';
            statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            statusDiv.innerText = '❌ Mail Task Failed: ' + errorMsg;
        }
        showToast(`❌ Mail Task Failed: ${errorMsg}`, 'error', 7000);
        setTimeout(() => { loadEmailLogs(); }, 500);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">🚀</span> <span id="globalEmailBtnText">Send Now</span>'; }
    }
}

/**
 * Start a live countdown timer in the header
 */
function startLiveCountdown(totalSeconds) {
    const timer = document.getElementById('emailHeaderTimer');
    const display = document.getElementById('emailHeaderEstValue');
    if (!timer || !display) return;

    if (window.emailCountdownInterval) clearInterval(window.emailCountdownInterval);

    let remaining = totalSeconds;
    
    const update = () => {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        
        if (mins > 0) {
            display.innerText = `${mins}m ${secs}s`;
        } else {
            display.innerText = `${secs}s`;
        }

        if (remaining <= 0) {
            clearInterval(window.emailCountdownInterval);
            display.innerText = 'Finishing up...';
        }
        remaining--;
    };

    update();
    window.emailCountdownInterval = setInterval(update, 1000);
}

/**
 * Update time estimate for email bundle
 */
function updateEmailEstimate() {
    const checks = document.querySelectorAll('.email-period-check:checked');
    const timer = document.getElementById('emailHeaderTimer');
    const estValue = document.getElementById('emailHeaderEstValue');
    const statusText = document.getElementById('globalEmailStatusText');
    const statusDiv = document.getElementById('globalEmailStatus');
    
    if (checks.length === 0) {
        if (timer) timer.style.display = 'none';
        if (statusDiv) statusDiv.style.display = 'none';
        return;
    }

    let minSeconds = 0;
    let maxSeconds = 0;
    let freshCount = 0;
    let cachedCount = 0;

    const historyChecks = Array.from(document.querySelectorAll('.history-check'));

    checks.forEach(c => {
        const isPreset = c.classList.contains('preset-check');
        const existsInHistory = isPreset && historyChecks.some(hc => 
            hc.dataset.scheme === c.dataset.scheme && 
            parseInt(hc.dataset.month) === parseInt(c.dataset.month) && 
            parseInt(hc.dataset.year) === parseInt(c.dataset.year)
        );

        if (c.classList.contains('history-check') || existsInHistory) {
            // Cached, no scraping needed — nearly instant
            minSeconds += 3;
            maxSeconds += 5;
            cachedCount++;
        } else {
            // Fresh scrape from portal
            minSeconds += 45;
            maxSeconds += 90;
            freshCount++;
        }
    });

    if (timer) {
        timer.style.display = 'block';
        
        const totalMin = Math.ceil(minSeconds / 60);
        const totalMax = Math.ceil(maxSeconds / 60);
        
        if (totalMax <= 1) {
            estValue.innerText = 'Under 1 min';
        } else {
            estValue.innerText = `${totalMin}-${totalMax} mins`;
        }
    }

    if (statusDiv && statusText) {
        statusDiv.style.display = 'flex';
        if (freshCount > 0) {
            statusText.innerText = `Generating fresh data for ${freshCount} scheme(s)... This may take several minutes.`;
            statusDiv.style.color = 'var(--warning)';
            statusDiv.style.background = 'rgba(245,158,11,0.1)';
            statusDiv.style.borderColor = 'rgba(245,158,11,0.2)';
        } else {
            statusText.innerText = `All ${cachedCount} report(s) are cached. Email will be sent instantly.`;
            statusDiv.style.color = 'var(--success)';
            statusDiv.style.background = 'rgba(16,185,129,0.1)';
            statusDiv.style.borderColor = 'rgba(16,185,129,0.2)';
        }
    }
}


function addEmailSelection() {
    const scheme = document.getElementById('emailQuickScheme').value;
    const month = parseInt(document.getElementById('emailQuickMonth').value);
    const year = new Date().getFullYear(); // Default to current year
    const grid = document.getElementById('schemeMonthGrid');
    
    if (!grid) return;

    const schemesToAdd = scheme === 'all' ? ['nfsa', 'mdm', 'icds', 'welfare'] : [scheme];
    
    schemesToAdd.forEach(s => {
        // Check if already exists to prevent duplicates
        const existing = Array.from(grid.querySelectorAll('.email-period-check')).find(c => 
            parseInt(c.dataset.month) === month && c.dataset.scheme === s
        );
        
        if (!existing) {
            const div = document.createElement('div');
            div.style = "background:#f0f9ff; padding:10px; border-radius:8px; border:1px solid #bae6fd; display:flex; align-items:center; gap:10px; animation: slideIn 0.3s ease-out;";
            div.innerHTML = `
                <input type="checkbox" class="email-period-check" onchange="updateEmailEstimate()" data-month="${month}" data-year="${year}" data-scheme="${s}" checked>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:12px; color:#0369a1;">${s.toUpperCase()}</div>
                    <div style="font-size:11px; color:#0c4a6e;">${getMonthName(month)} ${year}</div>
                </div>
                <button type="button" onclick="this.parentElement.remove(); updateEmailEstimate();" style="background:none; border:none; color:#0369a1; cursor:pointer; font-size:16px;">&times;</button>
            `;
            grid.prepend(div);
            updateEmailEstimate();
        }
    });
}

/**
 * View detailed report in dashboard — shows Insights & Analytics panel
 */
async function viewReport(id) {
    try {
        const res = await fetch(`api/reports/${id}`);
        const data = await res.json();

        if (!data.insights) {
            alert('This report does not contain detailed analytics data. Try regenerating it.');
            return;
        }

        const insights = typeof data.insights === 'string' ? JSON.parse(data.insights) : data.insights;
        window.currentReportAnalytics = { 
            ...insights, 
            id: data.id,
            month: data.month, 
            year: data.year, 
            scheme: data.scheme,
            fromDate: data.from_date || insights.fromDate,
            toDate: data.to_date || insights.toDate
        };

        // Normalize scheme name for switchScheme
        let targetScheme = data.scheme || 'nfsa';
        if (targetScheme === 'nfsa_daterange') targetScheme = 'nfsa';

        // Switch to correct scheme tab (loads report history for that scheme)
        switchScheme(targetScheme);

        // Load balance report controls/filters
        await initBalanceReportControls(data.id, targetScheme);

        // Map scheme to its analytics section element ID
        const analyticsSectionMap = {
            'nfsa': data.scheme === 'nfsa_daterange' ? 'drAnalyticsSection' : 'analyticsSection',
            'mdm': 'mdmAnalyticsSection',
            'icds': 'icdsAnalyticsSection',
            'welfare': 'welfareAnalyticsSection'
        };

        // Hide all analytics sections first, then show the relevant one
        Object.values(analyticsSectionMap).forEach(secId => {
            const el = document.getElementById(secId);
            if (el) el.style.display = 'none';
        });

        // Render analytics data into the correct section
        if (targetScheme === 'nfsa') {
            if (data.scheme === 'nfsa_daterange') {
                displayNfsaDaterangeAnalytics(insights);
            } else {
                displayAnalytics(insights);
            }
        } else {
            const funcName = `display${targetScheme.toUpperCase()}Analytics`;
            if (window[funcName]) {
                window[funcName](insights);
            } else {
                console.warn(`Analytics function ${funcName} not found.`);
                alert(`Analytics display function not available for scheme: ${targetScheme}`);
                return;
            }
        }

        // Show the correct analytics section (displayX functions set display=block, but just to be safe)
        const analyticsSectionId = analyticsSectionMap[targetScheme];
        const analyticsSection = document.getElementById(analyticsSectionId);
        if (analyticsSection) {
            analyticsSection.style.display = 'block';

            // Show a banner indicating this is a historical view
            const subtitleId = targetScheme === 'nfsa'
                ? (data.scheme === 'nfsa_daterange' ? 'drAnalyticsSubtitle' : 'analyticsSubtitle')
                : `${targetScheme}AnalyticsSubtitle`;
            const subtitleEl = document.getElementById(subtitleId);
            if (subtitleEl) {
                if (data.scheme === 'nfsa_daterange') {
                    subtitleEl.innerHTML = `📅 तिथि सीमा (Date Range): <strong>${data.from_date || insights.fromDate} से ${data.to_date || insights.toDate}</strong> (रिपोर्ट निर्माण: ${new Date(data.generated_at).toLocaleDateString('en-GB')})`;
                } else {
                    subtitleEl.innerHTML = `📅 Viewing historical report: <strong>${getMonthName(data.month)} ${data.year}</strong> (Generated: ${new Date(data.generated_at).toLocaleDateString('en-GB')})`;
                }
                subtitleEl.style.color = '#4f46e5';
            }

            // Scroll smoothly to the analytics section
            setTimeout(() => analyticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }

    } catch (e) {
        console.error('View report error:', e);
        alert('Failed to load report insights: ' + (e.stack || e.message));
        window.lastErrorObj = e;
    }
}


/**
 * Delete a report
 */
async function deleteReport(id) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
    try {
        const response = await fetch(`api/reports/${id}`, { method: 'DELETE' });
        if (response.ok) {
            refreshReports();
        } else {
            const data = await response.json();
            alert('Failed to delete report: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Delete error:', e);
        alert('Error deleting report.');
    }
}

/**
 * Generate PDF for a report (handles all schemes automatically via backend)
 */
async function generatePDF(id, e) {
    const btn = e ? (e.currentTarget || e.target) : null;
    const originalContent = btn ? btn.innerHTML : null;
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> PDF...';
    }

    try {
        const response = await fetch(`api/generate-pdf/${id}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success && data.pdfUrl) {
            // Open in new tab automatically
            window.open(data.pdfUrl, '_blank');
            
            // Also trigger download as fallback
            const link = document.createElement('a');
            link.href = data.pdfUrl;
            link.download = data.filename || `report_${id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const errMsg = data.message || data.error || 'Unknown error';
            console.error('PDF generation failed:', errMsg);
            alert('Failed to generate PDF: ' + errMsg);
        }
    } catch (err) {
        console.error('PDF generation error:', err);
        alert('Error generating PDF: ' + (err.message || 'Network or server error. Check server logs.'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}
window.generatePDF = generatePDF;

/**
 * Selection and Bulk Actions
 */
function toggleSelectAll(scheme) {
    const selectAllId = scheme === 'nfsa' ? 'selectAll' : `${scheme}SelectAll`;
    const checkboxClass = scheme === 'nfsa' ? 'report-checkbox' : `${scheme}-report-checkbox`;
    
    const mainCheckbox = document.getElementById(selectAllId);
    if (!mainCheckbox) return;
    
    const checkboxes = document.querySelectorAll(`.${checkboxClass}`);
    checkboxes.forEach(cb => {
        cb.checked = mainCheckbox.checked;
    });
    
    updateDeleteButtonVisibility(scheme);
}

function updateDeleteButtonVisibility(scheme) {
    const checkboxClass = scheme === 'nfsa' ? 'report-checkbox' : `${scheme}-report-checkbox`;
    const deleteBtnId = scheme === 'nfsa' ? 'nfsaDeleteSelected' : `${scheme}DeleteSelected`;
    
    const checkboxes = document.querySelectorAll(`.${checkboxClass}`);
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    
    const deleteBtn = document.getElementById(deleteBtnId);
    if (deleteBtn) {
        deleteBtn.style.display = anyChecked ? 'inline-flex' : 'none';
        if (anyChecked) {
            const count = Array.from(checkboxes).filter(cb => cb.checked).length;
            deleteBtn.innerHTML = `🗑️ Delete Selected (${count})`;
        }
    }
}

async function deleteSelectedReports(scheme) {
    const checkboxClass = scheme === 'nfsa' ? 'report-checkbox' : `${scheme}-report-checkbox`;
    const checkboxes = document.querySelectorAll(`.${checkboxClass}:checked`);
    const ids = Array.from(checkboxes).map(cb => cb.value);
    
    if (ids.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${ids.length} selected reports? This cannot be undone.`)) {
        return;
    }
    
    const deleteBtnId = scheme === 'nfsa' ? 'nfsaDeleteSelected' : `${scheme}DeleteSelected`;
    const deleteBtn = document.getElementById(deleteBtnId);
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '⏳ Deleting...';
    }
    
    try {
        await Promise.all(ids.map(id => fetch(`api/reports/${id}`, { method: 'DELETE' })));
        refreshReports();
    } catch (e) {
        console.error('Bulk delete error:', e);
        alert('Failed to delete some reports.');
    } finally {
        if (deleteBtn) {
            deleteBtn.disabled = false;
            updateDeleteButtonVisibility(scheme);
        }
    }
}

/**
 * Universal Table Export to Excel / CSV with UTF-8 Devanagari Hindi BOM support
 */
function exportTableToExcel(target, filename) {
    let element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    let table = element.tagName === 'TABLE' ? element : element.querySelector('table');
    if (!table) {
        if (typeof showToast === 'function') showToast('❌ No table data found to export.', 'error');
        return;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
            let text = col.innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
            text = text.replace(/"/g, '""');
            rowData.push(`"${text}"`);
        });
        if (rowData.length > 0) csv.push(rowData.join(','));
    });

    const csvString = '\uFEFF' + csv.join('\n'); // UTF-8 BOM for Devanagari in Excel
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', (filename || 'Export') + '_' + new Date().toISOString().slice(0,10) + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === 'function') showToast('📊 Table exported to Excel/CSV successfully!', 'success');
}
window.exportTableToExcel = exportTableToExcel;

/**
 * Export a dashboard section as Image, PDF, or Excel
 */
async function exportDashboard(type, elementId, filenamePrefix) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Element not found for export:', elementId);
        return;
    }

    const btn = event ? (event.currentTarget || event.target) : null;
    const originalText = btn ? btn.innerHTML : null;
    if (btn) {
        btn.innerHTML = '⏳ Processing...';
        btn.disabled = true;
    }

    if (type === 'excel' || type === 'csv') {
        exportTableToExcel(elementId, filenamePrefix);
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        return;
    }

    try {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: isLight ? '#ffffff' : '#0d1526'
        });

        let displayFilename = filenamePrefix;
        if (window.currentReportAnalytics && window.currentReportAnalytics.month) {
            const monthName = getMonthName(window.currentReportAnalytics.month);
            const scheme = (window.currentReportAnalytics.scheme || currentScheme || '').toUpperCase();
            
            if (filenamePrefix === 'Sector_Details' || filenamePrefix === 'Pending_FPS') {
                displayFilename = `Pending_FPS_${monthName}`;
            } else {
                displayFilename = `${filenamePrefix}_${monthName}`;
            }
        } else {
            displayFilename = `${filenamePrefix}_${new Date().getTime()}`;
        }

        if (type === 'jpeg' || type === 'png') {
            const link = document.createElement('a');
            link.download = displayFilename + '.jpg';
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } else if (type === 'pdf') {
            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            const orientation = canvas.width > canvas.height ? 'l' : 'p';
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: 'a4'
            });
            
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10; // 10mm margin
            const maxW = pageWidth - (margin * 2);
            const maxH = pageHeight - (margin * 2);
            
            const ratio = canvas.width / canvas.height;
            let imgWidth = maxW;
            let imgHeight = maxW / ratio;
            
            if (imgHeight > maxH) {
                imgHeight = maxH;
                imgWidth = maxH * ratio;
            }
            
            pdf.addImage(imgData, 'JPEG', (pageWidth - imgWidth) / 2, margin, imgWidth, imgHeight);
            pdf.save(displayFilename + '.pdf');
            
            // Attempt to open in new window (might be blocked but good for "auto-open" request)
            try {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } catch (e) {
                console.warn('Auto-open blocked or failed:', e);
            }
        }
    } catch (e) {
        console.error('Export error:', e);
        alert('Failed to export: ' + e.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

/**
 * Toggle individual shop details within a sector card
 */
function toggleSectorShops(sectorId) {
    const el = document.getElementById('shops-' + sectorId);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
}


/**
 * Toggle NFSA Generation Mode (Monthly vs Date Range)
 */
function toggleNfsaMode(mode) {
    currentReportMode = mode;
    const monthlyForm = document.getElementById('generateForm');
    const daterangeForm = document.getElementById('generateDateRangeForm');
    const btnMonthly = document.getElementById('btnNfsaMonthly');
    const btnDaterange = document.getElementById('btnNfsaDateRange');
    const subActive = isSubViewActive();

    if (mode === 'monthly') {
        if (monthlyForm) monthlyForm.style.display = 'block';
        if (daterangeForm) daterangeForm.style.display = 'none';
        if (btnMonthly) {
            btnMonthly.classList.add('btn-primary');
            btnMonthly.classList.remove('btn-secondary');
            btnMonthly.style.backgroundColor = '';
            btnMonthly.style.color = '';
        }
        if (btnDaterange) {
            btnDaterange.classList.add('btn-secondary');
            btnDaterange.classList.remove('btn-primary');
            btnDaterange.style.backgroundColor = '#e2e8f0';
            btnDaterange.style.color = '#1e293b';
        }
        // Toggle History
        if (document.getElementById('nfsaReportHistorySection')) {
            document.getElementById('nfsaReportHistorySection').style.display = (subActive || currentScheme !== 'nfsa') ? 'none' : 'block';
        }
        if (document.getElementById('daterangeHistory')) {
            document.getElementById('daterangeHistory').style.display = 'none';
        }
        loadReports();
    } else {
        if (monthlyForm) monthlyForm.style.display = 'none';
        if (daterangeForm) daterangeForm.style.display = 'block';
        if (btnDaterange) {
            btnDaterange.classList.add('btn-primary');
            btnDaterange.classList.remove('btn-secondary');
            btnDaterange.style.backgroundColor = '';
            btnDaterange.style.color = '';
        }
        if (btnMonthly) {
            btnMonthly.classList.add('btn-secondary');
            btnMonthly.classList.remove('btn-primary');
            btnMonthly.style.backgroundColor = '#e2e8f0';
            btnMonthly.style.color = '#1e293b';
        }
        // Toggle History
        if (document.getElementById('nfsaReportHistorySection')) {
            document.getElementById('nfsaReportHistorySection').style.display = 'none';
        }
        if (document.getElementById('daterangeHistory')) {
            document.getElementById('daterangeHistory').style.display = (subActive || currentScheme !== 'nfsa') ? 'none' : 'block';
        }
        
        // Load and show daterange history
        loadDaterangeReports(); 
    }
}

/**
 * Toggle Sector-wise Matrix visibility
 */
function toggleMatrix() {
    const sectionId = currentScheme === 'nfsa' ? (currentReportMode === 'daterange' ? 'drMatrixSection' : 'matrixSection') : (currentScheme + 'MatrixSection');
    const tbodyId = currentScheme === 'nfsa' ? (currentReportMode === 'daterange' ? 'drMatrixTableBody' : 'matrixTableBody') : (currentScheme + 'MatrixTableBody');
    
    const section = document.getElementById(sectionId);
    const tbody = document.getElementById(tbodyId);

    if (section && section.style.display === 'block') {
        section.style.display = 'none';
        return;
    }

    const items = window.currentReportAnalytics && (window.currentReportAnalytics.allSectors || window.currentReportAnalytics.matrix);

    if (section && tbody && items) {
        section.style.display = 'block';
        
        // Setup Date Range heading date range if not set
        const drRangeEl = document.getElementById('drMatrixDateRange');
        if (drRangeEl && window.currentReportAnalytics && window.currentReportAnalytics.fromDate && window.currentReportAnalytics.toDate) {
            drRangeEl.textContent = `(दिनांक ${window.currentReportAnalytics.fromDate} से ${window.currentReportAnalytics.toDate})`;
        }

        tbody.innerHTML = items.map((s, i) => {
            if (currentReportMode === 'daterange') {
                const disp = parseFloat(s.totalDispatched || s.dispatch || 0);
                const isZero = disp === 0;
                
                const bgColor = i % 2 === 0 ? '#0f172a' : '#1e293b';
                const dispColor = isZero ? '#94a3b8' : '#4ade80';
                const datesStr = s.dispatchDates && s.dispatchDates.length > 0 ? s.dispatchDates.join(', ') : '-';

                return `
                <tr style="background:${bgColor}; border-bottom:1px solid #334155; transition: background 0.2s ease;">
                    <td style="text-align:center; padding:12px; border-right:1px solid #334155; color:#cbd5e1; font-size:13px;">${i + 1}</td>
                    <td style="text-align:left; padding:12px; font-weight:500; border-right:1px solid #334155; color:white; font-size:14px;">${escapeHtml(s.name)}</td>
                    <td style="text-align:center; padding:12px; font-weight:700; color:${dispColor}; border-right:1px solid #334155; font-size:14px;">${disp.toFixed(2)} Qt</td>
                    <td style="text-align:center; padding:12px; border-right:1px solid #334155; color:#cbd5e1; font-size:13px;">${escapeHtml(datesStr)}</td>
                    <td style="text-align:center; padding:12px; color:#cbd5e1; font-size:13px;">${escapeHtml(s.transporter || '-')}</td>
                </tr>`;
            }
            const dispatchPct = s.dispatchPercentage !== undefined ? s.dispatchPercentage :
                                (s.totalAllotted > 0 ? (s.totalDispatched / s.totalAllotted) * 100 : 0);
            const receivingPct = s.receivingPercentage !== undefined ? s.receivingPercentage :
                                 (s.totalAllotted > 0 ? (s.totalReceived / s.totalAllotted) * 100 : 0);
            const balance = s.balance !== undefined ? s.balance :
                            ((s.totalAllotted !== undefined && s.totalDispatched !== undefined) ? s.totalAllotted - s.totalDispatched : 0);
            return `
            <tr>
                <td style="font-weight:700; color:#1e293b; text-align:left;">${escapeHtml(s.name)}</td>
                <td style="text-align:center; font-weight:600;">${(dispatchPct || 0).toFixed(2)}%</td>
                <td style="text-align:center; font-weight:600;">${(receivingPct || 0).toFixed(2)}%</td>
                <td style="text-align:center; font-weight:800; color:${getStatusColor(dispatchPct)};">${parseFloat(balance || 0).toFixed(2)} Qt</td>
            </tr>`;
        }).join('');
        
        // Ensure table alignment for header consistency
        const table = tbody.closest('table');
        if (table) {
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
        }

        setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } else {
        alert('Detailed matrix data is not available for this report view.');
    }
}
window.toggleMatrix = toggleMatrix;
window.toggleNfsaMode = toggleNfsaMode;
window.toggleSectorShops = toggleSectorShops;
window.toggleActiveShopsDetails = toggleActiveShopsDetails;
window.exportDashboard = exportDashboard;

/**
 * Single-Report Email Modal Functions
 * Used by the per-row "Email" button in report history tables.
 */
function openEmailModal(reportId, scheme) {
    const modal = document.getElementById('emailReportModal');
    if (!modal) return;

    // Store values in hidden field and scheme label
    document.getElementById('emailReportId').value = reportId;
    const schemeEl = document.getElementById('emailReportScheme');
    if (schemeEl) schemeEl.textContent = (scheme || 'Report').toUpperCase();

    // Pre-fill recipient/CC from global email fields if available
    const globalTo = document.getElementById('globalEmailTo');
    const globalCc = document.getElementById('globalEmailCc');
    const toInput = document.getElementById('emailToInput');
    const ccInput = document.getElementById('emailCcInput');
    if (toInput && globalTo && globalTo.value) toInput.value = globalTo.value;
    if (ccInput) ccInput.value = (globalCc && globalCc.value) ? globalCc.value : '';

    // Clear status message
    const statusMsg = document.getElementById('emailStatusMessage');
    if (statusMsg) statusMsg.innerHTML = '';

    modal.style.display = 'flex';
    if (toInput) setTimeout(() => toInput.focus(), 100);
}

function closeEmailModal() {
    const modal = document.getElementById('emailReportModal');
    if (modal) modal.style.display = 'none';

    const statusMsg = document.getElementById('emailStatusMessage');
    if (statusMsg) statusMsg.innerHTML = '';

    const btn = document.getElementById('sendEmailBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Email'; }
}

/* ── Global Toast Notifications ───────────────────────────────── */
function showToast(message, type = 'success', duration = 5000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:10px; max-width:420px; pointer-events:none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    toast.style.cssText = `background:${bg}; color:#ffffff; padding:14px 20px; border-radius:12px; font-size:13px; font-weight:600; font-family:var(--font-family, sans-serif); box-shadow:0 10px 30px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:space-between; gap:12px; pointer-events:auto; animation:slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1);`;
    
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">${message}</div>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; font-size:16px; cursor:pointer; opacity:0.8; padding:0; margin-left:8px;">&times;</button>
    `;

    if (!document.getElementById('toastStyle')) {
        const style = document.createElement('style');
        style.id = 'toastStyle';
        style.innerHTML = `
            @keyframes slideInToast {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
window.showToast = showToast;

async function submitEmailReport() {
    const reportId = document.getElementById('emailReportId').value;
    const emailTo = document.getElementById('emailToInput').value.trim();
    const ccInput = document.getElementById('emailCcInput');
    const cc = ccInput ? ccInput.value.trim() : '';
    const statusMsg = document.getElementById('emailStatusMessage');
    const btn = document.getElementById('sendEmailBtn');

    if (!emailTo) {
        alert('Please enter a recipient email address.');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending...'; }
    if (statusMsg) {
        statusMsg.style.color = '#1e40af';
        statusMsg.innerHTML = '⚙️ Preparing and sending report...';
    }

    try {
        const res = await fetch('api/email-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId, emailTo, cc, format: 'pdf', scheme: null })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            const successText = `Mail sending task completed! Report delivered to ${emailTo}`;
            if (statusMsg) {
                statusMsg.style.color = '#166534';
                statusMsg.innerHTML = `✅ ${successText}`;
            }
            showToast(`📧 ${successText}`, 'success', 6000);
            setTimeout(() => closeEmailModal(), 2500);
        } else {
            throw new Error(data.details || data.error || 'Unknown error');
        }
    } catch (err) {
        if (statusMsg) {
            statusMsg.style.color = '#991b1b';
            statusMsg.innerHTML = `❌ Failed: ${err.message}`;
        }
        showToast(`❌ Mail Task Failed: ${err.message}`, 'error', 6000);
        if (btn) { btn.disabled = false; btn.textContent = 'Send Email'; }
    }
}

// Expose to global scope (called from inline onclick in HTML)
window.openEmailModal = openEmailModal;
window.closeEmailModal = closeEmailModal;
window.submitEmailReport = submitEmailReport;
window.switchEmailTab = switchEmailTab;
window.onScheduleToggleChange = onScheduleToggleChange;
window.saveEmailSchedule = saveEmailSchedule;
window.loadEmailScheduleSettings = loadEmailScheduleSettings;

/**
 * Shop Balances Reports Control Logic
 */
async function initBalanceReportControls(reportId, scheme) {
    // Hide all balance report cards first
    ['nfsa', 'mdm', 'icds', 'welfare'].forEach(s => {
        const card = document.getElementById(`${s}BalanceReportCard`);
        if (card) card.style.display = 'none';
        closeBalanceReportPreview(s);
    });

    // Hide pending analytics panel until filters are ready
    const pendingCard = document.getElementById('pendingAnalyticsCard');
    if (pendingCard) pendingCard.style.display = 'none';

    if (!reportId || !['nfsa', 'mdm', 'icds', 'welfare'].includes(scheme)) {
        return;
    }

    try {
        const filterRes = await fetch(`/api/reports/${reportId}/balances/filters`);
        const filters = await filterRes.json();
        window.currentReportFiltersData = filters;
        
        const card = document.getElementById(`${scheme}BalanceReportCard`);
        if (card) {
            card.style.display = 'block';
            const selectEl = document.getElementById(`${scheme}BalanceReportType`);
            if (selectEl) {
                selectEl.value = 'transporter';
                onBalanceReportTypeChange(scheme, 'transporter');
            }
        }

        // Initialize the pending analytics panel (runs in background, don't await)
        initPendingAnalyticsPanel(reportId, scheme).catch(e => console.warn('Pending panel init failed:', e));

    } catch (err) {
        console.error('Failed to initialize balance report filters:', err);
    }
}


function onBalanceReportTypeChange(scheme, type) {
    const valueContainer = document.getElementById(`${scheme}BalanceValueSelectContainer`);
    const valueSelect = document.getElementById(`${scheme}BalanceValueSelect`);
    const labelEl = document.getElementById(`${scheme}BalanceValueLabel`);
    
    if (!valueContainer || !valueSelect || !window.currentReportFiltersData) return;

    if (type === 'individual_transporter') {
        valueContainer.style.display = 'block';
        labelEl.innerText = 'परिवहनकर्ता चुनें (Select Transporter):';
        
        const list = window.currentReportFiltersData.transporters || [];
        valueSelect.innerHTML = list.map(t => `<option value="${t}">${t}</option>`).join('');
    } else if (type === 'individual_depot') {
        valueContainer.style.display = 'block';
        labelEl.innerText = 'प्रदाय केंद्र चुनें (Select Issue Center):';
        
        const list = window.currentReportFiltersData.depots || [];
        valueSelect.innerHTML = list.map(d => `<option value="${d}">${d}</option>`).join('');
    } else {
        valueContainer.style.display = 'none';
        valueSelect.innerHTML = '';
    }
}

async function downloadBalanceReport(format, buttonEl, scheme) {
    const reportId = window.currentReportAnalytics ? window.currentReportAnalytics.id : null;
    if (!reportId) {
        alert('No report loaded.');
        return;
    }
    
    const typeEl = document.getElementById(`${scheme}BalanceReportType`);
    const valueEl = document.getElementById(`${scheme}BalanceValueSelect`);
    const type = typeEl ? typeEl.value : 'transporter';
    const value = (valueEl && (type === 'individual_transporter' || type === 'individual_depot')) ? valueEl.value : '';
    
    // Disable button to prevent double submission
    const originalContent = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `⏳ Downloading...`;
    
    try {
        const queryParams = new URLSearchParams({ type, value }).toString();
        const url = `/api/reports/${reportId}/balances/${format}?${queryParams}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            buttonEl.disabled = false;
            buttonEl.innerHTML = originalContent;
        }, 3000);
    } catch (err) {
        console.error('Download balance report error:', err);
        alert('Download failed. Please check the logs.');
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalContent;
    }
}

async function downloadBalanceReportImage(scheme) {
    const iframe = document.getElementById(`${scheme}BalanceReportPreviewIframe`);
    const previewSection = document.getElementById(`${scheme}BalanceReportPreviewSection`);

    // Check if preview section is visible and iframe has content
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    const hasContent = iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML.trim().length > 0;

    if (!iframe || !previewSection || previewSection.style.display === 'none' || !hasContent) {
        alert('कृपया पहले "👁️ देखें" बटन दबाकर रिपोर्ट प्रीव्यू खोलें, उसके बाद इमेज सेव करें।\n\n(Please click "👁️ देखें" to view the report first, then export as Image.)');
        return;
    }
    try {
        // Brief delay to ensure rendering is complete
        await new Promise(r => setTimeout(r, 600));

        // Capture the full iframe body
        const canvas = await html2canvas(iframeDoc.body, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            width: iframeDoc.body.scrollWidth,
            height: iframeDoc.body.scrollHeight,
            windowWidth: iframeDoc.body.scrollWidth,
            windowHeight: iframeDoc.body.scrollHeight
        });

        const monthNames = { 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' };
        const month = window.currentReportAnalytics ? window.currentReportAnalytics.month : '';
        const year = window.currentReportAnalytics ? window.currentReportAnalytics.year : '';
        const monthFile = month ? (monthNames[month] || getMonthName(month)) : '';
        const schemeFile = scheme === 'welfare' ? 'Welfare_KKY' : scheme.toUpperCase();

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const link = document.createElement('a');
        link.download = `Balance_Shops_${schemeFile}_${monthFile}_${year}.jpg`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error generating image:', error);
        alert('इमेज बनाने में समस्या आई। कृपया रिपोर्ट प्रीव्यू पूरी तरह लोड होने के बाद दोबारा कोशिश करें।\n\nError: ' + error.message);
    }
}


let currentMessengerDefaulters = [];
let currentMessengerTargetRole = '';

async function openMessengerModal(scheme) {
    const reportId = window.currentReportAnalytics ? window.currentReportAnalytics.id : null;
    if (!reportId) {
        alert('No report loaded.');
        return;
    }
    
    const typeEl = document.getElementById(`${scheme}BalanceReportType`);
    const valueEl = document.getElementById(`${scheme}BalanceValueSelect`);
    const type = typeEl ? typeEl.value : 'transporter';
    const value = (valueEl && (type === 'individual_transporter' || type === 'individual_depot')) ? valueEl.value : '';
    
    try {
        const queryParams = new URLSearchParams({ type, value }).toString();
        const response = await fetch(`/api/reports/${reportId}/balances/defaulters?${queryParams}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status}`);
        }
        
        currentMessengerDefaulters = await response.json();
        
        if (type === 'transporter') currentMessengerTargetRole = 'All Transporters';
        else if (type === 'individual_transporter') currentMessengerTargetRole = `Transporter: ${value}`;
        else if (type === 'depot') currentMessengerTargetRole = 'All Issue Centers';
        else if (type === 'individual_depot') currentMessengerTargetRole = `Issue Center: ${value}`;
        
        const roleEl = document.getElementById('messengerTargetRole');
        if (roleEl) roleEl.innerText = currentMessengerTargetRole;
        const countEl = document.getElementById('messengerDefaulterCount');
        if (countEl) countEl.innerText = currentMessengerDefaulters.length;
        
        const modalEl = document.getElementById('defaultersMessengerModal');
        if (modalEl) modalEl.style.display = 'flex';
        updateDefaultersPreview();
        
    } catch (error) {
        console.error('Error opening messenger:', error);
        alert('Could not load defaulters for messenger: ' + error.message);
    }
}

function updateDefaultersPreview() {
    const levelEl = document.querySelector('input[name="warningLevel"]:checked');
    const level = levelEl ? levelEl.value : 'simple';
    const previewBox = document.getElementById('defaulterMessagePreview');
    if (!previewBox) return;
    
    if (!currentMessengerDefaulters || currentMessengerDefaulters.length === 0) {
        previewBox.innerText = "No defaulters found for the selected filter. Everyone has completed their lifting! 🎉";
        return;
    }
    
    let msg = '';
    const primaryRole = (currentMessengerDefaulters[0] && currentMessengerDefaulters[0].role) ? currentMessengerDefaulters[0].role : 'संबंधित अधिकारी / परिवहनकर्ता';

    
    if (level === 'simple') {
        if (primaryRole.includes('केंद्र')) {
            msg += `⚠️ ${primaryRole} को सूचित किया जाता है कि कुछ दुकानों का उठाव लंबित है। कृपया तत्काल उठाव सुनिश्चित करें।\n\n`;
        } else {
            msg += `⚠️ ${primaryRole} को सूचित किया जाता है कि संबंधित दुकानों हेतु परिवहन/उठाव कार्य लंबित है। कृपया तत्काल कार्यवाही सुनिश्चित करें।\n\n`;
        }
    } else {
        if (primaryRole.includes('केंद्र')) {
            if (primaryRole.includes(',')) {
                msg += `⚠️ ${primaryRole} — आपके केंद्र से संबंधित दुकानों का उठाव लंबित है। विलंब के कारण आवंटन लैप्स होने की स्थिति में व्यक्तिगत जिम्मेदारी निर्धारित की जाएगी।\n\n`;
            } else {
                msg += `⚠️ ${primaryRole} को सूचित किया जाता है कि आवंटित सामग्री का उठाव अभी तक पूर्ण नहीं किया गया है। विलंब के कारण आवंटन लैप्स होने की स्थिति निर्मित हो रही है। कृपया तत्काल उठाव सुनिश्चित करें, अन्यथा व्यक्तिगत जवाबदेही निर्धारित की जाएगी।\n\n`;
            }
        } else {
            if (primaryRole.includes(',')) {
                msg += `⚠️ ${primaryRole} — आपके अंतर्गत लंबित दुकानों का उठाव/परिवहन कार्य अभी तक पूर्ण नहीं हुआ है। विलंब के कारण आवंटन लैप्स होने की स्थिति में व्यक्तिगत जिम्मेदारी तय की जाएगी।\n\n`;
            } else {
                msg += `⚠️ ${primaryRole} को सूचित किया जाता है कि संबंधित दुकानों हेतु परिवहन/उठाव कार्य लंबित है। विलंब के कारण आवंटन लैप्स होने पर व्यक्तिगत दायित्व निर्धारित किया जाएगा।\n\n`;
            }
        }
    }
    
    const totalPendingShops = currentMessengerDefaulters.reduce((a,b)=>a+parseInt(b.pendingShops||0), 0);
    msg += `लंबित संख्या: ${totalPendingShops}\nकुल शेष मात्रा: ${currentMessengerDefaulters.reduce((a,b)=>a+parseFloat(b.totalBalance),0).toFixed(2)} Qt\n`;
    
    // Aggregate issue center breakdown
    const centerAgg = {};
    currentMessengerDefaulters.forEach(d => {
        if (d.centerBreakdown) {
            d.centerBreakdown.forEach(cb => {
                if (!centerAgg[cb.center]) centerAgg[cb.center] = { shops: 0, qty: 0 };
                centerAgg[cb.center].shops += parseInt(cb.pendingShops);
                centerAgg[cb.center].qty += parseFloat(cb.balance);
            });
        }
    });

    const centers = Object.keys(centerAgg);
    if (centers.length > 0) {
        msg += `\n*केंद्रवार विवरण:*\n`;
        centers.sort((a,b)=> centerAgg[b].qty - centerAgg[a].qty).forEach((c, i) => {
            msg += `${i+1}. ${c}: ${centerAgg[c].shops} दुकानें (${centerAgg[c].qty.toFixed(2)} Qt)\n`;
        });
    }
    
    previewBox.innerText = msg;
}

function sendDefaultersWhatsApp() {
    const text = document.getElementById('defaulterMessagePreview').innerText;
    if (!text || currentMessengerDefaulters.length === 0) return;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.location.href = url;
}

function copyDefaulterMessage() {
    const text = document.getElementById('defaulterMessagePreview').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Message copied to clipboard!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

async function viewBalanceReport(buttonEl, scheme) {
    const reportId = window.currentReportAnalytics ? window.currentReportAnalytics.id : null;
    if (!reportId) {
        alert('No report loaded.');
        return;
    }

    const typeEl = document.getElementById(`${scheme}BalanceReportType`);
    const valueEl = document.getElementById(`${scheme}BalanceValueSelect`);
    const type = typeEl ? typeEl.value : 'transporter';
    const value = (valueEl && (type === 'individual_transporter' || type === 'individual_depot')) ? valueEl.value : '';

    // Disable button and show spinner
    const originalContent = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `⏳ Loading View...`;

    try {
        const queryParams = new URLSearchParams({ type, value }).toString();
        const url = `/api/reports/${reportId}/balances/html?${queryParams}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load preview');
        const htmlContent = await res.text();

        const previewSection = document.getElementById(`${scheme}BalanceReportPreviewSection`);
        const iframe = document.getElementById(`${scheme}BalanceReportPreviewIframe`);

        if (previewSection && iframe) {
            previewSection.style.display = 'block';
            
            // Write htmlContent to iframe context for style isolation
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Scroll preview section into view
            setTimeout(() => {
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        buttonEl.disabled = false;
        buttonEl.innerHTML = originalContent;
    } catch (err) {
        console.error('View balance report error:', err);
        alert('Failed to load report preview. Please check logs.');
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalContent;
    }
}

function closeBalanceReportPreview(scheme) {
    const previewSection = document.getElementById(`${scheme}BalanceReportPreviewSection`);
    const iframe = document.getElementById(`${scheme}BalanceReportPreviewIframe`);
    
    if (previewSection) {
        previewSection.style.display = 'none';
    }
    if (iframe) {
        // Clear iframe to free memory
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write('');
        doc.close();
    }
}

// ════════════════════════════════════════════════════════════════
//  PENDING DISPATCH ANALYTICS — Transporter / Issue Center wise
// ════════════════════════════════════════════════════════════════

let _pendingDebounceTimer = null;

/**
 * Initialize the pending analytics panel when a report is loaded.
 * Fetches available transporters/issuecenter filters and shows the panel.
 */
async function initPendingAnalyticsPanel(reportId, scheme) {
    const card = document.getElementById('pendingAnalyticsCard');
    if (!card) return;

    // Only show for schemes that have shop-level data
    if (!['nfsa', 'mdm', 'icds', 'welfare'].includes(scheme)) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

    // Populate filter dropdowns from already-fetched filters
    const filters = window.currentReportFiltersData || { transporters: [], depots: [] };

    const tSelect = document.getElementById('pendingFilterTransporter');
    const icSelect = document.getElementById('pendingFilterIssueCenter');
    if (tSelect) {
        tSelect.innerHTML = '<option value="">All Transporters</option>' +
            (filters.transporters || []).map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }
    if (icSelect) {
        icSelect.innerHTML = '<option value="">All Issue Centers</option>' +
            (filters.depots || []).map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    }

    // Store reportId for later use
    card.dataset.reportId = reportId;

    // Reset view to initial prompt state — DO NOT auto-generate report until user asks by clicking Generate Report
    const promptEl = document.getElementById('pendingAnalyticsPrompt');
    if (promptEl) promptEl.style.display = 'block';
    const tableContainer = document.getElementById('pendingAnalyticsTableContainer');
    if (tableContainer) tableContainer.style.display = 'none';
    const loader = document.getElementById('pendingAnalyticsLoader');
    if (loader) loader.style.display = 'none';
    const empty = document.getElementById('pendingAnalyticsEmpty');
    if (empty) empty.style.display = 'none';

    ['pendingExcelBtn','pendingPdfBtn','pendingImgBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

/**
 * Called whenever any filter/sort dropdown changes.
 * Updates data ONLY if report has already been generated by user; otherwise keeps prompt.
 */
function pendingAnalyticsFilterChanged() {
    const tableContainer = document.getElementById('pendingAnalyticsTableContainer');
    // Only auto-update if report is already generated on screen
    if (tableContainer && tableContainer.style.display !== 'none') {
        clearTimeout(_pendingDebounceTimer);
        _pendingDebounceTimer = setTimeout(() => {
            const card = document.getElementById('pendingAnalyticsCard');
            const reportId = card ? card.dataset.reportId : null;
            if (reportId) loadPendingSummary(reportId);
        }, 350);
    }
}

/**
 * Manually generate/refresh pending dispatch analysis report on user demand.
 */
async function generatePendingSummaryReport(btnEl) {
    const card = document.getElementById('pendingAnalyticsCard');
    const reportId = card ? card.dataset.reportId : null;
    if (!reportId) {
        alert('No report loaded. Please select or generate a base report first.');
        return;
    }

    const origContent = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>⏳</span> <span>Generating...</span>`;
    }

    try {
        await loadPendingSummary(reportId);
    } catch (err) {
        console.error('Error generating pending summary report:', err);
    } finally {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = origContent;
        }
    }
}

/**
 * Fetch summary from backend and render the table.
 */
async function loadPendingSummary(reportId) {
    if (!reportId) return;

    const groupBy = document.getElementById('pendingGroupBy')?.value || 'transporter';
    const sortBy  = document.getElementById('pendingSortBy')?.value || 'pendingQty';
    const filterTransporter  = document.getElementById('pendingFilterTransporter')?.value || '';
    const filterIssueCenter  = document.getElementById('pendingFilterIssueCenter')?.value || '';

    // Update header label
    const headerEl = document.getElementById('pendingGroupHeader');
    if (headerEl) {
        headerEl.textContent = groupBy === 'issuecenter' ? 'प्रदाय केंद्र' : 'परिवहनकर्ता (सेक्टर क्र. एवं नाम)';
    }

    // Hide prompt, show loader
    const promptEl = document.getElementById('pendingAnalyticsPrompt');
    if (promptEl) promptEl.style.display = 'none';

    document.getElementById('pendingAnalyticsLoader').style.display = 'block';
    document.getElementById('pendingAnalyticsEmpty').style.display = 'none';
    document.getElementById('pendingAnalyticsTableContainer').style.display = 'none';
    ['pendingExcelBtn','pendingPdfBtn','pendingImgBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    try {
        const params = new URLSearchParams({ groupBy, sortBy });
        if (filterTransporter) params.set('filterTransporter', filterTransporter);
        if (filterIssueCenter) params.set('filterIssueCenter', filterIssueCenter);

        const res = await fetch(`/api/reports/${reportId}/balances/pending-summary?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        document.getElementById('pendingAnalyticsLoader').style.display = 'none';

        if (!data.rows || data.rows.length === 0) {
            document.getElementById('pendingAnalyticsEmpty').style.display = 'block';
            return;
        }

        renderPendingSummaryTable(data);

        document.getElementById('pendingAnalyticsTableContainer').style.display = 'block';
        ['pendingExcelBtn','pendingPdfBtn','pendingImgBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'inline-flex';
        });

        // Also load HTML preview for image export
        loadPendingSummaryPreview(reportId, params);

    } catch (err) {
        console.error('Pending summary load error:', err);
        document.getElementById('pendingAnalyticsLoader').style.display = 'none';
        document.getElementById('pendingAnalyticsEmpty').style.display = 'block';
        document.getElementById('pendingAnalyticsEmpty').innerHTML = `<span style="font-size:24px;">⚠️</span><br><span style="font-size:13px;color:var(--error);">Failed to load: ${err.message}</span>`;
    }
}

/**
 * Render rows + grand total into the table.
 */
function renderPendingSummaryTable(data) {
    const tbody = document.getElementById('pendingAnalyticsTbody');
    const tfoot = document.getElementById('pendingAnalyticsTfoot');
    if (!tbody || !tfoot) return;

    tbody.innerHTML = data.rows.map((r, idx) => {
        const highPending = r.pendingShops > 5;
        const shopCell = `<td style="text-align:center;font-weight:700;${highPending ? 'color:#dc2626;' : 'color:var(--text-main);'}">${r.pendingShops || 0}</td>`;
        return `<tr style="transition:background .15s;" onmouseover="this.style.background='rgba(79,70,229,0.06)'" onmouseout="this.style.background=''">
            <td style="text-align:center;color:var(--text-muted);font-size:12px;">${idx + 1}</td>
            <td style="text-align:left;font-weight:600;padding:8px 10px;">${escapeHtml(r.displayLabel || r.group)}</td>
            ${shopCell}
            <td style="text-align:center;font-weight:800;color:#ef4444;">${(r.pendingQty || 0).toFixed(2)}</td>
            <td style="text-align:center;border-left:2px solid rgba(59,130,246,0.2);background:rgba(59,130,246,0.04);font-size:12px;">${r.rice?.shops || 0}</td>
            <td style="text-align:center;background:rgba(59,130,246,0.04);font-size:12px;color:#3b82f6;font-weight:600;">${(r.rice?.qty || 0).toFixed(2)}</td>
            <td style="text-align:center;border-left:2px solid rgba(251,191,36,0.25);background:rgba(251,191,36,0.04);font-size:12px;">${r.wheat?.shops || 0}</td>
            <td style="text-align:center;background:rgba(251,191,36,0.04);font-size:12px;color:#d97706;font-weight:600;">${(r.wheat?.qty || 0).toFixed(2)}</td>
            <td style="text-align:center;border-left:2px solid rgba(16,185,129,0.25);background:rgba(16,185,129,0.04);font-size:12px;">${r.salt?.shops || 0}</td>
            <td style="text-align:center;background:rgba(16,185,129,0.04);font-size:12px;color:#059669;font-weight:600;">${(r.salt?.qty || 0).toFixed(2)}</td>
        </tr>`;
    }).join('');

    const gt = data.grandTotal || { pendingShops: 0, pendingQty: 0, rice: {}, wheat: {}, salt: {} };
    tfoot.innerHTML = `<tr style="background:linear-gradient(90deg,rgba(251,191,36,0.18),rgba(251,191,36,0.08));font-weight:800;font-size:13px;border-top:2px solid rgba(251,191,36,0.5);">
        <td style="text-align:center;" colspan="2">🏁 कुल योग (Grand Total)</td>
        <td style="text-align:center;color:#dc2626;">${gt.pendingShops || 0}</td>
        <td style="text-align:center;color:#dc2626;">${(gt.pendingQty || 0).toFixed(2)}</td>
        <td style="text-align:center;border-left:2px solid rgba(59,130,246,0.2);">${gt.rice?.shops || 0}</td>
        <td style="text-align:center;color:#3b82f6;">${(gt.rice?.qty || 0).toFixed(2)}</td>
        <td style="text-align:center;border-left:2px solid rgba(251,191,36,0.25);">${gt.wheat?.shops || 0}</td>
        <td style="text-align:center;color:#d97706;">${(gt.wheat?.qty || 0).toFixed(2)}</td>
        <td style="text-align:center;border-left:2px solid rgba(16,185,129,0.25);">${gt.salt?.shops || 0}</td>
        <td style="text-align:center;color:#059669;">${(gt.salt?.qty || 0).toFixed(2)}</td>
    </tr>`;
}

/**
 * Load HTML preview into the iframe (for image export).
 */
async function loadPendingSummaryPreview(reportId, params) {
    try {
        const res = await fetch(`/api/reports/${reportId}/balances/pending-summary/html?${params}`);
        if (!res.ok) return;
        const html = await res.text();
        const iframe = document.getElementById('pendingSummaryPreviewIframe');
        if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open(); doc.write(html); doc.close();
            document.getElementById('pendingSummaryPreviewSection').style.display = 'block';
        }
    } catch (e) {
        // preview optional — silently ignore
    }
}

/**
 * Export pending summary as Excel or PDF.
 */
async function exportPendingSummary(format, buttonEl) {
    const card = document.getElementById('pendingAnalyticsCard');
    const reportId = card ? card.dataset.reportId : null;
    if (!reportId) { alert('No report loaded.'); return; }

    const groupBy = document.getElementById('pendingGroupBy')?.value || 'transporter';
    const sortBy  = document.getElementById('pendingSortBy')?.value || 'pendingQty';
    const filterTransporter = document.getElementById('pendingFilterTransporter')?.value || '';
    const filterIssueCenter = document.getElementById('pendingFilterIssueCenter')?.value || '';

    const originalContent = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `⏳`;

    try {
        const params = new URLSearchParams({ groupBy, sortBy });
        if (filterTransporter) params.set('filterTransporter', filterTransporter);
        if (filterIssueCenter) params.set('filterIssueCenter', filterIssueCenter);

        const link = document.createElement('a');
        link.href = `/api/reports/${reportId}/balances/pending-summary/${format}?${params}`;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => { buttonEl.disabled = false; buttonEl.innerHTML = originalContent; }, 3000);
    } catch (err) {
        console.error('Export error:', err);
        alert('Export failed: ' + err.message);
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalContent;
    }
}

/**
 * Export pending summary table as JPEG image using html2canvas on the iframe.
 */
async function exportPendingSummaryImage() {
    const previewSection = document.getElementById('pendingSummaryPreviewSection');
    const iframe = document.getElementById('pendingSummaryPreviewIframe');
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    const hasContent = iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML.trim().length > 0;

    if (!iframe || !previewSection || previewSection.style.display === 'none' || !hasContent) {
        alert('रिपोर्ट अभी लोड हो रही है। कृपया कुछ सेकंड प्रतीक्षा करें और दोबारा Image बटन दबाएं।\n\n(Report is loading. Please wait a moment and try again.)');
        return;
    }

    try {
        await new Promise(r => setTimeout(r, 500));
        const canvas = await html2canvas(iframeDoc.body, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scrollX: 0, scrollY: 0,
            width: iframeDoc.body.scrollWidth,
            height: iframeDoc.body.scrollHeight,
            windowWidth: iframeDoc.body.scrollWidth,
            windowHeight: iframeDoc.body.scrollHeight
        });

        const card = document.getElementById('pendingAnalyticsCard');
        const reportId = card ? card.dataset.reportId : '';
        const analytics = window.currentReportAnalytics;
        const monthNames = {1:'January',2:'February',3:'March',4:'April',5:'May',6:'June',7:'July',8:'August',9:'September',10:'October',11:'November',12:'December'};
        const month = analytics ? monthNames[analytics.month] || analytics.month : '';
        const year = analytics ? analytics.year : '';
        const groupBy = document.getElementById('pendingGroupBy')?.value || 'transporter';
        const tag = groupBy === 'issuecenter' ? 'IC' : 'Transporter';

        const link = document.createElement('a');
        link.download = `Pending_Summary_${tag}_${month}_${year}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error('Image export error:', err);
        alert('Image बनाने में समस्या आई: ' + err.message);
    }
}

function closePendingSummaryPreview() {
    const previewSection = document.getElementById('pendingSummaryPreviewSection');
    if (previewSection) previewSection.style.display = 'none';
}

window.pendingAnalyticsFilterChanged = pendingAnalyticsFilterChanged;
window.exportPendingSummary = exportPendingSummary;
window.exportPendingSummaryImage = exportPendingSummaryImage;
window.closePendingSummaryPreview = closePendingSummaryPreview;



window.initBalanceReportControls = initBalanceReportControls;
window.onBalanceReportTypeChange = onBalanceReportTypeChange;
window.downloadBalanceReport = downloadBalanceReport;
window.viewBalanceReport = viewBalanceReport;
window.closeBalanceReportPreview = closeBalanceReportPreview;

// Report History Hiding / Expansion Logic
window.historyExpanded = {
    nfsa: false,
    nfsa_daterange: false,
    mdm: false,
    icds: false,
    welfare: false
};

function setupHistoryExpansion(scheme, count) {
    let tbodyId;
    if (scheme === 'nfsa') tbodyId = 'reportsTableBody';
    else if (scheme === 'nfsa_daterange') tbodyId = 'daterangeReportsTableBody';
    else tbodyId = scheme + 'ReportsTableBody';
    
    const container = document.getElementById(scheme + 'HistoryToggleContainer');
    const btn = document.getElementById(scheme + 'HistoryToggleBtn');
    
    if (!container || !btn) return;
    
    if (count <= 5) {
        container.style.display = 'none';
        
        // Ensure all rows are visible if count decreased to <= 5
        const tbody = document.getElementById(tbodyId);
        if (tbody) {
            const rows = Array.from(tbody.querySelectorAll('tr.report-row'));
            rows.forEach(row => row.style.display = '');
        }
        return;
    }
    
    container.style.display = 'block';
    
    const tbody = document.getElementById(tbodyId);
    if (tbody) {
        const rows = Array.from(tbody.querySelectorAll('tr.report-row'));
        const isExpanded = window.historyExpanded[scheme];
        rows.forEach((row, idx) => {
            if (idx >= 5) {
                row.style.display = isExpanded ? '' : 'none';
            } else {
                row.style.display = '';
            }
        });
        btn.innerHTML = isExpanded ? `👆 Show Less` : `👇 Show More (${rows.length - 5} more)`;
    }
}

function toggleHistoryExpansion(scheme) {
    const isExpanded = !window.historyExpanded[scheme];
    window.historyExpanded[scheme] = isExpanded;
    
    let tbodyId;
    if (scheme === 'nfsa') tbodyId = 'reportsTableBody';
    else if (scheme === 'nfsa_daterange') tbodyId = 'daterangeReportsTableBody';
    else tbodyId = scheme + 'ReportsTableBody';
    
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr.report-row'));
    const extraRows = rows.slice(5);
    
    extraRows.forEach(row => {
        row.style.display = isExpanded ? '' : 'none';
    });
    
    const btn = document.getElementById(scheme + 'HistoryToggleBtn');
    if (btn) {
        btn.innerHTML = isExpanded ? `👆 Show Less` : `👇 Show More (${extraRows.length} more)`;
    }
}

window.setupHistoryExpansion = setupHistoryExpansion;
window.toggleHistoryExpansion = toggleHistoryExpansion;

// Success Alert PDF Generation Handlers
function generateNFSAPDF(e) {
    if (window.currentReportAnalytics && window.currentReportAnalytics.id) {
        generatePDF(window.currentReportAnalytics.id, e);
    } else {
        alert("No active report ID found to generate PDF.");
    }
}

function generateMDMPDF(e) {
    if (window.currentReportAnalytics && window.currentReportAnalytics.id) {
        generatePDF(window.currentReportAnalytics.id, e);
    } else {
        alert("No active report ID found to generate PDF.");
    }
}

function generateICDSPDF(e) {
    if (window.currentReportAnalytics && window.currentReportAnalytics.id) {
        generatePDF(window.currentReportAnalytics.id, e);
    } else {
        alert("No active report ID found to generate PDF.");
    }
}

function generateWelfarePDF(e) {
    if (window.currentReportAnalytics && window.currentReportAnalytics.id) {
        generatePDF(window.currentReportAnalytics.id, e);
    } else {
        alert("No active report ID found to generate PDF.");
    }
}

window.generateNFSAPDF = generateNFSAPDF;
window.generateMDMPDF = generateMDMPDF;
window.generateICDSPDF = generateICDSPDF;
window.generateWelfarePDF = generateWelfarePDF;

/* ══════════════════════════════════════════════════════════════
   ENTERPRISE DASHBOARD EXPORT ENGINE (PDF & IMAGE)
══════════════════════════════════════════════════════════════ */

let _currentExportBlob = null;
let _currentExportFormat = null;
let _currentExportFilename = '';
let _previewPdfPages = [];
let _previewCurrentPage = 1;

// 1. Dropdown Toggle
function toggleExportMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('dashExportMenu');
    if (menu) menu.classList.toggle('show');
}
document.addEventListener('click', function(e) {
    const menu = document.getElementById('dashExportMenu');
    if (menu && !e.target.closest('.export-dropdown')) {
        menu.classList.remove('show');
    }
});

// 2. Main Orchestrator
async function exportFullDashboard(format) {
    // Hide menu
    const menu = document.getElementById('dashExportMenu');
    if (menu) menu.classList.remove('show');

    const modal = document.getElementById('exportPreviewModal');
    const progWrap = document.getElementById('exportProgressWrap');
    const progBar = document.getElementById('exportProgressBar');
    const progLbl = document.getElementById('exportProgressLabel');
    const body = document.getElementById('exportPreviewBody');
    const footer = document.getElementById('exportPreviewFooter');
    const btn = document.getElementById('exportDownloadBtn');
    
    if (!modal) return;
    
    // Reset modal state
    modal.style.display = 'flex';
    progWrap.style.display = 'flex';
    progBar.style.width = '0%';
    progLbl.innerText = 'Preparing dashboard sections...';
    body.innerHTML = `<div class="export-preview-placeholder">
        <div class="loading-spinner"></div>
        <p>Rendering dashboard sections for ${format.includes('pdf') ? 'PDF' : 'Image'}...</p>
    </div>`;
    footer.style.display = 'none';
    btn.disabled = true;
    _currentExportFormat = format;

    try {
        // Step 1: Capture all sections
        progBar.style.width = '20%';
        progLbl.innerText = 'Capturing elements (this may take a few seconds)...';
        
        // Wait a frame to let UI update
        await new Promise(r => setTimeout(r, 100));
        
        const sections = await captureDashboardSections();
        if (!sections || sections.length === 0) {
            throw new Error("No visible dashboard sections found to export.");
        }
        
        progBar.style.width = '60%';
        progLbl.innerText = 'Generating document...';
        
        await new Promise(r => setTimeout(r, 100));

        let filename = 'District_Betul_Dashboard';
        const rawDate = new Date().toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
        const safeDate = rawDate.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
        filename += `_${safeDate}`;
        
        if (format === 'image') {
            filename += '.png';
            _currentExportFilename = filename;
            await buildImageExport(sections);
        } else {
            filename += '.pdf';
            _currentExportFilename = filename;
            const orientation = format === 'pdf-landscape' ? 'l' : 'p';
            await buildPdfDocument(sections, orientation);
        }
        
        progBar.style.width = '100%';
        progLbl.innerText = 'Preview ready!';
        setTimeout(() => {
            progWrap.style.display = 'none';
        }, 500);

    } catch (e) {
        console.error("Dashboard Export Error:", e);
        progWrap.style.display = 'none';
        body.innerHTML = `<div class="export-preview-placeholder" style="color:var(--error);">
            <div style="font-size:32px;">⚠️</div>
            <p>Failed to generate export: ${e.message}</p>
        </div>`;
    }
}

// 3. Section Capture
async function captureDashboardSections() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bgColor = isDark ? '#0d1526' : '#ffffff'; // match --bg-card
    const scale = 2; // high res
    
    // Define the logical sections of the dashboard to capture independently
    const sectionSelectors = [
        { id: 'dashboardSection', selector: '.dash-header', name: 'Header' },
        { id: 'dashboardSection', selector: '.dash-kpi-strip', name: 'KPIs' },
        { id: 'dashboardSection', selector: '.dash-2col', name: 'Scheme Perf' },
        { id: 'dashboardSection', selector: '.dash-rings-card:not(#fpsActivityCard)', name: 'Progress Rings' },
        { id: 'fpsActivityCard', name: 'FPS Activity' },
        { id: 'dashboardSection', selector: '.dash-equal-2col', name: 'Leaderboards' }
    ];

    const capturedTiles = [];
    
    for (let i = 0; i < sectionSelectors.length; i++) {
        const sec = sectionSelectors[i];
        let el = null;
        if (sec.selector) {
            const parent = document.getElementById(sec.id);
            if (parent) el = parent.querySelector(sec.selector);
        } else {
            el = document.getElementById(sec.id);
        }
        
        // Only capture if visible
        if (el && el.offsetParent !== null && window.getComputedStyle(el).display !== 'none') {
            try {
                // Ensure charts finish any animations
                const canvas = await html2canvas(el, {
                    scale: scale,
                    useCORS: true,
                    logging: false,
                    backgroundColor: bgColor,
                    onclone: (clonedDoc) => {
                        // Fix for chart.js canvas rendering in some html2canvas versions
                        const originalCanvases = el.getElementsByTagName('canvas');
                        if (originalCanvases.length > 0) {
                            const clonedCanvases = clonedDoc.querySelectorAll(sec.selector ? sec.selector + ' canvas' : '#' + sec.id + ' canvas');
                            for (let j = 0; j < originalCanvases.length; j++) {
                                if (clonedCanvases[j]) {
                                    const ctx = clonedCanvases[j].getContext('2d');
                                    if(ctx) {
                                       try { ctx.drawImage(originalCanvases[j], 0, 0); } catch(e){}
                                    }
                                }
                            }
                        }
                    }
                });
                capturedTiles.push({
                    name: sec.name,
                    canvas: canvas,
                    width: canvas.width,
                    height: canvas.height
                });
            } catch (err) {
                console.warn(`Failed to capture section ${sec.name}:`, err);
            }
        }
    }
    
    return capturedTiles;
}

// 4. Build PDF
async function buildPdfDocument(tiles, orientation) {
    const { jsPDF } = window.jspdf;
    
    // Use A4
    const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
    });
    
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const pdfBgColor = isDark ? '#080e1c' : '#f8fafc'; // surface color
    
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12; // mm
    const maxContentW = pageW - (margin * 2);
    
    const headerHeight = 20; // mm
    const footerHeight = 15; // mm
    const startY = margin + headerHeight;
    const maxContentH = pageH - margin - footerHeight - startY;
    
    let currentY = startY;
    let pageNum = 1;
    let totalPages = 1; // We'll update this at the end if possible, or just print without total
    
    // First pass to calculate total pages (approx)
    let simY = startY;
    let simPages = 1;
    for (const tile of tiles) {
        const ratio = tile.width / tile.height;
        const printW = maxContentW;
        const printH = maxContentW / ratio;
        const spacing = 5; // mm gap between sections
        
        if (simY + printH > startY + maxContentH && simY > startY) {
            simPages++;
            simY = startY;
        }
        simY += printH + spacing;
    }
    totalPages = simPages;
    
    const drawBrandedHeader = (doc, pNum) => {
        doc.setFillColor(pdfBgColor);
        doc.rect(0, 0, pageW, pageH, 'F');
        
        doc.setTextColor(isDark ? '#eef2ff' : '#0f172a');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("MPSCSC District Intelligence Dashboard", margin, margin + 6);
        
        doc.setTextColor(isDark ? '#8ea3c2' : '#64748b');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text("District Office Betul", margin, margin + 12);
        
        const modeText = document.getElementById('btnMonthMode') ? document.getElementById('btnMonthMode').innerText : 'Analytics';
        doc.text(`Active Mode: ${modeText.replace('📅 ', '')}`, margin, margin + 17);
        
        // Right side
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageW - margin, margin + 12, { align: 'right' });
        
        // Separator line
        doc.setDrawColor(isDark ? 50 : 200);
        doc.setLineWidth(0.3);
        doc.line(margin, startY - 3, pageW - margin, startY - 3);
    };
    
    const drawBrandedFooter = (doc, pNum, total) => {
        doc.setDrawColor(isDark ? 50 : 200);
        doc.setLineWidth(0.3);
        const fY = pageH - margin - 5;
        doc.line(margin, fY, pageW - margin, fY);
        
        doc.setTextColor(isDark ? '#4a6283' : '#94a3b8');
        doc.setFontSize(9);
        doc.text("Confidential & Proprietary • Madhya Pradesh State Civil Supplies Corporation", margin, fY + 5);
        doc.text(`Page ${pNum} of ${total}`, pageW - margin, fY + 5, { align: 'right' });
    };
    
    // Draw initial header
    drawBrandedHeader(pdf, pageNum);
    
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const ratio = tile.width / tile.height;
        const printW = maxContentW;
        const printH = maxContentW / ratio;
        const spacing = i === 0 ? 0 : 5; // mm
        
        // Check if page break needed
        if (currentY + printH + spacing > startY + maxContentH && currentY > startY) {
            drawBrandedFooter(pdf, pageNum, totalPages);
            pdf.addPage();
            pageNum++;
            currentY = startY;
            drawBrandedHeader(pdf, pageNum);
        } else {
            currentY += spacing;
        }
        
        // Add image tile
        pdf.addImage(tile.canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, currentY, printW, printH);
        currentY += printH;
    }
    
    // Draw final footer
    drawBrandedFooter(pdf, pageNum, totalPages);
    
    // Render preview
    const blob = pdf.output('blob');
    _currentExportBlob = blob;
    
    showPdfPreview(pdf, totalPages);
}

// 5. Build Image
async function buildImageExport(tiles) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bgColor = isDark ? '#080e1c' : '#f8fafc';
    const textColor = isDark ? '#eef2ff' : '#0f172a';
    const subColor = isDark ? '#8ea3c2' : '#64748b';
    const lineColor = isDark ? '#1e293b' : '#e2e8f0';
    
    const padding = 60; // px
    const gap = 30; // px
    const maxW = Math.max(...tiles.map(t => t.width));
    
    const headerH = 150; // px
    const footerH = 100; // px
    
    // Calculate total height
    let totalH = padding + headerH + footerH;
    for (const tile of tiles) {
        totalH += tile.height + gap;
    }
    
    // Create master canvas
    const master = document.createElement('canvas');
    master.width = maxW + (padding * 2);
    master.height = totalH;
    const ctx = master.getContext('2d');
    
    // Fill bg
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, master.width, master.height);
    
    // Draw Header
    ctx.fillStyle = textColor;
    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.fillText("MPSCSC District Intelligence Dashboard", padding, padding + 30);
    
    ctx.fillStyle = subColor;
    ctx.font = '22px "Inter", sans-serif';
    ctx.fillText("District Office Betul", padding, padding + 70);
    
    const modeText = document.getElementById('btnMonthMode') ? document.getElementById('btnMonthMode').innerText : 'Analytics';
    ctx.fillText(`Active Mode: ${modeText.replace('📅 ', '')}`, padding, padding + 105);
    
    ctx.textAlign = 'right';
    ctx.fillText(`Generated: ${new Date().toLocaleString('en-IN')}`, master.width - padding, padding + 70);
    ctx.textAlign = 'left';
    
    // Line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.moveTo(padding, padding + headerH - 10);
    ctx.lineTo(master.width - padding, padding + headerH - 10);
    ctx.stroke();
    
    // Draw tiles
    let currentY = padding + headerH + 20;
    for (const tile of tiles) {
        // center tile
        const x = padding + ((maxW - tile.width) / 2);
        ctx.drawImage(tile.canvas, x, currentY);
        currentY += tile.height + gap;
    }
    
    // Draw Footer
    const fY = master.height - padding - 20;
    ctx.beginPath();
    ctx.moveTo(padding, fY - 30);
    ctx.lineTo(master.width - padding, fY - 30);
    ctx.stroke();
    
    ctx.fillStyle = subColor;
    ctx.font = '18px "Inter", sans-serif';
    ctx.fillText("Confidential & Proprietary • Madhya Pradesh State Civil Supplies Corporation", padding, fY);
    ctx.textAlign = 'right';
    ctx.fillText("Generated from District Intelligence Portal", master.width - padding, fY);
    
    // Create Data URL for preview
    const dataUrl = master.toDataURL('image/png');
    
    // Convert Base64 to Blob robustly for download
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    _currentExportBlob = new Blob([u8arr], {type: mime});
    
    showImagePreview(dataUrl);
}

// 6. Preview Handlers
function showPdfPreview(pdf, totalPages) {
    const body = document.getElementById('exportPreviewBody');
    const footer = document.getElementById('exportPreviewFooter');
    const btn = document.getElementById('exportDownloadBtn');
    
    body.innerHTML = '';
    btn.disabled = false;
    
    // For reliable cross-browser PDF preview without huge memory usage,
    // we extract each page as an image to show in the modal.
    _previewPdfPages = [];
    _previewCurrentPage = 1;
    
    const pdfPagesContainer = document.createElement('div');
    pdfPagesContainer.className = 'export-pdf-pages';
    body.appendChild(pdfPagesContainer);
    
    // Only works reliably if we re-generate or if we use objectURL iframe.
    // Given iframe PDF viewers are native and reliable, we'll try iframe first.
    try {
        const iframe = document.createElement('iframe');
        iframe.src = URL.createObjectURL(_currentExportBlob) + '#toolbar=0&navpanes=0&scrollbar=0';
        body.innerHTML = '';
        body.appendChild(iframe);
        
        footer.style.display = 'flex';
        document.querySelector('.export-page-nav').style.display = 'none'; // Iframe has native scroll
        document.getElementById('exportFileInfo').innerText = `PDF Document • ${totalPages} Page(s) • ${(_currentExportBlob.size / 1024 / 1024).toFixed(2)} MB`;
        
    } catch(e) {
        body.innerHTML = '<div class="export-preview-placeholder">PDF Ready for Download. Preview unavailable in this browser.</div>';
    }
}

function showImagePreview(dataUrl) {
    const body = document.getElementById('exportPreviewBody');
    const footer = document.getElementById('exportPreviewFooter');
    const btn = document.getElementById('exportDownloadBtn');
    
    body.innerHTML = `<img src="${dataUrl}" alt="Dashboard Preview" />`;
    btn.disabled = false;
    
    footer.style.display = 'flex';
    document.querySelector('.export-page-nav').style.display = 'none';
    document.getElementById('exportFileInfo').innerText = `PNG Image • ${(_currentExportBlob.size / 1024 / 1024).toFixed(2)} MB`;
}

function closeExportPreview() {
    document.getElementById('exportPreviewModal').style.display = 'none';
    _currentExportBlob = null;
    _previewPdfPages = [];
}

function downloadExport() {
    if (!_currentExportBlob) return;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(_currentExportBlob);
    link.download = _currentExportFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Optional: close modal on download
    // closeExportPreview();
}

window.toggleExportMenu = toggleExportMenu;
window.exportFullDashboard = exportFullDashboard;
window.closeExportPreview = closeExportPreview;
window.downloadExport = downloadExport;

/* ── Advanced Analytics Preview Modal & Export Logic ─────────────────── */
function showAdvancedAnalyticsModal(reportId) {
    let modal = document.getElementById('advAnalyticsPreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'advAnalyticsPreviewModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.85); backdrop-filter:blur(6px); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:#ffffff; border-radius:14px; width:96%; height:94%; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.4);">
            <!-- Toolbar -->
            <div style="background:#0b2545; color:#ffffff; padding:12px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; border-bottom:3px solid #c9a227;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:22px;">📊</span>
                    <div>
                        <div style="font-size:15px; font-weight:800;">उन्नत विश्लेषण रिपोर्ट प्रीव्यू / Advanced Analytics Executive Report</div>
                        <div style="font-size:11px; color:#c9a227;">MP State Civil Supplies Corporation Ltd. • District Office Betul</div>
                    </div>
                </div>
                
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button onclick="downloadAdvAnalyticsImage()" class="btn btn-sm" style="background:#2563eb; color:#ffffff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px;">
                        🖼️ Image सेव करें (Export Image)
                    </button>
                    <button onclick="downloadAdvAnalytics('${reportId}', 'pdf')" class="btn btn-sm" style="background:#4338ca; color:#ffffff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px;">
                        📄 PDF डाउनलोड (.pdf)
                    </button>
                    <button onclick="downloadAdvAnalytics('${reportId}', 'excel')" class="btn btn-sm" style="background:#15803d; color:#ffffff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px;">
                        📊 Excel डाउनलोड (.xlsx)
                    </button>
                    <button onclick="closeAdvAnalyticsModal()" style="background:rgba(255,255,255,0.18); color:#ffffff; border:none; padding:8px 14px; border-radius:6px; font-size:13px; font-weight:700; cursor:pointer; margin-left:6px;">
                        ❌ बंद करें (Close)
                    </button>
                </div>
            </div>

            <!-- Report Content Iframe -->
            <div style="flex:1; width:100%; background:#f8fafc; position:relative; overflow:hidden;">
                <iframe id="advAnalyticsPreviewIframe" src="/api/reports/${reportId}/advanced-analytics/html" style="width:100%; height:100%; border:none; background:#ffffff;"></iframe>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeAdvAnalyticsModal() {
    const modal = document.getElementById('advAnalyticsPreviewModal');
    if (modal) modal.style.display = 'none';
}

function downloadAdvAnalytics(reportId, type) {
    if (type === 'excel') {
        showToast('📊 Generating Enterprise Advanced Analytics Excel...', 'info', 4000);
        window.location.href = `/api/reports/${reportId}/advanced-analytics/excel`;
    } else if (type === 'pdf') {
        showToast('📄 Generating Executive Analytics PDF Report...', 'info', 5000);
        window.location.href = `/api/reports/${reportId}/advanced-analytics/pdf`;
    }
}

async function downloadAdvAnalyticsImage() {
    const iframe = document.getElementById('advAnalyticsPreviewIframe');
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;

    if (!iframeDoc || !iframeDoc.body || iframeDoc.body.innerHTML.trim().length === 0) {
        alert('कृपया प्रीव्यू लोड होने तक प्रतीक्षा करें। (Please wait for preview to load completely.)');
        return;
    }

    try {
        showToast('🖼️ Generating Image export from report preview...', 'info', 4000);
        await new Promise(r => setTimeout(r, 400));

        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library is not loaded');
        }

        const canvas = await html2canvas(iframeDoc.body, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            width: iframeDoc.body.scrollWidth,
            height: iframeDoc.body.scrollHeight,
            windowWidth: iframeDoc.body.scrollWidth,
            windowHeight: iframeDoc.body.scrollHeight
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const link = document.createElement('a');
        link.download = `Advanced_Analytics_Executive_Report_${Date.now()}.jpg`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('✅ Image exported successfully!', 'success', 3000);
    } catch (err) {
        console.error('Image export error:', err);
        alert('इमेज बनाने में त्रुटि हुई: ' + err.message);
    }
}

window.showAdvancedAnalyticsModal = showAdvancedAnalyticsModal;
window.closeAdvAnalyticsModal = closeAdvAnalyticsModal;
window.downloadAdvAnalytics = downloadAdvAnalytics;
window.downloadAdvAnalyticsImage = downloadAdvAnalyticsImage;

// ═══════════════════════════════════════════════════════════════
//  LIVE STOCK POSITION — ADVANCED ANALYTICS EXECUTIVE REPORT
//  उन्नत विश्लेषण रिपोर्ट प्रीव्यू — Live District Stock Position
// ═══════════════════════════════════════════════════════════════

async function showStockAdvancedReport() {
    const data = window.lastStockData;
    if (!data || !data.icData || data.icData.length === 0) {
        if (typeof showToast === 'function') {
            showToast('⚠️ कृपया पहले "Sync Live Data" करें। (Please sync live data first.)', 'warning', 4000);
        } else {
            alert('कृपया पहले "Sync Live Data" करें। Please sync live data first.');
        }
        return;
    }

    const modal = document.getElementById('stockAdvAnalyticsModal');
    if (!modal) return;

    // Fetch snapshot history (limit 2) with resilient endpoint fallback
    let historySnapshots = [];
    try {
        const endpoints = ['/api/stock-position/snapshot-history?limit=2', 'api/stock-position/snapshot-history?limit=2', '/stock-position/snapshot-history?limit=2', 'stock-position/snapshot-history?limit=2'];
        for (const ep of endpoints) {
            try {
                const res = await fetch(ep);
                if (res && res.ok) {
                    const json = await res.json();
                    if (json && json.snapshots && Array.isArray(json.snapshots)) {
                        historySnapshots = json.snapshots;
                        break;
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        console.warn('Could not load snapshot history:', err);
    }

    const reportHtml = buildStockAdvancedReportHTML(data, historySnapshots);

    modal.innerHTML = `
        <div id="stockAdvReportWrapper" style="background:#ffffff;border-radius:14px;width:98%;height:96%;max-width:1280px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.5);">
            <!-- Toolbar -->
            <div style="background:#0b2545;color:#ffffff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-bottom:3px solid #c9a227;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">📊</span>
                    <div>
                        <div style="font-size:15px;font-weight:800;letter-spacing:0.2px;">उन्नत विश्लेषण रिपोर्ट प्रीव्यू / Advanced Analytics Executive Report</div>
                        <div style="font-size:11px;color:#c9a227;font-weight:500;">मध्यप्रदेश स्टेट सिविल सप्लाइज कारपोरेशन लि. • जिला कार्यालय बैतूल • Live District Stock Position</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <button onclick="downloadStockAdvReport('image')" style="background:#2563eb;color:#ffffff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                        🖼️ Image Export
                    </button>
                    <button onclick="downloadStockAdvReport('pdf')" style="background:#4338ca;color:#ffffff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                        📄 PDF Export
                    </button>
                    <button onclick="downloadStockAdvReport('excel')" style="background:#15803d;color:#ffffff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                        📊 Excel Export
                    </button>
                    <button onclick="closeStockAdvancedReport()" style="background:rgba(255,255,255,0.15);color:#ffffff;border:1px solid rgba(255,255,255,0.3);padding:8px 14px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;margin-left:4px;">
                        ❌ बंद करें
                    </button>
                </div>
            </div>
            <!-- Report Content -->
            <div id="stockAdvReportContent" style="flex:1;overflow-y:auto;background:#f8fafc;">
                ${reportHtml}
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Close on backdrop click
    modal.onclick = function(e) {
        if (e.target === modal) closeStockAdvancedReport();
    };

    // ESC key close
    window._stockAdvReportEscHandler = function(e) {
        if (e.key === 'Escape') closeStockAdvancedReport();
    };
    document.addEventListener('keydown', window._stockAdvReportEscHandler);
}

function closeStockAdvancedReport() {
    const modal = document.getElementById('stockAdvAnalyticsModal');
    if (modal) modal.style.display = 'none';
    if (window._stockAdvReportEscHandler) {
        document.removeEventListener('keydown', window._stockAdvReportEscHandler);
        window._stockAdvReportEscHandler = null;
    }
}

/**
 * Compute dynamic top-half concentration metric (top N of M issue centers).
 * Top N is defined by convention as Math.ceil(totalICs / 2).
 *
 * @param {Array<Object>} icData - Array of IC records with totals
 * @returns {Object} { topN: number, totalICs: number, topSharePct: string, topHalfPct: string }
 */
function computeTopConcentration(icData) {
    const list = Array.isArray(icData) ? icData : [];
    const totalICs = list.length;
    const topN = Math.ceil(totalICs / 2);
    const districtTotal = list.reduce((s, ic) => s + (parseFloat(ic.total) || 0), 0);
    const sortedTotals = list.map(ic => parseFloat(ic.total) || 0).sort((a, b) => b - a);
    const topHalf = sortedTotals.slice(0, topN).reduce((s, v) => s + v, 0);
    const topSharePct = districtTotal > 0 ? (topHalf / districtTotal * 100).toFixed(1) : '0.0';

    return {
        topN,
        totalICs,
        topSharePct,
        topHalfPct: topSharePct
    };
}

const LOW_BUFFER_THRESHOLD_PCT = 0.5;
const HIGH_BUFFER_THRESHOLD_PCT = 1.3;

/**
 * Auditable District Health Score (0-100) & IC Buffer Classification logic.
 *
 * @param {Array<Object>} icData - Issue center records with totals and commodities
 * @returns {Object} { score, label, color, districtTotal, avgStock, totalICs, topN, topHalfPct, topSharePct, negativeItems, lowBufferICs, components, thresholds }
 */
function computeDistrictHealthScore(icData) {
    const list = Array.isArray(icData) ? icData : [];
    const districtTotal = list.reduce((s, ic) => s + (parseFloat(ic.total) || 0), 0);
    const avgStock = list.length ? districtTotal / list.length : 0;

    // 1. Negative stock items (< -0.001 Qt)
    const negativeItems = [];
    list.forEach(ic => {
        if (ic && ic.commodities && typeof ic.commodities === 'object') {
            Object.keys(ic.commodities).forEach(h => {
                const val = parseFloat(ic.commodities[h]) || 0;
                if (val < -0.001) {
                    negativeItems.push({ center: ic.name || 'Unknown IC', commodity: h, val: val });
                }
            });
        }
    });

    // 2. Low buffer ICs (< 50% of avg)
    const lowBufferThreshold = avgStock * LOW_BUFFER_THRESHOLD_PCT;
    const highBufferThreshold = avgStock * HIGH_BUFFER_THRESHOLD_PCT;
    const lowBufferICs = list.filter(ic => {
        const tot = parseFloat(ic.total) || 0;
        return tot > 0 && tot < lowBufferThreshold;
    });

    // 3. Distribution equity (% held by top N = Math.ceil(totalICs / 2) ICs)
    const { topN, totalICs, topHalfPct, topSharePct } = computeTopConcentration(list);

    // Base score and deductions
    const baseScore = 100;
    const negWeight = -12;
    const lowBufferWeight = -8;
    const equityWeight = -10;

    const negContribution = negativeItems.length * negWeight;
    const lowBufferContribution = lowBufferICs.length * lowBufferWeight;
    const equityContribution = parseFloat(topHalfPct) > 75 ? equityWeight : 0;

    const rawScore = baseScore + negContribution + lowBufferContribution + equityContribution;
    const score = Math.max(0, Math.min(100, rawScore));

    const color = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626';
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Moderate' : 'Critical';

    const components = [
        {
            name: 'Base Score',
            description: 'Starting baseline health score for district stock',
            value: baseScore,
            weight: 1,
            contribution: baseScore
        },
        {
            name: 'Negative Stock Deduction',
            description: 'Deduction for commodity balances < -0.001 Qt',
            value: negativeItems.length,
            weight: negWeight,
            contribution: negContribution
        },
        {
            name: 'Low Buffer IC Deduction',
            description: 'Deduction for ICs with stock < 50% of district average',
            value: lowBufferICs.length,
            weight: lowBufferWeight,
            contribution: lowBufferContribution
        },
        {
            name: 'Distribution Concentration Deduction',
            description: `Deduction if top ${topN} of ${totalICs} ICs hold > 75% of total district stock`,
            value: parseFloat(topHalfPct),
            weight: equityWeight,
            contribution: equityContribution
        }
    ];

    const thresholds = {
        icClassification: {
            lowThreshold: lowBufferThreshold,
            highThreshold: highBufferThreshold,
            low: `< 50% of avg stock (< ${lowBufferThreshold.toFixed(2)} Qt)`,
            normal: `50% – 130% of avg stock (${lowBufferThreshold.toFixed(2)} to ${highBufferThreshold.toFixed(2)} Qt)`,
            high: `> 130% of avg stock (> ${highBufferThreshold.toFixed(2)} Qt)`
        },
        healthScoreBands: {
            excellent: '>= 80 (Green #059669)',
            moderate: '60 – 79 (Amber #D97706)',
            critical: '< 60 (Red #DC2626)'
        }
    };

    return {
        score,
        label,
        color,
        districtTotal,
        avgStock,
        totalICs,
        topN,
        topHalfPct,
        topSharePct,
        negativeItems,
        lowBufferICs,
        components,
        thresholds
    };
}

function toggleHealthScoreAudit(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const el = document.getElementById('healthScoreAuditDetails');
    if (el) {
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
    }
}

// Helper for exact IST date calculation (UTC+5:30)
function getISTDateString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const istTime = new Date(d.getTime() + istOffsetMs);
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildStockAdvancedReportHTML(data, historySnapshots = []) {
    const icData = data.icData || [];
    const headers = data.headers || [];
    const commodityHeaders = headers.slice(1, headers.length - 1);

    // ── Compute aggregates & auditable health score ──
    function pv(v) { return parseFloat((v || '0').replace ? (v || '0').replace(/,/g, '') : v) || 0; }

    const districtTotal = icData.reduce((s, ic) => s + ic.total, 0);
    const avgStock = icData.length ? districtTotal / icData.length : 0;
    const sorted = icData.slice().sort((a, b) => b.total - a.total);
    const maxIC = sorted[0] || { name: '—', total: 0 };
    const minIC = sorted[sorted.length - 1] || { name: '—', total: 0 };

    // Auditable Health Score & Component Breakdown
    const healthInfo = computeDistrictHealthScore(icData);
    const healthScore = healthInfo.score;
    const healthColor = healthInfo.color;
    const healthLabel = healthInfo.label;
    const negativeItems = healthInfo.negativeItems;
    const lowBufferICs = healthInfo.lowBufferICs;
    const topHalfPct = healthInfo.topHalfPct;
    const topN = healthInfo.topN;
    const totalICs = healthInfo.totalICs;

    // Fire-and-forget async snapshot save (do not await, do not surface errors)
    try {
        const classifiedICs = sorted.map(ic => {
            const share = districtTotal > 0 ? (ic.total / districtTotal * 100).toFixed(1) : '0';
            const status = ic.total < avgStock * LOW_BUFFER_THRESHOLD_PCT ? 'Low' : ic.total > avgStock * HIGH_BUFFER_THRESHOLD_PCT ? 'High' : 'Normal';
            return {
                icName: ic.name,
                icTotal: ic.total,
                sharePct: parseFloat(share) || 0,
                status: status
            };
        });

        const snapshotPayload = {
            score: healthScore,
            label: healthLabel,
            districtTotalQt: districtTotal,
            icData: classifiedICs,
            syncedAt: new Date().toISOString(),
            snapshotDate: getISTDateString()
        };

        const postEndpoints = ['/api/stock-position/snapshot', 'api/stock-position/snapshot', '/stock-position/snapshot', 'stock-position/snapshot'];
        (async () => {
            for (const ep of postEndpoints) {
                try {
                    const r = await fetch(ep, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(snapshotPayload)
                    });
                    if (r && r.ok) break;
                } catch (e) {}
            }
        })().catch(() => {});
    } catch (e) {}

    // ── Trend calculation vs most recent prior day (limit=2 history) ──
    const todayIST = getISTDateString();
    let priorSnapshot = null;
    if (Array.isArray(historySnapshots) && historySnapshots.length > 0) {
        if (historySnapshots[0].snapshotDate !== todayIST) {
            priorSnapshot = historySnapshots[0];
        } else if (historySnapshots.length >= 2) {
            priorSnapshot = historySnapshots[1];
        }
    }

    let trendBadgeHtml = '';
    if (priorSnapshot && priorSnapshot.healthScore !== undefined && priorSnapshot.healthScore !== null) {
        const priorScore = parseInt(priorSnapshot.healthScore, 10);
        if (!isNaN(priorScore)) {
            const delta = healthScore - priorScore;
            const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
            const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;
            const badgeColor = delta > 0 ? '#86efac' : delta < 0 ? '#fca5a5' : '#cbd5e1';
            const badgeBg = delta > 0 ? 'rgba(34,197,94,0.25)' : delta < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.12)';
            const badgeBorder = delta > 0 ? 'rgba(34,197,94,0.45)' : delta < 0 ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.25)';
            trendBadgeHtml = `<span style="font-size:11px;font-weight:700;color:${badgeColor};background:${badgeBg};border:1px solid ${badgeBorder};padding:2px 7px;border-radius:4px;display:inline-flex;align-items:center;gap:3px;" title="Trend vs prior snapshot (${priorSnapshot.snapshotDate}: ${priorScore}/100)">${arrow} ${deltaSign}</span>`;
        }
    }

    // Commodity group totals
    const commodityTotals = {};
    commodityHeaders.forEach(h => {
        commodityTotals[h] = icData.reduce((s, ic) => s + (ic.commodities[h] || 0), 0);
    });

    const donutGroups = {
        'Wheat (गेहूं)': 0,
        'CMR/Paddy (चावल/धान)': 0,
        'Jowar (ज्वार)': 0,
        'Sugar (शक्कर)': 0,
        'Salt (नमक)': 0
    };
    Object.keys(commodityTotals).forEach(h => {
        const hl = h.toLowerCase(), v = commodityTotals[h];
        if (hl.includes('wheat')) donutGroups['Wheat (गेहूं)'] += v;
        else if (hl.includes('cmr') || hl.includes('paddy') || hl.includes('rice')) donutGroups['CMR/Paddy (चावल/धान)'] += v;
        else if (hl.includes('jwar') || hl.includes('jowar')) donutGroups['Jowar (ज्वार)'] += v;
        else if (hl.includes('sugar')) donutGroups['Sugar (शक्कर)'] += v;
        else if (hl.includes('salt') || hl.includes('f.salt') || hl.includes('iodine')) donutGroups['Salt (नमक)'] += v;
    });

    // Top commodity by volume
    const topCommodity = commodityHeaders.reduce((a, b) => (commodityTotals[b] || 0) > (commodityTotals[a] || 0) ? b : a, commodityHeaders[0] || '');
    const topCommodityPct = districtTotal > 0 ? (commodityTotals[topCommodity] / districtTotal * 100).toFixed(1) : '0';

    function fmtQ(v) {
        // Display in Quintals (Qt) matching Google Sheet values 1:1
        return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Qt';
    }

    const syncTime = new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const reportDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    // ──────────────────────────────────────────────────
    // SHARED STYLES
    // ──────────────────────────────────────────────────
    const baseCss = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, .report-root { font-family: 'Inter', 'Noto Sans Devanagari', sans-serif; background: #f8fafc; color: #1e293b; }
        .page { width: 100%; background: #ffffff; margin-bottom: 0; padding: 0; }
        .page-inner { padding: 32px 36px; }
        .section-divider { height: 6px; background: linear-gradient(90deg, #0b2545, #c9a227); margin: 0; }
        .cover-header { background: linear-gradient(135deg, #0b2545 0%, #1e3a8a 60%, #0b2545 100%); padding: 36px; color: white; position: relative; overflow: hidden; }
        .cover-header::before { content: ''; position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: rgba(201,162,39,0.12); }
        .cover-header::after  { content: ''; position: absolute; bottom: -30px; left: -30px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.05); }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; position: relative; overflow: hidden; }
        .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--kpi-accent, #0b2545); }
        .kpi-value { font-size: 22px; font-weight: 800; color: var(--kpi-color, #0b2545); line-height: 1.1; margin: 6px 0 4px; }
        .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
        .kpi-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
        .section-header { background: #0b2545; color: white; padding: 14px 20px; display: flex; align-items: center; gap: 10px; border-left: 5px solid #c9a227; }
        .section-num { width: 28px; height: 28px; background: #c9a227; color: #0b2545; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
        .ic-bar-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .ic-bar-row:last-child { border-bottom: none; }
        .ic-bar-label { font-size: 12px; font-weight: 700; color: #1e293b; min-width: 120px; flex-shrink: 0; }
        .ic-bar-track { flex: 1; height: 22px; background: #f1f5f9; border-radius: 4px; overflow: hidden; position: relative; }
        .ic-bar-fill { height: 100%; border-radius: 4px; display: flex; align-items: center; padding-left: 8px; font-size: 10px; font-weight: 700; color: white; white-space: nowrap; transition: width 0.3s; }
        .ic-bar-val { font-size: 11px; font-weight: 800; min-width: 80px; text-align: right; flex-shrink: 0; }
        .commodity-matrix { width: 100%; border-collapse: collapse; font-size: 11px; }
        .commodity-matrix th { background: #0b2545; color: white; padding: 8px 10px; text-align: center; font-weight: 700; font-size: 10px; white-space: nowrap; }
        .commodity-matrix th:first-child { text-align: left; min-width: 110px; }
        .commodity-matrix td { padding: 7px 10px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 600; }
        .commodity-matrix td:first-child { text-align: left; font-weight: 700; color: #1e293b; }
        .commodity-matrix tr:last-child { background: #fef3c7; font-weight: 800; }
        .commodity-matrix tr:last-child td { border-top: 2px solid #c9a227; }
        .heat-hi  { background: rgba(5,150,105,0.18); color: #065f46; }
        .heat-mid { background: rgba(217,119,6,0.15);  color: #92400e; }
        .heat-lo  { background: rgba(220,38,38,0.12);  color: #991b1b; }
        .heat-neg { background: rgba(220,38,38,0.35);  color: #7f1d1d; font-weight: 800; }
        .alert-card { border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; border-left: 4px solid; }
        .alert-critical { background: rgba(254,226,226,0.8); border-color: #dc2626; }
        .alert-warning  { background: rgba(254,243,199,0.8); border-color: #d97706; }
        .alert-ok       { background: rgba(209,250,229,0.8); border-color: #059669; }
        .alert-info     { background: rgba(219,234,254,0.8); border-color: #2563eb; }
        .alert-title { font-size: 12px; font-weight: 800; margin-bottom: 4px; }
        .alert-body  { font-size: 11px; color: #374151; line-height: 1.55; }
        .scorecard { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
        .score-item { text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .score-val { font-size: 20px; font-weight: 800; }
        .score-lab { font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 600; }
        .donut-legend { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
        .donut-row { display: flex; align-items: center; gap: 8px; font-size: 11px; }
        .donut-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
        .priority-card { background: #0b2545; color: white; border-radius: 10px; padding: 18px; margin-bottom: 12px; border-left: 5px solid #c9a227; }
        .priority-num { display: inline-flex; width: 24px; height: 24px; background: #c9a227; color: #0b2545; border-radius: 50%; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; margin-right: 8px; }
        .footer-bar { background: #0b2545; color: #94a3b8; padding: 12px 36px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; border-top: 3px solid #c9a227; }
        .ranking-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
    `;

    // ──────────────────────────────────────────────────
    // SECTION 0: COVER / EXECUTIVE SUMMARY
    // ──────────────────────────────────────────────────
    const coverSection = `
    <div class="page">
        <div class="cover-header">
            <div style="position:relative;z-index:1;">
                <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
                    <div style="width:52px;height:52px;background:#c9a227;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">📦</div>
                    <div>
                        <div style="font-size:11px;font-weight:600;color:#c9a227;letter-spacing:1px;text-transform:uppercase;">मध्यप्रदेश स्टेट सिविल सप्लाइज कारपोरेशन लिमिटेड</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:1px;">Madhya Pradesh State Civil Supplies Corporation Ltd.</div>
                        <div style="font-size:19px;font-weight:800;margin-top:8px;line-height:1.2;">Live District Stock Position Analysis</div>
                        <div style="font-size:14px;font-weight:600;color:#c9a227;margin-top:4px;">उन्नत विश्लेषण कार्यकारी रिपोर्ट — Betul District</div>
                    </div>
                </div>
                <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
                    <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 16px;">
                        <div style="font-size:10px;color:#c9a227;font-weight:700;text-transform:uppercase;">Data Source</div>
                        <div style="font-size:12px;font-weight:700;margin-top:2px;">View_LiveRollup (Google Sheets)</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 16px;">
                        <div style="font-size:10px;color:#c9a227;font-weight:700;text-transform:uppercase;">Generated On</div>
                        <div style="font-size:12px;font-weight:700;margin-top:2px;">${reportDate}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 16px;">
                        <div style="font-size:10px;color:#c9a227;font-weight:700;text-transform:uppercase;">Sync Time</div>
                        <div style="font-size:12px;font-weight:700;margin-top:2px;">${syncTime}</div>
                    </div>
                    <div style="background:rgba(201,162,39,0.2);border:1px solid rgba(201,162,39,0.4);border-radius:8px;padding:10px 16px;min-width:260px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <div style="font-size:10px;color:#c9a227;font-weight:700;text-transform:uppercase;">District Stock Health</div>
                            <button type="button" onclick="toggleHealthScoreAudit(event)" style="background:rgba(201,162,39,0.25);border:1px solid rgba(201,162,39,0.5);color:#fef08a;font-size:10px;cursor:pointer;padding:2px 6px;border-radius:4px;font-weight:600;display:inline-flex;align-items:center;gap:3px;" title="View calculation methodology & components">
                                ⓘ How this is calculated
                            </button>
                        </div>
                        <div style="font-size:18px;font-weight:800;margin-top:4px;color:${healthColor};display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <span>${healthScore}/100 — ${healthLabel}</span>
                            ${trendBadgeHtml}
                        </div>
                        <div id="healthScoreAuditDetails" style="display:none;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(201,162,39,0.4);font-size:10px;color:rgba(255,255,255,0.95);">
                            <div style="font-weight:700;color:#c9a227;margin-bottom:6px;font-size:11px;">📊 Health Score Calculation Audit:</div>
                            <table style="width:100%;border-collapse:collapse;font-size:10px;color:white;margin-bottom:6px;">
                                <thead>
                                    <tr style="border-bottom:1px solid rgba(201,162,39,0.5);color:#fde68a;font-size:9px;text-transform:uppercase;">
                                        <th style="text-align:left;padding:2px 0;">Component</th>
                                        <th style="text-align:center;padding:2px 4px;">Qty / Val</th>
                                        <th style="text-align:center;padding:2px 4px;">Weight</th>
                                        <th style="text-align:right;padding:2px 0;">Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${healthInfo.components.map(c => `
                                        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                                            <td style="padding:4px 0;color:#f1f5f9;font-weight:500;">${c.name}</td>
                                            <td style="padding:4px 4px;text-align:center;color:#cbd5e1;">${c.name.includes('Base') ? '100 pts' : c.name.includes('Concentration') ? `${c.value}%` : `${c.value} item(s)`}</td>
                                            <td style="padding:4px 4px;text-align:center;color:#cbd5e1;">${c.name.includes('Base') ? '—' : `${c.weight} pts`}</td>
                                            <td style="padding:4px 0;text-align:right;font-weight:700;color:${c.contribution < 0 ? '#fca5a5' : '#86efac'};">${c.contribution > 0 ? '+' : ''}${c.contribution}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="font-weight:800;border-top:1px solid #c9a227;">
                                        <td colspan="3" style="padding:5px 0;color:#c9a227;">Final Health Score (Clamped 0–100)</td>
                                        <td style="padding:5px 0;text-align:right;color:${healthColor};font-size:11px;">${healthScore}/100</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style="font-size:9px;color:rgba(255,255,255,0.75);line-height:1.4;background:rgba(0,0,0,0.2);padding:6px 8px;border-radius:4px;">
                                <div>• <strong>Status Bands:</strong> Excellent (≥80), Moderate (60–79), Critical (&lt;60)</div>
                                <div>• <strong>IC Buffers:</strong> Low (&lt;50% avg), Normal (50–130% avg), High (&gt;130% avg)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="page-inner">
            <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">Executive KPI Summary</div>
            <div class="kpi-grid">
                <div class="kpi-card" style="--kpi-accent:#10b981;--kpi-color:#059669;">
                    <div class="kpi-label">📍 Total District Stock</div>
                    <div class="kpi-value">${fmtQ(districtTotal)}</div>
                    <div class="kpi-sub">All commodities combined</div>
                </div>
                <div class="kpi-card" style="--kpi-accent:#f59e0b;--kpi-color:#d97706;">
                    <div class="kpi-label">🏆 Highest Buffer IC</div>
                    <div class="kpi-value" style="font-size:16px;">${maxIC.name}</div>
                    <div class="kpi-sub">${fmtQ(maxIC.total)} — ${districtTotal > 0 ? (maxIC.total / districtTotal * 100).toFixed(1) : 0}% share</div>
                </div>
                <div class="kpi-card" style="--kpi-accent:#6366f1;--kpi-color:#4f46e5;">
                    <div class="kpi-label">📉 Lowest Buffer IC</div>
                    <div class="kpi-value" style="font-size:16px;">${minIC.name}</div>
                    <div class="kpi-sub">${fmtQ(minIC.total)} — ${districtTotal > 0 ? (minIC.total / districtTotal * 100).toFixed(1) : 0}% share</div>
                </div>
                <div class="kpi-card" style="--kpi-accent:${(negativeItems.length + lowBufferICs.length) > 0 ? '#dc2626' : '#059669'};--kpi-color:${(negativeItems.length + lowBufferICs.length) > 0 ? '#dc2626' : '#059669'};">
                    <div class="kpi-label">🚨 ICs Requiring Attention</div>
                    <div class="kpi-value">${(negativeItems.length + lowBufferICs.length) > 0 ? (negativeItems.length + lowBufferICs.length) : '✓ None'}</div>
                    <div class="kpi-sub">${negativeItems.length} negative · ${lowBufferICs.length} low buffer</div>
                </div>
                <div class="kpi-card" style="--kpi-accent:#f26b2b;--kpi-color:#ea580c;">
                    <div class="kpi-label">🌾 Wheat Pool Share</div>
                    <div class="kpi-value">${districtTotal > 0 ? (donutGroups['Wheat (गेहूं)'] / districtTotal * 100).toFixed(1) : '0'}%</div>
                    <div class="kpi-sub">${fmtQ(donutGroups['Wheat (गेहूं)'])} of total</div>
                </div>
                <div class="kpi-card" style="--kpi-accent:${negativeItems.length > 0 ? '#dc2626' : '#059669'};--kpi-color:${negativeItems.length > 0 ? '#dc2626' : '#059669'};">
                    <div class="kpi-label">⚠️ Negative Stock Items</div>
                    <div class="kpi-value">${negativeItems.length > 0 ? negativeItems.length : '✓ None'}</div>
                    <div class="kpi-sub">${negativeItems.length > 0 ? 'Urgent attention required' : 'All stocks positive'}</div>
                </div>
            </div>
        </div>
    </div>`;

    // ──────────────────────────────────────────────────
    // SECTION 1: IC VOLUME ANALYSIS
    // ──────────────────────────────────────────────────
    const ic1Bars = sorted.map((ic, i) => {
        const share = districtTotal > 0 ? (ic.total / districtTotal * 100).toFixed(1) : '0';
        const barPct = maxIC.total > 0 ? (ic.total / maxIC.total * 100).toFixed(1) : '0';
        const barColor = ic.total === maxIC.total ? '#059669' : ic.total < avgStock * LOW_BUFFER_THRESHOLD_PCT ? '#dc2626' : '#1e3a8a';
        const statusLabel = ic.total < avgStock * LOW_BUFFER_THRESHOLD_PCT ? 'Low' : ic.total > avgStock * HIGH_BUFFER_THRESHOLD_PCT ? 'High' : 'Normal';
        const statusColor = ic.total < avgStock * LOW_BUFFER_THRESHOLD_PCT ? '#dc2626' : ic.total > avgStock * HIGH_BUFFER_THRESHOLD_PCT ? '#059669' : '#2563eb';
        return `
        <div class="ic-bar-row">
            <div class="ic-bar-label">${['🥇','🥈','🥉'][i] || '#'+(i+1)} ${ic.name}</div>
            <div class="ic-bar-track">
                <div class="ic-bar-fill" style="width:${barPct}%;background:${barColor};">${fmtQ(ic.total)}</div>
            </div>
            <div class="ic-bar-val" style="color:${barColor};">${share}%</div>
            <div style="font-size:10px;font-weight:700;color:${statusColor};min-width:48px;text-align:center;">${statusLabel}</div>
        </div>`;
    }).join('');

    const section1 = `
    <div class="section-divider"></div>
    <div class="page">
        <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div class="section-num">1</div>
                <div>
                    <div style="font-size:14px;font-weight:800;">Issue Center Stock Volume Analysis</div>
                    <div style="font-size:11px;color:#c9a227;font-weight:500;">इश्यू सेंटर स्टॉक मात्रा विश्लेषण — ${icData.length} Issue Centers</div>
                </div>
            </div>
            <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.9);display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);">
                <span><strong style="color:#86efac;">● High:</strong> &gt;130% avg</span>
                <span><strong style="color:#93c5fd;">● Normal:</strong> 50%–130% avg</span>
                <span><strong style="color:#fca5a5;">● Low:</strong> &lt;50% avg</span>
            </div>
        </div>
        <div class="page-inner">
            <div style="margin-bottom:20px;">
                ${ic1Bars}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:8px;padding-top:16px;border-top:2px solid #f1f5f9;">
                <div style="text-align:center;padding:10px;background:rgba(209,250,229,0.5);border-radius:8px;border:1px solid #bbf7d0;">
                    <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;">District Total</div>
                    <div style="font-size:18px;font-weight:800;color:#059669;">${fmtQ(districtTotal)}</div>
                </div>
                <div style="text-align:center;padding:10px;background:rgba(254,243,199,0.5);border-radius:8px;border:1px solid #fde68a;">
                    <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;">Avg per IC</div>
                    <div style="font-size:18px;font-weight:800;color:#d97706;">${fmtQ(avgStock)}</div>
                </div>
                <div style="text-align:center;padding:10px;background:rgba(219,234,254,0.5);border-radius:8px;border:1px solid #bfdbfe;">
                    <div style="font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;">Issue Centers</div>
                    <div style="font-size:18px;font-weight:800;color:#2563eb;">${icData.length}</div>
                </div>
            </div>
        </div>
    </div>`;

    // ──────────────────────────────────────────────────
    // SECTION 2: COMMODITY INTELLIGENCE MATRIX
    // ──────────────────────────────────────────────────
    const colMax = {};
    commodityHeaders.forEach(h => {
        colMax[h] = Math.max(0, ...icData.map(ic => ic.commodities[h] || 0));
    });

    function heatClass(val, max) {
        if (val < -0.001) return 'heat-neg';
        if (max <= 0) return '';
        const r = val / max;
        if (r > 0.65) return 'heat-hi';
        if (r > 0.30) return 'heat-mid';
        if (r > 0)    return 'heat-lo';
        return '';
    }

    const shortCols = commodityHeaders.map(h =>
        h.replace('2024-25','24-25').replace('2025-26','25-26').replace('2026-27','26-27')
         .replace('CMR-','').replace('NonFort','NF').replace('Fortified','Ft').replace('(Iodine)','Iod').replace('Iodine','Iod')
    );

    const matrixRows = icData.map(ic => {
        const cells = commodityHeaders.map((h, i) => {
            const val = ic.commodities[h] || 0;
            const cls = heatClass(val, colMax[h]);
            const disp = Math.abs(val) > 0.001 
                ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                : '—';
            return `<td class="${cls}">${disp}</td>`;
        }).join('');
        return `<tr><td style="font-weight:700;">${ic.name}</td>${cells}<td style="font-weight:800;color:#0b2545;">${fmtQ(ic.total)}</td></tr>`;
    }).join('');

    const totalCells = commodityHeaders.map(h => {
        const v = commodityTotals[h] || 0;
        return `<td style="background:#fef3c7;font-weight:800;color:#92400e;">${Math.abs(v) > 0.001 ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>`;
    }).join('');

    const donutLegendRows = Object.keys(donutGroups).filter(k => donutGroups[k] > 0.001).map((k, i) => {
        const colors = ['#10b981','#6366f1','#f59e0b','#ec4899','#06b6d4'];
        const pct = districtTotal > 0 ? (donutGroups[k] / districtTotal * 100).toFixed(1) : '0';
        return `<div class="donut-row"><div class="donut-dot" style="background:${colors[i]};"></div><span style="flex:1;font-weight:600;">${k}</span><span style="font-weight:800;color:${colors[i]};">${pct}%</span><span style="color:#64748b;margin-left:6px;">${fmtQ(donutGroups[k])}</span></div>`;
    }).join('');

    const section2 = `
    <div class="section-divider"></div>
    <div class="page">
        <div class="section-header">
            <div class="section-num">2</div>
            <div>
                <div style="font-size:14px;font-weight:800;">Commodity Intelligence Matrix (Quantity in Quintals / Qt)</div>
                <div style="font-size:11px;color:#c9a227;font-weight:500;">कमोडिटी इंटेलिजेंस मैट्रिक्स (मात्रा क्विंटल में) • Heatmap View</div>
            </div>
        </div>
        <div class="page-inner">
            <div style="display:grid;grid-template-columns:1fr 280px;gap:20px;align-items:start;">
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px;">
                        <div style="font-size:11px;font-weight:700;color:#0b2545;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:6px;">
                            <span>📊</span> IC × Commodity Breakdown
                        </div>
                        <div style="background:#0b2545;color:#c9a227;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;border:1px solid #c9a227;">
                            <span>⚖️</span> Unit: Quintals (Qt) — 100% Parity with Google Sheet
                        </div>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="commodity-matrix">
                            <thead><tr>
                                <th>Issue Center</th>
                                ${shortCols.map(c => `<th>${c} (Qt)</th>`).join('')}
                                <th style="background:#c9a227;color:#0b2545;">IC Total (Qt)</th>
                            </tr></thead>
                            <tbody>
                                ${matrixRows}
                                <tr>
                                    <td style="font-weight:800;background:#fef3c7;color:#92400e;">∑ TOTAL (Qt)</td>
                                    ${totalCells}
                                    <td style="background:#fef3c7;font-weight:800;color:#059669;">${fmtQ(districtTotal)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex;gap:12px;margin-top:12px;font-size:10px;flex-wrap:wrap;">
                        <span style="background:rgba(5,150,105,0.18);color:#065f46;padding:3px 8px;border-radius:4px;font-weight:600;">🟢 High Stock</span>
                        <span style="background:rgba(217,119,6,0.15);color:#92400e;padding:3px 8px;border-radius:4px;font-weight:600;">🟡 Medium Stock</span>
                        <span style="background:rgba(220,38,38,0.12);color:#991b1b;padding:3px 8px;border-radius:4px;font-weight:600;">🔴 Low Stock</span>
                        <span style="background:rgba(220,38,38,0.35);color:#7f1d1d;padding:3px 8px;border-radius:4px;font-weight:600;">❌ Negative</span>
                    </div>
                    <div style="margin-top:8px;font-size:10px;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 10px;border-radius:4px;line-height:1.4;">
                        <strong>Abbreviations:</strong> Fort = CMR Fortified Rice · NF = CMR Non-Fortified Rice · Jwar = Jowar (Sorghum) · Salt (Iod) = Salt (Iodine) · F.Salt = Fortified Salt
                    </div>
                </div>
                <div>
                    <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Commodity Mix (Qt)</div>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                        <div class="donut-legend">${donutLegendRows}</div>
                        <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
                            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Dominant Commodity</div>
                            <div style="font-size:14px;font-weight:800;color:#0b2545;">${topCommodity}</div>
                            <div style="font-size:12px;color:#d97706;font-weight:700;margin-top:2px;">${topCommodityPct}% of district stock (${fmtQ(commodityTotals[topCommodity] || 0)})</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // ──────────────────────────────────────────────────
    // SECTION 3: RISK INTELLIGENCE & ALERTS
    // ──────────────────────────────────────────────────
    let alertsHtml = '';

    if (negativeItems.length === 0 && lowBufferICs.length === 0) {
        alertsHtml += `<div class="alert-card alert-ok"><div class="alert-title" style="color:#059669;">✅ All Systems Normal</div><div class="alert-body">No negative stock detected. All Issue Centers maintain positive commodity balances.</div></div>`;
    }

    negativeItems.forEach(ni => {
        alertsHtml += `<div class="alert-card alert-critical"><div class="alert-title" style="color:#dc2626;">🔴 Critical: Negative Stock — ${ni.center}</div><div class="alert-body"><strong>${ni.commodity}</strong>: <strong style="color:#dc2626;">${fmtQ(ni.val)}</strong>. Immediate replenishment or stock audit is required. Verify records for data entry errors.</div></div>`;
    });

    lowBufferICs.forEach(ic => {
        const pct = districtTotal > 0 ? (ic.total / districtTotal * 100).toFixed(1) : '0';
        alertsHtml += `<div class="alert-card alert-warning"><div class="alert-title" style="color:#d97706;">🟡 Low Buffer Warning — ${ic.name}</div><div class="alert-body">Holds only <strong>${fmtQ(ic.total)}</strong> (${pct}% district share) — below 50% of district average (${fmtQ(avgStock)}). Consider restocking priority dispatch.</div></div>`;
    });

    if (parseFloat(topHalfPct) > 75) {
        alertsHtml += `<div class="alert-card alert-warning"><div class="alert-title" style="color:#d97706;">📊 Distribution Imbalance Alert</div><div class="alert-body">Top ${topN} of ${totalICs} Issue Centers hold <strong>${topHalfPct}%</strong> of district stock. High concentration may signal unequal distribution — consider rebalancing.</div></div>`;
    }

    if (maxIC.total && districtTotal > 0) {
        const maxShare = (maxIC.total / districtTotal * 100).toFixed(1);
        alertsHtml += `<div class="alert-card alert-ok"><div class="alert-title" style="color:#059669;">🟢 Strongest Buffer IC</div><div class="alert-body"><strong>${maxIC.name}</strong> holds the district's highest reserve at <strong>${fmtQ(maxIC.total)}</strong> (${maxShare}% share). This provides strong food security buffer.</div></div>`;
    }

    // Wheat Pool Intelligence (Aged vs Fresh Breakdown)
    function getWheatHeaderYear(h) {
        const rangeMatch = h.match(/(?:20)?(\d{2})[-/](?:20)?(\d{2})/);
        if (rangeMatch) {
            const startYear = parseInt(rangeMatch[1], 10);
            return startYear < 100 ? (2000 + startYear) : startYear;
        }
        const singleYearMatch = h.match(/\b(20\d{2})\b/);
        if (singleYearMatch) {
            return parseInt(singleYearMatch[1], 10);
        }
        return 0;
    }

    const wheatCols = commodityHeaders.filter(h => h.toLowerCase().includes('wheat'));
    wheatCols.sort((a, b) => getWheatHeaderYear(b) - getWheatHeaderYear(a));

    const totalWheatQt = donutGroups['Wheat (गेहूं)'] || 0;
    const freshWheatHeader = wheatCols[0] || '';
    const freshWheatQt = freshWheatHeader ? (commodityTotals[freshWheatHeader] || 0) : 0;
    const agedWheatCols = wheatCols.slice(1);
    const agedWheatQt = agedWheatCols.reduce((sum, h) => sum + (commodityTotals[h] || 0), 0);

    const totalWheatPct = districtTotal > 0 ? (totalWheatQt / districtTotal * 100).toFixed(1) : '0.0';
    const agedPctOfDistrict = districtTotal > 0 ? (agedWheatQt / districtTotal * 100).toFixed(1) : '0.0';
    const agedPctOfWheatPool = totalWheatQt > 0 ? (agedWheatQt / totalWheatQt * 100).toFixed(1) : '0.0';
    const freshYearLabel = freshWheatHeader.match(/(?:20)?\d{2}[-/](?:20)?\d{2}|\b20\d{2}\b/)?.[0] || 'current-season';

    if (parseFloat(totalWheatPct) > 0) {
        let wheatMsg = '';
        if (agedWheatQt > 0.001) {
            wheatMsg = `Wheat pool is ${totalWheatPct}% of district stock (${fmtQ(totalWheatQt)}), but only ${fmtQ(agedWheatQt)} — ${agedPctOfWheatPool}% of the pool, ${agedPctOfDistrict}% of district total — is aged pre-${freshYearLabel} procurement. Prioritize this portion for offloading; the remaining ${fmtQ(freshWheatQt)} is current-season stock.`;
        } else {
            wheatMsg = `Wheat constitutes ${totalWheatPct}% of total district stock (${fmtQ(totalWheatQt)}), all of which is fresh current-season (${freshYearLabel}) stock with no aged procurement backlog.`;
        }
        alertsHtml += `<div class="alert-card alert-info"><div class="alert-title" style="color:#2563eb;">🌾 Wheat Pool Intelligence</div><div class="alert-body">${wheatMsg}</div></div>`;
    }

    const section3 = `
    <div class="section-divider"></div>
    <div class="page">
        <div class="section-header">
            <div class="section-num">3</div>
            <div>
                <div style="font-size:14px;font-weight:800;">Risk Intelligence & Smart Alerts</div>
                <div style="font-size:11px;color:#c9a227;font-weight:500;">जोखिम विश्लेषण एवं स्मार्ट अलर्ट</div>
            </div>
        </div>
        <div class="page-inner">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>${alertsHtml}</div>
                <div>
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">IC Stock Ranking</div>
                    ${sorted.map((ic, i) => {
                        const share = districtTotal > 0 ? (ic.total / districtTotal * 100).toFixed(1) : '0';
                        const barW = maxIC.total > 0 ? (ic.total / maxIC.total * 100).toFixed(0) : 0;
                        const medals = ['🥇','🥈','🥉'];
                        const colors = ['#f59e0b','#94a3b8','#cd7f32'];
                        const c = colors[i] || '#059669';
                        return `<div class="ranking-row">
                            <span style="font-size:16px;">${medals[i] || '#'+(i+1)}</span>
                            <div style="flex:1;">
                                <div style="font-size:12px;font-weight:700;color:#1e293b;">${ic.name}</div>
                                <div style="height:4px;background:#f1f5f9;border-radius:2px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:${barW}%;background:${c};border-radius:2px;"></div></div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:11px;font-weight:800;color:${c};">${fmtQ(ic.total)}</div>
                                <div style="font-size:10px;color:#94a3b8;">${share}%</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    </div>`;

    // ──────────────────────────────────────────────────
    // SECTION 4: MANAGEMENT SUMMARY & PRIORITIES
    // ──────────────────────────────────────────────────
    const priorities = [];

    if (negativeItems.length > 0) {
        priorities.push({
            title: 'Immediate: Resolve Negative Stock Positions',
            body: `${negativeItems.length} commodity-IC combination(s) show negative stock. Conduct physical verification at ${[...new Set(negativeItems.map(n => n.center))].join(', ')} and initiate emergency replenishment if confirmed.`,
            color: '#dc2626'
        });
    }
    if (lowBufferICs.length > 0) {
        const lowBufferTargetQt = avgStock * LOW_BUFFER_THRESHOLD_PCT;
        const icReplenishmentDetails = lowBufferICs.map(ic => {
            const icTot = parseFloat(ic.total) || 0;
            const neededQt = Math.max(0, lowBufferTargetQt - icTot);
            return {
                name: ic.name,
                neededQt: neededQt,
                formatted: `${ic.name}: +${fmtQ(neededQt)}`
            };
        });
        const totalNeededQt = icReplenishmentDetails.reduce((sum, item) => sum + item.neededQt, 0);
        const icListFormatted = icReplenishmentDetails.map(item => item.formatted).join(' · ');

        priorities.push({
            title: 'Priority: Replenish Low-Buffer Issue Centers',
            body: `${lowBufferICs.length} IC(s) hold below 50% of district average: ${icListFormatted}. Total replenishment needed: ${fmtQ(totalNeededQt)}. Recommend prioritizing dispatch from nearest warehouse in next allocation cycle.`,
            color: '#d97706'
        });
    }
    if (parseFloat(topHalfPct) > 75) {
        priorities.push({
            title: 'Governance: Rebalance Stock Distribution',
            body: `Top ${topN} of ${totalICs} Issue Centers hold ${topHalfPct}% of district stock. Review dispatch planning to ensure equitable coverage across all Issue Centers.`,
            color: '#2563eb'
        });
    }
    if (priorities.length < 3 && agedWheatQt > 0.001) {
        priorities.push({
            title: 'Priority: Expedite Offloading of Aged Wheat',
            body: `Aged pre-${freshYearLabel} wheat stock stands at ${fmtQ(agedWheatQt)} (${agedPctOfWheatPool}% of wheat pool, ${agedPctOfDistrict}% of district stock). Prioritize offloading and FIFO dispatch to avoid shelf-life degradation.`,
            color: '#f26b2b'
        });
    } else if (priorities.length < 3 && parseFloat(totalWheatPct) > 60) {
        priorities.push({
            title: 'Monitor: High Wheat Concentration',
            body: `Wheat accounts for ${totalWheatPct}% of total stock (${fmtQ(totalWheatQt)}). Track expiry timelines and plan proactive offloading before new allocation.`,
            color: '#f26b2b'
        });
    }
    if (priorities.length === 0) {
        priorities.push({
            title: 'Status: Maintain Current Buffer Levels',
            body: `District stock position is healthy. All ICs show positive stock with balanced distribution. Continue routine monitoring and timely dispatch adherence.`,
            color: '#059669'
        });
    }

    const priorityCards = priorities.slice(0, 3).map((p, i) => `
        <div class="priority-card">
            <div style="font-size:12px;font-weight:800;color:#c9a227;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <span class="priority-num">${i + 1}</span> ${p.title}
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.85);line-height:1.6;">${p.body}</div>
        </div>`
    ).join('');

    const section4 = `
    <div class="section-divider"></div>
    <div class="page">
        <div class="section-header">
            <div class="section-num">4</div>
            <div>
                <div style="font-size:14px;font-weight:800;">Management Summary & Action Priorities</div>
                <div style="font-size:11px;color:#c9a227;font-weight:500;">प्रबंधन सारांश एवं प्राथमिकता कार्ययोजना</div>
            </div>
        </div>
        <div class="page-inner">
            <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start;">
                <div>
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">Top Management Priorities</div>
                    ${priorityCards}
                </div>
                <div>
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">District Health Scorecard</div>
                    <div style="background:#0b2545;border-radius:12px;padding:20px;color:white;text-align:center;border:3px solid #c9a227;">
                        <div style="font-size:11px;color:#c9a227;font-weight:700;margin-bottom:8px;text-transform:uppercase;">Overall Health Score</div>
                        <div style="font-size:52px;font-weight:800;color:${healthColor};line-height:1;">${healthScore}</div>
                        <div style="font-size:13px;font-weight:700;color:${healthColor};margin-top:4px;">${healthLabel}</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">out of 100</div>
                    </div>
                    <div class="scorecard">
                        <div class="score-item">
                            <div class="score-val" style="color:${negativeItems.length > 0 ? '#dc2626' : '#059669'};">${negativeItems.length}</div>
                            <div class="score-lab">Negative Items</div>
                        </div>
                        <div class="score-item">
                            <div class="score-val" style="color:${lowBufferICs.length > 0 ? '#d97706' : '#059669'};">${lowBufferICs.length}</div>
                            <div class="score-lab">Low Buffer ICs</div>
                        </div>
                        <div class="score-item">
                            <div class="score-val" style="color:#2563eb;">${icData.length}</div>
                            <div class="score-lab">Total ICs</div>
                        </div>
                    </div>
                    <div style="margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Distribution Equity</div>
                        <div style="font-size:20px;font-weight:800;color:${parseFloat(topHalfPct) > 75 ? '#d97706' : '#059669'};">${topHalfPct}%</div>
                        <div style="font-size:10px;color:#94a3b8;">Top ${topN} of ${totalICs} ICs hold of total stock</div>
                        <div style="font-size:10px;font-weight:700;color:${parseFloat(topHalfPct) > 75 ? '#d97706' : '#059669'};margin-top:4px;">${parseFloat(topHalfPct) > 75 ? '⚠️ Concentration Risk' : '✅ Equitable Distribution'}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // ──────────────────────────────────────────────────
    // FOOTER
    // ──────────────────────────────────────────────────
    const footer = `
    <div class="footer-bar">
        <div>📊 उन्नत विश्लेषण रिपोर्ट प्रीव्यू / Advanced Analytics Executive Report — Live District Stock Position</div>
        <div style="text-align:right;">मध्यप्रदेश स्टेट सिविल सप्लाइज कारपोरेशन लि. • Betul District PDS • ${syncTime}</div>
    </div>`;

    return `
    <div class="report-root">
        <style>${baseCss}</style>
        ${coverSection}
        ${section1}
        ${section2}
        ${section3}
        ${section4}
        ${footer}
    </div>`;
}

async function downloadStockAdvReport(type) {
    const data = window.lastStockData;
    if (!data || !data.icData || data.icData.length === 0) {
        if (typeof showToast === 'function') showToast('⚠️ No data loaded. Please sync first.', 'warning');
        return;
    }

    if (type === 'excel') {
        // Two-sheet CSV export
        const icData = data.icData || [];
        const headers = data.headers || [];
        const commodityHeaders = headers.slice(1, headers.length - 1);

        // Sheet 1: IC Summary
        let csv1 = '\uFEFF'; // BOM
        csv1 += ['IC Name','Total Stock (Qt)','% District Share','Status'].join(',') + '\n';
        const districtTotal = icData.reduce((s, ic) => s + ic.total, 0);
        const avgStock = icData.length ? districtTotal / icData.length : 0;
        icData.slice().sort((a, b) => b.total - a.total).forEach(ic => {
            const share = districtTotal > 0 ? (ic.total / districtTotal * 100).toFixed(2) : '0';
            const status = ic.total < avgStock * 0.5 ? 'LOW BUFFER' : ic.total > avgStock * 1.3 ? 'HIGH BUFFER' : 'NORMAL';
            csv1 += ['"' + ic.name + '"', ic.total.toFixed(2), share + '%', '"' + status + '"'].join(',') + '\n';
        });
        csv1 += ['"DISTRICT TOTAL"', districtTotal.toFixed(2), '100.00%', '"—"'].join(',') + '\n';

        // Sheet 2: Commodity Matrix
        let csv2 = '\uFEFF';
        csv2 += ['IC Name', ...commodityHeaders, 'IC Total'].join(',') + '\n';
        icData.forEach(ic => {
            const vals = commodityHeaders.map(h => (ic.commodities[h] || 0).toFixed(2));
            csv2 += ['"' + ic.name + '"', ...vals, ic.total.toFixed(2)].join(',') + '\n';
        });
        // Totals row
        const commTotals = commodityHeaders.map(h => icData.reduce((s, ic) => s + (ic.commodities[h] || 0), 0).toFixed(2));
        csv2 += ['"TOTAL"', ...commTotals, districtTotal.toFixed(2)].join(',') + '\n';

        const date = new Date().toISOString().slice(0, 10);

        // Download Sheet 1
        const blob1 = new Blob([csv1], { type: 'text/csv;charset=utf-8;' });
        const a1 = document.createElement('a');
        a1.href = URL.createObjectURL(blob1);
        a1.download = `Stock_IC_Summary_${date}.csv`;
        document.body.appendChild(a1);
        a1.click();
        document.body.removeChild(a1);

        // Short delay then Sheet 2
        await new Promise(r => setTimeout(r, 400));
        const blob2 = new Blob([csv2], { type: 'text/csv;charset=utf-8;' });
        const a2 = document.createElement('a');
        a2.href = URL.createObjectURL(blob2);
        a2.download = `Stock_Commodity_Matrix_${date}.csv`;
        document.body.appendChild(a2);
        a2.click();
        document.body.removeChild(a2);

        if (typeof showToast === 'function') showToast('📊 Excel export complete — 2 CSV files downloaded!', 'success', 3500);
        return;
    }

    // Image or PDF — capture the report content div
    const reportEl = document.getElementById('stockAdvReportContent');
    if (!reportEl) {
        alert('Report not visible. Please open the report preview first.');
        return;
    }

    if (typeof html2canvas === 'undefined') {
        alert('html2canvas library is not loaded. Cannot export image/PDF.');
        return;
    }

    try {
        if (typeof showToast === 'function') {
            showToast(type === 'pdf' ? '📄 Generating PDF...' : '🖼️ Generating image...', 'info', 5000);
        }

        await new Promise(r => setTimeout(r, 350));

        const canvas = await html2canvas(reportEl, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: -window.scrollY,
            width: reportEl.scrollWidth,
            height: reportEl.scrollHeight,
            windowWidth: reportEl.scrollWidth,
            windowHeight: reportEl.scrollHeight
        });

        const date = new Date().toISOString().slice(0, 10);

        if (type === 'image') {
            const link = document.createElement('a');
            link.download = `Stock_Advanced_Analytics_${date}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.92);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            if (typeof showToast === 'function') showToast('✅ Image exported!', 'success', 3000);
        } else if (type === 'pdf') {
            const jsPDFLib = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
            if (!jsPDFLib) { alert('jsPDF library not loaded.'); return; }

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDFLib({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const maxW = pw - margin * 2;
            const maxH = ph - margin * 2;
            const ratio = canvas.width / canvas.height;

            // Multi-page support for tall content
            const pageHeightPx = canvas.width / maxW * maxH;
            let srcY = 0;
            let pageNum = 0;

            while (srcY < canvas.height) {
                if (pageNum > 0) pdf.addPage();

                const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceH;
                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

                const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 1.0);
                const sliceRenderH = sliceH / canvas.width * maxW;
                pdf.addImage(sliceImgData, 'JPEG', margin, margin, maxW, sliceRenderH);

                srcY += sliceH;
                pageNum++;
            }

            pdf.save(`Stock_Advanced_Analytics_${date}.pdf`);
            try { window.open(URL.createObjectURL(pdf.output('blob')), '_blank'); } catch(e) {}
            if (typeof showToast === 'function') showToast('✅ PDF exported!', 'success', 3000);
        }
    } catch (err) {
        console.error('Export error:', err);
        alert('Export failed: ' + err.message);
    }
}

window.showStockAdvancedReport = showStockAdvancedReport;
window.closeStockAdvancedReport = closeStockAdvancedReport;
window.buildStockAdvancedReportHTML = buildStockAdvancedReportHTML;
window.downloadStockAdvReport = downloadStockAdvReport;
window.computeDistrictHealthScore = computeDistrictHealthScore;
window.computeTopConcentration = computeTopConcentration;
window.toggleHealthScoreAudit = toggleHealthScoreAudit;
window.LOW_BUFFER_THRESHOLD_PCT = LOW_BUFFER_THRESHOLD_PCT;
window.HIGH_BUFFER_THRESHOLD_PCT = HIGH_BUFFER_THRESHOLD_PCT;

// ═══════════════════════════════════════════════════════════════
//  INTERACTIVE MANUAL CAPTCHA MODAL HANDLERS (FOR CLOUD / RENDER)
// ═══════════════════════════════════════════════════════════════

window.currentCaptchaRequestId = null;

function openManualCaptchaModal(imageBase64, requestId, message) {
    const modal = document.getElementById('manualCaptchaModal');
    const imgEl = document.getElementById('manualCaptchaImage');
    const inputEl = document.getElementById('manualCaptchaInput');
    const statusEl = document.getElementById('manualCaptchaStatus');
    const btnSubmit = document.getElementById('btnSubmitCaptcha');

    if (!modal || !imageBase64) return;

    const isAlreadyOpen = modal.style.display === 'flex';
    const isSameImage = imgEl && imgEl.getAttribute('data-raw') === imageBase64;

    // If modal is already open and displaying the exact same captcha image, DO NOT touch user input
    if (isAlreadyOpen && isSameImage) {
        return;
    }

    window.currentCaptchaRequestId = requestId;
    if (imgEl) {
        imgEl.src = imageBase64;
        imgEl.setAttribute('data-raw', imageBase64);
    }
    modal.style.display = 'flex';

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '🚀 Submit & Continue';
    }

    if (statusEl) {
        if (isAlreadyOpen && !isSameImage) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#f59e0b';
            statusEl.innerText = '⚠️ Previous code was not accepted. Please enter the fresh characters shown above.';
        } else {
            statusEl.style.display = 'none';
            statusEl.innerHTML = '';
        }
    }

    // Clear and focus when modal opens or when image changes
    if (inputEl) {
        inputEl.value = '';
        setTimeout(() => {
            inputEl.focus();
        }, 150);
    }
}

function closeManualCaptchaModal() {
    const modal = document.getElementById('manualCaptchaModal');
    if (modal && modal.style.display !== 'none') {
        modal.style.display = 'none';
        const inputEl = document.getElementById('manualCaptchaInput');
        if (inputEl) inputEl.value = '';
    }
}

async function submitManualCaptcha(event) {
    if (event) event.preventDefault();

    const requestId = window.currentCaptchaRequestId;
    const inputEl = document.getElementById('manualCaptchaInput');
    const btnSubmit = document.getElementById('btnSubmitCaptcha');
    const statusEl = document.getElementById('manualCaptchaStatus');

    const captchaCode = inputEl ? inputEl.value.trim() : '';
    if (!captchaCode) {
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#ef4444';
            statusEl.innerText = '⚠️ Please enter the CAPTCHA characters.';
        }
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '⏳ Submitting to server...';
    }

    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#6366f1';
        statusEl.innerText = '🔄 Submitting code to browser session...';
    }

    try {
        const endpoints = ['/api/captcha/submit', 'api/captcha/submit'];
        let response = null;

        for (const ep of endpoints) {
            try {
                const res = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId, captchaCode })
                });
                if (res) { response = res; break; }
            } catch (err) {}
        }

        if (!response || !response.ok) {
            const errData = response ? await response.json().catch(() => ({})) : {};
            throw new Error(errData.error || 'Failed to submit CAPTCHA to server.');
        }

        if (statusEl) {
            statusEl.style.color = '#10b981';
            statusEl.innerText = '✅ Code submitted! Verifying login with portal...';
        }
    } catch (err) {
        console.error('Error submitting CAPTCHA:', err);
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#ef4444';
            statusEl.innerText = `❌ ${err.message}`;
        }
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '🚀 Submit & Continue';
        }
    }
}

async function refreshManualCaptcha() {
    const requestId = window.currentCaptchaRequestId;
    const imgEl = document.getElementById('manualCaptchaImage');
    const btnRef = document.getElementById('btnRefreshCaptcha');
    const statusEl = document.getElementById('manualCaptchaStatus');
    const inputEl = document.getElementById('manualCaptchaInput');

    if (!requestId) return;

    if (btnRef) {
        btnRef.disabled = true;
        btnRef.innerHTML = '⏳ Refreshing...';
    }

    try {
        const endpoints = ['/api/captcha/refresh', 'api/captcha/refresh'];
        let response = null;

        for (const ep of endpoints) {
            try {
                const res = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId })
                });
                if (res) { response = res; break; }
            } catch (err) {}
        }

        if (response && response.ok) {
            const data = await response.json();
            if (data.captchaImage && imgEl) {
                imgEl.src = data.captchaImage;
                if (inputEl) {
                    inputEl.value = '';
                    inputEl.focus();
                }
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.style.color = '#10b981';
                    statusEl.innerText = '✅ Fresh CAPTCHA loaded.';
                }
            }
        }
    } catch (err) {
        console.error('Error refreshing CAPTCHA:', err);
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#ef4444';
            statusEl.innerText = '❌ Failed to refresh CAPTCHA.';
        }
    } finally {
        if (btnRef) {
            btnRef.disabled = false;
            btnRef.innerHTML = '<span>🔄</span> Refresh CAPTCHA';
        }
    }
}

window.openManualCaptchaModal = openManualCaptchaModal;
window.closeManualCaptchaModal = closeManualCaptchaModal;
window.submitManualCaptcha = submitManualCaptcha;
window.refreshManualCaptcha = refreshManualCaptcha;
