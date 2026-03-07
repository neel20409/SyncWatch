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

### Using Vercel + Railway (recommended)
1. Push to GitHub
2. Deploy to Vercel (set env vars in Vercel dashboard)
3. **Note**: Socket.io requires a persistent server — use Railway, Render, or a VPS instead of Vercel serverless
4. OR deploy the entire app to **Railway** / **Render** with `npm start`

### Environment Variables for Production
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=a-long-random-secret-string
NODE_ENV=production
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
