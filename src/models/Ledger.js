const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // 有些是系统基金账户，无具体 UserID
    },
    accountType: {
        type: String,
        enum: ['AirKOP', 'RP', 'Steward', 'GrowthFund', 'Maintenance', 'Referrer'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['Credit', 'Debit'], // Credit 为入账, Debit 为支出
        default: 'Credit'
    },
    status: {
        type: String,
        enum: ['Pending', 'Settled'],
        default: 'Settled'
    },
    description: {
        type: String
    }
}, {
    timestamps: true
});

const Ledger = mongoose.model('Ledger', ledgerSchema);

module.exports = Ledger;

