import { performance } from "node:perf_hooks";

function normalizeLabel(label, fallback = "unknown") {
  const value = String(label || "").trim();
  return value === "" ? fallback : value;
}

function normalizeSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSqlTableName(normalizedSql) {
  const match = normalizedSql.match(
    /\b(?:INTO|UPDATE|FROM|JOIN|DELETE FROM)\s+[`"]?([a-zA-Z0-9_]+)[`"]?/i
  );
  return match?.[1] ? String(match[1]).toLowerCase() : "unknown";
}

function classifySql(scope, sql) {
  const normalizedScope = normalizeLabel(scope, "sql");
  const normalizedSql = normalizeSql(sql);
  const operation = normalizedSql.split(" ")[0]?.toUpperCase() || "QUERY";
  const table = readSqlTableName(normalizedSql);
  return `${normalizedScope}:${operation}:${table}`;
}

function formatMs(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0.00";
  }

  return numericValue.toFixed(2);
}

function flattenTopEntries(entries, limit = 5) {
  return [...entries]
    .sort((left, right) => {
      if (right.totalMs !== left.totalMs) {
        return right.totalMs - left.totalMs;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, "fr");
    })
    .slice(0, limit);
}

const AGGREGATE_STEP_LABELS = new Set([
  "response_finale_backend",
  "generation_totale",
  "capture_generation_totale",
]);

export class GenerationPerformanceTracker {
  constructor({ enabled = true, logger = console } = {}) {
    this.enabled = enabled !== false;
    this.logger = logger;
    this.steps = new Map();
    this.sql = new Map();
    this.counters = new Map();
  }

  startStep(label) {
    if (!this.enabled) {
      return;
    }

    const stepLabel = normalizeLabel(label);
    const current = this.steps.get(stepLabel) || {
      label: stepLabel,
      count: 0,
      totalMs: 0,
      runningSince: null,
    };

    current.runningSince = performance.now();
    this.steps.set(stepLabel, current);
  }

  endStep(label) {
    if (!this.enabled) {
      return 0;
    }

    const stepLabel = normalizeLabel(label);
    const current = this.steps.get(stepLabel);
    if (!current?.runningSince) {
      return 0;
    }

    const elapsedMs = performance.now() - current.runningSince;
    current.runningSince = null;
    current.count += 1;
    current.totalMs += elapsedMs;
    this.steps.set(stepLabel, current);
    return elapsedMs;
  }

  async measure(label, fn) {
    this.startStep(label);
    try {
      return await fn();
    } finally {
      this.endStep(label);
    }
  }

  measureSync(label, fn) {
    this.startStep(label);
    try {
      return fn();
    } finally {
      this.endStep(label);
    }
  }

  incrementCounter(name, value = 1) {
    if (!this.enabled) {
      return;
    }

    const counterName = normalizeLabel(name);
    const currentValue = Number(this.counters.get(counterName) || 0);
    this.counters.set(counterName, currentValue + Number(value || 0));
  }

  setCounter(name, value) {
    if (!this.enabled) {
      return;
    }

    this.counters.set(normalizeLabel(name), Number(value || 0));
  }

  recordSql(label, elapsedMs = 0, count = 1) {
    if (!this.enabled) {
      return;
    }

    const sqlLabel = normalizeLabel(label, "sql");
    const current = this.sql.get(sqlLabel) || {
      label: sqlLabel,
      count: 0,
      totalMs: 0,
    };

    current.count += Number(count || 0);
    current.totalMs += Number(elapsedMs || 0);
    this.sql.set(sqlLabel, current);
  }

  wrapExecutor(executor, scope = "sql") {
    if (!this.enabled || !executor || typeof executor.query !== "function") {
      return executor;
    }

    if (executor.__generationPerformanceTrackerWrapped) {
      return executor;
    }

    const tracker = this;

    return new Proxy(executor, {
      get(target, property) {
        if (property === "__generationPerformanceTrackerWrapped") {
          return true;
        }

        const value = target[property];
        if (
          (property === "query" || property === "execute") &&
          typeof value === "function"
        ) {
          return async function wrappedQuery(...args) {
            const startedAt = performance.now();
            try {
              return await value.apply(target, args);
            } finally {
              const elapsedMs = performance.now() - startedAt;
              tracker.incrementCounter("sql_queries_total", 1);
              tracker.recordSql(normalizeLabel(scope, "sql"), elapsedMs, 1);
              tracker.recordSql(
                classifySql(normalizeLabel(scope, "sql"), args[0]),
                elapsedMs,
                1
              );
            }
          };
        }

        if (typeof value === "function") {
          return value.bind(target);
        }

        return value;
      },
    });
  }

  getStepEntries() {
    return flattenTopEntries(this.steps.values(), this.steps.size);
  }

  getSlowestStep() {
    return this.getStepEntries()[0] || null;
  }

  getSqlEntries() {
    return flattenTopEntries(this.sql.values(), this.sql.size);
  }

  snapshot() {
    return {
      steps: this.getStepEntries().map((entry) => ({
        label: entry.label,
        count: entry.count,
        total_ms: Number(formatMs(entry.totalMs)),
      })),
      sql: this.getSqlEntries().map((entry) => ({
        label: entry.label,
        count: entry.count,
        total_ms: Number(formatMs(entry.totalMs)),
      })),
      counters: Object.fromEntries(this.counters.entries()),
    };
  }

  printSummary({
    prefix = "[scheduler:perf]",
    coursesToPlace = null,
    coursesPlaced = null,
    conflictsDetected = null,
  } = {}) {
    if (!this.enabled) {
      return;
    }

    const slowestStep =
      flattenTopEntries(
        [...this.steps.values()].filter((entry) => !AGGREGATE_STEP_LABELS.has(entry.label)),
        this.steps.size
      )[0] || this.getSlowestStep();
    const totalGenerationMs =
      this.steps.get("response_finale_backend")?.totalMs ||
      this.steps.get("generation_totale")?.totalMs ||
      this.steps.get("capture_generation_totale")?.totalMs ||
      0;
    const sqlTotal = Number(this.counters.get("sql_queries_total") || 0);
    const topSteps = this.getStepEntries()
      .map((entry) => `${entry.label}=${formatMs(entry.totalMs)}ms`)
      .join(" | ");
    const topSql = this.getSqlEntries()
      .slice(0, 5)
      .map((entry) => `${entry.label}=${entry.count}`)
      .join(" | ");

    this.logger.info(
      `${prefix} cours_a_placer=${coursesToPlace ?? "n/a"} ` +
        `cours_places=${coursesPlaced ?? "n/a"} ` +
        `conflits=${conflictsDetected ?? "n/a"} ` +
        `temps_total=${formatMs(totalGenerationMs)}ms ` +
        `etape_plus_lente=${slowestStep?.label || "n/a"} ` +
        `sql_importantes=${sqlTotal}`
    );

    if (topSteps) {
      this.logger.info(`${prefix} etapes ${topSteps}`);
    }

    if (topSql) {
      this.logger.info(`${prefix} top_sql ${topSql}`);
    }
  }
}
