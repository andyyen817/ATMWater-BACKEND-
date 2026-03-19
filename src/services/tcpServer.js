// ATMWater-BACKEND/src/services/tcpServer.js
// TCP 服务器 - 处理硬件设备连接

const net = require('net');
const { User, PhysicalCard, Unit, Transaction, FirmwareVersion, UpgradeTask } = require('../models');
const websocketService = require('./websocketService');
const { calculateCRC8, splitFileIntoPackets } = require('../utils/crcUtils');

// 存储所有活跃的设备连接
const deviceConnections = new Map();

// 存储升级会话状态
const upgradeSessions = new Map();

// TCP 服务器配置
const TCP_PORT = process.env.TCP_PORT || 55036;
const HEARTBEAT_TIMEOUT = 180000; // 180秒超时 (硬件心跳间隔90秒 + 90秒容错)

// ========================================
// 时间戳工具函数
// ========================================
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function log(...args) {
  console.log(`[${getTimestamp()}]`, ...args);
}

function logError(...args) {
  console.error(`[${getTimestamp()}]`, ...args);
}

// ========================================
// TCP 服务器
// ========================================
const server = net.createServer((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  log(`[TCP] 🔌 New connection: ${clientId}`);

  // 【优化1】禁用Nagle算法，确保数据立即发送（不等待缓冲区满）
  socket.setNoDelay(true);
  log(`[TCP] ⚙️ Socket configured: NoDelay=true (Nagle disabled)`);

  // 第1步：连接云平台 - 立即发送CONNECT OK
  // 设备等待60秒才发GT，说明它在等待CONNECT OK
  // 使用\r\n结尾（GPRS模块标准格式）
  const connectTime = Date.now();
  const connectOkData = 'CONNECT OK\r\n';

  log(`[TCP] 📤 Preparing to send CONNECT OK`);
  log(`[TCP] 📤 CONNECT OK hex:`, Buffer.from(connectOkData).toString('hex'));
  log(`[TCP] 📤 CONNECT OK length:`, connectOkData.length);

  socket.write(connectOkData, (err) => {
    const sendTime = Date.now() - connectTime;
    if (err) {
      logError(`[TCP] ❌ Failed to send CONNECT OK:`, err);
      logError(`[TCP] ❌ Error code:`, err.code);
      logError(`[TCP] ❌ Error stack:`, err.stack);
    } else {
      log(`[TCP] ✅ CONNECT OK sent successfully (${sendTime}ms)`);
      log(`[TCP] ✅ Socket writable:`, socket.writable);
      log(`[TCP] ✅ Socket buffered bytes:`, socket.bufferSize);
    }
  });
  log(`[TCP] ⬅️ [SERVER→HARDWARE] Sending: CONNECT OK (with \\r\\n)`);

  let deviceId = null;
  let buffer = '';
  let heartbeatTimer = null;
  let isAuthenticated = false; // 标记设备是否已认证

  // 设置心跳超时检测
  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      log(`[TCP] ⏰ Heartbeat timeout: ${deviceId || clientId}`);
      socket.end();
    }, HEARTBEAT_TIMEOUT);
  };

  // 【方案2】不在连接时启动心跳超时
  // 只在AU认证成功后才启动心跳超时检测
  // 这样设备有足够时间发送GT和AU命令
  log(`[TCP] ⏳ Waiting for device authentication (GT → AU)...`);

  // 添加Socket状态监控
  socket.on('drain', () => {
    log(`[TCP] 💧 Socket drain event - write buffer emptied`);
  });

  socket.on('timeout', () => {
    log(`[TCP] ⏰ Socket timeout event`);
  });

  socket.on('end', () => {
    log(`[TCP] 🔚 Socket end event - other end sent FIN`);
  });

  // 每30秒报告一次连接状态
  const statusInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - connectTime) / 1000);
    log(`[TCP] 📊 Status report (${elapsed}s since connect):`);
    log(`[TCP] 📊   - Socket writable:`, socket.writable);
    log(`[TCP] 📊   - Socket readable:`, socket.readable);
    log(`[TCP] 📊   - Socket destroyed:`, socket.destroyed);
    log(`[TCP] 📊   - Bytes written:`, socket.bytesWritten);
    log(`[TCP] 📊   - Bytes read:`, socket.bytesRead);
    log(`[TCP] 📊   - Device ID:`, deviceId || 'Not set');
    log(`[TCP] 📊   - Authenticated:`, isAuthenticated);
  }, 30000);

  // ========================================
  // 接收数据
  // ========================================
  socket.on('data', async (data) => {
    const receiveTime = Date.now();
    const timeSinceConnect = receiveTime - connectTime;

    log(`[TCP] 📥 Data received after ${timeSinceConnect}ms (${Math.floor(timeSinceConnect/1000)}s) from connection`);
    log(`[TCP] 📥 Data length:`, data.length);
    log(`[TCP] 📥 Data hex:`, data.toString('hex'));
    log(`[TCP] 📥 Data string:`, JSON.stringify(data.toString()));

    buffer += data.toString();

    // 处理多条消息（以 \n 分隔）
    const messages = buffer.split('\n');
    buffer = messages.pop(); // 保留不完整的消息

    // 【修复】如果buffer中有完整的JSON但没有换行符，也要处理
    // 检查buffer是否包含完整的JSON对象
    if (buffer.trim() && buffer.includes('{') && buffer.includes('}')) {
      const jsonTest = buffer.match(/\{[^}]*\}/);
      if (jsonTest) {
        log(`[TCP] 🔧 Found complete JSON in buffer without newline, processing it`);
        messages.push(buffer);
        buffer = '';
      }
    }

    for (const message of messages) {
      if (!message.trim()) continue;

      try {
        // 记录原始数据（用于调试）
        log(`[TCP] ➡️ [HARDWARE→SERVER] Received raw:`, JSON.stringify(message));
        log(`[TCP] 📏 Data length: ${message.length}, First 100 chars:`, message.substring(0, 100));

        // 清理数据：移除所有控制字符
        let cleanMessage = message.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

        // 提取所有JSON对象：硬件可能在一条消息中发送多个JSON
        // 例如：{"Cmd":"GT","DId":"xxx"}{"Cmd":"AU","DId":"xxx","Pwd":"pudow"}
        // 使用全局匹配提取所有JSON对象
        const jsonMatches = cleanMessage.match(/\{[^}]*\}/g);

        log(`[TCP] 🧹 Original message length:`, message.length);
        log(`[TCP] 🧹 Clean message length:`, cleanMessage.length);
        log(`[TCP] 🧹 Clean message:`, JSON.stringify(cleanMessage));

        if (jsonMatches && jsonMatches.length > 0) {
          log(`[TCP] 🧹 Found ${jsonMatches.length} JSON object(s) in message`);

          jsonMatches.forEach((json, index) => {
            log(`[TCP] 🧹 JSON[${index}]:`, json);
          });

          // 处理每个JSON对象
          for (const jsonStr of jsonMatches) {
            try {
              const cmd = JSON.parse(jsonStr);
              log(`[TCP] ➡️ [HARDWARE→SERVER] Parsed command:`, cmd);

              // 【优化4】记录命令处理开始时间
              const cmdStartTime = Date.now();

              const response = await handleCommand(cmd, socket, deviceId);

              // 【优化4】记录命令处理耗时
              const cmdProcessTime = Date.now() - cmdStartTime;
              log(`[TCP] ⏱️ Command processing time: ${cmdProcessTime}ms`);

              // 【方案2】如果是AU认证成功，启动心跳超时
              if (cmd.Cmd === 'AU' && response && response.Time) {
                if (!isAuthenticated) {
                  isAuthenticated = true;
                  resetHeartbeat();
                  log(`[TCP] ✅ Authentication successful, heartbeat timeout started (${HEARTBEAT_TIMEOUT/1000}s)`);
                }
              }

              // 【方案2】如果已认证，每次收到消息都重置心跳
              if (isAuthenticated && cmd.Cmd === 'HB') {
                resetHeartbeat();
              }

              if (response) {
                // 使用\r\n作为行尾符（与GPRS模块格式一致）
                const responseStr = JSON.stringify(response) + '\r\n';

                // 【优化2】记录响应发送开始时间
                const sendStartTime = Date.now();

                // 【优化2】添加回调确认发送成功
                socket.write(responseStr, (err) => {
                  const sendTime = Date.now() - sendStartTime;
                  if (err) {
                    logError(`[TCP] ❌ Failed to send response:`, err);
                  } else {
                    log(`[TCP] ✅ Response sent successfully (${sendTime}ms)`);
                  }
                });

                log(`[TCP] ⬅️ [SERVER→HARDWARE] Sending response:`, response);
                log(`[TCP] ⬅️ [SERVER→HARDWARE] Raw JSON sent:`, JSON.stringify(responseStr));
                log(`[TCP] ⏱️ Total response time (process + send): ${Date.now() - cmdStartTime}ms`);
              }

              // 更新设备ID
              if (cmd.DId) {
                // 构造完整的deviceId：IMEI + "0001"
                deviceId = cmd.DId + '0001';
                deviceConnections.set(deviceId, socket);
                log(`[TCP] 📱 Device ID constructed: ${deviceId} (IMEI: ${cmd.DId})`);
              }

              // 【方案2】不在这里重置心跳，只在AU认证成功和HB心跳时重置

            } catch (parseError) {
              logError(`[TCP] ❌ Failed to parse JSON object:`, jsonStr);
              logError(`[TCP] ❌ Parse error:`, parseError.message);
            }
          }
        } else {
          // 没有找到JSON对象
          log(`[TCP] ⚠️ No JSON object found in message:`, cleanMessage);
        }

      } catch (error) {
        logError(`[TCP] ❌ Message processing error:`, error.message);
        logError(`[TCP] ❌ Failed message:`, JSON.stringify(message));
      }
    }
  });
  
  // ========================================
  // 连接关闭
  // ========================================
  socket.on('close', () => {
    log(`[TCP] 🔌 Connection closed: ${deviceId || clientId}`);
    if (deviceId) {
      deviceConnections.delete(deviceId);
      updateDeviceStatus(deviceId, 'Offline');

      // 推送设备离线状态到前端
      websocketService.sendDeviceUpdate(deviceId, {
        status: 'Offline',
        disconnectedAt: new Date()
      });
    }
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    clearInterval(statusInterval); // 清理状态报告定时器
  });

  // ========================================
  // 错误处理
  // ========================================
  socket.on('error', (error) => {
    logError(`[TCP] ❌ Socket error (${deviceId || clientId}):`, error.message);
  });
});

