import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../logger';
import { recordLocationUpdate } from '../tracking/tracking.service';

interface AuthSocket extends Socket {
  userId?: string;
  userType?: string;
}

export function setupTrackingGateway(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; userType: string };
      socket.userId = payload.userId;
      socket.userType = payload.userType;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    logger.debug('WebSocket connected', { userId: socket.userId, userType: socket.userType });

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      logger.debug('Joined room', { userId: socket.userId, roomId });
    });

    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
    });

    // Truckers push live location
    socket.on('location_update', async (data: {
      loadId: string;
      truckId: string;
      lat: number;
      lng: number;
      speedKmh?: number;
      heading?: number;
      accuracy?: number;
      batteryLevel?: number;
    }) => {
      if (socket.userType !== 'trucker' || !socket.userId) return;

      try {
        await recordLocationUpdate({ ...data, truckerId: socket.userId });

        // Broadcast to everyone tracking this load
        io.to(`load:${data.loadId}`).emit('location_update', {
          loadId: data.loadId,
          lat: data.lat,
          lng: data.lng,
          speedKmh: data.speedKmh ?? 0,
          heading: data.heading ?? 0,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Failed to process location update', { error: (err as Error).message });
      }
    });

    socket.on('disconnect', () => {
      logger.debug('WebSocket disconnected', { userId: socket.userId });
    });
  });

  return io;
}
