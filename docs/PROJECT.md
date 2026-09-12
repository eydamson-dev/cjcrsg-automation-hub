# PROJECT.md

# Self-Hosted Facebook Publishing Platform

## 1. Project Summary

Build a self-hosted social-media publishing platform for a Facebook Page, with a custom administration dashboard and n8n handling automation/orchestration.

The system will initially support two post types:

1. Bible verse posts
2. Image + caption posts

The entire system will be self-hosted on the user's Proxmox server, including the custom admin dashboard and n8n.

The intended separation of responsibilities is:

- **Custom dashboard**: content management, scheduling, preview, approval, and status management.
- **Application backend**: application API, business logic, authentication, persistence, and integration coordination.
- **PostgreSQL**: application source of truth.
- **Local filesystem storage**: media/assets for v1.
- **n8n**: automation/orchestration and asynchronous publishing jobs.
- **Canva Pro**: design creation/export.
- **Meta/Facebook Graph API**: Facebook Page publishing.
- **Proxmox + Docker**: self-hosting infrastructure.

The system should be designed so that individual integrations can be replaced later without requiring a complete rewrite.

---

## 2. Explicitly Decided Requirements

### 2.1 Hosting

- The whole project will be self-hosted.
- Hosting environment: **Proxmox server**.
- n8n will be self-hosted.
- The custom administration dashboard will also be self-hosted.
- Docker will be used for the deployment.

### 2.2 Social platform

Initial target:

- **Facebook Page**

Publishing must use an API-based approach, not browser automation.

The intended integration is the **Meta Graph API**.

The application should treat Facebook as a provider behind an integration boundary so additional platforms can be added later without changing the core post model.

### 2.3 Canva

The selected Canva plan is:

- **Canva Pro**

Canva is responsible for the visual/design side of the publishing process.

The architecture must **not require Canva Autofill**, because Autofill is a Canva Enterprise capability and the selected plan is Canva Pro.

The system should instead isolate Canva-specific operations behind an application integration/service abstraction so a future Enterprise Autofill implementation could be added without redesigning the core application.

### 2.4 Initial content types

The first release must support:

#### Bible verse posts

Data discussed for this type:

- Bible translation/version
- Book
- Chapter
- Starting verse
- Ending verse
- Verse text
- Caption
- Hashtags
- Canva template
- Schedule

The Bible verse text should be treated as source content. AI must not silently rewrite or alter the actual scripture text.

AI may later assist with captions, reflections, or hashtags, but AI content generation is **not required for v1**.

#### Image + caption posts

Data discussed for this type:

- Source image
- Caption
- Canva template
- Schedule

### 2.5 Custom dashboard

The user wants a custom self-hosted administration dashboard rather than using n8n as the content-management UI.

The dashboard should manage the lifecycle of posts and should be the main interface for:

- creating posts
- editing posts
- saving drafts
- previewing posts
- approving posts
- scheduling posts
- publishing immediately
- cancelling scheduled posts
- retrying failed posts
- viewing status/history

A calendar/content-planning view is part of the discussed UI design.

### 2.6 Storage

**MinIO is not required for v1.**

The decided v1 storage approach is a dedicated local filesystem directory on the self-hosted environment.

The application should store media outside the PostgreSQL database.

The database should store metadata and a storage key/path, not the image binary itself.

The storage implementation should be abstracted so MinIO/S3-compatible storage can be introduced later without changing the database model or application-level storage API.

### 2.7 PostgreSQL

PostgreSQL is the intended application database.

n8n may use its own database storage, but the application and n8n must not share application tables.

The application's PostgreSQL schema is the source of truth for post state.

### 2.8 n8n's role

n8n should be treated as the automation/job engine, not as the application's primary database or CMS.

n8n is responsible for workflows such as:

- design generation/processing
- Canva export
- Facebook publishing
- retry handling
- scheduled execution

The dashboard/application remains authoritative for post metadata and state.

---

# 3. Architecture Decisions

## 3.1 High-level architecture

