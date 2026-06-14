import { Request, Response } from 'express';
import {
  createLoadSchema,
  searchLoadsSchema,
  cancelLoadSchema,
  confirmDeliverySchema,
} from './load.schemas';
import {
  createNewLoad,
  getLoad,
  getMerchantLoadList,
  searchLoads,
  acceptLoadByTrucker,
  confirmPickup,
  deliverLoad,
  cancelLoadRequest,
} from './load.service';
import { logger } from '../logger';

function getRequesterId(req: Request): { userId: string; userType: string } {
  return {
    userId: req.headers['x-user-id'] as string,
    userType: req.headers['x-user-type'] as string,
  };
}

export async function handleCreateLoad(req: Request, res: Response): Promise<void> {
  const parsed = createLoadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
    return;
  }

  const { userId } = getRequesterId(req);
  try {
    const load = await createNewLoad(userId, parsed.data);
    res.status(201).json({ success: true, data: load });
  } catch (err) {
    logger.error('Failed to create load', { error: (err as Error).message, userId });
    res.status(500).json({ success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create load' } });
  }
}

export async function handleGetLoad(req: Request, res: Response): Promise<void> {
  const { loadId } = req.params;
  const { userId, userType } = getRequesterId(req);
  const load = await getLoad(loadId, userId, userType);
  if (!load) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found' } });
    return;
  }
  res.json({ success: true, data: load });
}

export async function handleListLoads(req: Request, res: Response): Promise<void> {
  const { userId, userType } = getRequesterId(req);
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 50);
  const status = (req.query['status'] as string) || null;

  if (userType === 'merchant') {
    const { items, total } = await getMerchantLoadList(userId, status, page, pageSize);
    res.json({ success: true, data: { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 } } });
    return;
  }

  res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Use /search endpoint' } });
}

export async function handleSearchLoads(req: Request, res: Response): Promise<void> {
  const parsed = searchLoadsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten().fieldErrors } });
    return;
  }

  const { page, pageSize, ...filters } = parsed.data;
  const items = await searchLoads(filters, page, pageSize);
  res.json({ success: true, data: { items, pagination: { page, pageSize, total: items.length, totalPages: 1, hasNextPage: false, hasPrevPage: page > 1 } } });
}

export async function handleAcceptLoad(req: Request, res: Response): Promise<void> {
  const { loadId } = req.params;
  const { userId } = getRequesterId(req);
  try {
    const load = await acceptLoadByTrucker(loadId, userId);
    res.json({ success: true, data: load });
  } catch (err) {
    const code = (err as Error).message;
    const statusMap: Record<string, number> = { LOAD_NOT_FOUND: 404, LOAD_NOT_AVAILABLE: 409, FORBIDDEN: 403 };
    res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
  }
}

export async function handleConfirmPickup(req: Request, res: Response): Promise<void> {
  const { loadId } = req.params;
  const { userId } = getRequesterId(req);
  try {
    const load = await confirmPickup(loadId, userId);
    res.json({ success: true, data: load });
  } catch (err) {
    const code = (err as Error).message;
    const statusMap: Record<string, number> = { LOAD_NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS_TRANSITION: 409 };
    res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
  }
}

export async function handleDeliverLoad(req: Request, res: Response): Promise<void> {
  const { loadId } = req.params;
  const { userId } = getRequesterId(req);
  const parsed = confirmDeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'POD photo URL required' } });
    return;
  }
  try {
    const load = await deliverLoad(loadId, userId, parsed.data.podPhotoUrl);
    res.json({ success: true, data: load });
  } catch (err) {
    const code = (err as Error).message;
    const statusMap: Record<string, number> = { LOAD_NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS_TRANSITION: 409 };
    res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
  }
}

export async function handleCancelLoad(req: Request, res: Response): Promise<void> {
  const { loadId } = req.params;
  const { userId, userType } = getRequesterId(req);
  const parsed = cancelLoadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason required' } });
    return;
  }
  try {
    const load = await cancelLoadRequest(loadId, userId, userType, parsed.data.reason);
    res.json({ success: true, data: load });
  } catch (err) {
    const code = (err as Error).message;
    const statusMap: Record<string, number> = { LOAD_NOT_FOUND: 404, FORBIDDEN: 403, LOAD_CANNOT_BE_CANCELLED: 409 };
    res.status(statusMap[code] ?? 500).json({ success: false, error: { code, message: code.toLowerCase().replace(/_/g, ' ') } });
  }
}
