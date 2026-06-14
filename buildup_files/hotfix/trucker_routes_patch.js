"use strict";
const { Router } = require('express');
const { query, queryOne } = require('../db/postgres');
const { logger } = require('../logger');

const router = Router();

function getUserId(req) { return req.headers['x-user-id']; }

// GET /profile
router.get('/profile', async (req, res) => {
    try {
        const userId = getUserId(req);
        const user = await queryOne('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trucker not found' } });

        const trucks = await query('SELECT * FROM trucks WHERE trucker_id = $1 AND deleted_at IS NULL', [userId]);
        const completedResult = await queryOne(
            "SELECT COUNT(*) AS count FROM loads WHERE trucker_id = $1 AND status = 'delivered'", [userId]
        );
        const completedLoads = parseInt(completedResult && completedResult.count || 0);

        res.json({
            success: true,
            data: {
                userId: user.user_id,
                fullName: user.full_name,
                phoneNumber: user.phone_number,
                kycStatus: user.kyc_status,
                rating: parseFloat(user.rating) || 0,
                totalRatings: user.total_ratings || 0,
                completedLoads,
                totalLoadsCompleted: completedLoads,
                isAvailable: trucks.some(t => t.status === 'available'),
                isSuspended: user.is_suspended,
                trucks: trucks.map(t => ({
                    truckId: t.truck_id,
                    registrationNumber: t.registration_no,
                    make: t.make,
                    model: t.model,
                    year: t.year,
                    truckType: t.truck_type,
                    capacityKg: t.capacity_kg,
                    fuelType: t.fuel_type,
                    isActive: t.status === 'available' || t.status === 'on_load',
                    status: t.status,
                })),
            }
        });
    } catch (e) {
        logger.error('Profile error', { error: e.message });
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

// GET /trucks
router.get('/trucks', async (req, res) => {
    try {
        const userId = getUserId(req);
        const trucks = await query('SELECT * FROM trucks WHERE trucker_id = $1 AND deleted_at IS NULL', [userId]);
        res.json({
            success: true,
            data: trucks.map(t => ({
                truckId: t.truck_id,
                registrationNumber: t.registration_no,
                make: t.make,
                model: t.model,
                year: t.year,
                truckType: t.truck_type,
                capacityKg: t.capacity_kg,
                fuelType: t.fuel_type,
                isActive: t.status === 'available' || t.status === 'on_load',
                status: t.status,
            }))
        });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

// POST /trucks
router.post('/trucks', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { registrationNo, make, model, year, capacityKg, volumeCbm, truckType, fuelType, mileageKmpl } = req.body;
        const rows = await query(
            'INSERT INTO trucks (trucker_id, registration_no, make, model, year, capacity_kg, volume_cbm, truck_type, fuel_type, mileage_kmpl, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
            [userId, registrationNo, make, model, year, capacityKg, volumeCbm || null, truckType, fuelType, mileageKmpl || null, 'available']
        );
        const t = rows[0];
        res.status(201).json({ success: true, data: { truckId: t.truck_id, registrationNumber: t.registration_no, make: t.make, model: t.model, year: t.year, truckType: t.truck_type, capacityKg: t.capacity_kg, isActive: true, status: t.status } });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

// PATCH /availability
router.patch('/availability', async (req, res) => {
    try {
        const userId = getUserId(req);
        let status = req.body.status;
        if (status === undefined) {
            status = req.body.isAvailable ? 'available' : 'offline';
        }
        const newStatus = status === 'available' ? 'available' : 'offline';
        await query("UPDATE trucks SET status = $1 WHERE trucker_id = $2 AND status != 'on_load'", [newStatus, userId]);
        res.json({ success: true, data: { status: newStatus } });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

// GET /earnings?period=weekly
router.get('/earnings', async (req, res) => {
    try {
        const userId = getUserId(req);
        const period = req.query.period || 'weekly';
        const now = new Date();
        let dateFilter;
        if (period === 'daily') dateFilter = new Date(now - 24*60*60*1000);
        else if (period === 'weekly') dateFilter = new Date(now - 7*24*60*60*1000);
        else dateFilter = new Date(now - 30*24*60*60*1000);

        const result = await queryOne(
            "SELECT COUNT(*) AS loads_count, COALESCE(SUM(agreed_price),0) AS gross, COALESCE(SUM(platform_commission),0) AS commission, COALESCE(SUM(net_trucker_earning),0) AS net FROM loads WHERE trucker_id = $1 AND status = 'delivered' AND delivery_confirmed_at >= $2",
            [userId, dateFilter]
        );

        const gross = parseFloat((result && result.gross) || 0);
        const commission = parseFloat((result && result.commission) || 0);
        const net = parseFloat((result && result.net) || 0);
        const loadsCount = parseInt((result && result.loads_count) || 0);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        res.json({
            success: true,
            data: { grossEarnings: gross, platformCommission: commission, netPayout: net, loadsCount, nextSettlementDate: nextMonth.toISOString(), period }
        });
    } catch (e) {
        logger.error('Earnings error', { error: e.message });
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

// GET /history?pageSize=10&status=delivered
router.get('/history', async (req, res) => {
    try {
        const userId = getUserId(req);
        const pageSize = parseInt(req.query.pageSize || 10);
        const page = parseInt(req.query.page || 1);
        const offset = (page - 1) * pageSize;
        const status = req.query.status;

        let loads, countResult;
        if (status) {
            loads = await query('SELECT load_id,merchant_id,trucker_id,truck_id,origin_city,origin_state,dest_city,dest_state,origin_address,dest_address,origin_lat,origin_lng,dest_lat,dest_lng,cargo_weight_kg,cargo_type,agreed_price,ai_suggested_price,net_trucker_earning,platform_commission,distance_km,status,created_at,delivery_confirmed_at FROM loads WHERE trucker_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4', [userId, status, pageSize, offset]);
            countResult = await queryOne('SELECT COUNT(*) AS total FROM loads WHERE trucker_id = $1 AND status = $2', [userId, status]);
        } else {
            loads = await query('SELECT load_id,merchant_id,trucker_id,truck_id,origin_city,origin_state,dest_city,dest_state,origin_address,dest_address,origin_lat,origin_lng,dest_lat,dest_lng,cargo_weight_kg,cargo_type,agreed_price,ai_suggested_price,net_trucker_earning,platform_commission,distance_km,status,created_at,delivery_confirmed_at FROM loads WHERE trucker_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId, pageSize, offset]);
            countResult = await queryOne('SELECT COUNT(*) AS total FROM loads WHERE trucker_id = $1', [userId]);
        }

        const serializeLoad = (l) => ({
            loadId: l.load_id,
            origin: { city: l.origin_city, state: l.origin_state, address: l.origin_address, lat: l.origin_lat, lng: l.origin_lng },
            destination: { city: l.dest_city, state: l.dest_state, address: l.dest_address, lat: l.dest_lat, lng: l.dest_lng },
            cargo: { weightKg: l.cargo_weight_kg, cargoType: l.cargo_type },
            pricing: { agreedPrice: l.agreed_price, aiSuggestedPrice: l.ai_suggested_price, netTruckerEarning: l.net_trucker_earning, platformCommission: l.platform_commission },
            distanceKm: l.distance_km,
            status: l.status,
            createdAt: l.created_at,
            deliveryConfirmedAt: l.delivery_confirmed_at,
        });

        const total = parseInt((countResult && countResult.total) || 0);
        res.json({
            success: true,
            data: { items: loads.map(serializeLoad), total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
});

module.exports = { truckerRoutes: router };
