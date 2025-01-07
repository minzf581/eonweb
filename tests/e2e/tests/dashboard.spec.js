const { test, expect } = require('@playwright/test');

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/auth/login.html');
    await page.fill('input[type="email"]', 'mz@qq.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard/index.html');
  });

  test('should display user stats correctly', async ({ page }) => {
    // 验证用户统计信息
    await expect(page.locator('.user-points')).toBeVisible();
    await expect(page.locator('.user-credits')).toBeVisible();
    await expect(page.locator('.completed-tasks')).toBeVisible();
    await expect(page.locator('.referral-code')).toBeVisible();
  });

  test('should display tasks list', async ({ page }) => {
    // 验证任务列表
    await expect(page.locator('.tasks-list')).toBeVisible();
    const tasks = await page.locator('.task-item').count();
    expect(tasks).toBeGreaterThan(0);
  });

  test('should be able to start a task', async ({ page }) => {
    // 找到第一个可用的任务
    const firstTask = await page.locator('.task-item:not(.completed)').first();
    await firstTask.locator('button.start-task').click();
    
    // 验证任务状态更新
    await expect(firstTask.locator('.task-status')).toHaveText('In Progress');
  });

  test('should display referral information', async ({ page }) => {
    // 验证推荐信息
    await expect(page.locator('.referral-section')).toBeVisible();
    await expect(page.locator('.referral-link')).toBeVisible();
    
    // 验证复制按钮功能
    const copyButton = page.locator('button.copy-referral');
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    // 验证复制成功提示
    await expect(page.locator('.copy-success')).toBeVisible();
  });
});
