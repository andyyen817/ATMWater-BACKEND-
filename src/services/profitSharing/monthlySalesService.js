const { UnitMonthlySales, Unit, ProfitSharingLedger } = require('../../models');
const { Op } = require('sequelize');

const getOrCreateMonthlySales = async (unitId, deviceId, year, month, freeThreshold) => {
  let unit = null;
  if (!deviceId) {
    unit = await Unit.findByPk(unitId);
    deviceId = unit ? unit.deviceId : 'UNKNOWN';
  }

  const [record] = await UnitMonthlySales.findOrCreate({
    where: { unitId, year, month },
    defaults: {
      unitId,
      deviceId,
      year,
      month,
      totalVolume: 0,
      totalRevenue: 0,
      freeThresholdVolume: freeThreshold || 17100,
      profitSharingVolume: 0,
      stewardProfit: 0,
      rpProfit: 0,
      headquartersRevenue: 0
    }
  });
  return record;
};

const updateMonthlySales = async (unitId, year, month, volumeDelta, revenueDelta) => {
  const record = await getOrCreateMonthlySales(unitId, null, year, month);
  await record.increment({ totalVolume: volumeDelta, totalRevenue: revenueDelta });
  return record.reload();
};

const getMonthlySummary = async (userId, role, year, month) => {
  const monthYear = `${year}-${String(month).padStart(2, '0')}`;
  // userId=0 means Super-Admin viewing all units for a given role
  const viewAll = userId === 0;

  if (role === 'Steward') {
    const unitWhere = viewAll ? {} : { stewardId: userId };
    const units = await Unit.findAll({ where: unitWhere });
    const unitIds = units.map(u => u.id);

    const sales = await UnitMonthlySales.findAll({
      where: { unitId: { [Op.in]: unitIds.length ? unitIds : [-1] }, year, month },
      include: [{ model: Unit, as: 'unit', attributes: ['deviceId', 'deviceName'] }]
    });

    const ledgerWhere = viewAll
      ? { monthYear, accountType: 'Steward' }
      : { userId, monthYear, accountType: 'Steward' };
    const ledger = await ProfitSharingLedger.findAll({ where: ledgerWhere });

    const totalProfit = ledger.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalRevenue), 0);
    const totalVolume = sales.reduce((sum, s) => sum + parseFloat(s.totalVolume), 0);
    return { role, userId, year, month, totalProfit, totalRevenue, totalVolume, units: sales, ledger };

  } else if (role === 'RP') {
    const unitWhere = viewAll ? {} : { rpOwnerId: userId };
    const units = await Unit.findAll({ where: unitWhere });
    const unitIds = units.map(u => u.id);

    const sales = await UnitMonthlySales.findAll({
      where: { unitId: { [Op.in]: unitIds.length ? unitIds : [-1] }, year, month },
      include: [{ model: Unit, as: 'unit', attributes: ['deviceId', 'deviceName'] }]
    });

    const ledgerWhere = viewAll
      ? { monthYear, accountType: 'RP' }
      : { userId, monthYear, accountType: 'RP' };
    const ledger = await ProfitSharingLedger.findAll({ where: ledgerWhere });

    const totalProfit = ledger.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalRevenue), 0);
    const totalVolume = sales.reduce((sum, s) => sum + parseFloat(s.totalVolume), 0);
    return { role, userId, year, month, totalProfit, totalRevenue, totalVolume, units: sales, ledger };

  } else {
    // 总部：查所有水站
    const sales = await UnitMonthlySales.findAll({
      where: { year, month },
      include: [{ model: Unit, as: 'unit', attributes: ['deviceId', 'deviceName', 'regionCode'] }]
    });

    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalRevenue), 0);
    const totalHqRevenue = sales.reduce((sum, s) => sum + parseFloat(s.headquartersRevenue), 0);
    return { role, year, month, totalRevenue, totalHqRevenue, units: sales };
  }
};

const resetMonthlyStats = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const units = await Unit.findAll({ where: { isActive: true } });

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
        headquartersRevenue: 0,
        lastResetAt: new Date()
      }
    });
  }

  console.log(`[MonthlySalesService] Reset completed for ${year}-${month}, ${units.length} units processed`);
};

module.exports = { getOrCreateMonthlySales, updateMonthlySales, getMonthlySummary, resetMonthlyStats };
