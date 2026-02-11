// add-otp-fields.js
// 添加 OTP 相关字段到 users 表

require('dotenv').config();
const sequelize = require('./src/config/database');

async function addOtpFields() {
  try {
    console.log('[DB] Connecting...');
    await sequelize.authenticate();
    console.log('[DB] ✅ Connected\n');

    // 添加 otp 字段
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN otp VARCHAR(10) NULL COMMENT "OTP验证码"');
      console.log('[DB] ✅ Added otp field');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('[DB] ⚠️  otp field already exists');
      } else {
        throw error;
      }
    }

    // 添加 otp_expires 字段
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN otp_expires DATETIME NULL COMMENT "OTP过期时间"');
      console.log('[DB] ✅ Added otp_expires field');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('[DB] ⚠️  otp_expires field already exists');
      } else {
        throw error;
      }
    }

    // 验证修改
    const [results] = await sequelize.query('DESCRIBE users');
    const otpField = results.find(r => r.Field === 'otp');
    const otpExpiresField = results.find(r => r.Field === 'otp_expires');

    console.log('\n[DB] OTP fields info:');
    console.log('otp:', otpField);
    console.log('otp_expires:', otpExpiresField);

    process.exit(0);
  } catch (error) {
    console.error('[DB] ❌ Error:', error.message);
    process.exit(1);
  }
}

addOtpFields();
