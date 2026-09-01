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

async function testSave() {
  console.log('Fetching student AKB-2024-001 before update...');
  const [before] = await p.query('SELECT id, name FROM students WHERE id = "AKB-2024-001"');
  console.log('Before update:', before);

  const [allSt] = await p.query('SELECT * FROM students');
  console.log('Total students in DB:', allSt.length);

  // simulate updating name of AKB-2024-001
  const updatedStudent = {
    id: 'AKB-2024-001',
    name: 'M. ABDUL KASIM (UPDATED)',
    grade: 'Grade 1',
    fees: {}
  };

  const state = {
    students: allSt.map(s => s.id === 'AKB-2024-001' ? updatedStudent : s),
    payments: [],
    users: [],
    meta: {}
  };

  console.log('Executing saveDBToMySQL simulation...');
  for (const s of state.students) {
    if (!s.id) continue;
    await p.query(
      `INSERT INTO students (id, name, grade, class_teacher, gender, father, mother, contact, religion, location, drop_location, transport_type, vehicle, status, discount, admission, sports_activity, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), grade=VALUES(grade), class_teacher=VALUES(class_teacher), gender=VALUES(gender),
         father=VALUES(father), mother=VALUES(mother), contact=VALUES(contact), religion=VALUES(religion),
         location=VALUES(location), drop_location=VALUES(drop_location), transport_type=VALUES(transport_type),
         vehicle=VALUES(vehicle), status=VALUES(status), discount=VALUES(discount), admission=VALUES(admission),
         sports_activity=VALUES(sports_activity), updated_at=NOW()`,
      [s.id, s.name || '', s.grade || '', s.classTeacher || null, s.gender || null, s.father || null, s.mother || null, s.contact || null, s.religion || null, s.location || null, s.dropLocation || null, s.transportType || null, s.vehicle || null, s.status || 'active', Number(s.discount) || 0, s.admission || 'NEW', s.sportsActivity || null]
    );
  }

  const [after] = await p.query('SELECT id, name FROM students WHERE id = "AKB-2024-001"');
  console.log('After update:', after);

  await p.end();
}

testSave();
