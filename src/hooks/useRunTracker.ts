import * as Location from 'expo-location';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { averagePaceSecPerKm, haversineMeters, simplifyRoute } from '@/utils/geo';
import { elapsedSeconds, initialTrackerState, trackerReducer } from '@/utils/tracker';
import type { SaveRunInput } from '@/types';

// Liga o reducer puro (utils/tracker.ts) ao GPS de verdade e a um relógio de
// 1 em 1 segundo. A lógica de "o que fazer com cada evento" já está testada
// no reducer; aqui só existe o encanamento com o sensor do aparelho.
export function useRunTracker() {
  const [state, dispatch] = useReducer(trackerReducer, initialTrackerState);
  const [now, setNow] = useState(() => Date.now());
  const [permissionDenied, setPermissionDenied] = useState(false);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  // Apenas para diagnóstico: não participa da lógica que valida pontos de GPS.
  const previousRawLocation = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    if (state.status !== 'active') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  const stopWatching = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  useEffect(() => stopWatching, [stopWatching]);

  const startWatching = useCallback(async () => {
    previousRawLocation.current = null;
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        // Diagnóstico E19: registra distâncias e incerteza, nunca coordenadas.
        // O algoritmo de aceitação permanece exclusivamente no trackerReducer.
        const previous = previousRawLocation.current;
        if (__DEV__) {
          const stepMeters = previous
            ? haversineMeters(
                {
                  lat: previous.coords.latitude,
                  lng: previous.coords.longitude,
                  t: previous.timestamp,
                },
                { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp },
              )
            : null;
          console.log('[GPS_RAW]', {
            accuracyM: loc.coords.accuracy?.toFixed(1) ?? null,
            speedMps: loc.coords.speed?.toFixed(2) ?? null,
            stepM: stepMeters?.toFixed(1) ?? null,
            intervalS: previous
              ? ((loc.timestamp - previous.timestamp) / 1000).toFixed(1)
              : null,
          });
        }
        previousRawLocation.current = loc;
        dispatch({
          type: 'ADD_POINT',
          now: loc.timestamp,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
      },
    );
    subscription.current = sub;
  }, []);

  const start = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      return false;
    }
    setPermissionDenied(false);
    dispatch({ type: 'START', now: Date.now() });
    await startWatching();
    return true;
  }, [startWatching]);

  const pause = useCallback(() => {
    stopWatching();
    dispatch({ type: 'PAUSE', now: Date.now() });
  }, [stopWatching]);

  const resume = useCallback(async () => {
    dispatch({ type: 'RESUME', now: Date.now() });
    await startWatching();
  }, [startWatching]);

  // Encerra a corrida e devolve os dados prontos para salvar no Supabase.
  const finish = useCallback(
    (spotifyTrackName: string | null): SaveRunInput | null => {
      stopWatching();
      const at = Date.now();
      dispatch({ type: 'FINISH', now: at });
      if (state.startedAt === null) return null;
      return {
        startedAt: new Date(state.startedAt).toISOString(),
        endedAt: new Date(at).toISOString(),
        distanceMeters: state.distanceMeters,
        durationSeconds: Math.round(
          elapsedSeconds({ ...state, status: 'finished', finishedAt: at }, at),
        ),
        route: simplifyRoute(state.route),
        spotifyTrackName,
      };
    },
    [state, stopWatching],
  );

  const reset = useCallback(() => {
    stopWatching();
    dispatch({ type: 'RESET' });
  }, [stopWatching]);

  // Registra somente pontos efetivamente aceitos, para comparação com GPS_RAW.
  useEffect(() => {
    if (__DEV__ && state.route.length > 0) {
      console.log('[GPS_ACEITO]', {
        pontos: state.route.length,
        distanciaTotalM: Number(state.distanceMeters.toFixed(1)),
      });
    }
  }, [state.route, state.distanceMeters]);

  const seconds = elapsedSeconds(state, now);

  return {
    status: state.status,
    route: state.route,
    distanceMeters: state.distanceMeters,
    elapsedSeconds: seconds,
    pace: averagePaceSecPerKm(state.distanceMeters, seconds),
    permissionDenied,
    start,
    pause,
    resume,
    finish,
    reset,
  };
}
