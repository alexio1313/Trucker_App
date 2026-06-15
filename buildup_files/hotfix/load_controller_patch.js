"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateLoad = handleCreateLoad;
exports.handleGetLoad = handleGetLoad;
exports.handleListLoads = handleListLoads;
exports.handleSearchLoads = handleSearchLoads;
exports.handleAcceptLoad = handleAcceptLoad;
exports.handleConfirmPickup = handleConfirmPickup;
exports.handleDeliverLoad = handleDeliverLoad;
exports.handleCancelLoad = handleCancelLoad;
const load_schemas_1 = require("./load.schemas");
const load_service_1 = require("./load.service");
const logger_1 = require("../logger");
function getRequesterId(req) {
    return {
        userId: req.headers['x-user-id'],
        userType: req.headers['x-user-type'],
    };
}
async function handleCreateLoad(req, res) {
    const parsed = load_schemas_1.createLoadSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
        return;
    }
    const { userId } = getRequesterId(req);
    try {
        const load = await (0, load_service_1.createNewLoad)(userId, parsed.data);
        res.status(201).json({ success: true, data: load });
    }
    catch (err) {
        logger_1.logger.error('Failed to create load', { error: err.message, userId });
        res.status(500).json({ success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create load' } });
    }
}
async function handleGetLoad(req, res) {
    const { loadId } = req.params;
    const { userId, userType } = getRequesterId(req);
    const load = await (0, load_service_1.getLoad)(loadId, userId, userType);
    if (!load) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found' } });
        return;
    }
    res.json({ success: true, data: load });
}
async function handleListLoads(req, res) {
    const { userId, userType } = getRequesterId(req);
    const page = parseInt(req.query['page']) || 1;
    const pageSize = Math.min(parseInt(req.query['pageSize']) || 20, 50);
    const status = req.query['status'] || null;
    if (userType === 'merchant') {
        const { items, total } = await (0, load_service_1.getMerchantLoadList)(userId, status, page, pageSize);
        res.json({ success: true, data: { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 } } });
        return;
    }
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Use /search endpoint' } });
}
async function handleSearchLoads(req, res) {
    const parsed = load_schemas_1.searchLoadsSchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten().fieldErrors } });
        return;
    }
    const { page, pageSize, ...filters } = parsed.data;
    const items = await (0, load_service_1.searchLoads)(filters, page, pageSize);
    res.json({ success: true, data: { items, pagination: { page, pageSize, total: items.length, totalPages: 1, hasNextPage: false, hasPrevPage: page > 1 } } });
}
async function handleAcceptLoad(req, res) {
    const { loadId } = req.params;
    const { userId } = getRequesterId(req);
    const truckId = req.body?.truckId ?? null;
    try {
        const load = await (0, load_service_1.acceptLoadByTrucker)(loadId, userId, truckId);
        res.json({ success: true, data: load });
    }
    catch (err) {
        const code = err.message;
        const statusMap = { LOAD_NOT_FOUND: 404, LOAD_NOT_AVAILABLE: 409, FORBIDDEN: 403 };
        res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
    }
}
async function handleConfirmPickup(req, res) {
    const { loadId } = req.params;
    const { userId } = getRequesterId(req);
    try {
        const load = await (0, load_service_1.confirmPickup)(loadId, userId);
        res.json({ success: true, data: load });
    }
    catch (err) {
        const code = err.message;
        const statusMap = { LOAD_NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS_TRANSITION: 409 };
        res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
    }
}
async function handleDeliverLoad(req, res) {
    const { loadId } = req.params;
    const { userId } = getRequesterId(req);
    const parsed = load_schemas_1.confirmDeliverySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'POD photo URL required' } });
        return;
    }
    try {
        const load = await (0, load_service_1.deliverLoad)(loadId, userId, parsed.data.podPhotoUrl);
        res.json({ success: true, data: load });
    }
    catch (err) {
        const code = err.message;
        const statusMap = { LOAD_NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS_TRANSITION: 409 };
        res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
    }
}
async function handleCancelLoad(req, res) {
    const { loadId } = req.params;
    const { userId, userType } = getRequesterId(req);
    const parsed = load_schemas_1.cancelLoadSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason required' } });
        return;
    }
    try {
        const load = await (0, load_service_1.cancelLoadRequest)(loadId, userId, userType, parsed.data.reason);
        res.json({ success: true, data: load });
    }
    catch (err) {
        const code = err.message;
        const statusMap = { LOAD_NOT_FOUND: 404, FORBIDDEN: 403, LOAD_CANNOT_BE_CANCELLED: 409 };
        res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
    }
}
//# sourceMappingURL=load.controller.js.map