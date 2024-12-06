CREATE DATABASE eon_protocol;
USE eon_protocol;

-- 用户表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(10) UNIQUE,
    referred_by VARCHAR(10),
    points DECIMAL(20,2) DEFAULT 0,
    status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (referred_by) REFERENCES users(referral_code)
);

-- 任务表
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status ENUM('active', 'paused', 'completed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户任务关系表
CREATE TABLE user_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    task_id INT,
    status ENUM('not_started', 'running', 'paused', 'completed') DEFAULT 'not_started',
    points_earned DECIMAL(20,2) DEFAULT 0,
    start_time TIMESTAMP NULL,
    last_update TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 积分历史表
CREATE TABLE point_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    task_id INT,
    points DECIMAL(20,2) NOT NULL,
    type ENUM('earned', 'referral', 'bonus', 'deducted') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 插入默认任务
INSERT INTO tasks (task_id, name, description, status) 
VALUES ('001', 'Bandwidth Sharing', 'Share bandwidth to support AI data crawling', 'active');