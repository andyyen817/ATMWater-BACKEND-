// 列出所有用户
require('dotenv').config();
const { User } = require('../src/models');

async function listUsers() {
  try {
    const users = await User.findAll({
      attributes: ['id', 'phoneNumber', 'email', 'name', 'role', 'balance'],
      limit: 10
    });

    console.log(`\n找到 ${users.length} 个用户:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No Name'}`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Phone: ${user.phoneNumber}`);
      console.log(`   - Email: ${user.email || 'No Email'}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Balance: Rp ${user.balance}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

listUsers();
