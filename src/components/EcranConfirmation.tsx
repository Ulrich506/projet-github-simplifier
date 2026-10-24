import type { ActionChoisie } from "../types";

const LIBELLES: Record<ActionChoisie, string> = {
  creer: "créer un dépôt GitHub pour ce projet",
  publier: "publier ce projet sur GitHub",
  maj: "mettre à jour le dépôt existant",
  recuperer: "récupérer ce projet depuis GitHub",
};

interface Props {
  action: ActionChoisie;
  erreur: string | null;
  nomDepot: string;
  onChangeNomDepot: (nom: string) => void;
  prive: boolean;
  onChangePrive: (prive: boolean) => void;
  onConfirmer: () => void;
  onAnnuler: () => void;
}

export function EcranConfirmation({
  action,
  erreur,
  nomDepot,
  onChangeNomDepot,
  prive,
  onChangePrive,
  onConfirmer,
  onAnnuler,
}: Props) {
  const demandeNomDepot =
    action === "creer" || action === "publier" || action === "recuperer";
  const libelleChamp =
    action === "recuperer" ? "Nom du dépôt à récupérer" : "Nom du dépôt sur GitHub";

  return (
    <div className="w-full max-w-xl space-y-4 text-center">
      <p className="text-lg text-slate-700">
        Confirmer : <strong>{LIBELLES[action]}</strong> ?
      </p>

      {demandeNomDepot && (
        <div className="text-left max-w-sm mx-auto">
          <label className="block text-sm text-slate-500 mb-1">{libelleChamp}</label>
          <input
            value={nomDepot}
            onChange={(e) => onChangeNomDepot(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            placeholder="mon-projet"
          />
        </div>
      )}

      {(action === "creer" || action === "publier") && (
        <label className="flex items-center justify-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={prive}
            onChange={(e) => onChangePrive(e.target.checked)}
          />
          Dépôt privé (visible uniquement par toi)
        </label>
      )}

      {erreur && <p className="text-red-600 text-sm">{erreur}</p>}
      <div className="flex justify-center gap-3">
        <button
          onClick={onAnnuler}
          className="px-6 py-3 bg-white border border-slate-300 rounded-lg"
        >
          Annuler
        </button>
        <button
          onClick={onConfirmer}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg"
        >
          Confirmer
        </button>
      </div>
    </div>
  );
}