// ========================================
// 指令处理函数
// ========================================
async function handleCommand(cmd, socket, deviceId) {
  const { Cmd, DId } = cmd;

  switch (Cmd) {
    case 'GT': // GPRS测试/初始化（硬件启动时发送）
      return await handleGPRSTest(cmd, socket);

    case 'AU': // 设备认证
      return await handleAuth(cmd);

    case 'HB': // 心跳
      return await handleHeartbeat(cmd);

    case 'WR': // 用水数据记录上报（硬件协议核心指令）
      return await handleWaterRecord(cmd, deviceId);

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

    case 'ACK': // 升级确认
      return await handleUpgradeAck(cmd, deviceId);

    case 'VerReq': // 请求固件数据包
      return await handleVerReq(cmd, socket, deviceId);

    default:
      // 对不认识的命令返回 {ok}
      log(`[TCP] ⚠️ Unknown command: ${Cmd}, responding with {ok}`);
      return { ok: true };
  }
}

// ========================================
// GT - GPRS测试/初始化（第2步）
// ========================================
async function handleGPRSTest(cmd) {
  const { DId } = cmd;

  log(`[TCP] 📡 GPRS test from device: ${DId}`);

  // 【优化3】GT命令处理是同步的，无数据库查询，无异步操作
  // 立即返回响应，确保毫秒级响应时间
  // 第2步：GT命令 - 遵循"一问一答原则"
  // 设备发送GT → 服务器只返回GT的JSON响应
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
  const { DId, Type, Pwd, Ver, PosX, PosY, CSQ, crc } = cmd;

  try {
    // 构造完整的deviceId：IMEI + "0001"
    const fullDeviceId = DId + '0001';

    // 查询设备
    const unit = await Unit.findOne({ where: { deviceId: fullDeviceId } });

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

    // 更新设备状态、固件版本和新字段
    await unit.update({
      status: 'Online',
      lastHeartbeatAt: new Date(),
      firmwareVersion: Ver || null,
      deviceType: Type || unit.deviceType,
      latitude: PosY ? parseFloat(PosY) : unit.latitude,
      longitude: PosX ? parseFloat(PosX) : unit.longitude,
      signalQuality: CSQ ? parseInt(CSQ) : null,
      crcChecksum: crc || null,
      imei: DId || unit.imei
    });

    log(`[TCP] ✅ Device authenticated: ${DId}, Version: ${Ver || 'Unknown'}, Signal: ${CSQ || 'N/A'}`);

    // 推送设备上线状态到前端
    websocketService.sendDeviceUpdate(fullDeviceId, {
      status: 'Online',
      type: Type,
      version: Ver,
      position: { lat: parseFloat(PosY), lng: parseFloat(PosX) },
      signalQuality: parseInt(CSQ),
      imei: DId,
      timestamp: new Date()
    });

    // 检查是否有 Pending 升级任务，有则立即发送升级命令
    try {
      const pendingTask = await UpgradeTask.findOne({
        where: { deviceId: fullDeviceId, status: 'Pending' },
        include: [{ model: FirmwareVersion, as: 'firmware' }],
        order: [['createdAt', 'DESC']]
      });
      if (pendingTask && pendingTask.firmware) {
        log(`[TCP] 📦 Pending upgrade task found for ${fullDeviceId}, sending UpgradeVer command`);
        setTimeout(() => {
          sendUpgradeCommand(fullDeviceId, {
            version: pendingTask.firmware.version,
            crc32: pendingTask.firmware.crc32,
            size: pendingTask.firmware.fileSize,
            fileName: pendingTask.firmware.fileName
          }).catch(e => logError('[TCP] Failed to send upgrade command on reconnect:', e.message));
        }, 1000);
      }
    } catch (e) {
      logError('[TCP] Error checking pending upgrade task:', e.message);
    }

    // 返回服务器时间戳（硬件协议格式）
    return {
      Cmd: 'AU',
      Time: Math.floor(Date.now() / 1000)
    };

  } catch (error) {
    logError('[TCP] Auth error:', error.message);
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
      log(`[TCP] ⚠️ Device errors: ${DId}`, Errs);
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
    logError('[TCP] Heartbeat error:', error.message);
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

    log(`[TCP] ✅ Water dispensed: ${volume}L, User: ${user.phone}, Amount: ${amount}`);

    return {
      Cmd: 'SW',
      Result: 'OK',
      Balance: balanceAfter,
      TransactionId: transaction.id,
      Msg: 'Water dispensed successfully'
    };

  } catch (error) {
    logError('[TCP] Swipe water error:', error.message);
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
    logError('[TCP] Device status error:', error.message);
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
    logError('[TCP] Water quality error:', error.message);
    return null;
  }
}

