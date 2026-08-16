// tests/test-health-score.js
// Verification test for computeDistrictHealthScore & IC Buffer Classification logic

const assert = require('assert');

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

    // 2. Low buffer ICs (<50% of avg)
    const lowBufferThreshold = avgStock * 0.5;
    const highBufferThreshold = avgStock * 1.3;
    const lowBufferICs = list.filter(ic => {
        const tot = parseFloat(ic.total) || 0;
        return tot > 0 && tot < lowBufferThreshold;
    });

    // 3. Distribution equity (% held by top 50% ICs)
    const sortedTotals = list.map(ic => parseFloat(ic.total) || 0).sort((a, b) => b - a);
    const topHalf = sortedTotals.slice(0, Math.ceil(sortedTotals.length / 2)).reduce((s, v) => s + v, 0);
    const topHalfPct = districtTotal > 0 ? (topHalf / districtTotal * 100).toFixed(1) : '0.0';

    // Base and penalties
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
            description: 'Baseline score for fully operational district stock',
            value: baseScore,
            weight: 1,
            contribution: baseScore
        },
        {
            name: 'Negative Stock Deduction',
            description: 'Penalizes data errors / negative balances (< -0.001 Qt)',
            value: negativeItems.length,
            weight: negWeight,
            contribution: negContribution
        },
        {
            name: 'Low Buffer IC Deduction',
            description: 'Penalizes issue centers holding < 50% of district average stock',
            value: lowBufferICs.length,
            weight: lowBufferWeight,
            contribution: lowBufferContribution
        },
        {
            name: 'Distribution Concentration Deduction',
            description: 'Penalizes concentration if top half of ICs hold > 75% of stock',
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
        topHalfPct,
        negativeItems,
        lowBufferICs,
        components,
        thresholds
    };
}

console.log('🧪 Testing computeDistrictHealthScore logic and auditability...\n');

// Test Case 1: Realistic live dataset matching View_LiveRollup baseline
// 3 negative items (-36 pts), 0 low buffer ICs (0 pts), top half > 75% (-10 pts) -> Score = 100 - 36 - 10 = 54?
// Let's test with 2 negative items (-24 pts), 1 low buffer IC (-8 pts), topHalf > 75% (-10 pts) -> Score = 100 - 24 - 8 - 10 = 58!
const mockLiveRollup = [
    { name: 'IC Betul', total: 10000, commodities: { 'Wheat': 8000, 'Rice': 2000, 'Sugar': -15.50 } }, // negative item 1 (-12)
    { name: 'IC Multai', total: 6000, commodities: { 'Wheat': 4000, 'Rice': 2000, 'Salt': -5.00 } },   // negative item 2 (-12)
    { name: 'IC Shahpur', total: 3000, commodities: { 'Wheat': 2000, 'Rice': 1000 } },
    { name: 'IC Bhainsdehi', total: 2500, commodities: { 'Wheat': 1500, 'Rice': 1000 } },
    { name: 'IC Amla', total: 800, commodities: { 'Wheat': 600, 'Rice': 200 } }                        // low buffer IC (< 50% of avg 4460 is < 2230) (-8)
];

const res1 = computeDistrictHealthScore(mockLiveRollup);
console.log('Test 1 Output (Live Rollup baseline):', {
    score: res1.score,
    label: res1.label,
    components: res1.components.map(c => `${c.name}: ${c.contribution} (val: ${c.value})`),
    thresholds: res1.thresholds.icClassification
});

assert.strictEqual(res1.score, 58, 'Score should be exactly 58');
assert.strictEqual(res1.label, 'Critical', 'Label should be Critical');
assert.strictEqual(res1.components.length, 4, 'Should have 4 breakdown components');
console.log('✅ Test 1 Passed: Exact score 58 / Critical verified\n');

// Test Case 2: Healthy district stock
const mockHealthy = [
    { name: 'IC 1', total: 2000, commodities: { 'Wheat': 1000, 'Rice': 1000 } },
    { name: 'IC 2', total: 2000, commodities: { 'Wheat': 1000, 'Rice': 1000 } },
    { name: 'IC 3', total: 2000, commodities: { 'Wheat': 1000, 'Rice': 1000 } },
    { name: 'IC 4', total: 2000, commodities: { 'Wheat': 1000, 'Rice': 1000 } }
];
const res2 = computeDistrictHealthScore(mockHealthy);
assert.strictEqual(res2.score, 100);
assert.strictEqual(res2.label, 'Excellent');
console.log('✅ Test 2 Passed: Healthy stock score 100 / Excellent verified\n');

// Test Case 3: Empty input handling
const res3 = computeDistrictHealthScore([]);
assert.strictEqual(res3.score, 100);
assert.strictEqual(res3.label, 'Excellent');
console.log('✅ Test 3 Passed: Empty array gracefully handled\n');

console.log('🎉 All District Health Score logic and audit tests passed successfully!');
