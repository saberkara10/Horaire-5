import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

const PDF_PAGE = {
  size: "A3",
  layout: "landscape",
  margins: { top: 24, bottom: 24, left: 24, right: 24 },
};

const DAYS = [
  { index: 0, label: "Lundi" },
  { index: 1, label: "Mardi" },
  { index: 2, label: "Mercredi" },
  { index: 3, label: "Jeudi" },
  { index: 4, label: "Vendredi" },
  { index: 5, label: "Samedi" },
  { index: 6, label: "Dimanche" },
];

const GRID_DEFAULT_START_MINUTES = 8 * 60;
const GRID_DEFAULT_END_MINUTES = 20 * 60;
const GRID_MIN_START_MINUTES = 6 * 60;
const GRID_MAX_END_MINUTES = 24 * 60;
const MIN_GRID_DURATION = 8 * 60;
const EXCEL_SLOT_MINUTES = 30;
const PDF_TABLE_HEADER_HEIGHT = 24;
const PDF_TABLE_MIN_ROW_HEIGHT = 24;
const EXCEL_FONT_FAMILY = "Aptos";
const EXCEL_WEEKLY_TIME_WIDTH = 13;
const EXCEL_WEEKLY_DAY_WIDTH = 26;
const EXCEL_DETAIL_HEADER_ROW = 4;
const EXCEL_WEEKLY_FREEZE_ROW = 4;
const EXCEL_WEEKLY_BASE_ROW_HEIGHT = 20;
const EXCEL_WEEKLY_LINE_HEIGHT = 12;

/**
 * Identite visuelle des exports.
 *
 * Regle metier explicite :
 * - orange reserve aux cours echoues / reprises
 * - bleu reserve aux exceptions individuelles etudiantes
 * - vert conserve la planification principale
 */
const COLORS = {
  ink: "#111827",
  text: "#102216",
  muted: "#4B6354",
  brand: "#166534",
  brandStrong: "#0F3D2E",
  brandSoft: "#DCFCE7",
  brandSurface: "#F0FDF4",
  brandSurfaceStrong: "#E5F7EA",
  section: "#F6FBF7",
  panel: "#FFFFFF",
  panelSoft: "#F7FAF7",
  border: "#BBD3C2",
  borderSoft: "#DDEBE1",
  warning: "#EA580C",
  warningSoft: "#FFF1E6",
  warningBorder: "#F7B78A",
  info: "#2563EB",
  infoStrong: "#1D4ED8",
  infoText: "#1E3A8A",
  infoSoft: "#EFF6FF",
  infoBorder: "#93C5FD",
  scheduleGrid: "#95AAA0",
  scheduleGridSoft: "#B8C7BF",
  white: "#FFFFFF",
};

