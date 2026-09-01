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

async function runTest() {
  console.log('--- Testing MySQL Student Name Update ---');
  console.log('Host:', process.env.MYSQL_HOST, 'Database:', process.env.MYSQL_DATABASE);

  // 1. Get current record
  const [rowsBefore] = await p.query('SELECT id, name FROM students LIMIT 1');
  if (!rowsBefore.length) {
    console.error('No students found in DB!');
    await p.end();
    return;
  }
  const testId = rowsBefore[0].id;
  const originalName = rowsBefore[0].name;
  console.log('Original Student:', testId, 'Name:', originalName);

  const updatedName = originalName.includes('(TESTED)') ? originalName.replace(' (TESTED)', '') : originalName + ' (TESTED)';
  console.log('New Target Name:', updatedName);

  // 2. Perform UPDATE query
  await p.query('UPDATE students SET name = ?, updated_at = NOW() WHERE id = ?', [updatedName, testId]);
  console.log('UPDATE query executed.');

  // 3. Verify in DB
  const [rowsAfter] = await p.query('SELECT id, name, updated_at FROM students WHERE id = ?', [testId]);
  console.log('Query result after update from MySQL:', rowsAfter[0]);

  await p.end();
}

runTest();
