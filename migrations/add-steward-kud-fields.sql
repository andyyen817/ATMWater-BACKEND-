-- 售水站管理者APP所需的数据库字段迁移
-- 日期: 2026-03-10

-- 1. 为 physical_cards 表添加 issued_by 字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'physical_cards'
               AND COLUMN_NAME = 'issued_by');

SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE physical_cards ADD COLUMN issued_by INT NULL COMMENT ''发卡人ID（售水站管理者）'' AFTER batch_id',
  'SELECT ''issued_by already exists'' AS message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 添加外键约束（如果不存在）
SET @fk_exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                  WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'physical_cards'
                  AND CONSTRAINT_NAME = 'fk_physical_cards_issued_by');

SET @sqlstmt := IF(@fk_exist = 0,
  'ALTER TABLE physical_cards ADD CONSTRAINT fk_physical_cards_issued_by FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT ''Foreign key already exists'' AS message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 为 transactions 表添加 station_revenue 字段
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'transactions'
               AND COLUMN_NAME = 'station_revenue');

SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE transactions ADD COLUMN station_revenue DECIMAL(10,2) DEFAULT 0.00 COMMENT ''站点收入'' AFTER amount',
  'SELECT ''station_revenue already exists'' AS message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 为 transactions 表添加 rp_revenue 字段
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'transactions'
               AND COLUMN_NAME = 'rp_revenue');

SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE transactions ADD COLUMN rp_revenue DECIMAL(10,2) DEFAULT 0.00 COMMENT ''RP收入'' AFTER station_revenue',
  'SELECT ''rp_revenue already exists'' AS message');

PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 完成
SELECT '✅ 售水站管理者APP字段迁移完成' AS status;
