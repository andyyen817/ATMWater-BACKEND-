// fix-password-nullable.js
// 修复 users 表的 password 字段，使其可为空

require('dotenv').config();
const sequelize = require('./src/config/database');

async function fixPasswordField() {
  try {
    console.log('[DB] Connecting...');
    await sequelize.authenticate();
    console.log('[DB] ✅ Connected\n');

    // 修改 password 字段为可空
    await sequelize.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL COMMENT "密码（bcrypt加密）"');
    console.log('[DB] ✅ Password field is now nullable');

    // 验证修改
    const [results] = await sequelize.query('DESCRIBE users');
    const passwordField = results.find(r => r.Field === 'password');
    console.log('\n[DB] Password field info:');
    console.log(passwordField);

    process.exit(0);
  } catch (error) {
    console.error('[DB] ❌ Error:', error.message);
    process.exit(1);
  }
}

fixPasswordField();
