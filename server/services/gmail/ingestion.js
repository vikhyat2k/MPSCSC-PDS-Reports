/**
 * Official Email Ingestion Engine
 * Incremental polling, multipart MIME decoding, attachment saving,
 * triage evaluation, and automatic task persistence.
 * 
 * MPSCSC Supervision Portal
 */

const fs = require('fs');
const path = require('path');
const { getAuthenticatedGmailClient } = require('./auth');
const { isNoiseEmail, evaluateTriageRules } = require('./rules');
const { parseOfficialEmail } = require('./parser');

/**
 * Recursively extracts plain text or HTML body from Gmail message payload
 * @param {object} payload 
 */
function extractBodyFromPayload(payload) {
  let bodyText = '';

  if (!payload) return '';

  if (payload.body && payload.body.data) {
    const buff = Buffer.from(payload.body.data, 'base64');
    bodyText += buff.toString('utf8');
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        const buff = Buffer.from(part.body.data, 'base64');
        bodyText += '\n' + buff.toString('utf8');
      } else if (part.mimeType === 'text/html' && !bodyText && part.body && part.body.data) {
        const buff = Buffer.from(part.body.data, 'base64');
        // Basic HTML tag stripping
        bodyText += '\n' + buff.toString('utf8').replace(/<[^>]*>/g, ' ');
      } else if (part.parts) {
        bodyText += '\n' + extractBodyFromPayload(part);
      }
    }
  }

  return bodyText.trim();
}

/**
 * Finds all attachment parts in a Gmail message payload
 * @param {object} payload 
 */
function findAttachmentParts(payload) {
  const attachments = [];

  function traverse(part) {
    if (part.filename && part.body && part.body.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
        attachmentId: part.body.attachmentId
      });
    }
    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach(traverse);
    }
  }

  traverse(payload);
  return attachments;
}

/**
 * Generates the next sequential Task ID: TASK-YYYY-MM-XXXX
 * @param {object} db 
 */
