const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { promisify } = require('util');

/**
 * Database Manager
 * Handles SQLite database operations
 */
class DatabaseManager {
  constructor() {
    const dbDir = path.join(__dirname, '../../database');

    // Create database directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'pds-reports.db');
    const seedPath = path.join(dbDir, 'pds-seed.db');

    // Auto-seed database on fresh cloud instances or if pds-seed.db is newer
    if (fs.existsSync(seedPath)) {
      const isDbMissingOrEmpty = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0;
      let shouldSeed = isDbMissingOrEmpty;
      if (!shouldSeed && fs.existsSync(dbPath)) {
        try {
          const seedStat = fs.statSync(seedPath);
          const dbStat = fs.statSync(dbPath);
          if (seedStat.mtimeMs > dbStat.mtimeMs || process.env.FORCE_SEED === 'true') {
            shouldSeed = true;
          }
        } catch (e) {}
      }

      if (shouldSeed) {
        try {
          fs.copyFileSync(seedPath, dbPath);
          console.log('🌱 [Database] Auto-seeded/updated database from pds-seed.db');
        } catch (seedErr) {
          console.warn('⚠️ [Database] Failed to auto-seed database:', seedErr.message);
        }
      }
    }

    this.db = new sqlite3.Database(dbPath);
    this.initialized = false;
  }

  /**
   * Explicitly initialize database tables and return a promise
   */
  async init() {
    if (this.initialized) return;

    // Enable WAL mode for concurrency
    this.db.run('PRAGMA journal_mode = WAL;');

    // Custom promisified run to capture this.lastID and this.changes
    this.run = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    };

