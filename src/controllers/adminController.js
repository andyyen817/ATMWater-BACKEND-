const Unit = require('../models/Unit');
const User = require('../models/User');
const UserLog = require('../models/UserLog');
const Permission = require('../models/Permission');
const { Op } = require('sequelize');
const hardwareService = require('../services/hardwareService');
const renrenWaterService = require('../services/renrenWaterService');
const websocketService = require('../services/websocketService');
// const completeDataSyncService = require('../services/completeDataSyncService'); // 暂时注释，因为依赖mongoose
const { MaintenanceLog, WaterQualityLog } = require('../models'); // 使用MySQL版本的模型

/**
 * @desc    管理员直接创建用户 (用于添加 RP, Steward 或 内部员工)
 * @route   POST /api/admin/users
 */
exports.createUser = async (req, res) => {
    try {
        const { phoneNumber, name, role, email } = req.body;

        if (!phoneNumber || !role) {
            return res.status(400).json({ success: false, message: 'Phone number and role are required' });
        }

        // 1. 检查手机号是否已存在
        let user = await User.findOne({ where: { phone: phoneNumber } });
        if (user) {
            return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
        }

        // 2. 检查唯一性限制 (Super-Admin 和 Admin 全局仅限 1 位)
        if (role === 'Super-Admin' || role === 'Admin') {
            const existing = await User.findOne({ where: { role } });
            if (existing) {
                return res.status(400).json({ success: false, message: `Only one ${role} is allowed in the system.` });
            }
        }

        // 3. 生成推荐码 (如果是 RP 或 Steward 可能需要)
        const crypto = require('crypto');
        const referralCode = crypto.randomBytes(3).toString('hex').toUpperCase();

        // 4. 创建用户
        user = await User.create({
            phone: phoneNumber,
            name: name || 'New User',
            role,
            email,
            referralCode,
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: `User created successfully with role: ${role}`,
            data: user
        });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取所有用户列表 (支持按角色过滤，包含统计数据)
 * @route   GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const sequelize = require('../config/database');
        const query = {};

        // 如果传入了角色过滤参数
        if (role && role !== 'All') {
            query.role = role;
        }

        const users = await User.findAll({
            where: query,
            attributes: {
                exclude: ['otp', 'otpExpires', 'password'],
                include: [
                    // 取水次数
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM transactions
                            WHERE transactions.user_id = User.id
                            AND transactions.type = 'WaterPurchase'
                            AND transactions.status = 'Completed'
                        )`),
                        'waterPurchaseCount'
                    ],
                    // 取水总量
                    [
                        sequelize.literal(`(
                            SELECT COALESCE(SUM(volume), 0)
                            FROM transactions
                            WHERE transactions.user_id = User.id
                            AND transactions.type = 'WaterPurchase'
                            AND transactions.status = 'Completed'
                        )`),
                        'totalWaterVolume'
                    ],
                    // 取水总金额
                    [
                        sequelize.literal(`(
                            SELECT COALESCE(SUM(amount), 0)
                            FROM transactions
                            WHERE transactions.user_id = User.id
                            AND transactions.type = 'WaterPurchase'
                            AND transactions.status = 'Completed'
                        )`),
                        'totalWaterAmount'
                    ],
                    // 充值次数
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM transactions
                            WHERE transactions.user_id = User.id
                            AND transactions.type = 'TopUp'
                            AND transactions.status = 'Completed'
                        )`),
                        'topUpCount'
                    ],
                    // 充值总额
                    [
                        sequelize.literal(`(
                            SELECT COALESCE(SUM(amount), 0)
                            FROM transactions
                            WHERE transactions.user_id = User.id
                            AND transactions.type = 'TopUp'
                            AND transactions.status = 'Completed'
                        )`),
                        'totalTopUpAmount'
                    ],
                    // 绑定卡片数
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM physical_cards
                            WHERE physical_cards.user_id = User.id
                        )`),
                        'cardCount'
                    ],
                    // 激活卡片数
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM physical_cards
                            WHERE physical_cards.user_id = User.id
                            AND physical_cards.status = 'Active'
                        )`),
                        'activeCardCount'
                    ],
                    // 日志总数
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM user_logs
                            WHERE user_logs.user_id = User.id
                        )`),
                        'logCount'
                    ]
                ]
            },
            order: [['createdAt', 'DESC']],
            raw: true
        });

        // 格式化数据结构
        const formattedUsers = users.map(user => ({
            ...user,
            stats: {
                waterPurchases: {
                    count: parseInt(user.waterPurchaseCount) || 0,
                    totalVolume: parseFloat(user.totalWaterVolume) || 0,
                    totalAmount: parseFloat(user.totalWaterAmount) || 0
                },
                topUps: {
                    count: parseInt(user.topUpCount) || 0,
                    totalAmount: parseFloat(user.totalTopUpAmount) || 0
                },
                cards: {
                    total: parseInt(user.cardCount) || 0,
                    active: parseInt(user.activeCardCount) || 0
                },
                logs: {
                    total: parseInt(user.logCount) || 0
                }
            }
        }));

        // 移除临时统计字段
        formattedUsers.forEach(user => {
            delete user.waterPurchaseCount;
            delete user.totalWaterVolume;
            delete user.totalWaterAmount;
            delete user.topUpCount;
            delete user.totalTopUpAmount;
            delete user.cardCount;
            delete user.activeCardCount;
            delete user.logCount;
        });

        res.status(200).json({
            success: true,
            count: formattedUsers.length,
            data: formattedUsers
        });
    } catch (error) {
        console.error('Get All Users Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    更新用户角色
 * @route   PUT /api/admin/users/:id/role
 */
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['Customer', 'Steward', 'RP', 'GM', 'Finance', 'Business', 'AfterSales', 'Admin', 'Super-Admin'];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        // 检查唯一性限制
        if (role === 'Super-Admin' || role === 'Admin') {
            const existing = await User.findOne({ where: { role } });
            if (existing && existing.id.toString() !== req.params.id) {
                return res.status(400).json({ success: false, message: `Only one ${role} is allowed in the system.` });
            }
        }

        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['otp', 'otpExpires'] }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await user.update({ role });

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            data: user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    管理员修改用户密码
 * @route   PUT /api/admin/users/:userId/password
 * @access  Private (Super-Admin, Admin)
 */
exports.updateUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;

        // 验证密码
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // 查找用户
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 更新密码（beforeUpdate hook会自动加密）
        await user.update({ password: newPassword });

        // 记录审计日志
        console.log(`[Admin] Password updated for user ${userId} by admin ${req.user?.id || 'unknown'}`);

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Update User Password Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

/**
 * @desc    获取用户上传的日志列表 (管理员查看)
 * @route   GET /api/admin/users/:userId/logs
 * @access  Private (Super-Admin, Admin)
 */
exports.getUserLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        // 验证用户是否存在
        const user = await User.findByPk(userId, {
            attributes: ['id', 'name', 'phoneNumber', 'role']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 分页查询日志
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows: logs } = await UserLog.findAndCountAll({
            where: { userId },
            order: [['uploadedAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        // 格式化日志数据
        const formattedLogs = logs.map(log => ({
            id: log.id,
            logs: log.logs,
            deviceInfo: log.deviceInfo,
            appVersion: log.appVersion,
            uploadedAt: log.uploadedAt,
            createdAt: log.createdAt
        }));

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    phoneNumber: user.phoneNumber,
                    role: user.role
                },
                logs: formattedLogs,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('[getUserLogs] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user logs',
            error: error.message
        });
    }
};

/**
 * @desc    获取用户交易记录 (支持type过滤)
 * @route   GET /api/admin/users/:userId/transactions
 * @access  Private (Super-Admin, Admin)
 */
exports.getUserTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type, page = 1, limit = 50 } = req.query;
        const Transaction = require('../models/Transaction');

        // 验证用户是否存在
        const user = await User.findByPk(userId, {
            attributes: ['id', 'name', 'phone']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 构建查询条件
        const whereClause = { userId: userId };
        if (type) {
            whereClause.type = type;
        }

        // 分页查询交易记录
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows: transactions } = await Transaction.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('[getUserTransactions] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user transactions',
            error: error.message
        });
    }
};

/**
 * @desc    获取用户充值记录
 * @route   GET /api/admin/users/:userId/recharges
 * @access  Private (Super-Admin, Admin)
 */
exports.getUserRecharges = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const Transaction = require('../models/Transaction');

        // 验证用户是否存在
        const user = await User.findByPk(userId, {
            attributes: ['id', 'name', 'phone']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 查询充值记录
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows: recharges } = await Transaction.findAndCountAll({
            where: {
                userId: userId,
                type: 'TopUp',
                status: 'Completed'
            },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        res.status(200).json({
            success: true,
            data: {
                recharges,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('[getUserRecharges] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user recharges',
            error: error.message
        });
    }
};

/**
 * @desc    获取用户绑定的卡片列表
 * @route   GET /api/admin/users/:userId/cards
 * @access  Private (Super-Admin, Admin)
 */
exports.getUserCards = async (req, res) => {
    try {
        const { userId } = req.params;
        const PhysicalCard = require('../models/PhysicalCard');

        // 验证用户是否存在
        const user = await User.findByPk(userId, {
            attributes: ['id', 'name', 'phone', 'virtualRfid']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 获取物理卡
        const physicalCards = await PhysicalCard.findAll({
            where: { userId: userId },
            order: [['boundAt', 'DESC']]
        });

        // 获取电子卡 (RenrenCard) - MongoDB
        let electronicCards = [];
        try {
            const RenrenCard = require('../models/RenrenCard');
            electronicCards = await RenrenCard.find({ localUserId: userId }).lean();
        } catch (mongoError) {
            console.log('[getUserCards] MongoDB not available or no RenrenCard model, skipping electronic cards');
        }

        res.status(200).json({
            success: true,
            data: {
                virtualRfid: user.virtualRfid,
                physicalCards: physicalCards,
                electronicCards: electronicCards
            }
        });
    } catch (error) {
        console.error('[getUserCards] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user cards',
            error: error.message
        });
    }
};

/**
 * @desc    获取权限矩阵
 * @route   GET /api/admin/permissions
 */
exports.getPermissions = async (req, res) => {
    try {
        const permissions = await Permission.findAll();
        res.status(200).json({
            success: true,
            data: permissions
        });
    } catch (error) {
        console.error('Get Permissions Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    更新权限矩阵
 * @route   POST /api/admin/permissions
 */
exports.updatePermissions = async (req, res) => {
    try {
        const { matrix } = req.body;

        for (const item of matrix) {
            const [permission, created] = await Permission.findOrCreate({
                where: { functionKey: item.functionKey },
                defaults: {
                    permissions: item.permissions,
                    label: item.label
                }
            });

            if (!created) {
                await permission.update({
                    permissions: item.permissions,
                    ...(item.label && { label: item.label })
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Permissions updated successfully'
        });
    } catch (error) {
        console.error('Update Permissions Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取单个设备详情
 * @route   GET /api/admin/units/:id
 */
exports.getUnitDetail = async (req, res) => {
    try {
        // 1. 获取MySQL中的基础设备信息
        const unit = await Unit.findByPk(req.params.id, {
            include: [{
                model: User,
                as: 'steward',
                attributes: ['id', 'name', 'phoneNumber']
            }]
        });

        if (!unit) {
            return res.status(404).json({ success: false, message: 'Unit not found' });
        }

        // 2. 获取最新水质数据（MySQL）
        let latestWaterQuality = null;
        try {
            // 首先尝试从water_quality_logs表查询
            latestWaterQuality = await WaterQualityLog.findOne({
                where: { deviceId: unit.deviceId },
                order: [['timestamp', 'DESC']]
            });

            // 如果water_quality_logs表为空，从transactions表查询最新的水质数据
            if (!latestWaterQuality) {
                const Transaction = require('../models/Transaction');
                const { Op } = require('sequelize');
                const latestTransaction = await Transaction.findOne({
                    where: {
                        deviceId: unit.deviceId,
                        type: 'WaterPurchase',
                        outputTds: { [Op.ne]: null }
                    },
                    order: [['createdAt', 'DESC']],
                    attributes: ['outputTds', 'waterTemp', 'createdAt']
                });

                if (latestTransaction) {
                    // 将transaction数据转换为water_quality_logs格式
                    latestWaterQuality = {
                        pureTds: latestTransaction.outputTds,
                        ph: 7.0, // 默认值，transactions表中没有pH数据
                        temperature: latestTransaction.waterTemp,
                        timestamp: latestTransaction.createdAt
                    };
                    console.log('[INFO] Using water quality data from transactions table');
                }
            }
        } catch (error) {
            console.warn('Failed to fetch water quality logs:', error.message);
        }

        // 3. 获取维护日志（MySQL）
        let maintenanceLogs = [];
        try {
            const logs = await MaintenanceLog.findAll({
                where: { deviceId: unit.deviceId },
                include: [{
                    model: User,
                    as: 'steward',
                    attributes: ['id', 'name', 'phoneNumber']
                }],
                order: [['createdAt', 'DESC']],
                limit: 10
            });

            // 转换为前端期望的格式
            maintenanceLogs = logs.map(log => {
                const date = new Date(log.createdAt);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const formattedDate = `${date.getDate()} ${monthNames[date.getMonth()]}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

                let title = 'Daily Check-in';
                if (log.steward) {
                    title = `Daily Check-in by ${log.steward.name || 'Steward'}`;
                }

                const tasks = [];
                if (log.cleaned) tasks.push('Cleaning done');
                if (log.filterChecked) tasks.push('Filter checked');
                if (log.tdsValue) tasks.push(`TDS: ${log.tdsValue}`);
                if (log.phValue) tasks.push(`pH: ${log.phValue}`);

                const desc = tasks.length > 0 ? tasks.join(', ') + '. Machine photo uploaded.' : 'Machine photo uploaded.';

                return {
                    date: formattedDate,
                    title: title,
                    desc: desc,
                    action: log.photoUrl ? 'View Photo' : null,
                    photoUrl: log.photoUrl,
                    status: log.status
                };
            });
        } catch (error) {
            console.warn('Failed to fetch maintenance logs:', error.message);
        }

        // 4. 构建响应数据（匹配前端期望）
        const responseData = {
            unitId: unit.deviceId,
            locationName: unit.deviceName || unit.location || 'Unknown Location',
            location: unit.location,
            latitude: unit.latitude,
            longitude: unit.longitude,
            status: unit.status === 'Online' ? 'Active' : unit.status,

            // 嵌套的传感器对象
            sensors: {
                pureTDS: latestWaterQuality?.pureTds || unit.tdsValue || 0,
                ph: latestWaterQuality?.ph || 7.0,
                temp: latestWaterQuality?.temperature || unit.temperature || 25
            },

            // 滤芯状态（暂时为空数组）
            filters: [],

            // 维护日志
            logs: maintenanceLogs,

            // 管家信息
            steward: unit.steward ? {
                id: unit.steward.id,
                name: unit.steward.name,
                phoneNumber: unit.steward.phoneNumber
            } : null,

            pricePerLiter: unit.pricePerLiter,
            lastHeartbeatAt: unit.lastHeartbeatAt
        };

        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Get Unit Detail Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

