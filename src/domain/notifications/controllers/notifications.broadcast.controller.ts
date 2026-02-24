import type { Request, Response } from 'express';
import { broadcastNotification } from '../services/notifications.broadcast';
import type { UserContext } from '../types/notifications.types';

/**
 * Send broadcast notification to multiple users
 * POST /api/v1/notifications/broadcast
 * Admin only
 */
export const sendBroadcast = async (req: Request, res: Response): Promise<void> => {
  try {
    const userContext = ((req as any).user as UserContext) || ((req as any).userContext as UserContext);

    if (!userContext) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - user context required',
      });
      return;
    }

    const payload = req.body;

    // Validate required fields
    if (!payload.target_type) {
      res.status(400).json({
        success: false,
        message: 'target_type is required',
      });
      return;
    }

    if (!payload.title || !payload.message) {
      res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
      return;
    }

    const result = await broadcastNotification(payload, userContext);

    res.status(200).json({
      success: true,
      message: `Broadcast sent to ${result.recipients_count} users`,
      data: result,
    });
  } catch (error: any) {
    console.error('Broadcast error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to send broadcast',
    });
  }
};
