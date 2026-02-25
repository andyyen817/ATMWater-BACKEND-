-- 创建维护日志表 (maintenance_logs)
-- 用于存储设备维护记录，包括检查清单、水质数据、照片等信息

CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- 设备关联
    unit_id INT NOT NULL COMMENT '关联的设备ID (units表)',
    device_id VARCHAR(50) NOT NULL COMMENT '设备编号',

    -- 管家关联
    steward_id INT NOT NULL COMMENT '执行维护的管家ID (users表)',

    -- 位置信息
    latitude DECIMAL(10, 8) COMMENT '纬度',
    longitude DECIMAL(11, 8) COMMENT '经度',
    address VARCHAR(255) COMMENT '地址描述',

    -- 维护照片
    photo_url VARCHAR(500) NOT NULL COMMENT '维护照片URL',

    -- 检查清单
    cleaned BOOLEAN DEFAULT FALSE COMMENT '是否已清洁',
    filter_checked BOOLEAN DEFAULT FALSE COMMENT '是否已检查滤芯',
    leakage_checked BOOLEAN DEFAULT FALSE COMMENT '是否已检查漏水',

    -- 水质数据
    tds_value INT COMMENT 'TDS值 (PPM)',
    ph_value DECIMAL(3, 1) COMMENT 'pH值',

    -- 审核状态
    status ENUM('Pending', 'Verified', 'Rejected') DEFAULT 'Verified' COMMENT '审核状态',

    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 索引
    INDEX idx_unit_id (unit_id),
    INDEX idx_device_id (device_id),
    INDEX idx_steward_id (steward_id),
    INDEX idx_created_at (created_at),

    -- 外键约束
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY (steward_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备维护日志表';
