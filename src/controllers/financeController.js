const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Unit = require('../models/Unit');

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

        // 1. 构建动态查询条件
        const query = {};
        if (type) query.type = type;
        if (status) query.status = status;
        if (userId) query.userId = userId;
        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // 2. 执行分页查询
        const transactions = await Transaction.find(query)
            .populate('userId', 'name phoneNumber role')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Transaction.countDocuments(query);

        // 3. 计算汇总统计 (针对当前筛选条件)
        const stats = await Transaction.aggregate([
            { $match: query },
            { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        res.status(200).json({
            success: true,
            data: transactions,
            stats,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
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
        // 1. 购水收入统计
        const totalRevenue = await Transaction.aggregate([
            { $match: { type: 'WaterPurchase', status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 2. 订阅费收入统计 (从SubscriptionFee类型的交易)
        const subscriptionRevenue = await Transaction.aggregate([
            { $match: { type: 'SubscriptionFee', status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 3. 管家奖励统计
        const stewardRewards = await Transaction.aggregate([
            { $match: { type: 'StewardReward', status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 4. 超期未维护设备数量
        const overdueUnits = await Unit.countDocuments({
            'subscription.isOverdue': true
        });

        // 5. 发展基金 (暂时为0，如果需要可以从Ledger表查询)
        const growthPool = 0;

        res.status(200).json({
            success: true,
            data: {
                totalRevenue: totalRevenue[0]?.total || 0,
                subscriptionRevenue: subscriptionRevenue[0]?.total || 0,
                stewardRewards: stewardRewards[0]?.total || 0,
                growthPool: growthPool,
                overdueUnits: overdueUnits
            }
        });
    } catch (error) {
        console.error('Revenue Stats Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    导出数据模拟 (生成 CSV 格式数据)
 * @route   GET /api/finance/export
 */
exports.exportTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find().populate('userId', 'name phoneNumber');
        
        let csv = 'ID,Date,User,Phone,Type,Amount(Rp),Status\n';
        transactions.forEach(t => {
            csv += `${t._id},${t.createdAt.toISOString()},${t.userId?.name || 'N/A'},${t.userId?.phoneNumber || 'N/A'},${t.type},${t.amount/100},${t.status}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('ATMWater_Transactions.csv');
        return res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Export Failed' });
    }
};

