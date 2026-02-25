const { RegionalPricing } = require('../models');

async function initRegionalPricing() {
  const defaultRegions = [
    {
      regionCode: 'JAKARTA',
      regionName: '雅加达',
      pureWaterPrice: 450,
      mineralWaterPrice: 550,
      electricityCost: 1500,
      waterCost: 8000,
      isActive: true
    },
    {
      regionCode: 'BANDUNG',
      regionName: '万隆',
      pureWaterPrice: 400,
      mineralWaterPrice: 500,
      electricityCost: 1200,
      waterCost: 7000,
      isActive: true
    },
    {
      regionCode: 'SURABAYA',
      regionName: '泗水',
      pureWaterPrice: 420,
      mineralWaterPrice: 520,
      electricityCost: 1300,
      waterCost: 7500,
      isActive: true
    }
  ];

  for (const region of defaultRegions) {
    await RegionalPricing.findOrCreate({
      where: { regionCode: region.regionCode },
      defaults: region
    });
  }
  console.log('[Migration] Regional pricing initialized');
}

module.exports = initRegionalPricing;
