/**
 * seed-rp-steward.js
 * 创建 RP 和水管家帐号，并绑定到水站 898608311123900885420001
 * 运行: node scripts/seed-rp-steward.js
 */

require('dotenv').config();
const { sequelize, User, Unit } = require('../src/models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('[Seed] 数据库连接成功');

    const TARGET_DEVICE = '898608311123900885420001';

    // 1. 创建或更新 RP 用户
    const [rp, rpCreated] = await User.findOrCreate({
      where: { phoneNumber: '081234567891' },
      defaults: {
        phoneNumber: '081234567891',
        name: 'RP Jakarta Utara',
        email: 'rp1@atmwater.com',
        role: 'RP',
        password: 'Rp@123456',
        isActive: true,
        isVerified: true,
        balance: 0
      }
    });
    if (!rpCreated) {
      await rp.update({ role: 'RP', name: 'RP Jakarta Utara', email: 'rp1@atmwater.com' });
    }
    console.log(`[Seed] RP 用户: ${rpCreated ? '已创建' : '已存在'} — ID=${rp.id}, 手机=${rp.phoneNumber}`);

    // 2. 创建或更新 Steward（水管家）用户
    const [steward, stewardCreated] = await User.findOrCreate({
      where: { phoneNumber: '081234567892' },
      defaults: {
        phoneNumber: '081234567892',
        name: 'Steward KT-NORTH',
        email: 'steward1@atmwater.com',
        role: 'Steward',
        password: 'Steward@123456',
        isActive: true,
        isVerified: true,
        balance: 0
      }
    });
    if (!stewardCreated) {
      await steward.update({ role: 'Steward', name: 'Steward KT-NORTH', email: 'steward1@atmwater.com' });
    }
    console.log(`[Seed] Steward 用户: ${stewardCreated ? '已创建' : '已存在'} — ID=${steward.id}, 手机=${steward.phoneNumber}`);

    // 3. 绑定 Steward 到 RP
    await steward.update({ managedBy: rp.id });
    console.log(`[Seed] Steward(${steward.id}) 已绑定到 RP(${rp.id})`);

    // 4. 绑定水站到 RP 和 Steward，同时设置正确的阈值
    const [affectedRows] = await Unit.update(
      {
        rpOwnerId: rp.id,
        stewardId: steward.id,
        regionCode: 'KT-NORTH',
        monthlyFreeThreshold: 17100,
        stewardProfitRatio: 80,
        rpProfitRatio: 20,
        profitSharingEnabled: true
      },
      { where: { deviceId: TARGET_DEVICE } }
    );

    if (affectedRows === 0) {
      console.warn(`[Seed] ⚠️  未找到水站 ${TARGET_DEVICE}，请确认设备已导入数据库`);
    } else {
      console.log(`[Seed] ✅ 水站 ${TARGET_DEVICE} 已绑定 RP(${rp.id}) + Steward(${steward.id})，阈值=17100升`);
    }

    console.log('\n[Seed] 完成！帐号信息：');
    console.log(`  RP 帐号:      手机 081234567891 / 密码 Rp@123456`);
    console.log(`  Steward 帐号: 手机 081234567892 / 密码 Steward@123456`);

    await sequelize.close();
  } catch (error) {
    console.error('[Seed] 错误:', error.message);
    process.exit(1);
  }
}

seed();
