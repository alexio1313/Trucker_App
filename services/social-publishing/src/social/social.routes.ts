import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/mongo';
import { generateCaption } from '../ai/caption.generator';
import { publishToAllPlatforms, Platform } from '../publishers/platform.publisher';
import { logger } from '../logger';

const router = Router();

interface SocialPostDoc {
  _id?: ObjectId;
  createdBy: string;
  createdByName?: string;
  platforms: Platform[];
  content: string;
  mediaUrls: string[];
  scheduledFor: Date | null;
  status: 'draft' | 'pending_approval' | 'queued' | 'published' | 'failed' | 'rejected';
  rejectionReason?: string;
  publishResults: unknown[];
  createdAt: Date;
  publishedAt: Date | null;
  approvedBy?: string;
  approvedAt?: Date;
}

const createPostSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  platforms: z.array(z.enum(['facebook', 'instagram', 'twitter', 'linkedin', 'whatsapp'])).min(1),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  scheduledFor: z.string().datetime().optional(),
  aiGenerate: z.boolean().default(false),
  aiTopic: z.string().max(200).optional(),
  aiTone: z.enum(['professional', 'casual', 'celebratory']).default('professional'),
}).refine((d) => d.content || d.aiGenerate, { message: 'Either content or aiGenerate must be provided' });

// POST /social/posts — create (goes to pending_approval)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string;
  const userType = req.headers['x-user-type'] as string;
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
    return;
  }

  try {
    const data = parsed.data;
    let content = data.content ?? '';

    if (data.aiGenerate && data.aiTopic) {
      content = await generateCaption({
        topic: data.aiTopic,
        platform: data.platforms[0],
        tone: data.aiTone,
      });
    }

    const posts = await getCollection<SocialPostDoc>('social_posts');
    const doc: SocialPostDoc = {
      createdBy: userId,
      platforms: data.platforms,
      content,
      mediaUrls: data.mediaUrls,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
      // Merchants → pending_approval; admins → publish immediately
      status: userType === 'admin' ? 'published' : 'pending_approval',
      publishResults: [],
      createdAt: new Date(),
      publishedAt: null,
    };

    if (userType === 'admin') {
      const results = await publishToAllPlatforms(content, data.platforms, data.mediaUrls);
      doc.publishResults = results;
      doc.status = results.some((r: { success: boolean }) => r.success) ? 'published' : 'failed';
      doc.publishedAt = new Date();
    }

    const result = await posts.insertOne(doc);
    res.status(201).json({ success: true, data: { ...doc, _id: result.insertedId } });
  } catch (err) {
    logger.error('Failed to create post', { error: (err as Error).message, userId });
    res.status(500).json({ success: false, error: { code: 'POST_FAILED', message: 'Failed to create post' } });
  }
});

// GET /social/posts — list (admin sees all, merchants see own)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string;
  const userType = req.headers['x-user-type'] as string;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 50);
  const status = req.query['status'] as string | undefined;

  const posts = await getCollection<SocialPostDoc>('social_posts');
  const filter: Record<string, unknown> = userType === 'admin' ? {} : { createdBy: userId };
  if (status) filter['status'] = status;

  const [items, total] = await Promise.all([
    posts.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    posts.countDocuments(filter),
  ]);

  res.json({ success: true, data: { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 } } });
});

// POST /social/posts/generate-caption — AI caption generation only
router.post('/generate-caption', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    topic: z.string().min(3).max(200),
    platform: z.enum(['facebook', 'instagram', 'twitter', 'linkedin', 'whatsapp']),
    tone: z.enum(['professional', 'casual', 'celebratory']).default('professional'),
    context: z.string().max(500).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    return;
  }

  const caption = await generateCaption(parsed.data);
  res.json({ success: true, data: { caption } });
});

// POST /social/posts/:id/approve — admin approves and publishes post
router.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const userType = req.headers['x-user-type'] as string;
  const adminId = req.headers['x-user-id'] as string;

  if (userType !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }

  try {
    const posts = await getCollection<SocialPostDoc>('social_posts');
    const post = await posts.findOne({ _id: new ObjectId(req.params.id), status: 'pending_approval' });

    if (!post) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found or not pending approval' } });
      return;
    }

    const results = await publishToAllPlatforms(post.content, post.platforms, post.mediaUrls);
    const newStatus = results.some((r: { success: boolean }) => r.success) ? 'published' : 'failed';

    await posts.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: newStatus, publishResults: results, publishedAt: new Date(), approvedBy: adminId, approvedAt: new Date() } },
    );

    res.json({ success: true, data: { status: newStatus, publishedAt: new Date() } });
  } catch (err) {
    logger.error('Failed to approve post', { error: (err as Error).message, postId: req.params.id });
    res.status(500).json({ success: false, error: { code: 'APPROVE_FAILED', message: 'Failed to approve post' } });
  }
});

// POST /social/posts/:id/reject — admin rejects post
router.post('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  const userType = req.headers['x-user-type'] as string;

  if (userType !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }

  const { reason } = req.body;
  if (!reason || typeof reason !== 'string') {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason required' } });
    return;
  }

  try {
    const posts = await getCollection<SocialPostDoc>('social_posts');
    const result = await posts.updateOne(
      { _id: new ObjectId(req.params.id), status: 'pending_approval' },
      { $set: { status: 'rejected', rejectionReason: reason } },
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found or not pending approval' } });
      return;
    }

    res.json({ success: true, data: { status: 'rejected' } });
  } catch (err) {
    logger.error('Failed to reject post', { error: (err as Error).message, postId: req.params.id });
    res.status(500).json({ success: false, error: { code: 'REJECT_FAILED', message: 'Failed to reject post' } });
  }
});

// DELETE /social/posts/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string;
  const posts = await getCollection<SocialPostDoc>('social_posts');
  const result = await posts.deleteOne({
    _id: new ObjectId(req.params.id),
    createdBy: userId,
    status: { $in: ['draft', 'queued', 'pending_approval', 'rejected'] },
  });
  if (result.deletedCount === 0) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found or cannot be deleted' } });
    return;
  }
  res.json({ success: true, data: null });
});

export { router as socialRoutes };
