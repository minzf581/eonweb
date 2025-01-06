-- 修改 tasks 表
ALTER TABLE tasks RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE tasks RENAME COLUMN "updatedAt" TO updated_at;

-- 修改 user_tasks 表
ALTER TABLE user_tasks RENAME COLUMN "userId" TO user_id;
ALTER TABLE user_tasks RENAME COLUMN "taskId" TO task_id;
ALTER TABLE user_tasks RENAME COLUMN "startTime" TO start_time;
ALTER TABLE user_tasks RENAME COLUMN "endTime" TO end_time;
ALTER TABLE user_tasks RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE user_tasks RENAME COLUMN "updatedAt" TO updated_at;

-- 修改 users 表
ALTER TABLE users RENAME COLUMN "referralCode" TO referral_code;
ALTER TABLE users RENAME COLUMN "referredBy" TO referred_by;
ALTER TABLE users RENAME COLUMN "lastLoginAt" TO last_login_at;
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE users RENAME COLUMN "isAdmin" TO is_admin;
