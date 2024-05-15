import GeoTIFF from 'ol/source/GeoTIFF.js';
import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import View from 'ol/View.js';
import {getRenderPixel} from 'ol/render.js';


const geotiff = await fetch('coregistered_proj.tif')
  .then((response) => response.blob())
  .then((blob) => {
    const source = new GeoTIFF({
      normalize: false,
      sources: [
        { blob: blob ,
        bands:[1,2,3,4]}
      ],

    });
    return source;
  });


  const geotiff2 = await fetch('20230724_222439_ssc10_u0002_pansharpened_bbox.tif')
  .then((response) => response.blob())
  .then((blob) => {
    const source = new GeoTIFF({
      normalize: false,
      sources: [
        { blob: blob ,
        bands:[1,2,3,4]}
      ],

    });
    console.log(source.getView());
    return source;
  });


//const source = new GeoTIFF({/
//  sources: [
//    {
//      blob: 'ndvi.tif',
//      //url: 'https://s2downloads.eox.at/demo/Sentinel-2/3857/R10m.tif',
//      bands: [3, 4],
//      min: 0,
//      nodata: 0,
//      max: 65535,
//    },
//    {
//      url: 'https://s2downloads.eox.at/demo/Sentinel-2/3857/R60m.tif',
//      bands: [9],
//      min: 0,
//      nodata: 0,
//      max: 65535,
//    },
//  ],
//});

const max = 255;
function normalize(value) {
  return ['/', value, max];
}

const red = normalize(['band', 1]);
const green = normalize(['band', 2]);
const blue = normalize(['band', 3]);
const nir = normalize(['band', 4]);

const ndvi = [
  '/',
  ['-', ['band', 2], ['band', 3]],
  ['+', ['band', 2], ['band', 3]],
];
const ndwi = [
  '/',
  ['-', ['band', 2], ['band', 1]],
  ['+', ['band',2], ['band', 1]],
];

const ndviPaletteViridis = {
  color: [
    'palette',
    [
      'interpolate',
      ['linear'],
      ['/', ['-', nir, red], ['+', nir,red]],
      -0.2,
      0,
      0.65,
      4,
    ],
    ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  ],
};

const rgb = {         color: [
  'color',
  // red: | NDVI - NDWI |

  ['*', 255, ['abs', ['-', ndvi, ndwi]]],
  // green: NDVI

  ['*',255,ndvi],
  // blue: NDWI
  ['*', 255, ndwi],
  //['*',340,b3],
  // alpha
//  ['band', 4],
]}

const b1=['band',1];
const b2=['band',2];
const b3=['band',3];

const geotiffLayer = new TileLayer({
  source: geotiff,
  opacity: 1,
  style: ndviPaletteViridis
})

const geotiffLayer2 = new TileLayer({
  source: geotiff2,
  opacity: 1,
  style: ndviPaletteViridis
})

const map = new Map({
  target: 'map',
  layers: [geotiffLayer, geotiffLayer2  ],
  //view: geotiff.getView(),
  view: new View({
    center: [525822.25, 4276947.5],
    zoom:1,
    showFullExtent: true,
    extent:[524808.5, 4276440, 526836, 4277455]
  }),
 
  //view: source.getView(),
});

console.log(map);

const swipe = document.getElementById('swipe');

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