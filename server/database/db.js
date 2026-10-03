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
    const payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data);

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
    const defectsCount = parseInt(data.defectsCount || data.defects_count || 0, 10);
    const payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data);

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
        id, year, month, issue_center, target_godowns, planned_date, completed_date, status, officer_name, remarks, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
        updated_at = CURRENT_TIMESTAMP
    `, [id, year, month, issueCenter, targetGodowns, plannedDate, completedDate, status, officerName, remarks]);

    return { success: true, id };
  }

  /**
   * Delete Roster Item
   */
  async deleteRosterItem(id) {
    return await this.run('DELETE FROM supervision_roster WHERE id = ?', [id]);
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
      agenda_items: JSON.parse(r.agenda_items || '[]'),
      action_points: JSON.parse(r.action_points || '[]')
    }));
  }

  /**
   * Save Supervision Meeting
   */
  async saveSupervisionMeeting(data) {
    const id = data.id || ('MEET_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
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
        id, meeting_type, agency, meeting_date, chairperson, attendees, agenda_items, minutes, action_points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        meeting_type = excluded.meeting_type,
        agency = excluded.agency,
        meeting_date = excluded.meeting_date,
        chairperson = excluded.chairperson,
        attendees = excluded.attendees,
        agenda_items = excluded.agenda_items,
        minutes = excluded.minutes,
        action_points = excluded.action_points
    `, [id, meetingType, agency, meetingDate, chairperson, attendees, agendaItems, minutes, actionPoints]);

    return { success: true, id };
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

      return {
        totalInspections: inspTotal?.count || 0,
        averageComplianceScore: Math.round(inspTotal?.avgScore || 0),
        inspectionsThisMonth: inspThisMonth?.count || 0,
        totalSurpriseVisits: surpTotal?.count || 0,
        totalRosterPlanned: rosterStats?.totalRoster || 0,
        rosterCompleted: rosterStats?.completedRoster || 0,
        rosterPending: rosterStats?.pendingRoster || 0,
        totalMeetingsRecorded: meetingsCount?.count || 0,
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
        branch_manager, centre_incharge, district_manager, payload, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
        updated_at = CURRENT_TIMESTAMP
    `, [id, warehouseName, analysisDate, totalLots, totalQty, totalBags, branchManager, centreIncharge, districtManager, payload]);

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

    return rows.map(r => ({
      ...r,
      payload: JSON.parse(r.payload || '{}')
    }));
  }

  /**
   * Get single Rice Quality Inspection Sheet by ID
   */
  async getRiceInspectionById(id) {
    const row = await this.get('SELECT * FROM supervision_rice_inspections WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      payload: JSON.parse(row.payload || '{}')
    };
  }

  /**
   * Delete Rice Quality Inspection Sheet by ID
   */
  async deleteRiceInspection(id) {
    return await this.run('DELETE FROM supervision_rice_inspections WHERE id = ?', [id]);
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
