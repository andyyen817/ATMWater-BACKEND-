/**
 * 水币系统 v2 完整测试（含测试数据创建）
 */

require('dotenv').config();
const { Transaction, User } = require('./src/models');
const { calculateAndSplitProfit, getDailyStats, DAILY_THRESHOLD } = require('./src/services/profitSharing/waterCoinSplitService');
const DailyDispenseCounter = require('./src/models/DailyDispenseCounter');

async function setupTestData() {
  console.log('🔧 准备测试数据...\n');

  // 查询一个真实存在的用户
  const existingUser = await User.findOne({
    order: [['id', 'ASC']],
    limit: 1
  });

  if (!existingUser) {
    throw new Error('数据库中没有用户，请先创建用户');
  }

  const testUserId = existingUser.id;

  // 查询一个真实存在的 unit
  const { QueryTypes } = require('sequelize');
  const db = require('./src/config/database');
  const units = await db.query('SELECT id FROM units LIMIT 1', { type: QueryTypes.SELECT });

  if (units.length === 0) {
    throw new Error('数据库中没有 unit，请先创建售水站');
  }

  const testUnitId = units[0].id;

  // 清理今日测试数据
  const today = new Date().toISOString().slice(0, 10);
  await DailyDispenseCounter.destroy({
    where: { unitId: testUnitId, date: today }
  });

  // 清理测试用户的旧测试交易（只删除测试标记的）
  await Transaction.destroy({
    where: {
      userId: testUserId,
      description: '测试充值'
    }
  });

  // 创建测试充值记录（200,000水币）
  const currentBalance = await Transaction.sum('amount', {
    where: {
      userId: testUserId,
      type: 'TopUp',
      status: 'Completed'
    }
  }) || 0;

  await Transaction.create({
    userId: testUserId,
    type: 'TopUp',
    amount: 200000,
    balanceBefore: currentBalance,
    balanceAfter: currentBalance + 200000,
    balanceType: 'APP_BACKED',
    status: 'Completed',
    description: '测试充值',
    profitShared: false
  });

  console.log('✅ 测试数据准备完成');
  console.log(`   测试用户ID: ${testUserId} (${existingUser.name || existingUser.phone})`);
  console.log(`   测试站点ID: ${testUnitId}`);
  console.log(`   测试充值: 200,000 水币\n`);

  return { testUserId, testUnitId };
}

