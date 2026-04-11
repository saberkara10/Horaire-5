import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

const PDF_PAGE = {
  size: "A4",
  layout: "landscape",
  margins: { top: 30, bottom: 30, left: 30, right: 30 },
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

const GRID_START_MINUTES = 8 * 60;
const GRID_END_MINUTES = 22 * 60;
const MIN_GRID_DURATION = 8 * 60;
const EXCEL_SLOT_MINUTES = 60;
const TABLE_ROW_HEIGHT = 22;

const COLORS = {
  dark: "#0F172A",
  text: "#0F172A",
  muted: "#475569",
  brand: "#1D4ED8",
  brandSoft: "#DBEAFE",
  panel: "#FFFFFF",
  panelSoft: "#F8FAFC",
  border: "#CBD5E1",
  borderSoft: "#E2E8F0",
  section: "#EFF6FF",
  warning: "#EA580C",
};

const BLOCK_PALETTES = {
  groupe: [
    { fill: "#DBEAFE", stroke: "#2563EB", text: "#1E3A8A" },
    { fill: "#E0E7FF", stroke: "#4338CA", text: "#312E81" },
    { fill: "#EDE9FE", stroke: "#7C3AED", text: "#5B21B6" },
  ],
  professeur: [
    { fill: "#CCFBF1", stroke: "#0F766E", text: "#134E4A" },
    { fill: "#DCFCE7", stroke: "#16A34A", text: "#166534" },
    { fill: "#E0F2FE", stroke: "#0284C7", text: "#0C4A6E" },
  ],
  etudiant: [
    { fill: "#E0E7FF", stroke: "#4338CA", text: "#312E81" },
    { fill: "#DBEAFE", stroke: "#2563EB", text: "#1E3A8A" },
    { fill: "#F5F3FF", stroke: "#7C3AED", text: "#5B21B6" },
  ],
  reprise: { fill: "#FFEDD5", stroke: "#EA580C", text: "#9A3412" },
  individuelle: { fill: "#CCFBF1", stroke: "#0F766E", text: "#134E4A" },
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
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
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

  return [...weeks.values()].sort((weekA, weekB) =>
    weekA.weekStart.getTime() - weekB.weekStart.getTime()
  );
}

function getGridBounds(sessions) {
  const items = safeArray(sessions);
  if (items.length === 0) {
    return {
      startMinutes: GRID_START_MINUTES,
      endMinutes: Math.max(GRID_END_MINUTES, GRID_START_MINUTES + MIN_GRID_DURATION),
    };
  }

  const rawStart = items.reduce(
    (minimum, session) => Math.min(minimum, timeToMinutes(session.heure_debut)),
    GRID_END_MINUTES
  );
  const rawEnd = items.reduce(
    (maximum, session) => Math.max(maximum, timeToMinutes(session.heure_fin)),
    GRID_START_MINUTES
  );

  const startMinutes = Math.max(GRID_START_MINUTES, Math.floor(rawStart / 60) * 60);
  const roundedEnd = Math.ceil(rawEnd / 60) * 60;
  const endMinutes = Math.max(
    Math.min(Math.max(roundedEnd, GRID_START_MINUTES + 60), 23 * 60),
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

function getBlockTheme(entityType, session) {
  if (entityType === "etudiant" && Boolean(session?.est_reprise)) {
    return BLOCK_PALETTES.reprise;
  }

  if (entityType === "etudiant" && cleanString(session?.source_horaire) === "individuelle") {
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
  return `${cleanString(session?.prenom_professeur)} ${cleanString(session?.nom_professeur)}`
    .trim() || "Prof a confirmer";
}

function formatStudentSource(session, defaultGroup = "") {
  if (Boolean(session?.est_reprise)) {
    return cleanString(session?.groupe_source) || "Groupe reprise a confirmer";
  }

  if (cleanString(session?.source_horaire) === "individuelle") {
    return cleanString(session?.groupe_source) || "Groupe d'accueil a confirmer";
  }

  return (
    cleanString(session?.groupe_source) ||
    cleanString(session?.nom_groupe) ||
    cleanString(defaultGroup) ||
    "Groupe principal"
  );
}

function isStudentIndividualException(session) {
  return cleanString(session?.source_horaire) === "individuelle";
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
  doc.roundedRect(left, 16, usableWidth, 86, 18).fill(COLORS.dark);
  doc.rect(left, 16, 8, 86).fill(COLORS.brand);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor("#FFFFFF")
    .text("HORAIRE 5", left + 18, 30, { lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#CBD5E1")
    .text(meta.kindLabel.toUpperCase(), left + 18, 54, { lineBreak: false });

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#FFFFFF")
    .text(meta.subjectLabel, left + 18, 66, {
      width: usableWidth - 210,
      lineBreak: false,
      ellipsis: true,
    });

  if (badgeLabel) {
    const badgeWidth = Math.min(
      184,
      doc.widthOfString(badgeLabel, { font: "Helvetica-Bold", size: 8 }) + 26
    );
    const badgeX = right - badgeWidth - 16;

    doc.save();
    doc.roundedRect(badgeX, 28, badgeWidth, 24, 12).fill(COLORS.brandSoft);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.brand)
      .text(badgeLabel, badgeX + 13, 36, {
        width: badgeWidth - 26,
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

  if (meta.entityType === "etudiant") {
    const normalTheme = BLOCK_PALETTES.etudiant[0];
    cursorX += drawPill(
      doc,
      cursorX,
      cursorY,
      "Groupe principal",
      normalTheme.fill,
      normalTheme.stroke,
      normalTheme.text
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
    cursorX += 8;
    drawPill(
      doc,
      cursorX,
      cursorY,
      "Exception individuelle",
      BLOCK_PALETTES.individuelle.fill,
      BLOCK_PALETTES.individuelle.stroke,
      BLOCK_PALETTES.individuelle.text
    );
  }

  return cursorY + 28;
}

function drawGridPanel(doc, x, y, width, height) {
  doc.save();
  doc.roundedRect(x, y, width, height, 18).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();
}

function drawSessionBlock(doc, meta, session, x, y, width, height) {
  const theme = getBlockTheme(meta.entityType, session);
  const contentWidth = Math.max(width - 12, 30);
  const availableLineCount = Math.max(1, Math.floor((height - 10) / 10));
  const firstLine = [cleanString(session.code_cours), cleanString(session.nom_cours)]
    .filter(Boolean)
    .join(" - ");
  const detailLines = [];

  detailLines.push(`${formatTime(session.heure_debut)} - ${formatTime(session.heure_fin)}`);
  detailLines.push(formatRoom(session));

  if (meta.entityType === "groupe") {
    detailLines.push(formatProfessor(session));
  } else if (meta.entityType === "professeur") {
    detailLines.push(cleanString(session.groupes) || "Groupe a confirmer");
  } else {
    if (Boolean(session.est_reprise)) {
      detailLines.push(`Groupe suivi : ${formatStudentSource(session, meta.defaultGroup)}`);
    } else if (isStudentIndividualException(session)) {
      detailLines.push(`Groupe d'accueil : ${formatStudentSource(session, meta.defaultGroup)}`);
    } else if (meta.defaultGroup) {
      detailLines.push(`Groupe principal : ${meta.defaultGroup}`);
    }
    detailLines.push(formatProfessor(session));
  }

  doc.save();
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(theme.fill, theme.stroke);
  doc.restore();

  if (
    meta.entityType === "etudiant" &&
    (Boolean(session.est_reprise) || isStudentIndividualException(session)) &&
    height >= 30
  ) {
    const badgeLabel = Boolean(session.est_reprise) ? "REPRISE" : "EXCEPTION";
    const badgeWidth = Math.min(
      width - 10,
      doc.widthOfString(badgeLabel, { font: "Helvetica-Bold", size: 6.5 }) + 14
    );

    doc.save();
    doc.roundedRect(x + width - badgeWidth - 5, y + 5, badgeWidth, 14, 7).fillAndStroke("#FFFFFF", theme.stroke);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(theme.stroke)
      .text(badgeLabel, x + width - badgeWidth - 5, y + 9, {
        width: badgeWidth,
        align: "center",
        lineBreak: false,
      });
  }

  doc.save();
  doc.rect(x + 1, y + 1, width - 2, height - 2).clip();

  let cursorY = y + 6;

  doc
    .font("Helvetica-Bold")
    .fontSize(height >= 30 ? 8.5 : 7.5)
    .fillColor(theme.text)
    .text(firstLine || "Cours", x + 6, cursorY, {
      width: contentWidth,
      lineBreak: false,
      ellipsis: true,
    });

  cursorY += height >= 30 ? 12 : 10;

  detailLines.slice(0, availableLineCount - 1).forEach((line) => {
    doc
      .font("Helvetica")
      .fontSize(6.8)
      .fillColor(theme.text)
      .text(line, x + 6, cursorY, {
        width: contentWidth,
        lineBreak: false,
        ellipsis: true,
      });
    cursorY += 9;
  });

  doc.restore();
}

function drawWeekGrid(doc, meta, weekStart, sessions) {
  const headerBottom = drawHeader(doc, meta, `Semaine du ${formatWeekRange(weekStart)}`);
  const legendBottom = drawLegend(doc, meta, headerBottom);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = legendBottom + 8;
  const bottom = doc.page.height - doc.page.margins.bottom - 20;
  const width = right - left;
  const height = bottom - top;
  const timeColumnWidth = 66;
  const dayHeaderHeight = 38;
  const gridBodyTop = top + dayHeaderHeight;
  const gridBodyHeight = height - dayHeaderHeight;
  const dayWidth = (width - timeColumnWidth) / DAYS.length;
  const bounds = getGridBounds(sessions);
  const totalMinutes = bounds.endMinutes - bounds.startMinutes;
  const totalHours = Math.round(totalMinutes / 60);

  drawGridPanel(doc, left, top, width, height);

  doc.save();
  doc.rect(left, top, timeColumnWidth, height).fill(COLORS.panelSoft);
  doc.restore();

  for (let index = 0; index <= DAYS.length; index += 1) {
    const x = left + timeColumnWidth + dayWidth * index;
    doc
      .moveTo(x, top)
      .lineTo(x, top + height)
      .strokeColor(COLORS.borderSoft)
      .lineWidth(0.8)
      .stroke();
  }

  doc
    .moveTo(left, gridBodyTop)
    .lineTo(right, gridBodyTop)
    .strokeColor(COLORS.border)
    .lineWidth(0.8)
    .stroke();

  for (let hourIndex = 0; hourIndex <= totalHours; hourIndex += 1) {
    const minutesOffset = hourIndex * 60;
    const y = gridBodyTop + (minutesOffset / totalMinutes) * gridBodyHeight;
    const labelMinutes = bounds.startMinutes + minutesOffset;

    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor(COLORS.borderSoft)
      .lineWidth(hourIndex === totalHours ? 0.8 : 0.5)
      .stroke();

    if (hourIndex < totalHours) {
      const halfHourY = gridBodyTop + ((minutesOffset + 30) / totalMinutes) * gridBodyHeight;
      doc
        .moveTo(left + timeColumnWidth, halfHourY)
        .lineTo(right, halfHourY)
        .dash(1, { space: 2 })
        .strokeColor("#E2E8F0")
        .lineWidth(0.4)
        .stroke()
        .undash();
    }

    if (hourIndex < totalHours) {
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

  DAYS.forEach((day) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + day.index);
    const dayLeft = left + timeColumnWidth + dayWidth * day.index;

    doc.save();
    doc.rect(dayLeft, top, dayWidth, dayHeaderHeight).fill(day.index >= 5 ? "#F8FAFC" : COLORS.section);
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

  DAYS.forEach((day) => {
    const daySessions = layoutSessionsForDay(
      safeArray(sessions).filter((session) => getDayIndex(session.date) === day.index)
    );

    daySessions.forEach((session) => {
      const slotLeft = left + timeColumnWidth + dayWidth * day.index + 4;
      const slotWidth = dayWidth - 8;
      const laneGap = 4;
      const laneCount = Math.max(1, Number(session.__laneCount || 1));
      const laneWidth = (slotWidth - laneGap * (laneCount - 1)) / laneCount;
      const blockLeft = slotLeft + Number(session.__lane || 0) * (laneWidth + laneGap);
      const blockTop =
        gridBodyTop +
        ((session.__startMinutes - bounds.startMinutes) / totalMinutes) * gridBodyHeight +
        2;
      const blockHeight = Math.max(
        ((session.__endMinutes - session.__startMinutes) / totalMinutes) * gridBodyHeight - 4,
        18
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
    doc.rect(currentX, y, columnWidth, TABLE_ROW_HEIGHT).fill(COLORS.dark);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#FFFFFF")
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

function drawTableRows(doc, x, y, bottomLimit, rows, columns) {
  let cursorY = y;
  let index = 0;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  while (index < rows.length) {
    if (cursorY + TABLE_ROW_HEIGHT > bottomLimit) {
      break;
    }

    const row = rows[index];
    const background = index % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    let currentX = x;

    columns.forEach((column) => {
      doc.save();
      doc.rect(currentX, cursorY, column.width, TABLE_ROW_HEIGHT).fill(background);
      doc.restore();

      const value = cleanString(column.value(row)) || "-";
      doc
        .font(column.emphasis?.(row) ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.2)
        .fillColor(column.color?.(row) || COLORS.text)
        .text(value, currentX + 6, cursorY + 7, {
          width: column.width - 12,
          lineBreak: false,
          ellipsis: true,
        });

      currentX += column.width;
    });

    doc
      .moveTo(x, cursorY + TABLE_ROW_HEIGHT)
      .lineTo(x + totalWidth, cursorY + TABLE_ROW_HEIGHT)
      .strokeColor(COLORS.borderSoft)
      .lineWidth(0.5)
      .stroke();

    cursorY += TABLE_ROW_HEIGHT;
    index += 1;
  }

  return { nextIndex: index, nextY: cursorY };
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
    const result = drawTableRows(
      doc,
      left,
      sectionBottom + TABLE_ROW_HEIGHT,
      bottomLimit,
      normalizedRows.slice(currentIndex),
      tableColumns
    );

    currentIndex += result.nextIndex;
  }
}

function buildWorkbookSheet(title, subtitle, columns, rows) {
  const headerRow = columns.map((column) => column.label);
  const bodyRows = safeArray(rows).map((row) => columns.map((column) => column.value(row)));
  const sheetRows = [[title], [subtitle], [], headerRow, ...bodyRows];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const lastColumnIndex = Math.max(columns.length - 1, 0);

  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
  ];
  sheet["!cols"] = columns.map((column) => ({ wch: column.width }));
  sheet["!freeze"] = { xSplit: 0, ySplit: 4 };

  if (columns.length > 0) {
    sheet["!autofilter"] = {
      ref: `A4:${XLSX.utils.encode_col(lastColumnIndex)}${Math.max(sheetRows.length, 4)}`,
    };
  }

  return sheet;
}

function buildWeeklyCellText(entityType, session, defaultGroup) {
  const lines = [];

  lines.push(
    `${cleanString(session.code_cours) || "Cours"} (${formatTime(session.heure_debut)}-${formatTime(session.heure_fin)})`
  );

  if (cleanString(session.nom_cours)) {
    lines.push(cleanString(session.nom_cours));
  }

  if (entityType === "groupe") {
    lines.push(formatProfessor(session));
  } else if (entityType === "professeur") {
    lines.push(cleanString(session.groupes) || "Groupe a confirmer");
  } else {
    if (Boolean(session.est_reprise)) {
      lines.push("REPRISE");
      lines.push(`Groupe suivi: ${formatStudentSource(session, defaultGroup)}`);
    } else if (defaultGroup) {
      lines.push(`Groupe principal: ${defaultGroup}`);
    }
    lines.push(formatProfessor(session));
  }

  lines.push(formatRoom(session));
  return lines.join("\n");
}

function buildWeeklySheet(meta, sessions) {
  const rows = [[meta.mainTitle], [meta.infoParts.join(" | ")], []];
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  const rowHeights = [{ hpt: 24 }, { hpt: 18 }, { hpt: 8 }];
  const weeks = groupSessionsByWeek(sessions);

  if (weeks.length === 0) {
    rows.push(["Aucune seance planifiee pour cet export."]);
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 7 } });
    rowHeights.push({ hpt: 24 });
  } else {
    weeks.forEach((week) => {
      const titleRowIndex = rows.length;
      rows.push([`Semaine du ${formatWeekRange(week.weekStart)}`]);
      merges.push({ s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: 7 } });
      rowHeights.push({ hpt: 20 });

      rows.push([
        "Heure",
        ...DAYS.map(
          (day) =>
            `${day.label}\n${formatDateShort(
              new Date(
                week.weekStart.getFullYear(),
                week.weekStart.getMonth(),
                week.weekStart.getDate() + day.index
              )
            )}`
        ),
      ]);
      rowHeights.push({ hpt: 30 });

      const bounds = getGridBounds(week.sessions);
      for (
        let startMinutes = bounds.startMinutes;
        startMinutes < bounds.endMinutes;
        startMinutes += EXCEL_SLOT_MINUTES
      ) {
        const endMinutes = Math.min(startMinutes + EXCEL_SLOT_MINUTES, bounds.endMinutes);
        const row = [`${minutesToLabel(startMinutes)}-${minutesToLabel(endMinutes)}`];

        DAYS.forEach((day) => {
          const overlapping = week.sessions
            .filter((session) => getDayIndex(session.date) === day.index)
            .filter((session) => {
              const sessionStart = timeToMinutes(session.heure_debut);
              const sessionEnd = normalizeDuration(sessionStart, timeToMinutes(session.heure_fin));
              return sessionStart < endMinutes && sessionEnd > startMinutes;
            })
            .sort(sortSessions);

          row.push(
            overlapping
              .map((session) => buildWeeklyCellText(meta.entityType, session, meta.defaultGroup))
              .join("\n\n")
          );
        });

        rows.push(row);
        rowHeights.push({ hpt: 44 });
      }

      rows.push([]);
      rowHeights.push({ hpt: 8 });
    });
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = merges;
  sheet["!cols"] = [
    { wch: 13 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
  ];
  sheet["!rows"] = rowHeights;
  return sheet;
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
    code: cleanString(reprise.code_cours),
    title: cleanString(reprise.nom_cours),
    step: cleanString(reprise.etape_etude) || "-",
    status: cleanString(reprise.statut) || "-",
    note: reprise.note_echec === null || reprise.note_echec === undefined ? "-" : String(reprise.note_echec),
    trackedGroup: cleanString(reprise.groupe_reprise) || "Non assigne",
  }));
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
    { label: "Date", ratio: 2.8, value: (row) => row.date },
    { label: "Debut", ratio: 1, value: (row) => row.start },
    { label: "Fin", ratio: 1, value: (row) => row.end },
    { label: "Code", ratio: 1.2, value: (row) => row.code },
    { label: "Cours", ratio: 3.6, value: (row) => row.title },
    { label: "Professeur", ratio: 2.4, value: (row) => row.professor },
    { label: "Salle", ratio: 1.6, value: (row) => row.room },
  ];
}

function buildProfesseurPdfColumns() {
  return [
    { label: "Date", ratio: 2.8, value: (row) => row.date },
    { label: "Debut", ratio: 1, value: (row) => row.start },
    { label: "Fin", ratio: 1, value: (row) => row.end },
    { label: "Code", ratio: 1.1, value: (row) => row.code },
    { label: "Cours", ratio: 3.2, value: (row) => row.title },
    { label: "Groupes", ratio: 2.4, value: (row) => row.groups },
    { label: "Salle", ratio: 1.5, value: (row) => row.room },
  ];
}

function buildEtudiantPdfColumns() {
  return [
    { label: "Date", ratio: 2.8, value: (row) => row.date },
    { label: "Debut", ratio: 1, value: (row) => row.start },
    { label: "Fin", ratio: 1, value: (row) => row.end },
    { label: "Code", ratio: 1.1, value: (row) => row.code },
    {
      label: "Cours",
      ratio: 3.1,
      value: (row) => row.title,
      emphasis: (row) => row.reprise === "Oui",
      color: (row) => (row.reprise === "Oui" ? COLORS.warning : COLORS.text),
    },
    { label: "Type", ratio: 1.6, value: (row) => row.type },
    { label: "Groupe", ratio: 2.1, value: (row) => row.trackedGroup },
    { label: "Salle", ratio: 1.5, value: (row) => row.room },
    { label: "Professeur", ratio: 2.3, value: (row) => row.professor },
  ];
}

function buildReprisePdfColumns() {
  return [
    { label: "Code", ratio: 1.2, value: (row) => row.code },
    { label: "Cours", ratio: 3.6, value: (row) => row.title },
    { label: "Etape", ratio: 1.2, value: (row) => row.step },
    { label: "Statut", ratio: 1.8, value: (row) => row.status },
    { label: "Note echec", ratio: 1.3, value: (row) => row.note },
    { label: "Groupe reprise", ratio: 2.9, value: (row) => row.trackedGroup },
  ];
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
  const repriseRows = buildRepriseRows(reprises).filter(
    (row) => row.status.toLowerCase() !== "planifie" || row.trackedGroup === "Non assigne"
  );
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

export function genererExcelGroupe({ groupe, horaire }) {
  const workbook = XLSX.utils.book_new();
  const meta = buildGroupMeta(groupe);
  const detailedRows = buildGroupDetailedRows(groupe, horaire);

  XLSX.utils.book_append_sheet(workbook, buildWeeklySheet(meta, horaire), "Vue hebdo");
  XLSX.utils.book_append_sheet(
    workbook,
    buildWorkbookSheet(
      meta.mainTitle,
      meta.infoParts.join(" | "),
      [
        { label: "Date", width: 26, value: (row) => row.date },
        { label: "Jour", width: 12, value: (row) => row.day },
        { label: "Heure debut", width: 11, value: (row) => row.start },
        { label: "Heure fin", width: 11, value: (row) => row.end },
        { label: "Code cours", width: 14, value: (row) => row.code },
        { label: "Nom cours", width: 34, value: (row) => row.title },
        { label: "Salle", width: 16, value: (row) => row.room },
        { label: "Type salle", width: 16, value: (row) => row.roomType },
        { label: "Professeur", width: 26, value: (row) => row.professor },
        { label: "Groupe", width: 18, value: (row) => row.group },
        { label: "Programme", width: 18, value: (row) => row.program },
        { label: "Etape", width: 10, value: (row) => row.step },
      ],
      detailedRows
    ),
    "Seances detaillees"
  );

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function genererExcelProfesseur({ professeur, horaire }) {
  const workbook = XLSX.utils.book_new();
  const meta = buildProfesseurMeta(professeur);
  const detailedRows = buildProfesseurDetailedRows(professeur, horaire);

  XLSX.utils.book_append_sheet(workbook, buildWeeklySheet(meta, horaire), "Vue hebdo");
  XLSX.utils.book_append_sheet(
    workbook,
    buildWorkbookSheet(
      meta.mainTitle,
      meta.infoParts.join(" | "),
      [
        { label: "Date", width: 26, value: (row) => row.date },
        { label: "Jour", width: 12, value: (row) => row.day },
        { label: "Heure debut", width: 11, value: (row) => row.start },
        { label: "Heure fin", width: 11, value: (row) => row.end },
        { label: "Code cours", width: 14, value: (row) => row.code },
        { label: "Nom cours", width: 34, value: (row) => row.title },
        { label: "Groupes", width: 24, value: (row) => row.groups },
        { label: "Salle", width: 16, value: (row) => row.room },
        { label: "Type salle", width: 16, value: (row) => row.roomType },
        { label: "Professeur", width: 26, value: (row) => row.professor },
        { label: "Matricule", width: 16, value: (row) => row.matricule },
        { label: "Programme", width: 24, value: (row) => row.program },
        { label: "Etape", width: 10, value: (row) => row.step },
      ],
      detailedRows
    ),
    "Seances detaillees"
  );

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function genererExcelEtudiant({
  etudiant,
  horaire,
  horaire_reprises,
  reprises,
  resume,
}) {
  const workbook = XLSX.utils.book_new();
  const mergedSchedule = mergeStudentSessions(horaire, horaire_reprises);
  const meta = buildEtudiantMeta(etudiant, resume);
  const detailedRows = buildEtudiantDetailedRows(etudiant, mergedSchedule);
  const repriseRows = buildRepriseRows(reprises);

  XLSX.utils.book_append_sheet(workbook, buildWeeklySheet(meta, mergedSchedule), "Vue hebdo");
  XLSX.utils.book_append_sheet(
    workbook,
    buildWorkbookSheet(
      meta.mainTitle,
      meta.infoParts.join(" | "),
      [
        { label: "Date", width: 26, value: (row) => row.date },
        { label: "Jour", width: 12, value: (row) => row.day },
        { label: "Heure debut", width: 11, value: (row) => row.start },
        { label: "Heure fin", width: 11, value: (row) => row.end },
        { label: "Code cours", width: 14, value: (row) => row.code },
        { label: "Nom cours", width: 34, value: (row) => row.title },
        { label: "Type", width: 18, value: (row) => row.type },
        { label: "Reprise", width: 11, value: (row) => row.reprise },
        { label: "Salle", width: 16, value: (row) => row.room },
        { label: "Professeur", width: 26, value: (row) => row.professor },
        { label: "Groupe principal", width: 20, value: (row) => row.mainGroup },
        { label: "Groupe suivi", width: 22, value: (row) => row.trackedGroup },
        { label: "Statut reprise", width: 18, value: (row) => row.status },
        { label: "Source", width: 14, value: (row) => row.source },
        { label: "Note echec", width: 12, value: (row) => row.note },
      ],
      detailedRows
    ),
    "Seances detaillees"
  );

  if (repriseRows.length > 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildWorkbookSheet(
        `${meta.mainTitle} - Reprises`,
        meta.infoParts.join(" | "),
        [
          { label: "Code cours", width: 14, value: (row) => row.code },
          { label: "Nom cours", width: 34, value: (row) => row.title },
          { label: "Etape", width: 12, value: (row) => row.step },
          { label: "Statut", width: 16, value: (row) => row.status },
          { label: "Note echec", width: 12, value: (row) => row.note },
          { label: "Groupe reprise", width: 22, value: (row) => row.trackedGroup },
        ],
        repriseRows
      ),
      "Reprises"
    );
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
