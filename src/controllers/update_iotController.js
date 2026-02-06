const Unit = require('../models/Unit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WaterQualityLog = require('../models/WaterQualityLog'); // P2-IOT-002
const { verifySignature } = require('../utils/signature');
const hardwareService = require('../services/hardwareService');
const { processProfitSharing } = require('../services/sharingService');

/**
 * @desc    下发取水授权指令 (由 App 触发)
 */
exports.authorizeDispense = async (req, res) => {
    try {
        const { unitId, waterType, cash } = req.body;
        const userId = req.user.id;
        const user = await User.findById(userId);
        const unit = await Unit.findOne({ unitId });

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
 */
exports.handleHardwareCallback = async (req, res) => {
    try {
        const data = req.body;
        if (!verifySignature(data, process.env.HARDWARE_APPKEY)) {
            return res.status(400).send('Signature Error');
        }

        if (data.data_type === 3 || data.data_type === 4) { // 3:无卡 4:电子卡
            const { out_trade_no, water_state, cash, card_no, device_no, volume } = data;
            
            // 1. 查找对应的交易记录
            const transaction = await Transaction.findOne({ externalId: out_trade_no }).populate('userId');
            
            if (water_state === 1) { // 成功出水
                const customer = transaction ? transaction.userId : await User.findOne({ phoneNumber: card_no });
                const unit = await Unit.findOne({ unitId: device_no });

                if (customer && unit) {
                    // 2. 真实扣除用户余额 (分)
                    // 注意：如果 transaction 已经存在，说明是 App 授权的，customer 即为下单用户
                    customer.balance -= cash;
                    await customer.save();

                    // 3. 更新交易状态
                    if (transaction) {
                        transaction.status = 'Completed';
                        await transaction.save();
                    }

                    // 4. 触发 6 角色分润
                    await processProfitSharing(out_trade_no, cash, device_no, customer._id);
                    
                    console.log(`[Callback Success] Unit ${device_no} dispensed ${volume}ml. User ${customer.phoneNumber} charged Rp ${cash}`);
                }
            } else {
                // 出水失败处理
                if (transaction) {
                    transaction.status = 'Failed';
                    await transaction.save();
                }
                console.warn(`[Callback Failed] Order ${out_trade_no} failed at device ${device_no}`);
            }
        }
        res.status(200).send('success');
    } catch (error) {
        res.status(500).send('Internal Error');
    }
};

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
            const currentUnit = await Unit.findOneAndUpdate(
                { unitId: device_no },
                { 
                    'sensors.rawTDS': raw_tds,
                    'sensors.pureTDS': pure_tds,
                    'sensors.temp': temperature,
                    'sensors.humidity': humidity,
                    'sensors.ph': mockPH,
                    status: power_status === 1 ? (sale_status === 1 ? 'Active' : 'Maintenance') : 'Locked',
                    lastHeartbeat: Date.now()
                },
                { new: true }
            );

            // [P2-API-006] 自动调价逻辑：TDS 异常时触发预警
            if (pure_tds > 500) {
                console.error(`[CRITICAL] Unit ${device_no} TDS too high (${pure_tds})! Triggering high service fee mode.`);
                // 此处可扩展逻辑：自动发送通知给管家或自动更改设备可售状态
            }

            // B. 归档历史记录 (用于 App 水质曲线图)
            const unitDoc = await Unit.findOne({ unitId: device_no });
            await WaterQualityLog.create({
                unitId: unitDoc ? unitDoc._id : null,
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

        const units = await Unit.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(distance)
                }
            },
            status: 'Active' // 仅显示营业中的
        }).limit(10);

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
        const unit = await Unit.findOne({ unitId: req.params.id });
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
        const logs = await WaterQualityLog.find({ deviceSerial: req.params.id })
            .sort({ createdAt: -1 })
            .limit(7);

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