'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

interface BroadcastPayload {
  title: string;
  body: string;
  userType: 'merchant' | 'trucker' | 'all';
}

export default function NotificationsContent() {
  const [form, setForm] = useState<BroadcastPayload>({ title: '', body: '', userType: 'all' });
  const [sent, setSent] = useState(false);

  const broadcastMutation = useMutation({
    mutationFn: async (payload: BroadcastPayload) => {
      await axios.post('/api/v1/admin/notifications/broadcast', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
    },
    onSuccess: () => {
      setSent(true);
      setForm({ title: '', body: '', userType: 'all' });
      setTimeout(() => setSent(false), 3000);
    },
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Notification Management</h2>
        <p className="text-gray-500 mt-1">Broadcast push notifications to platform users</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-xl">
        <h3 className="font-semibold text-gray-900 mb-4">Send Broadcast</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Audience</label>
            <div className="flex gap-2">
              {(['all', 'merchant', 'trucker'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, userType: t }))}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium ${
                    form.userType === t ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Platform update"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Your notification message..."
            />
          </div>

          {sent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
              Notification broadcast sent successfully.
            </div>
          )}

          {broadcastMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
              Failed to send. Please try again.
            </div>
          )}

          <button
            onClick={() => broadcastMutation.mutate(form)}
            disabled={!form.title.trim() || !form.body.trim() || broadcastMutation.isPending}
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {broadcastMutation.isPending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </div>
    </div>
  );
}