const BLOCK_PALETTES = {
  groupe: [
    { fill: "#EDF8F0", stroke: "#166534", text: COLORS.text, accent: "#166534" },
    { fill: "#E8F5EC", stroke: "#15803D", text: COLORS.text, accent: "#15803D" },
    { fill: "#F3FBF5", stroke: "#2F855A", text: COLORS.text, accent: "#2F855A" },
  ],
  professeur: [
    { fill: "#ECF9F1", stroke: "#166534", text: COLORS.text, accent: "#166534" },
    { fill: "#E7F6EA", stroke: "#0F766E", text: COLORS.text, accent: "#15803D" },
    { fill: "#F2FBF4", stroke: "#2F855A", text: COLORS.text, accent: "#2F855A" },
  ],
  etudiant: [
    { fill: "#EEF9F1", stroke: "#166534", text: COLORS.text, accent: "#166534" },
    { fill: "#E8F6EB", stroke: "#15803D", text: COLORS.text, accent: "#15803D" },
    { fill: "#F3FBF5", stroke: "#2F855A", text: COLORS.text, accent: "#2F855A" },
  ],
  individuelle: {
    fill: COLORS.infoSoft,
    stroke: COLORS.info,
    text: COLORS.infoText,
    accent: COLORS.infoStrong,
  },
  reprise: {
    fill: COLORS.warningSoft,
    stroke: COLORS.warning,
    text: "#8A2F06",
    accent: COLORS.warning,
  },
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function formatTime(value) {
  return cleanString(value).slice(0, 5);
}

function timeToMinutes(value) {
  const [hoursText = "0", minutesText = "0"] = formatTime(value).split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function minutesToLabel(minutes) {
  const normalized = Math.max(0, Math.min(minutes, 24 * 60));
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function parseLocalDate(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = cleanString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.slice(0, 10));
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) {
    return new Date(1970, 0, 1);
  }

  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function getWeekStart(value) {
  const date = parseLocalDate(value);
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getDayIndex(value) {
  return (parseLocalDate(value).getDay() + 6) % 7;
}

function formatDateShort(value) {
  return parseLocalDate(value).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  });
}

function formatDateLong(value) {
  return parseLocalDate(value).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatToday() {
  return new Date().toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function composeSessionLabel(session, year) {
  const sessionLabel = cleanString(session);
  const yearLabel = cleanString(year);

  if (!sessionLabel) {
    return yearLabel;
  }

  if (!yearLabel || sessionLabel.includes(yearLabel)) {
    return sessionLabel;
  }

  return `${sessionLabel} ${yearLabel}`;
}

function formatWeekRange(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${formatDateShort(weekStart)} au ${formatDateShort(end)}`;
}

function sortSessions(sessionA, sessionB) {
  const dateCompare = cleanString(sessionA?.date).localeCompare(cleanString(sessionB?.date), "fr");
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const startCompare = formatTime(sessionA?.heure_debut).localeCompare(
    formatTime(sessionB?.heure_debut),
    "fr"
  );
  if (startCompare !== 0) {
    return startCompare;
  }

  const endCompare = formatTime(sessionA?.heure_fin).localeCompare(formatTime(sessionB?.heure_fin), "fr");
  if (endCompare !== 0) {
    return endCompare;
  }

  return Number(sessionA?.id_affectation_cours || 0) - Number(sessionB?.id_affectation_cours || 0);
}

function groupSessionsByWeek(sessions) {
  const weeks = new Map();

  safeArray(sessions)
    .slice()
    .sort(sortSessions)
    .forEach((session) => {
      const weekStart = getWeekStart(session.date);
      const key = weekStart.toISOString().slice(0, 10);
      const bucket = weeks.get(key) || { weekStart, sessions: [] };
      bucket.sessions.push(session);
      weeks.set(key, bucket);
    });

  return [...weeks.values()].sort((weekA, weekB) => weekA.weekStart.getTime() - weekB.weekStart.getTime());
}

function getVisibleDays(sessions) {
  return DAYS;
}

function getGridBounds(sessions) {
  const items = safeArray(sessions);
  if (items.length === 0) {
    return {
      startMinutes: GRID_DEFAULT_START_MINUTES,
      endMinutes: Math.max(GRID_DEFAULT_END_MINUTES, GRID_DEFAULT_START_MINUTES + MIN_GRID_DURATION),
    };
  }

  const rawStart = items.reduce(
    (minimum, session) => Math.min(minimum, timeToMinutes(session.heure_debut)),
    GRID_DEFAULT_START_MINUTES
  );
  const rawEnd = items.reduce(
    (maximum, session) => Math.max(maximum, timeToMinutes(session.heure_fin)),
    GRID_DEFAULT_END_MINUTES
  );

  const startMinutes = Math.max(GRID_MIN_START_MINUTES, Math.floor(rawStart / 60) * 60);
  const roundedEnd = Math.ceil(rawEnd / 60) * 60;
  const endMinutes = Math.max(
    Math.min(Math.max(roundedEnd, startMinutes + 60), GRID_MAX_END_MINUTES),
    startMinutes + MIN_GRID_DURATION
  );

  return { startMinutes, endMinutes };
}

function hashString(value) {
  return [...cleanString(value)].reduce((hash, character) => {
    const next = (hash * 31 + character.charCodeAt(0)) % 2147483647;
    return next < 0 ? next + 2147483647 : next;
  }, 7);
}

function isStudentIndividualException(session) {
  return cleanString(session?.source_horaire) === "individuelle";
}

function getSessionVariant(entityType, session) {
  if (entityType === "etudiant" && Boolean(session?.est_reprise)) {
    return "reprise";
  }

  if (entityType === "etudiant" && isStudentIndividualException(session)) {
    return "individuelle";
  }

  return "standard";
}

function getBlockTheme(entityType, session) {
  const variant = getSessionVariant(entityType, session);

  if (variant === "reprise") {
    return BLOCK_PALETTES.reprise;
  }

  if (variant === "individuelle") {
    return BLOCK_PALETTES.individuelle;
  }

  const palette = BLOCK_PALETTES[entityType] || BLOCK_PALETTES.groupe;
  return palette[hashString(session?.code_cours || session?.nom_cours || entityType) % palette.length];
}

function formatRoom(session) {
  const type = cleanString(session?.type_salle).toLowerCase();

  if (type.includes("ligne") || type.includes("virtuel") || type.includes("distance")) {
    return "En ligne";
  }

  return cleanString(session?.code_salle) || "Salle a confirmer";
}

function formatProfessor(session) {
  return `${cleanString(session?.prenom_professeur)} ${cleanString(session?.nom_professeur)}`.trim() || "Professeur a confirmer";
}

function joinDisplayParts(parts) {
  return safeArray(parts)
    .map((part) => cleanString(part))
    .filter(Boolean)
    .join(" | ");
}

function formatStudentSource(session, defaultGroup = "") {
  if (Boolean(session?.est_reprise)) {
    return cleanString(session?.groupe_source) || "Groupe reprise a confirmer";
  }

  if (isStudentIndividualException(session)) {
    return cleanString(session?.groupe_source) || "Groupe d'accueil a confirmer";
  }

  return (
    cleanString(session?.groupe_source) ||
    cleanString(session?.nom_groupe) ||
    cleanString(defaultGroup) ||
    "Groupe principal"
  );
}

function formatStudentMainGroup(session, defaultGroup = "") {
  return (
    cleanString(defaultGroup) ||
    cleanString(session?.nom_groupe) ||
    cleanString(session?.groupe_principal) ||
    cleanString(session?.groupe_source) ||
    "Groupe principal a confirmer"
  );
}

function getStudentSessionTypeLabel(session) {
  if (Boolean(session?.est_reprise)) {
    return "Reprise";
  }

  if (isStudentIndividualException(session)) {
    return "Exception individuelle";
  }

  return "Groupe principal";
}

function normalizeDuration(startMinutes, endMinutes) {
  if (endMinutes <= startMinutes) {
    return startMinutes + 60;
  }

  return endMinutes;
}

function finalizeOverlapCluster(cluster, output) {
  const laneCount = Math.max(
    1,
    cluster.reduce((maximum, item) => Math.max(maximum, Number(item.__lane || 0)), 0) + 1
  );

  cluster.forEach((item) => {
    output.push({ ...item, __laneCount: laneCount });
  });
}

function layoutSessionsForDay(sessions) {
  const ordered = safeArray(sessions)
    .map((session) => {
      const startMinutes = timeToMinutes(session.heure_debut);
      const endMinutes = normalizeDuration(startMinutes, timeToMinutes(session.heure_fin));
      return {
        ...session,
        __startMinutes: startMinutes,
        __endMinutes: endMinutes,
      };
    })
    .sort((sessionA, sessionB) => {
      if (sessionA.__startMinutes !== sessionB.__startMinutes) {
        return sessionA.__startMinutes - sessionB.__startMinutes;
      }

      if (sessionA.__endMinutes !== sessionB.__endMinutes) {
        return sessionB.__endMinutes - sessionA.__endMinutes;
      }

      return sortSessions(sessionA, sessionB);
    });

  const output = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -1;

  ordered.forEach((session) => {
    if (cluster.length > 0 && session.__startMinutes >= clusterEnd) {
      finalizeOverlapCluster(cluster, output);
      cluster = [];
      laneEnds = [];
      clusterEnd = -1;
    }

    let lane = laneEnds.findIndex((endMinutes) => endMinutes <= session.__startMinutes);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(session.__endMinutes);
    } else {
      laneEnds[lane] = session.__endMinutes;
    }

    cluster.push({ ...session, __lane: lane });
    clusterEnd = Math.max(clusterEnd, session.__endMinutes);
  });

  if (cluster.length > 0) {
    finalizeOverlapCluster(cluster, output);
  }

  return output;
}

/**
 * Modele central partage par le PDF et l'Excel.
 *
 * La hierarchie d'affichage est stable :
 * 1. code + cours
 * 2. nature speciale (reprise / exception)
 * 3. groupe
 * 4. professeur
 * 5. salle / horaire
 */
function buildSessionPresentation(meta, session) {
  const variant = getSessionVariant(meta.entityType, session);
  const code = cleanString(session?.code_cours) || "Cours";
  const title = cleanString(session?.nom_cours) || code;
  const timeLabel = `${formatTime(session?.heure_debut)} - ${formatTime(session?.heure_fin)}`;
  const detailLines = [];
  let badgeLabel = null;

  if (meta.entityType === "groupe") {
    detailLines.push(`Professeur : ${formatProfessor(session)}`);
    detailLines.push(joinDisplayParts([`Salle : ${formatRoom(session)}`, `Horaire : ${timeLabel}`]));
  } else if (meta.entityType === "professeur") {
    detailLines.push(`Groupes : ${cleanString(session?.groupes) || "Groupe a confirmer"}`);
    detailLines.push(joinDisplayParts([`Salle : ${formatRoom(session)}`, `Horaire : ${timeLabel}`]));
  } else {
    detailLines.push(`Groupe principal : ${formatStudentMainGroup(session, meta.defaultGroup)}`);

    if (variant === "reprise") {
      badgeLabel = "REPRISE";
      detailLines.push(
        joinDisplayParts([
          "Type : Reprise",
          `Groupe suivi : ${formatStudentSource(session, meta.defaultGroup)}`,
        ])
      );
    } else if (variant === "individuelle") {
      badgeLabel = "EXCEPTION";
      detailLines.push(
        joinDisplayParts([
          "Type : Exception individuelle",
          `Groupe suivi : ${formatStudentSource(session, meta.defaultGroup)}`,
        ])
      );
    } else {
      detailLines.push("Type : Groupe principal");
    }

    detailLines.push(`Professeur : ${formatProfessor(session)}`);
    detailLines.push(joinDisplayParts([`Salle : ${formatRoom(session)}`, `Horaire : ${timeLabel}`]));
  }

  return {
    code,
    title,
    variant,
    badgeLabel,
    timeLabel,
    detailLines,
    theme: getBlockTheme(meta.entityType, session),
  };
}

function measureTextWidth(doc, text, font, size) {
  return doc.font(font).fontSize(size).widthOfString(cleanString(text));
}

function truncateTextToWidth(doc, text, width, font, size) {
  const value = cleanString(text);
  if (!value) {
    return "";
  }

  if (measureTextWidth(doc, value, font, size) <= width) {
    return value;
  }

  const ellipsis = "...";
  if (measureTextWidth(doc, ellipsis, font, size) >= width) {
    return ellipsis;
  }

  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${value.slice(0, middle).trimEnd()}${ellipsis}`;
    if (measureTextWidth(doc, candidate, font, size) <= width) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return `${value.slice(0, low).trimEnd()}${ellipsis}`;
}

function wrapTextToLines(doc, text, width, { font, size, maxLines }) {
  const value = cleanString(text);
  if (!value || width <= 0 || maxLines <= 0) {
    return [];
  }

  const tokens = value.split(/\s+/);
  const lines = [];
  let current = "";
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    const candidate = current ? `${current} ${token}` : token;

    if (measureTextWidth(doc, candidate, font, size) <= width) {
      current = candidate;
      index += 1;
      continue;
    }

    if (!current) {
      lines.push(truncateTextToWidth(doc, token, width, font, size));
      index += 1;
    } else {
      lines.push(current);
      current = "";
    }

    if (lines.length >= maxLines) {
      const remaining = [current, ...tokens.slice(index)].filter(Boolean).join(" ");
      if (remaining) {
        lines[maxLines - 1] = truncateTextToWidth(doc, remaining, width, font, size);
      }
      return lines.slice(0, maxLines);
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  return [
    ...lines.slice(0, maxLines - 1),
    truncateTextToWidth(doc, lines.slice(maxLines - 1).join(" "), width, font, size),
  ];
}

const BLOCK_LAYOUT_PROFILES = [
  {
    paddingX: 11,
    paddingTop: 9,
    paddingBottom: 9,
    badgeHeight: 16,
    badgeFontSize: 7,
    badgeInlineMinWidth: 128,
    badgeGap: 4,
    codeSize: 7.8,
    codeLineHeight: 8.5,
    titleSize: 10.2,
    titleLineHeight: 11.1,
    metaSize: 7.2,
    metaLineHeight: 8.2,
    titleGap: 3,
    metaGap: 3,
    radius: 14,
  },
  {
    paddingX: 9,
    paddingTop: 8,
    paddingBottom: 8,
    badgeHeight: 14,
    badgeFontSize: 6.4,
    badgeInlineMinWidth: 112,
    badgeGap: 3,
    codeSize: 7.1,
    codeLineHeight: 7.8,
    titleSize: 9,
    titleLineHeight: 9.8,
    metaSize: 6.4,
    metaLineHeight: 7.3,
    titleGap: 2.6,
    metaGap: 2.4,
    radius: 13,
  },
  {
    paddingX: 8,
    paddingTop: 7,
    paddingBottom: 7,
    badgeHeight: 12,
    badgeFontSize: 5.9,
    badgeInlineMinWidth: 96,
    badgeGap: 3,
    codeSize: 6.5,
    codeLineHeight: 7.1,
    titleSize: 8,
    titleLineHeight: 8.7,
    metaSize: 5.8,
    metaLineHeight: 6.5,
    titleGap: 2.2,
    metaGap: 2.1,
    radius: 12,
  },
  {
    paddingX: 6,
    paddingTop: 6,
    paddingBottom: 6,
    badgeHeight: 11,
    badgeFontSize: 5.5,
    badgeInlineMinWidth: 84,
    badgeGap: 2.5,
    codeSize: 6,
    codeLineHeight: 6.6,
    titleSize: 7.2,
    titleLineHeight: 7.8,
    metaSize: 5.3,
    metaLineHeight: 5.9,
    titleGap: 1.8,
    metaGap: 1.8,
    radius: 11,
  },
  {
    paddingX: 5,
    paddingTop: 5,
    paddingBottom: 5,
    badgeHeight: 10,
    badgeFontSize: 5.1,
    badgeInlineMinWidth: 76,
    badgeGap: 2,
    codeSize: 5.5,
    codeLineHeight: 6.1,
    titleSize: 6.5,
    titleLineHeight: 7,
    metaSize: 4.9,
    metaLineHeight: 5.4,
    titleGap: 1.4,
    metaGap: 1.5,
    radius: 10,
  },
  {
    paddingX: 4,
    paddingTop: 4,
    paddingBottom: 4,
    badgeHeight: 9,
    badgeFontSize: 4.7,
    badgeInlineMinWidth: 70,
    badgeGap: 1.5,
    codeSize: 5,
    codeLineHeight: 5.5,
    titleSize: 5.8,
    titleLineHeight: 6.2,
    metaSize: 4.5,
    metaLineHeight: 4.9,
    titleGap: 1.2,
    metaGap: 1.2,
    radius: 9,
  },
];

function wrapManyLines(doc, textLines, width, font, size) {
  return safeArray(textLines)
    .flatMap((line) => wrapTextToLines(doc, line, width, { font, size, maxLines: 24 }))
    .filter(Boolean);
}

function prepareBlockLayout(doc, presentation, width, height) {
  const accentWidth = width >= 92 ? 7 : width >= 72 ? 6 : 5;
  let fallbackLayout = null;

  for (const profile of BLOCK_LAYOUT_PROFILES) {
    const contentWidth = Math.max(width - accentWidth - profile.paddingX * 2 - 2, 26);
    const hasBadge = Boolean(presentation.badgeLabel);
    const inlineBadge = hasBadge && contentWidth >= profile.badgeInlineMinWidth;
    const badgeWidth = inlineBadge
      ? Math.min(
          contentWidth * 0.45,
          measureTextWidth(doc, presentation.badgeLabel, "Helvetica-Bold", profile.badgeFontSize) + 18
        )
      : 0;
    const codeWidth = inlineBadge ? Math.max(contentWidth - badgeWidth - 6, 22) : contentWidth;
    const codeLines = wrapTextToLines(doc, presentation.code, codeWidth, {
      font: "Helvetica-Bold",
      size: profile.codeSize,
      maxLines: 1,
    });
    const titleLines = wrapManyLines(doc, [presentation.title], contentWidth, "Helvetica-Bold", profile.titleSize);
    const metaLines = wrapManyLines(doc, presentation.detailLines, contentWidth, "Helvetica", profile.metaSize);

    let requiredHeight = profile.paddingTop + profile.paddingBottom;

    if (hasBadge && !inlineBadge) {
      requiredHeight += profile.badgeHeight + profile.badgeGap;
    }

    requiredHeight += Math.max(codeLines.length, 1) * profile.codeLineHeight;
    requiredHeight += profile.titleGap;
    requiredHeight += Math.max(titleLines.length, 1) * profile.titleLineHeight;

    if (metaLines.length > 0) {
      requiredHeight += profile.metaGap;
      requiredHeight += metaLines.length * profile.metaLineHeight;
    }

    fallbackLayout = {
      ...profile,
      accentWidth,
      contentWidth,
      codeWidth,
      badgeWidth,
      inlineBadge,
      codeLines,
      titleLines,
      metaLines,
    };

    if (requiredHeight <= height - 2) {
      return fallbackLayout;
    }
  }

  return fallbackLayout || {
    accentWidth,
    contentWidth: Math.max(width - accentWidth - 10, 20),
    codeWidth: Math.max(width - accentWidth - 10, 20),
    badgeWidth: 0,
    inlineBadge: false,
    codeLines: [presentation.code],
    titleLines: [presentation.title],
    metaLines: presentation.detailLines,
    paddingX: 4,
    paddingTop: 4,
    paddingBottom: 4,
    badgeHeight: 0,
    badgeFontSize: 4.7,
    badgeGap: 1.5,
    codeSize: 5,
    codeLineHeight: 5.5,
    titleSize: 5.8,
    titleLineHeight: 6.2,
    metaSize: 4.5,
    metaLineHeight: 4.9,
    titleGap: 1.2,
    metaGap: 1.2,
    radius: 9,
  };
}

function drawPill(doc, x, y, label, fillColor, borderColor, textColor) {
  const text = cleanString(label);
  const width = doc.widthOfString(text, { font: "Helvetica-Bold", size: 7 }) + 18;

  doc.save();
  doc.roundedRect(x, y, width, 18, 9).fillAndStroke(fillColor, borderColor);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(textColor)
    .text(text, x + 9, y + 5, { lineBreak: false });

  return width;
}

function drawHeader(doc, meta, badgeLabel) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const usableWidth = right - left;

  doc.save();
  doc.roundedRect(left, 16, usableWidth, 86, 18).fill(COLORS.brandStrong);
  doc.roundedRect(left, 16, 10, 86, 18).fill(COLORS.brand);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor(COLORS.white)
    .text("HORAIRE 5", left + 20, 30, { lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#D5E8DA")
    .text(meta.kindLabel.toUpperCase(), left + 20, 54, { lineBreak: false });

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(COLORS.white)
    .text(meta.subjectLabel, left + 20, 66, {
      width: usableWidth - 220,
      lineBreak: false,
      ellipsis: true,
    });

  if (badgeLabel) {
    const badgeWidth = Math.min(
      198,
      doc.widthOfString(badgeLabel, { font: "Helvetica-Bold", size: 8.2 }) + 28
    );
    const badgeX = right - badgeWidth - 18;

    doc.save();
    doc.roundedRect(badgeX, 28, badgeWidth, 24, 12).fill(COLORS.brandSoft);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.brandStrong)
      .text(badgeLabel, badgeX + 14, 36, {
        width: badgeWidth - 28,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });
  }

  doc.save();
  doc.roundedRect(left, 112, usableWidth, 42, 14).fillAndStroke(COLORS.panel, COLORS.borderSoft);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLORS.text)
    .text(meta.mainTitle, left + 16, 124, {
      width: usableWidth - 32,
      lineBreak: false,
      ellipsis: true,
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(meta.infoParts.join(" | "), left + 16, 140, {
      width: usableWidth - 32,
      lineBreak: false,
      ellipsis: true,
    });

  return 166;
}

function drawLegend(doc, meta, startY) {
  let cursorX = doc.page.margins.left;
  const cursorY = startY;

  cursorX += drawPill(
    doc,
    cursorX,
    cursorY,
    "Vue hebdomadaire",
    COLORS.panelSoft,
    COLORS.border,
    COLORS.text
  );
  cursorX += 8;

  cursorX += drawPill(
    doc,
    cursorX,
    cursorY,
    "Cours planifie",
    BLOCK_PALETTES.etudiant[0].fill,
    BLOCK_PALETTES.etudiant[0].stroke,
    COLORS.text
  );

  if (meta.entityType === "etudiant") {
    cursorX += 8;
    cursorX += drawPill(
      doc,
      cursorX,
      cursorY,
      "Exception individuelle",
      BLOCK_PALETTES.individuelle.fill,
      BLOCK_PALETTES.individuelle.stroke,
      COLORS.text
    );
    cursorX += 8;
    drawPill(
      doc,
      cursorX,
      cursorY,
      "Reprise",
      BLOCK_PALETTES.reprise.fill,
      BLOCK_PALETTES.reprise.stroke,
      BLOCK_PALETTES.reprise.text
    );
  }

  return cursorY + 28;
}

function drawGridPanel(doc, x, y, width, height) {
  doc.save();
  doc.roundedRect(x, y, width, height, 18).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();
}

/**
 * Anti-debordement PDF :
 * - largeur disponible mesuree avant rendu
 * - retour a la ligne controle pour le cours
 * - nombre de lignes borne selon la hauteur du bloc
 * - badge reserve dans une zone dediee pour eviter les chevauchements
 */
function drawSessionBlock(doc, meta, session, x, y, width, height) {
  const presentation = buildSessionPresentation(meta, session);
  const theme = presentation.theme;
  const layout = prepareBlockLayout(doc, presentation, width, height);
  const accentWidth = layout.accentWidth;
  const innerX = x + accentWidth + layout.paddingX;
  const innerY = y + layout.paddingTop;
  const innerWidth = layout.contentWidth;
  const radius = Math.min(layout.radius, width / 3, height / 3);

  doc.save();
  doc.roundedRect(x, y, width, height, radius).fillAndStroke(theme.fill, theme.stroke);
  doc.roundedRect(x, y, accentWidth, height, radius).fill(theme.accent);
  doc.restore();

  doc.save();
  doc.rect(x + 2, y + 1, Math.max(width - 4, 10), Math.max(height - 2, 10)).clip();

  let cursorY = innerY;

  if (presentation.badgeLabel && !layout.inlineBadge && layout.badgeHeight > 0) {
    doc.save();
    doc
      .roundedRect(innerX, cursorY, layout.badgeWidth || innerWidth, layout.badgeHeight, layout.badgeHeight / 2)
      .fillAndStroke(COLORS.white, theme.stroke);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(layout.badgeFontSize)
      .fillColor(theme.stroke)
      .text(presentation.badgeLabel, innerX + 7, cursorY + 4, {
        width: Math.max((layout.badgeWidth || innerWidth) - 14, 10),
        lineBreak: false,
        ellipsis: true,
      });

    cursorY += layout.badgeHeight + layout.badgeGap;
  }

  if (presentation.badgeLabel && layout.inlineBadge && layout.badgeHeight > 0) {
    const badgeX = innerX + layout.codeWidth + 6;
    const badgeY = cursorY + Math.max((layout.codeLineHeight - layout.badgeHeight) / 2 - 0.2, 0);

    doc.save();
    doc
      .roundedRect(badgeX, badgeY, layout.badgeWidth, layout.badgeHeight, layout.badgeHeight / 2)
      .fillAndStroke(COLORS.white, theme.stroke);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(layout.badgeFontSize)
      .fillColor(theme.stroke)
      .text(presentation.badgeLabel, badgeX + 7, badgeY + Math.max((layout.badgeHeight - 7) / 2 - 0.4, 1.8), {
        width: Math.max(layout.badgeWidth - 14, 10),
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(layout.codeSize)
    .fillColor(theme.accent)
    .text(layout.codeLines.join("\n") || "Cours", innerX, cursorY, {
      width: layout.codeWidth,
      lineGap: 0,
    });

  cursorY += layout.codeLineHeight;

  doc
    .font("Helvetica-Bold")
    .fontSize(layout.titleSize)
    .fillColor(theme.text)
    .text(layout.titleLines.join("\n") || "Cours", innerX, cursorY, {
      width: innerWidth,
      lineGap: 0,
    });

  cursorY += layout.titleLineHeight * Math.max(layout.titleLines.length, 1);

  if (layout.metaLines.length > 0) {
    cursorY += layout.metaGap;
  }

  layout.metaLines.forEach((line) => {
    doc
      .font("Helvetica")
      .fontSize(layout.metaSize)
      .fillColor(theme.text)
      .text(line, innerX, cursorY, {
        width: innerWidth,
        lineGap: 0,
      });

    cursorY += layout.metaLineHeight;
  });

  doc.restore();
}

function drawWeekGrid(doc, meta, weekStart, sessions) {
  const headerBottom = drawHeader(doc, meta, `Semaine du ${formatWeekRange(weekStart)}`);
  const legendBottom = drawLegend(doc, meta, headerBottom);
  const visibleDays = getVisibleDays(sessions);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = legendBottom + 8;
  const bottom = doc.page.height - doc.page.margins.bottom - 20;
  const width = right - left;
  const height = bottom - top;
  const timeColumnWidth = 72;
  const dayHeaderHeight = 40;
  const gridBodyTop = top + dayHeaderHeight;
  const gridBodyHeight = height - dayHeaderHeight;
  const dayWidth = (width - timeColumnWidth) / visibleDays.length;
  const bounds = getGridBounds(sessions);
  const totalMinutes = bounds.endMinutes - bounds.startMinutes;

  drawGridPanel(doc, left, top, width, height);

  doc.save();
  doc.rect(left, top, timeColumnWidth, height).fill(COLORS.panelSoft);
  doc.restore();

  for (let index = 0; index <= visibleDays.length; index += 1) {
    const x = left + timeColumnWidth + dayWidth * index;
    doc
      .moveTo(x, top)
      .lineTo(x, top + height)
      .strokeColor(COLORS.scheduleGridSoft)
      .lineWidth(0.9)
      .stroke();
  }

  doc
    .moveTo(left, gridBodyTop)
    .lineTo(right, gridBodyTop)
    .strokeColor(COLORS.scheduleGrid)
    .lineWidth(1)
    .stroke();

  for (let labelMinutes = bounds.startMinutes; labelMinutes <= bounds.endMinutes; labelMinutes += 60) {
    const y = gridBodyTop + ((labelMinutes - bounds.startMinutes) / totalMinutes) * gridBodyHeight;
    const isLast = labelMinutes === bounds.endMinutes;

    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor(COLORS.scheduleGrid)
      .lineWidth(isLast ? 1 : 0.8)
      .stroke();

    if (!isLast) {
      const halfHourY = gridBodyTop + ((labelMinutes + 30 - bounds.startMinutes) / totalMinutes) * gridBodyHeight;
      if (halfHourY < gridBodyTop + gridBodyHeight) {
        doc
          .moveTo(left + timeColumnWidth, halfHourY)
          .lineTo(right, halfHourY)
          .dash(1, { space: 2 })
          .strokeColor(COLORS.scheduleGridSoft)
          .lineWidth(0.55)
          .stroke()
          .undash();
      }

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(minutesToLabel(labelMinutes), left + 10, y + 4, {
          width: timeColumnWidth - 16,
          align: "left",
          lineBreak: false,
        });
    }
  }

  visibleDays.forEach((day, columnIndex) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + day.index);
    const dayLeft = left + timeColumnWidth + dayWidth * columnIndex;

    doc.save();
    doc.rect(dayLeft, top, dayWidth, dayHeaderHeight).fill(day.index >= 5 ? COLORS.panelSoft : COLORS.brandSurface);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(COLORS.text)
      .text(day.label, dayLeft + 8, top + 10, {
        width: dayWidth - 16,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(formatDateShort(date), dayLeft + 8, top + 22, {
        width: dayWidth - 16,
        lineBreak: false,
      });
  });

  visibleDays.forEach((day, columnIndex) => {
    const daySessions = layoutSessionsForDay(
      safeArray(sessions).filter((session) => getDayIndex(session.date) === day.index)
    );

    daySessions.forEach((session) => {
      const slotLeft = left + timeColumnWidth + dayWidth * columnIndex + 4;
      const slotWidth = dayWidth - 8;
      const laneCount = Math.max(1, Number(session.__laneCount || 1));
      const laneGap = laneCount > 1 ? 3 : 4;
      const laneWidth = (slotWidth - laneGap * (laneCount - 1)) / laneCount;
      const blockLeft = slotLeft + Number(session.__lane || 0) * (laneWidth + laneGap);
      const blockTop =
        gridBodyTop +
        ((session.__startMinutes - bounds.startMinutes) / totalMinutes) * gridBodyHeight +
        2;
      const blockHeight = Math.max(
        ((session.__endMinutes - session.__startMinutes) / totalMinutes) * gridBodyHeight - 4,
        24
      );

      drawSessionBlock(doc, meta, session, blockLeft, blockTop, laneWidth, blockHeight);
    });
  });
}

function drawSectionBanner(doc, title, subtitle, topY) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  doc.save();
  doc.roundedRect(left, topY, width, 28, 12).fillAndStroke(COLORS.panelSoft, COLORS.borderSoft);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(title, left + 12, topY + 9, { lineBreak: false });

  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(subtitle, left + 170, topY + 10, {
        width: width - 182,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      });
  }

  return topY + 40;
}

function drawTableHeader(doc, x, y, width, columns) {
  const totalRatio = columns.reduce((sum, column) => sum + column.ratio, 0);
  let currentX = x;

  return columns.map((column) => {
    const columnWidth = (width * column.ratio) / totalRatio;

    doc.save();
    doc.rect(currentX, y, columnWidth, PDF_TABLE_HEADER_HEIGHT).fill(COLORS.brandStrong);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(7.4)
      .fillColor(COLORS.white)
      .text(column.label, currentX + 6, y + 7, {
        width: columnWidth - 12,
        lineBreak: false,
        ellipsis: true,
      });

    const result = { ...column, width: columnWidth };
    currentX += columnWidth;
    return result;
  });
}

function getPdfRowBackground(row, index) {
  if (row.variant === "reprise") {
    return COLORS.warningSoft;
  }

  if (row.variant === "individuelle") {
    return BLOCK_PALETTES.individuelle.fill;
  }

  return index % 2 === 0 ? COLORS.white : COLORS.panelSoft;
}

function getPdfRowTextColor(row) {
  if (row.variant === "individuelle") {
    return COLORS.infoText;
  }

  return COLORS.text;
}

function preparePdfTableRow(doc, row, columns) {
  const cells = columns.map((column) => {
    const value = cleanString(column.value(row)) || "-";
    const font = column.emphasis?.(row) ? "Helvetica-Bold" : "Helvetica";
    const fontSize = column.fontSize || 7.1;
    const maxLines = Math.max(column.maxLines || 2, 12);
    const lines = wrapTextToLines(doc, value, column.width - 12, {
      font,
      size: fontSize,
      maxLines,
    });

    return {
      ...column,
      font,
      fontSize,
      color: column.color?.(row) || getPdfRowTextColor(row),
      text: lines.join("\n"),
      lineCount: Math.max(lines.length, 1),
    };
  });

  const rowHeight = Math.max(
    PDF_TABLE_MIN_ROW_HEIGHT,
    ...cells.map((cell) => cell.lineCount * 8 + 10)
  );

  return { cells, rowHeight };
}

function drawPreparedPdfRow(doc, x, y, rowHeight, preparedRow, row, rowIndex) {
  let currentX = x;
  const background = getPdfRowBackground(row, rowIndex);

  preparedRow.cells.forEach((cell) => {
    doc.save();
    doc.rect(currentX, y, cell.width, rowHeight).fill(background);
    doc.restore();

    doc
      .font(cell.font)
      .fontSize(cell.fontSize)
      .fillColor(cell.color)
      .text(cell.text, currentX + 6, y + 6, {
        width: cell.width - 12,
        align: cell.align || "left",
        lineGap: 0.2,
      });

    doc
      .moveTo(currentX + cell.width, y)
      .lineTo(currentX + cell.width, y + rowHeight)
      .strokeColor(COLORS.borderSoft)
      .lineWidth(0.4)
      .stroke();

    currentX += cell.width;
  });

  doc
    .moveTo(x, y + rowHeight)
    .lineTo(currentX, y + rowHeight)
    .strokeColor(COLORS.borderSoft)
    .lineWidth(0.5)
    .stroke();
}

function drawTablePages(doc, meta, title, rows, columns, emptyMessage) {
  const normalizedRows = safeArray(rows);
  let currentIndex = 0;

  if (normalizedRows.length === 0) {
    doc.addPage(PDF_PAGE);
    const headerBottom = drawHeader(doc, meta, title);
    const sectionBottom = drawSectionBanner(doc, title, null, headerBottom);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(emptyMessage, doc.page.margins.left, sectionBottom + 10, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      });
    return;
  }

  while (currentIndex < normalizedRows.length) {
    doc.addPage(PDF_PAGE);
    const headerBottom = drawHeader(doc, meta, title);
    const sectionBottom = drawSectionBanner(
      doc,
      title,
      `${normalizedRows.length} ligne(s)`,
      headerBottom
    );
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 18;
    const tableColumns = drawTableHeader(doc, left, sectionBottom, width, columns);
    let cursorY = sectionBottom + PDF_TABLE_HEADER_HEIGHT;

    while (currentIndex < normalizedRows.length) {
      const row = normalizedRows[currentIndex];
      const preparedRow = preparePdfTableRow(doc, row, tableColumns);
      if (cursorY + preparedRow.rowHeight > bottomLimit) {
        break;
      }

      drawPreparedPdfRow(doc, left, cursorY, preparedRow.rowHeight, preparedRow, row, currentIndex);
      cursorY += preparedRow.rowHeight;
      currentIndex += 1;
    }
  }
}

function hexToArgb(hex) {
  const normalized = cleanString(hex).replace(/^#/, "").toUpperCase();
  if (!normalized) {
    return "FF000000";
  }

  if (normalized.length === 8) {
    return normalized;
  }

  if (normalized.length === 6) {
    return `FF${normalized}`;
  }

  return `FF${normalized.padEnd(6, "0").slice(0, 6)}`;
}

function cloneStyle(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function buildExcelBorder(color = COLORS.border) {
  const argb = hexToArgb(color);
  return {
    top: { style: "thin", color: { argb } },
    left: { style: "thin", color: { argb } },
    bottom: { style: "thin", color: { argb } },
    right: { style: "thin", color: { argb } },
  };
}

function getExcelRowTheme(variant) {
  if (variant === "reprise") {
    return {
      fill: COLORS.warningSoft,
      border: COLORS.warningBorder,
      text: BLOCK_PALETTES.reprise.text,
    };
  }

  if (variant === "individuelle") {
    return {
      fill: COLORS.infoSoft,
      border: COLORS.infoBorder,
      text: COLORS.infoText,
    };
  }

  return {
    fill: COLORS.white,
    border: COLORS.borderSoft,
    text: COLORS.text,
  };
}

function applyExcelCellStyle(cell, style) {
  if (style.font) {
    cell.font = cloneStyle(style.font);
  }

  if (style.fill) {
    cell.fill = cloneStyle(style.fill);
  }

  if (style.alignment) {
    cell.alignment = cloneStyle(style.alignment);
  }

  if (style.border) {
    cell.border = cloneStyle(style.border);
  }

  if (style.numFmt) {
    cell.numFmt = style.numFmt;
  }
}

function estimateWrappedWordLines(text, widthChars) {
  const value = cleanString(text);
  if (!value) {
    return 1;
  }

  const words = value.split(/\s+/);
  let lines = 1;
  let currentLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    const nextLength = currentLength === 0 ? wordLength : currentLength + 1 + wordLength;
    if (nextLength <= widthChars) {
      currentLength = nextLength;
    } else {
      lines += 1;
      currentLength = Math.min(wordLength, widthChars);
    }
  });

  return lines;
}

function estimateExcelLineCount(text, widthChars, maxLines = 6) {
  const parts = String(text ?? "")
    .split("\n")
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return 1;
  }

  const total = parts.reduce((sum, part) => sum + estimateWrappedWordLines(part, Math.max(widthChars, 8)), 0);
  if (!Number.isFinite(maxLines)) {
    return Math.max(total, 1);
  }

  return Math.min(Math.max(total, 1), maxLines);
}

function getExcelTextFill(color) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(color) } };
}

function buildWeeklyCellLines(meta, session) {
  const presentation = buildSessionPresentation(meta, session);
  const lines = [`${presentation.code} | ${presentation.timeLabel}`, presentation.title];

  if (presentation.badgeLabel) {
    lines.push(`Statut : ${presentation.badgeLabel}`);
  }

  return [...lines, ...presentation.detailLines];
}

function buildWeeklyCellText(meta, session, slotSpan = 2) {
  return buildWeeklyCellLines(meta, session).join("\n");
}

function getWeeklyConflictText(meta, sessions) {
  return safeArray(sessions)
    .map((session) => buildWeeklyCellText(meta, session, 1))
    .join("\n\n");
}

function styleExcelMergedRegion(worksheet, startRow, endRow, column, style) {
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    applyExcelCellStyle(worksheet.getCell(rowIndex, column), style);
  }
}

