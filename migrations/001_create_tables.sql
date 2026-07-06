-- ===== 工资管理助手 - MySQL 建表脚本 =====
-- 创建时间: 2026-07-03
-- 版本: v1.0 (MySQL)
-- 注意: 需先创建数据库 salary_assistant

-- ===== 1. 用户表 =====
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(64) UNIQUE NOT NULL,
    unionid VARCHAR(64),
    nickname VARCHAR(50) NOT NULL,
    avatar_url VARCHAR(500),
    phone VARCHAR(20),
    points INT DEFAULT 0,
    `level` INT DEFAULT 1,
    exp INT DEFAULT 0,
    invite_code VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 2. 用户设置表 =====
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    hourly_rate DECIMAL(10,2) DEFAULT 25.00,
    night_rate DECIMAL(10,2) DEFAULT 20.00,
    standard_hours INT DEFAULT 8,
    factory_name VARCHAR(100),
    factory_city VARCHAR(50),
    reminder_enabled TINYINT(1) DEFAULT 0,
    reminder_time VARCHAR(5) DEFAULT '21:00',
    font_scale VARCHAR(10) DEFAULT 'medium',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 3. 工时记录表 =====
CREATE TABLE IF NOT EXISTS workhour_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    record_date DATE NOT NULL,
    hours DECIMAL(4,1) NOT NULL,
    shift VARCHAR(10) NOT NULL,
    pay_amount DECIMAL(10,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, record_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 4. 扣款记录表 =====
CREATE TABLE IF NOT EXISTS salary_deductions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month VARCHAR(7) NOT NULL,
    category VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    note VARCHAR(200),
    record_date VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 5. 花销记录表 =====
CREATE TABLE IF NOT EXISTS salary_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month VARCHAR(7) NOT NULL,
    category VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    note VARCHAR(200),
    record_date VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 6. 预支记录表 =====
CREATE TABLE IF NOT EXISTS salary_advances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month VARCHAR(7) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    note VARCHAR(200),
    record_date VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 7. 工资账单表 =====
CREATE TABLE IF NOT EXISTS salary_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month VARCHAR(7) NOT NULL,
    gross_salary DECIMAL(10,2) NOT NULL,
    actual_salary DECIMAL(10,2) NOT NULL,
    total_deductions DECIMAL(10,2) DEFAULT 0,
    total_expenses DECIMAL(10,2) DEFAULT 0,
    total_advances DECIMAL(10,2) DEFAULT 0,
    remaining DECIMAL(10,2) DEFAULT 0,
    is_settled TINYINT(1) DEFAULT 0,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_month (user_id, month),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 8. 检测记录表 =====
CREATE TABLE IF NOT EXISTS detection_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(20) NOT NULL,
    description VARCHAR(100) NOT NULL,
    result_text VARCHAR(200) NOT NULL,
    result_detail JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 9. 配置项表 =====
CREATE TABLE IF NOT EXISTS config_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(50) UNIQUE NOT NULL,
    value JSON NOT NULL,
    description VARCHAR(200),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 10. 法律知识库表 =====
CREATE TABLE IF NOT EXISTS legal_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    source VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    original_text TEXT NOT NULL,
    keywords JSON NOT NULL,
    applicable_scenarios JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 11. 用户协议同意记录表 =====
CREATE TABLE IF NOT EXISTS user_agreements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    agreement_type VARCHAR(20) NOT NULL,
    version VARCHAR(10) NOT NULL,
    accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_type (user_id, agreement_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
