const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const User = require('./src/models/User');

const setPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 为8888和+868888都设置密码
        const users = await User.find({
            $or: [
                { phoneNumber: '8888' },
                { phoneNumber: '+868888' }
            ]
        });

        if (users.length === 0) {
            console.log('❌ No users found');
            process.exit(1);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('888888', salt);

        for (const user of users) {
            user.password = hashedPassword;
            await user.save();
            console.log(`✅ Set password for: ${user.phoneNumber} (${user.role})`);
        }

        console.log('\n========== Password Set Successfully ==========');
        console.log('Password: 888888');
        console.log('Login API: POST /api/auth/login-password');
        console.log('================================================\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

setPassword();
