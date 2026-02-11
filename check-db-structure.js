// check-db-structure.js
// 检查数据库表结构

require('dotenv').config();
const { sequelize } = require('./src/models');

async function checkDatabase() {
  try {
    console.log('[DB] Connecting...');
    await sequelize.authenticate();
    console.log('[DB] ✅ Connected\n');

    // 查询 users 表结构
    const [results] = await sequelize.query('DESCRIBE users');
    console.log('[DB] Users table structure:');
    console.table(results);

    // 查询现有用户
    const [users] = await sequelize.query('SELECT * FROM users LIMIT 5');
    console.log('\n[DB] Existing users:');
    console.table(users);

    process.exit(0);
  } catch (error) {
    console.error('[DB] ❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
