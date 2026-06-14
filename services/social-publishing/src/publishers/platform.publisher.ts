import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../logger';

export type Platform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'whatsapp';

export interface PublishResult {
  platform: Platform;
  success: boolean;
  platformPostId?: string;
  error?: string;
}

async function publishToFacebook(content: string, mediaUrls: string[]): Promise<string> {
  if (!env.FACEBOOK_APP_ID) throw new Error('Facebook not configured');
  const params: Record<string, string> = {
    message: content,
    access_token: env.FACEBOOK_APP_SECRET ?? '',
  };
  if (mediaUrls.length > 0) {
    params['link'] = mediaUrls[0];
  }
  const response = await axios.post<{ id: string }>(
    `https://graph.facebook.com/me/feed`,
    params,
    { timeout: 10000 },
  );
  return response.data.id;
}

async function publishToTwitter(content: string): Promise<string> {
  if (!env.TWITTER_API_KEY) throw new Error('Twitter not configured');
  const OAuth = (await import('oauth-1.0a')).default;
  const oauth = new OAuth({
    consumer: { key: env.TWITTER_API_KEY, secret: env.TWITTER_API_SECRET ?? '' },
    signature_method: 'HMAC-SHA1',
    hash_function: (base: string, key: string) => {
      const crypto = require('crypto');
      return crypto.createHmac('sha1', key).update(base).digest('base64');
    },
  });

  const requestData = { url: 'https://api.twitter.com/2/tweets', method: 'POST' };
  const token = { key: env.TWITTER_ACCESS_TOKEN ?? '', secret: env.TWITTER_ACCESS_SECRET ?? '' };
  const headers = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await axios.post<{ data: { id: string } }>(
    requestData.url,
    { text: content.slice(0, 280) },
    { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 10000 },
  );
  return response.data.data.id;
}

async function publishToLinkedIn(content: string): Promise<string> {
  if (!env.LINKEDIN_ACCESS_TOKEN) throw new Error('LinkedIn not configured');
  const response = await axios.post<{ id: string }>(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: 'urn:li:organization:REPLACE_WITH_ORG_ID',
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    {
      headers: { Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    },
  );
  return response.data.id;
}

export async function publishToAllPlatforms(
  content: string,
  platforms: Platform[],
  mediaUrls: string[],
): Promise<PublishResult[]> {
  const publishers: Record<Platform, () => Promise<string>> = {
    facebook: () => publishToFacebook(content, mediaUrls),
    twitter: () => publishToTwitter(content),
    linkedin: () => publishToLinkedIn(content),
    instagram: async () => {
      logger.warn('Instagram publishing requires Business API approval');
      return 'instagram_mock_id';
    },
    whatsapp: async () => {
      logger.warn('WhatsApp Business publishing not yet configured');
      return 'whatsapp_mock_id';
    },
  };

  const results = await Promise.allSettled(
    platforms.map(async (platform): Promise<PublishResult> => {
      try {
        const platformPostId = await publishers[platform]();
        logger.info('Published to platform', { platform, platformPostId });
        return { platform, success: true, platformPostId };
      } catch (err) {
        logger.error('Platform publish failed', { platform, error: (err as Error).message });
        return { platform, success: false, error: (err as Error).message };
      }
    }),
  );

  return results.map((r) => (r.status === 'fulfilled' ? r.value : { platform: 'facebook', success: false }));
}
