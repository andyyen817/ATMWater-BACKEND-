const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        trim: true,
        default: 'New User'
    },
    role: {
        type: String,
        enum: ['Customer', 'Steward', 'RP', 'GM', 'Finance', 'Business', 'AfterSales', 'Admin', 'Super-Admin'],
        default: 'Customer'
    },
    balance: {
        type: Number,
        default: 0
    },
    password: {
        type: String,
        select: false // 默认不返回密码，保护隐私
    },
    // OTP 验证相关
    otp: {
        type: String
    },
    otpExpires: {
        type: Date
    },
    // 状态相关
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    // [P2-APP-003] RP 关联管家 或 [P3-API-007] 推荐人关联
    managedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // [P3-API-007] 推荐系统
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    isFirstTopUpDone: {
        type: Boolean,
        default: false
    },
    // [P3-APP-004] 个人中心扩展
    bankAccounts: [{
        bankName: String,
        accountNumber: String,
        accountHolder: String,
        isDefault: { type: Boolean, default: false }
    }],
    shippingAddresses: [{
        label: String, // e.g., 'Home', 'Office'
        receiverName: String,
        receiverPhone: String,
        fullAddress: String,
        isDefault: { type: Boolean, default: false }
    }],
    email: {
        type: String,
        trim: true,
        lowercase: true
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;
