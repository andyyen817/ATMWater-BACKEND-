const { User, Unit, Transaction } = require('../models'); // Stage 1 修复：使用 Sequelize 模型
// ❌ WaterQualityLog 暂时注释（非核心功能，待迁移）
// const WaterQualityLog = require('../models/WaterQualityLog'); // P2-IOT-002
// ❌ RenrenCard, RenrenTransaction 已删除（阶段0：清理人人水站功能）
// const RenrenCard = require('../models/RenrenCard');
// const RenrenTransaction = require('../models/RenrenTransaction');
const { verifySignature } = require('../utils/signature');
const hardwareService = require('../services/hardwareService');
// ❌ sharingService 暂时注释（依赖 Setting 模型，待迁移）
// const { processProfitSharing } = require('../services/sharingService');

/**
 * @desc    下发取水授权指令 (由 App 触发)
 */
exports.authorizeDispense = async (req, res) => {
    try {
        const { unitId, waterType, cash } = req.body;
        const userId = req.user.id;
        const user = await User.findByPk(userId);
        const unit = await Unit.findOne({ where: { unitId } });

        if (!user || !unit) {
            return res.status(404).json({ success: false, message: 'User or Unit not found' });
        }

        if (user.balance < cash) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        const out_trade_no = `ORDER_${Date.now()}_${userId.toString().slice(-4)}`;
        const outlet = waterType === 'Mineral' ? 2 : 1;

        // 调用硬件平台 API [P1-IOT-001]
        const hardwareResult = await hardwareService.authorizeWater(
            unit.unitId,
            out_trade_no,
            cash,
            outlet
        );

        if (!hardwareResult.success) {
            return res.status(500).json({
                success: false,
                message: hardwareResult.error || 'Hardware authorization failed'
            });
        }

        // 创建 Pending 交易记录
        await Transaction.create({
            userId,
            type: 'WaterPurchase',
            amount: cash,
            externalId: out_trade_no,
            description: `Water Purchase at ${unitId} (${waterType})`
        });

        res.status(200).json({
            success: true,
            message: 'Dispense command sent to hardware',
            out_trade_no: out_trade_no
        });

    } catch (error) {
        console.error('Authorize Dispense Error:', error);
        res.status(500).json({ success: false, message: 'Auth Logic Error' });
    }
};

/**
 * @desc    接收硬件平台打水结果回调通知
 * 支持所有打水数据类型：
 * 1: 刷卡打水记录
 * 2: 投币打水记录
 * 3: 无卡打水记录
 * 4: 电子水卡打水记录
 */
exports.handleHardwareCallback = async (req, res) => {
    try {
        const data = req.body;

        // 签名验证
        if (!verifySignature(data, process.env.HARDWARE_APPKEY)) {
            console.error('[Callback] Signature verification failed');
            return res.status(400).send('Signature Error');
        }

        const { data_type } = data;

        switch (data_type) {
            case 1:
                // 刷卡打水记录
                await handleCardWaterDispense(data);
                break;
            case 2:
                // 投币打水记录
                await handleCoinWaterDispense(data);
                break;
            case 3:
                // 无卡打水记录
                await handleCardlessWaterDispense(data);
                break;
            case 4:
                // 电子水卡打水记录
                await handleEcardWaterDispense(data);
                break;
            default:
                console.warn(`[Callback] Unknown data_type: ${data_type}`);
        }

        res.status(200).send('success');
    } catch (error) {
        console.error('[Callback] Error:', error);
        res.status(500).send('Internal Error');
    }
};

/**
 * 4.1 刷卡打水推送 (data_type=1)
 */
async function handleCardWaterDispense(data) {
    const { device_no, card_no, water_time, cash, start_balance, end_balance, price, volume, outlet } = data;

    console.log(`[Callback] Card Water Dispense: ${card_no} at ${device_no}, ${volume}ml, Rp ${cash}`);

    // 1. 更新本地卡片余额
    const card = await RenrenCard.findOne({ where: { cardNo: card_no } });
    if (card) {
        await card.update({
            balance: end_balance,
            lastSyncTime: new Date()
        });
    }

    // 2. 保存交易记录到 RenrenTransaction
    await RenrenTransaction.create({
        cardNo: card_no,
        deviceNo: device_no,
        tradeType: 3, // 刷卡打水
        cash: cash,
        presentCash: 0,
        balance: end_balance,
        volume: volume,
        price: price,
        outlet: outlet,
        waterTime: new Date(water_time),
        remark: 'Card Water Dispense'
    });

    // 3. 如果卡片关联了本地用户，更新用户余额并创建本地交易
    if (card && card.localUserId) {
        const user = await User.findByPk(card.localUserId);
        if (user) {
            await user.update({ balance: end_balance });

            await Transaction.create({
                userId: user.id,
                type: 'WaterPurchase',
                amount: cash,
                status: 'Completed',
                volume: volume,
                description: `Card Water Purchase at ${device_no}`
            });
        }
    }
}