function createWorkbook(meta) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HORAIRE 5";
  workbook.lastModifiedBy = "HORAIRE 5";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.title = meta.mainTitle;
  workbook.properties.subject = meta.kindLabel;
  return workbook;
}

function configureWorkbookBanner(worksheet, title, subtitle, maxColumn, legendText) {
  worksheet.mergeCells(1, 1, 1, maxColumn);
  worksheet.mergeCells(2, 1, 2, maxColumn);
  worksheet.mergeCells(3, 1, 3, maxColumn);

  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  applyExcelCellStyle(titleCell, {
    font: {
      name: EXCEL_FONT_FAMILY,
      size: 16,
      bold: true,
      color: { argb: hexToArgb(COLORS.white) },
    },
    fill: getExcelTextFill(COLORS.brandStrong),
    alignment: { vertical: "middle", horizontal: "left" },
    border: buildExcelBorder(COLORS.brandStrong),
  });
  worksheet.getRow(1).height = 28;

  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  applyExcelCellStyle(subtitleCell, {
    font: {
      name: EXCEL_FONT_FAMILY,
      size: 10,
      color: { argb: hexToArgb(COLORS.text) },
    },
    fill: getExcelTextFill(COLORS.panelSoft),
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    border: buildExcelBorder(COLORS.borderSoft),
  });
  worksheet.getRow(2).height = 22;

  const legendCell = worksheet.getCell(3, 1);
  legendCell.value = legendText;
  applyExcelCellStyle(legendCell, {
    font: {
      name: EXCEL_FONT_FAMILY,
      size: 9,
      italic: true,
      color: { argb: hexToArgb(COLORS.muted) },
    },
    fill: getExcelTextFill(COLORS.panel),
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    border: buildExcelBorder(COLORS.borderSoft),
  });
  worksheet.getRow(3).height = 18;
}

