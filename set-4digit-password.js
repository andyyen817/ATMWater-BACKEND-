const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill';

async function setPassword() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到数据库\n');

        const User = require('./src/models/User');
        const bcrypt = require('bcryptjs');

        // 查找用户并设置4位数字密码
        const user = await User.findOne({ phoneNumber: '+8618099372988' });

        if (user) {
            const password = '1234';
            const hashedPassword = await bcrypt.hash(password, 10);

            user.password = hashedPassword;
            await user.save();

            console.log(`✅ 已设置用户 ${user.phoneNumber} 的密码为: ${password}`);
        } else {
            console.log('未找到用户');
        }

        await mongoose.connection.close();
        console.log('\n完成！');
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

setPassword();