// ========================================
// WR - 用水数据记录上报 (硬件协议核心指令)
// ========================================
async function handleWaterRecord(cmd, deviceId) {
  const { TE, RFID, PWM, Money, FT, Tds, IDS, RE, Tmp } = cmd;

  // 添加诊断日志
  log(`[TCP] 🔍 WR command processing:`);
  log(`[TCP] 🔍   - deviceId: ${deviceId}`);
  log(`[TCP] 🔍   - RFID: ${RFID}`);
  log(`[TCP] 🔍   - Amount: ${Money}`);
  log(`[TCP] 🔍   - RE: ${RE}`);

  // ★ QR 扫码订单匹配：RE 以 QR_ 开头说明是 APP 扫码发起的出水
  // dispenseByQR 已经预扣款并创建了 Pending 交易，这里只需更新状态，不再扣款
  // 注意：某些设备固件会忽略 RE 字段，回传自己的内部编号，所以需要 fallback 匹配
  let qrTransaction = null;

  if (RE && RE.startsWith('QR_')) {
    try {
      qrTransaction = await Transaction.findOne({ where: { recordId: RE, status: 'Pending' } });
    } catch (err) {
      logError('[TCP] QR WR matching error:', err.message);
    }
  }

  // Fallback：设备未回传 QR_ RE，按 deviceId + Pending 状态 + 5分钟内匹配
  if (!qrTransaction) {
    try {
      const { Op } = require('sequelize');
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      qrTransaction = await Transaction.findOne({
        where: {
          deviceId,
          status: 'Pending',
          cardType: 'Virtual',
          recordId: { [Op.like]: 'QR_%' },
          createdAt: { [Op.gte]: fiveMinAgo }
        },
        order: [['createdAt', 'DESC']]
      });
      if (qrTransaction) {
        log(`[TCP] 🔍 QR order fallback matched: txId=${qrTransaction.id}, recordId=${qrTransaction.recordId}, device RE=${RE}`);
      }
    } catch (err) {
      logError('[TCP] QR fallback matching error:', err.message);
    }
  }

  if (qrTransaction) {
    try {
      log(`[TCP] ✅ QR order matched: txId=${qrTransaction.id}, recordId=${qrTransaction.recordId}`);

      // 用硬件实际数据更新交易记录（不再扣款）
      await qrTransaction.update({
        status: 'Completed',
        completedAt: TE ? new Date(parseInt(TE) * 1000) : new Date(),
        pulseCount: parseInt(PWM) || qrTransaction.pulseCount,
        dispensingTime: parseInt(FT) || null,
        inputTds: parseInt(IDS) || null,
        outputTds: parseInt(Tds) || null,
        waterTemp: parseFloat(Tmp) || null,
      });

      // 更新设备水质数据
      const unit = await Unit.findOne({ where: { deviceId } });
      if (unit) {
        await unit.update({
          tdsValue: parseInt(Tds) || null,
          temperature: parseFloat(Tmp) || null,
          lastHeartbeatAt: new Date(),
        });
      }

      // WebSocket 推送完成状态到 APP
      websocketService.broadcast({
        type: 'dispense_status',
        data: { orderId: qrTransaction.id, status: 'completed' }
      });

      const user = await User.findByPk(qrTransaction.userId);
      log(`[TCP] ✅ QR order completed: txId=${qrTransaction.id}, user balance=${user ? user.balance : 'N/A'}`);

      return {
        Cmd: 'WR', RFID, RE, RT: 'OK',
        LeftL: '-1',
        LeftM: user ? user.balance.toString() : '-1',
        DayLmt: '-1'
      };
    } catch (err) {
      logError('[TCP] QR WR completion error:', err.message);
    }
  }

  try {
    // 1. 查找设备
    const unit = await Unit.findOne({ where: { deviceId } });
    if (!unit) {
      logError(`[TCP] ❌ Device not found: ${deviceId}`);
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
    log(`[TCP] ✅ Device found: ${unit.deviceName}`);

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
      logError(`[TCP] ❌ User/Card not found: RFID=${RFID}`);
      logError(`[TCP] ❌ Checked physical cards and virtual RFID`);
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
    log(`[TCP] ✅ User found: ${user.phone}, Balance: ${user.balance}`);

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
      deviceId: deviceId,
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
      completedAt: TE ? new Date(parseInt(TE) * 1000) : new Date()
    });

    // 6. 更新设备水质数据
    await unit.update({
      tdsValue: parseInt(Tds) || null,
      temperature: parseFloat(Tmp) || null,
      lastHeartbeatAt: new Date()
    });

    log(`[TCP] ✅ Water record: ${volume.toFixed(2)}L, User: ${user.phone}, Amount: ${amount}, Balance: ${balanceAfter}`);

    // 推送交易记录到前端
    websocketService.sendTransactionUpdate({
      id: transaction.id,
      userId: user.id,
      deviceId: deviceId,
      rfid: RFID,
      volume: volume,
      amount: amount,
      balanceAfter: balanceAfter,
      timestamp: new Date()
    });

    // 推送设备水质更新到前端
    websocketService.sendDeviceUpdate(deviceId, {
      tds: parseInt(Tds),
      inputTds: parseInt(IDS),
      temperature: parseFloat(Tmp),
      lastTransaction: new Date()
    });

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
    logError('[TCP] ❌ Water record error:', error.message);
    logError('[TCP] ❌ Error stack:', error.stack);
    logError('[TCP] ❌ deviceId:', deviceId);
    logError('[TCP] ❌ RFID:', RFID);
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

    log(`[TCP] ✅ Make water record: ${DId}, Time: ${FT}s, PWM: ${PWM}, TDS: ${TDS}`);

    return {
      Cmd: 'Mk',
      RT: 'OK',
      RC: RC
    };

  } catch (error) {
    logError('[TCP] Make water error:', error.message);
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

    log(`[TCP] ✅ Add money: ${RFID}, Amount: ${amount}, Balance: ${balanceAfter}`);

    return {
      Cmd: 'AddMoney',
      RT: 'OK',
      RC: RE
    };

  } catch (error) {
    logError('[TCP] Add money error:', error.message);
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
    // 如果 RE 以 QR_ 开头，说明是 APP 扫码发起的命令回传
    // qrDispenseController 已完成扣款和交易记录，这里直接返回 OK
    if (RE && RE.startsWith('QR_')) {
      log(`[TCP] ✅ QR scan OpenWater ack: ${RFID}, RE: ${RE}`);
      return {
        Cmd: 'OpenWater',
        RT: 'OK',
        RC: RE
      };
    }

    // 以下是设备主动发起的 OpenWater（如刷实体卡）
    const user = await User.findOne({ where: { virtualRfid: RFID } });

    if (!user) {
      return {
        Cmd: 'OpenWater',
        RT: 'Fail',
        RC: RE
      };
    }

    const amount = parseFloat(Money) || 0;

    if (user.balance < amount) {
      return {
        Cmd: 'OpenWater',
        RT: 'Fail',
        RC: RE
      };
    }

    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - amount;

    await user.update({ balance: balanceAfter });

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

    log(`[TCP] ✅ Open water: ${RFID}, Amount: ${amount}, Type: ${Type}, Balance: ${balanceAfter}`);

    return {
      Cmd: 'OpenWater',
      RT: 'OK',
      RC: RE
    };

  } catch (error) {
    logError('[TCP] Open water error:', error.message);
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
    logError('[TCP] Update device status error:', error.message);
  }
}

