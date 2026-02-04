/**
 * EON Protocol Email Service
 * Supports Resend API and SMTP (nodemailer)
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.resendApiKey = process.env.RESEND_API_KEY;
        this.smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
        this.defaultFrom = process.env.EMAIL_FROM || 'EON Protocol <noreply@eon-protocol.com>';
        
        // Create nodemailer transporter if SMTP is configured
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
     * Check if email service is configured
     */
    isConfigured() {
        return !!(this.resendApiKey || this.smtpConfigured);
    }

    /**
     * Get configuration status
     */
    getStatus() {
        return {
            configured: this.isConfigured(),
            provider: this.resendApiKey ? 'Resend' : (this.smtpConfigured ? 'SMTP' : null),
            smtp_host: this.smtpConfigured ? process.env.SMTP_HOST : null
        };
    }

    /**
     * Send email
     */
    async sendEmail({ to, subject, html, text, attachments = [] }) {
        if (!this.isConfigured()) {
            console.log('[EmailService] Email service not configured, skipping');
            return { success: false, error: 'Email service not configured' };
        }

        // Prefer Resend
        if (this.resendApiKey) {
            return this.sendViaResend({ to, subject, html, text, attachments });
        }

        // Fallback to SMTP
        if (this.smtpConfigured) {
            return this.sendViaSMTP({ to, subject, html, text, attachments });
        }

        return { success: false, error: 'No available email sending method' };
    }

    /**
     * Send email via Resend API
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

            // Process attachments
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
                console.error('[EmailService] Resend error:', result);
                return { success: false, error: result.message || 'Resend API error' };
            }

            console.log(`[EmailService] Resend email sent successfully: ${to}, ID: ${result.id}`);
            return { success: true, messageId: result.id };
        } catch (error) {
            console.error('[EmailService] Resend send failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send email via SMTP
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

            // Process attachments
            if (attachments && attachments.length > 0) {
                mailOptions.attachments = attachments.map(att => ({
                    filename: att.filename,
                    content: Buffer.from(att.content, 'base64'),
                    contentType: att.mimetype
                }));
            }

            const result = await this.transporter.sendMail(mailOptions);

            console.log(`[EmailService] SMTP email sent successfully: ${to}, ID: ${result.messageId}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('[EmailService] SMTP send failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate standard EON Protocol email template
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
                            ${statusChange ? `<div style="margin-top: 24px; padding: 16px; background: #F0FDF4; border-radius: 8px; border-left: 4px solid #10B981;"><p style="margin: 0; color: #065F46; font-size: 14px;"><strong>Status Update:</strong> ${statusChange}</p></div>` : ''}
                            ${actionUrl ? `<div style="margin-top: 30px; text-align: center;"><a href="${actionUrl}" style="display: inline-block; padding: 14px 28px; background: #0D43F9; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px;">${actionText || 'View Details'}</a></div>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 30px; background: #F9FAFB; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px; text-align: center;">This email was sent automatically by EON Protocol. Please do not reply directly.</p>
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
     * Send system message notification email
     */
    async sendMessageNotification({ to, senderName, subject, content, statusChange }) {
        const html = this.generateTemplate({
            title: subject,
            content: `<p style="color: #6B7280; margin-bottom: 16px;">You received a message from <strong>${senderName}</strong>:</p><div style="padding: 20px; background: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">${content}</div>`,
            statusChange,
            actionUrl: process.env.SITE_URL || 'https://eonprotocol.ai',
            actionText: 'Login to View'
        });

        return this.sendEmail({ to, subject, html });
    }

    /**
     * Send review result notification
     */
    async sendReviewNotification({ to, entityType, entityName, status, feedback }) {
        const statusText = { approved: 'Approved', rejected: 'Rejected', pending: 'Pending' };
        const statusColors = {
            approved: { bg: '#D1FAE5', text: '#065F46', label: '✅ Approved' },
            rejected: { bg: '#FEE2E2', text: '#991B1B', label: '❌ Rejected' },
            pending: { bg: '#FEF3C7', text: '#92400E', label: '⏳ Pending Review' }
        };

        const statusStyle = statusColors[status] || statusColors.pending;
        const entityTypeText = entityType === 'company' ? 'Company' : 'Investor';
        const title = `${entityTypeText} Review Result`;

        const html = this.generateTemplate({
            title,
            content: `<p>Your ${entityTypeText.toLowerCase()} profile <strong>${entityName}</strong> review result:</p><div style="margin: 20px 0; padding: 16px; background: ${statusStyle.bg}; border-radius: 8px; text-align: center;"><span style="color: ${statusStyle.text}; font-size: 18px; font-weight: 600;">${statusStyle.label}</span></div>${feedback ? `<div style="margin-top: 20px;"><p style="margin-bottom: 8px; font-weight: 500; color: #374151;">Admin Feedback:</p><div style="padding: 16px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #0D43F9;">${feedback}</div></div>` : ''}`,
            actionUrl: process.env.SITE_URL || 'https://eonprotocol.ai',
            actionText: 'Login to View Details'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] ${title} - ${statusText[status] || status}`, html });
    }

    /**
     * Send access request result notification
     */
    async sendAccessRequestNotification({ to, companyName, requestType, status, adminResponse }) {
        const requestTypeText = { bp_access: 'BP File Access', introduction: 'Company Introduction', meeting: 'Meeting Request', data_room: 'Data Room Access' };
        const statusText = status === 'approved' ? 'Approved' : 'Rejected';
        const title = `Access Request ${statusText}`;

        const statusBadge = status === 'approved' 
            ? '<div style="margin: 20px 0; padding: 16px; background: #D1FAE5; border-radius: 8px; text-align: center;"><span style="color: #065F46; font-size: 16px;">✅ You can now access the requested information</span></div>'
            : '<div style="margin: 20px 0; padding: 16px; background: #FEE2E2; border-radius: 8px; text-align: center;"><span style="color: #991B1B; font-size: 16px;">❌ Request was not approved</span></div>';

        const html = this.generateTemplate({
            title,
            content: `<p>Your ${requestTypeText[requestType] || requestType} request for <strong>${companyName}</strong> has been ${statusText.toLowerCase()}.</p>${statusBadge}${adminResponse ? `<div style="margin-top: 20px;"><p style="margin-bottom: 8px; font-weight: 500; color: #374151;">Admin Response:</p><div style="padding: 16px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #0D43F9;">${adminResponse}</div></div>` : ''}`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/investor`,
            actionText: 'View My Requests'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] Access Request ${statusText} - ${companyName}`, html });
    }

    /**
     * Send new access request notification to admin
     */
    async sendNewAccessRequestNotification({ to, investorName, companyName, requestType, message }) {
        const requestTypeText = { bp_access: 'BP File Access', introduction: 'Company Introduction', meeting: 'Meeting Request', data_room: 'Data Room Access' };

        const html = this.generateTemplate({
            title: 'New Access Request',
            content: `<p>Investor <strong>${investorName}</strong> has submitted an access request for company <strong>${companyName}</strong>.</p><table style="width: 100%; margin: 20px 0; border-collapse: collapse;"><tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500; width: 120px;">Request Type</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${requestTypeText[requestType] || requestType}</td></tr><tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">Investor</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${investorName}</td></tr><tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">Target Company</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${companyName}</td></tr>${message ? `<tr><td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">Message</td><td style="padding: 12px; border: 1px solid #E5E7EB;">${message}</td></tr>` : ''}</table>`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#requests`,
            actionText: 'Process Request'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] New Access Request - ${investorName} → ${companyName}`, html });
    }

    /**
     * Send company submitted notification to admin
     */
    async sendCompanySubmittedNotification({ to, companyName, submitterName, submitterEmail }) {
        const html = this.generateTemplate({
            title: 'New Company Submitted for Review',
            content: `<p>A new company has been submitted for review. Please process it promptly.</p>
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500; width: 120px;">Company Name</td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>${companyName}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">Submitter</td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;">${submitterName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-weight: 500;">Email</td>
                        <td style="padding: 12px; border: 1px solid #E5E7EB;">${submitterEmail}</td>
                    </tr>
                </table>`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#companies`,
            actionText: 'Review Company'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] New Company Pending Review - ${companyName}`, html });
    }

    /**
     * Send feedback notification (Feedback to Company)
     * Notify: Company, all admins and staff with access
     */
    async sendFeedbackNotification({ to, companyName, senderName, senderRole, content }) {
        const roleText = { admin: 'Admin', staff: 'Staff', company: 'Company' };
        const html = this.generateTemplate({
            title: 'New Feedback Message',
            content: `<p><strong>${roleText[senderRole] || senderRole}</strong> ${senderName} sent a new message in the feedback thread for company <strong>${companyName}</strong>:</p>
                <div style="margin: 20px 0; padding: 16px; background: #F0FDF4; border-radius: 8px; border-left: 4px solid #10B981;">
                    <p style="margin: 0; white-space: pre-wrap;">${this.escapeHtml(content)}</p>
                </div>`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#companies`,
            actionText: 'View Details'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] New Feedback - ${companyName}`, html });
    }

    /**
     * Send internal note notification (Internal Notes)
     * Notify: Admins and staff with access only
     */
    async sendInternalNoteNotification({ to, companyName, senderName, senderRole, content }) {
        const roleText = { admin: 'Admin', staff: 'Staff' };
        const html = this.generateTemplate({
            title: 'New Internal Note',
            content: `<p><strong>${roleText[senderRole] || senderRole}</strong> ${senderName} added an internal note for company <strong>${companyName}</strong>:</p>
                <div style="margin: 20px 0; padding: 16px; background: #FEF2F2; border-radius: 8px; border-left: 4px solid #EF4444;">
                    <p style="margin: 0 0 8px 0; color: #991B1B; font-size: 12px;"><i>🔒 This is an internal note, visible only to admins and authorized staff</i></p>
                    <p style="margin: 0; white-space: pre-wrap;">${this.escapeHtml(content)}</p>
                </div>`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#companies`,
            actionText: 'View Details'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] Internal Note - ${companyName}`, html });
    }

    /**
     * Send verdict notification (ENGAGE/EXPLORE/PASS)
     */
    async sendVerdictNotification({ to, companyName, verdict, reviewerName, adminNotes }) {
        const verdictInfo = {
            engage: { 
                label: 'ENGAGE', 
                text: 'Mandate Discussion', 
                color: '#065F46', 
                bg: '#D1FAE5',
                icon: '🤝',
                description: 'The admin has decided to follow up with this company. Further communication will be arranged.'
            },
            explore: { 
                label: 'EXPLORE', 
                text: 'Need More Information', 
                color: '#1E40AF', 
                bg: '#DBEAFE',
                icon: '🔍',
                description: 'The admin needs more information to evaluate. Please watch for follow-up questions.'
            },
            pass: { 
                label: 'PASS', 
                text: 'Not Proceeding', 
                color: '#991B1B', 
                bg: '#FEE2E2',
                icon: '⏸️',
                description: 'The admin has decided not to proceed with this company at this time.'
            },
            approved: { 
                label: 'APPROVED', 
                text: 'Review Passed', 
                color: '#065F46', 
                bg: '#D1FAE5',
                icon: '✅',
                description: 'Company review has been approved.'
            },
            rejected: { 
                label: 'REJECTED', 
                text: 'Review Failed', 
                color: '#991B1B', 
                bg: '#FEE2E2',
                icon: '❌',
                description: 'Company review was not approved.'
            }
        };

        const info = verdictInfo[verdict] || verdictInfo.pass;

        const html = this.generateTemplate({
            title: `Company Review Result: ${info.label}`,
            content: `<p>Company <strong>${companyName}</strong> review status has been updated:</p>
                <div style="margin: 20px 0; padding: 20px; background: ${info.bg}; border-radius: 8px; text-align: center;">
                    <span style="font-size: 32px;">${info.icon}</span>
                    <p style="margin: 10px 0 0 0; color: ${info.color}; font-size: 24px; font-weight: 600;">${info.label}</p>
                    <p style="margin: 8px 0 0 0; color: ${info.color}; font-size: 14px;">${info.text}</p>
                </div>
                <p style="color: #6B7280;">${info.description}</p>
                ${reviewerName ? `<p style="margin-top: 16px; color: #6B7280; font-size: 14px;">Reviewed by: <strong>${reviewerName}</strong></p>` : ''}
                ${adminNotes ? `<div style="margin-top: 20px;"><p style="margin-bottom: 8px; font-weight: 500; color: #374151;">Notes:</p><div style="padding: 16px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #0D43F9;">${this.escapeHtml(adminNotes)}</div></div>` : ''}`,
            actionUrl: `${process.env.SITE_URL || 'https://eonprotocol.ai'}/admin/fundraising.html#companies`,
            actionText: 'View Details'
        });

        return this.sendEmail({ to, subject: `[EON Protocol] Review Result: ${info.label} - ${companyName}`, html });
    }

    /**
     * Send bulk email (same content to multiple recipients)
     */
    async sendBulkEmail({ recipients, subject, html }) {
        if (!this.isConfigured()) {
            console.log('[EmailService] Email service not configured, skipping bulk send');
            return { success: false, error: 'Email service not configured', sent: 0 };
        }

        const results = [];
        for (const to of recipients) {
            try {
                const result = await this.sendEmail({ to, subject, html });
                results.push({ to, ...result });
            } catch (error) {
                results.push({ to, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[EmailService] Bulk send completed: ${successCount}/${recipients.length} successful`);
        
        return { 
            success: successCount > 0, 
            sent: successCount, 
            total: recipients.length,
            results 
        };
    }

    /**
     * HTML escape
     */
    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br>');
    }
}

// Export singleton instance
module.exports = new EmailService();
