const { User, Unit, Transaction } = require('../models');
const { parseAndValidateQR } = require('../utils/qrcode');
const { sendCommandToDevice, isDeviceConnected } = require('../services/tcpServer');
const websocketService = require('../services/websocketService');
const { getUnitPricing } = require('../services/profitSharing/regionalPricingService');

/**
 * POST /api/iot/dispense/qr
 * 扫码取水核心接口
 * Body: { qrCode?, deviceId?, waterType: 'pure'|'mineral', amount (升) }
 * 支持两种模式：1) 扫码传 qrCode  2) 手动输入传 deviceId
 */
exports.dispenseByQR = async (req, res) => {
  const { qrCode, waterType, amount, deviceId: directDeviceId } = req.body;
  const userId = req.user.id;

  try {
    // 1. 解析设备ID：优先用 directDeviceId（手动输入），否则从 QR 码解析
    let targetDeviceId = null;

    if (directDeviceId) {
      targetDeviceId = directDeviceId;
    } else if (qrCode) {
      const qrResult = parseAndValidateQR(qrCode);
      if (!qrResult.valid) {
        return res.status(400).json({ success: false, message: qrResult.error });
      }
      targetDeviceId = qrResult.deviceId;
    } else {
      return res.status(400).json({ success: false, message: 'Missing qrCode or deviceId' });
    }

    // 2. 查找设备
    const unit = await Unit.findOne({ where: { deviceId: targetDeviceId } });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    // 3. 检查设备在线（本地 TCP 连接 OR 数据库状态为 Online）
    const tcpConnected = isDeviceConnected(targetDeviceId);
    const dbOnline = unit.status && unit.status.toLowerCase() === 'online';
    console.log(`[QR Dispense] 🔍 Device check: targetDeviceId=${targetDeviceId}, tcpConnected=${tcpConnected}, dbStatus=${unit.status}, dbOnline=${dbOnline}`);
    if (!tcpConnected && !dbOnline) {
      return res.status(503).json({
        success: false,
        message: 'Device is offline',
        code: 'DEVICE_OFFLINE'
      });
    }

    // 4. 查找用户
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 4.1 确保 virtualRfid 存在（兼容旧用户）
    if (!user.virtualRfid && user.phoneNumber) {
      const vRfid = `VIRT_${user.phoneNumber}`;
      await user.update({ virtualRfid: vRfid });
      console.log(`[QR Dispense] Auto-generated virtualRfid for user ${userId}: ${vRfid}`);
    }

    // 5. 获取区域定价
    const pricing = await getUnitPricing(targetDeviceId);
    const pricePerLiter = waterType === 'pure'
      ? pricing.pureWaterPrice
      : pricing.mineralWaterPrice;
    const totalCost = amount * pricePerLiter;

    // 6. 检查余额
    const userBalance = parseFloat(user.balance) || 0;
    if (userBalance < totalCost) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        data: { balance: userBalance, required: totalCost }
      });
    }

    // 7. 计算 PWM 脉冲数
    const pulsePerLiter = parseFloat(unit.pulsePerLiter) || 1.0;
    const pwm = Math.round(amount * pulsePerLiter);

    // 8. 生成 recordId
    const recordId = `QR_${Date.now()}_${userId}`;

    // 9. 预扣款
    const balanceBefore = userBalance;
    const balanceAfter = balanceBefore - totalCost;
    await user.update({ balance: balanceAfter });

    // 10. 创建 Pending 交易
    const transaction = await Transaction.create({
      userId: user.id,
      unitId: unit.id,
      deviceId: targetDeviceId,
      type: 'WaterPurchase',
      amount: totalCost,
      balanceBefore,
      balanceAfter,
      volume: amount,
      pricePerLiter,
      pulseCount: pwm,
      rfid: user.virtualRfid,
      cardType: 'Virtual',
      recordId,
      status: 'Pending',
      description: `QR Scan - ${waterType === 'pure' ? 'RO' : 'UF'}`
    });

    // 11. 发送 OpenWater TCP 命令
    const hwType = waterType === 'pure' ? 'RO' : 'UF';
    console.log(`[QR Dispense] 🔍 About to send OpenWater: tcpConnected=${tcpConnected}, deviceId=${targetDeviceId}, RFID=${user.virtualRfid}, Type=${hwType}, PWM=${pwm}, RE=${recordId}`);
    if (tcpConnected) {
      // 设备直连本地 TCP，直接发送命令
      try {
        await sendCommandToDevice(targetDeviceId, {
          Cmd: 'OpenWater',
          RFID: user.virtualRfid,
          Money: totalCost.toFixed(2),
          PWM: pwm.toString(),
          Type: hwType,
          RE: recordId
        });
      } catch (tcpError) {
        // 回滚：退款 + 标记交易失败
        await user.update({ balance: balanceBefore });
        await transaction.update({ status: 'Failed' });
        return res.status(503).json({
          success: false,
          message: 'Failed to communicate with device',
          code: 'TCP_SEND_FAILED'
        });
      }
    } else {
      // 设备连在其他后端实例（云端 TCP），本地无法发送命令
      // 回滚：退款 + 标记交易失败
      await user.update({ balance: balanceBefore });
      await transaction.update({ status: 'Failed' });
      return res.status(503).json({
        success: false,
        message: 'Device connected to cloud server, please use cloud API',
        code: 'DEVICE_ON_REMOTE_TCP'
      });
    }

    // 12. WebSocket 推送出水状态
    websocketService.broadcast({
      type: 'dispense_status',
      data: {
        orderId: transaction.id,
        status: 'dispensing',
        deviceId: targetDeviceId,
        userId,
        amount,
        cost: totalCost
      }
    });

    // 13. 5分钟安全超时（正常情况下 WR 回传会在几秒内完成订单）
    // 如果超时仍为 Pending，说明硬件未回传 WR，回滚退款
    setTimeout(async () => {
      try {
        const tx = await Transaction.findByPk(transaction.id);
        if (tx && tx.status === 'Pending') {
          await tx.update({ status: 'Failed' });
          const u = await User.findByPk(tx.userId);
          if (u) await u.update({ balance: parseFloat(u.balance) + totalCost });
          websocketService.broadcast({
            type: 'dispense_status',
            data: { orderId: tx.id, status: 'failed' }
          });
          console.log(`[QR Dispense] Timeout: order ${tx.id} failed, refunded ${totalCost}`);
        }
      } catch (err) {
        console.error('[QR Dispense] Timeout handler error:', err.message);
      }
    }, 300000);

    // 14. 返回结果
    return res.status(200).json({
      success: true,
      data: {
        orderId: transaction.id,
        status: 'dispensing',
        amount,
        cost: totalCost,
        balance: balanceAfter,
        deviceId: targetDeviceId,
        waterType
      }
    });

  } catch (error) {
    console.error('[QR Dispense] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/iot/device-status/:deviceId
 * 检查设备在线状态（扫码后立即调用）
 */
exports.getDeviceOnlineStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const tcpConnected = isDeviceConnected(deviceId);
    const unit = await Unit.findOne({
      where: { deviceId },
      attributes: ['deviceId', 'deviceName', 'status', 'location', 'tdsValue', 'temperature']
    });

    if (!unit) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    // 设备在线判断：本地 TCP 连接 OR 数据库状态为 Online/online
    const dbOnline = unit.status && unit.status.toLowerCase() === 'online';
    const online = tcpConnected || dbOnline;

    return res.json({
      success: true,
      data: {
        deviceId,
        online,
        deviceName: unit.deviceName,
        location: unit.location,
        status: unit.status,
        tdsValue: unit.tdsValue,
        temperature: unit.temperature
      }
    });
  } catch (error) {
    console.error('[Device Status] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/iot/dispense/:orderId
 * 查询取水订单状态（断网重连后用）
 */
exports.getDispenseStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const transaction = await Transaction.findByPk(orderId, {
      attributes: ['id', 'status', 'amount', 'volume', 'deviceId', 'description', 'completedAt', 'createdAt']
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({
      success: true,
      data: {
        orderId: transaction.id,
        status: transaction.status === 'Completed' ? 'completed'
          : transaction.status === 'Failed' ? 'failed'
          : 'dispensing',
        amount: transaction.volume,
        cost: transaction.amount,
        deviceId: transaction.deviceId,
        completedAt: transaction.completedAt,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('[Dispense Status] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
