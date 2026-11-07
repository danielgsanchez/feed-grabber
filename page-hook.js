// Runs inside the page itself (world: MAIN) so it can read the responses Instagram
// receives. Story video URLs only appear there: on the page, the <video> is a
// segmented blob: that cannot be downloaded.
(() => {
  'use strict';

  const firstUrl = (versions) => versions?.[0]?.url || null; // ordered from highest to lowest quality

  function findReels(node, found = []) {
    if (!node || typeof node !== 'object') return found;
    if (Array.isArray(node)) {
      for (const child of node) findReels(child, found);
      return found;
    }
    if (Array.isArray(node.items) && node.items[0]?.image_versions2 && node.items[0]?.pk) {
      found.push({
        id: String(node.id ?? ''),
        username: node.user?.username || null,
        items: node.items.map((item) => ({
          pk: String(item.pk),
          videoUrl: firstUrl(item.video_versions),
          imageUrl: firstUrl(item.image_versions2?.candidates),
          duration: item.video_duration ?? null,
        })),
      });
      return found;
    }
    for (const key in node) findReels(node[key], found);
    return found;
  }

  function harvest(text) {
    if (typeof text !== 'string' || !text.includes('image_versions2')) return;
    // Some responses have an anti-hijacking prefix or several JSON documents, one per line.
    for (const line of text.replace(/^for \(;;\);/, '').split('\n')) {
      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      const reels = findReels(data);
      if (reels.length) window.postMessage({ source: 'igdl-reels', reels }, location.origin);
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    response.clone().text().then(harvest).catch(() => {});
    return response;
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      if (this.responseType === '' || this.responseType === 'text') harvest(this.responseText);
    });
    return originalSend.apply(this, args);
  };

  // When a story is opened directly, its data may already be embedded in the HTML.
  addEventListener('DOMContentLoaded', () => {
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      harvest(script.textContent);
    }
  });
})();
