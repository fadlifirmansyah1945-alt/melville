const video = document.querySelector('#video');
const canvas = document.querySelector('#canvas');
const preview = document.querySelector('#photoPreview');
const frame = document.querySelector('#cameraFrame');
const faceOverlay = document.querySelector('#faceOverlay');
const message = document.querySelector('#cameraMessage');
const status = document.querySelector('#cameraStatus');
const gallery = document.querySelector('#galleryGrid');

const editPanel = document.createElement('section');
editPanel.className = 'edit-preview-panel';
editPanel.style.cssText = [
  'display:none',
  'margin-top:24px',
  'border:1px solid #d9d2c8',
  'padding:16px',
  'background:#f5efe7'
].join(';');

editPanel.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font:11px DM Mono,monospace;color:#79776f">
    <b style="font-weight:500;color:#20211d">EDIT PREVIEW</b>
    <span>latest capture</span>
  </div>
  <img
    id="editPreviewImage"
    alt="Preview foto untuk diedit"
    style="display:block;width:100%;max-height:360px;object-fit:contain;background:#d0c8bd"
  >
  <button id="editPreviewDownload" type="button" style="margin-top:12px;background:#20211d;color:#fff;padding:9px 13px;font:11px DM Mono,monospace">
    ↓ Save this photo
  </button>
`;

document.querySelector('.camera-column').appendChild(editPanel);

const editPreviewImage = document.querySelector('#editPreviewImage');
const editDownloadButton = document.querySelector('#editPreviewDownload');

let stream;
let facingMode = 'user';
let isMirrored = true;
let currentFaceEffect = 'original';
let currentColorFilter = 'original';
let faceLandmarker = null;
let faceLandmarkerPromise = null;
let faceLandmarks = null;
let faceTrackingFrame = 0;
let captures = JSON.parse(localStorage.getItem('posed-captures') || '[]');
let soundOn = true;
let characterImage = null;
let characterPosition = { x: 0.62, y: 0.16 };
let characterScale = 1;
let characterRotation = 0;

const names = {
  original: 'Original',
  cat: 'Cat Face',
  stretch: 'Stretch Face',
  bigEyes: 'Big Eyes',
  wide: 'Wide Face',
  bunny: 'Bunny Face',
  noir: 'Noir',
  vintage: 'Film Club',
  dreamy: 'Dreamy',
  pop: 'Pop',
  cool: 'Cool Blue',
  sepia: 'Sepia',
  fade: 'Fade',
  neon: 'Neon',
  rose: 'Rose Tint',
  matrix: 'Matrix',
  invert: 'Invert',
  contrast: 'High Contrast',
  blur: 'Soft Blur'
};

const filters = {
  original: 'none',
  cat: 'none',
  stretch: 'none',
  bigEyes: 'none',
  wide: 'none',
  bunny: 'none',
  noir: 'grayscale(1) contrast(1.2)',
  vintage: 'sepia(.48) saturate(.85) contrast(.95)',
  dreamy: 'saturate(.8) brightness(1.08) contrast(.9)',
  pop: 'saturate(1.75) contrast(1.15)',
  cool: 'hue-rotate(18deg) saturate(.9) brightness(1.04)',
  sepia: 'sepia(1) saturate(.8) contrast(1.05)',
  fade: 'saturate(.55) brightness(1.12) contrast(.8)',
  neon: 'saturate(2.4) contrast(1.3) hue-rotate(285deg)',
  rose: 'sepia(.18) saturate(1.45) hue-rotate(315deg) brightness(1.04)',
  matrix: 'grayscale(1) contrast(1.7) sepia(1) hue-rotate(55deg) saturate(2)',
  invert: 'invert(1) hue-rotate(180deg)',
  contrast: 'contrast(1.8) saturate(1.2)',
  blur: 'blur(2px) saturate(.85) brightness(1.05)'
};
const faceEffects = new Set(['cat', 'stretch', 'bigEyes', 'wide', 'bunny']);

let editSource = '';
let editEffect = 'original';
let editRotation = 0;
let editScale = 1;

const extraEffects = [
  ['sepia', 'Sepia', 'warm memory', 'linear-gradient(135deg,#6f4937,#e4c08d)'],
  ['fade', 'Fade', 'washed out', 'linear-gradient(135deg,#e6d8c9,#fffaf1)'],
  ['neon', 'Neon', 'electric night', 'linear-gradient(135deg,#f15ae8,#46e9dc)'],
  ['rose', 'Rose Tint', 'pink mood', 'linear-gradient(135deg,#e99aaa,#fff0e8)'],
  ['matrix', 'Matrix', 'green screen', 'linear-gradient(135deg,#071d12,#8bdc79)'],
  ['invert', 'Invert', 'opposite day', 'linear-gradient(135deg,#0b1227,#f6d35d)'],
  ['contrast', 'Contrast', 'sharp focus', 'linear-gradient(135deg,#050505,#fff)'],
  ['blur', 'Soft Blur', 'hazy feeling', 'linear-gradient(135deg,#a6c9ca,#f7d6d5)']
];

extraEffects.forEach(([id, label, note, background]) => {
  const button = document.createElement('button');
  button.className = 'effect-card';
  button.dataset.effect = id;
  button.type = 'button';
  button.innerHTML = `
    <i class="effect-swatch" style="background:${background}"></i>
    <b>${label}</b>
    <small>${note}</small>
  `;
  document.querySelector('#filterGrid').appendChild(button);
});

const editControls = document.createElement('div');
editControls.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;font:10px DM Mono,monospace;color:#79776f';
editControls.innerHTML = `
  <label>
    Effect
    <select id="editEffect" style="display:block;width:100%;margin-top:5px;padding:6px;border:1px solid #d9d2c8;background:#fff;font:10px DM Mono,monospace">
      ${Object.entries(names)
        .filter(([id]) => !faceEffects.has(id))
        .map(([id, label]) => `<option value="${id}">${label}</option>`)
        .join('')}
    </select>
  </label>
  <label>
    Rotate
    <input id="editRotation" type="range" min="-180" max="180" value="0" style="display:block;width:100%;margin-top:10px">
  </label>
  <label style="grid-column:1/-1">
    Zoom
    <input id="editScale" type="range" min="0.7" max="1.4" step="0.05" value="1" style="display:block;width:100%;margin-top:10px">
  </label>
