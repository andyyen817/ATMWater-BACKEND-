const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const users = await mongoose.connection.db.collection('users').find({}).toArray();

    console.log('=== 所有管理员账户 ===');
    users.forEach(u => {
      if (u.role && (u.role.includes('Admin') || u.role.includes('Manager'))) {
        console.log(`Phone: ${u.phoneNumber} | Role: ${u.role} | Password: ${u.password ? 'YES' : 'NO'}`);
      }
    });

    // 为带正确前缀的账户设置密码
    const targetPhone = '+628770000001';
    const target = await mongoose.connection.db.collection('users').findOne({ phoneNumber: targetPhone });
    if (target) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('123456', salt);
      await mongoose.connection.db.collection('users').updateOne(
        { _id: target._id },
        { $set: { password: hashedPassword } }
      );
      console.log('\n=== Password Set ===');
      console.log(`Phone: ${targetPhone}`);
      console.log(`Password: 123456`);
      console.log(`Name: ${target.name}`);
      console.log(`Role: ${target.role}`);
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
