const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const DEFAULT_TARGET_GROUP_SIZE = 26;
const DEFAULT_MAX_GROUP_CAPACITY = 30;
const DEFAULT_MAX_GROUPS_PER_PROFESSOR = 16;
const DEFAULT_MAX_WEEKLY_SESSIONS_PER_PROFESSOR = 16;

function readPositiveInteger(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isOnlineCourseSchedulingEnabled() {
  const brute = String(process.env.ENABLE_ONLINE_COURSES || "").trim().toLowerCase();
  if (!brute) {
    return false;
  }

  return TRUE_VALUES.has(brute);
}

export function isCourseSchedulable(cours) {
  if (isOnlineCourseSchedulingEnabled()) {
    return true;
  }

  return !Boolean(Number(cours?.est_en_ligne || 0));
}

export function getSchedulerTargetGroupSize() {
  return readPositiveInteger(
    process.env.SCHEDULER_TARGET_GROUP_SIZE,
    DEFAULT_TARGET_GROUP_SIZE
  );
}

export function getSchedulerMaxGroupCapacity() {
  const configuredMax = readPositiveInteger(
    process.env.SCHEDULER_MAX_GROUP_CAPACITY,
    DEFAULT_MAX_GROUP_CAPACITY
  );

  return Math.max(configuredMax, getSchedulerTargetGroupSize());
}

export function resolveOperationalCourseCapacity() {
  return getSchedulerMaxGroupCapacity();
}

export function getSchedulerMaxGroupsPerProfessor() {
  return readPositiveInteger(
    process.env.SCHEDULER_MAX_GROUPS_PER_PROFESSOR,
    DEFAULT_MAX_GROUPS_PER_PROFESSOR
  );
}

export function getSchedulerMaxWeeklySessionsPerProfessor() {
  return readPositiveInteger(
    process.env.SCHEDULER_MAX_WEEKLY_SESSIONS_PER_PROFESSOR,
    DEFAULT_MAX_WEEKLY_SESSIONS_PER_PROFESSOR
  );
}
