const { User, Transaction } = require('../models');

const FREE_WATER_BONUS = 1750; // 5 桶水 × 350 水币/桶
const CASHBACK_RATE = 0.05;   // 5% 返现

/**
 * 检查并发放首次充值邀请奖励（双方各得 1750 水币）
 * 内部函数，由 walletController.createTopUp 调用
 * @param {number} userId - 充值用户 ID
 * @param {object} [t] - Sequelize 事务对象（可选）
 */
async function checkAndGrantInviteBonus(userId, t) {
    try {
        const user = await User.findByPk(userId);
        if (!user || !user.referredBy) return;

        // 检查是否已有历史 topup（本次充值已 save，所以 count >= 1 表示本次是第一笔）
        const topupCount = await Transaction.count({
            where: { userId, type: 'topup' },
            ...(t ? { transaction: t } : {})
        });
        // 如果不是第一笔充值，跳过
        if (topupCount !== 1) return;

        // 查找推荐人
        const referrer = await User.findOne({
            where: { referralCode: user.referredBy },
            ...(t ? { transaction: t } : {})
        });
        if (!referrer) return;

        // 给被邀请人发放奖励
        const inviteeBefore = parseFloat(user.balance) || 0;
        user.balance = inviteeBefore + FREE_WATER_BONUS;
        await user.save(t ? { transaction: t } : {});
        await Transaction.create({
            userId: user.id,
            type: 'referral_reward',
            amount: FREE_WATER_BONUS,
            balanceBefore: inviteeBefore,
            balanceAfter: user.balance,
            status: 'Completed',
            description: `Welcome bonus: 5 buckets free water (invited by ${referrer.name || referrer.phoneNumber || referrer.email})`
        }, t ? { transaction: t } : {});

        // 给推荐人发放奖励
        const referrerBefore = parseFloat(referrer.balance) || 0;
        referrer.balance = referrerBefore + FREE_WATER_BONUS;
        await referrer.save(t ? { transaction: t } : {});
        await Transaction.create({
            userId: referrer.id,
            type: 'referral_reward',
            amount: FREE_WATER_BONUS,
            balanceBefore: referrerBefore,
            balanceAfter: referrer.balance,
            status: 'Completed',
            description: `Invite bonus: ${user.name || user.phoneNumber || user.email} completed first top-up`
        }, t ? { transaction: t } : {});

        console.log(`[Referral] Invite bonus granted: user ${userId} & referrer ${referrer.id} each got ${FREE_WATER_BONUS} coins`);
    } catch (err) {
        console.error('[Referral] checkAndGrantInviteBonus error:', err);
    }
}
/**
 * 给推荐人发放充值返现（5%）
 * 内部函数，由 walletController.createTopUp 调用
 * @param {number} userId - 充值用户 ID
 * @param {number} topupAmount - 充值金额
 * @param {object} [t] - Sequelize 事务对象（可选）
 */
async function grantCashbackToReferrer(userId, topupAmount, t) {
    try {
        const user = await User.findByPk(userId);
        if (!user || !user.referredBy) return;

        const referrer = await User.findOne({
            where: { referralCode: user.referredBy },
            ...(t ? { transaction: t } : {})
        });
        if (!referrer) return;

        const cashback = Math.floor(topupAmount * CASHBACK_RATE);
        if (cashback <= 0) return;

        const referrerBefore = parseFloat(referrer.balance) || 0;
        referrer.balance = referrerBefore + cashback;
        await referrer.save(t ? { transaction: t } : {});
        await Transaction.create({
            userId: referrer.id,
            type: 'referral_reward',
            amount: cashback,
            balanceBefore: referrerBefore,
            balanceAfter: referrer.balance,
            status: 'Completed',
            description: `Cashback 5% from ${user.name || user.phoneNumber || user.email} top-up of ${topupAmount}`
        }, t ? { transaction: t } : {});

        console.log(`[Referral] Cashback ${cashback} coins granted to referrer ${referrer.id} from user ${userId} topup ${topupAmount}`);
    } catch (err) {
        console.error('[Referral] grantCashbackToReferrer error:', err);
    }
}

/**
 * @desc    获取用户的推荐数据
 * @route   GET /api/referral/stats
 */
exports.getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId, { attributes: ['id', 'referralCode'] });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // 查找我邀请的人
        const invitees = await User.findAll({
            where: { referredBy: user.referralCode },
            attributes: ['id', 'name', 'phoneNumber', 'email', 'createdAt']
        });

        // 每个被邀请人：是否已完成首次充值
        const inviteeData = await Promise.all(invitees.map(async (inv) => {
            const topupCount = await Transaction.count({ where: { userId: inv.id, type: 'topup' } });
            const cashbackSum = await Transaction.sum('amount', {
                where: {
                    userId,
                    type: 'referral_reward',
                    description: { [require('sequelize').Op.like]: `%${inv.name || inv.phoneNumber || inv.email}%` }
                }
            }) || 0;
            return {
                id: inv.id,
                name: inv.name || null,
                phone: inv.phoneNumber ? inv.phoneNumber.slice(-4) : null,
                email: inv.email || null,
                isActive: topupCount > 0,
                joinedAt: inv.createdAt,
                cashbackContributed: cashbackSum
            };
        }));

        // 我总共获得的推荐奖励
        const totalCashback = await Transaction.sum('amount', {
            where: { userId, type: 'referral_reward' }
        }) || 0;

        res.status(200).json({
            success: true,
            data: {
                referralCode: user.referralCode,
                inviteCount: invitees.length,
                successCount: inviteeData.filter(i => i.isActive).length,
                totalCashback,
                invitees: inviteeData
            }
        });
    } catch (error) {
        console.error('[Referral] getReferralStats error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.checkAndGrantInviteBonus = checkAndGrantInviteBonus;
exports.grantCashbackToReferrer = grantCashbackToReferrer;

