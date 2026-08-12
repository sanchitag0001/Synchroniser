-- =============================================================================
-- TECHNIKA SUPABASE POSTGRESQL PRODUCTION DDL MIGRATION (v1.0 Production)
-- Run this directly in the Supabase SQL Query Editor
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PARTICIPANTS
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    college VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    age INT DEFAULT 18,
    course VARCHAR(100),
    semester VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    is_registration_frozen BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_participants_reg_id ON participants(registration_id);
CREATE INDEX IF NOT EXISTS idx_participants_updated_at ON participants(updated_at);

-- 2. EVENTS (With System/Competition Types & Lifecycle States)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) DEFAULT 'COMPETITION' CHECK (event_type IN ('SYSTEM', 'COMPETITION')),
    lifecycle_state VARCHAR(50) DEFAULT 'SCANNING_OPEN' CHECK (lifecycle_state IN (
        'UPCOMING',
        'REGISTRATION_OPEN',
        'SCANNING_OPEN',
        'SCANNING_CLOSED',
        'WINNER_DECLARATION_OPEN',
        'COMPLETED',
        'LOCKED'
    )),
    max_active_devices INT DEFAULT 1,
    description TEXT,
    venue VARCHAR(255),
    day VARCHAR(50),
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    capacity INT DEFAULT 100,
    individual_allowed BOOLEAN DEFAULT TRUE,
    team_allowed BOOLEAN DEFAULT FALSE,
    min_members INT DEFAULT 1,
    max_members INT DEFAULT 1,
    points_first INT DEFAULT 10,
    points_second INT DEFAULT 7,
    points_third INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_lifecycle ON events(lifecycle_state);

-- 3. TEAMS
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(50) UNIQUE NOT NULL,
    team_name VARCHAR(255),
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    leader_id VARCHAR(10) NOT NULL REFERENCES participants(registration_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'forming',
    member_count INT DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_team_id ON teams(team_id);

-- 4. TEAM MEMBERS
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(50) NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id VARCHAR(10) NOT NULL REFERENCES participants(registration_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- 5. REGISTRATIONS
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id VARCHAR(10) NOT NULL REFERENCES participants(registration_id) ON DELETE CASCADE,
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    team_id VARCHAR(50) REFERENCES teams(team_id) ON DELETE SET NULL,
    registration_type VARCHAR(20) DEFAULT 'INDIVIDUAL',
    status VARCHAR(50) DEFAULT 'CONFIRMED',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(registration_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_registrations_event_reg ON registrations(event_id, registration_id);

-- 6. VOLUNTEERS
CREATE TABLE IF NOT EXISTS volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    assigned_event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    active_session_token TEXT,
    active_device_id VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_volunteers_auth ON volunteers(volunteer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_volunteers_event ON volunteers(assigned_event_id);

-- 7. ATTENDANCE (With Full Audit Trail)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    registration_id VARCHAR(10) NOT NULL REFERENCES participants(registration_id) ON DELETE RESTRICT,
    team_id VARCHAR(50) REFERENCES teams(team_id) ON DELETE SET NULL,
    scanned_by VARCHAR(50) NOT NULL REFERENCES volunteers(volunteer_id),
    device_id VARCHAR(255),
    scan_mode VARCHAR(20) DEFAULT 'ONLINE' CHECK (scan_mode IN ('ONLINE', 'OFFLINE')),
    scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    device_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    offline_sync_id VARCHAR(100) UNIQUE NOT NULL,
    present BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, registration_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_event_reg ON attendance(event_id, registration_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scan_time ON attendance(scan_time);

-- 8. WINNERS (With Full Audit Trail)
CREATE TABLE IF NOT EXISTS winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    position INT NOT NULL CHECK (position IN (1, 2, 3)),
    registration_id VARCHAR(10) REFERENCES participants(registration_id) ON DELETE RESTRICT,
    team_id VARCHAR(50) REFERENCES teams(team_id) ON DELETE RESTRICT,
    points_awarded INT NOT NULL,
    declared_by VARCHAR(50) NOT NULL REFERENCES volunteers(volunteer_id),
    declared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified_by VARCHAR(50) REFERENCES volunteers(volunteer_id),
    last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    remarks TEXT,
    UNIQUE(event_id, position)
);
CREATE INDEX IF NOT EXISTS idx_winners_event ON winners(event_id);

-- 9. SYNC LOGS
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INT,
    added_count INT DEFAULT 0,
    updated_count INT DEFAULT 0,
    deleted_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    details JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. NOTIFICATIONS (Broadcast Announcement Board Only)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Important', 'Emergency', 'LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    target_event_id VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. SOS CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    priority INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
