-- 水币系统数据库迁移脚本 v2
-- 日期: 2026-03-10
-- 修正内容: 改为每日阈值 + 9:1分账 + 简化物理卡管理

-- ========================================
-- 第一部分：Transactions 表升级
-- ========================================

-- 添加水币来源追踪字段
ALTER TABLE transactions
ADD COLUMN balance_type ENUM('APP_BACKED', 'PHYSICAL_BACKED') DEFAULT 'APP_BACKED'
COMMENT '水币来源类型: APP_BACKED=App充值, PHYSICAL_BACKED=物理卡';

ALTER TABLE transactions
ADD COLUMN origin_card_id INT NULL
COMMENT '物理卡ID（若来源为物理卡）';

-- 添加分账信息字段
ALTER TABLE transactions
ADD COLUMN profit_shared BOOLEAN DEFAULT FALSE
COMMENT '是否已分账';

ALTER TABLE transactions
ADD COLUMN station_revenue DECIMAL(10,2) DEFAULT 0
COMMENT '站点分润金额';

ALTER TABLE transactions
ADD COLUMN rp_revenue DECIMAL(10,2) DEFAULT 0
COMMENT 'RP区域代理分润金额';

-- 添加索引优化查询
ALTER TABLE transactions ADD INDEX idx_balance_type (balance_type);
ALTER TABLE transactions ADD INDEX idx_profit_shared (profit_shared);
ALTER TABLE transactions ADD INDEX idx_origin_card_id (origin_card_id);

-- ========================================
-- 第二部分：创建每日出水量计数器表
-- ========================================

CREATE TABLE IF NOT EXISTS daily_dispense_counters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT NOT NULL COMMENT '售水站ID',
  date DATE NOT NULL COMMENT '日期: 2026-03-10',
  app_backed_volume DECIMAL(10,2) DEFAULT 0 COMMENT 'App水币累计出水量（升）',
  threshold_reached BOOLEAN DEFAULT FALSE COMMENT '是否已达570L阈值',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_unit_date (unit_id, date),
  INDEX idx_date (date),
  INDEX idx_threshold (threshold_reached),

  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日App水币出水量统计表';

-- ========================================
-- 第三部分：数据迁移
-- ========================================

-- 将现有交易标记为 APP_BACKED（假设历史数据都是App充值）
UPDATE transactions
SET balance_type = 'APP_BACKED',
    profit_shared = TRUE
WHERE balance_type IS NULL;

-- ========================================
-- 第四部分：验证迁移结果
-- ========================================

-- 检查新增字段
SELECT
    COUNT(*) as total_transactions,
    SUM(CASE WHEN balance_type = 'APP_BACKED' THEN 1 ELSE 0 END) as app_backed_count,
    SUM(CASE WHEN balance_type = 'PHYSICAL_BACKED' THEN 1 ELSE 0 END) as physical_backed_count
FROM transactions;

-- 检查新表
SELECT COUNT(*) as counter_records FROM daily_dispense_counters;

-- ========================================
-- 第五部分：清理旧表（如果存在）
-- ========================================

-- 如果之前创建了月度计数器表，可以选择删除
-- DROP TABLE IF EXISTS monthly_dispense_counters;

-- ========================================
-- 完成提示
-- ========================================

SELECT '数据库升级完成！v2版本：每日阈值 + 9:1分账' as status;
