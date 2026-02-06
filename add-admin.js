const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const User = require('./src/models/User');

const addSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if user already exists
        let user = await User.findOne({ phoneNumber: '8888' });

        if (user) {
            // Update existing user to Super-Admin
            user.role = 'Super-Admin';
            user.name = 'Super Admin';
            user.isActive = true;
            await user.save();
            console.log('✅ Updated existing user 8888 to Super-Admin');
        } else {
            // Create new Super-Admin user
            const crypto = require('crypto');
            user = await User.create({
                phoneNumber: '8888',
                name: 'Super Admin',
                role: 'Super-Admin',
                referralCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
                isActive: true
            });
            console.log('✅ Created new Super-Admin user 8888');
        }

        console.log('\n========== Super-Admin Account ==========');
        console.log('Phone Number:', user.phoneNumber);
        console.log('Role:', user.role);
        console.log('Name:', user.name);
        console.log('==========================================\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

addSuperAdmin();
