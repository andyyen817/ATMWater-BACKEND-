const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const admin = await User.findOne({ role: 'Super-Admin' }).select('+password');

        if (admin) {
            console.log('\n========== Super-Admin Account ==========');
            console.log('Phone Number:', admin.phoneNumber);
            console.log('Role:', admin.role);
            console.log('Name:', admin.name);
            console.log('Has Password:', admin.password ? 'Yes' : 'No');
            console.log('Referral Code:', admin.referralCode);
            console.log('==========================================\n');

            if (admin.password) {
                console.log('Note: Password is hashed. You can login with password or OTP.');
            } else {
                console.log('Note: No password set. Use OTP to login (check console when sending OTP).');
            }
        } else {
            console.log('❌ No Super-Admin account found!');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

checkAdmin();
