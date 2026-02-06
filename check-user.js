const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User');

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const phoneNumber = '+8618099372988';
        const newPassword = '1234';

        const user = await User.findOne({ phoneNumber }).select('+password');

        if (!user) {
            console.log(`\n❌ 用户 ${phoneNumber} 不存在！`);
            console.log('正在创建用户...');

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            const newUser = new User({
                phoneNumber,
                password: hashedPassword,
                name: '测试用户',
                role: 'Customer'
            });
            await newUser.save();
            console.log('✅ 用户创建成功，密码已设置为:', newPassword);
        } else {
            console.log(`\n✅ 找到用户:`, user.phoneNumber);

            // 验证当前密码
            if (user.password) {
                const isMatch = await bcrypt.compare(newPassword, user.password);
                console.log('  当前密码验证 "1234":', isMatch ? '✅ 匹配' : '❌ 不匹配');
            }

            // 重置密码为 1234
            console.log('  正在重置密码为:', newPassword);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            user.password = hashedPassword;
            await user.save();
            console.log('✅ 密码已重置为:', newPassword);
        }

        // 验证新密码
        const verifyUser = await User.findOne({ phoneNumber }).select('+password');
        const isMatch = await bcrypt.compare(newPassword, verifyUser.password);
        console.log('  验证新密码:', isMatch ? '✅ 成功' : '❌ 失败');

        await mongoose.connection.close();
        console.log('\n完成');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

checkUser();