```text
                         Internet
                            |
                            v
                    +---------------+
                    | Cloudflare     |
                    | / DNS / proxy  |
                    +-------+-------+
                            |
                            v
                    +---------------+
                    | Reverse Proxy  |
                    | (Caddy or TBD) |
                    +-------+-------+
                            |
             +--------------+--------------+
             |                             |
             v                             v
     +---------------+             +---------------+
     | Next.js       |             | n8n           |
     | Dashboard     |             | Automation    |
     +-------+-------+             +-------+-------+
             |                             |
             v                             |
     +---------------+                    |
     | Application   |<-------------------+
     | Backend/API   |
     +-------+-------+
             |
      +------+----------+
      |                 |
      v                 v
+-------------+   +----------------------+
| PostgreSQL  |   | Local Filesystem     |
| App DB      |   | /data/social-manager |
+-------------+   +----------------------+

n8n -> Canva
n8n -> Meta Graph API -> Facebook Page
```

### Responsibility boundaries

#### Dashboard

Owns:

- human-facing UI
- post creation/editing
- scheduling metadata
- approval actions
- status display
- media management

#### Backend/API

Owns:

- authentication
- authorization
- application business rules
- database access
- post state transitions
- asset metadata
- integration abstraction
- communication with n8n

#### PostgreSQL

Owns:

- users
- sessions
- posts
- post-type-specific data
- assets metadata
- Canva templates
- social accounts/pages metadata
- publication records
- publishing job metadata
- audit logs

#### Local filesystem

Owns:

- uploaded images
- generated images
- previews/exports
- temporary files as needed

#### n8n

Owns:

- asynchronous automation
- Canva workflow execution
- publishing workflow execution
- retries
- orchestration between external services

---

# 4. Architecture Constraints

The following constraints were explicitly established:

1. The project is self-hosted on Proxmox.
2. n8n is self-hosted.
3. The admin dashboard is self-hosted.
4. Canva plan is Canva Pro.
5. Canva Enterprise Autofill must not be a v1 dependency.
6. Facebook is the first publishing destination.
7. n8n is not the application's source-of-truth database.
8. PostgreSQL is the application's source of truth.
9. MinIO is not required for v1.
10. Media files are stored on a dedicated local filesystem volume/directory for v1.
11. Media binary data should not be stored in PostgreSQL.
12. Storage should be abstracted behind a storage service so S3/MinIO can be added later.
13. n8n and the application should not share application database tables.
14. Facebook publishing should use an API, not browser automation.
15. The application should support retries and avoid duplicate Facebook posts.
16. Bible verse text should not be silently modified by AI.

---

# 5. Suggested Storage Layout

This was the agreed direction for v1:

```text
/data/social-manager/
├── uploads/
│   ├── original/
│   └── temporary/
├── generated/
│   ├── canva/
│   └── facebook/
├── previews/
└── exports/
```

A dedicated Proxmox storage/dataset/volume is preferred over putting large media directly on the VM's OS/root filesystem.

The exact Proxmox storage implementation is unresolved.

The application should store storage keys such as:

```text
uploads/original/2026/09/abc123.jpg
```

rather than absolute host paths.

Absolute paths must not be persisted as application-level asset identifiers.

Generated filenames should use unique IDs/UUIDs rather than relying on original filenames.

Asset uploads should calculate and persist a checksum (SHA-256 was discussed) so duplicate uploads can potentially be detected.

---

# 6. Storage Abstraction

The application should use a storage service abstraction.

Proposed interface from the design discussion:

```ts
interface StorageService {
  put(
    key: string,
    file: Buffer,
    options?: StoragePutOptions
  ): Promise<StoredObject>;

  get(key: string): Promise<Buffer>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  getPath(key: string): string;
}
```

V1 implementation:

```text
FilesystemStorage
```

Future implementations may include:

```text
S3Storage
MinioStorage
```

Those future providers are not part of v1.

---

# 7. Data Model

The following schema was designed during the discussion. It is a **proposed implementation baseline**, not a claim that every column/enum has been independently finalized by the user. The coding agent must preserve the unresolved items listed later rather than silently making product decisions.

## 7.1 users

```text
users
----------------------------
id UUID PK
name
email UNIQUE
password_hash
role
is_active
last_login_at
created_at
updated_at
```

