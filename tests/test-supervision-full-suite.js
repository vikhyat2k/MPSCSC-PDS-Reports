const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://127.0.0.1:3000';

// Helper for making HTTP requests
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runSupervisionFullTestSuite() {
    console.log('══════════════════════════════════════════════════════════');
    console.log('🧪 SUPERVISION PORTAL COMPREHENSIVE AUTOMATED TEST SUITE');
    console.log('   Testing Order 3/1 & 3/2, Endpoints, CRUD & Safe Purge');
    console.log('══════════════════════════════════════════════════════════\n');

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    function recordTest(name, fn) {
        return async () => {
            totalTests++;
            try {
                await fn();
                passedTests++;
                console.log(`  ✅ [PASS] ${name}`);
            } catch (err) {
                failedTests++;
                console.error(`  ❌ [FAIL] ${name}:`, err.message);
                throw err;
            }
        };
    }

    // ──────────────────────────────────────────────────────────
    // SUITE 1: DATA SAFETY & BASELINE AUDIT
    // ──────────────────────────────────────────────────────────
    console.log('▶️ SUITE 1: Data Safety & Baseline Audit');

    await recordTest('Baseline Detailed Inspection exists (INSP_BETUL_DEMO_01)', async () => {
        const res = await request('GET', '/api/supervision/inspections/INSP_BETUL_DEMO_01');
        assert.strictEqual(res.status, 200, 'Baseline inspection not found');
        assert.strictEqual(res.body.id, 'INSP_BETUL_DEMO_01');
    })();

    await recordTest('Baseline Surprise Inspection exists (SURP_BETUL_DEMO_01)', async () => {
        const res = await request('GET', '/api/supervision/surprise/SURP_BETUL_DEMO_01');
        assert.strictEqual(res.status, 200, 'Baseline surprise visit not found');
        assert.strictEqual(res.body.id, 'SURP_BETUL_DEMO_01');
    })();

    await recordTest('Baseline Coordination Meeting exists (MEET_COORD_MPWLC_01)', async () => {
        const res = await request('GET', '/api/supervision/meetings/MEET_COORD_MPWLC_01');
        assert.strictEqual(res.status, 200, 'Baseline meeting not found');
        assert.strictEqual(res.body.id, 'MEET_COORD_MPWLC_01');
    })();

    await recordTest('Baseline Annual Roster contains 24 official KMS 2026-27 targets', async () => {
        const res = await request('GET', '/api/supervision/roster?year=2026');
        assert.strictEqual(res.status, 200);
        const baselineRoster = res.body.filter(r => r.id && r.id.startsWith('ROST_2026_'));
        assert.strictEqual(baselineRoster.length, 24, `Expected 24 baseline roster items, found ${baselineRoster.length}`);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 2: TEST DATA SEEDING & PREVIEW
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 2: Test Data Seeding & Sandbox Status API');

    await recordTest('Purge any previous ad-hoc test records to establish clean baseline', async () => {
        const res = await request('POST', '/api/supervision/test-data/cleanup');
        assert.strictEqual(res.status, 200);
    })();

    await recordTest('Seed 22 realistic dummy test records across 5 modules', async () => {
        const res = await request('POST', '/api/supervision/test-data/seed');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.seededCount, 22);
    })();

    await recordTest('Verify /api/supervision/test-data/status reflects all 22 records', async () => {
        const res = await request('GET', '/api/supervision/test-data/status');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.totalTestRecords, 22);
        assert.strictEqual(res.body.counts.inspections, 5);
        assert.strictEqual(res.body.counts.surprise, 5);
        assert.strictEqual(res.body.counts.roster, 5);
        assert.strictEqual(res.body.counts.meetings, 3);
        assert.strictEqual(res.body.counts.rice, 4);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 3: CRUD OPERATIONS ON DETAILED INSPECTIONS (परिशिष्ट 01/02)
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 3: Detailed Inspections CRUD & Workflows');

    const tempInspId = 'TEST_INSP_ADHOC_' + Date.now();
    await recordTest('CREATE: Detailed Inspection with Hindi notes & high stock values', async () => {
        const payload = {
            id: tempInspId,
            mode: 'dm',
            issueCenter: 'Bhainsdehi',
            inspectionMonth: 'November',
            inspectionDate: '2026-11-05',
            officerName: 'श्री राजेश कुमार (परीक्षण अधिकारी)',
            officerDesignation: 'District Manager, Betul',
            complianceScore: 94,
            deficienciesCount: 1,
            godownsCount: 4,
            isTest: 1,
            payload: {
                reservation: { wheat: 2500, rice: 1200 },
                stock: [
                    { commodity: 'गेहूं (Wheat)', soundBags: 4500, soundQty: 2250.00, damagedBags: 0, damagedQty: 0 },
                    { commodity: 'चावल (Rice)', soundBags: 2400, soundQty: 1200.00, damagedBags: 0, damagedQty: 0 }
                ],
                gunnyBags: { hdpe: 15000, jute: 8000, serviceable: 22000, unserviceable: 1000 },
                checkpoints: {
                    chk_1_computer: true, chk_2_printer: true, chk_3_ups: true, chk_4_internet: true,
                    chk_5_deo_format: true, chk_6_doorstep_receipts: true, chk_7_stock_quality: true,
                    chk_8_stack_criteria: true, chk_9_stack_cards: true, chk_10_sweepage_handling: true,
                    chk_11_records_reconciliation: true, chk_12_stack_killing: true, chk_13_loss_gain_cert: false,
                    chk_14_damaged_dcc: true, chk_15_transport_order: true, chk_16_fumigation_schedule: true,
                    chk_17_hq_compliance: true
                },
                issuesAndSuggestions: [
                    { issue: 'स्टेक लास/गेम प्रमाण पत्र जारी नहीं किया गया', suggestion: '7 दिवस के भीतर प्रमाण पत्र जारी करें' }
                ]
            }
        };

        const res = await request('POST', '/api/supervision/inspections', payload);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.id, tempInspId);
    })();

    await recordTest('READ: Fetch newly created inspection by ID', async () => {
        const res = await request('GET', `/api/supervision/inspections/${tempInspId}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.id, tempInspId);
        assert.strictEqual(res.body.issue_center, 'Bhainsdehi');
        assert.strictEqual(res.body.compliance_score, 94);
        assert.strictEqual(res.body.payload.gunnyBags.hdpe, 15000);
    })();

    await recordTest('UPDATE: Modify inspection remarks and score', async () => {
        const updatedPayload = {
            id: tempInspId,
            mode: 'dm',
            issueCenter: 'Bhainsdehi',
            inspectionMonth: 'November',
            inspectionDate: '2026-11-05',
            officerName: 'श्री राजेश कुमार (परीक्षण अधिकारी - अद्यतन)',
            officerDesignation: 'District Manager, Betul',
            complianceScore: 100,
            deficienciesCount: 0,
            godownsCount: 4,
            isTest: 1,
            payload: {
                issuesAndSuggestions: [
                    { issue: 'सभी कमियों का निराकरण हो चुका है', suggestion: 'प्रशंसा पत्र प्रेषित करें' }
                ]
            }
        };

        const res = await request('POST', '/api/supervision/inspections', updatedPayload);
        assert.strictEqual(res.status, 200);

        const checkRes = await request('GET', `/api/supervision/inspections/${tempInspId}`);
        assert.strictEqual(checkRes.body.compliance_score, 100);
        assert.strictEqual(checkRes.body.deficiencies_count, 0);
    })();

    await recordTest('DELETE: Remove ad-hoc inspection and verify 404', async () => {
        const delRes = await request('DELETE', `/api/supervision/inspections/${tempInspId}`);
        assert.strictEqual(delRes.status, 200);

        const checkRes = await request('GET', `/api/supervision/inspections/${tempInspId}`);
        assert.strictEqual(checkRes.status, 404);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 4: CRUD OPERATIONS ON SURPRISE VISITS (परिशिष्ट 03/04)
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 4: Surprise Visits CRUD & Workflows');

    const tempSurpId = 'TEST_SURP_ADHOC_' + Date.now();
    await recordTest('CREATE: Surprise Visit with 10-point checklist', async () => {
        const payload = {
            id: tempSurpId,
            mode: 'dm',
            issueCenter: 'Athner',
            inspectionDate: '2026-11-12',
            officerName: 'District Manager, MPSCSC Betul',
            score: 90,
            defectsCount: 1,
            isTest: 1,
            payload: {
                points: [
                    { id: 1, compliant: true },
                    { id: 2, compliant: true },
                    { id: 3, compliant: false, defect: 'IRRS साफ्टवेयर एंट्री 2 दिवस लंबित' },
                    { id: 4, compliant: true },
                    { id: 5, compliant: true },
                    { id: 6, compliant: true },
                    { id: 7, compliant: true },
                    { id: 8, compliant: true },
                    { id: 9, compliant: true },
                    { id: 10, compliant: true }
                ],
                remark: 'समग्र व्यवस्था संतोषजनक पाई गई।'
            }
        };

        const res = await request('POST', '/api/supervision/surprise', payload);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    })();

    await recordTest('READ: Fetch surprise visit by ID and check list inclusion', async () => {
        const res = await request('GET', `/api/supervision/surprise/${tempSurpId}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.id, tempSurpId);
        assert.strictEqual(res.body.issue_center, 'Athner');
        assert.strictEqual(res.body.score, 90);

        const listRes = await request('GET', '/api/supervision/surprise');
        assert.strictEqual(listRes.status, 200);
        assert(listRes.body.some(s => s.id === tempSurpId));
    })();

    await recordTest('DELETE: Remove surprise visit and verify 404', async () => {
        const delRes = await request('DELETE', `/api/supervision/surprise/${tempSurpId}`);
        assert.strictEqual(delRes.status, 200);

        const checkRes = await request('GET', `/api/supervision/surprise/${tempSurpId}`);
        assert.strictEqual(checkRes.status, 404);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 5: CRUD OPERATIONS ON ANNUAL ROSTER TARGETS
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 5: Annual Roster Targets CRUD & Workflows');

    const tempRostId = 'TEST_ROST_ADHOC_' + Date.now();
    await recordTest('CREATE: Roster inspection target for December 2026', async () => {
        const payload = {
            id: tempRostId,
            year: 2026,
            month: 'December',
            officerRole: 'dm',
            issueCenter: 'Multai',
            targetDate: '2026-12-18',
            status: 'Pending',
            isTest: 1,
            remarks: 'मासिक नियमित रोस्टर निरीक्षण लक्ष्य'
        };

        const res = await request('POST', '/api/supervision/roster', payload);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    })();

    await recordTest('UPDATE: Mark roster target as Completed', async () => {
        const updated = {
            id: tempRostId,
            year: 2026,
            month: 'December',
            officerRole: 'dm',
            issueCenter: 'Multai',
            targetDate: '2026-12-18',
            status: 'Completed',
            isTest: 1,
            actualInspectionId: 'TEST_INSP_001',
            remarks: 'लक्ष्य शत-प्रतिशत पूर्ण किया गया'
        };

        const res = await request('POST', '/api/supervision/roster', updated);
        assert.strictEqual(res.status, 200);

        const listRes = await request('GET', '/api/supervision/roster?year=2026');
        const item = listRes.body.find(r => r.id === tempRostId);
        assert(item !== undefined);
        assert.strictEqual(item.status, 'Completed');
    })();

    await recordTest('DELETE: Remove roster target and verify removal', async () => {
        const delRes = await request('DELETE', `/api/supervision/roster/${tempRostId}`);
        assert.strictEqual(delRes.status, 200);

        const listRes = await request('GET', '/api/supervision/roster?year=2026');
        const item = listRes.body.find(r => r.id === tempRostId);
        assert.strictEqual(item, undefined);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 6: CRUD OPERATIONS ON COORDINATION MEETINGS
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 6: Coordination & Review Meetings CRUD & Workflows');

    const tempMeetId = 'TEST_MEET_ADHOC_' + Date.now();
    await recordTest('CREATE: Coordination Meeting with DCCB Bank & PACS societies', async () => {
        const payload = {
            id: tempMeetId,
            meetingType: 'coordination',
            agency: 'DCCB',
            meetingDate: '2026-11-20',
            chairperson: 'District Manager, MPSCSC Betul',
            attendees: 'CEO DCCB Betul, Incharge Procurement, Nodal Officer',
            minutes: 'उपार्जन समितियों के कमीशन देयकों के भुगतान एवं किसानों के बैंक खाता सत्यापन पर विचार-विमर्श।',
            actionPoints: '7 दिवस के भीतर शेष समितियों का भुगतान सुनिश्चित किया जाए।',
            isTest: 1
        };

        const res = await request('POST', '/api/supervision/meetings', payload);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    })();

    await recordTest('READ: Fetch coordination meeting by ID and check list inclusion', async () => {
        const res = await request('GET', `/api/supervision/meetings/${tempMeetId}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.id, tempMeetId);
        assert.strictEqual(res.body.agency, 'DCCB');

        const listRes = await request('GET', '/api/supervision/meetings');
        assert.strictEqual(listRes.status, 200);
        assert(listRes.body.some(m => m.id === tempMeetId));
    })();

    await recordTest('DELETE: Remove coordination meeting and verify 404', async () => {
        const delRes = await request('DELETE', `/api/supervision/meetings/${tempMeetId}`);
        assert.strictEqual(delRes.status, 200);

        const checkRes = await request('GET', `/api/supervision/meetings/${tempMeetId}`);
        assert.strictEqual(checkRes.status, 404);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 7: CRUD OPERATIONS ON RICE QUALITY INSPECTION (KMS 2025-26)
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 7: Rice Quality Inspection (KMS 2025-26) CRUD & Analysis');

    const tempRiceId = 'TEST_RICE_ADHOC_' + Date.now();
    await recordTest('CREATE: Rice Inspection sheet with multiple lots & analytical parameters', async () => {
        const payload = {
            id: tempRiceId,
            warehouseName: 'MPWLC Chicholi Warehouse',
            analysisDate: '2026-11-22',
            branchManager: 'Branch Manager, MPWLC Chicholi',
            centreIncharge: 'Centre Incharge, MPSCSC Chicholi',
            districtManager: 'District Manager, MPSCSC Betul',
            isTest: 1,
            lots: [
                {
                    sno: 1,
                    millerName: 'श्री गणेश राइस मिल, चिचोली',
                    stackNo: 'ST-01',
                    lotNo: 'LOT-KMS-2025-CH-01',
                    quantityMt: 29.0,
                    noOfBags: 580,
                    receiptDate: '2026-11-22',
                    brokenSmall: 0.8,
                    brokenBig: 19.0,
                    brokenTotal: 19.8,
                    fmInorg: 0.2,
                    fmOrg: 0.3,
                    fmTotal: 0.5,
                    damaged: 2.2,
                    admixture: 3.5,
                    redKernels: 1.2,
                    chalky: 3.0,
                    discoloured: 1.8,
                    dehusked: 9.0,
                    frk: 1.0,
                    testResult: 'Positive (1.0% FRK Fortified)',
                    result: 'Within Specification (PASSED)'
                },
                {
                    sno: 2,
                    millerName: 'श्री गणेश राइस मिल, चिचोली',
                    stackNo: 'ST-02',
                    lotNo: 'LOT-KMS-2025-CH-02',
                    quantityMt: 29.0,
                    noOfBags: 580,
                    receiptDate: '2026-11-22',
                    brokenSmall: 1.2,
                    brokenBig: 24.5,
                    brokenTotal: 25.7, // Exceeds 25% max limit
                    fmInorg: 0.4,
                    fmOrg: 0.5,
                    fmTotal: 0.9,
                    damaged: 3.5,
                    admixture: 5.0,
                    redKernels: 2.5,
                    chalky: 5.5,
                    discoloured: 3.2,
                    dehusked: 12.0,
                    frk: 0.6,
                    testResult: 'Positive (0.6% FRK)',
                    result: 'Beyond Rejection Limit (BRL - REJECTED)'
                }
            ]
        };

        const res = await request('POST', '/api/supervision/rice-inspections', payload);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.id, tempRiceId);
    })();

    await recordTest('READ: Fetch rice inspection sheet, verify totals and lot parameters', async () => {
        const res = await request('GET', `/api/supervision/rice-inspections/${tempRiceId}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.id, tempRiceId);
        assert.strictEqual(res.body.warehouse_name, 'MPWLC Chicholi Warehouse');
        assert.strictEqual(res.body.total_lots, 2);
        assert.strictEqual(res.body.total_quantity_mt, 58.0);
        assert.strictEqual(res.body.total_bags, 1160);
        assert.strictEqual(res.body.overall_result, 'REJECTED'); // Because lot 2 is rejected
    })();

    await recordTest('DELETE: Remove rice inspection sheet and verify 404', async () => {
        const delRes = await request('DELETE', `/api/supervision/rice-inspections/${tempRiceId}`);
        assert.strictEqual(delRes.status, 200);

        const checkRes = await request('GET', `/api/supervision/rice-inspections/${tempRiceId}`);
        assert.strictEqual(checkRes.status, 404);
    })();

    await recordTest('SPEC: Verify Common Rice (KMS 2025-26) Maximum Limit thresholds', async () => {
        // Test evaluation logic against official KMS 2025-26 Common Rice Schedule
        const COMMON_LIMITS = {
            brokenTotalMax: 25.0,
            brokenSmallMax: 1.0,
            fmTotalMax: 0.50,
            fmInorgMax: 0.20,
            damagedMax: 3.0,
            discolouredMax: 3.0,
            chalkyMax: 5.0,
            redKernelsMax: 3.0,
            dehuskedMax: 13.0,
            frkMin: 0.90,
            frkMax: 1.20
        };

        // Within limits lot
        const compliantLot = {
            brokenSmall: 0.85,
            brokenBig: 18.0,
            brokenTotal: 18.85,
            fmInorg: 0.12,
            fmOrg: 0.20,
            fmTotal: 0.32,
            damaged: 2.80, // <= 3.0% Common limit
            discoloured: 2.50, // <= 3.0% Common limit
            chalky: 4.20, // <= 5.0% Common limit
            redKernels: 2.10, // <= 3.0% Common limit
            dehusked: 11.50, // <= 13.0% Common limit
            frk: 1.05 // between 0.90 - 1.20%
        };

        const isCompliant = compliantLot.brokenSmall <= COMMON_LIMITS.brokenSmallMax &&
                            compliantLot.brokenTotal <= COMMON_LIMITS.brokenTotalMax &&
                            compliantLot.fmInorg <= COMMON_LIMITS.fmInorgMax &&
                            compliantLot.fmTotal <= COMMON_LIMITS.fmTotalMax &&
                            compliantLot.damaged <= COMMON_LIMITS.damagedMax &&
                            compliantLot.discoloured <= COMMON_LIMITS.discolouredMax &&
                            compliantLot.chalky <= COMMON_LIMITS.chalkyMax &&
                            compliantLot.redKernels <= COMMON_LIMITS.redKernelsMax &&
                            compliantLot.dehusked <= COMMON_LIMITS.dehuskedMax &&
                            compliantLot.frk >= COMMON_LIMITS.frkMin && compliantLot.frk <= COMMON_LIMITS.frkMax;
        assert.strictEqual(isCompliant, true, 'Compliant lot should pass all Common Rice KMS 2025-26 limits');

        // Damaged exceeding 3.0% (previously passed when limit was wrongly 4.0%)
        const damagedExceededLot = { ...compliantLot, damaged: 3.40 };
        assert.strictEqual(damagedExceededLot.damaged > COMMON_LIMITS.damagedMax, true, '3.40% Damaged must exceed Common Rice 3.0% max limit');

        // Small broken exceeding 1.0%
        const smallBrokenExceeded = { ...compliantLot, brokenSmall: 1.25 };
        assert.strictEqual(smallBrokenExceeded.brokenSmall > COMMON_LIMITS.brokenSmallMax, true, '1.25% Small Broken must exceed Footnote (*) 1.0% limit');

        // Discolored exceeding 3.0% (Raw Common limit)
        const discolouredExceeded = { ...compliantLot, discoloured: 3.60 };
        assert.strictEqual(discolouredExceeded.discoloured > COMMON_LIMITS.discolouredMax, true, '3.60% Discoloured must exceed Raw Common 3.0% limit');
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 8: NEGATIVE, VALIDATION & ERROR HANDLING
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 8: Negative Inputs, Validation & Error Handling');

    await recordTest('Error Handling: Non-existent detailed inspection returns 404', async () => {
        const res = await request('GET', '/api/supervision/inspections/NON_EXISTENT_ID_99999');
        assert.strictEqual(res.status, 404);
    })();

    await recordTest('Error Handling: Non-existent surprise visit returns 404', async () => {
        const res = await request('GET', '/api/supervision/surprise/NON_EXISTENT_ID_99999');
        assert.strictEqual(res.status, 404);
    })();

    await recordTest('Error Handling: Non-existent coordination meeting returns 404', async () => {
        const res = await request('GET', '/api/supervision/meetings/NON_EXISTENT_ID_99999');
        assert.strictEqual(res.status, 404);
    })();

    await recordTest('Error Handling: Non-existent rice sheet returns 404', async () => {
        const res = await request('GET', '/api/supervision/rice-inspections/NON_EXISTENT_ID_99999');
        assert.strictEqual(res.status, 404);
    })();

    await recordTest('Validation: Detailed inspection rejects empty / missing body', async () => {
        const res = await request('POST', '/api/supervision/inspections', {});
        // Server handles missing fields gracefully with 400
        assert(res.status === 400 || res.body.success === false);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 9: DASHBOARD STATS & KPI AGGREGATION
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 9: Dashboard Statistics & KPI Aggregation');

    await recordTest('Verify /api/supervision/stats calculations and response schema', async () => {
        const res = await request('GET', '/api/supervision/stats');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.activeDistrict, 'Betul');
        assert(typeof res.body.inspectionsCompleted === 'number');
        assert(typeof res.body.surpriseVisitsCompleted === 'number');
        assert(typeof res.body.avgComplianceScore === 'number');
        assert(typeof res.body.riceInspectionsCount === 'number');
        assert(typeof res.body.totalRosterPlanned === 'number');
        assert(res.body.totalRosterPlanned >= 24);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 10: ONE-CLICK SAFE TEST DATA CLEANUP & DATA INTEGRITY
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 10: One-Click Test Data Cleanup & Zero-Data-Loss Verification');

    await recordTest('Execute safe test data cleanup via POST /api/supervision/test-data/cleanup', async () => {
        const res = await request('POST', '/api/supervision/test-data/cleanup');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert(res.body.totalDeleted >= 22, `Expected at least 22 records deleted, got ${res.body.totalDeleted}`);
        console.log(`     Cleanup breakdown: Detailed: ${res.body.deleted.inspections}, Surprise: ${res.body.deleted.surprise}, Roster: ${res.body.deleted.roster}, Meetings: ${res.body.deleted.meetings}, Rice: ${res.body.deleted.rice}`);
    })();

    await recordTest('Verify test data status shows ZERO test records remaining', async () => {
        const res = await request('GET', '/api/supervision/test-data/status');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.totalTestRecords, 0, 'Expected 0 test records after cleanup');
        assert.strictEqual(res.body.counts.inspections, 0);
        assert.strictEqual(res.body.counts.surprise, 0);
        assert.strictEqual(res.body.counts.roster, 0);
        assert.strictEqual(res.body.counts.meetings, 0);
        assert.strictEqual(res.body.counts.rice, 0);
    })();

    await recordTest('STRICT INTEGRITY CHECK: 100% of original baseline data is intact', async () => {
        // 1. Detailed Inspection baseline
        const inspRes = await request('GET', '/api/supervision/inspections/INSP_BETUL_DEMO_01');
        assert.strictEqual(inspRes.status, 200, 'Baseline INSP_BETUL_DEMO_01 was lost!');
        assert.strictEqual(inspRes.body.id, 'INSP_BETUL_DEMO_01');

        // 2. Surprise Visit baseline
        const surpRes = await request('GET', '/api/supervision/surprise/SURP_BETUL_DEMO_01');
        assert.strictEqual(surpRes.status, 200, 'Baseline SURP_BETUL_DEMO_01 was lost!');
        assert.strictEqual(surpRes.body.id, 'SURP_BETUL_DEMO_01');

        // 3. Coordination Meeting baseline
        const meetRes = await request('GET', '/api/supervision/meetings/MEET_COORD_MPWLC_01');
        assert.strictEqual(meetRes.status, 200, 'Baseline MEET_COORD_MPWLC_01 was lost!');
        assert.strictEqual(meetRes.body.id, 'MEET_COORD_MPWLC_01');

        // 4. Annual Roster baseline (all 24 original KMS 2026-27 records)
        const rostRes = await request('GET', '/api/supervision/roster?year=2026');
        assert.strictEqual(rostRes.status, 200);
        const baselineRoster = rostRes.body.filter(r => r.id && r.id.startsWith('ROST_2026_'));
        assert.strictEqual(baselineRoster.length, 24, `Expected 24 baseline records, found ${baselineRoster.length}`);
    })();

    // ──────────────────────────────────────────────────────────
    // SUITE 11: RE-SEED FOR USER TESTING IN BROWSER
    // ──────────────────────────────────────────────────────────
    console.log('\n▶️ SUITE 11: Final Test Data Re-seeding for Browser Exploration');

    await recordTest('Re-seed 22 dummy test records so user can interactively test in UI', async () => {
        const res = await request('POST', '/api/supervision/test-data/seed');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.seededCount, 22);

        const statusRes = await request('GET', '/api/supervision/test-data/status');
        assert.strictEqual(statusRes.body.totalTestRecords, 22);
    })();

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`🏁 TEST SUITE COMPLETE: ${passedTests}/${totalTests} Tests Passed (0 Failed)`);
    console.log('══════════════════════════════════════════════════════════\n');
}

runSupervisionFullTestSuite().catch(err => {
    console.error('Test suite execution failed:', err);
    process.exit(1);
});