/**
 * Strategie Excel :
 * - jours visibles reduits a la semaine utile
 * - cellules fusionnees verticalement quand un cours occupe plusieurs slots
 * - style partage avec le PDF pour garder la meme lecture metier
 */
function buildWeeklySheet(workbook, meta, sessions) {
  const weeks = groupSessionsByWeek(sessions);
  const maxVisibleDayCount = DAYS.length;
  const worksheet = workbook.addWorksheet("Vue hebdo", {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", xSplit: 1, ySplit: EXCEL_WEEKLY_FREEZE_ROW }],
  });

  const totalColumns = 1 + maxVisibleDayCount;
  worksheet.columns = [
    { width: EXCEL_WEEKLY_TIME_WIDTH },
    ...new Array(maxVisibleDayCount).fill(null).map(() => ({ width: EXCEL_WEEKLY_DAY_WIDTH })),
  ];

  configureWorkbookBanner(
    worksheet,
    meta.mainTitle,
    meta.infoParts.join(" | "),
    totalColumns,
    "Palette : vert = planification principale ; orange = cours echoue / reprise."
  );

  let currentRow = 5;

  if (weeks.length === 0) {
    worksheet.mergeCells(currentRow, 1, currentRow, totalColumns);
    const emptyCell = worksheet.getCell(currentRow, 1);
    emptyCell.value = "Aucune seance planifiee pour cet export.";
    applyExcelCellStyle(emptyCell, {
      font: { name: EXCEL_FONT_FAMILY, size: 11, italic: true, color: { argb: hexToArgb(COLORS.muted) } },
      alignment: { vertical: "middle", horizontal: "center" },
      fill: getExcelTextFill(COLORS.panel),
      border: buildExcelBorder(COLORS.borderSoft),
    });
    worksheet.getRow(currentRow).height = 28;
    return worksheet;
  }

  weeks.forEach((week) => {
    const visibleDays = getVisibleDays(week.sessions);
    const sectionLastColumn = totalColumns;
    const weekTitleRow = currentRow;

    worksheet.mergeCells(weekTitleRow, 1, weekTitleRow, sectionLastColumn);
    const weekTitleCell = worksheet.getCell(weekTitleRow, 1);
    weekTitleCell.value = `Semaine du ${formatWeekRange(week.weekStart)}`;
    applyExcelCellStyle(weekTitleCell, {
      font: { name: EXCEL_FONT_FAMILY, size: 12, bold: true, color: { argb: hexToArgb(COLORS.text) } },
      alignment: { vertical: "middle", horizontal: "left" },
      fill: getExcelTextFill(COLORS.brandSurfaceStrong),
      border: buildExcelBorder(COLORS.border),
    });
    worksheet.getRow(weekTitleRow).height = 24;

    currentRow += 1;
    const headerRowIndex = currentRow;
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.height = 34;

    const timeHeaderCell = worksheet.getCell(headerRowIndex, 1);
    timeHeaderCell.value = "Heure";
    applyExcelCellStyle(timeHeaderCell, {
      font: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: hexToArgb(COLORS.white) } },
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
      fill: getExcelTextFill(COLORS.brandStrong),
      border: buildExcelBorder(COLORS.brandStrong),
    });

    visibleDays.forEach((day, index) => {
      const date = new Date(week.weekStart);
      date.setDate(date.getDate() + day.index);
      const cell = worksheet.getCell(headerRowIndex, index + 2);
      cell.value = `${day.label}\n${formatDateShort(date)}`;
      applyExcelCellStyle(cell, {
        font: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: hexToArgb(COLORS.text) } },
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        fill: getExcelTextFill(day.index >= 5 ? COLORS.panelSoft : COLORS.brandSurface),
        border: buildExcelBorder(COLORS.border),
      });
    });

    currentRow += 1;
    const bounds = getGridBounds(week.sessions);
    const slotCount = Math.max(1, Math.ceil((bounds.endMinutes - bounds.startMinutes) / EXCEL_SLOT_MINUTES));
    const gridStartRow = currentRow;
    const requiredRowHeights = new Array(slotCount).fill(EXCEL_WEEKLY_BASE_ROW_HEIGHT);

    const occupiedSlots = new Map();
    const inlineConflicts = new Map();
    visibleDays.forEach((day) => {
      occupiedSlots.set(day.index, new Array(slotCount).fill(false));
      inlineConflicts.set(day.index, new Map());
    });

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const rowIndex = gridStartRow + slotIndex;
      const startMinutes = bounds.startMinutes + slotIndex * EXCEL_SLOT_MINUTES;
      const endMinutes = Math.min(startMinutes + EXCEL_SLOT_MINUTES, bounds.endMinutes);
      const row = worksheet.getRow(rowIndex);
      row.height = EXCEL_WEEKLY_BASE_ROW_HEIGHT;

      const timeCell = worksheet.getCell(rowIndex, 1);
      timeCell.value = `${minutesToLabel(startMinutes)}-${minutesToLabel(endMinutes)}`;
      applyExcelCellStyle(timeCell, {
        font: { name: EXCEL_FONT_FAMILY, size: 9, color: { argb: hexToArgb(COLORS.muted) } },
        alignment: { vertical: "middle", horizontal: "center" },
        fill: getExcelTextFill(COLORS.panelSoft),
        border: buildExcelBorder(COLORS.borderSoft),
      });

      visibleDays.forEach((day, dayIndex) => {
        applyExcelCellStyle(worksheet.getCell(rowIndex, dayIndex + 2), {
          font: { name: EXCEL_FONT_FAMILY, size: 9, color: { argb: hexToArgb(COLORS.text) } },
          alignment: { vertical: "top", horizontal: "left", wrapText: true },
          fill: getExcelTextFill(COLORS.panel),
          border: buildExcelBorder(COLORS.borderSoft),
        });
      });
    }

    safeArray(week.sessions)
      .slice()
      .sort(sortSessions)
      .forEach((session) => {
        const dayPosition = visibleDays.findIndex((day) => day.index === getDayIndex(session.date));
        if (dayPosition === -1) {
          return;
        }

        const sessionStart = timeToMinutes(session.heure_debut);
        const sessionEnd = normalizeDuration(sessionStart, timeToMinutes(session.heure_fin));
        const startSlot = Math.max(0, Math.floor((sessionStart - bounds.startMinutes) / EXCEL_SLOT_MINUTES));
        const endSlotExclusive = Math.min(
          slotCount,
          Math.ceil((sessionEnd - bounds.startMinutes) / EXCEL_SLOT_MINUTES)
        );

        if (endSlotExclusive <= startSlot) {
          return;
        }

        const dayIndex = visibleDays[dayPosition].index;
        const dayOccupancy = occupiedSlots.get(dayIndex);
        const conflictByRow = inlineConflicts.get(dayIndex);
        const column = dayPosition + 2;
        const hasConflict = dayOccupancy.slice(startSlot, endSlotExclusive).some(Boolean);
        const rowTheme = getExcelRowTheme(getSessionVariant(meta.entityType, session));
        const cellStyle = {
          font: {
            name: EXCEL_FONT_FAMILY,
            size: 9.5,
            bold: true,
            color: { argb: hexToArgb(rowTheme.text) },
          },
          alignment: { vertical: "top", horizontal: "left", wrapText: true },
          fill: getExcelTextFill(rowTheme.fill),
          border: buildExcelBorder(rowTheme.border),
        };

        if (!hasConflict) {
          const topRow = gridStartRow + startSlot;
          const bottomRow = gridStartRow + endSlotExclusive - 1;
          const slotSpan = endSlotExclusive - startSlot;
          const cell = worksheet.getCell(topRow, column);
          cell.value = buildWeeklyCellText(meta, session, slotSpan);

          if (bottomRow > topRow) {
            worksheet.mergeCells(topRow, column, bottomRow, column);
          }

          styleExcelMergedRegion(worksheet, topRow, bottomRow, column, cellStyle);

          const requiredLineCount = estimateExcelLineCount(
            cell.value,
            Math.max(EXCEL_WEEKLY_DAY_WIDTH - 5, 8),
            Number.POSITIVE_INFINITY
          );
          const requiredHeight = Math.max(
            slotSpan * EXCEL_WEEKLY_BASE_ROW_HEIGHT,
            requiredLineCount * EXCEL_WEEKLY_LINE_HEIGHT + 8
          );
          const distributedHeight = requiredHeight / slotSpan;

          for (let slotIndex = startSlot; slotIndex < endSlotExclusive; slotIndex += 1) {
            requiredRowHeights[slotIndex] = Math.max(requiredRowHeights[slotIndex], distributedHeight);
          }

          for (let slotIndex = startSlot; slotIndex < endSlotExclusive; slotIndex += 1) {
            dayOccupancy[slotIndex] = true;
          }
          return;
        }

        for (let slotIndex = startSlot; slotIndex < endSlotExclusive; slotIndex += 1) {
          dayOccupancy[slotIndex] = true;
          const rowIndex = gridStartRow + slotIndex;
          const list = conflictByRow.get(rowIndex) || [];
          list.push(session);
          conflictByRow.set(rowIndex, list);

          const cell = worksheet.getCell(rowIndex, column);
          cell.value = getWeeklyConflictText(meta, list);
          applyExcelCellStyle(cell, {
            font: {
              name: EXCEL_FONT_FAMILY,
              size: 9,
              bold: true,
              color: { argb: hexToArgb(COLORS.text) },
            },
            alignment: { vertical: "top", horizontal: "left", wrapText: true },
            fill: getExcelTextFill(COLORS.panelSoft),
            border: buildExcelBorder(COLORS.border),
          });

          const requiredLineCount = estimateExcelLineCount(
            cell.value,
            Math.max(EXCEL_WEEKLY_DAY_WIDTH - 5, 8),
            Number.POSITIVE_INFINITY
          );
          requiredRowHeights[slotIndex] = Math.max(
            requiredRowHeights[slotIndex],
            requiredLineCount * EXCEL_WEEKLY_LINE_HEIGHT + 8
          );
        }
      });

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const rowIndex = gridStartRow + slotIndex;
      worksheet.getRow(rowIndex).height = Math.max(
        EXCEL_WEEKLY_BASE_ROW_HEIGHT,
        Math.ceil(requiredRowHeights[slotIndex])
      );
    }

    currentRow = gridStartRow + slotCount + 1;
  });

  return worksheet;
}

