const { RegionalPricing, Unit } = require('../../models');

const getAllRegions = async () => {
  return await RegionalPricing.findAll({ where: { isActive: true }, order: [['regionCode', 'ASC']] });
};

const getRegionByCode = async (regionCode) => {
  return await RegionalPricing.findOne({ where: { regionCode } });
};

const createOrUpdateRegion = async (data) => {
  const [record, created] = await RegionalPricing.upsert(data, { returning: true });
  return { record, created };
};

const deleteRegion = async (regionCode) => {
  return await RegionalPricing.destroy({ where: { regionCode } });
};

const getUnitPricing = async (deviceId) => {
  const unit = await Unit.findOne({ where: { deviceId } });
  if (!unit) {
    return { deviceId, pureWaterPrice: 400, mineralWaterPrice: 500, regionName: 'Default', currency: 'Rp', unit: '升' };
  }

  if (unit.regionCode) {
    const region = await RegionalPricing.findOne({ where: { regionCode: unit.regionCode, isActive: true } });
    if (region) {
      return {
        deviceId,
        regionCode: region.regionCode,
        regionName: region.regionName,
        pureWaterPrice: parseFloat(region.pureWaterPrice),
        mineralWaterPrice: parseFloat(region.mineralWaterPrice),
        currency: 'Rp',
        unit: '升'
      };
    }
  }

  // 使用水站自身价格作为兜底
  return {
    deviceId,
    regionCode: null,
    regionName: 'Default',
    pureWaterPrice: parseFloat(unit.pricePerLiter) || 400,
    mineralWaterPrice: parseFloat(unit.pricePerLiter) ? parseFloat(unit.pricePerLiter) + 100 : 500,
    currency: 'Rp',
    unit: '升'
  };
};

module.exports = { getAllRegions, getRegionByCode, createOrUpdateRegion, deleteRegion, getUnitPricing };