// ========================================
// 启动 TCP 服务器
// ========================================
function start() {
  server.listen(TCP_PORT, '0.0.0.0', () => {
    log(`[TCP] ✅ Server listening on port ${TCP_PORT}`);
  });

  server.on('error', (error) => {
    logError('[TCP] ❌ Server error:', error.message);
  });
}

// ========================================
// 停止 TCP 服务器
// ========================================
function stop() {
  return new Promise((resolve) => {
    server.close(() => {
      log('[TCP] ✅ Server stopped');
      resolve();
    });
  });
}

// ========================================
// 主动向设备发送命令（扫码取水用）
// ========================================
/**
 * 向已连接的设备发送 TCP JSON 命令
 * @param {string} deviceId - 设备ID
 * @param {Object} command - JSON 命令对象（如 OpenWater）
 * @returns {Promise<boolean>}
 */
function sendCommandToDevice(deviceId, command) {
  return new Promise((resolve, reject) => {
    const socket = deviceConnections.get(deviceId);
    if (!socket || socket.destroyed) {
      reject(new Error(`Device ${deviceId} is not connected`));
      return;
    }

    const data = JSON.stringify(command) + '\r\n';
    socket.write(data, (err) => {
      if (err) {
        logError(`[TCP] Failed to send command to ${deviceId}:`, err.message);
        reject(err);
      } else {
        log(`[TCP] ✅ Command sent to ${deviceId}:`, JSON.stringify(command));
        resolve(true);
      }
    });
  });
}