Roles discussed:

```text
ADMIN
EDITOR
PUBLISHER
VIEWER
```

However, the minimum initial role set was also discussed as:

```text
ADMIN
EDITOR
```

**Unresolved:** final role set.

## 7.2 sessions

```text
sessions
----------------------------
id
user_id
_token_hash_
expires_at
ip_address
user_agent
created_at
```

Authentication direction discussed:

- server-side sessions
- secure HTTP-only cookies
- no application JWT stored in localStorage/sessionStorage

Exact session implementation is not yet finalized.

## 7.3 posts

```text
posts
----------------------------
id UUID PK

type
status

title
caption

scheduled_at
published_at

created_by
updated_by

created_at
updated_at
```

Initial post types:

```text
BIBLE_VERSE
IMAGE
```

Post statuses discussed:

```text
DRAFT
READY
PROCESSING
DESIGN_READY
APPROVED
SCHEDULED
PUBLISHING
PUBLISHED
FAILED
CANCELLED
ARCHIVED
```

These statuses form the proposed state machine:

```text
DRAFT
  -> READY
  -> PROCESSING
  -> DESIGN_READY
  -> APPROVED
  -> SCHEDULED
  -> PUBLISHING
  -> PUBLISHED
```

Failure path:

```text
PUBLISHING -> FAILED -> RETRY -> PUBLISHING
```

The backend should enforce valid transitions rather than allowing arbitrary status changes.

## 7.4 bible_verse_posts

```text
bible_verse_posts
----------------------------
post_id UUID PK/FK

translation
book
chapter
verse_start
verse_end
verse_text
```

## 7.5 assets

```text
assets
----------------------------
id UUID PK

filename
mime_type
size_bytes

storage_provider
storage_key

width
height
sha256

created_by
created_at
```

V1 storage provider value is intended to represent the local filesystem implementation, but the exact enum/string value is unresolved.

## 7.6 post_assets

```text
post_assets
----------------------------
post_id
asset_id
role
sort_order
```

Roles discussed:

```text
SOURCE_IMAGE
GENERATED_IMAGE
PREVIEW
ATTACHMENT
```

## 7.7 canva_templates

```text
canva_templates
----------------------------
id UUID PK

name
type

canva_template_id
canva_design_id

thumbnail_asset_id

active

created_at
updated_at
```

The distinction between Canva template ID and design ID should be validated against the actual Canva API behavior during implementation.

## 7.8 social_accounts

```text
social_accounts
----------------------------
id UUID PK

provider
account_name

access_token_encrypted
refresh_token_encrypted

token_expires_at

metadata JSONB

created_at
updated_at
```

Initial provider:

```text
FACEBOOK
```

## 7.9 social_pages

```text
social_pages
----------------------------
id UUID PK

social_account_id
provider
external_page_id
name
metadata JSONB
is_active
created_at
updated_at
```

The model is intentionally separated from social accounts so one connected provider account can manage multiple Pages.

## 7.10 post_publications

```text
post_publications
----------------------------
id UUID PK

post_id
social_page_id

status

external_post_id
external_url

published_at

error_code
error_message

created_at
updated_at
```

The purpose is to separate an application post from its external publication(s).

This allows a future post to have multiple platform publications.

## 7.11 publishing_jobs

```text
publishing_jobs
----------------------------
id UUID PK

post_id
publication_id

job_type
status

attempts
max_attempts

n8n_execution_id

last_error

started_at
completed_at
created_at
updated_at
```

Job types discussed:

```text
GENERATE_DESIGN
EXPORT_DESIGN
PUBLISH_FACEBOOK
```

Exact job enum is unresolved.

## 7.12 audit_logs

```text
audit_logs
----------------------------
id UUID PK

user_id
action
entity_type
entity_id

metadata JSONB

ip_address
created_at
```

Actions discussed include:

```text
USER_LOGIN
POST_CREATED
POST_UPDATED
POST_APPROVED
POST_SCHEDULED
POST_PUBLISHED
POST_FAILED
POST_RETRIED
CANVA_CONNECTED
FACEBOOK_CONNECTED
TEMPLATE_CREATED
```

