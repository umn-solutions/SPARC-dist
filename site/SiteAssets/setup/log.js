let logEl = null;

export function initLog(el) {
  logEl = el;
}

export function log(msg, type = '') {
  const span = document.createElement('span');
  if (type) span.className = 'log-' + type;
  span.textContent = msg + '\n';
  logEl.appendChild(span);
  logEl.scrollTop = logEl.scrollHeight;
  // Auto-open log panel on first message
  document.getElementById('log-panel').classList.add('open');
}
