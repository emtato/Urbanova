import fs from 'fs';
import path from 'path';

const bbox = {
  south: 43.655,
  west: -79.376,
  north: 43.663,
  east: -79.352,
};

const query = `[out:json][timeout:30];
(
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out body;
>;
out skel qt;`;

const mirrors = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function fetchFromMirrors() {
  for (const url of mirrors) {
    try {
      console.log(`Trying Overpass mirror: ${url}...`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Urbanova-CorridorMassing/1.0 (contact: info@urbanova.local)',
        },
        body: 'data=' + encodeURIComponent(query),
      });

      if (!resp.ok) {
        console.warn(`Mirror ${url} returned ${resp.status}`);
        continue;
      }

      const text = await resp.text();
      if (!text.startsWith('{')) {
        console.warn(`Mirror ${url} returned non-JSON response`);
        continue;
      }

      return JSON.parse(text);
    } catch (err) {
      console.warn(`Failed mirror ${url}:`, err.message);
    }
  }
  throw new Error('All Overpass mirrors failed.');
}

function osmToGeoJSON(osmData) {
  const nodes = new Map();
  for (const el of osmData.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, [el.lon, el.lat]);
    }
  }

  const features = [];
  for (const el of osmData.elements) {
    if (el.type === 'way' && el.nodes && el.nodes.length >= 4) {
      // Must be a closed polygon
      if (el.nodes[0] !== el.nodes[el.nodes.length - 1]) continue;

      const coords = [];
      let valid = true;
      for (const nid of el.nodes) {
        const pt = nodes.get(nid);
        if (!pt) {
          valid = false;
          break;
        }
        coords.push(pt);
      }
      if (!valid || coords.length < 4) continue;

      const tags = el.tags || {};
      let height = 10;

      if (tags.height) {
        const parsed = parseFloat(tags.height);
        if (!isNaN(parsed) && parsed > 0) height = parsed;
      } else if (tags['building:levels']) {
        const lvls = parseFloat(tags['building:levels']);
        if (!isNaN(lvls) && lvls > 0) height = Math.round(lvls * 3.5);
      } else if (tags.building === 'apartments' || tags.building === 'commercial') {
        height = 18;
      } else if (tags.building === 'house' || tags.building === 'residential') {
        height = 9;
      } else if (tags.building === 'retail' || tags.building === 'service') {
        height = 7;
      }

      // Keep height realistic between 4m and 120m for baseline buildings
      height = Math.max(4, Math.min(120, height));

      features.push({
        type: 'Feature',
        id: `osm-${el.id}`,
        properties: {
          id: `osm-${el.id}`,
          name: tags.name || tags['addr:street'] ? `${tags['addr:housenumber'] || ''} ${tags['addr:street'] || ''}`.trim() : `Building ${el.id}`,
          height_m: height,
          kind: 'existing',
          levels: tags['building:levels'] ? parseFloat(tags['building:levels']) : Math.round(height / 3.5),
          building_type: tags.building || 'yes',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

async function run() {
  const osm = await fetchFromMirrors();
  console.log(`Fetched ${osm.elements.length} OSM elements`);
  const geojson = osmToGeoJSON(osm);
  console.log(`Generated ${geojson.features.length} real 3D building polygons!`);

  const outPath1 = path.resolve('frontend/src/data/corridor_massing.json');
  const outPath2 = path.resolve('data/reviewed/massing.geojson');

  fs.writeFileSync(outPath1, JSON.stringify(geojson, null, 2));
  fs.writeFileSync(outPath2, JSON.stringify(geojson, null, 2));
  console.log(`Saved to ${outPath1} and ${outPath2}`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
