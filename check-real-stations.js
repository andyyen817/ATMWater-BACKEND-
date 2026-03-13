// 查询真实售水站设备信息
const mysql = require('mysql2/promise');

async function checkRealStations() {
  try {
    // 连接数据库
    const connection = await mysql.createConnection({
      host: 'hkg1.clusters.zeabur.com',
      port: 30886,
      user: 'root',
      password: 'm6RE5f3pADClMNn9ca47Z1z028gbXxuW',
      database: 'zeabur'
    });

    console.log('✅ 已连接到数据库\n');
    console.log('========================================');
    console.log('真实售水站设备信息');
    console.log('========================================\n');

    // 查询所有活跃的售水站
    const [units] = await connection.execute(`
      SELECT
        id,
        device_id,
        device_name,
        location,
        status,
        tds_value,
        temperature,
        price_per_liter,
        pulse_per_liter,
        is_active,
        created_at,
        updated_at
      FROM units
      WHERE is_active = 1 OR is_active IS NULL
      ORDER BY created_at DESC
    `);

    if (units.length === 0) {
      console.log('⚠️  数据库中没有找到活跃的售水站设备');
      await connection.end();
      return;
    }

    console.log(`📊 找到 ${units.length} 个售水站设备\n`);

    units.forEach((unit, index) => {
      console.log(`【设备 ${index + 1}】`);
      console.log(`  设备ID (device_id): ${unit.device_id}`);
      console.log(`  设备名称: ${unit.device_name || '未设置'}`);
      console.log(`  位置: ${unit.location || '未设置'}`);
      console.log(`  状态: ${unit.status || '未设置'}`);
      console.log(`  水质TDS: ${unit.tds_value || '未设置'} ppm`);
      console.log(`  温度: ${unit.temperature || '未设置'} °C`);
      console.log(`  价格: ${unit.price_per_liter || '未设置'} 水币/升`);
      console.log(`  脉冲数: ${unit.pulse_per_liter || '未设置'} 脉冲/升`);
      console.log(`  是否活跃: ${unit.is_active ? '是' : '否'}`);
      console.log(`  创建时间: ${unit.created_at}`);
      console.log(`  更新时间: ${unit.updated_at}`);
      console.log(`  二维码URL: https://qr.airkop.com/qrcode/atmwater/${unit.device_id}`);
      console.log('');
    });

    console.log('========================================');
    console.log('TCP连接状态检查');
    console.log('========================================\n');

    // 查询最近的TCP连接日志（如果有的话）
    const [logs] = await connection.execute(`
      SELECT
        device_id,
        MAX(created_at) as last_seen
      FROM transactions
      WHERE device_id IS NOT NULL
      GROUP BY device_id
      ORDER BY last_seen DESC
      LIMIT 10
    `);

    if (logs.length > 0) {
      console.log('最近有交易记录的设备：\n');
      logs.forEach((log, index) => {
        console.log(`${index + 1}. 设备ID: ${log.device_id}`);
        console.log(`   最后活动: ${log.last_seen}\n`);
      });
    } else {
      console.log('⚠️  暂无交易记录\n');
    }

    await connection.end();
    console.log('✅ 查询完成');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkRealStations();
