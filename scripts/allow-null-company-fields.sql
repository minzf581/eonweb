-- 允许 Company 表的字段为空（支持可选字段）
-- 2026-01-26

ALTER TABLE companies ALTER COLUMN name_cn DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN industry_primary DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN location_headquarters DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN description DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN stage DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN contact_name DROP NOT NULL;
ALTER TABLE companies ALTER COLUMN contact_email DROP NOT NULL;
