# Instagram Downloader

A small Chrome extension for saving Instagram media you are viewing.

- **Posts:** hover over a photo or video and click the button at the top center. In a carousel, it saves the current slide.
- **Stories:** click the button to the right of the story to save the image or video.
- **File names:** `username_IMG888345510.jpg` for images and `username_VID885832356.mp4` for videos.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Reload any open Instagram tab.

After changing the code, click the reload icon on the extension's card and reload Instagram.

## How it works

- `content.js` places the button and works out which photo or video is on screen.
- `page-hook.js` reads the story data Instagram's own page receives, because story videos are blob URLs that can't be downloaded directly.
- `background.js` saves the files using `chrome.downloads`.

The extension only runs on `www.instagram.com` and only asks for the `downloads` permission. It sends nothing to any server other than Instagram and its CDN.

It relies on Instagram's current page structure and private web API, so it can stop working whenever Instagram changes them.

## Disclaimer

This is an unofficial personal project, not affiliated with or endorsed by Instagram or Meta. Only download content you have the right to save, and respect other people's rights and Instagram's terms.
