require('dotenv').config();
const { User } = require('../src/models');
const bcrypt = require('bcryptjs');

async function check() {
  const user = await User.findOne({ where: { email: 'admin@atmwater.com' } });
  if (!user) { console.log('User NOT found'); process.exit(1); }
  console.log('ID:', user.id, 'role:', user.role, 'isActive:', user.isActive);
  const ok = await bcrypt.compare('Admin@123456', user.password);
  console.log('Password match:', ok);
  await User.sequelize.close();
}
check().catch(e => { console.error(e.message); process.exit(1); });
