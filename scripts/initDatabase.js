// ATMWater-BACKEND/scripts/initDatabase.js
// 初始化 MySQL 数据库脚本

require('dotenv').config();
const { sequelize, User, PhysicalCard, Unit, Transaction, syncDatabase } = require('../src/models');

async function initDatabase() {
  try {
    console.log('========================================');
    console.log('🚀 Starting database initialization...');
    console.log('========================================\n');
    
    // 1. 测试连接
    console.log('[1/5] Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // 2. 同步表结构（force: true 会删除现有表）
    console.log('[2/5] Synchronizing database schema...');
    await syncDatabase({ force: true });
    console.log('✅ Database schema synchronized\n');
    
    // 3. 创建测试用户
    console.log('[3/5] Creating test users...');
    
    const testUser = await User.create({
      phone: '081234567890',
      password: 'password123',
      pin: '1234',
      name: 'Test User',
      email: 'test@example.com',
      balance: 50000.00,
      role: 'User',
      isActive: true,
      isVerified: true
    });
    console.log(`✅ Created user: ${testUser.phone} (ID: ${testUser.id})`);
    
    const adminUser = await User.create({
      phone: '081234567891',
      password: 'admin123',
      pin: '9999',
      name: 'Admin User',
      email: 'admin@example.com',
      balance: 0.00,
      role: 'Admin',
      isActive: true,
      isVerified: true
    });
    console.log(`✅ Created admin: ${adminUser.phone} (ID: ${adminUser.id})\n`);
    
    // 4. 创建测试设备
    console.log('[4/5] Creating test devices...');
    
    const testDevice = await Unit.create({
      deviceId: 'DEVICE001',
      deviceName: 'Test Water Dispenser',
      deviceType: 'WaterDispenser',
      password: 'pudow',
      location: 'Jakarta Office',
      latitude: -6.2088,
      longitude: 106.8456,
      status: 'Offline',
      isActive: true,
      pricePerLiter: 500.00,
      tdsValue: 50,
      temperature: 25.5
    });
    console.log(`✅ Created device: ${testDevice.deviceId} (ID: ${testDevice.id})\n`);
    
    // 5. 创建测试 RFID 卡
    console.log('[5/5] Creating test RFID cards...');
    
    const testCard = await PhysicalCard.create({
      rfid: 'RFID001',
      userId: testUser.id,
      status: 'Active',
      batchId: 'BATCH001',
      activatedAt: new Date(),
      boundAt: new Date()
    });
    console.log(`✅ Created RFID card: ${testCard.rfid} (bound to user ${testUser.phone})\n`);
    
    // 显示测试信息
    console.log('========================================');
    console.log('✅ Database initialization completed!');
    console.log('========================================\n');
    
    console.log('📋 Test Data Summary:');
    console.log('─────────────────────────────────────');
    console.log('👤 Test User:');
    console.log(`   Phone: ${testUser.phone}`);
    console.log(`   Password: password123`);
    console.log(`   PIN: 1234`);
    console.log(`   Balance: Rp ${testUser.balance.toLocaleString()}`);
    console.log(`   Virtual RFID: ${testUser.virtualRfid}`);
    console.log('');
    console.log('🔧 Test Device:');
    console.log(`   Device ID: ${testDevice.deviceId}`);
    console.log(`   Password: ${testDevice.password}`);
    console.log(`   Location: ${testDevice.location}`);
    console.log(`   Price: Rp ${testDevice.pricePerLiter}/L`);
    console.log('');
    console.log('💳 Test RFID Card:');
    console.log(`   RFID: ${testCard.rfid}`);
    console.log(`   Bound to: ${testUser.phone}`);
    console.log('─────────────────────────────────────\n');
    
    console.log('🧪 TCP Test Command:');
    console.log('─────────────────────────────────────');
    console.log('1. Device Authentication:');
    console.log(`   {"Cmd":"AU","DId":"${testDevice.deviceId}","Type":"WaterDispenser","Pwd":"${testDevice.password}"}`);
    console.log('');
    console.log('2. Heartbeat:');
    console.log(`   {"Cmd":"HB","DId":"${testDevice.deviceId}"}`);
    console.log('');
    console.log('3. Swipe Water (Physical Card):');
    console.log(`   {"Cmd":"SW","DId":"${testDevice.deviceId}","RFID":"${testCard.rfid}","Vol":"2.5","Price":"500"}`);
    console.log('');
    console.log('4. Swipe Water (Virtual Card):');
    console.log(`   {"Cmd":"SW","DId":"${testDevice.deviceId}","RFID":"${testUser.virtualRfid}","Vol":"2.5","Price":"500"}`);
    console.log('─────────────────────────────────────\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// 运行初始化
initDatabase();

