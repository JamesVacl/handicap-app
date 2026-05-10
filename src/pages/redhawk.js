import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getPlayers,
  getScores,
  signIn,
  signOutUser,
  getRedhawkAdjustments,
  saveRedhawkAdjustment,
  deleteRedhawkAdjustment,
} from 'src/firebase';
import NavigationMenu from 'src/components/NavigationMenu';

// ─── Handicap math (mirrors index.js — read-only, no writes) ─────────────────
const MAX_RECENT_ROUNDS = 20;
const DIFFERENTIALS_USED_COUNT = 8;

const getScoreDateMs = (scoreDate) => {
  if (!scoreDate) return 0;
  if (typeof scoreDate.toMillis === 'function') return scoreDate.toMillis();
  if (typeof scoreDate.seconds === 'number') return scoreDate.seconds * 1000;
  if (scoreDate instanceof Date) return scoreDate.getTime();
  const parsed = new Date(scoreDate).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const computeHandicaps = (scores) => {
  const playerScores = {};
  scores.forEach((score) => {
    if (!playerScores[score.player]) playerScores[score.player] = [];
    playerScores[score.player].push(score);
  });

  return Object.keys(playerScores).map((name) => {
    const eligible = playerScores[name]
      .filter((s) => s.differential !== null && (s.holeType === '18' || s.isComposed))
      .sort((a, b) => getScoreDateMs(b.date) - getScoreDateMs(a.date))
      .slice(0, MAX_RECENT_ROUNDS);

    const lowest = [...eligible]
      .sort((a, b) => {
        if (a.differential === b.differential)
          return getScoreDateMs(b.date) - getScoreDateMs(a.date);
        return a.differential - b.differential;
      })
      .slice(0, DIFFERENTIALS_USED_COUNT);

    const handicap =
      lowest.length > 0
        ? parseFloat(
            (lowest.reduce((acc, s) => acc + s.differential, 0) / lowest.length).toFixed(1)
          )
        : 0;

    return { name, handicap };
  });
};
// ─────────────────────────────────────────────────────────────────────────────

export default function RedhawkTrials() {
  // Auth
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Data
  const [baseHandicaps, setBaseHandicaps] = useState([]); // [{ name, handicap }]
  const [adjustments, setAdjustments] = useState({});     // { playerName: { delta, notes } }
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Edit panel
  const [editing, setEditing] = useState(null); // player name being edited
  const [draftDelta, setDraftDelta] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);

  // ── Auth listener ───────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => setAuthenticated(!!user));
    return () => unsub();
  }, []);

  // Restore remembered email
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('guyscorp_email');
      const savedRemember = localStorage.getItem('guyscorp_remember');
      if (savedEmail && savedRemember === 'true') {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (_) {}
  }, []);

  // ── Load data when authenticated ────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const [scores, adjMap] = await Promise.all([getScores(), getRedhawkAdjustments()]);
      const computed = computeHandicaps(scores);
      computed.sort((a, b) => a.handicap - b.handicap);
      setBaseHandicaps(computed);
      setAdjustments(adjMap);
      setLoading(false);
    };

    load();
  }, [authenticated]);

  // ── Manual refresh ──────────────────────────────────────────────────────────
  const refreshData = async () => {
    if (!authenticated || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [scores, adjMap] = await Promise.all([getScores(), getRedhawkAdjustments()]);
      const computed = computeHandicaps(scores);
      computed.sort((a, b) => a.handicap - b.handicap);
      setBaseHandicaps(computed);
      setAdjustments(adjMap);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error refreshing Redhawk data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Close edit panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setEditing(null);
      }
    };
    if (editing) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      if (rememberMe) {
        localStorage.setItem('guyscorp_email', email);
        localStorage.setItem('guyscorp_remember', 'true');
      } else {
        localStorage.removeItem('guyscorp_email');
        localStorage.removeItem('guyscorp_remember');
      }
    } catch (_) {
      alert('Authentication failed!');
    }
  };

  const openEdit = (player) => {
    const existing = adjustments[player.name];
    setDraftDelta(existing ? String(existing.delta) : '');
    setDraftNotes(existing ? (existing.notes || '') : '');
    setEditing(player.name);
  };

  const handleSave = async () => {
    if (draftDelta === '' || isNaN(parseFloat(draftDelta))) {
      alert('Please enter a valid adjustment value (e.g. +1.5 or -2).');
      return;
    }
    setSaving(true);
    await saveRedhawkAdjustment(editing, parseFloat(draftDelta), draftNotes);
    const updated = await getRedhawkAdjustments();
    setAdjustments(updated);
    setSaving(false);
    setEditing(null);
  };

  const handleClear = async () => {
    setSaving(true);
    await deleteRedhawkAdjustment(editing);
    const updated = await getRedhawkAdjustments();
    setAdjustments(updated);
    setSaving(false);
    setEditing(null);
  };

  // ── Derived leaderboard ─────────────────────────────────────────────────────
  const leaderboard = baseHandicaps
    .map((p) => {
      const adj = adjustments[p.name];
      const delta = adj ? adj.delta : 0;
      return {
        ...p,
        delta,
        notes: adj ? adj.notes : '',
        adjusted: parseFloat((p.handicap + delta).toFixed(1)),
        hasAdjustment: !!adj,
      };
    })
    .sort((a, b) => a.adjusted - b.adjusted);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Guyscorp Golf — Redhawk Trials</title>
        <meta
          name="description"
          content="Redhawk Trials handicap adjustments for the Guyscorp golf group."
        />
      </Head>

      <div className="app-wrapper">
        {authenticated && <NavigationMenu />}

        <div className="home-container">
          <div className="overlay" />

          <div className="content redhawk-content">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="redhawk-header">
              <div className="rh-rv-icon">
                <Image
                  src="/redhawk-rv.png"
                  alt="Jayco Redhawk RV"
                  width={90}
                  height={90}
                  style={{ objectFit: 'contain' }}
                />
              </div>
              <div>
                <h1 className="redhawk-title">Redhawk Trials</h1>
                <p className="redhawk-subtitle">
                  Post-season handicap adjustments — base scores remain untouched
                </p>
              </div>
            </div>

            {/* ── Auth gate ───────────────────────────────────────────────── */}
            {!authenticated ? (
              <div className="auth-container">
                <form onSubmit={handleSignIn} className="d-flex flex-column align-items-center mb-8 auth-form">
                  <input
                    type="email"
                    placeholder="Enter Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mb-4 p-3 form-control w-50"
                  />
                  <input
                    type="password"
                    placeholder="Enter Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mb-4 p-3 form-control w-50"
                  />
                  <div className="form-check mb-3 w-50">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="rememberMeRedhawk"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="rememberMeRedhawk">
                      Remember me (stay logged in)
                    </label>
                  </div>
                  <button type="submit" className="btn btn-success w-50">
                    Sign In
                  </button>
                </form>
              </div>
            ) : loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Loading…</span>
                </div>
                <p className="text-muted mt-3">Loading handicap data…</p>
              </div>
            ) : (
              <>
                {/* ── Legend + Refresh ─────────────────────────────────────── */}
                <div className="redhawk-legend">
                  <span className="rh-badge rh-badge-improved">▼ Easier</span>
                  <span className="rh-badge rh-badge-harder">▲ Harder</span>
                  <span className="rh-badge rh-badge-none">— No change</span>
                  <div className="rh-legend-right">
                    {lastUpdated && (
                      <span className="rh-last-updated">
                        Updated {lastUpdated.toLocaleTimeString()}
                      </span>
                    )}
                    <button
                      className="rh-refresh-btn"
                      onClick={refreshData}
                      disabled={isRefreshing}
                      title="Refresh handicaps from latest scores"
                    >
                      {isRefreshing ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                          Refreshing…
                        </>
                      ) : (
                        <>↻ Refresh Handicaps</>
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Leaderboard table ──────────────────────────────────────── */}
                <div className="table-responsive-wrapper">
                  <table className="table table-bordered table-hover rh-table">
                    <thead>
                      <tr>
                        <th className="rh-col-rank">#</th>
                        <th className="rh-col-player">Player</th>
                        <th className="rh-col-base text-center">Base HCP</th>
                        <th className="rh-col-delta text-center">Trial Adj.</th>
                        <th className="rh-col-adjusted text-center">Adjusted HCP</th>
                        <th className="rh-col-notes">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((player, idx) => {
                        const deltaSign = player.delta > 0 ? '+' : '';
                        const dirClass =
                          player.delta < 0
                            ? 'rh-row-improved'
                            : player.delta > 0
                            ? 'rh-row-harder'
                            : '';

                        return (
                          <tr
                            key={player.name}
                            className={`rh-player-row ${dirClass}`}
                            onClick={() => openEdit(player)}
                            title="Click to edit adjustment"
                          >
                            <td className="rh-col-rank text-center fw-semibold text-muted">
                              {idx + 1}
                            </td>
                            <td className="rh-col-player fw-semibold">{player.name}</td>
                            <td className="rh-col-base text-center text-muted">
                              {player.handicap.toFixed(1)}
                            </td>
                            <td className="rh-col-delta text-center">
                              {player.hasAdjustment ? (
                                <span
                                  className={`rh-delta-badge ${
                                    player.delta < 0
                                      ? 'rh-badge-improved'
                                      : 'rh-badge-harder'
                                  }`}
                                >
                                  {deltaSign}{player.delta.toFixed(1)}
                                </span>
                              ) : (
                                <span className="rh-delta-badge rh-badge-none">—</span>
                              )}
                            </td>
                            <td className="rh-col-adjusted text-center">
                              <span
                                className={`rh-adjusted-value ${
                                  player.delta < 0
                                    ? 'rh-adj-improved'
                                    : player.delta > 0
                                    ? 'rh-adj-harder'
                                    : ''
                                }`}
                              >
                                {player.adjusted.toFixed(1)}
                              </span>
                            </td>
                            <td className="rh-col-notes text-muted fst-italic">
                              {player.notes || ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Edit panel ─────────────────────────────────────────────── */}
                {editing && (
                  <div className="rh-panel-backdrop">
                    <div className="rh-edit-panel" ref={panelRef}>
                      <div className="rh-panel-header">
                        <span className="rh-panel-hawk">
                          <Image src="/redhawk-rv.png" alt="RV" width={28} height={28} style={{ objectFit: 'contain' }} />
                        </span>
                        <h3 className="rh-panel-title">Adjust: {editing}</h3>
                        <button
                          className="rh-panel-close"
                          onClick={() => setEditing(null)}
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="rh-panel-body">
                        {/* Current base handicap display */}
                        {(() => {
                          const base = baseHandicaps.find((p) => p.name === editing);
                          return (
                            <div className="rh-panel-base-display">
                              <span className="rh-panel-label">Base HCP</span>
                              <span className="rh-panel-base-val">
                                {base ? base.handicap.toFixed(1) : '—'}
                              </span>
                            </div>
                          );
                        })()}

                        <div className="rh-panel-field">
                          <label className="rh-panel-label" htmlFor="rh-delta-input">
                            Trial Adjustment (+ or −)
                          </label>
                          <div className="rh-delta-input-row">
                            <button
                              className="rh-stepper-btn"
                              onClick={() =>
                                setDraftDelta((v) =>
                                  String(parseFloat(v || 0) - 0.5)
                                )
                              }
                            >
                              −
                            </button>
                            <input
                              id="rh-delta-input"
                              type="number"
                              step="0.5"
                              placeholder="e.g. -1.5"
                              value={draftDelta}
                              onChange={(e) => setDraftDelta(e.target.value)}
                              className="form-control rh-delta-input"
                            />
                            <button
                              className="rh-stepper-btn"
                              onClick={() =>
                                setDraftDelta((v) =>
                                  String(parseFloat(v || 0) + 0.5)
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                          {draftDelta !== '' && !isNaN(parseFloat(draftDelta)) && (
                            <div className="rh-panel-preview">
                              Adjusted HCP →{' '}
                              <strong>
                                {(
                                  (baseHandicaps.find((p) => p.name === editing)
                                    ?.handicap || 0) + parseFloat(draftDelta)
                                ).toFixed(1)}
                              </strong>
                            </div>
                          )}
                        </div>

                        <div className="rh-panel-field">
                          <label className="rh-panel-label" htmlFor="rh-notes-input">
                            Notes (optional)
                          </label>
                          <textarea
                            id="rh-notes-input"
                            rows={3}
                            placeholder="e.g. Shot well under pressure at Redhawk"
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            className="form-control"
                          />
                        </div>

                        <div className="rh-panel-actions">
                          <button
                            className="btn btn-success rh-save-btn"
                            onClick={handleSave}
                            disabled={saving}
                          >
                            {saving ? 'Saving…' : '✓ Save Adjustment'}
                          </button>
                          {adjustments[editing] && (
                            <button
                              className="btn rh-clear-btn"
                              onClick={handleClear}
                              disabled={saving}
                            >
                              ✕ Remove Adjustment
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Footer disclaimer ─────────────────────────────────────── */}
                <p className="rh-disclaimer">
                  🔒 Base handicaps are calculated live from score history and are never
                  modified. Adjustments are stored separately in Redhawk Trials records.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
