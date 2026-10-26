import { useSyncExternalStore } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { getProgression, subscribeProgression } from "../services/progressStore";

interface Props {
  completedLabel: string;
  cancelLabel: string;
  loadingLabel: string;
  onCancel: () => void;
}

export function ProgressOverlay({ completedLabel, cancelLabel, loadingLabel, onCancel }: Props) {
  const progress = useSyncExternalStore(subscribeProgression, getProgression, getProgression);
  const label = progress?.label ?? loadingLabel;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      <div className="pointer-events-auto rounded-xl border border-slate-700 bg-[#171717] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm font-medium text-slate-100">{label}</p>
          {progress?.complete
            ? <Check size={17} className="shrink-0 text-emerald-300" aria-hidden="true" />
            : !progress && <LoaderCircle size={17} className="shrink-0 animate-spin text-orange-400" aria-hidden="true" />}
        </div>
        <div
          className="relative h-2 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress?.complete ? 100 : undefined}
        >
          <div
            className={`h-full rounded-full ${progress?.complete ? "w-full bg-emerald-500" : "progress-indeterminate bg-orange-500"}`}
          />
        </div>
        {progress?.complete ? (
          <p className="mt-3 text-right text-sm font-medium text-emerald-300">{completedLabel}</p>
        ) : progress && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <X size={14} className="mr-1.5 inline" />
              {cancelLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
