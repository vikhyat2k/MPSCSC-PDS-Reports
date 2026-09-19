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
                    sectors: [],
                    sectorsData: []   // full sector objects for per-sector breakdown
                });
            }
            const item = transporterMap.get(t);
            item.sectorsCount += 1;
            item.allocation += s.allocation;
            item.dispatch += s.dispatch;
            item.posReceipt += s.posReceipt;
            item.sectors.push(s.sectorName);
            item.sectorsData.push(s);  // preserve full sector data
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
                sectorsData: t.sectorsData,  // per-sector detail rows
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
                        recAction += `\n[ध्वज: POS फीडिंग विलंब (+${s.posGapPP.toFixed(1)}%) - दुकान स्तर एंट्री सत्यापित करें]`;
                    } else {
                        recAction += `\n[ध्वज: POS ओवर-रिसीट विसंगति (${s.posGapPP.toFixed(1)}%) - प्रदाय केंद्र डिस्पैच एवं POS डेटा विसंगति जांचें]`;
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

        // ─────────────────────────────────────────────
        // 1. Priority Sector Intervention (Composite Urgency Ranking)
        // ─────────────────────────────────────────────
        const scoredSectors = rankedSectors.map(s => {
            let urgencyScore = 0;
            // Factor 1: Severe lifting deficit
            if (s.liftPct < 0.20) urgencyScore += 6;
            else if (s.liftPct < 0.25) urgencyScore += 5;
            else if (s.liftPct < 0.30) urgencyScore += 4;
            else if (s.liftPct < 0.40) urgencyScore += 2;
            else if (s.liftPct < 0.50) urgencyScore += 1;

            // Factor 2: High pending volume burden
            if (s.remaining >= 3500) urgencyScore += 6;
            else if (s.remaining >= 2800) urgencyScore += 4;
            else if (s.remaining >= 2200) urgencyScore += 3;
            else if (s.remaining >= 1500) urgencyScore += 1;

            // Factor 3: POS Feeding Delay / Data Incoherence
            if (Math.abs(s.posGapPP) >= 30) urgencyScore += 5;
            else if (Math.abs(s.posGapPP) >= 20) urgencyScore += 3;
            else if (Math.abs(s.posGapPP) >= 15) urgencyScore += 2;

            return {
                ...s,
                urgencyScore
            };
        });

        scoredSectors.sort((a, b) => b.urgencyScore - a.urgencyScore || a.liftPct - b.liftPct);

        // Select Top 8 Priority Intervention Sectors
        const priorityInterventions = scoredSectors.slice(0, 8).map((s, idx) => {
            let rootCause = '';
            let specificAction = '';
            let sla = '48h';

            if (s.liftPct < 0.20) {
                rootCause = 'वाहन फेरा (Trip cycle) विफलता; प्रदाय केंद्र से उठाव गति अत्यंत धीमी।';
                specificAction = 'बैतूल प्रदाय केंद्र से 2 अतिरिक्त ट्रिप शेड्यूल करें; दैनिक उठाव कोटा तय करें।';
                sla = '24h';
            } else if (s.posGapPP >= 30) {
                rootCause = 'सामग्री प्रदाय केंद्र से प्रेषित, लेकिन दुकानों द्वारा 30%+ खाद्यान्न की POS प्रविष्टि रोकी गई।';
                specificAction = 'दुकानों का तत्काल भौतिक सत्यापन करें; बायोमेट्रिक/नेटवर्क जांच कर POS स्टॉक मिलान करें।';
                sla = '24h';
            } else if (s.liftPct < 0.25) {
                rootCause = 'परिवहनकर्ता की सुस्त गति एवं दुकान स्तर पर POS प्राप्ति दर्ज करने में कोताही।';
                specificAction = 'परिवहनकर्ता को नोटिस जारी करें; कनिष्ठ आपूर्ति अधिकारी (JSO) दुकानवार POS एंट्री कराएं।';
                sla = '36h';
            } else if (s.remaining >= 2800) {
                rootCause = 'प्रदाय केंद्र पर लोडिंग विलंब एवं उच्च लंबित खाद्यान्न भार।';
                specificAction = 'बैतूल प्रदाय केंद्र पर लोडिंग प्राथमिकता दें; दैनिक न्यूनतम 300 Qt डिस्पैच सुनिश्चित करें।';
                sla = '36h';
            } else if (s.posGapPP >= 20) {
                rootCause = 'दूरस्थ सेक्टर मार्ग (+60 किमी); दुकान स्तर पर POS मशीन सिंकिंग पेंडिंग।';
                specificAction = 'वाहन मूवमेंट का GPS/लॉग सत्यापन करें; संबंधित FPS संचालकों को तत्काल एंट्री का निर्देश दें।';
                sla = '48h';
            } else {
                rootCause = 'सड़क मार्ग की दूरी एवं नियमित वाहन फेरे का अभाव।';
                specificAction = 'दैनिक प्रदाय चक्र दोगुना करें; पर्यवेक्षक स्तर पर POS प्रविष्टि का सत्यापन कराएं।';
                sla = '48h';
            }

            return {
                priorityRank: idx + 1,
                sectorName: s.sectorName,
                block: s.block,
                transporter: s.transporter,
                liftPct: s.liftPct,
                remaining: s.remaining,
                posGapPP: s.posGapPP,
                rootCause,
                specificAction,
                sla
            };
        });

        // ─────────────────────────────────────────────
        // 2. Consolidated Transporter Intelligence
        // ─────────────────────────────────────────────
        const lowLiftingTransporters = transporters.filter(t => !t.hasMultiple && t.liftPct < 0.30);
        const normalPerformers = transporters.filter(t => t.liftPct >= 0.50);

        const transporterIntelligence = {
            multiSector: multiSectorTransporters,
            lowPerformers: lowLiftingTransporters,
            normalPerformers: {
                count: normalPerformers.length,
                transporters: normalPerformers.map(t => ({
                    transporter: t.transporter,
                    liftPct: t.liftPct,
                    sector: t.sectorsList
                }))
            }
        };

        // ─────────────────────────────────────────────
        // 3. Material POS Anomalies (|Gap| > 15 pp)
        // ─────────────────────────────────────────────
        const materialPosAnomalies = rankedSectors
            .filter(s => Math.abs(s.posGapPP) > 15)
            .sort((a, b) => Math.abs(b.posGapPP) - Math.abs(a.posGapPP))
            .map(s => {
                const isLag = s.posGapPP > 0;
                return {
                    sectorName: s.sectorName,
                    block: s.block,
                    transporter: s.transporter,
                    dispatchPct: s.liftPct,
                    posReceiptPct: s.posReceiptPct,
                    posGapPP: s.posGapPP,
                    nature: isLag ? 'दुकान स्तर प्रविष्टि विलंब (POS Feeding Delay)' : 'ओवर-रिसीट विसंगति (Over-Receipt Anomaly)',
                    action: isLag 
                        ? 'FPS दुकान पर भौतिक जांच; बायोमेट्रिक/नेटवर्क सत्यापन व लंबित रसीद प्रविष्टि पूर्ण करवाएं।' 
                        : 'प्रदाय केंद्र प्रेषण चालान एवं POS मशीन डेटा का तकनीकी क्रॉस-ऑडिट करें।',
                    officer: 'कनिष्ठ आपूर्ति अधिकारी (JSO) / ब्लॉक खाद्य निरीक्षक',
                    sla: Math.abs(s.posGapPP) >= 30 ? '24h' : '48h'
                };
            });

        // ─────────────────────────────────────────────
        // 4. Executive Management Concerns & Actions (Page 1)
        // ─────────────────────────────────────────────
        const managementConcerns = [
            `आमला ब्लॉक में गंभीर उठाव पिछड़ाव: उठाव केवल ${(worstBlock ? worstBlock.liftPct * 100 : 0).toFixed(2)}%; कुल ${worstBlock ? worstBlock.remaining.toLocaleString('en-IN', {maximumFractionDigits: 1}) : 0} क्विंटल खाद्यान्न 2 सेक्टरों में अटका हुआ है।`,
            `जिले का सबसे अधिक लंबित सेक्टर: ${worstSector ? worstSector.sectorName : 'आमला 20'} में न्यूनतम उठाव (${worstSector ? (worstSector.liftPct * 100).toFixed(2) : 0}%) एवं जिले का सबसे बड़ा बैकलॉग (${worstSector ? worstSector.remaining.toLocaleString('en-IN', {maximumFractionDigits: 1}) : 0} Qt) दर्ज।`,
            `बहु-सेक्टर परिवहनकर्ता क्षमता संकट: ${multiSectorTransporters.map(t => t.transporter).join(', ')} के पास 2 सेक्टरों में कुल ${multiSectorTransporters.reduce((sum, t) => sum + t.remaining, 0).toLocaleString('en-IN', {maximumFractionDigits: 1})} क्विंटल लंबित भार है (उठाव दर: 36.39%)।`,
            `13 सेक्टरों में गंभीर POS फीडिंग विलंब: सामग्री प्रदाय केंद्र से जारी होने के बावजूद दुकान स्तर पर +15% से +37.3% सामग्री POS में अप्राप्त दर्ज है, जिससे लाभार्थी वितरण बाधित होने का जोखिम है।`,
            `जिले के शत-प्रतिशत सेक्टर गंभीर श्रेणी में: कुल 22 में से 22 सेक्टर (100%) उठाव के 70% मानक से नीचे हैं, जिससे तत्काल प्रबंधकीय हस्तक्षेप अनिवार्य है।`
        ];

        const immediateActions = [
            {
                action: 'कम उठाव वाले परिवहनकर्ताओं (पीयूष आर्य, रविन्द्र सिंह तोमर) को अतिरिक्त वाहन अनुबंध व तैनाती का अल्टीमेटम जारी करें।',
                officer: 'जिला प्रबंधक / परिवहन नोडल',
                sla: '24 घंटे'
            },
            {
                action: 'आमला (सेक्टर 20, 21) व मुलताई (सेक्टर 18, 19) के लिए बैतूल प्रदाय केंद्र से दैनिक ट्रिप फेरे तत्काल दोगुने करें।',
                officer: 'प्रदाय केंद्र प्रभारी, बैतूल',
                sla: '36 घंटे'
            },
            {
                action: 'सर्वोच्च POS अंतर वाले 13 सेक्टरों (शाहपुर-5, आठनेर-15 आदि) में फील्ड सुपरवाइजर भेजकर POS मशीन में प्रविष्टि सत्यापित करवाएं।',
                officer: 'सहायक आपूर्ति अधिकारी / JSO',
                sla: '48 घंटे'
            },
            {
                action: 'सभी 21 परिवहनकर्ताओं के दैनिक ट्रिप लॉग शाम 6:00 बजे तक जिला कार्यालय में अनिवार्य रूप से तलब करें।',
                officer: 'समस्त सेक्टर परिवहनकर्ता',
                sla: 'दैनिक (Daily)'
            }
        ];

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
            priorityInterventions,
            transporterIntelligence,
            materialPosAnomalies,
            managementConcerns,
            immediateActions,
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
