import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '@truck-platform/api-client';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'whatsapp';

const PLATFORMS: { id: Platform; label: string; icon: string; color: string }[] = [
  { id: 'facebook', label: 'Facebook', icon: 'f', color: 'bg-blue-600' },
  { id: 'instagram', label: 'Instagram', icon: '📸', color: 'bg-pink-500' },
  { id: 'twitter', label: 'Twitter / X', icon: '𝕏', color: 'bg-gray-900' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'in', color: 'bg-blue-700' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
];

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  pending_approval: { badge: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
  published: { badge: 'bg-green-100 text-green-800', label: 'Published' },
  failed: { badge: 'bg-red-100 text-red-800', label: 'Failed' },
  rejected: { badge: 'bg-red-100 text-red-700', label: 'Rejected' },
  queued: { badge: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
  draft: { badge: 'bg-gray-100 text-gray-600', label: 'Draft' },
};

export default function SocialPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'create' | 'posts'>('create');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['linkedin']);
  const [content, setContent] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'casual' | 'celebratory'>('professional');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['my-social-posts'],
    queryFn: () => socialApi.getPosts({ page: 1 }),
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      socialApi.createPost({
        content: generatedCaption || content,
        platforms: selectedPlatforms,
        aiGenerate: false,
      }),
    onSuccess: () => {
      setSuccess(true);
      setContent('');
      setGeneratedCaption('');
      setAiTopic('');
      setSelectedPlatforms(['linkedin']);
      qc.invalidateQueries({ queryKey: ['my-social-posts'] });
      setTimeout(() => { setSuccess(false); setTab('posts'); }, 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => socialApi.deletePost(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-social-posts'] }),
  });

  async function handleGenerateCaption() {
    if (!aiTopic.trim() || selectedPlatforms.length === 0) return;
    setIsGenerating(true);
    try {
      const resp = await socialApi.generateCaption({
        topic: aiTopic,
        platform: selectedPlatforms[0],
        tone: aiTone,
      });
      if (resp.success) setGeneratedCaption(resp.data.caption);
    } catch {
      /* ignore */
    } finally {
      setIsGenerating(false);
    }
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
    setGeneratedCaption('');
  }

  const posts = postsData?.data?.items ?? [];
  const finalContent = generatedCaption || content;
  const canSubmit = finalContent.trim().length > 0 && selectedPlatforms.length > 0;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Social Media</h2>
        <p className="text-gray-500 mt-1">Create and manage AI-powered posts across your social platforms</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: 'create', label: '+ Create Post' },
          { value: 'posts', label: `My Posts ${posts.length > 0 ? `(${posts.length})` : ''}` },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create post tab */}
      {tab === 'create' && (
        <div className="space-y-6">
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
              Post submitted for admin approval. You'll be notified once it's reviewed.
            </div>
          )}

          {/* Platform selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Select Platforms</h3>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedPlatforms.includes(p.id)
                      ? `${p.color} text-white shadow-sm`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="text-base">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content method */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="font-semibold text-gray-900">Post Content</h3>
              <button
                onClick={() => { setUseAI(!useAI); setGeneratedCaption(''); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  useAI ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🤖 {useAI ? 'AI Mode ON' : 'Use AI'}
              </button>
            </div>

            {useAI ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic or Theme *</label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="E.g. 'Fast delivery from Mumbai to Delhi' or 'New refrigerated truck fleet'"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                  <div className="flex gap-2">
                    {(['professional', 'casual', 'celebratory'] as const).map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setAiTone(tone)}
                        className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                          aiTone === tone ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleGenerateCaption}
                  disabled={isGenerating || !aiTopic.trim() || selectedPlatforms.length === 0}
                  className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? 'Generating with AI…' : '✨ Generate Caption'}
                </button>

                {generatedCaption && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-purple-700">AI Generated Caption</span>
                      <button
                        onClick={() => setGeneratedCaption('')}
                        className="text-xs text-purple-500 hover:text-purple-700"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{generatedCaption}</p>
                    <p className="text-xs text-purple-500 mt-2">{generatedCaption.length} characters</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your post content here..."
                  rows={5}
                  maxLength={2000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{content.length}/2000</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {finalContent && selectedPlatforms.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Preview</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-2 mb-3">
                  {selectedPlatforms.map((p) => {
                    const pl = PLATFORMS.find((x) => x.id === p)!;
                    return (
                      <span key={p} className={`${pl.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                        {pl.label}
                      </span>
                    );
                  })}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{finalContent}</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 mb-4">
            Posts are reviewed by the admin team before publishing to ensure quality and compliance.
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Submitting…' : 'Submit for Approval →'}
          </button>
        </div>
      )}

      {/* My posts tab */}
      {tab === 'posts' && (
        <div className="space-y-4">
          {postsLoading ? (
            <div className="py-12 text-center text-gray-400">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📣</p>
              <p className="font-medium text-gray-600">No posts yet</p>
              <p className="text-sm mt-1">Create your first social post to get started</p>
              <button
                onClick={() => setTab('create')}
                className="mt-4 px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Create Post
              </button>
            </div>
          ) : (
            posts.map((post: {
              _id: string; status: string; content: string; platforms: string[];
              createdAt: string; publishedAt: string | null; rejectionReason?: string;
            }) => {
              const statusInfo = STATUS_STYLES[post.status] ?? { badge: 'bg-gray-100 text-gray-500', label: post.status };
              return (
                <div key={post._id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {post.platforms.map((p) => {
                          const pl = PLATFORMS.find((x) => x.id === p);
                          return pl ? (
                            <span key={p} className={`${pl.color} text-white text-xs w-6 h-6 rounded flex items-center justify-center`}>
                              {pl.icon}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.badge}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 mb-3">{post.content}</p>

                  {post.status === 'rejected' && post.rejectionReason && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                      <p className="text-xs text-red-700"><strong>Rejection reason:</strong> {post.rejectionReason}</p>
                    </div>
                  )}

                  {(post.status === 'pending_approval' || post.status === 'rejected' || post.status === 'draft') && (
                    <button
                      onClick={() => deleteMutation.mutate(post._id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
