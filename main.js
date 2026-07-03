import GeoTIFF from 'ol/source/GeoTIFF.js';
import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import View from 'ol/View.js';
import { getRenderPixel } from 'ol/render.js';

const envAwsAccessKey = import.meta.env.VITE_AWS_ACCESS_KEY_ID || '';
const envAwsSecretKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '';
const envAwsSessionToken = import.meta.env.VITE_AWS_SESSION_TOKEN || '';
const envAwsRegion = import.meta.env.VITE_AWS_REGION || 'us-east-1';

const geotiff = await fetch('data/img1.tif')
  .then((response) => response.blob())
  .then((blob) => {
    const source = new GeoTIFF({
      normalize: false,
      sources: [
        {
          blob: blob,
          bands: [1, 2, 3]
        }
      ],

    });
    return source;
  });


const geotiff2 = await fetch('data/img2.tif')
  .then((response) => response.blob())
  .then((blob) => {
    const source = new GeoTIFF({
      normalize: false,
      sources: [
        {
          blob: blob,
          bands: [1, 2, 3]
        }
      ],

    });
    console.log(source.getView());
    return source;
  });


const max = 255;
function normalize(value) {
  return ['/', value, max];
}

const red = normalize(['band', 1]);
const green = normalize(['band', 2]);
const blue = normalize(['band', 3]);
const nir = normalize(['band', 3]);

const ndvi = [
  '/',
  ['-', ['band', 2], ['band', 3]],
  ['+', ['band', 2], ['band', 3]],
];
const ndwi = [
  '/',
  ['-', ['band', 2], ['band', 1]],
  ['+', ['band', 2], ['band', 1]],
];

const ndviPaletteViridis = {
  color: [
    'palette',
    [
      'interpolate',
      ['linear'],
      ['/', ['-', blue, red], ['+', blue, red]],
      //  ['/', ['-', nir, red], ['+', nir,red]],
      -0.2,
      0,
      0.65,
      4,
    ],
    ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  ],
};

// build a WebGL style that applies a contrast factor to each band channel
function makeStyle(contrast) {
  // expression to normalize band to [0,1], center to [-0.5,0.5], scale, shift back, then to 0-255
  function channelExpr(bandIndex) {
    return [
      '*',
      [
        '+',
        ['*', ['-', ['/', ['band', bandIndex], 255], 0.5], contrast],
        0.5,
      ],
      255,
    ];
  }
  return {
    color: ['color', channelExpr(1), channelExpr(2), channelExpr(3)]
  };
}

const b1 = ['band', 1];
const b2 = ['band', 2];
const b3 = ['band', 3];

// helper to create layer from a GeoTIFF source
function makeLayer(source, name) {
  return new TileLayer({
    source: source,
    opacity: 1,
    style: makeStyle(1),
    properties: { name: name }
  });
}

const geotiffLayer = makeLayer(geotiff, 'img1.tif');
const geotiffLayer2 = makeLayer(geotiff2, 'img2.tif');

const layerCollection = [geotiffLayer, geotiffLayer2];

const map = new Map({
  target: 'map',
  layers: layerCollection,
  view: geotiff.getView(),
});

console.log(map);

const swipe = document.getElementById('swipe');
const panel = document.getElementById('panel');
const togglePanel = document.getElementById('togglePanel');
const swipeWrapper = document.getElementById('swipeWrapper');

function updateSwipeWidth() {
  if (!swipeWrapper) return;
  if (panel?.classList.contains('collapsed')) {
    swipeWrapper.style.maxWidth = '80vw';
  } else {
    swipeWrapper.style.maxWidth = 'calc((100vw - 450px) * 0.8)';
  }
}

if (togglePanel) {
  togglePanel.addEventListener('click', () => {
    if (!panel) return;
    panel.classList.toggle('collapsed');
    const icon = togglePanel.querySelector('i');
    if (icon) icon.textContent = panel.classList.contains('collapsed') ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left';
    updateSwipeWidth();
    map.updateSize();
  });
}

window.addEventListener('resize', updateSwipeWidth);
updateSwipeWidth();
geotiffLayer2.on('prerender', function (event) {
  const gl = event.context;
  gl.enable(gl.SCISSOR_TEST);

  const mapSize = map.getSize(); // [width, height] in CSS pixels

  // get render coordinates and dimensions given CSS coordinates
  const bottomLeft = getRenderPixel(event, [0, mapSize[1]]);
  const topRight = getRenderPixel(event, [mapSize[0], 0]);

  const width = Math.round((topRight[0] - bottomLeft[0]) * (swipe.value / 100));
  const height = topRight[1] - bottomLeft[1];

  gl.scissor(bottomLeft[0], bottomLeft[1], width, height);
});

