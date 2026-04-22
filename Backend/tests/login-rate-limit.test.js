import { afterEach, describe, expect, jest, test } from "@jest/globals";

import { createLoginRateLimit } from "../middlewares/loginRateLimit.js";

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("loginRateLimit", () => {
  test("laisse passer une requete sans echec enregistre", () => {
    const limiter = createLoginRateLimit();
    const request = {
      ip: "127.0.0.1",
      headers: {},
      body: { email: "admin@ecole.ca" },
    };
    const response = createResponse();
    const next = jest.fn();

    limiter(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  test("bloque apres le nombre maximal de tentatives", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_000);

    const limiter = createLoginRateLimit({ windowMs: 60_000, maxAttempts: 2 });
    const request = {
      ip: "127.0.0.1",
      headers: {},
      body: { email: "admin@ecole.ca" },
    };
    const response = createResponse();
    const next = jest.fn();

    const firstInfo = limiter.enregistrerEchec(request);
    const secondInfo = limiter.enregistrerEchec(request);
    limiter(request, response, next);

    expect(firstInfo).toEqual({
      tentatives_restantes: 1,
      attente_secondes: 60,
      estBloque: false,
    });
    expect(secondInfo).toEqual({
      tentatives_restantes: 0,
      attente_secondes: 60,
      estBloque: true,
    });
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      message: "Trop de tentatives de connexion. Reessayez plus tard.",
      tentatives_restantes: 0,
      attente_secondes: 60,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("reinitialise l'entree apres une connexion reussie", () => {
    jest.spyOn(Date, "now").mockReturnValue(2_000);

    const limiter = createLoginRateLimit({ windowMs: 60_000, maxAttempts: 1 });
    const request = {
      ip: "127.0.0.1",
      headers: {},
      body: { email: "admin@ecole.ca" },
    };
    const response = createResponse();
    const next = jest.fn();

    limiter.enregistrerEchec(request);
    limiter.reinitialiser(request);
    limiter(request, response, next);

    expect(request.rateLimitInfo).toBeNull();
    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  test("nettoie les entrees expirees avant de verifier un blocage", () => {
    const dateNowSpy = jest.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(10_000);

    const limiter = createLoginRateLimit({ windowMs: 5_000, maxAttempts: 1 });
    const request = {
      ip: "127.0.0.1",
      headers: { "x-forwarded-for": "10.0.0.8" },
      socket: { remoteAddress: "10.0.0.9" },
      body: { email: "ADMIN@ecole.ca" },
    };

    limiter.enregistrerEchec(request);
    dateNowSpy.mockReturnValue(16_000);

    const response = createResponse();
    const next = jest.fn();
    limiter(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });
});
