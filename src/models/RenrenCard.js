const mongoose = require('mongoose');

/**
 * 人人水站卡片模型
 */
const renrenCardSchema = new mongoose.Schema({
    // 卡片基本信息
    cardNo: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    balance: {
        type: Number,
        default: 0
    },
    realBalance: {
        type: Number,
        default: 0
    },
    presentCash: {
        type: Number,
        default: 0
    },
    validDays: {
        type: Number,
        default: 0
    },

    // 卡片状态
    valid: {
        type: Number,
        enum: [1, 2, 3, 5], // 1-正常 2-冻结 3-过期 5-注销
        default: 1
    },
    isBlack: {
        type: Boolean,
        default: false
    },

    // 用户信息
    userName: {
        type: String,
        default: ''
    },
    userPhone: {
        type: String,
        default: ''
    },

    // 管理信息
    operatorName: {
        type: String,
        default: ''
    },
    groupId: {
        type: String,
        default: ''
    },
    remark: {
        type: String,
        default: ''
    },

    // 同步信息
    unsyncCash: {
        type: Number,
        default: 0
    },
    lastSyncTime: {
        type: Date
    },

    // 绑定的实体卡（人人水站系统）
    boundEcardNo: {
        type: String,
        default: ''
    },

    // 绑定的家庭实物卡列表（本地数据库，用于家庭多卡管理）
    boundPhysicalCards: [{
        cardNo: {
            type: String,
            required: true
        },
        nickname: {
            type: String,
            default: ''
        },
        balance: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive', 'Lost', 'Damaged'],
            default: 'Active'
        },
        boundAt: {
            type: Date,
            default: Date.now
        },
        remark: {
            type: String,
            default: ''
        }
    }],

    // 创建/更新时间
    createTime: {
        type: Date
    },
    updateTime: {
        type: Date
    },

    // 本地关联信息（将人人水站卡片与本地用户关联）
    localUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // ==================== 增强字段 ====================

    /**
     * 同步历史记录
     * 记录每次同步的详细信息，用于审计和问题追踪
     */
    syncHistory: [{
        syncTime: {
            type: Date,
            default: Date.now
        },
        syncType: {
            type: String,
            enum: ['auto', 'manual', 'charge', 'dispense', 'bind', 'unbind', 'create'],
            default: 'manual'
        },
        balanceBefore: {
            type: Number,
            default: 0
        },
        balanceAfter: {
            type: Number,
            default: 0
        },
        realBalanceBefore: {
            type: Number,
            default: 0
        },
        realBalanceAfter: {
            type: Number,
            default: 0
        },
        amount: {
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
        },
        operatorName: {
            type: String,
            default: ''
        },
        ipAddress: {
            type: String,
            default: ''
        }
    }],

    /**
     * 最后充值时间
     */
    lastChargeTime: {
        type: Date
    },

    /**
     * 最后打水时间
     */
    lastDispenseTime: {
        type: Date
    },

    /**
     * 累计充值金额（分）
     * 用于统计和报表
     */
    totalCharged: {
        type: Number,
        default: 0
    },

    /**
     * 累计打水金额（分）
     * 用于统计和报表
     */
    totalDispensed: {
        type: Number,
        default: 0
    },

    /**
     * 充值次数
     */
    chargeCount: {
        type: Number,
        default: 0
    },

    /**
     * 打水次数
     */
    dispenseCount: {
        type: Number,
        default: 0
    },

    /**
     * 最后绑定用户时间
     */
    lastBindTime: {
        type: Date
    },

    /**
     * 绑定历史记录
     */
    bindHistory: [{
        bindTime: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            enum: ['bind', 'unbind']
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userName: {
            type: String,
            default: ''
        },
        userPhone: {
            type: String,
            default: ''
        },
        remark: {
            type: String,
            default: ''
        }
    }],

    /**
     * 卡片激活时间
     */
    activatedAt: {
        type: Date
    },

    /**
     * 卡片过期时间（根据validDays计算）
     */
    expiredAt: {
        type: Date
    },

    /**
     * 扩展数据（JSON格式，用于存储额外的自定义字段）
     */
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// 索引优化 - 添加复合索引提升查询性能
renrenCardSchema.index({ cardNo: 1 });
renrenCardSchema.index({ userPhone: 1 });
renrenCardSchema.index({ localUserId: 1 });
renrenCardSchema.index({ valid: 1 });
renrenCardSchema.index({ groupId: 1 });
renrenCardSchema.index({ lastSyncTime: -1 });
renrenCardSchema.index({ 'syncHistory.syncTime': -1 });

// 复合索引 - 用于常见查询场景
renrenCardSchema.index({ localUserId: 1, valid: 1 });
renrenCardSchema.index({ groupId: 1, valid: 1 });
renrenCardSchema.index({ valid: 1, lastSyncTime: -1 });

// 文本索引 - 用于全文搜索
renrenCardSchema.index({ cardNo: 'text', userName: 'text', userPhone: 'text', remark: 'text' });

/**
 * 虚拟字段 - 获取同步历史数量
 */
renrenCardSchema.virtual('syncHistoryCount').get(function() {
    return this.syncHistory ? this.syncHistory.length : 0;
});

/**
 * 虚拟字段 - 获取卡片状态描述
 */
renrenCardSchema.virtual('statusDescription').get(function() {
    switch (this.valid) {
        case 1: return '正常';
        case 2: return '冻结';
        case 3: return '过期';
        case 5: return '注销';
        default: return '未知';
    }
});

/**
 * 虚拟字段 - 是否已绑定用户
 */
renrenCardSchema.virtual('isBound').get(function() {
    return !!this.localUserId;
});

/**
 * 虚拟字段 - 卡片使用天数
 */
renrenCardSchema.virtual('daysInUse').get(function() {
    if (!this.createTime) return 0;
    const diff = Date.now() - this.createTime.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
});

/**
 * 实例方法 - 添加同步记录
 */
renrenCardSchema.methods.addSyncRecord = function(data) {
    const record = {
        syncTime: new Date(),
        balanceBefore: this.balance,
        realBalanceBefore: this.realBalance,
        ...data
    };
    record.balanceAfter = this.balance;
    record.realBalanceAfter = this.realBalance;

    // 保持同步历史最多100条记录
    if (this.syncHistory.length >= 100) {
        this.syncHistory.shift(); // 移除最旧的记录
    }
    this.syncHistory.push(record);
    this.lastSyncTime = new Date();

    return this.save();
};

/**
 * 实例方法 - 记录充值
 */
renrenCardSchema.methods.recordCharge = function(amount, remark = '') {
    this.lastChargeTime = new Date();
    this.totalCharged += amount;
    this.chargeCount += 1;

    return this.addSyncRecord({
        syncType: 'charge',
        amount: amount,
        remark: remark
    });
};

/**
 * 实例方法 - 记录打水
 */
renrenCardSchema.methods.recordDispense = function(amount, remark = '') {
    this.lastDispenseTime = new Date();
    this.totalDispensed += amount;
    this.dispenseCount += 1;

    return this.addSyncRecord({
        syncType: 'dispense',
        amount: amount,
        remark: remark
    });
};

/**
 * 静态方法 - 获取需要同步的卡片
 */
renrenCardSchema.statics.getCardsNeedingSync = function(minutes = 30) {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.find({
        $or: [
            { lastSyncTime: { $lt: cutoffTime } },
            { lastSyncTime: { $exists: false } }
        ],
        valid: 1
    });
};

/**
 * 静态方法 - 获取卡片统计信息
 */
renrenCardSchema.statics.getCardStatistics = async function(groupId = null) {
    const match = groupId ? { groupId } : {};

    const [
        totalCards,
        activeCards,
        frozenCards,
        expiredCards,
        totalBalance,
        totalCharged,
        totalDispensed
    ] = await Promise.all([
        this.countDocuments(match),
        this.countDocuments({ ...match, valid: 1 }),
        this.countDocuments({ ...match, valid: 2 }),
        this.countDocuments({ ...match, valid: 3 }),
        this.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
        this.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$totalCharged' } } }]),
        this.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$totalDispensed' } } }])
    ]);

    return {
        totalCards,
        activeCards,
        frozenCards,
        expiredCards,
        totalBalance: totalBalance[0]?.total || 0,
        totalCharged: totalCharged[0]?.total || 0,
        totalDispensed: totalDispensed[0]?.total || 0
    };
};

/**
 * 中间件 - 保存前更新过期时间
 */
renrenCardSchema.pre('save', function(next) {
    if (this.validDays && this.validDays > 0) {
        const baseTime = this.createTime || this.createdAt || new Date();
        this.expiredAt = new Date(baseTime.getTime() + this.validDays * 24 * 60 * 60 * 1000);
    }
    next();
});

/**
 * 中间件 - 更新时记录修改
 */
renrenCardSchema.pre('findOneAndUpdate', function(next) {
    this._update.updatedAt = new Date();
    next();
});

const RenrenCard = mongoose.model('RenrenCard', renrenCardSchema);

module.exports = RenrenCard;
