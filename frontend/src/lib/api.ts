import type { SubscriberDTO, Tier } from '@shared';

export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface VillageResponse {
  world: { tile: number; width: number; height: number; seed: number; lunarMinDays: number; tiers: Array<{ tier: Tier; label: string; minDays: number }> };
  count: number;
  subscribers: SubscriberDTO[];
}
export interface StatsResponse { count: number; channelName: string; byTier: Record<Tier, number> }

/** fresh = bypass the CDN cache (used after a dropped live connection). */
export const getVillage = async (fresh = false): Promise<VillageResponse> => (await fetch(`${API}/api/village${fresh ? `?t=${Date.now()}` : ''}`)).json();
export const getStats = async (fresh = false): Promise<StatsResponse> => (await fetch(`${API}/api/stats${fresh ? `?t=${Date.now()}` : ''}`)).json();

export async function simulate(token: string, body: { count?: number; ageDays?: number; premium?: boolean }) {
  const res = await fetch(`${API}/api/admin/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`simulate failed: ${res.status}`);
  return res.json();
}

export function connectEvents(onVillager: (v: SubscriberDTO) => void, onReconnect: () => void): EventSource {
  const es = new EventSource(`${API}/api/events`);
  let opened = false;
  es.addEventListener('villager', (e) => onVillager(JSON.parse((e as MessageEvent).data)));
  es.addEventListener('reset', () => location.reload());
  es.onopen = () => { if (opened) onReconnect(); opened = true; };
  return es;
}
