const { User, Transaction, PhysicalCard } = require('../models'); // Stage 1 修复：使用 Sequelize 模型
const UserLog = require('../models/UserLog');
const { logAction } = require('../utils/logger');
// ❌ RenrenCard 已删除（阶段0：清理人人水站功能）
// const RenrenCard = require('../models/RenrenCard');
// ❌ renrenWaterService 已删除（阶段0：清理人人水站功能）
// const renrenWaterService = require('../services/renrenWaterService');
const { Op } = require('sequelize');

/**
 * @desc    获取用户的卡片列表（含余额）
 * @route   GET /api/user/cards
 */
exports.getUserCards = async (req, res) => {
    try {
        // Find all physical cards belonging to the current user
        const cards = await PhysicalCard.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'ASC']]
        });

        // Format response
        const formattedCards = cards.map(card => ({
            id: card.id,
            rfid: card.rfid,
            status: card.status,
            activatedAt: card.activatedAt,
            boundAt: card.boundAt,
            batchId: card.batchId
        }));

        res.status(200).json({
            success: true,
            count: formattedCards.length,
            data: formattedCards
        });
    } catch (error) {
        console.error('[getUserCards] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve cards',
            error: error.message
        });
    }
};

/**
 * @desc    获取用户卡片的交易记录
 * @route   GET /api/user/cards/:cardNo/transactions
 */
exports.getCardTransactions = async (req, res) => {
    try {
        const { cardNo } = req.params;
        const { page = 1, size = 20 } = req.query;

        // 验证卡片是否属于当前用户
        const card = await RenrenCard.findOne({ where: { cardNo, localUserId: req.user.id } });

        if (!card) {
            return res.status(404).json({ success: false, message: 'Card not found' });
        }

        // 从人人水站获取交易记录
        const records = await renrenWaterService.getCardRecords(cardNo, parseInt(page), parseInt(size));

        if (records.success && records.code === 0) {
            const transactions = records.result.list || [];

            res.status(200).json({
                success: true,
                data: transactions.map(t => ({
                    date: t.createTime ? new Date(t.createTime) : new Date(),
                    cash: t.cash || 0,
                    presentCash: t.present_cash || 0,
                    days: t.days || 0,
                    tradePayType: t.tradePayType,
                    remark: t.remark || ''
                })),
                total: records.result.total || 0,
                page: parseInt(page)
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch transactions from Renren Water API',
                data: []
            });
        }
    } catch (error) {
        console.error('[CardTransactions] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error', data: [] });
    }
};

/**
 * @desc    获取用户取水历史
 * @route   GET /api/user/history
 */
exports.getUserHistory = async (req, res) => {
    try {
        const history = await Transaction.findAll({
            where: {
                userId: req.user.id,
                type: { [Op.in]: ['Water-Purchase', 'Dispense'] }
            },
            order: [['createdAt', 'DESC']]
        });

        const formattedHistory = history.map(item => ({
            id: item.id,
            date: item.createdAt,
            unitName: item.metadata?.unitName || 'Water Station',
            volume: item.metadata?.volume || 0,
            waterType: item.metadata?.waterType || 'Pure',
            amount: Math.abs(item.amount)
        }));

        res.status(200).json({ success: true, data: formattedHistory });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取完整的个人资料 (包含地址和银行卡)
 * @route   GET /api/user/profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['otp', 'otpExpires'] }
        });
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    更新用户资料
 * @route   PUT /api/user/profile
 */
exports.updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await user.update({ name, email });

        // Reload to exclude sensitive fields
        const updatedUser = await User.findByPk(req.user.id, {
            attributes: { exclude: ['otp', 'otpExpires'] }
        });

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    添加银行卡
 * @route   POST /api/user/bank-accounts
 */
exports.addBankAccount = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        const { bankName, accountNumber, accountHolder } = req.body;

        // 如果是第一张卡，设为默认
        const isDefault = user.bankAccounts.length === 0;

        user.bankAccounts.push({ bankName, accountNumber, accountHolder, isDefault });
        await user.save();

        res.status(201).json({ success: true, data: user.bankAccounts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    添加收货地址
 * @route   POST /api/user/addresses
 */
exports.addAddress = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        const { label, receiverName, receiverPhone, fullAddress } = req.body;

        const isDefault = user.shippingAddresses.length === 0;

        user.shippingAddresses.push({ label, receiverName, receiverPhone, fullAddress, isDefault });
        await user.save();

        res.status(201).json({ success: true, data: user.shippingAddresses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    删除银行卡
 * @route   DELETE /api/user/bank-accounts/:id
 */
exports.deleteBankAccount = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        user.bankAccounts = user.bankAccounts.filter(acc => acc.id.toString() !== req.params.id);
        await user.save();
        res.status(200).json({ success: true, data: user.bankAccounts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    删除地址
 * @route   DELETE /api/user/addresses/:id
 */
exports.deleteAddress = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        user.shippingAddresses = user.shippingAddresses.filter(addr => addr.id.toString() !== req.params.id);
        await user.save();
        res.status(200).json({ success: true, data: user.shippingAddresses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    上传用户日志
 * @route   POST /api/users/logs/upload
 */
exports.uploadUserLog = async (req, res) => {
    try {
        const userId = req.user.id;
        const { logs, deviceInfo, appVersion } = req.body;

        // 验证必填字段
        if (!logs) {
            return res.status(400).json({
                success: false,
                message: 'Logs are required'
            });
        }

        // 创建UserLog记录
        const userLog = await UserLog.create({
            userId,
            logs: typeof logs === 'string' ? logs : JSON.stringify(logs),
            deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
            appVersion,
            uploadedAt: new Date()
        });

        // 记录审计日志
        await logAction(
            req,
            'user',
            'upload_log',
            {
                logId: userLog.id,
                logCount: Array.isArray(logs) ? logs.length : 1,
                appVersion
            },
            'success'
        );

        res.status(201).json({
            success: true,
            data: { logId: userLog.id },
            message: 'Log uploaded successfully'
        });
    } catch (error) {
        console.error('[uploadUserLog] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to upload log',
            error: error.message
        });
    }
};
