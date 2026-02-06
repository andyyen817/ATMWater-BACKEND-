const mongoose = require('mongoose');

const waterQualityLogSchema = new mongoose.Schema({
    unitId: {
        type: String,
        required: true,
        index: true // 建立索引提高查询速度
    },
    pureTDS: {
        type: Number,
        required: true
    },
    rawTDS: {
        type: Number
    },
    ph: {
        type: Number,
        default: 7.0
    },
    temperature: {
        type: Number
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    // 自动删除 30 天前的数据，防止数据库爆满 (TTL 索引)
    timestamps: false
});

// 设置 30 天自动过期
waterQualityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

const WaterQualityLog = mongoose.model('WaterQualityLog', waterQualityLogSchema);

module.exports = WaterQualityLog;

