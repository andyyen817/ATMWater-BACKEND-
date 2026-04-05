// 数据库迁移脚本：添加 communicationLogs 字段
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Connected to database');

    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'communicationLogs'`,
      [process.env.DB_NAME]
    );

    if (columns.length > 0) {
      console.log('✅ communicationLogs field already exists');
      return;
    }

    // 添加字段
    console.log('Adding communicationLogs field...');
    await connection.query(
      `ALTER TABLE applications
       ADD COLUMN communicationLogs JSON NULL
       COMMENT '沟通记录数组，格式：[{ adminId, adminName, content, createdAt }]'`
    );

    // 初始化现有记录
    console.log('Initializing existing records...');
    await connection.query(
      `UPDATE applications SET communicationLogs = JSON_ARRAY() WHERE communicationLogs IS NULL`
    );

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);
