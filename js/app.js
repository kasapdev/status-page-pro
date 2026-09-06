/* =====================================================================
   Status Page Pro — Application logic (app.js)
   Classic script. Depends on window.WUS (core.js) and window.SPP_DATA.
   Renders the public Status dashboard and the gated Admin panel,
   wires up modals, keyboard shortcuts and a live "last updated" ticker.
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var D = window.SPP_DATA;
  var esc = WUS.escapeHtml;

  /* ----------------------------- State ----------------------------- */
  var state = null;            // { services, incidents, subscribers, settings }
  var currentView = 'status';  // 'status' | 'admin'
  var adminUnlocked = false;
  var lastUpdated = Date.now();
  var tickTimer = null;

  var statusEl = document.getElementById('view-status');
  var adminEl = document.getElementById('view-admin');

  /* ============================ BOOT ============================ */
  function boot() {
    try {
      D.seedIfFirstRun();
      state = D.loadState();
      applyBranding();
      bindHeader();
      bindModals();
      registerShortcuts();
      renderStatus();
      startTicker();
      setView('status');
    } catch (e) {
      console.error(e);
      WUS.toast('Something went wrong while loading. Try resetting demo data.', 'error');
    }
  }

  function applyBranding() {
    var s = state.settings;
    document.getElementById('brand-name').textContent = s.logoText || 'Status Page';
    document.title = (s.siteName || 'Status Page Pro') + ' — Service Status';
    var sub = document.getElementById('brand-sub');
    if (sub) sub.textContent = s.siteName || 'Pro · live service health';
  }

  /* ============================ VIEW SWITCH ============================ */
  function setView(view) {
    if (view === 'admin' && !adminUnlocked) { promptPin(); return; }
    currentView = view;
    var isStatus = view === 'status';
    statusEl.hidden = !isStatus;
    adminEl.hidden = isStatus;
    document.getElementById('tab-status').setAttribute('aria-selected', String(isStatus));
    document.getElementById('tab-admin').setAttribute('aria-selected', String(!isStatus));
    if (isStatus) renderStatus(); else renderAdmin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindHeader() {
    document.getElementById('tab-status').addEventListener('click', function () { setView('status'); });
    document.getElementById('tab-admin').addEventListener('click', function () { setView('admin'); });
  }

  /* ============================ SHORTCUTS ============================ */
  function registerShortcuts() {
    WUS.registerShortcut('s', function () { setView('status'); }, 'Open Status dashboard');
    WUS.registerShortcut('a', function () { setView('admin'); }, 'Open Admin panel');
    WUS.registerShortcut('t', function () { WUS.toggleTheme(); }, 'Toggle theme');
    WUS.registerShortcut('?', openHelp, 'Show keyboard shortcuts');
    WUS.registerShortcut('shift+/', openHelp, 'Show keyboard shortcuts');
  }

  /* ============================ MODALS ============================ */
  var helpModal = document.getElementById('help-modal');
  var appModal = document.getElementById('app-modal');
  var appModalInner = document.getElementById('app-modal-inner');

  function openHelp() { openBackdrop(helpModal); }
  function openBackdrop(node) {
    node.hidden = false;
    var focusable = node.querySelector('button, [href], input, select, textarea');
    if (focusable) setTimeout(function () { focusable.focus(); }, 30);
  }
  function closeBackdrop(node) { node.hidden = true; }
  function closeAllModals() {
    helpModal.hidden = true;
    appModal.hidden = true;
  }

  function bindModals() {
    document.getElementById('help-btn').addEventListener('click', openHelp);
    [helpModal, appModal].forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) closeBackdrop(m); });
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-close-modal]');
      if (t) closeAllModals();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllModals();
    });
  }

  // Open the generic app modal with an HTML string; returns the inner node.
  function openModal(html, opts) {
    opts = opts || {};
    appModalInner.innerHTML = html;
    appModalInner.style.maxWidth = opts.wide ? '620px' : '480px';
    openBackdrop(appModal);
    return appModalInner;
  }

  /* ============================ ADMIN PIN ============================ */
  function promptPin() {
    var html =
      '<div class="row between center" style="margin-bottom:var(--space-4)">' +
        '<h2 id="app-modal-title" style="margin:0">Admin access</h2>' +
        closeBtn() +
      '</div>' +
      '<p class="muted" style="margin-top:0">Enter your admin PIN to manage services, incidents and settings.</p>' +
      '<form id="pin-form" class="field" autocomplete="off">' +
        '<label for="pin-input">PIN</label>' +
        '<input id="pin-input" type="password" inputmode="numeric" placeholder="••••" maxlength="12" />' +
        '<button class="btn btn--primary btn--block" type="submit" style="margin-top:var(--space-2)">Unlock admin</button>' +
      '</form>';
    openModal(html);
    var form = document.getElementById('pin-form');
    var input = document.getElementById('pin-input');
    setTimeout(function () { input.focus(); }, 40);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value === state.settings.pin) {
        adminUnlocked = true;
        closeAllModals();
        WUS.toast('Admin unlocked');
        setView('admin');
      } else {
        input.value = '';
        input.focus();
        WUS.toast('Incorrect PIN', 'error');
      }
    });
  }

  function closeBtn() {
    return '<button class="btn btn--icon btn--ghost" data-close-modal aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  }

  /* ============================ TICKER ============================ */
  function startTicker() {
    if (tickTimer) clearInterval(tickTimer);
    // Update the "last updated" label every 5s; full re-render every 30s.
    var ticks = 0;
    tickTimer = setInterval(function () {
      ticks++;
      var lbl = document.getElementById('last-updated');
      if (lbl) lbl.textContent = D.relTime(lastUpdated);
      // refresh relative times in incident list too
      var rels = document.querySelectorAll('[data-rel]');
      for (var i = 0; i < rels.length; i++) {
        rels[i].textContent = D.relTime(parseInt(rels[i].getAttribute('data-rel'), 10));
      }
      if (ticks % 6 === 0 && currentView === 'status') {
        lastUpdated = Date.now();
        renderStatus();
      }
    }, 5000);
  }

  /* ====================================================================
     STATUS VIEW (public)
     ==================================================================== */
  function renderStatus() {
    var services = state.services;
    var overall = D.overallStatus(services);
    var headline = D.overallHeadline(overall);

    var html = '';

    /* ---- Overall banner ---- */
    html +=
      '<section class="banner banner--' + overall.id + ' rise">' +
        '<div class="banner-pulse" aria-hidden="true"></div>' +
        '<div class="banner-main">' +
          '<div class="banner-ico" aria-hidden="true">' + bannerIcon(overall.id) + '</div>' +
          '<div>' +
            '<h1 class="banner-title">' + esc(headline) + '</h1>' +
            '<p class="banner-sub">' + esc(state.settings.siteName) + ' · ' +
              services.length + ' monitored ' + (services.length === 1 ? 'service' : 'services') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="banner-meta">' +
          '<span class="live-dot" aria-hidden="true"></span>' +
          '<span class="muted" style="font-size:13px">Last updated <span id="last-updated" aria-live="polite">' +
            D.relTime(lastUpdated) + '</span></span>' +
        '</div>' +
      '</section>';

    /* ---- Services grid ---- */
    if (!services.length) {
      html += emptyState('No services yet', 'Add your first service from the Admin panel to start tracking uptime.');
    } else {
      html += '<div class="svc-grid">';
      services.forEach(function (svc, idx) {
        html += serviceCard(svc, idx);
      });
      html += '</div>';
    }

    /* ---- Incident history ---- */
    html += incidentHistorySection();

    /* ---- Subscribe box ---- */
    html += subscribeSection();

    statusEl.innerHTML = html;
    bindStatusEvents();
  }

  function bannerIcon(id) {
    var icons = {
      operational: '<path d="M20 6 9 17l-5-5"/>',
      maintenance: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4L14 10l-1-1 1.7-1.7z"/>',
      degraded:    '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
      partial:     '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
      major:       '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (icons[id] || icons.operational) + '</svg>';
  }

  function serviceCard(svc, idx) {
    var st = D.STATUS[svc.status] || D.STATUS.operational;
    var pct = D.uptimePct(svc.history);
    var latency = D.recentLatency(svc.history, 30);
    var delay = Math.min(idx * 50, 300);

    var html =
      '<article class="svc-card fade-in" style="animation-delay:' + delay + 'ms">' +
        '<div class="svc-head">' +
          '<span class="svc-ico svc-ico--' + st.id + '" aria-hidden="true">' + D.categoryIcon(svc.category) + '</span>' +
          '<div class="svc-name-wrap">' +
            '<h3 class="svc-name">' + esc(svc.name) + '</h3>' +
            '<p class="svc-desc muted">' + esc(svc.description || D.CATEGORIES[svc.category].label) + '</p>' +
          '</div>' +
          '<span class="badge badge--' + st.badge + '">' + dot(st.id) + esc(st.label) + '</span>' +
        '</div>' +

        '<div class="svc-strip" role="img" aria-label="90 day uptime history, ' + pct.toFixed(2) + ' percent uptime">' +
          uptimeStrip(svc.history) +
        '</div>' +

        '<div class="svc-stats">' +
          '<div class="svc-stat">' +
            '<span class="svc-stat-val mono">' + pct.toFixed(2) + '%</span>' +
            '<span class="svc-stat-lbl muted">90-day uptime</span>' +
          '</div>' +
          '<div class="svc-spark" aria-hidden="true">' + sparkline(svc.history) + '</div>' +
          '<div class="svc-stat svc-stat--right">' +
            '<span class="svc-stat-val mono">' + latency + '<span class="unit">ms</span></span>' +
            '<span class="svc-stat-lbl muted">avg response</span>' +
          '</div>' +
        '</div>' +
      '</article>';
    return html;
  }

  function dot(statusId) {
    return '<span class="s-dot s-dot--' + statusId + '" aria-hidden="true"></span>';
  }

  // 90 small squares; recent days on the right.
  function uptimeStrip(history) {
    var h = history || [];
    var cells = '';
    // pad to 90 if shorter
    var pad = 90 - h.length;
    for (var p = 0; p < pad; p++) cells += '<span class="cell cell--empty"></span>';
    for (var i = 0; i < h.length; i++) {
      var rec = h[i];
      var label = (90 - h.length + i + 1);
      var ago = (h.length - i - 1);
      var agoLabel = ago === 0 ? 'today' : ago + (ago === 1 ? ' day ago' : ' days ago');
      cells += '<span class="cell cell--' + rec.status + '" title="' +
        agoLabel + ' · ' + (D.STATUS[rec.status] || D.STATUS.operational).label + ' · ' + rec.ms + 'ms"></span>';
    }
    return cells;
  }

  // Tiny SVG sparkline of recent response times.
  function sparkline(history) {
    var h = (history || []).slice(-30);
    if (h.length < 2) return '';
    var w = 96, ht = 28, pad = 2;
    var vals = h.map(function (d) { return d.ms; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var step = (w - pad * 2) / (h.length - 1);
    var pts = vals.map(function (v, i) {
      var x = pad + i * step;
      var y = ht - pad - ((v - min) / range) * (ht - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var d = 'M' + pts.join(' L');
    var area = d + ' L' + (pad + (h.length - 1) * step).toFixed(1) + ',' + (ht - pad) +
               ' L' + pad + ',' + (ht - pad) + ' Z';
    var gid = 'sg-' + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 ' + w + ' ' + ht + '" width="' + w + '" height="' + ht + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="var(--brand-400)" stop-opacity=".35"/>' +
        '<stop offset="1" stop-color="var(--brand-400)" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--brand-400)" stroke-width="1.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  }

  /* ---- Incident history ---- */
  function incidentHistorySection() {
    var incidents = state.incidents.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h2>Incident history</h2>' +
          '<span class="muted" style="font-size:13px">' + incidents.length +
            (incidents.length === 1 ? ' incident' : ' incidents') + ' on record</span>' +
        '</div>';

    if (!incidents.length) {
      html += '<div class="panel">' + emptyInner('No incidents reported',
        'When something goes wrong, incidents and their updates will appear here.') + '</div>';
    } else {
      html += '<div class="timeline">';
      incidents.forEach(function (inc) { html += incidentItem(inc); });
      html += '</div>';
    }
    html += '</section>';
    return html;
  }

  function incidentItem(inc) {
    var sev = D.SEVERITY[inc.severity] || D.SEVERITY.minor;
    var stt = D.INCIDENT_STATE[inc.status] || D.INCIDENT_STATE.investigating;
    var resolved = inc.status === 'resolved';
    var affectedNames = (inc.affected || []).map(function (id) {
      var s = state.services.find(function (x) { return x.id === id; });
      return s ? s.name : null;
    }).filter(Boolean);

    var updates = (inc.updates || []).slice().sort(function (a, b) { return b.at - a.at; });

    var html =
      '<article class="incident' + (resolved ? ' is-resolved' : '') + '">' +
        '<div class="incident-rail" aria-hidden="true"><span class="incident-node incident-node--' + stt.id + '"></span></div>' +
        '<div class="incident-body">' +
          '<div class="incident-top">' +
            '<h3 class="incident-title">' + esc(inc.title) + '</h3>' +
            '<div class="incident-badges">' +
              '<span class="badge badge--' + sev.badge + '">' + esc(sev.label) + '</span>' +
              '<span class="badge badge--' + stt.badge + '">' + esc(stt.label) + '</span>' +
            '</div>' +
          '</div>' +
          '<p class="incident-meta muted">' +
            'Opened <span data-rel="' + inc.createdAt + '">' + D.relTime(inc.createdAt) + '</span>' +
            (resolved && inc.resolvedAt ? ' · Resolved <span data-rel="' + inc.resolvedAt + '">' + D.relTime(inc.resolvedAt) + '</span>' : '') +
            (affectedNames.length ? ' · Affected: ' + esc(affectedNames.join(', ')) : '') +
          '</p>' +
          '<div class="incident-updates">';

    updates.forEach(function (u) {
      var ust = D.INCIDENT_STATE[u.state] || D.INCIDENT_STATE.investigating;
      html +=
        '<div class="upd">' +
          '<div class="upd-head">' +
            '<span class="upd-state upd-state--' + ust.id + '">' + esc(ust.label) + '</span>' +
            '<span class="muted upd-time" data-rel="' + u.at + '">' + D.relTime(u.at) + '</span>' +
          '</div>' +
          '<p class="upd-msg">' + esc(u.message) + '</p>' +
        '</div>';
    });

    html += '</div></div></article>';
    return html;
  }

  /* ---- Subscribe ---- */
  function subscribeSection() {
    return '<section class="section">' +
      '<div class="panel subscribe">' +
        '<div class="subscribe-copy">' +
          '<h2 style="margin-bottom:var(--space-1)">Get notified</h2>' +
          '<p class="muted" style="margin:0">Subscribe to receive an email whenever we post a new incident or maintenance window.</p>' +
        '</div>' +
        '<form id="subscribe-form" class="subscribe-form">' +
          '<label class="sr-only" for="subscribe-email">Email address</label>' +
          '<input id="subscribe-email" type="email" placeholder="you@company.com" required />' +
          '<button class="btn btn--primary" type="submit">Subscribe</button>' +
        '</form>' +
      '</div>' +
    '</section>';
  }

  function bindStatusEvents() {
    var form = document.getElementById('subscribe-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('subscribe-email');
        var email = (input.value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          WUS.toast('Please enter a valid email address', 'error');
          return;
        }
        if (state.subscribers.some(function (s) { return s.email === email; })) {
          WUS.toast('You are already subscribed');
          input.value = '';
          return;
        }
        state.subscribers.push({ id: WUS.uid(), email: email, at: Date.now() });
        D.saveSubscribers(state.subscribers);
        input.value = '';
        WUS.toast('Subscribed — confirmation sent to ' + email);
      });
    }
  }

  /* ====================================================================
     ADMIN VIEW (gated)
     ==================================================================== */
  function renderAdmin() {
    var html = '';

    html +=
      '<div class="admin-head rise">' +
        '<div>' +
          '<h1 style="margin-bottom:var(--space-1)">Admin panel</h1>' +
          '<p class="muted" style="margin:0">Manage services, incidents, subscribers and settings.</p>' +
        '</div>' +
        '<button class="btn" id="lock-admin">' + lockIcon() + 'Lock</button>' +
      '</div>';

    /* ---- Services manager ---- */
    html +=
      '<section class="section">' +
        '<div class="section-head">' +
          '<h2>Services</h2>' +
          '<button class="btn btn--primary btn--sm" id="add-service">' + plusIcon() + 'Add service</button>' +
        '</div>' +
        '<div class="admin-list" id="admin-services">' + adminServiceRows() + '</div>' +
      '</section>';

    /* ---- Incidents manager ---- */
    html +=
      '<section class="section">' +
        '<div class="section-head">' +
          '<h2>Incidents</h2>' +
          '<button class="btn btn--primary btn--sm" id="add-incident">' + plusIcon() + 'New incident</button>' +
        '</div>' +
        '<div class="admin-list" id="admin-incidents">' + adminIncidentRows() + '</div>' +
      '</section>';

    /* ---- Subscribers ---- */
    html +=
      '<section class="section">' +
        '<div class="section-head">' +
          '<h2>Subscribers</h2>' +
          '<span class="muted" style="font-size:13px">' + state.subscribers.length + ' total</span>' +
        '</div>' +
        '<div class="panel">' + subscriberList() + '</div>' +
      '</section>';

    /* ---- Settings ---- */
    html += settingsSection();

    adminEl.innerHTML = html;
    bindAdminEvents();
  }

  function adminServiceRows() {
    if (!state.services.length) {
      return '<div class="panel">' + emptyInner('No services', 'Add a service to begin.') + '</div>';
    }
    return state.services.map(function (svc) {
      var st = D.STATUS[svc.status] || D.STATUS.operational;
      var pct = D.uptimePct(svc.history);
      var opts = D.STATUS_ORDER.map(function (id) {
        var o = D.STATUS[id];
        return '<option value="' + id + '"' + (id === svc.status ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      return '<div class="admin-row" data-svc="' + svc.id + '">' +
          '<span class="svc-ico svc-ico--' + st.id + '" aria-hidden="true">' + D.categoryIcon(svc.category) + '</span>' +
          '<div class="admin-row-main">' +
            '<strong class="truncate">' + esc(svc.name) + '</strong>' +
            '<span class="muted" style="font-size:12px">' + D.CATEGORIES[svc.category].label + ' · ' + pct.toFixed(2) + '% uptime</span>' +
          '</div>' +
          '<select class="admin-status" aria-label="Status for ' + esc(svc.name) + '">' + opts + '</select>' +
          '<div class="admin-row-actions">' +
            '<button class="btn btn--sm btn--ghost" data-action="randomize" title="Simulate 90-day history" aria-label="Simulate 90-day history for ' + esc(svc.name) + '">' + diceIcon() + '</button>' +
            '<button class="btn btn--sm btn--ghost" data-action="edit" aria-label="Edit ' + esc(svc.name) + '">' + editIcon() + '</button>' +
            '<button class="btn btn--sm btn--ghost" data-action="delete" aria-label="Delete ' + esc(svc.name) + '">' + trashIcon() + '</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function adminIncidentRows() {
    if (!state.incidents.length) {
      return '<div class="panel">' + emptyInner('No incidents', 'Create an incident to post an update.') + '</div>';
    }
    var sorted = state.incidents.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    return sorted.map(function (inc) {
      var sev = D.SEVERITY[inc.severity] || D.SEVERITY.minor;
      var stt = D.INCIDENT_STATE[inc.status] || D.INCIDENT_STATE.investigating;
      var resolved = inc.status === 'resolved';
      return '<div class="admin-row" data-inc="' + inc.id + '">' +
          '<span class="incident-node incident-node--' + stt.id + '" style="position:static;flex:none"></span>' +
          '<div class="admin-row-main">' +
            '<strong class="truncate">' + esc(inc.title) + '</strong>' +
            '<span class="muted" style="font-size:12px">' +
              sev.label + ' · ' + stt.label + ' · ' + (inc.updates || []).length + ' updates · opened ' + D.relTime(inc.createdAt) +
            '</span>' +
          '</div>' +
          '<div class="admin-row-actions">' +
            (resolved ? '' : '<button class="btn btn--sm btn--ghost" data-action="update" title="Post update" aria-label="Post update for ' + esc(inc.title) + '">' + chatIcon() + '</button>') +
            (resolved ? '' : '<button class="btn btn--sm btn--ghost" data-action="resolve" title="Resolve incident" aria-label="Resolve incident: ' + esc(inc.title) + '">' + checkIcon() + '</button>') +
            '<button class="btn btn--sm btn--ghost" data-action="edit-inc" aria-label="Edit incident">' + editIcon() + '</button>' +
            '<button class="btn btn--sm btn--ghost" data-action="delete-inc" aria-label="Delete incident">' + trashIcon() + '</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function subscriberList() {
    if (!state.subscribers.length) {
      return emptyInner('No subscribers yet', 'Emails captured on the status page appear here.');
    }
    var rows = state.subscribers.slice().sort(function (a, b) { return b.at - a.at; }).map(function (s) {
      return '<li class="sub-row" data-sub="' + s.id + '">' +
        '<span class="sub-email mono truncate">' + esc(s.email) + '</span>' +
        '<span class="muted sub-when" style="font-size:12px">' + D.relTime(s.at) + '</span>' +
        '<button class="btn btn--sm btn--ghost" data-action="unsub" aria-label="Remove subscriber">' + trashIcon() + '</button>' +
      '</li>';
    }).join('');
    return '<ul class="sub-list">' + rows + '</ul>' +
      '<div class="row between center" style="margin-top:var(--space-4); flex-wrap:wrap; gap:var(--space-2)">' +
        '<span class="muted" style="font-size:13px">Export your subscriber list as CSV.</span>' +
        '<button class="btn btn--sm" id="export-subs">' + downloadIcon() + 'Export CSV</button>' +
      '</div>';
  }

  function settingsSection() {
    var s = state.settings;
    return '<section class="section">' +
      '<div class="section-head"><h2>Settings</h2></div>' +
      '<div class="panel">' +
        '<form id="settings-form" class="settings-grid">' +
          field('set-name', 'Site name', 'text', s.siteName) +
          field('set-url', 'Site URL', 'url', s.siteUrl) +
          field('set-logo', 'Logo text', 'text', s.logoText) +
          field('set-email', 'Contact email', 'email', s.contactEmail) +
          field('set-pin', 'Admin PIN', 'text', s.pin) +
          '<div class="field settings-actions">' +
            '<button class="btn btn--primary" type="submit">Save settings</button>' +
            '<button class="btn btn--danger" type="button" id="reset-demo">Reset demo data</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</section>';
  }

  function field(id, label, type, val) {
    return '<div class="field">' +
      '<label for="' + id + '">' + esc(label) + '</label>' +
      '<input id="' + id + '" type="' + type + '" value="' + esc(val == null ? '' : val) + '" />' +
    '</div>';
  }

  /* ---- Admin events ---- */
  function bindAdminEvents() {
    document.getElementById('lock-admin').addEventListener('click', function () {
      adminUnlocked = false;
      WUS.toast('Admin locked');
      setView('status');
    });

    document.getElementById('add-service').addEventListener('click', function () { serviceForm(null); });
    document.getElementById('add-incident').addEventListener('click', function () { incidentForm(null); });

    // Service rows (event delegation)
    var svcWrap = document.getElementById('admin-services');
    svcWrap.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var row = e.target.closest('[data-svc]');
      var id = row.getAttribute('data-svc');
      var action = btn.getAttribute('data-action');
      if (action === 'edit') serviceForm(id);
      else if (action === 'delete') deleteService(id);
      else if (action === 'randomize') randomizeService(id);
    });
    svcWrap.addEventListener('change', function (e) {
      if (!e.target.classList.contains('admin-status')) return;
      var row = e.target.closest('[data-svc]');
      setServiceStatus(row.getAttribute('data-svc'), e.target.value);
    });

    // Incident rows
    var incWrap = document.getElementById('admin-incidents');
    incWrap.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var row = e.target.closest('[data-inc]');
      var id = row.getAttribute('data-inc');
      var action = btn.getAttribute('data-action');
      if (action === 'update') updateForm(id);
      else if (action === 'resolve') resolveIncident(id);
      else if (action === 'edit-inc') incidentForm(id);
      else if (action === 'delete-inc') deleteIncident(id);
    });

    // Subscribers
    var subPanel = adminEl.querySelector('.sub-list') ? adminEl : null;
    adminEl.addEventListener('click', function (e) {
      var unsub = e.target.closest('[data-action="unsub"]');
      if (unsub) {
        var li = e.target.closest('[data-sub]');
        removeSubscriber(li.getAttribute('data-sub'));
      }
    });
    var exportBtn = document.getElementById('export-subs');
    if (exportBtn) exportBtn.addEventListener('click', exportSubscribers);

    // Settings
    document.getElementById('settings-form').addEventListener('submit', saveSettingsForm);
    document.getElementById('reset-demo').addEventListener('click', resetDemo);
  }

  /* ---- Service operations ---- */
  function setServiceStatus(id, status) {
    var svc = state.services.find(function (s) { return s.id === id; });
    if (!svc) return;
    svc.status = status;
    // reflect today's status in the most recent history cell
    if (svc.history && svc.history.length) {
      svc.history[svc.history.length - 1] = { status: status, ms: D.recentLatency(svc.history, 10) || 150 };
    }
    D.saveServices(state.services);
    renderAdmin();
    WUS.toast('Status updated · ' + (D.STATUS[status] || {}).label);
  }

  function randomizeService(id) {
    var svc = state.services.find(function (s) { return s.id === id; });
    if (!svc) return;
    svc.history = D.generateHistory(90, { baseMs: 80 + Math.random() * 180, jitter: 50 });
    // keep current status reflected in last cell
    svc.history[svc.history.length - 1] = { status: svc.status, ms: D.recentLatency(svc.history, 10) };
    D.saveServices(state.services);
    renderAdmin();
    WUS.toast('Simulated new 90-day history for ' + svc.name);
  }

  function deleteService(id) {
    var svc = state.services.find(function (s) { return s.id === id; });
    if (!svc) return;
    confirmModal('Delete service?', 'This removes ' + esc(svc.name) + ' and its uptime history. This cannot be undone.', function () {
      state.services = state.services.filter(function (s) { return s.id !== id; });
      // strip from incidents' affected lists
      state.incidents.forEach(function (inc) {
        inc.affected = (inc.affected || []).filter(function (a) { return a !== id; });
      });
      D.saveServices(state.services);
      D.saveIncidents(state.incidents);
      renderAdmin();
      WUS.toast('Service deleted');
    });
  }

  function serviceForm(id) {
    var editing = !!id;
    var svc = editing ? state.services.find(function (s) { return s.id === id; }) : {
      name: '', category: 'other', status: 'operational', description: ''
    };
    var catOpts = Object.keys(D.CATEGORIES).map(function (c) {
      return '<option value="' + c + '"' + (c === svc.category ? ' selected' : '') + '>' + D.CATEGORIES[c].label + '</option>';
    }).join('');
    var statusOpts = D.STATUS_ORDER.map(function (st) {
      return '<option value="' + st + '"' + (st === svc.status ? ' selected' : '') + '>' + D.STATUS[st].label + '</option>';
    }).join('');

    var html =
      modalHeader(editing ? 'Edit service' : 'Add service') +
      '<form id="svc-form" class="field" style="gap:var(--space-4)">' +
        '<div class="field"><label for="f-name">Service name</label>' +
          '<input id="f-name" type="text" required value="' + esc(svc.name) + '" placeholder="e.g. API Gateway" /></div>' +
        '<div class="field"><label for="f-desc">Description</label>' +
          '<input id="f-desc" type="text" value="' + esc(svc.description || '') + '" placeholder="Short description (optional)" /></div>' +
        '<div class="row gap-3" style="flex-wrap:wrap">' +
          '<div class="field flex-1" style="min-width:160px"><label for="f-cat">Category</label>' +
            '<select id="f-cat">' + catOpts + '</select></div>' +
          '<div class="field flex-1" style="min-width:160px"><label for="f-status">Current status</label>' +
            '<select id="f-status">' + statusOpts + '</select></div>' +
        '</div>' +
        '<button class="btn btn--primary btn--block" type="submit">' + (editing ? 'Save changes' : 'Add service') + '</button>' +
      '</form>';
    openModal(html);

    document.getElementById('svc-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('f-name').value.trim();
      if (!name) { WUS.toast('Name is required', 'error'); return; }
      var cat = document.getElementById('f-cat').value;
      var status = document.getElementById('f-status').value;
      var desc = document.getElementById('f-desc').value.trim();
      if (editing) {
        svc.name = name; svc.category = cat; svc.status = status; svc.description = desc;
        if (svc.history && svc.history.length) svc.history[svc.history.length - 1].status = status;
        WUS.toast('Service updated');
      } else {
        var hist = D.generateHistory(90, { baseMs: 120 });
        hist[hist.length - 1].status = status;
        state.services.push({ id: WUS.uid(), name: name, category: cat, status: status, description: desc, history: hist });
        WUS.toast('Service added');
      }
      D.saveServices(state.services);
      closeAllModals();
      renderAdmin();
    });
  }

  /* ---- Incident operations ---- */
  function incidentForm(id) {
    var editing = !!id;
    var inc = editing ? state.incidents.find(function (i) { return i.id === id; }) : {
      title: '', severity: 'minor', status: 'investigating', affected: [], updates: []
    };
    var sevOpts = D.SEVERITY_ORDER.map(function (s) {
      return '<option value="' + s + '"' + (s === inc.severity ? ' selected' : '') + '>' + D.SEVERITY[s].label + '</option>';
    }).join('');
    var stOpts = D.INCIDENT_STATE_ORDER.map(function (s) {
      return '<option value="' + s + '"' + (s === inc.status ? ' selected' : '') + '>' + D.INCIDENT_STATE[s].label + '</option>';
    }).join('');
    var affectedChecks = state.services.map(function (svc) {
      var checked = (inc.affected || []).indexOf(svc.id) > -1 ? ' checked' : '';
      return '<label class="check affected-check"><input type="checkbox" value="' + svc.id + '"' + checked + ' /> ' + esc(svc.name) + '</label>';
    }).join('');

    var html =
      modalHeader(editing ? 'Edit incident' : 'New incident', true) +
      '<form id="inc-form" class="field" style="gap:var(--space-4)">' +
        '<div class="field"><label for="i-title">Title</label>' +
          '<input id="i-title" type="text" required value="' + esc(inc.title) + '" placeholder="e.g. Elevated API error rate" /></div>' +
        '<div class="row gap-3" style="flex-wrap:wrap">' +
          '<div class="field flex-1" style="min-width:150px"><label for="i-sev">Severity</label><select id="i-sev">' + sevOpts + '</select></div>' +
          '<div class="field flex-1" style="min-width:150px"><label for="i-state">Status</label><select id="i-state">' + stOpts + '</select></div>' +
        '</div>' +
        '<div class="field"><label>Affected services</label>' +
          '<div class="affected-grid">' + (affectedChecks || '<span class="muted">No services available</span>') + '</div></div>' +
        (editing ? '' :
          '<div class="field"><label for="i-msg">Initial update message</label>' +
          '<textarea id="i-msg" rows="3" placeholder="What are you seeing? What are you doing about it?"></textarea></div>') +
        '<button class="btn btn--primary btn--block" type="submit">' + (editing ? 'Save changes' : 'Create incident') + '</button>' +
      '</form>';
    openModal(html, { wide: true });

    document.getElementById('inc-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('i-title').value.trim();
      if (!title) { WUS.toast('Title is required', 'error'); return; }
      var severity = document.getElementById('i-sev').value;
      var status = document.getElementById('i-state').value;
      var affected = Array.prototype.slice.call(document.querySelectorAll('.affected-check input:checked'))
        .map(function (c) { return c.value; });

      if (editing) {
        inc.title = title; inc.severity = severity; inc.status = status; inc.affected = affected;
        if (status === 'resolved' && !inc.resolvedAt) inc.resolvedAt = Date.now();
        if (status !== 'resolved') inc.resolvedAt = null;
        WUS.toast('Incident updated');
      } else {
        var msg = document.getElementById('i-msg').value.trim();
        var now = Date.now();
        var newInc = {
          id: WUS.uid(), title: title, severity: severity, status: status, affected: affected,
          createdAt: now, resolvedAt: status === 'resolved' ? now : null,
          updates: [{ id: WUS.uid(), state: status, message: msg || 'Incident created.', at: now }]
        };
        state.incidents.push(newInc);
        WUS.toast('Incident created');
      }
      D.saveIncidents(state.incidents);
      closeAllModals();
      renderAdmin();
    });
  }

  function updateForm(id) {
    var inc = state.incidents.find(function (i) { return i.id === id; });
    if (!inc) return;
    var stOpts = D.INCIDENT_STATE_ORDER.map(function (s) {
      return '<option value="' + s + '"' + (s === inc.status ? ' selected' : '') + '>' + D.INCIDENT_STATE[s].label + '</option>';
    }).join('');
    var html =
      modalHeader('Post update') +
      '<p class="muted" style="margin-top:0">' + esc(inc.title) + '</p>' +
      '<form id="upd-form" class="field" style="gap:var(--space-4)">' +
        '<div class="field"><label for="u-state">New status</label><select id="u-state">' + stOpts + '</select></div>' +
        '<div class="field"><label for="u-msg">Update message</label>' +
          '<textarea id="u-msg" rows="3" required placeholder="Share what changed..."></textarea></div>' +
        '<button class="btn btn--primary btn--block" type="submit">Post update</button>' +
      '</form>';
    openModal(html);
    document.getElementById('upd-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var st = document.getElementById('u-state').value;
      var msg = document.getElementById('u-msg').value.trim();
      if (!msg) { WUS.toast('Message is required', 'error'); return; }
      var now = Date.now();
      inc.updates.push({ id: WUS.uid(), state: st, message: msg, at: now });
      inc.status = st;
      if (st === 'resolved') inc.resolvedAt = now; else inc.resolvedAt = null;
      D.saveIncidents(state.incidents);
      closeAllModals();
      renderAdmin();
      WUS.toast('Update posted');
    });
  }

  function resolveIncident(id) {
    var inc = state.incidents.find(function (i) { return i.id === id; });
    if (!inc) return;
    var now = Date.now();
    inc.status = 'resolved';
    inc.resolvedAt = now;
    inc.updates.push({ id: WUS.uid(), state: 'resolved', message: 'This incident has been resolved.', at: now });
    D.saveIncidents(state.incidents);
    renderAdmin();
    WUS.toast('Incident resolved');
  }

  function deleteIncident(id) {
    var inc = state.incidents.find(function (i) { return i.id === id; });
    if (!inc) return;
    confirmModal('Delete incident?', 'This permanently removes "' + esc(inc.title) + '" and all its updates.', function () {
      state.incidents = state.incidents.filter(function (i) { return i.id !== id; });
      D.saveIncidents(state.incidents);
      renderAdmin();
      WUS.toast('Incident deleted');
    });
  }

  /* ---- Subscribers ---- */
  function removeSubscriber(id) {
    state.subscribers = state.subscribers.filter(function (s) { return s.id !== id; });
    D.saveSubscribers(state.subscribers);
    renderAdmin();
    WUS.toast('Subscriber removed');
  }

  function exportSubscribers() {
    if (!state.subscribers.length) { WUS.toast('No subscribers to export', 'error'); return; }
    var rows = [['email', 'subscribed_at']];
    state.subscribers.forEach(function (s) {
      rows.push([s.email, new Date(s.at).toISOString()]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    WUS.download('subscribers.csv', csv, 'text/csv;charset=utf-8');
    WUS.toast('Exported ' + state.subscribers.length + ' subscribers');
  }

  /* ---- Settings ---- */
  function saveSettingsForm(e) {
    e.preventDefault();
    var pin = document.getElementById('set-pin').value.trim();
    if (!pin) { WUS.toast('PIN cannot be empty', 'error'); return; }
    state.settings = {
      siteName: document.getElementById('set-name').value.trim() || 'Status Page',
      siteUrl: document.getElementById('set-url').value.trim(),
      logoText: document.getElementById('set-logo').value.trim() || 'Status Page',
      contactEmail: document.getElementById('set-email').value.trim(),
      pin: pin
    };
    D.saveSettings(state.settings);
    applyBranding();
    WUS.toast('Settings saved');
    renderAdmin();
  }

  function resetDemo() {
    confirmModal('Reset demo data?', 'This restores the original sample services, incidents and subscribers, replacing your current data.', function () {
      D.resetToSample();
      state = D.loadState();
      applyBranding();
      renderAdmin();
      WUS.toast('Demo data restored');
    });
  }

  /* ---- Confirm modal ---- */
  function confirmModal(title, message, onConfirm) {
    var html =
      modalHeader(title) +
      '<p class="muted" style="margin-top:0">' + message + '</p>' +
      '<div class="row gap-3" style="margin-top:var(--space-5)">' +
        '<button class="btn flex-1" data-close-modal>Cancel</button>' +
        '<button class="btn btn--danger flex-1" id="confirm-yes">Confirm</button>' +
      '</div>';
    openModal(html);
    document.getElementById('confirm-yes').addEventListener('click', function () {
      closeAllModals();
      onConfirm();
    });
  }

  /* ---- Shared modal header ---- */
  function modalHeader(title) {
    return '<div class="row between center" style="margin-bottom:var(--space-4)">' +
      '<h2 id="app-modal-title" style="margin:0">' + esc(title) + '</h2>' + closeBtn() + '</div>';
  }

  /* ---- Empty states ---- */
  function emptyState(title, msg) {
    return '<div class="section"><div class="panel">' + emptyInner(title, msg) + '</div></div>';
  }
  function emptyInner(title, msg) {
    return '<div class="empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 4v16"/></svg>' +
      '<h3 style="margin:0 0 var(--space-1)">' + esc(title) + '</h3>' +
      '<p style="margin:0">' + esc(msg) + '</p></div>';
  }

  /* ---- Inline icons ---- */
  function ico(path, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) +
      '" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }
  function plusIcon() { return ico('<path d="M12 5v14M5 12h14"/>'); }
  function trashIcon() { return ico('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'); }
  function editIcon() { return ico('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'); }
  function diceIcon() { return ico('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01M16 16h.01M12 12h.01"/>'); }
  function chatIcon() { return ico('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'); }
  function checkIcon() { return ico('<path d="M20 6 9 17l-5-5"/>'); }
  function lockIcon() { return ico('<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'); }
  function downloadIcon() { return ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'); }

  /* ============================ START ============================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
