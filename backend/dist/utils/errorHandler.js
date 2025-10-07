"use strict";
/**
 * Elysian Trading System - Error Handler
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.createError = createError;
const logger_1 = require("./logger");
function errorHandler(error, req, res, next) {
    logger_1.logger.error('API Error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? (statusCode === 500 ? 'Internal Server Error' : error.message)
        : error.message;
    res.status(statusCode).json({
        error: message,
        timestamp: new Date().toISOString(),
        path: req.url
    });
}
function createError(message, statusCode = 500, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}
