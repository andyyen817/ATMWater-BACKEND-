const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Unit = require('../models/Unit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * @desc    获取 RP 看板核心数据
 * @route   GET /api/rp/dashboard
 */
exports.getRPDashboard = async (req, res) => {
    try {
        const rpId = req.user.id;

        // 1. 获取该 RP 的所有设备
        const units = await Unit.findAll({ where: { rpOwnerId: rpId } });
        const totalUnits = units.length;
        const offlineUnits = units.filter(u => u.status === 'Offline').length;

        // 2. 计算本月收入
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const unitIds = units.map(u => u.id);
        let monthlyRevenue = 0;
        if (unitIds.length > 0) {
            const result = await Transaction.findAll({
                where: {
                    unitId: { [Op.in]: unitIds },
                    type: 'WaterPurchase',
                    status: 'Completed',
                    createdAt: { [Op.gte]: startOfMonth }
                },
                attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
                raw: true
            });
            monthlyRevenue = parseFloat(result[0]?.total) || 0;
        }

        // 3. 获取下属管家
        const stewards = await User.findAll({
            where: { managedBy: rpId, role: 'Steward' },
            attributes: ['id', 'name', 'phoneNumber']
        });
        const MaintenanceLog = require('../models/MaintenanceLog.sequelize');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stewardList = await Promise.all(stewards.map(async (steward) => {
            const managedUnitsCount = await Unit.count({ where: { stewardId: steward.id } });
            const checkinCount = await MaintenanceLog.count({
                where: { stewardId: steward.id, createdAt: { [Op.gte]: today } }
            });
            return {
                id: steward.id,
                name: steward.name,
                phoneNumber: steward.phoneNumber,
                managedUnitsCount,
                hasCheckedInToday: checkinCount > 0
            };
        }));

        res.status(200).json({
            success: true,
            data: {
                totalUnits,
                offlineUnits,
                monthlyRevenue,
                stewards: stewardList,
                rpName: req.user.name
            }
        });
    } catch (error) {
        console.error('RP Dashboard Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to load RP dashboard' });
    }
};

/**
 * @desc    RP 组织树
 * @route   GET /api/rp/org-tree
 */
exports.getRPOrgTree = async (req, res) => {
    try {
        const rpId = req.user.id;
        const rp = await User.findByPk(rpId, { attributes: ['id', 'name', 'phoneNumber'] });

        const stewards = await User.findAll({
            where: { managedBy: rpId, role: 'Steward' },
            attributes: ['id', 'name', 'phoneNumber']
        });

        const children = await Promise.all(stewards.map(async (steward) => {
            const units = await Unit.findAll({
                where: { stewardId: steward.id },
                attributes: ['id', 'deviceId', 'location', 'status']
            });
            return {
                id: steward.id,
                name: steward.name,
                phoneNumber: steward.phoneNumber,
                units: units.map(u => ({ id: u.id, deviceId: u.deviceId, location: u.location, status: u.status }))
            };
        }));

        const totalUnits = children.reduce((sum, s) => sum + s.units.length, 0);

        res.status(200).json({
            success: true,
            data: [{
                id: rp.id,
                name: rp.name,
                phoneNumber: rp.phoneNumber,
                totalUnits,
                stewardCount: stewards.length,
                children
            }]
        });
    } catch (error) {
        console.error('RP OrgTree Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    RP 收入汇总
 * @route   GET /api/rp/revenue-summary
 */
exports.getRPRevenueSummary = async (req, res) => {
    try {
        const rpId = req.user.id;
        const { year, month } = req.query;

        const now = new Date();
        const y = parseInt(year) || now.getFullYear();
        const m = parseInt(month) || (now.getMonth() + 1);
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59);

        const units = await Unit.findAll({ where: { rpOwnerId: rpId }, attributes: ['id', 'deviceId'] });
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
            data: { year: y, month: m, totalRevenue, totalVolume, transactionCount, unitCount: units.length }
        });
    } catch (error) {
        console.error('RP RevenueSummary Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    RP 欠费提醒处理
 * @route   POST /api/rp/handle-overdue
 */
exports.handleOverdue = async (req, res) => {
    try {
        const { unitId } = req.body;
        res.status(200).json({ success: true, message: `Overdue alert for unit ${unitId} acknowledged.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
