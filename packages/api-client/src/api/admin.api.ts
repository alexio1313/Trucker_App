import { apiClient } from '../axios.instance';
import {
  ApiResponse,
  PaginatedResponse,
  User,
  Load,
  Dispute,
  FeatureFlag,
  AuditLog,
  SocialPost,
} from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export interface AdminUserListParams {
  page?: number;
  pageSize?: number;
  userType?: string;
  kycStatus?: string;
  isSuspended?: boolean;
  isApproved?: boolean;
  search?: string;
  fraudScore?: number;
}

export interface AdminAnalytics {
  activeLoads: number;
  gmv24h: number;
  deliverySuccessRate: number;
  activeUsers: number;
  pendingKyc: number;
  openDisputes: number;
  revenueToday: number;
  avgDeliveryTime: number;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  uptime?: string;
  version?: string;
  checkedAt: string;
}

export const adminApi = {
  // ── Users ──────────────────────────────────────────
  getUsers(params?: AdminUserListParams): Promise<ApiResponse<PaginatedResponse<User>>> {
    return apiClient.get(ENDPOINTS.ADMIN.USERS, { params }).then((r) => r.data);
  },

  getUserById(userId: string): Promise<ApiResponse<User>> {
    return apiClient.get(`${ENDPOINTS.ADMIN.USERS}/${userId}`).then((r) => r.data);
  },

  suspendUser(userId: string, reason: string, until?: Date): Promise<ApiResponse<User>> {
    return apiClient
      .post(`${ENDPOINTS.ADMIN.USERS}/${userId}/suspend`, { reason, until })
      .then((r) => r.data);
  },

  unsuspendUser(userId: string): Promise<ApiResponse<User>> {
    return apiClient.post(`${ENDPOINTS.ADMIN.USERS}/${userId}/unsuspend`).then((r) => r.data);
  },

  // ── Merchant approvals ─────────────────────────────
  getPendingMerchants(params?: { page?: number; pageSize?: number }): Promise<ApiResponse<PaginatedResponse<User>>> {
    return apiClient
      .get(ENDPOINTS.ADMIN.USERS, { params: { ...params, userType: 'merchant', kycStatus: 'submitted' } })
      .then((r) => r.data);
  },

  approveMerchant(userId: string): Promise<ApiResponse<User>> {
    return apiClient.post(`${ENDPOINTS.ADMIN.KYC_QUEUE}/${userId}/approve`).then((r) => r.data);
  },

  rejectMerchant(userId: string, reason: string): Promise<ApiResponse<User>> {
    return apiClient.post(`${ENDPOINTS.ADMIN.KYC_QUEUE}/${userId}/reject`, { reason }).then((r) => r.data);
  },

  // ── KYC ───────────────────────────────────────────
  getKycQueue(params?: { page?: number; status?: string }): Promise<ApiResponse<PaginatedResponse<User>>> {
    return apiClient.get(ENDPOINTS.ADMIN.KYC_QUEUE, { params }).then((r) => r.data);
  },

  approveKyc(userId: string): Promise<ApiResponse<User>> {
    return apiClient.post(`${ENDPOINTS.ADMIN.KYC_QUEUE}/${userId}/approve`).then((r) => r.data);
  },

  rejectKyc(userId: string, reason: string): Promise<ApiResponse<User>> {
    return apiClient
      .post(`${ENDPOINTS.ADMIN.KYC_QUEUE}/${userId}/reject`, { reason })
      .then((r) => r.data);
  },

  // ── Loads ─────────────────────────────────────────
  getLoads(params?: { status?: string; page?: number }): Promise<ApiResponse<PaginatedResponse<Load>>> {
    return apiClient.get(ENDPOINTS.ADMIN.LOADS, { params }).then((r) => r.data);
  },

  // ── Analytics ─────────────────────────────────────
  getAnalytics(): Promise<ApiResponse<AdminAnalytics>> {
    return apiClient.get(ENDPOINTS.ADMIN.ANALYTICS).then((r) => r.data);
  },

  // ── Disputes ──────────────────────────────────────
  getDisputes(params?: { status?: string; page?: number }): Promise<ApiResponse<PaginatedResponse<Dispute>>> {
    return apiClient.get(ENDPOINTS.ADMIN.DISPUTES, { params }).then((r) => r.data);
  },

  resolveDispute(
    disputeId: string,
    resolution: string,
    compensationAmount?: number,
  ): Promise<ApiResponse<Dispute>> {
    return apiClient
      .post(`${ENDPOINTS.ADMIN.DISPUTES}/${disputeId}/resolve`, { resolution, compensationAmount })
      .then((r) => r.data);
  },

  // ── Feature flags ─────────────────────────────────
  getFeatureFlags(): Promise<ApiResponse<FeatureFlag[]>> {
    return apiClient.get(ENDPOINTS.ADMIN.FEATURE_FLAGS).then((r) => r.data);
  },

  updateFeatureFlag(flagName: string, updates: Partial<FeatureFlag>): Promise<ApiResponse<FeatureFlag>> {
    return apiClient
      .patch(`${ENDPOINTS.ADMIN.FEATURE_FLAGS}/${flagName}`, updates)
      .then((r) => r.data);
  },

  // ── Audit logs ────────────────────────────────────
  getAuditLogs(params?: { page?: number; userId?: string }): Promise<ApiResponse<PaginatedResponse<AuditLog>>> {
    return apiClient.get(ENDPOINTS.ADMIN.AUDIT_LOGS, { params }).then((r) => r.data);
  },

  // ── Social posts ──────────────────────────────────
  getSocialPosts(params?: { page?: number; status?: string; pageSize?: number }): Promise<ApiResponse<PaginatedResponse<SocialPost>>> {
    return apiClient.get('/social/posts', { params }).then((r) => r.data);
  },

  approveSocialPost(postId: string): Promise<ApiResponse<{ status: string; publishedAt: string }>> {
    return apiClient.post(ENDPOINTS.SOCIAL.APPROVE(postId)).then((r) => r.data);
  },

  rejectSocialPost(postId: string, reason: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post(ENDPOINTS.SOCIAL.REJECT(postId), { reason }).then((r) => r.data);
  },

  // ── Service health ────────────────────────────────
  async getServiceHealth(): Promise<ServiceHealth[]> {
    const services = [
      { name: 'API Gateway', url: 'http://192.168.8.101:3000/health' },
      { name: 'Load Service', url: 'http://192.168.8.101:3001/health' },
      { name: 'Trucker Service', url: 'http://192.168.8.101:3002/health' },
      { name: 'Pricing Service', url: 'http://192.168.8.101:3003/health' },
      { name: 'Admin Service', url: 'http://192.168.8.101:3004/health' },
      { name: 'Notification Service', url: 'http://192.168.8.101:3005/health' },
      { name: 'Payment Service', url: 'http://192.168.8.101:3006/health' },
      { name: 'Social Service', url: 'http://192.168.8.101:3007/health' },
      { name: 'ML Service', url: 'http://192.168.8.101:3008/health' },
    ];

    const results = await Promise.all(
      services.map(async (svc) => {
        const start = Date.now();
        try {
          const resp = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
          const latencyMs = Date.now() - start;
          const body = await resp.json().catch(() => ({}));
          return {
            service: svc.name,
            status: resp.ok ? 'healthy' : 'degraded',
            latencyMs,
            version: body.version,
            uptime: body.uptime,
            checkedAt: new Date().toISOString(),
          } as ServiceHealth;
        } catch {
          return {
            service: svc.name,
            status: 'down',
            latencyMs: Date.now() - start,
            checkedAt: new Date().toISOString(),
          } as ServiceHealth;
        }
      }),
    );
    return results;
  },
};
