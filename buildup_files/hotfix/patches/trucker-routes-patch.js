"use strict";
// Trucker Service Routes Patch
// Adds all missing trucker endpoints for profile, trucks, earnings, history, and journey management.

const { query, queryOne } = require('./db/postgres');

const TRUCK_TYPE_MAP = {
    flatbed: 'heavy', open_body: 'heavy', closed_body: 'medium',
    refrigerated: 'heavy', container: 'trailer', tipper: 'heavy',
    tanker: 'heavy', mini: 'mini', light: 'light', medium: 'medium',
    heavy: 'heavy', trailer: 'trailer',
};

function mapTruckType(t) {
    return TRUCK_TYPE_MAP[(t || '').toLowerCase()] || 'heavy';
}

module.exports = function registerTruckerRoutes(app) {
    // ── Profile ──────────────────────────────────────────────────────────────

    app.get('/api/v1/truckers/profile', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const user = await queryOne('SELECT * FROM users WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
            if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
            const truckRows = await query('SELECT COUNT(*) as cnt FROM trucks WHERE trucker_id = $1 AND deleted_at IS NULL', [userId]);
            res.json({
                success: true,
                data: {
                    userId: user.user_id,
                    fullName: user.full_name,
                    phoneNumber: user.phone_number,
                    email: user.email || null,
                    userType: user.user_type,
                    kycStatus: user.kyc_status,
                    availabilityStatus: user.availability_status,
                    availability_status: user.availability_status,
                    isAvailable: user.availability_status === 'available',
                    rating: parseFloat(user.rating) || 5.0,
                    totalRatings: user.total_ratings || 0,
                    truckCount: parseInt(truckRows[0]?.cnt) || 0,
                    bankAccount: user.bank_account || null,
                    panNumber: user.pan_number || null,
                    profilePhotoUrl: user.profile_photo_url || null,
                    createdAt: user.created_at,
                },
            });
        } catch (e) {
            console.error('GET /truckers/profile error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Trucks ────────────────────────────────────────────────────────────────

    app.get('/api/v1/truckers/trucks', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const trucks = await query(
                'SELECT * FROM trucks WHERE trucker_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
                [userId]
            );
            res.json({
                success: true,
                data: trucks.map((t) => ({
                    truckId: t.truck_id,
                    registrationNo: t.registration_no,
                    make: t.make,
                    model: t.model,
                    year: t.year,
                    capacityKg: t.capacity_kg,
                    volumeCbm: t.volume_cbm ? parseFloat(t.volume_cbm) : null,
                    truckType: t.truck_type,
                    fuelType: t.fuel_type,
                    status: t.status,
                    createdAt: t.created_at,
                })),
            });
        } catch (e) {
            console.error('GET /truckers/trucks error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    app.post('/api/v1/truckers/trucks', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { registrationNo, make, model, year, capacityKg, truckType, fuelType, mileageKmpl, volumeCbm } = req.body;
            if (!registrationNo || !capacityKg) {
                return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'registrationNo and capacityKg required' } });
            }
            const dbType = mapTruckType(truckType);
            const rows = await query(
                `INSERT INTO trucks (trucker_id, registration_no, make, model, year, capacity_kg, volume_cbm, truck_type, fuel_type, mileage_kmpl)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [userId, registrationNo, make || null, model || null, year || null, capacityKg, volumeCbm || null, dbType, fuelType || 'diesel', mileageKmpl || null]
            );
            const t = rows[0];
            res.json({
                success: true,
                data: {
                    truckId: t.truck_id,
                    registrationNo: t.registration_no,
                    make: t.make,
                    model: t.model,
                    year: t.year,
                    capacityKg: t.capacity_kg,
                    truckType: t.truck_type,
                    fuelType: t.fuel_type,
                    status: t.status,
                    createdAt: t.created_at,
                },
            });
        } catch (e) {
            console.error('POST /truckers/trucks error:', e.message);
            if (e.message.includes('unique') || e.message.includes('duplicate')) {
                return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Registration number already exists' } });
            }
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Earnings ──────────────────────────────────────────────────────────────

    app.get('/api/v1/truckers/earnings', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const period = req.query.period || 'weekly';
            const intervalMap = { daily: '1 day', weekly: '7 days', monthly: '30 days' };
            const interval = intervalMap[period] || '7 days';
            const rows = await query(
                `SELECT COUNT(*) as loads_count,
                        COALESCE(SUM(agreed_price), 0) as gross_earnings,
                        COALESCE(SUM(platform_commission), 0) as platform_commission,
                        COALESCE(SUM(net_trucker_earning), 0) as net_payout
                 FROM loads
                 WHERE trucker_id = $1 AND status = 'delivered'
                   AND delivery_confirmed_at >= NOW() - $2::interval
                   AND deleted_at IS NULL`,
                [userId, interval]
            );
            const r = rows[0] || {};
            const next = new Date();
            next.setDate(next.getDate() + (7 - next.getDay() || 7));
            res.json({
                success: true,
                data: {
                    period,
                    loadsCount: parseInt(r.loads_count) || 0,
                    grossEarnings: parseFloat(r.gross_earnings) || 0,
                    platformCommission: parseFloat(r.platform_commission) || 0,
                    netPayout: parseFloat(r.net_payout) || 0,
                    nextSettlementDate: next.toISOString(),
                },
            });
        } catch (e) {
            console.error('GET /truckers/earnings error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Load History ──────────────────────────────────────────────────────────

    app.get('/api/v1/truckers/history', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const pageSize = Math.min(parseInt(req.query.pageSize) || 10, 50);
            const status = req.query.status || null;
            const offset = (page - 1) * pageSize;
            const whereParts = ['l.trucker_id = $1', 'l.deleted_at IS NULL'];
            const params = [userId];
            if (status) { params.push(status); whereParts.push(`l.status = $${params.length}`); }
            const where = whereParts.join(' AND ');
            const countRows = await query(`SELECT COUNT(*) as cnt FROM loads l WHERE ${where}`, params);
            const total = parseInt(countRows[0]?.cnt) || 0;
            params.push(pageSize, offset);
            const loads = await query(
                `SELECT l.*, u.full_name as merchant_name
                 FROM loads l LEFT JOIN users u ON u.user_id = l.merchant_id
                 WHERE ${where} ORDER BY l.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            res.json({
                success: true,
                data: {
                    items: loads.map((l) => ({
                        loadId: l.load_id,
                        status: l.status,
                        origin: { city: l.origin_city, state: l.origin_state, address: l.origin_address },
                        destination: { city: l.dest_city, state: l.dest_state, address: l.dest_address },
                        cargo: { cargoType: l.cargo_type, weightKg: l.cargo_weight_kg },
                        pricing: {
                            agreedPrice: parseFloat(l.agreed_price) || 0,
                            netTruckerEarning: parseFloat(l.net_trucker_earning) || 0,
                            platformCommission: parseFloat(l.platform_commission) || 0,
                        },
                        distanceKm: parseFloat(l.distance_km) || 0,
                        merchantName: l.merchant_name || null,
                        deliveryConfirmedAt: l.delivery_confirmed_at || null,
                        createdAt: l.created_at,
                    })),
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
                },
            });
        } catch (e) {
            console.error('GET /truckers/history error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Journey: Active Load ──────────────────────────────────────────────────

    app.get('/api/v1/truckers/my/active-load', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const load = await queryOne(
                `SELECT l.*, u.full_name as merchant_name
                 FROM loads l LEFT JOIN users u ON u.user_id = l.merchant_id
                 WHERE l.trucker_id = $1 AND l.status IN ('accepted','loading','in_transit') AND l.deleted_at IS NULL
                 ORDER BY l.updated_at DESC LIMIT 1`,
                [userId]
            );
            if (!load) return res.json({ success: true, data: { load: null, journey: null, fuelStops: [] } });
            const journey = await queryOne(
                'SELECT * FROM journey_logs WHERE load_id = $1 AND trucker_id = $2 ORDER BY created_at DESC LIMIT 1',
                [load.load_id, userId]
            );
            const fuelStops = await query(
                'SELECT * FROM fuel_stops WHERE load_id = $1 AND trucker_id = $2 ORDER BY logged_at ASC',
                [load.load_id, userId]
            );
            res.json({
                success: true,
                data: {
                    load: {
                        load_id: load.load_id,
                        origin_city: load.origin_city,
                        dest_city: load.dest_city,
                        origin_address: load.origin_address,
                        dest_address: load.dest_address,
                        origin_lat: parseFloat(load.origin_lat),
                        origin_lng: parseFloat(load.origin_lng),
                        dest_lat: parseFloat(load.dest_lat),
                        dest_lng: parseFloat(load.dest_lng),
                        origin_state: load.origin_state,
                        dest_state: load.dest_state,
                        cargo_type: load.cargo_type,
                        cargo_weight_kg: load.cargo_weight_kg,
                        agreed_price: parseFloat(load.agreed_price) || 0,
                        distance_km: parseFloat(load.distance_km) || 0,
                        status: load.status,
                        merchant_name: load.merchant_name || null,
                        origin_contact_name: load.origin_contact_name || null,
                        origin_contact_phone: load.origin_contact_phone || null,
                        dest_contact_name: load.dest_contact_name || null,
                        dest_contact_phone: load.dest_contact_phone || null,
                    },
                    journey: journey || null,
                    fuelStops: fuelStops || [],
                },
            });
        } catch (e) {
            console.error('GET /truckers/my/active-load error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Journey: Begin Loading ────────────────────────────────────────────────

    app.post('/api/v1/truckers/my/journey/begin-loading', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { loadId } = req.body;
            if (!loadId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId required' } });
            const load = await queryOne(
                "SELECT load_id FROM loads WHERE load_id = $1 AND trucker_id = $2 AND status = 'accepted' AND deleted_at IS NULL",
                [loadId, userId]
            );
            if (!load) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found or not in accepted status' } });
            await query("UPDATE loads SET status = 'loading', updated_at = NOW() WHERE load_id = $1", [loadId]);
            const existing = await queryOne('SELECT log_id FROM journey_logs WHERE load_id = $1 AND trucker_id = $2', [loadId, userId]);
            if (!existing) {
                await query("INSERT INTO journey_logs (load_id, trucker_id, journey_status) VALUES ($1,$2,'loading')", [loadId, userId]);
            } else {
                await query("UPDATE journey_logs SET journey_status = 'loading' WHERE log_id = $1", [existing.log_id]);
            }
            res.json({ success: true, data: { status: 'loading', message: 'Arrived at pickup — loading cargo' } });
        } catch (e) {
            console.error('POST /truckers/my/journey/begin-loading error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Journey: Start ────────────────────────────────────────────────────────

    app.post('/api/v1/truckers/my/journey/start', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { loadId, startOdometerKm } = req.body;
            if (!loadId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId required' } });
            const load = await queryOne(
                "SELECT load_id FROM loads WHERE load_id = $1 AND trucker_id = $2 AND status IN ('accepted','loading') AND deleted_at IS NULL",
                [loadId, userId]
            );
            if (!load) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found or already in transit' } });
            await query("UPDATE loads SET status = 'in_transit', updated_at = NOW() WHERE load_id = $1", [loadId]);
            const existing = await queryOne('SELECT log_id FROM journey_logs WHERE load_id = $1 AND trucker_id = $2', [loadId, userId]);
            if (!existing) {
                await query(
                    "INSERT INTO journey_logs (load_id, trucker_id, journey_status, start_odometer_km, journey_started_at) VALUES ($1,$2,'in_transit',$3,NOW())",
                    [loadId, userId, startOdometerKm || null]
                );
            } else {
                await query(
                    "UPDATE journey_logs SET journey_status = 'in_transit', start_odometer_km = $1, journey_started_at = NOW() WHERE log_id = $2",
                    [startOdometerKm || null, existing.log_id]
                );
            }
            res.json({ success: true, data: { status: 'in_transit', message: 'Journey started' } });
        } catch (e) {
            console.error('POST /truckers/my/journey/start error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Journey: Fuel Stop ────────────────────────────────────────────────────

    app.post('/api/v1/truckers/my/journey/fuel-stop', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { loadId, fuelLiters, fuelCost, odometerKm, stationName } = req.body;
            if (!loadId || !fuelLiters || !fuelCost) {
                return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId, fuelLiters and fuelCost required' } });
            }
            await query(
                'INSERT INTO fuel_stops (load_id, trucker_id, fuel_liters, fuel_cost, odometer_km, fuel_station_name) VALUES ($1,$2,$3,$4,$5,$6)',
                [loadId, userId, fuelLiters, fuelCost, odometerKm || null, stationName || null]
            );
            await query(
                `UPDATE journey_logs SET
                     total_fuel_liters = COALESCE(total_fuel_liters, 0) + $1,
                     total_fuel_cost   = COALESCE(total_fuel_cost, 0) + $2
                 WHERE load_id = $3 AND trucker_id = $4`,
                [fuelLiters, fuelCost, loadId, userId]
            );
            res.json({ success: true, data: { message: 'Fuel stop logged' } });
        } catch (e) {
            console.error('POST /truckers/my/journey/fuel-stop error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Journey: Deliver ──────────────────────────────────────────────────────

    app.post('/api/v1/truckers/my/journey/deliver', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { loadId, endOdometerKm, actualTollCost } = req.body;
            if (!loadId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId required' } });
            const load = await queryOne(
                "SELECT load_id, truck_id FROM loads WHERE load_id = $1 AND trucker_id = $2 AND status = 'in_transit' AND deleted_at IS NULL",
                [loadId, userId]
            );
            if (!load) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found or not in transit' } });
            await query(
                "UPDATE loads SET status = 'delivered', delivery_confirmed_at = NOW(), delivery_confirmed_by = $2::uuid, updated_at = NOW() WHERE load_id = $1",
                [loadId, userId]
            );
            await query(
                `UPDATE journey_logs SET journey_status = 'completed', end_odometer_km = $1, actual_toll_cost = $2, journey_ended_at = NOW()
                 WHERE load_id = $3 AND trucker_id = $4`,
                [endOdometerKm || null, actualTollCost || null, loadId, userId]
            );
            if (load.truck_id) {
                await query("UPDATE trucks SET status = 'available', updated_at = NOW() WHERE truck_id = $1", [load.truck_id]);
            }
            res.json({ success: true, data: { status: 'delivered', message: 'Delivery confirmed' } });
        } catch (e) {
            console.error('POST /truckers/my/journey/deliver error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── Bank Details ──────────────────────────────────────────────────────────

    app.post('/api/v1/truckers/profile/bank', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { accountNumber, ifsc, bankName, accountName } = req.body;
            await query(
                'UPDATE users SET bank_account = $1, updated_at = NOW() WHERE user_id = $2',
                [JSON.stringify({ accountNumber, ifsc, bankName, accountName }), userId]
            );
            res.json({ success: true, data: { message: 'Bank details saved' } });
        } catch (e) {
            console.error('POST /truckers/profile/bank error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

    // ── KYC Submit ────────────────────────────────────────────────────────────

    app.post('/api/v1/truckers/kyc', async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
            const { panNumber, aadhaarNumber, dlNumber } = req.body;
            await query(
                "UPDATE users SET pan_number = $1, kyc_status = 'pending', updated_at = NOW() WHERE user_id = $2",
                [panNumber || null, userId]
            );
            res.json({ success: true, data: { kycStatus: 'pending', message: 'KYC submitted for review' } });
        } catch (e) {
            console.error('POST /truckers/kyc error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });
};
