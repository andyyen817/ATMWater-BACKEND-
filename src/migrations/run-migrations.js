require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const initRegionalPricing = require('./init-regional-pricing');
const assignUnitRegions = require('./assign-unit-regions');
const initMonthlySales = require('./init-monthly-sales');

async function runMigrations() {
  try {
    console.log('[Migrations] Starting migrations...');

    await initRegionalPricing();
    await assignUnitRegions();
    await initMonthlySales();

    console.log('[Migrations] All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Migrations] Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
