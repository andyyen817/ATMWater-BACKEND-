const Transaction = require('../models/Transaction');
const User = require('../models/User');
const RenrenTransaction = require('../models/RenrenTransaction');
const renrenWaterService = require('../services/renrenWaterService');

/**
 * @desc    发起电子卡充值申请 (对接人人水站API)
 * @route   POST /api/wallet/topup
 */
exports.createTopUp = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;
        const user = await User.findById(userId);

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

        // 3. 获取用户的电子卡号 (手机号格式化为11位)
        // 电子卡号格式: 去掉国家码的手机号，如08123456789
        let ecardNo = user.phoneNumber;
        // 如果有+86或+62等前缀，去掉后加上0
        if (ecardNo.startsWith('+86')) {
            ecardNo = '0' + ecardNo.substring(3);
        } else if (ecardNo.startsWith('+62')) {
            ecardNo = '0' + ecardNo.substring(3);
        }
        // 确保是11位数字
        if (ecardNo.length < 11 && ecardNo.startsWith('0')) {
            // 如果不足11位，需要补充（根据实际手机号格式）
            // 印尼手机号: 08xxxxxxxxx (11-12位)
            // 这里假设已经是正确格式
        }

        console.log(`[Wallet TopUp] Charging e-card ${ecardNo} with amount ${amount}`);

        // 4. 调用人人水站电子卡充值接口
        const renrenResult = await renrenWaterService.chargeEcard(
            outTradeNo,
            ecardNo,
            amount,      // 充值金额（分）
            0,           // 赠送金额（分），暂不赠送
            0,           // 有效天数，暂不延长
            'APP Top Up' // 备注
        );

        if (renrenResult.result !== 1 && renrenResult.result !== '1') {
            console.error('[Wallet TopUp] Renren Water API failed:', renrenResult);
            return res.status(500).json({
                success: false,
                message: 'Failed to charge e-card via Renren Water API',
                error: renrenResult.errmsg || 'Unknown error'
            });
        }

        // 5. 更新用户本地余额 (从人人水站返回的余额)
        const newBalance = renrenResult.balance || renrenResult.data?.balance || 0;
        user.balance = newBalance;
        await user.save();

        // 6. 创建已完成的交易记录
        await Transaction.create({
            userId,
            type: 'TopUp',
            amount,
            externalId: outTradeNo,
            status: 'Completed',
            description: `E-Card Top Up - Rp ${new Intl.NumberFormat('id-ID').format(amount)}`
        });

        console.log(`[Wallet TopUp] Success: ${ecardNo} charged with ${amount}, new balance: ${newBalance}`);

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
 * @desc    获取用户余额 (从人人水站API实时获取)
 * @route   GET /api/wallet/balance
 */
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 构建所有可能的电子卡号格式
        const phoneNumber = user.phoneNumber;
        const possibleCardNos = [phoneNumber];

        // 处理印尼手机号 (+62)
        if (phoneNumber.startsWith('+62')) {
            possibleCardNos.push('0' + phoneNumber.substring(3)); // +6281... -> 081...
        }
        // 处理中国手机号 (+86)
        else if (phoneNumber.startsWith('+86')) {
            possibleCardNos.push('0' + phoneNumber.substring(3)); // +8613... -> 013...
        }
        // 如果已经是 08 开头的印尼格式
        else if (phoneNumber.startsWith('08')) {
            possibleCardNos.push('+62' + phoneNumber.substring(1)); // 081... -> +6281...
        }

        console.log('[Wallet Balance] Trying cardNos:', possibleCardNos);

        // 尝试从人人水站获取实时余额（尝试多种格式）
        for (const ecardNo of possibleCardNos) {
            try {
                console.log('[Wallet Balance] Trying ecard:', ecardNo);
                const ecardInfo = await renrenWaterService.getEcardInfo(ecardNo);
                if (ecardInfo.result === 1 || ecardInfo.result === '1') {
                    const realBalance = ecardInfo.balance || 0;

                    // 同步更新本地余额
                    user.balance = realBalance;
                    await user.save();

                    console.log('[Wallet Balance] Got balance from Renren Water:', realBalance, 'using cardNo:', ecardNo);
                    return res.status(200).json({ success: true, balance: realBalance });
                }
            } catch (apiError) {
                console.log('[Wallet Balance] Failed for', ecardNo, ':', apiError.message);
                // 继续尝试下一个格式
            }
        }

        // 所有API调用都失败时返回本地缓存的余额
        console.log('[Wallet Balance] Using local balance:', user.balance);
        return res.status(200).json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('[Wallet Balance] Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取交易流水 (从 RenrenTransaction 集合读取实时保存的交易数据)
 * @route   GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 构建所有可能的手机号格式用于查询
        // 人人水站电子卡号可能是: 08xxxxxxxxx (11位), +628xxxxxxxxx, 或其他格式
        const phoneNumber = user.phoneNumber;
        const possibleCardNos = [phoneNumber];

        // 处理印尼手机号 (+62)
        if (phoneNumber.startsWith('+62')) {
            possibleCardNos.push('0' + phoneNumber.substring(3)); // +6281... -> 081...
        }
        // 处理中国手机号 (+86)
        else if (phoneNumber.startsWith('+86')) {
            possibleCardNos.push('0' + phoneNumber.substring(3)); // +8613... -> 013...
        }
        // 如果已经是 08 开头的印尼格式
        else if (phoneNumber.startsWith('08')) {
            possibleCardNos.push('+62' + phoneNumber.substring(1)); // 081... -> +6281...
        }
        // 如果已经是 01 开头的格式
        else if (phoneNumber.startsWith('01')) {
            possibleCardNos.push('+86' + phoneNumber.substring(1)); // 013... -> +8613...
        }

        console.log('[Wallet Transactions] Querying for cardNos:', possibleCardNos);

        // 从 RenrenTransaction 集合查询该电子卡的所有交易记录
        // 这些记录是通过 /api/iot/callback 实时推送保存的
        const renrenTransactions = await RenrenTransaction.find({
            cardNo: { $in: possibleCardNos }
        })
        .sort({ waterTime: -1 })
        .limit(100);

        console.log('[Wallet Transactions] Found', renrenTransactions.length, 'RenrenTransaction records');

        // 同时获取用户的本地交易记录（TopUp、ReferralReward等）
        const localTransactions = await Transaction.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        // 合并并格式化返回
        res.status(200).json({
            success: true,
            data: {
                renren: renrenTransactions,
                local: localTransactions
            }
        });
    } catch (error) {
        console.error('[Wallet Transactions] Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
