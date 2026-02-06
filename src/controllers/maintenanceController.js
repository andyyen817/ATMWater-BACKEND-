const MaintenanceLog = require('../models/MaintenanceLog');
const Unit = require('../models/Unit');

/**
 * @desc    提交每日打卡维护记录
 * @route   POST /api/maintenance/checkin
 */
exports.submitCheckin = async (req, res) => {
    try {
        const { unitId, coordinates, photoUrl, checklist, tdsValue, phValue } = req.body;
        const stewardId = req.user.id;

        // 1. 验证设备是否存在
        const unit = await Unit.findOne({ unitId });
        if (!unit) {
            return res.status(404).json({ success: false, message: 'Unit not found' });
        }

        // 2. [核心逻辑] 地理围栏校验 (Geo-fencing)
        // 模拟逻辑：如果管家距离设备位置 > 200米，则拒绝打卡
        // 在正式版中，我们会计算 coordinates 与 unit.location 之间的距离
        console.log(`[Check-in] Steward ${stewardId} is checking in at Unit ${unitId}`);

        // 3. 创建维护日志
        const log = await MaintenanceLog.create({
            unitId,
            stewardId,
            location: {
                coordinates: coordinates || [0, 0],
                address: 'Indomaret Kemang' // 模拟地址
            },
            photoUrl,
            checklist,
            tdsValue,
            phValue
        });

        // 4. 更新设备表中的最后维护时间
        unit.lastHeartbeat = Date.now(); // 借用此字段或新增 lastMaintenanceAt
        await unit.save();

        res.status(201).json({
            success: true,
            message: 'Daily check-in submitted successfully',
            data: log
        });

    } catch (error) {
        console.error('Check-in Error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit check-in' });
    }
};

/**
 * @desc    获取设备的维护历史 (供管理端或管家查看)
 * @route   GET /api/maintenance/history/:unitId
 */
exports.getMaintenanceHistory = async (req, res) => {
    try {
        const logs = await MaintenanceLog.find({ unitId: req.params.unitId })
            .sort({ createdAt: -1 })
            .limit(10);
            
        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

