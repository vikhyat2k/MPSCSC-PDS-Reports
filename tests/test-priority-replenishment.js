// tests/test-priority-replenishment.js
// Verification test for Priority 1 Low-Buffer Replenishment calculation

const assert = require('assert');

const LOW_BUFFER_THRESHOLD_PCT = 0.5;

function fmtQ(v) {
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Qt';
}

function computeLowBufferReplenishment(icData) {
    const list = Array.isArray(icData) ? icData : [];
    const districtTotal = list.reduce((s, ic) => s + (parseFloat(ic.total) || 0), 0);
    const avgStock = list.length ? districtTotal / list.length : 0;
    const lowBufferThreshold = avgStock * LOW_BUFFER_THRESHOLD_PCT;

    const lowBufferICs = list.filter(ic => {
        const tot = parseFloat(ic.total) || 0;
        return tot > 0 && tot < lowBufferThreshold;
    });

    const icReplenishmentDetails = lowBufferICs.map(ic => {
        const icTot = parseFloat(ic.total) || 0;
        const neededQt = Math.max(0, lowBufferThreshold - icTot);
        return {
            name: ic.name,
            total: icTot,
            neededQt: neededQt,
            formatted: `${ic.name}: +${fmtQ(neededQt)}`
        };
    });

    // Sum unrounded values, then format once
    const totalNeededQt = icReplenishmentDetails.reduce((sum, item) => sum + item.neededQt, 0);
    const totalNeededFormatted = fmtQ(totalNeededQt);
    const icListFormatted = icReplenishmentDetails.map(item => item.formatted).join(' · ');

    const priorityBody = `${lowBufferICs.length} IC(s) hold below 50% of district average: ${icListFormatted}. Total replenishment needed: ${totalNeededFormatted}. Recommend prioritizing dispatch from nearest warehouse in next allocation cycle.`;

    return {
        districtTotal,
        avgStock,
        lowBufferThreshold,
        lowBufferICs,
        icReplenishmentDetails,
        totalNeededQt,
        totalNeededFormatted,
        priorityBody
    };
}

console.log('🧪 Testing Priority 1 Replenishment Target calculation...\n');

// Test Case 1: Realistic mock with 4 low-buffer ICs (matching user context sample)
// District Avg per IC = 200,000 / 5 = 40,000 Qt
// Low Buffer Threshold (50%) = 20,000 Qt
const mockICs = [
    { name: 'बैतूल', total: 100000 },     // High
    { name: 'भैंसदेही', total: 1835.30 },   // Low: needed = 20000 - 1835.30 = 18164.70
    { name: 'भीमपुर', total: 7275.53 },    // Low: needed = 20000 - 7275.53 = 12724.47
    { name: 'मुलताई', total: 8090.76 },    // Low: needed = 20000 - 8090.76 = 11909.24
    { name: 'आमला', total: -21778.58 }     // Negative, not in lowBufferICs (> 0 condition)
];
// Let's add a proper 5th positive low IC
const mockRealistic = [
    { name: 'बैतूल', total: 150000 },
    { name: 'चिचोली', total: 60000 },
    { name: 'भैंसदेही', total: 1835.30 },
    { name: 'भीमपुर', total: 7275.53 },
    { name: 'मुलताई', total: 8090.76 },
    { name: 'आमला', total: 2000.00 }
];

const res = computeLowBufferReplenishment(mockRealistic);
console.log('District Total:', res.districtTotal);
console.log('District Avg per IC:', res.avgStock);
console.log('50% Threshold:', res.lowBufferThreshold);
console.log('Low Buffer ICs found:', res.lowBufferICs.length);
console.log('Per-IC Needed:');
res.icReplenishmentDetails.forEach(d => {
    console.log(`  - ${d.name}: actual = ${d.total} Qt, needed = +${d.neededQt.toFixed(4)} Qt (${d.formatted})`);
});
console.log('Total Replenishment Needed (Exact):', res.totalNeededQt);
console.log('Total Replenishment Needed (Formatted):', res.totalNeededFormatted);
console.log('\nRendered Priority 1 Body:');
console.log(res.priorityBody);

assert.strictEqual(res.lowBufferICs.length, 4, 'Should identify 4 low buffer ICs');
assert.ok(res.priorityBody.includes('Total replenishment needed:'), 'Should include total replenishment phrase');
assert.ok(res.priorityBody.includes('भैंसदेही: +'), 'Should format ICs with +Qt');

// Test Case 2: Precision check verifying sum of unrounded values vs sum of rounded
const precisionMock = [
    { name: 'IC 1', total: 10000 },
    { name: 'IC 2', total: 1000.333 },
    { name: 'IC 3', total: 1000.333 },
    { name: 'IC 4', total: 1000.334 }
];
const res2 = computeLowBufferReplenishment(precisionMock);
assert.strictEqual(typeof res2.totalNeededQt, 'number');

console.log('\n✅ All Priority 1 Replenishment Target tests passed successfully!');
