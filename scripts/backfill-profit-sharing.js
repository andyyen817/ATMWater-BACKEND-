/**
 * 回填历史交易分润数据
 * 运行: node scripts/backfill-profit-sharing.js
 */
require('dotenv').config();
const { Transaction, Unit, UnitMonthlySales, ProfitSharingLedger, User } = require('../src/models');
const { Op } = require('sequelize');
const sequelize = require('../src/config/database');

const calculateProfitSharing = (txAmount, txVolume, currentVolume, unit) => {
  const freeThreshold = parseFloat(unit.monthlyFreeThreshold) || 17100;
  const stewardRatio = parseFloat(unit.stewardProfitRatio) || 80;
  const rpRatio = parseFloat(unit.rpProfitRatio) || 20;
  const prevVolume = currentVolume;
  const newVolume = prevVolume + txVolume;

  let stewardAmount = 0, rpAmount = 0, headquartersAmount = 0;
  let profitType = 'FreeThreshold';

  if (prevVolume >= freeThreshold) {
    profitType = 'ProfitSharing';
    stewardAmount = Math.floor(txAmount * (stewardRatio / 100));
    rpAmount = Math.floor(txAmount * (rpRatio / 100));
    headquartersAmount = txAmount - stewardAmount - rpAmount;
  } else if (newVolume > freeThreshold) {
    const overVolume = newVolume - freeThreshold;
    const overRatio = overVolume / txVolume;
    const overAmount = Math.floor(txAmount * overRatio);
    profitType = 'ProfitSharing';
    stewardAmount = Math.floor(overAmount * (stewardRatio / 100));
    rpAmount = Math.floor(overAmount * (rpRatio / 100));
    headquartersAmount = txAmount - stewardAmount - rpAmount;
  } else {
    headquartersAmount = txAmount;
  }

  return { stewardAmount, rpAmount, headquartersAmount, profitType };
};

