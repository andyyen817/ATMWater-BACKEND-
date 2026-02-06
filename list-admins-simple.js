const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('=== 管理员账户列表 ===');
    users.forEach(u => {
      if (u.role && u.role.includes('Admin')) {
        const hasPwd = u.password ? '[有密码]' : '[无密码]';
        console.log(`${u.phoneNumber} - ${u.role} ${hasPwd}`);
      }
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
