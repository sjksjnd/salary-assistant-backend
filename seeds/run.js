const fs = require('fs');
const path = require('path');

async function runSeeds() {
  const seedsDir = path.join(__dirname);
  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.js') && f !== 'run.js')
    .sort();

  console.log(`Found ${files.length} seed files:`);

  for (const file of files) {
    console.log(`\n--- Seeding: ${file} ---`);
    const { seed } = require(`./${file}`);
    try {
      await seed();
      console.log(`✓ Seed completed: ${file}`);
    } catch (err) {
      console.error(`✗ Seed failed: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n✅ All seeds completed successfully!');
  process.exit(0);
}

runSeeds().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
