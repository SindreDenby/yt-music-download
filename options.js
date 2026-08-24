const DEFAULT_ENDPOINT = 'http://127.0.0.1:8765';
const endpoint = document.getElementById('endpoint');
const status = document.getElementById('status');

function normalizeEndpoint(value) {
  return value.replace(/\/+$/, '').replace(/\/download$/i, '');
}

chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT }, (settings) => {
  endpoint.value = normalizeEndpoint(settings.endpoint || DEFAULT_ENDPOINT);
});

document.getElementById('save').addEventListener('click', () => {
  let value;
  try {
    const url = new URL(normalizeEndpoint(endpoint.value.trim()));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    value = url.toString().replace(/\/$/, '');
  } catch {
    status.textContent = 'Enter a valid http or https URL.';
    return;
  }
  chrome.storage.sync.set({ endpoint: value }, () => {
    status.textContent = 'Saved.';
    setTimeout(() => { status.textContent = ''; }, 1800);
  });
});
