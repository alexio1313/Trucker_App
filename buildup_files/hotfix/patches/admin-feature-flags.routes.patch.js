"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagsRoutes = void 0;
const express_1 = require("express");
const postgres_1 = require("../db/postgres");
const router = (0, express_1.Router)();
exports.featureFlagsRoutes = router;

// DB columns: flag_id, flag_key, flag_value (bool), description, updated_by, created_at, updated_at
router.get('/', async (_req, res) => {
    try {
        const rows = await (0, postgres_1.query)('SELECT * FROM feature_flags ORDER BY flag_key ASC');
        res.json({
            success: true,
            data: rows.map((r) => ({
                flagId: r.flag_id,
                flagName: r.flag_key,
                flagKey: r.flag_key,
                isEnabled: r.flag_value,
                flag_value: r.flag_value,
                description: r.description,
                updatedBy: r.updated_by,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
            })),
        });
    } catch (e) {
        console.error('feature-flags GET error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

router.patch('/:flagName', async (req, res) => {
    try {
        const { isEnabled, flagValue } = req.body;
        const adminId = req.headers['x-user-id'];
        const newValue = isEnabled !== undefined ? isEnabled : flagValue;
        if (newValue === undefined) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'isEnabled required' } });
        }
        const updated = await (0, postgres_1.queryOne)(
            'UPDATE feature_flags SET flag_value = $1, updated_by = $2, updated_at = NOW() WHERE flag_key = $3 RETURNING *',
            [Boolean(newValue), adminId || null, req.params.flagName]
        );
        if (!updated) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Feature flag not found' } });
        }
        res.json({
            success: true,
            data: {
                flagId: updated.flag_id,
                flagName: updated.flag_key,
                flagKey: updated.flag_key,
                isEnabled: updated.flag_value,
                description: updated.description,
                updatedAt: updated.updated_at,
            },
        });
    } catch (e) {
        console.error('feature-flags PATCH error:', e.message);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});
//# sourceMappingURL=feature-flags.routes.js.map