function buildWorkbookSheet(workbook, options) {
  const { sheetName, title, subtitle, columns, rows, emptyMessage, legendText } = options;
  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", ySplit: EXCEL_DETAIL_HEADER_ROW }],
  });

  worksheet.columns = columns.map((column) => ({ width: column.width }));
  configureWorkbookBanner(
    worksheet,
    title,
    subtitle,
    columns.length,
    legendText ||
      "Bleu = exception individuelle ; orange = reprise a traiter ; vert / blanc = groupe principal."
  );

  const headerRow = worksheet.getRow(EXCEL_DETAIL_HEADER_ROW);
  headerRow.height = 24;
  columns.forEach((column, index) => {
    const cell = worksheet.getCell(EXCEL_DETAIL_HEADER_ROW, index + 1);
    cell.value = column.label;
    applyExcelCellStyle(cell, {
      font: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: hexToArgb(COLORS.white) } },
      alignment: {
        vertical: "middle",
        horizontal: column.align === "center" ? "center" : "left",
        wrapText: true,
      },
      fill: getExcelTextFill(COLORS.brandStrong),
      border: buildExcelBorder(COLORS.brandStrong),
    });
  });

  if (!rows.length) {
    worksheet.mergeCells(5, 1, 5, columns.length);
    const cell = worksheet.getCell(5, 1);
    cell.value = emptyMessage;
    applyExcelCellStyle(cell, {
      font: { name: EXCEL_FONT_FAMILY, size: 10, italic: true, color: { argb: hexToArgb(COLORS.muted) } },
      alignment: { vertical: "middle", horizontal: "center" },
      fill: getExcelTextFill(COLORS.panel),
      border: buildExcelBorder(COLORS.borderSoft),
    });
    worksheet.getRow(5).height = 26;
    return worksheet;
  }

  rows.forEach((row, rowIndex) => {
    const excelRowIndex = EXCEL_DETAIL_HEADER_ROW + 1 + rowIndex;
    const excelRow = worksheet.getRow(excelRowIndex);
    const rowTheme = getExcelRowTheme(row.variant);
    const lineCount = columns.reduce((maximum, column, columnIndex) => {
      const cell = worksheet.getCell(excelRowIndex, columnIndex + 1);
      const value = cleanString(column.value(row)) || "-";
      cell.value = value;

      applyExcelCellStyle(cell, {
        font: {
          name: EXCEL_FONT_FAMILY,
          size: 10,
          bold: Boolean(column.emphasis?.(row)),
          color: { argb: hexToArgb(column.color?.(row) || rowTheme.text) },
        },
        alignment: {
          vertical: "top",
          horizontal: column.align === "center" ? "center" : "left",
          wrapText: column.wrap !== false,
        },
        fill: getExcelTextFill(
          row.variant === "standard" && rowIndex % 2 === 1 ? COLORS.panelSoft : rowTheme.fill
        ),
        border: buildExcelBorder(rowTheme.border),
      });

      return Math.max(
        maximum,
        estimateExcelLineCount(
          value,
          Math.max(column.width - 3, 8),
          Number.POSITIVE_INFINITY
        )
      );
    }, 1);

    excelRow.height = Math.max(22, lineCount * 12 + 6);
  });

  worksheet.autoFilter = {
    from: { row: EXCEL_DETAIL_HEADER_ROW, column: 1 },
    to: { row: EXCEL_DETAIL_HEADER_ROW, column: columns.length },
  };

  return worksheet;
}

