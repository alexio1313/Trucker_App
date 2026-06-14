// =============================================================
// SHARED API / PAGINATION / ERROR TYPES
// =============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// WebSocket event envelope
export interface WSMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: Date;
  roomId?: string;
}

// Notification
export type NotificationType =
  | 'load_posted'
  | 'bid_received'
  | 'bid_accepted'
  | 'load_picked_up'
  | 'load_delivered'
  | 'payment_released'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'sla_at_risk'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'system_alert';

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// Rating
export interface Rating {
  ratingId: string;
  loadId: string;
  fromUserId: string;
  toUserId: string;
  score: number;        // 1–5
  comment: string | null;
  tags: string[];
  createdAt: Date;
}

// Dispute
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated';
export type DisputeReason =
  | 'damage'
  | 'late_delivery'
  | 'wrong_items'
  | 'no_show'
  | 'price_dispute'
  | 'other';

export interface Dispute {
  disputeId: string;
  loadId: string;
  raisedBy: string;
  againstUser: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  resolvedBy: string | null;
  resolution: string | null;
  compensationAmount: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

// Feature flags
export interface FeatureFlag {
  flagName: string;
  isEnabled: boolean;
  rolloutPercent: number;
  description: string;
}

// Audit log
export interface AuditLog {
  auditId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// KYC document
export type KYCDocumentType = 'aadhaar' | 'pan' | 'driving_license' | 'rc' | 'insurance';

export interface KYCSubmission {
  documentType: KYCDocumentType;
  frontSignedUrl: string;
  backSignedUrl?: string;
  documentNumber: string;
}

// Social post
export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'whatsapp';
export type PostStatus = 'draft' | 'pending_approval' | 'queued' | 'published' | 'failed' | 'rejected';

export interface SocialPost {
  postId: string;
  createdBy: string;
  platforms: SocialPlatform[];
  content: string;
  mediaUrls: string[];
  scheduledFor: Date | null;
  status: PostStatus;
  publishedAt: Date | null;
  analytics: Record<SocialPlatform, SocialAnalytics>;
  createdAt: Date;
}

export interface SocialAnalytics {
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  shares: number;
  fetchedAt: Date;
}
