chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'check-backend') {
    checkBackend(message.endpoint)
      .then((available) => sendResponse({ ok: available }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type !== 'download-track') return;

  downloadTrack(message.endpoint, message.track)
    .then((downloadId) => sendResponse({ ok: true, downloadId }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function checkBackend(endpoint) {
  const healthUrl = new URL(endpoint);
  healthUrl.pathname = '/health';
  healthUrl.search = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadTrack(endpoint, track) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track)
  });
  if (!response.ok) throw new Error(`Downloader returned HTTP ${response.status}`);
  const data = bufferToBase64(await response.arrayBuffer());
  const downloadId = await chrome.downloads.download({
    url: `data:audio/mpeg;base64,${data}`,
    filename: `${safeFilename(track.title)}.mp3`,
    saveAs: false
  });
  pendingCleanup.set(downloadId, { endpoint, url: track.url });
  return downloadId;
}

const pendingCleanup = new Map();

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current !== 'complete' && delta.state?.current !== 'interrupted') return;
  const cleanup = pendingCleanup.get(delta.id);
  if (!cleanup) return;
  pendingCleanup.delete(delta.id);
  if (delta.state.current === 'complete') cleanupFiles(cleanup.endpoint, cleanup.url);
});

async function cleanupFiles(endpoint, url) {
  const cleanupUrl = new URL(endpoint);
  cleanupUrl.pathname = '/cleanup';
  cleanupUrl.search = '';
  try {
    await fetch(cleanupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  } catch (error) {
    console.warn('[YouTube Music Downloader] Cleanup failed', error);
  }
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function safeFilename(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) || 'track';
}
