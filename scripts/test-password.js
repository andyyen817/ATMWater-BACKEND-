// 测试密码验证
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');

async function testPassword() {
  try {
    const user = await User.findOne({ where: { email: 'user1@atmwater.com' } });

    if (!user) {
      console.log('❌ 用户不存在');
      process.exit(1);
    }

    console.log('用户信息:');
    console.log('  - Email:', user.email);
    console.log('  - Name:', user.name);
    console.log('  - Password Hash:', user.password);
    console.log('');

    const testPassword = 'password123';
    console.log('测试密码:', testPassword);

    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log('密码验证结果:', isValid ? '✅ 正确' : '❌ 错误');

    // 生成新的哈希测试
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log('\n新生成的哈希:', newHash);

    const isNewValid = await bcrypt.compare(testPassword, newHash);
    console.log('新哈希验证:', isNewValid ? '✅ 正确' : '❌ 错误');

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

testPassword();
