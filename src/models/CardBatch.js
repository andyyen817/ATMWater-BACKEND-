const mongoose = require('mongoose');

const cardBatchSchema = new mongoose.Schema({
    batchId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true
    },
    valuePerCard: {
        type: Number,
        required: true,
        default: 600000 // Rp 600,000 as per UI requirement
    },
    startSerial: {
        type: String,
        required: true
    },
    endSerial: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Error', 'Archived'],
        default: 'Pending'
    },

    // 批次备注
    notes: {
        type: String,
        default: ''
    },

    // 统计信息（定期更新）
    statistics: {
        totalCreated: {
            type: Number,
            default: 0
        },
        totalActivated: {
            type: Number,
            default: 0
        },
        totalUsed: {
            type: Number,
            default: 0
        },
        totalRemaining: {
            type: Number,
            default: 0
        },
        totalCharged: {
            type: Number,
            default: 0
        },
        totalDispensed: {
            type: Number,
            default: 0
        },
        activationRate: {
            type: Number,
            default: 0
        },
        usageRate: {
            type: Number,
            default: 0
        }
    },

    // 最后统计更新时间
    lastStatsUpdate: {
        type: Date,
        default: null
    },

    // 归档信息
    archivedAt: {
        type: Date,
        default: null
    },
    archivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// 索引
cardBatchSchema.index({ batchId: 1 });
cardBatchSchema.index({ status: 1 });
cardBatchSchema.index({ createdAt: -1 });
cardBatchSchema.index({ createdBy: 1 });

// 复合索引
cardBatchSchema.index({ status: 1, createdAt: -1 });

/**
 * 静态方法 - 更新批次统计信息
 */
cardBatchSchema.statics.updateStatistics = async function(batchId) {
    const RenrenCard = require('./RenrenCard');

    const batch = await this.findOne({ batchId });
    if (!batch) return null;

    // 计算该批次卡片的统计信息
    const stats = await RenrenCard.aggregate([
        { $match: { batchId: batchId } },
        {
            $group: {
                _id: '$batchId',
                totalCreated: { $sum: 1 },
                totalActivated: {
                    $sum: { $cond: [{ $ne: ['$userName', null] }, 1, 0] }
                },
                totalUsed: {
                    $sum: { $cond: [{ $gt: ['$totalDispensed', 0] }, 1, 0] }
                },
                totalRemaining: {
                    $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] }
                },
                totalCharged: { $sum: '$totalCharged' },
                totalDispensed: { $sum: '$totalDispensed' }
            }
        }
    ]);

    const statData = stats[0] || {
        totalCreated: 0,
        totalActivated: 0,
        totalUsed: 0,
        totalRemaining: 0,
        totalCharged: 0,
        totalDispensed: 0
    };

    // 计算比率
    statData.activationRate = statData.totalCreated > 0
        ? (statData.totalActivated / statData.totalCreated * 100).toFixed(2)
        : 0;
    statData.usageRate = statData.totalActivated > 0
        ? (statData.totalUsed / statData.totalActivated * 100).toFixed(2)
        : 0;

    // 更新批次统计
    batch.statistics = statData;
    batch.lastStatsUpdate = new Date();
    await batch.save();

    return batch;
};

module.exports = mongoose.model('CardBatch', cardBatchSchema);