/**
 * @desc    获取 Dashboard 核心 KPI 数据
 * @route   GET /api/admin/dashboard-stats
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');
        
        // 1. 总装机量 (设备总数)
        const totalUnits = await Unit.countDocuments();
        
        // 2. 活跃设备 (Active 状态)
        const activeUnits = await Unit.countDocuments({ status: 'Active' });
        
        // 3. 总用户量 (排除管理员)
        const totalUsers = await User.countDocuments({ role: { $nin: ['Admin', 'Super-Admin'] } });
        
        // 4. 总收入 (已完成的购水和订阅费用)
        const revenueStats = await Transaction.aggregate([
            {
                $match: {
                    type: { $in: ['WaterPurchase', 'SubscriptionFee'] },
                    status: 'Completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        const totalRevenue = revenueStats.length > 0 ? revenueStats[0].total : 0;

        // 5. 获取最近 15 天的收入趋势图数据
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        fifteenDaysAgo.setHours(0, 0, 0, 0);

        const dailyRevenue = await Transaction.aggregate([
            {
                $match: {
                    type: { $in: ['WaterPurchase', 'SubscriptionFee'] },
                    status: 'Completed',
                    createdAt: { $gte: fifteenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$amount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // 填充缺失日期
        const chartData = [];
        for (let i = 0; i < 16; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (15 - i));
            const dateStr = date.toISOString().split('T')[0];
            const dayData = dailyRevenue.find(d => d._id === dateStr);
            chartData.push({
                date: dateStr.substring(5), // 只显示 MM-DD
                revenue: dayData ? dayData.revenue : 0
            });
        }

        // 6. 计算设备增长率 (本月 vs 上月)
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        const unitsThisMonth = await Unit.countDocuments({ createdAt: { $gte: startOfThisMonth } });
        const unitsLastMonth = await Unit.countDocuments({ 
            createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } 
        });

        let growthRate = '0%';
        if (unitsLastMonth > 0) {
            const rate = ((unitsThisMonth - unitsLastMonth) / unitsLastMonth * 100).toFixed(0);
            growthRate = (rate >= 0 ? '+' : '') + rate + '%';
        } else if (unitsThisMonth > 0) {
            growthRate = '+100%';
        }

        // 7. 获取 RP 表现数据
        const rpPerformance = await User.find({ role: 'RP' });
        const rpDataList = await Promise.all(rpPerformance.map(async (rp) => {
            const unitsCount = await Unit.countDocuments({ rpOwner: rp._id });
            const rpRevenueStats = await Transaction.aggregate([
                {
                    $match: {
                        userId: rp._id,
                        status: 'Completed'
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            return {
                name: rp.name || 'Anonymous RP',
                region: 'Active Region',
                units: unitsCount,
                goal: 100, // 实际数据，暂时设定目标为 100%
                revenue: (rpRevenueStats[0]?.total || 0).toLocaleString(),
                color: 'bg-cyan-400'
            };
        }));

        res.status(200).json({
            success: true,
            data: {
                totalUnits,
                activeUnits,
                totalUsers,
                totalRevenue,
                growthRate,
                chartData,
                rpData: rpDataList
            }
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


/**
 * @desc    获取所有设备列表
 * @route   GET /api/admin/units
 */
