import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Polygon,
  LayersControl,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function toLngLatRing(latlngs) {
  const ring = latlngs.map((point) => [point.lng, point.lat]);

  if (ring.length > 0) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push(first);
    }
  }

  return ring;
}

function parsePolygonGeoJson(geojsonValue) {
  const geojson =
    typeof geojsonValue === "string" ? JSON.parse(geojsonValue) : geojsonValue;

  const coordinates = geojson?.coordinates?.[0] || [];
  return coordinates.map(([lng, lat]) => ({ lng, lat }));
}

function parsePolygonPositions(geojsonValue) {
  const geojson =
    typeof geojsonValue === "string" ? JSON.parse(geojsonValue) : geojsonValue;

  const coordinates = geojson?.coordinates?.[0] || [];
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

function getLongestEdgeAngleDegrees(latlngs) {
  if (!latlngs || latlngs.length < 2) return 0;

  let longestDistance = 0;
  let bestAngle = 0;

  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % latlngs.length];

    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > longestDistance) {
      longestDistance = distance;
      bestAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    }
  }

  return bestAngle;
}

function getOrientedBoundingDimensionsMeters(latlngs) {
  if (!latlngs.length) {
    return {
      widthMeters: 0,
      heightMeters: 0,
      angleDegrees: 0,
    };
  }

  const coordinates = toLngLatRing(latlngs);
  const polygonFeature = turf.polygon([coordinates]);

  const angleDegrees = getLongestEdgeAngleDegrees(latlngs);

  const rotated = turf.transformRotate(polygonFeature, -angleDegrees, {
    pivot: turf.centroid(polygonFeature),
  });

  const rotatedCoords = rotated.geometry.coordinates[0];

  const lngs = rotatedCoords.map((c) => c[0]);
  const lats = rotatedCoords.map((c) => c[1]);

  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const widthMeters = turf.distance(
    turf.point([minLng, minLat]),
    turf.point([maxLng, minLat]),
    { units: "meters" }
  );

  const heightMeters = turf.distance(
    turf.point([minLng, minLat]),
    turf.point([minLng, maxLat]),
    { units: "meters" }
  );

  return {
    widthMeters,
    heightMeters,
    angleDegrees,
  };
}

function findOverlaps(newGeometry, existingPolygons = []) {
  return existingPolygons.filter((item) => {
    try {
      const existingGeometry =
        typeof item.geojson === "string" ? JSON.parse(item.geojson) : item.geojson;

      return turf.booleanIntersects(newGeometry, existingGeometry);
    } catch (error) {
      console.error("Overlap check failed:", error);
      return false;
    }
  });
}

function FieldMap({
  onPolygonCreated,
  existingPolygons = [],
  onOverlapDetected,
}) {
  const center = useMemo(() => [14.1470, 121.2665], []);

  function handleCreated(event) {
    const layer = event.layer;

    if (event.layerType !== "polygon" && event.layerType !== "rectangle") return;

    const latlngs = layer.getLatLngs()?.[0] || [];
    const coordinates = toLngLatRing(latlngs);

    const polygonFeature = turf.polygon([coordinates]);
    const geometry = polygonFeature.geometry;
    const areaSqMeters = turf.area(polygonFeature);

    const { widthMeters, heightMeters, angleDegrees } =
      getOrientedBoundingDimensionsMeters(latlngs);

    const overlaps = findOverlaps(geometry, existingPolygons);

    onPolygonCreated({
      geojson: geometry,
      coordinates,
      areaSqMeters,
      widthMeters,
      heightMeters,
      angleDegrees,
      drawType: event.layerType,
    });

    if (onOverlapDetected) {
      onOverlapDetected(overlaps);
    }
  }

  function handleDeleted() {
    onPolygonCreated(null);
    if (onOverlapDetected) {
      onOverlapDetected([]);
    }
  }

  return (
    <div style={{ height: "420px", borderRadius: "16px", overflow: "hidden" }}>
      <MapContainer
        center={center}
        zoom={18}
        style={{ height: "100%", width: "100%" }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {existingPolygons.map((polygon) => {
          let positions = [];

          try {
            positions = parsePolygonPositions(polygon.geojson);
          } catch (error) {
            console.error("Failed to parse existing polygon:", error);
            return null;
          }

          return (
            <Polygon
              key={polygon.id}
              positions={positions}
              pathOptions={{
                color: polygon.fits ? "#2563eb" : "#b91c1c",
                weight: 2,
                fillOpacity: 0.18,
              }}
            />
          );
        })}

        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            onDeleted={handleDeleted}
            draw={{
              rectangle: {
                showArea: true,
                shapeOptions: {
                  color: "#16a34a",
                  weight: 2,
                },
              },
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                  color: "#2563eb",
                  weight: 2,
                },
              },
            }}
            edit={{
              edit: false,
            }}
          />
        </FeatureGroup>
      </MapContainer>
    </div>
  );
}

export default FieldMap;