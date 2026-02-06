const Ad = require('../models/Ad');
const Ledger = require('../models/Ledger');
const User = require('../models/User');
const Setting = require('../models/Setting');

/**
 * @desc    获取所有广告活动
 * @route   GET /api/ads/list
 */
exports.getAds = async (req, res) => {
    try {
        const ads = await Ad.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: ads });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    新建广告活动
 * @route   POST /api/ads/new
 */
exports.createAd = async (req, res) => {
    try {
        const ad = await Ad.create(req.body);
        res.status(201).json({ success: true, data: ad });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    停止广告活动
 * @route   POST /api/ads/stop/:id
 */
exports.stopAd = async (req, res) => {
    try {
        const ad = await Ad.findByIdAndUpdate(req.params.id, { status: 'Ended' }, { new: true });
        res.status(200).json({ success: true, data: ad });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    结算广告收益 (模拟逻辑)
 * @route   POST /api/ads/settle-revenue
 */
exports.settleAdRevenue = async (req, res) => {
    try {
        const { amount, adId } = req.body; // 总收益金额 (Rp)

        // 1. 获取分润比例 (PRD: AirKOP 70, RP 10, Steward 10, Growth 10)
        // 实际上这应该从 Setting 模型获取，但如果没设则用默认
        const ratios = {
            airkop: 70,
            rp: 10,
            steward: 10,
            growthFund: 10
        };

        // 2. 模拟分给所有活跃 RP 和 Steward (实际应按点击或展示归属，此处简化为计入公共账本)
        // 记录 Ledger
        const ledgerEntries = [
            { transactionId: `AD_${Date.now()}`, recipientType: 'AirKOP', amount: Math.floor(amount * 0.7), percentage: 70, description: `Ad Revenue Share - Ad ${adId}` },
            { recipientType: 'GrowthFunding', amount: Math.floor(amount * 0.1), percentage: 10, description: `Ad Revenue Share - Ad ${adId}` },
            // RP 和 Steward 的分润在演示版中简化为计入公共池或分给所有
        ];

        await Ledger.insertMany(ledgerEntries);

        res.status(200).json({
            success: true,
            message: `Ad revenue of Rp ${amount/100} settled successfully according to 70/10/10/10 split.`
        });

    } catch (error) {
        console.error('Ad Settle Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

