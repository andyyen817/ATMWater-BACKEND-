const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const User = require('./src/models/User');

const fixAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 查找+868888用户
        let user = await User.findOne({ phoneNumber: '+868888' });

        if (user) {
            // 更改为Super-Admin
            user.role = 'Super-Admin';
            user.name = 'Super Admin';
            user.isActive = true;

            // 确保有密码
            if (!user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash('888888', salt);
            }

            await user.save();
            console.log('✅ Updated +868888 to Super-Admin');
        } else {
            // 如果不存在则创建
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('888888', salt);
            const crypto = require('crypto');

            user = await User.create({
                phoneNumber: '+868888',
                name: 'Super Admin',
                role: 'Super-Admin',
                password: hashedPassword,
                referralCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
                isActive: true
            });
            console.log('✅ Created +868888 as Super-Admin');
        }

        console.log('\n========== Super-Admin Account ==========');
        console.log('Phone Number: +868888');
        console.log('Role:', user.role);
        console.log('Password: 888888');
        console.log('==========================================\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

fixAdmin();
