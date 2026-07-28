# PDS Lifting Report - Comprehensive End-to-End Audit Report

## 1. Executive Summary
This document provides an exhaustive, evidence-based end-to-end audit of the PDS Lifting Report system. The review encompassed functional logic, module interactions, report generation accuracy, analytics validation, and system stability. 

Overall, the system demonstrates strong functionality for scraping and visualizing complex tabular data across multiple state schemes (NFSA, MDM, ICDS, Welfare). However, critical vulnerabilities exist in concurrency management, data retention (file leakages), error propagation during UI polling, and historical report restoration logic for non-NFSA reports. Addressing these issues is required to ensure long-term stability and data integrity.

---

## 2. Complete Defect Log

### 1. Unbounded Puppeteer Concurrency (Memory Exhaustion Risk)
* **Module/Page:** `server.js` (Report Generation Endpoints)
* **Severity:** **Critical**
* **Exact reproduction steps:** Open multiple browser tabs and click "Generate Report" for different months concurrently, or programmatically spam the `/api/generate-report` endpoint.
* **Expected vs actual result:** Expected the system to queue requests or reject them with a "Server Busy" message. Actual result: The system spins up unbounded instances of Puppeteer (`activeScrapers.set`), rapidly exhausting RAM and crashing the Node.js process.
* **Root cause analysis:** No validation exists on `activeRequests.size` before initiating a new scraping job.
* **Business impact:** A single user (or malicious actor) can accidentally or intentionally take down the entire reporting server.
* **Recommended fix:** Implement a concurrency limit (e.g., max 2 or 3 active scrapers) and queue overflow requests, or return a 429 Too Many Requests response.
* **Priority:** 1

### 2. Orphaned File Storage Leak on Report Deletion
* **Module/Page:** `server.js` (`app.delete('/api/reports/:id')`)
* **Severity:** **High**
* **Exact reproduction steps:** Generate a new report. Go to History. Delete the report from the dashboard. Check the server filesystem in the `reports/` directory.
* **Expected vs actual result:** Expected the database record AND the associated Excel/PDF files to be deleted. Actual result: Only `db.deleteReport(id)` is called. The physical files are orphaned and permanently consume disk space.
* **Root cause analysis:** The delete endpoint does not query the filepath of the report before deletion, nor does it invoke `fs.unlink()`.
* **Business impact:** Rapid storage bloat. Over months of usage and manual testing, the server disk will reach 100% capacity, causing database writes and report generation to fail system-wide.
* **Recommended fix:** Query the filepath from the database first, call `fs.unlink()` wrapped in a `try/catch`, and then delete the DB record.
* **Priority:** 2

### 3. Deep Restore Data Corruption for Non-NFSA Reports
* **Module/Page:** `server/services/reportRestorer.js`
* **Severity:** **Medium** (Previously Critical, currently patched for new reports)
* **Exact reproduction steps:** Load an older MDM, ICDS, or Welfare report generated before the recent patch. The system triggers `reportRestorer.restoreReport`.
* **Expected vs actual result:** Expected accurate historical matrices. Actual result: The restorer forcefully applies NFSA `allSectors` mappings to MDM/ICDS data, wiping out valid specific commodities and defaulting UI balances to `0.00 Qt`.
* **Root cause analysis:** `reportRestorer.js` lacks strict schema segregation. It assumes any report missing legacy NFSA fields needs to be "fixed" using NFSA logic.
* **Business impact:** Misleading historical analytics, rendering old non-NFSA reports factually incorrect and legally invalid for submission.
* **Recommended fix:** Add a strict guard clause in `reportRestorer.js` to immediately return the raw insights if `report.scheme !== 'nfsa'`.
* **Priority:** 3

