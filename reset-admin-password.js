/**
 * 重置管理员密码
 * 运行: node reset-admin-password.js
 */
require('dotenv').config();
const { sequelize, User } = require('./src/models');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    const phoneNumber = '081234567891';
    const newPassword = 'admin123';

    // 查找用户
    const user = await User.findOne({ where: { phoneNumber } });

    if (!user) {
      console.error(`❌ 未找到用户: ${phoneNumber}`);
      process.exit(1);
    }

    console.log(`📱 找到用户: ${user.name} (${user.phoneNumber})`);
    console.log(`👤 角色: ${user.role}`);

    // 手动加密密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 直接更新密码（绕过 hooks）
    await sequelize.query(
      'UPDATE users SET password = ? WHERE phone = ?',
      { replacements: [hashedPassword, phoneNumber] }
    );

    console.log(`✅ 密码已重置为: ${newPassword}`);
    console.log(`\n登录信息：`);
    console.log(`  电话: ${phoneNumber}`);
    console.log(`  密码: ${newPassword}`);

    await sequelize.close();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

resetPassword();
