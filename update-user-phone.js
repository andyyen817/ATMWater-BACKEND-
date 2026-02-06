const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

async function updateUserPhone() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到数据库\n');

        // 查找 +868888 用户
        const User = require('./src/models/User');
        const user = await User.findOne({ phoneNumber: '+868888' });

        if (user) {
            console.log(`找到用户: ${user.phoneNumber}`);
            console.log(`用户名: ${user.name || '无'}`);
            console.log(`用户ID: ${user._id}`);

            // 检查新手机号是否已存在
            const existingUser = await User.findOne({ phoneNumber: '+8618099372988' });
            if (existingUser) {
                console.log('\n新手机号 +8618099372988 已存在，将删除旧用户');
                await User.deleteOne({ phoneNumber: '+868888' });
                console.log('已删除旧用户 +868888');
            } else {
                // 更新手机号
                user.phoneNumber = '+8618099372988';
                await user.save();
                console.log('\n已更新用户手机号为: +8618099372988');
            }
        } else {
            console.log('未找到用户 +868888');
            console.log('\n创建新用户 +8618099372988...');
            const newUser = new User({
                phoneNumber: '+8618099372988',
                name: '测试用户',
                role: 'user',
                isActive: true
            });
            await newUser.save();
            console.log('已创建新用户 +8618099372988');
        }

        // 显示所有用户
        const allUsers = await User.find({});
        console.log(`\n当前系统用户 (${allUsers.length} 个):`);
        for (const u of allUsers) {
            console.log(`  - ${u.phoneNumber} (${u.name || '无名称'}, ${u.role})`);
        }

        await mongoose.connection.close();
        console.log('\n完成！');
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

updateUserPhone();
