/* ════════════════════════════════════════════════════
   DATA LAYER
════════════════════════════════════════════════════ */
const DirDB = {
    K: {
        branches:     'dir_v1_branches',
        issueCenters: 'dir_v1_issue_centers',
        godowns:      'dir_v1_godowns',
        transporters: 'dir_v1_transporters'
    },
    API: {
        branches:     'api/directory/branches',
        issueCenters: 'api/directory/issue-centers',
        godowns:      'api/directory/godowns',
        transporters: 'api/directory/transporters'
    },

    get(key)         { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; } },
    set(key, data)   { localStorage.setItem(key, JSON.stringify(data)); },
    getBranches()    { return this.get(this.K.branches); },
    getICs()         { return this.get(this.K.issueCenters); },
    getGodowns()     { return this.get(this.K.godowns); },
    getTransporters(){ return this.get(this.K.transporters); },

    genId(prefix)    { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); },
    ts()             { return new Date().toISOString(); },

    /* ── CRUD: Branches ── */
    addBranch(data) {
        const rows = this.getBranches();
        const rec = { ...data, id: this.genId('BR'), createdAt: this.ts(), updatedAt: this.ts() };
        rows.push(rec);
        this.set(this.K.branches, rows);
        this.apiSync('POST', this.API.branches, rec);
        return rec;
    },
    updateBranch(id, data) {
        const rows = this.getBranches().map(r => r.id === id ? { ...r, ...data, updatedAt: this.ts() } : r);
        this.set(this.K.branches, rows);
        this.apiSync('PUT', this.API.branches + '/' + id, data);
    },
    deleteBranch(id) {
        this.set(this.K.branches, this.getBranches().filter(r => r.id !== id));
        this.apiSync('DELETE', this.API.branches + '/' + id);
    },

    /* ── CRUD: Issue Centers ── */
    addIC(data) {
        const rows = this.getICs();
        const rec = { ...data, id: this.genId('IC'), createdAt: this.ts(), updatedAt: this.ts() };
        rows.push(rec);
        this.set(this.K.issueCenters, rows);
        this.apiSync('POST', this.API.issueCenters, rec);
        return rec;
    },
    updateIC(id, data) {
        const rows = this.getICs().map(r => r.id === id ? { ...r, ...data, updatedAt: this.ts() } : r);
        this.set(this.K.issueCenters, rows);
        this.apiSync('PUT', this.API.issueCenters + '/' + id, data);
    },
    deleteIC(id) {
        this.set(this.K.issueCenters, this.getICs().filter(r => r.id !== id));
        this.apiSync('DELETE', this.API.issueCenters + '/' + id);
    },

    /* ── CRUD: Godowns ── */
    addGodown(data) {
        const rows = this.getGodowns();
        const rec = { ...data, id: this.genId('GD'), createdAt: this.ts(), updatedAt: this.ts() };
        rows.push(rec);
        this.set(this.K.godowns, rows);
        this.apiSync('POST', this.API.godowns, rec);
        return rec;
    },
    updateGodown(id, data) {
        const rows = this.getGodowns().map(r => r.id === id ? { ...r, ...data, updatedAt: this.ts() } : r);
        this.set(this.K.godowns, rows);
        this.apiSync('PUT', this.API.godowns + '/' + id, data);
    },
    deleteGodown(id) {
        this.set(this.K.godowns, this.getGodowns().filter(r => r.id !== id));
        this.apiSync('DELETE', this.API.godowns + '/' + id);
    },

    /* ── Async API sync (fire & forget) ── */
    async apiSync(method, url, data) {
        try {
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: method !== 'DELETE' ? JSON.stringify(data) : undefined
            });
        } catch(e) { /* Backend not yet connected — data saved in localStorage */ }
    },

    /* ── Transporter sync ── */
    async fetchTransporters() {
        // 1. Try dedicated endpoint
        try {
            const res = await fetch(this.API.transporters);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.set(this.K.transporters, data);
                    return data;
                }
            }
        } catch(e) {}

        // 2. Fall back: extract from report sector data
        const found = {};
        const schemes = ['nfsa','mdm','icds','welfare'];
        for (const scheme of schemes) {
            try {
                const listRes = await fetch(`api/reports?scheme=${scheme}`);
                if (!listRes.ok) continue;
                const reports = await listRes.json();
                if (!Array.isArray(reports) || reports.length === 0) continue;
                // Use latest 2 reports for coverage
                const toFetch = reports.slice(0, 2);
                for (const r of toFetch) {
                    if (!r.id) continue;
                    const detailRes = await fetch(`api/reports/${r.id}`);
                    if (!detailRes.ok) continue;
                    const detail = await detailRes.json();
                    const insights = detail.insights || {};
                    const sectors = detail.sectors || detail.sectorData || insights.allSectors || insights.matrix || [];
                    sectors.forEach(s => {
                        const name = (s.transporter || s.transporterName || '').trim();
                        if (!name) return;
                        if (!found[name]) {
                            found[name] = {
                                id: 'TR_' + name.replace(/\s+/g,'_'),
                                name,
                                mobile: s.mobile || s.transporterMobile || '',
                                sector: s.sectorName || s.sector || s.name || '',
                                issueCenterName: s.shopName || s.issueCenterName || '',
                                scheme: scheme.toUpperCase(),
                                source: 'report'
                            };
                        } else if (!found[name].mobile && s.mobile) {
                            found[name].mobile = s.mobile;
                        }
                    });
                }
            } catch(e) {}
        }
        const result = Object.values(found);
        if (result.length > 0) this.set(this.K.transporters, result);
        return this.getTransporters();
    },

    /* ── Helpers ── */
    getBranchById(id) { return this.getBranches().find(b => b.id === id); },
    getGodownsByBranch(branchId) { return this.getGodowns().filter(g => g.branchId === branchId); },
    getICsByBranch(branchId) { return this.getICs().filter(ic => ic.branchId === branchId); },
    getICsByGodown(godownId) { return this.getICs().filter(ic => (ic.godownIds || []).includes(godownId)); },
};

/* ════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════ */
let State = {
    view: 'dashboard',
    viewMode: { branches:'card', issueCenters:'card', godowns:'card', transporters:'card' },
    filters: { branches:{}, issueCenters:{}, godowns:{}, transporters:{} },
    editType: null,
    editId: null,
    deleteType: null,
    deleteId: null,
    reportType: 'branches',
};

