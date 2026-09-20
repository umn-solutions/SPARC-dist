/**
 * Email API beta -- SP.Utilities.Utility.SendEmail with email->login resolution.
 *
 * Bypasses SharePoint's per-site UIL.Email-column lookup variability by
 * pre-resolving every recipient to its claim login name via a siteUsers
 * OR-filter query, then issuing a single SendEmail POST.
 *
 * Self-contained: vanilla fetch + native Error. No framework dependencies.
 *
 * Console usage:
 *   await import('/<your-site>/client-tests/email.test.js');
 *   await sendEmailDemo();
 *   await sendEmail({ to: ['user@corp'], subject: '...', body: '...' });
 */

// ---------------------------------------------------------------------------
// Demo config (edit for sendEmailDemo)
// ---------------------------------------------------------------------------
const TO_EMAIL = 'you@example.com';
const SUBJECT  = 'Email API beta';
const BODY     = 'If you are reading this, the beta send works.';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_RECIPIENTS_PER_CALL = 50;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const _normalizeEmail = (e) => String(e ?? '').trim().toLowerCase();
const _isValidEmail   = (e) => EMAIL_RX.test(_normalizeEmail(e));
const _escapeODataStr = (s) => String(s).replace(/'/g, "''");

const _webUrl = () =>
  (window._spPageContextInfo?.webAbsoluteUrl ?? location.origin).replace(/\/$/, '');

const _getDigest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el && el.value) return el.value;
  if (window._spPageContextInfo?.formDigestValue) return _spPageContextInfo.formDigestValue;
  throw new EmailError('EmailDigestUnavailable',
    'No request digest found. Page must include the SharePoint form digest.');
};

const _getHeaders = () => ({
  'Accept': 'application/json;odata=verbose',
});

const _postHeaders = () => ({
  'Accept':          'application/json;odata=verbose',
  'Content-Type':    'application/json;odata=verbose',
  'X-RequestDigest': _getDigest(),
});

/**
 * GET a SharePoint REST endpoint and return the parsed JSON body.
 * Throws EmailError on non-2xx with parsed OData error context.
 */
