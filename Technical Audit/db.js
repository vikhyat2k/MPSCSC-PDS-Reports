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
    const columns = 'id, month, year, filename, filepath, ro_type, total_allocation, total_dispatch, total_pos_receipt, dispatch_percentage, generated_at, scheme, insights';
    
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
   * Close database connection
   */
  close() {
    this.db.close();
    console.log('🔒 Database connection closed');
  }
}

module.exports = DatabaseManager;
