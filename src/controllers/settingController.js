const Setting = require('../models/Setting');
const Permission = require('../models/Permission');
const { logAction } = require('../utils/logger'); // P3-WEB-006

/**
 * @desc    获取水价设置（APP端专用，无需权限）
 * @route   GET /api/settings/water_pricing
 */
exports.getWaterPricing = async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'water_pricing' });

        if (!setting) {
            // 返回默认水价
            return res.status(200).json({
                success: true,
                data: {
                    pure: 400,      // 纯净水 4元/桶
                    mineral: 500    // 矿泉水 5元/桶
                }
            });
        }

        res.status(200).json({
            success: true,
            data: setting.prices || { pure: 400, mineral: 500 }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取所有系统设置
 * @route   GET /api/admin/settings
 */
exports.getSettings = async (req, res) => {
    try {
        const settings = await Setting.find();
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    更新特定设置 (如水价或分润比例)
 * @route   POST /api/admin/settings/:key
 */
exports.updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const updateData = req.body; // 可以包含 prices 或 ratios

        const setting = await Setting.findOneAndUpdate(
            { key },
            { ...updateData, updatedBy: req.user.id },
            { new: true, upsert: true }
        );

        // [P3-WEB-006] 记录审计日志
        await logAction(req, 'Settings', `UPDATE_${key.toUpperCase()}`, { newValue: updateData });

        res.status(200).json({
            success: true,
            message: `Setting ${key} updated successfully`,
            data: setting
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    初始化系统默认设置 (用于首次启动)
 */
exports.seedSettings = async () => {
    try {
        // 1. 初始化基础设置
        const defaultSettings = [
            {
                key: 'water_pricing',
                prices: { pure: 400, mineral: 500 },
                ratios: {
                    airkop: 40,
                    rp: 40,
                    steward: 15,
                    growthFund: 5
                },
                adRatios: {
                    airkop: 70,
                    rp: 10,
                    steward: 10,
                    growthFund: 10
                },
                maintenanceFees: {
                    standard: 500000,
                    enhanced: 800000,
                    tdsThreshold: 300,
                    phThreshold: 6.5
                },
                softwareFee: 200000
            }
        ];

        for (const s of defaultSettings) {
            await Setting.updateOne(
                { key: s.key },
                { $setOnInsert: s },
                { upsert: true }
            );
            console.log(`[Settings] Ensured default setting exists: ${s.key}`);
        }

        // 2. 初始化权限矩阵 (P1-WEB-001)
        const defaultPermissions = [
            { 
                functionKey: 'view_dashboard', 
                label: 'View Dashboard & KPIs',
                permissions: { GM: true, Finance: true, Business: true, AfterSales: true }
            },
            { 
                functionKey: 'manage_units', 
                label: 'Manage Unit Lock/Unlock',
                permissions: { GM: true, Finance: false, Business: false, AfterSales: false }
            },
            { 
                functionKey: 'edit_prices', 
                label: 'Edit Water Prices (水价设置)',
                permissions: { GM: true, Finance: false, Business: false, AfterSales: false }
            },
            { 
                functionKey: 'approve_withdrawals', 
                label: 'Approve Withdrawal (提现审核)',
                permissions: { GM: true, Finance: true, Business: false, AfterSales: false }
            },
            { 
                functionKey: 'manage_partners', 
                label: 'Manage Steward & RP Bindings',
                permissions: { GM: true, Finance: false, Business: true, AfterSales: false }
            },
            { 
                functionKey: 'view_logs', 
                label: 'View Technical/Quality Logs',
                permissions: { GM: true, Finance: false, Business: false, AfterSales: true }
            }
        ];

        for (const p of defaultPermissions) {
            await Permission.updateOne(
                { functionKey: p.functionKey },
                { $setOnInsert: p },
                { upsert: true }
            );
        }
        console.log(`[Permissions] Initialized default permission matrix`);

    } catch (error) {
        console.error('Seed Settings Error:', error);
    }
};

