# Project & Task Management System — Frontend

React (Vite + TypeScript) UI for the Project & Task Management System.  
The Django REST API lives in a **separate** backend repository.

## Requirements

- Node.js 20+
- npm 10+
- Running backend API (local default: `http://127.0.0.1:8000`)

## Project structure

```text
frontend/
  src/
    api/                 # Shared HTTP client
    components/          # Shared layout and UI primitives
    config/              # Env and app config
    modules/             # Domain modules (mirrors backend apps / SRS)
      accounts/
      companies/
      organization/
      rbac/
      projects/
      tasks/
      tracking/
      reviews/
      notifications/
      dashboards/
      reports/
      risks/
      system_settings/
      common/
    routes/              # React Router route map
    styles/              # Global styles
    types/               # Shared TypeScript types
  .env.example           # Environment variable template
  .env                   # Local secrets / machine values (do not commit)
  package.json
  vite.config.ts
```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/arjunnexcrest/task-management-system-frontend.git
cd task-management-system-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and edit values for your machine:

```powershell
copy .env.example .env
```

```bash
cp .env.example .env
```

#### `.env` model

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | Django API base URL | `http://127.0.0.1:8000` |
| `VITE_APP_ENV` | Yes | Runtime mode | `development` |
| `VITE_APP_NAME` | No | Display name in the shell | `Project & Task Management System` |

Example file content:

```env
VITE_API_BASE_URL='http://127.0.0.1:8000'
VITE_APP_ENV='development'
VITE_APP_NAME='Project & Task Management System'
```

Never commit the real `.env` file. Only `.env.example` belongs in git.

### 4. Start the development server

```bash
npm run dev
```

App URL (local): `http://127.0.0.1:5173/`

### 5. Production build

```bash
npm run build
npm run preview
```

## Modules (SRS mapping)

| Module | Responsibility |
|---|---|
| `accounts` | Login, password reset, employees |
| `companies` | Multi-company management |
| `organization` | Departments, teams, org chart |
| `rbac` | Roles and permissions |
| `projects` | Projects, planning, milestones, timeline |
| `tasks` | Tasks, kanban, calendar, workload |
| `tracking` | Progress updates and time tracking |
| `reviews` | Review and approval |
| `notifications` | In-app notifications |
| `dashboards` | CEO / role dashboards |
| `reports` | Reports and analytics |
| `risks` | Risks, issues, blockers |
| `system_settings` | Workflow and system settings |
| `common` | Shared helpers and home screen |

Screens and API helpers are intentionally stubbed for other developers to implement.

## Notes

- Frontend stack: React + TypeScript + Vite + React Router
- Backend: Django REST Framework (separate repository)
- SRS / design documents are local-only and ignored by git
