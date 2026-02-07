#!/usr/bin/env python3
"""
修复公司联系人脚本
将公司的user_id和contact_email更新为新的联系人邮箱
"""
import psycopg2
import sys
from urllib.parse import urlparse

# 数据库连接
DATABASE_URL = "postgresql://postgres:VmPQYyympykEtaHihWGKyaslZSGhjMJu@trolley.proxy.rlwy.net:42525/railway"

def get_db_connection():
    """获取数据库连接"""
    result = urlparse(DATABASE_URL)
    conn = psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port
    )
    return conn

def find_company_by_name(conn, company_name):
    """根据公司名称查找公司"""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, name_cn, name_en, user_id, contact_email, contact_name
        FROM companies
        WHERE name_en ILIKE %s OR name_cn ILIKE %s
        LIMIT 5
    """, (f'%{company_name}%', f'%{company_name}%'))
    companies = cur.fetchall()
    cur.close()
    return companies

def find_user_by_email(conn, email):
    """根据邮箱查找用户"""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, email, name, role, status
        FROM users
        WHERE email = %s
    """, (email,))
    user = cur.fetchone()
    cur.close()
    return user

def update_company_contact(conn, company_id, new_user_id, new_contact_email):
    """更新公司联系人"""
    cur = conn.cursor()
    try:
        # 更新user_id和contact_email
        cur.execute("""
            UPDATE companies
            SET user_id = %s, contact_email = %s, updated_at = NOW()
            WHERE id = %s
        """, (new_user_id, new_contact_email, company_id))
        conn.commit()
        cur.close()
        return True
    except Exception as e:
        conn.rollback()
        cur.close()
        print(f"更新失败: {e}")
        return False

def main():
    import sys
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    
    company_name = "POL"
    old_email = "41912912@qq.com"
    new_email = "leo@polgroupusa.com"
    
    print(f"查找公司: {company_name}")
    print(f"旧联系人: {old_email}")
    print(f"新联系人: {new_email}")
    print("-" * 50)
    
    conn = get_db_connection()
    
    # 查找公司
    companies = find_company_by_name(conn, company_name)
    if not companies:
        print(f"未找到公司: {company_name}")
        conn.close()
        return
    
    print(f"找到 {len(companies)} 个公司:")
    for i, company in enumerate(companies, 1):
        print(f"{i}. ID: {company[0]}, 中文名: {company[1]}, 英文名: {company[2]}, 当前user_id: {company[3]}, 当前contact_email: {company[4]}")
    
    # 查找新用户
    new_user = find_user_by_email(conn, new_email)
    if not new_user:
        print(f"\n错误: 未找到用户 {new_email}")
        print("请先创建该用户账户")
        conn.close()
        return
    
    print(f"\n找到新用户:")
    print(f"  ID: {new_user[0]}")
    print(f"  邮箱: {new_user[1]}")
    print(f"  姓名: {new_user[2]}")
    print(f"  角色: {new_user[3]}")
    print(f"  状态: {new_user[4]}")
    
    if new_user[3] != 'company':
        print(f"\n警告: 用户角色是 {new_user[3]}，不是 'company'")
        print("建议先将用户角色改为 'company'")
    
    # 更新第一个匹配的公司
    company_id = companies[0][0]
    new_user_id = new_user[0]
    
    print(f"\n准备更新公司 ID: {company_id}")
    print(f"  新 user_id: {new_user_id}")
    print(f"  新 contact_email: {new_email}")
    
    if not auto_confirm:
        try:
            confirm = input("\n确认更新? (yes/no): ")
            if confirm.lower() != 'yes':
                print("取消更新")
                conn.close()
                return
        except EOFError:
            print("\n非交互式模式，使用 --yes 参数自动确认")
            conn.close()
            return
    
    if update_company_contact(conn, company_id, new_user_id, new_email):
        print("\n✓ 更新成功!")
        print(f"  公司 ID: {company_id}")
        print(f"  新 user_id: {new_user_id}")
        print(f"  新 contact_email: {new_email}")
        print("\n现在 leo@polgroupusa.com 登录后应该能看到公司POL了")
    else:
        print("\n✗ 更新失败")
    
    conn.close()

if __name__ == "__main__":
    main()
