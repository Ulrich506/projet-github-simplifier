import { useEffect, useState } from "react";
import { FolderPlus, UploadCloud } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDirectory } from "@tauri-apps/plugin-dialog";

interface Props {
  onFolderSelected: (path: string) => void;
  erreur: string | null;
  disabled?: boolean;
  onError: (message: string) => void;
  action?: string | null;
}

export function ZoneDepot({ onFolderSelected, erreur, disabled = false, onError, action }: Props) {
  const [survole, setSurvole] = useState(false);

  async function parcourirDossier() {
    try {
      const path = await openDirectory({ directory: true, multiple: false });
      if (typeof path === "string" && !disabled) onFolderSelected(path);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible d’ouvrir le sélecteur de dossier.");
    }
  }

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over" || event.payload.type === "enter") {
        setSurvole(true);
        return;
      }
      if (event.payload.type === "drop") {
        setSurvole(false);
        const paths = event.payload.paths;
        if (!disabled && paths && paths.length > 0) onFolderSelected(paths[0]);
        return;
      }
      setSurvole(false);
    });

    return () => {
      void unlisten.then((unsubscribe) => unsubscribe());
    };
  }, [disabled, onError, onFolderSelected]);

  function bloquerComportementDefaut(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {erreur && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {erreur}
        </div>
      )}

      <div
        onDragOver={bloquerComportementDefaut}
        onDragEnter={bloquerComportementDefaut}
        onDrop={bloquerComportementDefaut}
        aria-disabled={disabled}
        className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all ${
          disabled ? "cursor-wait opacity-60" :
          survole
            ? "border-orange-500 bg-orange-950/30"
            : "border-slate-700 bg-[#171717] hover:border-slate-500"
        }`}
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-900/40 text-orange-300">
          <UploadCloud size={30} />
        </div>
        <p className="text-lg font-semibold text-slate-100 sm:text-xl">
          {action === "maj" ? "Dépose le projet à mettre à jour" : "Glisse-dépose un dossier de projet ici"}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Les dépendances et dossiers de compilation sont ignorés automatiquement.
        </p>
        <button
          type="button"
          onClick={parcourirDossier}
          disabled={disabled}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold hover:bg-orange-500 disabled:cursor-wait disabled:opacity-50"
        >
          <FolderPlus size={16} />
          Parcourir un dossier
        </button>
      </div>
    </div>
  );
}
