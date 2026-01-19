/**
 * 翻译配置文件 - 包含所有页面的中英文翻译
 */
const translations = {
    // 通用
    common: {
        home: { zh: '首页', en: 'Home' },
        login: { zh: '登录', en: 'Login' },
        logout: { zh: '退出登录', en: 'Logout' },
        register: { zh: '注册', en: 'Register' },
        submit: { zh: '提交', en: 'Submit' },
        save: { zh: '保存', en: 'Save' },
        cancel: { zh: '取消', en: 'Cancel' },
        confirm: { zh: '确认', en: 'Confirm' },
        delete: { zh: '删除', en: 'Delete' },
        edit: { zh: '编辑', en: 'Edit' },
        view: { zh: '查看', en: 'View' },
        download: { zh: '下载', en: 'Download' },
        upload: { zh: '上传', en: 'Upload' },
        search: { zh: '搜索', en: 'Search' },
        loading: { zh: '加载中...', en: 'Loading...' },
        success: { zh: '成功', en: 'Success' },
        error: { zh: '错误', en: 'Error' },
        warning: { zh: '警告', en: 'Warning' },
        back: { zh: '返回', en: 'Back' },
        backToHome: { zh: '返回首页', en: 'Back to Home' },
        welcome: { zh: '欢迎', en: 'Welcome' },
        status: { zh: '状态', en: 'Status' },
        action: { zh: '操作', en: 'Action' },
        date: { zh: '日期', en: 'Date' },
        name: { zh: '名称', en: 'Name' },
        email: { zh: '邮箱', en: 'Email' },
        password: { zh: '密码', en: 'Password' },
        changePassword: { zh: '修改密码', en: 'Change Password' },
        currentPassword: { zh: '当前密码', en: 'Current Password' },
        newPassword: { zh: '新密码', en: 'New Password' },
        confirmPassword: { zh: '确认密码', en: 'Confirm Password' },
        passwordChanged: { zh: '密码修改成功', en: 'Password changed successfully' },
        passwordMismatch: { zh: '两次输入的新密码不一致', en: 'Passwords do not match' },
        passwordTooShort: { zh: '新密码长度不能少于6位', en: 'Password must be at least 6 characters' },
        fillAllFields: { zh: '请填写所有字段', en: 'Please fill in all fields' },
        overview: { zh: '概览', en: 'Overview' },
        settings: { zh: '设置', en: 'Settings' },
        referralCode: { zh: '推荐码', en: 'Referral Code' },
        copy: { zh: '复制', en: 'Copy' },
        copied: { zh: '已复制', en: 'Copied' },
    },
    
    // 状态
    status: {
        draft: { zh: '草稿', en: 'Draft' },
        pending: { zh: '待审核', en: 'Pending' },
        approved: { zh: '已通过', en: 'Approved' },
        rejected: { zh: '已拒绝', en: 'Rejected' },
        active: { zh: '活跃', en: 'Active' },
        suspended: { zh: '已暂停', en: 'Suspended' },
        expired: { zh: '已过期', en: 'Expired' },
    },

    // 企业门户
    company: {
        portal: { zh: '企业门户', en: 'Company Portal' },
        profile: { zh: '企业资料', en: 'Company Profile' },
        fundraising: { zh: '融资信息', en: 'Fundraising Info' },
        documents: { zh: 'BP/文档', en: 'BP/Documents' },
        submitStatus: { zh: '提交状态', en: 'Submission Status' },
        companyName: { zh: '企业名称', en: 'Company Name' },
        companyNameCn: { zh: '企业中文名', en: 'Company Name (CN)' },
        companyNameEn: { zh: '企业英文名', en: 'Company Name (EN)' },
        industry: { zh: '行业', en: 'Industry' },
        stage: { zh: '阶段', en: 'Stage' },
        location: { zh: '地区', en: 'Location' },
        website: { zh: '网站', en: 'Website' },
        description: { zh: '简介', en: 'Description' },
        targetAmount: { zh: '目标金额', en: 'Target Amount' },
        minInvestment: { zh: '最低投资', en: 'Min Investment' },
        timeline: { zh: '时间线', en: 'Timeline' },
        dataSensitivity: { zh: '数据敏感性', en: 'Data Sensitivity' },
        uploadBP: { zh: '上传BP', en: 'Upload BP' },
        bpLink: { zh: 'BP链接', en: 'BP Link' },
        submitForReview: { zh: '提交审核', en: 'Submit for Review' },
        progress: { zh: '提交进度', en: 'Submission Progress' },
        connectCapital: { zh: '管理您的企业信息，对接国际资本', en: 'Manage your company info, connect with global capital' },
    },

    // 投资人门户
    investor: {
        portal: { zh: '投资人门户', en: 'Investor Portal' },
        projects: { zh: '项目列表', en: 'Project List' },
        myRequests: { zh: '我的请求', en: 'My Requests' },
        investorProfile: { zh: '投资人资料', en: 'Investor Profile' },
        investorType: { zh: '投资人类型', en: 'Investor Type' },
        individual: { zh: '个人投资人', en: 'Individual' },
        familyOffice: { zh: '家族办公室', en: 'Family Office' },
        vc: { zh: '风险投资', en: 'Venture Capital' },
        pe: { zh: '私募股权', en: 'Private Equity' },
        corporate: { zh: '企业战投', en: 'Corporate VC' },
        requestBP: { zh: '请求BP', en: 'Request BP' },
        requestIntro: { zh: '请求引荐', en: 'Request Introduction' },
        viewDetails: { zh: '查看详情', en: 'View Details' },
    },

    // 管理员
    admin: {
        dashboard: { zh: '管理后台', en: 'Admin Dashboard' },
        companies: { zh: '企业管理', en: 'Companies' },
        investors: { zh: '投资人管理', en: 'Investors' },
        requests: { zh: '请求管理', en: 'Requests' },
        users: { zh: '用户管理', en: 'User Management' },
        messages: { zh: '消息管理', en: 'Messages' },
        systemSettings: { zh: '系统设置', en: 'System Settings' },
        createUser: { zh: '创建用户', en: 'Create User' },
        resetPassword: { zh: '重置密码', en: 'Reset Password' },
        sendMessage: { zh: '发送消息', en: 'Send Message' },
        approve: { zh: '通过', en: 'Approve' },
        reject: { zh: '拒绝', en: 'Reject' },
        viewBP: { zh: '查看BP', en: 'View BP' },
        totalCompanies: { zh: '企业总数', en: 'Total Companies' },
        totalInvestors: { zh: '投资人总数', en: 'Total Investors' },
        pendingRequests: { zh: '待处理请求', en: 'Pending Requests' },
        totalUsers: { zh: '用户总数', en: 'Total Users' },
    },

    // 普通管理员
    staff: {
        portal: { zh: '运营管理', en: 'Staff Portal' },
        myCompanies: { zh: '我的企业', en: 'My Companies' },
        createCompany: { zh: '创建企业', en: 'Create Company' },
        investorMatching: { zh: '投资人匹配', en: 'Investor Matching' },
        sendToInvestor: { zh: '联系投资人', en: 'Contact Investor' },
    },

    // 行业
    industry: {
        technology: { zh: '科技/互联网', en: 'Technology/Internet' },
        healthcare: { zh: '医疗健康', en: 'Healthcare' },
        finance: { zh: '金融科技', en: 'FinTech' },
        manufacturing: { zh: '制造业', en: 'Manufacturing' },
        consumer: { zh: '消费品', en: 'Consumer' },
        energy: { zh: '能源/环保', en: 'Energy/Green' },
        education: { zh: '教育', en: 'Education' },
        logistics: { zh: '物流/供应链', en: 'Logistics/Supply Chain' },
        other: { zh: '其他', en: 'Other' },
    },

    // 融资阶段
    stage: {
        seed: { zh: '种子轮', en: 'Seed' },
        angel: { zh: '天使轮', en: 'Angel' },
        pre_a: { zh: 'Pre-A轮', en: 'Pre-A' },
        a: { zh: 'A轮', en: 'Series A' },
        b: { zh: 'B轮', en: 'Series B' },
        c: { zh: 'C轮+', en: 'Series C+' },
        pre_ipo: { zh: 'Pre-IPO', en: 'Pre-IPO' },
        ipo: { zh: '已上市', en: 'IPO' },
    },

    // 请求类型
    requestType: {
        bp_access: { zh: 'BP访问', en: 'BP Access' },
        referral: { zh: '引荐', en: 'Introduction' },
        meeting: { zh: '会议', en: 'Meeting' },
        dataroom: { zh: '数据室', en: 'Data Room' },
    },
};

/**
 * 获取翻译文本
 * @param {string} key - 翻译键，如 'common.login' 或 'company.portal'
 * @param {string} lang - 语言代码 'zh' 或 'en'
 * @returns {string} 翻译后的文本
 */
function t(key, lang) {
    lang = lang || (typeof getLang === 'function' ? getLang() : 'zh');
    const keys = key.split('.');
    let result = translations;
    
    for (const k of keys) {
        if (result && result[k]) {
            result = result[k];
        } else {
            return key; // 返回原始 key
        }
    }
    
    return result[lang] || result.zh || key;
}

/**
 * 应用翻译到页面元素
 * @param {string} lang - 语言代码
 */
function applyTranslations(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key, lang);
        if (text) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        }
    });
}

// 监听语言切换事件
window.addEventListener('languageChanged', (e) => {
    applyTranslations(e.detail.lang);
});

// 导出
window.translations = translations;
window.t = t;
window.applyTranslations = applyTranslations;
