// 检查用户账户
require('dotenv').config();
const { User } = require('../src/models');

async function checkUser() {
  try {
    const user = await User.findOne({ where: { email: 'user1@atmwater.com' } });

    if (user) {
      console.log('✅ 找到用户:');
      console.log('  - ID:', user.id);
      console.log('  - Email:', user.email);
      console.log('  - Name:', user.name);
      console.log('  - Phone:', user.phoneNumber);
      console.log('  - Has Password:', !!user.password);
      console.log('  - Balance:', user.balance);
    } else {
      console.log('❌ 用户不存在: user1@atmwater.com');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkUser();
