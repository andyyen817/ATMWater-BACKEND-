const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');

const listAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const admins = await User.find({ role: 'Super-Admin' });

        console.log('========== All Super-Admin Accounts ==========');
        admins.forEach((admin, index) => {
            console.log(`${index + 1}. Phone: ${admin.phoneNumber} | Name: ${admin.name}`);
        });
        console.log('==============================================\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

listAdmins();