async function backfill() {
  try {
    await sequelize.authenticate();
    console.log('[Backfill] DB connected');

    // 清空旧的分润数据
    await ProfitSharingLedger.destroy({ where: {} });
    await UnitMonthlySales.destroy({ where: {} });
    console.log('[Backfill] Cleared old profit sharing data');

    // 获取所有需要回填的交易（按时间升序）
    const transactions = await Transaction.findAll({
      where: {
        type: 'WaterPurchase',
        status: 'Completed',
        unitId: { [Op.not]: null }
      },
      order: [['createdAt', 'ASC']]
    });

    console.log(`[Backfill] Processing ${transactions.length} transactions...`);

    // 按 unitId + year + month 分组累计
    const monthlyState = {}; // key: `${unitId}-${year}-${month}`
    const unitCache = {};
    let processed = 0, skipped = 0;
    const ledgerBatch = [];
    const stewardBalance = {};
    const rpBalance = {};

    for (const tx of transactions) {
      const unit = unitCache[tx.unitId] || (unitCache[tx.unitId] = await Unit.findByPk(tx.unitId));
      if (!unit || !unit.profitSharingEnabled) { skipped++; continue; }

      const d = new Date(tx.createdAt);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      const key = `${tx.unitId}-${year}-${month}`;

      if (!monthlyState[key]) {
        monthlyState[key] = {
          unitId: unit.id, deviceId: unit.deviceId, year, month,
          totalVolume: 0, totalRevenue: 0,
          freeThresholdVolume: parseFloat(unit.monthlyFreeThreshold) || 17100,
          profitSharingVolume: 0, stewardProfit: 0, rpProfit: 0, headquartersRevenue: 0
        };
      }

      const state = monthlyState[key];
      const txAmount = parseFloat(tx.amount) || 0;
      const txVolumeML = parseFloat(tx.volume) || 0;
      const txVolume = txVolumeML / 1000; // ml → L

      const { stewardAmount, rpAmount, headquartersAmount, profitType } =
        calculateProfitSharing(txAmount, txVolume, state.totalVolume, unit);

      state.totalVolume += txVolume;
      state.totalRevenue += txAmount;
      if (profitType === 'ProfitSharing') state.profitSharingVolume += txVolume;
      state.stewardProfit += stewardAmount;
      state.rpProfit += rpAmount;
      state.headquartersRevenue += headquartersAmount;

      // 收集账本条目
      if (stewardAmount > 0) {
        ledgerBatch.push({ transactionId: tx.id, unitId: unit.id, deviceId: unit.deviceId, userId: unit.stewardId, accountType: 'Steward', amount: stewardAmount, volume: txVolume, profitType, monthYear, description: `Steward profit from ${unit.deviceId}`, status: 'Settled', createdAt: tx.createdAt, updatedAt: tx.createdAt });
        stewardBalance[unit.stewardId] = (stewardBalance[unit.stewardId] || 0) + stewardAmount;
      }
      if (rpAmount > 0) {
        ledgerBatch.push({ transactionId: tx.id, unitId: unit.id, deviceId: unit.deviceId, userId: unit.rpOwnerId, accountType: 'RP', amount: rpAmount, volume: txVolume, profitType, monthYear, description: `RP profit from ${unit.deviceId}`, status: 'Settled', createdAt: tx.createdAt, updatedAt: tx.createdAt });
        rpBalance[unit.rpOwnerId] = (rpBalance[unit.rpOwnerId] || 0) + rpAmount;
      }
      if (headquartersAmount > 0) {
        ledgerBatch.push({ transactionId: tx.id, unitId: unit.id, deviceId: unit.deviceId, userId: null, accountType: 'Headquarters', amount: headquartersAmount, volume: txVolume, profitType, monthYear, description: `HQ revenue from ${unit.deviceId}`, status: 'Settled', createdAt: tx.createdAt, updatedAt: tx.createdAt });
      }

      processed++;
      if (processed % 1000 === 0) console.log(`[Backfill] ${processed}/${transactions.length}...`);
    }

    // 批量写入月度统计
    const monthlyRecords = Object.values(monthlyState);
    for (const rec of monthlyRecords) {
      await UnitMonthlySales.create(rec);
    }
    console.log(`[Backfill] Created ${monthlyRecords.length} monthly sales records`);

    // 批量写入分润账本（每批500条）
    const BATCH_SIZE = 500;
    for (let i = 0; i < ledgerBatch.length; i += BATCH_SIZE) {
      await ProfitSharingLedger.bulkCreate(ledgerBatch.slice(i, i + BATCH_SIZE));
    }
    console.log(`[Backfill] Created ${ledgerBatch.length} ledger entries`);

    // 更新用户余额
    for (const [userId, amount] of Object.entries(stewardBalance)) {
      await User.update({ balance: amount }, { where: { id: userId } });
      console.log(`[Backfill] Steward ${userId} balance: Rp ${amount}`);
    }
    for (const [userId, amount] of Object.entries(rpBalance)) {
      await User.update({ balance: amount }, { where: { id: userId } });
      console.log(`[Backfill] RP ${userId} balance: Rp ${amount}`);
    }

    console.log(`\n[Backfill] Done! processed=${processed}, skipped=${skipped}`);

    // 打印汇总
    const totals = Object.values(monthlyState).reduce((acc, s) => {
      acc.revenue += s.totalRevenue;
      acc.steward += s.stewardProfit;
      acc.rp += s.rpProfit;
      acc.hq += s.headquartersRevenue;
      return acc;
    }, { revenue: 0, steward: 0, rp: 0, hq: 0 });

    console.log(`\n=== Summary ===`);
    console.log(`Total Revenue:  Rp ${totals.revenue.toFixed(2)}`);
    console.log(`Steward Profit: Rp ${totals.steward}`);
    console.log(`RP Profit:      Rp ${totals.rp}`);
    console.log(`HQ Revenue:     Rp ${totals.hq}`);

    await sequelize.close();
  } catch (e) {
    console.error('[Backfill] Error:', e.message);
    process.exit(1);
  }
}

backfill();