geotiffLayer2.on('postrender', function (event) {
  const gl = event.context;
  gl.disable(gl.SCISSOR_TEST);
});

swipe.addEventListener('input', function () {
  map.render();
});

// --- Layer controls, file/url loader ---
const layersListEl = document.getElementById('layers-list');
if (layersListEl) layersListEl.classList.add('collection');

function updateLayersList() {
  layersListEl.innerHTML = '';
  layerCollection.forEach((layer, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.alignItems = 'center';
    div.className = 'collection-item';

    const name = layer.get('properties')?.name || layer.get('name') || `layer-${idx}`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = layer.getVisible();
    cb.className = 'filled-in';
    cb.addEventListener('change', () => { layer.setVisible(cb.checked); });

    const label = document.createElement('span');
    label.textContent = name;

    const op = document.createElement('input');
    op.type = 'range';
    op.min = 0.2; op.max = 3; op.step = 0.01; op.value = 1.0;
    op.title = 'Contrast (0.2 - 3)';
    const valSpan = document.createElement('span');
    valSpan.style.marginLeft = '6px';
    valSpan.textContent = op.value;
    op.addEventListener('input', () => {
      const v = parseFloat(op.value);
      valSpan.textContent = v.toFixed(2);
      layer.setStyle(makeStyle(v));
      map.render();
    });

    div.appendChild(cb);
    div.appendChild(label);
    div.appendChild(op);
    div.appendChild(valSpan);
    layersListEl.appendChild(div);
  });
}

updateLayersList();

function addLayerFromSource(source, name) {
  const layer = makeLayer(source, name || 'layer');
  layerCollection.push(layer);
  map.addLayer(layer);
  updateLayersList();
}

// file input handler
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', (ev) => {
  const files = ev.target.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = async function (evt) {
      const blob = new Blob([evt.target.result]);
      const source = new GeoTIFF({ normalize: false, sources: [{ blob: blob, bands: [1, 2, 3] }] });
      addLayerFromSource(source, file.name);
    };
    reader.readAsArrayBuffer(file);
  }
});

// URL loader
const loadUrlBtn = document.getElementById('loadUrl');
const urlInput = document.getElementById('urlInput');
loadUrlBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const source = new GeoTIFF({ normalize: false, sources: [{ blob: blob, bands: [1, 2, 3] }] });
    addLayerFromSource(source, url.split('/').pop());
  } catch (err) {
    console.error('Failed to load URL', err);
    alert('Failed to load URL: ' + err.message);
  }
});

const loaderLocalRadio = document.getElementById('loaderLocal');
const loaderS3Radio = document.getElementById('loaderS3');
const localLoaderSection = document.getElementById('localLoaderSection');
const s3LoaderSection = document.getElementById('s3LoaderSection');

function updateLoaderMode() {
  if (loaderS3Radio?.checked) {
    localLoaderSection.style.display = 'none';
    s3LoaderSection.style.display = 'block';
  } else {
    localLoaderSection.style.display = 'block';
    s3LoaderSection.style.display = 'none';
  }
}

loaderLocalRadio?.addEventListener('change', updateLoaderMode);
loaderS3Radio?.addEventListener('change', updateLoaderMode);
updateLoaderMode();

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key, msg) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg);
  return new Uint8Array(sig);
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + key), new TextEncoder().encode(dateStamp));
  const kRegion = await hmac(kDate, new TextEncoder().encode(regionName));
  const kService = await hmac(kRegion, new TextEncoder().encode(serviceName));
  const kSigning = await hmac(kService, new TextEncoder().encode('aws4_request'));
  return kSigning;
}

async function buildAwsHeaders(url, region, accessKey, secretKey, sessionToken) {
  const method = 'GET';
  const service = 's3';
  const urlObj = new URL(url);
  const host = urlObj.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]| /g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = toHex(await sha256(''));
  let canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  let signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  if (sessionToken) {
    canonicalHeaders += `x-amz-security-token:${sessionToken}\n`;
    signedHeaders += ';x-amz-security-token';
  }
  const canonicalQueryString = urlObj.searchParams.toString();
  const canonicalRequest = [
    method,
    urlObj.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join('\n');
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = toHex(await hmac(signingKey, new TextEncoder().encode(stringToSign)));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  };
  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }
  return headers;
}

