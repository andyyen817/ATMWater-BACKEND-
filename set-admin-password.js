const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Define User Schema
const userSchema = new mongoose.Schema({
  phoneNumber: String,
  password: String,
  name: String,
  role: String,
});

const User = mongoose.model('User', userSchema);

async function setAdminPassword() {
  const phoneNumber = process.argv[2] || '08571085222';
  const newPassword = process.argv[3] || '123456';

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      console.log('❌ User not found:', phoneNumber);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    console.log('✅ Password set successfully!');
    console.log('   Phone:', phoneNumber);
    console.log('   Password:', newPassword);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setAdminPassword();
