/**
 * seed-kt-north-region.js
 * 创建 KT-NORTH (Jakarta Utara) 区域定价，并绑定到水站 898608311123900885420001
 * 运行: node scripts/seed-kt-north-region.js
 */

require('dotenv').config();
const { sequelize, RegionalPricing, Unit } = require('../src/models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('[Seed] 数据库连接成功');

    const TARGET_DEVICE = '898608311123900885420001';

    // 1. 创建或更新 KT-NORTH 区域定价
    const [region, created] = await RegionalPricing.findOrCreate({
      where: { regionCode: 'KT-NORTH' },
      defaults: {
        regionCode: 'KT-NORTH',
        regionName: 'Jakarta Utara',
        pureWaterPrice: 400,
        mineralWaterPrice: 500,
        isActive: true
      }
    });
    if (!created) {
      await region.update({
        regionName: 'Jakarta Utara',
        pureWaterPrice: 400,
        mineralWaterPrice: 500,
        isActive: true
      });
    }
    console.log(`[Seed] KT-NORTH 区域: ${created ? '已创建' : '已更新'} — 纯净水 Rp${region.pureWaterPrice}/L, 矿泉水 Rp${region.mineralWaterPrice}/L`);

    // 2. 更新水站的 regionCode
    const [affectedRows] = await Unit.update(
      { regionCode: 'KT-NORTH' },
      { where: { deviceId: TARGET_DEVICE } }
    );

    if (affectedRows === 0) {
      console.warn(`[Seed] ⚠️  未找到水站 ${TARGET_DEVICE}，请确认设备已导入数据库`);
    } else {
      console.log(`[Seed] ✅ 水站 ${TARGET_DEVICE} 已绑定区域 KT-NORTH (Jakarta Utara)`);
    }

    console.log('\n[Seed] 查看计费的方式：');
    console.log(`  API: GET /api/profit-sharing/unit-pricing/${TARGET_DEVICE}`);
    console.log(`  API: GET /api/profit-sharing/monthly-sales/:unitId`);
    console.log(`  数据库表: profit_sharing_ledger (每笔分润明细)`);
    console.log(`  数据库表: unit_monthly_sales (月度汇总)`);

    await sequelize.close();
  } catch (error) {
    console.error('[Seed] 错误:', error.message);
    process.exit(1);
  }
}

seed();
