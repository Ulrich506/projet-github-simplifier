export type OperationErrorCategory =
  | "AUTHENTICATION_ERROR"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "GITHUB_RATE_LIMIT"
  | "REPOSITORY_NOT_FOUND"
  | "REPOSITORY_ALREADY_EXISTS"
  | "NOT_A_GIT_REPOSITORY"
  | "INVALID_WORKING_DIRECTORY"
  | "INVALID_PATH"
  | "CLONE_DESTINATION_ERROR"
  | "GIT_NOT_INSTALLED"
  | "LOCAL_PROJECT_ERROR"
  | "GIT_OPERATION_ERROR"
  | "CONFLICT_ERROR"
  | "TIMEOUT_ERROR"
  | "UNKNOWN_ERROR";

export interface OperationDiagnostic {
  id: string;
  operation: string;
  step: string;
  category: OperationErrorCategory;
  retryable: boolean;
  occurredAt: string;
  durationMs: number;
  code: string;
  technicalDetails: string;
}

interface ErrorFacts {
  message: string;
  code: string;
  httpStatus?: number;
  gitExitCode?: number;
  rateLimitRemaining?: string;
  retryAfter?: string;
  rateLimitReset?: string;
}

function redact(value: string, token: string | null): string {
  let safe = value;
  if (token) safe = safe.split(token).join("[TOKEN REDACTED]");
  return safe
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[TOKEN REDACTED]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/=_-]+/gi, "$1 [REDACTED]")
    .replace(/https:\/\/[^/\s:@]+:[^/\s@]+@/gi, "https://[REDACTED]@")
    .replace(/(?:\/home\/|\/Users\/)[^/\s]+/g, "/[USER]")
    .replace(/[A-Za-z]:\\Users\\[^\\/\s]+/gi, "[USER]")
    .slice(0, 1800);
}

function factsFromError(error: unknown, token: string | null): ErrorFacts {
  const strings: string[] = [];
  let httpStatus: number | undefined;
  let code = "";
  let rateLimitRemaining: string | undefined;
  let retryAfter: string | undefined;
  let rateLimitReset: string | undefined;
  const visited = new Set<object>();

  function visit(value: unknown, depth: number): void {
    if (value == null || depth > 4) return;
    if (typeof value === "string") {
      if (value.trim()) strings.push(value.trim());
      return;
    }
    if (typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.code === "string" || typeof record.code === "number") {
      code ||= String(record.code);
    }
    for (const key of ["message", "stderr", "statusMessage"]) {
      if (typeof record[key] === "string") strings.push(record[key] as string);
    }
    if (typeof record.status === "number" && record.status >= 100 && record.status <= 599) {
      httpStatus = record.status;
    }
    if (typeof record.statusCode === "number" && record.statusCode >= 100 && record.statusCode <= 599) {
      httpStatus = record.statusCode;
    }
    const response = record.response;
    if (response && typeof response === "object") {
      const responseRecord = response as Record<string, unknown>;
      if (typeof responseRecord.status === "number") httpStatus = responseRecord.status;
      visit(responseRecord.data, depth + 1);
      const headers = responseRecord.headers;
      if (headers && typeof headers === "object") {
        const headerRecord = headers as Record<string, unknown>;
        const headerGetter = headers as { get?: (name: string) => string | null };
        rateLimitRemaining = String(headerGetter.get?.("x-ratelimit-remaining") ?? headerRecord["x-ratelimit-remaining"] ?? "");
        retryAfter = String(headerGetter.get?.("retry-after") ?? headerRecord["retry-after"] ?? "");
        rateLimitReset = String(headerGetter.get?.("x-ratelimit-reset") ?? headerRecord["x-ratelimit-reset"] ?? "");
      }
    }
    visit(record.cause, depth + 1);
    visit(record.error, depth + 1);
    visit(record.data, depth + 1);
    visit(record.errors, depth + 1);
  }

  visit(error, 0);
  const joined = redact([...new Set(strings)].join(" | ") || String(error), token);
  const gitNative = joined.match(/GIT_NATIVE_ERROR:(-?\d+):/i);
  const embeddedHttp = joined.match(/(?:HTTP|status(?: code)?)[\s:=]+(4\d\d|5\d\d)\b/i);
  if (!httpStatus && embeddedHttp) httpStatus = Number(embeddedHttp[1]);
  if (gitNative) {
    code = `GIT_EXIT_${gitNative[1]}`;
    strings.push(joined.slice(joined.indexOf(gitNative[0]) + gitNative[0].length));
  }
  return {
    message: redact([...new Set(strings)].join(" | ") || joined, token),
    code: code || (httpStatus ? `HTTP_${httpStatus}` : "UNCLASSIFIED_ERROR"),
    httpStatus,
    gitExitCode: gitNative ? Number(gitNative[1]) : undefined,
    rateLimitRemaining: rateLimitRemaining || undefined,
    retryAfter: retryAfter || undefined,
    rateLimitReset: rateLimitReset || undefined,
  };
}

