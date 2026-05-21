# Audiyo

A self-hosted YouTube audio downloader with automatic metadata tagging, album artwork embedding, and music library organization.

## Features

- **YouTube & YouTube Music Support** - Download audio from videos, playlists, and albums
- **Automatic Metadata Tagging** - Uses beets with MusicBrainz for accurate tags
- **Album Art Embedding** - Fetches and embeds high-quality artwork
- **Multiple Formats** - MP3, Opus, or FLAC output
- **Job Queue** - Submit multiple downloads, track progress
- **Dark Mode** - Modern UI with light/dark theme support
- **Non-AVX Compatible** - Runs on older CPUs without AVX support
- **Library Ready** - Output works with Navidrome, Jellyfin, Plex, etc.

## Quick Start

### Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/wyatts97/audiyo.git
cd audiyo

# Start with Docker Compose
docker-compose up -d

# Access the UI
open http://localhost:3000
```

### Manual Installation

#### Prerequisites

- Node.js 18+
- Python 3.9+
- FFmpeg
- yt-dlp
- beets

#### Install Dependencies

```bash
# Install Python dependencies (yt-dlp, beets, and plugins)
pip install -r requirements.txt

# Install frontend dependencies
cd app/frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

#### Configure Environment

```bash
# Backend
cp app/backend/.env.example app/backend/.env
# Edit .env with your settings

# Frontend
cp app/frontend/.env.example app/frontend/.env
# Edit .env with your settings
```

#### Start Services

```bash
# Terminal 1 - Backend
cd app/backend
npm run dev

# Terminal 2 - Frontend
cd app/frontend
npm run dev

# Access the UI
open http://localhost:3000
```

## Configuration

### Environment Variables

#### Backend (`app/backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend API port | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `DATA_DIR` | Base data directory | `./data` |
| `LIBRARY_DIR` | Final music library path | `./data/library` |
| `YT_DLP_PATH` | Path to yt-dlp binary | `yt-dlp` |
| `BEETS_PATH` | Path to beet binary | `beet` |
| `BEETS_CONFIG` | Path to beets config | `./config/beets.yaml` |

#### Frontend (`app/frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | `http://localhost:3001` |

### Beets Configuration

The default `config/beets.yaml` is configured for:
- Automatic tagging with MusicBrainz
- Album art fetching and embedding
- Organized folder structure: `Artist/Album/Track Title`
- Last.fm genre tagging

Customize the config to match your preferences. See the [beets documentation](https://beets.readthedocs.io/) for options.

## Directory Structure

```
/data
  /incoming      # yt-dlp downloads (temporary)
  /processing    # beets working directory (temporary)
  /library       # Final tagged music files
```

## Usage

1. Open the web UI at `http://localhost:3000`
2. Paste a YouTube or YouTube Music URL
3. Select output format (MP3, Opus, or FLAC)
4. Click Download
5. Monitor job progress in the queue
6. Files appear in your library directory when complete

### Supported URLs

- Single videos: `https://www.youtube.com/watch?v=...`
- Playlists: `https://www.youtube.com/playlist?list=...`
- YouTube Music albums: `https://music.youtube.com/playlist?list=...`
- YouTube Music songs: `https://music.youtube.com/watch?v=...`

## Job States

| State | Description |
|-------|-------------|
| `QUEUED` | Waiting to be processed |
| `DOWNLOADING` | yt-dlp is downloading audio |
| `TAGGING` | beets is tagging and organizing |
| `COMPLETED` | Successfully processed |
| `FAILED` | Error occurred (check logs) |

## Troubleshooting

### yt-dlp errors

Update yt-dlp to the latest version:
```bash
pip install -U yt-dlp
```

### Beets tagging failures

- Check the job logs for match confidence issues
- Some releases may not be in MusicBrainz
- Files are still saved to library even if tagging fails

### FFmpeg issues

Ensure FFmpeg is installed and in PATH:
```bash
ffmpeg -version
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/:id` | Get job details |
| `POST` | `/api/jobs` | Create new job |
| `DELETE` | `/api/jobs/:id` | Delete job |
| `POST` | `/api/jobs/:id/retry` | Retry failed job |
| `GET` | `/api/health` | Health check |

## Tech Stack

- **Frontend**: Next.js 14, Shadcn UI, Tailwind CSS
- **Backend**: Node.js, Express, SQLite
- **Download**: yt-dlp
- **Tagging**: beets, MusicBrainz
- **Container**: Docker

## Python Dependencies

All Python dependencies are listed in `requirements.txt`:
- **yt-dlp** - YouTube audio extraction
- **beets** - Music tagging and organization
- **pylast** - Last.fm integration for genre tagging
- **pyacoustid** - Audio fingerprinting
- **requests** - HTTP client for API calls

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
