'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TILE, TIERS, LUNAR_MIN_DAYS, tierFor, ageDays, type SubscriberDTO } from '@shared';
import { connectEvents, getStats, getVillage, simulate, type StatsResponse } from '../lib/api';
import { EarthWorld } from '../lib/earth';
import Scene, { biomeOf, type Entry } from './Scene';
import MoonScene from './MoonScene';
import SpaceTransit from './SpaceTransit';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
function fmtAge(iso: string) {
  const d = ageDays(iso);
  if (d < 1) return 'joined today';
  if (d < 60) return `${d} day${d === 1 ? '' : 's'} in the village`;
  const m = Math.floor(d / 30.4);
  return m < 24 ? `${m} months in the village` : `${(d / 365).toFixed(1)} years in the village`;
}
const BIOME_LABEL: Record<string, string> = {
  emerald: 'Pine forest', golden: 'Golden grove', blossom: 'Blossom grove', blue: 'Blue taiga', lime: 'Flower meadow',
  snow: 'Snowfield', desert: 'Desert', swamp: 'Swamp', tropical: 'Tropical jungle', mountain: 'Mountain foothills',
};

export default function VillageApp() {
  const forest = useMemo(() => new EarthWorld(), []);
  useEffect(() => { if (process.env.NODE_ENV !== 'production') (window as unknown as { __forest: EarthWorld }).__forest = forest; }, [forest]); // debug hook
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selected, setSelected] = useState<SubscriberDTO | null>(null);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [adminToken, setAdminToken] = useState('');
  const [view, setView] = useState<'earth' | 'moon' | 'up' | 'down'>('earth'); // up/down = flying between the worlds
  const [arriveMoon, setArriveMoon] = useState(false);
  const [arriveEarth, setArriveEarth] = useState(false);
  const [banner, setBanner] = useState('');
  const [launchSignal, setLaunchSignal] = useState(0);
  const [returnSignal, setReturnSignal] = useState(0);
  const entriesRef = useRef<Entry[]>([]);
  entriesRef.current = entries;

  /** New villagers walk in from the forest edge, a few hundred pixels from where their house will stand. */
  const spawnPoint = useCallback((v: SubscriberDTO) => {
    const a = Math.random() * Math.PI * 2, d = 260 + Math.random() * 140;
    return { x: v.x * TILE + Math.cos(a) * d, y: v.y * TILE + Math.sin(a) * d };
  }, []);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 4500);
  }, []);

  // merge a fresh server snapshot (new villagers, premium / Moon changes) without disturbing running animations
  const refresh = useCallback(async () => {
    const vv = await getVillage(true);
    const byId = new Map(entriesRef.current.map((e) => [e.sub.id, e]));
    for (const s of vv.subscribers) if (!byId.has(s.id)) forest.clearYard(s.x, s.y);
    setEntries(vv.subscribers.map((s) => {
      const old = byId.get(s.id);
      return old?.mode === 'anim' ? { ...old, sub: s } : { sub: s, mode: 'built' as const };
    }));
    setStats(await getStats(true));
  }, [forest]);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      const [v, s] = await Promise.all([getVillage(), getStats()]);
      if (!alive) return;
      forest.init(v.subscribers);
      setEntries(v.subscribers.map((sub) => ({ sub, mode: 'built' as const })));
      setStats(s);
      setReady(true);
    })().catch((e) => console.error('load failed', e));
    const q = new URLSearchParams(location.search).get('admin');
    if (q) setAdminToken(q);
    return () => { alive = false; };
  }, [forest]);

  // live updates (SSE)
  useEffect(() => {
    if (!ready) return;
    const es = connectEvents(
      (v) => {
        if (entriesRef.current.some((e) => e.sub.id === v.id)) return;
        setEntries((es2) => [...es2, { sub: v, mode: 'anim', spawn: spawnPoint(v) }]);
        setStats((s) => (s ? { ...s, count: s.count + 1 } : s));
        showToast(`${v.name} joined the village!`);
      },
      () => { void refresh(); },
    );
    return () => es.close();
  }, [ready, spawnPoint, showToast, refresh]);

  // house tiers are recomputed from the subscribe date every minute
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(i); }, []);

  const tierOf = useCallback((s: SubscriberDTO) => tierFor(s.subscribedAt, now), [now]);
  const onBuilt = useCallback((id: number) => setEntries((es) => es.map((e) => (e.sub.id === id ? { ...e, mode: 'built' } : e))), []);
  const colonists = useMemo(() => entries.filter((e) => e.sub.moon).map((e) => e.sub), [entries]);

  // ---- travel: lift-off -> space flight -> landing, in both directions
  const arrive = useCallback(async (to: 'earth' | 'moon') => {
    if (to === 'moon') await refresh().catch(() => undefined);
    setSelected(null);
    setBanner('');
    if (to === 'moon') setArriveMoon(true); else setArriveEarth(true);
    setView(to);
  }, [refresh]);

  const sim = (body: { count?: number; ageDays?: number; premium?: boolean }) => simulate(adminToken, body).catch((e) => showToast(String(e)));
  const selTier = selected ? TIERS.find((t) => t.tier === tierFor(selected.subscribedAt, now)) : null;
  const onMoon = view === 'moon';
  const flying = view === 'up' || view === 'down';

  return (
    <>
      <div id="stage">
        {ready && view === 'earth' && (
          <Scene forest={forest} entries={entries} tierOf={tierOf} selected={selected} onSelect={setSelected} onBuilt={onBuilt}
            launchSignal={launchSignal} arrival={arriveEarth} onLaunchStart={() => setBanner('Ignition… lift-off!')}
            onLifted={() => { setBanner(''); setView('up'); }} onLanded={() => { setArriveEarth(false); setBanner(''); }} />
        )}
        {ready && view === 'moon' && (
          <MoonScene colonists={colonists} tierOf={tierOf} selected={selected} onSelect={setSelected}
            returnSignal={returnSignal} arrival={arriveMoon} onReturnStart={() => setBanner('Lift-off from the Moon…')}
            onLifted={() => { setBanner(''); setView('down'); }} onLanded={() => { setArriveMoon(false); setBanner(''); }} />
        )}
        {view === 'up' && <SpaceTransit direction="toMoon" onDone={() => void arrive('moon')} />}
        {view === 'down' && <SpaceTransit direction="toEarth" onDone={() => void arrive('earth')} />}
      </div>
      <div className={flying ? 'vignette off' : onMoon ? 'vignette moon' : 'vignette'} />
      {onMoon && <div className="earth-sky" title="Earth" />}
      <header id="hud" style={flying ? { opacity: 0 } : undefined}>
        <h1>{stats?.channelName ?? 'Jungle Village'}</h1>
        <div className="where">{onMoon ? '🌙 Moon colony' : '🌍 Earth'}</div>
        <div id="count">{onMoon ? `${colonists.length} colonist${colonists.length === 1 ? '' : 's'}` : `${entries.length} villager${entries.length === 1 ? '' : 's'}`}</div>
        {onMoon ? (
          <p className="note">Premium members and subscribers of {Math.round(LUNAR_MIN_DAYS / 365)}+ year live here, in space suits.</p>
        ) : (
          <ul id="legend">
            {TIERS.map((t) => (
              <li key={t.tier}>{t.label} — {t.minDays === 0 ? 'new' : t.minDays >= 365 ? `${t.minDays / 365 >= 2 ? '2 years' : '1 year'}+` : `${t.minDays} days+`}</li>
            ))}
          </ul>
        )}
        <button className="travel" disabled={flying || !!banner} onClick={() => (onMoon ? setReturnSignal((n) => n + 1) : setLaunchSignal((n) => n + 1))}>
          {onMoon ? '🌍 Return to Earth' : '🚀 Fly to the Moon'}
        </button>
        {!onMoon && <p className="hint">or click the rocket in the south-east desert</p>}
      </header>
      {!flying && (
        <div id="zoombar">
          <button aria-label="Zoom in" onClick={() => window.dispatchEvent(new CustomEvent('vv-zoom', { detail: 1.4 }))}>+</button>
          <button aria-label="Zoom out" onClick={() => window.dispatchEvent(new CustomEvent('vv-zoom', { detail: 1 / 1.4 }))}>−</button>
          <button aria-label="Reset view" onClick={() => window.dispatchEvent(new CustomEvent('vv-zoom', { detail: 'reset' }))}>⌂</button>
        </div>
      )}
      <div id="toast" className={toast ? 'show' : ''}>{toast}</div>
      {banner && <div id="banner">{banner}</div>}
      {selected && !flying && (
        <div id="popup">
          <div className="p-name">{selected.name}{selected.premium ? ' ★' : ''}</div>
          <div className="p-date">Subscribed {fmtDate(selected.subscribedAt)}</div>
          {onMoon ? (
            <div className="p-job">🌙 Moon colonist{selected.premium ? ' · premium member' : ''}</div>
          ) : (
            <div className="p-job">{BIOME_LABEL[biomeOf(selected)]}{selected.premium ? ' · ★ premium' : ''}{selected.moon ? ' · 🌙 colonist' : ''}</div>
          )}
          <div className="p-tier">{selTier?.label} · {fmtAge(selected.subscribedAt)}</div>
        </div>
      )}
      {adminToken && (
        <div id="admin">
          <b>Simulate</b>
          <button onClick={() => sim({ count: 1 })}>+1</button>
          <button onClick={() => sim({ count: 5 })}>+5</button>
          <button onClick={() => sim({ count: 20 })}>+20</button>
          <button onClick={() => sim({ count: 1, ageDays: 400 })}>+1 (1y old)</button>
          <button onClick={() => sim({ count: 1, premium: true })}>+1 ★ premium</button>
        </div>
      )}
      <div id="loading" className={ready ? 'done' : ''}>Waking the forest…</div>
    </>
  );
}
