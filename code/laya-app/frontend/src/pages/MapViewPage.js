import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  LayersControl,
} from "react-leaflet";
import AppShell from "../components/AppShell";
import SectionCard from "../components/SectionCard";
import { useAuth } from "../context/AuthContext";
import { fetchAllExperimentPolygons } from "../services/experimentService";
import "leaflet/dist/leaflet.css";

function geoJsonToLatLngs(geojsonString) {
  const geojson =
    typeof geojsonString === "string" ? JSON.parse(geojsonString) : geojsonString;

  const coords = geojson?.coordinates?.[0] || [];
  return coords.map(([lng, lat]) => [lat, lng]);
}

function MapViewPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [polygons, setPolygons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  useEffect(() => {
    loadPolygons();
  }, []);

  async function loadPolygons() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAllExperimentPolygons();
      setPolygons(data || []);
    } catch (err) {
      console.error("Failed to load polygons:", err);
      setError(err.message || "Failed to load experiment polygons.");
    } finally {
      setLoading(false);
    }
  }

  const center = useMemo(() => [14.1470, 121.2665], []);

  return (
    <AppShell
      leftActions={[
        <button
          key="dashboard"
          className="wf-btn wf-btn-secondary"
          onClick={() => navigate("/dashboard")}
        >
          Dashboard
        </button>,
        <button
          key="map"
          className="wf-btn wf-btn-secondary"
          onClick={() => navigate("/map-view")}
        >
          Map View
        </button>,
        ...(user?.role === "admin"
          ? [
              <button
                key="admin"
                className="wf-btn wf-btn-accent"
                onClick={() => navigate("/admin")}
              >
                Admin
              </button>,
            ]
          : []),
      ]}
      rightActions={[
        <div key="user" className="wf-user-box">
          <div>{user?.full_name || "User"}</div>
          <div>Role: {user?.role || "-"}</div>
        </div>,
        <button key="logout" className="wf-btn" onClick={handleLogout}>
          Logout
        </button>,
      ]}
    >
      <SectionCard title="Experiment Field Map">
        {loading && <div className="wf-loading">Loading map polygons...</div>}
        {error && <div className="wf-error">{error}</div>}

        <div style={{ height: "72vh", borderRadius: "16px", overflow: "hidden" }}>
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

            {polygons.map((polygon) => {
              let positions = [];

              try {
                positions = geoJsonToLatLngs(polygon.geojson);
              } catch (err) {
                console.error("Failed to parse polygon geojson:", err);
                return null;
              }

              const color = polygon.fits ? "#1f7a63" : "#c0392b";

              return (
                <Polygon
                  key={polygon.id}
                  positions={positions}
                  pathOptions={{
                    color,
                    weight: 2,
                    fillOpacity: 0.25,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: "220px" }}>
                      <div style={{ fontWeight: 700, marginBottom: "8px" }}>
                        {polygon.experiment_name}
                      </div>
                      <div><strong>Crop:</strong> {polygon.crop}</div>
                      <div><strong>Design:</strong> {polygon.design_type}</div>
                      <div><strong>Status:</strong> {polygon.status}</div>
                      <div><strong>Area:</strong> {polygon.area_sq_m || "-"} m²</div>
                      <div>
                        <strong>Fit Result:</strong>{" "}
                        {polygon.fits === true
                          ? "Fits"
                          : polygon.fits === false
                          ? "Does not fit"
                          : "Not analyzed"}
                      </div>

                      <button
                        className="wf-btn wf-btn-secondary"
                        style={{ marginTop: "10px", width: "100%" }}
                        onClick={() => navigate(`/experiments/${polygon.experiment_id}`)}
                      >
                        View Experiment
                      </button>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </MapContainer>
        </div>
      </SectionCard>
    </AppShell>
  );
}

export default MapViewPage;