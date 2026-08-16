// tests/test-top-concentration.js
const assert = require('assert');

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

console.log('🧪 Testing computeTopConcentration...\n');

// Test Case 1: 9 Issue Centers in Betul
const mockBetul9ICs = [
    { name: 'Betul', total: 400000 },
    { name: 'Multai', total: 200000 },
    { name: 'Shahpur', total: 120000 },
    { name: 'Bhainsdehi', total: 80000 },
    { name: 'Amla', total: 60000 },
    { name: 'Chicholi', total: 40000 },
    { name: 'Ghoradongri', total: 30000 },
    { name: 'Athner', total: 20000 },
    { name: 'Prabhat Pattan', total: 10000 }
];

const res1 = computeTopConcentration(mockBetul9ICs);
console.log('Test 1 (9 ICs):', res1);
assert.strictEqual(res1.totalICs, 9);
assert.strictEqual(res1.topN, 5); // Math.ceil(9 / 2) = 5
assert.strictEqual(res1.topSharePct, '89.6');

// Test Case 2: Realistic 86.3% case
// Total = 1,000,000. Top 5 sum = 863,000 -> 86.3%
const mock86Pct = [
    { name: 'IC 1', total: 350000 },
    { name: 'IC 2', total: 250000 },
    { name: 'IC 3', total: 120000 },
    { name: 'IC 4', total: 80000 },
    { name: 'IC 5', total: 63000 },
    { name: 'IC 6', total: 40000 },
    { name: 'IC 7', total: 40000 },
    { name: 'IC 8', total: 30000 },
    { name: 'IC 9', total: 27000 }
];
const res2 = computeTopConcentration(mock86Pct);
console.log('Test 2 (86.3% case):', res2);
assert.strictEqual(res2.topN, 5);
assert.strictEqual(res2.totalICs, 9);
assert.strictEqual(res2.topSharePct, '86.3');

const s3Text = `Top ${res2.topN} of ${res2.totalICs} Issue Centers hold ${res2.topSharePct}% of district stock`;
console.log('Generated Card String:', s3Text);
assert.strictEqual(s3Text, 'Top 5 of 9 Issue Centers hold 86.3% of district stock');

console.log('🎉 All computeTopConcentration tests passed successfully!');
