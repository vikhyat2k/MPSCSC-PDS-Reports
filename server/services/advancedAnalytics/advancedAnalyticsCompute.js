const fs = require('fs');
const path = require('path');
const DataProcessor = require('../dataProcessor');

class AdvancedAnalyticsCompute {
    constructor() {
        this.dataProcessor = new DataProcessor();
        this.sectorsConfig = [];
        try {
            const configPath = path.join(__dirname, '../../../config/sectors.json');
            if (fs.existsSync(configPath)) {
                this.sectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (e) {
            console.error('Could not load sectors.json in AdvancedAnalyticsCompute:', e);
        }
    }

    /**
     * Computes all analytical rollups, risk tiers, POS gap flags, district ranks,
     * block summaries, transporter analysis, and priority action plan.
     * 
     * @param {Object} report Database report row
     * @returns {Object} Structured compute metrics
     */
    compute(report) {
        if (!report) {
            throw new Error('Report object is required for advanced analytics compute.');
        }

        let rawData = [];
        if (report.raw_data) {
            try {
                rawData = typeof report.raw_data === 'string' ? JSON.parse(report.raw_data) : report.raw_data;
            } catch (e) {
                console.error('Failed to parse report raw_data:', e);
            }
        }

        // Process sectors through dataProcessor for canonical sector aggregation
        const processedResult = this.dataProcessor.processData(rawData);
        const rawSectors = processedResult.sectors || [];

        // Map and enrich sectors
        const sectors = rawSectors.map((s, idx) => {
            const matchedCfg = this.sectorsConfig.find(c => 
                String(c.serialNo) === String(s.serialNo) || 
                (c.sectorName && s.sectorName && c.sectorName.trim() === s.sectorName.trim())
            ) || {};

            const alloc = parseFloat(s.allocation || 0);
            const disp = parseFloat(s.dispatch || 0);
            const posRec = parseFloat(s.posReceipt || s.receipt || 0);

            // Lift % uses dispatch (depot outgoing), NEVER posReceipt
            const liftPct = alloc > 0 ? (disp / alloc) : 0;
            const posReceiptPct = alloc > 0 ? (posRec / alloc) : 0;
            
            // POS Gap pp = (Lift % - POS Receipt %) * 100
            const posGapPP = (liftPct - posReceiptPct) * 100;

            let posGapFlag = 'NORMAL';
            let posGapLabel = 'सामान्य / Normal';
            if (posGapPP > 15) {
                posGapFlag = 'LAG';
                posGapLabel = 'POS फीडिंग विलंब / POS Feeding Lag';
            } else if (posGapPP < -15) {
                posGapFlag = 'OVER_RECEIPT';
                posGapLabel = 'POS ओवर-रिसीट विसंगति / POS Over-Receipt Anomaly';
            }

            // Risk Tiers based on Lift %
            let riskTier = 'Critical';
            let riskTierHindi = 'गंभीर';
            let riskColor = '#B23A2E'; // Red

            if (liftPct >= 0.95) {
                riskTier = 'Excellent';
                riskTierHindi = 'उत्कृष्ट';
                riskColor = '#1E7B4D'; // Green
            } else if (liftPct >= 0.85) {
                riskTier = 'Good';
                riskTierHindi = 'अच्छा';
                riskColor = '#2E6F95'; // Blue
            } else if (liftPct >= 0.70) {
                riskTier = 'Watch';
                riskTierHindi = 'निगरानी';
                riskColor = '#D98E04'; // Amber
            }

            const blockName = matchedCfg.block || s.block || matchedCfg.districtOffice || 'बैतूल';
            const transporterName = matchedCfg.transporter || s.transporter || 'N/A';
            const mobileNumber = matchedCfg.mobile || s.mobileNumber || 'N/A';
            const sectorName = s.sectorName || matchedCfg.sectorName || `Sector ${s.serialNo || idx + 1}`;

            return {
                srNo: idx + 1,
                serialNo: s.serialNo || idx + 1,
                sectorName,
                block: blockName,
                shopsCount: s.totalShops || (s.shops ? s.shops.length : 0),
                allocation: alloc,
                dispatch: disp,
                posReceipt: posRec,
                liftPct,
                posReceiptPct,
                posGapPP: Number(posGapPP.toFixed(2)),
                posGapFlag,
                posGapLabel,
                remaining: Math.max(0, alloc - disp),
                riskTier,
                riskTierHindi,
                riskColor,
                transporter: transporterName,
                mobile: mobileNumber
            };
        });

        // Compute District Ranks (highest liftPct = Rank 1)
        const sortedByLift = [...sectors].sort((a, b) => b.liftPct - a.liftPct);
        sortedByLift.forEach((sec, idx) => {
            sec.districtRank = idx + 1;
        });

        // Ensure sectors array preserves initial order with rank attached
        const rankedSectors = sectors.map(s => {
            const found = sortedByLift.find(item => item.serialNo === s.serialNo && item.sectorName === s.sectorName);
            return {
                ...s,
                districtRank: found ? found.districtRank : s.srNo
            };
        });

        // District KPI Aggregates
        const totalAllocation = rankedSectors.reduce((sum, s) => sum + s.allocation, 0);
        const totalDispatch = rankedSectors.reduce((sum, s) => sum + s.dispatch, 0);
        const totalPOSReceipt = rankedSectors.reduce((sum, s) => sum + s.posReceipt, 0);
        const districtLiftPct = totalAllocation > 0 ? (totalDispatch / totalAllocation) : 0;
        const pendingQty = Math.max(0, totalAllocation - totalDispatch);
        const avgPosReceiptPct = totalAllocation > 0 ? (totalPOSReceipt / totalAllocation) : 0;

        const criticalSectorsCount = rankedSectors.filter(s => s.riskTier === 'Critical').length;
        const watchSectorsCount = rankedSectors.filter(s => s.riskTier === 'Watch').length;
        const goodSectorsCount = rankedSectors.filter(s => s.riskTier === 'Good').length;
        const excellentSectorsCount = rankedSectors.filter(s => s.riskTier === 'Excellent').length;

        // Block-wise Summary Rollup
        const blockMap = new Map();
        rankedSectors.forEach(s => {
            const b = s.block;
            if (!blockMap.has(b)) {
                blockMap.set(b, {
                    block: b,
                    sectorsCount: 0,
                    allocation: 0,
                    dispatch: 0,
                    posReceipt: 0
                });
            }
            const item = blockMap.get(b);
            item.sectorsCount += 1;
            item.allocation += s.allocation;
            item.dispatch += s.dispatch;
            item.posReceipt += s.posReceipt;
        });

        const blocks = Array.from(blockMap.values()).map(b => {
            const liftPct = b.allocation > 0 ? (b.dispatch / b.allocation) : 0;
            return {
                ...b,
                liftPct,
                remaining: Math.max(0, b.allocation - b.dispatch)
            };
        });

        // Rank blocks by Lift % descending (Rank 1 = best)
        blocks.sort((a, b) => b.liftPct - a.liftPct);
        blocks.forEach((b, idx) => {
            b.rank = idx + 1;
        });

        // Transporter Rollup
        const transporterMap = new Map();
        rankedSectors.forEach(s => {
            const t = s.transporter;
            if (!transporterMap.has(t)) {
                transporterMap.set(t, {
                    transporter: t,
                    mobile: s.mobile,
                    sectorsCount: 0,
                    allocation: 0,
                    dispatch: 0,
                    posReceipt: 0,
                    sectors: []
                });
            }
            const item = transporterMap.get(t);
            item.sectorsCount += 1;
            item.allocation += s.allocation;
            item.dispatch += s.dispatch;
            item.posReceipt += s.posReceipt;
            item.sectors.push(s.sectorName);
        });

        const transporters = Array.from(transporterMap.values()).map((t, idx) => {
            const liftPct = t.allocation > 0 ? (t.dispatch / t.allocation) : 0;
            const hasMultiple = t.sectorsCount > 1;
            return {
                srNo: idx + 1,
                transporter: t.transporter,
                mobile: t.mobile,
                sectorsCount: t.sectorsCount,
                sectorsList: t.sectors.join(', '),
                allocation: t.allocation,
                dispatch: t.dispatch,
                posReceipt: t.posReceipt,
                liftPct,
                remaining: Math.max(0, t.allocation - t.dispatch),
                hasMultiple,
                remark: hasMultiple ? 'एकाधिक सेक्टर — क्षमता जांचें / Multiple sectors — verify capacity' : 'सामान्य / Normal'
            };
        });

        // Sort transporters by Lift % descending
        transporters.sort((a, b) => b.liftPct - a.liftPct);
        transporters.forEach((t, idx) => {
            t.srNo = idx + 1;
        });

        // Priority Action Plan (Sectors with Lift % < 85%, sorted ascending worst first)
        const actionPlanSectors = rankedSectors
            .filter(s => s.liftPct < 0.85)
            .sort((a, b) => a.liftPct - b.liftPct)
            .map((s, idx) => {
                let recAction = '';
                if (s.riskTier === 'Critical') {
                    recAction = '48 घंटे के भीतर प्रदाय सुनिश्चित करें एवं समीक्षा करें / Ensure dispatch & review within 48 hours';
                } else {
                    recAction = 'साप्ताहिक समीक्षा एवं नियमित अनुश्रवण करें / Weekly review & regular monitoring';
                }

                if (Math.abs(s.posGapPP) > 15) {
                    if (s.posGapPP > 15) {
                        recAction += `\n[ध्वज: POS फीडिंग विलंब (+${s.posGapPP.toFixed(1)} pp) - दुकान स्तर एंट्री सत्यापित करें]`;
                    } else {
                        recAction += `\n[ध्वज: POS ओवर-रिसीट विसंगति (${s.posGapPP.toFixed(1)} pp) - डिपो डिस्पैच एवं POS डेटा विसंगति जांचें]`;
                    }
                }

                return {
                    srNo: idx + 1,
                    sectorName: s.sectorName,
                    block: s.block,
                    liftPct: s.liftPct,
                    remaining: s.remaining,
                    riskTier: s.riskTier,
                    riskTierHindi: s.riskTierHindi,
                    transporterInfo: `${s.transporter} (${s.mobile})`,
                    recommendedAction: recAction
                };
            });

        // Executive Findings
        const bestBlock = blocks.length > 0 ? blocks[0] : null;
        const worstBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
        const worstSector = sortedByLift.length > 0 ? sortedByLift[sortedByLift.length - 1] : null;
        
        // Find biggest POS gap in positive direction (lag) and negative direction (over-receipt)
        const sortedByGapDesc = [...rankedSectors].sort((a, b) => b.posGapPP - a.posGapPP);
        const biggestLagSector = sortedByGapDesc.find(s => s.posGapPP > 15) || null;
        const sortedByGapAsc = [...rankedSectors].sort((a, b) => a.posGapPP - b.posGapPP);
        const biggestOverReceiptSector = sortedByGapAsc.find(s => s.posGapPP < -15) || null;

        const multiSectorTransporters = transporters.filter(t => t.hasMultiple);

        return {
            month: report.month,
            year: report.year,
            scheme: report.scheme || 'nfsa',
            generatedAt: report.created_at || report.generated_at || new Date().toISOString(),
            kpis: {
                totalAllocation,
                totalDispatch,
                districtLiftPct,
                pendingQty,
                avgPosReceiptPct,
                criticalSectorsCount,
                watchSectorsCount,
                goodSectorsCount,
                excellentSectorsCount,
                totalSectorsCount: rankedSectors.length
            },
            sectors: rankedSectors,
            blocks,
            transporters,
            actionPlan: actionPlanSectors,
            findings: {
                bestBlock,
                worstBlock,
                worstSector,
                biggestLagSector,
                biggestOverReceiptSector,
                multiSectorTransporters,
                sub85Count: actionPlanSectors.length
            }
        };
    }
}

module.exports = AdvancedAnalyticsCompute;
