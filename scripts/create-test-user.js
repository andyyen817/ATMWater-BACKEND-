// 创建测试用户 user1@atmwater.com
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');

async function createTestUser() {
  try {
    // 检查用户是否已存在
    let user = await User.findOne({ where: { email: 'user1@atmwater.com' } });

    if (user) {
      console.log('⚠️  用户已存在，更新密码...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      user.password = hashedPassword;
      await user.save();
      console.log('✅ 密码已更新');
    } else {
      console.log('创建新用户 user1@atmwater.com...');
      const hashedPassword = await bcrypt.hash('password123', 10);

      user = await User.create({
        phoneNumber: '+6281234567890',
        name: 'Budi Santoso',
        email: 'user1@atmwater.com',
        password: hashedPassword,
        balance: 50000.00,
        referralCode: 'BUDI01',
        role: 'User',
        isActive: true,
        isVerified: true
      });

      console.log('✅ 用户创建成功');
    }

    console.log('\n用户信息:');
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

createTestUser();
