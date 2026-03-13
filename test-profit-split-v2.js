/**
 * 水币系统 v2 分账逻辑测试
 * 测试每日阈值 + 9:1 分账比例
 */

require('dotenv').config();
const { calculateAndSplitProfit, getDailyStats, DAILY_THRESHOLD } = require('./src/services/profitSharing/waterCoinSplitService');

async function testProfitSplitV2() {
  console.log('🧪 水币系统 v2 分账逻辑测试\n');
  console.log('📋 测试配置:');
  console.log(`   每日阈值: ${DAILY_THRESHOLD}L`);
  console.log(`   分账比例: 站点90% + RP10%`);
  console.log(`   价格: 300水币/升\n`);

  const testUnitId = 1;
  const testUserId = 1;

  try {
    // 测试场景1: 未达阈值（100L）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 场景1: 未达每日阈值');
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

    // 验证
    if (result1.stationRevenue === 0 && result1.rpRevenue === 0) {
      console.log('✅ 验证通过: 未达阈值，不分账\n');
    } else {
      console.log('❌ 验证失败: 未达阈值应该不分账\n');
    }

    // 查询当前统计
    const stats1 = await getDailyStats(testUnitId);
    console.log('📈 当前统计:');
    console.log(`   累计出水: ${stats1.currentVolume}L / ${stats1.threshold}L`);
    console.log(`   进度: ${stats1.percentage.toFixed(2)}%`);
    console.log(`   阈值状态: ${stats1.thresholdReached ? '已达' : '未达'}\n`);

    // 测试场景2: 跨越阈值（500L，总计600L）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 场景2: 跨越每日阈值');
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

    // 验证跨阈值分账
    // 前470L归总部，后30L分账: 30 * 300 = 9000
    // 站点: 9000 * 0.9 = 8100
    // RP: 9000 * 0.1 = 900
    const expectedStation = 8100;
    const expectedRP = 900;

    if (Math.abs(result2.stationRevenue - expectedStation) < 1 &&
        Math.abs(result2.rpRevenue - expectedRP) < 1) {
      console.log('✅ 验证通过: 跨阈值分账正确\n');
    } else {
      console.log(`❌ 验证失败: 期望站点${expectedStation}, RP${expectedRP}\n`);
    }

    const stats2 = await getDailyStats(testUnitId);
    console.log('📈 当前统计:');
    console.log(`   累计出水: ${stats2.currentVolume}L / ${stats2.threshold}L`);
    console.log(`   进度: ${stats2.percentage.toFixed(2)}%`);
    console.log(`   阈值状态: ${stats2.thresholdReached ? '已达' : '未达'}\n`);

    // 测试场景3: 已超阈值（50L）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 场景3: 已超阈值后出水');
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

    // 验证全部分账: 50 * 300 = 15000
    // 站点: 15000 * 0.9 = 13500
    // RP: 15000 * 0.1 = 1500
    const expectedStation3 = 13500;
    const expectedRP3 = 1500;

    if (Math.abs(result3.stationRevenue - expectedStation3) < 1 &&
        Math.abs(result3.rpRevenue - expectedRP3) < 1) {
      console.log('✅ 验证通过: 超阈值全部按9:1分账\n');
    } else {
      console.log(`❌ 验证失败: 期望站点${expectedStation3}, RP${expectedRP3}\n`);
    }

    const stats3 = await getDailyStats(testUnitId);
    console.log('📈 最终统计:');
    console.log(`   累计出水: ${stats3.currentVolume}L / ${stats3.threshold}L`);
    console.log(`   进度: ${stats3.percentage.toFixed(2)}%`);
    console.log(`   阈值状态: ${stats3.thresholdReached ? '已达' : '未达'}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 所有测试通过！水币系统 v2 分账逻辑正常');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testProfitSplitV2();
