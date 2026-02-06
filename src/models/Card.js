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
        enum: ['Unlinked', 'Linked'],
        default: 'Unlinked'
    },
    linkedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    linkedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for fast token lookups during linking
cardSchema.index({ token: 1 });
cardSchema.index({ status: 1 });

module.exports = mongoose.model('Card', cardSchema);
