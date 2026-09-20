/**
 * Session timeout / form-digest refresh diagnostic.
 *
 * Standalone port of SPARC's request-digest refresh logic
 * (src/base/sharepoint/api/requestDigest.ts). No SPARC imports, no jQuery,
 * no Toast -- pure fetch + console.
 *
 * Mirrors SPARC behavior:
 *   - POST /_api/contextinfo (odata=nometadata, with verbose fallback)
 *   - Updates the page-local #__REQUESTDIGEST hidden field
 *   - Caches remote-site tokens with a 60s safety buffer before expiry
 *   - Coalesces concurrent refreshes per site
 *   - Sleep/suspend detector: timer ticks every (digestTimeout - 120s) and
 *     refreshes only when elapsed > 2x interval (tab woke up)
 *
 * Load:
 *   await import('/<path>/client-tests/sessionRefresh.test.js');
 *
 * Exposed on window:
 *   refreshDigest(siteUrl?)        -- one-shot refresh; returns the new token
 *   startSessionTimer(opts?)       -- start sleep-aware refresh loop
 *   stopSessionTimer()             -- stop the loop
 *   getCurrentDigest()             -- read whatever digest is in the page now
 *   getDigestTimeoutSeconds()      -- read formDigestTimeoutSeconds from context
 *   sessionInfo()                  -- print current state (digest age, timer, cache)
 *   forceExpireDigest()            -- blank the page digest to test recovery
 */

// ---------------------------------------------------------------------------
// State (module-private)
// ---------------------------------------------------------------------------

const _pendingRefreshes = new Map();   // siteUrl -> in-flight Promise<string>
const _remoteTokenCache = new Map();   // siteUrl -> { token, expiresAt }

let _timerId           = null;
let _lastTickTimestamp = Date.now();
let _intervalMs        = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeUrl = (url) => (url || '').replace(/\/+$/, '').toLowerCase();

const localWebUrl = () =>
  (window._spPageContextInfo?.webAbsoluteUrl ?? location.origin).replace(/\/$/, '');

const getCurrentDigest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el?.value) return el.value;
  return window._spPageContextInfo?.formDigestValue ?? null;
};

const getDigestTimeoutSeconds = () =>
  (typeof window._spPageContextInfo !== 'undefined' &&
   typeof _spPageContextInfo.formDigestTimeoutSeconds === 'number')
    ? _spPageContextInfo.formDigestTimeoutSeconds
    : null;

// Same dual-shape extractor as SPARC: works for nometadata or verbose.
const extractDigestInfo = (payload) => {
  if (!payload) return null;
  const info = payload.FormDigestValue
    ? payload
    : (payload.GetContextWebInformation ?? payload.d?.GetContextWebInformation);
  if (!info) return null;

  const token          = info.FormDigestValue;
  const timeoutSeconds = info.FormDigestTimeoutSeconds;

  if (typeof token !== 'string' || token.length === 0)            return null;
  if (typeof timeoutSeconds !== 'number' || !Number.isFinite(timeoutSeconds)) return null;

  return { token, timeoutSeconds };
};

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

/**
 * Fetch a fresh form-digest token. Local site updates the DOM hidden field;
 * remote sites are cached in-memory with a 60s buffer before expiry.
 * Coalesces concurrent calls per site.
 *
 * @param {string} [siteUrl] absolute URL; defaults to current web
 * @returns {Promise<string>} new digest token
 */
window.refreshDigest = function refreshDigest(siteUrl) {
  if (typeof window._spPageContextInfo === 'undefined' || !_spPageContextInfo.webAbsoluteUrl) {
    return Promise.reject(new Error(
      '_spPageContextInfo is not available. Cannot refresh digest outside of a SharePoint context.'
    ));
  }

  const local            = _spPageContextInfo.webAbsoluteUrl;
  const normalizedLocal  = normalizeUrl(local);
  const target           = siteUrl ?? local;
  const normalizedTarget = normalizeUrl(target);
  const isLocal          = normalizedTarget === normalizedLocal;

  if (!isLocal) {
    const cached = _remoteTokenCache.get(normalizedTarget);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[refreshDigest] cache hit for ${target} (expires in ${((cached.expiresAt - Date.now()) / 1000).toFixed(0)}s)`);
      return Promise.resolve(cached.token);
    }
  }

  const pending = _pendingRefreshes.get(normalizedTarget);
  if (pending) {
    console.log(`[refreshDigest] coalesced into in-flight request for ${target}`);
    return pending;
  }

  const url = target + '/_api/contextinfo';
  console.log('[refreshDigest] POST', url);

  const promise = fetch(url, {
    method:      'POST',
    headers:     { 'Accept': 'application/json;odata=nometadata' },
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} -- ${text || res.statusText}`);
      }
      const json = await res.json();
      const info = extractDigestInfo(json);
      if (!info) {
        throw new Error('Unexpected contextinfo response shape -- could not extract digest token');
      }

      const { token, timeoutSeconds } = info;
      if (isLocal) {
        const el = document.getElementById('__REQUESTDIGEST');
        if (el) el.value = token;
        if (window._spPageContextInfo) _spPageContextInfo.formDigestValue = token;
        console.log(`[refreshDigest] OK (local) -- digestTimeout=${timeoutSeconds}s, DOM updated`);
      } else {
        _remoteTokenCache.set(normalizedTarget, {
          token,
          expiresAt: Date.now() + (timeoutSeconds - 60) * 1000,
        });
        console.log(`[refreshDigest] OK (remote) -- cached for ${timeoutSeconds - 60}s`);
      }
      return token;
    })
    .finally(() => {
      _pendingRefreshes.delete(normalizedTarget);
    });

  _pendingRefreshes.set(normalizedTarget, promise);
  return promise;
};