`;

editPanel.insertBefore(editControls, editDownloadButton);

const editEffectSelect = document.querySelector('#editEffect');
const editRotationInput = document.querySelector('#editRotation');
const editScaleInput = document.querySelector('#editScale');

function applyEditPreview() {
  editPreviewImage.style.filter = filters[editEffect] || 'none';
  editPreviewImage.style.transform = `rotate(${editRotation}deg) scale(${editScale})`;
}

editEffectSelect.addEventListener('change', (event) => {
  editEffect = event.target.value;
  applyEditPreview();
});

editRotationInput.addEventListener('input', (event) => {
  editRotation = Number(event.target.value);
  applyEditPreview();
});

editScaleInput.addEventListener('input', (event) => {
  editScale = Number(event.target.value);
  applyEditPreview();
});

const characterPreview = document.createElement('img');
characterPreview.alt = 'Karakter teman foto';
characterPreview.style.cssText = 'display:none;position:absolute;z-index:2;width:34%;object-fit:contain;object-position:top;pointer-events:auto;cursor:grab;filter:drop-shadow(0 5px 5px #0004)';
frame.appendChild(characterPreview);
document.querySelector('.camera-column').style.position = 'relative';

function positionCharacter() {
  characterPreview.style.left = `${characterPosition.x * 100}%`;
  characterPreview.style.top = `${characterPosition.y * 100}%`;
  characterPreview.style.width = `${34 * characterScale}%`;
  characterPreview.style.transform = `rotate(${characterRotation}deg)`;
}

let draggingCharacter = false;
let dragOffset = { x: 0, y: 0 };

characterPreview.addEventListener('pointerdown', (event) => {
  draggingCharacter = true;
  characterPreview.setPointerCapture(event.pointerId);
  characterPreview.style.cursor = 'grabbing';

  const characterRect = characterPreview.getBoundingClientRect();
  dragOffset = {
    x: event.clientX - characterRect.left,
    y: event.clientY - characterRect.top
  };

  event.preventDefault();
});

characterPreview.addEventListener('pointermove', (event) => {
  if (!draggingCharacter) return;

  const frameRect = frame.getBoundingClientRect();
  characterPosition.x = Math.max(
    0,
    Math.min(0.72, (event.clientX - frameRect.left - dragOffset.x) / frameRect.width)
  );
  characterPosition.y = Math.max(
    0,
    Math.min(0.78, (event.clientY - frameRect.top - dragOffset.y) / frameRect.height)
  );

  positionCharacter();
});

characterPreview.addEventListener('pointerup', (event) => {
  draggingCharacter = false;
  characterPreview.releasePointerCapture(event.pointerId);
  characterPreview.style.cursor = 'grab';
});

const characterLabel = document.createElement('label');
characterLabel.htmlFor = 'characterInput';
characterLabel.textContent = '+ Add a character';
characterLabel.title = 'Upload karakter untuk foto bersama';
characterLabel.style.cssText = 'position:absolute;z-index:4;left:14px;bottom:14px;background:#f5efe7ee;padding:6px 9px;font:11px DM Mono,monospace;color:#20211d;cursor:pointer';

const characterInput = document.createElement('input');
characterInput.id = 'characterInput';
characterInput.type = 'file';
characterInput.accept = 'image/*';
characterInput.hidden = true;

const characterRemove = document.createElement('button');
characterRemove.type = 'button';
characterRemove.textContent = 'Remove character';
characterRemove.style.cssText = 'display:none;position:absolute;z-index:4;left:14px;bottom:14px;background:#f5efe7ee;padding:6px 9px;font:10px DM Mono,monospace;color:#20211d;cursor:pointer';
frame.append(characterLabel, characterInput, characterRemove);

const characterSize = document.createElement('label');
characterSize.textContent = 'Size';
characterSize.style.cssText = 'display:none;position:absolute;z-index:4;right:14px;bottom:14px;align-items:center;gap:7px;background:#f5efe7ee;padding:6px 9px;font:10px DM Mono,monospace;color:#20211d';

const characterSizeInput = document.createElement('input');
characterSizeInput.type = 'range';
characterSizeInput.min = '0.5';
characterSizeInput.max = '1.8';
characterSizeInput.step = '0.05';
characterSizeInput.value = '1';
characterSizeInput.setAttribute('aria-label', 'Atur ukuran karakter');
characterSizeInput.style.width = '90px';
characterSize.appendChild(characterSizeInput);
frame.appendChild(characterSize);

characterSizeInput.addEventListener('input', (event) => {
  characterScale = Number(event.target.value);
  positionCharacter();
});

const characterRotate = document.createElement('label');
characterRotate.textContent = 'Rotate';
characterRotate.style.cssText = 'display:none;position:absolute;z-index:4;right:14px;bottom:48px;align-items:center;gap:7px;background:#f5efe7ee;padding:6px 9px;font:10px DM Mono,monospace;color:#20211d';

const characterRotateInput = document.createElement('input');
characterRotateInput.type = 'range';
characterRotateInput.min = '-180';
characterRotateInput.max = '180';
characterRotateInput.step = '1';
characterRotateInput.value = '0';
characterRotateInput.setAttribute('aria-label', 'Putar karakter');
characterRotateInput.style.width = '90px';
characterRotate.appendChild(characterRotateInput);
frame.appendChild(characterRotate);

characterRotateInput.addEventListener('input', (event) => {
  characterRotation = Number(event.target.value);
  positionCharacter();
});

characterInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    characterImage = new Image();
    characterImage.onload = () => {
      characterPreview.src = reader.result;
      characterPreview.style.display = 'block';
      positionCharacter();
      characterLabel.style.display = 'none';
      characterRemove.style.display = 'block';
      characterSize.style.display = 'flex';
      characterRotate.style.display = 'flex';
      toast('Karakter ditambahkan ke frame.');
    };
    characterImage.src = reader.result;
  };

  reader.readAsDataURL(file);
});

characterRemove.addEventListener('click', () => {
  characterImage = null;
  characterPosition = { x: 0.62, y: 0.16 };
  characterScale = 1;
  characterRotation = 0;
  characterSizeInput.value = '1';
  characterRotateInput.value = '0';
  characterRotate.style.display = 'none';
  positionCharacter();
  characterPreview.removeAttribute('src');
  characterPreview.style.display = 'none';
  characterLabel.style.display = 'block';
  characterRemove.style.display = 'none';
  characterInput.value = '';
  toast('Karakter dilepas.');
});

function toast(text) {
  const element = document.querySelector('#toast');
  element.textContent = text;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function render() {
  document.querySelector('#galleryCount').textContent = `(${captures.length})`;

  gallery.innerHTML = captures.length
    ? captures
        .map(
          (capture, index) => `
            <div class="gallery-item">
              <img src="${capture.src}" alt="Capture ${index + 1}">
              <div class="gallery-actions" style="position:absolute;right:8px;top:8px;display:flex;gap:5px">
                <button data-download="${index}" type="button" title="Simpan gambar" style="position:static;width:28px;height:28px;background:#f5efe7ee;border-radius:50%;font-size:17px;line-height:1">↓</button>
                <button data-delete="${index}" type="button" title="Hapus gambar" style="position:static;width:28px;height:28px;background:#f5efe7ee;border-radius:50%;font-size:17px;line-height:1">×</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-gallery"><span>✦</span><p>Your photos will appear here.<br>Go on, make a face.</p></div>';
}

