const STORE_KEY = 'fira-portfolio-v1';
const seedData = {
  albums: [
    { id: 'album-identity', name: 'Identitas Visual', description: 'Eksplorasi bentuk, warna, dan karakter untuk sebuah identitas yang terasa dekat.', category: 'Branding', createdAt: '2026-02-12', cover: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=85' },
    { id: 'album-digital', name: 'Ruang Digital', description: 'Ruang-ruang digital yang dirancang agar terasa jernih, ramah, dan mudah digunakan.', category: 'UI/UX', createdAt: '2025-11-04', cover: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85' },
    { id: 'album-campaign', name: 'Cerita & Kampanye', description: 'Kumpulan ide visual untuk menghubungkan orang dan cerita.', category: 'Kampanye', createdAt: '2025-08-20', cover: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1000&q=85' }
  ],
  works: [
    { id: 'work-identity', albumId: 'album-identity', title: 'Warna, bentuk, karakter', description: 'Eksplorasi identitas visual melalui material cetak, warna hangat, dan bentuk yang sederhana.', category: 'Branding', year: 2026, tools: 'Adobe Illustrator, Photoshop', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1200&q=85', featured: true },
    { id: 'work-digital', albumId: 'album-digital', title: 'Ruang untuk ide baru', description: 'Studi arah desain untuk ruang kerja kreatif yang mengutamakan fokus dan kolaborasi.', category: 'UI/UX', year: 2025, tools: 'Figma', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85', featured: true },
    { id: 'work-campaign', albumId: 'album-campaign', title: 'Ruang untuk bertemu', description: 'Konsep kampanye dan pengalaman visual untuk membawa orang bertemu lewat ide.', category: 'Kampanye', year: 2025, tools: 'Adobe Photoshop, Illustrator', image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=85', featured: true }
  ]
};

const byId = (id) => document.getElementById(id);
const readStore = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return saved?.albums && saved?.works ? saved : structuredClone(seedData);
  } catch {
    return structuredClone(seedData);
  }
};
let data = readStore();
let activeCategory = 'all';
let activeAlbum = null;
let activeWorkList = [];
let favorites = new Set(JSON.parse(localStorage.getItem('fira-portfolio-favorites') || '[]'));

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function getAlbum(albumId) {
  return data.albums.find((album) => album.id === albumId);
}

function renderFilters() {
  const categories = [...new Set(data.works.map((work) => work.category).filter(Boolean))].sort();
  if (activeCategory !== 'all' && !categories.includes(activeCategory)) activeCategory = 'all';
  byId('category-filters').innerHTML = ['all', ...categories].map((category) => {
    const label = category === 'all' ? 'Semua' : category;
    return `<button class="filter-button${activeCategory === category ? ' is-active' : ''}" type="button" data-filter="${escapeHtml(category)}" aria-pressed="${activeCategory === category}">${escapeHtml(label)}</button>`;
  }).join('');
}

function renderWorks() {
  renderFilters();
  const selectedAlbum = getAlbum(activeAlbum);
  byId('album-context').hidden = !selectedAlbum;
  byId('album-context').innerHTML = selectedAlbum ? `<span>Album / <strong>${escapeHtml(selectedAlbum.name)}</strong></span><div><button type="button" data-add-to-album="${escapeHtml(selectedAlbum.id)}">+ Tambah karya</button><button type="button" data-clear-album>Semua karya ×</button></div>` : '';
  const query = byId('work-search').value.trim().toLocaleLowerCase('id');
  const sort = byId('work-sort').value;
  let works = data.works.filter((work) => {
    const album = getAlbum(work.albumId);
    const matchesCategory = activeCategory === 'all' || work.category === activeCategory;
    const matchesAlbum = !activeAlbum || work.albumId === activeAlbum;
    const haystack = [work.title, work.description, work.category, work.year, album?.name].join(' ').toLocaleLowerCase('id');
    return matchesCategory && matchesAlbum && haystack.includes(query);
  });
  works.sort((a, b) => sort === 'oldest' ? a.year - b.year : sort === 'title' ? a.title.localeCompare(b.title, 'id') : b.year - a.year);
  byId('visible-count').textContent = String(works.length).padStart(2, '0');
  byId('work-empty').hidden = works.length > 0;
  byId('project-grid').innerHTML = works.map((work, index) => {
    const album = getAlbum(work.albumId);
    return `<article class="project-card reveal is-visible">
      <button class="project-image" type="button" data-view-work="${escapeHtml(work.id)}" aria-label="Lihat ${escapeHtml(work.title)}">
        <img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}" loading="lazy">
        <span class="image-index">${String(index + 1).padStart(2, '0')} / ${escapeHtml(work.year)}</span><span class="image-arrow" aria-hidden="true">↗</span>
        ${work.featured ? '<span class="featured-mark">PILIHAN</span>' : ''}
      </button>
      <div class="project-info"><div><p class="project-type">${escapeHtml(work.category)}${album ? ` · ${escapeHtml(album.name)}` : ''}</p><h3>${escapeHtml(work.title)}</h3></div><button class="favorite-button${favorites.has(work.id) ? ' is-favorite' : ''}" type="button" data-favorite="${escapeHtml(work.id)}" aria-label="${favorites.has(work.id) ? 'Hapus dari' : 'Tambah ke'} favorit">${favorites.has(work.id) ? '♥' : '♡'}</button></div>
    </article>`;
  }).join('');
}

function renderAlbums() {
  byId('album-empty').hidden = data.albums.length > 0;
  byId('album-grid').innerHTML = data.albums.map((album) => {
    const count = data.works.filter((work) => work.albumId === album.id).length;
    const image = album.cover || data.works.find((work) => work.albumId === album.id)?.image || '';
    return `<article class="album-card">
      <button class="album-cover" type="button" data-view-album="${escapeHtml(album.id)}" aria-label="Lihat album ${escapeHtml(album.name)}"><img src="${escapeHtml(image)}" alt="Cover album ${escapeHtml(album.name)}" loading="lazy"><span>${String(count).padStart(2, '0')} KARYA</span></button>
      <div class="album-meta"><p class="project-type">${escapeHtml(album.category)} · ${new Date(`${album.createdAt}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p><h3>${escapeHtml(album.name)}</h3><p>${escapeHtml(album.description || '')}</p></div>
      <div class="album-actions"><button type="button" data-view-album="${escapeHtml(album.id)}">Lihat album ↗</button><button type="button" data-add-to-album="${escapeHtml(album.id)}">+ Karya</button></div>
    </article>`;
  }).join('');
}

function renderDashboard() {
  const categories = new Set(data.works.map((work) => work.category));
  byId('dashboard-stats').innerHTML = `<div><strong>${data.albums.length}</strong><span>Album</span></div><div><strong>${data.works.length}</strong><span>Karya</span></div><div><strong>${categories.size}</strong><span>Kategori</span></div>`;
  byId('dashboard-list').innerHTML = `<h3>Kelola album</h3>${data.albums.map((album) => `<div class="manage-row"><div><strong>${escapeHtml(album.name)}</strong><span>${data.works.filter((work) => work.albumId === album.id).length} karya · ${escapeHtml(album.category)}</span></div><button type="button" data-view-album="${escapeHtml(album.id)}">Lihat</button><button type="button" data-edit-album="${escapeHtml(album.id)}">Edit</button><button class="danger-action" type="button" data-delete-album="${escapeHtml(album.id)}">Hapus</button></div>`).join('') || '<p class="empty-state">Belum ada album.</p>'}<h3>Karya terbaru</h3>${[...data.works].sort((a, b) => b.year - a.year).slice(0, 6).map((work) => `<div class="manage-row"><div><strong>${escapeHtml(work.title)}</strong><span>${escapeHtml(getAlbum(work.albumId)?.name || 'Tanpa album')} · ${escapeHtml(work.year)}</span></div><button type="button" data-view-work="${escapeHtml(work.id)}">Lihat</button><button type="button" data-edit-work="${escapeHtml(work.id)}">Edit</button><button class="danger-action" type="button" data-delete-work="${escapeHtml(work.id)}">Hapus</button></div>`).join('') || '<p class="empty-state">Belum ada karya.</p>'}`;
}

function renderAll() {
  renderWorks();
  renderAlbums();
  renderDashboard();
}

function openAlbumForm(album = null) {
  const form = byId('album-form');
  form.reset();
  form.elements.id.value = album?.id || '';
  form.elements.name.value = album?.name || '';
  form.elements.description.value = album?.description || '';
  form.elements.category.value = album?.category || '';
  byId('album-form-title').textContent = album ? 'Edit album' : 'Album baru';
  byId('album-dialog').showModal();
}

function openWorkForm(work = null, albumId = '') {
  if (!data.albums.length) {
    alert('Buat album terlebih dahulu sebelum menambahkan karya.');
    openAlbumForm();
    return;
  }
  const form = byId('work-form');
  form.reset();
  form.elements.albumId.innerHTML = data.albums.map((album) => `<option value="${escapeHtml(album.id)}">${escapeHtml(album.name)}</option>`).join('');
  form.elements.id.value = work?.id || '';
  form.elements.albumId.value = work?.albumId || albumId || data.albums[0].id;
  form.elements.title.value = work?.title || '';
  form.elements.description.value = work?.description || '';
  form.elements.category.value = work?.category || '';
  form.elements.year.value = work?.year || new Date().getFullYear();
  form.elements.tools.value = work?.tools || '';
  form.elements.projectUrl.value = work?.projectUrl || '';
  form.elements.socialUrl.value = work?.socialUrl || '';
  form.elements.featured.checked = Boolean(work?.featured);
  byId('work-form-title').textContent = work ? 'Edit karya' : 'Karya baru';
  byId('work-dialog').showModal();
}

function readImage(file) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('File yang dipilih bukan gambar yang valid.'));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openWorkDetail(workId, move = 0) {
  const index = activeWorkList.findIndex((work) => work.id === workId);
  let work = data.works.find((item) => item.id === workId);
  if (index >= 0) work = activeWorkList[(index + move + activeWorkList.length) % activeWorkList.length];
  if (!work) return;
  activeWorkList = data.works;
  const album = getAlbum(work.albumId);
  const safeLink = (url, label) => url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : '';
  byId('detail-content').innerHTML = `<button class="icon-close detail-close" type="button" data-close aria-label="Tutup">×</button><div class="detail-image"><img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}"></div><div class="detail-copy"><p class="eyebrow">${escapeHtml(work.category)} · ${escapeHtml(work.year)}</p><h2>${escapeHtml(work.title)}</h2><p>${escapeHtml(work.description || '')}</p><dl><div><dt>Album</dt><dd>${escapeHtml(album?.name || '-')}</dd></div><div><dt>Tahun</dt><dd>${escapeHtml(work.year)}</dd></div><div><dt>Tools</dt><dd>${escapeHtml(work.tools || '-')}</dd></div></dl><div class="detail-links">${safeLink(work.projectUrl, 'Project')}${safeLink(work.socialUrl, 'Link karya')}<button type="button" data-copy-link="${escapeHtml(work.id)}">Salin tautan</button><a href="${escapeHtml(work.image)}" download="${escapeHtml(work.title.replace(/[^a-z0-9-_]+/gi, '-'))}.jpg">Unduh gambar ↓</a></div><div class="detail-nav"><button type="button" data-move-work="-1">← Sebelumnya</button><button type="button" data-move-work="1">Berikutnya →</button></div></div>`;
  byId('detail-dialog').showModal();
}

function showAlbum(albumId) {
  activeAlbum = albumId;
  renderWorks();
  byId('karya').scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.hasAttribute('data-close')) target.closest('dialog').close();
  if (target.dataset.action === 'add-album') openAlbumForm();
  if (target.dataset.action === 'add-work') openWorkForm();
  if (target.id === 'open-dashboard') { renderDashboard(); byId('dashboard-dialog').showModal(); }
  if (target.dataset.filter !== undefined) { activeCategory = target.dataset.filter; renderWorks(); }
  if (target.dataset.viewAlbum) showAlbum(target.dataset.viewAlbum);
  if (target.hasAttribute('data-clear-album')) { activeAlbum = null; renderWorks(); }
  if (target.dataset.addToAlbum) openWorkForm(null, target.dataset.addToAlbum);
  if (target.dataset.viewWork) openWorkDetail(target.dataset.viewWork);
  if (target.dataset.editAlbum) openAlbumForm(getAlbum(target.dataset.editAlbum));
  if (target.dataset.editWork) openWorkForm(data.works.find((work) => work.id === target.dataset.editWork));
  if (target.dataset.deleteAlbum) {
    const album = getAlbum(target.dataset.deleteAlbum);
    if (confirm(`Hapus album "${album.name}" dan seluruh karya di dalamnya?`)) {
      data.albums = data.albums.filter((item) => item.id !== album.id);
      data.works = data.works.filter((work) => work.albumId !== album.id);
      if (activeAlbum === album.id) activeAlbum = null;
      persist(); renderAll();
    }
  }
  if (target.dataset.deleteWork) {
    const work = data.works.find((item) => item.id === target.dataset.deleteWork);
    if (confirm(`Hapus karya "${work.title}"?`)) {
      data.works = data.works.filter((item) => item.id !== work.id);
      favorites.delete(work.id);
      localStorage.setItem('fira-portfolio-favorites', JSON.stringify([...favorites]));
      persist(); renderAll();
    }
  }
  if (target.dataset.favorite) {
    favorites.has(target.dataset.favorite) ? favorites.delete(target.dataset.favorite) : favorites.add(target.dataset.favorite);
    localStorage.setItem('fira-portfolio-favorites', JSON.stringify([...favorites])); renderWorks();
  }
  if (target.dataset.moveWork) {
    const current = byId('detail-content').querySelector('img')?.alt;
    const work = activeWorkList.find((item) => item.title === current);
    if (work) openWorkDetail(work.id, Number(target.dataset.moveWork));
  }
  if (target.dataset.copyLink) {
    const url = new URL(location.href); url.hash = `work-${target.dataset.copyLink}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard tidak tersedia');
      await navigator.clipboard.writeText(url.href);
      target.textContent = 'Tautan tersalin';
    } catch {
      prompt('Salin tautan karya ini:', url.href);
    }
  }
});

byId('album-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const existing = getAlbum(form.elements.id.value);
    const cover = await readImage(form.elements.coverFile.files[0]);
    const album = { id: existing?.id || `album-${crypto.randomUUID()}`, name: form.elements.name.value.trim(), description: form.elements.description.value.trim(), category: form.elements.category.value.trim(), createdAt: existing?.createdAt || new Date().toISOString().slice(0, 10), cover: cover || existing?.cover || '' };
    if (existing) data.albums = data.albums.map((item) => item.id === existing.id ? album : item);
    else data.albums.unshift(album);
    persist(); renderAll(); byId('album-dialog').close();
  } catch (error) { alert(error.message); }
});

byId('work-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const existing = data.works.find((work) => work.id === form.elements.id.value);
    const image = await readImage(form.elements.imageFile.files[0]);
    if (!image && !existing?.image) { alert('Pilih gambar untuk karya ini.'); return; }
    const work = { id: existing?.id || `work-${crypto.randomUUID()}`, albumId: form.elements.albumId.value, title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), category: form.elements.category.value.trim(), year: Number(form.elements.year.value), tools: form.elements.tools.value.trim(), projectUrl: form.elements.projectUrl.value.trim(), socialUrl: form.elements.socialUrl.value.trim(), image: image || existing.image, featured: form.elements.featured.checked };
    if (existing) data.works = data.works.map((item) => item.id === existing.id ? work : item);
    else data.works.unshift(work);
    if (work.albumId && !getAlbum(work.albumId).cover) getAlbum(work.albumId).cover = work.image;
    persist(); renderAll(); byId('work-dialog').close();
  } catch (error) { alert(error.message); }
});

byId('work-search').addEventListener('input', renderWorks);
byId('work-sort').addEventListener('change', renderWorks);
byId('theme-toggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('fira-portfolio-theme', dark ? 'dark' : 'light');
  byId('theme-toggle').setAttribute('aria-label', dark ? 'Aktifkan tema terang' : 'Aktifkan tema gelap');
});
if (localStorage.getItem('fira-portfolio-theme') === 'dark') document.body.classList.add('dark-theme');

const menuToggle = byId('menu-toggle');
const siteNav = byId('site-nav');
menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Buka navigasi' : 'Tutup navigasi');
  siteNav.classList.toggle('is-open', !expanded);
});
siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  siteNav.classList.remove('is-open');
}));
document.querySelectorAll('.app-dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

renderAll();