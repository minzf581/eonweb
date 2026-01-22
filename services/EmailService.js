/**
 * EON Protocol 邮件服务
 * 支持 Resend API 和 SMTP (nodemailer) 两种方式
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.resendApiKey = process.env.RESEND_API_KEY;
        this.smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
        this.defaultFrom = process.env.EMAIL_FROM || 'EON Protocol <noreply@eon-protocol.com>';
        
        // 如果配置了 SMTP，创建 nodemailer transporter
        if (this.smtpConfigured) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        }
    }

    /**
     * 检查邮件服务是否已配置
     */
    isConfigured() {
        return !!(this.resendApiKey || this.smtpConfigured);
    }

    /**
     * 获取配置状态
     */
    getStatus() {
        return {
            configured: this.isConfigured(),
            provider: this.resendApiKey ? 'Resend' : (this.smtpConfigured ? 'SMTP' : null),
            smtp_host: this.smtpConfigured ? process.env.SMTP_HOST : null
        };
    }

    /**
     * 发送邮件
     */
    async sendEmail({ to, subject, html, text, attachments = [] }) {
        if (!this.isConfigured()) {
            console.log('[EmailService] 邮件服务未配置，跳过发送');
            return { success: false, error: '邮件服务未配置' };
        }

        // 优先使用 Resend
        if (this.resendApiKey) {
            return this.sendViaResend({ to, subject, html, text, attachments });
        }

        // 回退到 SMTP
        if (this.smtpConfigured) {
            return this.sendViaSMTP({ to, subject, html, text, attachments });
        }

        return { success: false, error: '没有可用的邮件发送方式' };
    }

    /**
     * 通过 Resend API 发送邮件
     */
    async sendViaResend({ to, subject, html, text, attachments }) {
        try {
            const emailData = {
                from: this.defaultFrom,
                to: Array.isArray(to) ? to : [to],
                subject,
                html
            };

            if (text) {
                emailData.text = text;
            }

            // 处理附件
            if (attachments && attachments.length > 0) {
                emailData.attachments = attachments.map(att => ({
                    filename: att.filename,
                    content: att.content
                }));
            }

            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[EmailService] Resend 错误:', result);
                return { success: false, error: result.message || 'Resend API 错误' };
            }

            console.log(`[EmailService] Resend 邮件发送成功: ${to}, ID: ${result.id}`);
            return { success: true, messageId: result.id };
        } catch (error) {
            console.error('[EmailService] Resend 发送失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 通过 SMTP 发送邮件
     */
    async sendViaSMTP({ to, subject, html, text, attachments }) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || this.defaultFrom,
                to,
                subject,
                html
            };

            if (text) {
                mailOptions.text = text;
            }

            // 处理附件
            if (attachments && attachments.length > 0) {
                mailOptions.attachments = attachments.map(att => ({
                    filename: att.filename,
                    content: Buffer.from(att.content, 'base64'),
                    contentType: att.mimetype
                }));
            }

            const result = await this.transporter.sendMail(mailOptions);

            console.log(`[EmailService] SMTP 邮件发送成功: ${to}, ID: ${result.messageId}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('[EmailService] SMTP 发送失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 生成标准的 EON Protocol 邮件模板
     */
    generateTemplate({ title, content, statusChange, actionUrl, actionText }) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0D43F9 0%, #4AD8FD 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">EON Protocol</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #1F2937; font-size: 20px; font-weight: 600;">${title}</h2>
                            <div style="color: #4B5563; font-size: 16px; line-height: 1.6;">
                                ${content.replace(/\n/g, '<br>')}
                            </div>
                            ${statusChange ? `<div style="margin-top: 24px; padding: 16px; background: #F0FDF4; border-radius: 8px; border-left: 4px solid #10B981;"><p style="margin: 0; color: #065F46; font-size: 14px;"><strong>状态更新:</strong> ${statusChange}</p></div>` : ''}
                            ${actionUrl ? `<div style="margin-top: 30px; text-align: center;"><a href="${actionUrl}" style="display: inline-block; padding: 14px 28px; background: #0D43F9; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px;">${actionText || '查看详情'}</a></div>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 30px; background: #F9FAFB; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px; text-align: center;">此邮件由 EON Protocol 系统自动发送，请勿直接回复。</p>
                            <p style="margin: 0; color: #9CA3AF; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} EON Protocol. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
    }

    /**
     * 发送系统消息通知邮件
     */
    async sendMessageNotification({ to, senderName, subject, content, statusChange }) {
        const html = this.generateTemplate({
            title: subject,
            content: `<p style="color: #6B7280; margin-bottom: 16px;">您收到来自 <strong>${senderName}</strong> 的消息：</p><div style="padding: 20px; background: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">${content}</div>`,
            statusChange,
            actionUrl: process.env.SITE_URL || 'https://eonprotocol.ai',
            actionText: '登录查看'
        });

        return this.sendEmail({ to, subject, html });
    }

    /**
     * 发送审核结果通知
     */
    async sendReviewNotification({ to, entityType, entityName, status, feedback }) {
        const statusText = { approved: '已通过', rejected: '已拒绝', pending: '待审核' };
        const statusColors = {
            approved: { bg: '#D1FAE5', text: '#065F46', label: '✅ 审核通过' },
            rejected: { bg: '#FEE2E2', text: '#991B1B', label: '❌ 审核未通过' },
            pending: { bg: '#FEF3C7', text: '#92400E', label: '⏳ 等待审核' }
        };

        const statusStyle = statusColors[status] || statusColors.pending;
        const title = `${entityType === 'company' ? '企业' : '投资人'}审核结果通知`;

        const html = this.generateTemplate({
            title,
            content: `<p>您的${entityType === 'company' ? '企业' : '投资人'}资料 <strong>${entityName}</strong> 审核结果如下：</p><div style="margin: 20px 0; padding: 16px; background: ${statusStyle.bg}; border-radius: 8px; text-align: center;"><span style="color: ${statusStyle.text}; font-size: 18px; font-weight: 600;">${statusStyle.label}</span></div>${feedback ? `<div style="margin-top: 20px;"><p style="margin-bottom: 8px; font-weight: 500; color: #374151;">管理员反馈：</p><div style="padding: 16px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #0D43F9;">${feedback}</div></div>` : ''}`,
            actionUrl: process.env.SITE_URL || 'https://eonprotocol.ai',
            actionText: '登录查看详情'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] ${title} - ${statusText[status] || status}`, html });
    }

    /**
     * 发送访问请求处理结果通知
     */
    async sendAccessRequestNotification({ to, companyName, requestType, status, adminResponse }) {
        const requestTypeText = { bp_access: 'BP 文件访问', introduction: '企业引荐', meeting: '会议安排', data_room: '数据室访问' };
        const statusText = status === 'approved' ? '已批准' : '已拒绝';
        const title = `访问请求${statusText}`;

        const statusBadge = status === 'approved' 
            ? '<div style="margin: 20px 0; padding: 16px; background: #D1FAE5; border-radius: 8px; text-align: center;"><span style="color: #065F46; font-size: 16px;">✅ 您现在可以查看相关信息</span></div>'
            : '<div style="margin: 20px 0; padding: 16px; background: #FEE2E2; border-radius: 8px; text-align: center;"><span style="color: #991B1B; font-size: 16px;">❌ 请求未被批准</span></div>';

        const html = this.generateTemplate({
            title,
            content: `<p>您对 <strong>${companyName}</strong> 的 ${requestTypeText[requestType] || requestType} 请求${statusText}。</p>${statusBadge}${adminResponse ? `<div style="margin-top: 20px;"><p style="margin-bottom: 8px; font-weight: 500; color: #374151;">管理员回复：</p><div style="padding: 16px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #0D43F9;">${adminResponse}</div></div>` : ''}`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/investor`,
            actionText: '查看我的请求'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] 访问请求${statusText} - ${companyName}`, html });
    }

    /**
     * 发送新访问请求通知给管理员
     */
    async sendNewAccessRequestNotification({ to, investorName, companyName, requestType, message }) {
        const requestTypeText = { bp_access: 'BP 文件访问', introduction: '企业引荐', meeting: '会议安排', data_room: '数据室访问' };

        const html = this.generateTemplate({
            title: '新的访问请求',
            content: `<p>投资人 <strong>${investorName}</strong> 向企业 <strong>${companyName}</strong> 发起了访问请求。</p><table style="width: 100%; margin: 20px 0; border-collapse: collapse;"><tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500; width: 120px;">请求类型</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${requestTypeText[requestType] || requestType}</td></tr><tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">投资人</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${investorName}</td></tr><tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">目标企业</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${companyName}</td></tr>${message ? `<tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">附言</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${message}</td></tr>` : ''}</table>`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#requests`,
            actionText: '处理请求'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] 新访问请求 - ${investorName} → ${companyName}`, html });
    }
}

// 导出单例实例
module.exports = new EmailService();