function downloadCapture(index) {
  const capture = captures[index];
  if (!capture) return;

  const link = document.createElement('a');
  link.href = capture.src;
  link.download = `fanibooth-${String(index + 1).padStart(2, '0')}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  toast('Gambar berhasil disimpan.');
}

function showEditPreview(src) {
  editSource = src;
  editEffect = 'original';
  editRotation = 0;
  editScale = 1;

  editPreviewImage.src = src;
  editEffectSelect.value = 'original';
  editRotationInput.value = '0';
  editScaleInput.value = '1';
  applyEditPreview();
  editPanel.style.display = 'block';
}

function saveEditedPreview() {
  if (!editSource) return;

  const image = new Image();
  image.onload = () => {
    const editCanvas = document.createElement('canvas');
    editCanvas.width = image.naturalWidth;
    editCanvas.height = image.naturalHeight;

    const context = editCanvas.getContext('2d');
    context.filter = filters[editEffect] || 'none';
    context.translate(editCanvas.width / 2, editCanvas.height / 2);
    context.rotate(editRotation * Math.PI / 180);
    context.scale(editScale, editScale);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

    const editedSource = editCanvas.toDataURL('image/jpeg', 0.92);

    if (captures.length) {
      captures[0].src = editedSource;
      localStorage.setItem('posed-captures', JSON.stringify(captures));
      render();
    }

    const link = document.createElement('a');
    link.href = editedSource;
    link.download = `fanibooth-edited-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    toast('Foto edit berhasil disimpan.');
  };

  image.src = editSource;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Kamera tidak tersedia, gunakan Upload.');
    return;
  }

  try {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false
    });

    video.srcObject = stream;
    message.classList.add('hidden');
    status.textContent = 'CAMERA LIVE';
    if (faceEffects.has(currentFaceEffect)) {
      ensureFaceLandmarker().then(startFaceTracking).catch(() => {
        toast('Efek wajah tidak dapat dimuat. Periksa koneksi internet.');
      });
    }
  } catch (error) {
    toast('Izin kamera belum diberikan. Gunakan Upload.');
  }
}