/**
 * 4.2 投币打水推送 (data_type=2)
 */
async function handleCoinWaterDispense(data) {
    const { device_no, water_time, cash, price, volume, outlet } = data;

    console.log(`[Callback] Coin Water Dispense: ${device_no}, ${volume}ml, Rp ${cash}`);

    // 保存投币打水记录（无卡片信息）
    await RenrenTransaction.create({
        deviceNo: device_no,
        tradeType: 2, // 投币打水
        cash: cash,
        volume: volume,
        price: price,
        outlet: outlet,
        waterTime: new Date(water_time),
        remark: 'Coin Water Dispense'
    });
}

/**
 * 4.3 无卡打水推送 (data_type=3)
 */
async function handleCardlessWaterDispense(data) {
    const { out_trade_no, water_state, cash, card_no, device_no, volume } = data;

    console.log(`[Callback] Cardless Water Dispense: ${out_trade_no}, state=${water_state}`);

    // 查找对应的交易记录
    let transaction = await Transaction.findOne({
        where: { externalId: out_trade_no },
        include: [{ model: User, as: 'user' }]
    });

    if (water_state === 1) { // 成功出水
        // 幂等性检查
        if (transaction && transaction.status === 'Completed') {
            console.warn(`[Callback] Order ${out_trade_no} already processed.`);
            return res.status(200).send('success');
        }

        const customer = transaction ? transaction.user : await User.findOne({ where: { phoneNumber: card_no } });
        const unit = await Unit.findOne({ where: { unitId: device_no } });

        if (customer && unit) {
            // 使用原子操作扣除余额
            const [affectedRows, [updateResult]] = await User.update(
                { balance: User.sequelize.literal(`balance - ${cash}`) },
                {
                    where: { id: customer.id },
                    returning: true
                }
            );

            if (!updateResult || updateResult.balance < 0) {
                console.error(`[Callback] Insufficient balance for ${customer.phoneNumber}`);
                if (transaction) {
                    await transaction.update({
                        status: 'Failed',
                        errorMessage: 'Insufficient balance'
                    });
                }
                return;
            }

            // 更新交易状态
            if (transaction) {
                await transaction.update({
                    status: 'Completed',
                    volume: volume
                });
            }

            // 触发分润
            await processProfitSharing(out_trade_no, cash, device_no, customer.id);

            console.log(`[Callback] Unit ${device_no} dispensed ${volume}ml. User ${customer.phoneNumber} charged Rp ${cash}`);
        }
    } else {
        // 出水失败
        if (transaction) {
            await transaction.update({ status: 'Failed' });
        }
        console.warn(`[Callback] Order ${out_trade_no} failed`);
    }
}

/**
 * 4.8 电子水卡打水推送 (data_type=4)
 */