function classify(facts: ErrorFacts): { category: OperationErrorCategory; retryable: boolean } {
  const message = facts.message.toLowerCase();
  const evidence = `${message} ${facts.code.toLowerCase()}`;
  if (/NOT_A_GIT_REPOSITORY|GIT_REPOSITORY_INVALID|fatal: not in a git directory|fatal: not a git repository/i.test(message)) {
    return { category: "NOT_A_GIT_REPOSITORY", retryable: false };
  }
  if (/INVALID_WORKING_DIRECTORY/i.test(message)) {
    return { category: "INVALID_WORKING_DIRECTORY", retryable: false };
  }
  if (/INVALID_PATH/i.test(message)) {
    return { category: "INVALID_PATH", retryable: false };
  }
  if (/CLONE_DESTINATION_ERROR|CLONE_VERIFICATION_FAILED|CLONE_CLEANUP_FAILED|could not create work tree dir|destination path .* already exists/i.test(message)) {
    return { category: "CLONE_DESTINATION_ERROR", retryable: false };
  }
  if (/GIT_OPERATION_TIMEOUT|timed out|timeout|deadline exceeded/i.test(facts.message)) {
    return { category: "TIMEOUT_ERROR", retryable: true };
  }
  if (
    facts.httpStatus === 429 ||
    facts.rateLimitRemaining === "0" ||
    /api rate limit exceeded|secondary rate limit|abuse detection|rate limit/i.test(evidence)
  ) {
    return { category: "GITHUB_RATE_LIMIT", retryable: true };
  }
  if (/impossible de vérifier le dossier|n’est pas un dossier|not a directory|allow-lstat|forbidden path|access is denied|eacces|os error 13/i.test(message)) {
    return { category: "LOCAL_PROJECT_ERROR", retryable: false };
  }
  if (facts.httpStatus === 401 || /\b401\b|bad credentials|authentication failed|could not authenticate|unauthorized/i.test(message)) {
    return { category: "AUTHENTICATION_ERROR", retryable: false };
  }
  if (facts.httpStatus === 403 || /\b403\b|permission denied|resource not accessible by integration|protected branch|sso/i.test(message)) {
    return { category: "PERMISSION_DENIED", retryable: false };
  }
  if (facts.httpStatus === 404 || /repository not found|repo not found|\b404\b/i.test(message)) {
    return { category: "REPOSITORY_NOT_FOUND", retryable: false };
  }
  if (
    facts.httpStatus === 422 &&
    /name already exists|already[_ -]exists|repository.*exists/i.test(evidence)
  ) {
    return { category: "REPOSITORY_ALREADY_EXISTS", retryable: false };
  }
  if (/GIT_OPERATION_CANCELLED/i.test(message)) {
    return { category: "GIT_OPERATION_ERROR", retryable: false };
  }
  if (  /failed to fetch|network error|dns|could not resolve|resolve host|unable to access|connection reset|connection refused|network request failed|fetch failed|offline|econn/i.test(evidence)) {
    return { category: "NETWORK_ERROR", retryable: true };
  }
  if (/GIT_NOT_INSTALLED|impossible de démarrer git|git .*not found|git is not installed|executable file not found/i.test(message)) {
    return { category: "GIT_NOT_INSTALLED", retryable: false };
  }
  if (/fast-forward|merge conflict|divergent|unmerged|needs merge|\[rejected\]|fetch first|non-fast-forward/i.test(message)) {
    return { category: "CONFLICT_ERROR", retryable: false };
  }
  if (facts.gitExitCode !== undefined || /GIT_NATIVE_ERROR|GIT_STATUS_FAILED/i.test(message)) {
    return { category: "GIT_OPERATION_ERROR", retryable: false };
  }
  return { category: "UNKNOWN_ERROR", retryable: false };
}

