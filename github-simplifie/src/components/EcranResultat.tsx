interface Props {
  urlDepot: string | null;
  onRecommencer: () => void;
}

export function EcranResultat({ urlDepot, onRecommencer }: Props) {
  return (
    <div className="text-center space-y-4">
      <p className="text-xl text-emerald-700">✓ Terminé !</p>
      {urlDepot && (
        <a
          href={urlDepot}
          target="_blank"
          rel="noreferrer"
          className="text-slate-600 underline"
        >
          Voir le dépôt sur GitHub
        </a>
      )}
      <div>
        <button
          onClick={onRecommencer}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg"
        >
          Gérer un autre projet
        </button>
      </div>
    </div>
  );
}