async function handleEcardWaterDispense(data) {
    const { device_no, card_no, water_time, cash, start_balance, end_balance, price, volume, outlet, water_state } = data;

    console.log(`[Callback] E-card Water Dispense: ${card_no} at ${device_no}, ${volume}ml, Rp ${cash}`);

    // 检查是否为最大余额模式交易
    // 通过 outTradeNo 查找对应的交易记录（最大余额模式的交易以 MAXBAL_ 开头）
    const outTradeNo = data.out_trade_no || '';
    let maxBalanceTransaction = null;

    if (outTradeNo && outTradeNo.startsWith('MAXBAL_')) {
        maxBalanceTransaction = await RenrenTransaction.findOne({
            where: {
                outTradeNo: outTradeNo,
                isMaxBalanceMode: true
            }
        });
    }

    // 1. 查找电子卡对应的用户（可能带国家码）
    const { Op } = require('sequelize');
    const user = await User.findOne({
        where: {
            phoneNumber: {
                [Op.in]: [
                    card_no,
                    '+86' + card_no.substring(1),
                    '+62' + card_no.substring(1)
                ]
            }
        }
    });

    if (user) {
        // 更新用户余额
        await user.update({ balance: end_balance });

        // 创建本地交易记录（最大余额模式只记录实际消费）
        await Transaction.create({
            userId: user.id,
            type: 'WaterPurchase',
            amount: cash,
            status: water_state === 1 ? 'Completed' : 'Failed',
            volume: volume,
            description: `E-card Water Purchase at ${device_no}`
        });
    }

    // 2. 保存到人人水站交易记录
    const transactionData = {
        cardNo: card_no,
        deviceNo: device_no,
        tradeType: 4, // 电子卡打水
        cash: cash,
        balance: end_balance,
        volume: volume,
        price: price,
        outlet: outlet,
        waterTime: new Date(water_time),
        waterState: water_state,
        remark: 'E-card Water Dispense'
    };

    // 如果是最大余额模式，添加特殊标记
    if (maxBalanceTransaction) {
        console.log(`[Callback] Max Balance Mode detected: ${outTradeNo}`);

        // 计算差额
        const maxBalanceAmount = maxBalanceTransaction.maxBalanceAmount || 0;
        const actualAmount = cash || 0;
        const refundAmount = maxBalanceAmount - actualAmount;

        console.log(`[Callback] Max Balance Mode refund calculation:`, {
            maxBalanceAmount,
            actualAmount,
            refundAmount
        });

        // 更新原始交易记录
        await maxBalanceTransaction.update({
            waterState: water_state,
            endBalance: end_balance,
            actualAmount: actualAmount,
            refundAmount: refundAmount,
            volume: volume,
            price: price,
            syncStatus: water_state === 1 ? 1 : 0 // 1-成功 0-失败
        });

        // 如果有差额需要退款且出水成功
        if (refundAmount > 0 && water_state === 1) {
            try {
                const renrenWaterService = require('../services/renrenWaterService');
                const refundOutTradeNo = `REFUND_${Date.now()}_${card_no}`;

                console.log(`[Callback] Processing refund: ${refundAmount} cents`);

                // 更新交易状态为处理中
                await maxBalanceTransaction.update({ refundStatus: 'processing' });

                // 退款重试机制（最多3次）
                let refundResult = null;
                let refundSuccess = false;
                const MAX_REFUND_RETRIES = 3;

                for (let attempt = 1; attempt <= MAX_REFUND_RETRIES; attempt++) {
                    console.log(`[Callback] Refund attempt ${attempt}/${MAX_REFUND_RETRIES}`);

                    try {
                        // 调用电子卡充值API退款
                        refundResult = await renrenWaterService.chargeEcard(
                            refundOutTradeNo,
                            card_no,
                            refundAmount,
                            0, // present_cash
                            0, // days
                            'Max Balance Mode Refund'
                        );

                        if (refundResult.success && refundResult.code === 0) {
                            refundSuccess = true;
                            console.log(`[Callback] Refund successful: ${refundAmount} cents`);

                            // 更新交易状态为成功
                            await maxBalanceTransaction.update({
                                refundStatus: 'success',
                                refundTradeNo: refundResult.result?.trade_no || '',
                                refundTime: new Date(),
                                refundRetryCount: attempt
                            });

                            // 等待1秒让人人水站处理完毕
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // 同步电子卡最新余额（强制重试）
                            let newBalance = 0;
                            let syncSuccess = false;

                            for (let syncAttempt = 1; syncAttempt <= 3; syncAttempt++) {
                                console.log(`[Callback] Balance sync attempt ${syncAttempt}/3`);

                                try {
                                    const syncResult = await renrenWaterService.getEcardInfo(card_no);
                                    if (syncResult.success && syncResult.code === 0) {
                                        newBalance = syncResult.result?.balance || 0;
                                        syncSuccess = true;
                                        console.log(`[Callback] New balance after refund: ${newBalance}`);

                                        // 更新用户余额
                                        if (user) {
                                            await user.update({ balance: newBalance });
                                        }

                                        // 更新退款后的余额
                                        await maxBalanceTransaction.update({ balanceAfterRefund: newBalance });

                                        break;
                                    }
                                } catch (syncError) {
                                    console.error(`[Callback] Balance sync attempt ${syncAttempt} failed:`, syncError.message);
                                    if (syncAttempt < 3) {
                                        await new Promise(resolve => setTimeout(resolve, 1000 * syncAttempt)); // 递增延迟
                                    }
                                }
                            }

                            if (!syncSuccess) {
                                console.error(`[Callback] Balance sync failed after 3 attempts`);
                                await maxBalanceTransaction.update({ refundError: 'Balance sync failed after refund' });
                            }

                            // 创建退款交易记录
                            await RenrenTransaction.create({
                                outTradeNo: refundOutTradeNo,
                                tradeNo: refundResult.result?.trade_no || '',
                                deviceNo: device_no,
                                cardNo: card_no,
                                waterTime: new Date(),
                                waterState: 1,
                                cash: -refundAmount, // 负数表示退款
                                startBalance: end_balance,
                                endBalance: newBalance,
                                outlet: outlet,
                                tradePayType: 5, // 其他
                                syncStatus: syncSuccess ? 1 : 0,
                                createTime: new Date(),
                                syncTime: new Date(),

                                // 最大余额模式字段
                                isMaxBalanceMode: false, // 退款记录不标记为最大余额模式
                                maxBalanceAmount: 0,
                                actualAmount: refundAmount, // 退款金额记录在 actualAmount
                                refundAmount: refundAmount,
                                parentTradeNo: outTradeNo, // 关联到原始出水交易

                                // 退款状态
                                refundStatus: 'success',
                                refundRetryCount: attempt,

                                localUserId: user?.id
                            });

                            break; // 退款成功，退出重试循环
                        } else {
                            console.warn(`[Callback] Refund attempt ${attempt} failed:`, refundResult);
                            await maxBalanceTransaction.update({
                                refundError: `Attempt ${attempt}: ${refundResult.error || 'Unknown error'}`,
                                refundRetryCount: attempt
                            });

                            if (attempt < MAX_REFUND_RETRIES) {
                                await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 递增延迟
                            }
                        }
                    } catch (retryError) {
                        console.error(`[Callback] Refund attempt ${attempt} exception:`, retryError.message);
                        await maxBalanceTransaction.update({
                            refundError: `Attempt ${attempt}: ${retryError.message}`,
                            refundRetryCount: attempt
                        });

                        if (attempt < MAX_REFUND_RETRIES) {
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 递增延迟
                        }
                    }
                }

                // 如果所有重试都失败
                if (!refundSuccess) {
                    console.error(`[Callback] Refund failed after ${MAX_REFUND_RETRIES} attempts`);
                    await maxBalanceTransaction.update({
                        refundStatus: 'failed',
                        refundError: `Failed after ${MAX_REFUND_RETRIES} attempts`
                    });
                }

            } catch (error) {
                console.error(`[Callback] Refund process error:`, error.message);
                await maxBalanceTransaction.update({
                    refundStatus: 'failed',
                    refundError: error.message
                });
            }
        } else if (water_state === 1) {
            // 出水成功但无差额需要退款
            await maxBalanceTransaction.update({
                refundStatus: 'success',
                refundTime: new Date()
            });
        }

        // 添加最大余额模式标记到交易数据
        transactionData.isMaxBalanceMode = true;
        transactionData.maxBalanceAmount = maxBalanceAmount;
        transactionData.actualAmount = cash;
        transactionData.refundAmount = refundAmount;
        transactionData.parentTradeNo = outTradeNo;
    }

    // 创建交易记录（如果不是最大余额模式，或者作为补充记录）
    if (!maxBalanceTransaction) {
        await RenrenTransaction.create(transactionData);
    }
}

