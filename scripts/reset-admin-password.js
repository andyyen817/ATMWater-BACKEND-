require('dotenv').config();
const { User } = require('../src/models');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  // The beforeCreate hook double-hashes if we pass a hash, so pass plain text
  // and let the hook hash it. But findOrCreate already ran the hook.
  // Use direct SQL update to set password correctly.
  const hash = await bcrypt.hash('Admin@123456', 10);
  await User.sequelize.query(
    "UPDATE users SET password = ? WHERE email = 'admin@atmwater.com'",
    { replacements: [hash] }
  );
  console.log('Password reset done. Hash prefix:', hash.substring(0, 20));

  // Verify
  const user = await User.findOne({ where: { email: 'admin@atmwater.com' } });
  const ok = await bcrypt.compare('Admin@123456', user.password);
  console.log('Verify match:', ok);
  await User.sequelize.close();
}
resetAdmin().catch(e => { console.error(e.message); process.exit(1); });
