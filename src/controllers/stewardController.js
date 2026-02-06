const Unit = require('../models/Unit');
const User = require('../models/User');

/**
 * @desc    获取管家管理的所有设备列表
 * @route   GET /api/steward/my-units
 * @access  Private (Steward)
 */
exports.getStewardUnits = async (req, res) => {
    try {
        const stewardId = req.user._id;
        const { status, page = 1, limit = 50 } = req.query;

        console.log('[StewardUnits] 获取管家设备列表', { stewardId });

        // 构建查询条件 - 查找所有steward字段为当前用户的设备
        const query = { steward: stewardId };
        if (status) {
            query.status = status;
        }

        const units = await Unit.find(query)
            .select('unitId locationName location status sensors subscription price speed valid validDate lastHeartbeat')
            .sort({ lastHeartbeat: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const total = await Unit.countDocuments(query);

        console.log('[StewardUnits] 查询完成', {
            stewardId,
            count: units.length,
            total
        });

        res.status(200).json({
            success: true,
            data: units,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('[StewardUnits] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取管家管理的单个设备详情
 * @route   GET /api/steward/units/:unitId
 * @access  Private (Steward)
 */
exports.getStewardUnitDetail = async (req, res) => {
    try {
        const { unitId } = req.params;
        const stewardId = req.user._id;

        console.info('[StewardUnitDetail] 获取设备详情', { unitId, stewardId });

        // 查找设备，同时验证是否属于当前管家
        const unit = await Unit.findOne({
            unitId: unitId,
            steward: stewardId
        })
        .select('unitId locationName location status sensors subscription price speed outlets preCash valid validDate lastHeartbeat createdAt updatedAt')
        .lean();

        if (!unit) {
            console.warn('[StewardUnitDetail] 设备不存在或无权访问', { unitId, stewardId });
            return res.status(404).json({
                success: false,
                message: 'Device not found or access denied'
            });
        }

        // 获取设备统计信息
        const stats = await getUnitStatistics(unit);

        console.info('[StewardUnitDetail] 查询成功', { unitId });

        res.status(200).json({
            success: true,
            data: {
                ...unit,
                stats
            }
        });

    } catch (error) {
        console.error('[StewardUnitDetail] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取管家设备汇总统计
 * @route   GET /api/steward/summary
 * @access  Private (Steward)
 */
exports.getStewardSummary = async (req, res) => {
    try {
        const stewardId = req.user._id;

        console.info('[StewardSummary] 获取管家汇总统计', { stewardId });

        // 获取所有管理设备的统计数据
        const units = await Unit.find({ steward: stewardId })
            .select('unitId status sensors subscription lastHeartbeat')
            .lean();

        const totalUnits = units.length;
        const activeUnits = units.filter(u => u.status === 'Active').length;
        const offlineUnits = units.filter(u => u.status === 'Offline').length;
        const maintenanceUnits = units.filter(u => u.status === 'Maintenance').length;
        const lockedUnits = units.filter(u => u.status === 'Locked').length;

        // 订阅状态统计
        const overdueUnits = units.filter(u => u.subscription?.isOverdue).length;

        // 传感器平均数据
        const avgSensors = {
            pureTDS: 0,
            rawTDS: 0,
            ph: 0,
            temp: 0
        };

        let validSensorCount = 0;
        units.forEach(unit => {
            if (unit.sensors) {
                avgSensors.pureTDS += unit.sensors.pureTDS || 0;
                avgSensors.rawTDS += unit.sensors.rawTDS || 0;
                avgSensors.ph += unit.sensors.ph || 0;
                avgSensors.temp += unit.sensors.temp || 0;
                validSensorCount++;
            }
        });

        if (validSensorCount > 0) {
            avgSensors.pureTDS = Math.round(avgSensors.pureTDS / validSensorCount);
            avgSensors.rawTDS = Math.round(avgSensors.rawTDS / validSensorCount);
            avgSensors.ph = parseFloat((avgSensors.ph / validSensorCount).toFixed(1));
            avgSensors.temp = Math.round(avgSensors.temp / validSensorCount);
        }

        const summary = {
            // 设备数量统计
            units: {
                total: totalUnits,
                active: activeUnits,
                offline: offlineUnits,
                maintenance: maintenanceUnits,
                locked: lockedUnits
            },
            // 订阅统计
            subscription: {
                overdue: overdueUnits,
                valid: totalUnits - overdueUnits
            },
            // 平均传感器数据
            avgSensors,
            // 最近心跳时间
            lastHeartbeat: units.length > 0
                ? new Date(Math.max(...units.map(u => new Date(u.lastHeartbeat || 0).getTime())))
                : null
        };

        console.info('[StewardSummary] 查询成功', { stewardId, summary });

        res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('[StewardSummary] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    管家打卡记录
 * @route   POST /api/steward/checkin
 * @access  Private (Steward)
 */
exports.stewardCheckIn = async (req, res) => {
    try {
        const { unitId, location, photo } = req.body;
        const stewardId = req.user._id;

        console.info('[StewardCheckIn] 收到打卡请求', { unitId, stewardId, location });

        // 验证设备是否属于当前管家
        const unit = await Unit.findOne({
            unitId: unitId,
            steward: stewardId
        });

        if (!unit) {
            console.warn('[StewardCheckIn] 设备不存在或无权访问', { unitId, stewardId });
            return res.status(404).json({
                success: false,
                message: 'Device not found or access denied'
            });
        }

        // 验证位置距离（可选，如果需要严格的位置验证）
        if (location && unit.location && unit.location.coordinates) {
            const distance = calculateDistance(
                location.lat,
                location.lng,
                unit.location.coordinates[1],
                unit.location.coordinates[0]
            );

            // 允许500米的误差范围
            if (distance > 500) {
                console.warn('[StewardCheckIn] 位置距离过远', {
                    unitId,
                    distance,
                    maxAllowed: 500
                });
                return res.status(400).json({
                    success: false,
                    message: 'Location too far from device'
                });
            }

            console.info('[StewardCheckIn] 位置验证通过', { unitId, distance });
        }

        // 更新设备最后心跳时间
        unit.lastHeartbeat = new Date();
        await unit.save();

        // 记录打卡历史到数据库
        const CheckIn = require('../models/CheckIn');
        const User = require('../models/User');

        // 获取管家信息
        const steward = await User.findById(stewardId).select('name phoneNumber');

        // 计算距离
        let distance = 0;
        let deviceLocation = null;
        if (location && unit.location && unit.location.coordinates) {
            distance = calculateDistance(
                location.lat,
                location.lng,
                unit.location.coordinates[1],
                unit.location.coordinates[0]
            );
            deviceLocation = {
                lat: unit.location.coordinates[1],
                lng: unit.location.coordinates[0]
            };
        }

        // 创建打卡记录
        const checkInRecord = await CheckIn.create({
            stewardId,
            stewardName: steward?.name || '',
            stewardPhone: steward?.phoneNumber || '',
            unitId: unit.unitId,
            unitName: unit.locationName || unit.unitId,
            location: {
                submitted: location,
                device: deviceLocation,
                verified: distance <= 500,
                distance: Math.round(distance)
            },
            photo: photo || null,
            unitSnapshot: {
                status: unit.status,
                sensors: unit.sensors || {},
                subscription: unit.subscription || {}
            },
            status: distance <= 500 ? 'verified' : 'failed'
        });

        console.info('[StewardCheckIn] 打卡成功', {
            unitId,
            stewardId,
            checkInId: checkInRecord._id,
            distance
        });

        res.status(200).json({
            success: true,
            message: 'Check-in successful',
            data: {
                unitId: unit.unitId,
                locationName: unit.locationName,
                checkInTime: checkInRecord.createdAt,
                location: location,
                verified: distance <= 500,
                distance: Math.round(distance),
                checkInId: checkInRecord._id
            }
        });

    } catch (error) {
        console.error('[StewardCheckIn] 打卡异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取设备水质历史数据
 * @route   GET /api/steward/units/:unitId/water-quality
 * @access  Private (Steward)
 */
exports.getStewardUnitWaterQuality = async (req, res) => {
    try {
        const { unitId } = req.params;
        const { days = 7 } = req.query;
        const stewardId = req.user._id;

        console.info('[StewardUnitWaterQuality] 获取水质历史', { unitId, stewardId, days });

        // 验证设备权限
        const unit = await Unit.findOne({
            unitId: unitId,
            steward: stewardId
        });

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: 'Device not found or access denied'
            });
        }

        // 获取水质历史记录
        const WaterQualityLog = require('../models/WaterQualityLog');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const logs = await WaterQualityLog.find({
            unitId: unit._id,
            createdAt: { $gte: startDate }
        })
        .sort({ createdAt: 1 })
        .lean();

        // 格式化数据用于图表展示
        const chartData = logs.map(log => ({
            timestamp: log.createdAt,
            pureTDS: log.pureTDS,
            rawTDS: log.rawTDS,
            ph: log.ph,
            temperature: log.temperature
        }));

        // 计算统计数据
        const stats = {
            avgPureTDS: 0,
            maxPureTDS: 0,
            minPureTDS: 999999,
            avgPH: 0,
            dataPoints: logs.length
        };

        if (logs.length > 0) {
            const pureTDSValues = logs.map(l => l.pureTDS);
            stats.avgPureTDS = Math.round(pureTDSValues.reduce((a, b) => a + b, 0) / logs.length);
            stats.maxPureTDS = Math.max(...pureTDSValues);
            stats.minPureTDS = Math.min(...pureTDSValues);
            stats.avgPH = parseFloat((logs.map(l => l.ph).reduce((a, b) => a + b, 0) / logs.length).toFixed(1));
        }

        console.info('[StewardUnitWaterQuality] 查询成功', {
            unitId,
            dataPoints: logs.length
        });

        res.status(200).json({
            success: true,
            data: {
                chartData,
                stats,
                unitId: unit.unitId,
                locationName: unit.locationName
            }
        });

    } catch (error) {
        console.error('[StewardUnitWaterQuality] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

// ==================== 辅助函数 ====================

/**
 * 计算两个经纬度坐标之间的距离（米）
 * 使用 Haversine 公式
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 地球半径（米）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * 获取设备统计信息
 */
async function getUnitStatistics(unit) {
    // 这里可以添加更多统计信息的计算
    // 例如：今日打水量、本周收入等

    return {
        // 基础状态
        isOnline: unit.status === 'Active',
        lastHeartbeatAgo: unit.lastHeartbeat
            ? Math.floor((Date.now() - new Date(unit.lastHeartbeat).getTime()) / 1000 / 60) // 分钟
            : null,

        // 传感器状态
        sensorStatus: {
            tdsNormal: (!unit.sensors || unit.sensors.pureTDS < 100),
            phNormal: (!unit.sensors || unit.sensors.ph >= 6.5 && unit.sensors.ph <= 8.5),
            tempNormal: (!unit.sensors || unit.sensors.temp >= 15 && unit.sensors.temp <= 35)
        },

        // 订阅状态
        subscriptionStatus: {
            isOverdue: unit.subscription?.isOverdue || false,
            overdueDays: unit.subscription?.overdueDays || 0
        }
    };
}

/**
 * @desc    获取管家打卡历史记录
 * @route   GET /api/steward/checkin-history
 * @access  Private (Steward)
 */
exports.getStewardCheckInHistory = async (req, res) => {
    try {
        const stewardId = req.user._id;
        const { page = 1, limit = 20, unitId, startDate, endDate } = req.query;

        console.info('[StewardCheckInHistory] 查询打卡历史', { stewardId, unitId, startDate, endDate });

        const CheckIn = require('../models/CheckIn');

        // 构建查询条件
        const query = { stewardId };
        if (unitId) query.unitId = unitId;

        // 日期范围过滤
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const checkIns = await CheckIn.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const total = await CheckIn.countDocuments(query);

        console.info('[StewardCheckInHistory] 查询完成', {
            stewardId,
            count: checkIns.length,
            total
        });

        res.status(200).json({
            success: true,
            data: checkIns,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('[StewardCheckInHistory] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取管家打卡统计
 * @route   GET /api/steward/checkin-statistics
 * @access  Private (Steward)
 */
exports.getStewardCheckInStatistics = async (req, res) => {
    try {
        const stewardId = req.user._id;
        const { unitId, startDate, endDate } = req.query;

        console.info('[StewardCheckInStatistics] 查询打卡统计', { stewardId, unitId, startDate, endDate });

        const CheckIn = require('../models/CheckIn');

        const stats = await CheckIn.getCheckInStatistics(
            unitId ? null : stewardId,
            startDate,
            endDate
        );

        console.info('[StewardCheckInStatistics] 查询成功', { stewardId, stats });

        res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('[StewardCheckInStatistics] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取单次打卡详情
 * @route   GET /api/steward/checkin/:id
 * @access  Private (Steward)
 */
exports.getCheckInDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const stewardId = req.user._id;

        console.info('[StewardCheckInDetail] 查询打卡详情', { id, stewardId });

        const CheckIn = require('../models/CheckIn');

        const checkIn = await CheckIn.findOne({
            _id: id,
            stewardId: stewardId
        });

        if (!checkIn) {
            return res.status(404).json({
                success: false,
                message: 'Check-in record not found'
            });
        }

        console.info('[StewardCheckInDetail] 查询成功', { id });

        res.status(200).json({
            success: true,
            data: checkIn
        });

    } catch (error) {
        console.error('[StewardCheckInDetail] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
