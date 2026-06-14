export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

export const ENDPOINTS = {
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    ME: '/auth/me',
  },
  LOADS: {
    BASE: '/loads',
    BY_ID: (id: string) => `/loads/${id}`,
    ACCEPT: (id: string) => `/loads/${id}/accept`,
    PICKUP: (id: string) => `/loads/${id}/pickup`,
    DELIVER: (id: string) => `/loads/${id}/deliver`,
    CANCEL: (id: string) => `/loads/${id}/cancel`,
    TRACK: (id: string) => `/loads/${id}/track`,
    SEARCH: '/loads/search',
    NEARBY: '/loads/nearby',
  },
  PRICING: {
    QUOTE: '/pricing/quote',
    SURGE: '/pricing/surge',
    FUEL: '/pricing/fuel',
    MARKET_RATES: '/pricing/market-rates',
  },
  TRUCKERS: {
    PROFILE: '/truckers/profile',
    TRUCKS: '/truckers/trucks',
    AVAILABILITY: '/truckers/availability',
    EARNINGS: '/truckers/earnings',
    HISTORY: '/truckers/history',
  },
  TRACKING: {
    UPDATE: '/tracking/update',
    BLOCKADES: '/tracking/blockades',
    ETA: (loadId: string) => `/tracking/${loadId}/eta`,
  },
  PAYMENTS: {
    INITIATE: '/payments/initiate',
    WEBHOOK: '/payments/webhook',
    HISTORY: '/payments/history',
    PAYOUT: '/payments/payout',
  },
  NOTIFICATIONS: {
    BASE: '/notifications',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
  },
  KYC: {
    UPLOAD_URL: '/kyc/upload-url',
    SUBMIT: '/kyc/submit',
    STATUS: '/kyc/status',
  },
  RATINGS: {
    SUBMIT: '/ratings',
    BY_USER: (userId: string) => `/ratings/user/${userId}`,
  },
  DISPUTES: {
    CREATE: '/disputes',
    BY_ID: (id: string) => `/disputes/${id}`,
  },
  SOCIAL: {
    POSTS: '/social/posts',
    BY_ID: (id: string) => `/social/posts/${id}`,
    APPROVE: (id: string) => `/social/posts/${id}/approve`,
    REJECT: (id: string) => `/social/posts/${id}/reject`,
    GENERATE_CAPTION: '/social/posts/generate-caption',
    SCHEDULE: '/social/posts/schedule',
    ANALYTICS: (id: string) => `/social/posts/${id}/analytics`,
  },
  ADMIN: {
    USERS: '/admin/users',
    LOADS: '/admin/loads',
    KYC_QUEUE: '/admin/kyc',
    ANALYTICS: '/admin/analytics',
    FEATURE_FLAGS: '/admin/feature-flags',
    DISPUTES: '/admin/disputes',
    AUDIT_LOGS: '/admin/audit-logs',
    SOCIAL_POSTS: '/admin/social/posts',
    MERCHANTS: '/admin/merchants',
    SERVICE_HEALTH: '/admin/health',
  },
} as const;

export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',

  // Tracking
  LOCATION_UPDATE: 'location_update',
  LOAD_STATUS_CHANGE: 'load_status_change',
  ETA_UPDATE: 'eta_update',
  SLA_ALERT: 'sla_alert',

  // Notifications
  NOTIFICATION: 'notification',
  NEW_LOAD: 'new_load',
  BID_ACCEPTED: 'bid_accepted',

  // Chat
  MESSAGE: 'message',
  TYPING: 'typing',
  READ_RECEIPT: 'read_receipt',
} as const;
