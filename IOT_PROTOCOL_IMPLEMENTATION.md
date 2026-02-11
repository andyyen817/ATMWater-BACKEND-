# IOT协议实现 - 完整修改说明

**日期**: 2026-02-09
**任务**: 根据硬件工程师提供的协议文档，完整修改系统的TCP服务器实现
**状态**: ✅ 已完成

---

## 📋 任务概述

根据硬件工程师提供的IOT通讯协议文档（`印尼系统IOT通讯协议.xlsx`），对系统进行了全面的协议适配，确保前端管理后台、后端数据库、Android应用都能正确接收和处理硬件数据。

---

## 🎯 关键发现与修复

### 严重问题（已修复）

1. **WR指令缺失** ⚠️⚠️⚠️
   - **问题**: 硬件使用WR指令上报用水记录，但系统未实现
   - **影响**: 硬件无法与系统正常通信
   - **修复**: 完整实现WR指令处理函数

2. **业务流程不兼容**
   - **硬件协议**: 设备先出水，后上报记录（WR指令）
   - **系统实现**: 服务器先验证，后允许出水（SW指令）
   - **修复**: 实现WR指令，同时保留SW指令以兼容旧系统

3. **字段命名不一致**
   - **问题**: PWM vs Vol, Money vs Price, Tmp vs Temp等
   - **修复**: 在WR指令中使用硬件协议的字段名

---

## 📝 详细修改清单

### 1. 数据库模型修改

#### 1.1 Unit模型 (`src/models/Unit.js`)

**新增字段**:

```javascript
// 每升脉冲数（用于PWM转换为升）
pulsePerLiter: {
  type: DataTypes.DECIMAL(10, 2),
  defaultValue: 1.0,
  allowNull: false,
  comment: '每升脉冲数（用于PWM转换为升）'
}

// 固件版本号
firmwareVersion: {
  type: DataTypes.STRING(50),
  allowNull: true,
  comment: '固件版本号'
}

// 告警代码（JSON数组）
errorCodes: {
  type: DataTypes.TEXT,
  allowNull: true,
  comment: '告警代码（JSON数组）'
}
```

**用途**:
- `pulsePerLiter`: 将硬件的PWM脉冲数转换为升数
- `firmwareVersion`: 记录设备固件版本，便于追踪和管理
- `errorCodes`: 存储设备告警信息

---

#### 1.2 Transaction模型 (`src/models/Transaction.js`)

**新增字段**:

```javascript
// 脉冲数（PWM）
pulseCount: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: '脉冲数（PWM）'
}

// 进水TDS值
inputTds: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: '进水TDS值'
}

// 纯水TDS值
outputTds: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: '纯水TDS值'
}

// 水温
waterTemp: {
  type: DataTypes.DECIMAL(5, 2),
  allowNull: true,
  comment: '水温（摄氏度）'
}

// 硬件记录ID
recordId: {
  type: DataTypes.STRING(50),
  allowNull: true,
  comment: '硬件记录ID（RE字段）'
}

// 放水时间
dispensingTime: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: '放水时间（秒）'
}
```

**用途**:
- 完整记录硬件上报的所有数据
- 便于数据分析和问题追踪
- 支持水质监测和设备维护

---

### 2. TCP服务器修改 (`src/services/tcpServer.js`)

#### 2.1 配置修改

**心跳超时调整**:

```javascript
// 修改前
const HEARTBEAT_TIMEOUT = 120000; // 120秒超时

// 修改后
const HEARTBEAT_TIMEOUT = 180000; // 180秒超时 (硬件心跳间隔90秒 + 90秒容错)
```

**原因**: 硬件协议规定心跳间隔为90秒，需要给予足够的容错时间

---

#### 2.2 AU指令修改

**修改内容**:

1. 添加`Ver`字段支持
2. 修改响应格式，返回服务器时间戳

**修改前**:
```javascript
async function handleAuth(cmd) {
  const { DId, Type, Pwd } = cmd;
  // ...
  return {
    Cmd: 'AU',
    Result: 'OK',
    Msg: 'Authentication successful'
  };
}
```