    // Standard promisification for get and all
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));

    await this.initializeTables();
    await this.seedSupervisionDataIfEmpty();
    this.initialized = true;
    console.log('✅ Database initialized and tables ready');
  }

  /**
   * Initialize database tables
   */
  async initializeTables() {
    // Reports table
    await this.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        ro_type TEXT,
        total_allocation REAL,
        total_dispatch REAL,
        total_pos_receipt REAL,
        dispatch_percentage REAL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_data TEXT
      )
    `);

    // Performance indexes for report history queries
    await this.run(`CREATE INDEX IF NOT EXISTS idx_reports_scheme_generated ON reports(scheme, generated_at DESC)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(month, year)`);

    // Portal users table (for application login)
    await this.run(`
      CREATE TABLE IF NOT EXISTS app_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Credentials table (encrypted - for external portal access)
    await this.run(`
      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Settings table
    await this.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Schedules table
    await this.run(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_type TEXT NOT NULL,
        cron_expression TEXT,
        enabled INTEGER DEFAULT 0,
        last_run DATETIME,
        next_run DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Email logs table
    await this.run(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER,
        recipient TEXT,
        subject TEXT,
        status TEXT,
        error_message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES reports(id)
      )
    `);

    // Directory table
    await this.run(`
      CREATE TABLE IF NOT EXISTS directory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Stock snapshots table (for District Health Score daily trend tracking)
    await this.run(`
      CREATE TABLE IF NOT EXISTS stock_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date TEXT NOT NULL UNIQUE,
        synced_at TEXT NOT NULL,
        health_score INTEGER NOT NULL,
        health_label TEXT,
        district_total_qt REAL,
        ic_data TEXT
      )
    `);

    // Supervision & Inspection module tables (Orders 3/1 & 3/2)
    await this.run(`
      CREATE TABLE IF NOT EXISTS supervision_inspections (
        id TEXT PRIMARY KEY,
        mode TEXT DEFAULT 'dm',
        issue_center TEXT NOT NULL,
        inspection_month TEXT,
        inspection_date TEXT NOT NULL,
        officer_name TEXT,
        officer_designation TEXT,
        officer_mobile TEXT,
        incharge_name TEXT,
        incharge_mobile TEXT,
        branch_manager TEXT,
        branch_manager_mobile TEXT,
        godowns_count INTEGER DEFAULT 0,
        compliance_score INTEGER DEFAULT 0,
        deficiencies_count INTEGER DEFAULT 0,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS supervision_surprise (
        id TEXT PRIMARY KEY,
        mode TEXT DEFAULT 'dm',
        issue_center TEXT NOT NULL,
        inspection_date TEXT NOT NULL,
        officer_name TEXT,
        officer_designation TEXT,
        score INTEGER DEFAULT 0,
        defects_count INTEGER DEFAULT 0,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS supervision_roster (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month TEXT NOT NULL,
        issue_center TEXT NOT NULL,
        target_godowns INTEGER DEFAULT 1,
        planned_date TEXT,
        completed_date TEXT,
        status TEXT DEFAULT 'pending',
        officer_name TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS supervision_meetings (
        id TEXT PRIMARY KEY,
        meeting_type TEXT NOT NULL,
        agency TEXT,
        meeting_date TEXT NOT NULL,
        chairperson TEXT,
        attendees TEXT,
        agenda_items TEXT,
        minutes TEXT,
        action_points TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rice Quality Analysis & Inspection (KMS 2025-26)
    await this.run(`
      CREATE TABLE IF NOT EXISTS supervision_rice_inspections (
        id TEXT PRIMARY KEY,
        warehouse_name TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        total_lots INTEGER DEFAULT 0,
        total_quantity_mt REAL DEFAULT 0,
        total_bags INTEGER DEFAULT 0,
        branch_manager TEXT,
        centre_incharge TEXT,
        district_manager TEXT,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`CREATE INDEX IF NOT EXISTS idx_superv_insp_date ON supervision_inspections(inspection_date DESC)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_superv_insp_ic ON supervision_inspections(issue_center)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_superv_roster_ym ON supervision_roster(year, month)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_superv_rice_date ON supervision_rice_inspections(analysis_date DESC)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_superv_rice_wh ON supervision_rice_inspections(warehouse_name)`);

    // Official Gmail Integration & Actionable Tasks Management
    await this.run(`
      CREATE TABLE IF NOT EXISTS official_email_accounts (
        id TEXT PRIMARY KEY,
        email_address TEXT NOT NULL UNIQUE,
        account_type TEXT DEFAULT 'gmail',
        display_name TEXT,
        encrypted_refresh_token TEXT NOT NULL,
        access_token TEXT,
        token_expires_at INTEGER,
        last_history_id TEXT,
        is_active INTEGER DEFAULT 1,
        connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS email_sync_logs (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        thread_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        sender_domain TEXT,
        recipient TEXT,
        subject TEXT,
        received_at DATETIME NOT NULL,
        has_attachments INTEGER DEFAULT 0,
        triage_status TEXT DEFAULT 'PENDING',
        triage_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS supervision_tasks (
        id TEXT PRIMARY KEY,
        sync_log_id TEXT,
        gmail_message_id TEXT NOT NULL,
        gmail_thread_id TEXT NOT NULL,
        letter_ref_no TEXT,
        letter_date TEXT,
        issuing_authority TEXT NOT NULL,
        department_category TEXT DEFAULT 'HO',
        subject TEXT NOT NULL,
        task_description TEXT NOT NULL,
        assigned_section TEXT DEFAULT 'PDS',
        responsible_person TEXT,
        priority TEXT DEFAULT 'MEDIUM',
        due_date DATETIME,
        suggested_timeline TEXT,
        deadline_type TEXT NOT NULL DEFAULT 'OFFICIAL_EXPLICIT',
        requires_confirmation INTEGER DEFAULT 0,
        status TEXT DEFAULT 'NEW',
        reporting_required INTEGER DEFAULT 0,
        reporting_details TEXT,
        completion_date DATETIME,
        compliance_remarks TEXT,
        source_email_url TEXT NOT NULL,
        is_test INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT,
        file_size_bytes INTEGER,
        local_storage_path TEXT NOT NULL,
        ocr_extracted_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS email_triage_rules (
        id TEXT PRIMARY KEY,
        rule_name TEXT NOT NULL,
        sender_pattern TEXT,
        keyword_match TEXT,
        assigned_priority TEXT DEFAULT 'HIGH',
        assigned_section TEXT DEFAULT 'PDS',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.run(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON supervision_tasks(due_date ASC)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON supervision_tasks(status)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_tasks_dept ON supervision_tasks(department_category)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_tasks_created ON supervision_tasks(created_at DESC)`);


    // Migration: add scheme and insights columns if they don't exist
    try {
      await this.run(`ALTER TABLE reports ADD COLUMN scheme TEXT DEFAULT 'nfsa'`);
      console.log('✅ DB Migration: added scheme column');
    } catch (e) {}

    try {
      await this.run(`ALTER TABLE reports ADD COLUMN insights TEXT`);
      console.log('✅ DB Migration: added insights column');
    } catch (e) {}

    try {
      await this.run(`ALTER TABLE reports ADD COLUMN from_date TEXT`);
      console.log('✅ DB Migration: added from_date column');
    } catch (e) {}

    try {
      await this.run(`ALTER TABLE reports ADD COLUMN to_date TEXT`);
      console.log('✅ DB Migration: added to_date column');
    } catch (e) {}

    // Migration: add is_test column to all supervision tables
    const supervTables = [
      'supervision_inspections',
      'supervision_surprise',
      'supervision_roster',
      'supervision_meetings',
      'supervision_rice_inspections'
    ];
    for (const tbl of supervTables) {
      try {
        await this.run(`ALTER TABLE ${tbl} ADD COLUMN is_test INTEGER DEFAULT 0`);
      } catch (e) {}
    }
  }

  /**
   * Save a generated report
   */
  async saveReport(reportData) {
    const generatedAt = reportData.generatedAt || new Date().toISOString();

    const result = await this.run(`
      INSERT INTO reports (
        month, year, filename, filepath, ro_type,
        total_allocation, total_dispatch, total_pos_receipt, dispatch_percentage,
        raw_data, generated_at, scheme, insights, from_date, to_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportData.month,
      reportData.year,
      reportData.filename,
      reportData.filepath,
      reportData.roType || 'All',
      reportData.totalAllocation || 0,
      reportData.totalDispatch || 0,
      reportData.totalPOSReceipt || 0,
      reportData.dispatchPercentage || 0,
      JSON.stringify(reportData.rawData || {}),
      generatedAt,
      reportData.scheme || 'nfsa',
      reportData.insights ? JSON.stringify(reportData.insights) : null,
      reportData.fromDate || null,
      reportData.toDate || null
    ]);

    return result?.lastID;
  }

  /**
   * Get report by ID
   */
  async getReport(id) {
    return await this.get('SELECT * FROM reports WHERE id = ?', [id]);
  }

  /**
   * Get all reports, sorted by most recent
   */
  async getAllReports(limit = 50, scheme = null) {
    const columns = 'id, month, year, filename, filepath, ro_type, total_allocation, total_dispatch, total_pos_receipt, dispatch_percentage, generated_at, scheme, from_date, to_date, insights';
    
    if (scheme === 'nfsa') {
      return await this.all(`
        SELECT ${columns} FROM reports
        WHERE scheme = 'nfsa'
        ORDER BY generated_at DESC
        LIMIT ?
      `, [limit]);
    } else if (scheme) {
      return await this.all(`
        SELECT ${columns} FROM reports
        WHERE scheme = ?
        ORDER BY generated_at DESC
        LIMIT ?
      `, [scheme, limit]);
    }
    return await this.all(`
      SELECT ${columns} FROM reports
      ORDER BY generated_at DESC
      LIMIT ?
    `, [limit]);
  }

  /**
   * Get reports for a specific month/year
   */
  async getReportsByMonthYear(month, year) {
    return await this.all(`
      SELECT * FROM reports 
      WHERE month = ? AND year = ? 
      ORDER BY generated_at DESC
    `, [month, year]);
  }

  /**
   * Delete a report
   */
  async deleteReport(id) {
    return await this.run('DELETE FROM reports WHERE id = ?', [id]);
  }

  /**
   * Save encrypted credentials
   */
  async saveCredentials(service, username, password) {
    const passwordHash = await bcrypt.hash(password, 10);

    return await this.run(`
      INSERT OR REPLACE INTO credentials (service, username, password_hash, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [service, username, passwordHash]);
  }

  /**
   * Get app user by username
   */
  async getAppUser(username) {
    return await this.get('SELECT * FROM app_users WHERE username = ? COLLATE NOCASE', [username]);
  }

  /**
   * Create a new portal user
   */
  async createAppUser(username, password, role = 'admin') {
    const passwordHash = await bcrypt.hash(password, 10);
    return await this.run(`
      INSERT OR IGNORE INTO app_users (username, password_hash, role)
      VALUES (?, ?, ?)
    `, [username, passwordHash, role]);
  }

  /**
   * Verify portal user login
   */
  async verifyAppUser(username, password) {
    const user = await this.getAppUser(username);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password_hash);
    return match ? user : null;
  }

  /**
   * Get credentials for a service
   */
  async getCredentials(service) {
    return await this.get(`
      SELECT username, password_hash FROM credentials WHERE service = ?
    `, [service]);
  }

  /**
   * Verify password
   */
  async verifyPassword(service, password) {
    const creds = await this.getCredentials(service);
    if (!creds) return false;

    return await bcrypt.compare(password, creds.password_hash);
  }

  /**
   * Save a setting
   */
  async saveSetting(key, value) {
    return await this.run(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [key, JSON.stringify(value)]);
  }

  /**
   * Get a setting
   */
  async getSetting(key) {
    const result = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? JSON.parse(result.value) : null;
  }

  /**
   * Log email sent
   */
  async logEmail(reportId, recipient, subject, status, errorMessage = null) {
    return await this.run(`
      INSERT INTO email_logs (report_id, recipient, subject, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `, [reportId, recipient, subject, status, errorMessage]);
  }

  /**
   * Get email logs with optional limit
   */
  async getEmailLogs(limit = 100) {
    try {
      return await this.all(`
        SELECT 
          e.id, e.report_id, e.recipient, e.subject, e.status, e.error_message, e.sent_at,
          r.filename, r.scheme
        FROM email_logs e
        LEFT JOIN reports r ON e.report_id = r.id
        ORDER BY e.sent_at DESC
        LIMIT ?
      `, [limit]);
    } catch (err) {
      console.error('Error fetching email logs:', err.message);
      return [];
    }
  }

  /**
   * Clear all email logs
   */
  async clearEmailLogs() {
    try {
      return await this.run('DELETE FROM email_logs');
    } catch (err) {
      console.error('Error clearing email logs:', err.message);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const totalReports = await this.get('SELECT COUNT(*) as count FROM reports');
      const totalSchedules = await this.get('SELECT COUNT(*) as count FROM schedules');
      const totalEmails = await this.get('SELECT COUNT(*) as count FROM email_logs');

      return {
        totalReports: totalReports ? totalReports.count : 0,
        totalSchedules: totalSchedules ? totalSchedules.count : 0,
        totalEmails: totalEmails ? totalEmails.count : 0
      };
    } catch (e) {
      console.error('📊 Stats fetch failed:', e.message);
      return { totalReports: 0, totalSchedules: 0, totalEmails: 0 };
    }
  }

  /**
   * Check if database is healthy and not locked
   */
  async checkHealth() {
    try {
      // Try a simple write-read test
      await this.run('CREATE TABLE IF NOT EXISTS health_check (id INTEGER PRIMARY KEY, ts DATETIME)');
      await this.run('INSERT INTO health_check (ts) VALUES (CURRENT_TIMESTAMP)');
      const res = await this.get('SELECT ts FROM health_check ORDER BY id DESC LIMIT 1');
      if (!res) throw new Error('Health check returned no data');
      return { healthy: true };
    } catch (err) {
      console.error('🚨 Database Health Check FAILED:', err.message);
      return { healthy: false, error: err.message };
    }
  }

  /**
   * Clean up old reports (archive)
   */
  async archiveOldReports(daysOld = 180) {
    const result = await this.run(`
      DELETE FROM reports 
      WHERE generated_at < datetime('now', '-' || ? || ' days')
    `, [daysOld]);

    return result?.changes || 0;
  }

  /**
   * Get directory records by type
   */
  async getDirRecords(type) {
    const rows = await this.all('SELECT data FROM directory WHERE type = ?', [type]);
    return rows.map(r => JSON.parse(r.data));
  }

  /**
   * Save a directory record
   */
  async saveDirRecord(id, type, data) {
    return await this.run(
      `INSERT INTO directory (id, type, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
      [id, type, JSON.stringify(data)]
    );
  }

  /**
   * Delete a directory record
   */
  async deleteDirRecord(id) {
    return await this.run('DELETE FROM directory WHERE id = ?', [id]);
  }

  /**
   * Save or update a stock snapshot by snapshot_date (upsert)
   */
  async saveStockSnapshot(data) {
    const syncedAt = data.syncedAt || new Date().toISOString();
    const snapshotDate = data.snapshotDate;
    const healthScore = parseInt(data.healthScore ?? data.score, 10) || 0;
    const healthLabel = data.healthLabel || data.label || '';
    const districtTotalQt = parseFloat(data.districtTotalQt ?? data.districtTotal) || 0;
    const icData = typeof data.icData === 'string' ? data.icData : JSON.stringify(data.icData || []);

    return await this.run(`
      INSERT INTO stock_snapshots (
        snapshot_date, synced_at, health_score, health_label, district_total_qt, ic_data
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_date) DO UPDATE SET
        synced_at = excluded.synced_at,
        health_score = excluded.health_score,
        health_label = excluded.health_label,
        district_total_qt = excluded.district_total_qt,
        ic_data = excluded.ic_data
    `, [snapshotDate, syncedAt, healthScore, healthLabel, districtTotalQt, icData]);
  }

  /**
   * Get recent stock snapshots ordered by snapshot_date DESC
   */
  async getStockSnapshotHistory(limit = 2) {
    const lim = Math.max(1, parseInt(limit, 10) || 2);
    const rows = await this.all(`
      SELECT * FROM stock_snapshots
      ORDER BY snapshot_date DESC
      LIMIT ?
    `, [lim]);
    return rows || [];
  }

  /* ═════════════════════════════════════════════════════════
   * SUPERVISION & INSPECTION MODULE METHODS (Orders 3/1 & 3/2)
   * ═════════════════════════════════════════════════════════ */

  /**
   * Save detailed inspection report (Insert or Upsert)
   */
  async saveSupervisionInspection(data) {
    const id = data.id || ('INSP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const isTest = (data.is_test || data.isTest || (id && (id.startsWith('TEST_') || id.startsWith('DUMMY_')))) ? 1 : 0;
    const mode = data.mode || 'dm';
    const issueCenter = data.issueCenter || data.issue_center || '';
    const inspectionMonth = data.inspectionMonth || data.inspection_month || '';
    const inspectionDate = data.inspectionDate || data.inspection_date || new Date().toISOString().split('T')[0];
    const officerName = data.officerName || data.officer_name || '';
    const officerDesignation = data.officerDesignation || data.officer_designation || '';
    const officerMobile = data.officerMobile || data.officer_mobile || '';
    const inchargeName = data.inchargeName || data.incharge_name || '';
    const inchargeMobile = data.inchargeMobile || data.incharge_mobile || '';
    const branchManager = data.branchManager || data.branch_manager || '';
    const branchManagerMobile = data.branchManagerMobile || data.branch_manager_mobile || '';
    const godownsCount = parseInt(data.godownsCount || data.godowns_count || 0, 10);
    const complianceScore = parseInt(data.complianceScore || data.compliance_score || 0, 10);
    const deficienciesCount = parseInt(data.deficienciesCount || data.deficiencies_count || 0, 10);
    const payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || data);

    await this.run(`
      INSERT INTO supervision_inspections (
        id, mode, issue_center, inspection_month, inspection_date,
        officer_name, officer_designation, officer_mobile,
        incharge_name, incharge_mobile, branch_manager, branch_manager_mobile,
        godowns_count, compliance_score, deficiencies_count, payload, is_test, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        issue_center = excluded.issue_center,
        inspection_month = excluded.inspection_month,
        inspection_date = excluded.inspection_date,
        officer_name = excluded.officer_name,
        officer_designation = excluded.officer_designation,
        officer_mobile = excluded.officer_mobile,
        incharge_name = excluded.incharge_name,
        incharge_mobile = excluded.incharge_mobile,
        branch_manager = excluded.branch_manager,
        branch_manager_mobile = excluded.branch_manager_mobile,
        godowns_count = excluded.godowns_count,
        compliance_score = excluded.compliance_score,
        deficiencies_count = excluded.deficiencies_count,
        payload = excluded.payload,
        is_test = excluded.is_test,
        updated_at = CURRENT_TIMESTAMP
    `, [
      id, mode, issueCenter, inspectionMonth, inspectionDate,
      officerName, officerDesignation, officerMobile,
      inchargeName, inchargeMobile, branchManager, branchManagerMobile,
      godownsCount, complianceScore, deficienciesCount, payload, isTest
    ]);

    return { success: true, id };
  }

  /**
   * Get all detailed inspection reports
   */
  async getSupervisionInspections(options = {}) {
    let sql = 'SELECT * FROM supervision_inspections WHERE 1=1';
    const params = [];

    if (options.mode) {
      sql += ' AND mode = ?';
      params.push(options.mode);
    }
    if (options.issueCenter) {
      sql += ' AND issue_center = ?';
      params.push(options.issueCenter);
    }
    if (options.month) {
      sql += ' AND inspection_month = ?';
      params.push(options.month);
    }

    sql += ' ORDER BY inspection_date DESC, created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(options.limit, 10));
    }

    const rows = await this.all(sql, params);
    return rows.map(r => ({
      ...r,
      payload: JSON.parse(r.payload || '{}')
    }));
  }

  /**
   * Get single inspection by ID
   */
  async getSupervisionInspectionById(id) {
    const row = await this.get('SELECT * FROM supervision_inspections WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      payload: JSON.parse(row.payload || '{}')
    };
  }

  /**
   * Delete inspection by ID
   */
  async deleteSupervisionInspection(id) {
    return await this.run('DELETE FROM supervision_inspections WHERE id = ?', [id]);
  }

  /**
   * Save surprise inspection
   */
  async saveSurpriseInspection(data) {
    const id = data.id || ('SURP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const isTest = (data.is_test || data.isTest || (id && (id.startsWith('TEST_') || id.startsWith('DUMMY_')))) ? 1 : 0;
    const mode = data.mode || 'dm';
    const issueCenter = data.issueCenter || data.issue_center || '';
    const inspectionDate = data.inspectionDate || data.inspection_date || new Date().toISOString().split('T')[0];
    const officerName = data.officerName || data.officer_name || '';
    const officerDesignation = data.officerDesignation || data.officer_designation || '';
    const score = parseInt(data.score || 0, 10);
    const defectsCount = parseInt(data.defectsCount || data.deficienciesCount || data.defects_count || 0, 10);
    const payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || data);

    await this.run(`
      INSERT INTO supervision_surprise (
        id, mode, issue_center, inspection_date, officer_name, officer_designation, score, defects_count, payload, is_test
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        issue_center = excluded.issue_center,
        inspection_date = excluded.inspection_date,
        officer_name = excluded.officer_name,
        officer_designation = excluded.officer_designation,
        score = excluded.score,
        defects_count = excluded.defects_count,
        payload = excluded.payload,
        is_test = excluded.is_test
    `, [id, mode, issueCenter, inspectionDate, officerName, officerDesignation, score, defectsCount, payload, isTest]);

    return { success: true, id };
  }

  /**
   * Get surprise inspections
   */
  async getSurpriseInspections(limit = 50) {
    const rows = await this.all(`
      SELECT * FROM supervision_surprise
      ORDER BY inspection_date DESC, created_at DESC
      LIMIT ?
    `, [parseInt(limit, 10) || 50]);

    return rows.map(r => ({
      ...r,
      payload: JSON.parse(r.payload || '{}')
    }));
  }

  /**
   * Get single surprise inspection by ID
   */
  async getSurpriseInspectionById(id) {
    const row = await this.get('SELECT * FROM supervision_surprise WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      payload: JSON.parse(row.payload || '{}')
    };
  }

  /**
   * Delete surprise inspection
   */
  async deleteSurpriseInspection(id) {
    return await this.run('DELETE FROM supervision_surprise WHERE id = ?', [id]);
  }

  /**
   * Get Roster items by year
   */
  async getRoster(year = 2026) {
    const rows = await this.all(`
      SELECT * FROM supervision_roster
      WHERE year = ?
      ORDER BY 
        CASE month
          WHEN 'April' THEN 1 WHEN 'May' THEN 2 WHEN 'June' THEN 3
          WHEN 'July' THEN 4 WHEN 'August' THEN 5 WHEN 'September' THEN 6
          WHEN 'October' THEN 7 WHEN 'November' THEN 8 WHEN 'December' THEN 9
          WHEN 'January' THEN 10 WHEN 'February' THEN 11 WHEN 'March' THEN 12
          ELSE 13
        END, issue_center ASC
    `, [parseInt(year, 10) || 2026]);

    return rows || [];
  }

  /**
   * Save or Update Roster Item
   */
  async saveRosterItem(data) {
    const id = data.id || ('ROST_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const isTest = (data.is_test || data.isTest || (id && (id.startsWith('TEST_') || id.startsWith('DUMMY_')))) ? 1 : 0;
    const year = parseInt(data.year, 10) || 2026;
    const month = data.month || 'October';
    const issueCenter = data.issueCenter || data.issue_center || '';
    const targetGodowns = parseInt(data.targetGodowns || data.target_godowns || 1, 10);
    const plannedDate = data.plannedDate || data.planned_date || '';
    const completedDate = data.completedDate || data.completed_date || '';
    const status = data.status || 'pending';
    const officerName = data.officerName || data.officer_name || '';
    const remarks = data.remarks || '';

    await this.run(`
      INSERT INTO supervision_roster (
        id, year, month, issue_center, target_godowns, planned_date, completed_date, status, officer_name, remarks, is_test, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        year = excluded.year,
        month = excluded.month,
        issue_center = excluded.issue_center,
        target_godowns = excluded.target_godowns,
        planned_date = excluded.planned_date,
        completed_date = excluded.completed_date,
        status = excluded.status,
        officer_name = excluded.officer_name,
        remarks = excluded.remarks,
        is_test = excluded.is_test,
        updated_at = CURRENT_TIMESTAMP
    `, [id, year, month, issueCenter, targetGodowns, plannedDate, completedDate, status, officerName, remarks, isTest]);

    return { success: true, id };
  }

  /**
   * Delete Roster Item
   */
  async deleteRosterItem(id) {
    return await this.run('DELETE FROM supervision_roster WHERE id = ?', [id]);
  }

  _safeJson(val, fallback = []) {
    if (!val) return fallback;
    if (typeof val !== 'string') return val;
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }

  /**
   * Get Supervision Meetings
   */
  async getSupervisionMeetings(type = null) {
    let sql = 'SELECT * FROM supervision_meetings';
    const params = [];
    if (type) {
      sql += ' WHERE meeting_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY meeting_date DESC, created_at DESC';

    const rows = await this.all(sql, params);
    return rows.map(r => ({
      ...r,
      agenda_items: this._safeJson(r.agenda_items, []),
      action_points: this._safeJson(r.action_points, [])
    }));
  }

  /**
   * Save Supervision Meeting
   */
  async saveSupervisionMeeting(data) {
    const id = data.id || ('MEET_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const isTest = (data.is_test || data.isTest || (id && (id.startsWith('TEST_') || id.startsWith('DUMMY_')))) ? 1 : 0;
    const meetingType = data.meetingType || data.meeting_type || 'coordination';
    const agency = data.agency || '';
    const meetingDate = data.meetingDate || data.meeting_date || new Date().toISOString().split('T')[0];
    const chairperson = data.chairperson || '';
    const attendees = data.attendees || '';
    const agendaItems = typeof data.agendaItems === 'string' ? data.agendaItems : JSON.stringify(data.agendaItems || data.agenda_items || []);
    const minutes = data.minutes || '';
    const actionPoints = typeof data.actionPoints === 'string' ? data.actionPoints : JSON.stringify(data.actionPoints || data.action_points || []);

    await this.run(`
      INSERT INTO supervision_meetings (
        id, meeting_type, agency, meeting_date, chairperson, attendees, agenda_items, minutes, action_points, is_test
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        meeting_type = excluded.meeting_type,
        agency = excluded.agency,
        meeting_date = excluded.meeting_date,
        chairperson = excluded.chairperson,
        attendees = excluded.attendees,
        agenda_items = excluded.agenda_items,
        minutes = excluded.minutes,
        action_points = excluded.action_points,
        is_test = excluded.is_test
    `, [id, meetingType, agency, meetingDate, chairperson, attendees, agendaItems, minutes, actionPoints, isTest]);

    return { success: true, id };
  }

  /**
   * Get single Supervision Meeting by ID
   */
  async getSupervisionMeetingById(id) {
    const row = await this.get('SELECT * FROM supervision_meetings WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      agenda_items: this._safeJson(row.agenda_items, []),
      action_points: this._safeJson(row.action_points, [])
    };
  }

  /**
   * Delete Supervision Meeting by ID
   */
  async deleteSupervisionMeeting(id) {
    return await this.run('DELETE FROM supervision_meetings WHERE id = ?', [id]);
  }

  /**
   * Get Supervision KPI Stats
   */
  async getSupervisionStats() {
    try {
      const now = new Date();
      const currentMonth = now.toLocaleString('en-US', { month: 'long' });
      const currentYear = now.getFullYear();

      const inspTotal = await this.get('SELECT COUNT(*) as count, AVG(compliance_score) as avgScore FROM supervision_inspections');
      const inspThisMonth = await this.get('SELECT COUNT(*) as count FROM supervision_inspections WHERE strftime("%Y-%m", inspection_date) = strftime("%Y-%m", "now")');
      const surpTotal = await this.get('SELECT COUNT(*) as count FROM supervision_surprise');
      const rosterStats = await this.get(`
        SELECT 
          COUNT(*) as totalRoster,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedRoster,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingRoster
        FROM supervision_roster WHERE year = ?
      `, [currentYear]);

      const meetingsCount = await this.get('SELECT COUNT(*) as count FROM supervision_meetings');
      const riceCount = await this.get('SELECT COUNT(*) as count FROM supervision_rice_inspections');

      const avgScore = Math.round(inspTotal?.avgScore || 0);
      const totalInsp = inspTotal?.count || 0;
      const totalSurp = surpTotal?.count || 0;

      return {
        totalInspections: totalInsp,
        inspectionsCompleted: totalInsp,
        averageComplianceScore: avgScore,
        avgComplianceScore: avgScore,
        inspectionsThisMonth: inspThisMonth?.count || 0,
        totalSurpriseVisits: totalSurp,
        surpriseVisitsCompleted: totalSurp,
        totalRosterPlanned: rosterStats?.totalRoster || 0,
        rosterCompleted: rosterStats?.completedRoster || 0,
        rosterPending: rosterStats?.pendingRoster || 0,
        totalMeetingsRecorded: meetingsCount?.count || 0,
        meetingsRecorded: meetingsCount?.count || 0,
        riceInspectionsCount: riceCount?.count || 0,
        activeDistrict: 'Betul',
        headquartersOrder: 'Order 3/1 (DM) & 3/2 (RM)'
      };
    } catch (err) {
      console.error('Supervision stats error:', err);
      return { totalInspections: 0, averageComplianceScore: 0, rosterCompleted: 0, rosterPending: 0 };
    }
  }

  /**
   * Auto-seed supervision roster and demo data if empty
   */
  async seedSupervisionDataIfEmpty() {
    try {
      const countRow = await this.get('SELECT COUNT(*) as c FROM supervision_roster');
      if (countRow && countRow.c > 0) return;

      console.log('🌱 Seeding initial Supervision & Inspection Roster for Betul District (KMS 2025-26 / 2026-27)...');
      const issueCenters = [
        'Betul', 'Multai', 'Bhainsdehi', 'Athner', 'Shahpur', 
        'Chicholi', 'Ghoradongri', 'Amla', 'Pattan', 'Bhimpur'
      ];
      const months = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
      const officers = ['District Manager (DM)', 'Manager (Finance)', 'Quality Control Officer', 'Assistant Manager (PDS)'];

      let idx = 0;
      for (const m of months) {
        // Schedule 2-3 issue centers per month as per Order 3/1 (at least 1 IC + all godowns, twice a year)
        const ic1 = issueCenters[idx % issueCenters.length];
        const ic2 = issueCenters[(idx + 1) % issueCenters.length];
        idx = (idx + 2) % issueCenters.length;

        const isPast = ['April', 'May', 'June', 'July', 'August', 'September'].includes(m);
        const day1 = isPast ? '14' : '15';
        const day2 = isPast ? '28' : '26';
        const ym = (isPast ? '2026-' : '2026-') + (months.indexOf(m) + 1).toString().padStart(2, '0');

        await this.saveRosterItem({
          id: `ROST_2026_${m}_${ic1}`,
          year: 2026,
          month: m,
          issueCenter: ic1,
          targetGodowns: 3,
          plannedDate: `${ym}-${day1}`,
          completedDate: isPast ? `${ym}-${day1}` : '',
          status: isPast ? 'completed' : 'pending',
          officerName: officers[0],
          remarks: isPast ? 'निरीक्षण संपन्न, प्रतिवेदन संधारित।' : 'वार्षिक कार्यक्रमानुसार प्रस्तावित।'
        });

        await this.saveRosterItem({
          id: `ROST_2026_${m}_${ic2}`,
          year: 2026,
          month: m,
          issueCenter: ic2,
          targetGodowns: 2,
          plannedDate: `${ym}-${day2}`,
          completedDate: isPast ? `${ym}-${day2}` : '',
          status: isPast ? 'completed' : 'pending',
          officerName: officers[1],
          remarks: isPast ? 'सत्यापन पूर्ण, स्कंध स्थिति संतोषप्रद।' : 'प्रस्तावित रोस्टर निरीक्षण।'
        });
      }

      // Seed one realistic completed detailed inspection report
      await this.saveSupervisionInspection({
        id: 'INSP_BETUL_DEMO_01',
        mode: 'dm',
        issueCenter: 'Betul',
        inspectionMonth: 'September',
        inspectionDate: '2026-09-22',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        officerMobile: '9425000000',
        inchargeName: 'R. K. Sharma',
        inchargeMobile: '9826100001',
        branchManager: 'A. K. Verma (MPWLC)',
        branchManagerMobile: '9425100002',
        godownsCount: 4,
        complianceScore: 94,
        deficienciesCount: 1,
        payload: {
          reservation: {
            wheat: 3500,
            rice: 1800,
            sugar: 120,
            salt: 95,
            other: 0
          },
          stock: [
            { commodity: 'गेहूं (Wheat)', soundBags: 6800, soundQty: 3400.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 12, sweepageQty: 5.40 },
            { commodity: 'चावल (Rice)', soundBags: 3550, soundQty: 1775.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 8, sweepageQty: 3.60 },
            { commodity: 'शक्कर (Sugar)', soundBags: 230, soundQty: 115.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 0, sweepageQty: 0.00 },
            { commodity: 'नमक (Salt)', soundBags: 190, soundQty: 95.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 0, sweepageQty: 0.00 }
          ],
          gunnyBags: {
            juteNew: { usableBales: 15, usableBags: 7500, unusableBags: 20 },
            hdpe: { usableBales: 22, usableBags: 11000, unusableBags: 45 },
            juteOld: { usableBales: 5, usableBags: 2500, unusableBags: 110 }
          },
          doorstepDelivery: {
            wheatLifted: 3380.00,
            riceLifted: 1750.00,
            sugarLifted: 112.50,
            saltLifted: 94.00,
            fpsDeliveredCount: 84,
            transporterReceiptDate: '2026-09-20',
            receiptSentToDO: '2026-09-21',
            enteredInSoftwareDate: '2026-09-22'
          },
          checkpoints: {
            chk_1_computer: true,
            chk_2_printer: true,
            chk_3_ups: true,
            chk_4_internet: true,
            chk_5_deo_format: true,
            chk_6_doorstep_receipts: true,
            chk_7_stock_quality: true,
            chk_8_stack_criteria: true,
            chk_9_stack_cards: true,
            chk_10_sweepage_handling: false, // 1 deficiency
            chk_11_records_reconciliation: true,
            chk_12_stack_killing: true,
            chk_13_loss_gain_cert: true,
            chk_14_damaged_dcc: true,
            chk_15_transport_order: true,
            chk_16_fumigation_schedule: true
          },
          issuesAndSuggestions: [
            { issue: 'स्वीपेज स्कंध (12 बोरे गेहूं + 8 बोरे चावल) पृथक सुरक्षित रूप से विनिर्मित स्टेक में रखा गया है किंतु छंटाई एवं अपग्रेडेशन शेष है।', suggestion: '3 दिवस में छंटाई पूर्ण कर अपग्रेडेशन अथवा निस्तारण प्रस्ताव मुख्यालय को प्रेषित करें।' }
          ],
          remarks: 'प्रदाय केन्द्र का कार्य सुव्यवस्थित है। द्वार प्रदाय योजना का उठाव 98% पूर्ण।'
        }
      });

      // Seed surprise visit
      await this.saveSurpriseInspection({
        id: 'SURP_BETUL_DEMO_01',
        mode: 'dm',
        issueCenter: 'Multai',
        inspectionDate: '2026-09-25',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        score: 90,
        defectsCount: 1,
        payload: {
          points: [
            { id: 1, label: 'आवंटन के मान से विभिन्न जिंस की उपलब्धता', compliant: true, remark: 'पर्याप्त बफर उपलब्ध' },
            { id: 2, label: 'स्थान उपलब्धता की स्थिति', compliant: true, remark: '350 MT अतिरिक्त रिक्त स्थान' },
            { id: 3, label: 'हार्डवेयर / सॉफ्टवेयर संचालन एवं प्रविष्टि स्थिति', compliant: true, remark: 'CSMS अद्यतन' },
            { id: 4, label: 'भंडारित स्कंध के रख-रखाव की स्थिति', compliant: true, remark: 'दिवारों से 1 मीटर अंतर मानक अनुसार' },
            { id: 5, label: 'स्वीपेज / क्षतिग्रस्त स्टाक की समीक्षा', compliant: false, remark: '5 बोरे स्वीपेज पृथक किए जाने हेतु निर्देशित' },
            { id: 6, label: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर', compliant: true, remark: 'गत धूमीकरण 12-09-2026' },
            { id: 7, label: 'द्वार प्रदाय योजना पावतियों की सॉफ्टवेयर में प्रविष्टि', compliant: true, remark: 'शत-प्रतिशत प्रविष्ट' },
            { id: 8, label: 'केन्द्रवार डीडी / देयक जिला कार्यालय प्रेषित स्थिति', compliant: true, remark: 'पावतियां प्रेषित' },
            { id: 9, label: 'FIFO (प्रथम आगम प्रथम निर्गम) पद्धति पालन', compliant: true, remark: 'FIFO का पूर्ण पालन' },
            { id: 10, label: 'केन्द्र प्रभारी / ऑपरेटर की उपस्थिति', compliant: true, remark: 'उपस्थित' }
          ],
          overallRemark: 'औचक निरीक्षण में व्यवस्थाएं संतोषप्रद पाई गईं।'
        }
      });

      // Seed coordination meeting agenda
      await this.saveSupervisionMeeting({
        id: 'MEET_COORD_MPWLC_01',
        meetingType: 'coordination',
        agency: 'MPWLC',
        meetingDate: '2026-09-18',
        chairperson: 'District Manager, MPSCSC Betul',
        attendees: 'Branch Managers MPWLC Betul, Multai, Athner, AM (Storage) MPSCSC',
        agendaItems: [
          'हार्डवेयर / आपरेटर्स के माध्यम से कम्प्यूटराईज्ड कार्य संपादन',
          'साविप्र भण्डारण हेतु स्थान उपलब्धता एवं स्कंध निकासी क्रम',
          'वैज्ञानिक भंडारण एवं गुणवत्ता स्थिति (धूमीकरण/कीटनाशक)',
          'स्टेक किल करने में आ रही कठिनाईयां एवं 1% से कम आधिक्य/कमी दावों का निराकरण',
          'भंडारण शुल्क देयकों का भुगतान एवं मिलान'
        ],
        minutes: 'म.प्र. वेयरहाउसिंग कार्पोरेशन के सभी शाखा प्रबंधकों के साथ विस्तृत समीक्षा की गई। धूमीकरण प्रमाण पत्र 25 तारीख तक अनिवार्य रूप से प्रस्तुत करने के निर्देश दिए गए।',
        actionPoints: [
          'मुलताई शाखा 3 दिन में स्टेक लॉस-गेन प्रमाण पत्र उपलब्ध कराएगी।',
          'बैतूल शाखा रिक्त 500 MT क्षमता का आवंटन साविप्र चावल भंडारण हेतु सुरक्षित रखेगी।'
        ]
      });

      // Seed Rice Quality Inspection (KMS 2025-26) Demo Record
      await this.saveRiceInspection({
        id: 'INSP_RICE_KMS_2025_26_01',
        warehouseName: 'MPWLC Warehouse Betul (Kosmi)',
        analysisDate: '2026-09-28',
        branchManager: 'MPWLC Betul',
        centreIncharge: 'MPSCSC Betul',
        districtManager: 'MPSCSC बैतूल',
        lots: [
          {
            sno: 1,
            millerName: 'M/s Jai Kisan Rice Mill, Betul',
            stackNo: 'S-04',
            lotNo: 'LOT-25/101',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: '2026-09-26',
            brokenSmall: 0.80,
            brokenBig: 18.20,
            brokenTotal: 19.00,
            fmInorg: 0.10,
            fmOrg: 0.20,
            fmTotal: 0.30,
            damaged: 2.10,
            admixture: 3.50,
            redKernels: 1.20,
            chalky: 3.00,
            discoloured: 2.00,
            dehusked: 8.50,
            frk: 0.98,
            testResult: 'Positive (1.0% FRK)',
            result: 'Within Specification'
          },
          {
            sno: 2,
            millerName: 'M/s Shri Ram Agro Industries, Multai',
            stackNo: 'S-05',
            lotNo: 'LOT-25/102',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: '2026-09-26',
            brokenSmall: 0.90,
            brokenBig: 20.10,
            brokenTotal: 21.00,
            fmInorg: 0.15,
            fmOrg: 0.25,
            fmTotal: 0.40,
            damaged: 2.80,
            admixture: 4.20,
            redKernels: 1.80,
            chalky: 3.80,
            discoloured: 2.50,
            dehusked: 9.20,
            frk: 1.02,
            testResult: 'Positive (1.0% FRK)',
            result: 'Within Specification'
          },
          {
            sno: 3,
            millerName: 'M/s Mahaveer Food Products, Amla',
            stackNo: 'S-06',
            lotNo: 'LOT-25/103',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: '2026-09-27',
            brokenSmall: 1.20,
            brokenBig: 23.50,
            brokenTotal: 24.70,
            fmInorg: 0.18,
            fmOrg: 0.30,
            fmTotal: 0.48,
            damaged: 3.90,
            admixture: 5.50,
            redKernels: 2.50,
            chalky: 4.80,
            discoloured: 3.20,
            dehusked: 11.00,
            frk: 0.95,
            testResult: 'Positive (0.95% FRK)',
            result: 'BRL'
          },
          {
            sno: 4,
            millerName: 'M/s Betul Modern Rice Mill',
            stackNo: 'S-07',
            lotNo: 'LOT-25/104',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: '2026-09-27',
            brokenSmall: 0.70,
            brokenBig: 17.50,
            brokenTotal: 18.20,
            fmInorg: 0.08,
            fmOrg: 0.15,
            fmTotal: 0.23,
            damaged: 1.80,
            admixture: 3.00,
            redKernels: 1.00,
            chalky: 2.50,
            discoloured: 1.50,
            dehusked: 7.80,
            frk: 1.00,
            testResult: 'Positive (1.0% FRK)',
            result: 'Within Specification'
          },
          {
            sno: 5,
            millerName: 'M/s Satpura Agro Mills, Shahpur',
            stackNo: 'S-08',
            lotNo: 'LOT-25/105',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: '2026-09-28',
            brokenSmall: 0.85,
            brokenBig: 19.00,
            brokenTotal: 19.85,
            fmInorg: 0.12,
            fmOrg: 0.22,
            fmTotal: 0.34,
            damaged: 2.40,
            admixture: 3.80,
            redKernels: 1.40,
            chalky: 3.20,
            discoloured: 2.10,
            dehusked: 8.90,
            frk: 1.05,
            testResult: 'Positive (1.05% FRK)',
            result: 'Within Specification'
          },
          {
            sno: 6,
            millerName: 'M/s Narmada Grain Processing, Multai',
            stackNo: 'S-09',
            lotNo: 'LOT-25/106',
            quantityMt: 29.00,
            noOfBags: 580,
            receiptDate: '2026-09-28',
            brokenSmall: 0.75,
            brokenBig: 18.00,
            brokenTotal: 18.75,
            fmInorg: 0.10,
            fmOrg: 0.18,
            fmTotal: 0.28,
            damaged: 2.00,
            admixture: 3.20,
            redKernels: 1.10,
            chalky: 2.80,
            discoloured: 1.80,
            dehusked: 8.10,
            frk: 1.00,
            testResult: 'Positive (1.0% FRK)',
            result: 'Within Specification'
          }
        ]
      });

      console.log('✅ Supervision initial data seeded successfully.');
    } catch (err) {
      console.warn('⚠️ Supervision seed failed:', err.message);
    }
  }

  /* ═════════════════════════════════════════════════════════
   * RICE QUALITY INSPECTION (KMS 2025-26) METHODS
   * ═════════════════════════════════════════════════════════ */

  /**
   * Save or Update Rice Quality Inspection Sheet
   */
  async saveRiceInspection(data) {
    const id = data.id || ('RICE_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const isTest = (data.is_test || data.isTest || (id && (id.startsWith('TEST_') || id.startsWith('DUMMY_')))) ? 1 : 0;
    const warehouseName = data.warehouseName || data.warehouse_name || '';
    const analysisDate = data.analysisDate || data.analysis_date || new Date().toISOString().split('T')[0];
    const branchManager = data.branchManager || data.branch_manager || 'MPWLC ....................';
    const centreIncharge = data.centreIncharge || data.centre_incharge || 'MPSCSC ....................';
    const districtManager = data.districtManager || data.district_manager || 'MPSCSC बैतूल';

    const lots = data.lots || data.payload?.lots || [];
    const totalLots = lots.length;
    let totalQty = 0;
    let totalBags = 0;

    lots.forEach(l => {
      totalQty += parseFloat(l.quantityMt || l.quantity_mt || 0);
      totalBags += parseInt(l.noOfBags || l.no_of_bags || 0, 10);
    });

    const payload = typeof data.payload === 'string' ? data.payload : JSON.stringify({
      warehouseName,
      analysisDate,
      branchManager,
      centreIncharge,
      districtManager,
      lots
    });

    await this.run(`
      INSERT INTO supervision_rice_inspections (
        id, warehouse_name, analysis_date, total_lots, total_quantity_mt, total_bags,
        branch_manager, centre_incharge, district_manager, payload, is_test, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        warehouse_name = excluded.warehouse_name,
        analysis_date = excluded.analysis_date,
        total_lots = excluded.total_lots,
        total_quantity_mt = excluded.total_quantity_mt,
        total_bags = excluded.total_bags,
        branch_manager = excluded.branch_manager,
        centre_incharge = excluded.centre_incharge,
        district_manager = excluded.district_manager,
        payload = excluded.payload,
        is_test = excluded.is_test,
        updated_at = CURRENT_TIMESTAMP
    `, [id, warehouseName, analysisDate, totalLots, totalQty, totalBags, branchManager, centreIncharge, districtManager, payload, isTest]);

    return { success: true, id };
  }

  /**
   * Get all Rice Quality Inspection Sheets
   */
  async getRiceInspections(limit = 50) {
    const rows = await this.all(`
      SELECT * FROM supervision_rice_inspections
      ORDER BY analysis_date DESC, created_at DESC
      LIMIT ?
    `, [parseInt(limit, 10) || 50]);

    return rows.map(r => {
      const payload = JSON.parse(r.payload || '{}');
      const lots = payload.lots || [];
      const hasRejected = lots.some(l => (l.result || '').toUpperCase().includes('REJECT') || (l.result || '').toUpperCase().includes('BEYOND'));
      return {
        ...r,
        payload,
        overall_result: hasRejected ? 'REJECTED' : 'PASSED'
      };
    });
  }

  /**
   * Get single Rice Quality Inspection Sheet by ID
   */
  async getRiceInspectionById(id) {
    const row = await this.get('SELECT * FROM supervision_rice_inspections WHERE id = ?', [id]);
    if (!row) return null;
    const payload = JSON.parse(row.payload || '{}');
    const lots = payload.lots || [];
    const hasRejected = lots.some(l => (l.result || '').toUpperCase().includes('REJECT') || (l.result || '').toUpperCase().includes('BEYOND'));
    return {
      ...row,
      payload,
      overall_result: hasRejected ? 'REJECTED' : 'PASSED'
    };
  }

  /**
   * Delete Rice Quality Inspection Sheet by ID
   */
  async deleteRiceInspection(id) {
    return await this.run('DELETE FROM supervision_rice_inspections WHERE id = ?', [id]);
  }

  /* ═════════════════════════════════════════════════════════
   * TEST / DUMMY DATA MANAGEMENT & 1-CLICK CLEANUP ENGINE
   * ═════════════════════════════════════════════════════════ */

  /**
   * Get preview counts of all test/dummy records in the supervision tables
   */
  async getSupervisionTestDataCounts() {
    const counts = {
      inspections: 0,
      surprise: 0,
      roster: 0,
      meetings: 0,
      rice: 0,
      total: 0
    };
    const records = {
      inspections: [],
      surprise: [],
      roster: [],
      meetings: [],
      rice: []
    };
    try {
      const i = await this.get("SELECT COUNT(*) as c FROM supervision_inspections WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
      counts.inspections = i ? i.c : 0;
      records.inspections = await this.all("SELECT id, issue_center as issue_center_name, inspection_date, compliance_score as compliance_percentage FROM supervision_inspections WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%' ORDER BY inspection_date DESC LIMIT 10");

      const s = await this.get("SELECT COUNT(*) as c FROM supervision_surprise WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
      counts.surprise = s ? s.c : 0;
      records.surprise = await this.all("SELECT id, issue_center as issue_center_name, inspection_date, (10 - defects_count) as passed_points, 10 as total_points FROM supervision_surprise WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%' ORDER BY inspection_date DESC LIMIT 10");

      const r = await this.get("SELECT COUNT(*) as c FROM supervision_roster WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
      counts.roster = r ? r.c : 0;
      records.roster = await this.all("SELECT id, issue_center as issue_center_name, month, planned_date as target_date, status FROM supervision_roster WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%' ORDER BY planned_date DESC LIMIT 10");

      const m = await this.get("SELECT COUNT(*) as c FROM supervision_meetings WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
      counts.meetings = m ? m.c : 0;
      records.meetings = await this.all("SELECT id, agency as agency_name, meeting_date FROM supervision_meetings WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%' ORDER BY meeting_date DESC LIMIT 10");

      const rc = await this.get("SELECT COUNT(*) as c FROM supervision_rice_inspections WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
      counts.rice = rc ? rc.c : 0;
      records.rice = await this.all("SELECT id, warehouse_name as center_name, '' as mill_name, analysis_date as inspection_date, 'PASSED' as overall_result FROM supervision_rice_inspections WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%' ORDER BY analysis_date DESC LIMIT 10");

      counts.total = counts.inspections + counts.surprise + counts.roster + counts.meetings + counts.rice;
    } catch (e) {
      console.error('Error fetching test data counts:', e.message);
    }
    return {
      success: true,
      total: counts.total,
      totalTestRecords: counts.total,
      counts,
      records,
      ...counts
    };
  }

  /**
   * Safe One-Click Cleanup: Permanently deletes ONLY test/dummy records
   * Strictly preserves all original production data
   */
  async cleanupSupervisionTestData() {
    const before = await this.getSupervisionTestDataCounts();
    await this.run("DELETE FROM supervision_inspections WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
    await this.run("DELETE FROM supervision_surprise WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
    await this.run("DELETE FROM supervision_roster WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
    await this.run("DELETE FROM supervision_meetings WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
    await this.run("DELETE FROM supervision_rice_inspections WHERE is_test = 1 OR id LIKE 'TEST_%' OR id LIKE 'DUMMY_%'");
    return {
      success: true,
      totalDeleted: before.total,
      deleted: before.counts || before,
      deletedCounts: before,
      message: `सफलतापूर्वक ${before.total} टेस्ट/डमी रिकॉर्ड्स हटाए गए। मूल वास्तविक रिकॉर्ड सुरक्षित हैं।`
    };
  }

  /**
   * Seed comprehensive realistic test dataset covering all 5 modules and edge cases
   */
  async seedComprehensiveTestData() {
    console.log('🧪 Seeding comprehensive dummy test dataset for Supervision Portal...');
    const inserted = { inspections: 0, surprise: 0, roster: 0, meetings: 0, rice: 0 };

    // 1. Detailed Inspections (5 records covering varied ICs, scores, and defect scenarios)
    const testInspections = [
      {
        id: 'TEST_INSP_001',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Betul',
        inspectionMonth: 'September',
        inspectionDate: '2026-09-22',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        officerMobile: '9425000000',
        inchargeName: 'R. K. Sharma',
        inchargeMobile: '9826100001',
        branchManager: 'A. K. Verma (MPWLC)',
        branchManagerMobile: '9425100002',
        godownsCount: 4,
        complianceScore: 96,
        deficienciesCount: 0,
        payload: {
          reservation: { wheat: 3500, rice: 1800, sugar: 120, salt: 95, other: 0 },
          stock: [
            { commodity: 'गेहूं (Wheat)', soundBags: 6800, soundQty: 3400.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 12, sweepageQty: 5.40 },
            { commodity: 'चावल (Rice)', soundBags: 3550, soundQty: 1775.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 8, sweepageQty: 3.60 },
            { commodity: 'शक्कर (Sugar)', soundBags: 230, soundQty: 115.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 0, sweepageQty: 0.00 },
            { commodity: 'नमक (Salt)', soundBags: 190, soundQty: 95.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 0, sweepageQty: 0.00 }
          ],
          gunnyBags: {
            juteNew: { usableBales: 15, usableBags: 7500, unusableBags: 20 },
            hdpe: { usableBales: 22, usableBags: 11000, unusableBags: 45 },
            juteOld: { usableBales: 5, usableBags: 2500, unusableBags: 110 }
          },
          doorstepDelivery: {
            wheatLifted: 3380.00, riceLifted: 1750.00, sugarLifted: 112.50, saltLifted: 94.00,
            fpsDeliveredCount: 84, transporterReceiptDate: '2026-09-20', receiptSentToDO: '2026-09-21', enteredInSoftwareDate: '2026-09-22'
          },
          checkpoints: {
            chk_1_computer: true, chk_2_printer: true, chk_3_ups: true, chk_4_internet: true,
            chk_5_deo_format: true, chk_6_doorstep_receipts: true, chk_7_stock_quality: true, chk_8_stack_criteria: true,
            chk_9_stack_cards: true, chk_10_sweepage_handling: true, chk_11_records_reconciliation: true, chk_12_stack_killing: true,
            chk_13_loss_gain_cert: true, chk_14_damaged_dcc: true, chk_15_transport_order: true, chk_16_fumigation_schedule: true
          },
          issuesAndSuggestions: [],
          remarks: 'टेस्ट डेटा - उत्कृष्ट व्यवस्था, शत-प्रतिशत मानक अनुपालन।'
        }
      },
      {
        id: 'TEST_INSP_002',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Multai',
        inspectionMonth: 'August',
        inspectionDate: '2026-08-20',
        officerName: 'Suresh Patil',
        officerDesignation: 'Quality Control Officer',
        officerMobile: '9425112233',
        inchargeName: 'M. P. Rao',
        inchargeMobile: '9826223344',
        branchManager: 'S. N. Sen (CWC)',
        branchManagerMobile: '9425334455',
        godownsCount: 3,
        complianceScore: 75,
        deficienciesCount: 4,
        payload: {
          reservation: { wheat: 2800, rice: 1400, sugar: 90, salt: 70, other: 0 },
          stock: [
            { commodity: 'गेहूं (Wheat)', soundBags: 5200, soundQty: 2600.00, damagedBags: 15, damagedQty: 7.50, sweepageBags: 25, sweepageQty: 11.25 },
            { commodity: 'चावल (Rice)', soundBags: 2600, soundQty: 1300.00, damagedBags: 8, damagedQty: 4.00, sweepageBags: 14, sweepageQty: 6.30 }
          ],
          gunnyBags: {
            juteNew: { usableBales: 10, usableBags: 5000, unusableBags: 50 },
            hdpe: { usableBales: 15, usableBags: 7500, unusableBags: 80 },
            juteOld: { usableBales: 4, usableBags: 2000, unusableBags: 220 }
          },
          doorstepDelivery: {
            wheatLifted: 2450.00, riceLifted: 1220.00, sugarLifted: 85.00, saltLifted: 68.00,
            fpsDeliveredCount: 65, transporterReceiptDate: '2026-08-15', receiptSentToDO: '2026-08-18', enteredInSoftwareDate: '2026-08-19'
          },
          checkpoints: {
            chk_1_computer: true, chk_2_printer: true, chk_3_ups: false, chk_4_internet: true,
            chk_5_deo_format: true, chk_6_doorstep_receipts: false, chk_7_stock_quality: true, chk_8_stack_criteria: true,
            chk_9_stack_cards: false, chk_10_sweepage_handling: false, chk_11_records_reconciliation: true, chk_12_stack_killing: true,
            chk_13_loss_gain_cert: true, chk_14_damaged_dcc: true, chk_15_transport_order: true, chk_16_fumigation_schedule: true
          },
          issuesAndSuggestions: [
            { issue: 'स्वीपेज एवं आंशिक क्षतिग्रस्त स्कंध पृथक स्टेक में व्यवस्थित नहीं।', suggestion: '48 घंटे में छंटाई एवं पृथक्करण पूर्ण करें।' },
            { issue: 'स्टेक कार्ड्स अद्यतन नहीं पाए गए।', suggestion: 'वर्तमान स्कंध अनुसार प्रविष्टि कर सील लगाएं।' }
          ],
          remarks: 'टेस्ट डेटा - मध्यम स्तर का अनुपालन, सुधार निर्देश जारी किए गए।'
        }
      },
      {
        id: 'TEST_INSP_003',
        is_test: 1,
        mode: 'rm',
        issueCenter: 'Bhainsdehi',
        inspectionMonth: 'July',
        inspectionDate: '2026-07-15',
        officerName: 'Alok Kumar Shrivastava',
        officerDesignation: 'Regional Manager (Bhopal)',
        officerMobile: '9425998877',
        inchargeName: 'K. L. Vishwakarma',
        inchargeMobile: '9826334455',
        branchManager: 'R. K. Mishra (MPWLC)',
        branchManagerMobile: '9425445566',
        godownsCount: 5,
        complianceScore: 100,
        deficienciesCount: 0,
        payload: {
          reservation: { wheat: 4200, rice: 2100, sugar: 150, salt: 110, other: 0 },
          stock: [
            { commodity: 'गेहूं (Wheat)', soundBags: 8400, soundQty: 4200.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 0, sweepageQty: 0.00 },
            { commodity: 'चावल (Rice)', soundBags: 4200, soundQty: 2100.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 0, sweepageQty: 0.00 }
          ],
          gunnyBags: {
            juteNew: { usableBales: 20, usableBags: 10000, unusableBags: 10 },
            hdpe: { usableBales: 30, usableBags: 15000, unusableBags: 20 },
            juteOld: { usableBales: 8, usableBags: 4000, unusableBags: 50 }
          },
          doorstepDelivery: {
            wheatLifted: 4180.00, riceLifted: 2090.00, sugarLifted: 148.00, saltLifted: 109.00,
            fpsDeliveredCount: 112, transporterReceiptDate: '2026-07-12', receiptSentToDO: '2026-07-13', enteredInSoftwareDate: '2026-07-14'
          },
          checkpoints: {
            chk_1_computer: true, chk_2_printer: true, chk_3_ups: true, chk_4_internet: true,
            chk_5_deo_format: true, chk_6_doorstep_receipts: true, chk_7_stock_quality: true, chk_8_stack_criteria: true,
            chk_9_stack_cards: true, chk_10_sweepage_handling: true, chk_11_records_reconciliation: true, chk_12_stack_killing: true,
            chk_13_loss_gain_cert: true, chk_14_damaged_dcc: true, chk_15_transport_order: true, chk_16_fumigation_schedule: true
          },
          issuesAndSuggestions: [],
          remarks: 'टेस्ट डेटा - संभागीय प्रबंधक महोदय द्वारा किया गया आदर्श त्रैमासिक निरीक्षण।'
        }
      },
      {
        id: 'TEST_INSP_004',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Shahpur',
        inspectionMonth: 'June',
        inspectionDate: '2026-06-10',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        officerMobile: '9425000000',
        inchargeName: 'G. P. Tiwari',
        inchargeMobile: '9826556677',
        branchManager: 'T. R. Yadav (MPWLC)',
        branchManagerMobile: '9425667788',
        godownsCount: 2,
        complianceScore: 62,
        deficienciesCount: 6,
        payload: {
          reservation: { wheat: 1800, rice: 900, sugar: 60, salt: 45, other: 0 },
          stock: [
            { commodity: 'गेहूं (Wheat)', soundBags: 3200, soundQty: 1600.00, damagedBags: 45, damagedQty: 22.50, sweepageBags: 35, sweepageQty: 15.75 },
            { commodity: 'चावल (Rice)', soundBags: 1600, soundQty: 800.00, damagedBags: 20, damagedQty: 10.00, sweepageBags: 18, sweepageQty: 8.10 }
          ],
          gunnyBags: {
            juteNew: { usableBales: 5, usableBags: 2500, unusableBags: 120 },
            hdpe: { usableBales: 8, usableBags: 4000, unusableBags: 180 },
            juteOld: { usableBales: 2, usableBags: 1000, unusableBags: 350 }
          },
          doorstepDelivery: {
            wheatLifted: 1500.00, riceLifted: 750.00, sugarLifted: 52.00, saltLifted: 40.00,
            fpsDeliveredCount: 42, transporterReceiptDate: '2026-06-05', receiptSentToDO: '2026-06-08', enteredInSoftwareDate: '2026-06-09'
          },
          checkpoints: {
            chk_1_computer: false, chk_2_printer: true, chk_3_ups: false, chk_4_internet: false,
            chk_5_deo_format: true, chk_6_doorstep_receipts: false, chk_7_stock_quality: true, chk_8_stack_criteria: true,
            chk_9_stack_cards: false, chk_10_sweepage_handling: false, chk_11_records_reconciliation: true, chk_12_stack_killing: true,
            chk_13_loss_gain_cert: false, chk_14_damaged_dcc: true, chk_15_transport_order: true, chk_16_fumigation_schedule: true
          },
          issuesAndSuggestions: [
            { issue: 'कंप्यूटर एवं इंटरनेट कनेक्टिविटी बाधित होने से CSMS प्रविष्टि में विलंब।', suggestion: 'स्थानीय ब्रॉडबैंड कनेक्शन तुरंत दुरुस्त कराएं।' },
            { issue: 'स्वीपेज की अधिकता (35 बोरे गेहूं + 18 बोरे चावल)।', suggestion: 'वेयरहाउस प्रबंधन के साथ संयुक्त पंचनामा बनाकर अपग्रेडेशन कराएं।' }
          ],
          remarks: 'टेस्ट डेटा - गंभीर कमियां परिलक्षित, कारण बताओ नोटिस जारी करने की अनुशंसा।'
        }
      },
      {
        id: 'TEST_INSP_005',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Ghoradongri',
        inspectionMonth: 'October',
        inspectionDate: '2026-10-02',
        officerName: 'Praveen Saxena',
        officerDesignation: 'Assistant Manager (PDS)',
        officerMobile: '9425778899',
        inchargeName: 'S. K. Jain',
        inchargeMobile: '9826778899',
        branchManager: 'V. K. Dubey (MPWLC)',
        branchManagerMobile: '9425889900',
        godownsCount: 3,
        complianceScore: 88,
        deficienciesCount: 2,
        payload: {
          reservation: { wheat: 2400, rice: 1200, sugar: 80, salt: 60, other: 0 },
          stock: [
            { commodity: 'गेहूं (Wheat)', soundBags: 4600, soundQty: 2300.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 8, sweepageQty: 3.60 },
            { commodity: 'चावल (Rice)', soundBags: 2300, soundQty: 1150.00, damagedBags: 0, damagedQty: 0.00, sweepageBags: 5, sweepageQty: 2.25 }
          ],
          gunnyBags: {
            juteNew: { usableBales: 8, usableBags: 4000, unusableBags: 15 },
            hdpe: { usableBales: 12, usableBags: 6000, unusableBags: 30 },
            juteOld: { usableBales: 3, usableBags: 1500, unusableBags: 80 }
          },
          doorstepDelivery: {
            wheatLifted: 2280.00, riceLifted: 1140.00, sugarLifted: 76.00, saltLifted: 58.00,
            fpsDeliveredCount: 58, transporterReceiptDate: '2026-09-28', receiptSentToDO: '2026-09-29', enteredInSoftwareDate: '2026-09-30'
          },
          checkpoints: {
            chk_1_computer: true, chk_2_printer: true, chk_3_ups: true, chk_4_internet: true,
            chk_5_deo_format: true, chk_6_doorstep_receipts: true, chk_7_stock_quality: true, chk_8_stack_criteria: true,
            chk_9_stack_cards: true, chk_10_sweepage_handling: true, chk_11_records_reconciliation: true, chk_12_stack_killing: false,
            chk_13_loss_gain_cert: false, chk_14_damaged_dcc: true, chk_15_transport_order: true, chk_16_fumigation_schedule: true
          },
          issuesAndSuggestions: [
            { issue: '2 स्टेकों का स्टेक-किलिंग निराकरण 1 माह से लंबित।', suggestion: 'वेयरहाउस शाखा प्रबंधक से समन्वय कर तत्काल सर्टिफिकेट प्राप्त करें।' }
          ],
          remarks: 'टेस्ट डेटा - सामान्य व्यवस्था संतोषप्रद।'
        }
      }
    ];

    for (const insp of testInspections) {
      await this.saveSupervisionInspection(insp);
      inserted.inspections++;
    }

    // 2. Surprise Inspections (5 records with varied pass/defect scores)
    const testSurprise = [
      {
        id: 'TEST_SURP_001',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Amla',
        inspectionDate: '2026-10-01',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        score: 100,
        defectsCount: 0,
        payload: {
          points: [
            { id: 1, label: 'आवंटन के मान से विभिन्न जिंस की उपलब्धता', compliant: true, remark: 'मानक अनुसार' },
            { id: 2, label: 'स्थान उपलब्धता की स्थिति', compliant: true, remark: 'मानक अनुसार' },
            { id: 3, label: 'हार्डवेयर / सॉफ्टवेयर संचालन एवं प्रविष्टि स्थिति', compliant: true, remark: 'मानक अनुसार' },
            { id: 4, label: 'भंडारित स्कंध के रख-रखाव की स्थिति', compliant: true, remark: 'मानक अनुसार' },
            { id: 5, label: 'स्वीपेज / क्षतिग्रस्त स्टाक की समीक्षा', compliant: true, remark: 'मानक अनुसार' },
            { id: 6, label: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर', compliant: true, remark: 'मानक अनुसार' },
            { id: 7, label: 'द्वार प्रदाय योजना पावतियों की सॉफ्टवेयर में प्रविष्टि', compliant: true, remark: 'मानक अनुसार' },
            { id: 8, label: 'केन्द्रवार डीडी / देयक जिला कार्यालय प्रेषित स्थिति', compliant: true, remark: 'मानक अनुसार' },
            { id: 9, label: 'FIFO (प्रथम आगम प्रथम निर्गम) पद्धति पालन', compliant: true, remark: 'मानक अनुसार' },
            { id: 10, label: 'केन्द्र प्रभारी / ऑपरेटर की उपस्थिति', compliant: true, remark: 'मानक अनुसार' }
          ],
          overallRemark: 'टेस्ट डेटा - आमला केन्द्र पर औचक निरीक्षण में संपूर्ण व्यवस्थाएं 100% सही पाई गईं।'
        }
      },
      {
        id: 'TEST_SURP_002',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Athner',
        inspectionDate: '2026-09-15',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        score: 80,
        defectsCount: 2,
        payload: {
          points: [
            { id: 1, label: 'आवंटन के मान से विभिन्न जिंस की उपलब्धता', compliant: true, remark: 'उपलब्ध' },
            { id: 2, label: 'स्थान उपलब्धता की स्थिति', compliant: false, remark: 'रिक्त स्थान का अभाव' },
            { id: 3, label: 'हार्डवेयर / सॉफ्टवेयर संचालन एवं प्रविष्टि स्थिति', compliant: true, remark: 'चालू' },
            { id: 4, label: 'भंडारित स्कंध के रख-रखाव की स्थिति', compliant: true, remark: 'दुरुस्त' },
            { id: 5, label: 'स्वीपेज / क्षतिग्रस्त स्टाक की समीक्षा', compliant: true, remark: 'नगण्य' },
            { id: 6, label: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर', compliant: true, remark: 'समय पर' },
            { id: 7, label: 'द्वार प्रदाय योजना पावतियों की सॉफ्टवेयर में प्रविष्टि', compliant: true, remark: 'अद्यतन' },
            { id: 8, label: 'केन्द्रवार डीडी / देयक जिला कार्यालय प्रेषित स्थिति', compliant: true, remark: 'प्रेषित' },
            { id: 9, label: 'FIFO (प्रथम आगम प्रथम निर्गम) पद्धति पालन', compliant: false, remark: 'नवीन स्टेक से निकासी पाई गई' },
            { id: 10, label: 'केन्द्र प्रभारी / ऑपरेटर की उपस्थिति', compliant: true, remark: 'उपस्थित' }
          ],
          overallRemark: 'टेस्ट डेटा - FIFO उल्लंघन पर प्रभारी को सचेत किया गया।'
        }
      },
      {
        id: 'TEST_SURP_003',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Chicholi',
        inspectionDate: '2026-08-20',
        officerName: 'Praveen Saxena',
        officerDesignation: 'Assistant Manager (PDS)',
        score: 60,
        defectsCount: 4,
        payload: {
          points: [
            { id: 1, label: 'आवंटन के मान से विभिन्न जिंस की उपलब्धता', compliant: true, remark: 'पर्याप्त' },
            { id: 2, label: 'स्थान उपलब्धता की स्थिति', compliant: true, remark: 'स्थान रिक्त' },
            { id: 3, label: 'हार्डवेयर / सॉफ्टवेयर संचालन एवं प्रविष्टि स्थिति', compliant: false, remark: 'प्रिंटर खराब' },
            { id: 4, label: 'भंडारित स्कंध के रख-रखाव की स्थिति', compliant: true, remark: 'ठीक' },
            { id: 5, label: 'स्वीपेज / क्षतिग्रस्त स्टाक की समीक्षा', compliant: false, remark: '18 बोरे स्वीपेज खुले पड़े' },
            { id: 6, label: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर', compliant: false, remark: 'धूमीकरण अवधि पार' },
            { id: 7, label: 'द्वार प्रदाय योजना पावतियों की सॉफ्टवेयर में प्रविष्टि', compliant: true, remark: 'सही' },
            { id: 8, label: 'केन्द्रवार डीडी / देयक जिला कार्यालय प्रेषित स्थिति', compliant: true, remark: 'सही' },
            { id: 9, label: 'FIFO (प्रथम आगम प्रथम निर्गम) पद्धति पालन', compliant: true, remark: 'पालन' },
            { id: 10, label: 'केन्द्र प्रभारी / ऑपरेटर की उपस्थिति', compliant: false, remark: 'ऑपरेटर अनाधिकृत अनुपस्थित' }
          ],
          overallRemark: 'टेस्ट डेटा - ऑपरेटर की अनुपस्थिति एवं कीटोपचार में देरी पर नोटिस जारी।'
        }
      },
      {
        id: 'TEST_SURP_004',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Pattan',
        inspectionDate: '2026-07-10',
        officerName: 'Vikhyat Hindoliya',
        officerDesignation: 'District Manager (MPSCSC)',
        score: 90,
        defectsCount: 1,
        payload: {
          points: [
            { id: 1, label: 'आवंटन के मान से विभिन्न जिंस की उपलब्धता', compliant: true, remark: 'सही' },
            { id: 2, label: 'स्थान उपलब्धता की स्थिति', compliant: true, remark: 'सही' },
            { id: 3, label: 'हार्डवेयर / सॉफ्टवेयर संचालन एवं प्रविष्टि स्थिति', compliant: true, remark: 'सही' },
            { id: 4, label: 'भंडारित स्कंध के रख-रखाव की स्थिति', compliant: true, remark: 'सही' },
            { id: 5, label: 'स्वीपेज / क्षतिग्रस्त स्टाक की समीक्षा', compliant: true, remark: 'सही' },
            { id: 6, label: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर', compliant: true, remark: 'सही' },
            { id: 7, label: 'द्वार प्रदाय योजना पावतियों की सॉफ्टवेयर में प्रविष्टि', compliant: true, remark: 'सही' },
            { id: 8, label: 'केन्द्रवार डीडी / देयक जिला कार्यालय प्रेषित स्थिति', compliant: false, remark: '2 देयक प्रेषण शेष' },
            { id: 9, label: 'FIFO (प्रथम आगम प्रथम निर्गम) पद्धति पालन', compliant: true, remark: 'सही' },
            { id: 10, label: 'केन्द्र प्रभारी / ऑपरेटर की उपस्थिति', compliant: true, remark: 'उपस्थित' }
          ],
          overallRemark: 'टेस्ट डेटा - 2 लंबित देयकों को आज ही भेजने के निर्देश दिए गए।'
        }
      },
      {
        id: 'TEST_SURP_005',
        is_test: 1,
        mode: 'dm',
        issueCenter: 'Bhimpur',
        inspectionDate: '2026-06-05',
        officerName: 'Suresh Patil',
        officerDesignation: 'Quality Control Officer',
        score: 70,
        defectsCount: 3,
        payload: {
          points: [
            { id: 1, label: 'आवंटन के मान से विभिन्न जिंस की उपलब्धता', compliant: false, remark: 'नमक बफर स्टॉक कम' },
            { id: 2, label: 'स्थान उपलब्धता की स्थिति', compliant: true, remark: 'सही' },
            { id: 3, label: 'हार्डवेयर / सॉफ्टवेयर संचालन एवं प्रविष्टि स्थिति', compliant: true, remark: 'सही' },
            { id: 4, label: 'भंडारित स्कंध के रख-रखाव की स्थिति', compliant: false, remark: 'स्टेक स्टेबिलिटी में कमी' },
            { id: 5, label: 'स्वीपेज / क्षतिग्रस्त स्टाक की समीक्षा', compliant: true, remark: 'सही' },
            { id: 6, label: 'स्टेकों का कीटोपचार / धूमीकरण निर्धारित समय पर', compliant: false, remark: 'धूमीकरण चार्ट अधूरा' },
            { id: 7, label: 'द्वार प्रदाय योजना पावतियों की सॉफ्टवेयर में प्रविष्टि', compliant: true, remark: 'सही' },
            { id: 8, label: 'केन्द्रवार डीडी / देयक जिला कार्यालय प्रेषित स्थिति', compliant: true, remark: 'सही' },
            { id: 9, label: 'FIFO (प्रथम आगम प्रथम निर्गम) पद्धति पालन', compliant: true, remark: 'सही' },
            { id: 10, label: 'केन्द्र प्रभारी / ऑपरेटर की उपस्थिति', compliant: true, remark: 'उपस्थित' }
          ],
          overallRemark: 'टेस्ट डेटा - नमक अतिरिक्त प्रदाय तत्काल सुनिश्चित करने के निर्देश।'
        }
      }
    ];

    for (const surp of testSurprise) {
      await this.saveSurpriseInspection(surp);
      inserted.surprise++;
    }

    // 3. Annual Roster (5 test records for varied months and statuses)
    const testRoster = [
      { id: 'TEST_ROST_001', is_test: 1, year: 2026, month: 'October', issueCenter: 'Betul', targetGodowns: 4, plannedDate: '2026-10-15', status: 'pending', officerName: 'District Manager (DM)', remarks: 'टेस्ट डेटा - आगामी रोस्टर निरीक्षण' },
      { id: 'TEST_ROST_002', is_test: 1, year: 2026, month: 'October', issueCenter: 'Multai', targetGodowns: 3, plannedDate: '2026-10-22', status: 'pending', officerName: 'Quality Control Officer', remarks: 'टेस्ट डेटा - आगामी रोस्टर निरीक्षण' },
      { id: 'TEST_ROST_003', is_test: 1, year: 2026, month: 'November', issueCenter: 'Shahpur', targetGodowns: 2, plannedDate: '2026-11-10', status: 'rescheduled', officerName: 'Assistant Manager (PDS)', remarks: 'टेस्ट डेटा - प्रशासनिक कारणों से पुनर्निर्धारित' },
      { id: 'TEST_ROST_004', is_test: 1, year: 2026, month: 'November', issueCenter: 'Amla', targetGodowns: 3, plannedDate: '2026-11-20', completedDate: '2026-11-19', status: 'completed', officerName: 'Manager (Finance)', remarks: 'टेस्ट डेटा - समय से पूर्व संपन्न' },
      { id: 'TEST_ROST_005', is_test: 1, year: 2026, month: 'December', issueCenter: 'Bhimpur', targetGodowns: 2, plannedDate: '2026-12-15', status: 'pending', officerName: 'District Manager (DM)', remarks: 'टेस्ट डेटा - शीतकालीन रोस्टर निरीक्षण' }
    ];

    for (const rost of testRoster) {
      await this.saveRosterItem(rost);
      inserted.roster++;
    }

    // 4. Meetings (3 records covering Coordination, Review, and Transporter)
    const testMeetings = [
      {
        id: 'TEST_MEET_001',
        is_test: 1,
        meetingType: 'coordination',
        agency: 'MPWLC',
        meetingDate: '2026-09-30',
        chairperson: 'Regional Manager (Bhopal)',
        attendees: 'Branch Managers MPWLC Betul, Multai, Athner; DM MPSCSC Betul',
        agendaItems: ['भंडारण शुल्क मिलान', 'स्थान आरक्षण', 'स्टेक किलिंग प्रमाणपत्र'],
        minutes: 'टेस्ट डेटा - एमपीडब्ल्यूएलसी के साथ समन्वय बैठक संपन्न। शत-प्रतिशत देयक मिलान पूर्ण करने का निर्णय।',
        actionPoints: ['10 अक्टूबर तक संयुक्त सत्यापन प्रतिवेदन प्रस्तुत करें।']
      },
      {
        id: 'TEST_MEET_002',
        is_test: 1,
        meetingType: 'review',
        agency: 'Internal MPSCSC',
        meetingDate: '2026-10-02',
        chairperson: 'District Manager Betul',
        attendees: 'All 10 Issue Center Incharges, AM (Storage), Quality Controller',
        agendaItems: ['द्वार प्रदाय योजना उठाव प्रगति', 'CSMS/IRRS ऑनलाइन प्रविष्टि', 'स्वीपेज अपग्रेडेशन'],
        minutes: 'टेस्ट डेटा - मासिक आंतरिक समीक्षा बैठक। 100% उठाव समयसीमा में पूर्ण करने के सख्त निर्देश।',
        actionPoints: ['प्रत्येक केंद्र प्रभारी प्रतिदिन सायं 6 बजे दैनिक उठाव रिपोर्ट साझा करेगा।']
      },
      {
        id: 'TEST_MEET_003',
        is_test: 1,
        meetingType: 'transporter',
        agency: 'Doorstep Transporters',
        meetingDate: '2026-09-10',
        chairperson: 'District Manager & AM (Storage)',
        attendees: 'Lead Transporters Sector A, B, C; Route Supervisors',
        agendaItems: ['जीपीएस ट्रैकिंग सक्रियता', 'उचित मूल्य दुकान स्तर पर तौल सत्यापन', 'पावती वापसी समय'],
        minutes: 'टेस्ट डेटा - परिवहनकर्ताओं के साथ समीक्षा बैठक। वाहन ट्रैकिंग एवं 48 घंटे में पावती जमा कराने का निर्णय।',
        actionPoints: ['मार्ग में वाहन खराब होने की दशा में 2 घंटे में बैकअप वाहन उपलब्ध कराना अनिवार्य होगा।']
      }
    ];

    for (const meet of testMeetings) {
      await this.saveSupervisionMeeting(meet);
      inserted.meetings++;
    }

    // 5. Rice Quality Inspections (4 sheets covering all scenarios and edge cases)
    const testRice = [
      {
        id: 'TEST_RICE_001',
        is_test: 1,
        warehouseName: 'MPWLC Warehouse Betul (Kosmi)',
        analysisDate: '2026-10-02',
        branchManager: 'MPWLC Betul',
        centreIncharge: 'MPSCSC Betul',
        districtManager: 'MPSCSC बैतूल',
        lots: [
          { sno: 1, millerName: 'M/s Betul Modern Rice Mill', stackNo: 'S-04', lotNo: 'LOT-25/101', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-10-01', brokenSmall: 0.80, brokenBig: 18.20, brokenTotal: 19.00, fmInorg: 0.10, fmOrg: 0.20, fmTotal: 0.30, damaged: 2.10, admixture: 3.50, redKernels: 1.20, chalky: 3.00, discoloured: 2.00, dehusked: 8.50, frk: 1.02, testResult: 'Positive (1.02% FRK)', result: 'Within Specification' },
          { sno: 2, millerName: 'M/s Satpura Agro Mills, Shahpur', stackNo: 'S-05', lotNo: 'LOT-25/102', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-10-01', brokenSmall: 0.90, brokenBig: 19.10, brokenTotal: 20.00, fmInorg: 0.15, fmOrg: 0.25, fmTotal: 0.40, damaged: 2.50, admixture: 4.00, redKernels: 1.50, chalky: 3.80, discoloured: 2.20, dehusked: 9.20, frk: 0.98, testResult: 'Positive (0.98% FRK)', result: 'Within Specification' },
          { sno: 3, millerName: 'M/s Narmada Grain Processing, Multai', stackNo: 'S-06', lotNo: 'LOT-25/103', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-10-02', brokenSmall: 0.65, brokenBig: 17.80, brokenTotal: 18.45, fmInorg: 0.08, fmOrg: 0.18, fmTotal: 0.26, damaged: 1.90, admixture: 3.10, redKernels: 1.10, chalky: 2.90, discoloured: 1.70, dehusked: 8.00, frk: 1.05, testResult: 'Positive (1.05% FRK)', result: 'Within Specification' },
          { sno: 4, millerName: 'M/s Betul Modern Rice Mill', stackNo: 'S-07', lotNo: 'LOT-25/104', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-10-02', brokenSmall: 0.70, brokenBig: 17.50, brokenTotal: 18.20, fmInorg: 0.08, fmOrg: 0.15, fmTotal: 0.23, damaged: 1.80, admixture: 3.00, redKernels: 1.00, chalky: 2.50, discoloured: 1.50, dehusked: 7.80, frk: 1.00, testResult: 'Positive (1.0% FRK)', result: 'Within Specification' },
          { sno: 5, millerName: 'M/s Satpura Agro Mills, Shahpur', stackNo: 'S-08', lotNo: 'LOT-25/105', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-10-02', brokenSmall: 0.85, brokenBig: 19.00, brokenTotal: 19.85, fmInorg: 0.12, fmOrg: 0.22, fmTotal: 0.34, damaged: 2.40, admixture: 3.80, redKernels: 1.40, chalky: 3.20, discoloured: 2.10, dehusked: 8.90, frk: 1.05, testResult: 'Positive (1.05% FRK)', result: 'Within Specification' },
          { sno: 6, millerName: 'M/s Narmada Grain Processing, Multai', stackNo: 'S-09', lotNo: 'LOT-25/106', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-10-02', brokenSmall: 0.75, brokenBig: 18.00, brokenTotal: 18.75, fmInorg: 0.10, fmOrg: 0.18, fmTotal: 0.28, damaged: 2.00, admixture: 3.20, redKernels: 1.10, chalky: 2.80, discoloured: 1.80, dehusked: 8.10, frk: 1.00, testResult: 'Positive (1.0% FRK)', result: 'Within Specification' }
        ]
      },
      {
        id: 'TEST_RICE_002',
        is_test: 1,
        warehouseName: 'CWC Warehouse Multai',
        analysisDate: '2026-09-25',
        branchManager: 'CWC Multai',
        centreIncharge: 'MPSCSC Multai',
        districtManager: 'MPSCSC बैतूल',
        lots: [
          { sno: 1, millerName: 'M/s Mahaveer Food Products, Amla', stackNo: 'S-01', lotNo: 'LOT-25/201', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-24', brokenSmall: 1.20, brokenBig: 23.30, brokenTotal: 24.50, fmInorg: 0.18, fmOrg: 0.28, fmTotal: 0.46, damaged: 3.80, admixture: 5.20, redKernels: 2.40, chalky: 4.60, discoloured: 3.10, dehusked: 10.80, frk: 0.95, testResult: 'Positive (0.95% FRK)', result: 'BRL' },
          { sno: 2, millerName: 'M/s Shri Ram Agro, Multai', stackNo: 'S-02', lotNo: 'LOT-25/202', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-24', brokenSmall: 0.85, brokenBig: 18.50, brokenTotal: 19.35, fmInorg: 0.10, fmOrg: 0.20, fmTotal: 0.30, damaged: 2.20, admixture: 3.60, redKernels: 1.30, chalky: 3.10, discoloured: 1.90, dehusked: 8.40, frk: 1.01, testResult: 'Positive (1.01% FRK)', result: 'Within Specification' },
          { sno: 3, millerName: 'M/s Jai Kisan Rice Mill, Betul', stackNo: 'S-03', lotNo: 'LOT-25/203', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-25', brokenSmall: 0.70, brokenBig: 17.20, brokenTotal: 17.90, fmInorg: 0.08, fmOrg: 0.15, fmTotal: 0.23, damaged: 1.90, admixture: 3.20, redKernels: 1.10, chalky: 2.80, discoloured: 1.60, dehusked: 7.90, frk: 1.03, testResult: 'Positive (1.03% FRK)', result: 'Within Specification' },
          { sno: 4, millerName: 'M/s Shri Ram Agro, Multai', stackNo: 'S-04', lotNo: 'LOT-25/204', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-25', brokenSmall: 0.90, brokenBig: 18.80, brokenTotal: 19.70, fmInorg: 0.12, fmOrg: 0.22, fmTotal: 0.34, damaged: 2.40, admixture: 3.70, redKernels: 1.40, chalky: 3.30, discoloured: 2.00, dehusked: 8.80, frk: 0.99, testResult: 'Positive (0.99% FRK)', result: 'Within Specification' }
        ]
      },
      {
        id: 'TEST_RICE_003',
        is_test: 1,
        warehouseName: 'MPWLC Warehouse Shahpur',
        analysisDate: '2026-09-12',
        branchManager: 'MPWLC Shahpur',
        centreIncharge: 'MPSCSC Shahpur',
        districtManager: 'MPSCSC बैतूल',
        lots: [
          { sno: 1, millerName: 'M/s Satpura Agro Mills', stackNo: 'S-01', lotNo: 'LOT-25/301', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-11', brokenSmall: 0.80, brokenBig: 18.00, brokenTotal: 18.80, fmInorg: 0.10, fmOrg: 0.20, fmTotal: 0.30, damaged: 2.10, admixture: 3.40, redKernels: 1.20, chalky: 3.00, discoloured: 1.80, dehusked: 8.20, frk: 1.02, testResult: 'Positive (1.02% FRK)', result: 'Within Specification' },
          { sno: 2, millerName: 'M/s Satpura Agro Mills', stackNo: 'S-02', lotNo: 'LOT-25/302', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-11', brokenSmall: 0.75, brokenBig: 18.25, brokenTotal: 19.00, fmInorg: 0.09, fmOrg: 0.19, fmTotal: 0.28, damaged: 2.00, admixture: 3.30, redKernels: 1.15, chalky: 2.90, discoloured: 1.75, dehusked: 8.10, frk: 1.04, testResult: 'Positive (1.04% FRK)', result: 'Within Specification' },
          { sno: 3, millerName: 'M/s Satpura Agro Mills', stackNo: 'S-03', lotNo: 'LOT-25/303', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-12', brokenSmall: 0.82, brokenBig: 18.18, brokenTotal: 19.00, fmInorg: 0.11, fmOrg: 0.21, fmTotal: 0.32, damaged: 2.20, admixture: 3.50, redKernels: 1.25, chalky: 3.10, discoloured: 1.85, dehusked: 8.30, frk: 1.01, testResult: 'Positive (1.01% FRK)', result: 'Within Specification' },
          { sno: 4, millerName: 'M/s Satpura Agro Mills', stackNo: 'S-04', lotNo: 'LOT-25/304', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-12', brokenSmall: 0.88, brokenBig: 18.92, brokenTotal: 19.80, fmInorg: 0.12, fmOrg: 0.24, fmTotal: 0.36, damaged: 2.30, admixture: 3.60, redKernels: 1.30, chalky: 3.20, discoloured: 1.95, dehusked: 8.50, frk: 1.00, testResult: 'Positive (1.00% FRK)', result: 'Within Specification' },
          { sno: 5, millerName: 'M/s Satpura Agro Mills', stackNo: 'S-05', lotNo: 'LOT-25/305', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-09-12', brokenSmall: 0.90, brokenBig: 19.10, brokenTotal: 20.00, fmInorg: 0.14, fmOrg: 0.25, fmTotal: 0.39, damaged: 2.45, admixture: 3.80, redKernels: 1.40, chalky: 3.40, discoloured: 2.10, dehusked: 8.90, frk: 1.03, testResult: 'Positive (1.03% FRK)', result: 'Within Specification' }
        ]
      },
      {
        id: 'TEST_RICE_004',
        is_test: 1,
        warehouseName: 'MPWLC Warehouse Amla',
        analysisDate: '2026-08-28',
        branchManager: 'MPWLC Amla',
        centreIncharge: 'MPSCSC Amla',
        districtManager: 'MPSCSC बैतूल',
        lots: [
          { sno: 1, millerName: 'M/s Mahaveer Food Products', stackNo: 'S-01', lotNo: 'LOT-25/401', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-08-27', brokenSmall: 0.50, brokenBig: 15.00, brokenTotal: 15.50, fmInorg: 0.05, fmOrg: 0.12, fmTotal: 0.17, damaged: 1.50, admixture: 2.50, redKernels: 0.80, chalky: 2.00, discoloured: 1.20, dehusked: 6.50, frk: 1.00, testResult: 'Positive (1.00% FRK)', result: 'Within Specification' },
          { sno: 2, millerName: 'M/s Mahaveer Food Products', stackNo: 'S-02', lotNo: 'LOT-25/402', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-08-27', brokenSmall: 1.10, brokenBig: 23.80, brokenTotal: 24.90, fmInorg: 0.19, fmOrg: 0.29, fmTotal: 0.48, damaged: 3.90, admixture: 5.40, redKernels: 2.45, chalky: 4.90, discoloured: 3.20, dehusked: 11.20, frk: 0.92, testResult: 'Positive (0.92% FRK)', result: 'BRL' },
          { sno: 3, millerName: 'M/s Mahaveer Food Products', stackNo: 'S-03', lotNo: 'LOT-25/403', quantityMt: 29.00, noOfBags: 580, receiptDate: '2026-08-28', brokenSmall: 0.80, brokenBig: 18.40, brokenTotal: 19.20, fmInorg: 0.10, fmOrg: 0.20, fmTotal: 0.30, damaged: 2.10, admixture: 3.30, redKernels: 1.20, chalky: 3.00, discoloured: 1.80, dehusked: 8.00, frk: 1.01, testResult: 'Positive (1.01% FRK)', result: 'Within Specification' }
        ]
      }
    ];

    for (const rice of testRice) {
      await this.saveRiceInspection(rice);
      inserted.rice++;
    }

    const total = inserted.inspections + inserted.surprise + inserted.roster + inserted.meetings + inserted.rice;
    console.log(`✅ Seeded ${total} test/dummy records successfully:`, inserted);
    return { success: true, inserted, total, seededCount: total };
  }

  /**
   * Close database connection (Async Promise-based)
   */
  close() {
    return new Promise((resolve) => {
      if (!this.db) {
        return resolve();
      }
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('🔒 Database connection closed');
        }
        this.db = null;
        resolve();
      });
    });
  }
}

module.exports = DatabaseManager;
