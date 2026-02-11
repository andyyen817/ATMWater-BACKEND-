const mongoose = require('mongoose');

/**
 * 实物水卡模型
 * 用于存储用户在本地数据库中添加的实物水卡信息
 * 这些卡片不在人人水站系统中绑定，仅用于本地记录和管理
 */
const physicalCardSchema = new mongoose.Schema({
    // 卡号（1个字母+8个数字）
    cardNo: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // 所属用户
    localUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 关联的电子水卡（可选）
    electronicCardNo: {
        type: String,
        default: ''
    },
    // 卡片昵称/备注
    nickname: {
        type: String,
        default: ''
    },
    // 卡片余额（本地记录，仅供参考）
    balance: {
        type: Number,
        default: 0
    },
    // 卡片状态
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Lost', 'Damaged'],
        default: 'Active'
    },
    // 绑定时间
    boundAt: {
        type: Date,
        default: Date.now
    },
    // 最后同步时间
    lastSyncTime: {
        type: Date
    },
    // 同步状态（是否已从人人水站系统验证）
    syncStatus: {
        type: String,
        enum: ['Pending', 'Verified', 'NotFound', 'Error'],
        default: 'Pending'
    },
    // 设备号（如果卡片绑定了特定设备）
    deviceNo: {
        type: String,
        default: ''
    },
    // 额外备注
    remark: {
        type: String,
        default: ''
    },
    // 充值记录
    chargeHistory: [{
        chargeTime: {
            type: Date,
            default: Date.now
        },
        amount: {
            type: Number,
            default: 0
        },
        presentCash: {
            type: Number,
            default: 0
        },
        remark: {
            type: String,
            default: ''
        },
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    // 使用记录
    usageHistory: [{
        useTime: {
            type: Date,
            default: Date.now
        },
        amount: {
            type: Number,
            default: 0
        },
        location: {
            type: String,
            default: ''
        },
        remark: {
            type: String,
            default: ''
        }
    }]
}, {
    timestamps: true
});

// 索引
physicalCardSchema.index({ cardNo: 1 });
physicalCardSchema.index({ localUserId: 1 });
physicalCardSchema.index({ electronicCardNo: 1 });
physicalCardSchema.index({ status: 1 });
physicalCardSchema.index({ createdAt: -1 });

// 复合索引
physicalCardSchema.index({ localUserId: 1, status: 1 });

// 虚拟字段 - 获取充值总额
physicalCardSchema.virtual('totalCharged').get(function() {
    return this.chargeHistory.reduce((sum, record) => sum + record.amount, 0);
});

// 虚拟字段 - 获取使用总额
physicalCardSchema.virtual('totalUsed').get(function() {
    return this.usageHistory.reduce((sum, record) => sum + record.amount, 0);
});

// 实例方法 - 添加充值记录
physicalCardSchema.methods.addChargeRecord = function(amount, presentCash = 0, remark = '', operatorId = null) {
    this.balance += amount;
    this.chargeHistory.push({
        chargeTime: new Date(),
        amount,
        presentCash,
        remark,
        operatorId
    });
    this.lastSyncTime = new Date();
    return this.save();
};

// 实例方法 - 添加使用记录
physicalCardSchema.methods.addUsageRecord = function(amount, location = '', remark = '') {
    this.balance -= amount;
    this.usageHistory.push({
        useTime: new Date(),
        amount,
        location,
        remark
    });
    this.lastSyncTime = new Date();
    return this.save();
};

// 静态方法 - 获取用户的所有实物卡
physicalCardSchema.statics.getUserCards = function(userId, status = null) {
    const query = { localUserId: userId };
    if (status) query.status = status;
    return this.find(query).sort({ boundAt: -1 });
};

// 静态方法 - 获取用户的实物卡统计
physicalCardSchema.statics.getUserCardStats = async function(userId) {
    const cards = await this.find({ localUserId: userId });
    return {
        total: cards.length,
        active: cards.filter(c => c.status === 'Active').length,
        totalBalance: cards.reduce((sum, c) => sum + c.balance, 0),
        totalCharged: cards.reduce((sum, c) => sum + (c.totalCharged || 0), 0),
        totalUsed: cards.reduce((sum, c) => sum + (c.totalUsed || 0), 0)
    };
};

const PhysicalCard = mongoose.model('PhysicalCard', physicalCardSchema);

module.exports = PhysicalCard;
