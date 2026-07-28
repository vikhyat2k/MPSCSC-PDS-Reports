class ReportValidator {
    async validate(processedResult, schemeName, month, year, db, options = {}) {
        if (!processedResult) {
            throw new Error(`Validation failed for ${schemeName}: processedResult is null or undefined.`);
        }

        if (!processedResult.sectors || !Array.isArray(processedResult.sectors)) {
            throw new Error(`Validation failed for ${schemeName}: sectors array is missing.`);
        }

        if (processedResult.sectors.length === 0) {
            throw new Error(`Validation failed for ${schemeName}: sectors array is empty. No data processed.`);
        }

        const totals = processedResult.totals;
        if (!totals) {
            throw new Error(`Validation failed for ${schemeName}: totals object is missing.`);
        }

        // Check for NaN
        for (const [key, value] of Object.entries(totals)) {
            if (Number.isNaN(value)) {
                throw new Error(`Validation failed for ${schemeName}: Total ${key} is NaN.`);
            }
        }

        let hasShops = false;
        processedResult.sectors.forEach(sector => {
            if (sector.shops && sector.shops.length > 0) {
                hasShops = true;
            }
        });

        if (schemeName !== 'nfsa_daterange' && !hasShops) {
            throw new Error(`Validation failed for ${schemeName}: No shops found in any sector.`);
        }

        // 1. Mandatory Category Verification (for NFSA)
        const expectedMandatory = options.mandatoryCategories || (schemeName === 'nfsa' ? ['Regular', 'Extra'] : []);
        const processedCats = options.processedCategories || processedResult.processedCategories || [];

        if (expectedMandatory.length > 0 && processedCats.length > 0) {
            const missingMandatory = expectedMandatory.filter(cat => !processedCats.includes(cat));
            if (missingMandatory.length > 0) {
                throw new Error(`Validation failed for ${schemeName}: Mandatory category/categories missing (${missingMandatory.join(', ')}). Report is incomplete.`);
            }
        }

        // 2. Summary Totals Reconciliation Check
        const verification = processedResult.verification || {};
        if (verification && Object.keys(verification).length > 0) {
            let summaryAlloc = 0;
            let summaryDisp = 0;

            if (schemeName === 'nfsa' || schemeName === 'nfsa_daterange') {
                if (verification.alloted && typeof verification.alloted === 'object') {
                    summaryAlloc = Object.values(verification.alloted).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
                }
                if (verification.dispatched && typeof verification.dispatched === 'object') {
                    summaryDisp = Object.values(verification.dispatched).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
                }
            } else {
                // MDM, ICDS, Welfare
                Object.values(verification).forEach(commObj => {
                    if (commObj && typeof commObj === 'object') {
                        summaryAlloc += (commObj.allotted || commObj.allocation || 0);
                        summaryDisp += (commObj.dispatched || commObj.dispatch || 0);
                    }
                });
            }

            const shopAlloc = totals.totalAllocation || totals.totalAllotted || 0;
            const shopDisp = totals.totalDispatch || totals.totalDispatched || 0;

            // Perform reconciliation check if summary totals are populated (>0)
            if (summaryAlloc > 0) {
                const allocDiff = Math.abs(shopAlloc - summaryAlloc);
                // Allocation tolerance: 50.0 MT across 500+ shops (catches missing categories / missing depots)
                const allocTolerance = options.allocTolerance || options.tolerance || 50.0;
                if (allocDiff > allocTolerance) {
                    throw new Error(`Validation failed for ${schemeName}: Detailed shop allocation sum (${shopAlloc.toFixed(2)} MT) does not match SCM portal summary total (${summaryAlloc.toFixed(2)} MT). Discrepancy: ${allocDiff.toFixed(2)} MT.`);
                }
            }

            if (summaryDisp > 0) {
                if (schemeName === 'nfsa' || schemeName === 'nfsa_daterange') {
                    // For NFSA, Portability dispatches (~200–2,000 MT across district) appear in detailed shop rows
                    // but are excluded from the SCM portal summary table top-level row.
                    // Therefore, shopDisp can exceed summaryDisp by the Portability volume (up to 2,500 MT),
                    // but must NOT be lower than summaryDisp by more than 50 MT (which would indicate missing shop data).
                    const dispDeficit = summaryDisp - shopDisp;
                    const dispSurplus = shopDisp - summaryDisp;

                    if (dispDeficit > 50.0) {
                        throw new Error(`Validation failed for ${schemeName}: Detailed shop dispatch sum (${shopDisp.toFixed(2)} MT) is significantly lower than SCM portal summary total (${summaryDisp.toFixed(2)} MT). Deficit: ${dispDeficit.toFixed(2)} MT.`);
                    }

                    const maxPortabilitySurplus = options.maxPortabilitySurplus || 2500.0;
                    if (dispSurplus > maxPortabilitySurplus) {
                        throw new Error(`Validation failed for ${schemeName}: Detailed shop dispatch sum (${shopDisp.toFixed(2)} MT) exceeds SCM portal summary total (${summaryDisp.toFixed(2)} MT) beyond expected Portability limits. Discrepancy: ${dispSurplus.toFixed(2)} MT.`);
                    }
                } else {
                    const dispDiff = Math.abs(shopDisp - summaryDisp);
                    const dispTolerance = options.dispTolerance || options.tolerance || 50.0;
                    if (dispDiff > dispTolerance) {
                        throw new Error(`Validation failed for ${schemeName}: Detailed shop dispatch sum (${shopDisp.toFixed(2)} MT) does not match SCM portal summary total (${summaryDisp.toFixed(2)} MT). Discrepancy: ${dispDiff.toFixed(2)} MT.`);
                    }
                }
            }
        }

        return true;
    }
}

module.exports = new ReportValidator();
