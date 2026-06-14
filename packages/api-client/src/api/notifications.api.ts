import { apiClient } from '../axios.instance';
import { ApiResponse, PaginatedResponse, Notification } from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export const notificationsApi = {
  getNotifications(params?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }): Promise<ApiResponse<PaginatedResponse<Notification>>> {
    return apiClient.get(ENDPOINTS.NOTIFICATIONS.BASE, { params }).then((r) => r.data);
  },

  markRead(notificationId: string): Promise<ApiResponse<null>> {
    return apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId)).then((r) => r.data);
  },

  markAllRead(): Promise<ApiResponse<{ count: number }>> {
    return apiClient.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ).then((r) => r.data);
  },

  registerFcmToken(token: string): Promise<ApiResponse<null>> {
    return apiClient
      .patch('/notifications/fcm-token', { fcmToken: token })
      .then((r) => r.data);
  },
};
