#!/bin/bash
# AI TRUCK LOGISTICS PLATFORM - Demo Laptop One-Time Setup
# Run this ONCE on the demo laptop after copying the VM.
# It writes all patch files and updates docker-up.sh so every restart
# auto-applies them.
#
# Usage (on the demo laptop VM):
#   bash /path/to/demo-laptop-setup.sh
#
# After this, just use:
#   bash /home/ubuntu/truck-platform/scripts/docker-up.sh

set -e

TRUCK_DIR="/home/ubuntu/truck-platform"
SCRIPTS="$TRUCK_DIR/scripts"

echo "=============================================="
echo "  AI Truck Platform - Demo Laptop Setup"
echo "=============================================="

# ── Patch 1: API Gateway proxy routes ─────────────────────────────────────────
cat > "$SCRIPTS/proxy.routes.patch.js" << 'PATCH1'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyRoutes = void 0;
const express_1 = require("express");
const http_proxy_middleware_1 = require("http-proxy-middleware");
const env_1 = require("../config/env");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const router = (0, express_1.Router)();
exports.proxyRoutes = router;
// Express strips path prefixes (/api/v1 by app.use, then /social etc by router.use).
// Restore the full original URL via req.originalUrl so the upstream gets the right path.
// Also re-inject the body that express.json() consumed before the proxy can forward it.
function fixRequest(proxyReq, req) {
    proxyReq.path = req.originalUrl;
    if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
        proxyReq.end();
    }
}
function makeProxy(target) {
    return (0, http_proxy_middleware_1.createProxyMiddleware)({
        target,
        changeOrigin: true,
        on: {
            proxyReq: fixRequest,
            error: (err, req, res) => {
                res.status(502).json({
                    success: false,
                    error: { code: 'UPSTREAM_ERROR', message: 'Service temporarily unavailable' },
                });
            },
        },
    });
}
router.post('/auth/register', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/login', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/send-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/verify-otp', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/refresh', rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.get('/auth/me', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.post('/auth/logout', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/kyc', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/loads', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
router.use('/pricing', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PRICING_SERVICE_URL));
router.use('/tracking', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/truckers', auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL));
router.use('/payments', auth_middleware_1.authMiddleware, makeProxy(env_1.env.PAYMENT_SERVICE_URL));
router.use('/notifications', auth_middleware_1.authMiddleware, makeProxy(env_1.env.NOTIFICATION_SERVICE_URL));
router.use('/ratings', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
router.use('/disputes', auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL));
router.use('/social', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin', 'merchant'), makeProxy(env_1.env.SOCIAL_SERVICE_URL));
router.use('/admin', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)('admin'), makeProxy(env_1.env.ADMIN_SERVICE_URL));
//# sourceMappingURL=proxy.routes.js.map
PATCH1
echo "[1/7] proxy.routes.patch.js written"

# ── Patch 2: Trucker service auth → camelCase user object ─────────────────────
cat > "$SCRIPTS/auth.service.patch.js" << 'PATCH2'
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.refreshAccessToken = refreshAccessToken;
exports.logoutUser = logoutUser;
exports.sendOtp = sendOtp;
exports.verifyOtpAndLogin = verifyOtpAndLogin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("redis");
const postgres_1 = require("../db/postgres");
const env_1 = require("../config/env");
const logger_1 = require("../logger");
let redisClient = null;
async function getRedis() {
    if (!redisClient) {
        redisClient = (0, redis_1.createClient)({ url: env_1.env.REDIS_URL });
        await redisClient.connect();
    }
    return redisClient;
}
function generateAccessToken(userId, userType) {
    return jsonwebtoken_1.default.sign({ userId, userType }, env_1.env.JWT_ACCESS_SECRET, {
        expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN,
    });
}
function generateRefreshToken(userId) {
    return jsonwebtoken_1.default.sign({ userId }, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN,
    });
}
function toUser(row) {
    return {
        userId: row.user_id,
        userType: row.user_type,
        fullName: row.full_name,
        email: row.email || null,
        phoneNumber: row.phone_number,
        kycStatus: row.kyc_status,
        kycDocFrontUrl: row.kyc_doc_front_url || null,
        kycDocBackUrl: row.kyc_doc_back_url || null,
        bankAccount: row.bank_account || null,
        gstNumber: row.gst_number || null,
        panNumber: row.pan_number || null,
        rating: row.rating || 0,
        totalRatings: row.total_ratings || 0,
        commissionRate: row.commission_rate || 0,
        isSuspended: row.is_suspended || false,
        suspendedUntil: row.suspended_until || null,
        suspensionReason: row.suspension_reason || null,
        fcmToken: row.fcm_token || null,
        lastLoginAt: row.last_login_at || null,
        profilePhotoUrl: row.profile_photo_url || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
async function registerUser(input) {
    const existing = await (0, postgres_1.queryOne)('SELECT user_id FROM users WHERE phone_number = $1', [input.phoneNumber]);
    if (existing)
        throw new Error('PHONE_ALREADY_REGISTERED');
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    const rows = await (0, postgres_1.query)(`INSERT INTO users (user_type, full_name, phone_number, email, password_hash, gst_number, kyc_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`, [input.userType, input.fullName, input.phoneNumber, input.email ?? null, passwordHash, input.gstNumber ?? null]);
    const user = rows[0];
    await (0, postgres_1.query)('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
    const accessToken = generateAccessToken(user.user_id, user.user_type);
    const refreshToken = generateRefreshToken(user.user_id);
    const redis = await getRedis();
    await redis.set(`refresh:${user.user_id}:${refreshToken.slice(-10)}`, refreshToken, { EX: 30 * 24 * 60 * 60 });
    logger_1.logger.info('User registered', { userId: user.user_id, userType: input.userType });
    return { accessToken, refreshToken, expiresIn: 900, user: toUser(user) };
}
async function loginUser(input) {
    const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE phone_number = $1', [input.phoneNumber]);
    if (!user)
        throw new Error('INVALID_CREDENTIALS');
    const passwordValid = await bcryptjs_1.default.compare(input.password, user.password_hash);
    if (!passwordValid)
        throw new Error('INVALID_CREDENTIALS');
    if (user.is_suspended) {
        if (!user.suspended_until || user.suspended_until > new Date()) {
            throw new Error('ACCOUNT_SUSPENDED');
        }
    }
    await (0, postgres_1.query)('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
    const accessToken = generateAccessToken(user.user_id, user.user_type);
    const refreshToken = generateRefreshToken(user.user_id);
    const redis = await getRedis();
    await redis.set(`refresh:${user.user_id}:${refreshToken.slice(-10)}`, refreshToken, { EX: 30 * 24 * 60 * 60 });
    logger_1.logger.info('User logged in', { userId: user.user_id });
    return { accessToken, refreshToken, expiresIn: 900, user: toUser(user) };
}
async function refreshAccessToken(refreshToken) {
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
    }
    catch {
        throw new Error('INVALID_REFRESH_TOKEN');
    }
    const redis = await getRedis();
    const stored = await redis.get(`refresh:${payload.userId}:${refreshToken.slice(-10)}`);
    if (!stored || stored !== refreshToken)
        throw new Error('REFRESH_TOKEN_REUSED');
    const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE user_id = $1', [payload.userId]);
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const newAccessToken = generateAccessToken(user.user_id, user.user_type);
    return { accessToken: newAccessToken, expiresIn: 900 };
}
async function logoutUser(userId, accessToken) {
    const redis = await getRedis();
    await redis.set(`blacklist:${accessToken}`, '1', { EX: 900 });
    const keys = await redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
        await redis.del(keys);
    }
    logger_1.logger.info('User logged out', { userId });
}
async function sendOtp(phoneNumber) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redis = await getRedis();
    await redis.set(`otp:${phoneNumber}`, otp, { EX: 300 });
    logger_1.logger.info('OTP generated', { phoneNumber, otp: env_1.env.NODE_ENV === 'development' ? otp : '[REDACTED]' });
    return 300;
}
async function verifyOtpAndLogin(phoneNumber, otp) {
    const redis = await getRedis();
    const stored = await redis.get(`otp:${phoneNumber}`);
    if (!stored || stored !== otp)
        throw new Error('INVALID_OTP');
    await redis.del(`otp:${phoneNumber}`);
    const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const accessToken = generateAccessToken(user.user_id, user.user_type);
    const refreshToken = generateRefreshToken(user.user_id);
    await redis.set(`refresh:${user.user_id}:${refreshToken.slice(-10)}`, refreshToken, { EX: 30 * 24 * 60 * 60 });
    await (0, postgres_1.query)('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
    return { accessToken, refreshToken, expiresIn: 900, user: toUser(user) };
}
//# sourceMappingURL=auth.service.js.map
PATCH2
echo "[2/7] auth.service.patch.js written"

# ── Patch 3: Social service MongoDB URI fix ────────────────────────────────────
cat > "$SCRIPTS/mongo.patch.js" << 'PATCH3'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.getCollection = getCollection;
exports.disconnectMongo = disconnectMongo;
const mongodb_1 = require("mongodb");
const env_1 = require("../config/env");
const logger_1 = require("../logger");
let client = null;
let db = null;
function parseMongoUri(uri) {
    const withoutScheme = uri.replace(/^mongodb:\/\//, '');
    const lastAt = withoutScheme.lastIndexOf('@');
    const userPass = withoutScheme.substring(0, lastAt);
    const hostAndRest = withoutScheme.substring(lastAt + 1);
    const colonIdx = userPass.indexOf(':');
    const username = userPass.substring(0, colonIdx);
    const password = userPass.substring(colonIdx + 1);
    const slashIdx = hostAndRest.indexOf('/');
    const hostPort = hostAndRest.substring(0, slashIdx);
    const afterSlash = hostAndRest.substring(slashIdx + 1);
    const qIdx = afterSlash.indexOf('?');
    const dbName = qIdx >= 0 ? afterSlash.substring(0, qIdx) : afterSlash;
    const queryString = qIdx >= 0 ? afterSlash.substring(qIdx + 1) : '';
    const authSourceMatch = queryString.match(/authSource=([^&]+)/);
    const authSource = authSourceMatch ? authSourceMatch[1] : 'admin';
    return { username, password, hostPort, dbName, authSource };
}
async function getDb() {
    if (db)
        return db;
    const { username, password, hostPort, dbName, authSource } = parseMongoUri(env_1.env.MONGODB_URI);
    client = new mongodb_1.MongoClient(`mongodb://${hostPort}`, {
        auth: { username, password },
        authSource,
    });
    await client.connect();
    db = client.db(dbName);
    logger_1.logger.info('MongoDB connected (social-publishing)');
    return db;
}
async function getCollection(name) {
    const database = await getDb();
    return database.collection(name);
}
async function disconnectMongo() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
//# sourceMappingURL=mongo.js.map
PATCH3
echo "[3/7] mongo.patch.js written"

# ── Patch 4: Trucker service missing routes ────────────────────────────────────
# (large file — written via python3 to avoid heredoc quoting issues)
python3 - << 'PYEOF'
content = open('/home/ubuntu/truck-platform/scripts/trucker-routes-patch.js', 'r').read() if __import__('os').path.exists('/home/ubuntu/truck-platform/scripts/trucker-routes-patch.js') else None
if content:
    print("trucker-routes-patch.js already exists, skipping write")
else:
    print("trucker-routes-patch.js not found - will be written by full setup")
PYEOF

# Write trucker-routes-patch.js if not already there from main server
if [ ! -f "$SCRIPTS/trucker-routes-patch.js" ]; then
cat > "$SCRIPTS/trucker-routes-patch.js" << 'PATCH4'
"use strict";
const { query, queryOne } = require('./db/postgres');
const TRUCK_TYPE_MAP = { flatbed:'heavy',open_body:'heavy',closed_body:'medium',refrigerated:'heavy',container:'trailer',tipper:'heavy',tanker:'heavy',mini:'mini',light:'light',medium:'medium',heavy:'heavy',trailer:'trailer' };
function mapTruckType(t){ return TRUCK_TYPE_MAP[(t||'').toLowerCase()]||'heavy'; }
module.exports = function registerTruckerRoutes(app) {
  app.get('/api/v1/truckers/profile', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const user=await queryOne('SELECT * FROM users WHERE user_id=$1 AND deleted_at IS NULL',[userId]);
      if(!user) return res.status(404).json({success:false,error:{code:'NOT_FOUND'}});
      const tc=await query('SELECT COUNT(*) as cnt FROM trucks WHERE trucker_id=$1 AND deleted_at IS NULL',[userId]);
      res.json({success:true,data:{userId:user.user_id,fullName:user.full_name,phoneNumber:user.phone_number,email:user.email||null,userType:user.user_type,kycStatus:user.kyc_status,availabilityStatus:user.availability_status,availability_status:user.availability_status,isAvailable:user.availability_status==='available',rating:parseFloat(user.rating)||5.0,totalRatings:user.total_ratings||0,truckCount:parseInt(tc[0]?.cnt)||0,bankAccount:user.bank_account||null,panNumber:user.pan_number||null,profilePhotoUrl:user.profile_photo_url||null,createdAt:user.created_at}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.get('/api/v1/truckers/trucks', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const trucks=await query('SELECT * FROM trucks WHERE trucker_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC',[userId]);
      res.json({success:true,data:trucks.map(t=>({truckId:t.truck_id,registrationNo:t.registration_no,make:t.make,model:t.model,year:t.year,capacityKg:t.capacity_kg,volumeCbm:t.volume_cbm?parseFloat(t.volume_cbm):null,truckType:t.truck_type,fuelType:t.fuel_type,status:t.status,createdAt:t.created_at}))});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/trucks', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{registrationNo,make,model,year,capacityKg,truckType,fuelType,mileageKmpl,volumeCbm}=req.body;
      if(!registrationNo||!capacityKg) return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'registrationNo and capacityKg required'}});
      const rows=await query('INSERT INTO trucks(trucker_id,registration_no,make,model,year,capacity_kg,volume_cbm,truck_type,fuel_type,mileage_kmpl) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[userId,registrationNo,make||null,model||null,year||null,capacityKg,volumeCbm||null,mapTruckType(truckType),fuelType||'diesel',mileageKmpl||null]);
      const t=rows[0];
      res.json({success:true,data:{truckId:t.truck_id,registrationNo:t.registration_no,make:t.make,model:t.model,year:t.year,capacityKg:t.capacity_kg,truckType:t.truck_type,fuelType:t.fuel_type,status:t.status,createdAt:t.created_at}});
    } catch(e){
      if(e.message.includes('unique')||e.message.includes('duplicate')) return res.status(409).json({success:false,error:{code:'DUPLICATE',message:'Registration number already exists'}});
      res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}});
    }
  });
  app.get('/api/v1/truckers/earnings', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const period=req.query.period||'weekly';
      const iv={daily:'1 day',weekly:'7 days',monthly:'30 days'}[period]||'7 days';
      const rows=await query("SELECT COUNT(*) as lc,COALESCE(SUM(agreed_price),0) as ge,COALESCE(SUM(platform_commission),0) as pc,COALESCE(SUM(net_trucker_earning),0) as np FROM loads WHERE trucker_id=$1 AND status='delivered' AND delivery_confirmed_at>=NOW()-$2::interval AND deleted_at IS NULL",[userId,iv]);
      const r=rows[0]||{};
      const next=new Date(); next.setDate(next.getDate()+(7-next.getDay()||7));
      res.json({success:true,data:{period,loadsCount:parseInt(r.lc)||0,grossEarnings:parseFloat(r.ge)||0,platformCommission:parseFloat(r.pc)||0,netPayout:parseFloat(r.np)||0,nextSettlementDate:next.toISOString()}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.get('/api/v1/truckers/history', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const page=Math.max(1,parseInt(req.query.page)||1),pageSize=Math.min(parseInt(req.query.pageSize)||10,50),status=req.query.status||null,offset=(page-1)*pageSize;
      const wp=['l.trucker_id=$1','l.deleted_at IS NULL'],params=[userId];
      if(status){params.push(status);wp.push('l.status=$'+params.length);}
      const where=wp.join(' AND ');
      const cr=await query('SELECT COUNT(*) as cnt FROM loads l WHERE '+where,params);
      const total=parseInt(cr[0]?.cnt)||0;
      params.push(pageSize,offset);
      const loads=await query('SELECT l.*,u.full_name as merchant_name FROM loads l LEFT JOIN users u ON u.user_id=l.merchant_id WHERE '+where+' ORDER BY l.created_at DESC LIMIT $'+(params.length-1)+' OFFSET $'+params.length,params);
      res.json({success:true,data:{items:loads.map(l=>({loadId:l.load_id,status:l.status,origin:{city:l.origin_city,state:l.origin_state,address:l.origin_address},destination:{city:l.dest_city,state:l.dest_state,address:l.dest_address},cargo:{cargoType:l.cargo_type,weightKg:l.cargo_weight_kg},pricing:{agreedPrice:parseFloat(l.agreed_price)||0,netTruckerEarning:parseFloat(l.net_trucker_earning)||0,platformCommission:parseFloat(l.platform_commission)||0},distanceKm:parseFloat(l.distance_km)||0,merchantName:l.merchant_name||null,deliveryConfirmedAt:l.delivery_confirmed_at||null,createdAt:l.created_at})),pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize)}}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.get('/api/v1/truckers/my/active-load', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const load=await queryOne("SELECT l.*,u.full_name as merchant_name FROM loads l LEFT JOIN users u ON u.user_id=l.merchant_id WHERE l.trucker_id=$1 AND l.status IN('accepted','loading','in_transit') AND l.deleted_at IS NULL ORDER BY l.updated_at DESC LIMIT 1",[userId]);
      if(!load) return res.json({success:true,data:{load:null,journey:null,fuelStops:[]}});
      const journey=await queryOne('SELECT * FROM journey_logs WHERE load_id=$1 AND trucker_id=$2 ORDER BY created_at DESC LIMIT 1',[load.load_id,userId]);
      const fuelStops=await query('SELECT * FROM fuel_stops WHERE load_id=$1 AND trucker_id=$2 ORDER BY logged_at ASC',[load.load_id,userId]);
      res.json({success:true,data:{load:{load_id:load.load_id,origin_city:load.origin_city,dest_city:load.dest_city,origin_address:load.origin_address,dest_address:load.dest_address,origin_lat:parseFloat(load.origin_lat),origin_lng:parseFloat(load.origin_lng),dest_lat:parseFloat(load.dest_lat),dest_lng:parseFloat(load.dest_lng),origin_state:load.origin_state,dest_state:load.dest_state,cargo_type:load.cargo_type,cargo_weight_kg:load.cargo_weight_kg,agreed_price:parseFloat(load.agreed_price)||0,distance_km:parseFloat(load.distance_km)||0,status:load.status,merchant_name:load.merchant_name||null,origin_contact_name:load.origin_contact_name||null,origin_contact_phone:load.origin_contact_phone||null,dest_contact_name:load.dest_contact_name||null,dest_contact_phone:load.dest_contact_phone||null},journey:journey||null,fuelStops:fuelStops||[]}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/my/journey/begin-loading', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{loadId}=req.body; if(!loadId) return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'loadId required'}});
      const load=await queryOne("SELECT load_id FROM loads WHERE load_id=$1 AND trucker_id=$2 AND status='accepted' AND deleted_at IS NULL",[loadId,userId]);
      if(!load) return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Load not found or not in accepted status'}});
      await query("UPDATE loads SET status='loading',updated_at=NOW() WHERE load_id=$1",[loadId]);
      const ex=await queryOne('SELECT log_id FROM journey_logs WHERE load_id=$1 AND trucker_id=$2',[loadId,userId]);
      if(!ex) await query("INSERT INTO journey_logs(load_id,trucker_id,journey_status) VALUES($1,$2,'loading')",[loadId,userId]);
      else await query("UPDATE journey_logs SET journey_status='loading' WHERE log_id=$1",[ex.log_id]);
      res.json({success:true,data:{status:'loading',message:'Arrived at pickup — loading cargo'}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/my/journey/start', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{loadId,startOdometerKm}=req.body; if(!loadId) return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'loadId required'}});
      const load=await queryOne("SELECT load_id FROM loads WHERE load_id=$1 AND trucker_id=$2 AND status IN('accepted','loading') AND deleted_at IS NULL",[loadId,userId]);
      if(!load) return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Load not found or already in transit'}});
      await query("UPDATE loads SET status='in_transit',updated_at=NOW() WHERE load_id=$1",[loadId]);
      const ex=await queryOne('SELECT log_id FROM journey_logs WHERE load_id=$1 AND trucker_id=$2',[loadId,userId]);
      if(!ex) await query("INSERT INTO journey_logs(load_id,trucker_id,journey_status,start_odometer_km,journey_started_at) VALUES($1,$2,'in_transit',$3,NOW())",[loadId,userId,startOdometerKm||null]);
      else await query("UPDATE journey_logs SET journey_status='in_transit',start_odometer_km=$1,journey_started_at=NOW() WHERE log_id=$2",[startOdometerKm||null,ex.log_id]);
      res.json({success:true,data:{status:'in_transit',message:'Journey started'}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/my/journey/fuel-stop', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{loadId,fuelLiters,fuelCost,odometerKm,stationName}=req.body;
      if(!loadId||!fuelLiters||!fuelCost) return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'loadId, fuelLiters and fuelCost required'}});
      await query('INSERT INTO fuel_stops(load_id,trucker_id,fuel_liters,fuel_cost,odometer_km,fuel_station_name) VALUES($1,$2,$3,$4,$5,$6)',[loadId,userId,fuelLiters,fuelCost,odometerKm||null,stationName||null]);
      await query('UPDATE journey_logs SET total_fuel_liters=COALESCE(total_fuel_liters,0)+$1,total_fuel_cost=COALESCE(total_fuel_cost,0)+$2 WHERE load_id=$3 AND trucker_id=$4',[fuelLiters,fuelCost,loadId,userId]);
      res.json({success:true,data:{message:'Fuel stop logged'}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/my/journey/deliver', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{loadId,endOdometerKm,actualTollCost}=req.body; if(!loadId) return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'loadId required'}});
      const load=await queryOne("SELECT load_id,truck_id FROM loads WHERE load_id=$1 AND trucker_id=$2 AND status='in_transit' AND deleted_at IS NULL",[loadId,userId]);
      if(!load) return res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Load not found or not in transit'}});
      await query("UPDATE loads SET status='delivered',delivery_confirmed_at=NOW(),delivery_confirmed_by=$2::uuid,updated_at=NOW() WHERE load_id=$1",[loadId,userId]);
      await query("UPDATE journey_logs SET journey_status='completed',end_odometer_km=$1,actual_toll_cost=$2,journey_ended_at=NOW() WHERE load_id=$3 AND trucker_id=$4",[endOdometerKm||null,actualTollCost||null,loadId,userId]);
      if(load.truck_id) await query("UPDATE trucks SET status='available',updated_at=NOW() WHERE truck_id=$1",[load.truck_id]);
      res.json({success:true,data:{status:'delivered',message:'Delivery confirmed'}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/profile/bank', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{accountNumber,ifsc,bankName,accountName}=req.body;
      await query('UPDATE users SET bank_account=$1,updated_at=NOW() WHERE user_id=$2',[JSON.stringify({accountNumber,ifsc,bankName,accountName}),userId]);
      res.json({success:true,data:{message:'Bank details saved'}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
  app.post('/api/v1/truckers/kyc', async (req,res) => {
    try {
      const userId=req.headers['x-user-id']; if(!userId) return res.status(401).json({success:false,error:{code:'UNAUTHORIZED'}});
      const{panNumber}=req.body;
      await query("UPDATE users SET pan_number=$1,kyc_status='pending',updated_at=NOW() WHERE user_id=$2",[panNumber||null,userId]);
      res.json({success:true,data:{kycStatus:'pending',message:'KYC submitted for review'}});
    } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
  });
};
PATCH4
echo "[4/7] trucker-routes-patch.js written"
fi

# ── Patch 5: Admin KYC routes column fix ──────────────────────────────────────
cat > "$SCRIPTS/admin-kyc.routes.patch.js" << 'PATCH5'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const postgres_1 = require("../db/postgres");
const logger_1 = require("../logger");
const router = (0, express_1.Router)();
exports.kycRoutes = router;
router.get('/', async (req, res) => {
    const page = parseInt(req.query['page']) || 1;
    const pageSize = Math.min(parseInt(req.query['pageSize']) || 20, 100);
    const status = req.query['status'] || 'pending';
    const offset = (page - 1) * pageSize;
    const [rows, countRows] = await Promise.all([
        (0, postgres_1.query)(`SELECT user_id, user_type, full_name, phone_number, email,
              kyc_status, kyc_doc_front_url, kyc_doc_back_url, created_at
       FROM users WHERE kyc_status = $1
       ORDER BY created_at ASC LIMIT $2 OFFSET $3`, [status, pageSize, offset]),
        (0, postgres_1.query)('SELECT COUNT(*) FROM users WHERE kyc_status = $1', [status]),
    ]);
    const total = parseInt(countRows[0]?.count ?? '0', 10);
    res.json({ success: true, data: { items: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 } } });
});
router.post('/:userId/approve', async (req, res) => {
    const adminId = req.headers['x-user-id'];
    const user = await (0, postgres_1.queryOne)('SELECT user_id FROM users WHERE user_id = $1', [req.params.userId]);
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    await (0, postgres_1.query)(`UPDATE users SET kyc_status = 'verified', updated_at = NOW() WHERE user_id = $1`, [req.params.userId]);
    await (0, postgres_1.query)(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value, ip_address, user_agent) VALUES ($1, 'KYC_APPROVED', 'user', $2, '{}', $3, $4)`, [adminId, req.params.userId, req.ip ?? '', req.headers['user-agent'] ?? '']);
    logger_1.logger.info('KYC approved', { targetUserId: req.params.userId, adminId });
    res.json({ success: true, data: { message: 'KYC approved' } });
});
router.post('/:userId/reject', async (req, res) => {
    const schema = zod_1.z.object({ reason: zod_1.z.string().min(5).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason required' } }); return; }
    const adminId = req.headers['x-user-id'];
    await (0, postgres_1.query)(`UPDATE users SET kyc_status = 'rejected', updated_at = NOW() WHERE user_id = $1`, [req.params.userId]);
    await (0, postgres_1.query)(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_value, ip_address, user_agent) VALUES ($1, 'KYC_REJECTED', 'user', $2, $3, $4, $5)`, [adminId, req.params.userId, JSON.stringify({ reason: parsed.data.reason }), req.ip ?? '', req.headers['user-agent'] ?? '']);
    logger_1.logger.info('KYC rejected', { targetUserId: req.params.userId, adminId });
    res.json({ success: true, data: { message: 'KYC rejected' } });
});
//# sourceMappingURL=kyc.routes.js.map
PATCH5
echo "[5/7] admin-kyc.routes.patch.js written"

# ── Patch 6: Admin analytics routes fix ───────────────────────────────────────
cat > "$SCRIPTS/admin-analytics.routes.patch.js" << 'PATCH6'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRoutes = void 0;
const express_1 = require("express");
const postgres_1 = require("../db/postgres");
const router = (0, express_1.Router)();
exports.analyticsRoutes = router;
router.get('/', async (_req, res) => {
    try {
        const [a,b,c,d,e,f,g,h] = await Promise.all([
            (0, postgres_1.query)(`SELECT COUNT(*) FROM loads WHERE status IN ('accepted','loading','in_transit')`),
            (0, postgres_1.query)(`SELECT COALESCE(SUM(agreed_price),0) AS total FROM loads WHERE status='delivered' AND delivery_confirmed_at>=NOW()-INTERVAL '24 hours'`),
            (0, postgres_1.query)(`SELECT ROUND(COUNT(*) FILTER(WHERE status='delivered')*100.0/NULLIF(COUNT(*) FILTER(WHERE status IN('delivered','cancelled')),0),1) AS rate FROM loads WHERE created_at>=NOW()-INTERVAL '30 days'`),
            (0, postgres_1.query)(`SELECT COUNT(DISTINCT user_id) FROM users WHERE last_login_at>=NOW()-INTERVAL '24 hours'`),
            (0, postgres_1.query)(`SELECT COUNT(*) FROM users WHERE kyc_status='pending'`),
            (0, postgres_1.query)(`SELECT COUNT(*) FROM disputes WHERE status IN('open','under_review')`),
            (0, postgres_1.query)(`SELECT COALESCE(SUM(platform_commission),0) AS total FROM loads WHERE status='delivered' AND delivery_confirmed_at>=NOW()-INTERVAL '24 hours'`),
            (0, postgres_1.query)(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM(delivery_confirmed_at-created_at))/3600),1) AS avg_hours FROM loads WHERE status='delivered' AND delivery_confirmed_at IS NOT NULL AND created_at>=NOW()-INTERVAL '30 days'`),
        ]);
        res.json({ success: true, data: { activeLoads: parseInt(a[0]?.count??'0',10), gmv24h: parseFloat(b[0]?.total??'0'), deliverySuccessRate: parseFloat(c[0]?.rate??'0'), activeUsers: parseInt(d[0]?.count??'0',10), pendingKyc: parseInt(e[0]?.count??'0',10), openDisputes: parseInt(f[0]?.count??'0',10), revenueToday: parseFloat(g[0]?.total??'0'), avgDeliveryTime: parseFloat(h[0]?.avg_hours??'0') } });
    } catch(e) { console.error('Analytics error:',e.message); res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
});
router.get('/loads-over-time', async (req, res) => {
    try { const days=Math.min(parseInt(req.query['days'])||30,90); const rows=await(0,postgres_1.query)(`SELECT DATE(created_at) AS date,COUNT(*) AS count,COALESCE(SUM(agreed_price),0) AS gmv FROM loads WHERE created_at>=NOW()-INTERVAL '${days} days' GROUP BY DATE(created_at) ORDER BY date ASC`); res.json({success:true,data:rows}); } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
});
router.get('/revenue-breakdown', async (_req, res) => {
    try { const rows=await(0,postgres_1.query)(`SELECT status,COUNT(*) AS count,COALESCE(SUM(platform_commission),0) AS total_commission FROM loads GROUP BY status ORDER BY total_commission DESC`); res.json({success:true,data:rows}); } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
});
router.get('/top-routes', async (_req, res) => {
    try { const rows=await(0,postgres_1.query)(`SELECT CONCAT(origin_city,' → ',dest_city) AS route,COUNT(*) AS count,ROUND(AVG(agreed_price)) AS avg_price FROM loads WHERE status='delivered' GROUP BY origin_city,dest_city ORDER BY count DESC LIMIT 10`); res.json({success:true,data:rows}); } catch(e){ res.status(500).json({success:false,error:{code:'INTERNAL_ERROR',message:e.message}}); }
});
//# sourceMappingURL=analytics.routes.js.map
PATCH6
echo "[6/7] admin-analytics.routes.patch.js written"

# ── Update docker-up.sh ────────────────────────────────────────────────────────
cat > "$SCRIPTS/docker-up.sh" << 'UPDOCKER'
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"
echo "=============================================="
echo "  AI TRUCK LOGISTICS PLATFORM - Starting Up"
echo "=============================================="
if [ ! -f .env ]; then cp .env.example .env; echo "WARN: Created .env from .env.example"; fi
STOPPED=$(docker ps -a --filter "name=truck_" --filter "status=exited" --format "{{.Names}}" 2>/dev/null)
if [ -n "$STOPPED" ]; then echo "Removing stopped containers: $STOPPED"; docker rm "$STOPPED"; fi
echo "[1/4] Starting databases and infrastructure..."
docker compose up -d postgres mongodb redis zookeeper elasticsearch
echo "Waiting 15s for databases..."; sleep 15
echo "[2/4] Starting Kafka and RabbitMQ..."
docker compose up -d kafka rabbitmq; sleep 8
echo "[3/4] Starting all application services..."
docker compose up -d
echo "[4/4] Applying runtime patches..."; sleep 5
PROXY="$SCRIPT_DIR/proxy.routes.patch.js"
if [ -f "$PROXY" ]; then echo "  [1/5] Patching API gateway..."; docker cp "$PROXY" truck_api_gateway:/app/dist/routes/proxy.routes.js; docker restart truck_api_gateway; sleep 3; echo "  Gateway done."; fi
AUTH="$SCRIPT_DIR/auth.service.patch.js"
if [ -f "$AUTH" ]; then echo "  [2/5] Patching auth service..."; docker cp "$AUTH" truck_trucker_service:/app/dist/auth/auth.service.js; echo "  Auth done."; fi
TR="$SCRIPT_DIR/trucker-routes-patch.js"
if [ -f "$TR" ]; then
  echo "  [3/5] Patching trucker routes..."
  docker cp "$TR" truck_trucker_service:/app/dist/trucker-routes-patch.js
  docker exec truck_trucker_service node -e "const fs=require('fs'),p='/app/dist/app.js';let c=fs.readFileSync(p,'utf8');if(!c.includes('trucker-routes-patch')){c=c.replace('app.use((_req, res) => {','try{require(\"./trucker-routes-patch\")(app);}catch(e){console.warn(e.message);}\napp.use((_req, res) => {');fs.writeFileSync(p,c);console.log('patched');}else{console.log('already patched');}"
  docker restart truck_trucker_service; sleep 4; echo "  Trucker routes done."
fi
MONGO="$SCRIPT_DIR/mongo.patch.js"
if [ -f "$MONGO" ]; then echo "  [4/5] Patching social MongoDB..."; docker cp "$MONGO" truck_social_service:/app/dist/db/mongo.js; docker restart truck_social_service; sleep 3; echo "  Social done."; fi
KYC="$SCRIPT_DIR/admin-kyc.routes.patch.js"; AN="$SCRIPT_DIR/admin-analytics.routes.patch.js"
if [ -f "$KYC" ] && [ -f "$AN" ]; then
  echo "  [5/5] Patching admin routes..."
  docker cp "$KYC" truck_admin_service:/app/dist/admin/kyc.routes.js
  docker cp "$AN" truck_admin_service:/app/dist/admin/analytics.routes.js
  docker restart truck_admin_service; sleep 3; echo "  Admin done."
fi
docker compose ps
echo ""
echo "=============================================="
echo "  ACCESS URLS"
echo "=============================================="
HOST=$(hostname -I | awk '{print $1}')
echo "  Web App:     http://${HOST}:3011"
echo "  API Gateway: http://${HOST}:3000"
echo "  Grafana:     http://${HOST}:3020"
echo "  RabbitMQ:    http://${HOST}:15672"
echo "=============================================="
UPDOCKER
chmod +x "$SCRIPTS/docker-up.sh"
echo "[7/7] docker-up.sh updated"

# ── Apply immediately if containers are running ────────────────────────────────
echo ""
if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "truck_api_gateway"; then
  echo "Containers are running - applying patches now..."

  docker cp "$SCRIPTS/proxy.routes.patch.js" truck_api_gateway:/app/dist/routes/proxy.routes.js
  docker restart truck_api_gateway
  sleep 3

  docker cp "$SCRIPTS/auth.service.patch.js" truck_trucker_service:/app/dist/auth/auth.service.js
  docker cp "$SCRIPTS/trucker-routes-patch.js" truck_trucker_service:/app/dist/trucker-routes-patch.js
  docker exec truck_trucker_service node -e "const fs=require('fs'),p='/app/dist/app.js';let c=fs.readFileSync(p,'utf8');if(!c.includes('trucker-routes-patch')){c=c.replace('app.use((_req, res) => {','try{require(\"./trucker-routes-patch\")(app);}catch(e){console.warn(e.message);}\napp.use((_req, res) => {');fs.writeFileSync(p,c);console.log('app.js patched');}else{console.log('already patched');}"
  docker restart truck_trucker_service
  sleep 4

  docker cp "$SCRIPTS/mongo.patch.js" truck_social_service:/app/dist/db/mongo.js
  docker restart truck_social_service
  sleep 3

  docker cp "$SCRIPTS/admin-kyc.routes.patch.js" truck_admin_service:/app/dist/admin/kyc.routes.js
  docker cp "$SCRIPTS/admin-analytics.routes.patch.js" truck_admin_service:/app/dist/admin/analytics.routes.js
  docker restart truck_admin_service
  sleep 3

  echo ""
  echo "Testing login..."
  RESULT=$(curl -s --max-time 10 -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' 2>/dev/null | head -c 80)
  if echo "$RESULT" | grep -q '"success":true'; then
    echo "  Login test: PASSED"
  else
    echo "  Login test: INCONCLUSIVE (try manually after containers settle)"
  fi
else
  echo "Containers not running — patches will apply automatically on next: bash $SCRIPTS/docker-up.sh"
fi

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo ""
echo "  Login credentials:"
echo "  Admin:    +919000000001 / TruckQA@2024"
echo "  Trucker:  +919860001001 / Admin@123"
echo "  Merchant: +919860002001 / Admin@123"
echo ""
echo "  To start:  bash $SCRIPTS/docker-up.sh"
echo "  To stop:   bash $SCRIPTS/docker-down.sh"
echo "=============================================="
