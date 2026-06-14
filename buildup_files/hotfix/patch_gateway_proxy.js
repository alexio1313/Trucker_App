// Rewrites /app/dist/routes/proxy.routes.js with proper path rewrite + fixRequestBody
// Run inside truck_api_gateway container
var fs = require('fs');

var content = '"use strict";\n' +
'Object.defineProperty(exports, "__esModule", { value: true });\n' +
'exports.proxyRoutes = void 0;\n' +
'const express_1 = require("express");\n' +
'const http_proxy_middleware_1 = require("http-proxy-middleware");\n' +
'const env_1 = require("../config/env");\n' +
'const auth_middleware_1 = require("../middleware/auth.middleware");\n' +
'const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");\n' +
'const router = (0, express_1.Router)();\n' +
'exports.proxyRoutes = router;\n' +
'\n' +
'function makeProxy(target, pathPrefix) {\n' +
'    return (0, http_proxy_middleware_1.createProxyMiddleware)({\n' +
'        target,\n' +
'        changeOrigin: true,\n' +
'        pathRewrite: pathPrefix ? function(p) { return pathPrefix + p; } : undefined,\n' +
'        on: {\n' +
'            proxyReq: http_proxy_middleware_1.fixRequestBody,\n' +
'            error: function(err, req, res) {\n' +
'                if (res && !res.headersSent) {\n' +
'                    res.status(502).json({\n' +
'                        success: false,\n' +
'                        error: { code: "UPSTREAM_ERROR", message: "Service temporarily unavailable" },\n' +
'                    });\n' +
'                }\n' +
'            },\n' +
'        },\n' +
'    });\n' +
'}\n' +
'\n' +
'// PUBLIC ROUTES (no auth required)\n' +
'router.post("/auth/register", rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'router.post("/auth/login", rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'router.post("/auth/send-otp", rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'router.post("/auth/verify-otp", rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'router.post("/auth/refresh", rate_limit_middleware_1.authRateLimit, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'\n' +
'// PROTECTED ROUTES (JWT required)\n' +
'router.get("/auth/me", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'router.post("/auth/logout", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1"));\n' +
'router.use("/kyc", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/kyc"));\n' +
'router.use("/loads", auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL, "/api/v1/loads"));\n' +
'router.use("/pricing", auth_middleware_1.authMiddleware, makeProxy(env_1.env.PRICING_SERVICE_URL, "/api/v1/pricing"));\n' +
'router.use("/tracking", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/tracking"));\n' +
'router.use("/truckers", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/truckers"));\n' +
'router.use("/payments", auth_middleware_1.authMiddleware, makeProxy(env_1.env.PAYMENT_SERVICE_URL, "/api/v1/payments"));\n' +
'router.use("/notifications", auth_middleware_1.authMiddleware, makeProxy(env_1.env.NOTIFICATION_SERVICE_URL, "/api/v1/notifications"));\n' +
'router.use("/ratings", auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL, "/api/v1/ratings"));\n' +
'router.use("/disputes", auth_middleware_1.authMiddleware, makeProxy(env_1.env.LOAD_SERVICE_URL, "/api/v1/disputes"));\n' +
'router.use("/social", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("admin", "merchant"), makeProxy(env_1.env.SOCIAL_SERVICE_URL, "/api/v1/social"));\n' +
'router.use("/admin", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("admin"), makeProxy(env_1.env.ADMIN_SERVICE_URL, "/api/v1/admin"));\n' +
'// V2 routes\n' +
'router.post("/kyc/aadhaar/send-otp", auth_middleware_1.authMiddleware, makeProxy(env_1.env.KYC_SERVICE_URL, "/api/v1/kyc/aadhaar/send-otp"));\n' +
'router.post("/kyc/aadhaar/verify-otp", auth_middleware_1.authMiddleware, makeProxy(env_1.env.KYC_SERVICE_URL, "/api/v1/kyc/aadhaar/verify-otp"));\n' +
'router.use("/kyc", auth_middleware_1.authMiddleware, makeProxy(env_1.env.KYC_SERVICE_URL, "/api/v1/kyc"));\n' +
'router.get("/highway/near", makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/highway/near"));\n' +
'router.post("/highway/ads/serve", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/highway/ads/serve"));\n' +
'router.post("/highway/ads/:adId/click", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/highway/ads"));\n' +
'router.use("/highway", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/highway"));\n' +
'router.get("/loader-cos/near", makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/loader-cos/near"));\n' +
'router.use("/loader-cos", auth_middleware_1.authMiddleware, makeProxy(env_1.env.TRUCKER_SERVICE_URL, "/api/v1/loader-cos"));\n';

fs.writeFileSync('/app/dist/routes/proxy.routes.js', content);
console.log('proxy.routes.js rewritten with fixRequestBody + pathRewrite. Size:', content.length);

// Quick sanity check
var verify = fs.readFileSync('/app/dist/routes/proxy.routes.js', 'utf8');
console.log('Has fixRequestBody:', verify.indexOf('fixRequestBody') > -1);
console.log('Has pathPrefix:', verify.indexOf('pathPrefix') > -1);
console.log('Has /api/v1:', verify.indexOf('/api/v1') > -1);
