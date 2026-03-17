// 检查固件数据
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkFirmwareData() {
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

    // 1. 检查 firmware_versions 表是否存在
    console.log('📋 检查 firmware_versions 表...\n');
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'firmware_versions'"
    );

    if (tables.length === 0) {
      console.log('❌ firmware_versions 表不存在！');
      console.log('需要创建表。');
      return;
    }

    console.log('✅ firmware_versions 表存在\n');

    // 2. 查看表结构
    console.log('📋 查看 firmware_versions 表结构...\n');
    const [columns] = await connection.query('SHOW COLUMNS FROM firmware_versions');
    console.log('表字段：');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // 3. 查询所有固件版本
    console.log('\n📋 查询所有固件版本...\n');
    const [firmwares] = await connection.query(
      'SELECT * FROM firmware_versions ORDER BY created_at DESC'
    );

    console.log(`找到 ${firmwares.length} 个固件版本：\n`);
    
    if (firmwares.length === 0) {
      console.log('❌ 数据库中没有任何固件版本！');
      console.log('这就是为什么前端显示空列表的原因。');
    } else {
      firmwares.forEach(fw => {
        console.log(`ID: ${fw.id}`);
        console.log(`版本: ${fw.version}`);
        console.log(`设备型号: ${fw.device_model}`);
        console.log(`文件名: ${fw.file_name}`);
        console.log(`文件大小: ${fw.file_size} bytes`);
        console.log(`CRC32: ${fw.crc32}`);
        console.log(`描述: ${fw.description || '无'}`);
        console.log(`激活: ${fw.is_active ? '是' : '否'}`);
        console.log(`上传者: ${fw.uploaded_by}`);
        console.log(`创建时间: ${fw.created_at}`);
        console.log('---');
      });
    }

    // 4. 检查 upgrade_tasks 表
    console.log('\n📋 检查 upgrade_tasks 表...\n');
    const [taskTables] = await connection.query(
      "SHOW TABLES LIKE 'upgrade_tasks'"
    );

    if (taskTables.length === 0) {
      console.log('❌ upgrade_tasks 表不存在！');
      return;
    }

    console.log('✅ upgrade_tasks 表存在\n');

    // 5. 查询所有升级任务
    console.log('📋 查询所有升级任务...\n');
    const [tasks] = await connection.query(
      'SELECT * FROM upgrade_tasks ORDER BY created_at DESC LIMIT 10'
    );

    console.log(`找到 ${tasks.length} 个升级任务：\n`);
    
    if (tasks.length === 0) {
      console.log('❌ 数据库中没有任何升级任务！');
      console.log('这就是为什么升级监控页面显示空列表的原因。');
    } else {
      tasks.forEach(task => {
        console.log(`ID: ${task.id}`);
        console.log(`设备ID: ${task.device_id}`);
        console.log(`固件版本ID: ${task.firmware_version_id}`);
        console.log(`状态: ${task.status}`);
        console.log(`进度: ${task.progress}%`);
        console.log(`创建时间: ${task.created_at}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

checkFirmwareData();