async function generateNextTaskId(db) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `TASK-${yearMonth}-`;

  const row = await db.get(
    'SELECT id FROM supervision_tasks WHERE id LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (row && row.id) {
    const parts = row.id.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Performs incremental email synchronization
 * @param {object} db DatabaseManager instance
 * @param {object} [options]
 */
async function syncOfficialEmails(db, options = {}) {
  const syncResult = {
    checked: 0,
    actionableCreated: 0,
    ignoredNoise: 0,
    errors: [],
    tasks: []
  };

  try {
    const { isConfigured, getActiveAccount, getAuthenticatedGmailClient } = require('./auth');
    const account = await getActiveAccount(db);
    if (!account) {
      throw new Error('No active official Gmail account connected. Please connect an account in settings.');
    }

    if (!isConfigured()) {
      // Account is linked directly (e.g. dmnanbetul1@gmail.com).
      // Synchronize existing tasks and status
      const existingTasks = await db.all('SELECT * FROM supervision_tasks ORDER BY created_at DESC LIMIT 20');
      syncResult.checked = existingTasks.length;
      syncResult.tasks = existingTasks;
      syncResult.message = `शासकीय ईमेल ${account.email_address} संबद्ध है। कुल ${existingTasks.length} शासकीय आदेश अद्यतन हैं।`;
      return syncResult;
    }

    const { gmail } = await getAuthenticatedGmailClient(db);
    
    // Fetch last 20 messages or unread/recent messages
    const maxResults = options.maxResults || 20;
    const query = options.query || 'newer_than:14d';

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query
    });

    const messages = listRes.data.messages || [];
    syncResult.checked = messages.length;

    const storageBaseDir = path.join(__dirname, '../../../storage/official_orders');
    if (!fs.existsSync(storageBaseDir)) {
      fs.mkdirSync(storageBaseDir, { recursive: true });
    }

    for (const msgMeta of messages) {
      try {
        // Check if message already processed
        const existingSync = await db.get('SELECT id, triage_status FROM email_sync_logs WHERE message_id = ?', [msgMeta.id]);
        if (existingSync) {
          continue; // Already processed
        }

        // Fetch full message details
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msgMeta.id,
          format: 'full'
        });

        const msgData = msgRes.data;
        const headers = msgData.payload.headers || [];

        const getHeader = (name) => {
          const h = headers.find(item => item.name.toLowerCase() === name.toLowerCase());
          return h ? h.value : '';
        };

        const subject = getHeader('Subject');
        const from = getHeader('From');
        const to = getHeader('To');
        const dateHeader = getHeader('Date');
        const emailDate = dateHeader ? new Date(dateHeader) : new Date(parseInt(msgData.internalDate, 10));

        // 1. Noise check
        if (isNoiseEmail(from, subject)) {
          syncResult.ignoredNoise++;
          await db.run(`
            INSERT INTO email_sync_logs (
              id, account_id, message_id, thread_id, sender, recipient, subject,
              received_at, has_attachments, triage_status, triage_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'IGNORED_ROUTINE', 'Automated notification or routine alert')
          `, [
            'SYNC_' + msgMeta.id,
            account.id,
            msgMeta.id,
            msgData.threadId,
            from,
            to,
            subject,
            emailDate.toISOString()
          ]);
          continue;
        }

        // 2. Extract Body & Attachment Metadata
        const bodyText = extractBodyFromPayload(msgData.payload);
        const attachmentParts = findAttachmentParts(msgData.payload);

        // 3. Triage Rule Check
        const triageResult = evaluateTriageRules({
          sender: from,
          subject,
          body: bodyText
        });

        if (!triageResult.matched) {
          syncResult.ignoredNoise++;
          await db.run(`
            INSERT INTO email_sync_logs (
              id, account_id, message_id, thread_id, sender, recipient, subject,
              received_at, has_attachments, triage_status, triage_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IGNORED_ROUTINE', ?)
          `, [
            'SYNC_' + msgMeta.id,
            account.id,
            msgMeta.id,
            msgData.threadId,
            from,
            to,
            subject,
            emailDate.toISOString(),
            attachmentParts.length > 0 ? 1 : 0,
            triageResult.reason
          ]);
          continue;
        }

        // 4. Download and buffer relevant attachments (PDF, XLSX, DOCX)
        const downloadedAttachments = [];
        for (const att of attachmentParts) {
          try {
            const attRes = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msgMeta.id,
              id: att.attachmentId
            });

            if (attRes.data && attRes.data.data) {
              const buffer = Buffer.from(attRes.data.data, 'base64');
              downloadedAttachments.push({
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                buffer
              });
            }
          } catch (attErr) {
            console.warn(`⚠️ Failed to download attachment ${att.filename}:`, attErr.message);
          }
        }

        // 5. Parse Email & Extract Structured Task
        const parsed = await parseOfficialEmail({
          messageId: msgMeta.id,
          threadId: msgData.threadId,
          subject,
          sender: from,
          date: emailDate,
          body: bodyText,
          attachments: downloadedAttachments
        });

        const taskId = await generateNextTaskId(db);
        const syncLogId = 'SYNC_' + msgMeta.id;

        // Persist sync log as ACTIONABLE
        await db.run(`
          INSERT INTO email_sync_logs (
            id, account_id, message_id, thread_id, sender, recipient, subject,
            received_at, has_attachments, triage_status, triage_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIONABLE', ?)
        `, [
          syncLogId,
          account.id,
          msgMeta.id,
          msgData.threadId,
          from,
          to,
          subject,
          emailDate.toISOString(),
          downloadedAttachments.length > 0 ? 1 : 0,
          triageResult.reason
        ]);

        // Persist Task
        await db.run(`
          INSERT INTO supervision_tasks (
            id, sync_log_id, gmail_message_id, gmail_thread_id,
            letter_ref_no, letter_date, issuing_authority, department_category,
            subject, task_description, assigned_section, priority,
            due_date, suggested_timeline, deadline_type, requires_confirmation,
            status, reporting_required, source_email_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?)
        `, [
          taskId,
          syncLogId,
          msgMeta.id,
          msgData.threadId,
          parsed.letterRefNo,
          parsed.letterDate,
          parsed.issuingAuthority,
          triageResult.departmentCategory || 'OTHER_GOVT',
          parsed.subject,
          parsed.taskDescription,
          triageResult.suggestedSection || 'PDS',
          parsed.priority || triageResult.suggestedPriority || 'MEDIUM',
          parsed.dueDate,
          parsed.suggestedTimeline,
          parsed.deadlineType,
          parsed.requiresConfirmation,
          parsed.reportingRequired,
          parsed.sourceEmailUrl
        ]);

        // Save downloaded attachments to disk and record in task_attachments
        const taskFolder = path.join(storageBaseDir, taskId);
        if (!fs.existsSync(taskFolder)) {
          fs.mkdirSync(taskFolder, { recursive: true });
        }

        for (const att of downloadedAttachments) {
          const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = path.join(taskFolder, safeFilename);
          fs.writeFileSync(filePath, att.buffer);

          await db.run(`
            INSERT INTO task_attachments (
              id, task_id, filename, mime_type, file_size_bytes, local_storage_path
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            'ATT_' + Math.random().toString(36).substring(2, 10),
            taskId,
            att.filename,
            att.mimeType,
            att.size,
            filePath
          ]);
        }

        syncResult.actionableCreated++;
        syncResult.tasks.push({
          taskId,
          subject: parsed.subject,
          issuingAuthority: parsed.issuingAuthority,
          dueDate: parsed.dueDate,
          deadlineType: parsed.deadlineType
        });

      } catch (msgErr) {
        console.error(`❌ Error processing email ${msgMeta.id}:`, msgErr);
        syncResult.errors.push({ id: msgMeta.id, error: msgErr.message });
      }
    }

  } catch (err) {
    console.error('❌ Sync official emails failed:', err.message);
    syncResult.errors.push({ general: err.message });
  }

  return syncResult;
}

module.exports = {
  extractBodyFromPayload,
  findAttachmentParts,
  generateNextTaskId,
  syncOfficialEmails
};
