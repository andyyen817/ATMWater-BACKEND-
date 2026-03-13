// 执行数据库修复脚本
require('dotenv').config();
const sequelize = require('../src/config/database');

async function fixDeviceId() {
  console.log('🔄 开始修复设备ID...\n');

  try {
    // 1. 查看当前问题数据
    console.log('1. 查看当前问题数据:');
    const [problemRows] = await sequelize.query(
      "SELECT id, device_id, imei, device_name, location FROM units WHERE device_id = '89860831112390088542'"
    );
    console.log('问题数据:', problemRows);
    console.log('');

    if (problemRows.length === 0) {
      console.log('✅ 没有发现问题数据，可能已经修复过了\n');
    } else {
      // 2. 修正deviceId
      console.log('2. 修正deviceId...');
      const [updateResult] = await sequelize.query(
        "UPDATE units SET device_id = '898608311123900885420002' WHERE device_id = '89860831112390088542'"
      );
      console.log(`✅ 已更新 ${updateResult.affectedRows || 1} 条记录\n`);
    }

    // 3. 验证修复结果
    console.log('3. 验证修复结果:');
    const [allUnits] = await sequelize.query(
      "SELECT id, device_id, imei, device_name, location FROM units ORDER BY created_at"
    );

    console.log('\n所有设备记录:');
    allUnits.forEach((unit, index) => {
      console.log(`Row ${index + 1}:`);
      console.log(`  - ID: ${unit.id}`);
      console.log(`  - Device ID: ${unit.device_id}`);
      console.log(`  - IMEI: ${unit.imei || 'NULL'}`);
      console.log(`  - Name: ${unit.device_name}`);
      console.log(`  - Location: ${unit.location || 'NULL'}`);
      console.log('');
    });

    console.log('✅ 数据库修复完成！\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixDeviceId();
