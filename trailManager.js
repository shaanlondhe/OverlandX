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
        
        // Initialize MapBox
        mapboxgl.accessToken = 'pk.eyJ1Ijoic2hhYW5sb25kaGUiLCJhIjoiY202bWcxYnMyMGRhNzJrb2dtcm9jaXg3bCJ9.mxKxq5XABY148dnhWyQf4A';
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/outdoors-v12',
            center: [-119.4179, 36.7783], // Center of California
            zoom: 7
        });
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
            
            // Extract waypoints
            const waypoints = Array.from(gpxDoc.getElementsByTagName('wpt')).map(wpt => {
                const symbol = wpt.getElementsByTagName('sym')[0]?.textContent || '';
                // Map custom icons to standard symbols if needed
                const mappedSymbol = symbol.startsWith('images/') ? 
                    this.customIconMap[symbol] || this.customIconMap['default'] : 
                    symbol;

                return {
                    lat: parseFloat(wpt.getAttribute('lat')),
                    lng: parseFloat(wpt.getAttribute('lon')),
                    name: wpt.getElementsByTagName('n')[0]?.textContent || '',
                    description: wpt.getElementsByTagName('desc')[0]?.textContent || '',
                    symbol: mappedSymbol,
                    elevation: parseFloat(wpt.getElementsByTagName('ele')[0]?.textContent || 0)
                };
            });

            const segments = [];

            // Try to extract track segments first
            const tracks = gpxDoc.getElementsByTagName('trk');
            for (const track of tracks) {
                const trackSegments = track.getElementsByTagName('trkseg');
                for (const segment of trackSegments) {
                    const points = Array.from(segment.getElementsByTagName('trkpt')).map(point => ({
                        lat: parseFloat(point.getAttribute('lat')),
                        lng: parseFloat(point.getAttribute('lon')),
                        elevation: parseFloat(point.getElementsByTagName('ele')[0]?.textContent || 0),
                        time: point.getElementsByTagName('time')[0]?.textContent
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
                lng: parseFloat(point.getAttribute('lon')),
                elevation: parseFloat(point.getElementsByTagName('ele')[0]?.textContent || 0),
                time: point.getElementsByTagName('time')[0]?.textContent
            }));
                    if (points.length > 0) {
                        segments.push(points);
                    }
                }
            }

            return {
                waypoints,
                segments
            };
        } catch (error) {
            console.error(`Error loading GPX file for trail ${trailId}:`, error);
            return null;
        }
    }

    async addTrail(trailData) {
        try {
            // For trails with multiple segments, we'll load the first segment initially
            const gpxFile = Array.isArray(trailData.gpxFile) ? trailData.gpxFile[0] : trailData.gpxFile;
            const gpxData = await this.loadGPXFile(trailData.id, gpxFile);

            if (!gpxData) {
                console.error('Failed to load GPX data for trail:', trailData.id);
                return null;
            }

            // Create trail object with initial segment
            const trail = {
                ...trailData,
                waypoints: gpxData.waypoints || [],
                segments: gpxData.segments || [],
                sources: [],
                layers: [],
                currentSegmentIndex: 0,
                hasMultipleSegments: Array.isArray(trailData.gpxFile)
            };

            this.trails.set(trail.id, trail);
            return trail;
        } catch (error) {
            console.error('Error adding trail:', error);
            return null;
        }
    }

    async loadNextSegment(trailId) {
        const trail = this.getTrail(trailId);
        if (!trail || !trail.hasMultipleSegments) return false;

        const nextIndex = trail.currentSegmentIndex + 1;
        if (nextIndex >= trail.gpxFile.length) return false;

        try {
            const gpxData = await this.loadGPXFile(trailId, trail.gpxFile[nextIndex]);
            if (!gpxData) return false;

            // Append new data to existing trail
            trail.waypoints = trail.waypoints.concat(gpxData.waypoints || []);
            trail.segments = trail.segments.concat(gpxData.segments || []);
            trail.currentSegmentIndex = nextIndex;

            // Update trail in map
            this.trails.set(trailId, trail);
            return true;
        } catch (error) {
            console.error('Error loading next segment:', error);
            return false;
        }
    }

    getTrail(id) {
        return this.trails.get(id);
    }

    getAllTrails() {
        return Array.from(this.trails.values());
    }

    clearCurrentDisplay() {
        // Remove existing paths
        if (this.currentPath) {
            this.currentPath.sources.forEach(sourceId => {
                if (this.map.getSource(sourceId)) {
                    // Remove associated layers first
                    this.currentPath.layers.forEach(layerId => {
                        if (this.map.getLayer(layerId)) {
                            this.map.removeLayer(layerId);
                        }
                    });
                    this.map.removeSource(sourceId);
                }
            });
        }

        // Remove existing markers
        this.currentMarkers.forEach(marker => marker.remove());
        this.currentMarkers = [];
    }

    async displayTrailOnMap(trailId) {
        const trail = this.getTrail(trailId);
        if (!trail) return null;

        this.clearCurrentDisplay();

        // For multi-segment trails, load all segments first
        if (trail.hasMultipleSegments) {
            for (let i = trail.currentSegmentIndex + 1; i < trail.gpxFile.length; i++) {
                await this.loadNextSegment(trailId);
            }
        }

        const sources = [];
        const layers = [];
        const bounds = new mapboxgl.LngLatBounds();

        // Add each segment as a separate line
        if (trail.segments) {
            trail.segments.forEach((segment, index) => {
                if (!segment || segment.length === 0) return;

                const sourceId = `trail-${trailId}-segment-${index}`;
                const layerId = `trail-layer-${trailId}-segment-${index}`;

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
                        id: layerId,
                        type: 'line',
                        source: sourceId,
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': '#FF0000',
                            'line-width': 3,
                            'line-opacity': 0.8
                        }
                    });

                    sources.push(sourceId);
                    layers.push(layerId);

                    // Extend bounds
                    segment.forEach(point => {
                        bounds.extend([point.lng, point.lat]);
                    });
                } catch (error) {
                    console.error(`Error adding segment ${index}:`, error);
                }
            });
        }

        // Add waypoints if they exist
        if (trail.waypoints && trail.waypoints.length > 0) {
            // Convert waypoints to GeoJSON
            const waypointsGeojson = {
                type: 'FeatureCollection',
                features: trail.waypoints.map(waypoint => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [waypoint.lng, waypoint.lat]
                    },
                    properties: {
                        name: waypoint.name,
                        description: waypoint.description,
                        elevation: waypoint.elevation,
                        symbol: waypoint.symbol
                    }
                }))
            };

            try {
                // Add waypoints source
                const waypointSourceId = `waypoints-${trailId}`;
                this.map.addSource(waypointSourceId, {
                    type: 'geojson',
                    data: waypointsGeojson
                });
                sources.push(waypointSourceId);

                // Add waypoints layer
                const waypointLayerId = `waypoints-layer-${trailId}`;
                this.map.addLayer({
                    id: waypointLayerId,
                    type: 'symbol',
                    source: waypointSourceId,
                    layout: {
                        'icon-image': ['get', 'symbol'],
                        'icon-size': 1.2,
                        'icon-allow-overlap': true,
                        'text-field': ['get', 'name'],
                        'text-font': ['Open Sans Regular'],
                        'text-offset': [0, 1.5],
                        'text-anchor': 'top',
                        'text-size': 12,
                        'text-allow-overlap': false,
                        'text-optional': true
                    },
                    paint: {
                        'text-halo-width': 1,
                        'text-halo-color': 'white'
                    }
                });
                layers.push(waypointLayerId);

                // Add click handler for waypoint popups
                this.map.on('click', waypointLayerId, (e) => {
                    if (!e.features.length) return;

                    const coordinates = e.features[0].geometry.coordinates.slice();
                    const properties = e.features[0].properties;

                    // Create popup content
                    const popupContent = `
                        <h3>${properties.name}</h3>
                        ${properties.description ? `<p>${properties.description}</p>` : ''}
                        ${properties.elevation ? `<p>Elevation: ${properties.elevation}m</p>` : ''}
                    `;

                    // Create and show popup
                    const popup = new mapboxgl.Popup({
                        offset: [0, 10],
                        maxWidth: '300px',
                        className: 'waypoint-popup',
                        anchor: 'top',
                        focusAfterOpen: false,
                        closeButton: true,
                        closeOnClick: false
                    })
                        .setLngLat(coordinates)
                        .setHTML(popupContent)
                        .addTo(this.map);

                    // Ensure popup is visible within viewport
                    popup.on('open', () => {
                        const popupElement = popup.getElement();
                        const mapElement = this.map.getContainer();
                        const mapRect = mapElement.getBoundingClientRect();
                        const popupRect = popupElement.getBoundingClientRect();

                        if (popupRect.bottom > mapRect.bottom) {
                            const overflowY = popupRect.bottom - mapRect.bottom + 20;
                            const center = this.map.getCenter();
                            const point = this.map.project(center);
                            point.y -= overflowY;
                            this.map.easeTo({ 
                                center: this.map.unproject(point),
                                duration: 300
                            });
                        }
                    });
                });

                // Change cursor to pointer when hovering over waypoints
                this.map.on('mouseenter', waypointLayerId, () => {
                    this.map.getCanvas().style.cursor = 'pointer';
                });
                this.map.on('mouseleave', waypointLayerId, () => {
                    this.map.getCanvas().style.cursor = '';
                });

                // Extend bounds with waypoints
                trail.waypoints.forEach(waypoint => {
                    bounds.extend([waypoint.lng, waypoint.lat]);
                });
            } catch (error) {
                console.error('Error adding waypoints:', error);
            }
        }

        // Store current path info
        this.currentPath = { sources, layers };

        // Fit map to bounds if we have any points
        if (bounds.isEmpty()) {
            console.warn('No valid coordinates found for trail:', trailId);
        } else {
            this.map.fitBounds(bounds, {
                padding: 50
            });
        }

        return this.currentPath;
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