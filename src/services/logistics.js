const axios = require('axios');
const logger = require('../utils/logger');

// Zone definitions based on distance from Nairobi CBD
const ZONES = {
  A: { range: [0, 3], fee: 200, eta: '15-30', areas: ['Westlands', 'Kileleshwa', 'Kilimani', 'CBD'] },
  B: { range: [3, 7], fee: 300, eta: '30-45', areas: ['South B', 'Hurlingham', 'Parklands', 'Lavington'] },
  C: { range: [7, 12], fee: 400, eta: '45-60', areas: ['Ruaka', 'Rongai', 'Embakasi', 'Donholm'] },
  D: { range: [12, 20], fee: 500, eta: '60-90', areas: ['Kitengela', 'Juja', 'Limuru', 'Athi River'] },
  E: { range: [20, Infinity], fee: 600, eta: '90+', areas: ['Thika', 'Ngong', 'Machakos'] }
};

// Known locations with coordinates
const KNOWN_LOCATIONS = {
  'westlands': { lat: -1.2531, lng: 36.8172, zone: 'A' },
  'kileleshwa': { lat: -1.2981, lng: 36.8073, zone: 'A' },
  'kilimani': { lat: -1.3000, lng: 36.8000, zone: 'A' },
  'cbd': { lat: -1.2921, lng: 36.8219, zone: 'A' },
  'south b': { lat: -1.3200, lng: 36.8500, zone: 'B' },
  'hurlingham': { lat: -1.3100, lng: 36.8300, zone: 'B' },
  'parklands': { lat: -1.2600, lng: 36.8200, zone: 'B' },
  'lavington': { lat: -1.2800, lng: 36.8000, zone: 'B' },
  'ruaka': { lat: -1.1800, lng: 36.8500, zone: 'C' },
  'rongai': { lat: -1.4000, lng: 36.6500, zone: 'C' },
  'embakasi': { lat: -1.3000, lng: 36.9000, zone: 'C' },
  'donholm': { lat: -1.2900, lng: 36.8800, zone: 'C' },
  'kitengela': { lat: -1.4700, lng: 36.9500, zone: 'D' },
  'juja': { lat: -1.1000, lng: 37.0100, zone: 'D' },
  'limuru': { lat: -1.1000, lng: 36.6400, zone: 'D' },
  'athi river': { lat: -1.4500, lng: 36.9800, zone: 'D' },
  'thika': { lat: -1.0500, lng: 37.0700, zone: 'E' },
  'ngong': { lat: -1.3600, lng: 36.6500, zone: 'E' },
  'machakos': { lat: -1.5200, lng: 37.2600, zone: 'E' }
};

