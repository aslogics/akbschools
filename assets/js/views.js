/* ===== AKB Fee Collection — views ===== */
(function (w) {
  'use strict';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const view = () => document.getElementById('view');

  function statusBadge(bal, total) {
    if (total === 0) return '<span class="badge gray">No fee</span>';
    if (bal <= 0) return '<span class="badge green">Paid</span>';
    if (bal >= total) return '<span class="badge red">Pending</span>';
    return '<span class="badge amber">Partial</span>';
  }

  /* -------------------------------------------------- Dashboard */
  function dashboard() {
    const students = Store.students;
    // category summary
    const cats = Store.HEAD_ORDER.map(k => {
      let total = 0, paid = 0;
      students.forEach(s => { const h = s.fees[k]; if (h) { total += h.total; paid += h.paid; } });
      return { key: k, label: Store.HEAD_LABELS[k], total, paid, bal: total - paid };
    });
    const gt = cats.reduce((a, c) => a + c.total, 0);
    const gp = cats.reduce((a, c) => a + c.paid, 0);
    const gb = gt - gp;
    const defaulters = students.filter(s => Store.studentTotals(s).balance > 0).length;

    const today = U.todayISO();
    const todayPays = Store.payments.filter(p => p.date === today);
    const todaySum = todayPays.reduce((a, p) => a + p.amount, 0);
    const appCollected = Store.payments.reduce((a, p) => a + p.amount, 0);

    // outstanding by grade
    const byGrade = {};
    students.forEach(s => {
      const g = s.grade || '—'; const t = Store.studentTotals(s);
      byGrade[g] = byGrade[g] || { total: 0, paid: 0, bal: 0, n: 0 };
      byGrade[g].total += t.total; byGrade[g].paid += t.paid; byGrade[g].bal += t.balance; byGrade[g].n++;
    });
    const gradeRows = Object.keys(byGrade).sort().map(g => {
      const x = byGrade[g];
      return `<tr class="clickable" data-grade="${U.esc(g)}"><td>${U.esc(g)}</td><td class="num">${x.n}</td>
        <td class="num">${U.inr(x.total)}</td><td class="num">${U.inr(x.paid)}</td>
        <td class="num" style="color:${x.bal > 0 ? 'var(--red)' : 'var(--green)'}">${U.inr(x.bal)}</td></tr>`;
    }).join('');

    const catRows = cats.map(c => `
      <tr><td>${U.esc(c.label)}</td>
        <td class="num">${U.inr(c.total)}</td>
        <td class="num" style="color:var(--green)">${U.inr(c.paid)}</td>
        <td class="num" style="color:${c.bal > 0 ? 'var(--red)' : 'var(--muted)'}">${U.inr(c.bal)}</td>
        <td style="width:120px"><div class="progress"><span style="width:${c.total ? Math.min(100, c.paid / c.total * 100) : 0}%"></span></div></td>
      </tr>`).join('');

    const recent = Store.payments.slice().sort((a, b) => a.createdAt < b.createdAt ? 1 : -1).slice(0, 8)
      .map(p => `<tr class="clickable" data-rcpt="${p.id}"><td>${U.fmtDate(p.date)}</td>
        <td>${U.esc(p.studentName)}<div class="muted" style="font-size:11px">${U.esc(p.grade || '')}</div></td>
        <td><span class="pill-mode">${U.esc(p.mode)}</span></td>
        <td class="num" style="color:var(--green);font-weight:600">${U.inr(p.amount)}</td></tr>`).join('')
      || '<tr><td colspan="4" class="empty">No payments recorded in the app yet. Use “Receive Payment”.</td></tr>';

    view().innerHTML = `
      <div class="page-head">
        <div><h1>Dashboard</h1><p>${U.esc(Store.meta.school || 'AKB School')} · Academic Year ${U.esc(Store.meta.year || '')}</p></div>
        <a href="#/collect" class="btn primary">🧾 Receive Payment</a>
      </div>
      <div class="cards">
        <div class="card accent-blue"><div class="k">Total Fees</div><div class="v">${U.inr(gt)}</div><div class="sub">${students.length} students</div></div>
        <div class="card accent-green"><div class="k">Collected</div><div class="v">${U.inr(gp)}</div><div class="sub">${gt ? Math.round(gp / gt * 100) : 0}% of total</div></div>
        <div class="card accent-red"><div class="k">Outstanding</div><div class="v">${U.inr(gb)}</div><div class="sub">${defaulters} students with dues</div></div>
        <div class="card accent-amber"><div class="k">Collected Today</div><div class="v">${U.inr(todaySum)}</div><div class="sub">${todayPays.length} receipt(s) · in-app total ${U.inr(appCollected)}</div></div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Fee Category Summary</h2><span class="muted">mirrors the “SUMMARY” sheet</span></div>
        <div class="table-scroll"><table>
          <thead><tr><th>Fee Category</th><th class="t-right">Amount</th><th class="t-right">Received</th><th class="t-right">Receivable</th><th>Progress</th></tr></thead>
          <tbody>${catRows}</tbody>
          <tfoot><tr style="font-weight:700;background:#f8fafc">
            <td>TOTAL</td><td class="num">${U.inr(gt)}</td><td class="num" style="color:var(--green)">${U.inr(gp)}</td>
            <td class="num" style="color:var(--red)">${U.inr(gb)}</td><td></td></tr></tfoot>
        </table></div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Recent Payments</h2><a href="#/collections" class="btn sm">View all →</a></div>
        <div class="table-scroll"><table>
          <thead><tr><th>Date</th><th>Student</th><th>Mode</th><th class="t-right">Amount</th></tr></thead>
          <tbody>${recent}</tbody>
        </table></div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Collection by Grade</h2></div>
        <div class="table-scroll"><table>
          <thead><tr><th>Grade</th><th class="t-right">Students</th><th class="t-right">Total</th><th class="t-right">Paid</th><th class="t-right">Outstanding</th></tr></thead>
          <tbody>${gradeRows}</tbody>
        </table></div>
      </div>`;

    $$('[data-grade]').forEach(tr => tr.onclick = () => { location.hash = '#/students?grade=' + encodeURIComponent(tr.dataset.grade); });
    $$('[data-rcpt]').forEach(tr => tr.onclick = () => { const p = Store.payments.find(x => x.id === tr.dataset.rcpt); if (p) Receipt.open(p); });
  }

  /* -------------------------------------------------- Students list */
  let studentsState = { q: '', grade: '', status: '', sort: 'name' };
  function students(params) {
    if (params && params.grade != null) studentsState.grade = params.grade;
    const grades = Array.from(new Set(Store.students.map(s => s.grade).filter(Boolean))).sort();
    const gradeOpts = ['<option value="">All grades</option>']
      .concat(grades.map(g => `<option value="${U.esc(g)}"${studentsState.grade === g ? ' selected' : ''}>${U.esc(g)}</option>`)).join('');

    view().innerHTML = `
      <div class="page-head">
        <div><h1>Students</h1><p>${Store.students.length} enrolled · click a row to view & collect fees</p></div>
        <button class="btn" id="expStudents">⬇ Export CSV</button>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div class="toolbar">
            <input id="stuSearch" type="search" placeholder="Search name / ID / parent…" value="${U.esc(studentsState.q)}" style="min-width:220px" />
            <select id="stuGrade">${gradeOpts}</select>
            <select id="stuStatus">
              <option value="">All statuses</option>
              <option value="pending"${studentsState.status === 'pending' ? ' selected' : ''}>Pending</option>
              <option value="partial"${studentsState.status === 'partial' ? ' selected' : ''}>Partial</option>
              <option value="paid"${studentsState.status === 'paid' ? ' selected' : ''}>Fully paid</option>
            </select>
            <select id="stuSort">
              <option value="name"${studentsState.sort === 'name' ? ' selected' : ''}>Sort: Name</option>
              <option value="balance"${studentsState.sort === 'balance' ? ' selected' : ''}>Sort: Balance ↓</option>
              <option value="grade"${studentsState.sort === 'grade' ? ' selected' : ''}>Sort: Grade</option>
            </select>
          </div>
          <span class="muted" id="stuCount"></span>
        </div>
        <div class="table-scroll"><table>
          <thead><tr><th>Student</th><th>ID</th><th>Grade</th><th class="t-right">Total</th><th class="t-right">Paid</th><th class="t-right">Balance</th><th>Status</th></tr></thead>
          <tbody id="stuBody"></tbody>
        </table></div>
      </div>`;

    function apply() {
      const q = studentsState.q.trim().toLowerCase();
      let rows = Store.students.filter(s => {
        if (studentsState.grade && s.grade !== studentsState.grade) return false;
        const t = Store.studentTotals(s);
        if (studentsState.status === 'paid' && !(t.total > 0 && t.balance <= 0)) return false;
        if (studentsState.status === 'pending' && !(t.balance >= t.total && t.total > 0)) return false;
        if (studentsState.status === 'partial' && !(t.balance > 0 && t.balance < t.total)) return false;
        if (q) {
          const hay = (s.name + ' ' + s.id + ' ' + (s.father || '') + ' ' + (s.contact || '')).toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
      rows.sort((a, b) => {
        if (studentsState.sort === 'balance') return Store.studentTotals(b).balance - Store.studentTotals(a).balance;
        if (studentsState.sort === 'grade') return (a.grade || '').localeCompare(b.grade || '') || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      $('#stuCount').textContent = rows.length + ' shown';
      $('#stuBody').innerHTML = rows.slice(0, 1000).map(s => {
        const t = Store.studentTotals(s);
        return `<tr class="clickable" data-id="${U.esc(s.id)}">
          <td><b>${U.esc(s.name)}</b><div class="muted" style="font-size:11px">${U.esc(s.father || '')}</div></td>
          <td class="mono">${U.esc(s.id)}</td><td>${U.esc(s.grade || '')}</td>
          <td class="num">${U.inr(t.total)}</td>
          <td class="num" style="color:var(--green)">${U.inr(t.paid)}</td>
          <td class="num" style="color:${t.balance > 0 ? 'var(--red)' : 'var(--muted)'};font-weight:600">${U.inr(t.balance)}</td>
          <td>${statusBadge(t.balance, t.total)}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="empty">No students match your filters.</td></tr>';
      $$('#stuBody [data-id]').forEach(tr => tr.onclick = () => location.hash = '#/student/' + encodeURIComponent(tr.dataset.id));
    }
    $('#stuSearch').oninput = U.debounce(e => { studentsState.q = e.target.value; apply(); }, 150);
    $('#stuGrade').onchange = e => { studentsState.grade = e.target.value; apply(); };
    $('#stuStatus').onchange = e => { studentsState.status = e.target.value; apply(); };
    $('#stuSort').onchange = e => { studentsState.sort = e.target.value; apply(); };
    $('#expStudents').onclick = exportStudentsCSV;
    apply();
  }

  function exportStudentsCSV() {
    const heads = Store.HEAD_ORDER;
    const header = ['Student ID', 'Name', 'Grade', 'Father', 'Contact', 'Discount']
      .concat(heads.flatMap(h => [Store.HEAD_LABELS[h] + ' Total', Store.HEAD_LABELS[h] + ' Paid', Store.HEAD_LABELS[h] + ' Bal']))
      .concat(['Grand Total', 'Grand Paid', 'Grand Balance']);
    const rows = [header];
    Store.students.forEach(s => {
      const t = Store.studentTotals(s);
      const r = [s.id, s.name, s.grade, s.father, s.contact, s.discount];
      heads.forEach(h => { const f = s.fees[h] || {}; r.push(f.total || 0, f.paid || 0, f.balance || 0); });
      r.push(t.total, t.paid, t.balance);
      rows.push(r);
    });
    U.download('akb_students_fees.csv', U.toCSV(rows), 'text/csv');
    U.toast('Exported students CSV', 'success');
  }

  /* -------------------------------------------------- Student detail */
  function studentDetail(id) {
    const s = Store.getStudent(id);
    if (!s) { view().innerHTML = `<div class="empty">Student not found. <a href="#/students">Back to list</a></div>`; return; }
    const t = Store.studentTotals(s);
    const info = [
      ['Student ID', s.id], ['Grade', s.grade], ['Class Teacher', s.classTeacher],
      ['Gender', s.gender], ['Date of Birth', s.dob ? U.fmtDate(s.dob) : ''], ['Age', s.age],
      ['Father', s.father], ['Mother', s.mother], ['Contact', s.contact],
      ['Religion', s.religion], ['Location', s.location], ['Transport', s.transportType],
      ['Vehicle / Bus', s.vehicle], ['Discount', s.discount ? (s.discount * 100).toFixed(0) + '%' : '—'],
      ['Admission', s.admission], ['Previous School', s.prevSchool]
    ].filter(r => r[1] !== '' && r[1] != null)
      .map(r => `<div class="row"><span class="lbl">${U.esc(r[0])}</span><span class="val">${U.esc(r[1])}</span></div>`).join('');

    const feeRows = Store.HEAD_ORDER.map(k => {
      const h = s.fees[k]; if (!h || (h.total === 0 && h.paid === 0)) return '';
      const pct = h.total ? Math.min(100, h.paid / h.total * 100) : 100;
      return `<tr>
        <td><b>${U.esc(h.label)}</b></td>
        <td class="num">${U.inr(h.total)}</td>
        <td class="num" style="color:var(--green)">${U.inr(h.paid)}</td>
        <td class="num" style="color:${h.balance > 0 ? 'var(--red)' : 'var(--muted)'};font-weight:600">${U.inr(h.balance)}</td>
        <td style="width:120px"><div class="progress"><span style="width:${pct}%"></span></div></td></tr>`;
    }).join('');

    const pays = Store.studentPayments(id);
    const payRows = pays.map(p => `
      <tr>
        <td>${U.fmtDate(p.date)}</td>
        <td class="mono">${U.esc(p.receiptNo)}</td>
        <td>${p.items.map(i => U.esc(i.label)).join(', ')}</td>
        <td><span class="pill-mode">${U.esc(p.mode)}</span></td>
        <td class="num" style="color:var(--green);font-weight:600">${U.inr(p.amount)}</td>
        <td class="t-right">
          <button class="btn sm" data-print="${p.id}">🖨️</button>
          <button class="btn sm danger" data-del="${p.id}">✕</button>
        </td></tr>`).join('')
      || '<tr><td colspan="6" class="empty">No payments recorded in the app for this student.</td></tr>';

    view().innerHTML = `
      <div class="page-head">
        <div class="flex gap" style="align-items:center">
          <a href="#/students" class="btn ghost sm">← Back</a>
          <div class="flex gap" style="align-items:center">
            <div class="avatar">${U.esc(U.initials(s.name))}</div>
            <div><h1 style="margin:0">${U.esc(s.name)}</h1><p>${U.esc(s.grade || '')} · ID ${U.esc(s.id)}</p></div>
          </div>
        </div>
        <button class="btn green" id="payBtn" ${t.balance <= 0 ? '' : ''}>🧾 Receive Payment</button>
      </div>

      <div class="cards">
        <div class="card accent-blue"><div class="k">Total Fees</div><div class="v">${U.inr(t.total)}</div></div>
        <div class="card accent-green"><div class="k">Paid</div><div class="v">${U.inr(t.paid)}</div></div>
        <div class="card ${t.balance > 0 ? 'accent-red' : 'accent-green'}"><div class="k">Balance</div><div class="v">${U.inr(t.balance)}</div></div>
      </div>

      <div class="detail-grid">
        <div class="panel">
          <div class="panel-head"><h2>Student Information</h2></div>
          <div class="panel-body pad"><div class="info-list">${info}</div></div>
        </div>
        <div>
          <div class="panel">
            <div class="panel-head"><h2>Fee Details</h2>${statusBadge(t.balance, t.total)}</div>
            <div class="table-scroll"><table>
              <thead><tr><th>Fee Head</th><th class="t-right">Total</th><th class="t-right">Paid</th><th class="t-right">Balance</th><th>Progress</th></tr></thead>
              <tbody>${feeRows}</tbody>
              <tfoot><tr style="font-weight:700;background:#f8fafc"><td>TOTAL</td><td class="num">${U.inr(t.total)}</td>
                <td class="num" style="color:var(--green)">${U.inr(t.paid)}</td>
                <td class="num" style="color:${t.balance > 0 ? 'var(--red)' : 'var(--muted)'}">${U.inr(t.balance)}</td><td></td></tr></tfoot>
            </table></div>
          </div>
          <div class="panel">
            <div class="panel-head"><h2>Payment History</h2></div>
            <div class="table-scroll"><table>
              <thead><tr><th>Date</th><th>Receipt</th><th>For</th><th>Mode</th><th class="t-right">Amount</th><th></th></tr></thead>
              <tbody>${payRows}</tbody>
            </table></div>
          </div>
        </div>
      </div>`;

    $('#payBtn').onclick = () => openPaymentModal(id);
    $$('[data-print]').forEach(b => b.onclick = () => { const p = Store.payments.find(x => x.id === b.dataset.print); if (p) Receipt.open(p); });
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this payment? The amount will be added back to the balance.')) return;
      await Store.deletePayment(b.dataset.del);
      U.toast('Payment deleted', 'success'); studentDetail(id);
    });
  }

  /* -------------------------------------------------- Payment modal */
  function openPaymentModal(studentId, presetHead) {
    const s = Store.getStudent(studentId);
    if (!s) return;
    const root = document.getElementById('modalRoot');
    const heads = Store.HEAD_ORDER.filter(k => { const h = s.fees[k]; return h && (h.total > 0 || h.paid > 0); });
    const rows = heads.map(k => {
      const h = s.fees[k];
      const paidoff = h.balance <= 0;
      return `<div class="fee-row ${paidoff ? 'paidoff' : ''}">
        <input type="checkbox" class="fh-chk" data-head="${k}" ${!paidoff ? 'checked' : ''} ${paidoff ? 'disabled' : ''}/>
        <div><div class="fh-label">${U.esc(h.label)}</div><div class="muted" style="font-size:11px">Paid ${U.inr(h.paid)} of ${U.inr(h.total)}</div></div>
        <div class="fh-bal">Bal ${U.inr(h.balance)}</div>
        <input type="number" class="fh-amt" data-head="${k}" min="0" step="1" value="${paidoff ? 0 : Math.max(0, h.balance)}" ${paidoff ? 'disabled' : ''}/>
      </div>`;
    }).join('') || '<div class="empty">This student has no outstanding fee heads.</div>';

    const entOpts = Store.ENTITIES.map(e => `<option>${U.esc(e)}</option>`).join('');
    const modeOpts = Store.MODES.map(m => `<option>${U.esc(m)}</option>`).join('');

    root.innerHTML = `
      <div class="modal-backdrop" id="payBackdrop">
        <div class="modal">
          <div class="modal-head"><h3>Receive Payment — ${U.esc(s.name)}</h3><button class="x-close" id="payClose">&times;</button></div>
          <div class="modal-body">
            <div class="muted" style="margin-bottom:10px">${U.esc(s.grade || '')} · ID ${U.esc(s.id)} · Outstanding <b style="color:var(--red)">${U.inr(Store.studentTotals(s).balance)}</b></div>
            <div id="feeRows">${rows}</div>
            <div class="grid3" style="margin-top:16px">
              <div class="field"><label>Date</label><input type="date" id="payDate" value="${U.todayISO()}"/></div>
              <div class="field"><label>Mode</label><select id="payMode">${modeOpts}</select></div>
              <div class="field"><label>Received in</label><select id="payEntity">${entOpts}</select></div>
            </div>
            <div class="field"><label>Remarks (optional)</label><input id="payRemarks" placeholder="e.g. cheque no., note"/></div>
            <div style="text-align:right;font-size:16px;font-weight:700;margin-top:6px">Total: <span id="payTotal" style="color:var(--green)">₹0</span></div>
          </div>
          <div class="modal-foot">
            <button class="btn" id="payCancel">Cancel</button>
            <button class="btn green" id="paySave">Save &amp; Print Receipt</button>
          </div>
        </div>
      </div>`;

    const close = () => { root.innerHTML = ''; };
    function recalc() {
      let tot = 0;
      $$('.fh-amt', root).forEach(inp => {
        const chk = $(`.fh-chk[data-head="${inp.dataset.head}"]`, root);
        if (chk && chk.checked && !inp.disabled) tot += Number(inp.value) || 0;
      });
      $('#payTotal', root).textContent = U.inr(tot);
      return tot;
    }
    $$('.fh-amt', root).forEach(i => i.oninput = recalc);
    $$('.fh-chk', root).forEach(c => c.onchange = () => {
      const inp = $(`.fh-amt[data-head="${c.dataset.head}"]`, root);
      inp.disabled = !c.checked; recalc();
    });
    recalc();
    $('#payClose', root).onclick = close;
    $('#payCancel', root).onclick = close;
    $('#payBackdrop', root).onclick = e => { if (e.target.id === 'payBackdrop') close(); };
    $('#paySave', root).onclick = async () => {
      const items = [];
      $$('.fh-amt', root).forEach(inp => {
        const chk = $(`.fh-chk[data-head="${inp.dataset.head}"]`, root);
        const amt = Number(inp.value) || 0;
        if (chk && chk.checked && amt > 0) items.push({ head: inp.dataset.head, amount: amt });
      });
      if (!items.length) { U.toast('Enter at least one amount', 'error'); return; }
      const rec = await Store.addPayment({
        studentId, date: $('#payDate', root).value, mode: $('#payMode', root).value,
        entity: $('#payEntity', root).value, remarks: $('#payRemarks', root).value, items
      });
      close();
      U.toast('Payment saved · ' + rec.receiptNo, 'success');
      Receipt.open(rec);
      // refresh underlying view
      if (location.hash.indexOf('#/student/') === 0) studentDetail(studentId);
      else Router.render();
    };
  }

  /* -------------------------------------------------- Collect (quick) */
  function collect() {
    view().innerHTML = `
      <div class="page-head"><div><h1>Receive Payment</h1><p>Search a student to record a fee payment</p></div></div>
      <div class="panel">
        <div class="panel-head"><div class="toolbar" style="width:100%">
          <input id="colSearch" type="search" placeholder="Type student name, ID, or parent name…" style="flex:1;min-width:240px" autofocus/>
        </div></div>
        <div class="table-scroll"><table>
          <thead><tr><th>Student</th><th>Grade</th><th class="t-right">Balance</th><th></th></tr></thead>
          <tbody id="colBody"></tbody>
        </table></div>
      </div>`;
    function apply(q) {
      q = (q || '').trim().toLowerCase();
      let rows = Store.students;
      if (q) rows = rows.filter(s => (s.name + ' ' + s.id + ' ' + (s.father || '') + ' ' + (s.contact || '')).toLowerCase().indexOf(q) >= 0);
      else rows = rows.filter(s => Store.studentTotals(s).balance > 0).sort((a, b) => Store.studentTotals(b).balance - Store.studentTotals(a).balance);
      $('#colBody').innerHTML = rows.slice(0, 60).map(s => {
        const t = Store.studentTotals(s);
        return `<tr><td class="clickable" data-open="${U.esc(s.id)}"><b>${U.esc(s.name)}</b><div class="muted" style="font-size:11px">ID ${U.esc(s.id)} · ${U.esc(s.father || '')}</div></td>
          <td>${U.esc(s.grade || '')}</td>
          <td class="num" style="color:${t.balance > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600">${U.inr(t.balance)}</td>
          <td class="t-right"><button class="btn green sm" data-pay="${U.esc(s.id)}">Collect</button></td></tr>`;
      }).join('') || '<tr><td colspan="4" class="empty">No match.</td></tr>';
      $$('[data-pay]').forEach(b => b.onclick = () => openPaymentModal(b.dataset.pay));
      $$('[data-open]').forEach(td => td.onclick = () => location.hash = '#/student/' + encodeURIComponent(td.dataset.open));
    }
    $('#colSearch').oninput = U.debounce(e => apply(e.target.value), 150);
    apply('');
  }

  /* -------------------------------------------------- Collections */
  let colState = { from: '', to: '', entity: '', mode: '' };
  function collections() {
    const pays = Store.payments;
    if (!colState.from && pays.length) {
      const dates = pays.map(p => p.date).sort();
      colState.from = dates[0]; colState.to = dates[dates.length - 1];
    }
    if (!colState.from) { colState.from = U.todayISO(); colState.to = U.todayISO(); }

    view().innerHTML = `
      <div class="page-head"><div><h1>Collections</h1><p>Payments recorded in the app · daily & entity summary</p></div>
        <button class="btn" id="expCol">⬇ Export CSV</button></div>
      <div class="panel"><div class="panel-head"><div class="toolbar">
        <label class="muted">From <input type="date" id="cFrom" value="${colState.from}"/></label>
        <label class="muted">To <input type="date" id="cTo" value="${colState.to}"/></label>
        <select id="cEntity"><option value="">All accounts</option>${Store.ENTITIES.map(e => `<option${colState.entity === e ? ' selected' : ''}>${U.esc(e)}</option>`).join('')}</select>
        <select id="cMode"><option value="">All modes</option>${Store.MODES.map(m => `<option${colState.mode === m ? ' selected' : ''}>${U.esc(m)}</option>`).join('')}</select>
      </div></div></div>
      <div id="colContent"></div>`;

    function isCash(m) { return m === 'Cash'; }
    function render() {
      const list = Store.payments.filter(p => {
        if (colState.from && p.date < colState.from) return false;
        if (colState.to && p.date > colState.to) return false;
        if (colState.entity && p.entity !== colState.entity) return false;
        if (colState.mode && p.mode !== colState.mode) return false;
        return true;
      }).sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));

      const total = list.reduce((a, p) => a + p.amount, 0);
      const cash = list.filter(p => isCash(p.mode)).reduce((a, p) => a + p.amount, 0);
      const online = total - cash;

      // by day
      const days = {};
      list.forEach(p => {
        days[p.date] = days[p.date] || { cash: 0, online: 0, total: 0, n: 0 };
        days[p.date].total += p.amount; days[p.date].n++;
        if (isCash(p.mode)) days[p.date].cash += p.amount; else days[p.date].online += p.amount;
      });
      const dayRows = Object.keys(days).sort().reverse().map(d => {
        const x = days[d];
        return `<tr><td>${U.fmtDate(d)}</td><td class="num">${U.inr(x.cash)}</td><td class="num">${U.inr(x.online)}</td>
          <td class="num" style="font-weight:700">${U.inr(x.total)}</td><td class="num">${x.n}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="empty">No collections in this range.</td></tr>';

      // by entity
      const ents = {};
      list.forEach(p => {
        ents[p.entity] = ents[p.entity] || { cash: 0, online: 0, total: 0 };
        ents[p.entity].total += p.amount;
        if (isCash(p.mode)) ents[p.entity].cash += p.amount; else ents[p.entity].online += p.amount;
      });
      const entRows = Object.keys(ents).sort().map(e => {
        const x = ents[e];
        return `<tr><td>${U.esc(e)}</td><td class="num">${U.inr(x.cash)}</td><td class="num">${U.inr(x.online)}</td><td class="num" style="font-weight:700">${U.inr(x.total)}</td></tr>`;
      }).join('') || '<tr><td colspan="4" class="empty">—</td></tr>';

      const txnRows = list.slice(0, 400).map(p => `
        <tr class="clickable" data-rcpt="${p.id}">
          <td>${U.fmtDate(p.date)}</td><td class="mono">${U.esc(p.receiptNo)}</td>
          <td>${U.esc(p.studentName)}<div class="muted" style="font-size:11px">${U.esc(p.grade || '')}</div></td>
          <td>${p.items.map(i => U.esc(i.label)).join(', ')}</td>
          <td><span class="pill-mode">${U.esc(p.mode)}</span></td>
          <td class="muted" style="font-size:12px">${U.esc(p.entity)}</td>
          <td class="num" style="color:var(--green);font-weight:600">${U.inr(p.amount)}</td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty">No transactions.</td></tr>';

      $('#colContent').innerHTML = `
        <div class="cards">
          <div class="card accent-green"><div class="k">Total Collected</div><div class="v">${U.inr(total)}</div><div class="sub">${list.length} receipts</div></div>
          <div class="card accent-blue"><div class="k">Cash</div><div class="v">${U.inr(cash)}</div></div>
          <div class="card accent-amber"><div class="k">Bank / Online</div><div class="v">${U.inr(online)}</div></div>
        </div>
        <div class="panel"><div class="panel-head"><h2>Daily Summary</h2></div>
          <div class="table-scroll"><table><thead><tr><th>Date</th><th class="t-right">Cash</th><th class="t-right">Bank/Online</th><th class="t-right">Total</th><th class="t-right">Receipts</th></tr></thead>
          <tbody>${dayRows}</tbody></table></div></div>
        <div class="panel"><div class="panel-head"><h2>By Account / Entity</h2></div>
          <div class="table-scroll"><table><thead><tr><th>Account</th><th class="t-right">Cash</th><th class="t-right">Bank/Online</th><th class="t-right">Total</th></tr></thead>
          <tbody>${entRows}</tbody></table></div></div>
        <div class="panel"><div class="panel-head"><h2>Transactions</h2><span class="muted">latest 400</span></div>
          <div class="table-scroll"><table><thead><tr><th>Date</th><th>Receipt</th><th>Student</th><th>For</th><th>Mode</th><th>Account</th><th class="t-right">Amount</th></tr></thead>
          <tbody>${txnRows}</tbody></table></div></div>`;
      $$('[data-rcpt]').forEach(tr => tr.onclick = () => { const p = Store.payments.find(x => x.id === tr.dataset.rcpt); if (p) Receipt.open(p); });
    }
    $('#cFrom').onchange = e => { colState.from = e.target.value; render(); };
    $('#cTo').onchange = e => { colState.to = e.target.value; render(); };
    $('#cEntity').onchange = e => { colState.entity = e.target.value; render(); };
    $('#cMode').onchange = e => { colState.mode = e.target.value; render(); };
    $('#expCol').onclick = () => {
      const list = Store.payments.filter(p => (!colState.from || p.date >= colState.from) && (!colState.to || p.date <= colState.to)
        && (!colState.entity || p.entity === colState.entity) && (!colState.mode || p.mode === colState.mode));
      const rows = [['Date', 'Receipt', 'Student ID', 'Student', 'Grade', 'For', 'Mode', 'Account', 'Amount']];
      list.forEach(p => rows.push([p.date, p.receiptNo, p.studentId, p.studentName, p.grade, p.items.map(i => i.label).join('; '), p.mode, p.entity, p.amount]));
      U.download('akb_collections.csv', U.toCSV(rows), 'text/csv');
      U.toast('Exported collections CSV', 'success');
    };
    render();
  }

  /* -------------------------------------------------- Reports */
  let repState = { grade: '', head: '', minBal: 1 };
  function reports() {
    const grades = Array.from(new Set(Store.students.map(s => s.grade).filter(Boolean))).sort();
    // category summary
    const cats = Store.HEAD_ORDER.map(k => {
      let total = 0, paid = 0;
      Store.students.forEach(s => { const h = s.fees[k]; if (h) { total += h.total; paid += h.paid; } });
      return { label: Store.HEAD_LABELS[k], total, paid, bal: total - paid };
    });
    const gt = cats.reduce((a, c) => a + c.total, 0), gp = cats.reduce((a, c) => a + c.paid, 0);

    view().innerHTML = `
      <div class="page-head"><div><h1>Reports</h1><p>Fee category summary & outstanding dues</p></div></div>
      <div class="panel"><div class="panel-head"><h2>Fee Category Summary</h2><button class="btn sm" id="expCat">⬇ CSV</button></div>
        <div class="table-scroll"><table><thead><tr><th>Category</th><th class="t-right">Amount</th><th class="t-right">Received</th><th class="t-right">Receivable</th><th class="t-right">% Collected</th></tr></thead>
        <tbody>${cats.map(c => `<tr><td>${U.esc(c.label)}</td><td class="num">${U.inr(c.total)}</td>
          <td class="num" style="color:var(--green)">${U.inr(c.paid)}</td>
          <td class="num" style="color:${c.bal > 0 ? 'var(--red)' : 'var(--muted)'}">${U.inr(c.bal)}</td>
          <td class="num">${c.total ? Math.round(c.paid / c.total * 100) : 0}%</td></tr>`).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#f8fafc"><td>TOTAL</td><td class="num">${U.inr(gt)}</td>
          <td class="num" style="color:var(--green)">${U.inr(gp)}</td><td class="num" style="color:var(--red)">${U.inr(gt - gp)}</td>
          <td class="num">${gt ? Math.round(gp / gt * 100) : 0}%</td></tr></tfoot></table></div></div>

      <div class="panel">
        <div class="panel-head"><h2>Outstanding Dues (Defaulters)</h2>
          <div class="toolbar">
            <select id="rGrade"><option value="">All grades</option>${grades.map(g => `<option${repState.grade === g ? ' selected' : ''}>${U.esc(g)}</option>`).join('')}</select>
            <select id="rHead"><option value="">Any fee head</option>${Store.HEAD_ORDER.map(k => `<option value="${k}"${repState.head === k ? ' selected' : ''}>${U.esc(Store.HEAD_LABELS[k])}</option>`).join('')}</select>
            <button class="btn sm" id="expDue">⬇ CSV</button>
          </div>
        </div>
        <div class="table-scroll"><table>
          <thead><tr><th>Student</th><th>Grade</th><th>Contact</th><th class="t-right">Total</th><th class="t-right">Paid</th><th class="t-right">Outstanding</th><th></th></tr></thead>
          <tbody id="dueBody"></tbody></table></div>
        <div class="panel-body pad" id="dueFoot"></div>
      </div>`;

    function dues() {
      let rows = Store.students.map(s => ({ s, t: Store.studentTotals(s) }));
      if (repState.head) rows = rows.filter(r => (r.s.fees[repState.head] || {}).balance > 0);
      else rows = rows.filter(r => r.t.balance > 0);
      if (repState.grade) rows = rows.filter(r => r.s.grade === repState.grade);
      rows.sort((a, b) => b.t.balance - a.t.balance);
      $('#dueBody').innerHTML = rows.slice(0, 1000).map(r => `
        <tr class="clickable" data-id="${U.esc(r.s.id)}">
          <td><b>${U.esc(r.s.name)}</b><div class="muted" style="font-size:11px">ID ${U.esc(r.s.id)}</div></td>
          <td>${U.esc(r.s.grade || '')}</td><td class="mono">${U.esc(r.s.contact || '')}</td>
          <td class="num">${U.inr(r.t.total)}</td><td class="num" style="color:var(--green)">${U.inr(r.t.paid)}</td>
          <td class="num" style="color:var(--red);font-weight:700">${U.inr(repState.head ? (r.s.fees[repState.head] || {}).balance : r.t.balance)}</td>
          <td class="t-right"><button class="btn green sm" data-pay="${U.esc(r.s.id)}">Collect</button></td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">No outstanding dues 🎉</td></tr>';
      const sum = rows.reduce((a, r) => a + (repState.head ? (r.s.fees[repState.head] || {}).balance : r.t.balance), 0);
      $('#dueFoot').innerHTML = `<b>${rows.length}</b> students · Total outstanding <b style="color:var(--red)">${U.inr(sum)}</b>`;
      $$('#dueBody [data-id]').forEach(tr => tr.onclick = e => { if (e.target.dataset.pay) return; location.hash = '#/student/' + encodeURIComponent(tr.dataset.id); });
      $$('#dueBody [data-pay]').forEach(b => b.onclick = ev => { ev.stopPropagation(); openPaymentModal(b.dataset.pay); });
    }
    $('#rGrade').onchange = e => { repState.grade = e.target.value; dues(); };
    $('#rHead').onchange = e => { repState.head = e.target.value; dues(); };
    $('#expCat').onclick = () => {
      const rows = [['Category', 'Amount', 'Received', 'Receivable']];
      cats.forEach(c => rows.push([c.label, c.total, c.paid, c.bal]));
      rows.push(['TOTAL', gt, gp, gt - gp]);
      U.download('akb_category_summary.csv', U.toCSV(rows), 'text/csv'); U.toast('Exported', 'success');
    };
    $('#expDue').onclick = () => {
      let rows = Store.students.map(s => ({ s, t: Store.studentTotals(s) })).filter(r => r.t.balance > 0);
      if (repState.grade) rows = rows.filter(r => r.s.grade === repState.grade);
      rows.sort((a, b) => b.t.balance - a.t.balance);
      const out = [['Student ID', 'Name', 'Grade', 'Father', 'Contact', 'Total', 'Paid', 'Outstanding']];
      rows.forEach(r => out.push([r.s.id, r.s.name, r.s.grade, r.s.father, r.s.contact, r.t.total, r.t.paid, r.t.balance]));
      U.download('akb_defaulters.csv', U.toCSV(out), 'text/csv'); U.toast('Exported defaulters', 'success');
    };
    dues();
  }

  /* -------------------------------------------------- Data & Backup */
  function data() {
    const totalPaid = Store.payments.reduce((a, p) => a + p.amount, 0);
    view().innerHTML = `
      <div class="page-head"><div><h1>Data &amp; Backup</h1><p>Backup, restore, and manage your data (stored locally in this browser)</p></div></div>
      <div class="cards">
        <div class="card accent-blue"><div class="k">Students</div><div class="v">${Store.students.length}</div></div>
        <div class="card accent-green"><div class="k">Payments Recorded</div><div class="v">${Store.payments.length}</div><div class="sub">${U.inr(totalPaid)} in app</div></div>
        <div class="card accent-amber"><div class="k">Receipts Issued</div><div class="v">${Store.meta.receiptSeq || 0}</div></div>
      </div>

      <div class="panel"><div class="panel-head"><h2>Backup &amp; Restore</h2></div>
        <div class="panel-body pad">
          <p class="muted">Your data lives only in this browser. Download a backup regularly, and restore it on another device or after clearing the browser.</p>
          <div class="flex gap wrap mt">
            <button class="btn primary" id="expJson">⬇ Download Full Backup (JSON)</button>
            <label class="btn" style="cursor:pointer">⬆ Restore from Backup<input type="file" id="impJson" accept="application/json" class="hidden"/></label>
            <button class="btn" id="expAllCsv">⬇ Students + Fees (CSV)</button>
          </div>
        </div>
      </div>

      <div class="panel"><div class="panel-head"><h2>Danger Zone</h2></div>
        <div class="panel-body pad">
          <p class="muted">Reset discards all app-recorded payments and reloads the original student list & balances from the bundled workbook data.</p>
          <button class="btn danger" id="resetBtn">↺ Reset to Original Workbook Data</button>
        </div>
      </div>`;

    $('#expJson').onclick = () => { U.download('akb_fees_backup_' + U.todayISO() + '.json', JSON.stringify(Store.exportAll()), 'application/json'); U.toast('Backup downloaded', 'success'); };
    $('#expAllCsv').onclick = exportStudentsCSV;
    $('#impJson').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const obj = JSON.parse(rd.result);
          if (!confirm('Restore will REPLACE all current data with the backup. Continue?')) return;
          await Store.importAll(obj);
          U.toast('Restored ' + Store.students.length + ' students', 'success');
          Router.render();
        } catch (err) { U.toast('Invalid backup: ' + err.message, 'error'); }
      };
      rd.readAsText(f);
    };
    $('#resetBtn').onclick = async () => {
      if (!confirm('This will DELETE all payments recorded in the app and reload original balances. Continue?')) return;
      await Store.resetToSeed(); U.toast('Reset complete', 'success'); Router.render();
    };
  }

  w.Views = { dashboard, students, studentDetail, collect, collections, reports, data, openPaymentModal };
})(window);