function buildGroupMeta(groupe) {
  const sessionLabel = composeSessionLabel(groupe?.session, groupe?.annee);
  return {
    entityType: "groupe",
    kindLabel: "Horaire du groupe",
    subjectLabel: cleanString(groupe?.nom_groupe) || "Groupe",
    mainTitle: `Horaire du groupe ${cleanString(groupe?.nom_groupe) || "Sans nom"}`,
    infoParts: [
      sessionLabel ? `Session ${sessionLabel}` : "Session active",
      cleanString(groupe?.programme) ? `Programme ${groupe.programme}` : null,
      groupe?.etape !== null && groupe?.etape !== undefined ? `Etape ${groupe.etape}` : null,
      groupe?.effectif !== null && groupe?.effectif !== undefined ? `Effectif ${groupe.effectif}` : null,
      `Exporte le ${formatToday()}`,
    ].filter(Boolean),
    defaultGroup: cleanString(groupe?.nom_groupe),
  };
}

function buildProfesseurMeta(professeur) {
  const fullName = `${cleanString(professeur?.prenom)} ${cleanString(professeur?.nom)}`.trim();
  const sessionLabel = composeSessionLabel(professeur?.session, professeur?.annee);
  return {
    entityType: "professeur",
    kindLabel: "Horaire du professeur",
    subjectLabel: fullName || "Professeur",
    mainTitle: `Horaire du professeur ${fullName || "sans nom"}`,
    infoParts: [
      sessionLabel ? `Session ${sessionLabel}` : "Session active",
      cleanString(professeur?.matricule) ? `Matricule ${professeur.matricule}` : null,
      cleanString(professeur?.programmes_assignes || professeur?.specialite)
        ? `Programme ${professeur.programmes_assignes || professeur.specialite}`
        : null,
      `Exporte le ${formatToday()}`,
    ].filter(Boolean),
  };
}

