const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=');
      if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g, '');
    }
  });
}

const p = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306
});

async function runDeleteTest() {
  console.log('--- Testing MySQL Student Delete ---');
  const dummyId = 'TEST-DELETE-9999';

  // 1. Insert dummy student
  await p.query('INSERT INTO students (id, name, grade) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [dummyId, 'DUMMY FOR DELETE TEST', 'Grade 10']);
  console.log('Dummy student inserted:', dummyId);

  // 2. Verify existence
  const [chk1] = await p.query('SELECT id, name FROM students WHERE id = ?', [dummyId]);
  console.log('Before delete:', chk1);

  // 3. Perform DELETE queries
  await p.query('DELETE FROM student_fees WHERE student_id = ?', [dummyId]);
  await p.query('DELETE FROM students WHERE id = ?', [dummyId]);
  console.log('Delete query executed.');

  // 4. Verify removal
  const [chk2] = await p.query('SELECT id, name FROM students WHERE id = ?', [dummyId]);
  console.log('After delete:', chk2);

  await p.end();
}

runDeleteTest();