async function ensureFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
      );
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      const options = {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1
      };

      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(fileset, options);
      } catch (error) {
        options.baseOptions.delegate = 'CPU';
        faceLandmarker = await FaceLandmarker.createFromOptions(fileset, options);
      }

      return faceLandmarker;
    })();
  }
  return faceLandmarkerPromise;
}

function drawCatFace(context, width, height, landmarks, sourceWidth, sourceHeight, earStyle = 'cat') {
  if (!landmarks?.length || !sourceWidth || !sourceHeight) return;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (width - sourceWidth * scale) / 2;
  const offsetY = (height - sourceHeight * scale) / 2;
  const point = (index) => ({
    x: landmarks[index].x * sourceWidth * scale + offsetX,
    y: landmarks[index].y * sourceHeight * scale + offsetY
  });
  const left = point(234);
  const right = point(454);
  const forehead = point(10);
  const nose = point(1);
  const cheekLeft = point(50);
  const cheekRight = point(280);
  const center = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const faceWidth = Math.hypot(right.x - left.x, right.y - left.y);
  const upLength = Math.hypot(forehead.x - center.x, forehead.y - center.y) || 1;
  const up = { x: (forehead.x - center.x) / upLength, y: (forehead.y - center.y) / upLength };
  const acrossLength = faceWidth || 1;
  const across = { x: (right.x - left.x) / acrossLength, y: (right.y - left.y) / acrossLength };

  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = Math.max(2, faceWidth * 0.025);
  context.strokeStyle = '#3b2027';
  context.fillStyle = '#3b2027';

  for (const side of [-1, 1]) {
    const earHeight = faceWidth * (earStyle === 'bunny' ? 0.45 : 0.32);
    const base = {
      x: center.x + across.x * faceWidth * side * 0.27 + up.x * upLength * 0.82,
      y: center.y + across.y * faceWidth * side * 0.27 + up.y * upLength * 0.82
    };
    const tip = {
      x: center.x + across.x * faceWidth * side * 0.34 + up.x * (upLength + earHeight),
      y: center.y + across.y * faceWidth * side * 0.34 + up.y * (upLength + earHeight)
    };
    const earHalfWidth = faceWidth * (earStyle === 'bunny' ? 0.105 : 0.14);
    const baseLeft = { x: base.x - across.x * earHalfWidth, y: base.y - across.y * earHalfWidth };
    const baseRight = { x: base.x + across.x * earHalfWidth, y: base.y + across.y * earHalfWidth };

    context.beginPath();
    context.moveTo(baseLeft.x, baseLeft.y);
    if (earStyle === 'bunny') {
      const curveOffset = faceWidth * 0.1;
      context.quadraticCurveTo(
        tip.x - across.x * curveOffset,
        tip.y - across.y * curveOffset,
        tip.x,
        tip.y
      );
      context.quadraticCurveTo(
        tip.x + across.x * curveOffset,
        tip.y + across.y * curveOffset,
        baseRight.x,
        baseRight.y
      );
    } else {
      context.lineTo(tip.x, tip.y);
      context.lineTo(baseRight.x, baseRight.y);
    }
    context.closePath();
    context.fill();
    context.stroke();

    const innerTip = {
      x: base.x * 0.2 + tip.x * 0.8,
      y: base.y * 0.2 + tip.y * 0.8
    };
    context.beginPath();
    context.moveTo(base.x - across.x * faceWidth * 0.05, base.y - across.y * faceWidth * 0.05);
    context.lineTo(innerTip.x, innerTip.y);
    context.lineTo(base.x + across.x * faceWidth * 0.05, base.y + across.y * faceWidth * 0.05);
    if (earStyle === 'bunny') {
      context.quadraticCurveTo(base.x, base.y, base.x - across.x * faceWidth * 0.05, base.y - across.y * faceWidth * 0.05);
    }
    context.closePath();
    context.fillStyle = '#e98e9d';
    context.fill();
    context.fillStyle = '#3b2027';
  }

  context.fillStyle = '#e98e9d';
  for (const cheek of [cheekLeft, cheekRight]) {
    context.beginPath();
    context.ellipse(cheek.x, cheek.y, faceWidth * 0.07, faceWidth * 0.035, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = '#d96f83';
  context.beginPath();
  context.moveTo(nose.x - faceWidth * 0.045, nose.y - faceWidth * 0.015);
  context.lineTo(nose.x + faceWidth * 0.045, nose.y - faceWidth * 0.015);
  context.lineTo(nose.x, nose.y + faceWidth * 0.045);
  context.closePath();
  context.fill();

  context.strokeStyle = '#3b2027';
  context.lineWidth = Math.max(1.5, faceWidth * 0.012);
  for (const side of [-1, 1]) {
    for (const offset of [-0.035, 0.035]) {
      context.beginPath();
      context.moveTo(nose.x + side * faceWidth * 0.045, nose.y + faceWidth * 0.025);
      context.lineTo(nose.x + side * faceWidth * 0.29, nose.y + faceWidth * offset);
      context.stroke();
    }
  }

  context.restore();
}

function applyFaceWarp(context, width, height, landmarks, sourceWidth, sourceHeight, effect, mirrored = false) {
  if (!landmarks?.length || !sourceWidth || !sourceHeight) return;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (width - sourceWidth * scale) / 2;
  const offsetY = (height - sourceHeight * scale) / 2;
  const point = (index) => {
    const x = landmarks[index].x * sourceWidth * scale + offsetX;
    return {
      x: mirrored ? width - x : x,
      y: landmarks[index].y * sourceHeight * scale + offsetY
    };
  };
  const left = point(234);
  const right = point(454);
  const forehead = point(10);
  const chin = point(152);
  const faceWidth = Math.hypot(right.x - left.x, right.y - left.y);
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  const centerX = (left.x + right.x) / 2;
  const centerY = (forehead.y + chin.y) / 2;
  const padding = faceWidth * 0.08;
  const regionX = Math.max(0, Math.floor(Math.min(left.x, right.x) - padding));
  const regionY = Math.max(0, Math.floor(forehead.y - padding));
  const regionRight = Math.min(width, Math.ceil(Math.max(left.x, right.x) + padding));
  const regionBottom = Math.min(height, Math.ceil(chin.y + padding));
  const regionWidth = regionRight - regionX;
  const regionHeight = regionBottom - regionY;
  if (regionWidth <= 0 || regionHeight <= 0 || !faceWidth || !faceHeight) return;

  const image = context.getImageData(regionX, regionY, regionWidth, regionHeight);
  const sourcePixels = image.data.slice();
  const eyeCenters = effect === 'bigEyes'
    ? [
        { x: (point(33).x + point(133).x) / 2, y: (point(33).y + point(133).y) / 2 },
        { x: (point(362).x + point(263).x) / 2, y: (point(362).y + point(263).y) / 2 }
      ]
    : [];

  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const outputX = regionX + x;
      const outputY = regionY + y;
      let sourceX = outputX;
      let sourceY = outputY;

      if (effect === 'stretch' || effect === 'wide') {
        const dx = (outputX - centerX) / (faceWidth * 0.52);
        const dy = (outputY - centerY) / (faceHeight * 0.54);
        const radius = dx * dx + dy * dy;
        if (radius < 1) {
          const strength = (1 - radius) ** 2 * 0.8;
          if (effect === 'stretch') {
            sourceY = centerY + (outputY - centerY) / (1 + strength);
          } else {
            sourceX = centerX + (outputX - centerX) / (1 + strength);
          }
        }
      } else if (effect === 'bigEyes') {
        for (const eye of eyeCenters) {
          const dx = (outputX - eye.x) / (faceWidth * 0.14);
          const dy = (outputY - eye.y) / (faceHeight * 0.13);
          const radius = dx * dx + dy * dy;
          if (radius < 1) {
            const strength = (1 - radius) ** 2 * 0.42;
            sourceX = eye.x + (sourceX - eye.x) / (1 + strength);
            sourceY = eye.y + (sourceY - eye.y) / (1 + strength);
          }
        }
      }

      const sourceLocalX = Math.max(0, Math.min(regionWidth - 1, Math.round(sourceX - regionX)));
      const sourceLocalY = Math.max(0, Math.min(regionHeight - 1, Math.round(sourceY - regionY)));
      const targetIndex = (y * regionWidth + x) * 4;
      const sourceIndex = (sourceLocalY * regionWidth + sourceLocalX) * 4;
      image.data[targetIndex] = sourcePixels[sourceIndex];
      image.data[targetIndex + 1] = sourcePixels[sourceIndex + 1];
      image.data[targetIndex + 2] = sourcePixels[sourceIndex + 2];
      image.data[targetIndex + 3] = sourcePixels[sourceIndex + 3];
    }
  }

  context.putImageData(image, regionX, regionY);
}

