import type { ActionChoisie, AnalyseProjet } from "../types";

const ACTIONS: [ActionChoisie, string][] = [
  ["creer", "Créer un dépôt GitHub"],
  ["publier", "Publier le projet"],
  ["maj", "Mettre à jour un projet existant"],
  ["recuperer", "Récupérer un projet"],
];

interface Props {
  analyse: AnalyseProjet;
  onChoisir: (action: ActionChoisie) => void;
}

export function MenuActions({ analyse, onChoisir }: Props) {
  return (
    <div className="w-full max-w-xl space-y-4">
      <p className="text-slate-600">
        Projet détecté : <strong>{analyse.type}</strong> ({analyse.fileCount} fichiers)
      </p>

      {analyse.hasExistingGit && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm">
          Ce dossier contient déjà un dépôt Git — l'action "Mettre à jour" est probablement
          la plus adaptée.
        </div>
      )}

      {analyse.sensitiveFiles.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-800 text-sm">
          ⚠️ Ces fichiers semblent sensibles et ne seront pas publiés par défaut :{" "}
          {analyse.sensitiveFiles.join(", ")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => onChoisir(id)}
            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-400 shadow-sm text-left"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
