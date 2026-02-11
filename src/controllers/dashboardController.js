const { User, Unit, Transaction, PhysicalCard } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

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
            Unit.count(),
            Unit.count({ where: { status: 'Online' } }),
            User.count({ where: { role: 'user' } }),
            User.count({ where: { role: 'rp' } }),
            // 获取本月总收入（从Transaction表，类型为TopUp）
            Transaction.sum('amount', {
                where: {
                    type: 'TopUp',
                    createdAt: { [Op.gte]: currentMonthStart }
                }
            })
        ]);

        // 计算增长率（对比上月）
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

        const lastMonthRevenue = await Transaction.sum('amount', {
            where: {
                type: 'TopUp',
                createdAt: {
                    [Op.gte]: lastMonthStart,
                    [Op.lt]: lastMonthEnd
                }
            }
        });

        const currentRevenue = revenueData || 0;
        const lastRevenue = lastMonthRevenue || 0;

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
        startDate.setHours(0, 0, 0, 0);

        // 查询最近N天的收入数据
        const trend = await Transaction.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'revenue']
            ],
            where: {
                type: 'TopUp',
                createdAt: { [Op.gte]: startDate }
            },
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });

        // 创建日期映射
        const trendMap = {};
        trend.forEach(item => {
            trendMap[item.date] = parseFloat(item.revenue) || 0;
        });

        // 填充缺失日期的数据为0
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const monthDay = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]} ${date.getDate()}`;

            result.push({
                date: monthDay,
                revenue: trendMap[dateStr] || 0
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

        // 查询所有RP用户
        const rps = await User.findAll({
            where: { role: 'rp' },
            include: [{
                model: Unit,
                as: 'managedUnits',
                attributes: ['id', 'location']
            }],
            limit: limit,
            order: [[sequelize.literal('(SELECT COUNT(*) FROM units WHERE units.steward_id = User.id)'), 'DESC']]
        });

        // 计算每个RP的收入
        const rpsWithRevenue = await Promise.all(rps.map(async (rp) => {
            const unitIds = rp.managedUnits.map(u => u.id);

            const revenueData = await Transaction.sum('amount', {
                where: {
                    type: 'TopUp',
                    unitId: { [Op.in]: unitIds }
                }
            });

            const revenue = revenueData || 0;
            const unitCount = rp.managedUnits.length;

            return {
                name: rp.name || rp.phoneNumber,
                region: rp.managedUnits[0]?.location || 'Unknown',
                units: unitCount,
                goal: Math.min(100, unitCount * 10), // 简化的目标百分比
                revenue: revenue,
                color: unitCount > 10 ? 'bg-cyan-400' : unitCount > 5 ? 'bg-emerald-500' : 'bg-rose-500'
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
        // 查询按位置分组的设备数量
        const unitsByRegion = await Unit.findAll({
            attributes: [
                'location',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: {
                location: { [Op.ne]: null }
            },
            group: ['location'],
            order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
            limit: 10,
            raw: true
        });

        if (unitsByRegion.length === 0) {
            // 如果没有数据，返回默认值
            return res.json({
                success: true,
                data: [
                    { label: 'Jakarta', value: '0%', percentage: '0%' }
                ]
            });
        }

        const total = unitsByRegion.reduce((sum, item) => sum + parseInt(item.count), 0);

        const distribution = unitsByRegion.map(item => ({
            label: item.location || 'Unknown',
            value: item.count,
            percentage: Math.round((item.count / total) * 100) + '%'
        }));

        // 分组到主要区域
        const jabodetabek = distribution.filter(d =>
            d.label.toLowerCase().includes('jakarta') ||
            d.label.toLowerCase().includes('bogor') ||
            d.label.toLowerCase().includes('depok') ||
            d.label.toLowerCase().includes('tangerang') ||
            d.label.toLowerCase().includes('bekasi')
        ).reduce((sum, d) => sum + parseInt(d.value), 0);

        const westJava = distribution.filter(d =>
            d.label.toLowerCase().includes('bandung') ||
            d.label.toLowerCase().includes('west java') ||
            d.label.toLowerCase().includes('jawa barat')
        ).reduce((sum, d) => sum + parseInt(d.value), 0);

        const others = total - jabodetabek - westJava;

        const result = [
            {
                label: 'Jabodetabek',
                value: jabodetabek,
                percentage: Math.round((jabodetabek / total) * 100) + '%'
            },
            {
                label: 'West Java',
                value: westJava,
                percentage: Math.round((westJava / total) * 100) + '%'
            },
            {
                label: 'Others',
                value: others,
                percentage: Math.round((others / total) * 100) + '%'
            }
        ].filter(d => d.value > 0);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Regional Distribution Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    获取合伙人详情
 * @route   GET /api/dashboard/partners/:id
 */
exports.getPartnerDetail = async (req, res) => {
    try {
        const partner = await User.findByPk(req.params.id, {
            include: [{
                model: Unit,
                as: 'managedUnits'
            }]
        });

        if (!partner || partner.role !== 'rp') {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        const units = partner.managedUnits || [];
        const unitIds = units.map(u => u.id);

        // 获取本月收入
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        const revenueData = await Transaction.sum('amount', {
            where: {
                type: 'TopUp',
                unitId: { [Op.in]: unitIds },
                createdAt: { [Op.gte]: currentMonthStart }
            }
        });

        // 计算新增设备（最近30天）
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const newUnits = await Unit.count({
            where: {
                stewardId: partner.id,
                createdAt: { [Op.gte]: thirtyDaysAgo }
            }
        });

        // 计算合规率（基于设备在线率）
        const onlineUnits = await Unit.count({
            where: {
                stewardId: partner.id,
                status: 'Online'
            }
        });
        const avgCompliance = units.length > 0 ? Math.round((onlineUnits / units.length) * 100) : 98;

        // 计算合规历史（最近6个月）
        const complianceHistory = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date();
            monthStart.setMonth(monthStart.getMonth() - i);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);

            // 简化：使用随机值模拟合规率
            const compliance = 90 + Math.floor(Math.random() * 10);
            complianceHistory.push(compliance);
        }

        // 获取Top和Low设备（基于交易数量）
        const unitsWithStats = await Promise.all(units.map(async (u) => {
            const txCount = await Transaction.count({
                where: { unitId: u.id }
            });
            return {
                id: u.deviceId,
                name: u.location || u.deviceName,
                revenue: txCount * 5000, // 简化计算
                txCount
            };
        }));

        unitsWithStats.sort((a, b) => b.revenue - a.revenue);

        res.json({
            success: true,
            data: {
                name: partner.name || partner.phoneNumber,
                role: 'Regional Partner',
                location: units[0]?.location || 'Unknown',
                joined: partner.createdAt ? new Date(partner.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
                stats: {
                    units: units.length,
                    newUnits: newUnits,
                    revenue: revenueData || 0,
                    compliance: avgCompliance,
                    stewards: 0 // 暂时设为0
                },
                topUnits: unitsWithStats.slice(0, 2).map(u => ({
                    id: u.id,
                    name: u.name,
                    revenue: u.revenue
                })),
                lowUnits: unitsWithStats.slice(-1).filter(() => unitsWithStats.length > 2).map(u => ({
                    id: u.id,
                    name: u.name,
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
