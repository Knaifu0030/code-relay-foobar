# Task Nexus — Enterprise Task Manager

A full-stack task management application built with **React**, **Vite**, **Node.js**, **Express**, and **MySQL**.

## Features

- **Authentication** — Register & Login with JWT tokens
- **Workspaces** — Organize teams and members
- **Projects** — Group tasks within workspaces with color coding
- **Tasks** — Kanban board and list views with priorities and due dates
- **Analytics** — Dashboard with task statistics and breakdown charts

## Project Structure

```
├── server/             # Node.js + Express backend
│   ├── server.js       # Main server file (all routes)
│   └── package.json
├── client/             # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx                   # Main app with routing
│   │   ├── App.css                   # Global styles
│   │   ├── main.jsx                  # Entry point
│   │   ├── modules/
│   │   │   ├── context/AuthContext.jsx   # Auth state management
│   │   │   ├── Layout.jsx                # App shell (sidebar + nav)
│   │   │   ├── UI/                       # Reusable UI components
│   │   │   └── TaskComponents/           # Legacy task components
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Workspaces.jsx
│   │       ├── Projects.jsx
│   │       └── Tasks.jsx
│   ├── vite.config.js
│   └── package.json
├── database.sql        # MySQL schema
└── README.md           # You are here
```

## Setup Instructions

### Prerequisites

- **Node.js** v16 or higher
- **MySQL** (via XAMPP, WAMP, or standalone)

### 1. Database

1. Start your MySQL server.
2. Import the schema to create the database and tables:
   ```bash
   mysql -u root -p < database.sql
   ```

### 2. Environment

Create a `.env` file in the `server/` directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=task_nexus
PORT=5000
```

Adjust credentials to match your local MySQL setup.

### 3. Backend

```bash
cd server
npm install
npm start
```

The server runs on **http://localhost:5000**

### 4. Frontend

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

The client runs on **http://localhost:3000**

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18, Vite, Axios, React Router, Lucide Icons |
| Backend | Node.js, Express, MySQL2, JSON Web Tokens |
| Database | MySQL with relational schema |
| Styling | Vanilla CSS with glassmorphism design |

## Railway Deploy (Quick)

### Backend service (recommended first)

- Service root: `task-nexus/server`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

Set these env vars in Railway:

```env
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
PORT=5000
JWT_SECRET=change_this_in_prod
CLIENT_ORIGIN=https://your-frontend-domain.com
```

Notes:

- `CLIENT_ORIGIN` supports comma-separated values for multiple frontends.
- If `CLIENT_ORIGIN` is not set, CORS is permissive (useful for initial setup/testing).

### Frontend service

- Service root: `task-nexus/client`
- Build command: `npm install && npm run build`
- Start command: `npm run preview -- --host 0.0.0.0 --port $PORT`

Set this env var:

```env
VITE_API_URL=https://your-backend-domain.up.railway.app/api
```
