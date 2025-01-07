-- 检查用户是否已存在
DO $$
DECLARE
    hashed_password TEXT := '$2a$10$8HxmGZYqUYw69lsmL3CRPuPtk1GK4tZ0AX0jFfYkA1dW0Qx5T5Hmi'; -- 这是 'vijTo9-kehmet-cessis' 的 bcrypt hash
    referral_code TEXT := substr(md5(random()::text), 1, 8);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'info@eon-protocol.com') THEN
        INSERT INTO users (
            email,
            username,
            password,
            is_admin,
            points,
            credits,
            referral_code,
            createdat,
            updatedat
        ) VALUES (
            'info@eon-protocol.com',
            'info',
            hashed_password,
            true,
            0,
            0,
            referral_code,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Admin user created successfully';
    ELSE
        -- 更新现有管理员用户的密码
        UPDATE users 
        SET 
            password = hashed_password,
            is_admin = true,
            updatedat = CURRENT_TIMESTAMP
        WHERE email = 'info@eon-protocol.com';
        RAISE NOTICE 'Admin user updated successfully';
    END IF;
END $$;
