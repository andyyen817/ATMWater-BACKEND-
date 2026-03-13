-- ============================================
-- 水币系统数据库升级脚本
-- 版本: v1.0
-- 日期: 2026-03-10
-- 描述: 支持水币来源追踪和分账逻辑
-- ============================================

-- 1. Transactions 表新增字段
ALTER TABLE transactions
ADD COLUMN balance_type ENUM('APP_BACKED', 'PHYSICAL_BACKED') DEFAULT 'APP_BACKED'
COMMENT '水币来源类型: APP_BACKED=App充值, PHYSICAL_BACKED=物理卡';

ALTER TABLE transactions
ADD COLUMN origin_card_id INT NULL
COMMENT '物理卡ID（若来源为物理卡）';

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
ALTER TABLE transactions
ADD INDEX idx_balance_type (balance_type);

ALTER TABLE transactions
ADD INDEX idx_profit_shared (profit_shared);

-- 2. 创建月度出水量计数器表
CREATE TABLE IF NOT EXISTS monthly_dispense_counters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT NOT NULL COMMENT '售水站ID',
  year_month VARCHAR(7) NOT NULL COMMENT '年月格式: 2026-03',
  app_backed_volume DECIMAL(10,2) DEFAULT 0 COMMENT 'App水币累计出水量（升）',
  threshold_reached BOOLEAN DEFAULT FALSE COMMENT '是否已达570L阈值',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_unit_month (unit_id, year_month),
  INDEX idx_year_month (year_month),
  INDEX idx_threshold (threshold_reached)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='月度App水币出水量统计';

-- 3. Cards 表新增字段
ALTER TABLE cards
ADD COLUMN sold_by_station_id INT NULL
COMMENT '售卡站点ID';

ALTER TABLE cards
ADD COLUMN sold_at TIMESTAMP NULL
COMMENT '售卡时间';

ALTER TABLE cards
ADD COLUMN presplit_done BOOLEAN DEFAULT FALSE
COMMENT '是否已预分账';

-- 添加索引
ALTER TABLE cards
ADD INDEX idx_sold_by_station (sold_by_station_id);

ALTER TABLE cards
ADD INDEX idx_presplit_done (presplit_done);

-- 4. 数据迁移：将现有交易标记为 APP_BACKED
UPDATE transactions
SET balance_type = 'APP_BACKED',
    profit_shared = TRUE
WHERE balance_type IS NULL;

-- 5. 创建财务分账记录表（可选，用于详细记录）
CREATE TABLE IF NOT EXISTS revenue_splits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL COMMENT '关联交易ID',
  unit_id INT NOT NULL COMMENT '售水站ID',
  split_type ENUM('APP_PROFIT', 'CARD_PRESPLIT', 'CROSS_STATION_COMPENSATION') NOT NULL COMMENT '分账类型',
  station_amount DECIMAL(10,2) DEFAULT 0 COMMENT '站点收入',
  rp_amount DECIMAL(10,2) DEFAULT 0 COMMENT 'RP收入',
  hq_amount DECIMAL(10,2) DEFAULT 0 COMMENT '总部收入',
  description TEXT COMMENT '描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction (transaction_id),
  INDEX idx_unit (unit_id),
  INDEX idx_split_type (split_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收入分账明细记录';

-- 6. 添加触发器：自动更新 updated_at
DELIMITER $$
CREATE TRIGGER trg_monthly_dispense_counters_update
BEFORE UPDATE ON monthly_dispense_counters
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- 完成提示
SELECT '数据库升级完成！' AS status,
       '已添加水币来源追踪、分账逻辑和月度计数器功能' AS message;