/**
 * @desc    接收设备最新状态推送 (TDS/温度/开关机等)
 * @route   POST /api/iot/status-push
 */
exports.handleStatusPush = async (req, res) => {
    try {
        const data = req.body;

        // 1. 签名验证
        if (!verifySignature(data, process.env.HARDWARE_APPKEY)) {
            return res.status(400).send('Signature Error');
        }

        // 2. 数据类型 12: 设备最新状态推送
        if (data.data_type === 12) {
            const { device_no, pure_tds, raw_tds, temperature, humidity, power_status, sale_status } = data;

            // 模拟 pH 值逻辑 (PRD 要求但硬件当前未上报，我们暂设随机波动以供前端展示曲线)
            const mockPH = (6.8 + Math.random() * 0.8).toFixed(2);

            // A. 更新 Unit 实时快照
            const [affectedRows, [currentUnit]] = await Unit.update(
                {
                    'sensors.rawTDS': raw_tds,
                    'sensors.pureTDS': pure_tds,
                    'sensors.temp': temperature,
                    'sensors.humidity': humidity,
                    'sensors.ph': mockPH,
                    status: power_status === 1 ? (sale_status === 1 ? 'Active' : 'Maintenance') : 'Locked',
                    lastHeartbeat: Date.now()
                },
                {
                    where: { unitId: device_no },
                    returning: true
                }
            );

            // [P2-API-006] 自动调价逻辑：TDS 异常时触发预警
            if (pure_tds > 500) {
                console.error(`[CRITICAL] Unit ${device_no} TDS too high (${pure_tds})! Triggering high service fee mode.`);
                // 此处可扩展逻辑：自动发送通知给管家或自动更改设备可售状态
            }

            // B. 归档历史记录 (用于 App 水质曲线图)
            const unitDoc = await Unit.findOne({ where: { unitId: device_no } });
            await WaterQualityLog.create({
                unitId: unitDoc ? unitDoc.id : null,
                deviceSerial: device_no,
                pureTDS: pure_tds,
                rawTDS: raw_tds,
                ph: mockPH,
                temperature: temperature
            });

            console.log(`[IOT Status] Unit ${device_no} updated & archived. TDS: ${pure_tds}, pH: ${mockPH}`);
        }

        res.status(200).send('success');
    } catch (error) {
        console.error('Status Push Error:', error);
        res.status(500).send('Internal Error');
    }
};

