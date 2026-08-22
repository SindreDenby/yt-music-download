# YouTube Music Authorized Downloader

An unpacked Chrome extension that adds a download button to the YouTube Music player. It sends the current track's player link to a local Python service, converts media to a high-quality MP3, and lets Chrome manage the download.

## Features

- Download button integrated into the YouTube Music player controls.
- Uses the YouTube Music player title link as the single source of the track URL.
- Local-only Python backend powered by `yt-dlp` and FFmpeg.
- High-quality VBR MP3 conversion.
- 500 ms backend health check before starting a conversion.
- Chrome-managed downloads with cleanup after the download completes.

## How It Works

```text
YouTube Music
      |
      | player title link href
      v
Chrome extension
      |
      | POST /download
      v
Local Python server
      |
      | yt-dlp + FFmpeg
      v
MP3 response
      |
      | Chrome download completes
      v
POST /cleanup
```

The extension reads the `href` from this player link:

```css
a.ytp-title-link.yt-uix-sessionlink.ytmusic-player[href]
```

The backend listens only on `127.0.0.1`, so it is not exposed to other devices on the network.

## Requirements

- Google Chrome
- Python 3.10 or newer
- [`uv`](https://docs.astral.sh/uv/)
- FFmpeg available on `PATH`

The extension works on Windows and macOS. The backend uses the same local HTTP address on both platforms.

Verify the required tools on Windows PowerShell or macOS Terminal:

```powershell
uv --version
python --version
ffmpeg -version
```

## Installation

### 1. Install Python dependencies

Open PowerShell or Terminal in the project directory and run:

```powershell
uv sync
```

This creates a local `.venv` environment and installs the locked `yt-dlp` dependency from `uv.lock`.

### 2. Install FFmpeg

On Windows, install FFmpeg using your preferred package manager or installer. On macOS with Homebrew:

```bash
brew install ffmpeg
```

Confirm that FFmpeg is available:

```powershell
ffmpeg -version
```

### 3. Start the local backend

```powershell
uv run downloader-server.py
```

The same command works in macOS Terminal.

Leave this terminal open while using the extension. The server runs at:

```text
http://127.0.0.1:8765
```

### Docker

Build and run the backend with FFmpeg included:

```bash
docker build -t yt-music-downloader .
docker run --rm -p 127.0.0.1:8765:8765 -v yt-music-downloads:/data yt-music-downloader
```

The published port is limited to localhost, matching the native server's local-only behavior. The `/data` volume stores temporary converted files between container restarts.

### 4. Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory. On macOS, this is the folder containing `manifest.json`.
5. Confirm that **YouTube Music Authorized Downloader** loads without errors.

## Usage

1. Open [YouTube Music](https://music.youtube.com).
2. Start a track.
3. Locate the `Download` button in the player controls.
4. Click the button.
5. Wait for Chrome to finish saving the MP3.

Before conversion, the extension requests:

```text
GET /health
```

If the backend is unavailable, the button immediately reports `Backend offline` instead of waiting for a failed conversion request.
