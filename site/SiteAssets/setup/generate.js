import { searchUsers } from '../app/libs/nofbiz/nofbiz.base.js'
import { log } from './log.js'

// -- Generic helpers ---------------------------------------------------------

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function uniquePick(arr, n) {
  const copy = arr.slice();
  const result = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function weightedPick(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function randomDateISO(minDays, maxDays) {
  const offset = rand(minDays, maxDays);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function genId(prefix, index) {
  const seq = String(index).padStart(4, '0');
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${prefix}_${seq}_${dd}${mm}${yyyy}`;
}

// -- Data pools --------------------------------------------------------------

const STATUS_WEIGHTS = [
  ['In Progress', 35],
  ['Not Started', 25],
  ['Completed', 20],
  ['Blocked', 12],
  ['On Hold', 8],
];

const TASK_ACTIONS = [
  'Implement', 'Review', 'Refactor', 'Analyze', 'Design',
  'Document', 'Test', 'Deploy', 'Migrate', 'Optimize',
  'Audit', 'Integrate', 'Validate', 'Configure', 'Monitor',
];

const TASK_DOMAINS = [
  'authentication flow', 'reporting module', 'data pipeline',
  'user management system', 'notification service', 'API gateway',
  'dashboard components', 'export functionality', 'search feature',
  'permission model', 'audit logging', 'caching layer',
  'batch processing job', 'email templates', 'file upload handler',
  'configuration panel', 'data validation rules', 'approval workflow',
  'archive strategy', 'backup procedures',
];

const DESCRIPTION_TEMPLATES = [
  'Work on the {area} subsystem. Coordinate with at least {n} stakeholders and aim for {pct}% test coverage.',
  'Address technical debt in the {area} module. Estimated effort spans {n} sprints.',
  'Evaluate current {area} implementation and propose improvements targeting {pct}% efficiency gain.',
  'Deliver a working prototype for the {area} feature by end of sprint. Minimum {n} acceptance criteria must pass.',
  'Conduct a full review of {area} and document findings. Target readiness: {pct}%.',
  'Integrate {area} with the existing system. Validate against {n} test scenarios.',
  'Refactor {area} to reduce coupling. Code coverage goal: {pct}%.',
  'Design and implement {area} following established patterns. Involves {n} component changes.',
];

const AREAS = [
  'authentication', 'reporting', 'data migration', 'user profile',
  'notification', 'search', 'export', 'import', 'permissions',
  'scheduling', 'caching', 'logging', 'archival', 'integration',
  'configuration', 'analytics', 'approval', 'onboarding', 'monitoring', 'billing',
];

const FALLBACK_PEOPLE = [
  { email: 'alice.martin@contoso.com', displayName: 'Alice Martin' },
  { email: 'bob.chen@contoso.com', displayName: 'Bob Chen' },
  { email: 'carol.watts@contoso.com', displayName: 'Carol Watts' },
  { email: 'david.lopes@contoso.com', displayName: 'David Lopes' },
  { email: 'eva.silva@contoso.com', displayName: 'Eva Silva' },
];

// -- People pool -------------------------------------------------------------

async function fetchPeoplePool() {
  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'j', 'm', 's'];
  const seen = new Set();
  const pool = [];

  for (const letter of letters) {
    try {
      const results = await searchUsers(letter);
      for (const user of results) {
        const email = user.email || user.Email || '';
        if (email && !seen.has(email)) {
          seen.add(email);
          pool.push({
            email,
            displayName: user.displayName || user.DisplayName || email,
          });
        }
      }
    } catch (e) {
      console.warn('[generate] searchUsers failed for a letter, continuing', e);
    }
  }

  if (pool.length === 0) {
    log('No AD users found, using fallback people pool', 'info');
    return FALLBACK_PEOPLE;
  }

  return pool;
}

// -- Serialization -----------------------------------------------------------

function userIdentity(person) {
  return JSON.stringify({ email: person.email, displayName: person.displayName });
}

// -- Template filler ---------------------------------------------------------

function fillTemplate(tpl) {
  return tpl
    .replace('{area}', pick(AREAS))
    .replace('{n}', rand(2, 8))
    .replace('{pct}', rand(60, 95));
}

// -- Task record builder -----------------------------------------------------

function buildTask(index, offset, pool) {
  const [a, b] = uniquePick(TASK_ACTIONS, 2);
  const person = pick(pool);
  return {
    Title: `${a} and ${b} ${pick(TASK_DOMAINS)}`,
    UUID: genId('TASK', offset + index),
    Status: weightedPick(STATUS_WEIGHTS),
    AssignedTo: userIdentity(person),
    DueDate: randomDateISO(-30, 120),
    Description: fillTemplate(pick(DESCRIPTION_TEMPLATES)),
    AuthorEmail: pick(pool).email,
  };
}

// -- Batch runner ------------------------------------------------------------

async function runBatch(items, createFn, batchSize, label) {
  let created = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(createFn));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        created++;
      } else {
        log(`${label} item ${i + j + 1} failed: ${r.reason?.message ?? r.reason}`, 'error');
      }
    });
    log(`${label}: ${Math.min(i + batchSize, items.length)}/${items.length} processed`, 'info');
  }
  return created;
}

// -- Main export -------------------------------------------------------------

export async function generateData(siteApi, count) {
  log('--- Generate Data ---', 'info');

  const pool = await fetchPeoplePool();
  log(`People pool: ${pool.length} users`, 'info');

  const listApi = siteApi.list('Tasks');

  let offset = 0;
  try {
    const existing = await listApi.getItems(undefined, { viewFields: ['Id'] });
    offset = existing.length;
    log(`Existing items: ${offset}`, 'info');
  } catch (e) {
    console.warn('[generate] could not read existing count, using offset 0', e);
    log('Could not read existing count, using offset 0: ' + e.message, 'error');
  }

  const items = Array.from({ length: count }, (_, i) => buildTask(i + 1, offset, pool));
  const created = await runBatch(items, (item) => listApi.createItem(item), 10, 'Tasks');

  log(`Done. Created ${created}/${count} tasks.`, 'success');
}
