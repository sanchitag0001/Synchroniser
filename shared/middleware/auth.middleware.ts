import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { UnauthorizedError, ForbiddenError } from '../errors/app.error';
import { SupabaseDatabase } from '../database/supabase.client';
import { logger } from '../logger/pino.logger';

export interface AuthenticatedVolunteer {
  volunteerId: string;
  name: string;
  assignedEventId: string;
  deviceId: string;
}

export interface AuthenticatedRequest extends Request {
  volunteer?: AuthenticatedVolunteer;
  isAdmin?: boolean;
}

export const authenticateVolunteer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header (Bearer token required)'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      volunteerId: string;
      name: string;
      assignedEventId: string;
      deviceId: string;
    };

    // Single active device session enforcement: Query Supabase
    const { data: volunteer, error } = await SupabaseDatabase.client
      .from('volunteers')
      .select('volunteer_id, name, assigned_event_id, active_session_token, active_device_id, is_active')
      .eq('volunteer_id', decoded.volunteerId)
      .single();

    if (error || !volunteer) {
      logger.warn({ volunteerId: decoded.volunteerId }, '❌ Volunteer account not found during auth verification');
      return next(new UnauthorizedError('Volunteer account does not exist or has been removed'));
    }

    if (!volunteer.is_active) {
      return next(new ForbiddenError('Volunteer account is deactivated. Contact Administrator.'));
    }

    // Invalidation check: If token does not match active_session_token or deviceId mismatch
    if (volunteer.active_session_token !== token) {
      logger.warn(
        { volunteerId: decoded.volunteerId, deviceId: decoded.deviceId },
        '⚠️ Session expired: Volunteer logged in from another device'
      );
      return next(
        new UnauthorizedError('Your session has expired because this account was logged into on another device.')
      );
    }

    req.volunteer = {
      volunteerId: volunteer.volunteer_id,
      name: volunteer.name,
      assignedEventId: volunteer.assigned_event_id,
      deviceId: decoded.deviceId,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Authentication token has expired. Please login again.'));
    }
    return next(new UnauthorizedError('Invalid authentication token signature.'));
  }
};

export const authenticateAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-admin-api-key'] || req.headers['x-api-key'];
  if (apiKey && apiKey === env.ADMIN_API_KEY) {
    req.isAdmin = true;
    return next();
  }

  // Fallback: check Bearer token if admin signed
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (decoded.role === 'ADMIN' || decoded.isAdmin === true) {
        req.isAdmin = true;
        return next();
      }
    } catch (_) {}
  }

  return next(new ForbiddenError('Administrator API Key (X-Admin-Api-Key) or Admin Token required'));
};
