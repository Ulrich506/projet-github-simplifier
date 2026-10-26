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
  const [comptes, setComptes] = useState<string[]>([]);

  useEffect(() => {
    let actif = true;
    void (async () => {
      try {
        const savedAccounts = await invoke<string[]>("lister_comptes_github");
        if (actif) setComptes(savedAccounts);
        if (localStorage.getItem("github_simplifie_signed_out") === "true") return;
        const token = await invoke<string | null>("charger_jeton_github");
        if (!actif || !token) return;
        try {
          const login = await obtenirUtilisateurConnecte(token);
          if (actif) {
            await invoke("enregistrer_compte_github", { login, token });
            setComptes((current) =>
              current.some((account) => account.toLowerCase() === login.toLowerCase())
                ? current
                : [...current, login].sort((left, right) => left.localeCompare(right))
            );
            setEtat({ ...ETAT_INITIAL, token, login });
          }
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
        await invoke("enregistrer_compte_github", { login, token });
        localStorage.removeItem("github_simplifie_signed_out");
        setComptes((current) =>
          current.some((account) => account.toLowerCase() === login.toLowerCase())
            ? current
            : [...current, login].sort((left, right) => left.localeCompare(right))
        );
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

  const connecterAvecCompte = useCallback(async (login: string) => {
    setEtat((current) => ({ ...current, enAttente: true, erreur: null }));
    try {
      const token = await invoke<string | null>("charger_jeton_github_compte", { login });
      if (!token) throw new Error("Aucune session enregistrée pour ce compte.");
      const verifiedLogin = await obtenirUtilisateurConnecte(token);
      localStorage.removeItem("github_simplifie_signed_out");
      setEtat({ ...ETAT_INITIAL, token, login: verifiedLogin });
      return true;
    } catch (error) {
      setEtat((current) => ({
        ...current,
        enAttente: false,
        erreur: error instanceof Error ? error.message : "Impossible de réutiliser ce compte GitHub.",
      }));
      return false;
    }
  }, []);

  const oublierCompte = useCallback(async (login: string) => {
    try {
      await invoke("oublier_compte_github", { login });
      setComptes((current) => current.filter((account) => account.toLowerCase() !== login.toLowerCase()));
      if (etat.login?.toLowerCase() === login.toLowerCase()) setEtat(ETAT_INITIAL);
    } catch (error) {
      setEtat((current) => ({
        ...current,
        erreur: error instanceof Error ? error.message : "Impossible d’oublier ce compte GitHub.",
      }));
    }
  }, [etat.login]);

  const deconnecter = useCallback(async () => {
    try {
      localStorage.setItem("github_simplifie_signed_out", "true");
    } catch {
      setEtat({
        ...ETAT_INITIAL,
        erreur: "Déconnexion effectuée, mais la préférence de session ne peut pas être mémorisée sur cet appareil.",
      });
      return;
    }
    setEtat(ETAT_INITIAL);
  }, []);

  const effacerErreur = useCallback(() => {
    setEtat((current) => ({ ...current, erreur: null }));
  }, []);

  return { ...etat, comptes, connecter, connecterAvecCompte, oublierCompte, deconnecter, effacerErreur };
}
