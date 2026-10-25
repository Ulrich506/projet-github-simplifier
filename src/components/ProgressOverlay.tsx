import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

interface Props {
  progress: {
    percent: number;
    label: string;
    complete: boolean;
  };
  completedLabel: string;
}

export function ProgressOverlay({ progress, completedLabel }: Props) {
  const target = useRef(progress.percent);
  const current = useRef(progress.percent);
  const [displayed, setDisplayed] = useState(progress.percent);

  target.current = progress.percent;

  useEffect(() => {
    let frame = 0;
    let previousTime = 0;
    let lastDisplayed = Math.round(current.current);

    const animate = (now: number) => {
      const elapsed = previousTime ? Math.min(now - previousTime, 50) : 16;
      previousTime = now;
      const remaining = target.current - current.current;
      if (Math.abs(remaining) < 0.05) {
        current.current = target.current;
      } else {
        current.current += remaining * Math.min(1, elapsed / 240);
      }
      const value = Math.round(current.current);
      if (value !== lastDisplayed) {
        lastDisplayed = value;
        setDisplayed(value);
      }
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const value = progress.complete ? 100 : Math.min(95, displayed);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#171717] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm font-medium text-slate-100">{progress.label}</p>
          <span className="shrink-0 font-mono text-sm text-slate-300">{value}%</span>
        </div>
        <div
          className="relative h-3 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-75 ease-out ${progress.complete ? "bg-emerald-500" : "bg-orange-500"}`}
            style={{ width: `${value}%` }}
          />
          {progress.complete && (
            <span className="check-sweep absolute top-1/2 flex -translate-y-1/2 items-center text-emerald-200">
              <Check size={15} strokeWidth={3} />
            </span>
          )}
        </div>
        {progress.complete && <p className="mt-3 text-right text-sm font-medium text-emerald-300">{completedLabel}</p>}
      </div>
    </div>
  );
}
