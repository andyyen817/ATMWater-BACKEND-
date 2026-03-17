// 更新设备型号从 HS003 到 ATM-ID-1000P
require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateDeviceType() {
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

    // 查询更新前的设备信息
    console.log('📋 更新前的设备信息...\n');
    const [before] = await connection.query(
      `SELECT id, device_id, device_name, device_type, firmware_version 
       FROM units 
       WHERE device_id = '898608311123900885420001'`
    );

    if (before.length === 0) {
      console.log('❌ 未找到设备');
      return;
    }

    console.log('设备信息：');
    console.log(`ID: ${before[0].id}`);
    console.log(`device_id: ${before[0].device_id}`);
    console.log(`device_name: ${before[0].device_name}`);
    console.log(`当前 device_type: ${before[0].device_type}`);
    console.log(`firmware_version: ${before[0].firmware_version}`);

    // 更新设备型号
    console.log('\n🔄 正在更新设备型号为 ATM-ID-1000P...\n');
    await connection.query(
      `UPDATE units 
       SET device_type = 'ATM-ID-1000P' 
       WHERE device_id = '898608311123900885420001'`
    );

    // 查询更新后的设备信息
    const [after] = await connection.query(
      `SELECT id, device_id, device_name, device_type, firmware_version 
       FROM units 
       WHERE device_id = '898608311123900885420001'`
    );

    console.log('✅ 更新成功！\n');
    console.log('更新后的设备信息：');
    console.log(`ID: ${after[0].id}`);
    console.log(`device_id: ${after[0].device_id}`);
    console.log(`device_name: ${after[0].device_name}`);
    console.log(`新 device_type: ${after[0].device_type}`);
    console.log(`firmware_version: ${after[0].firmware_version}`);

    console.log('\n🎉 设备型号已更新为 ATM-ID-1000P！');
    console.log('现在前端固件升级时可以找到这台设备了。');

  } catch (error) {
    console.error('❌ 更新失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

updateDeviceType();
