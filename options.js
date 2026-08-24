const DEFAULT_ENDPOINT = 'http://127.0.0.1:8765/download';
const endpoint = document.getElementById('endpoint');
const status = document.getElementById('status');

chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT }, (settings) => {
  endpoint.value = settings.endpoint;
});

document.getElementById('save').addEventListener('click', () => {
  let value;
  try {
    const url = new URL(endpoint.value.trim());
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