const s3BucketInput = document.getElementById('s3BucketInput');
const s3PrefixInput = document.getElementById('s3PrefixInput');
const listS3Btn = document.getElementById('listS3');
const s3ObjectsSelect = document.getElementById('s3Objects');
const loadS3Btn = document.getElementById('loadS3');

function getS3Host(bucket, region) {
  if (!region || region === 'us-east-1') return `${bucket}.s3.amazonaws.com`;
  return `${bucket}.s3.${region}.amazonaws.com`;
}

async function listS3Objects(bucket, prefix = '', region = envAwsRegion) {
  if (!bucket) throw new Error('Bucket required');
  const host = getS3Host(bucket, region);
  const url = `https://${host}/?list-type=2&prefix=${encodeURIComponent(prefix || '')}&max-keys=1000`;
  const headers = await buildAwsHeaders(url, region, envAwsAccessKey, envAwsSecretKey, envAwsSessionToken);
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`List objects failed ${resp.status}: ${resp.statusText}\n${text}`);
  }
  const xml = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const contents = Array.from(doc.getElementsByTagName('Contents'));
  const keys = contents.map((c) => c.getElementsByTagName('Key')[0].textContent);
  return keys;
}

if (listS3Btn) {
  listS3Btn.addEventListener('click', async () => {
    const bucket = s3BucketInput.value.trim();
    const prefix = s3PrefixInput.value.trim();
    const region = envAwsRegion;
    if (!bucket) {
      alert('Enter bucket name');
      return;
    }
    try {
      s3ObjectsSelect.innerHTML = '<option value="">Loading...</option>';
      const keys = await listS3Objects(bucket, prefix, region);
      if (!keys.length) {
        s3ObjectsSelect.innerHTML = '<option value="">-- no objects --</option>';
        return;
      }
      s3ObjectsSelect.innerHTML = '';
      keys.forEach((k) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        s3ObjectsSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('List S3 failed', err);
      alert('Failed to list objects: ' + err.message);
      s3ObjectsSelect.innerHTML = '<option value="">-- error --</option>';
    }
  });
}

if (loadS3Btn) {
  loadS3Btn.addEventListener('click', async () => {
    const bucket = s3BucketInput.value.trim();
    const region = envAwsRegion;
    const selected = s3ObjectsSelect.value;
    if (!bucket || !selected) {
      alert('Choose a bucket and select an object first');
      return;
    }
    try {
      // encode each segment of key to preserve slashes
      const encodedKey = selected.split('/').map(encodeURIComponent).join('/');
      const host = getS3Host(bucket, region);
      const url = `https://${host}/${encodedKey}`;
      const headers = await buildAwsHeaders(url, region, envAwsAccessKey, envAwsSecretKey, envAwsSessionToken);
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`S3 fetch failed ${resp.status}: ${resp.statusText}\n${txt}`);
      }
      const blob = await resp.blob();
      const source = new GeoTIFF({ normalize: false, sources: [{ blob: blob, bands: [1, 2, 3] }] });
      addLayerFromSource(source, `S3:${selected}`);
    } catch (err) {
      console.error('Failed to load S3 object', err);
      alert('Failed to load S3 object: ' + err.message);
    }
  });
}

// --- Coordinate and pixel readout ---
const coordEl = document.getElementById('coord');
const pixelEl = document.getElementById('pixel');

const mapDiv = document.getElementById('map');
mapDiv.addEventListener('mousemove', (ev) => {
  const canvas = mapDiv.querySelector('canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.round(ev.clientX - rect.left);
  const y = Math.round(ev.clientY - rect.top);
  // removed canvas RGBA sampling — keep pixel placeholder for raw/per-band sampling
  pixelEl.textContent = 'Pixel: -';
  // coordinate
  const pixel = [x, y];
  const coord = map.getCoordinateFromPixel(pixel);
  if (coord) {
    coordEl.textContent = `Coord: ${coord.map(c => c.toFixed(2)).join(', ')}`;
  }
});

// rerun layer list when map layers change
map.getLayers().on('add', updateLayersList);
map.getLayers().on('remove', updateLayersList);

// expose function for debugging
window._addLayerFromUrl = async function (url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const source = new GeoTIFF({ normalize: false, sources: [{ blob: blob, bands: [1, 2, 3] }] });
  addLayerFromSource(source, url.split('/').pop());
}

console.log('UI and loaders initialized');
