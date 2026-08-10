/* ===== AKB Fee Collection — storage layer =====
   IndexedDB persistence with an in-memory cache so views can render
   synchronously. Falls back to localStorage if IndexedDB is unavailable.
*/
(function (w) {
  'use strict';

  // Safe storage: real localStorage when available, else an in-memory shim
  // (keeps the app working in sandboxed iframes / private-mode restrictions).
  var LS = (function () {
    try { var s = w['local' + 'Storage']; var t = '__akbtest'; s.setItem(t, '1'); s.removeItem(t); return s; }
    catch (e) {
      var m = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
        setItem: function (k, v) { m[k] = String(v); },
        removeItem: function (k) { delete m[k]; }
      };
    }
  })();

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
  // The 4 businesses, each issuing its own receipt with its own logo
  const BUSINESSES = {
    school: { key: 'school', name: 'AKB School of Excellence', sub: 'Senior Secondary CBSE School', logo: 'assets/img/logo-school.svg', color: '#7f1d1d', prefix: 'AKB' },
    sports: { key: 'sports', name: 'AKB Sports Academy', sub: 'One Team · One Passion · One Legacy', logo: 'assets/img/logo-sports.svg', color: '#7c1d2e', prefix: 'SA' },
    co: { key: 'co', name: 'AKB & Co', sub: 'School Supplies · Games · Playing Courts', logo: 'assets/img/logo-co.svg', color: '#1e3a8a', prefix: 'CO' },
    falcon: { key: 'falcon', name: 'Falcon Trading & Transport', sub: 'Transport Services', logo: 'assets/img/logo-falcon.svg', color: '#c2410c', prefix: 'FTT' }
  };
  const BUSINESS_ORDER = ['school', 'co', 'falcon', 'sports'];
  // fee head -> business key
  const HEAD_BUSINESS = {
    term: 'school', app_fees: 'school', extra_curricular: 'school',
    supplies: 'co', uniform: 'co', transport: 'falcon', evening_sports: 'sports'
  };
  // legacy: fee head -> business display name (used by Chairman Dashboard)
  const BUSINESS = {};
  Object.keys(HEAD_BUSINESS).forEach(k => { BUSINESS[k] = BUSINESSES[HEAD_BUSINESS[k]].name; });

  let db = null;
  let useIDB = true;

  const Store = {
    students: [],   // in-memory cache
    payments: [],
    users: [],
    meta: {},
    currentUser: null,
    ENTITIES, MODES, HEAD_ORDER, HEAD_LABELS, BUSINESS, BUSINESSES, BUSINESS_ORDER, HEAD_BUSINESS,

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
        this.students = JSON.parse(LS.getItem('akb_students') || '[]');
        this.payments = JSON.parse(LS.getItem('akb_payments') || '[]');
        this.users = JSON.parse(LS.getItem('akb_users') || '[]');
        this.meta = JSON.parse(LS.getItem('akb_meta') || '{}');
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
        LS.removeItem('akb_students');
        LS.removeItem('akb_payments');
        LS.removeItem('akb_meta');
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
        LS.setItem('akb_students', JSON.stringify(this.students));
      }
    },
    async persistStudent(s) {
      if (useIDB) await idbPut('students', s);
      else LS.setItem('akb_students', JSON.stringify(this.students));
    },
    async persistMeta() {
      if (useIDB) await idbPut('meta', { id: 'meta', value: this.meta });
      else LS.setItem('akb_meta', JSON.stringify(this.meta));
    },

    /* ---- payments ----
       A single collection is SPLIT by business, producing one receipt (and one
       payment record) per business, each with its own logo & receipt number. */
    async addPayment(p) {
      // p: {studentId, date, mode, remarks, items:[{head,amount}]}
      const student = this.getStudent(p.studentId);
      if (!student) throw new Error('Student not found');
      const year = (this.meta.year || '2026-2027').split('-')[0];
      this.meta.seqByBiz = this.meta.seqByBiz || {};
      const createdAt = new Date().toISOString();
      const groupId = U.uid(); // ties the split receipts of one transaction together

      // group valid items by business
      const groups = {};
      p.items.forEach(it => {
        const amt = Number(it.amount) || 0; if (amt <= 0) return;
        const biz = HEAD_BUSINESS[it.head] || 'school';
        (groups[biz] = groups[biz] || []).push({ head: it.head, label: HEAD_LABELS[it.head] || it.head, amount: amt });
        const h = student.fees[it.head];
        if (h) {
          h.paid = (Number(h.paid) || 0) + amt;
          // ad-hoc fee (e.g. student newly joins Evening Sports/an event): bill it
          // on the spot so the balance never goes negative.
          h.total = Math.max(Number(h.total) || 0, h.paid);
        }
      });
      this.recompute(student);

      const records = [];
      BUSINESS_ORDER.concat(Object.keys(groups)).filter((v, i, a) => a.indexOf(v) === i).forEach(biz => {
        const items = groups[biz]; if (!items || !items.length) return;
        const B = BUSINESSES[biz];
        this.meta.seqByBiz[biz] = (this.meta.seqByBiz[biz] || 0) + 1;
        const seq = this.meta.seqByBiz[biz];
        const rec = {
          id: U.uid(), groupId,
          receiptNo: B.prefix + '/' + year + '/' + String(seq).padStart(5, '0'), seq,
          business: biz, businessName: B.name,
          studentId: student.id, studentName: student.name, grade: student.grade,
          date: p.date || U.todayISO(), mode: p.mode || 'Cash', remarks: p.remarks || '',
          items, amount: items.reduce((a, x) => a + x.amount, 0), createdAt
        };
        records.push(rec); this.payments.push(rec);
      });
      // keep a running overall receipt count for stats
      this.meta.receiptSeq = (this.meta.receiptSeq || 0) + records.length;

      if (useIDB) { for (const r of records) await idbPut('payments', r); await idbPut('students', student); }
      else { LS.setItem('akb_payments', JSON.stringify(this.payments)); LS.setItem('akb_students', JSON.stringify(this.students)); }
      await this.persistMeta();
      return records; // array — one per business
    },
    businessOfHead(k) { return HEAD_BUSINESS[k] || 'school'; },

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
      else { LS.setItem('akb_payments', JSON.stringify(this.payments)); LS.setItem('akb_students', JSON.stringify(this.students)); }
    },

    studentPayments(id) {
      return this.payments.filter(p => p.studentId === id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    /* ---- students: add ---- */
    suggestId() {
      const nums = this.students.map(s => String(s.id).replace(/\D/g, '')).filter(Boolean);
      if (!nums.length) return '25260001';
      // use the most common id length so a stray long/short id doesn't skew it
      const byLen = {};
      nums.forEach(n => { byLen[n.length] = (byLen[n.length] || 0) + 1; });
      const modeLen = Object.keys(byLen).sort((a, b) => byLen[b] - byLen[a])[0];
      let max = 0;
      nums.forEach(n => { if (String(n.length) === modeLen) { const v = parseInt(n, 10); if (v > max) max = v; } });
      return String(max + 1);
    },
    async addStudent(data) {
      const id = String(data.id || '').trim();
      if (!id) throw new Error('Student ID is required');
      if (this.getStudent(id)) throw new Error('Student ID "' + id + '" already exists');
      if (!data.name || !String(data.name).trim()) throw new Error('Student name is required');
      const fees = {};
      HEAD_ORDER.forEach(k => {
        const total = Number((data.fees && data.fees[k]) || 0) || 0;
        fees[k] = { label: HEAD_LABELS[k], total, paid: 0, balance: total };
      });
      const s = {
        id, name: String(data.name).trim(), grade: data.grade || '', classTeacher: data.classTeacher || '',
        gender: data.gender || '', dob: data.dob || '', age: data.age || '', prevSchool: data.prevSchool || '',
        father: data.father || '', mother: data.mother || '', location: data.location || '', dropLocation: data.dropLocation || '',
        transportType: data.transportType || '', vehicle: data.vehicle || '', contact: data.contact || '',
        religion: data.religion || '', discount: Number(data.discount) || 0, admission: data.admission || 'NEW',
        sportsActivity: data.sportsActivity || '', marks: { english: '', maths: '', science: '' }, fees
      };
      await this.saveStudent(s);
      return s;
    },

    /* ---- students: edit ---- */
    async saveStudent(s) {
      this.recompute(s);
      const i = this.students.findIndex(x => x.id === s.id);
      if (i < 0) this.students.push(s);
      if (useIDB) await idbPut('students', s);
      else LS.setItem('akb_students', JSON.stringify(this.students));
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
      else LS.setItem('akb_users', JSON.stringify(this.users));
    },
    async persistUsers() {
      if (useIDB) { await idbClear('users'); await idbPutMany('users', this.users); }
      else LS.setItem('akb_users', JSON.stringify(this.users));
    },
    // session (persisted so a refresh keeps you logged in on this device)
    setSession(u) {
      this.currentUser = u ? { username: u.username, role: u.role, name: u.name } : null;
      if (u) LS.setItem('akb_session', JSON.stringify({ username: u.username, ts: Date.now() }));
      else LS.removeItem('akb_session');
    },
    restoreSession() {
      try {
        const s = JSON.parse(LS.getItem('akb_session') || 'null');
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
        LS.setItem('akb_students', JSON.stringify(this.students));
        LS.setItem('akb_payments', JSON.stringify(this.payments));
        LS.setItem('akb_meta', JSON.stringify(this.meta));
        if (Array.isArray(obj.users) && obj.users.length) LS.setItem('akb_users', JSON.stringify(this.users));
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
