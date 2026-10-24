import { useCallback, useState } from "react";
import { attendreValidation, demarrerConnexion } from "../services/githubAuth";
import { obtenirUtilisateurConnecte } from "../services/githubService";
import type { EtatConnexion } from "../types";

const ETAT_INITIAL: EtatConnexion = {
  token: null,
  login: null,
  codeUtilisateur: null,
  urlVerification: null,
  enAttente: false,
  erreur: null,
};

export function useGitHubAuth() {
  const [etat, setEtat] = useState<EtatConnexion>(ETAT_INITIAL);

  const connecter = useCallback(async () => {
    setEtat({ ...ETAT_INITIAL, enAttente: true });
    try {
      const { device_code, user_code, verification_uri, interval, expires_in } =
        await demarrerConnexion();

      setEtat((s) => ({
        ...s,
        codeUtilisateur: user_code,
        urlVerification: verification_uri,
      }));

      const token = await attendreValidation(device_code, interval, expires_in);
      const login = await obtenirUtilisateurConnecte(token).catch(() => null);
      setEtat((s) => ({ ...s, token, login, enAttente: false }));
    } catch (err) {
      setEtat({
        ...ETAT_INITIAL,
        erreur: err instanceof Error ? err.message : "Erreur de connexion à GitHub",
      });
    }
  }, []);

  const deconnecter = useCallback(() => setEtat(ETAT_INITIAL), []);

  return { ...etat, connecter, deconnecter };
}