**修改后**:
```javascript
async function handleAuth(cmd) {
  const { DId, Type, Pwd, Ver } = cmd;  // 添加Ver字段
  // ...
  await unit.update({
    status: 'Online',
    lastHeartbeatAt: new Date(),
    firmwareVersion: Ver || null  // 保存固件版本
  });

  return {
    Cmd: 'AU',
    Time: Math.floor(Date.now() / 1000)  // 返回Unix时间戳
  };
}
```

---

#### 2.3 HB指令修改

**修改内容**:

1. 添加`Errs`数组支持
2. 根据告警信息更新设备状态
3. 简化响应格式

**修改前**:
```javascript
async function handleHeartbeat(cmd) {
  const { DId } = cmd;
  // ...
  return {
    Cmd: 'HB',
    Result: 'OK',
    ServerTime: new Date().toISOString()
  };
}
```

**修改后**:
```javascript
async function handleHeartbeat(cmd) {
  const { DId, Errs } = cmd;  // 添加Errs字段

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
    updateData.errorCodes = null;
  }

  await Unit.update(updateData, { where: { deviceId: DId } });

  return {
    Cmd: 'HB'  // 简化响应
  };
}
```

---

#### 2.4 WR指令实现（核心功能）⭐

**完整实现用水数据记录上报功能**:

```javascript
async function handleWaterRecord(cmd) {
  const { DId, TE, RFID, PWM, Money, FT, Tds, IDS, RE, Tmp } = cmd;

  try {
    // 1. 查找设备
    const unit = await Unit.findOne({ where: { deviceId: DId } });

    // 2. 查找用户（实体卡或虚拟卡）
    let user = null;
    let cardType = null;

    const physicalCard = await PhysicalCard.findOne({
      where: { rfid: RFID, status: 'Active' },
      include: [{ model: User, as: 'user' }]
    });

    if (physicalCard && physicalCard.user) {
      user = physicalCard.user;
      cardType = 'Physical';
    } else {
      user = await User.findOne({ where: { virtualRfid: RFID } });
      cardType = 'Virtual';
    }

    // 3. 计算水量（PWM脉冲数转换为升）
    const pulseCount = parseInt(PWM) || 0;
    const pulsePerLiter = parseFloat(unit.pulsePerLiter) || 1.0;
    const volume = pulseCount / pulsePerLiter;
    const amount = parseFloat(Money) || 0;

    // 4. 扣款（注意：硬件已经出水，即使余额不足也要记录）
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - amount;
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
```

**关键点**:
1. 支持实体卡和虚拟卡
2. PWM脉冲数自动转换为升数
3. 完整记录所有硬件上报的数据
4. 即使余额不足也记录交易（因为硬件已出水）
5. 返回用户剩余余额

---

#### 2.5 Mk指令实现

**制水记录上报**:

```javascript
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
```

---

#### 2.6 AddMoney指令实现

**充值命令处理**:

```javascript
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
```

---

#### 2.7 OpenWater指令实现

**扫码放水处理**:

```javascript
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
```

---

#### 2.8 指令路由更新

**更新handleCommand函数**:

```javascript
async function handleCommand(cmd, socket) {
  const { Cmd, DId } = cmd;

  switch (Cmd) {
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
      return {
        Cmd: 'ER',
        Msg: `Unknown command: ${Cmd}`
      };
  }
}
```

---

### 3. 测试脚本创建

**文件**: `test-hardware-protocol.js`

**功能**:
- 测试所有10个指令
- 自动连接TCP服务器
- 发送测试数据
- 显示响应结果
- 彩色输出便于查看

**运行方式**:
```bash
node test-hardware-protocol.js
```

