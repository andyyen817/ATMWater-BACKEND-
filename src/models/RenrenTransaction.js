const mongoose = require('mongoose');

/**
 * 人人水站交易记录模型
 */
const renrenTransactionSchema = new mongoose.Schema({
    // 交易基本信息
    outTradeNo: {
        type: String,
        required: true,
        unique: true
    },
    tradeNo: {
        type: String,
        default: ''
    },

    // 设备和卡片信息
    deviceNo: {
        type: String,
        required: true
    },
    cardNo: {
        type: String,
        required: true
    },

    // 交易详情
    waterTime: {
        type: Date,
        required: true
    },
    waterState: {
        type: Number,
        enum: [1, 2], // 1-成功 2-失败
        required: true
    },
    cash: {
        type: Number,
        required: true
    },
    startBalance: {
        type: Number,
        default: 0
    },
    endBalance: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        default: 0
    },
    volume: {
        type: Number,
        default: 0
    },
    outlet: {
        type: Number,
        default: 1
    },

    // 支付类型
    tradePayType: {
        type: Number,
        enum: [1, 2, 3, 5], // 1-微信 2-支付宝 3-现金 5-其他
        default: 3
    },

    // 同步状态
    syncStatus: {
        type: Number,
        enum: [0, 1, 2], // 0-失败 1-成功 2-处理中
        default: 1
    },

    // 时间戳
    createTime: {
        type: Date
    },
    syncTime: {
        type: Date
    },
    successTime: {
        type: Date
    },

    // 本地关联
    localUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    localUnitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit'
    },

    // ==================== 最大余额模式字段 ====================
    /**
     * 最大余额模式标记
     * 标识该交易是否使用最大余额模式进行出水
     */
    isMaxBalanceMode: {
        type: Boolean,
        default: false
    },

    /**
     * 最大余额预设金额（分）
     * 在最大余额模式下，记录预设的最大出水金额
     */
    maxBalanceAmount: {
        type: Number,
        default: 0
    },

    /**
     * 实际消费金额（分）
     * 在最大余额模式下，记录实际出水的消费金额
     */
    actualAmount: {
        type: Number,
        default: 0
    },

    /**
     * 退款金额（分）
     * 在最大余额模式下，记录退还到电子卡的金额
     * refundAmount = maxBalanceAmount - actualAmount
     */
    refundAmount: {
        type: Number,
        default: 0
    },

    /**
     * 关联的父交易号
     * 用于退款交易关联到原始出水交易
     */
    parentTradeNo: {
        type: String,
        default: ''
    },

    // ==================== 退款状态字段 ====================
    /**
     * 退款状态
     * pending - 待退款
     * processing - 退款处理中
     * success - 退款成功
     * failed - 退款失败
     * partial_success - 部分退款成功
     */
    refundStatus: {
        type: String,
        enum: ['pending', 'processing', 'success', 'failed', 'partial_success'],
        default: 'pending'
    },

    /**
     * 退款重试次数
     * 记录退款操作的重试次数
     */
    refundRetryCount: {
        type: Number,
        default: 0
    },

    /**
     * 退款交易号
     * 退款API调用成功后返回的交易号
     */
    refundTradeNo: {
        type: String,
        default: ''
    },

    /**
     * 退款时间
     * 退款成功的时间戳
     */
    refundTime: {
        type: Date
    },

    /**
     * 退款错误信息
     * 退款失败时的错误描述
     */
    refundError: {
        type: String,
        default: ''
    },

    /**
     * 退款完成后的余额
     * 退款成功后电子卡的实际余额
     */
    balanceAfterRefund: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 索引
renrenTransactionSchema.index({ outTradeNo: 1 });
renrenTransactionSchema.index({ deviceNo: 1 });
renrenTransactionSchema.index({ cardNo: 1 });
renrenTransactionSchema.index({ waterTime: -1 });
renrenTransactionSchema.index({ waterState: 1 });
// 最大余额模式索引
renrenTransactionSchema.index({ isMaxBalanceMode: 1 });
renrenTransactionSchema.index({ parentTradeNo: 1 });
// 退款状态索引（用于对账任务）
renrenTransactionSchema.index({ refundStatus: 1, isMaxBalanceMode: 1 });
renrenTransactionSchema.index({ refundRetryCount: 1 });

const RenrenTransaction = mongoose.model('RenrenTransaction', renrenTransactionSchema);

module.exports = RenrenTransaction;