/* ════════════════════════════════════════════════════
   VIEW ROUTING
════════════════════════════════════════════════════ */
function showView(name, navEl) {
    document.querySelectorAll('.dir-view').forEach(v => v.style.display = 'none');
    const v = document.getElementById('view-' + name);
    if (v) v.style.display = 'block';
    document.querySelectorAll('.app-sidebar .nav-item').forEach(n => n.classList.remove('active'));
    if (navEl) navEl.classList.add('active');
    State.view = name;
    if (name === 'dashboard')    renderDashboard();
    if (name === 'branches')     { refreshBranchFilters(); renderBranches(); }
    if (name === 'issueCenters') { refreshICFilters(); renderIssueCenters(); }
    if (name === 'godowns')      { refreshGodownFilters(); renderGodowns(); }
    if (name === 'transporters') { refreshTransporterFilters(); renderTransporters(); }
    if (name === 'hierarchy')    renderHierarchy();
    if (name === 'reports')      { selectReport(State.reportType); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════════════════
   ALIAS: showDirectoryView → showView
   index.html calls showDirectoryView(); directory.html
   calls showView(). This bridges both conventions.
════════════════════════════════════════════════════ */
function showDirectoryView(name, navEl) {
    // If caller passed null/undefined, try to resolve by both ID patterns
    if (!navEl) {
        navEl = document.getElementById('dirTab-' + name)
             || document.getElementById('dir-nav-' + name)
             || null;
    }
    // Also sync the scheme-tab active state used in index.html
    document.querySelectorAll('.scheme-tab').forEach(t => t.classList.remove('active-tab'));
    const tabEl = document.getElementById('dirTab-' + name);
    if (tabEl) tabEl.classList.add('active-tab');

    showView(name, navEl);
}

/* ════════════════════════════════════════════════════
   FILTER / SEARCH
════════════════════════════════════════════════════ */
function filterView(entity, key, value) {
    State.filters[entity] = { ...State.filters[entity], [key]: value };
    if (entity === 'branches')     renderBranches();
    if (entity === 'issueCenters') renderIssueCenters();
    if (entity === 'godowns')      renderGodowns();
    if (entity === 'transporters') renderTransporters();
}
function setViewMode(entity, mode, btn) {
    State.viewMode[entity] = mode;
    btn.closest('.view-toggle-wrap').querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (entity === 'branches')     renderBranches();
    if (entity === 'issueCenters') renderIssueCenters();
    if (entity === 'godowns')      renderGodowns();
    if (entity === 'transporters') renderTransporters();
}
function applyFilters(arr, filters) {
    return arr.filter(r => {
        const q = (filters.search || '').toLowerCase();
        if (q) {
            const blob = JSON.stringify(r).toLowerCase();
            if (!blob.includes(q)) return false;
        }
        if (filters.status && r.status !== filters.status) return false;
        if (filters.district && r.district !== filters.district) return false;
        if (filters.branchId && r.branchId !== filters.branchId) return false;
        if (filters.sector && r.sector !== filters.sector) return false;
        if (filters.scheme && (r.scheme || '').toLowerCase() !== filters.scheme) return false;
        return true;
    });
}
function globalSearch(q) {
    if (!q.trim()) { clearSearch(); return; }
    document.querySelectorAll('.dir-view').forEach(v => v.style.display = 'none');
    document.getElementById('view-search').style.display = 'block';
    const ql = q.toLowerCase();
    const results = [];
    const search = (arr, type, label, color) => arr.filter(r => JSON.stringify(r).toLowerCase().includes(ql))
        .forEach(r => results.push({ type, label, color, record: r }));
    search(DirDB.getBranches(),    'branch',      'MPWLC Branch',  '#6366f1');
    search(DirDB.getICs(),         'issueCenter', 'Issue Center',  '#f26b2b');
    search(DirDB.getGodowns(),     'godown',      'Godown',        '#06b6d4');
    search(DirDB.getTransporters(),'transporter', 'Transporter',   '#10b981');
    document.getElementById('searchResultsDesc').textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${q}"`;
    document.getElementById('searchResultsContainer').innerHTML = results.length === 0
        ? `<div class="dir-empty"><div class="dir-empty-icon">🔍</div><div class="dir-empty-title">No results found</div></div>`
        : results.map(res => renderSearchResult(res)).join('');
}
function renderSearchResult({ type, label, color, record }) {
    const name = record.name || record.branchName || '(Unnamed)';
    let detail = '';
    if (type === 'branch') detail = `${record.district || ''} · Manager: ${record.managerName || '—'}`;
    if (type === 'issueCenter') detail = `Sector: ${record.sector || '—'} · Manager: ${record.managerName || '—'}`;
    if (type === 'godown') detail = `${record.location || ''} · Branch: ${DirDB.getBranchById(record.branchId)?.name || '—'}`;
    if (type === 'transporter') detail = `Sector: ${record.sector || '—'} · Scheme: ${record.scheme || '—'}`;
    return `<div class="dir-card" style="--entity-color:${color};margin-bottom:12px;">
        <div class="dir-card-header">
            <div><div class="dir-card-title">${name}</div><div class="dir-card-sub">${detail}</div></div>
            <span class="entity-tag ${type}">${label}</span>
        </div>
        <div class="dir-card-footer">
            <button class="btn btn-sm btn-secondary" onclick="openEditModal('${type}','${record.id}')">✏️ Edit</button>
            <button class="btn btn-sm" style="background:#ef4444;color:white;border:none;" onclick="openDeleteConfirm('${type}','${record.id}')">🗑️ Delete</button>
        </div>
    </div>`;
}
function clearSearch() {
    document.getElementById('globalSearchInput').value = '';
    showView(State.view, document.getElementById('dir-nav-' + State.view));
}

/* ════════════════════════════════════════════════════
   RENDER: DASHBOARD
════════════════════════════════════════════════════ */
function renderDashboard() {
    const branches = DirDB.getBranches();
    const ics = DirDB.getICs();
    const godowns = DirDB.getGodowns();
    const transporters = DirDB.getTransporters();
    setText('ds-branches', branches.length);
    setText('ds-ics', ics.length);
    setText('ds-godowns', godowns.length);
    setText('ds-transporters', transporters.length);
}

/* ════════════════════════════════════════════════════
   RENDER: BRANCHES
════════════════════════════════════════════════════ */
function renderBranches() {
    const data = applyFilters(DirDB.getBranches(), State.filters.branches);
    const cont = document.getElementById('branches-content');
    if (!cont) return;
    if (data.length === 0) { cont.innerHTML = emptyState('🏢','No MPWLC Branches Found','Add your first MPWLC branch to get started.','openAddModal(\'branch\')','+ Add Branch'); return; }
    if (State.viewMode.branches === 'table') {
        cont.innerHTML = `<div class="dir-table-wrap"><table class="dir-table">
            <thead><tr><th>Branch ID</th><th>Branch Name</th><th>District</th><th>Branch Manager</th><th>Mobile</th><th>Godowns</th><th>Issue Centers</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${data.map(b => {
                const gdCount = DirDB.getGodownsByBranch(b.id).length;
                const icCount = DirDB.getICsByBranch(b.id).length;
                return `<tr>
                    <td><code style="font-size:11px;color:var(--primary);">${b.id}</code></td>
                    <td style="font-weight:600;">${b.name}</td>
                    <td>${b.district || '—'}</td>
                    <td>${b.managerName || '—'}</td>
                    <td>${b.managerMobile ? `<a class="click-call" href="tel:${b.managerMobile}">${b.managerMobile}</a>` : '—'}</td>
                    <td><span style="font-weight:700;color:#06b6d4;">${gdCount}</span></td>
                    <td><span style="font-weight:700;color:#f26b2b;">${icCount}</span></td>
                    <td>${statusChip(b.status)}</td>
                    <td>${actionBtns('branch', b.id)}</td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    } else {
        cont.innerHTML = `<div class="dir-cards-grid">${data.map(b => branchCard(b)).join('')}</div>`;
    }
}
function branchCard(b) {
    const gdCount = DirDB.getGodownsByBranch(b.id).length;
    const icCount = DirDB.getICsByBranch(b.id).length;
    return `<div class="dir-card" style="--entity-color:#6366f1;">
        <div class="dir-card-header">
            <div>
                <div class="dir-card-title">${b.name}</div>
                <div class="dir-card-sub">🏙️ ${b.district || 'District —'} &nbsp; ${statusChip(b.status)}</div>
            </div>
            <span class="entity-tag branch">Branch</span>
        </div>
        <div class="dir-card-body">
            <div class="dir-card-row"><span class="row-icon">👤</span><div><strong>शाखा प्रबंधक:</strong> ${b.managerName || '—'}</div></div>
            ${b.managerMobile ? `<div class="dir-card-row"><span class="row-icon">📞</span><a class="click-call" href="tel:${b.managerMobile}">${b.managerMobile}</a></div>` : ''}
            ${b.email ? `<div class="dir-card-row"><span class="row-icon">📧</span>${b.email}</div>` : ''}
            ${b.address ? `<div class="dir-card-row"><span class="row-icon">📍</span>${b.address}</div>` : ''}
            <div class="dir-card-divider"></div>
            <div style="display:flex;gap:16px;">
                <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:#06b6d4;font-family:'Outfit',sans-serif;">${gdCount}</div><div style="font-size:10px;color:var(--text-muted);">Godowns</div></div>
                <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:#f26b2b;font-family:'Outfit',sans-serif;">${icCount}</div><div style="font-size:10px;color:var(--text-muted);">Issue Centers</div></div>
            </div>
        </div>
        <div class="dir-card-footer">
            <button class="btn btn-sm btn-secondary" onclick="openViewModal('branch','${b.id}')">👁️ View</button>
            <button class="btn btn-sm btn-secondary" onclick="openEditModal('branch','${b.id}')">✏️ Edit</button>
            <button class="btn btn-sm" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.2);" onclick="openDeleteConfirm('branch','${b.id}')">🗑️</button>
        </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   RENDER: ISSUE CENTERS
════════════════════════════════════════════════════ */
function renderIssueCenters() {
    const data = applyFilters(DirDB.getICs(), State.filters.issueCenters);
    const cont = document.getElementById('issueCenters-content');
    if (!cont) return;
    if (data.length === 0) { cont.innerHTML = emptyState('🏪','No Issue Centers Found','Add your first MPSCSC Issue Center to get started.','openAddModal(\'issueCenter\')','+ Add Issue Center'); return; }
    if (State.viewMode.issueCenters === 'table') {
        cont.innerHTML = `<div class="dir-table-wrap"><table class="dir-table">
            <thead><tr><th>ID</th><th>Name</th><th>Sector</th><th>केंद्र प्रभारी</th><th>Manager Mobile</th><th>Operator</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${data.map(ic => {
                const branch = DirDB.getBranchById(ic.branchId);
                return `<tr>
                    <td><code style="font-size:11px;color:#f26b2b;">${ic.id}</code></td>
                    <td style="font-weight:600;">${ic.name}</td>
                    <td>${ic.sector || '—'}</td>
                    <td>${ic.managerName || '—'}</td>
                    <td>${ic.managerMobile ? `<a class="click-call" href="tel:${ic.managerMobile}">${ic.managerMobile}</a>` : '—'}</td>
                    <td>${ic.operatorName || '—'}</td>
                    <td>${branch ? branch.name : '—'}</td>
                    <td>${statusChip(ic.status)}</td>
                    <td>${actionBtns('issueCenter', ic.id)}</td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    } else {
        cont.innerHTML = `<div class="dir-cards-grid">${data.map(ic => icCard(ic)).join('')}</div>`;
    }
}
function icCard(ic) {
    const branch = DirDB.getBranchById(ic.branchId);
    const godowns = (ic.godownIds || []).map(gid => {
        const g = DirDB.getGodowns().find(g => g.id === gid);
        return g ? `<span class="linked-chip" onclick="openViewModal('godown','${gid}')">${g.name}</span>` : '';
    }).join('');
    return `<div class="dir-card" style="--entity-color:#f26b2b;">
        <div class="dir-card-header">
            <div>
                <div class="dir-card-title">${ic.name}</div>
                <div class="dir-card-sub">🗺️ Sector: ${ic.sector || '—'} &nbsp; ${statusChip(ic.status)}</div>
            </div>
            <span class="entity-tag ic">Issue Center</span>
        </div>
        <div class="dir-card-body">
            <div class="dir-card-row"><span class="row-icon">👤</span><div><strong>केंद्र प्रभारी:</strong> ${ic.managerName || '—'}</div></div>
            ${ic.managerMobile ? `<div class="dir-card-row"><span class="row-icon">📞</span><a class="click-call" href="tel:${ic.managerMobile}">${ic.managerMobile}</a></div>` : ''}
            <div class="dir-card-row"><span class="row-icon">👷</span><div><strong>Operator:</strong> ${ic.operatorName || '—'}</div></div>
            ${ic.operatorMobile ? `<div class="dir-card-row"><span class="row-icon">📞</span><a class="click-call" href="tel:${ic.operatorMobile}">${ic.operatorMobile}</a></div>` : ''}
            ${ic.address ? `<div class="dir-card-row"><span class="row-icon">📍</span>${ic.address}</div>` : ''}
            <div class="dir-card-divider"></div>
            ${branch ? `<div class="dir-card-row"><span class="row-icon">🏢</span><div><strong>Branch:</strong> ${branch.name}</div></div>` : ''}
            ${godowns ? `<div class="dir-card-row"><span class="row-icon">🏭</span><div><strong>Godowns:</strong><div class="linked-chips" style="margin-top:5px;">${godowns}</div></div></div>` : ''}
        </div>
        <div class="dir-card-footer">
            <button class="btn btn-sm btn-secondary" onclick="openViewModal('issueCenter','${ic.id}')">👁️ View</button>
            <button class="btn btn-sm btn-secondary" onclick="openEditModal('issueCenter','${ic.id}')">✏️ Edit</button>
            <button class="btn btn-sm" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.2);" onclick="openDeleteConfirm('issueCenter','${ic.id}')">🗑️</button>
        </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   RENDER: GODOWNS
════════════════════════════════════════════════════ */
function renderGodowns() {
    const data = applyFilters(DirDB.getGodowns(), State.filters.godowns);
    const cont = document.getElementById('godowns-content');
    if (!cont) return;
    if (data.length === 0) { cont.innerHTML = emptyState('🏭','No Godowns Found','Add your first MPWLC Godown to get started.','openAddModal(\'godown\')','+ Add Godown'); return; }
    if (State.viewMode.godowns === 'table') {
        cont.innerHTML = `<div class="dir-table-wrap"><table class="dir-table">
            <thead><tr><th>ID</th><th>Godown Name</th><th>Location</th><th>Branch</th><th>Capacity</th><th>Issue Centers</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${data.map(g => {
                const branch = DirDB.getBranchById(g.branchId);
                const icCount = DirDB.getICsByGodown(g.id).length;
                return `<tr>
                    <td><code style="font-size:11px;color:#06b6d4;">${g.id}</code></td>
                    <td style="font-weight:600;">${g.name}</td>
                    <td>${g.location || '—'}</td>
                    <td>${branch ? branch.name : '—'}</td>
                    <td>${g.capacity || '—'}</td>
                    <td><span style="font-weight:700;color:#f26b2b;">${icCount}</span></td>
                    <td>${statusChip(g.status)}</td>
                    <td>${actionBtns('godown', g.id)}</td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    } else {
        cont.innerHTML = `<div class="dir-cards-grid">${data.map(g => godownCard(g)).join('')}</div>`;
    }
}
function godownCard(g) {
    const branch = DirDB.getBranchById(g.branchId);
    const icsHere = DirDB.getICsByGodown(g.id);
    return `<div class="dir-card" style="--entity-color:#06b6d4;">
        <div class="dir-card-header">
            <div>
                <div class="dir-card-title">${g.name}</div>
                <div class="dir-card-sub">📍 ${g.location || '—'} &nbsp; ${statusChip(g.status)}</div>
            </div>
            <span class="entity-tag godown">Godown</span>
        </div>
        <div class="dir-card-body">
            ${branch ? `<div class="dir-card-row"><span class="row-icon">🏢</span><div><strong>Branch:</strong> ${branch.name}</div></div>
            <div class="dir-card-row"><span class="row-icon">👤</span><div><strong>Branch Manager:</strong> ${branch.managerName || '—'} ${branch.managerMobile ? `<a class="click-call" href="tel:${branch.managerMobile}">${branch.managerMobile}</a>` : ''}</div></div>` : ''}
            ${g.capacity ? `<div class="dir-card-row"><span class="row-icon">📦</span><div><strong>Capacity:</strong> ${g.capacity}</div></div>` : ''}
            <div class="dir-card-divider"></div>
            <div class="dir-card-row"><span class="row-icon">🏪</span><div><strong>Issue Centers (${icsHere.length}):</strong>
            ${icsHere.length > 0 ? `<div class="linked-chips" style="margin-top:5px;">${icsHere.map(ic => `<span class="linked-chip" onclick="openViewModal('issueCenter','${ic.id}')">${ic.name}</span>`).join('')}</div>` : ' None linked'}
            </div></div>
        </div>
        <div class="dir-card-footer">
            <button class="btn btn-sm btn-secondary" onclick="openViewModal('godown','${g.id}')">👁️ View</button>
            <button class="btn btn-sm btn-secondary" onclick="openEditModal('godown','${g.id}')">✏️ Edit</button>
            <button class="btn btn-sm" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.2);" onclick="openDeleteConfirm('godown','${g.id}')">🗑️</button>
        </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   RENDER: TRANSPORTERS
════════════════════════════════════════════════════ */
function renderTransporters() {
    const data = applyFilters(DirDB.getTransporters(), State.filters.transporters);
    const cont = document.getElementById('transporters-content');
    if (!cont) return;
    if (data.length === 0) {
        cont.innerHTML = emptyState('🚛','No Transporters Synced','Click "Sync from Reports" to auto-import transporters from PDS report data.','syncTransporters()','🔄 Sync Transporters');
        return;
    }
    if (State.viewMode.transporters === 'table') {
        cont.innerHTML = `<div class="dir-table-wrap"><table class="dir-table">
            <thead><tr><th>Name</th><th>Mobile</th><th>Sector</th><th>Issue Center</th><th>Scheme</th><th>Source</th><th>Actions</th></tr></thead>
            <tbody>${data.map(t => `<tr>
                <td style="font-weight:600;">${t.name}</td>
                <td>${t.mobile ? `<a class="click-call" href="tel:${t.mobile}">${t.mobile}</a>` : '—'}</td>
                <td>${t.sector || '—'}</td>
                <td>${t.issueCenterName || '—'}</td>
                <td><span class="entity-tag ic">${t.scheme || '—'}</span></td>
                <td style="font-size:11px;color:var(--text-muted);">${t.source || 'manual'}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="openViewModal('transporter','${t.id}')">👁️ View</button></td>
            </tr>`).join('')}</tbody></table></div>`;
    } else {
        cont.innerHTML = `<div class="dir-cards-grid">${data.map(t => transporterCard(t)).join('')}</div>`;
    }
}
function transporterCard(t) {
    return `<div class="dir-card" style="--entity-color:#10b981;">
        <div class="dir-card-header">
            <div>
                <div class="dir-card-title">🚛 ${t.name}</div>
                <div class="dir-card-sub">🗺️ Sector: ${t.sector || '—'}</div>
            </div>
            <span class="entity-tag transporter">${t.scheme || 'Transporter'}</span>
        </div>
        <div class="dir-card-body">
            ${t.mobile ? `<div class="dir-card-row"><span class="row-icon">📞</span><a class="click-call" href="tel:${t.mobile}">${t.mobile}</a></div>` : `<div class="dir-card-row"><span class="row-icon">📞</span><span style="color:var(--text-muted);">No mobile on record</span></div>`}
            ${t.issueCenterName ? `<div class="dir-card-row"><span class="row-icon">🏪</span><div>${t.issueCenterName}</div></div>` : ''}
            <div class="dir-card-row"><span class="row-icon">📋</span><div style="font-size:11px;color:var(--text-muted);">Source: ${t.source || 'manual'}</div></div>
        </div>
        <div class="dir-card-footer">
            <button class="btn btn-sm btn-secondary" onclick="openViewModal('transporter','${t.id}')">👁️ View Details</button>
        </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   RENDER: HIERARCHY
════════════════════════════════════════════════════ */
function renderHierarchy() {
    const branches = DirDB.getBranches();
    const cont = document.getElementById('hierarchy-content');
    if (!cont) return;
    if (branches.length === 0) {
        cont.innerHTML = emptyState('🌳','No Data to Display','Add branches, godowns and issue centers first to see the hierarchy.','showView(\'branches\',document.getElementById(\'dir-nav-branches\'))','→ Add Branches');
        return;
    }
    const unmappedICs = DirDB.getICs().filter(ic => !ic.branchId);
    cont.innerHTML = branches.map(branch => {
        const godowns = DirDB.getGodownsByBranch(branch.id);
        const branchICs = DirDB.getICsByBranch(branch.id);
        return `<div class="h-branch-card">
            <div class="h-branch-header">
                <div>
                    <div class="h-branch-title">🏢 ${branch.name}</div>
                    <div class="h-branch-meta">📍 ${branch.district || ''} &nbsp; | &nbsp; शाखा प्रबंधक: ${branch.managerName || '—'} ${branch.managerMobile ? `<a class="click-call" href="tel:${branch.managerMobile}" style="color:#10b981;">${branch.managerMobile}</a>` : ''}</div>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:#06b6d4;">${godowns.length}</div><div style="font-size:10px;color:var(--text-muted);">Godowns</div></div>
                    <div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:#f26b2b;">${branchICs.length}</div><div style="font-size:10px;color:var(--text-muted);">Issue Centers</div></div>
                </div>
            </div>
            <div class="h-godown-block">
            ${godowns.length === 0 && branchICs.length === 0 ? '<div style="color:var(--text-muted);font-size:13px;font-style:italic;">No godowns or issue centers linked yet.</div>' : ''}
            ${godowns.map(g => {
                const gICs = DirDB.getICsByGodown(g.id);
                return `<div class="h-godown-row">
                    <div style="font-size:20px;flex-shrink:0;">🏭</div>
                    <div style="flex:1;">
                        <div class="h-godown-name">${g.name}</div>
                        <div style="font-size:11px;color:var(--text-muted);">📍 ${g.location || '—'} ${g.capacity ? '· Cap: ' + g.capacity : ''}</div>
                        ${gICs.length > 0 ? `<div class="h-ic-list">${gICs.map(ic => renderHierarchyIC(ic)).join('')}</div>` : '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;font-style:italic;">No Issue Centers linked to this godown.</div>'}
                    </div>
                </div>`;
            }).join('')}
            ${branchICs.filter(ic => (ic.godownIds || []).length === 0).map(ic => `
                <div style="margin-top:8px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">⚠️ Not linked to a godown:</div>${renderHierarchyIC(ic)}</div>`).join('')}
            </div>
        </div>`;
    }).join('') + (unmappedICs.length > 0 ? `<div class="h-branch-card" style="border-color:rgba(245,158,11,0.3);border-left-color:#f59e0b;">
        <div class="h-branch-header" style="background:rgba(245,158,11,0.06);">
            <div class="h-branch-title" style="color:#f59e0b;">⚠️ Unassigned Issue Centers</div>
        </div>
        <div class="h-godown-block">${unmappedICs.map(ic => renderHierarchyIC(ic)).join('')}</div>
    </div>` : '');
}
function renderHierarchyIC(ic) {
    const transporters = DirDB.getTransporters().filter(t => t.issueCenterId === ic.id || t.issueCenterName === ic.name);
    return `<div class="h-ic-row">
        <div class="h-ic-name">🏪 ${ic.name}</div>
        <div class="h-ic-contacts">
            <span>👤 केंद्र प्रभारी: <strong>${ic.managerName || '—'}</strong>${ic.managerMobile ? ` <a class="click-call" href="tel:${ic.managerMobile}" style="font-size:11px;">${ic.managerMobile}</a>` : ''}</span>
            <span>👷 Operator: <strong>${ic.operatorName || '—'}</strong>${ic.operatorMobile ? ` <a class="click-call" href="tel:${ic.operatorMobile}" style="font-size:11px;">${ic.operatorMobile}</a>` : ''}</span>
        </div>
        ${transporters.length > 0 ? `<div class="h-transporter-chips">${transporters.map(t => `<span class="h-transporter-chip">🚛 ${t.name}</span>`).join('')}</div>` : ''}
    </div>`;
}

/* ════════════════════════════════════════════════════
   MODALS: ADD / EDIT
════════════════════════════════════════════════════ */
function openAddModal(type) {
    State.editType = type; State.editId = null;
    const titles = { branch: '🏢 Add MPWLC Branch', issueCenter: '🏪 Add Issue Center', godown: '🏭 Add Godown' };
    document.getElementById('dirModalTitle').textContent = titles[type] || 'Add Record';
    document.getElementById('dirModalBody').innerHTML = buildForm(type, null);
    document.getElementById('dirModal').style.display = 'flex';
    populateFormDropdowns(type);
}
function openEditModal(type, id) {
    State.editType = type; State.editId = id;
    let record = null;
    if (type === 'branch') record = DirDB.getBranches().find(r => r.id === id);
    if (type === 'issueCenter') record = DirDB.getICs().find(r => r.id === id);
    if (type === 'godown') record = DirDB.getGodowns().find(r => r.id === id);
    if (!record) return;
    const titles = { branch: '✏️ Edit Branch', issueCenter: '✏️ Edit Issue Center', godown: '✏️ Edit Godown' };
    document.getElementById('dirModalTitle').textContent = titles[type];
    document.getElementById('dirModalBody').innerHTML = buildForm(type, record);
    document.getElementById('dirModal').style.display = 'flex';
    populateFormDropdowns(type, record);
}
function closeModal() { document.getElementById('dirModal').style.display = 'none'; State.editType = null; State.editId = null; }

function buildForm(type, data) {
    const v = (field) => data ? (data[field] || '') : '';
    const sel = (field, val) => data && data[field] === val ? 'selected' : '';
    if (type === 'branch') return `
        <div class="dir-form-grid">
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Branch Name <span class="required">*</span></label>
                <input class="dir-form-input" id="f_name" value="${v('name')}" placeholder="e.g. MPWLC Branch Betul" required></div>
            <div class="dir-form-group"><label class="dir-form-label">District</label>
                <input class="dir-form-input" id="f_district" value="${v('district')}" placeholder="e.g. Betul"></div>
            <div class="dir-form-group"><label class="dir-form-label">Status</label>
                <select class="dir-form-select" id="f_status"><option value="active" ${sel('status','active')}>Active</option><option value="inactive" ${sel('status','inactive')}>Inactive</option></select></div>
            <div class="dir-form-group"><label class="dir-form-label">शाखा प्रबंधक (Branch Manager) <span class="required">*</span></label>
                <input class="dir-form-input" id="f_managerName" value="${v('managerName')}" placeholder="Manager name"></div>
            <div class="dir-form-group"><label class="dir-form-label">Manager Mobile</label>
                <input class="dir-form-input" id="f_managerMobile" value="${v('managerMobile')}" type="tel" placeholder="10-digit mobile"></div>
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Email (Optional)</label>
                <input class="dir-form-input" id="f_email" value="${v('email')}" type="email" placeholder="branch@mpwlc.gov.in"></div>
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Branch Address</label>
                <textarea class="dir-form-textarea" id="f_address" placeholder="Full address…">${v('address')}</textarea></div>
        </div>`;

    if (type === 'godown') return `
        <div class="dir-form-grid">
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Godown Name <span class="required">*</span></label>
                <input class="dir-form-input" id="f_name" value="${v('name')}" placeholder="e.g. Betul Mandi Godown"></div>
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Attached MPWLC Branch <span class="required">*</span></label>
                <select class="dir-form-select" id="f_branchId"><option value="">— Select Branch —</option></select></div>
            <div class="dir-form-group"><label class="dir-form-label">Location</label>
                <input class="dir-form-input" id="f_location" value="${v('location')}" placeholder="Village / Area"></div>
            <div class="dir-form-group"><label class="dir-form-label">Capacity (MT / Bags)</label>
                <input class="dir-form-input" id="f_capacity" value="${v('capacity')}" placeholder="e.g. 5000 MT"></div>
            <div class="dir-form-group"><label class="dir-form-label">Status</label>
                <select class="dir-form-select" id="f_status"><option value="active" ${sel('status','active')}>Active</option><option value="inactive" ${sel('status','inactive')}>Inactive</option></select></div>
        </div>`;

    if (type === 'issueCenter') return `
        <div class="dir-form-grid">
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Issue Center Name <span class="required">*</span></label>
                <input class="dir-form-input" id="f_name" value="${v('name')}" placeholder="e.g. Betul Urban FPS"></div>
            <div class="dir-form-group"><label class="dir-form-label">Sector</label>
                <input class="dir-form-input" id="f_sector" value="${v('sector')}" placeholder="e.g. Betul Sector 1"></div>
            <div class="dir-form-group"><label class="dir-form-label">District</label>
                <input class="dir-form-input" id="f_district" value="${v('district')}" placeholder="e.g. Betul"></div>
            <div class="dir-form-group"><label class="dir-form-label">Status</label>
                <select class="dir-form-select" id="f_status"><option value="active" ${sel('status','active')}>Active</option><option value="inactive" ${sel('status','inactive')}>Inactive</option></select></div>
            <div class="dir-form-group"><label class="dir-form-label">केंद्र प्रभारी (Manager) <span class="required">*</span></label>
                <input class="dir-form-input" id="f_managerName" value="${v('managerName')}" placeholder="Manager name"></div>
            <div class="dir-form-group"><label class="dir-form-label">Manager Mobile</label>
                <input class="dir-form-input" id="f_managerMobile" value="${v('managerMobile')}" type="tel" placeholder="10-digit"></div>
            <div class="dir-form-group"><label class="dir-form-label">Operator Name</label>
                <input class="dir-form-input" id="f_operatorName" value="${v('operatorName')}" placeholder="Operator name"></div>
            <div class="dir-form-group"><label class="dir-form-label">Operator Mobile</label>
                <input class="dir-form-input" id="f_operatorMobile" value="${v('operatorMobile')}" type="tel" placeholder="10-digit"></div>
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Attached MPWLC Branch <span class="required">*</span></label>
                <select class="dir-form-select" id="f_branchId" onchange="updateGodownOptions(this.value,'${v('godownIds')}')"><option value="">— Select Branch —</option></select></div>
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Attached Godown(s)</label>
                <div class="multi-select-wrap" id="f_godownIds_wrap"><div style="color:var(--text-muted);font-size:12px;padding:4px;">Select a branch first to see godowns.</div></div></div>
            <div class="dir-form-group dir-form-full"><label class="dir-form-label">Address</label>
                <textarea class="dir-form-textarea" id="f_address" placeholder="Full address…">${v('address')}</textarea></div>
        </div>`;
    return '';
}

function populateFormDropdowns(type, data) {
    const branches = DirDB.getBranches();
    const branchOptions = branches.map(b => `<option value="${b.id}" ${data && data.branchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('');

    if (type === 'godown' || type === 'issueCenter') {
        const sel = document.getElementById('f_branchId');
        if (sel) sel.innerHTML = `<option value="">— Select Branch —</option>${branchOptions}`;
    }
    if (type === 'issueCenter' && data && data.branchId) {
        updateGodownOptions(data.branchId, data.godownIds || []);
    }
}

function updateGodownOptions(branchId, selectedIds) {
    const wrap = document.getElementById('f_godownIds_wrap');
    if (!wrap) return;
    const godowns = branchId ? DirDB.getGodownsByBranch(branchId) : [];
    if (godowns.length === 0) {
        wrap.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:4px;">No godowns found for this branch.</div>';
        return;
    }
    const selected = Array.isArray(selectedIds) ? selectedIds : [];
    wrap.innerHTML = godowns.map(g =>
        `<label class="multi-check-item"><input type="checkbox" name="godownIds" value="${g.id}" ${selected.includes(g.id) ? 'checked' : ''}> ${g.name} <span style="font-size:11px;color:var(--text-muted);">(${g.location || ''})</span></label>`
    ).join('');
}

function saveModal() {
    const type = State.editType;
    const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const data = {};

    if (type === 'branch') {
        if (!get('f_name') || !get('f_managerName')) { showToast('Branch name and manager name are required.', 'error'); return; }
        Object.assign(data, { name: get('f_name'), district: get('f_district'), managerName: get('f_managerName'), managerMobile: get('f_managerMobile'), email: get('f_email'), address: get('f_address'), status: get('f_status') || 'active' });
    }
    if (type === 'godown') {
        if (!get('f_name') || !get('f_branchId')) { showToast('Godown name and branch are required.', 'error'); return; }
        Object.assign(data, { name: get('f_name'), branchId: get('f_branchId'), location: get('f_location'), capacity: get('f_capacity'), status: get('f_status') || 'active' });
    }
    if (type === 'issueCenter') {
        if (!get('f_name') || !get('f_branchId') || !get('f_managerName')) { showToast('Name, branch and manager are required.', 'error'); return; }
        const godownIds = [...document.querySelectorAll('#f_godownIds_wrap input:checked')].map(c => c.value);
        Object.assign(data, { name: get('f_name'), sector: get('f_sector'), district: get('f_district'), address: get('f_address'), managerName: get('f_managerName'), managerMobile: get('f_managerMobile'), operatorName: get('f_operatorName'), operatorMobile: get('f_operatorMobile'), branchId: get('f_branchId'), godownIds, status: get('f_status') || 'active' });
    }

    if (State.editId) {
        if (type === 'branch')      DirDB.updateBranch(State.editId, data);
        if (type === 'godown')      DirDB.updateGodown(State.editId, data);
        if (type === 'issueCenter') DirDB.updateIC(State.editId, data);
        showToast('Record updated successfully!', 'success');
    } else {
        if (type === 'branch')      DirDB.addBranch(data);
        if (type === 'godown')      DirDB.addGodown(data);
        if (type === 'issueCenter') DirDB.addIC(data);
        showToast('Record added successfully!', 'success');
    }
    closeModal();
    refreshCurrentView();
    renderDashboard();
}

/* ── View Detail Modal ─────────────────────────── */
function openViewModal(type, id) {
    let record = null, title = '', html = '';
    if (type === 'branch')      record = DirDB.getBranches().find(r => r.id === id);
    if (type === 'issueCenter') record = DirDB.getICs().find(r => r.id === id);
    if (type === 'godown')      record = DirDB.getGodowns().find(r => r.id === id);
    if (type === 'transporter') record = DirDB.getTransporters().find(r => r.id === id);
    if (!record) return;

    const row = (icon, label, val) => val ? `<div class="dir-card-row"><span class="row-icon">${icon}</span><div><strong>${label}:</strong> ${val}</div></div>` : '';
    const callRow = (icon, label, mobile) => mobile ? `<div class="dir-card-row"><span class="row-icon">${icon}</span><div><strong>${label}:</strong> <a class="click-call" href="tel:${mobile}">${mobile}</a></div></div>` : '';

    if (type === 'branch') {
        title = '🏢 ' + record.name;
        const godowns = DirDB.getGodownsByBranch(id);
        const ics = DirDB.getICsByBranch(id);
        html = row('🏙️','District',record.district) + row('👤','शाखा प्रबंधक',record.managerName) + callRow('📞','Mobile',record.managerMobile) + row('📧','Email',record.email) + row('📍','Address',record.address) + row('🔵','Status',record.status) + `<div class="dir-card-divider"></div>` + `<div class="dir-card-row"><span class="row-icon">🏭</span><div><strong>Godowns (${godowns.length}):</strong><div class="linked-chips" style="margin-top:5px;">${godowns.map(g => `<span class="linked-chip">${g.name}</span>`).join('') || '<em>None</em>'}</div></div></div>` + `<div class="dir-card-row"><span class="row-icon">🏪</span><div><strong>Issue Centers (${ics.length}):</strong><div class="linked-chips" style="margin-top:5px;">${ics.map(ic => `<span class="linked-chip">${ic.name}</span>`).join('') || '<em>None</em>'}</div></div></div>`;
    }
    if (type === 'issueCenter') {
        title = '🏪 ' + record.name;
        const branch = DirDB.getBranchById(record.branchId);
        const godowns = (record.godownIds || []).map(gid => DirDB.getGodowns().find(g => g.id === gid)?.name).filter(Boolean);
        html = row('🗺️','Sector',record.sector) + row('🏙️','District',record.district) + row('📍','Address',record.address) + `<div class="dir-card-divider"></div>` + row('👤','केंद्र प्रभारी',record.managerName) + callRow('📞','Manager Mobile',record.managerMobile) + row('👷','Operator',record.operatorName) + callRow('📞','Operator Mobile',record.operatorMobile) + `<div class="dir-card-divider"></div>` + row('🏢','MPWLC Branch',branch?.name) + `<div class="dir-card-row"><span class="row-icon">🏭</span><div><strong>Godowns:</strong><div class="linked-chips" style="margin-top:5px;">${godowns.map(n => `<span class="linked-chip">${n}</span>`).join('') || '<em>None linked</em>'}</div></div></div>` + row('🔵','Status',record.status);
    }
    if (type === 'godown') {
        title = '🏭 ' + record.name;
        const branch = DirDB.getBranchById(record.branchId);
        const ics = DirDB.getICsByGodown(id);
        html = row('📍','Location',record.location) + row('📦','Capacity',record.capacity) + row('🏢','Branch',branch?.name) + callRow('📞','Branch Manager',branch?.managerMobile) + `<div class="dir-card-divider"></div>` + `<div class="dir-card-row"><span class="row-icon">🏪</span><div><strong>Issue Centers (${ics.length}):</strong><div class="linked-chips" style="margin-top:5px;">${ics.map(ic => `<span class="linked-chip">${ic.name}</span>`).join('') || '<em>None</em>'}</div></div></div>` + row('🔵','Status',record.status);
    }
    if (type === 'transporter') {
        title = '🚛 ' + record.name;
        html = callRow('📞','Mobile',record.mobile) + row('🗺️','Sector',record.sector) + row('🏪','Issue Center',record.issueCenterName) + row('📋','Scheme',record.scheme) + row('🔗','Source',record.source);
    }
    document.getElementById('viewModalTitle').textContent = title;
    document.getElementById('viewModalBody').innerHTML = html || '<div style="color:var(--text-muted);">No details available.</div>';
    document.getElementById('dirViewModal').style.display = 'flex';
}

/* ── Delete ────────────────────────────────────── */
function openDeleteConfirm(type, id) {
    State.deleteType = type; State.deleteId = id;
    const names = { branch: 'MPWLC Branch', issueCenter: 'Issue Center', godown: 'Godown' };
    document.getElementById('deleteConfirmDesc').textContent = `Are you sure you want to delete this ${names[type] || type}? This cannot be undone.`;
    document.getElementById('deleteConfirmBtn').onclick = confirmDelete;
    document.getElementById('dirDeleteModal').style.display = 'flex';
}
function confirmDelete() {
    const { deleteType, deleteId } = State;
    if (deleteType === 'branch')      DirDB.deleteBranch(deleteId);
    if (deleteType === 'issueCenter') DirDB.deleteIC(deleteId);
    if (deleteType === 'godown')      DirDB.deleteGodown(deleteId);
    document.getElementById('dirDeleteModal').style.display = 'none';
    showToast('Record deleted.', 'success');
    refreshCurrentView();
    renderDashboard();
}

/* ════════════════════════════════════════════════════
   REPORTS
════════════════════════════════════════════════════ */
function selectReport(type) {
    State.reportType = type;
    document.querySelectorAll('.report-type-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('rtype-' + type);
    if (card) card.classList.add('selected');
    renderReportPreview(type);
}

function renderReportPreview(type) {
    const titles = { branches: 'Branch Directory', issueCenters: 'Issue Center Directory', godowns: 'Godown Mapping', transporters: 'Transporter Directory', contacts: 'Contact Sheet', full: 'Full Directory' };
    document.getElementById('reportPreviewTitle').textContent = (titles[type] || type) + ' — Preview';
    let html = '';
    if (type === 'branches') {
        const data = DirDB.getBranches();
        html = previewTable(['Branch Name','District','Branch Manager','Mobile','Email','Status'], data.map(b => [b.name, b.district||'—', b.managerName||'—', b.managerMobile||'—', b.email||'—', b.status||'—']));
    } else if (type === 'issueCenters') {
        const data = DirDB.getICs();
        html = previewTable(['IC Name','Sector','District','Manager','Mob.','Operator','Branch','Status'], data.map(ic => [ic.name, ic.sector||'—', ic.district||'—', ic.managerName||'—', ic.managerMobile||'—', ic.operatorName||'—', DirDB.getBranchById(ic.branchId)?.name||'—', ic.status||'—']));
    } else if (type === 'godowns') {
        const data = DirDB.getGodowns();
        html = previewTable(['Godown Name','Location','Branch','Capacity','Status'], data.map(g => [g.name, g.location||'—', DirDB.getBranchById(g.branchId)?.name||'—', g.capacity||'—', g.status||'—']));
    } else if (type === 'transporters') {
        const data = DirDB.getTransporters();
        html = previewTable(['Transporter Name','Mobile','Sector','Issue Center','Scheme'], data.map(t => [t.name, t.mobile||'—', t.sector||'—', t.issueCenterName||'—', t.scheme||'—']));
    } else if (type === 'contacts') {
        const rows = [];
        DirDB.getBranches().forEach(b => { if(b.managerName) rows.push([b.managerName,'Branch Manager','MPWLC',b.name,b.managerMobile||'—']); });
        DirDB.getICs().forEach(ic => {
            if (ic.managerName) rows.push([ic.managerName,'केंद्र प्रभारी','MPSCSC',ic.name,ic.managerMobile||'—']);
            if (ic.operatorName) rows.push([ic.operatorName,'Operator','MPSCSC',ic.name,ic.operatorMobile||'—']);
        });
        DirDB.getTransporters().forEach(t => { if(t.name) rows.push([t.name,'Transporter',t.scheme||'—',t.sector||'—',t.mobile||'—']); });
        html = previewTable(['Name','Role','Organization/Scheme','Location/Center','Mobile'], rows);
    } else if (type === 'full') {
        html = '<div style="color:var(--text-muted);font-size:13px;padding:20px;text-align:center;">Full directory export includes all branches, issue centers, godowns, and transporters. Use the Export or Print button to generate the full report.</div>';
    }
    document.getElementById('reportPreviewContent').innerHTML = html || '<div class="dir-empty" style="padding:30px;"><div class="dir-empty-icon" style="font-size:32px;">📋</div><div class="dir-empty-title">No Data</div><div class="dir-empty-desc">Add records first to generate reports.</div></div>';
}

function previewTable(headers, rows) {
    if (rows.length === 0) return '<div style="padding:20px;color:var(--text-muted);text-align:center;">No data available.</div>';
    return `<div style="overflow-x:auto;"><table class="report-preview-table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.slice(0,20).map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>${rows.length > 20 ? `<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);">Showing 20 of ${rows.length} records. Export to see all.</div>` : ''}</div>`;
}

function exportReport(format) {
    const type = State.reportType;
    if (format === 'csv') exportData(type === 'full' ? 'all' : type === 'contacts' ? 'contacts' : type, 'csv');
}

/* ════════════════════════════════════════════════════
   EXPORT
════════════════════════════════════════════════════ */
function exportData(entity, format) {
    let headers = [], rows = [], filename = 'export';

    if (entity === 'branches') {
        headers = ['ID','Branch Name','District','Branch Manager','Mobile','Email','Address','Status'];
        rows = DirDB.getBranches().map(b => [b.id,b.name,b.district||'',b.managerName||'',b.managerMobile||'',b.email||'',b.address||'',b.status||'']);
        filename = 'MPWLC_Branch_Directory';
    } else if (entity === 'issueCenters') {
        headers = ['ID','Name','Sector','District','Manager','Manager Mobile','Operator','Operator Mobile','Branch','Status'];
        rows = DirDB.getICs().map(ic => [ic.id,ic.name,ic.sector||'',ic.district||'',ic.managerName||'',ic.managerMobile||'',ic.operatorName||'',ic.operatorMobile||'',DirDB.getBranchById(ic.branchId)?.name||'',ic.status||'']);
        filename = 'Issue_Center_Directory';
    } else if (entity === 'godowns') {
        headers = ['ID','Godown Name','Location','Branch','Capacity','Status'];
        rows = DirDB.getGodowns().map(g => [g.id,g.name,g.location||'',DirDB.getBranchById(g.branchId)?.name||'',g.capacity||'',g.status||'']);
        filename = 'Godown_Directory';
    } else if (entity === 'transporters') {
        headers = ['Name','Mobile','Sector','Issue Center','Scheme','Source'];
        rows = DirDB.getTransporters().map(t => [t.name,t.mobile||'',t.sector||'',t.issueCenterName||'',t.scheme||'',t.source||'']);
        filename = 'Transporter_Directory';
    } else if (entity === 'contacts') {
        headers = ['Name','Role','Organization','Location','Mobile'];
        rows = [];
        DirDB.getBranches().forEach(b => { if(b.managerName) rows.push([b.managerName,'Branch Manager','MPWLC',b.name,b.managerMobile||'']); });
        DirDB.getICs().forEach(ic => {
            if (ic.managerName) rows.push([ic.managerName,'केंद्र प्रभारी','MPSCSC',ic.name,ic.managerMobile||'']);
            if (ic.operatorName) rows.push([ic.operatorName,'Operator','MPSCSC',ic.name,ic.operatorMobile||'']);
        });
        DirDB.getTransporters().forEach(t => rows.push([t.name,'Transporter',t.scheme||'',t.sector||'',t.mobile||'']));
        filename = 'Contact_Sheet';
    } else {
        // Export all
        exportData('branches', format);
        setTimeout(() => exportData('issueCenters', format), 300);
        setTimeout(() => exportData('godowns', format), 600);
        setTimeout(() => exportData('transporters', format), 900);
        return;
    }
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename + '_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    showToast(`${filename} exported as CSV.`, 'success');
}

/* ════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════ */
function refreshCurrentView() {
    const v = State.view;
    if (v === 'branches')     renderBranches();
    if (v === 'issueCenters') renderIssueCenters();
    if (v === 'godowns')      renderGodowns();
    if (v === 'transporters') renderTransporters();
    if (v === 'hierarchy')    renderHierarchy();
    if (v === 'reports')      renderReportPreview(State.reportType);
    if (v === 'search')       {} // search stays
}
function refreshBranchFilters() {}
function refreshICFilters() {
    const sel = document.getElementById('filter-ic-branch');
    if (!sel) return;
    const branches = DirDB.getBranches();
    const current = sel.value;
    sel.innerHTML = `<option value="">All Branches</option>` + branches.map(b => `<option value="${b.id}" ${current === b.id ? 'selected' : ''}>${b.name}</option>`).join('');
}
function refreshGodownFilters() {
    const sel = document.getElementById('filter-gd-branch');
    if (!sel) return;
    const branches = DirDB.getBranches();
    sel.innerHTML = `<option value="">All Branches</option>` + branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
}
function refreshTransporterFilters() {
    const sel = document.getElementById('filter-tr-sector');
    if (!sel) return;
    const sectors = [...new Set(DirDB.getTransporters().map(t => t.sector).filter(Boolean))].sort();
    const current = sel.value;
    sel.innerHTML = `<option value="">All Sectors</option>` + sectors.map(s => `<option value="${s}" ${current === s ? 'selected' : ''}>${s}</option>`).join('');
}

async function syncTransporters() {
    showToast('Syncing transporters from reports…', 'info');
    const data = await DirDB.fetchTransporters();
    refreshTransporterFilters();
    renderTransporters();
    renderDashboard();
    showToast(`Synced ${data.length} transporters.`, 'success');
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function statusChip(status) {
    const s = (status || 'active').toLowerCase();
    return `<span class="status-chip ${s}">${s}</span>`;
}
function actionBtns(type, id) {
    return `<div style="display:flex;gap:5px;">
        <button class="btn btn-sm btn-secondary" onclick="openViewModal('${type}','${id}')">👁️</button>
        <button class="btn btn-sm btn-secondary" onclick="openEditModal('${type}','${id}')">✏️</button>
        <button class="btn btn-sm" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.2);" onclick="openDeleteConfirm('${type}','${id}')">🗑️</button>
    </div>`;
}
function emptyState(icon, title, desc, action, btnLabel) {
    return `<div class="dir-empty"><div class="dir-empty-icon">${icon}</div><div class="dir-empty-title">${title}</div><div class="dir-empty-desc">${desc}</div><button class="btn btn-primary" onclick="${action}">${btnLabel}</button></div>`;
}

/* ── Toast notifications ─────────────────────── */
function showToast(msg, type) {
    const colors = { success:'#10b981', error:'#ef4444', info:'#6366f1' };
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${colors[type]||colors.info};color:white;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.3);animation:slideIn 0.25s ease;max-width:320px;font-family:'Inter',sans-serif;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ── Sidebar / Theme / Clock ────────────────── */
function toggleSidebar() {
    const w = document.getElementById('appWrapper');
    w.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar-collapsed', w.classList.contains('sidebar-collapsed') ? '1' : '0');
}
function toggleTheme() {
    const html = document.documentElement;
    const isLight = html.getAttribute('data-theme') === 'light';
    if (isLight) {
        html.removeAttribute('data-theme');
        localStorage.setItem('pds-theme','dark');
        setText('dirThemeIcon','☀️'); setText('dirThemeLabel','Day');
    } else {
        html.setAttribute('data-theme','light');
        localStorage.setItem('pds-theme','light');
        setText('dirThemeIcon','🌙'); setText('dirThemeLabel','Night');
    }
}
(function clock() {
    function tick() {
        const el = document.getElementById('dir-live-clock');
        if (el) el.textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }
    setInterval(tick, 1000); tick();
})();

/* ── Collapsed sidebar tooltip ──────────────── */
(function initTooltip() {
    const tip = document.getElementById('dir-nav-tooltip');
    document.addEventListener('mouseover', function(e) {
        const wrapper = document.getElementById('appWrapper');
        if (!wrapper || !wrapper.classList.contains('sidebar-collapsed')) { tip.classList.remove('visible'); return; }
        const navItem = e.target.closest('.app-sidebar .nav-item');
        if (!navItem) { tip.classList.remove('visible'); return; }
        const label = navItem.querySelector('.nav-label');
        if (!label) return;
        const rect = navItem.getBoundingClientRect();
        tip.textContent = label.textContent.trim();
        tip.style.left  = (rect.right + 12) + 'px';
        tip.style.top   = (rect.top + rect.height / 2) + 'px';
        tip.classList.add('visible');
    });
    document.addEventListener('mouseout', function(e) {
        const navItem = e.target.closest('.app-sidebar .nav-item');
        if (navItem && !navItem.contains(e.relatedTarget)) tip.classList.remove('visible');
    });
})();

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════
   SEED DATA — MPWLC BRANCHES (District Betul)
   Runs only once when no branch records exist yet.
════════════════════════════════════════════════════ */
var SEED_BRANCHES = [
    {
        name: 'Betul',
        district: 'Betul',
        managerName: 'Shri N.P. Keer',
        managerMobile: '07141-238253',
        email: 'mpwlcbetul@gmail.com',
        address: 'ITARSI ROAD ITI KE SAMNE SADAR BETUL',
        status: 'active'
    },
    {
        name: 'Bhainsdehi',
        district: 'Betul',
        managerName: 'Mukesh Kumar Bhalavi',
        managerMobile: '8871039521',
        email: 'mpwlcbhainsdehi@gmail.com',
        address: 'Civil Line Bhainsdehi Disst Betul (M.P.)',
        status: 'active'
    },
    {
        name: 'Athner',
        district: 'Betul',
        managerName: 'Miss Prema Kumari',
        managerMobile: '07144-286780',
        email: 'athnermpwlc@gmail.com',
        address: 'M.P.W.L.C. Warehouse Near Janpad Panchayat Athner (M.P.)',
        status: 'active'
    },
    {
        name: 'Multai',
        district: 'Betul',
        managerName: 'MS Gamar',
        managerMobile: '7225018671',
        email: 'branchmanagermultai@gmail.com',
        address: 'Chandora Khurd, Khedli Bazar Rd, Multai',
        status: 'active'
    },
    {
        name: 'Shahpur',
        district: 'Betul',
        managerName: 'Vimal',
        managerMobile: '07146-299415',
        email: 'shahpurmpwlc@gmail.com',
        address: 'Tahsil Office Ke Pas Pataupura Shahpur Dist. Betul',
        status: 'active'
    },
    {
        name: 'Ghoradongri',
        district: 'Betul',
        managerName: 'Sarvan Uikey',
        managerMobile: '9406553322',
        email: 'mpwlcghoradongri@gmail.com',
        address: 'Main Road Ranipur Tirupati Warehouse Juwadi Dist. Betul M.P.',
        status: 'active'
    }
];

var SEED_ISSUE_CENTERS = [
    {
        id: 'IC_Aathner',
        name: 'Aathner',
        sector: 'Aathner',
        district: 'Betul',
        managerName: 'Sunil Kadu',
        managerMobile: '9753030976',
        operatorName: 'Vijay Barthe',
        operatorMobile: '9406506766',
        status: 'active'
    },
    {
        id: 'IC_Bhainsdehi',
        name: 'Bhainsdehi',
        sector: 'Bhainsdehi',
        district: 'Betul',
        managerName: 'Sunil Kadu',
        managerMobile: '9753030976',
        operatorName: 'Raju Sirsam',
        operatorMobile: '8463040802',
        status: 'active'
    },
    {
        id: 'IC_Betul',
        name: 'Betul',
        sector: 'Betul',
        district: 'Betul',
        managerName: 'Parvatrao Mahski',
        managerMobile: '9302278164',
        operatorName: 'Shailesh Gujre',
        operatorMobile: '9399093004',
        status: 'active'
    },
    {
        id: 'IC_Bhimpur',
        name: 'Bhimpur',
        sector: 'Bhimpur',
        district: 'Betul',
        managerName: 'Gangaram Vanjare',
        managerMobile: '9406938890',
        operatorName: 'Rohit Patil',
        operatorMobile: '8305136324',
        status: 'active'
    },
    {
        id: 'IC_Multai',
        name: 'Multai',
        sector: 'Multai',
        district: 'Betul',
        managerName: 'Namrata Batti',
        managerMobile: '9098261807',
        operatorName: 'Omprakash Photfode',
        operatorMobile: '9131550210',
        status: 'active'
    },
    {
        id: 'IC_Amla',
        name: 'Amla',
        sector: 'Amla',
        district: 'Betul',
        managerName: 'Sanjay Pahade',
        managerMobile: '9691965380',
        operatorName: 'Gaurav Pawar',
        operatorMobile: '6262050062',
        status: 'active'
    },
    {
        id: 'IC_PrabhatPattan',
        name: 'PrabhatPattan',
        sector: 'PrabhatPattan',
        district: 'Betul',
        managerName: 'Namrata Batti',
        managerMobile: '9098261807',
        operatorName: 'Govinddas Pandole',
        operatorMobile: '6260647027',
        status: 'active'
    },
    {
        id: 'IC_Ghodadongri',
        name: 'Ghodadongri',
        sector: 'Ghodadongri',
        district: 'Betul',
        managerName: 'Baldev Mahski',
        managerMobile: '9893781561',
        operatorName: 'Yatish Nirapure',
        operatorMobile: '7415771495',
        status: 'active'
    },
    {
        id: 'IC_Shahpur',
        name: 'Shahpur',
        sector: 'Shahpur',
        district: 'Betul',
        managerName: 'Poonam Thakur',
        managerMobile: '9340502158',
        operatorName: 'Neeraj Pawar',
        operatorMobile: '8319067070',
        status: 'active'
    },
    {
        id: 'IC_DistrictOffice',
        name: 'District Office (Betul)',
        sector: 'District Office',
        district: 'Betul',
        managerName: 'Vikhyat Hindoliya (District Manager)',
        managerMobile: '8839223715',
        operatorName: 'Durga (District Office Operator)',
        operatorMobile: '9111443451',
        inchargeName: 'Surendra Joshi (PDS In-charge)',
        inchargeMobile: '9826329445',
        status: 'active'
    }
];

function seedBranchDataIfEmpty() {
    if (DirDB.getBranches().length > 0) return; // already seeded or user has data
    SEED_BRANCHES.forEach(function(b) { DirDB.addBranch(b); });
    console.log('[Directory] Seeded ' + SEED_BRANCHES.length + ' MPWLC branches for District Betul.');
}

function seedICDataIfEmpty() {
    let existing = DirDB.getICs();
    const branches = DirDB.getBranches();
    
    SEED_ISSUE_CENTERS.forEach(function(icSeed) {
        const idx = existing.findIndex(e => e.id === icSeed.id || e.name.toLowerCase() === icSeed.name.toLowerCase() || e.sector.toLowerCase() === icSeed.sector.toLowerCase());
        const matchedBranch = branches.find(b => 
            b.name.toLowerCase().includes(icSeed.name.toLowerCase()) || 
            icSeed.name.toLowerCase().includes(b.name.toLowerCase())
        );
        if (idx === -1) {
            const rec = { 
                ...icSeed, 
                branchId: matchedBranch ? matchedBranch.id : '',
                createdAt: DirDB.ts(), 
                updatedAt: DirDB.ts() 
            };
            DirDB.addIC(rec);
        } else {
            const updated = {
                ...existing[idx],
                ...icSeed,
                branchId: existing[idx].branchId || (matchedBranch ? matchedBranch.id : ''),
                updatedAt: DirDB.ts()
            };
            DirDB.updateIC(existing[idx].id, updated);
        }
    });
    console.log('[Directory] Seeded/Updated ' + SEED_ISSUE_CENTERS.length + ' Issue Centers.');
}

document.addEventListener('DOMContentLoaded', function() {
    // Theme icon
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    setText('dirThemeIcon', isLight ? '🌙' : '☀️');
    setText('dirThemeLabel', isLight ? 'Night' : 'Day');

    // Sidebar collapse state
    if (localStorage.getItem('sidebar-collapsed') === '1') {
        document.getElementById('appWrapper').classList.add('sidebar-collapsed');
    }

    // Close modals on backdrop click
    document.getElementById('dirModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
    document.getElementById('dirViewModal').addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
    document.getElementById('dirDeleteModal').addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });

    // Seed branch & IC data if needed
    seedBranchDataIfEmpty();
    seedICDataIfEmpty();

    // Render dashboard
    renderDashboard();

    // Auto-sync transporters (silently)
    DirDB.fetchTransporters().then(() => renderDashboard()).catch(() => {});
});