import type { ProgressionGit } from "../types";

interface Props {
  progression: ProgressionGit | null;
}

export function EcranProgression({ progression }: Props) {
  const pourcentage =
    progression?.total && progression.total > 0
      ? Math.round(((progression.loaded ?? 0) / progression.total) * 100)
      : null;

  return (
    <div className="w-full max-w-md space-y-4 text-center">
      <p className="text-slate-600 text-lg">
        {progression?.phase ?? "Opération en cours…"}
      </p>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-900 transition-all"
          style={{ width: pourcentage !== null ? `${pourcentage}%` : "40%" }}
        />
      </div>
      {pourcentage !== null && (
        <p className="text-slate-400 text-sm">{pourcentage}%</p>
      )}
    </div>
  );
}
