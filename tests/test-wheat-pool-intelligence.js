// tests/test-wheat-pool-intelligence.js
const assert = require('assert');

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

function computeWheatPoolIntelligence(commodityHeaders, commodityTotals, districtTotal, donutWheatTotal) {
    const wheatCols = commodityHeaders.filter(h => h.toLowerCase().includes('wheat'));
    wheatCols.sort((a, b) => getWheatHeaderYear(b) - getWheatHeaderYear(a));

    const totalWheatQt = donutWheatTotal !== undefined ? donutWheatTotal : wheatCols.reduce((s, h) => s + (commodityTotals[h] || 0), 0);
    const freshWheatHeader = wheatCols[0] || '';
    const freshWheatQt = freshWheatHeader ? (commodityTotals[freshWheatHeader] || 0) : 0;
    const agedWheatCols = wheatCols.slice(1);
    const agedWheatQt = agedWheatCols.reduce((sum, h) => sum + (commodityTotals[h] || 0), 0);

    const totalWheatPct = districtTotal > 0 ? (totalWheatQt / districtTotal * 100).toFixed(1) : '0.0';
    const agedPctOfDistrict = districtTotal > 0 ? (agedWheatQt / districtTotal * 100).toFixed(1) : '0.0';
    const agedPctOfWheatPool = totalWheatQt > 0 ? (agedWheatQt / totalWheatQt * 100).toFixed(1) : '0.0';
    const freshYearLabel = freshWheatHeader.match(/(?:20)?\d{2}[-/](?:20)?\d{2}|\b20\d{2}\b/)?.[0] || 'current-season';

    function fmtQ(v) {
        return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Qt';
    }

    let wheatMsg = '';
    if (agedWheatQt > 0) {
        wheatMsg = `Wheat pool is ${totalWheatPct}% of district stock (${fmtQ(totalWheatQt)}), but only ${fmtQ(agedWheatQt)} — ${agedPctOfWheatPool}% of the pool, ${agedPctOfDistrict}% of district total — is aged pre-${freshYearLabel} procurement. Prioritize this portion for offloading; the remaining ${fmtQ(freshWheatQt)} is current-season stock.`;
    } else {
        wheatMsg = `Wheat constitutes ${totalWheatPct}% of total district stock (${fmtQ(totalWheatQt)}), all of which is fresh current-season (${freshYearLabel}) stock with no aged procurement backlog.`;
    }

    return {
        totalWheatQt,
        freshWheatQt,
        agedWheatQt,
        totalWheatPct,
        agedPctOfDistrict,
        agedPctOfWheatPool,
        freshYearLabel,
        wheatCols,
        freshWheatHeader,
        agedWheatCols,
        wheatMsg
    };
}

console.log('🧪 Testing computeWheatPoolIntelligence...\n');

// Test Case 1: Multi-year wheat stock matching user example
const headers1 = ['Wheat 2024-25', 'Wheat 2025-26', 'Wheat 2026-27', 'CMR-2025-26', 'Sugar', 'Salt'];
const totals1 = {
    'Wheat 2024-25': 12000.15,
    'Wheat 2025-26': 24117.06,
    'Wheat 2026-27': 574836.82,
    'CMR-2025-26': 300000.00,
    'Sugar': 50000.00,
    'Salt': 34000.00
};
const districtTotal1 = 995000.00;
const donutWheat1 = 610954.03;

const res1 = computeWheatPoolIntelligence(headers1, totals1, districtTotal1, donutWheat1);
console.log('Test 1 Result:', res1);

assert.strictEqual(res1.freshWheatHeader, 'Wheat 2026-27');
assert.strictEqual(res1.agedWheatCols.length, 2);
assert.strictEqual(res1.agedWheatQt.toFixed(2), '36117.21');
assert.strictEqual(res1.freshWheatQt.toFixed(2), '574836.82');
assert.strictEqual(res1.agedPctOfWheatPool, '5.9');
assert.strictEqual(res1.agedPctOfDistrict, '3.6');
assert.strictEqual(res1.totalWheatPct, '61.4');
console.log('✅ Test 1 Passed: Exact aged and fresh figures match!\n');
console.log('Generated Message:\n', res1.wheatMsg, '\n');

// Test Case 2: Only fresh wheat
const headers2 = ['Wheat 2026-27', 'Sugar', 'Salt'];
const totals2 = {
    'Wheat 2026-27': 500000.00,
    'Sugar': 50000.00,
    'Salt': 34000.00
};
const res2 = computeWheatPoolIntelligence(headers2, totals2, 584000.00, 500000.00);
assert.strictEqual(res2.agedWheatQt, 0);
assert.strictEqual(res2.agedWheatCols.length, 0);
console.log('✅ Test 2 Passed: Single season handled cleanly!\n');

console.log('🎉 All Wheat Pool Intelligence tests passed successfully!');
