const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['TopUp', 'WaterPurchase', 'SubscriptionFee', 'Withdrawal'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'IDR'
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Expired'],
        default: 'Pending'
    },
    paymentGateway: {
        type: String,
        enum: ['Xendit', 'Internal', 'Manual'],
        default: 'Xendit'
    },
    externalId: {
        type: String, // Xendit 的 Invoice ID 或交易单号
        unique: true,
        sparse: true
    },
    paymentUrl: {
        type: String // 支付跳转链接
    },
    description: {
        type: String
    },
    metadata: {
        type: Object // 存储 Xendit 返回的原始数据
    }
}, {
    timestamps: true
});

// [P3-INF-002] 针对海量交易数据的索引优化
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: 1 }); // 用于财务报表按时间范围查询

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;