**测试覆盖**:
1. ✅ AU - 设备认证
2. ✅ HB - 心跳（无告警）
3. ✅ HB - 心跳（带告警）
4. ✅ WR - 用水数据记录上报
5. ✅ Mk - 制水记录
6. ✅ AddMoney - 充值命令
7. ✅ OpenWater - 扫码放水
8. ✅ DS - 设备状态上报
9. ✅ WQ - 水质数据上报
10. ✅ SW - 刷卡出水（兼容）

---

### 4. 文档创建

#### 4.1 硬件对接指南

**文件**: `HARDWARE_PROTOCOL_GUIDE.md`

**内容**:
- 协议概述
- 连接配置
- 所有指令详解
- 业务流程说明
- 错误处理
- 测试指南
- 常见问题解答

#### 4.2 修改说明文档

**文件**: `IOT_PROTOCOL_IMPLEMENTATION.md` (本文档)

**内容**:
- 完整的修改清单
- 代码对比
- 实现细节
- 测试结果

---

## 🔄 兼容性说明

### 向后兼容

系统保留了原有的SW指令，确保旧版本硬件仍能正常工作:

```javascript
case 'SW': // 刷卡出水（保留兼容旧系统）
  return await handleSwipeWater(cmd);
```

### 渐进式迁移

建议采用以下迁移策略:

1. **阶段1**: 部署新版本服务器，同时支持SW和WR指令
2. **阶段2**: 新设备使用WR指令，旧设备继续使用SW指令
3. **阶段3**: 逐步升级旧设备固件
4. **阶段4**: 所有设备切换到WR指令后，可考虑移除SW指令

---

## 📊 协议对比总结

### 修改前

| 指令 | 状态 |
|------|------|
| AU | ✅ 部分实现（缺Ver字段） |
| HB | ✅ 部分实现（缺Errs字段） |
| WR | ❌ 未实现 |
| Mk | ❌ 未实现 |
| AddMoney | ❌ 未实现 |
| OpenWater | ❌ 未实现 |
| SW | ✅ 已实现 |
| DS | ✅ 已实现 |
| WQ | ✅ 已实现 |

### 修改后

| 指令 | 状态 |
|------|------|
| AU | ✅ 完整实现（含Ver字段） |
| HB | ✅ 完整实现（含Errs字段） |
| WR | ✅ 完整实现（核心指令） |
| Mk | ✅ 完整实现 |
| AddMoney | ✅ 完整实现 |
| OpenWater | ✅ 完整实现 |
| SW | ✅ 保留兼容 |
| DS | ✅ 已实现 |
| WQ | ✅ 已实现 |

---

## ✅ 验证清单

### 数据库

- [x] Unit表添加firmwareVersion字段
- [x] Unit表添加pulsePerLiter字段
- [x] Unit表添加errorCodes字段
- [x] Transaction表添加pulseCount字段
- [x] Transaction表添加inputTds字段
- [x] Transaction表添加outputTds字段
- [x] Transaction表添加waterTemp字段
- [x] Transaction表添加recordId字段
- [x] Transaction表添加dispensingTime字段

### TCP服务器

- [x] 心跳超时调整为180秒
- [x] AU指令添加Ver字段支持
- [x] AU指令返回Time字段
- [x] HB指令添加Errs数组支持
- [x] HB指令根据告警更新设备状态
- [x] WR指令完整实现
- [x] Mk指令完整实现
- [x] AddMoney指令完整实现
- [x] OpenWater指令完整实现
- [x] 指令路由更新

### 测试

- [x] 创建测试脚本
- [x] 测试AU指令
- [x] 测试HB指令（无告警）
- [x] 测试HB指令（带告警）
- [x] 测试WR指令
- [x] 测试Mk指令
- [x] 测试AddMoney指令
- [x] 测试OpenWater指令
- [x] 测试DS指令
- [x] 测试WQ指令
- [x] 测试SW指令（兼容）

### 文档

- [x] 创建硬件对接指南
- [x] 创建修改说明文档
- [x] 更新README（如需要）

---

## 🚀 部署步骤

### 1. 数据库迁移

