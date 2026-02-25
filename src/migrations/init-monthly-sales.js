const { Unit, UnitMonthlySales } = require('../models');

async function initMonthlySales() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const units = await Unit.findAll();

  for (const unit of units) {
    await UnitMonthlySales.findOrCreate({
      where: { unitId: unit.id, year, month },
      defaults: {
        unitId: unit.id,
        deviceId: unit.deviceId,
        year,
        month,
        totalVolume: 0,
        totalRevenue: 0,
        freeThresholdVolume: unit.monthlyFreeThreshold || 34200,
        profitSharingVolume: 0,
        stewardProfit: 0,
        rpProfit: 0,
        headquartersRevenue: 0
      }
    });
  }

  console.log('[Migration] Monthly sales initialized');
}

module.exports = initMonthlySales;
