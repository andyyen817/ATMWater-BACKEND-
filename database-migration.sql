-- ========================================
-- IOT协议实现 - 数据库迁移脚本
-- ========================================
-- 日期: 2026-02-09
-- 用途: 添加硬件协议所需的数据库字段
-- 执行方式: 在MySQL客户端执行此脚本

-- ========================================
-- 1. Units表 - 添加新字段
-- ========================================

-- 添加固件版本号字段
ALTER TABLE units
ADD COLUMN firmware_version VARCHAR(50) NULL
COMMENT '固件版本号'
AFTER last_maintenance_at;

-- 添加每升脉冲数字段（用于PWM转换）
ALTER TABLE units
ADD COLUMN pulse_per_liter DECIMAL(10,2) NOT NULL DEFAULT 1.0
COMMENT '每升脉冲数（用于PWM转换为升）'
AFTER price_per_liter;

-- 添加告警代码字段
ALTER TABLE units
ADD COLUMN error_codes TEXT NULL
COMMENT '告警代码（JSON数组）'
AFTER firmware_version;

-- ========================================
-- 2. Transactions表 - 添加新字段
-- ========================================

-- 添加脉冲数字段
ALTER TABLE transactions
ADD COLUMN pulse_count INT NULL
COMMENT '脉冲数（PWM）'
AFTER price_per_liter;

-- 添加进水TDS字段
ALTER TABLE transactions
ADD COLUMN input_tds INT NULL
COMMENT '进水TDS值'
AFTER pulse_count;

-- 添加纯水TDS字段
ALTER TABLE transactions
ADD COLUMN output_tds INT NULL
COMMENT '纯水TDS值'
AFTER input_tds;

-- 添加水温字段
ALTER TABLE transactions
ADD COLUMN water_temp DECIMAL(5,2) NULL
COMMENT '水温（摄氏度）'
AFTER output_tds;

-- 添加硬件记录ID字段
ALTER TABLE transactions
ADD COLUMN record_id VARCHAR(50) NULL
COMMENT '硬件记录ID（RE字段）'
AFTER water_temp;

-- 添加放水时间字段
ALTER TABLE transactions
ADD COLUMN dispensing_time INT NULL
COMMENT '放水时间（秒）'
AFTER record_id;

-- ========================================
-- 3. 创建索引（可选，提升查询性能）
-- ========================================

-- Units表索引
CREATE INDEX idx_firmware_version ON units(firmware_version);

-- Transactions表索引
CREATE INDEX idx_record_id ON transactions(record_id);
CREATE INDEX idx_pulse_count ON transactions(pulse_count);

-- ========================================
-- 4. 验证修改
-- ========================================

-- 查看Units表结构
DESCRIBE units;

-- 查看Transactions表结构
DESCRIBE transactions;

-- ========================================
-- 5. 数据初始化（可选）
-- ========================================

-- 为现有设备设置默认脉冲数
UPDATE units
SET pulse_per_liter = 1.0
WHERE pulse_per_liter IS NULL OR pulse_per_liter = 0;

-- ========================================
-- 完成
-- ========================================

SELECT '数据库迁移完成！' AS status;
SELECT '已添加Units表字段: firmware_version, pulse_per_liter, error_codes' AS units_changes;
SELECT '已添加Transactions表字段: pulse_count, input_tds, output_tds, water_temp, record_id, dispensing_time' AS transactions_changes;