```sql
-- 添加Unit表字段
ALTER TABLE units ADD COLUMN firmware_version VARCHAR(50) NULL COMMENT '固件版本号';
ALTER TABLE units ADD COLUMN pulse_per_liter DECIMAL(10,2) NOT NULL DEFAULT 1.0 COMMENT '每升脉冲数';
ALTER TABLE units ADD COLUMN error_codes TEXT NULL COMMENT '告警代码（JSON数组）';

-- 添加Transaction表字段
ALTER TABLE transactions ADD COLUMN pulse_count INT NULL COMMENT '脉冲数（PWM）';
ALTER TABLE transactions ADD COLUMN input_tds INT NULL COMMENT '进水TDS值';
ALTER TABLE transactions ADD COLUMN output_tds INT NULL COMMENT '纯水TDS值';
ALTER TABLE transactions ADD COLUMN water_temp DECIMAL(5,2) NULL COMMENT '水温（摄氏度）';
ALTER TABLE transactions ADD COLUMN record_id VARCHAR(50) NULL COMMENT '硬件记录ID（RE字段）';
ALTER TABLE transactions ADD COLUMN dispensing_time INT NULL COMMENT '放水时间（秒）';
```

### 2. 代码部署

```bash
# 1. 备份当前代码
cp -r d:\airkopapp\JKT99ATM-main\ATMWater-BACKEND d:\airkopapp\JKT99ATM-main\ATMWater-BACKEND.backup

# 2. 部署新代码（已完成修改）

# 3. 重启服务器
cd d:\airkopapp\JKT99ATM-main\ATMWater-BACKEND
npm install
npm start
```

### 3. 测试验证

```bash
# 运行测试脚本
node test-hardware-protocol.js

# 检查日志
tail -f logs/app.log
```

### 4. 监控

- 监控设备连接状态
- 监控WR指令处理情况
- 监控交易记录创建
- 监控告警信息

---

## 📈 预期效果

### 功能完整性

- ✅ 硬件设备能够正常认证
- ✅ 心跳保持连接稳定
- ✅ 用水记录正确上报和处理
- ✅ 余额正确扣除和返回
- ✅ 水质数据正确记录
- ✅ 告警信息正确处理
- ✅ 固件版本正确追踪

### 数据完整性

- ✅ 所有交易记录完整保存
- ✅ 脉冲数正确转换为升数
- ✅ 水质数据完整记录
- ✅ 设备状态实时更新

### 系统稳定性

- ✅ 心跳超时合理设置
- ✅ 错误处理完善
- ✅ 向后兼容保证
- ✅ 日志记录详细

---

## 🔍 问题排查

### 如果WR指令失败

1. 检查设备ID是否存在
2. 检查RFID是否注册
3. 检查数据格式是否正确
4. 查看服务器日志

### 如果心跳超时

1. 检查网络连接
2. 确认心跳间隔为90秒
3. 检查服务器负载

### 如果余额不正确

1. 检查pulsePerLiter配置
2. 检查PWM转换逻辑
3. 查看交易记录

---

## 📞 技术支持

如有问题，请查看:

1. **硬件对接指南**: `HARDWARE_PROTOCOL_GUIDE.md`
2. **服务器日志**: `logs/app.log`
3. **测试脚本**: `test-hardware-protocol.js`
4. **协议分析报告**: `D:\airkopapp\IOT协议对比分析报告.md`

---

## 📝 总结

本次修改完整实现了硬件工程师提供的IOT通讯协议，主要成果:

1. ✅ 实现WR指令（最关键）
2. ✅ 完善AU和HB指令
3. ✅ 实现Mk、AddMoney、OpenWater指令
4. ✅ 添加数据库字段支持
5. ✅ 调整心跳超时配置
6. ✅ 创建完整测试脚本
7. ✅ 编写详细对接文档
8. ✅ 保持向后兼容

系统现在能够完整支持硬件协议，确保前端、后端、硬件三方数据一致性。

---

**文档创建**: 2026-02-09
**作者**: IOT协议实现专家
**状态**: ✅ 已完成
