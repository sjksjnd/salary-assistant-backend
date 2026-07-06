const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  // Create database if not exists
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE ${config.db.name}`);
  console.log(`✓ Database: ${config.db.name}`);

  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files:\n`);

  for (const file of files) {
    console.log(`--- Running: ${file} ---`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      await connection.query(sql);
      console.log(`✓ Executed successfully\n`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
        console.log(`⚠ Index already exists, skipping\n`);
      } else {
        console.error(`✗ Error: ${err.message}\n`);
        process.exit(1);
      }
    }
  }

  console.log('✅ All migrations completed successfully!');
  await connection.end();
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
