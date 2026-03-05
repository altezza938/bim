import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { UploadCloud, Search, Map as MapIcon, Layers } from 'lucide-react';

// Helper component to auto-zoom map to the selected polygon
function ChangeView({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
}

export default function BoundaryViewer() {
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [features, setFeatures] = useState([]);
    const [selectedFeature, setSelectedFeature] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const processFile = (file) => {
        if (!file.name.endsWith('.geojson') && !file.name.endsWith('.json')) {
            alert("Please upload a .geojson file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (json.type === "FeatureCollection") {
                    setGeoJsonData(json);
                    setFeatures(json.features || []);
                    setSelectedFeature(null);
                } else {
                    alert("Invalid GeoJSON Format (Must be a FeatureCollection).");
                }
            } catch (err) {
                alert("Failed to parse the JSON file.");
            }
        };
        reader.readAsText(file);
    };

    const extractFeatureNumber = (feature) => {
        // Assuming the FGDB standard properties. Adjust these keys if your data uses different field names.
        return feature.properties?.Object_ID ||
            feature.properties?.Feature_No ||
            feature.properties?.id ||
            feature.properties?.OBJECTID ||
            "Unknown Feature ID";
    };

    const filteredFeatures = features.filter(f =>
        extractFeatureNumber(f).toString().toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Helper to extract Leaflet LatLng arrays from GeoJSON coordinates
    const getPolygonPositions = (feature) => {
        if (!feature || !feature.geometry) return [];

        // GeoJSON is [lng, lat], Leaflet is [lat, lng]
        if (feature.geometry.type === 'Polygon') {
            return feature.geometry.coordinates.map(ring =>
                ring.map(coord => [coord[1], coord[0]])
            );
        } else if (feature.geometry.type === 'MultiPolygon') {
            return feature.geometry.coordinates.map(polygon =>
                polygon.map(ring =>
                    ring.map(coord => [coord[1], coord[0]])
                )
            );
        }
        return [];
    };

    const getBoundsFromPositions = (positions) => {
        if (!positions || positions.length === 0) return null;
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

        const updateBounds = (lat, lng) => {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        };

        // positions could be deeply nested depending on Polygon vs MultiPolygon
        const processArray = (arr) => {
            if (arr.length === 2 && typeof arr[0] === 'number') {
                updateBounds(arr[0], arr[1]);
            } else {
                arr.forEach(item => {
                    if (Array.isArray(item)) processArray(item);
                });
            }
        };

        processArray(positions);

        if (minLat === 90) return null; // No valid coordinates found

        return [
            [minLat, minLng],
            [maxLat, maxLng]
        ];
    };

    const polygonPositions = selectedFeature ? getPolygonPositions(selectedFeature) : [];
    const mapBounds = selectedFeature ? getBoundsFromPositions(polygonPositions) : null;

    // Default HK center
    const defaultCenter = [22.3193, 114.1694];

    return (
        <div className="main-content" style={{ gridTemplateColumns: 'minmax(300px, 350px) 1fr' }}>

            {/* Sidebar: File Upload & Feature List */}
            <aside className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Upload Zone (Small) */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                        <MapIcon size={20} /> Boundary Data
                    </h2>

                    {!geoJsonData ? (
                        <div
                            className={`drop-zone ${isDragging ? 'active' : ''}`}
                            style={{ minHeight: '150px', padding: '1.5rem 1rem' }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="drop-zone-icon" style={{ width: 32, height: 32, marginBottom: '0.5rem' }} />
                            <h3 style={{ fontSize: '1rem' }}>Upload GeoJSON</h3>
                            <p style={{ fontSize: '0.8rem' }}>Export FGDB to .geojson format</p>
                            <input type="file" ref={fileInputRef} onChange={(e) => processFile(e.target.files[0])} style={{ display: 'none' }} accept=".json,.geojson" />
                        </div>
                    ) : (
                        <div className="status-indicator success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>Loaded Data</strong>
                                <div style={{ fontSize: '0.8rem' }}>{features.length} Features found</div>
                            </div>
                            <button
                                onClick={() => { setGeoJsonData(null); setFeatures([]); setSelectedFeature(null); }}
                                className="remove-btn"
                                style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Feature List */}
                {geoJsonData && (
                    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ position: 'relative', marginBottom: '1rem' }}>
                            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Search Feature No..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                                    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                            {filteredFeatures.map((feature, idx) => {
                                const featureNo = extractFeatureNumber(feature);
                                const isSelected = selectedFeature === feature;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedFeature(feature)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            background: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Layers size={16} color={isSelected ? 'var(--primary)' : 'var(--text-secondary)'} />
                                        <span style={{ fontWeight: isSelected ? '600' : '400' }}>{featureNo}</span>
                                    </button>
                                );
                            })}
                            {filteredFeatures.length === 0 && (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                                    No features found.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Map Area */}
            <section className="glass-panel" style={{ overflow: 'hidden', position: 'relative', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                {!geoJsonData ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <MapIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>Upload a GeoJSON file to view feature boundaries.</p>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, position: 'relative', background: '#e5e7eb' }}>
                        <MapContainer
                            center={defaultCenter}
                            zoom={11}
                            style={{ height: '100%', width: '100%', backgroundColor: '#1a1d24' }}
                            zoomControl={true}
                        >
                            {/* Dark mode map tiles (CartoDB Dark Matter) */}
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />

                            {selectedFeature && polygonPositions.length > 0 && (
                                <>
                                    <Polygon
                                        positions={polygonPositions}
                                        pathOptions={{ color: '#4F46E5', fillColor: '#4F46E5', fillOpacity: 0.4, weight: 3 }}
                                    />
                                    {mapBounds && <ChangeView bounds={mapBounds} />}
                                </>
                            )}
                        </MapContainer>

                        {/* Feature Properties Overlay */}
                        {selectedFeature && (
                            <div style={{
                                position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000,
                                background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)',
                                padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--primary)',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)', maxWidth: '350px', maxHeight: '400px', overflowY: 'auto'
                            }}>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                    Feature Info: {extractFeatureNumber(selectedFeature)}
                                </h3>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    {Object.entries(selectedFeature.properties || {}).map(([key, value]) => (
                                        <div key={key} style={{ fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>{key}:</span>
                                            <span style={{ color: '#fff', wordBreak: 'break-all' }}>{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
