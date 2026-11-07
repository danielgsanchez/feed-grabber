# Feed Grabber

A small Chrome extension for saving Instagram media you are viewing.

- **Posts:** hover over a photo or video and click the button at the top center. In a carousel, it saves the current slide.
- **Stories:** click the button to the right of the story to save the image or video.
- **File names:** by default, `username_IMG123456789_1789_6543_n.jpg` for images and `username_VID987654321_1789_6543_n.mp4` for videos, using the file's full name on Instagram. Click the extension's icon to change the prefix, suffix and name, or to leave out the username or the IMG / VID tag.

## Install

1. Download [feed-grabber.zip](https://github.com/danielgsanchez/feed-grabber/releases/latest/download/feed-grabber.zip) and unzip it somewhere you'll keep it, because Chrome loads the extension from that folder.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `feed-grabber` folder.
4. Reload any open Instagram tab.

To update, replace the folder with the one from the latest ZIP, click the reload icon on the extension's card and reload Instagram.

## Install as a userscript

1. Install a script manager such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/). Greasemonkey is not supported. In Chrome, the manager may ask you to turn on Developer mode or allow user scripts.
2. Open [feed-grabber.user.js](https://raw.githubusercontent.com/danielgsanchez/feed-grabber/main/feed-grabber.user.js) and confirm the installation.
3. Reload any open Instagram tab.

To change the file name, open the script manager's menu on Instagram and choose **File name options**. The manager updates the script automatically.

`feed-grabber.user.js` is generated from the extension's files. After changing them, run:

```bash
powershell -ExecutionPolicy Bypass -File userscript/build.ps1
```

## Releases

To publish a new version, change `version` in `manifest.json`, run `userscript/build.ps1` and push to `main`. A GitHub Actions workflow then creates the release and its ZIP. It fails if `feed-grabber.user.js` is out of date.

Pushing a new version also updates the userscript for everyone, since script managers read it directly from `main`.

## How it works

- `content.js` places the button and works out which photo or video is on screen.
- `page-hook.js` reads the story data Instagram's own page receives, because story videos are blob URLs that can't be downloaded directly.
- `background.js` saves the files using `chrome.downloads`.

The extension only runs on `www.instagram.com` and only asks for the `downloads` permission. It sends nothing to any server other than Instagram and its CDN.

It relies on Instagram's current page structure and private web API, so it can stop working whenever Instagram changes them.

## Disclaimer

This is an unofficial personal project, not affiliated with or endorsed by Instagram or Meta. Only download content you have the right to save, and respect other people's rights and Instagram's terms.
