/**
 * Sprint C — Interactive Map dengan Leaflet.js
 * Menampilkan lokasi outlets FnB Group di peta interaktif
 */
import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Clock, Phone, Mail } from "lucide-react";

// Fix Leaflet default icon issue dengan Vite/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom marker icons per brand (per design guidelines)
const createCustomIcon = (color = "#8B4513") => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          transform: rotate(45deg);
          color: white;
          font-size: 14px;
          font-weight: bold;
        ">📍</div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const brandColors = {
  "the-coffeeshop": "#C8A96E",
  "the-restaurant": "#E05C3A",
  "the-bistro": "#7B9E87",
  "the-bakery": "#D4A574",
  "the-lounge": "#DC2626",
};

// Component to auto-fit map bounds to all markers
function FitBounds({ outlets }) {
  const map = useMap();
  
  useEffect(() => {
    if (outlets.length > 0) {
      const bounds = L.latLngBounds(
        outlets.map(o => [o.lat, o.lng])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [outlets, map]);
  
  return null;
}

export default function InteractiveMap({ outlets = [], className = "" }) {
  const [isMounted, setIsMounted] = useState(false);

  // Leaflet requires window object; prevent SSR issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || outlets.length === 0) {
    return (
      <div className={`bg-muted/30 rounded-lg flex items-center justify-center ${className}`}
        style={{ minHeight: "400px" }}
        data-testid="interactive-map-loading">
        <span className="text-sm text-muted-foreground">Memuat peta...</span>
      </div>
    );
  }

  // Calculate initial center point dari semua outlets
  const centerLat = outlets.reduce((sum, o) => sum + (o.lat || 0), 0) / outlets.length;
  const centerLng = outlets.reduce((sum, o) => sum + (o.lng || 0), 0) / outlets.length;
  const center = [centerLat, centerLng];

  return (
    <div className={`rounded-lg overflow-hidden border border-border/40 shadow-lg ${className}`}
      data-testid="interactive-map-container">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: "100%", minHeight: "500px", width: "100%" }}
        data-testid="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds outlets={outlets} />
        {outlets.map((outlet) => {
          if (!outlet.lat || !outlet.lng) return null;
          const icon = createCustomIcon(brandColors[outlet.brandId] || "#8B4513");
          return (
            <Marker
              key={outlet.id}
              position={[outlet.lat, outlet.lng]}
              icon={icon}
              data-testid={`map-marker-${outlet.id}`}
            >
              <Popup maxWidth={300} className="custom-popup">
                <div className="p-2 space-y-2" data-testid={`map-popup-${outlet.id}`}>
                  <h3 className="font-serif font-bold text-base text-espresso-900 dark:text-cream-100">
                    {outlet.name}
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gold-600 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{outlet.address}</span>
                    </div>
                    {outlet.hours && (
                      <div className="flex items-start gap-2">
                        <Clock className="h-3.5 w-3.5 text-gold-600 mt-0.5 flex-shrink-0" />
                        <div className="text-muted-foreground">
                          <div>Weekday: {outlet.hours.weekday}</div>
                          <div>Weekend: {outlet.hours.weekend}</div>
                        </div>
                      </div>
                    )}
                    {outlet.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-gold-600 flex-shrink-0" />
                        <a href={`tel:${outlet.phone}`} className="text-gold-700 hover:underline">
                          {outlet.phone}
                        </a>
                      </div>
                    )}
                    {outlet.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-gold-600 flex-shrink-0" />
                        <a href={`mailto:${outlet.email}`} className="text-gold-700 hover:underline">
                          {outlet.email}
                        </a>
                      </div>
                    )}
                  </div>
                  {outlet.features && outlet.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border/30">
                      {outlet.features.map((feat, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gold-500/15 text-gold-800 dark:text-gold-300"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>
                  )}
                  <a
                    href={outlet.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full text-center mt-2 px-3 py-1.5 text-xs font-medium rounded bg-espresso-800 hover:bg-espresso-900 text-cream-50 transition-colors"
                    data-testid={`map-directions-link-${outlet.id}`}
                  >
                    Buka di Google Maps
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
