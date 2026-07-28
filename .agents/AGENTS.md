
## Claude Sonnet 5 Preparation Workflow
**Trigger**: When the user explicitly requests to prepare a task for Claude (e.g., by saying "ok claude 5").

**Action**:
1. Analyze the task requirement properly.
2. Identify all relevant project files required for the task.
3. Create a new folder at "F:\AI Projects\Anti Gravity\Claude Analysis\<ProjectName>_<Date>_<TaskName>".
4. Copy all identified relevant files into this new folder. **IMPORTANT: Flatten the directory structure** (no sub-folders) for convenience so the user can easily drag and drop all files into Claude's web UI. Exclude node_modules, build folders, caches, and binaries.
5. Generate the following text files inside the folder using token-efficient formatting:
   - "claude_prompt.md": Clearly explain the objective, current vs expected behavior, relevant files, constraints, edge cases, and ask for a production-quality implementation without breaking existing functionality.
   - "context_summary.md": Brief context explaining the project/module and relevant workflow.
   - "implementation_notes.md": Dependency or implementation notes.
6. Present the folder path to the user when finished.

---

## Master Document Auto-Update Rule

**Trigger**: After EVERY substantive change to the PDS Lifting Report project — including bug fixes, new features, UI changes, server logic changes, analytics changes, config changes, or any modification to files under `f:\AI Projects\Anti Gravity\PDS lifting Report\`.

**Action**: Automatically update `f:\AI Projects\Anti Gravity\PDS lifting Report\PROJECT_DOCS.md` as follows:

1. **Change Log (Section 20)** — Add a new dated entry at the top of the log with:
   - Date, session type (Bug Fix / Feature / Improvement / Analysis)
   - Files changed
   - What was broken (ROOT CAUSE) and what was fixed (FIX), or what was added
   - Issue IDs opened or closed (e.g., "Closes: ISSUE-007")

2. **Known Issues Register (Section 19)** — Add new issues when discovered; mark issues as RESOLVED when fixed, and add the resolution date.

3. **Progress Tracker (Section 14)** — Update the Status and Verified columns for any feature touched. Change status to COMPLETE when done, update Verified to YES once confirmed working.

4. **Milestone Ledger (Section 15)** — Move milestones from "Upcoming" to "Completed" when achieved; add new upcoming milestones when planned.

5. **Pending Tasks (Section 16)** — Remove tasks when completed; add new tasks when identified.

6. **Watchlist (Section 17)** — Add items when a change introduces a regression risk; remove items when risk is mitigated.

7. **Verification Ledger (Section 18)** — Update test status (VERIFIED / PARTIAL / NOT VERIFIED) for all components touched.

8. **Quick Status Dashboard** — Update the "Last Code Change" and any counters (open issues, completed milestones) at the top of the document.

**Important**: This update must happen in the SAME response as the code change — not as a separate step. The document must always reflect the current state of the project.

