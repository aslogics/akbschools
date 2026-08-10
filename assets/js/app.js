/* ===== AKB Fee Collection — router & bootstrap ===== */
(function (w) {
  'use strict';

  const Router = {
    render() { route(); },
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
    document.querySelectorAll('#nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === routeName);
    });
  }

  function route() {
    const { seg, params } = parseHash();
    const name = seg[0];
    try {
      switch (name) {
        case 'dashboard': setActive('dashboard'); Views.dashboard(); break;
        case 'students': setActive('students'); Views.students(params); break;
        case 'student': setActive('students'); Views.studentDetail(decodeURIComponent(seg[1] || '')); break;
        case 'collect': setActive('collect'); Views.collect(); break;
        case 'collections': setActive('collections'); Views.collections(); break;
        case 'reports': setActive('reports'); Views.reports(); break;
        case 'data': setActive('data'); Views.data(); break;
        default: location.hash = '#/dashboard';
      }
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML = '<div class="empty">Something went wrong: ' + U.esc(e.message) + '</div>';
    }
    // close mobile sidebar on navigate
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo(0, 0);
  }

  /* global search */
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
    input.oninput = run;
    input.onfocus = run;
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) box.classList.remove('open');
    });
  }

  async function boot() {
    document.getElementById('hamburger').onclick = () =>
      document.getElementById('sidebar').classList.toggle('open');
    window.addEventListener('hashchange', route);

    try {
      await Store.init();
      document.getElementById('dbStatus').title = 'Data loaded';
      document.getElementById('yearBadge').textContent =
        (Store.meta.school || 'AKB School') + ' · ' + (Store.meta.year || '');
      wireGlobalSearch();
      route();
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML =
        '<div class="empty">Failed to load data: ' + U.esc(e.message) +
        '<br><br>If you opened this file directly, try running a local server:<br><code>python3 -m http.server</code> then open <code>http://localhost:8000</code></div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
