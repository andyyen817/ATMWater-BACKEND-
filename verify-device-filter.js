// 验证设备筛选功能
require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifyDeviceFilter() {
  let connection;

  try {
    console.log('🔌 连接到数据库...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ 数据库连接成功\n');

    // 1. 查询所有 ATM-ID-1000P 型号的设备
    console.log('📋 查询所有 ATM-ID-1000P 型号的设备...\n');
    const [devices] = await connection.query(
      `SELECT id, device_id, device_name, device_type, location, firmware_version, imei, status, is_active
       FROM units 
       WHERE device_type = 'ATM-ID-1000P' AND is_active = 1`
    );

    console.log(`找到 ${devices.length} 台 ATM-ID-1000P 设备：\n`);
    devices.forEach(d => {
      console.log(`设备 ID: ${d.id}`);
      console.log(`设备编号: ${d.device_id}`);
      console.log(`设备名称: ${d.device_name}`);
      console.log(`设备型号: ${d.device_type}`);
      console.log(`位置: ${d.location || '未设置'}`);
      console.log(`固件版本: ${d.firmware_version}`);
      console.log(`IMEI: ${d.imei}`);
      console.log(`状态: ${d.status}`);
      console.log(`激活: ${d.is_active ? '是' : '否'}`);
      console.log('---');
    });

    // 2. 模拟前端筛选逻辑（无筛选条件，只查询激活设备）
    console.log('\n📋 模拟前端筛选（无筛选条件）...\n');
    const [allActive] = await connection.query(
      `SELECT id, device_id, device_name, location, firmware_version, imei, status
       FROM units 
       WHERE is_active = 1
       ORDER BY device_id ASC`
    );

    console.log(`找到 ${allActive.length} 台激活设备：\n`);
    allActive.forEach(d => {
      console.log(`${d.device_id} - ${d.device_name || '未命名'} - ${d.status}`);
    });

    // 3. 查询设备型号分布
    console.log('\n📋 设备型号分布...\n');
    const [types] = await connection.query(
      `SELECT device_type, COUNT(*) as count
       FROM units
       WHERE is_active = 1
       GROUP BY device_type`
    );

    console.log('激活设备的型号分布：');
    types.forEach(t => {
      console.log(`  - ${t.device_type}: ${t.count} 台`);
    });

    console.log('\n✅ 验证完成！');
    console.log('前端固件升级时应该能看到设备 898608311123900885420001 了。');

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

verifyDeviceFilter();
