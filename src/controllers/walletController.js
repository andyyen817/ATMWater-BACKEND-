const { User, Transaction } = require('../models'); // Stage 1 修复：使用 Sequelize 模型
// ❌ RenrenTransaction 已删除（阶段0：清理人人水站功能）
const { checkAndGrantInviteBonus, grantCashbackToReferrer } = require('./referralController');

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

        // 3.5 裂变奖励（不阻断主流程）
        await checkAndGrantInviteBonus(userId);
        await grantCashbackToReferrer(userId, amount);

        // 4. 创建已完成的交易记录 - 标记为App充值水币
        await Transaction.create({
            userId,
            type: 'topup',
            amount,
            balanceType: 'APP_BACKED', // 标记为App充值
            profitShared: false, // 待出水时分账
            externalId: outTradeNo,
            status: 'Completed',
            description: `Water Coin Purchase - 💧 ${new Intl.NumberFormat('id-ID').format(amount)}`
        });

        console.log(`[Wallet TopUp] Success: User ${userId} purchased ${amount} Water Coins, new balance: ${newBalance}`);

        return res.status(200).json({
            success: true,
            message: `Successfully purchased 💧 ${new Intl.NumberFormat('id-ID').format(amount)} Water Coins!`,
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
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'balance', 'phone', 'name']
        });

        if (!user) {
            console.error(`[Wallet Balance] User not found: ${req.user.id}`);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const balance = parseFloat(user.balance) || 0;

        console.log(`[Wallet Balance] User ${req.user.id} (${user.phone}) balance: ${balance}`);

        return res.status(200).json({
            success: true,
            data: {
                balance: balance,
                currency: 'IDR'
            }
        });
    } catch (error) {
        console.error('[Wallet Balance] Error:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

/**
 * @desc    获取交易流水 (从本地数据库读取)
 * @route   GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const where = { userId: req.user.id };
        if (type) where.type = type;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        console.log('[Wallet Transactions] Querying for userId:', req.user.id, '| type:', type || 'all', '| page:', page);

        const { rows, count } = await Transaction.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        // 字段标准化映射，统一前后端字段名
        const statusMap = { Completed: 'success', Pending: 'pending', Failed: 'failed', Cancelled: 'failed' };
        const formatted = rows.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: parseFloat(tx.amount),
            balance: tx.balanceAfter != null ? parseFloat(tx.balanceAfter) : null,
            volume: tx.volume != null ? parseFloat(tx.volume) : null,
            balanceType: tx.balanceType,
            status: statusMap[tx.status] || tx.status.toLowerCase(),
            description: tx.description,
            createdAt: tx.createdAt,
            rfid: tx.rfid,                    // 新增：返回RFID卡号（虚拟卡或物理卡）
            cardType: tx.cardType             // 新增：返回卡片类型（Virtual/Physical）
        }));

        console.log('[Wallet Transactions] Found', count, 'records, returning page', page);

        res.status(200).json({
            success: true,
            data: formatted,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('[Wallet Transactions] Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
