import React, { useState, useEffect } from 'react';

export interface MapProps {
  lat: string | number;
  lng: string | number;
  zoom?: string | number;
  staticMap?: boolean;
  width?: number;
  height?: number;
  apiBaseUrl?: string;
  apiKey?: string;
  agencyId: string;
}

export const Map: React.FC<MapProps> = ({
  lat,
  lng,
  zoom = 10,
  staticMap = true,
  width = 600,
  height = 400,
  apiBaseUrl = '',
  apiKey,
  agencyId
}) => {
  const [mapUrl, setMapUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStaticMap = async (latNum: number, lngNum: number, zoomNum: number): Promise<void> => {
    try {
      const params = new URLSearchParams({
        lat: latNum.toString(),
        lng: lngNum.toString(),
        zoom: zoomNum.toString(),
        agency_id: agencyId
      });

      const headers: HeadersInit = {
        'Accept': 'image/*'
      };

      // Add Authorization header with ApiKey format if API key is provided
      if (apiKey) {
        headers['Authorization'] = `ApiKey ${apiKey}`;
      }

      const response = await fetch(`${apiBaseUrl}/map/static?${params}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch static map: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setMapUrl(objectUrl);
    } catch (err) {
      console.error('Error fetching static map:', err);
      setError(`Failed to load map: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (!lat || !lng) {
      setError('Invalid coordinates provided');
      setIsLoading(false);
      return;
    }

    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
    const zoomNum = typeof zoom === 'string' ? parseInt(zoom) : zoom;

    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Invalid coordinate format');
      setIsLoading(false);
      return;
    }

    const loadMap = async () => {
      setIsLoading(true);
      setError(null);

      if (staticMap) {
        // Use the relative endpoint for static maps
        await getStaticMap(latNum, lngNum, zoomNum);
      } else {
        // For interactive maps, use Google Maps embed
        setMapUrl(`https://maps.google.com/maps?q=${latNum},${lngNum}&output=embed`);
      }

      setIsLoading(false);
    };

    loadMap();
  }, [lat, lng, zoom, staticMap, width, height, apiBaseUrl, apiKey]);

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mapUrl && mapUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mapUrl);
      }
    };
  }, [mapUrl]);

  if (error) {
    return (
      <div className="fusioni-map-error">
        <div className="fusioni-map-error-content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="15"
              y1="9"
              x2="9"
              y2="15"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="9"
              y1="9"
              x2="15"
              y2="15"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fusioni-map-loading">
        <div className="fusioni-map-loading-content">
          <div className="fusioni-map-loading-spinner"></div>
          <span>Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fusioni-map-container">
      {staticMap ? (
        <div className="fusioni-map-static">
          <img
            src={mapUrl}
            alt={`Map showing location at ${lat}, ${lng}`}
            width={width}
            height={height}
            className="fusioni-map-image"
            onError={() => setError('Failed to load map image')}
          />
        </div>
      ) : (
        <div className="fusioni-map-interactive">
          <iframe
            src={mapUrl}
            width={width}
            height={height}
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            title={`Map showing location at ${lat}, ${lng}`}
            className="fusioni-map-iframe"
          />
        </div>
      )}
    </div>
  );
};
