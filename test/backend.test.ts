import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { env } from '../shared/config/env.config';
import {
  AttendanceScanItemSchema,
  WinnerSubmissionSchema,
  VolunteerLoginSchema,
  NotificationPublishSchema,
  EventLifecycleSchema,
  VolunteerReassignSchema,
} from '../shared/models/types';

describe('Technika Backend Microservices (v1.0 Production) Tests', () => {
  it('Validates environment variables and Campus Entry device allowances', () => {
    assert.strictEqual(env.PORT, 4000);
    assert.strictEqual(env.CRON_SYNC_INTERVAL_SEC, 30);
    assert.strictEqual(env.CAMPUS_ENTRY_MAX_DEVICES, 2);
    assert.strictEqual(env.STANDARD_EVENT_MAX_DEVICES, 1);
    assert.ok(env.CAMPUS_ENTRY_EVENT_IDS.includes('EVT-ENTRY'));
  });

  it('Validates Volunteer Login Zod Schema', () => {
    const valid = VolunteerLoginSchema.safeParse({
      volunteerId: 'VOL-001',
      password: 'password123',
      deviceId: 'device-male-scanner-01',
    });
    assert.strictEqual(valid.success, true);

    const invalid = VolunteerLoginSchema.safeParse({
      volunteerId: '',
      password: '',
    });
    assert.strictEqual(invalid.success, false);
  });

  it('Validates Attendance Scan Item Schema with audit trail fields', () => {
    const valid = AttendanceScanItemSchema.safeParse({
      registrationId: 'TECH26-00001',
      deviceId: 'android-terminal-04',
      scanMode: 'OFFLINE',
      scanTime: '2026-08-12T10:15:30.000Z',
      offlineSyncId: 'SCAN-SYNC-001',
    });
    assert.strictEqual(valid.success, true);
  });

  it('Validates Winner Declaration Schema with position constraint (1, 2, 3)', () => {
    const valid = WinnerSubmissionSchema.safeParse({
      position: 1,
      registrationId: 'TECH26-00001',
      remarks: 'First position winner',
    });
    assert.strictEqual(valid.success, true);

    // Invalid position (e.g. 4)
    const invalidPosition = WinnerSubmissionSchema.safeParse({
      position: 4 as any,
      registrationId: 'TECH26-00001',
    });
    assert.strictEqual(invalidPosition.success, false);
  });

  it('Validates Event Lifecycle Schema transitions', () => {
    const scanningOpen = EventLifecycleSchema.safeParse({
      lifecycleState: 'SCANNING_OPEN',
    });
    assert.strictEqual(scanningOpen.success, true);

    const winnerOpen = EventLifecycleSchema.safeParse({
      lifecycleState: 'WINNER_DECLARATION_OPEN',
    });
    assert.strictEqual(winnerOpen.success, true);

    const locked = EventLifecycleSchema.safeParse({
      lifecycleState: 'LOCKED',
    });
    assert.strictEqual(locked.success, true);

    const invalid = EventLifecycleSchema.safeParse({
      lifecycleState: 'INVALID_STATE' as any,
    });
    assert.strictEqual(invalid.success, false);
  });

  it('Validates Volunteer Reassign Schema', () => {
    const valid = VolunteerReassignSchema.safeParse({
      assignedEventId: 'EVT-CODING',
    });
    assert.strictEqual(valid.success, true);

    const invalid = VolunteerReassignSchema.safeParse({
      assignedEventId: '',
    });
    assert.strictEqual(invalid.success, false);
  });

  it('Validates Broadcast Notification Announcement Schema', () => {
    const normal = NotificationPublishSchema.safeParse({
      title: 'Lunch Break Announcement',
      message: 'Lunch is served at the cafeteria from 1 PM to 2 PM.',
      priority: 'Normal',
    });
    assert.strictEqual(normal.success, true);

    const emergency = NotificationPublishSchema.safeParse({
      title: 'Urgent Organizer Meeting',
      message: 'All volunteers report to Control Room immediately.',
      priority: 'Emergency',
    });
    assert.strictEqual(emergency.success, true);
  });

  it('Signs and verifies JWT with single-device claim', () => {
    const payload = {
      volunteerId: 'VOL-ENTRY-MALE',
      name: 'Male Entry Volunteer',
      assignedEventId: 'EVT-ENTRY',
      deviceId: 'android-male-entry-01',
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });
    assert.ok(token);

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    assert.strictEqual(decoded.volunteerId, 'VOL-ENTRY-MALE');
    assert.strictEqual(decoded.assignedEventId, 'EVT-ENTRY');
    assert.strictEqual(decoded.deviceId, 'android-male-entry-01');
  });
});
