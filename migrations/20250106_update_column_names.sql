-- 修改 tasks 表
ALTER TABLE tasks 
  RENAME COLUMN "createdAt" TO created_at,
  RENAME COLUMN "updatedAt" TO updated_at;

-- 修改 user_tasks 表
ALTER TABLE user_tasks 
  RENAME COLUMN "userId" TO user_id,
  RENAME COLUMN "taskId" TO task_id,
  RENAME COLUMN "startTime" TO start_time,
  RENAME COLUMN "endTime" TO end_time,
  RENAME COLUMN "createdAt" TO created_at,
  RENAME COLUMN "updatedAt" TO updated_at;

-- 修改 users 表
ALTER TABLE users 
  RENAME COLUMN "referralCode" TO referral_code,
  RENAME COLUMN "referredBy" TO referred_by,
  RENAME COLUMN "lastLoginAt" TO last_login_at,
  RENAME COLUMN "createdAt" TO created_at,
  RENAME COLUMN "updatedAt" TO updated_at,
  RENAME COLUMN "isAdmin" TO is_admin;