// ---------------------------------------------------------------------------
// Sleep-aware timer
// ---------------------------------------------------------------------------

/**
 * Start the digest timer. Mirrors SPARC: ticks every (formDigestTimeoutSeconds - 120s),
 * but only refreshes when elapsed >> interval (i.e. the tab/device was asleep).
 * Normal ticks are no-ops -- SP's native UpdateFormDigest keeps the digest fresh
 * while the tab is active.
 *
 * @param {object} [opts]
 * @param {number} [opts.intervalSeconds] override the auto-computed interval
 * @param {number} [opts.bufferSeconds=120] safety buffer subtracted from digest timeout
 * @param {() => void} [opts.onExpired] called when refresh fails after a sleep gap
 */
window.startSessionTimer = function startSessionTimer(opts) {
  window.stopSessionTimer();

  const bufferS  = opts?.bufferSeconds ?? 120;
  const fallback = 25 * 60 * 1000;

  if (typeof opts?.intervalSeconds === 'number' && opts.intervalSeconds > 0) {
    _intervalMs = opts.intervalSeconds * 1000;
  } else {
    const t = getDigestTimeoutSeconds();
    _intervalMs = (typeof t === 'number' && t > bufferS) ? (t - bufferS) * 1000 : fallback;
  }

  _lastTickTimestamp = Date.now();

  _timerId = setInterval(() => {
    const now     = Date.now();
    const elapsed = now - _lastTickTimestamp;
    _lastTickTimestamp = now;

    if (elapsed > _intervalMs * 2) {
      console.warn(`[sessionTimer] sleep gap detected (${(elapsed / 1000).toFixed(0)}s elapsed, expected ${(_intervalMs / 1000).toFixed(0)}s); refreshing digest`);
      window.refreshDigest().catch((err) => {
        console.error('[sessionTimer] refresh after sleep FAILED -- session likely expired', err);
        if (typeof opts?.onExpired === 'function') {
          try { opts.onExpired(); } catch (e) { console.error('[sessionTimer] onExpired threw', e); }
        }
        window.stopSessionTimer();
      });
    } else {
      console.log(`[sessionTimer] tick OK (${(elapsed / 1000).toFixed(0)}s since last tick)`);
    }
  }, _intervalMs);

  console.log(`[sessionTimer] started -- interval=${(_intervalMs / 1000).toFixed(0)}s, digestTimeout=${getDigestTimeoutSeconds() ?? '(unknown)'}s, buffer=${bufferS}s`);
};

window.stopSessionTimer = function stopSessionTimer() {
  if (_timerId !== null) {
    clearInterval(_timerId);
    _timerId = null;
    console.log('[sessionTimer] stopped');
  }
};

// ---------------------------------------------------------------------------
// Inspection / test helpers
// ---------------------------------------------------------------------------

window.getCurrentDigest        = getCurrentDigest;
window.getDigestTimeoutSeconds = getDigestTimeoutSeconds;

window.sessionInfo = () => {
  const digest      = getCurrentDigest();
  const timeoutS    = getDigestTimeoutSeconds();
  const digestParts = digest?.split(',') ?? [];
  // SP digest format: "<hash>,<UTC issued timestamp>"
  const issuedRaw   = digestParts[1];
  const issued      = issuedRaw ? new Date(issuedRaw.replace(' ', 'T') + 'Z') : null;
  const ageSeconds  = issued ? Math.floor((Date.now() - issued.getTime()) / 1000) : null;

  const summary = {
    webUrl:                  localWebUrl(),
    digestPresent:           !!digest,
    digestIssuedUTC:         issued ? issued.toISOString() : '(unparseable)',
    digestAgeSeconds:        ageSeconds,
    digestTimeoutSeconds:    timeoutS,
    timerActive:             _timerId !== null,
    timerIntervalSeconds:    _timerId !== null ? _intervalMs / 1000 : null,
    secondsSinceLastTick:    _timerId !== null ? Math.floor((Date.now() - _lastTickTimestamp) / 1000) : null,
    pendingRefreshes:        Array.from(_pendingRefreshes.keys()),
    remoteCacheEntries:      Array.from(_remoteTokenCache.entries()).map(([url, v]) => ({
      url,
      expiresInSeconds: Math.floor((v.expiresAt - Date.now()) / 1000),
    })),
  };
  console.table(summary);
  return summary;
};

// Wipe the page digest. Next write call should hit 403 + force a refresh.
window.forceExpireDigest = () => {
  const el = document.getElementById('__REQUESTDIGEST');
  if (el) {
    const old = el.value;
    el.value = '';
    console.log('[forceExpireDigest] cleared #__REQUESTDIGEST (was length', old.length, ')');
  } else {
    console.warn('[forceExpireDigest] no #__REQUESTDIGEST element on page');
  }
};

console.log('[sessionRefresh.test] loaded.');
console.log('  await refreshDigest()             -- one-shot refresh of local digest');
console.log('  await refreshDigest(siteUrl)      -- refresh + cache for a remote site');
console.log('  startSessionTimer()               -- begin sleep-aware refresh loop');
console.log('  startSessionTimer({ intervalSeconds: 30 }) -- short interval for testing');
console.log('  stopSessionTimer()                -- stop the loop');
console.log('  sessionInfo()                     -- print digest age, timer state, cache');
console.log('  getCurrentDigest()                -- raw digest string');
console.log('  getDigestTimeoutSeconds()         -- timeout from _spPageContextInfo');
console.log('  forceExpireDigest()               -- blank the digest to simulate expiry');
