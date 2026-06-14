'use client';
import { useState, useEffect, useCallback } from 'react';

const ADMIN_API = 'http://192.168.8.101:3004/api/v1/admin';

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  linkedin: 'in',
  instagram: '📸',
  facebook: 'f',
  whatsapp: '💬',
};

const STATUS_STYLES: Record<string, string> = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-500',
};

interface SocialPost {
  _id: string;
  createdByName?: string;
  createdBy?: string;
  platforms: string[];
  content: string;
  status: string;
  createdAt?: string;
  publishedAt?: string | null;
  rejectionReason?: string | null;
}

export default function SocialContent() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [allPosts, setAllPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchPosts = useCallback(async (status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`${ADMIN_API}/social-posts${params}`);
      const json = await res.json();
      if (json.success) return json.data?.posts ?? [];
    } catch { /* ignore */ }
    return [];
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [filtered, all] = await Promise.all([
      fetchPosts(statusFilter || undefined),
      fetchPosts(undefined),
    ]);
    setPosts(filtered);
    setAllPosts(all);
    setLoading(false);
  }, [fetchPosts, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const approve = async (postId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}/social-posts/${postId}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (json.success) { showToast('Post approved and published'); loadData(); }
      else showToast(json.error?.message || 'Error');
    } catch { showToast('Error'); }
    finally { setActionLoading(false); }
  };

  const reject = async () => {
    if (!rejectingId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}/social-posts/${rejectingId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || 'Content policy violation' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Post rejected');
        setRejectingId(null);
        setRejectReason('');
        loadData();
      } else showToast(json.error?.message || 'Error');
    } catch { showToast('Error'); }
    finally { setActionLoading(false); }
  };

  const publishedPosts = allPosts.filter(p => p.status === 'published').length;
  const pendingPosts = allPosts.filter(p => p.status === 'pending_approval').length;
  const rejectedPosts = allPosts.filter(p => p.status === 'rejected').length;

  const platformCounts: Record<string, number> = {};
  allPosts.forEach(p => p.platforms?.forEach(pl => { platformCounts[pl] = (platformCounts[pl] ?? 0) + 1; }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Social Media Management</h2>
        <p className="text-gray-500 mt-1">Review and approve merchant social posts before they go live</p>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg z-50 shadow">{toast}</div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Posts</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{allPosts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-yellow-100 cursor-pointer hover:border-yellow-300" onClick={() => setStatusFilter('pending_approval')}>
          <p className="text-sm text-gray-500">Pending Approval</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingPosts}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-green-100 cursor-pointer hover:border-green-300" onClick={() => setStatusFilter('published')}>
          <p className="text-sm text-gray-500">Published</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{publishedPosts}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-red-100 cursor-pointer hover:border-red-300" onClick={() => setStatusFilter('rejected')}>
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-3xl font-bold text-red-500 mt-1">{rejectedPosts}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['', 'pending_approval', 'published', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s === '' ? 'All' : s === 'pending_approval' ? 'Pending' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 text-sm">{post.createdByName || 'Merchant'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[post.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {post.status === 'pending_approval' ? 'Pending Approval' : post.status}
                    </span>
                    <div className="flex gap-1">
                      {post.platforms?.map(p => (
                        <span key={p} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-medium">{PLATFORM_ICONS[p] || p}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{post.content}</p>
                  {post.rejectionReason && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1 rounded">
                      Rejected: {post.rejectionReason}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-400">
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
                {post.status === 'pending_approval' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => approve(post._id)}
                      disabled={actionLoading}
                      className="text-sm px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(post._id)}
                      className="text-sm px-4 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400">
              No {statusFilter ? `"${statusFilter.replace('_', ' ')}"` : ''} posts found
            </div>
          )}
        </div>
      )}

      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-4">Reject Social Post</h3>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none"
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={reject}
                disabled={actionLoading}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting…' : 'Reject Post'}
              </button>
              <button
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="flex-1 border border-gray-200 py-2 rounded-lg text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
