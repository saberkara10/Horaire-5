import { describe, it, expect, jest } from "@jest/globals";
import {
  userAuth,
  userNotAuth,
  userAdmin,
  userResponsable,
} from "../middlewares/auth.js";

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
}

describe("middlewares auth", () => {
  it("userAuth appelle next si utilisateur connecté", () => {
    const request = { user: { id: 1 } };
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

  it("userNotAuth retourne 401 si utilisateur déjà connecté", () => {
    const request = { user: { id: 1 } };
    const response = createResponse();
    const next = jest.fn();

    userNotAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
  });

  it("userAdmin appelle next si rôle ADMIN présent", () => {
    const request = { user: { roles: ["ADMIN"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdmin(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userAdmin retourne 401 si rôle ADMIN absent", () => {
    const request = { user: { roles: ["RESPONSABLE"] } };
    const response = createResponse();
    const next = jest.fn();

    userAdmin(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
  });

  it("userResponsable appelle next si rôle RESPONSABLE présent", () => {
    const request = { user: { roles: ["RESPONSABLE"] } };
    const response = createResponse();
    const next = jest.fn();

    userResponsable(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("userResponsable retourne 401 si rôle RESPONSABLE absent", () => {
    const request = { user: { roles: ["ADMIN"] } };
    const response = createResponse();
    const next = jest.fn();

    userResponsable(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalled();
  });
});