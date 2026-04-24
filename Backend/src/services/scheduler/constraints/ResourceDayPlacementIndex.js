import { timeStringToMinutes } from "../time/TimeSlotUtils.js";

const RESOURCE_TYPE_ALIASES = new Map([
  ["prof", "professeur"],
  ["professeur", "professeur"],
  ["teacher", "professeur"],
  ["groupe", "groupe"],
  ["group", "groupe"],
  ["etudiant", "etudiant"],
  ["student", "etudiant"],
]);

function normalizeResourceType(resourceType) {
  const normalized = String(resourceType || "").trim().toLowerCase();
  return RESOURCE_TYPE_ALIASES.get(normalized) ?? normalized;
}

function normalizeDate(dateValue) {
  return String(dateValue || "").trim().slice(0, 10);
}

function normalizeResourceId(resourceId) {
  const numericId = Number(resourceId);
  return Number.isFinite(numericId) && numericId > 0
    ? numericId
    : String(resourceId || "").trim();
}

function clonePlacement(placement) {
  return {
    ...placement,
  };
}

function comparePlacements(leftPlacement, rightPlacement) {
  const leftStartMinutes = timeStringToMinutes(leftPlacement?.heure_debut);
  const rightStartMinutes = timeStringToMinutes(rightPlacement?.heure_debut);

  if (leftStartMinutes !== rightStartMinutes) {
    return leftStartMinutes - rightStartMinutes;
  }

  const leftEndMinutes = timeStringToMinutes(leftPlacement?.heure_fin);
  const rightEndMinutes = timeStringToMinutes(rightPlacement?.heure_fin);

  if (leftEndMinutes !== rightEndMinutes) {
    return leftEndMinutes - rightEndMinutes;
  }

  return String(
    leftPlacement?.id_affectation_cours ?? leftPlacement?.id ?? ""
  ).localeCompare(
    String(rightPlacement?.id_affectation_cours ?? rightPlacement?.id ?? ""),
    "fr"
  );
}

function placementsMatch(leftPlacement, rightPlacement) {
  if (!leftPlacement || !rightPlacement) {
    return false;
  }

  const leftId = leftPlacement.id_affectation_cours ?? leftPlacement.id;
  const rightId = rightPlacement.id_affectation_cours ?? rightPlacement.id;

  if (leftId != null && rightId != null) {
    return String(leftId) === String(rightId);
  }

  return (
    normalizeDate(leftPlacement.date) === normalizeDate(rightPlacement.date) &&
    String(leftPlacement.heure_debut || "").trim() ===
      String(rightPlacement.heure_debut || "").trim() &&
    String(leftPlacement.heure_fin || "").trim() ===
      String(rightPlacement.heure_fin || "").trim()
  );
}

function normalizeEntry(entry) {
  const placement = entry?.placement ? entry.placement : entry;
  const resourceType = normalizeResourceType(entry?.resourceType);
  const resourceId = normalizeResourceId(entry?.resourceId);
  const date = normalizeDate(entry?.date ?? placement?.date);

  if (!resourceType || !resourceId || !date || !placement) {
    return null;
  }

  return {
    resourceType,
    resourceId,
    date,
    placement: {
      ...clonePlacement(placement),
      date,
    },
  };
}

export class ResourceDayPlacementIndex {
  constructor(initialEntries = []) {
    this.store = new Map();

    for (const entry of initialEntries) {
      this.add(entry);
    }
  }

  add(entry) {
    const normalizedEntry = normalizeEntry(entry);
    if (!normalizedEntry) {
      return this;
    }

    const { resourceType, resourceId, date, placement } = normalizedEntry;
    const resourceStore = this.#ensureResourceStore(resourceType, resourceId);
    const dayPlacements = resourceStore.get(date) ?? [];
    const placementClone = clonePlacement(placement);

    if (
      dayPlacements.length === 0 ||
      comparePlacements(dayPlacements[dayPlacements.length - 1], placementClone) <= 0
    ) {
      dayPlacements.push(placementClone);
    } else {
      let insertIndex = dayPlacements.length;
      while (
        insertIndex > 0 &&
        comparePlacements(dayPlacements[insertIndex - 1], placementClone) > 0
      ) {
        insertIndex -= 1;
      }
      dayPlacements.splice(insertIndex, 0, placementClone);
    }

    resourceStore.set(date, dayPlacements);
    return this;
  }

  remove(entry) {
    const normalizedEntry = normalizeEntry(entry);
    if (!normalizedEntry) {
      return 0;
    }

    const { resourceType, resourceId, date, placement } = normalizedEntry;
    const resourceStore = this.store.get(resourceType)?.get(resourceId);
    const dayPlacements = resourceStore?.get(date);

    if (!dayPlacements) {
      return 0;
    }

    const remainingPlacements = dayPlacements.filter(
      (existingPlacement) => !placementsMatch(existingPlacement, placement)
    );
    const removedCount = dayPlacements.length - remainingPlacements.length;

    if (remainingPlacements.length > 0) {
      resourceStore.set(date, remainingPlacements);
    } else {
      resourceStore.delete(date);
    }

    if (resourceStore.size === 0) {
      this.store.get(resourceType)?.delete(resourceId);
    }

    if ((this.store.get(resourceType)?.size ?? 0) === 0) {
      this.store.delete(resourceType);
    }

    return removedCount;
  }

  get({ resourceType, resourceId, date }) {
    return this.peek({ resourceType, resourceId, date }).map(clonePlacement);
  }

  peek({ resourceType, resourceId, date }) {
    const normalizedType = normalizeResourceType(resourceType);
    const normalizedId = normalizeResourceId(resourceId);
    const normalizedDate = normalizeDate(date);

    return this.store.get(normalizedType)?.get(normalizedId)?.get(normalizedDate) ?? [];
  }

  has({ resourceType, resourceId, date }) {
    return this.peek({ resourceType, resourceId, date }).length > 0;
  }

  clear() {
    this.store.clear();
  }

  #ensureResourceStore(resourceType, resourceId) {
    if (!this.store.has(resourceType)) {
      this.store.set(resourceType, new Map());
    }

    const typeStore = this.store.get(resourceType);
    if (!typeStore.has(resourceId)) {
      typeStore.set(resourceId, new Map());
    }

    return typeStore.get(resourceId);
  }
}

export function createResourceDayPlacementIndex(initialEntries = []) {
  return new ResourceDayPlacementIndex(initialEntries);
}
