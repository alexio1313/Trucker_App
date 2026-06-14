import { apiClient } from '../axios.instance';
import { ApiResponse, SocialPost, SocialPlatform, PaginatedResponse } from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export interface CreatePostInput {
  content?: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledFor?: string;
  aiGenerate?: boolean;
  aiTopic?: string;
  aiTone?: 'professional' | 'casual' | 'celebratory';
}

export interface GenerateCaptionInput {
  topic: string;
  platform: SocialPlatform;
  tone?: 'professional' | 'casual' | 'celebratory';
  context?: string;
}

export const socialApi = {
  createPost(input: CreatePostInput): Promise<ApiResponse<SocialPost>> {
    return apiClient.post(ENDPOINTS.SOCIAL.POSTS, input).then((r) => r.data);
  },

  generateCaption(input: GenerateCaptionInput): Promise<ApiResponse<{ caption: string }>> {
    return apiClient.post(ENDPOINTS.SOCIAL.GENERATE_CAPTION, input).then((r) => r.data);
  },

  schedulePost(input: CreatePostInput): Promise<ApiResponse<SocialPost>> {
    return apiClient.post(ENDPOINTS.SOCIAL.SCHEDULE, input).then((r) => r.data);
  },

  getPosts(params?: { page?: number; status?: string }): Promise<ApiResponse<PaginatedResponse<SocialPost>>> {
    return apiClient.get(ENDPOINTS.SOCIAL.POSTS, { params }).then((r) => r.data);
  },

  getPostAnalytics(postId: string): Promise<ApiResponse<SocialPost['analytics']>> {
    return apiClient.get(ENDPOINTS.SOCIAL.ANALYTICS(postId)).then((r) => r.data);
  },

  deletePost(postId: string): Promise<ApiResponse<null>> {
    return apiClient.delete(ENDPOINTS.SOCIAL.BY_ID(postId)).then((r) => r.data);
  },
};