function buildEtudiantMeta(etudiant, resume = null) {
  const fullName = `${cleanString(etudiant?.prenom)} ${cleanString(etudiant?.nom)}`.trim();
  const sessionLabel = composeSessionLabel(etudiant?.session, etudiant?.annee);
  return {
    entityType: "etudiant",
    kindLabel: "Horaire de l'etudiant",
    subjectLabel: fullName || "Etudiant",
    mainTitle: `Horaire de l'etudiant ${fullName || "sans nom"}`,
    infoParts: [
      sessionLabel ? `Session ${sessionLabel}` : "Session active",
      cleanString(etudiant?.matricule) ? `Matricule ${etudiant.matricule}` : null,
      cleanString(etudiant?.programme) ? `Programme ${etudiant.programme}` : null,
      etudiant?.etape !== null && etudiant?.etape !== undefined ? `Etape ${etudiant.etape}` : null,
      cleanString(etudiant?.groupe) ? `Groupe principal ${etudiant.groupe}` : null,
      resume?.charge_cible !== null && resume?.charge_cible !== undefined
        ? `Charge cible ${resume.charge_cible}`
        : null,
      `Exporte le ${formatToday()}`,
    ].filter(Boolean),
    defaultGroup: cleanString(etudiant?.groupe),
  };
}

function buildGroupDetailedRows(groupe, sessions) {
  return safeArray(sessions)
    .slice()
    .sort(sortSessions)
    .map((session) => ({
      variant: "standard",
      date: formatDateLong(session.date),
      day: formatDateShort(session.date),
      start: formatTime(session.heure_debut),
      end: formatTime(session.heure_fin),
      code: cleanString(session.code_cours),
      title: cleanString(session.nom_cours),
      room: formatRoom(session),
      roomType: cleanString(session.type_salle) || "-",
      professor: formatProfessor(session),
      group: cleanString(groupe?.nom_groupe),
      program: cleanString(groupe?.programme),
      step: groupe?.etape ?? "-",
    }));
}

function buildProfesseurDetailedRows(professeur, sessions) {
  const fullName = `${cleanString(professeur?.prenom)} ${cleanString(professeur?.nom)}`.trim();

  return safeArray(sessions)
    .slice()
    .sort(sortSessions)
    .map((session) => ({
      variant: "standard",
      date: formatDateLong(session.date),
      day: formatDateShort(session.date),
      start: formatTime(session.heure_debut),
      end: formatTime(session.heure_fin),
      code: cleanString(session.code_cours),
      title: cleanString(session.nom_cours),
      groups: cleanString(session.groupes) || "-",
      room: formatRoom(session),
      roomType: cleanString(session.type_salle) || "-",
      professor: fullName || "Professeur",
      matricule: cleanString(professeur?.matricule) || "-",
      program: cleanString(professeur?.programmes_assignes || professeur?.specialite) || "-",
      step: cleanString(session.etape_etude) || "-",
    }));
}

function buildEtudiantDetailedRows(etudiant, sessions) {
  return safeArray(sessions)
    .slice()
    .sort(sortSessions)
    .map((session) => ({
      variant: getSessionVariant("etudiant", session),
      date: formatDateLong(session.date),
      day: formatDateShort(session.date),
      start: formatTime(session.heure_debut),
      end: formatTime(session.heure_fin),
      code: cleanString(session.code_cours),
      title: cleanString(session.nom_cours),
      type: getStudentSessionTypeLabel(session),
      reprise: Boolean(session.est_reprise) ? "Oui" : "Non",
      room: formatRoom(session),
      professor: formatProfessor(session),
      mainGroup: cleanString(etudiant?.groupe) || "-",
      trackedGroup: formatStudentSource(session, etudiant?.groupe),
      status: cleanString(session.statut_reprise) || "-",
      source: cleanString(session.source_horaire) || "-",
      note: session.note_echec === null || session.note_echec === undefined ? "-" : String(session.note_echec),
    }));
}

function buildRepriseRows(reprises) {
  return safeArray(reprises).map((reprise) => ({
    variant: "reprise",
    code: cleanString(reprise.code_cours),
    title: cleanString(reprise.nom_cours),
    step: cleanString(reprise.etape_etude) || "-",
    status: cleanString(reprise.statut) || "-",
    note: reprise.note_echec === null || reprise.note_echec === undefined ? "-" : String(reprise.note_echec),
    trackedGroup: cleanString(reprise.groupe_reprise) || "Non assigne",
  }));
}

function filterReprisesToFollow(reprises) {
  return buildRepriseRows(reprises).filter(
    (row) => row.status.toLowerCase() !== "planifie" || row.trackedGroup === "Non assigne"
  );
}

function mergeStudentSessions(horaire, horaireReprises) {
  const merged = [...safeArray(horaire), ...safeArray(horaireReprises)];
  const seen = new Set();

  return merged
    .filter((session) => {
      const key = [
        cleanString(session?.source_horaire),
        Number(session?.id_affectation_cours || 0),
        Number(session?.id_plage_horaires || 0),
        cleanString(session?.date),
        formatTime(session?.heure_debut),
        formatTime(session?.heure_fin),
        cleanString(session?.code_cours),
        Boolean(session?.est_reprise) ? "1" : "0",
      ].join("|");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort(sortSessions);
}

function finalizePdf(doc) {
  const range = doc.bufferedPageRange();

  for (let offset = 0; offset < range.count; offset += 1) {
    doc.switchToPage(range.start + offset);
    const footerY = doc.page.height - doc.page.margins.bottom + 6;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(`HORAIRE 5 | Exporte le ${formatToday()}`, doc.page.margins.left, footerY, {
        lineBreak: false,
      })
      .text(`Page ${offset + 1} / ${range.count}`, doc.page.margins.left, footerY, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "right",
        lineBreak: false,
      });
  }
}

function appendWeeklyPages(doc, meta, sessions) {
  const weeks = groupSessionsByWeek(sessions);

  if (weeks.length === 0) {
    doc.addPage(PDF_PAGE);
    const headerBottom = drawHeader(doc, meta, "Vue hebdomadaire");
    const sectionBottom = drawSectionBanner(doc, "Vue hebdomadaire", null, headerBottom);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text("Aucune seance planifiee pour cet export.", doc.page.margins.left, sectionBottom + 12, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      });
    return;
  }

  weeks.forEach((week) => {
    doc.addPage(PDF_PAGE);
    drawWeekGrid(doc, meta, week.weekStart, week.sessions);
  });
}

function createPdf(meta) {
  const doc = new PDFDocument({
    ...PDF_PAGE,
    autoFirstPage: false,
    bufferPages: true,
    compress: false,
    info: {
      Title: meta.mainTitle,
      Author: "HORAIRE 5",
      Subject: meta.kindLabel,
    },
  });
  const chunks = [];
  const bufferPromise = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return { doc, bufferPromise };
}

function buildGroupPdfColumns() {
  return [
    { label: "Date", ratio: 2.6, value: (row) => row.date, maxLines: 2 },
    { label: "Debut", ratio: 1, value: (row) => row.start, align: "center", maxLines: 1 },
    { label: "Fin", ratio: 1, value: (row) => row.end, align: "center", maxLines: 1 },
    { label: "Code", ratio: 1.2, value: (row) => row.code, maxLines: 1 },
    { label: "Cours", ratio: 3.5, value: (row) => row.title, maxLines: 2, emphasis: () => true },
    { label: "Professeur", ratio: 2.4, value: (row) => row.professor, maxLines: 2 },
    { label: "Salle", ratio: 1.6, value: (row) => row.room, maxLines: 1 },
  ];
}

function buildProfesseurPdfColumns() {
  return [
    { label: "Date", ratio: 2.6, value: (row) => row.date, maxLines: 2 },
    { label: "Debut", ratio: 1, value: (row) => row.start, align: "center", maxLines: 1 },
    { label: "Fin", ratio: 1, value: (row) => row.end, align: "center", maxLines: 1 },
    { label: "Code", ratio: 1.1, value: (row) => row.code, maxLines: 1 },
    { label: "Cours", ratio: 3.1, value: (row) => row.title, maxLines: 2, emphasis: () => true },
    { label: "Groupes", ratio: 2.5, value: (row) => row.groups, maxLines: 2 },
    { label: "Salle", ratio: 1.6, value: (row) => row.room, maxLines: 1 },
  ];
}

function buildEtudiantPdfColumns() {
  return [
    { label: "Date", ratio: 2.6, value: (row) => row.date, maxLines: 2 },
    { label: "Debut", ratio: 1, value: (row) => row.start, align: "center", maxLines: 1 },
    { label: "Fin", ratio: 1, value: (row) => row.end, align: "center", maxLines: 1 },
    { label: "Code", ratio: 1.1, value: (row) => row.code, maxLines: 1 },
    {
      label: "Cours",
      ratio: 3.1,
      value: (row) => row.title,
      maxLines: 2,
      emphasis: () => true,
      color: (row) => (row.variant === "reprise" ? COLORS.warning : undefined),
    },
    { label: "Type", ratio: 1.7, value: (row) => row.type, maxLines: 2 },
    { label: "Groupe", ratio: 2.3, value: (row) => row.trackedGroup, maxLines: 2 },
    { label: "Salle", ratio: 1.5, value: (row) => row.room, maxLines: 1 },
    { label: "Professeur", ratio: 2.2, value: (row) => row.professor, maxLines: 2 },
  ];
}

function buildReprisePdfColumns() {
  return [
    { label: "Code", ratio: 1.2, value: (row) => row.code, maxLines: 1 },
    { label: "Cours", ratio: 3.6, value: (row) => row.title, maxLines: 2, emphasis: () => true },
    { label: "Etape", ratio: 1.2, value: (row) => row.step, maxLines: 1, align: "center" },
    { label: "Statut", ratio: 1.8, value: (row) => row.status, maxLines: 2 },
    { label: "Note echec", ratio: 1.3, value: (row) => row.note, maxLines: 1, align: "center" },
    { label: "Groupe reprise", ratio: 2.9, value: (row) => row.trackedGroup, maxLines: 2 },
  ];
}

