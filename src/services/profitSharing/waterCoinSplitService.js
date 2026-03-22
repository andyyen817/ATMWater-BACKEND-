/**
 * 水币分账服务
 * 处理App充值水币和物理卡水币的分账逻辑
 * v2: 改为每日阈值 + 9:1分账比例
 */

const { Transaction, User } = require('../../models');
const DailyDispenseCounter = require('../../models/DailyDispenseCounter');
const Card = require('../../models/Card');
const { Op } = require('sequelize');

// 每日阈值：前570L归总部
const DAILY_THRESHOLD = 570;

/**
 * 计算并执行出水分账
 * @param {Object} params
 * @param {number} params.userId - 用户ID
 * @param {number} params.unitId - 售水站ID
 * @param {number} params.totalCost - 总费用（水币）
 * @param {number} params.volume - 出水量（升）
 * @param {number} params.pricePerLiter - 每升价格
 * @returns {Object} 分账结果
 */
async function calculateAndSplitProfit(params) {
  const { userId, unitId, totalCost, volume, pricePerLiter } = params;

  try {
    // 1. 查询用户余额构成（FIFO原则：先消耗最早的水币）
    const userTransactions = await Transaction.findAll({
      where: {
        userId,
        type: 'topup',
        status: 'Completed',
        balanceAfter: { [Op.gt]: 0 } // 还有剩余
      },
      order: [['createdAt', 'ASC']]
    });

    // 2. 计算本次消耗的水币来源
    let remainingCost = totalCost;
    let appBackedCost = 0;
    let physicalBackedCost = 0;
    let originCardId = null;

    for (const tx of userTransactions) {
      if (remainingCost <= 0) break;

      const available = parseFloat(tx.balanceAfter) - parseFloat(tx.balanceBefore || 0);
      const consume = Math.min(available, remainingCost);

      if (tx.balanceType === 'APP_BACKED') {
        appBackedCost += consume;
      } else if (tx.balanceType === 'PHYSICAL_BACKED') {
        physicalBackedCost += consume;
        if (!originCardId) originCardId = tx.originCardId;
      }

      remainingCost -= consume;
    }

    let stationRevenue = 0;
    let rpRevenue = 0;
    let description = '';

    // 3. 处理 App 水币分账
    if (appBackedCost > 0) {
      const appVolume = appBackedCost / pricePerLiter;
      const today = new Date().toISOString().slice(0, 10); // '2026-03-10'

      // 查询或创建今日计数器
      let counter = await DailyDispenseCounter.findOne({
        where: { unitId, date: today }
      });

      if (!counter) {
        counter = await DailyDispenseCounter.create({
          unitId,
          date: today,
          appBackedVolume: 0,
          thresholdReached: false
        });
      }

      const currentVolume = parseFloat(counter.appBackedVolume);

      if (currentVolume >= DAILY_THRESHOLD) {
        // 已超阈值，全部按 9:1 分账
        stationRevenue += appBackedCost * 0.9;
        rpRevenue += appBackedCost * 0.1;
        description += `[App水币分润: 站点90% + RP10%]`;
      } else if (currentVolume + appVolume > DAILY_THRESHOLD) {
        // 跨越阈值
        const beforeThreshold = DAILY_THRESHOLD - currentVolume;
        const afterThreshold = appVolume - beforeThreshold;

        // 阈值前部分：归总部（不分账）
        // 阈值后部分：按 9:1 分账
        const afterCost = afterThreshold * pricePerLiter;
        stationRevenue += afterCost * 0.9;
        rpRevenue += afterCost * 0.1;
        description += `[App水币跨阈值: 前${beforeThreshold.toFixed(2)}L归总部, 后${afterThreshold.toFixed(2)}L分润]`;
      } else {
        // 未达阈值，全部归总部（stationRevenue = 0）
        description += `[App水币未达阈值: 全部归总部]`;
      }

      // 更新累计出水量
      counter.appBackedVolume = currentVolume + appVolume;
      if (counter.appBackedVolume >= DAILY_THRESHOLD) {
        counter.thresholdReached = true;
      }
      await counter.save();

      console.log(`[WaterCoinSplit] Unit ${unitId} - ${today}: App volume ${currentVolume} -> ${counter.appBackedVolume}L`);
    }

    // 4. 处理物理卡水币（不分账）
    if (physicalBackedCost > 0) {
      // 物理卡已在采购时结清，出水时不再分账
      description += ` [物理卡消费: 无需分账]`;

      // 注：跨站补偿功能暂不实施，因物理卡不再记录售卡站点
    }

    return {
      success: true,
      stationRevenue: parseFloat(stationRevenue.toFixed(2)),
      rpRevenue: parseFloat(rpRevenue.toFixed(2)),
      appBackedCost,
      physicalBackedCost,
      description: description.trim()
    };

  } catch (error) {
    console.error('[WaterCoinSplit] Error:', error);
    return {
      success: false,
      stationRevenue: 0,
      rpRevenue: 0,
      error: error.message
    };
  }
}

/**
 * 获取站点今日分账统计
 * @param {number} unitId - 售水站ID
 * @returns {Object} 统计数据
 */
async function getDailyStats(unitId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const counter = await DailyDispenseCounter.findOne({
      where: { unitId, date: today }
    });

    if (!counter) {
      return {
        currentVolume: 0,
        threshold: DAILY_THRESHOLD,
        thresholdReached: false,
        percentage: 0
      };
    }

    const percentage = (parseFloat(counter.appBackedVolume) / DAILY_THRESHOLD) * 100;

    return {
      currentVolume: parseFloat(counter.appBackedVolume),
      threshold: DAILY_THRESHOLD,
      thresholdReached: counter.thresholdReached,
      percentage: Math.min(percentage, 100),
      reachedAt: counter.thresholdReached ? counter.updatedAt : null
    };

  } catch (error) {
    console.error('[WaterCoinSplit] getDailyStats error:', error);
    return null;
  }
}

module.exports = {
  calculateAndSplitProfit,
  getDailyStats,
  DAILY_THRESHOLD
};
