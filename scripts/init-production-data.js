// 生产环境数据初始化脚本
// 用于添加硬件设备、用户和RFID卡数据

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, PhysicalCard, Unit } = require('../src/models');

async function initProductionData() {
  console.log('🔄 开始初始化生产环境数据...\n');

  try {
    // 1. 添加用户和RFID卡 (先创建用户,因为设备需要关联steward)
    console.log('👤 添加用户和RFID卡...\n');

    const users = [
      {
        phone: '+6281234567890',
        name: 'Budi Santoso',
        email: 'user1@atmwater.com',
        password: 'password123',
        balance: 50000.00,
        referralCode: 'BUDI01',
        rfids: ['99092100', '99092101', '99092102', '99092103']
      },
      {
        phone: '+6281234567891',
        name: 'Siti Aminah',
        email: 'user2@atmwater.com',
        password: 'password123',
        balance: 30000.00,
        referralCode: 'SITI02',
        rfids: ['99092104', '99092105']
      },
      {
        phone: '+6281234567892',
        name: 'Ahmad Wijaya',
        email: 'user3@atmwater.com',
        password: 'password123',
        balance: 40000.00,
        referralCode: 'AHMAD03',
        rfids: ['99092106', '99092107', '99092108', '99092109']
      }
      // 可以添加更多用户
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const [user, created] = await User.findOrCreate({
        where: { phoneNumber: userData.phone },
        defaults: {
          phoneNumber: userData.phone,
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          balance: userData.balance,
          referralCode: userData.referralCode,
          role: 'User',
          isActive: true,
          isVerified: true
        }
      });

      if (created) {
        console.log(`✅ 创建用户: ${userData.name}`);
        console.log(`   - 手机: ${userData.phone}`);
        console.log(`   - Email: ${userData.email}`);
        console.log(`   - 余额: Rp ${userData.balance.toLocaleString()}`);
      } else {
        console.log(`⚠️  用户已存在: ${userData.name} (${userData.phone})`);
      }

      // 添加RFID卡
      for (const rfid of userData.rfids) {
        const [card, cardCreated] = await PhysicalCard.findOrCreate({
          where: { rfid },
          defaults: {
            userId: user.id,
            status: 'Active',
            activatedAt: new Date(),
            boundAt: new Date()
          }
        });

        if (cardCreated) {
          console.log(`   ✅ 创建RFID卡: ${rfid}`);
        } else {
          console.log(`   ⚠️  RFID卡已存在: ${rfid}`);
        }
      }
      console.log('');
    }

    // 2. 添加设备 (在用户创建后,可以关联steward)
    console.log('📱 添加设备记录...\n');

    const devices = [
      {
        deviceId: '898608311123900885420001',
        deviceName: 'Water Station - Jakarta Central',
        location: 'Indomaret Kemang, Jakarta Selatan',
        imei: '89860831112390088542',
        password: 'pudow',
        tdsValue: 42,
        temperature: 24.0,
        stewardPhone: '+6281234567890' // Budi Santoso
      }
      // 可以添加更多设备
    ];

    for (const device of devices) {
      // Find steward by phone
      let steward = null;
      if (device.stewardPhone) {
        steward = await User.findOne({ where: { phoneNumber: device.stewardPhone } });
      }

      const [unit, created] = await Unit.findOrCreate({
        where: { deviceId: device.deviceId },
        defaults: {
          deviceName: device.deviceName,
          deviceType: 'WaterDispenser',
          password: device.password,
          status: 'Offline',
          location: device.location,
          stewardId: steward ? steward.id : null,
          tdsValue: device.tdsValue,
          temperature: device.temperature,
          pricePerLiter: 500.00,
          pulsePerLiter: 1.0,
          isActive: true,
          imei: device.imei
        }
      });

      if (created) {
        console.log(`✅ 创建设备: ${device.deviceName}`);
        console.log(`   - Device ID: ${device.deviceId}`);
        console.log(`   - Location: ${device.location}`);
        console.log(`   - Steward: ${steward ? steward.name : 'None'}`);
        console.log(`   - TDS: ${device.tdsValue}, Temp: ${device.temperature}°C`);
        console.log(`   - IMEI: ${device.imei}`);
        console.log(`   - Password: ${device.password}\n`);
      } else {
        console.log(`⚠️  设备已存在: ${device.deviceName} (${device.deviceId})\n`);
      }
    }

    // 3. 验证数据
    console.log('🔍 验证数据...\n');

    const deviceCount = await Unit.count();
    const userCount = await User.count();
    const cardCount = await PhysicalCard.count();

    console.log(`📊 数据统计:`);
    console.log(`   - 设备数量: ${deviceCount}`);
    console.log(`   - 用户数量: ${userCount}`);
    console.log(`   - RFID卡数量: ${cardCount}\n`);

    console.log('✅ 生产环境数据初始化完成！\n');
    console.log('📝 下一步：');
    console.log('   1. 硬件发送WR命令测试');
    console.log('   2. 检查Zeabur日志，应该看到 RT: \'OK\'');
    console.log('   3. 验证前端APP实时更新功能\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error('\n错误详情:', error);
    process.exit(1);
  }
}

// 执行初始化
initProductionData();
