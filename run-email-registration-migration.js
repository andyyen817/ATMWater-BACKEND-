const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  console.log('✅ Connected to MySQL database');

  try {
    // 1. 将 phone 字段改为可选（NULLABLE）
    console.log('\n📝 Step 1: Making phone field NULLABLE...');
    await connection.query('ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NULL');
    console.log('✅ Phone field is now NULLABLE');

    // 2. 为 email 字段添加唯一约束
    console.log('\n📝 Step 2: Adding UNIQUE constraint to email field...');
    try {
      await connection.query('ALTER TABLE users ADD UNIQUE KEY unique_email (email)');
      console.log('✅ UNIQUE constraint added to email field');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  UNIQUE constraint already exists, skipping...');
      } else {
        throw error;
      }
    }

    // 3. 验证修改
    console.log('\n📝 Step 3: Verifying changes...');
    const [columns] = await connection.query('DESCRIBE users');
    console.log('\n📋 Users table structure:');
    console.table(columns);

    const [indexes] = await connection.query('SHOW INDEX FROM users');
    console.log('\n📋 Users table indexes:');
    console.table(indexes);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
