# PICS Nigeria

PICS Nigeria is a production-oriented monorepo for national political operations with hierarchical RBAC, voter registration, referrals, rewards, candidate onboarding, polls, posts, feedback, agents, and starter voter/admin/candidate dashboards.
The current backend also includes a map-ready intelligence foundation for agent locations, incidents, and polling-unit coverage analytics.
Reward balances currently assume that `PENDING`, `APPROVED`, and `PAID` redemption requests reserve points immediately, while `REJECTED` requests release them back into available balance.

## Stack

- `apps/web`: Next.js + TypeScript
- `apps/api`: Express + TypeScript
- `packages/database`: Prisma schema, migration, seed, bootstrap checks
- `packages/shared`: shared constants, types, and helpers

## Local setup order

1. Install dependencies
   - `npm install`
2. Create env files
   - `.env`
   - `apps/web/.env.local`
3. Generate Prisma client
   - `npm run prisma:generate`
4. Run database migration
   - `npm run prisma:migrate`
5. Seed starter data
   - `npm run seed`
6. Review seeded bootstrap details
   - `npm run seed:credentials`
   - `npm run bootstrap:check`
7. Run API
   - `npm run dev:api`
8. Run web
   - `npm run dev:web`

## Environment variables

### `.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pics_nigeria?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
PORT=4000
SUPER_ADMIN_EMAIL="superadmin@pics.ng"
SUPER_ADMIN_PASSWORD="ChangeMe123!"
SUPER_ADMIN_NAME="PICS Nigeria Super Admin"
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
```

## Deployment

### Render API

- The repo includes [`render.yaml`](/C:/Users/USER/projects/pics-nigeria/render.yaml) for the Express API.
- Import the repo in Render as a Blueprint or create a web service that uses the same commands:
  - Build command: `npm install && npm run build`
  - Start command: `npm run start:render --workspace @pics-nigeria/api`
- This app is configured for PostgreSQL in production. Set `DATABASE_URL` in Render to your Render Postgres connection string.
- Required secret env vars in Render:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `SUPER_ADMIN_EMAIL`
  - `SUPER_ADMIN_PASSWORD`
- Use the Render Postgres internal connection string when the database and web service are in the same Render region.

### Vercel Web

- Configure the Vercel project root directory as `apps/web`.
- The repo includes [`apps/web/vercel.json`](/C:/Users/USER/projects/pics-nigeria/apps/web/vercel.json) for monorepo installs/builds.
- Set `NEXT_PUBLIC_API_BASE_URL` in Vercel to your Render API URL, for example `https://pics-nigeria-api.onrender.com`.
- After the API URL is known, redeploy the Vercel project so the public env var is baked into the build.

## Starter seed structure

The seed creates:

- 1 state: `seed-state-lagos`
- 1 senatorial district: `seed-senatorial-lagos-central`
- 1 federal constituency: `seed-fed-ikeja`
- 1 LGA: `seed-lga-ikeja`
- 2 wards: `seed-ward-ikeja-ward-a`, `seed-ward-ikeja-ward-b`
- 1 state constituency: `seed-state-const-ikeja-1`
- 1 polling unit: `seed-pu-ikeja-001`
- 1 `SUPER_ADMIN`
- 1 sample state admin
- 1 sample candidate
- 1 sample voter
- 1 sample candidate assignment
- 1 sample agent
- 1 sample agent activity
- 1 sample incident
- 1 sample redemption request
- 1 sample notification set
- 1 sample audit log
- 1 sample poll
- 1 sample post
- 1 sample feedback item

Safe helper output:

- `npm run seed:credentials`
  - prints seeded emails, plain local sample passwords, and starter territory ids
  - does not print password hashes
- `npm run bootstrap:check`
  - prints whether bootstrap env vars and `SUPER_ADMIN` exist
  - does not print secrets

## Auth flow

`POST /auth/login`

```json
{
  "email": "superadmin@pics.ng",
  "password": "ChangeMe123!"
}
```

`GET /auth/me`

- requires `Authorization: Bearer <token>`
- returns role plus admin/candidate/voter/agent profile context needed by the web app

