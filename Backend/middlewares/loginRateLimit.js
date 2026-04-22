/**
 * Middleware de limitation des tentatives de connexion.
 *
 * Ce rate limit garde un etat en memoire par couple `ip + email`.
 * Il ne compte que les echec reels de connexion et remet le compteur
 * a zero apres une connexion reussie.
 */

function nettoyerEntreesExpirees(store, maintenant) {
  for (const [cle, entree] of store.entries()) {
    if (entree.expiresAt <= maintenant) {
      store.delete(cle);
    }
  }
}

function construireCleClient(request) {
  const ip =
    request.ip ||
    request.headers["x-forwarded-for"] ||
    request.socket?.remoteAddress ||
    "unknown";
  const email = String(request.body?.email || "").trim().toLowerCase();

  return `${ip}:${email}`;
}

export function createLoginRateLimit(options = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxAttempts = options.maxAttempts ?? 5;
  const message =
    options.message ??
    "Trop de tentatives de connexion. Reessayez plus tard.";
  const store = new Map();

  function obtenirEntreeActive(request) {
    const maintenant = Date.now();
    nettoyerEntreesExpirees(store, maintenant);

    const cleClient = construireCleClient(request);
    const entree = store.get(cleClient);

    if (!entree || entree.expiresAt <= maintenant) {
      return {
        cleClient,
        entree: null,
        maintenant,
      };
    }

    return {
      cleClient,
      entree,
      maintenant,
    };
  }

  function loginRateLimit(request, response, next) {
    const { entree, maintenant } = obtenirEntreeActive(request);

    if (entree && entree.count >= maxAttempts && entree.expiresAt > maintenant) {
      const attente_secondes = Math.ceil((entree.expiresAt - maintenant) / 1000);

      return response.status(429).json({
        message,
        tentatives_restantes: 0,
        attente_secondes,
      });
    }

    return next();
  }

  loginRateLimit.enregistrerEchec = function enregistrerEchec(request) {
    const { cleClient, entree, maintenant } = obtenirEntreeActive(request);
    const count = (entree?.count || 0) + 1;
    const expiresAt = entree?.expiresAt || maintenant + windowMs;

    store.set(cleClient, {
      count,
      expiresAt,
    });

    const tentatives_restantes = Math.max(0, maxAttempts - count);
    const attente_secondes = Math.max(
      0,
      Math.ceil((expiresAt - maintenant) / 1000)
    );
    const estBloque = count >= maxAttempts;

    request.rateLimitInfo = {
      tentatives_restantes,
      attente_secondes,
      estBloque,
    };

    return request.rateLimitInfo;
  };

  loginRateLimit.reinitialiser = function reinitialiser(request) {
    const cleClient = construireCleClient(request);
    store.delete(cleClient);
    request.rateLimitInfo = null;
  };

  return loginRateLimit;
}
