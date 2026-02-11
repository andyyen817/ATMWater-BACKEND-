require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log
  }
);

async function resetAdminPassword() {
  try {
    console.log('🔄 Resetting admin password...');

    // 直接使用SQL更新，避免Sequelize的beforeUpdate钩子
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const [results] = await sequelize.query(
      'UPDATE users SET password = ? WHERE phone = ?',
      {
        replacements: [hashedPassword, '081234567891']
      }
    );

    console.log('✅ Password reset successful!');
    console.log('📱 Phone: 081234567891');
    console.log('🔑 Password: admin123');
    console.log('📊 Rows affected:', results.affectedRows);

    // 验证密码
    const [users] = await sequelize.query(
      'SELECT phone, password FROM users WHERE phone = ?',
      {
        replacements: ['081234567891']
      }
    );

    if (users.length > 0) {
      const match = await bcrypt.compare('admin123', users[0].password);
      console.log('✅ Password verification:', match ? 'SUCCESS' : 'FAILED');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdminPassword();