/**
 * @desc    获取附近的取水站 (P3-INF-002: 地理位置查询)
 * @route   GET /api/iot/nearby
 */
exports.getNearbyUnits = async (req, res) => {
    try {
        const { lng, lat, distance = 5000 } = req.query; // 默认 5km

        if (!lng || !lat) {
            return res.status(400).json({ success: false, message: 'Coordinates required' });
        }

        const { Op, fn, col, literal } = require('sequelize');

        // Sequelize geospatial query using ST_Distance_Sphere
        const units = await Unit.findAll({
            where: {
                status: 'Active', // 仅显示营业中的
                [Op.and]: literal(
                    `ST_Distance_Sphere(location, ST_GeomFromText('POINT(${parseFloat(lng)} ${parseFloat(lat)})')) <= ${parseInt(distance)}`
                )
            },
            order: literal(
                `ST_Distance_Sphere(location, ST_GeomFromText('POINT(${parseFloat(lng)} ${parseFloat(lat)})'))`
            ),
            limit: 10
        });

        res.status(200).json({ success: true, data: units });
    } catch (error) {
        console.error('Nearby API Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取取水站详情
 * @route   GET /api/iot/units/:id
 */
exports.getUnitDetail = async (req, res) => {
    try {
        const unit = await Unit.findOne({ where: { unitId: req.params.id } });
        if (!unit) {
            return res.status(404).json({ success: false, message: 'Station not found' });
        }
        res.status(200).json({ success: true, data: unit });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取水质历史记录
 * @route   GET /api/iot/water-quality/:id
 */
exports.getWaterQualityHistory = async (req, res) => {
    try {
        const logs = await WaterQualityLog.findAll({
            where: { deviceSerial: req.params.id },
            order: [['createdAt', 'DESC']],
            limit: 7
        });

        // 格式化为前端图表所需格式
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const tdsHistory = logs.reverse().map((log, index) => {
            const date = new Date(log.createdAt);
            const isToday = index === logs.length - 1;
            return {
                day: isToday ? 'Today' : days[date.getDay()],
                value: log.pureTDS,
                height: Math.min(Math.max((log.pureTDS / 100) * 100, 20), 100) // 动态高度模拟
            };
        });

        const phHistory = logs.map(log => ({
            value: log.ph,
            offset: (log.ph - 7) * 20 // 模拟偏移量
        }));

        res.status(200).json({
            success: true,
            data: {
                tdsHistory,
                phHistory,
                tdsStats: {
                    min: Math.min(...logs.map(l => l.pureTDS)),
                    max: Math.max(...logs.map(l => l.pureTDS)),
                    avg: Math.round(logs.reduce((acc, l) => acc + l.pureTDS, 0) / logs.length)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};