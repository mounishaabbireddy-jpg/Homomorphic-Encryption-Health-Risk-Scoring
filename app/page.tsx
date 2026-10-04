"use client";

import { useState, useEffect, useCallback } from "react";
import {
  initializeHE,
  encryptVitals,
  serverCompute,
  decryptResult,
  plaintextScore,
  MODEL_WEIGHTS,
  FEATURE_NAMES,
  type HEContext,
  type EncryptedVitals,
  type TimingInfo,
} from "../lib/he";

// ── Feature configs ─────────────────────────────────────────────────────────
const FEATURE_CONFIGS = [
  { name: "Age", min: 18, max: 100, step: 1, default: 45, unit: "years" },
  { name: "BMI", min: 10, max: 50, step: 0.5, default: 27.5, unit: "kg/m2" },
  {
    name: "Blood Pressure",
    min: 80,
    max: 200,
    step: 1,
    default: 130,
    unit: "mmHg",
  },
  {
    name: "Glucose",
    min: 50,
    max: 300,
    step: 1,
    default: 110,
    unit: "mg/dL",
  },
];

export default function Home() {
  // ── State ───────────────────────────────────────────────────────────────
  const [heCtx, setHeCtx] = useState<HEContext | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [vitals, setVitals] = useState(FEATURE_CONFIGS.map((f) => f.default));
  const [encrypted, setEncrypted] = useState<EncryptedVitals | null>(null);
  const [heScore, setHeScore] = useState<number | null>(null);
  const [ptScore, setPtScore] = useState<number | null>(null);
  const [timings, setTimings] = useState<Partial<TimingInfo>>({});
  const [isComputing, setIsComputing] = useState(false);
  const [step, setStep] = useState(0); // 0=init, 1=ready, 2=encrypted, 3=computed, 4=decrypted

  // ── Initialize HE on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setIsInitializing(true);
      try {
        const { heCtx: ctx, keygenMs, publicKeySizeBytes } = await initializeHE();
        setHeCtx(ctx);
        setTimings((t) => ({ ...t, keygenMs, publicKeySizeBytes }));
        setStep(1);
      } catch (e) {
        setInitError(String(e));
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  // ── Run the full pipeline ──────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (!heCtx) return;
    setIsComputing(true);
    setStep(1);

    // Small delay so UI updates
    await new Promise((r) => setTimeout(r, 50));

    try {
      // 1. Encrypt
      setStep(2);
      const { encrypted: enc, encryptMs } = encryptVitals(heCtx, vitals);
      setEncrypted(enc);
      setTimings((t) => ({ ...t, encryptMs, ciphertextSizeBytes: enc.sizeBytes }));

      await new Promise((r) => setTimeout(r, 50));

      // 2. Server compute
      setStep(3);
      const result = serverCompute(heCtx, enc);
      setTimings((t) => ({ ...t, computeMs: result.computeTimeMs }));

      await new Promise((r) => setTimeout(r, 50));

      // 3. Decrypt
      setStep(4);
      const { score, decryptMs } = decryptResult(heCtx, result);
      setHeScore(score);
      setTimings((t) => ({ ...t, decryptMs }));

      // 4. Plaintext baseline
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) plaintextScore(vitals);
      const plaintextUs = ((performance.now() - t0) / 1000) * 1000; // us
      const pt = plaintextScore(vitals);
      setPtScore(pt);
      setTimings((t) => ({ ...t, plaintextUs }));
    } catch (e) {
      setInitError(String(e));
    } finally {
      setIsComputing(false);
    }
  }, [heCtx, vitals]);

  // ── Render ─────────────────────────────────────────────────────────────
  const diff =
    heScore !== null && ptScore !== null ? Math.abs(heScore - ptScore) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xl">
            🔒
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Homomorphic Encryption Demo
            </h1>
            <p className="text-sm text-gray-400">
              Health-risk scoring on encrypted data — your vitals never leave
              your browser unencrypted
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Init status */}
        {isInitializing && (
          <div className="mb-8 p-4 rounded-xl bg-gray-800/50 border border-gray-700 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300">
              Initializing SEAL WASM &amp; generating encryption keys...
            </span>
          </div>
        )}
        {initError && (
          <div className="mb-8 p-4 rounded-xl bg-red-900/30 border border-red-700 text-red-300">
            Error: {initError}
          </div>
        )}

        {/* Three panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel 1: Inputs */}
          <div className="rounded-2xl bg-gray-800/40 border border-gray-700/50 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-900/40 to-cyan-900/40 border-b border-gray-700/50">
              <h2 className="font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Your Vitals (Plaintext)
              </h2>
            </div>
            <div className="p-5 space-y-5">
              {FEATURE_CONFIGS.map((feat, i) => (
                <div key={feat.name}>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm text-gray-300">{feat.name}</label>
                    <span className="text-sm font-mono text-emerald-400">
                      {vitals[i]} {feat.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={feat.min}
                    max={feat.max}
                    step={feat.step}
                    value={vitals[i]}
                    onChange={(e) => {
                      const v = [...vitals];
                      v[i] = parseFloat(e.target.value);
                      setVitals(v);
                    }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer
                               bg-gray-700 accent-emerald-500"
                  />
                </div>
              ))}

              <div className="pt-3 border-t border-gray-700/50">
                <p className="text-xs text-gray-500 mb-1">Model weights</p>
                <code className="text-xs text-gray-400">
                  [{MODEL_WEIGHTS.join(", ")}]
                </code>
                <p className="text-xs text-gray-500 mt-2">Formula</p>
                <code className="text-xs text-gray-400">
                  {"score = \u03A3(w\u1D62 \u00B7 v\u1D62)\u00B2"}
                </code>
              </div>

              <button
                onClick={runPipeline}
                disabled={!heCtx || isComputing}
                className="w-full py-3 rounded-xl font-semibold text-sm
                           bg-gradient-to-r from-emerald-600 to-cyan-600
                           hover:from-emerald-500 hover:to-cyan-500
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-200 shadow-lg shadow-emerald-900/30"
              >
                {isComputing
                  ? "Computing..."
                  : !heCtx
                    ? "Initializing..."
                    : "Encrypt & Compute"}
              </button>
            </div>
          </div>

          {/* Panel 2: Server View */}
          <div className="rounded-2xl bg-gray-800/40 border border-gray-700/50 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-orange-900/40 to-red-900/40 border-b border-gray-700/50">
              <h2 className="font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">
                  2
                </span>
                What the Server Sees
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {encrypted ? (
                <>
                  <Metric
                    label="Ciphertext Size"
                    value={`${encrypted.sizeBytes.toLocaleString()} chars (base64)`}
                    color="orange"
                  />
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      Hex preview (first 64 bytes)
                    </p>
                    <div className="p-3 rounded-lg bg-gray-900/80 border border-gray-700/50 font-mono text-[10px] text-orange-300 break-all leading-relaxed">
                      {encrypted.hexPreview}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/30">
                    <p className="text-xs text-red-400 font-medium">
                      🚫 No secret key
                    </p>
                    <p className="text-xs text-red-400/70 mt-1">
                      The server cannot decrypt this data. It computes blindly
                      on ciphertext.
                    </p>
                  </div>
                  {timings.publicKeySizeBytes && (
                    <Metric
                      label="Public Key Size"
                      value={`~${timings.publicKeySizeBytes.toLocaleString()} chars`}
                      color="gray"
                    />
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <div className="text-4xl mb-3">🔐</div>
                  <p className="text-sm">
                    Encrypt your vitals to see what the server receives
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel 3: Results */}
          <div className="rounded-2xl bg-gray-800/40 border border-gray-700/50 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-b border-gray-700/50">
              <h2 className="font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">
                  3
                </span>
                Results
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {heScore !== null && ptScore !== null ? (
                <>
                  <Metric
                    label="Decrypted HE Score"
                    value={heScore.toFixed(6)}
                    color="purple"
                    large
                  />
                  <Metric
                    label="Plaintext Baseline"
                    value={ptScore.toFixed(6)}
                    color="cyan"
                    large
                  />
                  <Metric
                    label="Error (|HE - PT|)"
                    value={diff!.toExponential(2)}
                    color={diff! < 1e-3 ? "green" : "red"}
                  />
                  {diff! < 1e-3 ? (
                    <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 text-xs font-medium">
                      ✅ Within 1e-3 tolerance
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-800/30 text-yellow-400 text-xs font-medium">
                      ⚠️ Error exceeds 1e-3 (CKKS approximate arithmetic)
                    </div>
                  )}

                  {/* Timings */}
                  <div className="pt-3 border-t border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-3 font-medium">
                      Performance
                    </p>
                    <div className="space-y-2">
                      {timings.keygenMs && (
                        <TimingRow
                          label="Key generation"
                          value={`${timings.keygenMs.toFixed(0)} ms`}
                        />
                      )}
                      {timings.encryptMs !== undefined && (
                        <TimingRow
                          label="Encrypt"
                          value={`${timings.encryptMs.toFixed(1)} ms`}
                        />
                      )}
                      {timings.computeMs !== undefined && (
                        <TimingRow
                          label="Server compute"
                          value={`${timings.computeMs.toFixed(1)} ms`}
                        />
                      )}
                      {timings.decryptMs !== undefined && (
                        <TimingRow
                          label="Decrypt"
                          value={`${timings.decryptMs.toFixed(1)} ms`}
                        />
                      )}
                      {timings.plaintextUs !== undefined && (
                        <TimingRow
                          label="Plaintext compute"
                          value={`${timings.plaintextUs.toFixed(1)} us`}
                        />
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm">
                    Results will appear here after computation
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline visualization */}
        {step > 0 && (
          <div className="mt-8 p-5 rounded-2xl bg-gray-800/30 border border-gray-700/50">
            <p className="text-xs text-gray-500 mb-4 font-medium">
              Encryption Pipeline
            </p>
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              <PipelineStep
                icon="🔑"
                label="Keygen"
                active={step >= 1}
                done={step >= 2}
              />
              <PipelineArrow active={step >= 2} />
              <PipelineStep
                icon="🔐"
                label="Encrypt"
                active={step >= 2}
                done={step >= 3}
              />
              <PipelineArrow active={step >= 3} />
              <PipelineStep
                icon="⚙️"
                label="Compute"
                active={step >= 3}
                done={step >= 4}
              />
              <PipelineArrow active={step >= 4} />
              <PipelineStep
                icon="🔓"
                label="Decrypt"
                active={step >= 4}
                done={step >= 4}
              />
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard
            title="CKKS Scheme"
            desc="Approximate arithmetic on encrypted real numbers. 128-bit security with poly_modulus_degree=8192."
          />
          <InfoCard
            title="Zero Trust Server"
            desc="The server never possesses the secret key. It computes on ciphertext and returns encrypted results."
          />
          <InfoCard
            title="Runs in Browser"
            desc="Everything runs client-side using Microsoft SEAL compiled to WebAssembly. No data leaves your browser."
          />
        </div>
      </main>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color: string;
  large?: boolean;
}) {
  const colorMap: Record<string, string> = {
    orange: "text-orange-400",
    purple: "text-purple-400",
    cyan: "text-cyan-400",
    green: "text-emerald-400",
    red: "text-red-400",
    gray: "text-gray-400",
  };
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p
        className={`${large ? "text-2xl font-bold" : "text-sm font-semibold"} font-mono ${colorMap[color] ?? "text-gray-300"}`}
      >
        {value}
      </p>
    </div>
  );
}

function TimingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono text-gray-300">{value}</span>
    </div>
  );
}

function PipelineStep({
  icon,
  label,
  active,
  done,
}: {
  icon: string;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300
        ${done ? "bg-emerald-600/30 border-emerald-500" : active ? "bg-gray-700/50 border-gray-500 animate-pulse" : "bg-gray-800/50 border-gray-700"}
        border`}
      >
        {icon}
      </div>
      <span
        className={`text-[10px] font-medium ${done ? "text-emerald-400" : active ? "text-gray-300" : "text-gray-600"}`}
      >
        {label}
      </span>
    </div>
  );
}

function PipelineArrow({ active }: { active: boolean }) {
  return (
    <div
      className={`flex-1 h-0.5 mx-2 rounded transition-all duration-500 ${active ? "bg-emerald-500" : "bg-gray-700"}`}
    />
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
      <p className="text-sm font-semibold text-gray-300 mb-1">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </div>
  );
}
