// 数据库迁移脚本执行器
// 用于执行 add_device_model_to_firmware.sql

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;

  try {
    console.log('🔌 连接到数据库...');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ 数据库连接成功');

    // 读取迁移脚本
    const sqlFile = path.join(__dirname, 'migrations', 'add_device_model_to_firmware.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // 分割 SQL 语句（按分号分割，忽略注释）
    const statements = sqlContent
      .split('\n')
      .filter(line => line.trim().length > 0 && !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 找到 ${statements.length} 条 SQL 语句`);

    // 执行每条 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n执行语句 ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + '...');

      await connection.query(statement);
      console.log('✅ 执行成功');
    }

    console.log('\n🎉 数据库迁移完成！');

    // 验证迁移结果
    console.log('\n🔍 验证迁移结果...');
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM firmware_versions WHERE Field = 'device_model'"
    );

    if (columns.length > 0) {
      console.log('✅ device_model 字段已成功添加');
      console.log('字段信息:', columns[0]);
    } else {
      console.log('❌ device_model 字段未找到');
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration();
