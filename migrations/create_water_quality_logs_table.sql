-- 创建水质日志表 (water_quality_logs)
-- 用于存储设备的水质监测数据，包括TDS、pH、温度等传感器数据

CREATE TABLE IF NOT EXISTS water_quality_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- 设备关联
    unit_id INT NOT NULL COMMENT '关联的设备ID (units表)',
    device_id VARCHAR(50) NOT NULL COMMENT '设备编号',

    -- 水质数据
    pure_tds INT COMMENT '纯水TDS值 (PPM)',
    raw_tds INT COMMENT '原水TDS值 (PPM)',
    ph DECIMAL(3, 1) DEFAULT 7.0 COMMENT 'pH值',
    temperature DECIMAL(4, 1) COMMENT '温度 (摄氏度)',

    -- 记录时间
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '数据采集时间',

    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 索引
    INDEX idx_unit_id (unit_id),
    INDEX idx_device_id (device_id),
    INDEX idx_timestamp (timestamp),

    -- 外键约束
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='水质监测日志表';
