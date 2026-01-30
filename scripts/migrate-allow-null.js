/**
 * 数据库迁移脚本：允许 Company 表字段为空
 * 在 Railway 环境中执行
 */
const { Client } = require('pg');

async function runMigration() {
    // 优先使用环境变量，如果是本地开发用的 localhost，则使用指定的 Railway 数据库
    let databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || databaseUrl.includes('localhost')) {
        databaseUrl = 'postgresql://postgres:VmPQYyympykEtaHihWGKyaslZSGhjMJu@postgres-dp8w.railway.internal:5432/railway';
    }
    
    console.log('正在连接数据库...');
    console.log('DATABASE_URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'));
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });
    
    try {
        await client.connect();
        console.log('数据库连接成功！\n');
        
        const alterStatements = [
            'ALTER TABLE companies ALTER COLUMN name_cn DROP NOT NULL',
            'ALTER TABLE companies ALTER COLUMN industry_primary DROP NOT NULL',
            'ALTER TABLE companies ALTER COLUMN location_headquarters DROP NOT NULL',
            'ALTER TABLE companies ALTER COLUMN description DROP NOT NULL',
            'ALTER TABLE companies ALTER COLUMN stage DROP NOT NULL',
            'ALTER TABLE companies ALTER COLUMN contact_name DROP NOT NULL',
            'ALTER TABLE companies ALTER COLUMN contact_email DROP NOT NULL',
        ];
        
        for (const sql of alterStatements) {
            try {
                console.log(`执行: ${sql}`);
                await client.query(sql);
                console.log('  ✓ 成功');
            } catch (err) {
                if (err.message.includes('does not have a NOT NULL constraint')) {
                    console.log('  ⚠ 跳过（约束已移除）');
                } else {
                    console.log(`  ⚠ 跳过: ${err.message}`);
                }
            }
        }
        
        console.log('\n迁移完成！验证结果：');
        
        const result = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'companies' 
            AND column_name IN ('name_cn', 'industry_primary', 'location_headquarters', 'description', 'stage', 'contact_name', 'contact_email')
            ORDER BY column_name
        `);
        
        for (const row of result.rows) {
            console.log(`  ${row.column_name}: nullable = ${row.is_nullable}`);
        }
        
    } catch (err) {
        console.error('错误:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
