/* ===== AKB Fee Collection — storage layer =====
   IndexedDB persistence with an in-memory cache so views can render
   synchronously. Falls back to localStorage if IndexedDB is unavailable.
*/
(function (w) {
  'use strict';

  const DB_NAME = 'akb_fees';
  const DB_VERSION = 1;
  const STORES = ['students', 'payments', 'meta'];

  // Business entities / bank accounts (from PAYMENT COLLECTION SUMMARY REPO)
  const ENTITIES = [
    'AKB School of Excellence - HDFC',
    'AKB School of Excellence - IB',
    'AKB & CO',
    'Falcon Trading & Transport',
    'Summer Camp'
  ];
  const MODES = ['Cash', 'G.Pay', 'Bank', 'Cheque', 'Card'];
  // Ordered fee heads for consistent display
  const HEAD_ORDER = ['term', 'supplies', 'uniform', 'transport', 'summer_camp', 'app_fees'];
  const HEAD_LABELS = {
    term: 'Term Fees', supplies: 'School Supplies', uniform: 'Uniform & Accessories',
    transport: 'Transport Fees', summer_camp: 'Summer Camp', app_fees: 'App Fees'
  };

  let db = null;
  let useIDB = true;

  const Store = {
    students: [],   // in-memory cache
    payments: [],
    meta: {},
    ENTITIES, MODES, HEAD_ORDER, HEAD_LABELS,

    async init() {
      try {
        db = await openDB();
      } catch (e) {
        console.warn('IndexedDB unavailable, using localStorage', e);
        useIDB = false;
      }
      await this.load();
      if (!this.meta.seeded) {
        await this.seed();
      }
      // derive computed totals once
      this.recomputeAll();
      return this;
    },

    async load() {
      if (useIDB) {
        this.students = await idbAll('students');
        this.payments = await idbAll('payments');
        const metaRows = await idbAll('meta');
        this.meta = (metaRows[0] && metaRows[0].value) || {};
      } else {
        this.students = JSON.parse(localStorage.getItem('akb_students') || '[]');
        this.payments = JSON.parse(localStorage.getItem('akb_payments') || '[]');
        this.meta = JSON.parse(localStorage.getItem('akb_meta') || '{}');
      }
    },

    async seed() {
      const seed = w.__AKB_SEED__ || { students: [] };
      this.students = (seed.students || []).map(s => normalizeStudent(s));
      this.payments = [];
      this.meta = {
        seeded: true,
        school: seed.school || 'AKB School of Excellence',
        year: seed.year || '2026-2027',
        receiptSeq: 0,
        seededAt: U.todayISO()
      };
      await this.persistStudents();
      await this.persistMeta();
      U.toast('Loaded ' + this.students.length + ' students from workbook', 'success');
    },

    async resetToSeed() {
      if (useIDB) {
        await idbClear('students'); await idbClear('payments'); await idbClear('meta');
      } else {
        localStorage.removeItem('akb_students');
        localStorage.removeItem('akb_payments');
        localStorage.removeItem('akb_meta');
      }
      this.meta = {};
      await this.seed();
      this.recomputeAll();
    },

    /* ---- students ---- */
    getStudent(id) { return this.students.find(s => s.id === id); },

    studentTotals(s) {
      let total = 0, paid = 0;
      HEAD_ORDER.forEach(k => {
        const h = s.fees[k]; if (!h) return;
        total += Number(h.total) || 0; paid += Number(h.paid) || 0;
      });
      return { total, paid, balance: total - paid };
    },

    recompute(s) {
      HEAD_ORDER.forEach(k => {
        const h = s.fees[k]; if (!h) return;
        h.balance = Math.round(((Number(h.total) || 0) - (Number(h.paid) || 0)) * 100) / 100;
      });
    },
    recomputeAll() { this.students.forEach(s => this.recompute(s)); },

    async persistStudents() {
      if (useIDB) {
        await idbPutMany('students', this.students);
      } else {
        localStorage.setItem('akb_students', JSON.stringify(this.students));
      }
    },
    async persistStudent(s) {
      if (useIDB) await idbPut('students', s);
      else localStorage.setItem('akb_students', JSON.stringify(this.students));
    },
    async persistMeta() {
      if (useIDB) await idbPut('meta', { id: 'meta', value: this.meta });
      else localStorage.setItem('akb_meta', JSON.stringify(this.meta));
    },

    /* ---- payments ---- */
    async addPayment(p) {
      // p: {studentId, date, mode, entity, remarks, items:[{head,amount}]}
      const student = this.getStudent(p.studentId);
      if (!student) throw new Error('Student not found');
      this.meta.receiptSeq = (this.meta.receiptSeq || 0) + 1;
      const seq = this.meta.receiptSeq;
      const receiptNo = 'AKB/' + (this.meta.year || '2026-2027').split('-')[0] + '/' +
        String(seq).padStart(5, '0');
      let amount = 0;
      p.items.forEach(it => {
        const amt = Number(it.amount) || 0;
        if (amt <= 0) return;
        amount += amt;
        const h = student.fees[it.head];
        if (h) { h.paid = (Number(h.paid) || 0) + amt; }
      });
      this.recompute(student);
      const rec = {
        id: U.uid(), receiptNo, seq,
        studentId: student.id, studentName: student.name, grade: student.grade,
        date: p.date || U.todayISO(),
        mode: p.mode || 'Cash', entity: p.entity || ENTITIES[0],
        remarks: p.remarks || '',
        items: p.items.filter(it => (Number(it.amount) || 0) > 0)
          .map(it => ({ head: it.head, label: HEAD_LABELS[it.head] || it.head, amount: Number(it.amount) })),
        amount, createdAt: new Date().toISOString()
      };
      this.payments.push(rec);
      if (useIDB) { await idbPut('payments', rec); await idbPut('students', student); }
      else { localStorage.setItem('akb_payments', JSON.stringify(this.payments)); localStorage.setItem('akb_students', JSON.stringify(this.students)); }
      await this.persistMeta();
      return rec;
    },

    async deletePayment(id) {
      const idx = this.payments.findIndex(p => p.id === id);
      if (idx < 0) return;
      const rec = this.payments[idx];
      const student = this.getStudent(rec.studentId);
      if (student) {
        rec.items.forEach(it => {
          const h = student.fees[it.head];
          if (h) h.paid = Math.max(0, (Number(h.paid) || 0) - (Number(it.amount) || 0));
        });
        this.recompute(student);
        if (useIDB) await idbPut('students', student);
      }
      this.payments.splice(idx, 1);
      if (useIDB) await idbDelete('payments', id);
      else { localStorage.setItem('akb_payments', JSON.stringify(this.payments)); localStorage.setItem('akb_students', JSON.stringify(this.students)); }
    },

    studentPayments(id) {
      return this.payments.filter(p => p.studentId === id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    /* ---- backup ---- */
    exportAll() {
      return { app: 'akb-fees', version: 1, exportedAt: new Date().toISOString(),
        meta: this.meta, students: this.students, payments: this.payments };
    },
    async importAll(obj) {
      if (!obj || !Array.isArray(obj.students)) throw new Error('Invalid backup file');
      this.students = obj.students.map(normalizeStudent);
      this.payments = Array.isArray(obj.payments) ? obj.payments : [];
      this.meta = obj.meta || { seeded: true, receiptSeq: 0 };
      this.meta.seeded = true;
      if (useIDB) {
        await idbClear('students'); await idbClear('payments'); await idbClear('meta');
        await idbPutMany('students', this.students);
        await idbPutMany('payments', this.payments);
        await idbPut('meta', { id: 'meta', value: this.meta });
      } else {
        localStorage.setItem('akb_students', JSON.stringify(this.students));
        localStorage.setItem('akb_payments', JSON.stringify(this.payments));
        localStorage.setItem('akb_meta', JSON.stringify(this.meta));
      }
      this.recomputeAll();
    }
  };

  /* ---------- helpers ---------- */
  function normalizeStudent(s) {
    s = Object.assign({}, s);
    s.fees = s.fees || {};
    HEAD_ORDER.forEach(k => {
      const h = s.fees[k] || { label: HEAD_LABELS[k], total: 0, paid: 0, balance: 0 };
      h.total = Number(h.total) || 0;
      h.paid = Number(h.paid) || 0;
      h.label = h.label || HEAD_LABELS[k];
      h.balance = Math.round((h.total - h.paid) * 100) / 100;
      s.fees[k] = h;
    });
    return s;
  }

  /* ---------- IndexedDB primitives ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!w.indexedDB) return reject(new Error('no idb'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('students')) d.createObjectStore('students', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('payments')) d.createObjectStore('payments', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function idbAll(store) {
    return new Promise((res, rej) => { const r = tx(store, 'readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
  }
  function idbPut(store, val) {
    return new Promise((res, rej) => { const r = tx(store, 'readwrite').put(val); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  }
  function idbPutMany(store, arr) {
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite'); const os = t.objectStore(store);
      arr.forEach(v => os.put(v));
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  }
  function idbDelete(store, key) {
    return new Promise((res, rej) => { const r = tx(store, 'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  }
  function idbClear(store) {
    return new Promise((res, rej) => { const r = tx(store, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  }

  w.Store = Store;
})(window);
