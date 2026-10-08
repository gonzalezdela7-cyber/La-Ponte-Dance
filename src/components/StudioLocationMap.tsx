import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Car, Footprints, Train, RotateCcw, AlertCircle } from 'lucide-react';
import { CONFIGURACION_LA_PONTE_DANCE } from '../data/config.ts';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

function checkAndDispatchQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

interface ResolvedPlaceInfo {
  displayName: string;
  formattedAddress: string;
  location: google.maps.LatLngLiteral;
  googleMapsURI?: string;
}

interface RouteSummaryInfo {
  distanceText: string;
  durationText: string;
}

const MapInnerController: React.FC<{
  originPlace: ResolvedPlaceInfo | null;
  travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT';
  onStudioMunicipalityResolved: (info: ResolvedPlaceInfo) => void;
  onRouteComputed: (summary: RouteSummaryInfo | null) => void;
  onRouteError: (msg: string | null) => void;
}> = ({
  originPlace,
  travelMode,
  onStudioMunicipalityResolved,
  onRouteComputed,
  onRouteError,
}) => {
  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR } = CONFIGURACION_LA_PONTE_DANCE;
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [studioLocality, setStudioLocality] = useState<ResolvedPlaceInfo | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState<boolean>(true);
  const [studioMarkerRef, studioMarker] = useAdvancedMarkerRef();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Dynamically resolve confirmed municipality ("Torrijos, Toledo, España") via Places API (New)
  useEffect(() => {
    if (!placesLib || studioLocality) return;

    let isMounted = true;
    const resolveMunicipality = async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        const token = new AutocompleteSessionToken();
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: `${CONFIRMADO.localidad}, España`,
          sessionToken: token,
        });

        const firstSuggestion = res.suggestions?.[0]?.placePrediction;
        if (!firstSuggestion) return;

        const place = firstSuggestion.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport', 'googleMapsURI'],
        });

        if (!isMounted || !place.location) return;

        const lat =
          typeof place.location.lat === 'function'
            ? place.location.lat()
            : (place.location as unknown as google.maps.LatLngLiteral).lat;
        const lng =
          typeof place.location.lng === 'function'
            ? place.location.lng()
            : (place.location as unknown as google.maps.LatLngLiteral).lng;

        const resolved: ResolvedPlaceInfo = {
          displayName: place.displayName || CONFIRMADO.localidad,
          formattedAddress: place.formattedAddress || CONFIRMADO.localidad,
          location: { lat, lng },
          googleMapsURI: place.googleMapsURI || undefined,
        };

        setStudioLocality(resolved);
        onStudioMunicipalityResolved(resolved);

        if (map) {
          map.setCenter(resolved.location);
          map.setZoom(14);
        }
      } catch (err) {
        checkAndDispatchQuotaError(err);
        console.error('Error resolving municipality via Places API (New):', err);
      }
    };

    void resolveMunicipality();
    return () => {
      isMounted = false;
    };
  }, [placesLib, map]);

  // Compute route using modern Routes API JS SDK (Route.computeRoutes) when originPlace is selected
  useEffect(() => {
    if (!routesLib || !map || !studioLocality) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!originPlace) {
      onRouteComputed(null);
      onRouteError(null);
      return;
    }

    const AnyRoutesLib = routesLib as any;
    const RouteClass = AnyRoutesLib.Route;
    if (!RouteClass) return;

    onRouteError(null);

    const compute = async () => {
      try {
        const sdkTravelMode =
          AnyRoutesLib.TravelMode?.[travelMode] || travelMode;

        const request: any = {
          origin: originPlace.location,
          destination: studioLocality.location,
          travelMode: sdkTravelMode,
          fields: ['polyline', 'distanceMeters', 'duration', 'viewport'],
        };

        let response: any;
        if (typeof RouteClass.computeRoutes === 'function') {
          response = await RouteClass.computeRoutes(request);
        } else {
          const routeService = new RouteClass();
          response = await routeService.computeRoutes(request);
        }

        const route = response?.routes?.[0];
        if (!route) {
          onRouteError('No se encontró una ruta disponible para el modo seleccionado.');
          onRouteComputed(null);
          return;
        }

        // Render route polyline
        if (typeof route.createPolylines === 'function') {
          const polylines = route.createPolylines();
          if (polylines?.[0]) {
            polylines[0].setOptions({
              strokeColor: '#5C1329',
              strokeOpacity: 0.9,
              strokeWeight: 5,
              map,
            });
            polylineRef.current = polylines[0];
          }
        } else if (route.polyline?.encodedPolyline && typeof RouteClass.decode === 'function') {
          const path = RouteClass.decode(route.polyline.encodedPolyline);
          const poly = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#5C1329',
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map,
          });
          polylineRef.current = poly;
        } else if (route.path) {
          const poly = new google.maps.Polyline({
            path: route.path,
            geodesic: true,
            strokeColor: '#5C1329',
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map,
          });
          polylineRef.current = poly;
        }

        if (route.viewport) {
          map.fitBounds(route.viewport);
        }

        const km = route.distanceMeters
          ? `${(route.distanceMeters / 1000).toFixed(1)} km`
          : 'Distancia calculada';

        let durationText = 'Tiempo estimado';
        if (typeof route.durationMillis === 'number') {
          const mins = Math.max(1, Math.round(route.durationMillis / 60000));
          durationText = `${mins} min`;
        } else if (typeof route.duration === 'string') {
          const secs = parseInt(route.duration.replace('s', ''), 10);
          if (!isNaN(secs)) {
            durationText = `${Math.max(1, Math.round(secs / 60))} min`;
          }
        }

        onRouteComputed({ distanceText: km, durationText });
      } catch (err) {
        checkAndDispatchQuotaError(err);
        console.error('Error computing route:', err);
        onRouteError('No se pudo calcular la ruta para este trayecto.');
        onRouteComputed(null);
      }
    };

    void compute();

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [routesLib, map, studioLocality, originPlace, travelMode]);

  return (
    <>
      {studioLocality && (
        <>
          <AdvancedMarker
            ref={studioMarkerRef}
            position={studioLocality.location}
            onClick={() => setInfoWindowOpen(true)}
            title={`${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`}
          >
            <Pin background="#5C1329" borderColor="#222222" glyphColor="#FFFFFF" scale={1.25} />
          </AdvancedMarker>

          {infoWindowOpen && studioMarker && (
            <InfoWindow
              anchor={studioMarker}
              maxWidth={260}
              onCloseClick={() => setInfoWindowOpen(false)}
            >
              <div className="p-1 space-y-1 text-[#222222]">
                <div className="font-semibold text-xs text-[#5C1329]">
                  {CONFIRMADO.nombre} · Localidad Confirmada
                </div>
                <div className="text-xs font-bold">{studioLocality.displayName}</div>
                <div className="text-[11px] text-[#222222]/75">
                  {studioLocality.formattedAddress}
                </div>
                <div className="text-[10px] bg-[#FBF8F6] border border-[#E8C5C8] rounded px-1.5 py-1 text-[#5C1329]">
                  Dirección exacta del local: <strong>{PENDIENTE_DE_CONFIRMAR.direccionExacta}</strong>
                </div>
              </div>
            </InfoWindow>
          )}
        </>
      )}

      {originPlace && (
        <AdvancedMarker
          position={originPlace.location}
          title={`Origen: ${originPlace.displayName}`}
        >
          <Pin background="#222222" borderColor="#5C1329" glyphColor="#E8C5C8" scale={1.1} />
        </AdvancedMarker>
      )}
    </>
  );
};

