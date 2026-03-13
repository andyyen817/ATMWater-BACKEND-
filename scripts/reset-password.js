// 重置用户密码为 password123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');

async function resetPassword() {
  try {
    const user = await User.findOne({ where: { email: 'user1@atmwater.com' } });

    if (!user) {
      console.log('❌ 用户不存在');
      process.exit(1);
    }

    console.log('重置密码为: password123');

    const hashedPassword = await bcrypt.hash('password123', 10);
    console.log('新哈希:', hashedPassword);

    // 直接使用SQL更新，避免Sequelize的任何转换
    await user.sequelize.query(
      'UPDATE users SET password = ? WHERE id = ?',
      { replacements: [hashedPassword, user.id] }
    );

    console.log('✅ 密码已重置\n');

    // 验证更新
    const updatedUser = await User.findOne({ where: { email: 'user1@atmwater.com' } });
    console.log('验证新密码:');
    const isValid = await bcrypt.compare('password123', updatedUser.password);
    console.log('密码验证:', isValid ? '✅ 正确' : '❌ 错误');

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
    process.exit(1);
  }
}

resetPassword();
