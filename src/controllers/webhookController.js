const { verifySignature } = require('../utils/signature');
const Transaction = require('../models/Transaction');
const RenrenTransaction = require('../models/RenrenTransaction');
const RenrenCard = require('../models/RenrenCard');
const Unit = require('../models/Unit');
const websocketService = require('../services/websocketService');

/**
 * 验证人人水站Webhook签名
 */
function verifyWebhookSignature(params) {
    const { sign, ...rest } = params;
    if (!sign) return false;

    // 使用人人水站的APPKEY验证
    const APPKEY = process.env.HARDWARE_APPKEY || '6f69164cc4134b54c7d8bae46866a0e0';

    // 按字母顺序排序
    const sortedKeys = Object.keys(rest).sort();
    const stringA = sortedKeys
        .map(key => `${key}=${rest[key]}`)
        .join('&');
    const stringSignTemp = `${stringA}&appkey=${APPKEY}`;
    const calculatedSign = require('crypto')
        .createHash('md5')
        .update(stringSignTemp)
        .digest('hex')
        .toUpperCase();

    return calculatedSign === sign;
}

/**
 * @desc    接收交易通知
 * @route   POST /api/webhook/trade
 */
exports.receiveTradeNotification = async (req, res) => {
    try {
        const data = req.body;

        console.log('[Webhook] Trade notification received:', data);

        // 验证签名
        if (!verifyWebhookSignature(data)) {
            console.error('[Webhook] Invalid signature for trade notification');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        // 处理交易数据
        const transactionData = {
            deviceNo: data.device_no,
            cardNo: data.card_no,
            waterTime: new Date(data.water_time || Date.now()),
            waterState: data.water_state, // 1-成功 2-失败
            cash: data.cash,
            startBalance: data.start_balance,
            endBalance: data.end_balance,
            price: data.price,
            volume: data.volume,
            outlet: data.outlet,
            outTradeNo: data.out_trade_no
        };

        // 保存到 RenrenTransaction 数据库
        console.log('[Webhook] Processing trade:', transactionData);

        try {
            // 检查交易是否已存在
            let transaction = await RenrenTransaction.findOne({ outTradeNo: data.out_trade_no });

            if (!transaction) {
                // 创建新交易记录
                transaction = new RenrenTransaction({
                    outTradeNo: data.out_trade_no,
                    tradeNo: data.trade_no || '',
                    deviceNo: data.device_no,
                    cardNo: data.card_no,
                    waterTime: new Date(data.water_time || Date.now()),
                    waterState: data.water_state, // 1-成功 2-失败
                    cash: data.cash || 0,
                    startBalance: data.start_balance || 0,
                    endBalance: data.end_balance || 0,
                    price: data.price || 0,
                    volume: data.volume || 0,
                    outlet: data.outlet || 1,
                    tradePayType: data.trade_pay_type || 3, // 默认现金
                    syncStatus: 1, // 同步成功
                    createTime: data.create_time ? new Date(data.create_time) : new Date(),
                    syncTime: new Date(),
                    successTime: data.water_state === 1 ? new Date() : null
                });

                await transaction.save();
                console.log('[Webhook] Transaction saved to database:', transaction.outTradeNo);

                // 同步更新卡片余额
                const card = await RenrenCard.findOne({ cardNo: data.card_no });
                if (card) {
                    card.balance = data.end_balance || card.balance;
                    card.lastSyncTime = new Date();
                    await card.save();
                    console.log('[Webhook] Card balance updated:', card.cardNo);

                    // 通过WebSocket推送卡片更新
                    websocketService.sendCardUpdate(card.cardNo, {
                        cardNo: card.cardNo,
                        balance: card.balance,
                        realBalance: card.realBalance,
                        endBalance: data.end_balance,
                        cash: data.cash,
                        deviceNo: data.device_no,
                        waterTime: data.water_time
                    });
                }
            } else {
                console.log('[Webhook] Transaction already exists, skipping:', transaction.outTradeNo);
            }
        } catch (dbError) {
            console.error('[Webhook] Database error:', dbError.message);
            // 继续执行，不中断Webhook响应
        }

        // 通过WebSocket推送交易更新
        websocketService.sendTransactionUpdate(transactionData);

        // 发送系统通知
        websocketService.sendNotification(
            'success',
            `新交易: ${data.device_no} - ${data.cash / 100}元`
        );

        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        console.error('[Webhook] Error processing trade notification:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    接收订单通知
 * @route   POST /api/webhook/order
 */
exports.receiveOrderNotification = async (req, res) => {
    try {
        const data = req.body;

        console.log('[Webhook] Order notification received:', data);

        // 验证签名
        if (!verifyWebhookSignature(data)) {
            console.error('[Webhook] Invalid signature for order notification');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        // 处理订单数据
        const orderData = {
            deviceNo: data.device_no,
            cardNo: data.card_no,
            waterTime: new Date(data.water_time || Date.now()),
            waterState: data.water_state,
            cash: data.cash,
            startBalance: data.start_balance,
            endBalance: data.end_balance,
            price: data.price,
            volume: data.volume,
            outlet: data.outlet
        };

        console.log('[Webhook] Processing order:', orderData);

        // 通过WebSocket推送订单更新
        websocketService.sendTransactionUpdate(orderData);

        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        console.error('[Webhook] Error processing order notification:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    接收设备状态通知
 * @route   POST /api/webhook/device-status
 */
exports.receiveDeviceStatusNotification = async (req, res) => {
    try {
        const data = req.body;

        console.log('[Webhook] Device status notification received:', data);

        // 验证签名
        if (!verifyWebhookSignature(data)) {
            console.error('[Webhook] Invalid signature for device status notification');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        // 更新本地数据库中的设备状态
        const unit = await Unit.findOne({ unitId: data.device_no });

        if (unit) {
            unit.status = data.type === 1 ? 'Active' : 'Offline';
            unit.lastHeartbeat = new Date(data.create_time || Date.now());
            await unit.save();

            // 通过WebSocket推送设备更新
            websocketService.sendDeviceUpdate(data.device_no, {
                unitId: data.device_no,
                status: unit.status,
                lastHeartbeat: unit.lastHeartbeat
            });
        }

        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        console.error('[Webhook] Error processing device status notification:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    接收水质数据通知
 * @route   POST /api/webhook/water-quality
 */
exports.receiveWaterQualityNotification = async (req, res) => {
    try {
        const data = req.body;

        console.log('[Webhook] Water quality notification received:', data);

        // 验证签名
        if (!verifyWebhookSignature(data)) {
            console.error('[Webhook] Invalid signature for water quality notification');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        // 更新本地数据库中的设备传感器数据
        const unit = await Unit.findOne({ unitId: data.device_no });

        if (unit) {
            unit.sensors = {
                rawTDS: data.raw_tds || unit.sensors?.rawTDS || 0,
                pureTDS: data.pure_tds || unit.sensors?.pureTDS || 0,
                temp: data.temperature || unit.sensors?.temp || 25,
                humidity: data.humidity || unit.sensors?.humidity || 50
            };

            // 更新设备状态
            if (data.miss_status === 1) unit.status = 'Maintenance'; // 缺水
            if (data.full_status === 1) unit.status = 'Maintenance'; // 满水
            if (data.make_status === 0) unit.status = 'Active'; // 停止制水

            unit.lastHeartbeat = new Date();
            await unit.save();

            // 通过WebSocket推送设备更新
            websocketService.sendDeviceUpdate(data.device_no, {
                unitId: data.device_no,
                status: unit.status,
                sensors: unit.sensors,
                lastHeartbeat: unit.lastHeartbeat
            });

            // 发送系统通知
            websocketService.sendNotification(
                'info',
                `水质更新: ${data.device_no} - TDS:${data.pure_tds}`
            );
        }

        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        console.error('[Webhook] Error processing water quality notification:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    接收滤芯数据通知
 * @route   POST /api/webhook/filter
 */
exports.receiveFilterNotification = async (req, res) => {
    try {
        const data = req.body;

        console.log('[Webhook] Filter notification received:', data);

        // 验证签名
        if (!verifyWebhookSignature(data)) {
            console.error('[Webhook] Invalid signature for filter notification');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        // 保存滤芯数据到数据库
        // 需要创建Filter模型来存储滤芯数据
        console.log('[Webhook] Processing filter data for device:', data.device_no);

        // 通过WebSocket推送滤芯更新
        websocketService.sendNotification(
            'info',
            `滤芯更新: ${data.device_no}`
        );

        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        console.error('[Webhook] Error processing filter notification:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    接收设备在线状态通知
 * @route   POST /api/webhook/device-online
 */
exports.receiveDeviceOnlineNotification = async (req, res) => {
    try {
        const data = req.body;

        console.log('[Webhook] Device online notification received:', data);

        // 验证签名
        if (!verifyWebhookSignature(data)) {
            console.error('[Webhook] Invalid signature for device online notification');
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        // 更新本地数据库中的设备在线状态
        const unit = await Unit.findOne({ unitId: data.device_no });

        if (unit) {
            unit.status = data.is_online === 1 ? 'Active' : 'Offline';
            unit.lastHeartbeat = new Date();
            await unit.save();

            // 通过WebSocket推送设备更新
            websocketService.sendDeviceUpdate(data.device_no, {
                unitId: data.device_no,
                status: unit.status,
                lastHeartbeat: unit.lastHeartbeat
            });
        }

        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        console.error('[Webhook] Error processing device online notification:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    Webhook健康检查（用于人人水站验证Webhook URL）
 * @route   GET /api/webhook/health
 */
exports.webhookHealth = (req, res) => {
    res.status(200).json({ success: true, message: 'Webhook endpoint is active' });
};
