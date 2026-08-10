/* ===== AKB Fee Collection — receipt rendering & printing ===== */
(function (w) {
  'use strict';

  function html(rec) {
    const s = Store.getStudent(rec.studentId) || {};
    const totals = s.fees ? Store.studentTotals(s) : { balance: 0 };
    const rows = rec.items.map(it =>
      `<tr><td>${U.esc(it.label)}</td><td class="num">${U.inr(it.amount)}</td></tr>`).join('');
    return `
    <div class="receipt" style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:26px 30px;border:1px solid #e2e8f0;border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:14px">
        <div>
          <div style="font-size:22px;font-weight:800;color:#1d4ed8;letter-spacing:.5px">AKB School of Excellence</div>
          <div style="font-size:12px;color:#555">Fee Payment Receipt &middot; Academic Year ${U.esc(Store.meta.year || '2026-2027')}</div>
        </div>
        <div style="width:56px;height:56px;border-radius:10px;background:#1d4ed8;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px">AKB</div>
      </div>

      <table style="width:100%;font-size:13px;margin-bottom:14px">
        <tr>
          <td style="padding:3px 0"><b>Receipt No:</b> ${U.esc(rec.receiptNo)}</td>
          <td style="padding:3px 0;text-align:right"><b>Date:</b> ${U.fmtDate(rec.date)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0"><b>Student:</b> ${U.esc(rec.studentName)}</td>
          <td style="padding:3px 0;text-align:right"><b>Student ID:</b> ${U.esc(rec.studentId)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0"><b>Grade:</b> ${U.esc(rec.grade || s.grade || '')}</td>
          <td style="padding:3px 0;text-align:right"><b>Received in:</b> ${U.esc(rec.entity)}</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="text-align:left;padding:8px 10px;border:1px solid #e2e8f0">Fee Head</th>
            <th style="text-align:right;padding:8px 10px;border:1px solid #e2e8f0">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.replace(/<td/g, '<td style="padding:8px 10px;border:1px solid #e2e8f0"')}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;background:#eff6ff">
            <td style="padding:8px 10px;border:1px solid #e2e8f0">Total Paid</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right">${U.inr(rec.amount)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="font-size:12px;color:#333;margin:10px 0 4px"><b>In words:</b> ${U.esc(U.inWords(rec.amount))}</div>
      <div style="font-size:12px;color:#333;margin-bottom:2px"><b>Payment mode:</b> ${U.esc(rec.mode)}${rec.remarks ? ' &middot; ' + U.esc(rec.remarks) : ''}</div>
      <div style="font-size:12px;color:#b91c1c;margin-bottom:16px"><b>Remaining balance for student:</b> ${U.inr(totals.balance)}</div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:34px">
        <div style="font-size:11px;color:#777">This is a computer-generated receipt.</div>
        <div style="text-align:center;font-size:12px">
          <div style="border-top:1px solid #333;padding-top:4px;width:150px">Authorised Signatory</div>
        </div>
      </div>
    </div>`;
  }

  function open(rec) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop" id="rcptBackdrop">
        <div class="modal wide">
          <div class="modal-head">
            <h3>Payment Receipt</h3>
            <button class="x-close" id="rcptClose">&times;</button>
          </div>
          <div class="modal-body">${html(rec)}</div>
          <div class="modal-foot no-print">
            <button class="btn" id="rcptCloseBtn">Close</button>
            <button class="btn primary" id="rcptPrint">🖨️ Print / Save PDF</button>
          </div>
        </div>
      </div>`;
    const close = () => { root.innerHTML = ''; };
    document.getElementById('rcptClose').onclick = close;
    document.getElementById('rcptCloseBtn').onclick = close;
    document.getElementById('rcptPrint').onclick = () => window.print();
    document.getElementById('rcptBackdrop').onclick = (e) => { if (e.target.id === 'rcptBackdrop') close(); };
  }

  w.Receipt = { html, open };
})(window);
