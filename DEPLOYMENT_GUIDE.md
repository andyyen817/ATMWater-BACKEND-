# IOT协议实现 - 快速部署指南

**版本**: 2.0
**日期**: 2026-02-09
**状态**: ✅ 准备就绪

---

## 📋 部署前检查清单

- [ ] 已备份当前代码
- [ ] 已备份数据库
- [ ] 已阅读修改说明文档
- [ ] 已准备测试环境
- [ ] 已通知硬件工程师

---

## 🚀 快速部署步骤

### 步骤1: 备份（5分钟）

```bash
# 1. 备份代码
cd d:\airkopapp\JKT99ATM-main
cp -r ATMWater-BACKEND ATMWater-BACKEND.backup.$(date +%Y%m%d)

# 2. 备份数据库
mysqldump -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur > backup_$(date +%Y%m%d).sql
```

---

### 步骤2: 数据库迁移（10分钟）

```bash
# 1. 连接数据库
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur

# 2. 执行迁移脚本
source d:\airkopapp\JKT99ATM-main\ATMWater-BACKEND\database-migration.sql

# 3. 验证字段
DESCRIBE units;
DESCRIBE transactions;

# 4. 退出
exit
```

**预期结果**:
- Units表新增3个字段: firmware_version, pulse_per_liter, error_codes
- Transactions表新增6个字段: pulse_count, input_tds, output_tds, water_temp, record_id, dispensing_time

---

### 步骤3: 代码部署（5分钟）

代码已经修改完成，无需额外操作。修改的文件:

1. `src/models/Unit.js` - 添加新字段
2. `src/models/Transaction.js` - 添加新字段
3. `src/services/tcpServer.js` - 实现新指令

---

### 步骤4: 重启服务（2分钟）

```bash
# 1. 进入后端目录
cd d:\airkopapp\JKT99ATM-main\ATMWater-BACKEND

# 2. 安装依赖（如有新增）
npm install

# 3. 重启服务
# 如果使用PM2
pm2 restart atmwater-backend

# 如果直接运行
# 先停止当前进程，然后
npm start
```

---

### 步骤5: 测试验证（10分钟）

```bash
# 1. 运行测试脚本
cd d:\airkopapp\JKT99ATM-main\ATMWater-BACKEND
node test-hardware-protocol.js

# 2. 检查日志
tail -f logs/app.log

# 3. 验证数据库
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur
SELECT * FROM units LIMIT 1;
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1;
```

**预期结果**:
- 所有10个测试用例通过
- 日志显示指令正常处理
- 数据库记录正确创建

---

## ✅ 验证清单

### 功能验证

- [ ] AU指令: 设备能够成功认证，返回Time字段
- [ ] HB指令: 心跳正常，告警信息正确记录
- [ ] WR指令: 用水记录正确上报，余额正确扣除
- [ ] Mk指令: 制水记录正确处理
- [ ] AddMoney指令: 充值功能正常
- [ ] OpenWater指令: 扫码放水功能正常
- [ ] SW指令: 旧系统兼容正常
- [ ] DS指令: 设备状态正常上报
- [ ] WQ指令: 水质数据正常上报

### 数据验证

- [ ] Units表: firmware_version字段正确保存
- [ ] Units表: pulse_per_liter字段默认为1.0
- [ ] Units表: error_codes字段正确保存告警信息
- [ ] Transactions表: pulse_count字段正确保存
- [ ] Transactions表: input_tds和output_tds字段正确保存
- [ ] Transactions表: water_temp字段正确保存
- [ ] Transactions表: record_id字段正确保存
- [ ] Transactions表: dispensing_time字段正确保存

### 性能验证

- [ ] 心跳超时设置为180秒
- [ ] TCP连接稳定
- [ ] 响应时间正常（< 100ms）
- [ ] 无内存泄漏

---

## 🔧 配置说明

### 环境变量

`.env`文件中的相关配置:

```env
# TCP服务器配置
TCP_PORT=55036

# 数据库配置
MYSQL_HOST=hkg1.clusters.zeabur.com
MYSQL_PORT=30886
MYSQL_USERNAME=root
MYSQL_PASSWORD=m6RE5f3pADClMNn9ca47Z1z028gbXxuW
MYSQL_DATABASE=zeabur
```

### 设备配置

每个设备需要在数据库中配置:

```sql
-- 设置设备的脉冲转换系数
UPDATE units
SET pulse_per_liter = 1.0  -- 根据实际硬件调整
WHERE device_id = 'DEVICE001';
```

---

## 📊 监控指标

### 关键指标

1. **设备在线率**: 应 > 95%
2. **WR指令成功率**: 应 > 99%
3. **心跳超时率**: 应 < 1%
4. **交易记录完整性**: 应 = 100%

