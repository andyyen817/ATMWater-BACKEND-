// create-test-user.js
// 创建测试用户脚本

require('dotenv').config();
const { User, sequelize } = require('./src/models');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    console.log('[Test] Connecting to database...');
    await sequelize.authenticate();
    console.log('[Test] ✅ Database connected');

    // 同步数据库表（创建表如果不存在）
    console.log('[Test] Syncing database tables...');
    await sequelize.sync({ alter: true });  // alter: true 会更新表结构
    console.log('[Test] ✅ Tables synced');

    // 检查用户是否已存在
    const phoneNumber = '+6281234567890';
    let user = await User.findOne({ where: { phoneNumber } });

    if (user) {
      console.log('[Test] ⚠️  User already exists:', phoneNumber);
      console.log('[Test] User ID:', user.id);
      console.log('[Test] Balance:', user.balance);
    } else {
      // 创建测试用户
      console.log('[Test] Creating test user...');
      const hashedPassword = await bcrypt.hash('123456', 10);

      user = await User.create({
        phoneNumber: phoneNumber,
        password: hashedPassword,
        name: 'Test User',
        role: 'User',
        balance: 0,
        isActive: true,
        isVerified: true
      });

      console.log('[Test] ✅ Test user created successfully!');
      console.log('[Test] Phone:', user.phoneNumber);
      console.log('[Test] ID:', user.id);
      console.log('[Test] Password: 123456');
    }

    // 创建管理员用户
    const adminPhone = '+6281234567891';
    let admin = await User.findOne({ where: { phoneNumber: adminPhone } });

    if (!admin) {
      console.log('[Test] Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);

      admin = await User.create({
        phoneNumber: adminPhone,
        password: hashedPassword,
        name: 'Admin User',
        role: 'Admin',
        balance: 0,
        isActive: true,
        isVerified: true
      });

      console.log('[Test] ✅ Admin user created!');
      console.log('[Test] Phone:', admin.phoneNumber);
      console.log('[Test] Password: admin123');
    }

    console.log('\n[Test] ✅ Setup complete!');
    console.log('[Test] You can now login with:');
    console.log('[Test] - User: +6281234567890 / 123456');
    console.log('[Test] - Admin: +6281234567891 / admin123');

    process.exit(0);
  } catch (error) {
    console.error('[Test] ❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTestUser();