class LogisticsService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async calculateLogistics(locationInput) {
    try {
      logger.info(`Calculating logistics for location: ${locationInput}`);

      // First, try to find in known locations
      const knownLocation = this.findKnownLocation(locationInput);
      if (knownLocation) {
        return this.createLogisticsResponse(knownLocation);
      }

      // If not found, geocode the location
      const geocodedLocation = await this.geocodeLocation(locationInput);
      if (geocodedLocation) {
        return this.createLogisticsResponse(geocodedLocation);
      }

      // Fallback to default zone
      return this.createLogisticsResponse({
        zone: 'C',
        distance: 8,
        coordinates: null,
        location: locationInput
      });

    } catch (error) {
      logger.error('Error calculating logistics:', error);
      return this.createLogisticsResponse({
        zone: 'C',
        distance: 8,
        coordinates: null,
        location: locationInput
      });
    }
  }

  findKnownLocation(locationInput) {
    const cleanInput = locationInput.toLowerCase().trim();
    
    for (const [key, location] of Object.entries(KNOWN_LOCATIONS)) {
      if (cleanInput.includes(key) || key.includes(cleanInput)) {
        return {
          zone: location.zone,
          distance: this.calculateDistanceFromCBD(location.lat, location.lng),
          coordinates: { lat: location.lat, lng: location.lng },
          location: locationInput
        };
      }
    }
    
    return null;
  }

  async geocodeLocation(locationInput) {
    if (!this.googleMapsApiKey) {
      logger.warn('Google Maps API key not configured, using fallback');
      return null;
    }

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address: `${locationInput}, Nairobi, Kenya`,
            key: this.googleMapsApiKey
          }
        }
      );

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        const { lat, lng } = result.geometry.location;
        const distance = this.calculateDistanceFromCBD(lat, lng);
        
        return {
          zone: this.getZoneByDistance(distance),
          distance: distance,
          coordinates: { lat, lng },
          location: locationInput
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Geocoding error:', error);
      return null;
    }
  }

  calculateDistanceFromCBD(lat, lng) {
    // Nairobi CBD coordinates
    const cbdLat = -1.2921;
    const cbdLng = 36.8219;
    
    // Haversine formula to calculate distance
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat - cbdLat);
    const dLng = this.toRadians(lng - cbdLng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(cbdLat)) * Math.cos(this.toRadians(lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  getZoneByDistance(distance) {
    for (const [zone, config] of Object.entries(ZONES)) {
      if (distance >= config.range[0] && distance < config.range[1]) {
        return zone;
      }
    }
    return 'E'; // Default to farthest zone
  }

  createLogisticsResponse(locationData) {
    const zone = ZONES[locationData.zone];
    const baseFee = zone.fee;
    
    // Add time-based surcharge (rush hour, etc.)
    const timeSurcharge = this.calculateTimeSurcharge();
    
    // Add distance-based adjustment
    const distanceAdjustment = this.calculateDistanceAdjustment(locationData.distance, zone);
    
    const totalFee = baseFee + timeSurcharge + distanceAdjustment;
    
    return {
      zone: locationData.zone,
      location: locationData.location,
      distance: locationData.distance,
      coordinates: locationData.coordinates,
      fee: totalFee,
      eta: zone.eta,
      baseFee: baseFee,
      timeSurcharge: timeSurcharge,
      distanceAdjustment: distanceAdjustment,
      areas: zone.areas,
      calculatedAt: new Date().toISOString()
    };
  }

  calculateTimeSurcharge() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Rush hour surcharge (7-9 AM, 5-7 PM on weekdays)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        return 50;
      }
    }
    
    // Weekend surcharge
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 100;
    }
    
    return 0;
  }

  calculateDistanceAdjustment(distance, zone) {
    // If distance is at the upper end of the zone range, add small adjustment
    const zoneRange = zone.range;
    const zoneMidpoint = (zoneRange[0] + zoneRange[1]) / 2;
    
    if (distance > zoneMidpoint) {
      return Math.round((distance - zoneMidpoint) * 10);
    }
    
    return 0;
  }

  async getNearestVehicle(locationData) {
    try {
      // This would integrate with vehicle tracking system
      // For now, return mock data
      const vehicles = await this.getAvailableVehicles();
      
      if (vehicles.length === 0) {
        return null;
      }
      
      // Find nearest vehicle (simplified)
      let nearestVehicle = vehicles[0];
      let shortestDistance = Infinity;
      
      for (const vehicle of vehicles) {
        const distance = this.calculateDistance(
          locationData.coordinates.lat,
          locationData.coordinates.lng,
          vehicle.lat,
          vehicle.lng
        );
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestVehicle = vehicle;
        }
      }
      
      return {
        vehicle: nearestVehicle,
        distance: shortestDistance,
        eta: this.calculateETA(shortestDistance)
      };
    } catch (error) {
      logger.error('Error finding nearest vehicle:', error);
      return null;
    }
  }

  async getAvailableVehicles() {
    // Mock data - in real implementation, this would query vehicle tracking system
    return [
      { id: 'VAN001', lat: -1.2921, lng: 36.8219, status: 'available', capacity: 4 },
      { id: 'VAN002', lat: -1.2800, lng: 36.8000, status: 'available', capacity: 4 },
      { id: 'VAN003', lat: -1.3000, lng: 36.8500, status: 'available', capacity: 4 }
    ];
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  calculateETA(distance) {
    // Base speed: 30 km/h in city traffic
    const baseSpeed = 30;
    const baseTime = (distance / baseSpeed) * 60; // Convert to minutes
    
    // Add buffer for traffic, stops, etc.
    const buffer = baseTime * 0.3;
    
    return Math.round(baseTime + buffer);
  }

  getZoneInfo(zone) {
    return ZONES[zone] || null;
  }

  getAllZones() {
    return ZONES;
  }
}

// Singleton instance
const logisticsService = new LogisticsService();

// Export functions for backward compatibility
async function calculateLogistics(locationInput) {
  return logisticsService.calculateLogistics(locationInput);
}

module.exports = {
  LogisticsService,
  logisticsService,
  calculateLogistics
}; 