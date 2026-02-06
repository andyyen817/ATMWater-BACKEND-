const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'water_pricing'
    },
    // 售水分润比例 (总和需为 100)
    ratios: {
        airkop: { type: Number, default: 40 },      // 公司 40%
        rp: { type: Number, default: 40 },          // 区域伙伴 40%
        steward: { type: Number, default: 15 },     // 水管家 15%
        growthFund: { type: Number, default: 5 }    // 发展基金 5%
    },
    // 云广告收益分润 (总和需为 100)
    adRatios: {
        airkop: { type: Number, default: 70 },
        rp: { type: Number, default: 10 },
        steward: { type: Number, default: 10 },
        growthFund: { type: Number, default: 10 }
    },
    // 维护费阶梯设置
    maintenanceFees: {
        standard: { type: Number, default: 500000 },
        enhanced: { type: Number, default: 800000 },
        tdsThreshold: { type: Number, default: 300 },
        phThreshold: { type: Number, default: 6.5 }
    },
    // 软件使用费
    softwareFee: { type: Number, default: 200000 },
    // 水价设置 (Rp/L)
    prices: {
        pure: { type: Number, default: 400 },
        mineral: { type: Number, default: 500 }
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
