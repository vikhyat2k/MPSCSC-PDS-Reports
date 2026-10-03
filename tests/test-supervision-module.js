const DatabaseManager = require('../server/database/db.js');
const assert = require('assert');

async function testSupervisionModule() {
    console.log('🧪 Starting Supervision & Inspection Module Tests...');
    const db = new DatabaseManager();
    await db.init();

    // Test 1: Get Stats
    const stats = await db.getSupervisionStats();
    console.log('✅ Test 1: Stats fetched successfully ->', stats);
    assert(stats.activeDistrict === 'Betul', 'Expected Betul as active district');
    assert(stats.totalRosterPlanned > 0, 'Expected positive roster targets');

    // Test 2: Save Detailed Inspection
    const testInspId = 'INSP_TEST_' + Date.now();
    const saveRes = await db.saveSupervisionInspection({
        id: testInspId,
        mode: 'dm',
        issueCenter: 'Chicholi',
        inspectionMonth: 'October',
        inspectionDate: '2026-10-03',
        officerName: 'Test Inspector',
        officerDesignation: 'District Manager',
        complianceScore: 88,
        deficienciesCount: 2,
        godownsCount: 2,
        payload: {
            reservation: { wheat: 1000, rice: 500 },
            stock: [{ commodity: 'गेहूं (Wheat)', soundBags: 2000, soundQty: 1000.00 }],
            checkpoints: { chk_1_computer: true, chk_2_printer: false },
            issuesAndSuggestions: [{ issue: 'प्रिंटर खराब', suggestion: 'मरम्मत कराएं' }]
        }
    });
    assert(saveRes.success === true, 'Inspection save failed');
    console.log('✅ Test 2: Saved inspection report ->', testInspId);

    // Test 3: Retrieve Inspection by ID
    const retrieved = await db.getSupervisionInspectionById(testInspId);
    assert(retrieved !== null, 'Failed to fetch saved inspection');
    assert(retrieved.issue_center === 'Chicholi', 'Issue center mismatch');
    assert(retrieved.compliance_score === 88, 'Score mismatch');
    console.log('✅ Test 3: Retrieved inspection by ID ->', retrieved.id);

    // Test 4: Surprise Inspection
    const testSurpId = 'SURP_TEST_' + Date.now();
    const surpRes = await db.saveSurpriseInspection({
        id: testSurpId,
        mode: 'dm',
        issueCenter: 'Amla',
        inspectionDate: '2026-10-03',
        officerName: 'Test Officer',
        score: 100,
        defectsCount: 0,
        payload: { remark: 'All good' }
    });
    assert(surpRes.success === true, 'Surprise inspection save failed');
    const surpriseList = await db.getSurpriseInspections(10);
    assert(surpriseList.some(s => s.id === testSurpId), 'Surprise item not found in list');
    console.log('✅ Test 4: Surprise inspection saved & listed ->', testSurpId);

    // Test 5: Roster Operations
    const roster = await db.getRoster(2026);
    assert(Array.isArray(roster) && roster.length >= 24, 'Roster count incorrect');
    console.log(`✅ Test 5: Annual Roster loaded with ${roster.length} entries for KMS 2026-27`);

    // Test 6: Rice Quality Inspection (KMS 2025-26)
    const testRiceId = 'RICE_TEST_' + Date.now();
    const riceSaveRes = await db.saveRiceInspection({
        id: testRiceId,
        warehouseName: 'MPWLC Kosmi Betul',
        analysisDate: '2026-10-03',
        branchManager: 'MPWLC Betul Branch',
        centreIncharge: 'MPSCSC Kosmi Center',
        districtManager: 'MPSCSC Betul',
        lots: [
            {
                sno: 1,
                millerName: 'Test Miller A',
                stackNo: 'S-01',
                lotNo: 'LOT-TEST-01',
                quantityMt: 29.0,
                noOfBags: 580,
                receiptDate: '2026-10-03',
                brokenSmall: 0.5,
                brokenBig: 18.0,
                brokenTotal: 18.5,
                fmInorg: 0.1,
                fmOrg: 0.2,
                fmTotal: 0.3,
                damaged: 2.0,
                admixture: 3.0,
                redKernels: 1.0,
                chalky: 2.5,
                discoloured: 1.5,
                dehusked: 8.0,
                frk: 1.0,
                testResult: 'Positive (1.0% FRK)',
                result: 'Within Specification'
            }
        ]
    });
    assert(riceSaveRes.success === true, 'Rice inspection save failed');
    const retrievedRice = await db.getRiceInspectionById(testRiceId);
    assert(retrievedRice !== null, 'Failed to fetch saved rice inspection');
    assert(retrievedRice.warehouse_name === 'MPWLC Kosmi Betul', 'Warehouse name mismatch');
    assert(retrievedRice.total_lots === 1, 'Lot count mismatch');
    assert(retrievedRice.total_quantity_mt === 29.0, 'Total MT mismatch');
    assert(retrievedRice.payload.lots.length === 1, 'Payload lots mismatch');
    const riceList = await db.getRiceInspections(10);
    assert(riceList.length >= 1, 'Rice list empty');
    console.log(`✅ Test 6: Rice Inspection (KMS 2025-26) save, fetch & list verified successfully!`);

    // Clean up test entries
    await db.deleteSupervisionInspection(testInspId);
    await db.deleteSurpriseInspection(testSurpId);
    await db.deleteRiceInspection(testRiceId);
    console.log('🧹 Cleaned up temporary test entries.');

    await db.close();
    console.log('🎉 All Supervision Module Tests (including Rice Quality Analysis) PASSED!');
}

testSupervisionModule().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
