const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    linkUrl: {
        type: String
    },
    target: {
        type: String,
        enum: ['App', 'Web', 'Both'],
        default: 'App'
    },
    status: {
        type: String,
        enum: ['Active', 'Paused', 'Ended'],
        default: 'Active'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    views: {
        type: Number,
        default: 0
    },
    clicks: {
        type: Number,
        default: 0
    },
    revenueGenerated: {
        type: Number,
        default: 0 // In Cents (Rp)
    }
}, {
    timestamps: true
});

const Ad = mongoose.model('Ad', adSchema);

module.exports = Ad;

