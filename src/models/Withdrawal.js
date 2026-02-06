const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number, // 请求提现的总金额 (单位：分)
        required: true
    },
    taxAmount: {
        type: Number, // 预估扣除的税费
        default: 0
    },
    serviceFee: {
        type: Number, // 预估扣除的服务费/订阅费
        default: 0
    },
    finalAmount: {
        type: Number, // 最终实到金额
        default: 0
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
        default: 'Pending'
    },
    bankDetails: {
        bankName: String,
        accountNumber: String,
        accountHolder: String
    },
    adminNotes: String,
    processedAt: Date,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;