This list is illustrative from the architecture discussion and should be finalized during implementation.

---

# 8. API Design

The application API was proposed as:

```text
/api/v1/*
```

This API design is a baseline discussed during architecture planning.

## 8.1 Authentication

```http
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

MFA endpoints were discussed as a future capability:

```http
POST /api/v1/auth/mfa/enable
POST /api/v1/auth/mfa/verify
```

MFA is **not required for the initial implementation**, but should be considered in the authentication design.

## 8.2 Posts

```http
GET    /api/v1/posts
POST   /api/v1/posts

GET    /api/v1/posts/:id
PATCH  /api/v1/posts/:id
DELETE /api/v1/posts/:id

POST   /api/v1/posts/:id/duplicate
POST   /api/v1/posts/:id/approve
POST   /api/v1/posts/:id/schedule
POST   /api/v1/posts/:id/cancel
POST   /api/v1/posts/:id/publish
POST   /api/v1/posts/:id/retry
```

## 8.3 Bible verse posts

```http
POST /api/v1/posts/bible-verse
```

Example payload discussed:

```json
{
  "translation": "KJV",
  "book": "John",
  "chapter": 3,
  "verseStart": 16,
  "verseEnd": 16,
  "templateId": "uuid",
  "caption": "God's love is the foundation of our hope.",
  "scheduledAt": "2026-09-13T08:00:00+08:00"
}
```

This is an illustrative contract from the architecture discussion. The exact Bible source/integration is unresolved.

## 8.4 Assets

```http
POST   /api/v1/assets
GET    /api/v1/assets
GET    /api/v1/assets/:id
DELETE /api/v1/assets/:id
```

An endpoint was also discussed for secure content streaming/preview:

```http
GET /api/v1/assets/:id/content
```

The browser should not receive unrestricted filesystem paths.

## 8.5 Canva

```http
GET  /api/v1/canva/templates
POST /api/v1/posts/:id/design
GET  /api/v1/posts/:id/design
POST /api/v1/posts/:id/design/export
```

These endpoints represent an application-level abstraction. The exact Canva API mapping is unresolved and must be validated against the current Canva API and the selected Canva Pro plan.

## 8.6 Social accounts/pages

```http
GET  /api/v1/social/accounts
POST /api/v1/social/facebook/connect
GET  /api/v1/social/pages
POST /api/v1/posts/:id/publish
```

Meta OAuth permissions and current Graph API requirements are integration details that must be verified during implementation.

## 8.7 Internal/n8n API

The dashboard/backend should expose private internal endpoints for n8n job execution/callbacks.

Examples discussed:

```http
POST /api/v1/internal/jobs/design
POST /api/v1/internal/jobs/publish
```

Internal calls should not rely only on an unauthenticated webhook. A signed request mechanism such as HMAC was proposed.

Example headers discussed:

```text
X-Signature
X-Timestamp
X-Request-Id
```

The exact signing protocol is unresolved.

---

# 9. Idempotency and Publishing Safety

Facebook publishing must be designed to avoid duplicate posts when a request or n8n workflow is retried.

An idempotency mechanism was proposed, for example:

```http
POST /api/v1/posts/:id/publish
Idempotency-Key: <unique-key>
```

The system should persist enough publication/job state to return an existing publication rather than creating a duplicate when the same operation is retried.

Exact idempotency storage/implementation is unresolved.

---

# 10. n8n Workflow Design

n8n should use separate workflows instead of one large workflow.

## 10.1 Design generation workflow

Conceptual flow:

```text
Webhook
  -> Get post from application API
  -> Validate status
  -> Get Canva template
  -> Upload/source asset if needed
  -> Create/process Canva design
  -> Export PNG
  -> Store result in local shared storage
  -> Notify application API
  -> Post becomes DESIGN_READY
```

## 10.2 Facebook publishing workflow

```text
Webhook
  -> Get post
  -> Check idempotency/publication state
  -> Get generated image
  -> Get Facebook credentials
  -> Publish via Meta API
  -> Record external post ID
  -> Notify application API
