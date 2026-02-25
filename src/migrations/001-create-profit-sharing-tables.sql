-- ATMWater 分润系统数据库迁移脚本
-- 版本: 1.0.0
-- 日期: 2026-02-19

-- ============================================
-- 1. 创建区域定价表
-- ============================================
CREATE TABLE IF NOT EXISTS regional_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_code VARCHAR(50) NOT NULL UNIQUE COMMENT '区域代码',
  region_name VARCHAR(100) NOT NULL COMMENT '区域名称',
  pure_water_price DECIMAL(10,2) NOT NULL DEFAULT 400 COMMENT '纯净水价格(Rp/升)',
  mineral_water_price DECIMAL(10,2) NOT NULL DEFAULT 500 COMMENT '矿物水价格(Rp/升)',
  electricity_cost DECIMAL(10,2) COMMENT '电费成本(Rp/kWh)',
  water_cost DECIMAL(10,2) COMMENT '水费成本(Rp/m³)',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT COMMENT '更新人ID',
  INDEX idx_region_code (region_code),
  INDEX idx_is_active (is_active)
) COMMENT='区域定价配置表';

-- ============================================
-- 2. 创建水站月度销售统计表
-- ============================================
CREATE TABLE IF NOT EXISTS unit_monthly_sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT NOT NULL COMMENT '水站ID',
  device_id VARCHAR(50) NOT NULL COMMENT '设备ID',
  year INT NOT NULL COMMENT '年份',
  month INT NOT NULL COMMENT '月份(1-12)',
  total_volume DECIMAL(10,2) DEFAULT 0 COMMENT '总销售量(升)',
  total_revenue DECIMAL(10,2) DEFAULT 0 COMMENT '总收入(Rp)',
  free_threshold_volume DECIMAL(10,2) DEFAULT 34200 COMMENT '免分润阈值(升)',
  profit_sharing_volume DECIMAL(10,2) DEFAULT 0 COMMENT '参与分润的销售量(升)',
  steward_profit DECIMAL(10,2) DEFAULT 0 COMMENT '水管家分润(Rp)',
  rp_profit DECIMAL(10,2) DEFAULT 0 COMMENT '区域RP分润(Rp)',
  headquarters_revenue DECIMAL(10,2) DEFAULT 0 COMMENT '总部收入(Rp)',
  last_reset_at TIMESTAMP NULL COMMENT '最后重置时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_unit_month (unit_id, year, month),
  INDEX idx_device_id (device_id),
  INDEX idx_year_month (year, month),
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) COMMENT='水站月度销售统计表';

-- ============================================
-- 3. 创建每日销售告警表
-- ============================================
CREATE TABLE IF NOT EXISTS daily_sales_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT NOT NULL COMMENT '水站ID',
  device_id VARCHAR(50) NOT NULL COMMENT '设备ID',
  alert_date DATE NOT NULL COMMENT '告警日期',
  daily_volume DECIMAL(10,2) NOT NULL COMMENT '当日销售量(升)',
  alert_threshold DECIMAL(10,2) DEFAULT 850 COMMENT '告警阈值(升)',
  is_below_threshold BOOLEAN DEFAULT FALSE COMMENT '是否低于阈值',
  alert_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送告警',
  sent_at TIMESTAMP NULL COMMENT '发送时间',
  recipients TEXT COMMENT '接收人列表(JSON)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_unit_date (unit_id, alert_date),
  INDEX idx_alert_date (alert_date),
  INDEX idx_alert_sent (alert_sent),
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) COMMENT='每日销售告警记录表';

-- ============================================
-- 4. 创建新分润账本表
-- ============================================
CREATE TABLE IF NOT EXISTS profit_sharing_ledger (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL COMMENT '关联交易ID',
  unit_id INT NOT NULL COMMENT '水站ID',
  device_id VARCHAR(50) NOT NULL COMMENT '设备ID',
  user_id INT COMMENT '用户ID',
  account_type ENUM('Steward', 'RP', 'Headquarters') NOT NULL COMMENT '账户类型',
  amount DECIMAL(10,2) NOT NULL COMMENT '分润金额(Rp)',
  volume DECIMAL(10,2) COMMENT '对应水量(升)',
  profit_type ENUM('FreeThreshold', 'ProfitSharing') NOT NULL COMMENT '分润类型',
  month_year VARCHAR(7) NOT NULL COMMENT '月份(YYYY-MM)',
  description TEXT COMMENT '描述',
  status ENUM('Pending', 'Settled') DEFAULT 'Settled' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_unit_id (unit_id),
  INDEX idx_user_id (user_id),
  INDEX idx_account_type (account_type),
  INDEX idx_month_year (month_year),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) COMMENT='新分润账本表';

-- ============================================
-- 5. 创建支出明细表
-- ============================================
CREATE TABLE IF NOT EXISTS expense_breakdown (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT NOT NULL COMMENT '水站ID',
  device_id VARCHAR(50) NOT NULL COMMENT '设备ID',
  month_year VARCHAR(7) NOT NULL COMMENT '月份(YYYY-MM)',
  device_subscription_fee DECIMAL(10,2) DEFAULT 0 COMMENT '设备订阅费(Rp)',
  software_subscription_fee DECIMAL(10,2) DEFAULT 0 COMMENT '软件订阅费(Rp)',
  network_fee DECIMAL(10,2) DEFAULT 0 COMMENT '网络费用(Rp)',
  total_expense DECIMAL(10,2) DEFAULT 0 COMMENT '总支出(Rp)',
  base_volume DECIMAL(10,2) DEFAULT 850 COMMENT '基准水量(升/天)',
  water_price DECIMAL(10,2) COMMENT '售水价格(Rp/升)',
  calculation_note TEXT COMMENT '计算说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_unit_month (unit_id, month_year),
  INDEX idx_month_year (month_year),
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) COMMENT='水站月度支出明细表';

-- ============================================
-- 6. 修改 units 表 - 添加分润相关字段
-- ============================================
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS region_code VARCHAR(50) COMMENT '所属区域代码',
  ADD COLUMN IF NOT EXISTS rp_owner_id INT COMMENT '区域RP负责人ID',
  ADD COLUMN IF NOT EXISTS profit_sharing_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用分润',
  ADD COLUMN IF NOT EXISTS monthly_free_threshold DECIMAL(10,2) DEFAULT 34200 COMMENT '月度免分润阈值(升)',
  ADD COLUMN IF NOT EXISTS steward_profit_ratio DECIMAL(5,2) DEFAULT 80 COMMENT '水管家分润比例(%)',
  ADD COLUMN IF NOT EXISTS rp_profit_ratio DECIMAL(5,2) DEFAULT 20 COMMENT 'RP分润比例(%)';

-- ============================================
-- 7. 修改 users 表 - 添加区域管理字段
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS managed_region VARCHAR(50) COMMENT 'RP管理的区域代码';

-- ============================================
-- 8. 修改 settings 表 - 添加新分润配置字段
-- ============================================
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS new_profit_sharing_config JSON COMMENT '新分润配置';
