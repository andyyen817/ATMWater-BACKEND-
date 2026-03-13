const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    serialNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    batch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CardBatch',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Unlinked', 'Sold', 'Linked'],
        default: 'Unlinked'
    },
    linkedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    linkedAt: {
        type: Date
    },
    // 售卡信息
    soldByStationId: {
        type: Number,
        default: null,
        comment: '售卡站点ID'
    },
    soldAt: {
        type: Date,
        default: null,
        comment: '售卡时间'
    },
    presplitDone: {
        type: Boolean,
        default: false,
        comment: '是否已预分账'
    }
}, {
    timestamps: true
});

// Index for fast token lookups during linking
cardSchema.index({ token: 1 });
cardSchema.index({ status: 1 });
cardSchema.index({ soldByStationId: 1 });
cardSchema.index({ presplitDone: 1 });

module.exports = mongoose.model('Card', cardSchema);