### 监控命令

```bash
# 查看设备在线状态
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "
SELECT status, COUNT(*) as count
FROM units
GROUP BY status;
"

# 查看最近的WR指令记录
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "
SELECT *
FROM transactions
WHERE type = 'WaterPurchase'
ORDER BY created_at DESC
LIMIT 10;
"

# 查看设备告警
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "
SELECT device_id, error_codes, last_heartbeat_at
FROM units
WHERE error_codes IS NOT NULL;
"
```

---

## 🐛 故障排查

### 问题1: 数据库迁移失败

**症状**: ALTER TABLE命令报错

**解决方案**:
```bash
# 检查表是否存在
SHOW TABLES;

# 检查字段是否已存在
DESCRIBE units;
DESCRIBE transactions;

# 如果字段已存在，跳过该字段的添加
```

---

### 问题2: 服务启动失败

**症状**: npm start报错

**解决方案**:
```bash
# 检查Node.js版本
node --version  # 应 >= 14.0.0

# 检查依赖
npm install

# 检查端口占用
netstat -ano | findstr :55036

# 查看详细错误
npm start --verbose
```

---

### 问题3: WR指令返回Fail

**症状**: 测试脚本显示WR指令失败

**解决方案**:
```bash
# 1. 检查设备是否存在
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "
SELECT * FROM units WHERE device_id = 'DEVICE001';
"

# 2. 检查用户是否存在
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "
SELECT * FROM users WHERE virtual_rfid = 'VIRT_081234567890';
"

# 3. 检查用户余额
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "
SELECT phone, balance FROM users WHERE virtual_rfid = 'VIRT_081234567890';
"

# 4. 查看服务器日志
tail -f logs/app.log | grep WR
```

---

### 问题4: 心跳超时

**症状**: 设备频繁断线

**解决方案**:
```bash
# 1. 检查心跳超时配置
grep HEARTBEAT_TIMEOUT src/services/tcpServer.js
# 应显示: const HEARTBEAT_TIMEOUT = 180000;

# 2. 检查网络连接
ping hkg1.clusters.zeabur.com

# 3. 检查设备心跳间隔
# 确保硬件每90秒发送一次心跳
```

---

## 📞 紧急回滚

如果部署后出现严重问题，执行以下回滚步骤:

### 1. 回滚代码

```bash
# 停止服务
pm2 stop atmwater-backend

# 恢复备份
cd d:\airkopapp\JKT99ATM-main
rm -rf ATMWater-BACKEND
cp -r ATMWater-BACKEND.backup.$(date +%Y%m%d) ATMWater-BACKEND

# 重启服务
cd ATMWater-BACKEND
pm2 start atmwater-backend
```

### 2. 回滚数据库

```bash
# 恢复数据库备份
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur < backup_$(date +%Y%m%d).sql
```

### 3. 验证回滚

```bash
# 检查服务状态
pm2 status

# 检查数据库
mysql -h hkg1.clusters.zeabur.com -P 30886 -u root -p zeabur -e "DESCRIBE units;"
```

---

## 📚 相关文档

1. **硬件对接指南**: `HARDWARE_PROTOCOL_GUIDE.md`
2. **完整修改说明**: `IOT_PROTOCOL_IMPLEMENTATION.md`
3. **协议对比报告**: `D:\airkopapp\IOT协议对比分析报告.md`
4. **测试脚本**: `test-hardware-protocol.js`
5. **数据库迁移**: `database-migration.sql`

---

## ✅ 部署完成确认

部署完成后，请确认以下事项:

- [ ] 数据库迁移成功
- [ ] 服务正常启动
- [ ] 测试脚本全部通过
- [ ] 日志无错误信息
- [ ] 设备能够正常连接
- [ ] WR指令正常工作
- [ ] 交易记录正确创建
- [ ] 余额正确扣除
- [ ] 告警信息正确记录
- [ ] 已通知硬件工程师可以开始测试

---

## 📅 后续工作

1. **监控**: 持续监控系统运行状态
2. **优化**: 根据实际运行情况优化性能
3. **文档**: 更新用户手册和操作指南
4. **培训**: 培训运维人员和客服人员
5. **反馈**: 收集硬件工程师的反馈

---

## 🎉 部署成功

恭喜！IOT协议实现已成功部署。

系统现在完全支持硬件工程师提供的通讯协议，能够正确处理所有硬件指令，确保前端、后端、硬件三方数据一致性。

如有任何问题，请参考相关文档或联系技术支持。

---

**文档创建**: 2026-02-09
**维护者**: IOT协议实现专家
**版本**: 1.0
