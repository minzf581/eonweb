-- 修改 tasks 表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'createdAt') THEN
        ALTER TABLE tasks RENAME COLUMN "createdAt" TO created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'updatedAt') THEN
        ALTER TABLE tasks RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'deleted_at') THEN
        ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 修改 user_tasks 表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'userId') THEN
        ALTER TABLE user_tasks RENAME COLUMN "userId" TO user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'taskId') THEN
        ALTER TABLE user_tasks RENAME COLUMN "taskId" TO task_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'startTime') THEN
        ALTER TABLE user_tasks RENAME COLUMN "startTime" TO start_time;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'endTime') THEN
        ALTER TABLE user_tasks RENAME COLUMN "endTime" TO end_time;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'createdAt') THEN
        ALTER TABLE user_tasks RENAME COLUMN "createdAt" TO created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'updatedAt') THEN
        ALTER TABLE user_tasks RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'deleted_at') THEN
        ALTER TABLE user_tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 修改 users 表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referralCode') THEN
        ALTER TABLE users RENAME COLUMN "referralCode" TO referral_code;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referredBy') THEN
        ALTER TABLE users RENAME COLUMN "referredBy" TO referred_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastLoginAt') THEN
        ALTER TABLE users RENAME COLUMN "lastLoginAt" TO last_login_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'createdAt') THEN
        ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updatedAt') THEN
        ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isAdmin') THEN
        ALTER TABLE users RENAME COLUMN "isAdmin" TO is_admin;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
