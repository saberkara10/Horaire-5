import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const creerActivityLogMock = jest.fn();
const listerActivityLogsMock = jest.fn();
const obtenirResumeActivityLogsMock = jest.fn();
const recupererActivityLogParIdMock = jest.fn();
const supprimerActivityLogsExpiresMock = jest.fn();

await jest.unstable_mockModule("../src/model/activity-log.model.js", () => ({
  creerActivityLog: creerActivityLogMock,
  listerActivityLogs: listerActivityLogsMock,
  obtenirResumeActivityLogs: obtenirResumeActivityLogsMock,
  recupererActivityLogParId: recupererActivityLogParIdMock,
  supprimerActivityLogsExpires: supprimerActivityLogsExpiresMock,
}));

const {
  journaliserActivite,
  sanitiserAuditValue,
  listerJournalActivite,
  recupererEvenementJournal,
  obtenirResumeJournalActivite,
  nettoyerJournalActiviteExpire,
} = await import("../src/services/activity-log.service.js");

describe("activity log service", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalForceAudit = process.env.FORCE_AUDIT_LOGS_IN_TESTS;
  const originalRetention = process.env.AUDIT_LOG_RETENTION_DAYS;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.FORCE_AUDIT_LOGS_IN_TESTS = "1";
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalForceAudit === undefined) {
      delete process.env.FORCE_AUDIT_LOGS_IN_TESTS;
    } else {
      process.env.FORCE_AUDIT_LOGS_IN_TESTS = originalForceAudit;
    }

    if (originalRetention === undefined) {
      delete process.env.AUDIT_LOG_RETENTION_DAYS;
    } else {
      process.env.AUDIT_LOG_RETENTION_DAYS = originalRetention;
    }

    consoleErrorSpy.mockRestore();
  });

  test("sanitiserAuditValue masque les cles sensibles et tronque les structures profondes", () => {
    const valeur = {
      password: "secret",
      nested: {
        token: "abc",
        headers: [{ authorization: "Bearer value" }],
      },
      longList: Array.from({ length: 60 }, (_, index) => ({ sid: index })),
      deep: {
        a: {
          b: {
            c: {
              d: {
                e: {
                  f: "trop-profond",
                },
              },
            },
          },
        },
      },
    };

    const resultat = sanitiserAuditValue(valeur);

    expect(resultat.password).toBe("[MASQUE]");
    expect(resultat.nested.token).toBe("[MASQUE]");
    expect(resultat.nested.headers[0].authorization).toBe("[MASQUE]");
    expect(resultat.longList).toHaveLength(50);
    expect(resultat.deep.a.b.c.d.e).toBe("[TRONQUE]");
  });

  test("journaliserActivite construit un log sanitise avec les metadonnees de requete", async () => {
    creerActivityLogMock.mockResolvedValueOnce({ id_log: 55 });

    const request = {
      headers: {
        "x-forwarded-for": "10.1.2.3, 127.0.0.1",
        "user-agent": "jest-test",
      },
      user: {
        id: 9,
        prenom: "Aya",
        nom: "Diallo",
        roles: ["ADMIN", "RESPONSABLE"],
      },
    };

    const resultat = await journaliserActivite({
      request,
      actionType: "login",
      module: "Authentification",
      targetType: "Utilisateur",
      targetId: 9,
      description: "  Connexion reussie  ",
      oldValue: { password: "secret" },
      newValue: { cookie: "sid=123", success: true },
    });

    expect(resultat).toEqual({ id_log: 55 });
    expect(creerActivityLogMock).toHaveBeenCalledWith({
      user_id: 9,
      user_name: "Aya Diallo",
      user_role: "ADMIN,RESPONSABLE",
      action_type: "LOGIN",
      module: "Authentification",
      target_type: "Utilisateur",
      target_id: 9,
      description: "Connexion reussie",
      old_value: { password: "[MASQUE]" },
      new_value: { cookie: "[MASQUE]", success: true },
      status: "SUCCESS",
      error_message: null,
      ip_address: "10.1.2.3",
      user_agent: "jest-test",
    });
  });

  test("journaliserActivite utilise les fallbacks explicites quand aucun utilisateur n'est present", async () => {
    creerActivityLogMock.mockResolvedValueOnce({ id_log: 73 });

    await journaliserActivite({
      action_type: "reset",
      module: "Systeme",
      userName: "Batch Scheduler",
      userRole: "SCRIPT",
      email: "batch@example.test",
      status: "invalide",
      ipAddress: "127.0.0.1",
      userAgent: "agent",
    });

    expect(creerActivityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        user_name: "Batch Scheduler",
        user_role: "SCRIPT",
        action_type: "RESET",
        status: "SUCCESS",
        ip_address: "127.0.0.1",
        user_agent: "agent",
      })
    );
  });

  test("journaliserActivite est inert en test si la journalisation n'est pas forcee", async () => {
    delete process.env.FORCE_AUDIT_LOGS_IN_TESTS;

    const resultat = await journaliserActivite({
      actionType: "CREATE",
      module: "Sessions",
    });

    expect(resultat).toBeNull();
    expect(creerActivityLogMock).not.toHaveBeenCalled();
  });

  test("journaliserActivite absorbe les erreurs internes et journalise l'echec sur stderr", async () => {
    const resultat = await journaliserActivite({
      actionType: "UNKNOWN_ACTION",
      module: "Application",
    });

    expect(resultat).toBeNull();
    expect(creerActivityLogMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[audit-log] journalisation impossible:",
      expect.stringContaining("Type d'action audit invalide")
    );
  });

  test("les fonctions de lecture deleguent au modele et nettoient selon la retention", async () => {
    listerActivityLogsMock.mockResolvedValueOnce({ data: [] });
    recupererActivityLogParIdMock.mockResolvedValueOnce({ id_log: 4 });
    obtenirResumeActivityLogsMock.mockResolvedValueOnce({ total: 4 });
    supprimerActivityLogsExpiresMock.mockResolvedValueOnce({ deleted: 3 });
    process.env.AUDIT_LOG_RETENTION_DAYS = "180";

    await expect(listerJournalActivite({ module: "Horaires" })).resolves.toEqual({
      data: [],
    });
    await expect(recupererEvenementJournal(4)).resolves.toEqual({ id_log: 4 });
    await expect(obtenirResumeJournalActivite()).resolves.toEqual({ total: 4 });
    await expect(nettoyerJournalActiviteExpire()).resolves.toEqual({ deleted: 3 });

    expect(listerActivityLogsMock).toHaveBeenCalledWith({ module: "Horaires" });
    expect(recupererActivityLogParIdMock).toHaveBeenCalledWith(4);
    expect(obtenirResumeActivityLogsMock).toHaveBeenCalledTimes(1);
    expect(supprimerActivityLogsExpiresMock).toHaveBeenCalledWith(180);
  });
});
