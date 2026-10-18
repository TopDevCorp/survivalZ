import React, { useEffect, useRef } from 'react';
import { X, Compass, Lock } from 'lucide-react';
import { BALANCE } from '../config/balance';
import { getTerrainHeight, ROAD_NETWORK } from '../world/heightmap';
import { WORLD_BUILDINGS } from '../world/settlements';

interface IslandMapModalProps {
  hasMapItem: boolean;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  onClose: () => void;
  onGrantMapForTesting: () => void;
}

export const IslandMapModal: React.FC<IslandMapModalProps> = ({
  hasMapItem,
  playerX,
  playerZ,
  playerYaw,
  onClose,
  onGrantMapForTesting,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!hasMapItem || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 560;
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    // Render 2km x 2km topographic elevation & contour chart
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const wx = ((px / size) * 2 - 1) * BALANCE.WORLD.HALF_SIZE;
        const wz = ((py / size) * 2 - 1) * BALANCE.WORLD.HALF_SIZE;
        const h = getTerrainHeight(wx, wz);

        let r = 22;
        let g = 35;
        let b = 46;

        if (h >= 0) {
          if (h < BALANCE.WORLD.BEACH_HEIGHT) {
            r = 165;
            g = 152;
            b = 126;
          } else {
            const elevFactor = Math.min(1, h / 55);
            r = Math.floor(48 + elevFactor * 65);
            g = Math.floor(68 + elevFactor * 55);
            b = Math.floor(52 + elevFactor * 42);
          }

          // 10m topographic contour lines
          const contourDist = Math.abs((h % 8) - 4);
          if (contourDist < 0.26) {
            r = Math.floor(r * 0.72);
            g = Math.floor(g * 0.72);
            b = Math.floor(b * 0.72);
          }
        }

        const idx = (py * size + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const toCanvas = (wx: number, wz: number): [number, number] => [
      ((wx / BALANCE.WORLD.HALF_SIZE + 1) * 0.5) * size,
      ((wz / BALANCE.WORLD.HALF_SIZE + 1) * 0.5) * size,
    ];

    // Draw 200m Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let g = -800; g <= 800; g += 200) {
      const [gx] = toCanvas(g, 0);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, size);
      ctx.stroke();

      const [, gy] = toCanvas(0, g);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(size, gy);
      ctx.stroke();
    }

    // Draw Asphalt Road Network
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.8;
    for (const seg of ROAD_NETWORK) {
      const [ax, ay] = toCanvas(seg.a[0], seg.a[1]);
      const [bx, by] = toCanvas(seg.b[0], seg.b[1]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // Draw Buildings
    for (const b of WORLD_BUILDINGS) {
      const [bx, by] = toCanvas(b.x, b.z);
      ctx.fillStyle =
        b.category === 'military'
          ? '#ef4444'
          : b.category === 'medical'
          ? '#38bdf8'
          : '#e2e8f0';
      ctx.fillRect(bx - 3, by - 3, 6, 6);
    }

    // Draw Settlement Labels
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    for (const s of BALANCE.SETTLEMENTS) {
      const [sx, sy] = toCanvas(s.center[0], s.center[1]);
      ctx.fillStyle = 'rgba(11, 14, 17, 0.85)';
      ctx.fillRect(sx - 44, sy - 28, 88, 18);
      ctx.fillStyle = s.type === 'military_camp' ? '#fca5a5' : '#fef3c7';
      ctx.fillText(s.name.toUpperCase(), sx, sy - 15);
    }

    // Draw Player Position & Heading Arrow
    const [px, py] = toCanvas(playerX, playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-playerYaw);
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [hasMapItem, playerX, playerZ, playerYaw]);

  return (
    <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-[740px] bg-[#0d1117] border border-white/15 rounded overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#11161d]">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wider text-slate-100">
              1:25,000 TOPOGRAPHIC SURVEY — DEADLANDS ISLAND
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" /> Close [M]
          </button>
        </div>

        <div className="p-6 flex flex-col items-center justify-center">
          {!hasMapItem ? (
            <div className="py-12 px-8 max-w-md text-center flex flex-col items-center gap-4">
              <Lock className="w-10 h-10 text-slate-500" />
              <div className="text-base font-semibold text-slate-200">
                You have not looted a Topographic Map yet
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                In DEADLANDS: Coastline, your map only reveals the 2km × 2km island once you find and carry a{' '}
                <span className="text-slate-200 font-medium">Coastal Topographic Map</span> inside houses, industrial
                sheds, or coastal caches (such as the cache along the road into Zalivsk).
              </p>
              <button
                onClick={onGrantMapForTesting}
                className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded cursor-pointer"
              >
                Acquire Field Survey Map Now
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="border border-slate-700 rounded overflow-hidden shadow-inner">
                <canvas ref={canvasRef} width={560} height={560} className="block w-[520px] h-[520px]" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 font-mono">
                <span>Amber Arrow: Current Position</span>
                <span>·</span>
                <span>Orange Lines: Asphalt Roads</span>
                <span>·</span>
                <span>Blue Squares: Medical Clinics</span>
                <span>·</span>
                <span>Red Squares: Military Garrison</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
