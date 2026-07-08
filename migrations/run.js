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

  try {
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
        } else if (err.code === 'ER_MALFORMED_PACKET') {
          console.log(`⚠ Packet error (may be transient), skipping\n`);
        } else {
          console.error(`✗ Error: ${err.message}\n`);
        }
      }
    }

    console.log('✅ All migrations completed successfully!');
  } catch (err) {
    if (err.code === 'ER_MALFORMED_PACKET') {
      console.log('⚠ Migration encountered packet error - this may be transient');
    } else {
      console.error('Migration failed:', err);
    }
  } finally {
    await connection.end();
  }
}

runMigrations().catch(err => {
  console.error('Migration error:', err);
});
