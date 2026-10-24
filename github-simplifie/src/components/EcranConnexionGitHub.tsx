interface Props {
  codeUtilisateur: string | null;
  urlVerification: string | null;
  enAttente: boolean;
  erreur: string | null;
  onConnecter: () => void;
}

export function EcranConnexionGitHub({
  codeUtilisateur,
  urlVerification,
  enAttente,
  erreur,
  onConnecter,
}: Props) {
  return (
    <div className="w-full max-w-md space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Connexion à GitHub</h1>
        <p className="text-slate-500 mt-1">
          Pas besoin de mot de passe ni de jeton à copier.
        </p>
      </div>

      {!codeUtilisateur && (
        <button
          onClick={onConnecter}
          disabled={enAttente}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg disabled:opacity-50"
        >
          {enAttente ? "Préparation…" : "Se connecter avec GitHub"}
        </button>
      )}

      {codeUtilisateur && urlVerification && (
        <div className="space-y-4">
          <p className="text-slate-600">Entre ce code sur GitHub :</p>
          <div className="text-3xl font-mono tracking-widest bg-slate-100 rounded-lg py-4">
            {codeUtilisateur}
          </div>
          <a
            href={urlVerification}
            target="_blank"
            rel="noreferrer"
            className="inline-block px-5 py-2 bg-slate-900 text-white rounded-lg"
          >
            Ouvrir GitHub
          </a>
          <p className="text-slate-400 text-sm">
            En attente de validation depuis ton navigateur…
          </p>
        </div>
      )}

      {erreur && <p className="text-red-600 text-sm">{erreur}</p>}
    </div>
  );
}
