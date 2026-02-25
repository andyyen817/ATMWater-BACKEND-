const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Unit = require('../models/Unit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * @desc    获取管家管理的所有设备列表
 * @route   GET /api/steward/my-units
 */
exports.getStewardUnits = async (req, res) => {
    try {
        const stewardId = req.user.id;
        const { status, page = 1, limit = 50 } = req.query;

        const where = { stewardId };
        if (status) where.status = status;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows } = await Unit.findAndCountAll({
            where,
            order: [['lastHeartbeatAt', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        res.status(200).json({
            success: true,
            data: rows,
            total: count,
            pages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('[StewardUnits] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取管家管理的单个设备详情
 * @route   GET /api/steward/units/:unitId
 */
exports.getStewardUnitDetail = async (req, res) => {
    try {
        const { unitId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // 根据角色构建查询条件
        const where = { id: unitId };
        if (role === 'Steward') where.stewardId = userId;

        const unit = await Unit.findOne({ where });
        if (!unit) {
            return res.status(404).json({ success: false, message: 'Device not found or access denied' });
        }

        const stats = {
            isOnline: unit.status === 'Online',
            lastHeartbeatAgo: unit.lastHeartbeatAt
                ? Math.floor((Date.now() - new Date(unit.lastHeartbeatAt).getTime()) / 1000 / 60)
                : null
        };

        res.status(200).json({ success: true, data: { ...unit.toJSON(), stats } });
    } catch (error) {
        console.error('[StewardUnitDetail] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取管家设备汇总统计
 * @route   GET /api/steward/summary
 */
exports.getStewardSummary = async (req, res) => {
    try {
        const stewardId = req.user.id;

        const units = await Unit.findAll({
            where: { stewardId },
            attributes: ['id', 'deviceId', 'status', 'tdsValue', 'temperature', 'lastHeartbeatAt']
        });

        const total = units.length;
        const active = units.filter(u => u.status === 'Online').length;
        const offline = units.filter(u => u.status === 'Offline').length;
        const maintenance = units.filter(u => u.status === 'Maintenance').length;
        const error = units.filter(u => u.status === 'Error').length;

        // 传感器平均值
        const avgSensors = { pureTDS: 0, rawTDS: 0, ph: 0, temp: 0 };
        let sensorCount = 0;
        units.forEach(u => {
            if (u.tdsValue != null) {
                avgSensors.pureTDS += u.tdsValue || 0;
                avgSensors.temp += parseFloat(u.temperature) || 0;
                sensorCount++;
            }
        });
        if (sensorCount > 0) {
            avgSensors.pureTDS = Math.round(avgSensors.pureTDS / sensorCount);
            avgSensors.temp = Math.round(avgSensors.temp / sensorCount);
        }

        const lastHeartbeat = units.length > 0
            ? new Date(Math.max(...units.map(u => new Date(u.lastHeartbeatAt || 0).getTime())))
            : null;

        res.status(200).json({
            success: true,
            data: {
                units: { total, active, offline, maintenance, error },
                avgSensors,
                lastHeartbeat
            }
        });
    } catch (error) {
        console.error('[StewardSummary] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    管家打卡 (使用 MaintenanceLog Sequelize 模型)
 * @route   POST /api/steward/checkin
 */
exports.stewardCheckIn = async (req, res) => {
    try {
        const { unitId, latitude, longitude, photoUrl, cleaned, filterChecked, leakageChecked, tdsValue, phValue } = req.body;
        const stewardId = req.user.id;

        const unit = await Unit.findOne({ where: { stewardId, id: unitId } });
        if (!unit) {
            return res.status(404).json({ success: false, message: 'Device not found or access denied' });
        }

        const MaintenanceLog = require('../models/MaintenanceLog.sequelize');
        const log = await MaintenanceLog.create({
            unitId: unit.id,
            deviceId: unit.deviceId,
            stewardId,
            latitude, longitude,
            photoUrl: photoUrl || '',
            cleaned: cleaned || false,
            filterChecked: filterChecked || false,
            leakageChecked: leakageChecked || false,
            tdsValue, phValue,
            status: 'Verified'
        });

        await unit.update({ lastMaintenanceAt: new Date() });

        res.status(200).json({ success: true, message: 'Check-in successful', data: log });
    } catch (error) {
        console.error('[StewardCheckIn] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取设备水质历史数据
 * @route   GET /api/steward/units/:unitId/water-quality
 */
exports.getStewardUnitWaterQuality = async (req, res) => {
    try {
        const { unitId } = req.params;
        const { days = 7 } = req.query;

        const unit = await Unit.findByPk(unitId);
        if (!unit) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        const WaterQualityLog = require('../models/WaterQualityLog.sequelize');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const logs = await WaterQualityLog.findAll({
            where: {
                unitId: unit.id,
                createdAt: { [Op.gte]: startDate }
            },
            order: [['createdAt', 'ASC']]
        });

        const chartData = logs.map(log => ({
            timestamp: log.createdAt,
            pureTDS: log.pureTds,
            rawTDS: log.rawTds,
            ph: parseFloat(log.ph),
            temperature: parseFloat(log.temperature)
        }));

        const stats = { avgPureTDS: 0, maxPureTDS: 0, minPureTDS: 0, avgPH: 0, dataPoints: logs.length };
        if (logs.length > 0) {
            const vals = logs.map(l => l.pureTds || 0);
            stats.avgPureTDS = Math.round(vals.reduce((a, b) => a + b, 0) / logs.length);
            stats.maxPureTDS = Math.max(...vals);
            stats.minPureTDS = Math.min(...vals);
            stats.avgPH = parseFloat((logs.map(l => parseFloat(l.ph) || 0).reduce((a, b) => a + b, 0) / logs.length).toFixed(1));
        }

        res.status(200).json({
            success: true,
            data: { chartData, stats, deviceId: unit.deviceId, location: unit.location }
        });
    } catch (error) {
        console.error('[StewardUnitWaterQuality] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取管家打卡历史记录 (使用 MaintenanceLog)
 * @route   GET /api/steward/checkin-history
 */
exports.getStewardCheckInHistory = async (req, res) => {
    try {
        const stewardId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        const MaintenanceLog = require('../models/MaintenanceLog.sequelize');
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await MaintenanceLog.findAndCountAll({
            where: { stewardId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        res.status(200).json({
            success: true,
            data: rows,
            total: count,
            pages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('[StewardCheckInHistory] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取管家打卡统计
 * @route   GET /api/steward/checkin-statistics
 */
exports.getStewardCheckInStatistics = async (req, res) => {
    try {
        const stewardId = req.user.id;
        const MaintenanceLog = require('../models/MaintenanceLog.sequelize');

        const [total, verified, pending, rejected] = await Promise.all([
            MaintenanceLog.count({ where: { stewardId } }),
            MaintenanceLog.count({ where: { stewardId, status: 'Verified' } }),
            MaintenanceLog.count({ where: { stewardId, status: 'Pending' } }),
            MaintenanceLog.count({ where: { stewardId, status: 'Rejected' } })
        ]);

        res.status(200).json({
            success: true,
            data: { totalCount: total, verifiedCount: verified, pendingCount: pending, rejectedCount: rejected }
        });
    } catch (error) {
        console.error('[StewardCheckInStatistics] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取单次打卡详情
 * @route   GET /api/steward/checkin/:id
 */
exports.getCheckInDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const stewardId = req.user.id;
        const MaintenanceLog = require('../models/MaintenanceLog.sequelize');

        const log = await MaintenanceLog.findOne({ where: { id, stewardId } });
        if (!log) {
            return res.status(404).json({ success: false, message: 'Check-in record not found' });
        }

        res.status(200).json({ success: true, data: log });
    } catch (error) {
        console.error('[StewardCheckInDetail] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * @desc    获取管家收入汇总
 * @route   GET /api/steward/revenue-summary
 */
exports.getStewardRevenueSummary = async (req, res) => {
    try {
        const stewardId = req.user.id;
        const { year, month } = req.query;

        const now = new Date();
        const y = parseInt(year) || now.getFullYear();
        const m = parseInt(month) || (now.getMonth() + 1);
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59);

        // 获取管家名下所有设备
        const units = await Unit.findAll({ where: { stewardId }, attributes: ['id', 'deviceId'] });
        const unitIds = units.map(u => u.id);

        let totalRevenue = 0;
        let totalVolume = 0;
        let transactionCount = 0;

        if (unitIds.length > 0) {
            const result = await Transaction.findAll({
                where: {
                    unitId: { [Op.in]: unitIds },
                    type: 'WaterPurchase',
                    status: 'Completed',
                    createdAt: { [Op.between]: [startDate, endDate] }
                },
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
                    [sequelize.fn('SUM', sequelize.col('volume')), 'totalVolume'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                raw: true
            });

            if (result[0]) {
                totalRevenue = parseFloat(result[0].totalAmount) || 0;
                totalVolume = parseFloat(result[0].totalVolume) || 0;
                transactionCount = parseInt(result[0].count) || 0;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                year: y, month: m,
                totalRevenue, totalVolume, transactionCount,
                unitCount: units.length
            }
        });
    } catch (error) {
        console.error('[StewardRevenueSummary] Error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};
