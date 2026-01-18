const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Company, FundraisingInfo, Document, AccessRequest } = require('../models');
const { authenticate, requireCompany } = require('../middleware/auth');

// 配置文件上传 - 使用内存存储（Railway不支持本地文件系统写入）
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB（内存存储需要限制大小）
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.ppt', '.pptx', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式，仅支持 PDF、PPT、PPTX、DOC、DOCX'));
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

// 上传 BP 文件 - 使用内存存储并保存到数据库
router.post('/upload-bp', authenticate, requireCompany, (req, res, next) => {
    // 先执行 multer 上传，捕获错误
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('[Company] Multer 错误:', err.message);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: '文件大小不能超过 10MB' });
            }
            return res.status(400).json({ error: err.message || '上传失败' });
        }
        next();
    });
}, async (req, res) => {
    const startTime = Date.now();
    console.log(`[Company] 开始处理 BP 上传请求`);
    
    try {
        const company = await Company.findOne({ where: { user_id: req.user.id } });
        if (!company) {
            console.log('[Company] 企业信息不存在');
            return res.status(400).json({ error: '请先创建企业基本信息' });
        }

        if (!req.file) {
            console.log('[Company] 未收到文件');
            return res.status(400).json({ error: '请选择要上传的文件' });
        }

        console.log(`[Company] 收到文件: ${req.file.originalname}, 大小: ${req.file.size} bytes`);

        // 将文件内容转换为 Base64 存储
        const fileContent = req.file.buffer.toString('base64');
        console.log(`[Company] Base64 编码完成，长度: ${fileContent.length}`);

        // 处理文件名编码 - 确保中文文件名正确存储
        let filename = req.file.originalname;
        // 尝试解码可能被错误编码的文件名
        try {
            // 如果文件名是 Latin-1 编码的 UTF-8 字节，需要重新解码
            const buffer = Buffer.from(filename, 'latin1');
            const decoded = buffer.toString('utf8');
            // 检查解码后是否有效（不包含替换字符）
            if (!decoded.includes('\ufffd') && decoded !== filename) {
                filename = decoded;
            }
        } catch (e) {
            // 保持原始文件名
        }
        console.log(`[Company] 处理后文件名: ${filename}`);

        const document = await Document.create({
            company_id: company.id,
            type: 'bp',
            filename: filename,
            filepath: null, // 不再使用文件路径
            filesize: req.file.size,
            mimetype: req.file.mimetype,
            file_content: fileContent, // Base64 内容存储在数据库
            description: req.body.description || 'Business Plan',
            requires_approval: true
        });

        const duration = Date.now() - startTime;
        console.log(`[Company] BP 上传成功，文档ID: ${document.id}，耗时: ${duration}ms`);

        res.json({ 
            message: 'BP 文件上传成功',
            document: {
                id: document.id,
                filename: document.filename,
                type: document.type,
                filesize: document.filesize,
                created_at: document.created_at
            }
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Company] 上传 BP 错误 (耗时 ${duration}ms):`, error.message);
        console.error('[Company] 错误堆栈:', error.stack);
        res.status(500).json({ error: '上传失败，请稍后重试: ' + error.message });
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

        // 直接从数据库删除（文件内容已存储在数据库中）
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

// 下载文档 - 从数据库返回文件内容
router.get('/documents/:id/download', authenticate, requireCompany, async (req, res) => {
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

        if (!document.file_content) {
            return res.status(404).json({ error: '文件内容不存在' });
        }

        // 将 Base64 内容转换回 Buffer
        const fileBuffer = Buffer.from(document.file_content, 'base64');

        // 设置响应头 - 使用 RFC 5987 编码支持中文文件名
        const filename = document.filename;
        const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape);
        
        res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Length', fileBuffer.length);

        res.send(fileBuffer);
    } catch (error) {
        console.error('[Company] 下载文档错误:', error);
        res.status(500).json({ error: '下载失败' });
    }
});

module.exports = router;
