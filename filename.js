// Shared by the content script and the popup, so the preview always matches the real result.

const DEFAULT_SETTINGS = {
  prefix: '',
  includeUsername: true,
  includeType: true,
  nameMode: 'full', // 'full' | 'short' | 'custom'
  customName: '',
  suffix: '',
};

// Removes characters Windows and Chrome reject in file names.
function cleanFileStem(text) {
  return text
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 200)
    .trim();
}

function composeFilename(settings, { username, id, isVideo, ext }) {
  let name = id;
  if (settings.nameMode === 'short') name = id.match(/^\d+/)?.[0] || id;
  if (settings.nameMode === 'custom') name = settings.customName;

  const user = settings.includeUsername ? `${username}_` : '';
  const type = settings.includeType ? (isVideo ? 'VID' : 'IMG') : '';
  const stem = cleanFileStem(`${settings.prefix}${user}${type}${name}${settings.suffix}`);

  return `${stem || cleanFileStem(id) || 'instagram'}.${ext}`;
}
