-- 更新管理员用户密码
-- 密码: vijTo9-kehmet-cessis
-- 哈希: $2a$10$LjhDXCgvSPfmmj5X8z7Nn.eNZIj8ftPJG8D1P4dMkFi4aDu4mZ.eq
UPDATE "Users"
SET "password" = '$2a$10$LjhDXCgvSPfmmj5X8z7Nn.eNZIj8ftPJG8D1P4dMkFi4aDu4mZ.eq',
    "updatedAt" = NOW()
WHERE "email" = 'info@eon-protocol.com';