```

## 10.3 Scheduler workflow

Run periodically (exact interval unresolved) and:

```text
Schedule Trigger
  -> GET application API for due posts
  -> Create publishing job
  -> Execute appropriate workflow
```

## 10.4 Retry workflow

A separate workflow for retryable failures was discussed.

Conceptual schedule/backoff discussed:

```text
Attempt 1 -> immediate
Attempt 2 -> 1 minute
Attempt 3 -> 5 minutes
Attempt 4 -> 30 minutes
Attempt 5 -> manual
```

This is **proposed behavior, not a final requirement**. Exact retry policy remains unresolved.

---

# 11. UI Requirements

## 11.1 Main navigation

The proposed main navigation is:

```text
Dashboard
Posts
Calendar
Media
Templates
Integrations
Settings
```

## 11.2 Dashboard

The dashboard should show at least:

- draft count
- scheduled count
- published count
- failed count
- upcoming posts
- recent publishing activity/status

## 11.3 Posts page

The discussed list/table should support filters such as:

- status
- type
- date
- template
- author
- platform

## 11.4 Calendar

A calendar/content-planning view is part of the intended UI.

Exact calendar library and whether drag-and-drop rescheduling is included in v1 are unresolved.

## 11.5 Post editor

The editor should be type-aware.

Bible verse editor fields discussed:

- translation
- book
- chapter
- verse/range
- verse text
- template
- caption
- schedule

Image post editor fields discussed:

- source image
- caption
- template
- schedule

## 11.6 Preview

The UI should provide a generated post preview before approval/publishing.

The preview should expose actions such as:

- edit
- open Canva
- regenerate
- approve/schedule

Exact Canva deep-link behavior is unresolved.

## 11.7 Media library

A media library should support:

- upload
- preview
- delete
- search
- use an asset in a post
- inspect file metadata

## 11.8 Canva template management

Admin UI should allow templates to be listed and managed.

The discussed fields include:

- template name
- post type
- Canva template ID
- thumbnail
- active/inactive

---

# 12. Authentication and Authorization

## 12.1 Authentication

The direction discussed is:

- email + password
- server-side sessions
- secure HttpOnly cookies
- Secure cookie attribute in HTTPS production
- SameSite protection
- Argon2id for password hashing
- do not store application auth JWTs in localStorage/sessionStorage

The exact framework/library implementation is unresolved.

## 12.2 Authorization

RBAC is required.

Roles discussed:

- ADMIN
- EDITOR
- PUBLISHER
- VIEWER

A smaller initial set of ADMIN and EDITOR was also discussed.

Final role definitions are unresolved.

Proposed responsibilities:

### ADMIN

- user management
- integrations
- templates
- system settings
- all post operations

### EDITOR

- create/edit posts
- upload media
- schedule posts
- view posts

### PUBLISHER

Potentially:

- approve
- schedule
- publish

### VIEWER

Potentially read-only.

These role assignments are proposed, not finalized.

## 12.3 MFA

MFA/TOTP is a production security consideration, especially for admin accounts, but is not required for the first implementation milestone.

---

# 13. External Integration Security

## Facebook

- Facebook credentials/tokens must never be exposed to the frontend.
- Credentials should be stored encrypted at rest by the application.
- Page access should be represented by `social_pages` records.
- Current Meta permission requirements must be verified during implementation.

## Canva

- Canva tokens/credentials must not be exposed to the browser.
- Canva functionality should be isolated behind an integration/service abstraction.
- Canva Pro constraints must be respected; Autofill is not a v1 dependency.

## n8n

- n8n is an internal service.
- Internal callbacks/requests should be authenticated.
- n8n execution IDs should be recorded when available for troubleshooting.

---

# 14. Deployment Baseline

A dedicated Proxmox VM was recommended for the stack.

The previously discussed sizing was approximately:

```text
2-4 vCPU
4-8 GB RAM
60-100 GB OS/application storage
```

These are sizing suggestions, not hard requirements.

The large media storage should preferably be separate from the VM's OS/root disk.

## Services discussed

```text
reverse proxy
nextjs
backend/API
postgres
n8n
```

MinIO is explicitly excluded from v1.

Redis is explicitly excluded from v1 unless later required.

The exact reverse proxy implementation was discussed as Caddy (with Cloudflare in front), but this is not finalized.

## Domains

The deployment examples discussed were conceptually:

```text
https://social.example.com
https://n8n.example.com
```

These are placeholders only. No real domain/hostname has been decided in this conversation.

---

# 15. Repository Structure

A pnpm monorepo was discussed as the preferred structure, based on the user's existing tooling preferences.

Proposed structure:

```text
social-manager/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── config/
│
├── infrastructure/
│   ├── docker/
│   ├── caddy/
│   └── postgres/
│
├── n8n/
│   └── workflows/
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── deployment.md
│
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

