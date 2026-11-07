(() => {
  'use strict';

  // Public ID of Instagram's web app; its API requires it as a header.
  const IG_APP_ID = '936619743392459';
  const SHORTCODE_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const MIN_MEDIA_SIZE = 200; // px: leaves out avatars and icons
  const BTN_SIZE = 36;
  const BTN_MARGIN = 10;
  const REFRESH_MS = 300;
  const NON_USER_PATHS = new Set([
    'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'direct',
    'accounts', 'about', 'legal', 'developer', 'api',
  ]);

  // ---------- File name ----------

  const lastPathSegment = (url) => new URL(url, location.href).pathname.split('/').pop() || '';

  // CDN URLs end in something like 551695984_1789_6543_n.jpg
  function mediaIdFromUrl(url) {
    return lastPathSegment(url).replace(/\.[^.]*$/, '').replace(/[^\w-]/g, '');
  }

  function extensionFromUrl(url, fallback) {
    const ext = lastPathSegment(url).match(/\.([a-z0-9]{2,5})$/i)?.[1];
    return ext ? ext.toLowerCase() : fallback;
  }

  // Videos have long non-numeric names, so their ID comes from the thumbnail.
  function buildFilename(username, idSourceUrl, downloadUrl, isVideo) {
    const safeUser = username.replace(/[^\w.-]/g, '').replace(/\.+$/, '') || 'instagram';
    const id = mediaIdFromUrl(idSourceUrl) || String(Date.now());
    const ext = extensionFromUrl(downloadUrl, isVideo ? 'mp4' : 'jpg');
    return `${safeUser}_${isVideo ? 'VID' : 'IMG'}${id}.${ext}`;
  }

  // ---------- Finding what's on screen ----------

  function isBigEnough(el) {
    const r = el.getBoundingClientRect();
    return r.width >= MIN_MEDIA_SIZE && r.height >= MIN_MEDIA_SIZE;
  }

  function isBlockedByModal(el, stack) {
    const dialogOnTop = stack[0]?.closest?.('[role="dialog"]');
    if (dialogOnTop && !dialogOnTop.contains(el)) return true;

    return [...document.querySelectorAll('[role="dialog"]')].some((dialog) => {
      const r = dialog.getBoundingClientRect();
      const isLarge = r.width >= innerWidth / 2 && r.height >= innerHeight / 2;
      return isLarge && !dialog.contains(el);
    });
  }

  function visiblePart(el) {
    const r = el.getBoundingClientRect();
    const left = Math.max(r.left, 0);
    const right = Math.min(r.right, innerWidth);
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, innerHeight);
    return right > left && bottom > top ? { left, right, top, bottom } : null;
  }

  // Instagram covers photos with transparent layers, so we check everything under
  // the point. In a carousel, only the visible slide receives the point: the others
  // are clipped by overflow:hidden.
  function mediaAt(x, y) {
    const stack = document
      .elementsFromPoint(x, y)
      .filter((el) => !el.classList.contains('igdl-btn'));

    for (const el of stack) {
      if ((el.tagName !== 'IMG' && el.tagName !== 'VIDEO') || !isBigEnough(el)) continue;
      if (isBlockedByModal(el, stack)) return null;
      // Grid thumbnails link to the post and are usually cropped.
      if (el.closest('a[href*="/p/"], a[href*="/reel/"]')) return null;
      // While a video loads, its still image sits on top: the video is what counts.
      return stack.find((other) => other.tagName === 'VIDEO' && isBigEnough(other)) || el;
    }
    return null;
  }

  // ---------- Posts ----------

  function bestImageUrl(img) {
    let bestUrl = img.currentSrc || img.src;
    let bestWidth = 0;
    const entry = /(\S+)\s+(\d+)w/g;
    for (const [, url, width] of (img.getAttribute('srcset') || '').matchAll(entry)) {
      if (Number(width) > bestWidth) {
        bestWidth = Number(width);
        bestUrl = url;
      }
    }
    return bestUrl;
  }

  function userFromHref(href) {
    const parts = new URL(href, location.href).pathname.split('/').filter(Boolean);
    return parts.length === 1 && !NON_USER_PATHS.has(parts[0]) ? parts[0] : null;
  }

  function usernameForPhoto(img) {
    const fromPostUrl = location.pathname.match(/^\/([^/]+)\/(?:p|reel)\//)?.[1];
    if (fromPostUrl) return fromPostUrl;

    // The first profile link inside a post is always its author.
    const scope = img.closest('article, [role="dialog"], main');
    if (scope) {
      for (const link of scope.querySelectorAll('a[href]')) {
        const user = userFromHref(link.getAttribute('href'));
        if (user) return user;
      }
    }
    return userFromHref(location.pathname) || 'instagram';
  }

  async function downloadPhoto(img) {
    const url = bestImageUrl(img);
    await sendDownload(url, buildFilename(usernameForPhoto(img), url, url, false));
  }

  const shortcodeIn = (path) => path.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/)?.[1];

  function shortcodeForVideo(video) {
    const article = video.closest('article');
    if (article) {
      for (const link of article.querySelectorAll('a[href]')) {
        const code = shortcodeIn(new URL(link.href).pathname);
        if (code) return code;
      }
    }
    return shortcodeIn(location.pathname);
  }

  function mediaPkFromShortcode(code) {
    let pk = 0n;
    for (const char of code) pk = pk * 64n + BigInt(SHORTCODE_ALPHABET.indexOf(char));
    return pk.toString();
  }

  async function fetchPost(code) {
    const res = await fetch(`/api/v1/media/${mediaPkFromShortcode(code)}/info/`, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': IG_APP_ID, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) throw new Error(`Instagram responded with ${res.status}`);
    const post = (await res.json()).items?.[0];
    if (!post) throw new Error('Instagram did not return this post');
    return post;
  }

  // In a carousel with several videos, the one being viewed is recognized by its duration.
  function pickVideo(post, video) {
    if (!post.carousel_media) return post.video_versions?.length ? post : null;
    const videos = post.carousel_media.filter((slide) => slide.video_versions?.length);
    if (videos.length === 1) return videos[0];
    return videos.find((slide) => Math.abs((slide.video_duration ?? 0) - video.duration) < 0.5);
  }

  async function downloadPostVideo(video) {
    const code = shortcodeForVideo(video);
    if (!code) throw new Error('Could not identify this video');

    const post = await fetchPost(code);
    const chosen = pickVideo(post, video);
    if (!chosen) throw new Error('Could not find this video in the post');

    const url = chosen.video_versions[0].url;
    const idSource = chosen.image_versions2?.candidates?.[0]?.url || url;
    const username = post.user?.username || 'instagram';
    await sendDownload(url, buildFilename(username, idSource, url, true));
  }

  // ---------- Stories ----------

  const storiesByPk = new Map();
  const storiesByReel = new Map(); // key: username or "highlight:<id>"

  addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== 'igdl-reels') return;

    for (const reel of e.data.reels) {
      const items = reel.items.map((item) => ({ ...item, username: reel.username }));
      for (const item of items) storiesByPk.set(item.pk, item);

      for (const key of [reel.username, reel.id]) {
        if (!key) continue;
        const incoming = new Set(items.map((item) => item.pk));
        const kept = (storiesByReel.get(key) || []).filter((item) => !incoming.has(item.pk));
        storiesByReel.set(key, [...kept, ...items]);
      }
    }
  });

  function parseStoryPath() {
    const highlight = location.pathname.match(/^\/stories\/highlights\/(\d+)/);
    if (highlight) {
      const mediaId = new URLSearchParams(location.search).get('story_media_id');
      return { reelKey: `highlight:${highlight[1]}`, pk: mediaId?.split('_')[0] };
    }
    const story = location.pathname.match(/^\/stories\/([^/]+)(?:\/(\d+))?/);
    return story ? { reelKey: story[1], username: story[1], pk: story[2] } : null;
  }

  // The viewer also shows neighboring stories in small size; the current one is the largest.
  function currentStoryMedia() {
    let best = null;
    let bestArea = 0;
    for (const el of document.querySelectorAll('video, img')) {
      if (!isBigEnough(el)) continue;
      const part = visiblePart(el);
      const area = part ? (part.right - part.left) * (part.bottom - part.top) : 0;
      // >= because the video comes after its thumbnail and is the same size.
      if (area > 0 && area >= bestArea) {
        best = el;
        bestArea = area;
      }
    }
    return best;
  }

  // The URL usually has the story ID, but the first one opened for each user and
  // highlights don't always: those are identified by what's on screen.
  function findStoryItem(story, media) {
    if (story.pk && storiesByPk.has(story.pk)) return storiesByPk.get(story.pk);

    const items = storiesByReel.get(story.reelKey) || [];
    if (media?.tagName === 'IMG') {
      const shownId = mediaIdFromUrl(bestImageUrl(media));
      return items.find((it) => !it.videoUrl && mediaIdFromUrl(it.imageUrl) === shownId);
    }
    if (media?.tagName === 'VIDEO') {
      return items.find(
        (it) => it.videoUrl && Math.abs((it.duration ?? 0) - media.duration) < 0.5,
      );
    }
    return undefined;
  }

  async function downloadStory() {
    const story = parseStoryPath();
    if (!story) throw new Error('This URL does not look like a story');

    const media = currentStoryMedia();
    const item = findStoryItem(story, media);

    if (item) {
      const url = item.videoUrl || item.imageUrl;
      const username = item.username || story.username || 'instagram';
      await sendDownload(url, buildFilename(username, item.imageUrl, url, Boolean(item.videoUrl)));
      return;
    }
    if (media?.tagName === 'IMG') {
      const url = bestImageUrl(media);
      await sendDownload(url, buildFilename(story.username || 'instagram', url, url, false));
      return;
    }
    throw new Error('No data for this story yet: reload the page and try again');
  }

  // ---------- Downloads and notices ----------

  async function sendDownload(url, filename) {
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: 'download', url, filename });
    } catch {
      throw new Error('The extension was updated: reload the page');
    }
    if (!res?.ok) throw new Error(res?.error || 'Download failed');
    toast(`Downloading ${filename}`);
  }

  let toastTimer;
  function toast(text) {
    let el = document.getElementById('igdl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'igdl-toast';
      document.documentElement.append(el);
    }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3000);
  }

  // ---------- Buttons ----------

  const isStoryPage = () => location.pathname.startsWith('/stories/');

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    if (btn.dataset.busy === 'true') return;
    btn.dataset.busy = 'true';
    try {
      if (isStoryPage()) {
        await downloadStory();
      } else {
        // Looked up now rather than when placing the button: the carousel may have just moved.
        const r = btn.getBoundingClientRect();
        const media = mediaAt(r.left + r.width / 2, r.top + r.height / 2);
        if (!media) throw new Error('Could not find the photo or video');
        if (media.tagName === 'VIDEO') await downloadPostVideo(media);
        else await downloadPhoto(media);
      }
    } catch (err) {
      toast(err.message);
    } finally {
      btn.dataset.busy = 'false';
    }
  }

  let button = null;

  function placeButton(left, top) {
    if (!button) {
      button = document.createElement('button');
      button.className = 'igdl-btn';
      button.type = 'button';
      button.title = 'Download';
      button.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';
      button.addEventListener('click', handleClick);
      document.documentElement.append(button);
    }
    button.style.left = `${Math.max(0, Math.min(left, innerWidth - BTN_SIZE))}px`;
    button.style.top = `${Math.max(0, Math.min(top, innerHeight - BTN_SIZE))}px`;
    button.style.display = 'flex';
  }

  let pointer = null;

  function refreshButton() {
    if (isStoryPage()) {
      // Outside the story, to its right, so it doesn't cover the viewer's controls.
      // Always shown: reaching it means leaving the story, which would end a hover.
      const media = currentStoryMedia();
      if (media) {
        const r = media.getBoundingClientRect();
        placeButton(r.right + BTN_MARGIN, r.top);
        return;
      }
    } else if (pointer) {
      const media = mediaAt(pointer.x, pointer.y);
      const part = media && visiblePart(media);
      if (part) {
        // Top center: the left has the author and the right has the "1/5" counter.
        placeButton((part.left + part.right - BTN_SIZE) / 2, part.top + BTN_MARGIN);
        return;
      }
    }
    if (button) button.style.display = 'none';
  }

  let framePending = false;
  function scheduleRefresh() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      refreshButton();
    });
  }

  document.addEventListener(
    'mousemove',
    (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      scheduleRefresh();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', () => {
    pointer = null;
    scheduleRefresh();
  });
  addEventListener('scroll', scheduleRefresh, { passive: true, capture: true });
  addEventListener('resize', scheduleRefresh, { passive: true });
  // Instagram changes page and slide without notice, so we also re-check often.
  setInterval(refreshButton, REFRESH_MS);
})();