/**
 * 检查设备是否在线（TCP连接是否存活）
 * @param {string} deviceId - 设备ID
 * @returns {boolean}
 */
function isDeviceConnected(deviceId) {
  const socket = deviceConnections.get(deviceId);
  return !!(socket && !socket.destroyed && socket.writable);
}

// ========================================
// 固件升级相关处理函数
// ========================================

/**
 * ACK - 设备确认升级命令
 */
async function handleUpgradeAck(cmd, deviceId) {
  const { RT, RC } = cmd;

  log(`[TCP] Upgrade ACK from ${deviceId}: RT=${RT}, RC=${RC}`);

  if (RT === 'OK') {
    // 更新升级任务状态
    const task = await UpgradeTask.findOne({
      where: { deviceId, status: 'Pending' },
      order: [['createdAt', 'DESC']]
    });

    if (task) {
      await task.update({ status: 'InProgress', startedAt: new Date() });

      // 推送状态更新
      websocketService.broadcast({
        type: 'upgrade_started',
        data: { taskId: task.id, deviceId, status: 'InProgress' }
      });

      log(`[TCP] Upgrade task ${task.id} started for device ${deviceId}`);
    }
  } else {
    log(`[TCP] Upgrade rejected by device ${deviceId}: RT=${RT}`);
  }

  return null; // ACK 不需要回复
}

