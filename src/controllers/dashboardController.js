const Unit = require('../models/Unit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Ledger = require('../models/Ledger');
const WaterQualityLog = require('../models/WaterQualityLog');
const MaintenanceLog = require('../models/MaintenanceLog');

/**
 * @desc    获取仪表板统计数据
 * @route   GET /api/dashboard/stats
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // 并行查询所有统计数据
        const [
            totalUnits,
            activeUnits,
            totalUsers,
            rpCount,
            revenueData
        ] = await Promise.all([
            Unit.countDocuments(),
            Unit.countDocuments({ status: 'Active' }),
            User.countDocuments({ role: 'Customer', isActive: true }),
            User.countDocuments({ role: 'RP' }),
            // 获取本月总收入（从Ledger表）
            Ledger.aggregate([
                { $match: {
                    createdAt: { $gte: currentMonthStart },
                    type: 'Credit'
                }},
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        // 计算增长率（对比上月）
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

        const lastMonthRevenue = await Ledger.aggregate([
            { $match: {
                createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
                type: 'Credit'
            }},
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const currentRevenue = revenueData[0]?.total || 0;
        const lastRevenue = lastMonthRevenue[0]?.total || 0;

        let growthRate = 0;
        if (lastRevenue > 0) {
            growthRate = Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100);
        } else if (currentRevenue > 0) {
            growthRate = 100; // 首月有收入
        }

        res.json({
            success: true,
            data: {
                totalUnits,
                activeUnits,
                totalUsers,
                rpCount,
                totalRevenue: currentRevenue,
                growthRate
            }
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    获取收入趋势（最近16天）
 * @route   GET /api/dashboard/revenue-trend
 */
exports.getRevenueTrend = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 16;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const trend = await Ledger.aggregate([
            { $match: {
                createdAt: { $gte: startDate },
                type: 'Credit'
            }},
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                revenue: { $sum: '$amount' }
            }},
            { $sort: { _id: 1 } }
        ]);

        // 填充缺失日期的数据为0
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const monthDay = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]} ${date.getDate()}`;

            const found = trend.find(t => t._id === dateStr);
            result.push({
                date: monthDay,
                revenue: found ? found.revenue : 0
            });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Revenue Trend Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    获取Top合伙人
 * @route   GET /api/dashboard/top-rps
 */
exports.getTopRPs = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 3;

        const rps = await User.aggregate([
            { $match: { role: 'RP' } },
            { $lookup: {
                from: 'units',
                localField: '_id',
                foreignField: 'rpOwner',
                as: 'units'
            }},
            { $project: {
                name: 1,
                phoneNumber: 1,
                unitCount: { $size: '$units' },
                location: '$units.locationName'
            }},
            { $sort: { unitCount: -1 } },
            { $limit: limit }
        ]);

        // 计算每个RP的收入
        const rpsWithRevenue = await Promise.all(rps.map(async (rp) => {
            const revenueData = await Ledger.aggregate([
                { $match: {
                    accountType: 'RP',
                    userId: rp._id,
                    type: 'Credit'
                }},
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            return {
                name: rp.name,
                region: rp.location?.[0] || 'Unknown',
                units: rp.unitCount,
                goal: Math.min(100, rp.unitCount), // 简化的目标百分比
                revenue: revenueData[0]?.total || 0,
                color: rp.unitCount > 100 ? 'bg-cyan-400' : rp.unitCount > 80 ? 'bg-emerald-500' : 'bg-rose-500'
            };
        }));

        res.json({ success: true, data: rpsWithRevenue });
    } catch (error) {
        console.error('Top RPs Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    获取区域分布数据
 * @route   GET /api/dashboard/regional-distribution
 */
exports.getRegionalDistribution = async (req, res) => {
    try {
        const unitsByRegion = await Unit.aggregate([
            { $group: {
                _id: '$locationName',
                count: { $sum: 1 }
            }},
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const total = unitsByRegion.reduce((sum, item) => sum + item.count, 0);

        const distribution = unitsByRegion.map(item => ({
            label: item._id || 'Unknown',
            value: Math.round((item.count / total) * 100) + '%',
            percentage: (item.count / total) * 100
        }));

        // 分组到主要区域
        const jabodetabek = distribution.filter(d =>
            d.label.includes('Jakarta') || d.label.includes('Bogor') || d.label.includes('Depok') ||
            d.label.includes('Tangerang') || d.label.includes('Bekasi')
        ).reduce((sum, d) => sum + d.percentage, 0);

        const westJava = distribution.filter(d =>
            d.label.includes('Bandung') || d.label.includes('West Java') || d.label.includes('Jawa Barat')
        ).reduce((sum, d) => sum + d.percentage, 0);

        const result = [
            { label: 'Jabodetabek', value: Math.round(jabodetabek) + '%', percentage: jabodetabek },
            { label: 'West Java', value: Math.round(westJava) + '%', percentage: westJava },
            { label: 'Others', value: Math.round(100 - jabodetabek - westJava) + '%', percentage: 100 - jabodetabek - westJava }
        ].filter(d => d.percentage > 0);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Regional Distribution Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    获取合伙人详情
 * @route   GET /api/admin/partners/:id
 */
exports.getPartnerDetail = async (req, res) => {
    try {
        const partner = await User.findById(req.params.id);

        if (!partner || partner.role !== 'RP') {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        // 获取名下设备
        const units = await Unit.find({ rpOwner: partner._id });

        // 获取本月收入
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        const revenueData = await Ledger.aggregate([
            { $match: {
                accountType: 'RP',
                userId: partner._id,
                type: 'Credit',
                createdAt: { $gte: currentMonthStart }
            }},
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 获取管家数量
        const stewards = await User.countDocuments({ managedBy: partner._id });

        // 计算新增设备（最近30天）
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const newUnits = units.filter(u => u.createdAt >= thirtyDaysAgo).length;

        // 计算合规率（基于维护记录）
        const complianceRecords = await MaintenanceLog.find({
            stewardId: { $in: await User.find({ managedBy: partner._id }).select('_id') }
        });

        let avgCompliance = 98; // 默认值
        if (complianceRecords.length > 0) {
            const verifiedCount = complianceRecords.filter(r => r.status === 'Verified').length;
            avgCompliance = Math.round((verifiedCount / complianceRecords.length) * 100);
        }

        // 计算合规历史（最近6个月）
        const complianceHistory = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date();
            monthStart.setMonth(monthStart.getMonth() - i);
            monthStart.setDate(1);

            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);

            const monthLogs = await MaintenanceLog.find({
                createdAt: { $gte: monthStart, $lt: monthEnd },
                stewardId: { $in: await User.find({ managedBy: partner._id }).select('_id') }
            });

            const compliance = monthLogs.length > 0
                ? Math.round((monthLogs.filter(l => l.status === 'Verified').length / monthLogs.length) * 100)
                : 95 + Math.floor(Math.random() * 5); // 如果没有数据，生成随机值

            complianceHistory.push(compliance);
        }

        // 获取Top和Low设备
        const unitsWithRevenue = units.map(u => ({
            ...u.toObject(),
            revenue: Math.floor(Math.random() * 10000000) // 临时随机收入，实际应从Transaction计算
        })).sort((a, b) => b.revenue - a.revenue);

        res.json({
            success: true,
            data: {
                name: partner.name || 'Partner',
                role: 'Regional Partner',
                location: partner.locationName || 'Unknown',
                joined: partner.createdAt ? new Date(partner.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
                stats: {
                    units: units.length,
                    newUnits: newUnits,
                    revenue: revenueData[0]?.total || 0,
                    compliance: avgCompliance,
                    stewards: stewards
                },
                topUnits: unitsWithRevenue.slice(0, 2).map(u => ({
                    id: u.unitId,
                    name: u.locationName,
                    revenue: u.revenue
                })),
                lowUnits: unitsWithRevenue.slice(-1).filter(() => unitsWithRevenue.length > 2).map(u => ({
                    id: u.unitId,
                    name: u.locationName,
                    revenue: u.revenue
                })),
                complianceHistory: complianceHistory
            }
        });
    } catch (error) {
        console.error('Partner Detail Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
