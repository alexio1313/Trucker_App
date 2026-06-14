import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Notification } from '@truck-platform/shared';
import { notificationsApi } from '@truck-platform/api-client';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

interface NotificationsActions {
  fetchNotifications(): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  markAllRead(): Promise<void>;
  addRealTimeNotification(notification: Notification): void;
}

export const useNotificationsStore = create<NotificationsState & NotificationsActions>()(
  immer((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,

    async fetchNotifications() {
      set((state) => { state.isLoading = true; });
      try {
        const res = await notificationsApi.getNotifications({ pageSize: 50 });
        const items = res.data.items;
        set((state) => {
          state.notifications = items;
          state.unreadCount = items.filter((n) => !n.isRead).length;
        });
      } finally {
        set((state) => { state.isLoading = false; });
      }
    },

    async markRead(notificationId) {
      await notificationsApi.markRead(notificationId);
      set((state) => {
        const n = state.notifications.find((n) => n.notificationId === notificationId);
        if (n && !n.isRead) {
          n.isRead = true;
          n.readAt = new Date();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });
    },

    async markAllRead() {
      await notificationsApi.markAllRead();
      set((state) => {
        state.notifications.forEach((n) => {
          n.isRead = true;
          n.readAt = new Date();
        });
        state.unreadCount = 0;
      });
    },

    addRealTimeNotification(notification) {
      set((state) => {
        state.notifications.unshift(notification);
        if (!notification.isRead) state.unreadCount += 1;
      });
    },
  })),
);