This structure is a proposed implementation baseline.

The exact backend framework was **not finalized** in the conversation. AdonisJS was proposed, but the user did not explicitly choose between AdonisJS and NestJS in this conversation. Therefore the coding agent must not treat AdonisJS as a settled requirement without confirmation.

Likewise, the exact Next.js version was not finalized in this conversation.

---

# 16. Backup Requirements / Direction

The system needs backups for:

1. PostgreSQL data
2. Local media storage
3. Application configuration/secrets, handled securely
4. Proxmox VM infrastructure as an additional recovery mechanism

The previously discussed retention example was:

```text
7 daily
4 weekly
3 monthly
```

This is a suggested policy, not finalized.

Proxmox snapshots/backups should not be treated as the only backup mechanism.

---

# 17. Observability / Operations

The dashboard should eventually expose basic system/integration health such as:

```text
Database
Storage
n8n
Canva
Facebook
```

It should also expose useful publishing/job information such as:

- latest successful publication
- failed jobs
- pending jobs
- execution history
- error details

Exact implementation is unresolved.

---

# 18. Explicitly Deferred / Not V1

The following were deliberately identified as things not to build initially:

- Instagram
- TikTok
- YouTube
- advanced analytics dashboard
- AI content generation as a required feature
- automatic Bible verse generation
- mobile application
- multi-tenant architecture
- Kubernetes
- microservices
- Redis unless needed
- automatic Canva template creation
- complex multi-step approval chains

The initial goal is to make **Facebook publishing reliable first**.

---

# 19. Unresolved Questions / Decisions Required Before Implementation

The coding agent must not silently choose answers to these product/architecture questions unless the user gives permission to make reasonable defaults.

## 19.1 Backend framework

Not explicitly decided.

Candidates discussed:

- AdonisJS
- NestJS

## 19.2 Frontend version

Next.js was selected conceptually, but the exact version was not finalized in this conversation.

## 19.3 Exact ORM/database access layer

PostgreSQL was decided, but the final database library/ORM was not explicitly chosen.

## 19.4 Auth library

Session-based authentication was the design direction, but the exact Adonis/Nest auth implementation was not finalized.

## 19.5 Roles

The final production role set is unresolved:

- ADMIN
- EDITOR
- PUBLISHER
- VIEWER

versus the smaller initial ADMIN/EDITOR model.

## 19.6 Bible source

No specific Bible API, database, or licensing source has been selected.

The implementation must not assume a particular Bible API/license.

## 19.7 Canva API workflow for Canva Pro

The architecture intentionally avoids requiring Enterprise Autofill, but the precise Pro-compatible design-generation workflow must be verified during implementation against the current Canva Connect API and account capabilities.

## 19.8 Meta Graph API details

The exact current Graph API version, permissions, OAuth flow, Page token lifecycle, and app-review requirements have not been fixed in this project document.

These must be verified against Meta's current documentation before implementation.

## 19.9 Reverse proxy

Caddy was suggested. The exact production reverse-proxy arrangement is not finalized.

## 19.10 Cloudflare usage

Cloudflare was suggested for DNS/proxying, but the specific use of Cloudflare Tunnel versus another exposure method was not decided.

## 19.11 Proxmox storage implementation

The system should use dedicated storage outside the application OS/root filesystem when practical, but the exact implementation is unresolved:

