import { haversineMeters, isPlausibleJump } from '@/utils/geo';
import type { RoutePoint } from '@/types';

export type TrackerStatus = 'idle' | 'active' | 'paused' | 'finished';

export interface TrackerState {
  status: TrackerStatus;
  startedAt: number | null; // epoch ms
  finishedAt: number | null;
  route: RoutePoint[];
  distanceMeters: number;
  pausedMs: number;
  pauseStartedAt: number | null;
}

export const initialTrackerState: TrackerState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  route: [],
  distanceMeters: 0,
  pausedMs: 0,
  pauseStartedAt: null,
};

export type TrackerAction =
  | { type: 'START'; now: number }
  | {
      type: 'ADD_POINT';
      now: number;
      lat: number;
      lng: number;
      accuracy?: number | null; // raio de incerteza da leitura, em metros
    }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'FINISH'; now: number }
  | { type: 'RESET' };

// Leituras com incerteza maior que isto são descartadas. Ao ligar o GPS, as
// primeiras posições costumam vir com dezenas de metros de erro e "pulam" até
// estabilizar: parada, a corrida ganhava ~8 m no primeiro segundo e era salva
// como corrida de verdade. 20 m é folgado para GPS a céu aberto (3–10 m).
export const MAX_ACCURACY_M = 20;

// Reducer puro: toda a lógica de estado da corrida, sem tocar em GPS nem em
// temporizador. O hook «useRunTracker» só liga isto aos eventos reais.
export function trackerReducer(state: TrackerState, action: TrackerAction): TrackerState {
  switch (action.type) {
    case 'START':
      return { ...initialTrackerState, status: 'active', startedAt: action.now };

    case 'ADD_POINT': {
      if (state.status !== 'active' || state.startedAt === null) return state;
      if (action.accuracy != null && action.accuracy > MAX_ACCURACY_M) return state;
      const point: RoutePoint = {
        lat: action.lat,
        lng: action.lng,
        t: action.now - state.startedAt,
      };
      const last = state.route[state.route.length - 1];
      if (!last) return { ...state, route: [point] };
      if (!isPlausibleJump(last, point)) return state; // salto de GPS: ignora o ponto inteiro
      const step = haversineMeters(last, point);
      // Deslocamento menor que a incerteza da leitura é ruído, não movimento: parada,
      // a posição "anda" alguns metros dentro da margem de erro (visto no iPhone:
      // 5 m salvos em 30 s parada, com precisão de 6 a 11 m). Só conta quando se
      // afasta mais que a margem de erro do último ponto aceito.
      if (action.accuracy != null && step < action.accuracy) return state;
      return {
        ...state,
        route: [...state.route, point],
        distanceMeters: state.distanceMeters + step,
      };
    }

    case 'PAUSE':
      return state.status === 'active'
        ? { ...state, status: 'paused', pauseStartedAt: action.now }
        : state;

    case 'RESUME':
      if (state.status !== 'paused' || state.pauseStartedAt === null) return state;
      return {
        ...state,
        status: 'active',
        pausedMs: state.pausedMs + (action.now - state.pauseStartedAt),
        pauseStartedAt: null,
      };

    case 'FINISH': {
      if (state.status !== 'active' && state.status !== 'paused') return state;
      const extraPause =
        state.status === 'paused' && state.pauseStartedAt
          ? action.now - state.pauseStartedAt
          : 0;
      return {
        ...state,
        status: 'finished',
        finishedAt: action.now,
        pausedMs: state.pausedMs + extraPause,
        pauseStartedAt: null,
      };
    }

    case 'RESET':
      return initialTrackerState;

    default:
      return state;
  }
}

// Segundos decorridos de corrida de verdade (sem contar as pausas), até "now".
export function elapsedSeconds(state: TrackerState, now: number): number {
  if (state.startedAt === null) return 0;
  const end = state.finishedAt ?? now;
  const ongoingPause =
    state.status === 'paused' && state.pauseStartedAt ? now - state.pauseStartedAt : 0;
  return Math.max(0, (end - state.startedAt - state.pausedMs - ongoingPause) / 1000);
}
