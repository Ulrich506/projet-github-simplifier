interface Props {
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  erreur: string | null;
}

export function ZoneDepot({ onDrop, erreur }: Props) {
  return (
    <div className="w-full max-w-xl space-y-4">
      {erreur && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-3 text-sm">
          {erreur}
        </div>
      )}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="h-64 border-4 border-dashed border-slate-300 rounded-2xl flex items-center justify-center text-slate-500 text-lg"
      >
        Dépose ton dossier de projet ici
      </div>
    </div>
  );
}
