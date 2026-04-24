import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const construireErreurConflitMock = jest.fn();
const normaliserRessourceDepuisPayloadMock = jest.fn();
const verifierDisponibiliteRessourceMock = jest.fn();

await jest.unstable_mockModule("../src/services/concurrency.service.js", () => ({
  construireErreurConflit: construireErreurConflitMock,
  normaliserRessourceDepuisPayload: normaliserRessourceDepuisPayloadMock,
  verifierDisponibiliteRessource: verifierDisponibiliteRessourceMock,
}));

const { requireResourceLock } = await import("../middlewares/concurrency.js");

function createResponse() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
}

describe("requireResourceLock middleware", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("laisse passer immediatement en environnement de test", async () => {
    process.env.NODE_ENV = "test";
    const next = jest.fn();

    await requireResourceLock("cours")( { params: { id: "4" } }, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(normaliserRessourceDepuisPayloadMock).not.toHaveBeenCalled();
  });

  test("laisse passer quand la ressource est disponible avec le verrou courant", async () => {
    process.env.NODE_ENV = "development";
    normaliserRessourceDepuisPayloadMock.mockReturnValue({
      resourceType: "cours",
      resourceId: "17",
    });
    verifierDisponibiliteRessourceMock.mockResolvedValue({
      available: true,
      own_lock: true,
      lock: { id_lock: 3 },
    });
    const next = jest.fn();
    const request = { params: { id: "17" } };

    await requireResourceLock("cours")(request, createResponse(), next);

    expect(normaliserRessourceDepuisPayloadMock).toHaveBeenCalledWith({
      resource_type: "cours",
      resource_id: "17",
    });
    expect(verifierDisponibiliteRessourceMock).toHaveBeenCalledWith(
      "cours",
      "17",
      request
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("laisse passer quand la ressource est libre sans verrou existant", async () => {
    process.env.NODE_ENV = "development";
    normaliserRessourceDepuisPayloadMock.mockReturnValue({
      resourceType: "generation",
      resourceId: "global",
    });
    verifierDisponibiliteRessourceMock.mockResolvedValue({
      available: true,
      own_lock: false,
      lock: null,
    });
    const next = jest.fn();

    await requireResourceLock("generation", () => "global")(
      { params: {}, body: {} },
      createResponse(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("retourne une erreur de conflit quand la ressource est occupee", async () => {
    process.env.NODE_ENV = "development";
    normaliserRessourceDepuisPayloadMock.mockReturnValue({
      resourceType: "planification",
      resourceId: "55",
    });
    verifierDisponibiliteRessourceMock.mockResolvedValue({
      available: false,
      own_lock: false,
      lock: { id_lock: 44, resource_id: "55" },
    });
    construireErreurConflitMock.mockReturnValue({
      status: 409,
      message: "Conflit detecte.",
      lock: { id_lock: 44, resource_id: "55" },
    });
    const response = createResponse();
    const next = jest.fn();

    await requireResourceLock("planification")(
      { params: { id: "55" } },
      response,
      next
    );

    expect(construireErreurConflitMock).toHaveBeenCalledWith({
      id_lock: 44,
      resource_id: "55",
    });
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message: "Conflit detecte.",
      lock: { id_lock: 44, resource_id: "55" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("retourne une erreur normalisee si la validation de ressource echoue", async () => {
    process.env.NODE_ENV = "development";
    normaliserRessourceDepuisPayloadMock.mockImplementation(() => {
      const error = new Error("Identifiant invalide.");
      error.status = 400;
      throw error;
    });
    const response = createResponse();

    await requireResourceLock("cours")(
      { params: { id: "" } },
      response,
      jest.fn()
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Identifiant invalide.",
    });
  });
});
