// tests/test-stock-snapshots.js
// Verification test for stock_snapshots database operations, IST date conversion, and trend logic

const assert = require('assert');
const DatabaseManager = require('../server/database/db');

function getISTDateString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const istTime = new Date(d.getTime() + istOffsetMs);
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function computeTrendBadge(currentScore, historySnapshots, todayIST = getISTDateString()) {
    let priorSnapshot = null;
    if (Array.isArray(historySnapshots) && historySnapshots.length > 0) {
        if (historySnapshots[0].snapshotDate !== todayIST) {
            priorSnapshot = historySnapshots[0];
        } else if (historySnapshots.length >= 2) {
            priorSnapshot = historySnapshots[1];
        }
    }

    if (priorSnapshot && priorSnapshot.healthScore !== undefined && priorSnapshot.healthScore !== null) {
        const priorScore = parseInt(priorSnapshot.healthScore, 10);
        if (!isNaN(priorScore)) {
            const delta = currentScore - priorScore;
            const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
            const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;
            return {
                priorDate: priorSnapshot.snapshotDate,
                priorScore,
                delta,
                arrow,
                badgeText: `${arrow} ${deltaSign}`
            };
        }
    }
    return null;
}

async function runTests() {
    console.log('🧪 Starting Stock Snapshots & Trend Verification Tests...\n');

    // 1. Test IST Date Conversion
    console.log('--- 1. Testing IST Date Conversion (UTC+5:30) ---');
    // 16 Aug 2026 18:30:00 UTC = 17 Aug 2026 00:00:00 IST
    const t1 = new Date('2026-08-16T18:30:00.000Z');
    assert.strictEqual(getISTDateString(t1), '2026-08-17', '18:30 UTC should be 17 Aug IST');

    // 16 Aug 2026 23:59:00 UTC = 17 Aug 2026 05:29:00 IST
    const t2 = new Date('2026-08-16T23:59:00.000Z');
    assert.strictEqual(getISTDateString(t2), '2026-08-17', '23:59 UTC should be 17 Aug IST (pre-dawn)');

    // 16 Aug 2026 18:29:00 UTC = 16 Aug 2026 23:59:00 IST
    const t3 = new Date('2026-08-16T18:29:00.000Z');
    assert.strictEqual(getISTDateString(t3), '2026-08-16', '18:29 UTC should be 16 Aug IST');

    console.log('✅ IST Date conversion tests passed!\n');

    // 2. Test Database Table & Operations
    console.log('--- 2. Testing DatabaseManager stock_snapshots Operations ---');
    const db = new DatabaseManager();
    await db.init();

    // Clean up test dates if any
    await db.run('DELETE FROM stock_snapshots WHERE snapshot_date IN (?, ?)', ['2026-08-16', '2026-08-17']);

    // Insert day 1 snapshot (2026-08-16)
    await db.saveStockSnapshot({
        snapshotDate: '2026-08-16',
        syncedAt: '2026-08-16T10:00:00.000Z',
        healthScore: 75,
        healthLabel: 'Moderate',
        districtTotalQt: 220000.50,
        icData: [{ icName: 'बैतूल', icTotal: 50000, sharePct: 22.7, status: 'Normal' }]
    });

    // Insert day 2 snapshot (2026-08-17)
    await db.saveStockSnapshot({
        snapshotDate: '2026-08-17',
        syncedAt: '2026-08-17T08:00:00.000Z',
        healthScore: 82,
        healthLabel: 'Excellent',
        districtTotalQt: 225000.00,
        icData: [{ icName: 'बैतूल', icTotal: 52000, sharePct: 23.1, status: 'Normal' }]
    });

    // Test Upsert: Second sync on the same day (2026-08-17) should update row, not fail
    await db.saveStockSnapshot({
        snapshotDate: '2026-08-17',
        syncedAt: '2026-08-17T09:30:00.000Z',
        healthScore: 84,
        healthLabel: 'Excellent',
        districtTotalQt: 226000.00,
        icData: [{ icName: 'बैतूल', icTotal: 53000, sharePct: 23.5, status: 'Normal' }]
    });

    // Fetch history with limit 2
    const history = await db.getStockSnapshotHistory(2);
    console.log('Snapshot History retrieved:', history.map(h => ({
        date: h.snapshot_date,
        score: h.health_score,
        label: h.health_label,
        total: h.district_total_qt
    })));

    assert.strictEqual(history.length, 2, 'Should return 2 rows');
    assert.strictEqual(history[0].snapshot_date, '2026-08-17', 'Row 0 should be latest (2026-08-17)');
    assert.strictEqual(history[0].health_score, 84, 'Row 0 score should be updated to 84 by upsert');
    assert.strictEqual(history[1].snapshot_date, '2026-08-16', 'Row 1 should be prior day (2026-08-16)');
    assert.strictEqual(history[1].health_score, 75, 'Row 1 score should be 75');

    console.log('✅ Database table, upsert, and history retrieval verified!\n');

    // 3. Test Trend Calculation & Badges
    console.log('--- 3. Testing Trend Delta & Arrow Logic ---');

    // Case A: 2 history snapshots (today 84, yesterday 75) -> Delta = +9 (▲ +9)
    const trendA = computeTrendBadge(84, [
        { snapshotDate: '2026-08-17', healthScore: 84 },
        { snapshotDate: '2026-08-16', healthScore: 75 }
    ], '2026-08-17');
    assert.deepStrictEqual(trendA, {
        priorDate: '2026-08-16',
        priorScore: 75,
        delta: 9,
        arrow: '▲',
        badgeText: '▲ +9'
    });
    console.log('Case A (Improvement):', trendA.badgeText);

    // Case B: Drop in score (today 70, yesterday 75) -> Delta = -5 (▼ -5)
    const trendB = computeTrendBadge(70, [
        { snapshotDate: '2026-08-17', healthScore: 70 },
        { snapshotDate: '2026-08-16', healthScore: 75 }
    ], '2026-08-17');
    assert.strictEqual(trendB.badgeText, '▼ -5');
    console.log('Case B (Decline):', trendB.badgeText);

    // Case C: Unchanged score -> Delta = 0 (— 0)
    const trendC = computeTrendBadge(75, [
        { snapshotDate: '2026-08-17', healthScore: 75 },
        { snapshotDate: '2026-08-16', healthScore: 75 }
    ], '2026-08-17');
    assert.strictEqual(trendC.badgeText, '— 0');
    console.log('Case C (Unchanged):', trendC.badgeText);

    // Case D: First-ever run (no prior history) -> null (no badge)
    const trendD = computeTrendBadge(80, [], '2026-08-17');
    assert.strictEqual(trendD, null, 'Empty history should return null');

    // Case E: Single row from today -> null (no prior day)
    const trendE = computeTrendBadge(80, [{ snapshotDate: '2026-08-17', healthScore: 80 }], '2026-08-17');
    assert.strictEqual(trendE, null, 'Single row for today should return null');

    // Case F: Single row from yesterday (today not yet recorded) -> compares against yesterday!
    const trendF = computeTrendBadge(82, [{ snapshotDate: '2026-08-16', healthScore: 75 }], '2026-08-17');
    assert.deepStrictEqual(trendF, {
        priorDate: '2026-08-16',
        priorScore: 75,
        delta: 7,
        arrow: '▲',
        badgeText: '▲ +7'
    });
    console.log('Case F (Prior day comparison before today is saved):', trendF.badgeText);

    console.log('\n🎉 ALL STOCK SNAPSHOT & TREND TESTS PASSED SUCCESSFULLY!');
    db.close();
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