exports.getAllUnits = async (req, res) => {
    try {
        const where = {};
        const role = req.user?.role;

        if (role === 'Steward') {
            where.stewardId = req.user.id;
        } else if (role === 'RP') {
            where.rpOwnerId = req.user.id;
        }

        const units = await Unit.findAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [{
                model: User,
                as: 'steward',
                attributes: ['id', 'name', 'phoneNumber']
            }]
        });
        res.status(200).json({
            success: true,
            count: units.length,
            data: units
        });
    } catch (error) {
        console.error('Get All Units Error:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    远程控制设备 (锁定/解锁) [P1-WEB-002]
 * @route   POST /api/admin/units/:id/control
 */
exports.controlUnit = async (req, res) => {
    try {
        const { action } = req.body; // 'lock' or 'unlock'
        const unit = await Unit.findById(req.params.id);

        if (!unit) {
            return res.status(404).json({ success: false, message: 'Unit not found' });
        }

        const power = action === 'unlock' ? 1 : 0;

        // 同步发送指令到硬件平台 [P1-WEB-002]
        const hardwareResult = await hardwareService.controlPower(unit.unitId, power);

        if (!hardwareResult.success) {
            return res.status(500).json({ 
                success: false, 
                message: hardwareResult.error || 'Hardware control failed' 
            });
        }

        if (action === 'lock') {
            unit.isLocked = true;
            unit.status = 'Locked';
        } else if (action === 'unlock') {
            unit.isLocked = false;
            unit.status = 'Active';
        }

        await unit.save();

        res.status(200).json({
            success: true,
            message: `Unit ${action}ed successfully via Hardware API`,
            data: unit
        });
    } catch (error) {
        console.error('Control Unit Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    从人人水站导入设备（检查存在性后导入）
 * @route   POST /api/admin/units/import
 */
exports.importRenrenDevice = async (req, res) => {
    try {
        const { deviceNo } = req.body;

        if (!deviceNo) {
            return res.status(400).json({
                success: false,
                message: '设备号不能为空'
            });
        }

        console.log('[ImportRenrenDevice] 收到导入请求', { deviceNo });

        // 先检查设备是否已在本地数据库中
        const existingUnit = await Unit.findOne({ unitId: deviceNo });
        if (existingUnit) {
            return res.status(200).json({
                success: true,
                message: '设备已存在于本地数据库',
                alreadyExists: true,
                data: existingUnit
            });
        }

        // 调用人人水站API检查设备是否存在
        const deviceInfo = await renrenWaterService.getDeviceInfo(deviceNo);

        if (deviceInfo.success && deviceInfo.code === 0) {
            const result = deviceInfo.result;

            // 创建新设备记录
            const unit = new Unit({
                unitId: result.device_no || deviceNo,
                locationName: result.device_name || `设备 ${deviceNo}`,
                status: 'Active',
                // 人人水站API数据
                price: result.price || 0,
                speed: result.speed || 0,
                preCash: result.pre_cash || 0,
                valid: result.valid === 1,
                validDate: result.valid_date || null,
                // 出水口信息
                outlets: result.outlets ? result.outlets.map(o => ({
                    no: o.outlet_no,
                    price: o.price,
                    speed: o.speed
                })) : []
            });

            await unit.save();

            console.log('[ImportRenrenDevice] 导入成功', {
                unitId: unit.unitId,
                locationName: unit.locationName
            });

            // 立即通过WebSocket推送新设备信息到所有前端
            websocketService.sendDeviceUpdate(unit.unitId, {
                unitId: unit.unitId,
                locationName: unit.locationName,
                status: unit.status,
                price: unit.price,
                speed: unit.speed,
                outlets: unit.outlets,
                lastHeartbeat: unit.lastHeartbeat,
                newlyImported: true  // 标记为新导入的设备
            });

            // 发送系统通知
            websocketService.sendNotification('success', `设备 ${unit.unitId} 导入成功，已启用实时同步`);

            res.status(200).json({
                success: true,
                message: '设备导入成功，已启用实时同步',
                alreadyExists: false,
                data: unit
            });
        } else {
            console.log('[ImportRenrenDevice] 设备不存在于人人水站', { deviceNo });
            res.status(404).json({
                success: false,
                message: '设备不存在于人人水站系统',
                error: deviceInfo.error || 'Device not found in RenrenWater system'
            });
        }
    } catch (error) {
        console.error('[ImportRenrenDevice] 导入异常', {
            deviceNo: req.body.deviceNo,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: '导入设备失败',
            error: error.message
        });
    }
};
