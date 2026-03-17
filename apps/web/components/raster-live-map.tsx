"use client";

import { useMemo, useState } from "react";

type MapPoint = {
  id: string;
  kind: "agent" | "incident";
  label: string;
  detail: string;
  timestamp: string | null;
  latitude: number;
  longitude: number;
};

type TileLayerKey = "street" | "satellite" | "terrain";

const TILE_SIZE = 256;
const DEFAULT_CENTER = { latitude: 9.082, longitude: 8.6753 };
const MAP_WIDTH = 960;
const MAP_HEIGHT = 420;

const TILE_LAYERS: Record<TileLayerKey, { label: string; attribution: string; url: (x: number, y: number, z: number) => string }> = {
  street: {
    label: "Street",
    attribution: "OpenStreetMap",
    url: (x, y, z) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
  satellite: {
    label: "Satellite",
    attribution: "Esri World Imagery",
    url: (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  },
  terrain: {
    label: "Terrain",
    attribution: "OpenTopoMap",
    url: (x, y, z) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
  },
};

function longitudeToX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom * TILE_SIZE;
}

function latitudeToY(latitude: number, zoom: number) {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom * TILE_SIZE;
}

function getZoom(points: MapPoint[]) {
  if (points.length <= 1) {
    return 14;
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const span = Math.max(latitudeSpan, longitudeSpan);

  if (span < 0.01) {
    return 15;
  }
  if (span < 0.03) {
    return 14;
  }
  if (span < 0.08) {
    return 13;
  }
  if (span < 0.15) {
    return 12;
  }
  if (span < 0.4) {
    return 10;
  }
  if (span < 1.2) {
    return 8;
  }
  return 6;
}

export function RasterLiveMap({
  points,
  emptyMessage,
}: {
  points: MapPoint[];
  emptyMessage: string;
}) {
  const [tileLayer, setTileLayer] = useState<TileLayerKey>("satellite");

  const mapModel = useMemo(() => {
    if (points.length === 0) {
      return null;
    }

    const latitude =
      points.reduce((sum, point) => sum + point.latitude, 0) / points.length || DEFAULT_CENTER.latitude;
    const longitude =
      points.reduce((sum, point) => sum + point.longitude, 0) / points.length || DEFAULT_CENTER.longitude;
    const zoom = getZoom(points);
    const centerX = longitudeToX(longitude, zoom);
    const centerY = latitudeToY(latitude, zoom);
    const topLeftX = centerX - MAP_WIDTH / 2;
    const topLeftY = centerY - MAP_HEIGHT / 2;
    const startTileX = Math.floor(topLeftX / TILE_SIZE);
    const startTileY = Math.floor(topLeftY / TILE_SIZE);
    const endTileX = Math.floor((topLeftX + MAP_WIDTH) / TILE_SIZE);
    const endTileY = Math.floor((topLeftY + MAP_HEIGHT) / TILE_SIZE);
    const tileCount = 2 ** zoom;

    const tiles = [];
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
        if (tileY < 0 || tileY >= tileCount) {
          continue;
        }

        const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${wrappedTileX}-${tileY}-${zoom}`,
          left: tileX * TILE_SIZE - topLeftX,
          top: tileY * TILE_SIZE - topLeftY,
          x: wrappedTileX,
          y: tileY,
          z: zoom,
        });
      }
    }

    const markers = points.map((point) => ({
      ...point,
      left: longitudeToX(point.longitude, zoom) - topLeftX,
      top: latitudeToY(point.latitude, zoom) - topLeftY,
    }));

    return {
      attribution: TILE_LAYERS[tileLayer].attribution,
      tiles,
      markers,
    };
  }, [points, tileLayer]);

  return (
    <div className="raster-map-frame">
      <div className="map-filter-row">
        <div className="live-map-legend">
          <span>Live basemap</span>
        </div>
        <select value={tileLayer} onChange={(event) => setTileLayer(event.target.value as TileLayerKey)}>
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <option key={key} value={key}>
              {layer.label}
            </option>
          ))}
        </select>
      </div>
      <div className="live-map-stage tiled">
        {mapModel ? (
          <>
            {mapModel.tiles.map((tile) => (
              <img
                key={tile.key}
                className="map-tile"
                src={TILE_LAYERS[tileLayer].url(tile.x, tile.y, tile.z)}
                alt=""
                loading="lazy"
                draggable={false}
                style={{ left: tile.left, top: tile.top }}
              />
            ))}
            <div className="map-overlay-shade" />
            {mapModel.markers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className={`map-marker ${marker.kind}`}
                style={{ left: `${(marker.left / MAP_WIDTH) * 100}%`, top: `${(marker.top / MAP_HEIGHT) * 100}%` }}
                title={`${marker.label} | ${marker.detail}${marker.timestamp ? ` | ${new Date(marker.timestamp).toLocaleString()}` : ""}`}
              >
                <span className="map-marker-pulse" />
              </button>
            ))}
            <div className="map-attribution">Basemap: {mapModel.attribution}</div>
          </>
        ) : (
          <div className="live-map-empty">
            <strong>{emptyMessage}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
