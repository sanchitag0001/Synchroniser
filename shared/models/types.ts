import { z } from 'zod';

// =============================================================================
// SHARED DOMAIN ENUMS & INTERFACES
// =============================================================================

export type EventType = 'SYSTEM' | 'COMPETITION';
export type EventLifecycleState =
  | 'UPCOMING'
  | 'REGISTRATION_OPEN'
  | 'SCANNING_OPEN'
  | 'SCANNING_CLOSED'
  | 'WINNER_DECLARATION_OPEN'
  | 'COMPLETED'
  | 'LOCKED';

export interface IParticipantRecord {
  registration_id: string;
  name: string;
  college: string;
  email: string;
  phone: string;
  gender: string;
  age?: number;
  course?: string;
  semester?: string;
  is_verified: boolean;
  is_registration_frozen: boolean;
  updated_at: string;
  created_at?: string;
}

export interface IEventRecord {
  event_id: string;
  name: string;
  category: string;
  event_type: EventType;
  lifecycle_state: EventLifecycleState;
  max_active_devices: number;
  description?: string;
  venue?: string;
  day?: string;
  start_time?: string;
  end_time?: string;
  capacity?: number;
  individual_allowed: boolean;
  team_allowed: boolean;
  min_members: number;
  max_members: number;
  points_first: number;
  points_second: number;
  points_third: number;
  is_active: boolean;
  display_order: number;
  updated_at: string;
}

export interface ITeamRecord {
  team_id: string;
  team_name?: string;
  event_id: string;
  leader_id: string;
  status: string;
  member_count: number;
  updated_at: string;
}

export interface ITeamMemberRecord {
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  updated_at: string;
}

export interface IRegistrationRecord {
  registration_id: string;
  event_id: string;
  team_id?: string | null;
  registration_type: string;
  status: string;
  registered_at: string;
  updated_at: string;
}

export interface IAttendanceRecord {
  id?: string;
  event_id: string;
  registration_id: string;
  team_id?: string | null;
  scanned_by: string;
  device_id?: string | null;
  scan_mode: 'ONLINE' | 'OFFLINE';
  scan_time: string;
  sync_time: string;
  device_timestamp: string;
  offline_sync_id: string;
  present: boolean;
  created_at?: string;
}

export interface IWinnerRecord {
  id?: string;
  event_id: string;
  position: number;
  registration_id?: string | null;
  team_id?: string | null;
  points_awarded: number;
  declared_by: string;
  declared_at: string;
  last_modified_by?: string | null;
  last_modified_at?: string;
  remarks?: string | null;
}

export interface ISyncLogRecord {
  id?: string;
  sync_type: 'MANUAL' | 'SCHEDULED' | 'INCREMENTAL';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  added_count: number;
  updated_count: number;
  deleted_count: number;
  failed_count: number;
  details?: Record<string, any>;
  error_message?: string | null;
}

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

// Volunteer Login
export const VolunteerLoginSchema = z.object({
  volunteerId: z.string().min(1, 'Volunteer ID is required'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().min(1, 'Device ID is required for active session tracking'),
});
export type VolunteerLoginDto = z.infer<typeof VolunteerLoginSchema>;

// Attendance Scan Request (With Audit Trail Fields)
export const AttendanceScanItemSchema = z.object({
  registrationId: z.string().min(1, 'Registration ID is required'),
  teamId: z.string().nullable().optional(),
  deviceId: z.string().optional(),
  scanMode: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'),
  scanTime: z.string().datetime().optional(),
  deviceTimestamp: z.string().datetime({ message: 'Valid ISO datetime required' }).optional(),
  offlineSyncId: z.string().min(1, 'Unique offlineSyncId is required').optional(),
});
export type AttendanceScanItemDto = z.infer<typeof AttendanceScanItemSchema>;

export const AttendanceBatchSchema = z.object({
  items: z.array(AttendanceScanItemSchema).min(1, 'At least one scan item required'),
});
export type AttendanceBatchDto = z.infer<typeof AttendanceBatchSchema>;

// Winner Declaration Schema
export const WinnerSubmissionSchema = z.object({
  position: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  registrationId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  remarks: z.string().max(500).optional(),
}).refine((data) => data.registrationId || data.teamId, {
  message: 'Either registrationId or teamId must be provided',
});
export type WinnerSubmissionDto = z.infer<typeof WinnerSubmissionSchema>;

// Event Lifecycle State Transition Schema
export const EventLifecycleSchema = z.object({
  lifecycleState: z.enum([
    'UPCOMING',
    'REGISTRATION_OPEN',
    'SCANNING_OPEN',
    'SCANNING_CLOSED',
    'WINNER_DECLARATION_OPEN',
    'COMPLETED',
    'LOCKED',
  ]),
});
export type EventLifecycleDto = z.infer<typeof EventLifecycleSchema>;

// Admin Volunteer Reassignment Schema
export const VolunteerReassignSchema = z.object({
  assignedEventId: z.string().min(1, 'Target Event ID is required'),
});
export type VolunteerReassignDto = z.infer<typeof VolunteerReassignSchema>;

// Broadcast Notification Schema
export const NotificationPublishSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message body is required'),
  priority: z.enum(['Normal', 'Important', 'Emergency', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('Normal'),
  targetEventId: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type NotificationPublishDto = z.infer<typeof NotificationPublishSchema>;

// SOS Contact Schema
export const ContactSchema = z.object({
  name: z.string().min(1, 'Contact name required'),
  phone: z.string().min(5, 'Valid phone number required'),
  designation: z.string().min(1, 'Designation required'),
  priority: z.number().int().default(1),
  isActive: z.boolean().default(true),
});
export type ContactDto = z.infer<typeof ContactSchema>;
