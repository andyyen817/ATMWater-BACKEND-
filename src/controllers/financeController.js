const { Transaction, Unit, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * @desc    获取全量交易流水 (带高级筛选)
 * @route   GET /api/finance/transactions
 */
exports.getAllTransactions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            status,
            startDate,
            endDate,
            userId
        } = req.query;

        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (userId) where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await Transaction.findAndCountAll({
            where,
            include: [{ model: User, as: 'user', attributes: ['name', 'phoneNumber', 'role'] }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        // 按类型汇总
        const stats = await Transaction.findAll({
            where,
            attributes: [
                'type',
                [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['type'],
            raw: true
        });

        res.status(200).json({
            success: true,
            data: rows,
            stats,
            total: count,
            pages: Math.ceil(count / parseInt(limit)),
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('Finance API Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取营收汇总数据
 * @route   GET /api/finance/revenue
 */
exports.getRevenueStats = async (req, res) => {
    try {
        // 1. 购水总收入
        const waterRevenue = await Transaction.findOne({
            where: { type: 'WaterPurchase', status: 'Completed' },
            attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
            raw: true
        });

        // 2. 充值总收入
        const topupRevenue = await Transaction.findOne({
            where: { type: 'TopUp', status: 'Completed' },
            attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
            raw: true
        });

        // 3. 本月购水收入
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyRevenue = await Transaction.findOne({
            where: {
                type: 'WaterPurchase',
                status: 'Completed',
                createdAt: { [Op.gte]: monthStart }
            },
            attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
            raw: true
        });

        // 4. 本月交易笔数
        const monthlyCount = await Transaction.count({
            where: {
                type: 'WaterPurchase',
                status: 'Completed',
                createdAt: { [Op.gte]: monthStart }
            }
        });

        // 5. 活跃水站数
        const activeUnits = await Unit.count({ where: { isActive: true } });

        // 6. 分润账本汇总（从 profit_sharing_ledger 表）
        const [ledgerStats] = await sequelize.query(`
            SELECT
                SUM(CASE WHEN account_type='Steward' THEN amount ELSE 0 END) as stewardTotal,
                SUM(CASE WHEN account_type='RP' THEN amount ELSE 0 END) as rpTotal,
                SUM(CASE WHEN account_type='Headquarters' THEN amount ELSE 0 END) as hqTotal
            FROM profit_sharing_ledger
            WHERE status='Settled'
        `);

        const ledger = ledgerStats[0] || {};

        res.status(200).json({
            success: true,
            data: {
                totalRevenue: parseFloat(waterRevenue?.total) || 0,
                topupRevenue: parseFloat(topupRevenue?.total) || 0,
                monthlyRevenue: parseFloat(monthlyRevenue?.total) || 0,
                monthlyCount,
                activeUnits,
                stewardRewards: parseFloat(ledger.stewardTotal) || 0,
                rpRevenue: parseFloat(ledger.rpTotal) || 0,
                headquartersRevenue: parseFloat(ledger.hqTotal) || 0,
                subscriptionRevenue: 0,
                growthPool: 0,
                overdueUnits: 0
            }
        });
    } catch (error) {
        console.error('Revenue Stats Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    导出交易数据 CSV
 * @route   GET /api/finance/export
 */
exports.exportTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            include: [{ model: User, as: 'user', attributes: ['name', 'phoneNumber'] }],
            order: [['createdAt', 'DESC']],
            limit: 5000
        });

        let csv = 'ID,Date,User,Phone,Type,Amount(Rp),Volume(ml),Status\n';
        transactions.forEach(t => {
            csv += `${t.id},${t.createdAt.toISOString()},${t.user?.name || 'N/A'},${t.user?.phoneNumber || 'N/A'},${t.type},${t.amount},${t.volume || 0},${t.status}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('ATMWater_Transactions.csv');
        return res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Export Failed' });
    }
};
