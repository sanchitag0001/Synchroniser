# Technika Backend Microservices (Synchronizer & Leaderboard)

Production-grade Node.js / TypeScript microservices suite powering the **Technika Ecosystem** and the **Volunteer QR Scanner Mobile App**.

---

## 🏛️ System Architecture

```
┌─────────────────────────┐
│   MongoDB Atlas (Cloud) │  <-- Source of Truth (Registration Website)
└────────────┬────────────┘
             │ (Read-Only SSL)
             ▼
┌────────────────────────────────────────────────────────┐
│   Microservice 1: SYNC SERVICE                         │
│   - Startup Full Sync & 30-second Incremental Sync     │
│   - MongoReader (Projected Mobile-Only Fields)         │
│   - SupabaseWriter (Batched Conflict-Safe Upserts)     │
│   * Never touches Attendance or Winners                │
└────────────┬───────────────────────────────────────────┘
             │ (Batch Upsert)
             ▼
┌─────────────────────────┐
│   Supabase PostgreSQL   │  <-- Scoped Mirror & Operational DB
└────────────▲────────────┘
             │
             │ (Idempotent Attendance & Scoped Query)
             ▼
┌────────────────────────────────────────────────────────┐
│   Microservice 2: LEADERBOARD & VOLUNTEER SERVICE      │
│   - Volunteer Auth (Single Active Device Session)      │
│   - System Events vs. Competition Events Management    │
│   - Event Lifecycle State Enforcement                  │
│   - Attendance & Winner Audit Trails                   │
│   - Admin Emergency Operations & Live Monitoring       │
│   - SOS Emergency Contacts & Broadcast Notifications   │
└────────────▲───────────────────────────────────────────┘
             │ (REST / JWT)
             │
┌────────────┴────────────┐
│  Volunteer Scanner App  │  <-- Flutter Mobile (Offline-first QR Scanner)
└─────────────────────────┘
```

---

## 🚀 Key Production Capabilities

1. **System Events vs. Competition Events**:
   - `SYSTEM` Events (e.g. `Campus Entry`, `VIP Entry`, `Staff Entry`): Attendance only, no winners allowed, no leaderboard points, configurable active device capacity (e.g. 2 for Campus Entry).
   - `COMPETITION` Events (e.g. `Coding`, `Valorant`, `Robotics`): Attendance, winner declarations, leaderboard points, 1 active volunteer device.

2. **Event Lifecycle State Engine**:
   - Transitions: `UPCOMING` $\rightarrow$ `REGISTRATION_OPEN` $\rightarrow$ `SCANNING_OPEN` $\rightarrow$ `SCANNING_CLOSED` $\rightarrow$ `WINNER_DECLARATION_OPEN` $\rightarrow$ `COMPLETED` $\rightarrow$ `LOCKED`.
   - Attendance is strictly blocked when scanning is closed or event is locked.
   - Winner declaration is strictly blocked until `WINNER_DECLARATION_OPEN`.
   - `LOCKED` events become completely read-only.

3. **Complete Audit Trails**:
   - **Attendance Audit**: `attendance_id`, `registration_id`, `event_id`, `scanned_by`, `device_id`, `scan_mode` (`ONLINE` / `OFFLINE`), `scan_time`, `sync_time`, `offline_sync_id`.
   - **Winner Audit**: `winner_id`, `event_id`, `position`, `points_awarded`, `declared_by`, `declared_at`, `last_modified_by`, `last_modified_at`, `remarks`.

4. **Admin Emergency Operations & Live Monitoring Dashboard**:
   - `GET /admin/monitor`: Live system health, MongoDB/Supabase statuses, active volunteer sessions, today's attendance metrics, and memory usage.
   - `PATCH /admin/events/:id/lifecycle`: Instant state transitions (e.g. Lock/Unlock).
   - `POST /admin/volunteers/:id/force-logout`: Emergency session eviction.
   - `PATCH /admin/volunteers/:id/reassign`: Live volunteer event reassignment.
   - `GET /admin/export/attendance.csv` & `GET /admin/export/winners.csv`: Instant CSV data export.

---

## 📡 API Reference

### Microservice 1: Sync Service
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/sync/run` | Trigger manual sync (`{"full": true}`) | Admin API Key |
| `GET` | `/sync/status` | Real-time sync engine telemetry & audit logs | Public |

### Microservice 2: Leaderboard & Volunteer Service
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/login` | Volunteer login (Returns JWT + Assigned Event + Device Limits) | Public |
| `GET` | `/assignment` | Returns active volunteer's assigned event | Volunteer JWT |
| `POST` | `/logout` | Revokes active volunteer session token | Volunteer JWT |
| `GET` | `/events` | List all events (Includes `eventType`, `lifecycleState`) | Public |
| `GET` | `/events/:id` | Get event details | Public |
| `GET` | `/events/:id/participants` | Scoped participants (`?presentOnly=true` for winner search) | Volunteer JWT |
| `GET` | `/events/:id/attendance` | Get attendance records for event | Volunteer JWT |
| `POST` | `/events/:id/attendance` | Scan & Mark attendance (Enforces Lifecycle & Audits) | Volunteer JWT |
| `POST` | `/events/:id/winners` | Declare 1st/2nd/3rd place winners (Enforces Attendance & Competition Type) | Volunteer JWT |
| `GET` | `/events/:id/winners` | Get winners list for event | Public |
| `GET` | `/notifications` | Get broadcast notifications for volunteer | Volunteer JWT |
| `POST` | `/notification` | Admin broadcast notification | Admin API Key |
| `GET` | `/sos` | Get emergency contacts list | Public |
| `POST` | `/sos` | Admin add emergency contact | Admin API Key |
| `GET` | `/health` | Unified microservice health check | Public |

### Admin Emergency Operations & Monitoring
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/admin/monitor` | Real-time system monitoring dashboard metrics | Admin API Key |
| `POST` | `/admin/sync/force` | Force immediate synchronization | Admin API Key |
| `PATCH` | `/admin/events/:id/lifecycle` | Transition lifecycle state (`SCANNING_OPEN`, `LOCKED`, etc.) | Admin API Key |
| `PATCH` | `/admin/events/:id/lock` | Lock event (read-only) | Admin API Key |
| `PATCH` | `/admin/events/:id/unlock` | Unlock event (resume scanning) | Admin API Key |
| `GET` | `/admin/volunteers/active` | View all active volunteer devices & sessions | Admin API Key |
| `POST` | `/admin/volunteers/:id/force-logout` | Invalidate volunteer session | Admin API Key |
| `PATCH` | `/admin/volunteers/:id/reassign` | Reassign volunteer to target event | Admin API Key |
| `GET` | `/admin/export/attendance.csv` | Export complete attendance audit CSV | Admin API Key |
| `GET` | `/admin/export/winners.csv` | Export verified winners audit CSV | Admin API Key |

---

## 🛠️ Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```

### 3. Initialize Supabase Database
Run the SQL migration script located at `sql/01_supabase_schema.sql` directly inside the **Supabase SQL Editor**.

### 4. Run Locally
```bash
# Run both microservices concurrently in dev mode:
npm run dev

# Run only Sync Service:
npm run dev:sync

# Run only Leaderboard Service:
npm run dev:leaderboard
```

### 5. Run Automated Tests
```bash
npm test
```
