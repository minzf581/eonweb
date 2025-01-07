const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/auth/login.html');
    
    // 填写登录表单
    await page.fill('input[type="email"]', 'mz@qq.com');
    await page.fill('input[type="password"]', 'password123');
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 等待跳转到仪表板
    await expect(page).toHaveURL('/dashboard/index.html');
    
    // 验证仪表板页面元素
    await expect(page.locator('.user-points')).toBeVisible();
    await expect(page.locator('.referral-code')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login.html');
    
    // 填写错误的登录信息
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 验证错误消息
    await expect(page.locator('.error-message')).toBeVisible();
  });
});
