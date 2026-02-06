const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

async function checkUserPassword() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到数据库\n');

        const User = require('./src/models/User');

        // 查找用户
        const user = await User.findOne({ phoneNumber: '+8618099372988' });

        if (user) {
            console.log(`找到用户: ${user.phoneNumber}`);
            console.log(`用户名: ${user.name || '无'}`);
            console.log(`角色: ${user.role}`);
            console.log(`是否激活: ${user.isActive}`);
            console.log(`是否有密码: ${user.password ? '是' : '否'}`);

            if (!user.password) {
                console.log('\n用户没有设置密码！');
                console.log('正在设置默认密码...');

                // 使用bcrypt直接设置密码
                const bcrypt = require('bcryptjs');
                const defaultPassword = '123456';
                const hashedPassword = await bcrypt.hash(defaultPassword, 10);

                user.password = hashedPassword;
                await user.save();

                console.log(`\n已设置默认密码: ${defaultPassword}`);
            }
        } else {
            console.log('未找到用户 +8618099372988');
        }

        await mongoose.connection.close();
        console.log('\n完成！');
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

checkUserPassword();
