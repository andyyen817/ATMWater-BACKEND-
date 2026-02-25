const { Unit } = require('../models');

async function assignUnitRegions() {
  const units = await Unit.findAll();

  for (const unit of units) {
    let regionCode = 'JAKARTA';

    if (unit.location) {
      if (unit.location.toLowerCase().includes('bandung')) {
        regionCode = 'BANDUNG';
      } else if (unit.location.toLowerCase().includes('surabaya')) {
        regionCode = 'SURABAYA';
      }
    }

    await unit.update({
      regionCode,
      profitSharingEnabled: true,
      monthlyFreeThreshold: 34200,
      stewardProfitRatio: 80,
      rpProfitRatio: 20
    });
  }

  console.log('[Migration] Unit regions assigned');
}

module.exports = assignUnitRegions;