const OriginAutocompleteSearch: React.FC<{
  onSelectOrigin: (place: ResolvedPlaceInfo) => void;
  onClearOrigin: () => void;
  hasOrigin: boolean;
}> = ({ onSelectOrigin, onClearOrigin, hasOrigin }) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [inputValue, setInputValue] = useState<string>('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = inputValue.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let active = true;
    setLoading(true);

    AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: trimmed,
      sessionToken: sessionTokenRef.current,
      region: 'ES',
      language: 'es',
    })
      .then((res) => {
        if (!active) return;
        setSuggestions(res.suggestions || []);
        setLoading(false);
      })
      .catch((err) => {
        checkAndDispatchQuotaError(err);
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [placesLib, inputValue]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });

        sessionTokenRef.current = null;
        setSuggestions([]);

        if (!place.location) return;
        const lat =
          typeof place.location.lat === 'function'
            ? place.location.lat()
            : (place.location as unknown as google.maps.LatLngLiteral).lat;
        const lng =
          typeof place.location.lng === 'function'
            ? place.location.lng()
            : (place.location as unknown as google.maps.LatLngLiteral).lng;

        const label =
          place.displayName ||
          suggestion.placePrediction.text?.text ||
          place.formattedAddress ||
          'Origen seleccionado';

        setInputValue(label);
        onSelectOrigin({
          displayName: label,
          formattedAddress: place.formattedAddress || label,
          location: { lat, lng },
        });
      } catch (err) {
        checkAndDispatchQuotaError(err);
        console.error('Error fetching selected origin place fields:', err);
      }
    },
    [placesLib, onSelectOrigin]
  );

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu localidad o calle de salida (ej. Toledo, Fuensalida, Talavera...)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8C5C8] bg-white text-xs sm:text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#5C1329]">
              Buscando...
            </span>
          )}
        </div>
        {hasOrigin && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setSuggestions([]);
              onClearOrigin();
            }}
            className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-[#E8C5C8] bg-white text-xs font-semibold text-[#222222] hover:border-[#5C1329]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#5C1329]" />
            Limpiar
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E8C5C8] rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-[#E8C5C8]/50">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => void handleSelectSuggestion(s)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-[#222222] hover:bg-[#FBF8F6] flex items-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-[#5C1329] shrink-0" />
                <span className="truncate">{s.placePrediction?.text?.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const StudioLocationMap: React.FC = () => {
  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR } = CONFIGURACION_LA_PONTE_DANCE;

  const [resolvedMunicipality, setResolvedMunicipality] = useState<ResolvedPlaceInfo | null>(
    null
  );
  const [originPlace, setOriginPlace] = useState<ResolvedPlaceInfo | null>(null);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'TRANSIT'>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummaryInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  if (!MAPS_API_KEY) {
    return (
      <div className="rounded-2xl border border-[#E8C5C8] bg-[#FBF8F6] p-6 text-xs text-[#222222]/80">
        Mapa interactivo pendiente de clave de configuración (`VITE_GOOGLE_MAPS_API_KEY`). Localidad oficial confirmada: <strong>{CONFIRMADO.localidad}</strong> ({PENDIENTE_DE_CONFIRMAR.direccionExacta}).
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={MAPS_API_KEY}
      language="es"
      region="ES"
      libraries={['places', 'marker', 'routes']}
    >
      <div className="rounded-2xl border border-[#E8C5C8] bg-white overflow-hidden shadow-xs">
        {/* Top Controls: Municipality Status + Route Planner */}
        <div className="p-4 sm:p-6 bg-[#FBF8F6] border-b border-[#E8C5C8] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#5C1329] flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                Ubicación y Cálculo de Ruta en Google Maps Platform
              </div>
              <h3 className="text-xl font-bold text-[#222222] mt-0.5">
                Cómo llegar a {CONFIRMADO.localidad} ({CONFIRMADO.nombre})
              </h3>
              <p className="text-xs text-[#222222]/75">
                Localidad confirmada: <strong>{CONFIRMADO.localidad}</strong> · Dirección exacta del centro:{' '}
                <span className="text-[#5C1329] font-semibold">
                  {PENDIENTE_DE_CONFIRMAR.direccionExacta}
                </span>
              </p>
            </div>

            {/* Travel Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E8C5C8] self-start">
              <button
                type="button"
                onClick={() => setTravelMode('DRIVING')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  travelMode === 'DRIVING'
                    ? 'bg-[#5C1329] text-white'
                    : 'text-[#222222]/75 hover:text-[#222222]'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                Coche
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('WALKING')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  travelMode === 'WALKING'
                    ? 'bg-[#5C1329] text-white'
                    : 'text-[#222222]/75 hover:text-[#222222]'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                A pie
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('TRANSIT')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  travelMode === 'TRANSIT'
                    ? 'bg-[#5C1329] text-white'
                    : 'text-[#222222]/75 hover:text-[#222222]'
                }`}
              >
                <Train className="w-3.5 h-3.5" />
                Transporte
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <OriginAutocompleteSearch
              onSelectOrigin={(place) => setOriginPlace(place)}
              onClearOrigin={() => {
                setOriginPlace(null);
                setRouteSummary(null);
                setRouteError(null);
              }}
              hasOrigin={Boolean(originPlace)}
            />

            {routeSummary && originPlace && (
              <div className="px-4 py-2.5 rounded-xl bg-[#5C1329] text-white text-xs font-semibold flex items-center gap-3 shrink-0">
                <span>Distancia: {routeSummary.distanceText}</span>
                <span aria-hidden="true">·</span>
                <span>Tiempo aprox.: {routeSummary.durationText}</span>
              </div>
            )}
          </div>

          {routeError && (
            <div className="flex items-center gap-2 text-xs text-[#5C1329] bg-[#5C1329]/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{routeError}</span>
            </div>
          )}
        </div>

        {/* Explicit Height Map Container (CF2 & CF9) */}
        <div className="h-[420px] w-full relative">
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: 39.98, lng: -4.28 }}
            defaultZoom={11}
            gestureHandling="cooperative"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            <MapInnerController
              originPlace={originPlace}
              travelMode={travelMode}
              onStudioMunicipalityResolved={setResolvedMunicipality}
              onRouteComputed={setRouteSummary}
              onRouteError={setRouteError}
            />
          </Map>
        </div>

        {/* Compliance & Attribution Footer */}
        <div className="px-4 py-2.5 bg-[#FBF8F6] border-t border-[#E8C5C8] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#222222]/70">
          <div>
            Municipio verificado con Google Places API (New):{' '}
            <strong>{resolvedMunicipality?.formattedAddress || CONFIRMADO.localidad}</strong>
          </div>
          <div className="flex items-center gap-3">
            {resolvedMunicipality?.googleMapsURI && (
              <a
                href={resolvedMunicipality.googleMapsURI}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C1329] font-semibold hover:underline"
              >
                Abrir {CONFIRMADO.localidad} en Google Maps
              </a>
            )}
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Términos de Google Maps
            </a>
          </div>
        </div>
      </div>
    </APIProvider>
  );
};