- ZFS dataset
- dedicated disk
- bind mount
- separate virtual disk
- other Proxmox storage configuration

## 19.12 Scheduler frequency

A periodic n8n scheduler was proposed, but the exact interval was not finalized.

## 19.13 Retry policy

A possible exponential/backoff schedule was discussed, but exact retry counts and delays were not finalized.

## 19.14 Canva preview/edit behavior

The exact behavior of the “Open Canva” action and whether generated designs remain directly editable through a deep link has not been finalized.

## 19.15 Calendar implementation

Calendar support is required conceptually, but the UI library and whether drag-and-drop scheduling is in v1 are unresolved.

## 19.16 AI

AI was discussed as a later capability, but no AI provider/model was selected and it is not required for v1.

---

# 20. Implementation Principles

The coding agent should follow these principles:

1. **Do not turn unresolved questions into hidden assumptions.** Record them clearly and stop at the appropriate boundary when a decision materially affects the implementation.
2. **Keep the dashboard and application database authoritative.** n8n is an executor/orchestrator.
3. **Keep external providers behind service abstractions.** At minimum, Canva, Facebook, and storage should not leak provider-specific details throughout the application.
4. **Make publishing idempotent.** Retries must not create duplicate Facebook posts.
5. **Keep media out of PostgreSQL.** Store media in the dedicated filesystem and metadata in PostgreSQL.
6. **Use unique asset names and storage keys.** Original filenames are metadata, not unique identifiers.
7. **Enforce post state transitions.** Do not allow arbitrary status mutations.
8. **Keep credentials server-side.** Frontend code must never receive raw provider access tokens/secrets.
9. **Design for future storage migration.** Local filesystem is v1; MinIO/S3 can be implemented later through the storage abstraction.
10. **Keep v1 narrow.** Reliable Facebook publishing is the primary goal.

---

# 21. V1 Acceptance Scope

The first usable version should be able to do the following end-to-end:

```text
1. User logs into the custom dashboard.
2. User creates a Bible verse post OR an Image + Caption post.
3. User selects a Canva template.
4. User uploads/selects any required source image.
5. User saves the post.
6. System generates/prepares the design through the Canva integration.
7. User can preview the generated result.
8. User can approve/schedule the post.
9. n8n executes the publishing job.
10. Facebook Page receives the publication through the Meta API.
11. Application records publication status and external post ID.
12. User can see the result in the dashboard.
13. A failed job can be retried without creating an unintended duplicate publication.
```

Everything beyond this should be considered secondary unless explicitly promoted into the v1 scope.

---

# 22. Implementation Status

## Decided

- Self-hosted on Proxmox
- Self-hosted n8n
- Custom self-hosted admin dashboard
- Facebook Page as first destination
- Canva Pro
- Bible verse posts
- Image + caption posts
- PostgreSQL
- n8n as automation/orchestration layer
- Dashboard/backend as application source of truth
- Local filesystem storage for v1
- No MinIO for v1
- Storage abstraction for future MinIO/S3 compatibility
- API-based Facebook publishing
- Media stored outside PostgreSQL
- Separation of application DB from n8n data
- Need for scheduling, preview, approval, retries, and publication tracking

## Proposed but not finalized

- AdonisJS backend
- Next.js exact version
- exact ORM/database library
- exact auth library
- exact RBAC role set
- Caddy as reverse proxy
- Cloudflare configuration
- Proxmox storage implementation
- exact Canva Pro API workflow
- exact Meta Graph API version/permissions
- exact Bible source
- exact scheduler interval
- retry policy
- exact calendar library/behavior
- exact HMAC/internal n8n authentication scheme
- MFA timing/implementation

---

# 23. Agent Guidance

This file is intended to be handed to another coding agent as the project baseline.

Before implementing a choice listed under **Unresolved Questions / Decisions Required Before Implementation**, the agent should either:

- use an explicitly provided decision from the user, or
- clearly identify the choice as an implementation assumption and keep it easy to replace.

The agent should not reinterpret Canva Pro as Canva Enterprise, should not add MinIO to v1 without a concrete requirement, and should not turn n8n into the application's primary datastore.
