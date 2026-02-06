/**
 * 更新用户手机号脚本
 * 用法: node update_phone.js <旧手机号> <新手机号>
 * 示例: node update_phone.js 8888 +868888
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 用户模型
const userSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    password: { type: String },
    name: String,
    role: String,
    balance: Number,
    isActive: Boolean,
    lastLogin: Date,
    managedBy: mongoose.Schema.Types.ObjectId,
    referralCode: String,
    isFirstTopUpDone: Boolean,
    bankAccounts: [{
        bankName: String,
        accountNumber: String,
        accountHolder: String,
        isDefault: Boolean
    }],
    shippingAddresses: [{
        label: String,
        receiverName: String,
        receiverPhone: String,
        fullAddress: String,
        isDefault: Boolean
    }],
    email: String
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

async function updatePhoneNumber() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('用法: node update_phone.js <旧手机号> <新手机号>');
        console.log('示例: node update_phone.js 8888 +868888');
        process.exit(1);
    }

    const oldPhone = args[0];
    const newPhone = args[1];

    console.log('========================================');
    console.log('更新用户手机号');
    console.log('========================================');
    console.log('旧手机号:', oldPhone);
    console.log('新手机号:', newPhone);
    console.log('----------------------------------------');

    // 连接数据库
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('错误: MONGODB_URI 环境变量未设置');
        process.exit(1);
    }

    console.log('正在连接数据库...');

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log('数据库连接成功!');
    } catch (error) {
        console.error('数据库连接失败:', error.message);
        process.exit(1);
    }

    try {
        // 查找旧用户
        console.log('\n查找旧用户...');
        const oldUser = await User.findOne({ phoneNumber: oldPhone });

        if (!oldUser) {
            console.error('错误: 用户', oldPhone, '不存在!');
            process.exit(1);
        }

        console.log('找到旧用户:');
        console.log('  - ID:', oldUser._id);
        console.log('  - 手机号:', oldUser.phoneNumber);
        console.log('  - 名称:', oldUser.name);
        console.log('  - 角色:', oldUser.role);

        // 检查新手机号是否已存在
        console.log('\n检查新手机号是否已存在...');
        const existingUser = await User.findOne({ phoneNumber: newPhone });
        if (existingUser) {
            console.error('错误: 新手机号', newPhone, '已被其他用户使用!');
            process.exit(1);
        }

        // 检查是否有卡片绑定到这个用户
        const RenrenCard = mongoose.model('RenrenCard', new mongoose.Schema({
            cardNo: String,
            localUserId: mongoose.Schema.Types.ObjectId
        }));
        const boundCard = await RenrenCard.findOne({ localUserId: oldUser._id });
        if (boundCard) {
            console.log('注意: 用户有绑定的卡片:', boundCard.cardNo);
        }

        // 更新手机号
        console.log('\n更新用户手机号...');
        oldUser.phoneNumber = newPhone;
        await oldUser.save();

        console.log('\n========================================');
        console.log('成功! 手机号已更新');
        console.log('========================================');
        console.log('旧手机号:', oldPhone);
        console.log('新手机号:', newPhone);
        console.log('用户名称:', oldUser.name);
        console.log('用户角色:', oldUser.role);
        console.log('========================================');

        process.exit(0);
    } catch (error) {
        console.error('\n发生错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行
updatePhoneNumber();