function buildGroupExcelColumns() {
  return [
    { label: "Date", width: 26, value: (row) => row.date, maxLines: 2 },
    { label: "Jour", width: 12, value: (row) => row.day, maxLines: 1 },
    { label: "Heure debut", width: 11, value: (row) => row.start, align: "center", maxLines: 1 },
    { label: "Heure fin", width: 11, value: (row) => row.end, align: "center", maxLines: 1 },
    { label: "Code cours", width: 14, value: (row) => row.code, maxLines: 1 },
    { label: "Nom cours", width: 34, value: (row) => row.title, maxLines: 3, emphasis: () => true },
    { label: "Salle", width: 16, value: (row) => row.room, maxLines: 1 },
    { label: "Type salle", width: 16, value: (row) => row.roomType, maxLines: 2 },
    { label: "Professeur", width: 26, value: (row) => row.professor, maxLines: 2 },
    { label: "Groupe", width: 18, value: (row) => row.group, maxLines: 1 },
    { label: "Programme", width: 18, value: (row) => row.program, maxLines: 2 },
    { label: "Etape", width: 10, value: (row) => row.step, align: "center", maxLines: 1 },
  ];
}

function buildProfesseurExcelColumns() {
  return [
    { label: "Date", width: 26, value: (row) => row.date, maxLines: 2 },
    { label: "Jour", width: 12, value: (row) => row.day, maxLines: 1 },
    { label: "Heure debut", width: 11, value: (row) => row.start, align: "center", maxLines: 1 },
    { label: "Heure fin", width: 11, value: (row) => row.end, align: "center", maxLines: 1 },
    { label: "Code cours", width: 14, value: (row) => row.code, maxLines: 1 },
    { label: "Nom cours", width: 34, value: (row) => row.title, maxLines: 3, emphasis: () => true },
    { label: "Groupes", width: 24, value: (row) => row.groups, maxLines: 2 },
    { label: "Salle", width: 16, value: (row) => row.room, maxLines: 1 },
    { label: "Type salle", width: 16, value: (row) => row.roomType, maxLines: 2 },
    { label: "Professeur", width: 26, value: (row) => row.professor, maxLines: 2 },
    { label: "Matricule", width: 16, value: (row) => row.matricule, maxLines: 1 },
    { label: "Programme", width: 24, value: (row) => row.program, maxLines: 2 },
    { label: "Etape", width: 10, value: (row) => row.step, align: "center", maxLines: 1 },
  ];
}

function buildEtudiantExcelColumns() {
  return [
    { label: "Date", width: 26, value: (row) => row.date, maxLines: 2 },
    { label: "Jour", width: 12, value: (row) => row.day, maxLines: 1 },
    { label: "Heure debut", width: 11, value: (row) => row.start, align: "center", maxLines: 1 },
    { label: "Heure fin", width: 11, value: (row) => row.end, align: "center", maxLines: 1 },
    { label: "Code cours", width: 14, value: (row) => row.code, maxLines: 1 },
    {
      label: "Nom cours",
      width: 34,
      value: (row) => row.title,
      maxLines: 3,
      emphasis: () => true,
      color: (row) => (row.variant === "reprise" ? COLORS.warning : undefined),
    },
    { label: "Type", width: 20, value: (row) => row.type, maxLines: 2 },
    { label: "Reprise", width: 11, value: (row) => row.reprise, align: "center", maxLines: 1 },
    { label: "Salle", width: 16, value: (row) => row.room, maxLines: 1 },
    { label: "Professeur", width: 26, value: (row) => row.professor, maxLines: 2 },
    { label: "Groupe principal", width: 20, value: (row) => row.mainGroup, maxLines: 2 },
    { label: "Groupe suivi", width: 22, value: (row) => row.trackedGroup, maxLines: 2 },
    { label: "Statut reprise", width: 18, value: (row) => row.status, maxLines: 2 },
    { label: "Source", width: 14, value: (row) => row.source, maxLines: 1 },
    { label: "Note echec", width: 12, value: (row) => row.note, align: "center", maxLines: 1 },
  ];
}

function buildRepriseExcelColumns() {
  return [
    { label: "Code cours", width: 14, value: (row) => row.code, maxLines: 1 },
    { label: "Nom cours", width: 34, value: (row) => row.title, maxLines: 3, emphasis: () => true },
    { label: "Etape", width: 12, value: (row) => row.step, align: "center", maxLines: 1 },
    { label: "Statut", width: 16, value: (row) => row.status, maxLines: 2 },
    { label: "Note echec", width: 12, value: (row) => row.note, align: "center", maxLines: 1 },
    { label: "Groupe reprise", width: 22, value: (row) => row.trackedGroup, maxLines: 2 },
  ];
}

async function writeWorkbookBuffer(workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export async function genererPDFGroupe({ groupe, horaire }) {
  const meta = buildGroupMeta(groupe);
  const { doc, bufferPromise } = createPdf(meta);

  appendWeeklyPages(doc, meta, horaire);
  drawTablePages(
    doc,
    meta,
    "Seances detaillees",
    buildGroupDetailedRows(groupe, horaire),
    buildGroupPdfColumns(),
    "Aucune seance detaillee a afficher."
  );

  finalizePdf(doc);
  doc.end();
  return bufferPromise;
}

export async function genererPDFProfesseur({ professeur, horaire }) {
  const meta = buildProfesseurMeta(professeur);
  const { doc, bufferPromise } = createPdf(meta);

  appendWeeklyPages(doc, meta, horaire);
  drawTablePages(
    doc,
    meta,
    "Seances detaillees",
    buildProfesseurDetailedRows(professeur, horaire),
    buildProfesseurPdfColumns(),
    "Aucune seance detaillee a afficher."
  );

  finalizePdf(doc);
  doc.end();
  return bufferPromise;
}

export async function genererPDFEtudiant({
  etudiant,
  horaire,
  horaire_reprises,
  reprises,
  resume,
}) {
  const mergedSchedule = mergeStudentSessions(horaire, horaire_reprises);
  const detailedRows = buildEtudiantDetailedRows(etudiant, mergedSchedule);
  const repriseRows = filterReprisesToFollow(reprises);
  const meta = buildEtudiantMeta(etudiant, resume);
  const { doc, bufferPromise } = createPdf(meta);

  appendWeeklyPages(doc, meta, mergedSchedule);
  drawTablePages(
    doc,
    meta,
    "Seances detaillees",
    detailedRows,
    buildEtudiantPdfColumns(),
    "Aucune seance detaillee a afficher."
  );

  if (repriseRows.length > 0) {
    drawTablePages(
      doc,
      meta,
      "Reprises a suivre",
      repriseRows,
      buildReprisePdfColumns(),
      "Aucune reprise a afficher."
    );
  }

  finalizePdf(doc);
  doc.end();
  return bufferPromise;
}

export async function genererExcelGroupe({ groupe, horaire }) {
  const meta = buildGroupMeta(groupe);
  const workbook = createWorkbook(meta);
  const detailedRows = buildGroupDetailedRows(groupe, horaire);

  buildWeeklySheet(workbook, meta, horaire);
  buildWorkbookSheet(workbook, {
    sheetName: "Seances detaillees",
    title: meta.mainTitle,
    subtitle: meta.infoParts.join(" | "),
    columns: buildGroupExcelColumns(),
    rows: detailedRows,
    emptyMessage: "Aucune seance detaillee a afficher.",
    legendText: "Vue detaillee du groupe. Les lignes restent neutres pour laisser la lecture prioritaire au cours, au professeur et a la salle.",
  });

  return writeWorkbookBuffer(workbook);
}

export async function genererExcelProfesseur({ professeur, horaire }) {
  const meta = buildProfesseurMeta(professeur);
  const workbook = createWorkbook(meta);
  const detailedRows = buildProfesseurDetailedRows(professeur, horaire);

  buildWeeklySheet(workbook, meta, horaire);
  buildWorkbookSheet(workbook, {
    sheetName: "Seances detaillees",
    title: meta.mainTitle,
    subtitle: meta.infoParts.join(" | "),
    columns: buildProfesseurExcelColumns(),
    rows: detailedRows,
    emptyMessage: "Aucune seance detaillee a afficher.",
    legendText: "Vue detaillee du professeur. Les groupes, la salle et le programme restent visibles sans debordement.",
  });

  return writeWorkbookBuffer(workbook);
}

export async function genererExcelEtudiant({
  etudiant,
  horaire,
  horaire_reprises,
  reprises,
  resume,
}) {
  const mergedSchedule = mergeStudentSessions(horaire, horaire_reprises);
  const meta = buildEtudiantMeta(etudiant, resume);
  const workbook = createWorkbook(meta);
  const detailedRows = buildEtudiantDetailedRows(etudiant, mergedSchedule);
  const repriseRows = filterReprisesToFollow(reprises);

  buildWeeklySheet(workbook, meta, mergedSchedule);
  buildWorkbookSheet(workbook, {
    sheetName: "Seances detaillees",
    title: meta.mainTitle,
    subtitle: meta.infoParts.join(" | "),
    columns: buildEtudiantExcelColumns(),
    rows: detailedRows,
    emptyMessage: "Aucune seance detaillee a afficher.",
    legendText:
      "Bleu = exception individuelle ; orange = reprise a suivre ; vert / blanc = groupe principal.",
  });

  if (repriseRows.length > 0) {
    buildWorkbookSheet(workbook, {
      sheetName: "Reprises",
      title: `${meta.mainTitle} - Reprises`,
      subtitle: meta.infoParts.join(" | "),
      columns: buildRepriseExcelColumns(),
      rows: repriseRows,
      emptyMessage: "Aucune reprise a afficher.",
      legendText: "Feuille de suivi des reprises non resolues ou non encore rattachees a un groupe.",
    });
  }

  return writeWorkbookBuffer(workbook);
}