function clearFaceOverlay() {
  const context = faceOverlay.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, faceOverlay.width, faceOverlay.height);
}

function drawFaceOverlay() {
  const rect = frame.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const targetWidth = Math.round(rect.width * pixelRatio);
  const targetHeight = Math.round(rect.height * pixelRatio);
  if (faceOverlay.width !== targetWidth || faceOverlay.height !== targetHeight) {
    faceOverlay.width = targetWidth;
    faceOverlay.height = targetHeight;
  }
  const context = faceOverlay.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, faceOverlay.width, faceOverlay.height);
  context.filter = filters[currentColorFilter] || 'none';
  if (faceLandmarks && video.videoWidth && ['cat', 'bunny'].includes(currentFaceEffect)) {
    drawCatFace(
      context,
      faceOverlay.width,
      faceOverlay.height,
      faceLandmarks,
      video.videoWidth,
      video.videoHeight,
      currentFaceEffect
    );
  } else if (faceLandmarks && video.videoWidth && ['stretch', 'bigEyes', 'wide'].includes(currentFaceEffect)) {
    const scale = Math.max(faceOverlay.width / video.videoWidth, faceOverlay.height / video.videoHeight);
    const offsetX = (faceOverlay.width - video.videoWidth * scale) / 2;
    const offsetY = (faceOverlay.height - video.videoHeight * scale) / 2;
    context.drawImage(
      video,
      offsetX,
      offsetY,
      video.videoWidth * scale,
      video.videoHeight * scale
    );
    context.filter = 'none';
    applyFaceWarp(
      context,
      faceOverlay.width,
      faceOverlay.height,
      faceLandmarks,
      video.videoWidth,
      video.videoHeight,
      currentFaceEffect
    );
  }
}

