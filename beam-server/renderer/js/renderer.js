(function () {
  const $ = (sel) => document.querySelector(sel);

  const statusDot = $('#status-dot');
  const statusHeadline = $('#status-headline');
  const statusAddress = $('#status-address');
  const toggleBtn = $('#toggle-btn');
  const nameInput = $('#name-input');
  const folderList = $('#folder-list');
  const foldersEmpty = $('#folders-empty');
  const errorBanner = $('#error-banner');

  const FOLDER_GLYPH = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
  const CLOSE_GLYPH = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let nameInputFocused = false;
  nameInput.addEventListener('focus', () => { nameInputFocused = true; });
  nameInput.addEventListener('blur', () => {
    nameInputFocused = false;
    window.beam.setFriendlyName(nameInput.value);
  });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

  function render(status) {
    statusDot.classList.toggle('running', status.running);
    statusHeadline.textContent = status.running ? 'Running' : 'Stopped';
    if (!status.running) {
      statusAddress.textContent = 'Your files aren’t reachable while stopped.';
    } else {
      // The IPv6 address is shown only when there is a routable one. The TV
      // can't sweep an IPv6 network to find this server, so on an IPv6-only
      // LAN typing this address is the way in.
      statusAddress.innerHTML = escapeHtml(`${status.localIp}:${status.port}`)
        + (status.localIpv6
          ? `<div class="addr-alt">IPv6: ${escapeHtml(`[${status.localIpv6}]:${status.port}`)}</div>`
          : '');
    }
    toggleBtn.textContent = status.running ? 'Stop' : 'Start';
    toggleBtn.classList.toggle('danger-hover', status.running);

    if (!nameInputFocused) nameInput.value = status.friendlyName;

    folderList.innerHTML = '';
    foldersEmpty.classList.toggle('hidden', status.folders.length > 0);
    status.folders.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'folder-row';
      row.innerHTML = `
        <div class="glyph">${FOLDER_GLYPH}</div>
        <div class="meta">
          <div class="name">${escapeHtml(f.label)}</div>
          <div class="path">${escapeHtml(f.path)}</div>
        </div>
        <button class="remove-btn" title="Stop sharing this folder">${CLOSE_GLYPH}</button>`;
      row.querySelector('.remove-btn').addEventListener('click', () => window.beam.removeFolder(f.path));
      row.querySelector('.meta').addEventListener('dblclick', () => window.beam.revealFolder(f.path));
      folderList.appendChild(row);
    });
  }

  toggleBtn.addEventListener('click', async () => {
    const s = await window.beam.getStatus();
    render(s.running ? await window.beam.stop() : await window.beam.start());
  });

  $('#add-folder-btn').addEventListener('click', async () => {
    render(await window.beam.addFolder());
  });

  window.beam.onStatus(render);
  window.beam.onError((msg) => {
    errorBanner.textContent = msg;
    errorBanner.classList.remove('hidden');
    setTimeout(() => errorBanner.classList.add('hidden'), 6000);
  });

  window.beam.getStatus().then(render);
})();
