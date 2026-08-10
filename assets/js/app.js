/* ===== AKB Fee Collection — router & bootstrap ===== */
(function (w) {
  'use strict';

  // routes allowed for the "account" role; everything else is admin-only
  const ACCOUNT_ROUTES = { students: 1, student: 1, collect: 1 };

  const Router = {
    render() { route(); },
    start: startApp
  };
  w.Router = Router;

  function parseHash() {
    let h = location.hash.replace(/^#\/?/, '');
    if (!h) h = 'dashboard';
    const [path, query] = h.split('?');
    const parts = path.split('/');
    const params = {};
    if (query) query.split('&').forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v || ''); });
    return { seg: parts, params };
  }

  function setActive(routeName) {
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === routeName));
  }

  function allowed(name) {
    if (Store.isAdmin()) return true;
    return !!ACCOUNT_ROUTES[name];
  }

  function route() {
    const { seg, params } = parseHash();
    let name = seg[0];
    if (!allowed(name)) {
      // send accounts to their landing page
      name = 'students';
      if (location.hash.replace(/^#\/?/, '').split('/')[0] !== 'students') { location.hash = '#/students'; return; }
    }
    try {
      switch (name) {
        case 'dashboard': setActive('dashboard'); Views.dashboard(); break;
        case 'students': setActive('students'); Views.students(params); break;
        case 'student': setActive('students'); Views.studentDetail(decodeURIComponent(seg[1] || '')); break;
        case 'collect': setActive('collect'); Views.collect(); break;
        case 'collections': setActive('collections'); Views.collections(params); break;
        case 'reports': setActive('reports'); Views.reports(params); break;
        case 'users': setActive('users'); Views.users(); break;
        case 'data': setActive('data'); Views.data(); break;
        default: location.hash = Store.isAdmin() ? '#/dashboard' : '#/students';
      }
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML = '<div class="empty">Something went wrong: ' + U.esc(e.message) + '</div>';
    }
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo(0, 0);
  }

  function applyRoleUI() {
    const admin = Store.isAdmin();
    document.querySelectorAll('#nav a[data-admin]').forEach(a => a.classList.toggle('hidden', !admin));
    const u = Store.currentUser || {};
    document.getElementById('userBox').innerHTML = `
      <div class="user-row">
        <div class="user-ava">${U.esc(U.initials(u.name || u.username || '?'))}</div>
        <div class="user-meta"><strong>${U.esc(u.name || u.username)}</strong><span class="badge ${admin ? 'blue' : 'gray'}">${U.esc(u.role)}</span></div>
      </div>
      <div class="user-actions">
        <button class="btn sm" id="changePw">Password</button>
        <button class="btn sm" id="logoutBtn">Logout</button>
      </div>`;
    document.getElementById('logoutBtn').onclick = () => Auth.logout();
    document.getElementById('changePw').onclick = () => Views.changePassword();
  }

  function wireGlobalSearch() {
    const input = document.getElementById('globalSearch');
    const box = document.getElementById('searchResults');
    const run = U.debounce(() => {
      const q = input.value.trim().toLowerCase();
      if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
      const rows = Store.students.filter(s =>
        (s.name + ' ' + s.id + ' ' + (s.father || '') + ' ' + (s.contact || '')).toLowerCase().indexOf(q) >= 0
      ).slice(0, 12);
      box.innerHTML = rows.map(s => {
        const t = Store.studentTotals(s);
        return `<div class="sr-item" data-id="${U.esc(s.id)}">
          <span>${U.esc(s.name)} <span class="muted">· ${U.esc(s.grade || '')} · ${U.esc(s.id)}</span></span>
          <span class="sr-bal" style="color:${t.balance > 0 ? 'var(--red)' : 'var(--green)'}">${U.inr(t.balance)}</span></div>`;
      }).join('') || '<div class="sr-item muted">No match</div>';
      box.classList.add('open');
      box.querySelectorAll('[data-id]').forEach(el => el.onclick = () => {
        location.hash = '#/student/' + encodeURIComponent(el.dataset.id);
        box.classList.remove('open'); input.value = '';
      });
    }, 150);
    input.oninput = run; input.onfocus = run;
    document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) box.classList.remove('open'); });
  }

  let wired = false;
  function startApp() {
    applyRoleUI();
    if (!wired) {
      wireGlobalSearch();
      window.addEventListener('hashchange', route);
      document.getElementById('hamburger').onclick = () => document.getElementById('sidebar').classList.toggle('open');
      wired = true;
    }
    document.getElementById('yearBadge').textContent = (Store.meta.school || 'AKB School') + ' · ' + (Store.meta.year || '');
    // land admins on dashboard, accounts on students
    if (!location.hash || location.hash === '#/' ) location.hash = Store.isAdmin() ? '#/dashboard' : '#/students';
    route();
  }

  async function boot() {
    try {
      await Store.init();
      const u = Store.restoreSession();
      if (u) startApp(u);
      else Auth.showLogin(startApp);
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML =
        '<div class="empty">Failed to load data: ' + U.esc(e.message) +
        '<br><br>If you opened this file directly, try a local server:<br><code>python3 -m http.server</code> then open <code>http://localhost:8000</code></div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
