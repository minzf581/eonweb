#!/usr/bin/env python3
"""
数据库迁移脚本：允许 Company 表字段为空
"""
import psycopg2

# Railway 数据库公网代理地址
DATABASE_URL = "postgresql://postgres:VmPQYyympykEtaHihWGKyaslZSGhjMJu@trolley.proxy.rlwy.net:42525/railway"

def run_migration():
    print("正在连接数据库...")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("数据库连接成功！\n")
        
        # 执行迁移
        alter_statements = [
            "ALTER TABLE companies ALTER COLUMN name_cn DROP NOT NULL",
            "ALTER TABLE companies ALTER COLUMN industry_primary DROP NOT NULL",
            "ALTER TABLE companies ALTER COLUMN location_headquarters DROP NOT NULL",
            "ALTER TABLE companies ALTER COLUMN description DROP NOT NULL",
            "ALTER TABLE companies ALTER COLUMN stage DROP NOT NULL",
            "ALTER TABLE companies ALTER COLUMN contact_name DROP NOT NULL",
            "ALTER TABLE companies ALTER COLUMN contact_email DROP NOT NULL",
        ]
        
        for sql in alter_statements:
            try:
                print(f"执行: {sql}")
                cursor.execute(sql)
                print("  ✓ 成功")
            except Exception as e:
                if "does not have a NOT NULL constraint" in str(e):
                    print("  ⚠ 跳过（约束已移除）")
                else:
                    print(f"  ⚠ 跳过: {e}")
        
        print("\n迁移完成！")
        
        # 验证结果
        cursor.execute("""
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'companies' 
            AND column_name IN ('name_cn', 'industry_primary', 'location_headquarters', 'description', 'stage', 'contact_name', 'contact_email')
            ORDER BY column_name
        """)
        
        print("\n验证结果：")
        for row in cursor.fetchall():
            print(f"  {row[0]}: nullable = {row[1]}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    run_migration()