async function _spGetJson(url) {
  const res = await fetch(url, {
    method:      'GET',
    headers:     _getHeaders(),
    credentials: 'include',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new EmailError('EmailHttpError',
      `GET ${url} -> HTTP ${res.status}: ${_extractOdataMessage(text)}`,
      { status: res.status, body: text });
  }
  return text ? JSON.parse(text) : null;
}

/**
 * POST a SharePoint REST endpoint with a JSON body. Auto-injects the request
 * digest and verbose OData content-type. Returns the parsed JSON body, or
 * `null` if the response body is empty (SendEmail returns empty on success).
 * Throws EmailError on non-2xx with parsed OData error context.
 */
async function _spPostJson(url, payload) {
  const res = await fetch(url, {
    method:      'POST',
    headers:     _postHeaders(),
    body:        JSON.stringify(payload),
    credentials: 'include',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new EmailError('EmailHttpError',
      `POST ${url} -> HTTP ${res.status}: ${_extractOdataMessage(text)}`,
      {
        status:      res.status,
        body:        text,
        correlation: res.headers.get('sprequestguid'),
      });
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Best-effort extraction of the human-readable OData error message from a
 * SharePoint REST error response body.
 */
function _extractOdataMessage(text) {
  if (!text) return '(empty body)';
  try {
    const json = JSON.parse(text);
    const e = json['odata.error'] ?? json.error;
    if (!e) return text;
    return e.message?.value ?? e.message ?? text;
  } catch {
    return text;
  }
}

/**
 * Strips OData envelopes ({ d: ... } or { value: ... }) and normalizes
 * a SharePoint REST collection response to a plain array.
 */
function _unwrapCollection(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.value))   return data.value;
    if (data.d) return _unwrapCollection(data.d);
  }
  return [];
}

// ---------------------------------------------------------------------------
// EmailError
// ---------------------------------------------------------------------------

/**
 * Errors thrown by the email API. The `name` field carries the taxonomy
 * (e.g. 'EmailUnresolved'); `details` carries structured context for UI
 * surfacing; `cause` carries the underlying error if any.
 */
class EmailError extends Error {
  constructor(name, message, details = null, cause = null) {
    super(message);
    this.name    = name;
    this.details = details;
    if (cause) this.cause = cause;
  }
}

/**
 * Wraps any thrown error in an EmailError, attaching contextual details.
 * Re-throws EmailError instances unchanged so existing taxonomy is preserved.
 */
function _rethrow(name, message, cause, details) {
  if (cause instanceof EmailError) throw cause;
  throw new EmailError(name, message, details ?? null, cause ?? null);
}

/**
 * Calls /_api/web/ensureUser to force the recipient into this site's UIL
 * via SharePoint's People Picker / UPS resolution. Returns the resolved
 * SPUser object on success, or null on any failure (network, perms,
 * unresolvable principal). Never throws.
 *
 * Used as a fallback when siteUsers lookup misses -- gives users who have
 * never visited this site collection a chance at being mailed without
 * forcing the caller to handle EmailUnresolved.
 */
async function _ensureUserSafe(loginNameOrEmail) {
  try {
    const url = `${_webUrl()}/_api/web/ensureUser`;
    const result = await _spPostJson(url, { logonName: loginNameOrEmail });
    return result?.d ?? result ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a list of email addresses to their SharePoint claim login names
 * via the current site's User Information List.
 *
 * Performs a single OR-filtered siteUsers query. Resolution-by-email bypasses
 * UPS / People Picker, which has been observed to fail on some sites where SP
 * cannot match UIL.Email column values reliably. Login-name lookups always
 * work if the user is in the UIL.
 *
 * @param {string[]} emails - Email addresses (any case, leading/trailing whitespace OK).
 * @returns {Promise<{
 *   resolved:   Map<string, string>,  // normalizedEmail -> claimLogin
 *   unresolved: string[],             // emails not in this site's UIL
 *   invalid:    string[],             // emails that failed format validation
 * }>}
 * @throws {EmailError} 'EmailResolutionFailed' if the siteUsers query fails.
 */
export async function resolveEmailsToLogins(emails) {
  const cleaned = [...new Set((emails ?? []).map(_normalizeEmail).filter(Boolean))];
  const valid   = cleaned.filter(_isValidEmail);
  const invalid = cleaned.filter(e => !_isValidEmail(e));

  const resolved = new Map();
  if (!valid.length) return { resolved, unresolved: [], invalid };

  const filter = valid.map(e => `Email eq '${_escapeODataStr(e)}'`).join(' or ');
  const url = `${_webUrl()}/_api/web/siteUsers`
    + `?$filter=${encodeURIComponent(filter)}`
    + `&$select=Email,LoginName`
    + `&$top=${valid.length}`;

  let data;
  try {
    data = await _spGetJson(url);
  } catch (cause) {
    _rethrow(
      'EmailResolutionFailed',
      `Failed to resolve ${valid.length} email(s) to login names via siteUsers query.`,
      cause,
      { count: valid.length },
    );
  }

  const rows = _unwrapCollection(data);
  for (const r of rows) {
    const e = _normalizeEmail(r.Email);
    if (e && r.LoginName) resolved.set(e, r.LoginName);
  }

  const unresolved = valid.filter(e => !resolved.has(e));
  return { resolved, unresolved, invalid };
}

/**
 * Sends an email via SP.Utilities.Utility.SendEmail.
 *
 * Pipeline:
 *   1. Validate args (subject, body, recipient presence)
 *   2. Normalize, dedupe, and cap-check recipients across To/Cc/Bcc
 *   3. Resolve every recipient to a claim login (single REST call)
 *   4. ensureUser fallback for any miss (one POST per missing recipient,
 *      runs sequentially; users who can't be resolved by SharePoint's
 *      People Picker remain in the unresolved list)
 *   5. POST a single SendEmail request
 *
 * Cap: {@link MAX_RECIPIENTS_PER_CALL}. Larger audiences must be chunked
 * by the caller -- one sendEmail call per chunk.
 *
 * @param {object} args
 * @param {string|string[]} args.to       - One or more email addresses (required).
 * @param {string|string[]} [args.cc]     - Optional Cc addresses.
 * @param {string|string[]} [args.bcc]    - Optional Bcc addresses.
 * @param {string} args.subject           - Non-empty subject (required).
 * @param {string} args.body              - Non-empty body, HTML or plain (required).
 * @param {string} [args.from]            - Optional From; omitted = SP web app default.
 * @returns {Promise<{ ok: true, recipientCount: number }>}
 * @throws {EmailError}
 *   - 'EmailValidation'         -- bad/missing args; programmer error.
 *   - 'EmailTooManyRecipients'  -- count exceeds MAX_RECIPIENTS_PER_CALL.
 *   - 'EmailInvalid'            -- malformed addresses present.
 *   - 'EmailUnresolved'         -- recipients not in site UIL.
 *   - 'EmailResolutionFailed'   -- siteUsers query failed.
 *   - 'EmailSendFailed'         -- SendEmail POST rejected.
 */
export async function sendEmail({ to, cc, bcc, subject, body, from } = {}) {
  // -- validate args
  if (!subject || typeof subject !== 'string') {
    throw new EmailError('EmailValidation', 'sendEmail: `subject` is required and must be a non-empty string.');
  }
  if (!body || typeof body !== 'string') {
    throw new EmailError('EmailValidation', 'sendEmail: `body` is required and must be a non-empty string.');
  }

  const toList  = [].concat(to  ?? []).map(_normalizeEmail).filter(Boolean);
  const ccList  = [].concat(cc  ?? []).map(_normalizeEmail).filter(Boolean);
  const bccList = [].concat(bcc ?? []).map(_normalizeEmail).filter(Boolean);
  const allDedup = [...new Set([...toList, ...ccList, ...bccList])];

  if (!allDedup.length) {
    throw new EmailError('EmailValidation', 'sendEmail: at least one recipient is required.');
  }
  if (allDedup.length > MAX_RECIPIENTS_PER_CALL) {
    throw new EmailError(
      'EmailTooManyRecipients',
      `sendEmail: recipient count ${allDedup.length} exceeds max ${MAX_RECIPIENTS_PER_CALL}. ` +
        `Split into batches of <= ${MAX_RECIPIENTS_PER_CALL} and call sendEmail once per batch.`,
      { count: allDedup.length, max: MAX_RECIPIENTS_PER_CALL },
    );
  }

  // -- resolve emails to logins
  let resolution;
  try {
    resolution = await resolveEmailsToLogins(allDedup);
  } catch (cause) {
    _rethrow(
      'EmailResolutionFailed',
      `sendEmail: unable to resolve recipient emails to claim logins.`,
      cause,
      { recipientCount: allDedup.length },
    );
  }

  if (resolution.invalid.length) {
    throw new EmailError(
      'EmailInvalid',
      `sendEmail: malformed email address(es): ${resolution.invalid.join(', ')}`,
      { invalid: resolution.invalid },
    );
  }

  // -- ensureUser fallback for misses
  // siteUsers only finds users who have already interacted with this site.
  // Users who exist in AD but have never visited this site collection are
  // missing from the UIL. ensureUser asks SharePoint to resolve them via
  // People Picker / UPS and add a UIL row. Sequential -- typical miss count
  // is small, and parallel calls add throttling risk for marginal gain.
  if (resolution.unresolved.length) {
    const stillMissing = [];
    for (const email of resolution.unresolved) {
      const user = await _ensureUserSafe(email);
      if (user?.LoginName) {
        resolution.resolved.set(email, user.LoginName);
      } else {
        stillMissing.push(email);
      }
    }
    resolution.unresolved = stillMissing;
  }

  if (resolution.unresolved.length) {
    throw new EmailError(
      'EmailUnresolved',
      `sendEmail: ${resolution.unresolved.length} recipient(s) could not be resolved ` +
        `even after ensureUser fallback: ${resolution.unresolved.join(', ')}. Each user must have visited or been granted ` +
        `access to this site collection before they can receive mail from it.`,
      { unresolved: resolution.unresolved },
    );
  }

  // -- build payload
  const _mapToLogins = (list) => list.map(e => resolution.resolved.get(e)).filter(Boolean);

  const properties = {
    __metadata: { type: 'SP.Utilities.EmailProperties' },
    To:      { results: _mapToLogins(toList) },
    Subject: subject,
    Body:    body,
  };
  if (ccList.length)  properties.Cc  = { results: _mapToLogins(ccList) };
  if (bccList.length) properties.Bcc = { results: _mapToLogins(bccList) };
  if (from)           properties.From = from;

  // SendEmail rejects an empty To.results. If the caller put everyone in Bcc,
  // promote one resolved login to To so the SMTP envelope is valid.
  if (!properties.To.results.length) {
    const fallback = _mapToLogins(bccList)[0] || _mapToLogins(ccList)[0] || from;
    if (!fallback) {
      throw new EmailError('EmailValidation', 'sendEmail: no resolvable To recipient available.');
    }
    properties.To = { results: [fallback] };
  }

  // -- send
  const url = `${_webUrl()}/_api/SP.Utilities.Utility.SendEmail`;
  try {
    await _spPostJson(url, { properties });
  } catch (cause) {
    _rethrow(
      'EmailSendFailed',
      `sendEmail: SP.Utilities.Utility.SendEmail rejected the request -- ${cause?.message ?? '(no message)'}`,
      cause,
      { recipientCount: allDedup.length },
    );
  }

  return { ok: true, recipientCount: allDedup.length };
}

// ---------------------------------------------------------------------------
// Console exposure
// ---------------------------------------------------------------------------

window.sendEmail               = sendEmail;
window.resolveEmailsToLogins   = resolveEmailsToLogins;
window.EmailError              = EmailError;
window.MAX_RECIPIENTS_PER_CALL = MAX_RECIPIENTS_PER_CALL;

window.sendEmailDemo = async () => {
  return sendEmail({
    to:      [TO_EMAIL],
    subject: SUBJECT,
    body:    BODY,
  });
};

console.log('[email beta] loaded.');
console.log('  await sendEmail({ to, cc?, bcc?, subject, body, from? })');
console.log('  await sendEmailDemo()');
console.log('  await resolveEmailsToLogins([emails])');
console.log(`  MAX_RECIPIENTS_PER_CALL = ${MAX_RECIPIENTS_PER_CALL}`);
