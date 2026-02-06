const mongoose = require('mongoose');

/**
 * 管家打卡记录模型
 * 记录管家在设备的打卡信息，用于考勤和工作记录
 */
const checkInSchema = new mongoose.Schema({
    // 关联信息
    stewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    stewardName: {
        type: String,
        default: ''
    },
    stewardPhone: {
        type: String,
        default: ''
    },

    // 设备信息
    unitId: {
        type: String,
        required: true
    },
    unitName: {
        type: String,
        default: ''
    },

    // 位置信息
    location: {
        submitted: {
            lat: { type: Number },  // 提交的纬度
            lng: { type: Number }   // 提交的经度
        },
        device: {
            lat: { type: Number },  // 设备的纬度
            lng: { type: Number }   // 设备的经度
        },
        verified: {
            type: Boolean,
            default: false
        },
        distance: {
            type: Number,  // 与设备的距离（米）
            default: 0
        }
    },

    // 打卡照片
    photo: {
        data: String,           // Base64图片数据
        format: {
            type: String,
            default: 'base64'
        },
        url: String,            // 如果上传到云存储，记录URL
        thumbnailUrl: String    // 缩略图URL
    },

    // 设备状态快照（打卡时记录）
    unitSnapshot: {
        status: {
            type: String,
            enum: ['Active', 'Offline', 'Maintenance', 'Locked']
        },
        sensors: {
            pureTDS: { type: Number, default: 0 },
            rawTDS: { type: Number, default: 0 },
            ph: { type: Number, default: 7.0 },
            temp: { type: Number, default: 25 },
            humidity: { type: Number, default: 50 }
        },
        subscription: {
            isOverdue: { type: Boolean, default: false },
            overdueDays: { type: Number, default: 0 }
        }
    },

    // 打卡状态
    status: {
        type: String,
        enum: ['pending', 'verified', 'failed'],
        default: 'pending'
    },

    // 审核信息（如果需要后台审核）
    review: {
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date,
        reviewNote: String
    },

    // 备注
    remark: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// 索引
checkInSchema.index({ stewardId: 1, createdAt: -1 });
checkInSchema.index({ unitId: 1, createdAt: -1 });
checkInSchema.index({ status: 1 });
checkInSchema.index({ createdAt: -1 });

// 复合索引
checkInSchema.index({ stewardId: 1, unitId: 1 });

/**
 * 虚拟字段 - 获取打卡状态描述
 */
checkInSchema.virtual('statusDescription').get(function() {
    switch (this.status) {
        case 'pending': return '待审核';
        case 'verified': return '已验证';
        case 'failed': return '失败';
        default: return '未知';
    }
});

/**
 * 虚拟字段 - 是否在有效距离内
 */
checkInSchema.virtual('isWithinValidRange').get(function() {
    return this.distance <= 500; // 500米内为有效
});

/**
 * 静态方法 - 获取打卡统计
 */
checkInSchema.statics.getCheckInStatistics = async function (stewardId, startDate, endDate) => {
    const match = { stewardId };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const [
        totalCount,
        verifiedCount,
        pendingCount,
        failedCount
    ] = await Promise.all([
        this.countDocuments(match),
        this.countDocuments({ ...match, status: 'verified' }),
        this.countDocuments({ ...match, status: 'pending' }),
        this.countDocuments({ ...match, status: 'failed' })
    ]);

    // 获取最近打卡记录
    const recentCheckIns = await this.find(match)
        .sort({ createdAt: -1 })
        .limit(10)
        .select('unitId unitName location status createdAt distance unitSnapshot')
        .lean();

    return {
        totalCount,
        verifiedCount,
        pendingCount,
        failedCount,
        recentCheckIns
    };
};

const CheckIn = mongoose.model('CheckIn', checkInSchema);

module.exports = CheckIn;
