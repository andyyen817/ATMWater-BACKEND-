const User = require('../models/User');
const Unit = require('../models/Unit');
const MaintenanceLog = require('../models/MaintenanceLog');

/**
 * @desc    获取所有 RP 及其关联的管家树状结构
 * @route   GET /api/partners/tree
 */
exports.getPartnerTree = async (req, res) => {
    try {
        // 1. 获取所有 RP
        const rps = await User.find({ role: 'RP' }).select('name phoneNumber balance');

        const partnerTree = await Promise.all(rps.map(async (rp) => {
            // 2. 获取该 RP 旗下的所有设备，用于统计
            const units = await Unit.find({ rpOwner: rp._id });
            
            // 3. 获取该 RP 管理的所有管家
            const stewards = await User.find({ managedBy: rp._id, role: 'Steward' }).select('name phoneNumber');

            // 4. 为每个管家统计数据
            const stewardDetails = await Promise.all(stewards.map(async (steward) => {
                const managedUnits = await Unit.find({ steward: steward._id }).select('unitId locationName');
                
                // 模拟合规率 (Compliance) - 实际应根据打卡记录计算
                const today = new Date();
                const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                const checkinCount = await MaintenanceLog.countDocuments({
                    stewardId: steward._id,
                    createdAt: { $gte: thirtyDaysAgo }
                });
                
                // 假设满分是 30 天每天打卡
                const compliance = Math.min((checkinCount / 30) * 100, 100).toFixed(1);

                return {
                    id: steward._id,
                    name: steward.name,
                    phoneNumber: steward.phoneNumber,
                    units: managedUnits.map(u => u.unitId),
                    compliance
                };
            }));

            return {
                id: rp._id,
                name: rp.name,
                phoneNumber: rp.phoneNumber,
                totalUnits: units.length,
                stewardCount: stewards.length,
                stewards: stewardDetails
            };
        }));

        res.status(200).json({
            success: true,
            data: partnerTree
        });

    } catch (error) {
        console.error('Get Partner Tree Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取未绑定的管家 (用于分配给 RP)
 * @route   GET /api/partners/unassigned-stewards
 */
exports.getUnassignedStewards = async (req, res) => {
    try {
        const stewards = await User.find({ 
            role: 'Steward', 
            managedBy: { $exists: false } 
        }).select('name phoneNumber');

        res.status(200).json({
            success: true,
            data: stewards
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    将管家绑定到 RP
 * @route   POST /api/partners/bind
 */
exports.bindSteward = async (req, res) => {
    try {
        const { rpId, stewardId } = req.body;

        const steward = await User.findById(stewardId);
        if (!steward || steward.role !== 'Steward') {
            return res.status(404).json({ success: false, message: 'Steward not found' });
        }

        steward.managedBy = rpId;
        await steward.save();

        res.status(200).json({
            success: true,
            message: 'Steward assigned to RP successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    解除管家与 RP 的绑定
 * @route   POST /api/partners/unbind
 */
exports.unbindSteward = async (req, res) => {
    try {
        const { stewardId } = req.body;

        const steward = await User.findById(stewardId);
        if (!steward) {
            return res.status(404).json({ success: false, message: 'Steward not found' });
        }

        steward.managedBy = undefined;
        await steward.save();

        // 同时解除该管家负责的所有设备关联
        await Unit.updateMany({ steward: stewardId }, { $unset: { steward: "" } });

        res.status(200).json({
            success: true,
            message: 'Steward unassigned successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

