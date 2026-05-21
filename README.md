# Audiyo

A self-hosted YouTube audio downloader with automatic metadata tagging, album artwork embedding, and music library management. Runs in a single Docker container with a Next.js frontend and Node.js backend.

## Features

- **YouTube & YouTube Music Support** - Download audio from videos and playlists
- **Automatic Metadata Tagging** - Fetches tags from iTunes API and MusicBrainz, writes them with NodeID3
- **Album Art Embedding** - Downloads and embeds artwork into audio files
- **Multiple Formats** - MP3, Opus, or FLAC output
- **Job Queue** - Submit downloads, track real-time progress via WebSocket
- **Library Management** - Browse, search, play, and edit your downloaded tracks
- **Dark Mode** - Modern UI with light/dark theme support
- **Remote Access** - Designed for VPS deployment; access via your server's public IP

## Quick Start (Docker)

### Prerequisites

- Docker & Docker Compose
- (For VPS) Open firewall ports for the app

### Deploy

```bash
# Clone the repository
git clone https://github.com/wyatts97/audiyo.git
cd audiyo

# Build and start
docker-compose up -d --build

# Open firewall ports (example with UFW)
sudo ufw allow 4872/tcp
sudo ufw allow 4873/tcp
```

### Access

| Service | URL |
|---------|-----|
| Web UI | `http://<your-vps-ip>:4872` |
| Backend API | `http://<your-vps-ip>:4873` |

If running locally:

| Service | URL |
|---------|-----|
| Web UI | `http://localhost:4872` |
| Backend API | `http://localhost:4873` |

### Default Ports

- `4872` — Frontend (Next.js)
- `4873` — Backend API (Express)

To change ports, edit `docker-compose.yml`.

## Manual Installation (Development Only)

#### Prerequisites

- Node.js 20+
- Python 3.11+
- FFmpeg

#### Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd app/frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

#### Start Services

```bash
# Terminal 1 — Backend
cd app/backend
npm run dev

# Terminal 2 — Frontend
cd app/frontend
npm run dev
```

## Configuration

### Environment Variables

Set these in `docker-compose.yml` or `.env` files:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `DATA_DIR` | Base data directory inside container | `/data` |
| `LIBRARY_DIR` | Final music library path | `/data/library` |
| `YT_DLP_PATH` | Path to yt-dlp binary | `yt-dlp` |
| `NEXT_PUBLIC_BACKEND_PORT` | Build-time backend port for WebSocket | `4873` |

### Volumes

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./data` | `/data` | Database, incoming downloads, config |
| `./library` | `/data/library` | Final tagged music files |
| `./config` | `/config` | App configuration files |

You can also set a custom library path via the app's Settings page.

## How Tagging Works

1. **Download** — `yt-dlp` extracts audio from YouTube
2. **Metadata Lookup** — The app queries:
   - **iTunes API** — Primary source for title, artist, album, year, genre, artwork
   - **MusicBrainz** — Fallback if iTunes has no match
3. **Tag Writing** — `node-id3` embeds metadata and artwork into the audio file
4. **File Organization** — The file is renamed to `Artist - Title.ext` and moved to the library

## Directory Structure

```
/data
  /audiyo.db     # SQLite database (jobs, history, settings)
  /incoming      # yt-dlp downloads (temporary)
  /processing    # Working directory (temporary)
  /library       # Final tagged music files
```

## Usage

1. Open the web UI at your server's IP and port
2. Paste a YouTube or YouTube Music URL
3. Select output format (MP3, Opus, or FLAC)
4. Click Download
5. Monitor job progress in real time
6. Files appear in your library when complete

### Supported URLs

- Single videos: `https://www.youtube.com/watch?v=...`
- Playlists: `https://www.youtube.com/playlist?list=...`
- YouTube Music: `https://music.youtube.com/watch?v=...`

## Job States

| State | Description |
|-------|-------------|
| `QUEUED` | Waiting to be processed |
| `DOWNLOADING` | yt-dlp is extracting audio |
| `TAGGING` | Looking up metadata and writing tags |
| `COMPLETED` | Successfully downloaded and tagged |
| `FAILED` | Error occurred (check job logs) |

## Troubleshooting

### Container shows "unhealthy"

Check the backend logs:
```bash
docker logs audiyo
```

Common causes:
- **Port conflict** — Ensure ports `4872` and `4873` are free
- **Permission error** — The `data` and `library` directories must be writable
- **Native module error** — The app is built for Node.js 20; do not mix Node versions

### Downloads complete but files don't appear in library

- Check the job logs in the UI for tagging errors
- Ensure the `library` volume directory exists and is writable
- If the file was already downloaded, you'll get a `409 Conflict` — the URL is in download history

### yt-dlp errors

Update yt-dlp inside the container:
```bash
docker exec audiyo /app/.venv/bin/pip install -U yt-dlp
```

Or rebuild the image to pull the latest version.

### 409 Conflict when retrying a download

The URL is already in the download history. The app prevents duplicate downloads by default. If the original job failed, delete it first and then retry.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/jobs` | List all jobs |
| `POST` | `/api/jobs` | Create new job |
| `DELETE` | `/api/jobs/:id` | Delete job |
| `POST` | `/api/jobs/:id/retry` | Retry failed job |
| `POST` | `/api/jobs/:id/cancel` | Cancel active job |
| `GET` | `/api/library` | List library tracks |
| `GET` | `/api/library/search` | Search library |
| `GET` | `/api/library/stream/:id` | Stream audio file |
| `GET` | `/api/library/artwork/:id` | Get track artwork |
| `GET` | `/api/settings` | Get settings |
| `POST` | `/api/settings` | Update settings |

## Tech Stack

- **Frontend**: Next.js 14 (standalone output), Shadcn UI, Tailwind CSS
- **Backend**: Node.js 20, Express, better-sqlite3, WebSocket
- **Download**: yt-dlp (Python, installed in virtual environment)
- **Metadata**: iTunes API, MusicBrainz API
- **Tagging**: NodeID3
- **Container**: Docker with multi-stage build (Alpine-based)

## Python Dependencies

Installed in a virtual environment inside the container:
- **yt-dlp** — YouTube audio extraction

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
