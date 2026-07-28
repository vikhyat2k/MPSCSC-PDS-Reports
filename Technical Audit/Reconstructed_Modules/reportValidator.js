class ReportValidator {
    async validate(processedResult, schemeName, month, year, db) {
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

        // We can do a basic check: if we have sectors, we expect some data (though maybe everything is 0)
        // If there are shops but total dispatched/allotted is 0, it might be an empty month, 
        // which is structurally valid but might trigger a warning. We won't throw unless it's definitely malformed.
        
        let hasShops = false;
        processedResult.sectors.forEach(sector => {
            if (sector.shops && sector.shops.length > 0) {
                hasShops = true;
            }
        });

        // For nfsaDaterange, shops aren't arrays per sector in the standard sense sometimes, but we check length
        if (schemeName !== 'nfsa_daterange' && !hasShops) {
            throw new Error(`Validation failed for ${schemeName}: No shops found in any sector.`);
        }

        return true;
    }
}

module.exports = ReportValidator;
