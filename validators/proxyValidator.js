const Joi = require('joi');

const nodeSchema = Joi.object({
    deviceId: Joi.string().required(),
    status: Joi.string().valid('active', 'inactive').required(),
    bandwidth: Joi.object({
        upload: Joi.number().min(0).required(),
        download: Joi.number().min(0).required()
    }).required(),
    ipAddress: Joi.string().ip().required(),
    location: Joi.object({
        country: Joi.string().allow(null),
        city: Joi.string().allow(null)
    }).optional()
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