### 4. UI Polling Silent Failures (Zombie Loading State)
* **Module/Page:** `public/app.js` (`pollingInterval`)
* **Severity:** **Medium**
* **Exact reproduction steps:** Click "Generate". Disconnect the network cable or restart the server during generation.
* **Expected vs actual result:** Expected the UI to display a "Network Error" or "Server Disconnected" state. Actual result: The `setInterval` polling fails silently, leaving the UI permanently stuck at "Processing..." indefinitely.
* **Root cause analysis:** `fetch` requests inside the `setInterval` do not trigger an error state update on the UI if a `TypeError` (network failure) occurs. 
* **Business impact:** User confusion, leading to users repeatedly hitting "Refresh" and triggering the concurrency bug (Defect #1).
* **Recommended fix:** Add a `.catch()` block to the polling `fetch` that updates the UI state to Error after 3 consecutive network failures.
* **Priority:** 4

---

## 3. Functional Gap Analysis
- **Missing Validation on Report Inputs:** Month and Year are accepted directly from the client without strict server-side validation against valid calendar months.
- **Missing Export Formats:** Analytics grids (like Top Transporters) cannot be exported independently of the main full-page PDF/Excel.
- **Missing Role-Based Access Control (RBAC):** The system lacks user authentication. Any user with the URL can trigger intensive scraping jobs or delete historical reports.

---

## 4. Data Accuracy Assessment
- **Calculations:** Percentage logic is generally robust due to the use of `Math.min(100, pct)` to cap over-lifting.
- **Pending Shops Issue:** The definition of a "Pending Shop" in MDM/ICDS relies on shop-level iteration. While recently patched for MDM, ICDS and Welfare arrays might still suffer from missing nested `shopsLeft` attributes in edge cases, requiring deep shop-level verification identical to the MDM patch.
- **Source Syncing:** The data strictly mirrors the upstream portals. However, no "Last Synced at Upstream" timestamp is provided by the portal, meaning users cannot definitively prove the exact hour the government portal was updated.

---

## 5. Export & Report Validation Summary
- **Excel Exports:** Generally highly accurate and cleanly styled via `exceljs`.
- **PDF Exports:** Prone to layout issues. Because `pdfmake` dynamically scales columns using `*` widths, extremely long shop names or transporter names can cause text wrapping that breaks vertical cell alignment across pages.
- **Naming Conventions:** Files are named sequentially (e.g., `Sector_Details...`), but lack a UUID in the user-facing filename, risking accidental overwrites on the user's local machine if downloaded multiple times.

---

## 6. UI/UX Consistency Findings
- **Hardcoded Endpoints:** The frontend relies on relative paths and some hardcoded assumptions about the host environment.
- **Lack of Cancellation:** Once a user clicks "Generate", there is no "Cancel" button on the UI to abort the Puppeteer job if they selected the wrong month.
- **Responsiveness:** The layout uses heavy CSS grid/flexbox but grid tables on mobile viewports require horizontal scrolling, which degrades the UX on mobile devices.

---

## 7. Risk Assessment
| Risk Category | Risk Level | Description |
|---|---|---|
| **Security** | High | Lack of Auth/RBAC exposes deletion endpoints to the public network. |
| **Availability** | Critical | Unbounded Puppeteer scraping can DDOS the host server. |
| **Integrity** | Low (New Data), High (Historical) | Historical non-NFSA reports remain vulnerable to aggressive NFSA restorer logic. |
| **Storage** | Medium | Orphaned files from deleted reports will eventually exhaust server storage. |

---

## 8. Performance Observations
- **Puppeteer Headless Mode:** Running multiple scrapers heavily taxes CPU. Headless mode mitigates some GPU overhead, but Chromium processes average 150-300MB RAM each.
- **Database Reads:** `db.getReports()` pulls the entire row, including the massive `raw_data` JSON string, for every report in the history table. This causes massive memory spikes when loading the History tab. The history endpoint should exclude `raw_data` until a specific report is clicked.

---

## 9. Recommended Implementation Roadmap

**Phase 1: Critical Stability (Next 48 Hours)**
- [ ] Implement a concurrency lock/queue in `server.js` (Max 2 active scrapers).
- [ ] Exclude `raw_data` from the `SELECT` query in `getReports()` for the history list.
- [ ] Update the `DELETE /api/reports/:id` endpoint to invoke `fs.unlinkSync()` on `filepath`.

**Phase 2: Data Integrity & UX (Next 1 Week)**
- [ ] Inject strict schema guard clauses in `reportRestorer.js`.
- [ ] Add network-failure `.catch()` logic to the UI polling interval.
- [ ] Implement an abort controller to allow users to cancel active report generation.

**Phase 3: Long-term Architecture (Next 1 Month)**
- [ ] Implement Basic Authentication or a token-based login.
- [ ] Optimize PDF column widths to prevent text wrapping misalignment.
- [ ] Add database indexing on `(scheme, month, year)`.