function startFaceTracking() {
  if (faceTrackingFrame || !faceEffects.has(currentFaceEffect) || !video.srcObject || !faceLandmarker) return;

  const track = () => {
    if (!faceEffects.has(currentFaceEffect) || !video.srcObject) {
      faceTrackingFrame = 0;
      clearFaceOverlay();
      return;
    }

    if (video.readyState >= 2) {
      const result = faceLandmarker.detectForVideo(video, performance.now());
      faceLandmarks = result.faceLandmarks?.[0] || null;
      drawFaceOverlay();
    }
    faceTrackingFrame = requestAnimationFrame(track);
  };

  track();
}

function updateEffectPresentation() {
  const colorFilter = filters[currentColorFilter] || 'none';
  video.className = preview.className = `effect-${currentFaceEffect} effect-${currentColorFilter}`;
  video.style.filter = preview.style.filter = colorFilter;
  characterPreview.style.filter = colorFilter;
  const activeNames = [currentFaceEffect, currentColorFilter]
    .filter((effect) => effect !== 'original')
    .map((effect) => names[effect]);
  status.textContent = (activeNames.join(' + ') || names.original).toUpperCase();
}

function setEffect(effect, group) {
  const isFaceEffect = group === 'face';
  if (isFaceEffect) {
    currentFaceEffect = effect;
  } else {
    currentColorFilter = effect;
  }

  const grid = document.querySelector(isFaceEffect ? '#faceEffectGrid' : '#filterGrid');
  grid.querySelectorAll('.effect-card').forEach((button) => {
    button.classList.toggle('active', button.dataset.effect === effect);
  });

  updateEffectPresentation();

  if (faceEffects.has(currentFaceEffect)) {
    ensureFaceLandmarker().then(startFaceTracking).catch(() => {
      toast('Efek wajah tidak dapat dimuat. Periksa koneksi internet.');
    });
  } else {
    faceLandmarks = null;
    clearFaceOverlay();
  }
}

