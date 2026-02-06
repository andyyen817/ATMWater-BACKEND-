const RenrenCard = require('../models/RenrenCard');
const CardBatch = require('../models/CardBatch');
const renrenWaterService = require('../services/renrenWaterService');
const cardSyncService = require('../services/cardSyncService');
const websocketService = require('../services/websocketService');
const logger = require('../utils/logger');

// 简单的日志包装函数
const logInfo = (message, data = {}) => console.log(`[INFO] ${message}`, data);
const logError = (message, data = {}) => console.error(`[ERROR] ${message}`, data);

/**
 * @desc    获取所有卡片列表
 * @route   GET /api/renren-cards
 */
exports.getAllCards = async (req, res) => {
    try {
        console.log('[RenrenCard API] getAllCards called');
        console.log('[RenrenCard API] Query params:', req.query);
        console.log('[RenrenCard API] Method:', req.method);
        console.log('[RenrenCard API] URL:', req.url);
        console.log('[RenrenCard API] Headers:', req.headers.authorization?.substring(0, 30) + '...');

        const { page = 1, limit = 50, valid, search } = req.query;

        const query = {};
        if (valid !== undefined) query.valid = parseInt(valid);
        if (search) {
            query.$or = [
                { cardNo: { $regex: search, $options: 'i' } },
                { userPhone: { $regex: search, $options: 'i' } },
                { userName: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('[RenrenCard API] Database query:', query);

        const cards = await RenrenCard.find(query)
            .sort({ updateTime: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await RenrenCard.countDocuments(query);

        console.log('[RenrenCard API] Found cards:', cards.length);

        res.status(200).json({
            success: true,
            data: cards,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('[RenrenCard API] Error:', error.message);
        console.error('[RenrenCard API] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    获取单个卡片详情
 * @route   GET /api/renren-cards/:cardNo
 */
exports.getCardByNo = async (req, res) => {
    try {
        const { cardNo } = req.params;

        const card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        res.status(200).json({
            success: true,
            data: card
        });
    } catch (error) {
        console.error('[RenrenCard API] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    从人人水站导入卡片（检查存在性后导入）
 * @route   POST /api/renren-cards/import
 */
exports.importRenrenCard = async (req, res) => {
    try {
        const { cardNo } = req.body;

        if (!cardNo) {
            return res.status(400).json({
                success: false,
                message: '卡号不能为空'
            });
        }

        logInfo('[ImportRenrenCard] 收到导入请求', { cardNo });

        // 先检查卡片是否已在本地数据库中
        const existingCard = await RenrenCard.findOne({ cardNo });
        if (existingCard) {
            return res.status(200).json({
                success: true,
                message: '卡片已存在于本地数据库',
                alreadyExists: true,
                data: existingCard
            });
        }

        // 调用人人水站API检查卡片是否存在
        const cardInfo = await renrenWaterService.getCardInfo(cardNo);

        if (cardInfo.success && cardInfo.code === 0) {
            const result = cardInfo.result;

            // 创建新卡片记录
            const card = new RenrenCard({
                cardNo: result.card_no || cardNo,
                balance: result.balance || 0,
                realBalance: result.real_balance || result.balance || 0,
                presentCash: result.present_cash || 0,
                valid: result.valid || 1,
                isBlack: result.is_black === 1,
                operatorName: result.operator_name || '',
                userPhone: result.user_phone || '',
                userName: result.user_name || '',
                remark: result.remark || '',
                groupId: result.group_id || '',
                unsyncCash: result.unsync_cash || 0,
                createTime: result.create_time ? new Date(result.create_time) : new Date(),
                updateTime: result.update_time ? new Date(result.update_time) : new Date(),
                lastSyncTime: new Date(),
                // 添加同步历史记录
                syncHistory: [{
                    syncTime: new Date(),
                    syncType: 'create',
                    balanceBefore: 0,
                    balanceAfter: result.balance || 0,
                    realBalanceBefore: 0,
                    realBalanceAfter: result.real_balance || result.balance || 0,
                    amount: 0,
                    remark: '从人人水站导入'
                }]
            });

            await card.save();

            logInfo('[ImportRenrenCard] 导入成功', {
                cardNo: card.cardNo,
                balance: card.balance
            });

            // 立即通过WebSocket推送新卡片信息到所有前端
            websocketService.sendCardUpdate(card.cardNo, {
                cardNo: card.cardNo,
                balance: card.balance,
                realBalance: card.realBalance,
                presentCash: card.presentCash,
                valid: card.valid,
                userName: card.userName,
                userPhone: card.userPhone,
                lastSyncTime: card.lastSyncTime,
                newlyImported: true  // 标记为新导入的卡片
            });

            // 发送系统通知
            websocketService.sendNotification('success', `卡片 ${card.cardNo} 导入成功，已启用实时同步`);

            res.status(200).json({
                success: true,
                message: '卡片导入成功，已启用实时同步',
                alreadyExists: false,
                data: card
            });
        } else {
            logInfo('[ImportRenrenCard] 卡片不存在于人人水站', { cardNo });
            res.status(404).json({
                success: false,
                message: '卡片不存在于人人水站',
                error: cardInfo.error || 'Card not found in RenrenWater system'
            });
        }
    } catch (error) {
        logError('[ImportRenrenCard] 导入异常', {
            cardNo: req.body.cardNo,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: '导入卡片失败',
            error: error.message
        });
    }
};

/**
 * @desc    从人人水站同步单个卡片
 * @route   POST /api/renren-cards/sync/:cardNo
 */
exports.syncCard = async (req, res) => {
    try {
        const { cardNo } = req.params;

        const cardInfo = await renrenWaterService.getCardInfo(cardNo);

        if (cardInfo.success && cardInfo.code === 0) {
            const result = cardInfo.result;

            let card = await RenrenCard.findOne({ cardNo });

            if (!card) {
                // 创建新卡片记录
                card = new RenrenCard({
                    cardNo: result.card_no || cardNo,
                    balance: result.balance,
                    realBalance: result.real_balance,
                    presentCash: result.present_cash || 0,
                    valid: result.valid,
                    isBlack: result.is_black === 1,
                    operatorName: result.operator_name || '',
                    userPhone: result.user_phone || '',
                    userName: result.user_name || '',
                    remark: result.remark || '',
                    groupId: result.group_id || '',
                    unsyncCash: result.unsync_cash || 0,
                    createTime: result.create_time ? new Date(result.create_time) : new Date(),
                    updateTime: result.update_time ? new Date(result.update_time) : new Date()
                });
            } else {
                // 更新现有卡片
                card.balance = result.balance;
                card.realBalance = result.real_balance;
                card.valid = result.valid;
                card.isBlack = result.is_black === 1;
                card.operatorName = result.operator_name || '';
                card.userPhone = result.user_phone || '';
                card.userName = result.user_name || '';
                card.remark = result.remark || '';
                card.groupId = result.group_id || '';
                card.unsyncCash = result.unsync_cash || 0;
                if (result.update_time) {
                    card.updateTime = new Date(result.update_time);
                }
                card.lastSyncTime = new Date();
            }

            await card.save();

            res.status(200).json({
                success: true,
                message: 'Card synced successfully',
                data: card
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to sync card from RenrenWater API',
                error: cardInfo.error || 'Unknown error'
            });
        }
    } catch (error) {
        console.error('[RenrenCard API] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    创建电子卡（首次注册时使用）
 * @route   POST /api/renren-cards/create-ecard
 * @access  Private (所有登录用户)
 */
exports.createEcard = async (req, res) => {
    try {
        const { device_no, cash, present_cash, days, user_name } = req.body;
        const userId = req.user._id;

        logInfo('[CreateEcard] 收到创建电子卡请求', {
            device_no,
            cash,
            present_cash,
            days,
            user_name,
            userId
        });

        // 参数验证
        if (!device_no) {
            return res.status(400).json({
                success: false,
                message: '设备号不能为空'
            });
        }

        if (!cash || cash < 100) {
            return res.status(400).json({
                success: false,
                message: '充值金额不能少于 100 分 (1元)'
            });
        }

        // 获取用户手机号作为电子卡号
        const User = require('../models/User');
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 处理手机号：移除 + 前缀
        let cardNo = user.phoneNumber;
        if (cardNo.startsWith('+62')) {
            cardNo = cardNo.substring(3);
        } else if (cardNo.startsWith('+86')) {
            cardNo = cardNo.substring(3);
        }

        // 验证是否为11位数字
        if (!/^[0-9]{11}$/.test(cardNo)) {
            return res.status(400).json({
                success: false,
                message: '手机号格式错误，电子卡号必须是11位数字'
            });
        }

        logInfo('[CreateEcard] 处理后的卡号:', { cardNo });

        // 调用人人水站API创建电子卡
        const result = await renrenWaterService.createEcard(
            cardNo,
            device_no,
            cash || 0,
            present_cash || 0,
            days || 0,
            user_name || cardNo,  // 默认使用手机号作为用户名
            '',  // remark
            ''   // group_id
        );

        logInfo('[CreateEcard] 人人水站API返回:', {
            success: result.success,
            code: result.code,
            error: result.error
        });

        if (result.success && result.code === 0) {
            // 等待1秒让人人水站处理完毕
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 同步电子卡信息到本地数据库
            const syncResult = await renrenWaterService.getEcardInfo(cardNo);

            if (syncResult.success && syncResult.code === 0) {
                const ecardInfo = syncResult.result;

                // 检查本地是否已有记录
                let existingCard = await RenrenCard.findOne({ cardNo });

                if (!existingCard) {
                    // 创建新的本地记录
                    existingCard = new RenrenCard({
                        cardNo: cardNo,
                        balance: ecardInfo.balance || 0,
                        realBalance: ecardInfo.balance || 0,
                        presentCash: ecardInfo.present_cash || 0,
                        valid: 1,
                        isBlack: false,
                        userPhone: cardNo,
                        userName: user_name || cardNo,
                        remark: ecardInfo.remark || '',
                        groupId: ecardInfo.group_id || '',
                        deviceNo: device_no,  // 记录开通设备
                        localUserId: userId,
                        createTime: ecardInfo.create_time ? new Date(ecardInfo.create_time) : new Date(),
                        updateTime: ecardInfo.update_time ? new Date(ecardInfo.update_time) : new Date(),
                        lastSyncTime: new Date()
                    });
                } else {
                    // 更新现有记录
                    existingCard.balance = ecardInfo.balance || 0;
                    existingCard.realBalance = ecardInfo.balance || 0;
                    existingCard.presentCash = ecardInfo.present_cash || 0;
                    existingCard.deviceNo = device_no;
                    existingCard.localUserId = userId;
                    existingCard.userName = user_name || cardNo;
                    existingCard.lastSyncTime = new Date();
                }

                await existingCard.save();
                logInfo('[CreateEcard] 电子卡已同步到本地数据库', { cardNo });
            }

            res.status(201).json({
                success: true,
                message: '电子卡创建成功',
                data: {
                    cardNo,
                    deviceNo,
                    balance: result.result?.balance || cash,
                    cash: cash + (present_cash || 0)
                }
            });
        } else {
            // 处理特定错误码
            if (result.code === '13201') {
                return res.status(409).json({
                    success: false,
                    message: '电子卡已存在',
                    code: '13201'
                });
            }

            if (result.code === '13211') {
                return res.status(400).json({
                    success: false,
                    message: '卡号格式错误',
                    code: '13211'
                });
            }

            if (result.code === '13213') {
                return res.status(400).json({
                    success: false,
                    message: '充值金额超出限制',
                    code: '13213'
                });
            }

            res.status(500).json({
                success: false,
                message: result.error || '创建电子卡失败',
                code: result.code
            });
        }
    } catch (error) {
        logError('[CreateEcard] 创建异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};

/**
 * @desc    查询用户的电子卡
 * @route   GET /api/renren-cards/ecard
 * @access  Private (所有登录用户)
 */
exports.getEcard = async (req, res) => {
    try {
        const userId = req.user._id;

        logInfo('[GetEcard] 查询用户电子卡', { userId });

        // 获取用户手机号
        const User = require('../models/User');
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 处理手机号：移除 + 前缀
        let cardNo = user.phoneNumber;
        if (cardNo.startsWith('+62')) {
            cardNo = cardNo.substring(3);
        } else if (cardNo.startsWith('+86')) {
            cardNo = cardNo.substring(3);
        }

        // 验证是否为11位数字
        if (!/^[0-9]{11}$/.test(cardNo)) {
            return res.status(400).json({
                success: false,
                message: '手机号格式错误'
            });
        }

        // 先查询本地数据库
        let card = await RenrenCard.findOne({ cardNo });

        if (card) {
            logInfo('[GetEcard] 从本地数据库找到电子卡', { cardNo, balance: card.balance });
            return res.status(200).json({
                success: true,
                data: card
            });
        }

        // 本地没有，从人人水站查询
        logInfo('[GetEcard] 本地没有，查询人人水站...', { cardNo });
        const result = await renrenWaterService.getEcardInfo(cardNo);

        if (result.success && result.code === 0) {
            const ecardInfo = result.result;

            // 同步到本地数据库
            card = new RenrenCard({
                cardNo: cardNo,
                balance: ecardInfo.balance || 0,
                realBalance: ecardInfo.balance || 0,
                presentCash: ecardInfo.present_cash || 0,
                valid: 1,
                isBlack: false,
                userPhone: cardNo,
                userName: ecardInfo.user_name || cardNo,
                remark: ecardInfo.remark || '',
                groupId: ecardInfo.group_id || '',
                deviceNo: ecardInfo.device_no || '',
                localUserId: userId,
                createTime: ecardInfo.create_time ? new Date(ecardInfo.create_time) : new Date(),
                updateTime: ecardInfo.update_time ? new Date(ecardInfo.update_time) : new Date(),
                lastSyncTime: new Date()
            });

            await card.save();
            logInfo('[GetEcard] 电子卡已同步到本地', { cardNo });

            res.status(200).json({
                success: true,
                data: card
            });
        } else {
            // 电子卡不存在
            res.status(404).json({
                success: false,
                message: '电子卡不存在',
                code: result.code || '13202'
            });
        }
    } catch (error) {
        logError('[GetEcard] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};

/**
 * @desc    创建新卡片（调用人人水站API）
 * @route   POST /api/renren-cards
 */
exports.createCard = async (req, res) => {
    try {
        console.log('[RenrenCard API] Request body:', req.body);
        const { card_no, cash, present_cash, days, user_name, user_phone, remark, group_id } = req.body;

        console.log('[RenrenCard API] Extracted params:', { card_no, cash, present_cash, days, user_name, user_phone, remark, group_id });

        // 调用人人水站API创建卡片
        const result = await renrenWaterService.createCard(
            card_no,
            cash || 0,
            present_cash || 0,
            days || 0,
            user_name || '',
            user_phone || '',
            remark || '',
            group_id || ''
        );

        if (result.success && result.code === 0) {
            // 同步到本地数据库
            await renrenWaterService.getCardInfo(card_no);

            res.status(201).json({
                success: true,
                message: 'Card created successfully',
                data: result.result
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to create card in RenrenWater API',
                error: result.error || 'Unknown error'
            });
        }
    } catch (error) {
        console.error('[RenrenCard API] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    卡充值（直接给实体卡充值）
 * @route   POST /api/renren-cards/charge/:cardNo
 * @access  Private (所有登录用户)
 */
exports.chargeCard = async (req, res) => {
    try {
        const { cardNo } = req.params;
        const { out_trade_no, cash, present_cash, days, remark } = req.body;
        const userId = req.user._id;

        logInfo('[ChargeCard] 收到充值请求', {
            cardNo,
            userId,
            cash,
            present_cash,
            days
        });

        // 参数验证
        if (!cardNo) {
            return res.status(400).json({
                success: false,
                message: 'cardNo is required'
            });
        }

        if (!out_trade_no) {
            return res.status(400).json({
                success: false,
                message: 'out_trade_no is required'
            });
        }

        if (cash === undefined || cash === null || cash < 100) {
            return res.status(400).json({
                success: false,
                message: 'cash must be >= 100 (1 RMB)'
            });
        }

        // 调用卡片同步服务执行完整的充值流程
        const result = await cardSyncService.chargeAndSync({
            cardNo,
            outTradeNo: out_trade_no,
            cash,
            presentCash: present_cash || 0,
            days: days || 0,
            remark: remark || '',
            userId
        });

        logInfo('[ChargeCard] 充值成功', {
            cardNo,
            chargeAmount: cash,
            newBalance: result.data.balance
        });

        res.status(200).json(result);

    } catch (error) {
        logError('[ChargeCard] 充值异常', {
            error: error.message,
            stack: error.stack
        });

        // 根据错误类型返回不同的HTTP状态码
        if (error.message.includes('权限') || error.message.includes('没有操作')) {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        if (error.message.includes('不存在') || error.message.includes('不找')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.message.includes('状态异常') || error.message.includes('黑名单')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    绑定实物水卡到电子账号（仅本地数据库绑定，不调用人人水站API）
 * 需求：一个电子卡（用户手机号）可以在本地MongoDB数据库中绑定多个实物卡
 *
 * 验证流程：
 * 1. 实物卡：先查本地 -> 本地没有则查人人水站 -> 都不存在则报错
 * 2. 电子卡：先查本地 -> 本地没有则查人人水站 -> 都不存在则报错
 * 3. 绑定：将实物卡添加到电子卡的 boundPhysicalCards 数组
 *
 * @route   POST /api/renren-cards/bind-physical
 * @access  Private (所有登录用户)
 */
exports.bindPhysicalCard = async (req, res) => {
    try {
        const { physicalCardNo, electronicCardNo, userName, remark } = req.body;
        const userId = req.user._id;

        // 参数验证
        if (!physicalCardNo) {
            return res.status(400).json({
                success: false,
                message: '请输入实物卡号'
            });
        }

        if (!electronicCardNo) {
            return res.status(400).json({
                success: false,
                message: '电子卡号不能为空'
            });
        }

        // 实物卡号格式：1个字母+8个数字
        if (!/^[a-zA-Z][0-9]{8}$/.test(physicalCardNo)) {
            return res.status(400).json({
                success: false,
                message: '实物卡号格式错误，应为1个字母+8个数字（如：A12345678）'
            });
        }

        // 电子卡号格式：支持 +62 或 +86 前缀，或无前缀的11位数字
        let cleanElectronicCardNo = electronicCardNo.trim();
        if (cleanElectronicCardNo.startsWith('+62')) {
            cleanElectronicCardNo = cleanElectronicCardNo.substring(3);
        } else if (cleanElectronicCardNo.startsWith('+86')) {
            cleanElectronicCardNo = cleanElectronicCardNo.substring(3);
        }

        // 验证清理后的手机号是否为11位数字
        if (!/^[0-9]{11}$/.test(cleanElectronicCardNo)) {
            return res.status(400).json({
                success: false,
                message: '电子卡号格式错误，应为11位手机号（可带 +62 或 +86 前缀）'
            });
        }

        console.log('[BindPhysicalCard] 绑定请求:', {
            physicalCardNo,
            electronicCardNo: cleanElectronicCardNo,
            userId
        });

        // ==================== 1. 验证实物卡是否存在 ====================
        let physicalCard = await RenrenCard.findOne({ cardNo: physicalCardNo });

        if (!physicalCard) {
            // 本地不存在，去人人水站查询
            console.log('[BindPhysicalCard] 实物卡本地不存在，查询人人水站...');
            const syncResult = await renrenWaterService.getCardInfo(physicalCardNo);

            if (!syncResult.success || syncResult.code !== 0) {
                return res.status(404).json({
                    success: false,
                    message: `实物卡 ${physicalCardNo} 不存在`
                });
            }

            // 人人水站存在，同步到本地
            const result = syncResult.result;
            physicalCard = new RenrenCard({
                cardNo: result.card_no || physicalCardNo,
                balance: result.balance || 0,
                realBalance: result.real_balance || 0,
                presentCash: result.present_cash || 0,
                valid: result.valid || 1,
                isBlack: result.is_black === 1,
                userPhone: result.user_phone || '',
                userName: result.user_name || '',
                remark: result.remark || '',
                groupId: result.group_id || '',
                createTime: result.create_time ? new Date(result.create_time) : new Date(),
                updateTime: result.update_time ? new Date(result.update_time) : new Date()
            });
            await physicalCard.save();
            console.log('[BindPhysicalCard] 实物卡已同步到本地');
        }

        // ==================== 2. 验证电子卡是否存在 ====================
        // 查询本地数据库用完整手机号（带前缀）
        let electronicCard = await RenrenCard.findOne({ cardNo: electronicCardNo });

        if (!electronicCard) {
            // 本地不存在，去人人水站查询（用11位手机号，不带前缀）
            console.log('[BindPhysicalCard] 电子卡本地不存在，查询人人水站...');
            const syncResult = await renrenWaterService.getCardInfo(cleanElectronicCardNo);

            if (!syncResult.success || syncResult.code !== 0) {
                return res.status(404).json({
                    success: false,
                    message: `电子卡 ${electronicCardNo} 不存在`
                });
            }

            // 人人水站存在，同步到本地
            const result = syncResult.result;
            electronicCard = new RenrenCard({
                cardNo: electronicCardNo,  // 始终用完整手机号（带国际区号前缀）
                balance: result.balance || 0,
                realBalance: result.real_balance || 0,
                presentCash: result.present_cash || 0,
                valid: result.valid || 1,
                isBlack: result.is_black === 1,
                userPhone: result.user_phone || electronicCardNo,
                userName: result.user_name || userName || '',
                remark: result.remark || '',
                groupId: result.group_id || '',
                localUserId: userId,
                boundPhysicalCards: [],
                createTime: result.create_time ? new Date(result.create_time) : new Date(),
                updateTime: result.update_time ? new Date(result.update_time) : new Date()
            });
            await electronicCard.save();
            console.log('[BindPhysicalCard] 电子卡已同步到本地');
        }

        // ==================== 3. 权限检查 ====================
        // 检查实物卡是否已被其他用户绑定
        if (physicalCard.localUserId &&
            physicalCard.localUserId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: '该实物卡已被其他用户绑定'
            });
        }

        // 检查电子卡是否属于当前用户
        if (electronicCard.localUserId &&
            electronicCard.localUserId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: '该电子卡不属于您，无法绑定'
            });
        }

        // ==================== 4. 检查是否已绑定 ====================
        const alreadyBound = electronicCard.boundPhysicalCards.some(
            bound => bound.cardNo === physicalCardNo
        );

        if (alreadyBound) {
            return res.status(400).json({
                success: false,
                message: '该实物卡已绑定到此电子卡'
            });
        }

        // ==================== 5. 执行绑定 ====================
        // 将实物卡添加到电子卡的 boundPhysicalCards 数组
        electronicCard.boundPhysicalCards.push({
            cardNo: physicalCardNo,
            nickname: userName || physicalCard.userName || '',
            balance: physicalCard.balance || 0,
            status: physicalCard.valid === 1 ? 'Active' : 'Inactive',
            boundAt: new Date(),
            remark: remark || ''
        });

        // 设置实物卡的 localUserId
        physicalCard.localUserId = userId;
        if (userName) physicalCard.userName = userName;

        // 确保电子卡归属于当前用户
        electronicCard.localUserId = userId;

        // 保存更新
        await Promise.all([
            electronicCard.save(),
            physicalCard.save()
        ]);

        console.log('[BindPhysicalCard] 绑定成功:', {
            physicalCardNo,
            electronicCardNo,
            userId,
            boundCardsCount: electronicCard.boundPhysicalCards.length
        });

        res.status(200).json({
            success: true,
            message: '实物卡绑定成功',
            data: {
                physicalCardNo,
                electronicCardNo,
                localUserId: userId,
                boundPhysicalCards: electronicCard.boundPhysicalCards
            }
        });
    } catch (error) {
        console.error('[BindPhysicalCard] 错误:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};

/**
 * @desc    解绑实物水卡
 * @route   POST /api/renren-cards/unbind-physical
 * @access  Private (所有登录用户)
 */
exports.unbindPhysicalCard = async (req, res) => {
    try {
        const { cardNo } = req.body;

        if (!cardNo) {
            return res.status(400).json({
                success: false,
                message: 'cardNo is required'
            });
        }

        // 调用人人水站API解绑
        const result = await renrenWaterService.unbindEcard(cardNo);

        if (result.success && result.code === 0) {
            // 更新本地数据库
            const card = await RenrenCard.findOne({ boundEcardNo: cardNo, localUserId: req.user.id });
            if (card) {
                card.boundEcardNo = '';
                await card.save();
            }

            res.status(200).json({
                success: true,
                message: 'Physical card unbound successfully',
                data: result.result
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to unbind physical card',
                code: result.code
            });
        }
    } catch (error) {
        console.error('[UnbindPhysicalCard] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    批量创建人人水站实体卡
 * @route   POST /api/renren-cards/batch-create
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.batchCreateCards = async (req, res) => {
    try {
        const {
            startCardNo,
            quantity,
            valuePerCard = 600000,
            presentCash = 0,
            days = 0,
            remark = '',
            groupId = ''
        } = req.body;

        logInfo('[BatchCreateCards] 收到批量创建请求', {
            startCardNo,
            quantity,
            valuePerCard,
            userId: req.user._id
        });

        // 参数验证
        if (!startCardNo) {
            return res.status(400).json({
                success: false,
                message: 'startCardNo is required'
            });
        }

        if (!quantity || quantity <= 0 || quantity > 1000) {
            return res.status(400).json({
                success: false,
                message: 'quantity must be between 1 and 1000'
            });
        }

        // 卡号格式验证：1个字母+8个数字
        if (!/^[a-zA-Z][0-9]{8}$/.test(startCardNo)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid card number format. Should be 1 letter + 8 digits (e.g., A12345678)'
            });
        }

        // 计算结束卡号
        const endCardNo = generateEndCardNo(startCardNo, quantity);

        // 1. 调用人人水站批量创建API
        const result = await renrenWaterService.batchCreateCards(
            startCardNo,
            quantity,
            valuePerCard,
            presentCash,
            days,
            remark,
            groupId
        );

        logInfo('[BatchCreateCards] 人人水站API返回', {
            success: result.success,
            code: result.code,
            error: result.error
        });

        if (!result.success || result.code !== 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create cards in RenrenWater API',
                error: result.error || result.msg || 'Unknown error'
            });
        }

        // 2. 创建批次记录
        const batchId = `RENREN_${Date.now()}`;
        const batch = await CardBatch.create({
            batchId,
            quantity,
            valuePerCard,
            startSerial: startCardNo,
            endSerial: endCardNo,
            createdBy: req.user._id,
            status: 'Completed'
        });

        logInfo('[BatchCreateCards] 批次记录创建成功', { batchId });

        // 3. 同步卡片信息到本地数据库（分批同步，避免请求过快）
        const syncResults = [];
        const batchSize = 10; // 每次同步10张

        for (let i = 0; i < quantity; i += batchSize) {
            const currentBatchSize = Math.min(batchSize, quantity - i);
            const syncPromises = [];

            for (let j = 0; j < currentBatchSize; j++) {
                const cardNo = generateCardNo(startCardNo, i + j);
                syncPromises.push(syncCardToLocal(cardNo));
            }

            const batchResults = await Promise.allSettled(syncPromises);
            syncResults.push(...batchResults);

            // 延迟100ms避免请求过快
            if (i + batchSize < quantity) {
                await delay(100);
            }
        }

        const successCount = syncResults.filter(r => r.status === 'fulfilled').length;
        const failedCount = syncResults.filter(r => r.status === 'rejected').length;

        logInfo('[BatchCreateCards] 同步完成', {
            total: quantity,
            success: successCount,
            failed: failedCount
        });

        // 4. 获取该批次的所有卡片
        const cards = await RenrenCard.find({
            cardNo: {
                $regex: `^${startCardNo.charAt(0)}\\d{8}$`,
                $gte: startCardNo,
                $lte: endCardNo
            }
        });

        res.status(201).json({
            success: true,
            message: `Successfully created ${quantity} cards (${successCount} synced, ${failedCount} failed)`,
            data: {
                batch,
                cards,
                syncResults: {
                    total: quantity,
                    success: successCount,
                    failed: failedCount
                }
            }
        });

    } catch (error) {
        logError('[BatchCreateCards] 批量创建异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取人人水站卡片批次列表
 * @route   GET /api/renren-cards/batches
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.getCardBatches = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const batches = await CardBatch.find({ batchId: /^RENREN_/ })
            .populate('createdBy', 'name phoneNumber')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await CardBatch.countDocuments({ batchId: /^RENREN_/ });

        res.status(200).json({
            success: true,
            data: batches,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        logError('[GetCardBatches] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取人人水站卡片批次详情
 * @route   GET /api/renren-cards/batches/:batchId
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.getCardBatchDetail = async (req, res) => {
    try {
        const { batchId } = req.params;

        const batch = await CardBatch.findOne({ batchId })
            .populate('createdBy', 'name phoneNumber');

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // 获取该批次的所有卡片
        const cards = await RenrenCard.find({
            cardNo: {
                $gte: batch.startSerial,
                $lte: batch.endSerial
            }
        }).sort({ cardNo: 1 });

        res.status(200).json({
            success: true,
            data: {
                batch,
                cards,
                count: cards.length
            }
        });

    } catch (error) {
        logError('[GetCardBatchDetail] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取卡片完整信息（含交易历史）
 * @route   GET /api/renren-cards/:cardNo/full-info
 * @access  Private
 */
exports.getCardFullInfo = async (req, res) => {
    try {
        const { cardNo } = req.params;

        const card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        // 获取交易记录（从人人水站API）
        const records = await renrenWaterService.getCardRecords(cardNo, 1, 20);

        const transactions = records.success && records.code === 0
            ? records.result.list || []
            : [];

        res.status(200).json({
            success: true,
            data: {
                card,
                transactions,
                transactionCount: transactions.length
            }
        });

    } catch (error) {
        logError('[GetCardFullInfo] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

// ==================== 辅助函数 ====================

/**
 * 生成结束卡号
 * @param {string} startCardNo - 起始卡号 (e.g., A12345678)
 * @param {number} quantity - 数量
 * @returns {string} 结束卡号
 */
function generateEndCardNo(startCardNo, quantity) {
    const prefix = startCardNo.charAt(0);
    const startNum = parseInt(startCardNo.substring(1));
    const endNum = startNum + quantity - 1;
    return `${prefix}${endNum.toString().padStart(8, '0')}`;
}

/**
 * 生成指定索引的卡号
 * @param {string} startCardNo - 起始卡号
 * @param {number} index - 索引
 * @returns {string} 卡号
 */
function generateCardNo(startCardNo, index) {
    const prefix = startCardNo.charAt(0);
    const startNum = parseInt(startCardNo.substring(1));
    const num = startNum + index;
    return `${prefix}${num.toString().padStart(8, '0')}`;
}

/**
 * 同步单张卡片到本地数据库
 * @param {string} cardNo - 卡号
 */
async function syncCardToLocal(cardNo) {
    try {
        const cardInfo = await renrenWaterService.getCardInfo(cardNo);

        if (cardInfo.success && cardInfo.code === 0) {
            const result = cardInfo.result;

            let card = await RenrenCard.findOne({ cardNo });

            if (!card) {
                card = new RenrenCard({
                    cardNo: result.card_no || cardNo,
                    balance: result.balance,
                    realBalance: result.real_balance,
                    presentCash: result.present_cash || 0,
                    valid: result.valid,
                    isBlack: result.is_black === 1,
                    operatorName: result.operator_name || '',
                    userPhone: result.user_phone || '',
                    userName: result.user_name || '',
                    remark: result.remark || '',
                    groupId: result.group_id || '',
                    unsyncCash: result.unsync_cash || 0,
                    createTime: result.create_time ? new Date(result.create_time) : new Date(),
                    updateTime: result.update_time ? new Date(result.update_time) : new Date()
                });
            } else {
                card.balance = result.balance;
                card.realBalance = result.real_balance;
                card.valid = result.valid;
                card.isBlack = result.is_black === 1;
                card.operatorName = result.operator_name || '';
                card.userPhone = result.user_phone || '';
                card.userName = result.user_name || '';
                card.remark = result.remark || '';
                card.groupId = result.group_id || '';
                card.unsyncCash = result.unsync_cash || 0;
                if (result.update_time) {
                    card.updateTime = new Date(result.update_time);
                }
                card.lastSyncTime = new Date();
            }

            await card.save();
            return { success: true, cardNo };
        } else {
            return { success: false, cardNo, error: cardInfo.error || 'Unknown error' };
        }
    } catch (error) {
        return { success: false, cardNo, error: error.message };
    }
}

/**
 * 延迟函数
 * @param {number} ms - 毫秒数
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @desc    获取卡片同步历史
 * @route   GET /api/renren-cards/:cardNo/sync-history
 * @access  Private
 */
exports.getCardSyncHistory = async (req, res) => {
    try {
        const { cardNo } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        // 分页获取同步历史
        const syncHistory = card.syncHistory || [];
        const startIndex = (page - 1) * limit;
        const paginatedHistory = syncHistory
            .slice(startIndex, startIndex + parseInt(limit))
            .reverse(); // 最新的在前

        res.status(200).json({
            success: true,
            data: {
                cardNo: card.cardNo,
                syncHistory: paginatedHistory,
                total: syncHistory.length,
                pages: Math.ceil(syncHistory.length / limit),
                currentPage: parseInt(page)
            }
        });

    } catch (error) {
        logError('[GetCardSyncHistory] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取卡片统计数据
 * @route   GET /api/renren-cards/statistics
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.getCardStatistics = async (req, res) => {
    try {
        const { groupId } = req.query;

        const statistics = await RenrenCard.getCardStatistics(groupId);

        logInfo('[GetCardStatistics] 查询成功', { statistics });

        res.status(200).json({
            success: true,
            data: statistics
        });

    } catch (error) {
        logError('[GetCardStatistics] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取卡片详细统计
 * @route   GET /api/renren-cards/:cardNo/statistics
 * @access  Private
 */
exports.getCardDetailStatistics = async (req, res) => {
    try {
        const { cardNo } = req.params;

        const card = await RenrenCard.findOne({ cardNo });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found'
            });
        }

        const statistics = {
            cardNo: card.cardNo,
            // 基本信息统计
            basic: {
                balance: card.balance,
                realBalance: card.realBalance,
                presentCash: card.presentCash,
                totalCharged: card.totalCharged || 0,
                totalDispensed: card.totalDispensed || 0,
                chargeCount: card.chargeCount || 0,
                dispenseCount: card.dispenseCount || 0
            },
            // 时间统计
            timestamps: {
                createTime: card.createTime,
                updateTime: card.updateTime,
                lastSyncTime: card.lastSyncTime,
                lastChargeTime: card.lastChargeTime,
                lastDispenseTime: card.lastDispenseTime,
                activatedAt: card.activatedAt,
                expiredAt: card.expiredAt
            },
            // 同步历史统计
            syncHistory: {
                totalCount: card.syncHistory?.length || 0,
                lastSync: card.syncHistory?.[card.syncHistory.length - 1] || null
            },
            // 绑定历史统计
            bindHistory: {
                totalCount: card.bindHistory?.length || 0,
                currentBinding: card.localUserId ? {
                    userId: card.localUserId,
                    boundAt: card.lastBindTime
                } : null
            },
            // 状态信息
            status: {
                valid: card.valid,
                isBlack: card.isBlack,
                isValid: card.valid === 1 && !card.isBlack
            }
        };

        res.status(200).json({
            success: true,
            data: statistics
        });

    } catch (error) {
        logError('[GetCardDetailStatistics] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    更新批次统计信息
 * @route   POST /api/renren-cards/batches/:batchId/update-stats
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.updateBatchStatistics = async (req, res) => {
    try {
        const { batchId } = req.params;
        const userId = req.user._id;

        logInfo('[UpdateBatchStatistics] 更新批次统计', { batchId, userId });

        const CardBatch = require('../models/CardBatch');
        const batch = await CardBatch.updateStatistics(batchId);

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Statistics updated successfully',
            data: batch
        });

    } catch (error) {
        logError('[UpdateBatchStatistics] 更新异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取批次统计信息
 * @route   GET /api/renren-cards/batches/:batchId/statistics
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.getBatchStatistics = async (req, res) => {
    try {
        const { batchId } = req.params;

        logInfo('[GetBatchStatistics] 获取批次统计', { batchId });

        const CardBatch = require('../models/CardBatch');
        const batch = await CardBatch.findOne({ batchId })
            .populate('createdBy', 'name phoneNumber');

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // 如果统计过期（超过1小时），自动更新
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (!batch.lastStatsUpdate || batch.lastStatsUpdate < oneHourAgo) {
            await CardBatch.updateStatistics(batchId);
            batch.lastStatsUpdate = new Date();
        }

        res.status(200).json({
            success: true,
            data: batch.statistics
        });

    } catch (error) {
        logError('[GetBatchStatistics] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取所有批次统计汇总
 * @route   GET /api/renren-cards/batches-summary
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.getBatchesSummary = async (req, res) => {
    try {
        logInfo('[GetBatchesSummary] 获取批次统计汇总');

        const CardBatch = require('../models/CardBatch');

        const summary = await CardBatch.aggregate([
            {
                $group: {
                    _id: null,
                    totalBatches: { $sum: 1 },
                    completedBatches: {
                        $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                    },
                    pendingBatches: {
                        $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
                    },
                    totalCards: { $sum: '$quantity' },
                    totalValue: { $sum: { $multiply: ['$quantity', '$valuePerCard'] } },
                    avgActivationRate: { $avg: '$statistics.activationRate' }
                }
            }
        ]);

        const recentBatches = await CardBatch.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('createdBy', 'name phoneNumber')
            .lean();

        res.status(200).json({
            success: true,
            data: {
                summary: summary[0] || {
                    totalBatches: 0,
                    completedBatches: 0,
                    pendingBatches: 0,
                    totalCards: 0,
                    totalValue: 0,
                    avgActivationRate: 0
                },
                recentBatches
            }
        });

    } catch (error) {
        logError('[GetBatchesSummary] 查询异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    归档批次
 * @route   PUT /api/renren-cards/batches/:batchId/archive
 * @access  Private (Admin, Super-Admin)
 */
exports.archiveBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const userId = req.user._id;

        logInfo('[ArchiveBatch] 归档批次', { batchId, userId });

        const CardBatch = require('../models/CardBatch');
        const batch = await CardBatch.findOne({ batchId });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        batch.status = 'Archived';
        batch.archivedAt = new Date();
        batch.archivedBy = userId;
        await batch.save();

        res.status(200).json({
            success: true,
            message: 'Batch archived successfully',
            data: batch
        });

    } catch (error) {
        logError('[ArchiveBatch] 归档异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    更新批次备注
 * @route   PUT /api/renren-cards/batches/:batchId/notes
 * @access  Private (Admin, Super-Admin, Business)
 */
exports.updateBatchNotes = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { notes } = req.body;

        logInfo('[UpdateBatchNotes] 更新批次备注', { batchId });

        const CardBatch = require('../models/CardBatch');
        const batch = await CardBatch.findOne({ batchId });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        batch.notes = notes || '';
        await batch.save();

        res.status(200).json({
            success: true,
            message: 'Notes updated successfully',
            data: batch
        });

    } catch (error) {
        logError('[UpdateBatchNotes] 更新异常', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    开始最大余额出水
 * @route   POST /api/renren-cards/max-balance-dispense
 * @access  Private (所有登录用户)
 */
exports.startMaxBalanceDispense = async (req, res) => {
    try {
        const { device_no, outlet, card_no } = req.body;
        const userId = req.user._id;

        logInfo('[StartMaxBalanceDispense] 收到最大余额出水请求', {
            device_no,
            outlet,
            card_no,
            userId
        });

        // 参数验证
        if (!device_no) {
            return res.status(400).json({
                success: false,
                message: '设备号不能为空'
            });
        }

        if (!card_no) {
            return res.status(400).json({
                success: false,
                message: '电子卡号不能为空'
            });
        }

        // 验证电子卡号格式（11位数字）
        let cleanCardNo = card_no.trim();
        if (cleanCardNo.startsWith('+62')) {
            cleanCardNo = cleanCardNo.substring(3);
        } else if (cleanCardNo.startsWith('+86')) {
            cleanCardNo = cleanCardNo.substring(3);
        }

        if (!/^[0-9]{11}$/.test(cleanCardNo)) {
            return res.status(400).json({
                success: false,
                message: '电子卡号格式错误，应为11位手机号'
            });
        }

        // 获取电子卡余额（从人人水站API）
        logInfo('[StartMaxBalanceDispense] 查询电子卡余额', { cardNo: cleanCardNo });
        const cardInfo = await renrenWaterService.getEcardInfo(cleanCardNo);

        if (!cardInfo.success || cardInfo.code !== 0) {
            return res.status(404).json({
                success: false,
                message: '电子卡不存在或查询失败',
                error: cardInfo.error
            });
        }

        const maxBalance = cardInfo.result?.balance || 0;

        if (maxBalance < 100) {
            return res.status(400).json({
                success: false,
                message: '电子卡余额不足，最低需要100分（1元）'
            });
        }

        logInfo('[StartMaxBalanceDispense] 电子卡余额', { balance: maxBalance });

        // 生成交易单号
        const out_trade_no = `MAXBAL_${Date.now()}_${cleanCardNo}`;

        // 调用人人水站API开始出水
        const waterResult = await renrenWaterService.deviceWater(
            device_no,
            cleanCardNo,
            maxBalance,
            outlet || 1,
            out_trade_no,
            'Max Balance Mode'
        );

        logInfo('[StartMaxBalanceDispense] 人人水站API返回', {
            success: waterResult.success,
            code: waterResult.code,
            error: waterResult.error
        });

        if (!waterResult.success || waterResult.code !== 0) {
            return res.status(500).json({
                success: false,
                message: '调用人人水站API失败',
                error: waterResult.error || 'Unknown error'
            });
        }

        // 创建交易记录（标记为最大余额模式）
        const RenrenTransaction = require('../models/RenrenTransaction');
        const transaction = await RenrenTransaction.create({
            outTradeNo: out_trade_no,
            tradeNo: waterResult.result?.trade_no || '',
            deviceNo: device_no,
            cardNo: cleanCardNo,
            waterTime: new Date(),
            waterState: 2, // 2-处理中
            cash: maxBalance,
            startBalance: maxBalance,
            endBalance: maxBalance, // 预设余额，出水完成回调后会更新
            outlet: outlet || 1,
            tradePayType: 3,
            syncStatus: 2, // 2-处理中
            createTime: new Date(),
            syncTime: new Date(),

            // 最大余额模式字段
            isMaxBalanceMode: true,
            maxBalanceAmount: maxBalance,
            actualAmount: 0,
            refundAmount: 0,
            parentTradeNo: '',

            localUserId: userId
        });

        logInfo('[StartMaxBalanceDispense] 交易记录已创建', {
            outTradeNo: out_trade_no,
            maxBalanceAmount: maxBalance
        });

        res.status(200).json({
            success: true,
            message: '最大余额出水已启动',
            data: {
                outTradeNo: out_trade_no,
                deviceNo: device_no,
                cardNo: cleanCardNo,
                maxBalance: maxBalance,
                outlet: outlet || 1,
                price: waterResult.result?.price || 0,
                volume: waterResult.result?.volume || 0
            }
        });

    } catch (error) {
        logError('[StartMaxBalanceDispense] 启动异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取电子卡实时余额
 * @route   GET /api/renren-cards/:cardNo/balance
 * @access  Private (所有登录用户)
 */
exports.getEcardBalance = async (req, res) => {
    try {
        const { cardNo } = req.params;

        logInfo('[GetEcardBalance] 查询电子卡余额', { cardNo });

        // 验证电子卡号格式
        let cleanCardNo = cardNo.trim();
        if (cleanCardNo.startsWith('+62')) {
            cleanCardNo = cleanCardNo.substring(3);
        } else if (cleanCardNo.startsWith('+86')) {
            cleanCardNo = cleanCardNo.substring(3);
        }

        if (!/^[0-9]{11}$/.test(cleanCardNo)) {
            return res.status(400).json({
                success: false,
                message: '电子卡号格式错误，应为11位手机号'
            });
        }

        // 从人人水站API获取最新余额
        const cardInfo = await renrenWaterService.getEcardInfo(cleanCardNo);

        if (!cardInfo.success || cardInfo.code !== 0) {
            return res.status(404).json({
                success: false,
                message: '电子卡不存在或查询失败',
                error: cardInfo.error
            });
        }

        const balance = cardInfo.result?.balance || 0;

        logInfo('[GetEcardBalance] 查询成功', { cardNo: cleanCardNo, balance });

        res.status(200).json({
            success: true,
            data: {
                cardNo: cleanCardNo,
                balance: balance,
                balanceInRupiah: balance / 100
            }
        });

    } catch (error) {
        logError('[GetEcardBalance] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

/**
 * @desc    获取卡片交易记录（过滤最大余额模式的预设交易）
 * @route   GET /api/renren-cards/:cardNo/transactions
 * @access  Private (所有登录用户)
 */
exports.getCardTransactionsFiltered = async (req, res) => {
    try {
        const { cardNo } = req.params;
        const { page = 1, limit = 50 } = req.query;

        logInfo('[GetCardTransactionsFiltered] 查询交易记录', { cardNo, page, limit });

        // 验证电子卡号格式
        let cleanCardNo = cardNo.trim();
        if (cleanCardNo.startsWith('+62')) {
            cleanCardNo = cleanCardNo.substring(3);
        } else if (cleanCardNo.startsWith('+86')) {
            cleanCardNo = cleanCardNo.substring(3);
        }

        if (!/^[0-9]{11}$/.test(cleanCardNo)) {
            return res.status(400).json({
                success: false,
                message: '电子卡号格式错误，应为11位手机号'
            });
        }

        const RenrenTransaction = require('../models/RenrenTransaction');

        // 查询交易记录，过滤条件：
        // - 不是最大余额模式，或
        // - 是最大余额模式但有实际消费金额（actualAmount > 0）
        const query = {
            cardNo: cleanCardNo,
            $or: [
                { isMaxBalanceMode: false },
                { isMaxBalanceMode: true, actualAmount: { $gt: 0 } }
            ]
        };

        const transactions = await RenrenTransaction.find(query)
            .sort({ waterTime: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await RenrenTransaction.countDocuments(query);

        logInfo('[GetCardTransactionsFiltered] 查询成功', {
            cardNo: cleanCardNo,
            count: transactions.length,
            total
        });

        res.status(200).json({
            success: true,
            data: transactions,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        logError('[GetCardTransactionsFiltered] 查询异常', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
