/* ===== AKB Fee Collection — storage layer =====
   IndexedDB persistence with an in-memory cache so views can render
   synchronously. Falls back to localStorage if IndexedDB is unavailable.
*/
(function (w) {
  'use strict';

  const DB_NAME = 'akb_fees';
  const DB_VERSION = 2;
  const STORES = ['students', 'payments', 'meta', 'users'];

  // Business entities / bank accounts (from PAYMENT COLLECTION SUMMARY REPO)
  const ENTITIES = [
    'AKB School of Excellence - HDFC',
    'AKB School of Excellence - IB',
    'AKB & CO',
    'Falcon Trading & Transport',
    'Summer Camp'
  ];
  const MODES = ['Cash', 'G.Pay', 'Bank', 'Cheque', 'Card'];
  // Ordered fee heads for consistent display (matches the Chairman Dashboard)
  const HEAD_ORDER = ['term', 'supplies', 'app_fees', 'uniform', 'transport', 'extra_curricular', 'evening_sports'];
  const HEAD_LABELS = {
    term: 'Terms Fees', supplies: 'School Supplies', app_fees: 'App Fees Paid',
    uniform: 'Uniform & Accessories', transport: 'Transport Fees',
    extra_curricular: 'Extra Curricular Fees', evening_sports: 'Evening Sports'
  };
  // Business owner per fee head (from Chairman Dashboard "BUSINESS CATEGORIES")
  const BUSINESS = {
    term: 'AKB School of Excellence', supplies: 'AKB & Co', app_fees: 'AKB School of Excellence',
    uniform: 'AKB & Co', transport: 'Falcon Trading & Transport',
    extra_curricular: 'AKB School of Excellence', evening_sports: 'AKB School of Excellence'
  };

  let db = null;
  let useIDB = true;

  const Store = {
    students: [],   // in-memory cache
    payments: [],
    users: [],
    meta: {},
    currentUser: null,
    ENTITIES, MODES, HEAD_ORDER, HEAD_LABELS, BUSINESS,

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
      if (!this.users.length) {
        await this.seedUsers();
      }
      // derive computed totals once
      this.recomputeAll();
      return this;
    },

    async load() {
      if (useIDB) {
        this.students = await idbAll('students');
        this.payments = await idbAll('payments');
        this.users = await idbAll('users');
        const metaRows = await idbAll('meta');
        this.meta = (metaRows[0] && metaRows[0].value) || {};
      } else {
        this.students = JSON.parse(localStorage.getItem('akb_students') || '[]');
        this.payments = JSON.parse(localStorage.getItem('akb_payments') || '[]');
        this.users = JSON.parse(localStorage.getItem('akb_users') || '[]');
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

    /* ---- students: edit ---- */
    async saveStudent(s) {
      this.recompute(s);
      const i = this.students.findIndex(x => x.id === s.id);
      if (i < 0) this.students.push(s);
      if (useIDB) await idbPut('students', s);
      else localStorage.setItem('akb_students', JSON.stringify(this.students));
    },

    /* ---- users & auth (client-side gate) ---- */
    async seedUsers() {
      const defs = [
        { username: 'admin', role: 'admin', pass: 'admin@123', name: 'Administrator' },
        { username: 'account1', role: 'account', pass: 'account1@123', name: 'Account 1' },
        { username: 'account2', role: 'account', pass: 'account2@123', name: 'Account 2' }
      ];
      this.users = [];
      for (const d of defs) {
        const salt = randSalt();
        this.users.push({
          username: d.username, role: d.role, name: d.name,
          salt, hash: await pbkdf(d.pass, salt), mustChange: true,
          createdAt: new Date().toISOString()
        });
      }
      await this.persistUsers();
    },
    getUser(username) { return this.users.find(u => u.username.toLowerCase() === String(username).toLowerCase()); },
    async verifyLogin(username, password) {
      const u = this.getUser(username);
      if (!u) return null;
      const h = await pbkdf(password, u.salt);
      return h === u.hash ? u : null;
    },
    async setPassword(username, password) {
      const u = this.getUser(username);
      if (!u) throw new Error('User not found');
      u.salt = randSalt();
      u.hash = await pbkdf(password, u.salt);
      u.mustChange = false;
      await this.persistUsers();
    },
    async addUser({ username, role, name, password }) {
      username = String(username || '').trim();
      if (!username) throw new Error('Username required');
      if (this.getUser(username)) throw new Error('Username already exists');
      if (!password || password.length < 4) throw new Error('Password too short (min 4)');
      const salt = randSalt();
      this.users.push({
        username, role: role === 'admin' ? 'admin' : 'account', name: name || username,
        salt, hash: await pbkdf(password, salt), mustChange: false, createdAt: new Date().toISOString()
      });
      await this.persistUsers();
    },
    async updateUserRole(username, role) {
      const u = this.getUser(username); if (!u) return;
      u.role = role === 'admin' ? 'admin' : 'account';
      await this.persistUsers();
    },
    async deleteUser(username) {
      const admins = this.users.filter(u => u.role === 'admin');
      const target = this.getUser(username);
      if (target && target.role === 'admin' && admins.length <= 1) throw new Error('Cannot delete the last admin');
      this.users = this.users.filter(u => u.username !== username);
      if (useIDB) await idbDelete('users', username);
      else localStorage.setItem('akb_users', JSON.stringify(this.users));
    },
    async persistUsers() {
      if (useIDB) { await idbClear('users'); await idbPutMany('users', this.users); }
      else localStorage.setItem('akb_users', JSON.stringify(this.users));
    },
    // session (persisted so a refresh keeps you logged in on this device)
    setSession(u) {
      this.currentUser = u ? { username: u.username, role: u.role, name: u.name } : null;
      if (u) localStorage.setItem('akb_session', JSON.stringify({ username: u.username, ts: Date.now() }));
      else localStorage.removeItem('akb_session');
    },
    restoreSession() {
      try {
        const s = JSON.parse(localStorage.getItem('akb_session') || 'null');
        if (!s) return null;
        const u = this.getUser(s.username);
        if (u) { this.currentUser = { username: u.username, role: u.role, name: u.name }; return this.currentUser; }
      } catch (e) {}
      return null;
    },
    isAdmin() { return this.currentUser && this.currentUser.role === 'admin'; },

    /* ---- backup ---- */
    exportAll(includeUsers) {
      const o = { app: 'akb-fees', version: 2, exportedAt: new Date().toISOString(),
        meta: this.meta, students: this.students, payments: this.payments };
      if (includeUsers) o.users = this.users;
      return o;
    },
    async importAll(obj) {
      if (!obj || !Array.isArray(obj.students)) throw new Error('Invalid backup file');
      this.students = obj.students.map(normalizeStudent);
      this.payments = Array.isArray(obj.payments) ? obj.payments : [];
      this.meta = obj.meta || { seeded: true, receiptSeq: 0 };
      this.meta.seeded = true;
      if (Array.isArray(obj.users) && obj.users.length) this.users = obj.users;
      if (useIDB) {
        await idbClear('students'); await idbClear('payments'); await idbClear('meta');
        await idbPutMany('students', this.students);
        await idbPutMany('payments', this.payments);
        await idbPut('meta', { id: 'meta', value: this.meta });
        if (Array.isArray(obj.users) && obj.users.length) { await idbClear('users'); await idbPutMany('users', this.users); }
      } else {
        localStorage.setItem('akb_students', JSON.stringify(this.students));
        localStorage.setItem('akb_payments', JSON.stringify(this.payments));
        localStorage.setItem('akb_meta', JSON.stringify(this.meta));
        if (Array.isArray(obj.users) && obj.users.length) localStorage.setItem('akb_users', JSON.stringify(this.users));
      }
      this.recomputeAll();
    }
  };

  /* password hashing via Web Crypto (PBKDF2-SHA256). Falls back to a
     lightweight hash if SubtleCrypto is unavailable (e.g. insecure origin). */
  function randSalt() {
    const a = new Uint8Array(16);
    (w.crypto || {}).getRandomValues ? w.crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = (i * 131 + 7) & 255);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function pbkdf(password, saltHex) {
    try {
      const enc = new TextEncoder();
      const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
      return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // fallback (non-crypto) — still salted; only used if Web Crypto is missing
      let h = 2166136261 >>> 0; const str = saltHex + '|' + password;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return 'fb' + h.toString(16);
    }
  }

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
        if (!d.objectStoreNames.contains('users')) d.createObjectStore('users', { keyPath: 'username' });
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
