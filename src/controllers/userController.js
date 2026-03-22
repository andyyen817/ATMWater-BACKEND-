const { User, Transaction, PhysicalCard } = require('../models'); // Stage 1 修复：使用 Sequelize 模型
const UserLog = require('../models/UserLog');
const { logAction } = require('../utils/logger');
// ❌ RenrenCard 已删除（阶段0：清理人人水站功能）
// const RenrenCard = require('../models/RenrenCard');
// ❌ renrenWaterService 已删除（阶段0：清理人人水站功能）
// const renrenWaterService = require('../services/renrenWaterService');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

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
        const offset = (parseInt(page) - 1) * parseInt(size);

        // 查询 Transaction 表中 rfid 匹配且属于当前用户的记录
        const { rows, count } = await Transaction.findAndCountAll({
            where: { rfid: cardNo, userId: req.user.id },
            order: [['createdAt', 'DESC']],
            limit: parseInt(size),
            offset
        });

        res.status(200).json({
            success: true,
            data: rows,
            total: count,
            page: parseInt(page)
        });
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
                type: { [Op.in]: ['dispense'] }
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
            attributes: { exclude: ['otp', 'otpExpires', 'password', 'pin'] }
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        // 返回前端期望的字段名（phone 而非 phoneNumber，nickname 优先于 name）
        const data = user.toJSON();
        data.phone = data.phoneNumber || null;
        res.status(200).json({ success: true, data });
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
        const { name, nickname, email } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await user.update({ name, nickname, email });

        // Reload to exclude sensitive fields
        const updatedUser = await User.findByPk(req.user.id, {
            attributes: { exclude: ['otp', 'otpExpires', 'password', 'pin'] }
        });
        const data = updatedUser.toJSON();
        data.phone = data.phoneNumber || null;

        res.status(200).json({
            success: true,
            data
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

/**
 * @desc    上传用户头像
 * @route   POST /api/users/upload-avatar
 */
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const baseUrl = process.env.BASE_URL || 'https://atmwater-backend.zeabur.app';
        const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
        await user.update({ avatar: avatarUrl });

        res.status(200).json({ success: true, data: { avatarUrl } });
    } catch (error) {
        console.error('[uploadAvatar] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    修改密码
 * @route   PUT /api/users/change-password
 */
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'oldPassword and newPassword are required' });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (!user.password) {
            return res.status(400).json({ success: false, message: 'No password set for this account. Please set a password first.' });
        }
        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Old password is incorrect' });
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashed });
        res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('[changePassword] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
