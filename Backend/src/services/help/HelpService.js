/**
 * Service metier du module help.
 *
 * Role:
 * - valider les entrees venant du controller
 * - transformer les lignes SQL en contrats API stables
 * - orchestrer le streaming video et le service des miniatures
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as HelpRepository from "../../model/help/HelpRepository.js";
import {
  HELP_CATEGORIES,
  HELP_CONTENT_TYPES,
  HELP_DOCUMENT_KINDS,
  HELP_DOCUMENTS,
  HELP_FAQS,
  HELP_FEATURED,
  HELP_GUIDES,
  HELP_LEVELS,
  HELP_SCENARIOS,
  findDocumentDefinitionBySlug,
} from "./HelpCenterCatalog.js";
import {
  buildHelpStreamUrl,
  buildHelpThumbnailUrl,
  resolveHelpMediaPath,
} from "./HelpMediaStorage.js";

const SEARCH_MIN_LENGTH = 2;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parsePositiveInteger(value, fieldLabel) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw createHttpError(400, `${fieldLabel} invalide.`);
  }

  return parsedValue;
}

function formatDuration(durationSeconds) {
  if (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) <= 0) {
    return null;
  }

  const totalSeconds = Number(durationSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} s`;
  }

  if (seconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${seconds} s`;
}

function parseKeywords(rawKeywords) {
  if (Array.isArray(rawKeywords)) {
    return rawKeywords
      .map((keyword) => String(keyword || "").trim())
      .filter(Boolean);
  }

  if (typeof rawKeywords !== "string" || rawKeywords.trim() === "") {
    return [];
  }

  try {
    const parsedKeywords = JSON.parse(rawKeywords);

    return Array.isArray(parsedKeywords)
      ? parsedKeywords
          .map((keyword) => String(keyword || "").trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function formatEstimatedMinutes(minutes) {
  const parsedMinutes = Number(minutes);

  if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
    return null;
  }

  return `${parsedMinutes} min`;
}

function findLabelById(collection, id) {
  return collection.find((entry) => entry.id === id)?.label || id || null;
}

function mapCategory(category) {
  return {
    id: category.id_category,
    name: category.name,
    slug: category.slug,
    description: category.description || null,
    displayOrder: category.display_order,
  };
}

function mapVideo(video) {
  return {
    id: video.id_video,
    categoryId: video.id_category,
    categoryName: video.category_name,
    categorySlug: video.category_slug,
    title: video.title,
    slug: video.slug,
    shortDescription: video.short_description || null,
    fullDescription: video.full_description || null,
    keywords: parseKeywords(video.keywords_json),
    moduleKey: video.module_key || null,
    durationSeconds: video.duration_seconds || null,
    durationLabel: formatDuration(video.duration_seconds),
    displayOrder: video.display_order,
    hasVideo: Boolean(video.video_path),
    hasThumbnail: Boolean(video.thumbnail_path),
    streamUrl: video.video_path ? buildHelpStreamUrl(video.id_video) : null,
    thumbnailUrl: video.thumbnail_path
      ? buildHelpThumbnailUrl(video.id_video)
      : null,
    createdAt: video.created_at || null,
    updatedAt: video.updated_at || null,
  };
}

function mapDocument(documentDefinition, categoriesById) {
  const category = categoriesById.get(documentDefinition.categoryId);

  return {
    id: documentDefinition.id,
    type: "documentation",
    slug: documentDefinition.slug,
    title: documentDefinition.title,
    summary: documentDefinition.description,
    description: documentDefinition.description,
    categoryId: documentDefinition.categoryId,
    categoryName: category?.name || null,
    categoryAccent: category?.accent || "blue",
    moduleKey: documentDefinition.moduleKey || category?.moduleKey || null,
    kind: documentDefinition.kind,
    kindLabel: findLabelById(HELP_DOCUMENT_KINDS, documentDefinition.kind),
    estimatedMinutes: documentDefinition.estimatedMinutes,
    estimatedLabel: formatEstimatedMinutes(documentDefinition.estimatedMinutes),
    tags: uniqueValues(documentDefinition.tags),
    keywords: uniqueValues(documentDefinition.keywords),
    addedAt: documentDefinition.addedAt || null,
    updatedAt: documentDefinition.updatedAt || null,
  };
}

function mapVideoSlot(slot, guideDefinition, categoriesById, videosBySlug) {
  const category = categoriesById.get(guideDefinition.categoryId);
  const repositoryVideo = slot.videoSlug ? videosBySlug.get(slot.videoSlug) : null;
  const resolvedVideo = repositoryVideo ? mapVideo(repositoryVideo) : null;
  const hasPlayableVideo = Boolean(resolvedVideo?.hasVideo && resolvedVideo?.streamUrl);

  return {
    id: slot.id,
    type: "video",
    title: slot.title,
    summary: slot.description || guideDefinition.summary,
    description: slot.description || guideDefinition.summary,
    categoryId: guideDefinition.categoryId,
    categoryName: category?.name || null,
    categoryAccent: category?.accent || "blue",
    moduleKey: guideDefinition.moduleKey || category?.moduleKey || null,
    guideId: guideDefinition.id,
    guideTitle: guideDefinition.title,
    level: slot.level || guideDefinition.level || null,
    levelLabel: findLabelById(HELP_LEVELS, slot.level || guideDefinition.level),
    durationLabel:
      resolvedVideo?.durationLabel ||
      slot.durationLabel ||
      formatEstimatedMinutes(guideDefinition.estimatedMinutes),
    durationSeconds: resolvedVideo?.durationSeconds || null,
    status: hasPlayableVideo ? "available" : "coming-soon",
    hasVideo: hasPlayableVideo,
    hasThumbnail: Boolean(resolvedVideo?.thumbnailUrl),
    streamUrl: hasPlayableVideo ? resolvedVideo.streamUrl : null,
    thumbnailUrl: resolvedVideo?.thumbnailUrl || null,
    backendVideoId: resolvedVideo?.id || null,
    tags: uniqueValues(["video", ...guideDefinition.tags]),
    keywords: uniqueValues([slot.title, guideDefinition.title, ...guideDefinition.keywords]),
    addedAt: guideDefinition.addedAt,
    updatedAt: guideDefinition.updatedAt,
  };
}

function mapGuide(guideDefinition, categoriesById, documentsById, videosBySlug) {
  const category = categoriesById.get(guideDefinition.categoryId);
  const documents = guideDefinition.documentIds
    .map((documentId) => documentsById.get(documentId))
    .filter(Boolean);
  const videos = guideDefinition.videoSlots.map((slot) =>
    mapVideoSlot(slot, guideDefinition, categoriesById, videosBySlug)
  );

  return {
    id: guideDefinition.id,
    type: "guide",
    title: guideDefinition.title,
    summary: guideDefinition.summary,
    description: guideDefinition.summary,
    objective: guideDefinition.objective,
    prerequisites: uniqueValues(guideDefinition.prerequisites),
    steps: uniqueValues(guideDefinition.steps),
    attentionPoints: uniqueValues(guideDefinition.attentionPoints),
    commonErrors: uniqueValues(guideDefinition.commonErrors),
    practicalTips: uniqueValues(guideDefinition.practicalTips),
    categoryId: guideDefinition.categoryId,
    categoryName: category?.name || null,
    categoryAccent: category?.accent || "blue",
    moduleKey: guideDefinition.moduleKey || category?.moduleKey || null,
    level: guideDefinition.level,
    levelLabel: findLabelById(HELP_LEVELS, guideDefinition.level),
    estimatedMinutes: guideDefinition.estimatedMinutes,
    estimatedLabel: formatEstimatedMinutes(guideDefinition.estimatedMinutes),
    tags: uniqueValues(guideDefinition.tags),
    keywords: uniqueValues(guideDefinition.keywords),
    documents,
    videos,
    hasVideo: videos.some((video) => video.hasVideo),
    hasVideoComingSoon: videos.some((video) => !video.hasVideo),
    relatedGuideIds: uniqueValues(guideDefinition.relatedGuideIds),
    popularityScore: guideDefinition.popularityScore || 0,
    addedAt: guideDefinition.addedAt || null,
    updatedAt: guideDefinition.updatedAt || null,
  };
}

function mapFaq(faqDefinition, categoriesById, guidesById, documentsById) {
  const category = categoriesById.get(faqDefinition.categoryId);

  return {
    id: faqDefinition.id,
    type: "faq",
    title: faqDefinition.title,
    summary: faqDefinition.summary,
    description: faqDefinition.summary,
    answer: faqDefinition.answer,
    categoryId: faqDefinition.categoryId,
    categoryName: category?.name || null,
    categoryAccent: category?.accent || "blue",
    moduleKey: faqDefinition.moduleKey || category?.moduleKey || null,
    level: faqDefinition.level,
    levelLabel: findLabelById(HELP_LEVELS, faqDefinition.level),
    tags: uniqueValues(faqDefinition.tags),
    keywords: uniqueValues(faqDefinition.keywords),
    relatedGuides: faqDefinition.relatedGuideIds
      .map((guideId) => guidesById.get(guideId))
      .filter(Boolean)
      .map((guide) => ({
        id: guide.id,
        title: guide.title,
        type: guide.type,
        categoryId: guide.categoryId,
        categoryName: guide.categoryName,
      })),
    relatedDocuments: faqDefinition.relatedDocumentIds
      .map((documentId) => documentsById.get(documentId))
      .filter(Boolean),
    addedAt: faqDefinition.addedAt || null,
    updatedAt: faqDefinition.updatedAt || null,
  };
}

function mapScenario(scenarioDefinition, categoriesById, guidesById, documentsById) {
  const category = categoriesById.get(scenarioDefinition.categoryId);

  return {
    id: scenarioDefinition.id,
    type: "scenario",
    title: scenarioDefinition.title,
    summary: scenarioDefinition.summary,
    description: scenarioDefinition.summary,
    objective: scenarioDefinition.objective,
    steps: uniqueValues(scenarioDefinition.steps),
    categoryId: scenarioDefinition.categoryId,
    categoryName: category?.name || null,
    categoryAccent: category?.accent || "blue",
    moduleKey: scenarioDefinition.moduleKey || category?.moduleKey || null,
    level: scenarioDefinition.level,
    levelLabel: findLabelById(HELP_LEVELS, scenarioDefinition.level),
    tags: uniqueValues(scenarioDefinition.tags),
    keywords: uniqueValues(scenarioDefinition.keywords),
    relatedGuides: scenarioDefinition.relatedGuideIds
      .map((guideId) => guidesById.get(guideId))
      .filter(Boolean)
      .map((guide) => ({
        id: guide.id,
        title: guide.title,
        type: guide.type,
        categoryId: guide.categoryId,
        categoryName: guide.categoryName,
      })),
    relatedDocuments: scenarioDefinition.relatedDocumentIds
      .map((documentId) => documentsById.get(documentId))
      .filter(Boolean),
    addedAt: scenarioDefinition.addedAt || null,
    updatedAt: scenarioDefinition.updatedAt || null,
  };
}

function resolveHelpDocumentPath(relativePath) {
  const normalizedPath = String(relativePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!normalizedPath) {
    return { ok: false, reason: "Aucun fichier markdown n'est configure." };
  }

  const absolutePath = path.resolve(REPOSITORY_ROOT, normalizedPath);
  const relativeToRoot = path.relative(REPOSITORY_ROOT, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return {
      ok: false,
      reason: "Le chemin de documentation pointe hors du depot autorise.",
    };
  }

  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      reason: "Le fichier markdown est introuvable sur le serveur.",
    };
  }

  return {
    ok: true,
    absolutePath,
    normalizedPath,
  };
}

function attachRelatedGuides(guides) {
  const guidesById = new Map(guides.map((guide) => [guide.id, guide]));

  return guides.map((guide) => ({
    ...guide,
    relatedGuides: guide.relatedGuideIds
      .map((guideId) => guidesById.get(guideId))
      .filter(Boolean)
      .map((relatedGuide) => ({
        id: relatedGuide.id,
        title: relatedGuide.title,
        type: relatedGuide.type,
        categoryId: relatedGuide.categoryId,
        categoryName: relatedGuide.categoryName,
        level: relatedGuide.level,
        levelLabel: relatedGuide.levelLabel,
      })),
  }));
}

function buildCategorySummaries(categories, guides, documents, faqs, scenarios, videos) {
  return categories.map((category) => {
    const guideCount = guides.filter((guide) => guide.categoryId === category.id).length;
    const documentCount = documents.filter(
      (document) => document.categoryId === category.id
    ).length;
    const faqCount = faqs.filter((faq) => faq.categoryId === category.id).length;
    const scenarioCount = scenarios.filter(
      (scenario) => scenario.categoryId === category.id
    ).length;
    const videoCount = videos.filter((video) => video.categoryId === category.id).length;

    return {
      ...category,
      counts: {
        guides: guideCount,
        documents: documentCount,
        faqs: faqCount,
        scenarios: scenarioCount,
        videos: videoCount,
      },
    };
  });
}

function selectByIds(collection, ids) {
  const collectionById = new Map(collection.map((item) => [item.id, item]));
  return ids.map((id) => collectionById.get(id)).filter(Boolean);
}

function buildFiltersPayload({ guides, documents, videos, faqs, scenarios, categories }) {
  const tagValues = uniqueValues(
    [...guides, ...documents, ...videos, ...faqs, ...scenarios].flatMap(
      (item) => item.tags || []
    )
  ).sort((tagA, tagB) => tagA.localeCompare(tagB, "fr"));

  const moduleValues = uniqueValues(
    [...guides, ...documents, ...videos, ...faqs, ...scenarios]
      .map((item) => item.moduleKey)
      .filter(Boolean)
  )
    .map((moduleKey) => ({
      id: moduleKey,
      label:
        categories.find((category) => category.moduleKey === moduleKey)?.name ||
        moduleKey,
    }))
    .sort((moduleA, moduleB) => moduleA.label.localeCompare(moduleB.label, "fr"));

  return {
    categories: categories.map((category) => ({
      id: category.id,
      label: category.name,
    })),
    levels: HELP_LEVELS,
    types: HELP_CONTENT_TYPES,
    tags: tagValues.map((tag) => ({ id: tag, label: tag })),
    modules: moduleValues,
  };
}

function parseRangeHeader(rangeHeader, totalSize) {
  if (!rangeHeader) {
    return null;
  }

  if (!String(rangeHeader).startsWith("bytes=")) {
    return { ok: false };
  }

  const [startToken, endToken] = String(rangeHeader).slice(6).split("-");
  const start = Number.parseInt(startToken, 10);
  const end = endToken ? Number.parseInt(endToken, 10) : totalSize - 1;

  if (
    !Number.isInteger(start) ||
    start < 0 ||
    !Number.isInteger(end) ||
    end < start ||
    end >= totalSize
  ) {
    return { ok: false };
  }

  return { ok: true, start, end };
}

function pipeFileToResponse(absolutePath, response, streamOptions) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(absolutePath, streamOptions);

    fileStream.on("error", reject);
    response.on("close", resolve);
    response.on("finish", resolve);

    fileStream.pipe(response);
  });
}

async function getVideoMediaOrThrow(videoId) {
  const id = parsePositiveInteger(videoId, "Identifiant du guide");
  const videoMedia = await HelpRepository.findVideoMediaById(id);

  if (!videoMedia) {
    throw createHttpError(404, "Guide introuvable.");
  }

  return videoMedia;
}

export async function getCategories() {
  const categories = await HelpRepository.findAllActiveCategories();
  return categories.map(mapCategory);
}

export async function getAllVideos() {
  const videos = await HelpRepository.findAllActiveVideos();
  return videos.map(mapVideo);
}

export async function searchVideos(query) {
  const normalizedQuery = String(query || "").trim();

  if (normalizedQuery.length < SEARCH_MIN_LENGTH) {
    throw createHttpError(
      400,
      `Le terme de recherche doit contenir au moins ${SEARCH_MIN_LENGTH} caracteres.`
    );
  }

  const videos = await HelpRepository.searchVideos(normalizedQuery);

  return {
    query: normalizedQuery,
    results: videos.map(mapVideo),
  };
}

export async function getVideosByCategory(categoryId) {
  const parsedCategoryId = parsePositiveInteger(
    categoryId,
    "Identifiant de categorie"
  );
  const videos = await HelpRepository.findVideosByCategory(parsedCategoryId);

  return videos.map(mapVideo);
}

export async function getVideoDetail(videoId) {
  const parsedVideoId = parsePositiveInteger(videoId, "Identifiant du guide");
  const video = await HelpRepository.findVideoById(parsedVideoId);

  if (!video) {
    throw createHttpError(404, "Guide introuvable.");
  }

  return mapVideo(video);
}

export async function getHelpCenter() {
  const categories = HELP_CATEGORIES.map((category, index) => ({
    ...category,
    displayOrder: index + 1,
  }));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const repositoryVideos = await HelpRepository.findAllActiveVideos();
  const videosBySlug = new Map(
    repositoryVideos.map((video) => [String(video.slug || "").trim(), video])
  );
  const documents = HELP_DOCUMENTS.map((documentDefinition) =>
    mapDocument(documentDefinition, categoriesById)
  );
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  const guides = attachRelatedGuides(
    HELP_GUIDES.map((guideDefinition) =>
      mapGuide(guideDefinition, categoriesById, documentsById, videosBySlug)
    )
  );
  const guidesById = new Map(guides.map((guide) => [guide.id, guide]));
  const videos = guides.flatMap((guide) => guide.videos);
  const faqs = HELP_FAQS.map((faqDefinition) =>
    mapFaq(faqDefinition, categoriesById, guidesById, documentsById)
  );
  const scenarios = HELP_SCENARIOS.map((scenarioDefinition) =>
    mapScenario(scenarioDefinition, categoriesById, guidesById, documentsById)
  );
  const categorySummaries = buildCategorySummaries(
    categories,
    guides,
    documents,
    faqs,
    scenarios,
    videos
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      categories: categorySummaries.length,
      guides: guides.length,
      documents: documents.length,
      videos: videos.length,
      videosReady: videos.filter((video) => video.hasVideo).length,
      faqs: faqs.length,
      scenarios: scenarios.length,
    },
    meta: {
      levels: HELP_LEVELS,
      contentTypes: HELP_CONTENT_TYPES,
      documentKinds: HELP_DOCUMENT_KINDS,
      filters: buildFiltersPayload({
        guides,
        documents,
        videos,
        faqs,
        scenarios,
        categories: categorySummaries,
      }),
    },
    featured: {
      quickAccess: selectByIds(
        [...guides, ...scenarios, ...faqs],
        HELP_FEATURED.quickAccessIds
      ),
      popularGuides: selectByIds(guides, HELP_FEATURED.popularGuideIds),
      recentContent: selectByIds(
        [...guides, ...documents, ...faqs, ...scenarios],
        HELP_FEATURED.recentContentIds
      ),
      recommendedGuides: selectByIds(guides, HELP_FEATURED.recommendedGuideIds),
      learningPath: HELP_FEATURED.learningPath
        .map((step) => {
          const content =
            guidesById.get(step.contentId) ||
            faqs.find((faq) => faq.id === step.contentId) ||
            scenarios.find((scenario) => scenario.id === step.contentId) ||
            documentsById.get(step.contentId);

          if (!content) {
            return null;
          }

          return {
            ...step,
            content: {
              id: content.id,
              title: content.title,
              type: content.type,
              categoryId: content.categoryId,
              categoryName: content.categoryName,
              estimatedLabel:
                content.estimatedLabel || content.durationLabel || null,
            },
          };
        })
        .filter(Boolean),
    },
    categories: categorySummaries,
    guides,
    documents,
    videos,
    faqs,
    scenarios,
  };
}

export async function getDocumentDetail(slug) {
  const normalizedSlug = String(slug || "").trim();

  if (!normalizedSlug) {
    throw createHttpError(400, "Identifiant de documentation invalide.");
  }

  const documentDefinition = findDocumentDefinitionBySlug(normalizedSlug);

  if (!documentDefinition) {
    throw createHttpError(404, "Documentation introuvable.");
  }

  const resolvedDocument = resolveHelpDocumentPath(documentDefinition.relativePath);

  if (!resolvedDocument.ok) {
    throw createHttpError(404, resolvedDocument.reason);
  }

  const [content, stats] = await Promise.all([
    fs.promises.readFile(resolvedDocument.absolutePath, "utf8"),
    fs.promises.stat(resolvedDocument.absolutePath),
  ]);

  const categoriesById = new Map(HELP_CATEGORIES.map((category) => [category.id, category]));
  const mappedDocument = mapDocument(documentDefinition, categoriesById);
  const relatedGuides = HELP_GUIDES.filter((guide) =>
    guide.documentIds.includes(documentDefinition.id)
  ).map((guide) => ({
    id: guide.id,
    title: guide.title,
    type: "guide",
    categoryId: guide.categoryId,
    categoryName: categoriesById.get(guide.categoryId)?.name || null,
    level: guide.level,
    levelLabel: findLabelById(HELP_LEVELS, guide.level),
    estimatedLabel: formatEstimatedMinutes(guide.estimatedMinutes),
  }));

  return {
    ...mappedDocument,
    content,
    path: resolvedDocument.normalizedPath,
    lastModifiedAt: stats.mtime.toISOString(),
    relatedGuides,
  };
}

export async function streamVideo(videoId, request, response) {
  const videoMedia = await getVideoMediaOrThrow(videoId);

  if (!videoMedia.video_path) {
    throw createHttpError(404, "Aucune video n'est associee a ce guide.");
  }

  const resolvedVideo = resolveHelpMediaPath(videoMedia.video_path, "video");

  if (!resolvedVideo.ok) {
    throw createHttpError(404, resolvedVideo.reason);
  }

  const totalSize = fs.statSync(resolvedVideo.absolutePath).size;
  const requestedRange = parseRangeHeader(request.headers.range, totalSize);

  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.setHeader("Content-Type", resolvedVideo.contentType);
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (requestedRange === null) {
    response.status(200);
    response.setHeader("Content-Length", totalSize);
    await pipeFileToResponse(resolvedVideo.absolutePath, response);
    return;
  }

  if (!requestedRange.ok) {
    response.status(416);
    response.setHeader("Content-Range", `bytes */${totalSize}`);
    response.end();
    return;
  }

  const { start, end } = requestedRange;
  const chunkSize = end - start + 1;

  response.status(206);
  response.setHeader("Content-Length", chunkSize);
  response.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);

  await pipeFileToResponse(resolvedVideo.absolutePath, response, { start, end });
}

export async function serveThumbnail(videoId, response) {
  const videoMedia = await getVideoMediaOrThrow(videoId);

  if (!videoMedia.thumbnail_path) {
    throw createHttpError(404, "Aucune miniature n'est associee a ce guide.");
  }

  const resolvedThumbnail = resolveHelpMediaPath(
    videoMedia.thumbnail_path,
    "thumbnail"
  );

  if (!resolvedThumbnail.ok) {
    throw createHttpError(404, resolvedThumbnail.reason);
  }

  response.status(200);
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.setHeader("Content-Type", resolvedThumbnail.contentType);
  response.setHeader("X-Content-Type-Options", "nosniff");

  await pipeFileToResponse(resolvedThumbnail.absolutePath, response);
}
