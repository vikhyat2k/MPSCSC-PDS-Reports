/**
 * Gmail & Official Orders Task Automation Module
 * Export index for MPSCSC Supervision Portal
 */

const crypto = require('./crypto');
const auth = require('./auth');
const rules = require('./rules');
const parser = require('./parser');
const ingestion = require('./ingestion');
const escalation = require('./escalation');

module.exports = {
  ...crypto,
  ...auth,
  ...rules,
  ...parser,
  ...ingestion,
  ...escalation
};
