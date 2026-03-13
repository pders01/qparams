import { useRef, useState, useMemo } from "react";
import { createSchema, toObject } from "@jpahd/qparams";
import { useQParams } from "@jpahd/qparams-react";

interface LogEntry {
  time: string;
  op: string;
  result: string;
}

const logRef: LogEntry[] = [];

function pushLog(op: string, result: URLSearchParams) {
  logRef.push({
    time: new Date().toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 1 }),
    op,
    result: result.toString() || "(empty)",
  });
  if (logRef.length > 50) logRef.shift();
}

const schema = createSchema({
  forbidden: ["token", "_internal"],
  repeatable: ["tag"],
  optional: ["q"],
  static: ["limit"],
  hooks: {
    onConstrain(_incoming, result) {
      pushLog("constrain", result);
    },
    onMerge(_current, _incoming, result) {
      pushLog("merge", result);
    },
    onWithout(_input, result) {
      pushLog("without", result);
    },
  },
});

const TAGS = ["electronics", "clothing", "books", "sale", "new"];
const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

export function App() {
  const { params, update, strip, toObject: getObject } = useQParams(schema);
  const [, setLogTick] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Force re-render to pick up log changes after operations settle
  const tickLog = () => setTimeout(() => setLogTick((t) => t + 1), 0);

  const activeTags = params.getAll("tag");
  const searchValue = params.get("q") ?? "";
  const sortValue = params.get("sort") ?? "relevance";
  const limitValue = params.get("limit") ?? "20";

  // Initialize limit if not set
  useMemo(() => {
    if (!params.has("limit")) {
      update({ limit: "20" });
      tickLog();
    }
  }, []);

  function onSearchChange(value: string) {
    if (value) {
      update({ q: value });
    } else {
      // Clear q — since it's optional, merge will drop it
      const next = new URLSearchParams(params);
      next.delete("q");
      update(next);
    }
    tickLog();
  }

  function onTagToggle(tag: string) {
    const current = new Set(activeTags);
    if (current.has(tag)) {
      current.delete(tag);
    } else {
      current.add(tag);
    }
    const next = new URLSearchParams();
    for (const t of current) next.append("tag", t);
    // Preserve other params
    params.forEach((v, k) => {
      if (k !== "tag") next.set(k, v);
    });
    update(next);
    tickLog();
  }

  function onSortChange(value: string) {
    update({ sort: value });
    tickLog();
  }

  function tryChangeLimit() {
    update({ limit: "999" });
    tickLog();
  }

  function injectToken() {
    update({ token: "hack_attempt_123" });
    tickLog();
  }

  const strippedUrl = strip({ static: true, forbidden: true }).toString();
  const stateJson = JSON.stringify(getObject(), null, 2);

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <h1 style={styles.title}>qparams</h1>
        <span style={styles.subtitle}>React Showcase</span>
      </header>

      {/* Current URL */}
      <section style={styles.card}>
        <label style={styles.label}>Current URL</label>
        <code style={styles.urlBar}>{window.location.pathname}{window.location.search || "?"}</code>
      </section>

      <div style={styles.grid}>
        {/* Left column: Controls */}
        <div style={styles.column}>
          {/* Search */}
          <section style={styles.card}>
            <label style={styles.label}>
              Search <span style={styles.badge}>optional</span>
            </label>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Type to search..."
              style={styles.input}
            />
            <p style={styles.hint}>Disappears from URL when empty</p>
          </section>

          {/* Tags */}
          <section style={styles.card}>
            <label style={styles.label}>
              Tags <span style={styles.badge}>repeatable</span>
            </label>
            <div style={styles.tagGrid}>
              {TAGS.map((tag) => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onTagToggle(tag)}
                    style={active ? { ...styles.tag, ...styles.tagActive } : styles.tag}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p style={styles.hint}>Multiple values in URL: tag=a&tag=b</p>
          </section>

          {/* Sort */}
          <section style={styles.card}>
            <label style={styles.label}>
              Sort <span style={styles.badge}>regular</span>
            </label>
            <select value={sortValue} onChange={(e) => onSortChange(e.target.value)} style={styles.select}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p style={styles.hint}>Last-write-wins</p>
          </section>

          {/* Static: limit */}
          <section style={styles.card}>
            <label style={styles.label}>
              Page Size <span style={styles.badge}>static</span>
            </label>
            <div style={styles.row}>
              <code style={styles.value}>{limitValue}</code>
              <button onClick={tryChangeLimit} style={styles.btnSecondary}>
                Try changing to 999
              </button>
            </div>
            <p style={styles.hint}>Set once, cannot be overwritten</p>
          </section>

          {/* Forbidden: token injection */}
          <section style={styles.card}>
            <label style={styles.label}>
              Security <span style={styles.badgeDanger}>forbidden</span>
            </label>
            <button onClick={injectToken} style={styles.btnDanger}>
              Inject token=hack_attempt_123
            </button>
            <p style={styles.hint}>Silently stripped by schema</p>
          </section>

          {/* Strip / API URL */}
          <section style={styles.card}>
            <label style={styles.label}>
              API URL <span style={styles.badge}>without</span>
            </label>
            <code style={styles.urlBar}>{strippedUrl || "(empty)"}</code>
            <button
              onClick={() => navigator.clipboard.writeText(`?${strippedUrl}`)}
              style={styles.btnPrimary}
            >
              Copy API URL
            </button>
            <p style={styles.hint}>Static & forbidden params stripped</p>
          </section>
        </div>

        {/* Right column: State + Logs */}
        <div style={styles.column}>
          {/* Current state */}
          <section style={styles.card}>
            <label style={styles.label}>toObject()</label>
            <pre style={styles.json}>{stateJson}</pre>
          </section>

          {/* Hook log */}
          <section style={{ ...styles.card, ...styles.logCard }}>
            <label style={styles.label}>Hook Log</label>
            <div style={styles.logScroll}>
              {logRef.length === 0 && <p style={styles.hint}>Waiting for operations...</p>}
              {logRef.map((entry, i) => (
                <div key={i} style={styles.logEntry}>
                  <span style={styles.logTime}>{entry.time}</span>
                  <span style={styles.logOp}>{entry.op}</span>
                  <code style={styles.logResult}>{entry.result}</code>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#f3f4f6",
    minHeight: "100vh",
    padding: "24px",
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    fontFamily: "ui-monospace, monospace",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    padding: 16,
    border: "1px solid #e5e7eb",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  badge: {
    fontSize: 10,
    fontWeight: 500,
    background: "#eef2ff",
    color: "#6366f1",
    padding: "2px 6px",
    borderRadius: 4,
    textTransform: "lowercase",
    letterSpacing: 0,
  },
  badgeDanger: {
    fontSize: 10,
    fontWeight: 500,
    background: "#fef2f2",
    color: "#dc2626",
    padding: "2px 6px",
    borderRadius: 4,
    textTransform: "lowercase",
    letterSpacing: 0,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "ui-monospace, monospace",
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  tagGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
    color: "#374151",
  },
  tagActive: {
    background: "#6366f1",
    color: "#fff",
    borderColor: "#6366f1",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  value: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "ui-monospace, monospace",
    color: "#111827",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    margin: "8px 0 0",
  },
  urlBar: {
    display: "block",
    padding: "10px 12px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontFamily: "ui-monospace, monospace",
    fontSize: 13,
    color: "#374151",
    overflowX: "auto",
    whiteSpace: "nowrap",
    marginBottom: 8,
  },
  btnPrimary: {
    padding: "8px 16px",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "6px 12px",
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "8px 16px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  json: {
    margin: 0,
    padding: 12,
    background: "#1e1b4b",
    color: "#c7d2fe",
    borderRadius: 6,
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    overflow: "auto",
    maxHeight: 200,
  },
  logCard: {
    flex: 1,
  },
  logScroll: {
    maxHeight: 320,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  logEntry: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    padding: "4px 8px",
    background: "#f9fafb",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "ui-monospace, monospace",
  },
  logTime: {
    color: "#9ca3af",
    flexShrink: 0,
  },
  logOp: {
    color: "#6366f1",
    fontWeight: 600,
    flexShrink: 0,
    minWidth: 70,
  },
  logResult: {
    color: "#374151",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
