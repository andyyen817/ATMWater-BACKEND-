require('dotenv').config();
const { User } = require('../src/models');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const hash = await bcrypt.hash('Admin@123456', 10);
  const [user, created] = await User.findOrCreate({
    where: { email: 'admin@atmwater.com' },
    defaults: {
      name: 'Super Admin',
      email: 'admin@atmwater.com',
      phoneNumber: '081000000001',
      role: 'GM',
      password: hash,
      isActive: true,
      isVerified: true,
      balance: 0
    }
  });
  if (!created) {
    await user.update({ role: 'GM', password: hash });
  }
  console.log('[Admin] ' + (created ? '已创建' : '已更新') + ' — ID=' + user.id + ', email=' + user.email + ', role=' + user.role);
  console.log('[Admin] 登录信息: admin@atmwater.com / Admin@123456');
  await User.sequelize.close();
}

createAdmin().catch(e => { console.error('[Admin] 错误:', e.message); process.exit(1); });
