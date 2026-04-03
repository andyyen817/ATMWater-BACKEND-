-- 创建设备参数配置表
-- 用于存储每个设备的菜单参数设置
-- 对应嵌入式协议中的Settings和QuerySets命令

CREATE TABLE IF NOT EXISTS device_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL UNIQUE COMMENT '设备ID',

  -- ========== 净水参数 (UF - Ultra Filtration) ==========
  A1 DECIMAL(5,1) DEFAULT 18.9 COMMENT '净水放水量(升/桶)',
  A2 INT DEFAULT 93 COMMENT '净水放水时间(秒/桶)',
  A3 DECIMAL(5,1) DEFAULT 4.0 COMMENT '净水每桶价格(元)',

  -- ========== RO水参数 (Reverse Osmosis) ==========
  B1 DECIMAL(5,1) DEFAULT 18.9 COMMENT 'RO放水量(升/桶)',
  B2 INT DEFAULT 103 COMMENT 'RO放水时间(秒/桶)',
  B3 DECIMAL(5,1) DEFAULT 8.0 COMMENT 'RO每桶价格(元)',

  -- ========== 设备控制参数 ==========
  C1 INT DEFAULT 30 COMMENT '臭氧开始工作(分钟)',
  C2 INT DEFAULT 120 COMMENT '臭氧工作时间(秒)',
  C3 INT DEFAULT 8 COMMENT '广告灯开启时间(小时)',
  C4 INT DEFAULT 20 COMMENT '广告灯关闭时间(小时)',

  -- ========== 密码 ==========
  P0 INT DEFAULT 231 COMMENT '设备设置密码',

  -- ========== 元数据 ==========
  updated_by INT COMMENT '最后更新人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备参数配置表';

-- 说明：
-- 1. A系列参数对应净水(UF)，B系列参数对应RO水
-- 2. 根据嵌入式协议，Type=0放RO水，Type=1放UF水
-- 3. P0密码仅用于设备本地设置，不通过TCP传输
-- 4. 所有参数都有默认值，设备首次连接时自动创建记录
