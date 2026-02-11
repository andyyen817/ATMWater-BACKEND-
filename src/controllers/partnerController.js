const User = require('../models/User');
const Unit = require('../models/Unit');
const { Op } = require('sequelize');

/**
 * @desc    获取所有 RP 及其关联的管家树状结构
 * @route   GET /api/partners/tree
 */
exports.getPartnerTree = async (req, res) => {
    try {
        // 1. 获取所有 RP
        const rps = await User.findAll({
            where: { role: 'RP' },
            attributes: ['id', 'name', 'phoneNumber', 'balance']
        });

        const partnerTree = await Promise.all(rps.map(async (rp) => {
            // 2. 获取该 RP 旗下的所有设备，用于统计
            const units = await Unit.findAll({
                where: { rpOwner: rp.id }
            });

            // 3. 获取该 RP 管理的所有管家
            const stewards = await User.findAll({
                where: {
                    managedBy: rp.id,
                    role: 'Steward'
                },
                attributes: ['id', 'name', 'phoneNumber']
            });

            // 4. 为每个管家统计数据
            const stewardDetails = await Promise.all(stewards.map(async (steward) => {
                const managedUnits = await Unit.findAll({
                    where: { steward: steward.id },
                    attributes: ['id', 'deviceId', 'location']
                });

                // 模拟合规率 (Compliance) - 实际应根据打卡记录计算
                // 由于 MaintenanceLog 模型可能不存在，暂时设置为固定值
                const compliance = '85.0';

                return {
                    id: steward.id,
                    name: steward.name,
                    phoneNumber: steward.phoneNumber,
                    units: managedUnits.map(u => u.deviceId),
                    compliance
                };
            }));

            return {
                id: rp.id,
                name: rp.name,
                phoneNumber: rp.phoneNumber,
                totalUnits: units.length,
                stewardCount: stewards.length,
                children: stewardDetails  // 前端期望的字段名是 children
            };
        }));

        res.status(200).json({
            success: true,
            data: partnerTree
        });

    } catch (error) {
        console.error('Get Partner Tree Error:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    获取未绑定的管家 (用于分配给 RP)
 * @route   GET /api/partners/unassigned-stewards
 */
exports.getUnassignedStewards = async (req, res) => {
    try {
        const stewards = await User.findAll({
            where: {
                role: 'Steward',
                managedBy: null
            },
            attributes: ['id', 'name', 'phoneNumber']
        });

        res.status(200).json({
            success: true,
            data: stewards
        });
    } catch (error) {
        console.error('Get Unassigned Stewards Error:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    将管家绑定到 RP
 * @route   POST /api/partners/bind
 */
exports.bindSteward = async (req, res) => {
    try {
        const { rpId, stewardId } = req.body;

        const steward = await User.findByPk(stewardId);
        if (!steward || steward.role !== 'Steward') {
            return res.status(404).json({ success: false, message: 'Steward not found' });
        }

        steward.managedBy = rpId;
        await steward.save();

        res.status(200).json({
            success: true,
            message: 'Steward assigned to RP successfully'
        });
    } catch (error) {
        console.error('Bind Steward Error:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    解除管家与 RP 的绑定
 * @route   POST /api/partners/unbind
 */
exports.unbindSteward = async (req, res) => {
    try {
        const { stewardId } = req.body;

        const steward = await User.findByPk(stewardId);
        if (!steward) {
            return res.status(404).json({ success: false, message: 'Steward not found' });
        }

        steward.managedBy = null;
        await steward.save();

        // 同时解除该管家负责的所有设备关联
        await Unit.update(
            { steward: null },
            { where: { steward: stewardId } }
        );

        res.status(200).json({
            success: true,
            message: 'Steward unassigned successfully'
        });
    } catch (error) {
        console.error('Unbind Steward Error:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

