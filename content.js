(function () {
  'use strict';

  const BUTTON_ID = 'authorized-download-button';
  const DEFAULT_ENDPOINT = 'http://127.0.0.1:8765/download';
  let endpoint = DEFAULT_ENDPOINT;
  let lastUrl = '';

  chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT }, (settings) => {
    endpoint = settings.endpoint || DEFAULT_ENDPOINT;
    installButton();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.endpoint) {
      endpoint = changes.endpoint.newValue || DEFAULT_ENDPOINT;
    }
  });

  function installButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) return;

    const middleControls = playerBar.querySelector('.middle-controls');
    if (middleControls) {
      insertButton(middleControls);
      return;
    }

    // Fall back to the cover element if YouTube Music changes its controls markup.
    const artwork = playerBar.querySelector('img.image.ytmusic-player-bar') ||
      playerBar.querySelector('#left-controls img') ||
      playerBar.querySelector('.content-info-wrapper img');
    const artworkParent = artwork?.parentElement;
    const title = playerBar.querySelector('.content-info-wrapper .title');
    const target = artworkParent || title || playerBar.querySelector('.content-info-wrapper') || playerBar;
    insertButton(target, artwork);
  }

  function insertButton(target, artwork) {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'authorized-download-button';
    button.type = 'button';
    button.title = 'Download this track (authorized media only)';
    button.setAttribute('aria-label', 'Download this track');
    button.innerHTML = '<span aria-hidden="true">⇩</span><span class="download-label">Download</span>';
    const stopPlayerActivation = (event) => {
      event.stopPropagation();
    };
    button.addEventListener('pointerdown', stopPlayerActivation);
    button.addEventListener('pointerup', stopPlayerActivation);
    button.addEventListener('mousedown', stopPlayerActivation);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      stopPlayerActivation(event);
      downloadCurrentTrack(event);
    });
    target.insertBefore(button, artwork || target.firstChild);
  }

  function getCurrentTrack() {
    const playerLink = findPlayerTitleLink();
    const title = document.querySelector('ytmusic-player-bar .title')?.textContent?.trim() ||
      document.querySelector('ytmusic-player-bar .content-info-wrapper yt-formatted-string')?.textContent?.trim() ||
      'YouTube Music track';
    const artist = document.querySelector('ytmusic-player-bar .byline')?.textContent?.trim() || '';
    return {
      url: playerLink,
      title: artist ? `${title} - ${artist}` : title
    };
  }

  function findPlayerTitleLink() {
    const links = Array.from(document.querySelectorAll(
      'a.ytp-title-link.yt-uix-sessionlink.ytmusic-player[href]'
    ));
    const candidates = links.map((link) => {
      try {
        const url = new URL(link.href, window.location.origin);
        if (url.hostname !== 'music.youtube.com' || url.pathname !== '/watch' || !url.searchParams.has('v')) return null;
        return { href: url.href, visible: link.getClientRects().length > 0 };
      } catch {
        return null;
      }
    }).filter(Boolean);
    return candidates.find((candidate) => candidate.visible)?.href || candidates[0]?.href || '';
  }

  async function downloadCurrentTrack(event) {
    const button = event.currentTarget;
    const track = getCurrentTrack();
    console.info('[YouTube Music Downloader] Download clicked', track);
    if (!track.url || !track.url.includes('music.youtube.com')) {
      showStatus(button, 'Track URL unavailable');
      return;
    }

    button.disabled = true;
    showStatus(button, 'Checking...');
    try {
      console.info('[YouTube Music Downloader] Checking backend', endpoint);
      const health = await chrome.runtime.sendMessage({ type: 'check-backend', endpoint });
      if (!health?.ok) {
        console.warn('[YouTube Music Downloader] Backend health check failed', health);
        showStatus(button, 'Backend offline');
        return;
      }

      showStatus(button, 'Preparing...');
      console.info('[YouTube Music Downloader] Sending download request', track.url);
      const result = await chrome.runtime.sendMessage({
        type: 'download-track',
        endpoint,
        track
      });
      if (!result?.ok) throw new Error(result?.error || 'Downloader request failed');

      showStatus(button, 'Download started');
    } catch (error) {
      console.error('[YouTube Music Downloader]', error);
      showStatus(button, 'Download failed');
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.title = 'Download this track (authorized media only)';
        button.innerHTML = '<span aria-hidden="true">⇩</span><span class="download-label">Download</span>';
      }, 2200);
    }
  }

  function showStatus(button, message) {
    button.textContent = message;
  }

  function safeFilename(value) {
    return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) || 'track';
  }

  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) lastUrl = currentUrl;
    installButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
