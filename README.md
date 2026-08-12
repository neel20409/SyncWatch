# 🎬 SyncWatch — YouTube Watch Party App

A full-stack real-time YouTube watch party application built with **Next.js**, **Socket.io**, and **MongoDB**.

## Features

- 🔐 **Auth**: Sign up / Log in with JWT + bcrypt (stored in MongoDB)
- 🎬 **YouTube Sync**: Paste any YouTube URL, play in perfect sync across all users
- ⚡ **Real-time**: Play, pause, seek — all synced instantly via WebSockets
- 💬 **Live Chat**: Chat while watching
- 👥 **Multiple Users**: See who's in the room
- 🔗 **Room Codes**: Share 8-character room codes with friends

---

## Tech Stack

| Layer        | Tech                        |
|--------------|-----------------------------|
| Frontend     | Next.js 14 (Pages Router)   |
| Realtime     | Socket.io                   |
| Database     | MongoDB + Mongoose           |
| Auth         | JWT + bcryptjs               |
| Styling      | Tailwind CSS                |
| Server       | Custom Node.js + Next.js    |

---

## Getting Started

### 1. Prerequisites
- Node.js 18+
- MongoDB running locally OR a MongoDB Atlas URI

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/yt-watch-party
JWT_SECRET=your-very-secret-key-here
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
yt-watch-party/
├── server.js              # Custom server with Socket.io
├── pages/
│   ├── index.js           # Landing page
│   ├── login.js           # Login
│   ├── signup.js          # Sign up
│   ├── dashboard.js       # Create/join rooms
│   ├── room/[id].js       # Watch party room
│   └── api/
│       ├── auth/
│       │   ├── login.js
│       │   ├── signup.js
│       │   ├── logout.js
│       │   └── me.js
│       └── room/
│           └── create.js
├── components/
│   ├── YouTubePlayer.js   # YouTube IFrame API wrapper
│   └── Chat.js            # Real-time chat component
├── models/
│   ├── User.js            # User schema (Mongoose)
│   └── Room.js            # Room schema (Mongoose)
├── lib/
│   ├── db.js              # MongoDB connection
│   └── auth.js            # JWT helpers
└── styles/
    └── globals.css
```

---

## How Sync Works

1. All users join a Socket.io room identified by the `roomId`
2. The **server** keeps track of: current video, play state, current time, last update timestamp
3. When User A presses **play/pause/seek**, the event is emitted to all others in the room
4. When a new user joins, they receive the current room state (including elapsed time offset) to catch up
5. Seeking is handled via `seekTo` on the YouTube IFrame API

---

## Deploying to Production

### Using MongoDB Atlas
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Replace `MONGODB_URI` in `.env.local` with your Atlas connection string

### Deploying to Render (Recommended)

#### Option A: One-Click / Blueprint Deploy (Easiest)
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Blueprint**.
3. Connect your GitHub repository. Render will automatically detect `render.yaml`.
4. Provide your `MONGODB_URI` from MongoDB Atlas.
5. Click **Apply** to deploy!

#### Option B: Manual Render Web Service Setup
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
3. Connect your `SyncWatch` GitHub repository.
4. Configure service settings:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add Environment Variables under **Advanced**:
   - `MONGODB_URI`: your MongoDB Atlas connection string
   - `JWT_SECRET`: your secret key for JWT signing
   - `NODE_ENV`: `production`
   - `NEXT_PUBLIC_SITE_URL`: `https://your-app-name.onrender.com`
6. Click **Create Web Service**.

### Option C: Decoupled Deploy (Vercel Frontend + Render Backend)
If you deploy the frontend on Vercel and the persistent server (Socket.io) on Render:
- Set `NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com` on Vercel.
- Set `CORS_ORIGIN=https://your-frontend.vercel.app` on Render.

### Environment Variables for Production
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/syncwatch?retryWrites=true&w=majority
JWT_SECRET=a-long-random-secret-string
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://your-app-name.onrender.com
# Optional if hosting backend separately:
# NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
# CORS_ORIGIN=https://your-frontend.vercel.app
```

---

## YouTube API Notes

- Uses the official YouTube IFrame Player API
- Works with any public YouTube video
- Accepts: full URLs (`youtube.com/watch?v=...`), short URLs (`youtu.be/...`), or raw video IDs

---

## Security Notes

- Passwords are hashed with **bcryptjs** (12 rounds)
- JWTs expire in **7 days**
- Tokens stored in **HttpOnly cookies** (XSS protection)
- In production, add `Secure` flag to cookies and use HTTPS
