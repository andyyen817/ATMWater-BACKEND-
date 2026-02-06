const Unit = require('../models/Unit');
const User = require('../models/User');
const Ledger = require('../models/Ledger');
const MaintenanceLog = require('../models/MaintenanceLog');

/**
 * @desc    获取 RP 看板核心数据
 * @route   GET /api/rp/dashboard
 */
exports.getRPDashboard = async (req, res) => {
    try {
        const rpId = req.user.id;

        // 1. 获取该 RP 的所有设备
        const units = await Unit.find({ rpOwner: rpId });
        const totalUnits = units.length;
        const overdueUnits = units.filter(u => u.subscription.isOverdue).length;

        // 2. 计算本月收益 (从 Ledger 中累计该 RP 的分润)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const revenueData = await Ledger.aggregate([
            {
                $match: {
                    recipientId: req.user._id,
                    createdAt: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const monthlyRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        // 3. 获取下属管家及其状态
        // 我们查找该 RP 下的所有设备关联的管家，或者直接查找 managedBy 为该 RP 的管家
        const stewards = await User.find({ managedBy: rpId, role: 'Steward' });
        
        const stewardList = await Promise.all(stewards.map(async (steward) => {
            // 查找该管家负责的设备数量
            const managedUnitsCount = await Unit.countDocuments({ steward: steward._id });
            
            // 查找该管家今日是否打卡 (MVP 简化逻辑：查找今日最新的维护日志)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const hasCheckedInToday = await MaintenanceLog.exists({
                stewardId: steward._id,
                createdAt: { $gte: today }
            });

            return {
                id: steward._id,
                name: steward.name,
                phoneNumber: steward.phoneNumber,
                managedUnitsCount,
                hasCheckedInToday: !!hasCheckedInToday
            };
        }));

        res.status(200).json({
            success: true,
            data: {
                totalUnits,
                overdueUnits,
                monthlyRevenue,
                stewards: stewardList,
                rpName: req.user.name
            }
        });

    } catch (error) {
        console.error('RP Dashboard Error:', error);
        res.status(500).json({ success: false, message: 'Failed to load RP dashboard' });
    }
};

/**
 * @desc    RP 欠费提醒处理 (模拟支付流程或发送提醒)
 * @route   POST /api/rp/handle-overdue
 */
exports.handleOverdue = async (req, res) => {
    try {
        const { unitId } = req.body;
        // 实际上这里可能会触发跳转到支付，或者直接尝试扣除余额（如果足够）
        // 这里仅作为占位逻辑，说明 RP 处理了预警
        res.status(200).json({
            success: true,
            message: `Overdue alert for unit ${unitId} acknowledged.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

