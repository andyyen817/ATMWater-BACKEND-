/**
 * 设置用户密码脚本
 * 用法: node set_password.js <手机号> <密码>
 * 示例: node set_password.js 8888 8888
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
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

async function setPassword() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('用法: node set_password.js <手机号> <密码>');
        console.log('示例: node set_password.js 8888 8888');
        process.exit(1);
    }

    const phoneNumber = args[0];
    const newPassword = args[1];

    console.log('========================================');
    console.log('设置用户密码');
    console.log('========================================');
    console.log('手机号:', phoneNumber);
    console.log('新密码:', newPassword);
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
        // 查找用户
        console.log('\n查找用户...');
        const user = await User.findOne({ phoneNumber });

        if (!user) {
            console.error('错误: 用户不存在!');
            process.exit(1);
        }

        console.log('找到用户:');
        console.log('  - ID:', user._id);
        console.log('  - 手机号:', user.phoneNumber);
        console.log('  - 名称:', user.name);
        console.log('  - 角色:', user.role);
        console.log('  - 当前密码:', user.password ? '已设置' : '未设置');

        // 加密新密码
        console.log('\n加密新密码...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        console.log('密码加密完成');

        // 更新密码
        console.log('\n更新用户密码...');
        user.password = hashedPassword;
        await user.save();

        console.log('\n========================================');
        console.log('成功! 密码已更新');
        console.log('========================================');
        console.log('手机号:', user.phoneNumber);
        console.log('密码:', newPassword);
        console.log('角色:', user.role);
        console.log('========================================');

        process.exit(0);
    } catch (error) {
        console.error('\n发生错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行
setPassword();