function updateMirror() {
  video.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
  preview.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
  faceOverlay.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
  document.querySelector('#flipCamera').setAttribute('aria-label', isMirrored ? 'Matikan mirror' : 'Aktifkan mirror');
}

function source() {
  const sourceImage = video.readyState >= 2 && video.videoWidth ? video : preview;
  if (!sourceImage.srcObject && !sourceImage.src && !video.videoWidth) return '';

  canvas.width = video.videoWidth || preview.naturalWidth || 1000;
  canvas.height = video.videoHeight || preview.naturalHeight || 1000;

  const context = canvas.getContext('2d');
  if (isMirrored) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.filter = getComputedStyle(video).filter;
  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  context.setTransform(1, 0, 0, 1, 0, 0);

  if (['stretch', 'bigEyes', 'wide'].includes(currentFaceEffect) && faceLandmarks) {
    applyFaceWarp(
      context,
      canvas.width,
      canvas.height,
      faceLandmarks,
      sourceImage.videoWidth || sourceImage.naturalWidth,
      sourceImage.videoHeight || sourceImage.naturalHeight,
      currentFaceEffect,
      isMirrored
    );
  }

  if (characterImage) {
    const characterWidth = canvas.width * 0.34 * characterScale;
    const ratio = characterImage.naturalHeight / characterImage.naturalWidth;
    const characterHeight = characterWidth * ratio;
    const characterX = canvas.width * characterPosition.x;
    const characterY = canvas.height * characterPosition.y;

    context.filter = filters[currentColorFilter] || 'none';
    context.save();
    context.translate(characterX + characterWidth / 2, characterY + characterHeight / 2);
    context.rotate(characterRotation * Math.PI / 180);
    context.drawImage(characterImage, -characterWidth / 2, -characterHeight / 2, characterWidth, characterHeight);
    context.restore();
  }

  if (['cat', 'bunny'].includes(currentFaceEffect) && faceLandmarks) {
    const sourceWidth = sourceImage.videoWidth || sourceImage.naturalWidth;
    const sourceHeight = sourceImage.videoHeight || sourceImage.naturalHeight;
    context.save();
    if (isMirrored) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    drawCatFace(context, canvas.width, canvas.height, faceLandmarks, sourceWidth, sourceHeight, currentFaceEffect);
    context.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

function capture() {
  const timer = Number(document.querySelector('#timerSelect').value);
  if (!video.srcObject && !preview.src) {
    toast('Aktifkan kamera atau upload foto dulu.');
    return;
  }

  if (timer) {
    let left = timer;
    status.textContent = `${left}...`;

    const countdown = setInterval(() => {
      left -= 1;
      status.textContent = left ? `${left}...` : 'SAY CHEESE';

      if (!left) {
        clearInterval(countdown);
        take();
      }
    }, 1000);

    return;
  }

  take();
}

function take() {
  const src = source();
  if (!src) return;

  preview.src = src;
  showEditPreview(src);

  const flash = document.querySelector('#flash');
  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');

  captures.unshift({ src, faceEffect: currentFaceEffect, colorFilter: currentColorFilter });
  captures = captures.slice(0, 12);
  localStorage.setItem('posed-captures', JSON.stringify(captures));
  render();
  status.textContent = 'CAPTURED';
  const appliedEffects = [currentFaceEffect, currentColorFilter]
    .filter((effect) => effect !== 'original')
    .map((effect) => names[effect]);
  toast(`${appliedEffects.join(' + ') || names.original} captured.`);
}

function upload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    message.classList.add('hidden');
    take();
  };

  reader.readAsDataURL(file);
}

