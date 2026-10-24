import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { attendreValidation, demarrerConnexion } from "../services/githubAuth";
import { obtenirUtilisateurConnecte } from "../services/githubService";
import type { EtatConnexion } from "../types";

const ETAT_INITIAL: EtatConnexion = {
  token: null,
  login: null,
  codeUtilisateur: null,
  urlVerification: null,
  codeExpireA: null,
  enAttente: false,
  erreur: null,
};

export function useGitHubAuth() {
  const [etat, setEtat] = useState<EtatConnexion>(ETAT_INITIAL);

  useEffect(() => {
    let actif = true;
    void (async () => {
      try {
        const token = await invoke<string | null>("charger_jeton_github");
        if (!actif || !token) return;
        try {
          const login = await obtenirUtilisateurConnecte(token);
          if (actif) setEtat({ ...ETAT_INITIAL, token, login });
        } catch (error) {
          if (actif) {
            setEtat({
              ...ETAT_INITIAL,
              token,
              erreur: `Jeton chargé, mais GitHub ne peut pas être contacté pour valider la session : ${
                error instanceof Error ? error.message : "erreur réseau"
              }`,
            });
          }
        }
      } catch (error) {
        if (actif) {
          setEtat({
            ...ETAT_INITIAL,
            erreur: error instanceof Error ? error.message : "Impossible de lire le trousseau sécurisé.",
          });
        }
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const connecter = useCallback(async () => {
    setEtat({ ...ETAT_INITIAL, enAttente: true });
    try {
      const { device_code, user_code, verification_uri, interval, expires_in } =
        await demarrerConnexion();

      setEtat((s) => ({
        ...s,
        codeUtilisateur: user_code,
        urlVerification: verification_uri,
        codeExpireA: Date.now() + expires_in * 1000,
      }));

      const token = await attendreValidation(device_code, interval, expires_in);
      const login = await obtenirUtilisateurConnecte(token);
      let erreurStockage: string | null = null;
      try {
        await invoke("enregistrer_jeton_github", { token });
      } catch (error) {
        erreurStockage =
          error instanceof Error
            ? `Connexion réussie, mais l’enregistrement sécurisé a échoué : ${error.message}`
            : "Connexion réussie, mais impossible d’enregistrer le jeton dans le trousseau système.";
      }
      setEtat((s) => ({ ...s, token, login, enAttente: false, erreur: erreurStockage }));
    } catch (err) {
      setEtat({
        ...ETAT_INITIAL,
        erreur: err instanceof Error ? err.message : "Erreur de connexion à GitHub",
      });
    }
  }, []);

  const deconnecter = useCallback(async () => {
    try {
      await invoke("supprimer_jeton_github");
      setEtat(ETAT_INITIAL);
    } catch (error) {
      setEtat((current) => ({
        ...current,
        erreur: error instanceof Error ? error.message : "Impossible d’effacer la session enregistrée.",
      }));
    }
  }, []);

  const effacerErreur = useCallback(() => {
    setEtat((current) => ({ ...current, erreur: null }));
  }, []);

  return { ...etat, connecter, deconnecter, effacerErreur };
}
