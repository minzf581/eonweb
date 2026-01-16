const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Company, FundraisingInfo, Document, AccessRequest } = require('../models');
const { authenticate, requireCompany } = require('../middleware/auth');

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/bp');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.ppt', '.pptx', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式'));
        }
    }
});

// 获取当前用户的企业信息
router.get('/profile', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({
            where: { user_id: req.user.id },
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' }
            ]
        });

        if (!company) {
            return res.json({ company: null, message: '尚未创建企业资料' });
        }

        res.json({ company });
    } catch (error) {
        console.error('[Company] 获取企业信息错误:', error);
        res.status(500).json({ error: '获取企业信息失败' });
    }
});

// 创建或更新企业基本信息
router.post('/profile', authenticate, requireCompany, async (req, res) => {
    try {
        const {
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail,
            stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp
        } = req.body;

        // 验证必填字段
        if (!name_cn || !industry_primary || !location_headquarters || !description || !stage || !contact_name || !contact_email) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        let company = await Company.findOne({ where: { user_id: req.user.id } });

        const companyData = {
            user_id: req.user.id,
            name_cn, name_en, website, linkedin,
            industry_primary, industry_secondary,
            location_headquarters, location_rd,
            description, description_detail,
            stage,
            contact_name, contact_title, contact_email,
            contact_phone, contact_wechat, contact_whatsapp,
            status: 'draft'
        };

        if (company) {
            // 更新
            await company.update(companyData);
        } else {
            // 创建
            company = await Company.create(companyData);
        }

        res.json({ 
            message: company ? '企业信息已更新' : '企业信息已创建',
            company 
        });
    } catch (error) {
        console.error('[Company] 保存企业信息错误:', error);
        res.status(500).json({ error: '保存企业信息失败' });
    }
});

// 保存融资信息
router.post('/fundraising', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        const {
            purpose, financing_type,
            amount_min, amount_max, amount_currency,
            timeline, valuation_expectation, use_of_funds,
            overseas_structure,
            ip_ownership, ip_transferable, ip_notes,
            data_sensitivity, data_sensitivity_notes,
            additional_info
        } = req.body;

        // 验证必填字段
        if (!purpose || !financing_type || !amount_min || !amount_max || !timeline) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        let fundraisingInfo = await FundraisingInfo.findOne({ where: { company_id: company.id } });

        const fundraisingData = {
            company_id: company.id,
            purpose: Array.isArray(purpose) ? purpose : [purpose],
            financing_type: Array.isArray(financing_type) ? financing_type : [financing_type],
            amount_min, amount_max, 
            amount_currency: amount_currency || 'USD',
            timeline, valuation_expectation, use_of_funds,
            overseas_structure: overseas_structure || {},
            ip_ownership, ip_transferable, ip_notes,
            data_sensitivity: data_sensitivity || 'medium',
            data_sensitivity_notes,
            additional_info
        };

        if (fundraisingInfo) {
            await fundraisingInfo.update(fundraisingData);
        } else {
            fundraisingInfo = await FundraisingInfo.create(fundraisingData);
        }

        res.json({ 
            message: '融资信息已保存',
            fundraisingInfo 
        });
    } catch (error) {
        console.error('[Company] 保存融资信息错误:', error);
        res.status(500).json({ error: '保存融资信息失败' });
    }
});

// 上传 BP 文件
router.post('/upload-bp', authenticate, requireCompany, upload.single('file'), async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '请选择要上传的文件' });
        }

        const document = await Document.create({
            company_id: company.id,
            type: 'bp',
            filename: req.file.originalname,
            filepath: req.file.path,
            filesize: req.file.size,
            mimetype: req.file.mimetype,
            description: req.body.description || 'Business Plan',
            requires_approval: true
        });

        res.json({ 
            message: 'BP 文件上传成功',
            document: {
                id: document.id,
                filename: document.filename,
                type: document.type,
                created_at: document.created_at
            }
        });
    } catch (error) {
        console.error('[Company] 上传 BP 错误:', error);
        res.status(500).json({ error: '上传失败，请稍后重试' });
    }
});

// 获取企业的所有文档
router.get('/documents', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.json({ documents: [] });
        }

        const documents = await Document.findAll({
            where: { company_id: company.id },
            order: [['created_at', 'DESC']]
        });

        res.json({ documents });
    } catch (error) {
        console.error('[Company] 获取文档列表错误:', error);
        res.status(500).json({ error: '获取文档列表失败' });
    }
});

// 删除文档
router.delete('/documents/:id', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.status(404).json({ error: '企业不存在' });
        }

        const document = await Document.findOne({
            where: { id: req.params.id, company_id: company.id }
        });

        if (!document) {
            return res.status(404).json({ error: '文档不存在' });
        }

        // 删除文件
        if (fs.existsSync(document.filepath)) {
            fs.unlinkSync(document.filepath);
        }

        await document.destroy();

        res.json({ message: '文档已删除' });
    } catch (error) {
        console.error('[Company] 删除文档错误:', error);
        res.status(500).json({ error: '删除文档失败' });
    }
});

// 提交审核
router.post('/submit', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ 
            where: { user_id: req.user.id },
            include: [
                { model: FundraisingInfo, as: 'fundraisingInfo' },
                { model: Document, as: 'documents' }
            ]
        });

        if (!company) {
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        if (!company.fundraisingInfo) {
            return res.status(400).json({ error: '请先填写融资信息' });
        }

        const hasBP = company.documents.some(doc => doc.type === 'bp');
        if (!hasBP) {
            return res.status(400).json({ error: '请先上传 BP 文件' });
        }

        await company.update({ status: 'pending' });

        res.json({ 
            message: '已提交审核，请等待管理员审核',
            status: 'pending'
        });
    } catch (error) {
        console.error('[Company] 提交审核错误:', error);
        res.status(500).json({ error: '提交失败，请稍后重试' });
    }
});

// 获取访问请求列表（企业收到的）
router.get('/access-requests', authenticate, requireCompany, async (req, res) => {
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            return res.json({ requests: [] });
        }

        const requests = await AccessRequest.findAll({
            where: { company_id: company.id },
            order: [['created_at', 'DESC']]
        });

        res.json({ requests });
    } catch (error) {
        console.error('[Company] 获取访问请求错误:', error);
        res.status(500).json({ error: '获取访问请求失败' });
    }
});

module.exports = router;
