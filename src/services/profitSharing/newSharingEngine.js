const { Unit, Transaction, UnitMonthlySales, ProfitSharingLedger, User } = require('../../models');
const { Op } = require('sequelize');

/**
 * 计算单笔交易的分润
 * @param {Object} transaction - 交易记录 { id, unitId, amount, volume }
 * @param {Object} monthlySales - 月度统计记录
 * @param {Object} unit - 水站记录 { stewardProfitRatio, rpProfitRatio, monthlyFreeThreshold }
 */
const calculateProfitSharing = (transaction, monthlySales, unit) => {
  const freeThreshold = parseFloat(unit.monthlyFreeThreshold) || 17100; // 单位：升
  const currentVolume = parseFloat(monthlySales.totalVolume) || 0;      // 单位：升（累计）
  const txVolumeML = parseFloat(transaction.volume) || 0;               // 硬件上报：毫升
  const txVolume = txVolumeML / 1000;                                   // 换算为升
  const txAmount = parseFloat(transaction.amount) || 0;
  const stewardRatio = parseFloat(unit.stewardProfitRatio) || 80;
  const rpRatio = parseFloat(unit.rpProfitRatio) || 20;

  // 本次交易前的累计量
  const prevVolume = currentVolume;
  const newVolume = prevVolume + txVolume;

  let stewardAmount = 0;
  let rpAmount = 0;
  let headquartersAmount = 0;
  let profitType = 'FreeThreshold';

  if (prevVolume >= freeThreshold) {
    // 已超过阈值，全部参与分润
    profitType = 'ProfitSharing';
    stewardAmount = Math.floor(txAmount * (stewardRatio / 100));
    rpAmount = Math.floor(txAmount * (rpRatio / 100));
    headquartersAmount = txAmount - stewardAmount - rpAmount;
  } else if (newVolume > freeThreshold) {
    // 部分超过阈值
    const overVolume = newVolume - freeThreshold;
    const overRatio = overVolume / txVolume;
    const overAmount = Math.floor(txAmount * overRatio);
    const freeAmount = txAmount - overAmount;

    profitType = 'ProfitSharing';
    stewardAmount = Math.floor(overAmount * (stewardRatio / 100));
    rpAmount = Math.floor(overAmount * (rpRatio / 100));
    headquartersAmount = freeAmount + overAmount - stewardAmount - rpAmount;
  } else {
    // 未超过阈值，全归总部
    profitType = 'FreeThreshold';
    headquartersAmount = txAmount;
  }

  return { stewardAmount, rpAmount, headquartersAmount, profitType, txVolume };
};

/**
 * 执行分润并更新账本
 * @param {Object} transaction - Sequelize Transaction 实例
 */
const processProfitSharing = async (transaction) => {
  try {
    const unit = await Unit.findByPk(transaction.unitId);
    if (!unit) {
      console.warn(`[NewSharingEngine] Unit not found for unitId: ${transaction.unitId}`);
      return null;
    }

    if (!unit.profitSharingEnabled) {
      console.log(`[NewSharingEngine] Profit sharing disabled for unit: ${unit.deviceId}`);
      return null;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;

    // 获取或创建月度统计
    const [monthlySales] = await UnitMonthlySales.findOrCreate({
      where: { unitId: unit.id, year, month },
      defaults: {
        unitId: unit.id,
        deviceId: unit.deviceId,
        year,
        month,
        totalVolume: 0,
        totalRevenue: 0,
        freeThresholdVolume: unit.monthlyFreeThreshold || 17100,
        profitSharingVolume: 0,
        stewardProfit: 0,
        rpProfit: 0,
        headquartersRevenue: 0
      }
    });

    // 计算分润
    const { stewardAmount, rpAmount, headquartersAmount, profitType, txVolume } = calculateProfitSharing(
      transaction, monthlySales, unit
    );

    const txAmount = parseFloat(transaction.amount) || 0;
    const profitSharingVolume = profitType === 'ProfitSharing' ? txVolume : 0;

    // 更新月度统计
    await monthlySales.increment({
      totalVolume: txVolume,
      totalRevenue: txAmount,
      profitSharingVolume: profitSharingVolume,
      stewardProfit: stewardAmount,
      rpProfit: rpAmount,
      headquartersRevenue: headquartersAmount
    });

    // 写入分润账本
    const ledgerEntries = [
      {
        transactionId: transaction.id,
        unitId: unit.id,
        deviceId: unit.deviceId,
        userId: unit.stewardId,
        accountType: 'Steward',
        amount: stewardAmount,
        volume: txVolume,
        profitType,
        monthYear,
        description: `Steward profit from ${unit.deviceId}`,
        status: 'Settled'
      },
      {
        transactionId: transaction.id,
        unitId: unit.id,
        deviceId: unit.deviceId,
        userId: unit.rpOwnerId,
        accountType: 'RP',
        amount: rpAmount,
        volume: txVolume,
        profitType,
        monthYear,
        description: `RP profit from ${unit.deviceId}`,
        status: 'Settled'
      },
      {
        transactionId: transaction.id,
        unitId: unit.id,
        deviceId: unit.deviceId,
        userId: null,
        accountType: 'Headquarters',
        amount: headquartersAmount,
        volume: txVolume,
        profitType,
        monthYear,
        description: `Headquarters revenue from ${unit.deviceId}`,
        status: 'Settled'
      }
    ].filter(e => e.amount > 0);

    await ProfitSharingLedger.bulkCreate(ledgerEntries);

    // 更新用户余额
    if (stewardAmount > 0 && unit.stewardId) {
      await User.increment({ balance: stewardAmount }, { where: { id: unit.stewardId } });
    }
    if (rpAmount > 0 && unit.rpOwnerId) {
      await User.increment({ balance: rpAmount }, { where: { id: unit.rpOwnerId } });
    }

    console.log(`[NewSharingEngine] Profit sharing processed for tx ${transaction.id}: steward=${stewardAmount}, rp=${rpAmount}, hq=${headquartersAmount}`);

    return { stewardAmount, rpAmount, headquartersAmount, profitType };
  } catch (error) {
    console.error('[NewSharingEngine] Error processing profit sharing:', error);
    throw error;
  }
};

/**
 * 获取月度统计
 */
const getMonthlyStats = async (unitId, year, month) => {
  return await UnitMonthlySales.findOne({ where: { unitId, year, month } });
};

module.exports = { calculateProfitSharing, processProfitSharing, getMonthlyStats };
