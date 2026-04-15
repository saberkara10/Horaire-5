/**
 * TEST SETUP - Backend
 *
 * Ce fichier filtre le bruit inutile
 * dans la sortie terminal des tests.
 */
import { afterAll, beforeAll, jest } from "@jest/globals";

const logOriginal = console.log;

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation((...args) => {
    const premierArgument = String(args[0] || "");

    if (premierArgument.startsWith("[dotenv@")) {
      return;
    }

    logOriginal(...args);
  });
});

afterAll(() => {
  if (typeof console.log?.mockRestore === "function") {
    console.log.mockRestore();
  }
});
