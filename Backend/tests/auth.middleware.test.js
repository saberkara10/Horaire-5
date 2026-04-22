/**
 * TESTS - Middlewares Auth
 *
 * Ce fichier couvre les regles d'acces
 * appliquees par les middlewares d'authentification.
 */
import { describe, expect, it, jest } from "@jest/globals";
import {
  userAdmin,
  userAdminOrResponsable,
  userAdminResponsable,
  userAuth,
  userNotAuth,
  userResponsable,
} from "../middlewares/auth.js";

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
}

function createJsonResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
}

describe("middlewares auth", () => {
  it("userAuth appelle next si utilisateur connecte", () => {
    const request = { user: { id: 1 } };
    const response = createResponse();
    const next = jest.fn();

    userAuth(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("userAuth accepte aussi un utilisateur stocke en session", () => {
    const request = { session: { user: { id: 7 } } };
    const response = createResponse();
    const next = jest.fn();

    userAuth(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("userAuth retourne 401 si utilisateur absent", () => {
    const request = {};
    const response = createResponse();
    const next = jest.fn();

    userAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("userNotAuth appelle next si utilisateur absent", () => {
    const request = {};
    const response = createResponse();
    const next = jest.fn();

    userNotAuth(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userNotAuth retourne 401 si utilisateur deja connecte", () => {
    const request = { user: { id: 1 } };
    const response = createResponse();
    const next = jest.fn();

    userNotAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
  });

  it("userAdmin appelle next si role ADMIN present", () => {
    const request = { user: { roles: ["ADMIN"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdmin(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userAdmin appelle next si role RESPONSABLE present", () => {
    const request = { user: { roles: ["RESPONSABLE"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdmin(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("userAdmin accepte aussi le format user.role", () => {
    const request = { user: { role: "ADMIN" } };
    const response = createResponse();
    const next = jest.fn();

    userAdmin(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("userAdmin retourne 401 si les roles admin sont absents", () => {
    const request = { user: { roles: ["UTILISATEUR"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdmin(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
  });

  it("userAdminResponsable appelle next pour ADMIN_RESPONSABLE", () => {
    const request = { user: { roles: ["ADMIN_RESPONSABLE"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdminResponsable(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userAdminResponsable retourne un JSON 401 sinon", () => {
    const request = { user: { roles: ["ADMIN"] } };
    const response = createJsonResponse();
    const next = jest.fn();

    userAdminResponsable(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Acces reserve a l'Admin Responsable.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("userResponsable appelle next si role RESPONSABLE present", () => {
    const request = { user: { roles: ["RESPONSABLE"] } };
    const response = createResponse();
    const next = jest.fn();

    userResponsable(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userResponsable retourne 401 si role RESPONSABLE absent", () => {
    const request = { user: { roles: ["ADMIN"] } };
    const response = createResponse();
    const next = jest.fn();

    userResponsable(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
  });

  it("userAdminOrResponsable appelle next pour un admin", () => {
    const request = { user: { roles: ["ADMIN"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdminOrResponsable(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userAdminOrResponsable retourne 403 avec JSON si aucun role autorise", () => {
    const request = { user: { roles: ["ETUDIANT"] } };
    const response = createJsonResponse();
    const next = jest.fn();

    userAdminOrResponsable(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      message: "Acces refuse.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
