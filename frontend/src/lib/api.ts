import { apiUrl } from './api-config';

export type Alert = {
  id: string;
  region: string;
  hazard: string;
  level: 'Waspada' | 'Siaga' | 'Awas';
  description: string;
  latitude: number;
  longitude: number;
  is_simulation: boolean;
};

export type AlertsResponse = { source: 'simulation' | 'database'; alerts: Alert[] };

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type BehaviorInput = {
  speed: number;
  speed_limit: number;
  harsh_braking?: number | boolean;
  harsh_acceleration?: number | boolean;
  sharp_turns?: number | boolean;
};
export type EnvironmentInput = {
  rainfall: number;
  visibility: number;
  road_condition: 'dry' | 'wet' | 'damaged' | 'flooded' | 'icy';
  slope: number;
  disaster_risk: number;
};
export type RiskInput = { fatigue_score: number; behavior_score: number; environment_score: number };
export type HealthResponse = { status: string; service: string; data_source: 'simulation' | 'database' };
export type BehaviorResponse = {
  behavior_score: number;
  risk_level: RiskLevel;
  details: { contributions: Record<string, number>; overspeed_ratio: number };
};
export type EnvironmentResponse = {
  environment_score: number;
  risk_level: RiskLevel;
  details: { component_scores: Record<string, number>; weights: Record<string, number>; contributions: Record<string, number> };
};
export type FatigueResponse = {
  max_closed_duration: number;
  perclos: number | null;
  closure_events: number;
  detection_rate: number;
  fatigue_score: number | null;
  fatigue_status: 'ALERT' | 'DROWSY' | 'FATIGUED' | 'INSUFFICIENT_DATA';
};
export type RiskResponse = {
  overall_risk_score: number;
  risk_level: RiskLevel;
  dominant_factor: 'fatigue' | 'behavior' | 'environment' | 'none';
  warning: string;
  component_breakdown: Record<'fatigue' | 'behavior' | 'environment', { score: number; weight: number; contribution: number }>;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('detail' in body)) return;
  const detail = body.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(item => {
      if (!item || typeof item !== 'object' || typeof item.msg !== 'string') return '';
      const location = Array.isArray(item.loc) ? item.loc.filter((part: unknown) => part !== 'body').join('.') : '';
      return `${location ? location + ': ' : ''}${item.msg}`;
    }).filter(Boolean).join('; ') || undefined;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('Tidak dapat terhubung ke backend. Periksa koneksi dan alamat API.');
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(errorDetail(body) || `Permintaan API gagal (HTTP ${response.status}).`, response.status);
  }
  return response.json();
}

function post<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
}

export function getAlerts(signal?: AbortSignal): Promise<AlertsResponse> {
  return request('alerts', { signal });
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request('health', { signal });
}

export function scoreBehavior(input: BehaviorInput, signal?: AbortSignal): Promise<BehaviorResponse> {
  return post('behavior', input, signal);
}

export function scoreEnvironment(input: EnvironmentInput, signal?: AbortSignal): Promise<EnvironmentResponse> {
  return post('environment', input, signal);
}

export function analyzeFatigue(video: File, signal?: AbortSignal): Promise<FatigueResponse> {
  const body = new FormData();
  body.append('file', video, video.name);
  // Browser sets Content-Type with the multipart boundary.
  return request('fatigue', { method: 'POST', body, signal });
}

export function fuseRisk(input: RiskInput, signal?: AbortSignal): Promise<RiskResponse> {
  return post('risk', input, signal);
}
