const Joi = require('joi');

const nodeSchema = Joi.object({
    deviceId: Joi.string().required(),
    username: Joi.string().required(),
    status: Joi.string().valid('online', 'offline').required(),
    ipAddress: Joi.string().ip().required(),
    duration: Joi.number().integer().min(0).required(),
    traffic: Joi.object({
        upload: Joi.number().integer().min(0).required(),    // bytes
        download: Joi.number().integer().min(0).required()   // bytes
    }).required(),
    reportType: Joi.string().valid('status_change', 'daily').required()
});

const batchReportSchema = Joi.object({
    nodes: Joi.array().items(nodeSchema).min(1).required()
});

const validateBatchReport = (req, res, next) => {
    const { error } = batchReportSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            code: 400,
            message: 'Invalid request data',
            error: error.details[0].message
        });
    }
    next();
};

module.exports = {
    validateBatchReport
};
