import { useRef, useState } from "react";
import { Download, Settings, Upload, X } from "lucide-react";
import type { Language } from "../i18n";

export type ThemeMode = "dark" | "light";
export type AccentColor = "orange" | "blue" | "violet" | "green";

interface Props {
  open: boolean;
  language: Language;
  theme: ThemeMode;
  accent: AccentColor;
  onClose: () => void;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: AccentColor) => void;
}

const PRESETS: { theme: ThemeMode; accent: AccentColor; name: string; nameFr: string }[] = [
  { theme: "dark", accent: "orange", name: "Midnight Orange", nameFr: "Nuit orange" },
  { theme: "dark", accent: "blue", name: "Midnight Blue", nameFr: "Nuit bleue" },
  { theme: "dark", accent: "violet", name: "Midnight Violet", nameFr: "Nuit violette" },
  { theme: "dark", accent: "green", name: "Midnight Green", nameFr: "Nuit verte" },
  { theme: "light", accent: "blue", name: "Daylight Blue", nameFr: "Clair bleu" },
  { theme: "light", accent: "orange", name: "Daylight Orange", nameFr: "Clair orange" },
];

export function SettingsModal({
  open,
  language,
  theme,
  accent,
  onClose,
  onLanguageChange,
  onThemeChange,
  onAccentChange,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const fr = language === "fr";
  const settings = fr ? {
    title: "Paramètres", language: "Langue", theme: "Thème", dark: "Sombre", light: "Clair",
    accent: "Couleur d’accentuation", presets: "Thèmes disponibles", export: "Télécharger le thème",
    import: "Importer un thème JSON", close: "Fermer", invalid: "Fichier de thème invalide.",
  } : language === "es" ? {
    title: "Ajustes", language: "Idioma", theme: "Tema", dark: "Oscuro", light: "Claro",
    accent: "Color de énfasis", presets: "Temas disponibles", export: "Descargar tema",
    import: "Importar tema JSON", close: "Cerrar", invalid: "El archivo de tema no es válido.",
  } : language === "ar" ? {
    title: "الإعدادات", language: "اللغة", theme: "السمة", dark: "داكن", light: "فاتح",
    accent: "لون التمييز", presets: "السمات المتاحة", export: "تنزيل السمة",
    import: "استيراد سمة JSON", close: "إغلاق", invalid: "ملف السمة غير صالح.",
  } : {
    title: "Settings", language: "Language", theme: "Theme", dark: "Dark", light: "Light",
    accent: "Accent color", presets: "Available themes", export: "Download theme",
    import: "Import theme JSON", close: "Close", invalid: "Invalid theme file.",
  };

  if (!open) return null;

  function downloadTheme() {
    const preset = PRESETS.find((item) => item.theme === theme && item.accent === accent);
    const blob = new Blob([JSON.stringify({
      format: "gsimplifie-theme",
      version: 1,
      name: preset?.name ?? "Custom theme",
      theme,
      accent,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gsimplifie-${theme}-${accent}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importTheme(file: File | undefined) {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (
        typeof data !== "object" || data === null ||
        !("format" in data) || data.format !== "gsimplifie-theme" ||
        !("version" in data) || data.version !== 1 ||
        !("theme" in data) || (data.theme !== "dark" && data.theme !== "light") ||
        !("accent" in data) || !["orange", "blue", "violet", "green"].includes(String(data.accent))
      ) throw new Error(settings.invalid);
      onThemeChange(data.theme);
      onAccentChange(data.accent as AccentColor);
      setError(null);
      onClose();
    } catch {
      setError(settings.invalid);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#171717] p-5 shadow-2xl">
        <header className="mb-5 flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 id="settings-title" className="flex items-center gap-2 text-lg font-semibold"><Settings size={18} />{settings.title}</h2>
          <button type="button" onClick={onClose} aria-label={settings.close} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </header>
        <div className="space-y-5">
          <label className="block text-sm">
            <span className="mb-2 block font-medium">{settings.language}</span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)} className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{settings.theme}</legend>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((value) => (
                <button key={value} type="button" onClick={() => onThemeChange(value)} aria-pressed={theme === value} className={`rounded-md border px-4 py-2 text-sm ${theme === value ? "border-orange-500 bg-orange-950/40" : "border-slate-700 hover:bg-slate-800"}`}>
                  {value === "dark" ? settings.dark : settings.light}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{settings.accent}</legend>
            <div className="flex flex-wrap gap-2">
              {(["orange", "blue", "violet", "green"] as const).map((value) => (
                <button key={value} type="button" onClick={() => onAccentChange(value)} aria-label={value} aria-pressed={accent === value} className={`h-8 w-8 rounded-full border-2 ${accent === value ? "border-white" : "border-transparent"}`} style={{ backgroundColor: { orange: "#f97316", blue: "#3b82f6", violet: "#8b5cf6", green: "#10b981" }[value] }} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{settings.presets}</legend>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button key={`${preset.theme}-${preset.accent}`} type="button" onClick={() => { onThemeChange(preset.theme); onAccentChange(preset.accent); }} className="rounded-md border border-slate-700 px-3 py-2 text-left text-xs hover:border-slate-500">
                  {fr ? preset.nameFr : preset.name}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
            <button type="button" onClick={downloadTheme} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"><Download size={15} />{settings.export}</button>
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"><Upload size={15} />{settings.import}</button>
            <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importTheme(event.target.files?.[0])} />
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </div>
      </section>
    </div>
  );
}
