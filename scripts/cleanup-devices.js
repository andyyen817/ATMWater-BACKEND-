// 清理数据库冗余设备脚本
require('dotenv').config();
const sequelize = require('../src/config/database');

async function cleanupDevices() {
  console.log('🔄 开始清理数据库冗余设备...\n');

  try {
    // 1. 查看当前所有设备
    console.log('1. 查看当前所有设备:');
    const [allDevices] = await sequelize.query(
      'SELECT id, device_id, imei, device_name, location FROM units ORDER BY created_at'
    );

    console.log(`\n找到 ${allDevices.length} 个设备:\n`);
    allDevices.forEach((device, index) => {
      console.log(`Row ${index + 1}:`);
      console.log(`  - ID: ${device.id}`);
      console.log(`  - Device ID: ${device.device_id}`);
      console.log(`  - IMEI: ${device.imei || 'NULL'}`);
      console.log(`  - Name: ${device.device_name || 'NULL'}`);
      console.log(`  - Location: ${device.location || 'NULL'}`);
      console.log('');
    });

    // 2. 删除测试设备
    console.log('2. 删除测试设备...');

    // 删除 DEVICE001
    const [result1] = await sequelize.query(
      "DELETE FROM units WHERE device_id = 'DEVICE001'"
    );
    console.log(`✅ 已删除 DEVICE001 (影响行数: ${result1.affectedRows || 0})`);

    // 删除 898608311123900885420002
    const [result2] = await sequelize.query(
      "DELETE FROM units WHERE device_id = '898608311123900885420002'"
    );
    console.log(`✅ 已删除 898608311123900885420002 (影响行数: ${result2.affectedRows || 0})`);

    console.log('');

    // 3. 验证只剩一个设备
    console.log('3. 验证清理结果:');
    const [remainingDevices] = await sequelize.query(
      'SELECT id, device_id, imei, device_name, location FROM units ORDER BY created_at'
    );

    console.log(`\n剩余 ${remainingDevices.length} 个设备:\n`);
    remainingDevices.forEach((device, index) => {
      console.log(`Row ${index + 1}:`);
      console.log(`  - ID: ${device.id}`);
      console.log(`  - Device ID: ${device.device_id}`);
      console.log(`  - IMEI: ${device.imei || 'NULL'}`);
      console.log(`  - Name: ${device.device_name || 'NULL'}`);
      console.log(`  - Location: ${device.location || 'NULL'}`);
      console.log('');
    });

    if (remainingDevices.length === 1 && remainingDevices[0].device_id === '898608311123900885420001') {
      console.log('✅ 数据库清理完成！只保留了生产设备 898608311123900885420001\n');
    } else {
      console.log('⚠️  警告: 清理结果不符合预期\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanupDevices();
