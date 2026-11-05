import type { ZoneClass } from "@/lib/api-types";

// mesma rampa do worker (render.py): -0,2 -> 0,15 (vermelho) -> 0,5 (amarelo) -> 0,9
export const RAMP_CSS = "linear-gradient(90deg, rgb(215,48,39) 0%, rgb(215,48,39) 31.8%, rgb(254,224,80) 63.6%, rgb(26,152,80) 100%)";
export const ZONE_STYLE: Record<ZoneClass, { color: string; label: string }> = {
  low: { color: "#be3422", label: "Baixo vigor" },
  medium: { color: "#ecb22e", label: "Médio vigor" },
  high: { color: "#348c38", label: "Alto vigor" },
};
const ORDER: ZoneClass[] = ["high", "medium", "low"];

export default function Legend({ mode }: { mode: "ndvi" | "zones" }) {
  return (
    <div
      data-testid="legend"
      data-legend={mode}
      className={`pointer-events-none absolute bottom-56 right-3 w-36 rounded-xl bg-tinta/85 p-2.5 text-xs text-solo shadow-lg backdrop-blur sm:bottom-3 sm:right-[26.5rem] sm:w-48 sm:p-3 sm:text-[12.5px] ${mode === "zones" ? "hidden sm:block" : ""}`}
    >
      {mode === "ndvi" ? (
        <>
          <b>NDVI</b>
          <div className="my-1.5 h-3 rounded-md" style={{ background: RAMP_CSS }} />
          <div className="flex justify-between tabular-nums text-[#d6d1c0]">
            <span>−0,2</span>
            <span>0,15</span>
            <span>0,5</span>
            <span>0,9</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[#d6d1c0]">
            <span
              aria-hidden
              className="h-3 w-[18px] shrink-0 rounded-[3px] border border-[#d6d1c0]"
              style={{ background: "repeating-linear-gradient(45deg,#d6d1c066 0 3px,transparent 3px 6px)" }}
            />
            sem dado
          </div>
        </>
      ) : (
        <>
          <b>Zonas de manejo</b>
          <ul className="mt-1.5 grid gap-1.5">
            {ORDER.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <i className="h-3.5 w-3.5 shrink-0 rounded border-2 border-tinta ring-1 ring-solo" style={{ background: ZONE_STYLE[c].color }} />
                {ZONE_STYLE[c].label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
