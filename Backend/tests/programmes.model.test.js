import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const queryMock = jest.fn();
const normaliserNomProgrammeMock = jest.fn((value) => {
  const normalized = String(value || "").trim();
  const aliases = {
    "dev web": "Developpement Web",
    "developpement web": "Developpement Web",
    "data": "Analyse de donnees",
    "analyse de donnees": "Analyse de donnees",
  };

  return aliases[normalized.toLowerCase()] || normalized;
});
const normaliserTexteMock = jest.fn((value) =>
  String(value || "")
    .trim()
    .toLowerCase()
);

await jest.unstable_mockModule("../db.js", () => ({
  default: {
    query: queryMock,
  },
}));

await jest.unstable_mockModule("../src/utils/programmes.js", () => ({
  normaliserNomProgramme: normaliserNomProgrammeMock,
  normaliserTexte: normaliserTexteMock,
}));

const {
  assurerProgrammeReference,
  normaliserEtDedupliquerProgrammes,
  recupererProgrammesDisponibles,
} = await import("../src/model/programmes.model.js");

describe("programmes.model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normaliserEtDedupliquerProgrammes filtre les vides, deduplique et trie", () => {
    const result = normaliserEtDedupliquerProgrammes([
      "  ",
      "Dev Web",
      "Developpement Web",
      "Data",
      "Analyse de donnees",
      "Commerce",
    ]);

    expect(result).toEqual(["Analyse de donnees", "Commerce", "Developpement Web"]);
  });

  test("assurerProgrammeReference ignore les valeurs vides", async () => {
    normaliserNomProgrammeMock.mockReturnValueOnce("");

    await expect(assurerProgrammeReference("   ")).resolves.toBe("");
    expect(queryMock).not.toHaveBeenCalled();
  });

  test("assurerProgrammeReference insere le programme normalise", async () => {
    const executor = { query: jest.fn().mockResolvedValue([{}]) };

    await expect(assurerProgrammeReference("Dev Web", executor)).resolves.toBe(
      "Developpement Web"
    );
    expect(executor.query).toHaveBeenCalledWith(
      `INSERT IGNORE INTO programmes_reference (nom_programme)
     VALUES (?)`,
      ["Developpement Web"]
    );
  });

  test("recupererProgrammesDisponibles consolide les sources SQL", async () => {
    queryMock.mockResolvedValue([
      [
        { programme: "Dev Web" },
        { programme: "Analyse de donnees" },
        { programme: "Commerce" },
        { programme: "Developpement Web" },
        { programme: "" },
      ],
    ]);

    await expect(recupererProgrammesDisponibles()).resolves.toEqual([
      "Analyse de donnees",
      "Commerce",
      "Developpement Web",
    ]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