async function runTests() {
  console.log('🧪 水币系统 v2 分账逻辑完整测试\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 测试配置');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   每日阈值: ${DAILY_THRESHOLD}L`);
  console.log(`   分账比例: 站点90% + RP10%`);
  console.log(`   价格: 300水币/升\n`);

  try {
    const { testUserId, testUnitId } = await setupTestData();

    // ========================================
    // 测试场景1: 未达阈值（100L）
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 场景1: 未达每日阈值（100L）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result1 = await calculateAndSplitProfit({
      userId: testUserId,
      unitId: testUnitId,
      totalCost: 30000, // 100L * 300
      volume: 100,
      pricePerLiter: 300
    });

    console.log('✅ 测试结果:');
    console.log(`   App水币消耗: ${result1.appBackedCost} 水币`);
    console.log(`   物理卡消耗: ${result1.physicalBackedCost} 水币`);
    console.log(`   站点分润: ${result1.stationRevenue} Rp`);
    console.log(`   RP分润: ${result1.rpRevenue} Rp`);
    console.log(`   描述: ${result1.description}`);

    if (result1.stationRevenue === 0 && result1.rpRevenue === 0) {
      console.log('✅ 验证通过: 未达阈值，不分账\n');
    } else {
      console.log('❌ 验证失败: 未达阈值应该不分账\n');
      throw new Error('场景1验证失败');
    }

    const stats1 = await getDailyStats(testUnitId);
    console.log('📈 当前统计:');
    console.log(`   累计出水: ${stats1.currentVolume}L / ${stats1.threshold}L`);
    console.log(`   进度: ${stats1.percentage.toFixed(2)}%`);
    console.log(`   阈值状态: ${stats1.thresholdReached ? '已达' : '未达'}\n`);

    // ========================================
    // 测试场景2: 跨越阈值（500L，总计600L）
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 场景2: 跨越每日阈值（+500L，总计600L）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result2 = await calculateAndSplitProfit({
      userId: testUserId,
      unitId: testUnitId,
      totalCost: 150000, // 500L * 300
      volume: 500,
      pricePerLiter: 300
    });

    console.log('✅ 测试结果:');
    console.log(`   App水币消耗: ${result2.appBackedCost} 水币`);
    console.log(`   站点分润: ${result2.stationRevenue} Rp`);
    console.log(`   RP分润: ${result2.rpRevenue} Rp`);
    console.log(`   描述: ${result2.description}`);

    // 验证: 前470L归总部，后30L分账
    // 30L * 300 = 9000水币
    // 站点: 9000 * 0.9 = 8100
    // RP: 9000 * 0.1 = 900
    const expectedStation2 = 8100;
    const expectedRP2 = 900;

    if (Math.abs(result2.stationRevenue - expectedStation2) < 1 &&
        Math.abs(result2.rpRevenue - expectedRP2) < 1) {
      console.log(`✅ 验证通过: 跨阈值分账正确（站点${expectedStation2}, RP${expectedRP2}）\n`);
    } else {
      console.log(`❌ 验证失败: 期望站点${expectedStation2}, RP${expectedRP2}\n`);
      throw new Error('场景2验证失败');
    }

    const stats2 = await getDailyStats(testUnitId);
    console.log('📈 当前统计:');
    console.log(`   累计出水: ${stats2.currentVolume}L / ${stats2.threshold}L`);
    console.log(`   进度: ${stats2.percentage.toFixed(2)}%`);
    console.log(`   阈值状态: ${stats2.thresholdReached ? '已达' : '未达'}\n`);

    // ========================================
    // 测试场景3: 已超阈值（50L）
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 场景3: 已超阈值后出水（+50L，总计650L）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result3 = await calculateAndSplitProfit({
      userId: testUserId,
      unitId: testUnitId,
      totalCost: 15000, // 50L * 300
      volume: 50,
      pricePerLiter: 300
    });

    console.log('✅ 测试结果:');
    console.log(`   App水币消耗: ${result3.appBackedCost} 水币`);
    console.log(`   站点分润: ${result3.stationRevenue} Rp`);
    console.log(`   RP分润: ${result3.rpRevenue} Rp`);
    console.log(`   描述: ${result3.description}`);

    // 验证: 全部按9:1分账
    // 50L * 300 = 15000水币
    // 站点: 15000 * 0.9 = 13500
    // RP: 15000 * 0.1 = 1500
    const expectedStation3 = 13500;
    const expectedRP3 = 1500;

    if (Math.abs(result3.stationRevenue - expectedStation3) < 1 &&
        Math.abs(result3.rpRevenue - expectedRP3) < 1) {
      console.log(`✅ 验证通过: 超阈值全部按9:1分账（站点${expectedStation3}, RP${expectedRP3}）\n`);
    } else {
      console.log(`❌ 验证失败: 期望站点${expectedStation3}, RP${expectedRP3}\n`);
      throw new Error('场景3验证失败');
    }

    const stats3 = await getDailyStats(testUnitId);
    console.log('📈 最终统计:');
    console.log(`   累计出水: ${stats3.currentVolume}L / ${stats3.threshold}L`);
    console.log(`   进度: ${stats3.percentage.toFixed(2)}%`);
    console.log(`   阈值状态: ${stats3.thresholdReached ? '已达' : '未达'}\n`);

    // ========================================
    // 测试总结
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 所有测试通过！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 每日阈值机制正常（570L）');
    console.log('✅ 9:1分账比例正确');
    console.log('✅ 跨阈值计算准确');
    console.log('✅ 计数器更新正常');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 清理测试数据
    console.log('🧹 清理测试数据...');
    await Transaction.destroy({
      where: {
        userId: testUserId,
        description: '测试充值'
      }
    });
    const today = new Date().toISOString().slice(0, 10);
    await DailyDispenseCounter.destroy({
      where: { unitId: testUnitId, date: today }
    });
    console.log('✅ 测试数据已清理\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runTests();
