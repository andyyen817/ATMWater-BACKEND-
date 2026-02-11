const Unit = require('../models/Unit');
const User = require('../models/User');
const Permission = require('../models/Permission');
const hardwareService = require('../services/hardwareService');
const renrenWaterService = require('../services/renrenWaterService');
const websocketService = require('../services/websocketService');
// const completeDataSyncService = require('../services/completeDataSyncService'); // 暂时注释，因为依赖mongoose

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
        let user = await User.findOne({ phoneNumber });
        if (user) {
            return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
        }

        // 2. 检查唯一性限制 (Super-Admin 和 Admin 全局仅限 1 位)
        if (role === 'Super-Admin' || role === 'Admin') {
            const existing = await User.findOne({ role });
            if (existing) {
                return res.status(400).json({ success: false, message: `Only one ${role} is allowed in the system.` });
            }
        }

        // 3. 生成推荐码 (如果是 RP 或 Steward 可能需要)
        const crypto = require('crypto');
        const referralCode = crypto.randomBytes(3).toString('hex').toUpperCase();

        // 4. 创建用户
        user = await User.create({
            phoneNumber,
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
 * @desc    获取所有用户列表 (支持按角色过滤)
 * @route   GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const query = {};
        
        // 如果传入了角色过滤参数
        if (role && role !== 'All') {
            query.role = role;
        }

        const users = await User.find(query).sort({ createdAt: -1 }).select('-otp -otpExpires');
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
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
            const existing = await User.findOne({ role });
            if (existing && existing._id.toString() !== req.params.id) {
                return res.status(400).json({ success: false, message: `Only one ${role} is allowed in the system.` });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true, runValidators: true }
        ).select('-otp -otpExpires');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

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
 * @desc    获取权限矩阵
 * @route   GET /api/admin/permissions
 */
exports.getPermissions = async (req, res) => {
    try {
        const permissions = await Permission.find();
        res.status(200).json({
            success: true,
            data: permissions
        });
    } catch (error) {
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
            await Permission.findOneAndUpdate(
                { functionKey: item.functionKey },
                { 
                    permissions: item.permissions,
                    // 如果前端传了 label 则更新，否则保持原样
                    ...(item.label && { label: item.label })
                },
                { upsert: true, new: true }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Permissions updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取单个设备详情
 * @route   GET /api/admin/units/:id
 */
exports.getUnitDetail = async (req, res) => {
    try {
        const unit = await Unit.findById(req.params.id)
            .populate('rpOwner', 'name phoneNumber')
            .populate('steward', 'name phoneNumber');

        if (!unit) {
            return res.status(404).json({ success: false, message: 'Unit not found' });
        }

        res.status(200).json({
            success: true,
            data: unit
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
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
        const units = await Unit.findAll({
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
