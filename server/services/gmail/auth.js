/**
 * Google OAuth 2.0 Authentication Service
 * Manages Google OAuth client, authorization URL generation,
 * token exchange, encrypted refresh token persistence, and automatic client instantiation.
 * 
 * MPSCSC Supervision Portal
 */

const { google } = require('googleapis');
const { encryptToken, decryptToken } = require('./crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Checks if Google OAuth client credentials are configured in the environment
 */
function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );
}

/**
 * Creates an OAuth2 client instance
 * @param {string} [customRedirectUri] Optional redirect URI override
 */
function getOAuth2Client(customRedirectUri = null) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = customRedirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/oauth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth authorization URL
 * @param {string} [redirectUri] Optional redirect URI
 */
function getAuthUrl(redirectUri = null) {
  const oauth2Client = getOAuth2Client(redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',     // Forces consent prompt so refresh_token is always returned
    scope: SCOPES,
    include_granted_scopes: true
  });
}

/**
 * Exchanges authorization code for tokens and extracts user profile
 * @param {string} code Authorization code from Google callback
 * @param {string} [redirectUri] Callback redirect URI
 */
async function exchangeCode(code, redirectUri = null) {
  const oauth2Client = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Retrieve user email to link account
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    tokens,
    profile: userInfo.data
  };
}

/**
 * Persists connected account and encrypted tokens into the database
 * @param {object} db DatabaseManager instance
 * @param {object} param1 Tokens and Profile object
 */
async function saveConnectedAccount(db, { tokens, profile }) {
  if (!profile.email) {
    throw new Error('Unable to extract email address from Google profile');
  }

  const encryptedRefreshToken = encryptToken(tokens.refresh_token);
  const accountId = 'GMAIL_' + profile.email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  // If this account already exists and no new refresh_token was provided, preserve the existing one
  let finalEncryptedRefresh = encryptedRefreshToken;
  if (!tokens.refresh_token) {
    const existing = await db.get('SELECT encrypted_refresh_token FROM official_email_accounts WHERE email_address = ?', [profile.email]);
    if (existing && existing.encrypted_refresh_token) {
      finalEncryptedRefresh = existing.encrypted_refresh_token;
    }
  }

  if (!finalEncryptedRefresh) {
    throw new Error('No refresh token received. Re-authorize with consent prompt to obtain a refresh token.');
  }

  await db.run(`
    INSERT INTO official_email_accounts (
      id, email_address, account_type, display_name, encrypted_refresh_token,
      access_token, token_expires_at, is_active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      email_address = excluded.email_address,
      display_name = excluded.display_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      access_token = excluded.access_token,
      token_expires_at = excluded.token_expires_at,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
  `, [
    accountId,
    profile.email,
    profile.hd ? 'gmail_workspace' : 'gmail_standard',
    profile.name || profile.email,
    finalEncryptedRefresh,
    tokens.access_token || null,
    tokens.expiry_date || null
  ]);

  return {
    accountId,
    email: profile.email,
    name: profile.name,
    picture: profile.picture
  };
}

/**
 * Retrieves the currently active connected official account
 * @param {object} db DatabaseManager instance
 */
async function getActiveAccount(db) {
  const row = await db.get('SELECT id, email_address, account_type, display_name, is_active, connected_at, updated_at FROM official_email_accounts WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1');
  return row || null;
}

/**
 * Creates an authenticated Gmail API client using decrypted refresh token
 * @param {object} db DatabaseManager instance
 * @param {string} [accountEmail] Optional specific email address
 */
async function getAuthenticatedGmailClient(db, accountEmail = null) {
  let query = 'SELECT * FROM official_email_accounts WHERE is_active = 1';
  let params = [];
  if (accountEmail) {
    query += ' AND email_address = ?';
    params.push(accountEmail);
  }
  query += ' ORDER BY updated_at DESC LIMIT 1';

  const account = await db.get(query, params);
  if (!account) {
    throw new Error('No active official Gmail account connected. Please connect an account in settings.');
  }

  const refreshToken = decryptToken(account.encrypted_refresh_token);
  if (!refreshToken) {
    throw new Error('Failed to decrypt stored OAuth credentials. Please re-authenticate the account.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: account.access_token,
    expiry_date: account.token_expires_at
  });

  // Listen for automatic token refreshes to keep DB updated
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      let updateSql = 'UPDATE official_email_accounts SET access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP';
      let updateParams = [newTokens.access_token, newTokens.expiry_date || null];

      if (newTokens.refresh_token) {
        updateSql += ', encrypted_refresh_token = ?';
        updateParams.push(encryptToken(newTokens.refresh_token));
      }
      updateSql += ' WHERE id = ?';
      updateParams.push(account.id);

      await db.run(updateSql, updateParams);
    } catch (err) {
      console.warn('⚠️ Could not update refreshed tokens in database:', err.message);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  return { gmail, account, oauth2Client };
}

/**
 * Disconnects an official email account
 * @param {object} db DatabaseManager instance
 * @param {string} accountId ID of account to disconnect
 */
async function disconnectAccount(db, accountId) {
  return await db.run('UPDATE official_email_accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [accountId]);
}

/**
 * Directly links an official email account (e.g. dmnanbetul1@gmail.com)
 * @param {object} db DatabaseManager instance
 * @param {string} email Official email address
 * @param {string} [displayName] Official display name
 */
async function linkDirectAccount(db, email, displayName = 'जिला कार्यालय बैतूल (District Office Betul)') {
  const accountId = 'GMAIL_' + email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const encryptedToken = encryptToken('OFFICIAL_LINKED_' + email);

  await db.run(`
    INSERT INTO official_email_accounts (
      id, email_address, account_type, display_name, encrypted_refresh_token,
      is_active, connected_at, updated_at
    ) VALUES (?, ?, 'gmail_standard', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      email_address = excluded.email_address,
      display_name = excluded.display_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
  `, [
    accountId,
    email,
    displayName,
    encryptedToken
  ]);

  return {
    id: accountId,
    email,
    displayName,
    accountType: 'gmail_standard'
  };
}

module.exports = {
  SCOPES,
  isConfigured,
  getOAuth2Client,
  getAuthUrl,
  exchangeCode,
  saveConnectedAccount,
  getActiveAccount,
  getAuthenticatedGmailClient,
  disconnectAccount,
  linkDirectAccount
};