export function creerDiagnosticOperation(
  error: unknown,
  operation: string,
  step: string,
  startedAt: number,
  token: string | null
): OperationDiagnostic {
  const facts = factsFromError(error, token);
  const classification = classify(facts);
  const retrySafeStep =
    (operation === "publication / synchronisation" &&
      ["synchronize_with_github", "verify_remote_publication"].includes(step)) ||
    (operation === "création / publication" &&
      ["push_to_github", "verify_remote_publication"].includes(step)) ||
    (operation === "clonage" && step === "clone_repository") ||
    (operation === "chargement des dépôts" && step === "list_repositories");
  const safeTechnicalDetails = [
    facts.message || "Aucun détail fourni par le système.",
    facts.rateLimitRemaining ? `rate-limit-remaining=${facts.rateLimitRemaining}` : "",
    facts.retryAfter ? `retry-after=${facts.retryAfter}` : "",
    facts.rateLimitReset ? `rate-limit-reset=${facts.rateLimitReset}` : "",
  ].filter(Boolean).join("\n").slice(0, 2200);

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `diag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    operation: redact(operation, token),
    step: redact(step, token),
    category: classification.category,
    retryable: classification.retryable && retrySafeStep,
    occurredAt: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    code: facts.code,
    technicalDetails: safeTechnicalDetails,
  };
}

export function messageDiagnostic(
  category: OperationErrorCategory,
  lang: "fr" | "en" | "es"
): string {
  const messages: Record<OperationErrorCategory, Record<"fr" | "en" | "es", string>> = {
    AUTHENTICATION_ERROR: {
      fr: "Votre connexion GitHub n’est plus valide. Reconnectez votre compte, puis réessayez.",
      en: "Your GitHub session is no longer valid. Reconnect your account, then retry.",
      es: "La sesión de GitHub ya no es válida. Vuelve a conectar tu cuenta e inténtalo de nuevo.",
    },
    PERMISSION_DENIED: {
      fr: "Votre compte ne dispose pas des autorisations nécessaires. Vérifiez aussi les restrictions de branche ou SSO de l’organisation.",
      en: "Your account lacks the required permissions. Also check branch restrictions or organization SSO.",
      es: "Tu cuenta no tiene los permisos necesarios. Comprueba también las restricciones de rama o SSO de la organización.",
    },
    NETWORK_ERROR: {
      fr: "Impossible de joindre GitHub. Vérifiez votre connexion Internet et réessayez.",
      en: "Could not reach GitHub. Check your internet connection and retry.",
      es: "No se pudo conectar con GitHub. Comprueba tu conexión a Internet e inténtalo de nuevo.",
    },
    GITHUB_RATE_LIMIT: {
      fr: "GitHub limite temporairement les requêtes. Attendez avant de réessayer.",
      en: "GitHub is temporarily rate-limiting requests. Wait before retrying.",
      es: "GitHub está limitando temporalmente las solicitudes. Espera antes de volver a intentarlo.",
    },
    REPOSITORY_NOT_FOUND: {
      fr: "Le dépôt est introuvable ou votre compte n’est pas autorisé à y accéder.",
      en: "The repository was not found or your account cannot access it.",
      es: "No se encontró el repositorio o tu cuenta no puede acceder.",
    },
    REPOSITORY_ALREADY_EXISTS: {
      fr: "Un dépôt portant déjà ce nom existe. Choisissez un autre nom ou associez le dépôt existant.",
      en: "A repository with this name already exists. Choose another name or link the existing repository.",
      es: "Ya existe un repositorio con ese nombre. Elige otro nombre o vincula el repositorio existente.",
    },
    NOT_A_GIT_REPOSITORY: {
      fr: "Git ne reconnaît pas ce dossier comme un dépôt valide. Les fichiers locaux ont été conservés; vérifiez le dossier ou ses métadonnées Git.",
      en: "Git does not recognize this folder as a valid repository. Local files were preserved; check the folder or its Git metadata.",
      es: "Git no reconoce esta carpeta como un repositorio válido. Se conservaron los archivos locales; revisa la carpeta o sus metadatos Git.",
    },
    INVALID_WORKING_DIRECTORY: {
      fr: "Le dossier de travail est introuvable ou inaccessible. Vérifiez le chemin et les permissions.",
      en: "The working directory is missing or inaccessible. Check the path and permissions.",
      es: "El directorio de trabajo no existe o no es accesible. Comprueba la ruta y los permisos.",
    },
    INVALID_PATH: {
      fr: "Le chemin fourni n’est pas valide pour cette opération.",
      en: "The supplied path is not valid for this operation.",
      es: "La ruta indicada no es válida para esta operación.",
    },
    CLONE_DESTINATION_ERROR: {
      fr: "Le clonage ne peut pas utiliser cette destination. Vérifiez qu’elle n’existe pas déjà et que son dossier parent est accessible.",
      en: "The clone cannot use this destination. Check that it does not already exist and that its parent folder is accessible.",
      es: "No se puede clonar en este destino. Comprueba que no exista ya y que su carpeta superior sea accesible.",
    },
    GIT_NOT_INSTALLED: {
      fr: "Git est introuvable sur cet ordinateur. Vérifiez son installation et sa configuration.",
      en: "Git could not be found. Check that it is installed and available in PATH.",
      es: "No se encontró Git. Comprueba que esté instalado y disponible en PATH.",
    },
    LOCAL_PROJECT_ERROR: {
      fr: "Le dossier du projet est invalide ou inaccessible. Sélectionnez-le à nouveau.",
      en: "The project folder is invalid or inaccessible. Select it again.",
      es: "La carpeta del proyecto no es válida o no se puede acceder. Selecciónala de nuevo.",
    },
    GIT_OPERATION_ERROR: {
      fr: "Une commande Git a échoué. Consultez les détails techniques pour identifier la commande et sa sortie.",
      en: "A Git command failed. Review the technical details for the command and its output.",
      es: "Falló un comando de Git. Consulta los detalles técnicos para identificar el comando y su salida.",
    },
    CONFLICT_ERROR: {
      fr: "Les modifications locales et distantes ne peuvent pas être synchronisées automatiquement. Une intervention est nécessaire.",
      en: "Local and remote changes cannot be synchronized automatically. Manual intervention is required.",
      es: "Los cambios locales y remotos no se pueden sincronizar automáticamente. Se requiere intervención.",
    },
    TIMEOUT_ERROR: {
      fr: "L’opération a dépassé le délai autorisé. Vérifiez la connexion et l’état du dépôt avant de réessayer.",
      en: "The operation timed out. Check the connection and repository state before retrying.",
      es: "La operación superó el tiempo permitido. Comprueba la conexión y el estado del repositorio antes de reintentar.",
    },
    UNKNOWN_ERROR: {
      fr: "Une erreur non classée a interrompu l’opération. Consultez les détails techniques et transmettez l’identifiant de diagnostic.",
      en: "An unclassified error interrupted the operation. Review the technical details and provide the diagnostic ID.",
      es: "Un error sin clasificar interrumpió la operación. Consulta los detalles técnicos e indica el ID de diagnóstico.",
    },
  };
  return messages[category][lang];
}

export function journalOperationSuccess(operation: string, step: string, startedAt: number): void {
  console.info("[Gsimplifié] Opération terminée", {
    id: globalThis.crypto?.randomUUID?.() ?? `diag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    operation,
    step,
    occurredAt: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    result: "success",
  });
}
