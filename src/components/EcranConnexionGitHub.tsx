import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Language, translations, translateError } from "../i18n";

interface Props {
  codeUtilisateur: string | null;
  urlVerification: string | null;
  codeExpireA: number | null;
  enAttente: boolean;
  erreur: string | null;
  onConnecter: () => void;
  lang?: Language;
}

export function EcranConnexionGitHub({
  codeUtilisateur,
  urlVerification,
  codeExpireA,
  enAttente,
  erreur,
  onConnecter,
  lang = "fr",
}: Props) {
  const [secondesRestantes, setSecondesRestantes] = useState(0);
  const [navigateurOuvert, setNavigateurOuvert] = useState(false);
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);
  const ouvertureEffectuee = useRef(false);
  const t = translations[lang].authModal;

  useEffect(() => {
    ouvertureEffectuee.current = false;
    setNavigateurOuvert(false);
    setErreurOuverture(null);
  }, [codeUtilisateur]);

  useEffect(() => {
    if (!codeExpireA) {
      setSecondesRestantes(0);
      return;
    }
    const actualiser = () => setSecondesRestantes(Math.max(0, Math.ceil((codeExpireA - Date.now()) / 1000)));
    actualiser();
    const timer = window.setInterval(actualiser, 1000);
    return () => window.clearInterval(timer);
  }, [codeExpireA]);

  async function ouvrirGitHubUneFois() {
    if (ouvertureEffectuee.current || !urlVerification || secondesRestantes <= 0) return;
    ouvertureEffectuee.current = true;
    try {
      await open(urlVerification);
      setNavigateurOuvert(true);
    } catch (error) {
      ouvertureEffectuee.current = false;
      setErreurOuverture(error instanceof Error ? error.message : t.browserError);
    }
  }

  const minutes = Math.floor(secondesRestantes / 60);
  const secondes = String(secondesRestantes % 60).padStart(2, "0");

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        <p className="mt-1 text-slate-400">
          {t.subtitle}
        </p>
      </div>

      {!codeUtilisateur && (
        <button
          onClick={onConnecter}
          disabled={enAttente}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg disabled:opacity-50"
        >
          {enAttente ? t.prepareBtn : t.startBtn}
        </button>
      )}

      {codeUtilisateur && urlVerification && (
        <div className="space-y-4">
          <p className="text-slate-300">{t.enterCodePrompt}</p>
          <div className="rounded-lg border border-white bg-black py-4 font-mono text-3xl tracking-widest text-white">
            {codeUtilisateur}
          </div>
          <button
            type="button"
            onClick={() => void ouvrirGitHubUneFois()}
            disabled={navigateurOuvert || secondesRestantes <= 0}
            className="inline-block rounded-lg bg-slate-900 px-5 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {navigateurOuvert ? t.githubOpenedBtn : t.openGitHubBtn}
          </button>
          <p className="text-sm text-slate-400">
            {secondesRestantes > 0
              ? t.expiresIn(minutes, secondes)
              : t.expiredMsg}
          </p>
          {erreurOuverture && (
            <p role="alert" className="text-sm text-red-400">{translateError(erreurOuverture, lang)}</p>
          )}
          <p className="text-slate-400 text-sm">
            {t.waitingBrowser}
          </p>
        </div>
      )}

      {codeUtilisateur && !urlVerification && <p role="alert" className="text-red-400">{t.noVerificationUrl}</p>}
      {!codeUtilisateur && erreur && (
        <button
          type="button"
          onClick={onConnecter}
          disabled={enAttente}
          className="rounded-lg bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
        >
          {t.retryBtn}
        </button>
      )}
      {erreur && <p role="alert" className="text-red-400 text-sm">{translateError(erreur, lang)}</p>}
    </div>
  );
}
