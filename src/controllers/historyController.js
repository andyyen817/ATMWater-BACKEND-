const WaterQualityLog = require('../models/WaterQualityLog');
const Unit = require('../models/Unit');

/**
 * @desc    获取特定设备的水质历史记录 (过去 24 小时或 7 天)
 * @route   GET /api/iot/water-quality/:unitId
 */
exports.getWaterQualityHistory = async (req, res) => {
    try {
        const { unitId } = req.params;
        const { days = 1 } = req.query; // 默认查询 1 天

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const logs = await WaterQualityLog.find({
            unitId: unitId,
            timestamp: { $gte: startDate }
        }).sort({ timestamp: 1 }); // 按时间顺序

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