/**
 * VerReq - 设备请求固件数据包
 * 设备发送: {"Cmd":"VerReq","Ver":"xxx.bin","RecLen":"0","SeqNo":"1"}
 * 服务器回复: 二进制数据包 0xAA 0xBB CRC8 len SeqNo data 0x0E
 */
async function handleVerReq(cmd, socket, deviceId) {
  const { Ver, RecLen, SeqNo } = cmd;
  const seqNo = parseInt(SeqNo);

  log(`[TCP] VerReq from ${deviceId}: Ver=${Ver}, SeqNo=${seqNo}, RecLen=${RecLen}`);

  try {
    const { Op } = require('sequelize');

    // 查找升级任务（同时查找 Pending 和 InProgress 状态）
    const task = await UpgradeTask.findOne({
      where: {
        deviceId,
        status: {
          [Op.in]: ['Pending', 'InProgress']
        }
      },
      include: [{ model: FirmwareVersion, as: 'firmware' }],
      order: [['createdAt', 'DESC']]
    });

    if (!task || !task.firmware) {
      logError(`[TCP] No active upgrade task for ${deviceId}`);
      return { Cmd: 'VerReq', RT: 'Fail', Msg: 'No active upgrade task' };
    }

    // 如果任务还是 Pending 状态，立即更新为 InProgress
    if (task.status === 'Pending') {
      await task.update({ status: 'InProgress' });
      log(`[TCP] 📝 Task ${task.id} status updated: Pending → InProgress`);
    }

    // 获取或创建升级会话
    let session = upgradeSessions.get(deviceId);
    if (!session) {
      const packets = await splitFileIntoPackets(task.firmware.filePath, 255);

      session = {
        taskId: task.id,
        packets,
        totalPackets: packets.length,
        currentPacket: 0
      };
      upgradeSessions.set(deviceId, session);

      // 更新任务总包数
      await task.update({ totalPackets: packets.length });

      log(`[TCP] Created upgrade session for ${deviceId}: ${packets.length} packets`);
    }

    // 检查序号
    if (seqNo > session.totalPackets) {
      // 升级完成
      log(`[TCP] Upgrade completed for ${deviceId}`);

      // 发送完成包: 0xAA 0xBB CRC8 0x00 SeqNo(2bytes) 0x0E
      const completionPacket = Buffer.alloc(7);
      completionPacket[0] = 0xAA;
      completionPacket[1] = 0xBB;
      completionPacket[2] = 0x00; // CRC8 placeholder
      completionPacket[3] = 0x00; // len = 0
      completionPacket[4] = (seqNo >> 8) & 0xFF; // SeqNo high byte
      completionPacket[5] = seqNo & 0xFF; // SeqNo low byte
      completionPacket[6] = 0x0E;

      // 计算 CRC8 (len + SeqNo)
      const crc8 = calculateCRC8(completionPacket.slice(3, 6));
      completionPacket[2] = crc8;

      socket.write(completionPacket);
      log(`[TCP] Sent completion packet to ${deviceId}`);

      // 更新任务状态
      await task.update({
        status: 'Completed',
        progress: 100,
        completedAt: new Date()
      });

      // 更新设备固件版本
      await Unit.update(
        { firmwareVersion: task.firmware.version },
        { where: { deviceId } }
      );

      // 清理升级会话
      upgradeSessions.delete(deviceId);

      // 推送完成通知
      websocketService.broadcast({
        type: 'upgrade_completed',
        data: {
          taskId: task.id,
          deviceId,
          version: task.firmware.version,
          status: 'Completed'
        }
      });

      return null; // 已发送二进制包，不返回JSON
    }

    // 发送数据包
    const packetIndex = seqNo - 1; // 数组索引从0开始
    if (packetIndex < 0 || packetIndex >= session.packets.length) {
      logError(`[TCP] Invalid packet index ${packetIndex} for ${deviceId}`);
      return { Cmd: 'VerReq', RT: 'Fail', Msg: 'Invalid packet number' };
    }

    const dataPacket = session.packets[packetIndex];
    const len = dataPacket.length;

    // 构造二进制包: 0xAA 0xBB CRC8 len SeqNo data 0x0E
    const packet = Buffer.alloc(6 + len);
    packet[0] = 0xAA;
    packet[1] = 0xBB;
    packet[2] = 0x00; // CRC8 placeholder
    packet[3] = len;
    packet[4] = (seqNo >> 8) & 0xFF; // SeqNo high byte
    packet[5] = seqNo & 0xFF; // SeqNo low byte
    dataPacket.copy(packet, 6);
    packet[6 + len] = 0x0E;

    // 计算 CRC8 (len + SeqNo + data)
    const crc8 = calculateCRC8(packet.slice(3, 6 + len));
    packet[2] = crc8;

    // 发送数据包
    socket.write(packet);

    // 更新进度
    session.currentPacket = seqNo;
    const progress = Math.floor((seqNo / session.totalPackets) * 100);

    await task.update({
      currentPacket: seqNo,
      progress
    });

    // 推送进度更新（每10包推送一次，避免过于频繁）
    if (seqNo % 10 === 0 || seqNo === session.totalPackets) {
      websocketService.broadcast({
        type: 'upgrade_progress',
        data: {
          taskId: task.id,
          deviceId,
          progress,
          currentPacket: seqNo,
          totalPackets: session.totalPackets
        }
      });
    }

    log(`[TCP] Sent packet ${seqNo}/${session.totalPackets} to ${deviceId} (${progress}%)`);

    return null; // 已发送二进制包，不返回JSON

  } catch (error) {
    logError(`[TCP] VerReq error for ${deviceId}:`, error);

    // 更新任务为失败状态
    const task = await UpgradeTask.findOne({
      where: { deviceId, status: 'InProgress' },
      order: [['createdAt', 'DESC']]
    });

    if (task) {
      await task.update({
        status: 'Failed',
        errorMessage: error.message
      });

      websocketService.broadcast({
        type: 'upgrade_failed',
        data: {
          taskId: task.id,
          deviceId,
          error: error.message
        }
      });
    }

    // 清理会话
    upgradeSessions.delete(deviceId);

    return { Cmd: 'VerReq', RT: 'Fail', Msg: error.message };
  }
}

/**
 * 主动发送升级命令到设备
 * @param {string} deviceId - 设备ID
 * @param {Object} firmwareInfo - 固件信息 {version, crc32, size, fileName}
 * @returns {Promise<boolean>}
 */
async function sendUpgradeCommand(deviceId, firmwareInfo) {
  const { version, crc32, size, fileName } = firmwareInfo;

  // 生成随机RC码
  const rc = Math.floor(Math.random() * 10000).toString();

  const command = {
    Cmd: 'UpgradeVer',
    Crc: crc32,
    RC: rc,
    Size: size.toString(),
    Ver: fileName
  };

  log(`[TCP] Sending upgrade command to ${deviceId}:`, command);

  return sendCommandToDevice(deviceId, command);
}

// ========================================
// 导出
// ========================================
module.exports = {
  start,
  stop,
  deviceConnections,
  sendCommandToDevice,
  isDeviceConnected,
  sendUpgradeCommand
};

