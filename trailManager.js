export default class TrailManager {
    constructor() {
        this.trails = new Map();
        this.metadata = null;
        this.currentPath = null;
        this.currentMarkers = [];
        this.map = null;
        
        // Symbol mapping for waypoint icons
        this.symbolMap = {
            'attraction': '/icons/attraction.png',
            'sand-dune': '/icons/dunes.png',
            'city-24': '/icons/city.png',
            'cave': '/icons/cave.png',
            'campsite-24': '/icons/camp.png',
            'cliff': '/icons/cliff.png',
            'building-24': '/icons/building.png',
            'known-route': '/icons/trail.png',
            'binoculars': '/icons/viewpoint.png',
            'fuel-24': '/icons/gas.png',
            'mine': '/icons/mine.png',
            'no-admittance-2': '/icons/no-entry.png',
            'off-road': '/icons/offroad.png',
            'forest': '/icons/forest.png',
            'camera-24': '/icons/photo.png',
            'police': '/icons/ranger.png',
            'bridge': '/icons/bridge.png',
            'peak': '/icons/peak.png',
            'geyser': '/icons/geyser.png',
            'stone': '/icons/rocks.png',
            'volcano': '/icons/volcano.png',
            'museum': '/icons/museum.png',
            'gate': '/icons/gate.png',
            // Default icon for unknown symbols
            'default': '/icons/marker.png'
        };
        
        // Add custom icon mapping for Big Sur Adventure Route
        this.customIconMap = {
            'images/icon-1.png': 'fuel-24',           // Gas Station
            'images/icon-2.png': 'attraction',        // Points of Interest
            'images/icon-3.png': 'lighthouse',        // Lighthouse
            'images/icon-4.png': 'museum',           // Aquarium
            'images/icon-5.png': 'golf',             // Pebble Beach
            'images/icon-6.png': 'water',            // Surf spot
            'images/icon-7.png': 'monument',         // Historic sites
            'images/icon-8.png': 'beach',            // Beaches
            'images/icon-9.png': 'bridge',           // Bridge
            'images/icon-10.png': 'waterfall',       // Waterfalls
            'images/icon-11.png': 'campsite-24',     // Campgrounds
            'images/icon-12.png': 'campsite-24',     // Campgrounds
            'images/icon-13.png': 'restaurant',      // Restaurant
            'images/icon-14.png': 'lodging',         // Resort
            'images/icon-15.png': 'peak',            // Mountain peak
            'images/icon-16.png': 'mountain',        // Mountain top
            'images/icon-17.png': 'danger',          // Warning point
            'images/icon-18.png': 'cave',            // Caves
            'images/icon-19.png': 'lodging',         // Institute
            'default': 'marker'                      // Default marker
        };
    }

    initMap() {
        try {
            if (!mapboxgl) {
                throw new Error('Mapbox GL JS not loaded');
            }
            
            mapboxgl.accessToken = 'pk.eyJ1Ijoic2hhYW5sb25kaGUiLCJhIjoiY202bWcxYnMyMGRhNzJrb2dtcm9jaXg3bCJ9.mxKxq5XABY148dnhWyQf4A';
            
            this.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/outdoors-v12',
                center: [-119.4179, 36.7783], // Center of California
                zoom: 7
            });

            return true;
        } catch (error) {
            console.error('Error initializing map:', error);
            throw error;
        }
    }

    async loadTrailData() {
        try {
            const response = await fetch('/trails/trails.json');
            const data = await response.json();
            
            // Store metadata
            this.metadata = data.metadata;
            
            // Load each trail
            for (const trailData of data.trails) {
                await this.addTrail(trailData);
            }
        } catch (error) {
            console.error('Error loading trail data:', error);
            throw error;
        }
    }

    async loadGPXFile(trailId, gpxFilePath) {
        try {
            const response = await fetch(`/trails/${gpxFilePath}`);
            const gpxText = await response.text();
            const parser = new DOMParser();
            const gpxDoc = parser.parseFromString(gpxText, "text/xml");
            
            const segments = [];

            // Try to extract track segments first
            const tracks = gpxDoc.getElementsByTagName('trk');
            for (const track of tracks) {
                const trackSegments = track.getElementsByTagName('trkseg');
                for (const segment of trackSegments) {
                    const points = Array.from(segment.getElementsByTagName('trkpt')).map(point => ({
                        lat: parseFloat(point.getAttribute('lat')),
                        lng: parseFloat(point.getAttribute('lon'))
                    }));
                    if (points.length > 0) {
                        segments.push(points);
                    }
                }
            }

            // If no track segments found, try to extract route points
            if (segments.length === 0) {
                const routes = gpxDoc.getElementsByTagName('rte');
                for (const route of routes) {
                    const points = Array.from(route.getElementsByTagName('rtept')).map(point => ({
                        lat: parseFloat(point.getAttribute('lat')),
                        lng: parseFloat(point.getAttribute('lon'))
                    }));
                    if (points.length > 0) {
                        segments.push(points);
                    }
                }
            }

            return { segments };
        } catch (error) {
            console.error(`Error loading GPX file for trail ${trailId}:`, error);
            return null;
        }
    }

    async addTrail(trailData) {
        try {
            const gpxFile = Array.isArray(trailData.gpxFile) ? trailData.gpxFile[0] : trailData.gpxFile;
            const gpxData = await this.loadGPXFile(trailData.id, gpxFile);

            if (!gpxData) {
                console.error('Failed to load GPX data for trail:', trailData.id);
                return null;
            }

            // Create simplified trail object
            const trail = {
                id: trailData.id,
                name: trailData.name,
                distance: trailData.distance,
                time: trailData.time,
                avgRating: trailData.avgRating,
                peakRating: trailData.peakRating,
                terrain: trailData.terrain,
                segments: gpxData.segments || []
            };

            this.trails.set(trail.id, trail);
            return trail;
        } catch (error) {
            console.error('Error adding trail:', error);
            return null;
        }
    }

    getTrail(id) {
        return this.trails.get(id);
    }

    getAllTrails() {
        return Array.from(this.trails.values());
    }

    clearCurrentDisplay() {
        if (this.currentPath) {
            this.currentPath.forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.removeLayer(layerId);
                }
                if (this.map.getSource(layerId)) {
                    this.map.removeSource(layerId);
                }
            });
        }
        this.currentPath = null;
    }

    async displayTrailOnMap(trailId) {
        const trail = this.getTrail(trailId);
        if (!trail) return null;

        this.clearCurrentDisplay();

        const layers = [];
        const bounds = new mapboxgl.LngLatBounds();

        // Add each segment as a separate line
        if (trail.segments) {
            trail.segments.forEach((segment, index) => {
                if (!segment || segment.length === 0) return;

                const sourceId = `trail-${trailId}-segment-${index}`;

                // Convert segment to GeoJSON
                const geojson = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: segment.map(point => [point.lng, point.lat])
                    }
                };

                try {
                    // Add source
                    this.map.addSource(sourceId, {
                        type: 'geojson',
                        data: geojson
                    });

                    // Add layer
                    this.map.addLayer({
                        id: sourceId,
                        type: 'line',
                        source: sourceId,
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': '#FF0000',
                            'line-width': 3
                        }
                    });

                    layers.push(sourceId);

                    // Extend bounds
                    segment.forEach(point => {
                        bounds.extend([point.lng, point.lat]);
                    });
                } catch (error) {
                    console.error(`Error adding segment ${index}:`, error);
                }
            });
        }

        this.currentPath = layers;

        // Fit map to bounds if we have any points
        if (!bounds.isEmpty()) {
            this.map.fitBounds(bounds, {
                padding: 50
            });
        }

        return layers;
    }

    createNavigationLink(lat, lng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }

    addNavigationButton(lat, lng, container) {
        const button = document.createElement('button');
        button.textContent = 'Navigate';
        button.className = 'navigation-button';
        button.onclick = () => {
            window.open(this.createNavigationLink(lat, lng), '_blank');
        };
        container.appendChild(button);
        return button;
    }
} 