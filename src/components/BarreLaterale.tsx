import type { ActionChoisie } from "../types";
import { CloudDownload, CloudUpload, FolderPlus, RefreshCw, LogOut } from "lucide-react";

interface Props {
  login: string | null;
  connecte: boolean;
  profilOuvert: boolean;
  actionActive: ActionChoisie | null;
  onOuvrirProfil: () => void;
  onDeconnecter: () => void;
  onChoisirAction: (action: ActionChoisie) => void;
}

const ACTIONS: [ActionChoisie, typeof FolderPlus, string][] = [
  ["creer", FolderPlus, "Créer"],
  ["publier", CloudUpload, "Publier"],
  ["maj", RefreshCw, "Mettre à jour"],
  ["recuperer", CloudDownload, "Récupérer"],
];

export function BarreLaterale({
  login,
  connecte,
  profilOuvert,
  actionActive,
  onOuvrirProfil,
  onDeconnecter,
  onChoisirAction,
}: Props) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-5 flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <span className="logo-gs" aria-label="GS">GS</span>
          <div>
            <p className="text-xl font-bold text-slate-900">GS</p>
            <p className="text-xs text-slate-500">GitHub Simplifié</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOuvrirProfil}
        className={`w-full rounded-xl border p-3 text-left transition-colors ${
          profilOuvert ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-blue-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
            {login ? login.slice(0, 1).toUpperCase() : "?"}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm text-slate-800">
              {login ?? "Profil GitHub"}
            </strong>
            <span className="text-xs text-slate-500">
              {connecte ? "Connecté à GitHub" : "Se connecter"}
            </span>
          </span>
        </div>
      </button>

      <nav className="mt-8 space-y-2" aria-label="Actions du projet">
        {ACTIONS.map(([id, Icone, label]) => (
          <button
            key={id}
            type="button"
            disabled={!connecte}
            onClick={() => onChoisirAction(id)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              actionActive === id
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icone size={18} strokeWidth={2.2} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {connecte && (
        <button
          type="button"
          onClick={onDeconnecter}
          className="mt-auto text-sm text-slate-500 hover:text-red-600 text-left px-3 py-2"
        >
          <LogOut size={16} aria-hidden="true" />
          Se déconnecter
        </button>
      )}
    </aside>
  );
}