`POST /auth/register-voter`

```json
{
  "fullName": "Ada Okafor",
  "email": "ada@example.com",
  "phone": "08030000000",
  "password": "StrongPass123!",
  "voterCardNumber": "VIN-1234567890",
  "stateId": "seed-state-lagos",
  "lgaId": "seed-lga-ikeja",
  "wardId": "seed-ward-ikeja-ward-a",
  "referredByCode": "PICSSEED01"
}
```

## Super admin routes

`POST /admin/users`

```json
{
  "name": "State Admin",
  "email": "state.admin@example.com",
  "password": "StrongPass123!",
  "adminLevel": "STATE",
  "stateId": "seed-state-lagos"
}
```

`POST /admin/candidates`

```json
{
  "name": "Kemi Adeyemi",
  "email": "kemi@example.com",
  "password": "StrongPass123!",
  "officeType": "HOUSE_OF_REP",
  "stateId": "seed-state-lagos",
  "federalConstituencyId": "seed-fed-ikeja"
}
```

Candidate office rules:

- `PRESIDENTIAL`: no lower territory ids
- `GOVERNORSHIP`: `stateId`
- `SENATE`: `stateId` and `senatorialDistrictId`
- `HOUSE_OF_REP`: `stateId` and `federalConstituencyId`
- `STATE_ASSEMBLY`: `stateId` and `stateConstituencyId`
- `CHAIRMANSHIP`: `stateId` and `lgaId`
- `COUNCILLOR`: `stateId`, `lgaId`, and `wardId`

`POST /admin/candidates/assign`

```json
{
  "adminUserId": "admin-user-id",
  "candidateUserId": "candidate-user-id",
  "permissionType": "MANAGE"
}
```

Assignment permission types:

- `VIEW`
- `MANAGE`
- `PUBLISH`
- `MODERATE`

## Admin operations routes

All require `ADMIN` or `SUPER_ADMIN` unless stated otherwise.

- `GET /admin/candidates`
- `POST /admin/agents`
- `GET /admin/agents`
- `POST /admin/participation`
- `POST /admin/polls`
- `GET /admin/polls/:pollId/results`
- `GET /admin/feedback`
- `GET /admin/summary`
- `GET /admin/agent-activity-summaries`
- `GET /admin/agent-activities`
- `GET /admin/incidents`
- `PATCH /admin/incidents/:incidentId/status`
- `PATCH /admin/incidents/:incidentId/assign`
- `GET /admin/map-summary`
- `GET /admin/polling-unit-coverage`
- `GET /admin/redemptions`
- `PATCH /admin/redemptions/:redemptionId/approve`
- `PATCH /admin/redemptions/:redemptionId/reject`
- `PATCH /admin/redemptions/:redemptionId/paid`
- `PATCH /admin/incidents/:incidentId/escalate`
- `GET /admin/recent-changes`
- `GET /admin/analytics`
- `GET /admin/audit-logs`
- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `PATCH /notifications/read-all`
- `POST /media/incidents/:incidentId`
- `POST /media/feedback/:feedbackId`

Agent creation example:

```json
{
  "name": "Ward Agent",
  "email": "agent@example.com",
  "password": "StrongPass123!",
  "stateId": "seed-state-lagos",
  "lgaId": "seed-lga-ikeja",
  "wardId": "seed-ward-ikeja-ward-a",
  "pollingUnitId": "seed-pu-ikeja-001"
}
```

Agent activity and incident routes:

- `POST /agent/check-in`
- `POST /agent/check-out`
- `POST /agent/location`
- `GET /agent/activities`
- `POST /agent/incidents`

Agent activity payload example:

```json
{
  "latitude": 6.6018,
  "longitude": 3.3515,
  "accuracyMeters": 15,
  "note": "Arrived at assigned polling unit",
  "pollingUnitId": "seed-pu-ikeja-001"
}
```

Agent incident example:

```json
{
  "type": "MATERIAL_SHORTAGE",
  "title": "Campaign materials running low",
  "description": "Leaflets and shirts are almost exhausted at the unit.",
  "severity": "MEDIUM",
  "pollingUnitId": "seed-pu-ikeja-001",
  "latitude": 6.6018,
  "longitude": 3.3515
}
```

Media metadata example:

```json
{
  "fileName": "incident-photo.jpg",
  "mimeType": "image/jpeg",
  "fileUrl": "https://example.com/uploads/incident-photo.jpg"
}
```

Incident escalation example:

```json
{
  "escalationNote": "Escalating due to repeated shortage reports."
}
```

Incident status update example:

```json
{
  "status": "IN_PROGRESS"
}
```

Incident assignment example:

```json
{
  "assignedAdminUserId": "admin-user-id"
}
```

Poll creation example:

```json
{
  "title": "Preferred House of Representatives candidate",
  "description": "Starter voter sentiment poll",
  "candidateUserId": "candidate-user-id",
  "officeType": "HOUSE_OF_REP",
  "stateId": "seed-state-lagos",
  "federalConstituencyId": "seed-fed-ikeja",
  "options": ["Kemi Adeyemi", "Undecided"]
}
```

Participation example:

```json
{
  "voterUserId": "voter-user-id",
  "type": "FIELD_CONTACT",
  "description": "Verified campaign participation",
  "pointsAwarded": 5
}
```

## Candidate routes

`POST /candidate/posts`

- candidate can create their own posts
- authorized admin can create posts for an assigned candidate with `MANAGE` or `PUBLISH`

```json
{
  "candidateUserId": "candidate-user-id",
  "title": "Campaign priorities",
  "content": "Jobs, accountability, and local development remain central.",
  "stateId": "seed-state-lagos",
  "federalConstituencyId": "seed-fed-ikeja",
  "isPublished": true
}
```

Additional candidate routes:

- `GET /candidate/posts`
- `GET /candidate/feedback`
- `GET /candidate/incidents`

## Voter routes

- `GET /voter/rewards`
- `GET /voter/polls`
- `POST /voter/polls/:pollId/respond`
- `GET /voter/posts`
- `POST /voter/feedback`
- `POST /voter/incidents`
- `POST /voter/redemptions`
- `GET /voter/redemptions`

Feedback/report example:

```json
{
  "type": "GENERAL_FEEDBACK",
  "message": "Road access and youth employment should stay top priorities.",
  "candidateUserId": "candidate-user-id",
  "stateId": "seed-state-lagos",
  "senatorialDistrictId": "seed-senatorial-lagos-central",
  "lgaId": "seed-lga-ikeja",
  "wardId": "seed-ward-ikeja-ward-a",
  "pollingUnitId": "seed-pu-ikeja-001"
}
```

Poll response example:

```json
{
  "optionId": "poll-option-id"
}
```

Voter incident example:

```json
{
  "type": "SECURITY_CONCERN",
  "title": "Security presence is low",
  "description": "Only one official is currently visible near the unit.",
  "severity": "HIGH",
  "stateId": "seed-state-lagos",
  "senatorialDistrictId": "seed-senatorial-lagos-central",
  "lgaId": "seed-lga-ikeja",
  "wardId": "seed-ward-ikeja-ward-a",
  "pollingUnitId": "seed-pu-ikeja-001",
  "latitude": 6.6018,
  "longitude": 3.3515
}
```

Reward redemption example:

```json
{
  "pointsRequested": 25,
  "amountRequested": 2500,
  "note": "Starter payout request"
}
```

## Starter web flows

- `/login`
  - voter login
  - voter dashboard shows reward totals, available balance, redemption flow, history, and notifications
- `/admin/login`
  - admin and super admin login
  - admin dashboard shows scoped counts, operational analytics, notifications, redemption previews, candidates, incidents, and feedback
- `/candidate/login`
  - candidate login
  - candidate dashboard shows office type, territory, authored posts, visible feedback/incidents, and notifications
- `/agent/login`
  - agent login
  - agent dashboard shows assigned territory, check-in/check-out controls, location ping form, recent activity, quick incident submission, and notifications
