"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type MapPoint = {
  id: string;
  kind: "agent" | "incident";
  label: string;
  detail: string;
  timestamp: string | null;
  latitude: number;
  longitude: number;
};

type GoogleLiveMapProps = {
  points: MapPoint[];
  emptyMessage: string;
  fallback: ReactNode;
};

declare global {
  interface Window {
    google?: any;
    __picsNigeriaGoogleMapsLoader?: Promise<any>;
  }
}

function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (window.__picsNigeriaGoogleMapsLoader) {
    return window.__picsNigeriaGoogleMapsLoader;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  window.__picsNigeriaGoogleMapsLoader = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-pics-google-maps="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google.maps), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.picsGoogleMaps = "true";
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }

      reject(new Error("Google Maps loaded without the expected API."));
    };
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return window.__picsNigeriaGoogleMapsLoader;
}

function getMapTypeForPoints(points: MapPoint[]) {
  if (points.some((point) => point.kind === "incident")) {
    return "hybrid";
  }

  return "satellite";
}

export function GoogleLiveMap({ points, emptyMessage, fallback }: GoogleLiveMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  const normalizedPoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
    [points],
  );

  useEffect(() => {
    let mounted = true;

    loadGoogleMaps()
      .then(() => {
        if (mounted) {
          setGoogleMapsReady(true);
          setLoadError("");
        }
      })
      .catch((caughtError) => {
        if (mounted) {
          setGoogleMapsReady(false);
          setLoadError(caughtError instanceof Error ? caughtError.message : "Google Maps could not be loaded.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!googleMapsReady || !mapRef.current || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    const googleMaps = window.google.maps;
    const map = new googleMaps.Map(mapRef.current, {
      center: { lat: 9.082, lng: 8.6753 },
      zoom: normalizedPoints.length > 1 ? 10 : 14,
      mapTypeId: getMapTypeForPoints(normalizedPoints),
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: "greedy",
      clickableIcons: false,
      tilt: 45,
    });

    const bounds = new googleMaps.LatLngBounds();
    const infoWindow = new googleMaps.InfoWindow();

    normalizedPoints.forEach((point) => {
      const marker = new googleMaps.Marker({
        map,
        position: { lat: point.latitude, lng: point.longitude },
        title: point.label,
        icon:
          point.kind === "agent"
            ? undefined
            : {
                path: googleMaps.SymbolPath.CIRCLE,
                fillColor: "#c63d2f",
                fillOpacity: 0.95,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                scale: 8,
              },
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          [
            `<strong>${point.label}</strong>`,
            point.detail,
            point.timestamp ? new Date(point.timestamp).toLocaleString() : "",
          ]
            .filter(Boolean)
            .join("<br />"),
        );
        infoWindow.open({ map, anchor: marker });
      });

      bounds.extend(marker.getPosition());
    });

    if (normalizedPoints.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(16);
    } else if (normalizedPoints.length > 1) {
      map.fitBounds(bounds, 48);
    }
  }, [googleMapsReady, normalizedPoints]);

  if (!googleMapsReady || loadError) {
    return (
      <div>
        {loadError ? <p className="muted">Google Maps unavailable: {loadError} Using fallback map.</p> : null}
        {fallback}
      </div>
    );
  }

  return (
    <div className="google-live-map-shell">
      {normalizedPoints.length === 0 ? (
        <div className="live-map-empty">
          <strong>{emptyMessage}</strong>
        </div>
      ) : null}
      <div
        ref={mapRef}
        className="google-live-map-canvas"
        style={{ display: normalizedPoints.length === 0 ? "none" : "block" }}
      />
    </div>
  );
}