document.querySelector('#startCamera').onclick = startCamera;
document.querySelector('#shutter').onclick = capture;
document.querySelector('#flipCamera').onclick = () => {
  isMirrored = !isMirrored;
  updateMirror();
};
document.querySelector('#uploadInput').onchange = upload;

const handleEffectClick = (event) => {
  const button = event.target.closest('.effect-card');
  if (button) {
    const group = event.currentTarget.id === 'faceEffectGrid' ? 'face' : 'filter';
    setEffect(button.dataset.effect, group);
  }
};

document.querySelectorAll('#faceEffectGrid, #filterGrid').forEach((grid) => {
  grid.addEventListener('click', handleEffectClick);
});

document.querySelector('#clearGallery').onclick = () => {
  captures = [];
  localStorage.removeItem('posed-captures');
  render();
  toast('Gallery cleared.');
};

gallery.onclick = (event) => {
  const downloadButton = event.target.closest('[data-download]');
  if (downloadButton) {
    downloadCapture(Number(downloadButton.dataset.download));
    return;
  }

  const deleteButton = event.target.closest('[data-delete]');
  if (!deleteButton) return;

  captures.splice(Number(deleteButton.dataset.delete), 1);
  localStorage.setItem('posed-captures', JSON.stringify(captures));
  render();
};

document.querySelector('#soundButton').onclick = (event) => {
  soundOn = !soundOn;
  event.currentTarget.textContent = soundOn ? '♫' : '×♫';
};
document.querySelector('#aboutButton').onclick = () => document.querySelector('#aboutDialog').showModal();
document.querySelector('#closeAbout').onclick = () => document.querySelector('#aboutDialog').close();
editDownloadButton.onclick = saveEditedPreview;

document.onkeydown = (event) => {
  if (event.code === 'Space' && event.target.tagName !== 'SELECT') {
    event.preventDefault();
    capture();
  }
};

updateMirror();
render();