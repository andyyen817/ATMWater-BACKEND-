const { User, Transaction } = require('../models'); // Stage 1 修复：使用 Sequelize 模型
// ❌ RenrenTransaction 已删除（阶段0：清理人人水站功能）

/**
 * @desc    发起电子卡充值申请 (本地余额更新)
 * @route   POST /api/wallet/topup
 */
exports.createTopUp = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. 验证起充金额 (最小1000 Rp)
        const MIN_AMOUNT = 1000;
        if (amount < MIN_AMOUNT) {
            return res.status(400).json({
                success: false,
                message: `Minimum top up amount is Rp ${new Intl.NumberFormat('id-ID').format(MIN_AMOUNT)}`
            });
        }

        // 2. 生成外部唯一交易号
        const outTradeNo = `TOPUP_${Date.now()}_${userId.toString().slice(-4)}`;

        console.log(`[Wallet TopUp] Processing top-up for user ${userId} with amount ${amount}`);

        // 3. 更新用户本地余额
        const currentBalance = parseFloat(user.balance) || 0;
        const newBalance = currentBalance + amount;
        user.balance = newBalance;
        await user.save();

        // 4. 创建已完成的交易记录
        await Transaction.create({
            userId,
            type: 'TopUp',
            amount,
            externalId: outTradeNo,
            status: 'Completed',
            description: `E-Card Top Up - Rp ${new Intl.NumberFormat('id-ID').format(amount)}`
        });

        console.log(`[Wallet TopUp] Success: User ${userId} topped up ${amount}, new balance: ${newBalance}`);

        return res.status(200).json({
            success: true,
            message: 'Top-up successful!',
            balance: newBalance,
            externalId: outTradeNo
        });

    } catch (error) {
        console.error('[Wallet TopUp] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate top-up' });
    }
};

/**
 * @desc    获取用户余额 (从本地数据库读取)
 * @route   GET /api/wallet/balance
 */
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const balance = parseFloat(user.balance) || 0;
        console.log('[Wallet Balance] User balance:', balance);

        return res.status(200).json({ success: true, balance: balance });
    } catch (error) {
        console.error('[Wallet Balance] Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取交易流水 (从本地数据库读取)
 * @route   GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('[Wallet Transactions] Querying for userId:', req.user.id);

        // ❌ RenrenTransaction 已删除（阶段0：清理人人水站功能）
        // 只返回用户的本地交易记录（TopUp、ReferralReward等）
        const localTransactions = await Transaction.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        console.log('[Wallet Transactions] Found', localTransactions.length, 'local transaction records');

        // 返回本地交易记录
        res.status(200).json({
            success: true,
            data: localTransactions
        });
    } catch (error) {
        console.error('[Wallet Transactions] Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
