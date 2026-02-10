// ATMWater-BACKEND/src/services/tcpServer.js
// TCP 服务器 - 处理硬件设备连接

const net = require('net');
const { User, PhysicalCard, Unit, Transaction } = require('../models');

// 存储所有活跃的设备连接
const deviceConnections = new Map();

// TCP 服务器配置
const TCP_PORT = process.env.TCP_PORT || 55036;
const HEARTBEAT_TIMEOUT = 180000; // 180秒超时 (硬件心跳间隔90秒 + 90秒容错)

// ========================================
// TCP 服务器
// ========================================
const server = net.createServer((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP] 🔌 New connection: ${clientId}`);

  // 立即发送连接确认（硬件协议要求）
  socket.write('CONNECT OK\n');
  console.log(`[TCP] ⬅️ [SERVER→HARDWARE] Sent: CONNECT OK`);

  let deviceId = null;
  let buffer = '';
  let heartbeatTimer = null;

  // 设置心跳超时检测
  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      console.log(`[TCP] ⏰ Heartbeat timeout: ${deviceId || clientId}`);
      socket.end();
    }, HEARTBEAT_TIMEOUT);
  };

  resetHeartbeat();

  // ========================================
  // 接收数据
  // ========================================
  socket.on('data', async (data) => {
    buffer += data.toString();

    // 处理多条消息（以 \n 分隔）
    const messages = buffer.split('\n');
    buffer = messages.pop(); // 保留不完整的消息

    for (const message of messages) {
      if (!message.trim()) continue;

      try {
        // 记录原始数据（用于调试）
        console.log(`[TCP] ➡️ [HARDWARE→SERVER] Received raw:`, JSON.stringify(message));
        console.log(`[TCP] 📏 Data length: ${message.length}, First 100 chars:`, message.substring(0, 100));

        // 清理数据：移除所有控制字符
        let cleanMessage = message.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

        // 提取JSON部分：硬件可能在JSON后面附加调试信息
        // 例如：{"Cmd":"GT","DId":"xxx"}GPRS reboot by GPRS_REBOOT!!!
        // 我们只需要JSON部分
        const jsonMatch = cleanMessage.match(/^(\{[^}]*\})/);
        if (jsonMatch) {
          cleanMessage = jsonMatch[1];
          console.log(`[TCP] 🧹 Extracted JSON:`, cleanMessage);
        } else {
          console.log(`[TCP] 🧹 Cleaned data:`, JSON.stringify(cleanMessage));
        }

        const cmd = JSON.parse(cleanMessage);
        console.log(`[TCP] ➡️ [HARDWARE→SERVER] Parsed command:`, cmd);

        const response = await handleCommand(cmd, socket);

        if (response) {
          const responseStr = JSON.stringify(response) + '\n';
          socket.write(responseStr);
          console.log(`[TCP] ⬅️ [SERVER→HARDWARE] Sending response:`, response);
          console.log(`[TCP] ⬅️ [SERVER→HARDWARE] Raw JSON sent:`, JSON.stringify(responseStr));
        }

        // 更新设备ID
        if (cmd.DId) {
          deviceId = cmd.DId;
          deviceConnections.set(deviceId, socket);
        }

        // 重置心跳计时器
        resetHeartbeat();

      } catch (error) {
        console.error(`[TCP] ❌ Parse error:`, error.message);
        console.error(`[TCP] ❌ Failed message:`, JSON.stringify(message));
        socket.write(JSON.stringify({
          Cmd: 'ER',
          Msg: 'Invalid JSON format'
        }) + '\n');
      }
    }
  });
  
  // ========================================
  // 连接关闭
  // ========================================
  socket.on('close', () => {
    console.log(`[TCP] 🔌 Connection closed: ${deviceId || clientId}`);
    if (deviceId) {
      deviceConnections.delete(deviceId);
      updateDeviceStatus(deviceId, 'Offline');
    }
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
  });
  
  // ========================================
  // 错误处理
  // ========================================
  socket.on('error', (error) => {
    console.error(`[TCP] ❌ Socket error (${deviceId || clientId}):`, error.message);
  });
});

// ========================================
// 指令处理函数
// ========================================
async function handleCommand(cmd, socket) {
  const { Cmd, DId } = cmd;

  switch (Cmd) {
    case 'GT': // GPRS测试/初始化（硬件启动时发送）
      return await handleGPRSTest(cmd);

    case 'AU': // 设备认证
      return await handleAuth(cmd);

    case 'HB': // 心跳
      return await handleHeartbeat(cmd);

    case 'WR': // 用水数据记录上报（硬件协议核心指令）
      return await handleWaterRecord(cmd);

    case 'Mk': // 制水记录
      return await handleMakeWater(cmd);

    case 'AddMoney': // 充值命令
      return await handleAddMoney(cmd);

    case 'OpenWater': // 扫码放水
      return await handleOpenWater(cmd);

    case 'SW': // 刷卡出水（保留兼容旧系统）
      return await handleSwipeWater(cmd);

    case 'DS': // 设备状态上报
      return await handleDeviceStatus(cmd);

    case 'WQ': // 水质数据上报
      return await handleWaterQuality(cmd);

    default:
      // 对不认识的命令返回 {ok}
      console.log(`[TCP] ⚠️ Unknown command: ${Cmd}, responding with {ok}`);
      return { ok: true };
  }
}

// ========================================
// GT - GPRS测试/初始化
// ========================================
async function handleGPRSTest(cmd) {
  const { DId } = cmd;

  console.log(`[TCP] 📡 GPRS test from device: ${DId}`);

  // 按照硬件工程师最新确认：Type应该是"PDF321"
  return {
    Cmd: 'GT',
    DId: DId,
    PTW: '',
    Type: 'PDF321'
  };
}

// ========================================
// AU - 设备认证
// ========================================
async function handleAuth(cmd) {
  const { DId, Type, Pwd, Ver } = cmd;

  try {
    // 查询设备
    const unit = await Unit.findOne({ where: { deviceId: DId } });

    if (!unit) {
      return {
        Cmd: 'AU',
        Result: 'Fail',
        Msg: 'Device not found'
      };
    }

    // 验证密码
    if (unit.password !== Pwd) {
      return {
        Cmd: 'AU',
        Result: 'Fail',
        Msg: 'Invalid password'
      };
    }

    // 更新设备状态和固件版本
    await unit.update({
      status: 'Online',
      lastHeartbeatAt: new Date(),
      firmwareVersion: Ver || null
    });

    console.log(`[TCP] ✅ Device authenticated: ${DId}, Version: ${Ver || 'Unknown'}`);

    // 返回服务器时间戳（硬件协议格式）
    return {
      Cmd: 'AU',
      Time: Math.floor(Date.now() / 1000)
    };

  } catch (error) {
    console.error('[TCP] Auth error:', error.message);
    return {
      Cmd: 'AU',
      Result: 'Fail',
      Msg: 'Server error'
    };
  }
}

// ========================================
// HB - 心跳
// ========================================
async function handleHeartbeat(cmd) {
  const { DId, Errs } = cmd;

  try {
    const updateData = {
      lastHeartbeatAt: new Date(),
      status: 'Online'
    };

    // 处理告警信息
    if (Errs && Array.isArray(Errs) && Errs.length > 0) {
      updateData.status = 'Error';
      updateData.errorCodes = JSON.stringify(Errs);
      console.log(`[TCP] ⚠️ Device errors: ${DId}`, Errs);
    } else {
      // 清除告警信息
      updateData.errorCodes = null;
    }

    // 更新设备心跳时间和状态
    await Unit.update(updateData, { where: { deviceId: DId } });

    // 返回简单响应（硬件协议格式）
    return {
      Cmd: 'HB'
    };

  } catch (error) {
    console.error('[TCP] Heartbeat error:', error.message);
    return null; // 心跳失败不返回错误
  }
}

// ========================================
// SW - 刷卡出水
// ========================================
async function handleSwipeWater(cmd) {
  const { DId, RFID, Vol, Price } = cmd;

  try {
    // 1. 查找设备
    const unit = await Unit.findOne({ where: { deviceId: DId } });
    if (!unit) {
      return {
        Cmd: 'SW',
        Result: 'Fail',
        Msg: 'Device not found'
      };
    }

    // 2. 查找用户（通过实体卡或虚拟卡）
    let user = null;
    let cardType = null;

    // 先查找实体卡
    const physicalCard = await PhysicalCard.findOne({
      where: { rfid: RFID, status: 'Active' },
      include: [{ model: User, as: 'user' }]
    });

    if (physicalCard && physicalCard.user) {
      user = physicalCard.user;
      cardType = 'Physical';
    } else {
      // 查找虚拟卡
      user = await User.findOne({ where: { virtualRfid: RFID } });
      cardType = 'Virtual';
    }

    if (!user) {
      return {
        Cmd: 'SW',
        Result: 'Fail',
        Msg: 'Card not found or not bound'
      };
    }

    // 3. 计算金额
    const volume = parseFloat(Vol) || 0;
    const pricePerLiter = parseFloat(Price) || unit.pricePerLiter;
    const amount = volume * pricePerLiter;

    // 4. 检查余额
    if (user.balance < amount) {
      return {
        Cmd: 'SW',
        Result: 'Fail',
        Msg: 'Insufficient balance',
        Balance: user.balance
      };
    }

    // 5. 扣款并创建交易记录
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - amount;

    await user.update({ balance: balanceAfter });

    const transaction = await Transaction.create({
      userId: user.id,
      unitId: unit.id,
      deviceId: DId,
      type: 'WaterPurchase',
      amount: amount,
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      volume: volume,
      pricePerLiter: pricePerLiter,
      rfid: RFID,
      cardType: cardType,
      status: 'Completed',
      completedAt: new Date()
    });

    console.log(`[TCP] ✅ Water dispensed: ${volume}L, User: ${user.phone}, Amount: ${amount}`);

    return {
      Cmd: 'SW',
      Result: 'OK',
      Balance: balanceAfter,
      TransactionId: transaction.id,
      Msg: 'Water dispensed successfully'
    };

  } catch (error) {
    console.error('[TCP] Swipe water error:', error.message);
    return {
      Cmd: 'SW',
      Result: 'Fail',
      Msg: 'Server error'
    };
  }
}

// ========================================
// DS - 设备状态上报
// ========================================
async function handleDeviceStatus(cmd) {
  const { DId, Status, ErrorCode } = cmd;

  try {
    const updateData = {
      lastHeartbeatAt: new Date()
    };

    if (Status) {
      updateData.status = Status;
    }

    await Unit.update(updateData, { where: { deviceId: DId } });

    return {
      Cmd: 'DS',
      Result: 'OK'
    };

  } catch (error) {
    console.error('[TCP] Device status error:', error.message);
    return null;
  }
}

// ========================================
// WQ - 水质数据上报
// ========================================
async function handleWaterQuality(cmd) {
  const { DId, TDS, Temp } = cmd;

  try {
    await Unit.update(
      {
        tdsValue: TDS,
        temperature: Temp,
        lastHeartbeatAt: new Date()
      },
      { where: { deviceId: DId } }
    );

    return {
      Cmd: 'WQ',
      Result: 'OK'
    };

  } catch (error) {
    console.error('[TCP] Water quality error:', error.message);
    return null;
  }
}

// ========================================
// WR - 用水数据记录上报 (硬件协议核心指令)
// ========================================
async function handleWaterRecord(cmd) {
  const { DId, TE, RFID, PWM, Money, FT, Tds, IDS, RE, Tmp } = cmd;

  try {
    // 1. 查找设备
    const unit = await Unit.findOne({ where: { deviceId: DId } });
    if (!unit) {
      return {
        Cmd: 'WR',
        RFID: RFID,
        RE: RE,
        RT: 'Fail',
        LeftL: '-1',
        LeftM: '-1',
        DayLmt: '-1'
      };
    }

    // 2. 查找用户（通过实体卡或虚拟卡）
    let user = null;
    let cardType = null;

    // 先查找实体卡
    const physicalCard = await PhysicalCard.findOne({
      where: { rfid: RFID, status: 'Active' },
      include: [{ model: User, as: 'user' }]
    });

    if (physicalCard && physicalCard.user) {
      user = physicalCard.user;
      cardType = 'Physical';
    } else {
      // 查找虚拟卡
      user = await User.findOne({ where: { virtualRfid: RFID } });
      cardType = 'Virtual';
    }

    if (!user) {
      return {
        Cmd: 'WR',
        RFID: RFID,
        RE: RE,
        RT: 'Fail',
        LeftL: '-1',
        LeftM: '-1',
        DayLmt: '-1'
      };
    }

    // 3. 计算水量（PWM脉冲数转换为升）
    const pulseCount = parseInt(PWM) || 0;
    const pulsePerLiter = parseFloat(unit.pulsePerLiter) || 1.0;
    const volume = pulseCount / pulsePerLiter;
    const amount = parseFloat(Money) || 0;

    // 4. 扣款
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - amount;

    // 注意：硬件已经出水，即使余额不足也要记录
    await user.update({ balance: balanceAfter });

    // 5. 创建交易记录
    const transaction = await Transaction.create({
      userId: user.id,
      unitId: unit.id,
      deviceId: DId,
      type: 'WaterPurchase',
      amount: amount,
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      volume: volume,
      pricePerLiter: volume > 0 ? amount / volume : 0,
      rfid: RFID,
      cardType: cardType,
      pulseCount: pulseCount,
      inputTds: parseInt(IDS) || null,
      outputTds: parseInt(Tds) || null,
      waterTemp: parseFloat(Tmp) || null,
      recordId: RE,
      dispensingTime: parseInt(FT) || null,
      status: 'Completed',
      completedAt: TE ? new Date(parseInt(TE)) : new Date()
    });

    // 6. 更新设备水质数据
    await unit.update({
      tdsValue: parseInt(Tds) || null,
      temperature: parseFloat(Tmp) || null,
      lastHeartbeatAt: new Date()
    });

    console.log(`[TCP] ✅ Water record: ${volume.toFixed(2)}L, User: ${user.phone}, Amount: ${amount}, Balance: ${balanceAfter}`);

    // 7. 返回响应（硬件协议格式）
    return {
      Cmd: 'WR',
      RFID: RFID,
      RE: RE,
      RT: 'OK',
      LeftL: '-1',  // 剩余升数（-1表示不限制）
      LeftM: balanceAfter.toString(),  // 剩余金额
      DayLmt: '-1'  // 每日限额（-1表示不限制）
    };

  } catch (error) {
    console.error('[TCP] Water record error:', error.message);
    return {
      Cmd: 'WR',
      RFID: RFID,
      RE: RE,
      RT: 'Fail',
      LeftL: '-1',
      LeftM: '-1',
      DayLmt: '-1'
    };
  }
}

// ========================================
// Mk - 制水记录
// ========================================
async function handleMakeWater(cmd) {
  const { DId, FT, PWM, TDS, IDS, RC } = cmd;

  try {
    const unit = await Unit.findOne({ where: { deviceId: DId } });

    if (!unit) {
      return {
        Cmd: 'Mk',
        RT: 'Fail',
        RC: RC
      };
    }

    // 更新设备水质信息
    await unit.update({
      tdsValue: parseInt(TDS) || null,
      lastHeartbeatAt: new Date()
    });

    console.log(`[TCP] ✅ Make water record: ${DId}, Time: ${FT}s, PWM: ${PWM}, TDS: ${TDS}`);

    return {
      Cmd: 'Mk',
      RT: 'OK',
      RC: RC
    };

  } catch (error) {
    console.error('[TCP] Make water error:', error.message);
    return {
      Cmd: 'Mk',
      RT: 'Fail',
      RC: RC
    };
  }
}

// ========================================
// AddMoney - 充值命令
// ========================================
async function handleAddMoney(cmd) {
  const { RFID, RE, LeftL, LeftM } = cmd;

  try {
    // 查找用户
    let user = null;
    const physicalCard = await PhysicalCard.findOne({
      where: { rfid: RFID, status: 'Active' },
      include: [{ model: User, as: 'user' }]
    });

    if (physicalCard && physicalCard.user) {
      user = physicalCard.user;
    } else {
      user = await User.findOne({ where: { virtualRfid: RFID } });
    }

    if (!user) {
      return {
        Cmd: 'AddMoney',
        RT: 'Fail',
        RC: RE
      };
    }

    // 充值或扣款
    const amount = parseFloat(LeftM) || 0;
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore + amount;

    await user.update({ balance: balanceAfter });

    // 创建交易记录
    await Transaction.create({
      userId: user.id,
      type: amount > 0 ? 'TopUp' : 'Withdrawal',
      amount: Math.abs(amount),
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      rfid: RFID,
      recordId: RE,
      status: 'Completed',
      completedAt: new Date()
    });

    console.log(`[TCP] ✅ Add money: ${RFID}, Amount: ${amount}, Balance: ${balanceAfter}`);

    return {
      Cmd: 'AddMoney',
      RT: 'OK',
      RC: RE
    };

  } catch (error) {
    console.error('[TCP] Add money error:', error.message);
    return {
      Cmd: 'AddMoney',
      RT: 'Fail',
      RC: RE
    };
  }
}

// ========================================
// OpenWater - 扫码放水
// ========================================
async function handleOpenWater(cmd) {
  const { RFID, Money, PWM, Type, RE } = cmd;

  try {
    // 查找用户（虚拟账户，以'w'开头）
    const user = await User.findOne({ where: { virtualRfid: RFID } });

    if (!user) {
      return {
        Cmd: 'OpenWater',
        RT: 'Fail',
        RC: RE
      };
    }

    const amount = parseFloat(Money) || 0;

    // 检查余额
    if (user.balance < amount) {
      return {
        Cmd: 'OpenWater',
        RT: 'Fail',
        RC: RE
      };
    }

    // 扣款
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - amount;

    await user.update({ balance: balanceAfter });

    // 创建交易记录
    await Transaction.create({
      userId: user.id,
      type: 'WaterPurchase',
      amount: amount,
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      rfid: RFID,
      pulseCount: parseInt(PWM) || null,
      recordId: RE,
      description: `Scan QR - ${Type}`,
      status: 'Completed',
      completedAt: new Date()
    });

    console.log(`[TCP] ✅ Open water: ${RFID}, Amount: ${amount}, Type: ${Type}, Balance: ${balanceAfter}`);

    return {
      Cmd: 'OpenWater',
      RT: 'OK',
      RC: RE
    };

  } catch (error) {
    console.error('[TCP] Open water error:', error.message);
    return {
      Cmd: 'OpenWater',
      RT: 'Fail',
      RC: RE
    };
  }
}

// ========================================
// 更新设备状态
// ========================================
async function updateDeviceStatus(deviceId, status) {
  try {
    await Unit.update(
      { status },
      { where: { deviceId } }
    );
  } catch (error) {
    console.error('[TCP] Update device status error:', error.message);
  }
}

// ========================================
// 启动 TCP 服务器
// ========================================
function start() {
  server.listen(TCP_PORT, '0.0.0.0', () => {
    console.log(`[TCP] ✅ Server listening on port ${TCP_PORT}`);
  });

  server.on('error', (error) => {
    console.error('[TCP] ❌ Server error:', error.message);
  });
}

// ========================================
// 停止 TCP 服务器
// ========================================
function stop() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log('[TCP] ✅ Server stopped');
      resolve();
    });
  });
}

// ========================================
// 导出
// ========================================
module.exports = {
  start,
  stop,
  deviceConnections
};

