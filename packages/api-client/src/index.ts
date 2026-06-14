export { apiClient, configureApiClient, setAccessToken } from './axios.instance';
export { authApi } from './api/auth.api';
export { loadsApi } from './api/loads.api';
export { truckersApi } from './api/truckers.api';
export { trackingApi } from './api/tracking.api';
export { notificationsApi } from './api/notifications.api';
export { ratingsApi } from './api/ratings.api';
export { socialApi } from './api/social.api';
export { adminApi } from './api/admin.api';

export type { LoadSearchParams, NearbyLoadsParams } from './api/loads.api';
export type { AddTruckInput, TruckerHistoryParams } from './api/truckers.api';
export type { LocationUpdate } from './api/tracking.api';
export type { SubmitRatingInput } from './api/ratings.api';
export type { CreatePostInput } from './api/social.api';
export type { AdminUserListParams, AdminAnalytics } from './api/admin.api';
