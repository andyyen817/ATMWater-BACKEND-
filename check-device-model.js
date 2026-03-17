// 检查设备和设备型号的关系
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkDeviceModel() {
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

    // 1. 查看 units 表结构
    console.log('📋 查看 units 表结构...\n');
    const [columns] = await connection.query('SHOW COLUMNS FROM units');
    console.log('表字段：');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // 2. 查询设备 898608311123900885420001
    console.log('\n📋 查询设备 898608311123900885420001...\n');
    const [device] = await connection.query(
      `SELECT * FROM units WHERE device_id = '898608311123900885420001' OR imei = '898608311123900885420001'`
    );

    if (device.length > 0) {
      console.log('✅ 找到设备：');
      console.log(JSON.stringify(device[0], null, 2));
    } else {
      console.log('❌ 未找到设备');
      
      // 尝试模糊查询
      console.log('\n🔍 尝试模糊查询...\n');
      const [fuzzy] = await connection.query(
        `SELECT * FROM units WHERE device_id LIKE '%898608%' OR imei LIKE '%898608%' LIMIT 5`
      );
      
      if (fuzzy.length > 0) {
        console.log(`找到 ${fuzzy.length} 个相似设备：`);
        fuzzy.forEach(u => {
          console.log(`\nID: ${u.id}`);
          console.log(`device_id: ${u.device_id}`);
          console.log(`imei: ${u.imei}`);
          console.log(`device_type: ${u.device_type}`);
          console.log(`is_active: ${u.is_active}`);
        });
      }
    }

    // 3. 查询所有激活的设备
    console.log('\n📋 查询所有激活的设备（前10个）...\n');
    const [activeDevices] = await connection.query(
      `SELECT id, device_id, imei, device_type, device_name, location, is_active 
       FROM units 
       WHERE is_active = 1 
       LIMIT 10`
    );

    console.log(`找到 ${activeDevices.length} 个激活设备：`);
    activeDevices.forEach(u => {
      console.log(`\nID: ${u.id}`);
      console.log(`device_id: ${u.device_id}`);
      console.log(`imei: ${u.imei}`);
      console.log(`device_type: ${u.device_type}`);
      console.log(`device_name: ${u.device_name}`);
      console.log(`location: ${u.location}`);
    });

    // 4. 检查 device_type 字段的所有唯一值
    console.log('\n📋 查询所有设备型号（device_type）...\n');
    const [deviceTypes] = await connection.query(
      `SELECT DISTINCT device_type, COUNT(*) as count 
       FROM units 
       GROUP BY device_type`
    );

    console.log('设备型号分布：');
    deviceTypes.forEach(dt => {
      console.log(`  - ${dt.device_type}: ${dt.count} 台设备`);
    });

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

checkDeviceModel();
