// 更新现有用户添加email和密码
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');

async function updateUser() {
  try {
    // 找到ID为3的用户 (手机号 +6281234567890)
    const user = await User.findOne({ where: { phoneNumber: '+6281234567890' } });

    if (!user) {
      console.log('❌ 用户不存在');
      process.exit(1);
    }

    console.log('找到用户:', user.name || user.phoneNumber);
    console.log('更新email和密码...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    user.email = 'user1@atmwater.com';
    user.password = hashedPassword;
    user.name = 'Budi Santoso';
    await user.save();

    console.log('✅ 用户更新成功\n');
    console.log('用户信息:');
    console.log('  - ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Name:', user.name);
    console.log('  - Phone:', user.phoneNumber);
    console.log('  - Balance:', user.balance);
    console.log('  - Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateUser();
