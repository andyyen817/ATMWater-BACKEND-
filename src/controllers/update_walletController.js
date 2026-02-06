const Transaction = require('../models/Transaction');  
const User = require('../models/User');  
const xenditService = require('../services/xenditService');

/**
 * @desc    正式发起充值申请 (对接 Xendit)
 * @route   POST /api/wallet/topup
 */
exports.createTopUp = async (req, res) => {
    try {
        const { amount, payerEmail } = req.body;
        const userId = req.user.id; 
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. 验证起充金额
        const MIN_AMOUNT = 10000; // 正式环境下通常设为 10,000 Rp
        if (amount < MIN_AMOUNT) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum top up amount is Rp ${new Intl.NumberFormat('id-ID').format(MIN_AMOUNT)}` 
            });
        }

        // 2. 创建外部唯一 ID
        const externalId = `TOPUP_${Date.now()}_${userId.toString().slice(-4)}`;

        // 3. 调用 Xendit 创建发票
        const xenditResult = await xenditService.createInvoice(
            externalId,
            amount,
            payerEmail || user.email,
            `AirKOP Wallet Top Up - ${user.phoneNumber}`
        );

        if (!xenditResult.success) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to initiate payment with Xendit',
                error: xenditResult.message
            });
        }

        // 4. 创建 Pending 状态的交易记录
        await Transaction.create({
            userId,
            type: 'TopUp',
            amount,
            externalId,
            status: 'Pending',
            description: `AirKOP Wallet Top Up via Xendit`
        });

        res.status(200).json({
            success: true,
            data: {
                invoiceUrl: xenditResult.data.invoiceUrl,
                externalId: externalId,
                amount: amount
            }
        });

    } catch (error) {
        console.error('Initiate Top-up Error:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate top-up' });
    }
};

/**
 * @desc    发起充值申请 (调试用：直接到账)
 * @route   POST /api/wallet/debug-topup
 */
exports.debugTopUp = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id; 

        // 1. 验证起充金额 (保持逻辑，但允许更小金额测试)
        const MIN_AMOUNT = 1000; // 调试阶段允许小额
        if (amount < MIN_AMOUNT) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum top up amount for debugging is Rp ${new Intl.NumberFormat('id-ID').format(MIN_AMOUNT)}` 
            });
        }

        // 2. 直接更新用户余额 (绕过 Xendit)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.balance += amount;

        // 处理首次充值推荐逻辑 (可选，为了保持逻辑完整性)
        if (!user.isFirstTopUpDone && amount >= 300000) {
            user.isFirstTopUpDone = true;
            if (user.managedBy) {
                const REWARD_AMOUNT = 40000;
                user.balance += REWARD_AMOUNT;
                await Transaction.create({
                    userId: user._id,
                    amount: REWARD_AMOUNT,
                    type: 'ReferralReward',
                    status: 'Completed',
                    description: 'Welcome Bonus (Simulated)'
                });

                const referrer = await User.findById(user.managedBy);
                if (referrer) {
                    referrer.balance += REWARD_AMOUNT;
                    await referrer.save();
                    await Transaction.create({
                        userId: referrer._id,
                        amount: REWARD_AMOUNT,
                        type: 'ReferralReward',
                        status: 'Completed',
                        description: `Referral Bonus for inviting ${user.phoneNumber}`
                    });
                }
            }
        }

        await user.save();

        // 3. 创建已完成的交易记录
        const externalId = `DEBUG_TOPUP_${Date.now()}_${userId.toString().slice(-4)}`;
        await Transaction.create({
            userId,
            type: 'TopUp',
            amount,
            externalId,
            status: 'Completed',
            description: `AirKOP Wallet Top Up (DEBUG MODE) - Rp ${amount}`
        });

        res.status(200).json({
            success: true,
            message: 'Debug Top-up successful! Balance updated.',
            balance: user.balance,
            externalId: externalId
        });

    } catch (error) {
        console.error('Debug Top-up Error:', error);
        res.status(500).json({ success: false, message: 'Failed to process debug top-up' });
    }
};

/**
 * @desc    获取用户余额
 * @route   GET /api/wallet/balance
 */
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('balance');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, balance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取交易流水 (用户视角)
 * @route   GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    接收 Xendit 支付回调 (Webhook) [P1-API-003]
 */
exports.handleWebhook = async (req, res) => {
    try {
        const { external_id, amount, status, id: invoiceId } = req.body;
        const xenditToken = req.headers['x-callback-token'];

        // 1. 安全验证 (可选，验证 Xendit 的 Webhook Token)
        if (process.env.XENDIT_WEBHOOK_TOKEN && xenditToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
            console.warn('[Xendit Webhook] Unauthorized callback attempt');
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        console.log(`[Xendit Webhook] Received status ${status} for ${external_id}, invoice: ${invoiceId}`);

        if (status === 'PAID' || status === 'SETTLED') {
            // 2. 查找对应的 Pending 交易记录
            let transaction = await Transaction.findOne({ externalId: external_id });
            
            if (transaction && transaction.status === 'Pending') {
                const user = await User.findById(transaction.userId);
                if (user) {
                    // 3. 更新用户余额
                    user.balance += amount;
                    
                    // 4. 处理首次充值推荐逻辑
                    if (!user.isFirstTopUpDone && amount >= 300000) {
                        user.isFirstTopUpDone = true;
                        
                        // 给自己奖励 (例如 100L 等值的 40,000 Rp)
                        const REWARD_AMOUNT = 40000;
                        user.balance += REWARD_AMOUNT;
                        await Transaction.create({
                            userId: user._id,
                            amount: REWARD_AMOUNT,
                            type: 'ReferralReward',
                            status: 'Completed',
                            description: 'First Top-up Bonus (100L equivalent)'
                        });

                        // 给推荐人奖励
                        if (user.managedBy) {
                            const referrer = await User.findById(user.managedBy);
                            if (referrer) {
                                referrer.balance += REWARD_AMOUNT;
                                await referrer.save();
                                await Transaction.create({
                                    userId: referrer._id,
                                    amount: REWARD_AMOUNT,
                                    type: 'ReferralReward',
                                    status: 'Completed',
                                    description: `Referral Bonus for inviting ${user.phoneNumber}`
                                });
                            }
                        }
                    }

                    await user.save();
                    transaction.status = 'Completed';
                    transaction.metadata = { invoiceId }; // 记录 Xendit 发票 ID
                    await transaction.save();
                    
                    console.log(`[Xendit Success] User ${user.phoneNumber} account topped up Rp ${amount}.`);
                }
            } else if (transaction && transaction.status === 'Completed') {
                console.log(`[Xendit Webhook] Transaction ${external_id} already completed.`);
            } else {
                console.warn(`[Xendit Warning] Unknown or invalid transaction state: ${external_id}`);
            }
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Xendit Webhook Error:', error);
        res.status(500).json({ success: false });
    }
};
