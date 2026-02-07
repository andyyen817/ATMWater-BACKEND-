// ATMWater-BACKEND/src/services/tcpServer.js
// TCP 服务器 - 处理硬件设备连接

const net = require('net');
const { User, PhysicalCard, Unit, Transaction } = require('../models');

// 存储所有活跃的设备连接
const deviceConnections = new Map();

// TCP 服务器配置
const TCP_PORT = process.env.TCP_PORT || 55036;
const HEARTBEAT_TIMEOUT = 120000; // 120秒超时

// ========================================
// TCP 服务器
// ========================================
const server = net.createServer((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP] 📥 New connection: ${clientId}`);
  
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
        const cmd = JSON.parse(message);
        console.log(`[TCP] 📤 Received from ${deviceId || clientId}:`, cmd);
        
        const response = await handleCommand(cmd, socket);
        
        if (response) {
          socket.write(JSON.stringify(response) + '\n');
          console.log(`[TCP] 📥 Sent to ${deviceId || clientId}:`, response);
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
    case 'AU': // 设备认证
      return await handleAuth(cmd);
      
    case 'HB': // 心跳
      return await handleHeartbeat(cmd);
      
    case 'SW': // 刷卡出水
      return await handleSwipeWater(cmd);
      
    case 'DS': // 设备状态上报
      return await handleDeviceStatus(cmd);
      
    case 'WQ': // 水质数据上报
      return await handleWaterQuality(cmd);
      
    default:
      return {
        Cmd: 'ER',
        Msg: `Unknown command: ${Cmd}`
      };
  }
}

// ========================================
// AU - 设备认证
// ========================================
async function handleAuth(cmd) {
  const { DId, Type, Pwd } = cmd;
  
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
    
    // 更新设备状态
    await unit.update({
      status: 'Online',
      lastHeartbeatAt: new Date()
    });
    
    console.log(`[TCP] ✅ Device authenticated: ${DId}`);
    
    return {
      Cmd: 'AU',
      Result: 'OK',
      Msg: 'Authentication successful'
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
  const { DId } = cmd;
  
  try {
    // 更新设备心跳时间
    await Unit.update(
      { 
        lastHeartbeatAt: new Date(),
        status: 'Online'
      },
      { where: { deviceId: DId } }
    );
    
    return {
      Cmd: 'HB',
      Result: 'OK',
      ServerTime: new Date().toISOString()
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

