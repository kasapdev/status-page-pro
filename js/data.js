/* =====================================================================
   Status Page Pro — Data layer (data.js)
   Classic script. Exposes window.SPP_DATA with:
     - constants (statuses, severities, categories, icons)
     - state load/save (localStorage via WUS.store, namespace "spp.")
     - sample-data seeding on first run
     - helpers: uptime history generation, relative time, derived status
   ===================================================================== */
(function () {
  'use strict';

  var store = window.WUS.store;
  var uid = window.WUS.uid;

  var KEYS = {
    services: 'spp.services',
    incidents: 'spp.incidents',
    subscribers: 'spp.subscribers',
    settings: 'spp.settings',
    seeded: 'spp.seeded'
  };

  /* ---- Status definitions (worst -> best ranking via rank) ---- */
  // rank: higher = worse, used to derive overall banner.
  var STATUS = {
    operational:  { id: 'operational',  label: 'Operational',   badge: 'success', rank: 0, color: 'var(--success)' },
    maintenance:  { id: 'maintenance',  label: 'Maintenance',   badge: 'info',    rank: 1, color: 'var(--info)' },
    degraded:     { id: 'degraded',     label: 'Degraded',      badge: 'warning', rank: 2, color: 'var(--warning)' },
    partial:      { id: 'partial',      label: 'Partial Outage',badge: 'warning', rank: 3, color: 'var(--warning)' },
    major:        { id: 'major',        label: 'Major Outage',  badge: 'danger',  rank: 4, color: 'var(--danger)' }
  };
  var STATUS_ORDER = ['operational', 'maintenance', 'degraded', 'partial', 'major'];

  /* ---- Incident severities & lifecycle ---- */
  var SEVERITY = {
    minor:    { id: 'minor',    label: 'Minor',    badge: 'warning' },
    major:    { id: 'major',    label: 'Major',    badge: 'danger' },
    critical: { id: 'critical', label: 'Critical', badge: 'danger' },
    maintenance: { id: 'maintenance', label: 'Maintenance', badge: 'info' }
  };
  var SEVERITY_ORDER = ['minor', 'major', 'critical', 'maintenance'];

  var INCIDENT_STATE = {
    investigating: { id: 'investigating', label: 'Investigating', badge: 'warning' },
    identified:    { id: 'identified',    label: 'Identified',    badge: 'warning' },
    monitoring:    { id: 'monitoring',    label: 'Monitoring',    badge: 'info' },
    resolved:      { id: 'resolved',      label: 'Resolved',      badge: 'success' }
  };
  var INCIDENT_STATE_ORDER = ['investigating', 'identified', 'monitoring', 'resolved'];

  /* ---- Category icons (inline SVG path sets) ---- */
  var CATEGORIES = {
    api:      { id: 'api',      label: 'API' },
    web:      { id: 'web',      label: 'Web App' },
    database: { id: 'database', label: 'Database' },
    cdn:      { id: 'cdn',      label: 'CDN' },
    auth:     { id: 'auth',     label: 'Authentication' },
    email:    { id: 'email',    label: 'Email' },
    storage:  { id: 'storage',  label: 'Storage' },
    other:    { id: 'other',    label: 'Service' }
  };

  // Returns an inline SVG string for a given category (stroke = currentColor).
  function categoryIcon(cat) {
    var p = {
      api:      '<path d="M7 8 3 12l4 4M17 8l4 4-4 4M14 4l-4 16"/>',
      web:      '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8"/>',
      database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      cdn:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      auth:     '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
      email:    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      storage:  '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
      other:    '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (p[cat] || p.other) + '</svg>';
  }

  /* ---- 90-day uptime history generation ----
     Returns an array of 90 day-records, oldest first:
       { status: 'operational'|'degraded'|'partial'|'major'|'maintenance', ms: <responseTime> }
     biasMajor / biasMinor tune how rough the history looks. */
  function generateHistory(days, profile) {
    days = days || 90;
    profile = profile || {};
    var base = profile.baseMs || 180;          // baseline response time
    var jitter = profile.jitter || 60;
    var pMajor = profile.pMajor != null ? profile.pMajor : 0.004;
    var pPartial = profile.pPartial != null ? profile.pPartial : 0.012;
    var pDegraded = profile.pDegraded != null ? profile.pDegraded : 0.03;
    var out = [];
    for (var i = 0; i < days; i++) {
      var r = Math.random();
      var st = 'operational';
      var ms = Math.round(base + (Math.random() - 0.5) * jitter);
      if (r < pMajor) { st = 'major'; ms = Math.round(base * 3 + Math.random() * 400); }
      else if (r < pMajor + pPartial) { st = 'partial'; ms = Math.round(base * 2 + Math.random() * 300); }
      else if (r < pMajor + pPartial + pDegraded) { st = 'degraded'; ms = Math.round(base * 1.5 + Math.random() * 150); }
      out.push({ status: st, ms: Math.max(40, ms) });
    }
    return out;
  }

  // Uptime % from history: operational + maintenance + degraded count as "up";
  // partial counts as 0.5, major counts as down.
  function uptimePct(history) {
    if (!history || !history.length) return 100;
    var score = 0;
    for (var i = 0; i < history.length; i++) {
      var s = history[i].status;
      if (s === 'major') score += 0;
      else if (s === 'partial') score += 0.5;
      else if (s === 'degraded') score += 0.97;
      else score += 1; // operational, maintenance
    }
    return (score / history.length) * 100;
  }

  // Average of the last N response times for the sparkline / "current latency".
  function recentLatency(history, n) {
    if (!history || !history.length) return 0;
    n = n || 30;
    var slice = history.slice(-n);
    var sum = 0;
    for (var i = 0; i < slice.length; i++) sum += slice[i].ms;
    return Math.round(sum / slice.length);
  }

  /* ---- Relative time ("2 hours ago", "3 days ago") ---- */
  function relTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var s = Math.floor(diff / 1000);
    if (s < 45) return 'just now';
    var m = Math.floor(s / 60);
    if (m < 1) return s + 's ago';
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.floor(h / 24);
    if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
    var mo = Math.floor(d / 30);
    if (mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
    var y = Math.floor(mo / 12);
    return y + (y === 1 ? ' year ago' : ' years ago');
  }

  function daysAgo(n) { return Date.now() - n * 86400000; }
  function hoursAgo(n) { return Date.now() - n * 3600000; }
  function minutesAgo(n) { return Date.now() - n * 60000; }

  /* ---- Derived overall status from services ---- */
  function overallStatus(services) {
    if (!services || !services.length) return STATUS.operational;
    var worst = STATUS.operational;
    for (var i = 0; i < services.length; i++) {
      var st = STATUS[services[i].status] || STATUS.operational;
      if (st.rank > worst.rank) worst = st;
    }
    return worst;
  }

  // Headline copy for the big banner based on worst status.
  function overallHeadline(st) {
    switch (st.id) {
      case 'operational': return 'All Systems Operational';
      case 'maintenance': return 'Under Maintenance';
      case 'degraded':    return 'Degraded Performance';
      case 'partial':     return 'Partial System Outage';
      case 'major':       return 'Major System Outage';
      default:            return 'All Systems Operational';
    }
  }

  /* ============================ STATE ============================ */
  var DEFAULT_SETTINGS = {
    siteName: 'Acme Cloud',
    siteUrl: 'https://status.acme.dev',
    logoText: 'Status Page',
    contactEmail: 'support@acme.dev',
    pin: '1234'
  };

  function loadState() {
    return {
      services: store.get('services', null) || [],
      incidents: store.get('incidents', null) || [],
      subscribers: store.get('subscribers', null) || [],
      settings: Object.assign({}, DEFAULT_SETTINGS, store.get('settings', null) || {})
    };
  }

  function saveServices(v) { store.set('services', v); }
  function saveIncidents(v) { store.set('incidents', v); }
  function saveSubscribers(v) { store.set('subscribers', v); }
  function saveSettings(v) { store.set('settings', v); }

  /* ---- Sample data (first run) ---- */
  function buildSampleServices() {
    return [
      {
        id: uid(), name: 'API Gateway', category: 'api', status: 'operational',
        description: 'Public REST & GraphQL API endpoints.',
        history: generateHistory(90, { baseMs: 142, jitter: 40, pMajor: 0.001, pPartial: 0.004, pDegraded: 0.02 })
      },
      {
        id: uid(), name: 'Web Application', category: 'web', status: 'operational',
        description: 'Customer-facing dashboard at app.acme.dev.',
        history: generateHistory(90, { baseMs: 220, jitter: 70, pMajor: 0.002, pPartial: 0.008, pDegraded: 0.025 })
      },
      {
        id: uid(), name: 'Primary Database', category: 'database', status: 'operational',
        description: 'Managed PostgreSQL cluster (us-east-1).',
        history: generateHistory(90, { baseMs: 18, jitter: 12, pMajor: 0.0, pPartial: 0.002, pDegraded: 0.01 })
      },
      {
        id: uid(), name: 'CDN & Edge', category: 'cdn', status: 'degraded',
        description: 'Global content delivery and edge caching.',
        history: generateHistory(90, { baseMs: 60, jitter: 30, pMajor: 0.003, pPartial: 0.02, pDegraded: 0.05 })
      },
      {
        id: uid(), name: 'Authentication', category: 'auth', status: 'operational',
        description: 'Login, SSO, and session management.',
        history: generateHistory(90, { baseMs: 95, jitter: 40, pMajor: 0.001, pPartial: 0.005, pDegraded: 0.018 })
      }
    ];
  }

  function buildSampleIncidents(services) {
    var cdn = services.find(function (s) { return s.category === 'cdn'; });
    var web = services.find(function (s) { return s.category === 'web'; });
    var api = services.find(function (s) { return s.category === 'api'; });
    var cdnId = cdn ? cdn.id : null;
    var webId = web ? web.id : null;
    var apiId = api ? api.id : null;

    return [
      {
        id: uid(),
        title: 'Elevated latency on CDN edge nodes',
        severity: 'minor',
        status: 'monitoring',
        affected: cdnId ? [cdnId] : [],
        createdAt: hoursAgo(3),
        resolvedAt: null,
        updates: [
          { id: uid(), state: 'investigating', message: 'We are investigating reports of slow asset loading in the EU region.', at: hoursAgo(3) },
          { id: uid(), state: 'identified', message: 'A misconfigured cache rule on three edge nodes has been identified. Rolling back now.', at: hoursAgo(2.2) },
          { id: uid(), state: 'monitoring', message: 'The fix has been deployed. Latency is recovering — we are monitoring edge metrics closely.', at: minutesAgo(35) }
        ]
      },
      {
        id: uid(),
        title: 'Intermittent 500 errors on the Web Application',
        severity: 'major',
        status: 'resolved',
        affected: [webId, apiId].filter(Boolean),
        createdAt: daysAgo(3),
        resolvedAt: daysAgo(3) + 5400000,
        updates: [
          { id: uid(), state: 'investigating', message: 'A subset of users are seeing 500 errors when loading the dashboard. Investigating.', at: daysAgo(3) },
          { id: uid(), state: 'identified', message: 'Root cause traced to a connection-pool exhaustion after a deploy. Scaling pool size.', at: daysAgo(3) + 1800000 },
          { id: uid(), state: 'monitoring', message: 'Error rate has returned to baseline. Monitoring for recurrence.', at: daysAgo(3) + 3600000 },
          { id: uid(), state: 'resolved', message: 'No further errors observed for 30 minutes. Incident resolved.', at: daysAgo(3) + 5400000 }
        ]
      },
      {
        id: uid(),
        title: 'Scheduled database maintenance',
        severity: 'maintenance',
        status: 'resolved',
        affected: services.filter(function (s) { return s.category === 'database'; }).map(function (s) { return s.id; }),
        createdAt: daysAgo(9),
        resolvedAt: daysAgo(9) + 2700000,
        updates: [
          { id: uid(), state: 'investigating', message: 'Planned failover maintenance to apply security patches. Brief read-only window expected.', at: daysAgo(9) },
          { id: uid(), state: 'monitoring', message: 'Patches applied and primary promoted. Verifying replication health.', at: daysAgo(9) + 1800000 },
          { id: uid(), state: 'resolved', message: 'Maintenance complete. All systems back to full read/write capacity.', at: daysAgo(9) + 2700000 }
        ]
      }
    ];
  }

  function buildSampleSubscribers() {
    return [
      { id: uid(), email: 'ops-team@acme.dev', at: daysAgo(40) },
      { id: uid(), email: 'jordan@partner.io', at: daysAgo(12) },
      { id: uid(), email: 'sre-oncall@acme.dev', at: daysAgo(2) }
    ];
  }

  function seedIfFirstRun() {
    if (store.get('seeded', false)) return false;
    var services = buildSampleServices();
    var incidents = buildSampleIncidents(services);
    saveServices(services);
    saveIncidents(incidents);
    saveSubscribers(buildSampleSubscribers());
    saveSettings(DEFAULT_SETTINGS);
    store.set('seeded', true);
    return true;
  }

  // Full reset back to sample data (used by Admin "reset demo data").
  function resetToSample() {
    var services = buildSampleServices();
    saveServices(services);
    saveIncidents(buildSampleIncidents(services));
    saveSubscribers(buildSampleSubscribers());
    saveSettings(DEFAULT_SETTINGS);
    store.set('seeded', true);
  }

  window.SPP_DATA = {
    STATUS: STATUS, STATUS_ORDER: STATUS_ORDER,
    SEVERITY: SEVERITY, SEVERITY_ORDER: SEVERITY_ORDER,
    INCIDENT_STATE: INCIDENT_STATE, INCIDENT_STATE_ORDER: INCIDENT_STATE_ORDER,
    CATEGORIES: CATEGORIES, categoryIcon: categoryIcon,
    generateHistory: generateHistory, uptimePct: uptimePct, recentLatency: recentLatency,
    relTime: relTime, daysAgo: daysAgo, hoursAgo: hoursAgo, minutesAgo: minutesAgo,
    overallStatus: overallStatus, overallHeadline: overallHeadline,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    loadState: loadState,
    saveServices: saveServices, saveIncidents: saveIncidents,
    saveSubscribers: saveSubscribers, saveSettings: saveSettings,
    seedIfFirstRun: seedIfFirstRun, resetToSample: resetToSample
  };
})();
