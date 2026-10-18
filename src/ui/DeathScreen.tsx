import React from 'react';
import { Skull, RotateCcw } from 'lucide-react';

interface DeathScreenProps {
  survivedSeconds: number;
  infectedKilled: number;
  causeOfDeath: string;
  onRespawn: () => void;
}

export const DeathScreen: React.FC<DeathScreenProps> = ({
  survivedSeconds,
  infectedKilled,
  causeOfDeath,
  onRespawn,
}) => {
  const survivedMinutes = Math.max(1, Math.round(survivedSeconds / 60));
  const exactMins = Math.floor(survivedSeconds / 60);
  const exactSecs = Math.floor(survivedSeconds % 60);

  return (
    <div className="fixed inset-0 z-50 bg-[#07090c]/96 flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full border border-red-900/50 bg-[#0d1117] p-8 rounded flex flex-col items-center text-center gap-6">
        <Skull className="w-12 h-12 text-red-600 stroke-[1.5]" />

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">YOU ARE DEAD</h1>
          <p className="text-xs text-red-400 font-mono">Cause of Death: {causeOfDeath || 'Exposure & Trauma'}</p>
        </div>

        <div className="w-full py-4 px-5 bg-[#090c10] border border-white/10 rounded flex flex-col gap-1.5">
          <div className="text-lg font-semibold text-amber-400 font-mono tabular-nums">
            Survived {survivedMinutes} min, killed {infectedKilled}
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            Exact Duration: {exactMins}m {exactSecs}s · Permadeath Active
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Everything you carried has been lost to the island. You will wash ashore on a random stretch of gravel beach
          with only a road flare and a sterile rag.
        </p>

        <button
          onClick={onRespawn}
          className="w-full py-3 px-5 bg-red-700 hover:bg-red-600 text-white font-semibold text-sm rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Awaken on a Random Beach
        </button>
      </div>
    </div>
  );
};
