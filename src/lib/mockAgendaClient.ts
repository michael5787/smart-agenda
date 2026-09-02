/**
 * A tiny in-memory stand-in for the Supabase client, covering only the query
 * surface the agenda components use. It lets the agenda behave end-to-end
 * (loading, auto-jump, create/edit/delete) without a live backend, and can
 * simulate the production failure (missing `agenda_events` table).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { shiftDay, toDateKey } from "@/components/agenda/useAgenda";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Filter = (row: Row) => boolean;
type PgError = { code: string; message: string; details: string; hint: string };

export const TODAY = toDateKey(new Date());
export const IDS = {
  teacher: "teacher-1",
  student: "student-1",
  classA: "class-a",
  classB: "class-b",
  res1: "res-1",
  res2: "res-2",
  res3: "res-3",
};

function baseTables(): Tables {
  const ts = (i: number) => new Date(Date.now() - i * 60_000).toISOString();
  const agenda = (o: Partial<Row> & { id: string; event_date: string; title: string }, i: number): Row => ({
    class_id: IDS.classA,
    teacher_id: IDS.teacher,
    kind: "homework",
    description: null,
    resource_id: null,
    link_url: null,
    created_at: ts(20 - i),
    updated_at: ts(20 - i),
    ...o,
  });
  return {
    classes: [
      { id: IDS.classA, name: "الأولى إعدادي — أ", code: "1A", level_id: null, capacity: 30, created_at: ts(50), updated_at: ts(50) },
      { id: IDS.classB, name: "الأولى إعدادي — ب", code: "1B", level_id: null, capacity: 30, created_at: ts(50), updated_at: ts(50) },
    ],
    profiles: [
      { id: IDS.student, email: "madauros26@example.com", full_name: "madauros26", space: "talameed", status: "approved", class_id: IDS.classA, level_id: null, created_at: ts(40), updated_at: ts(40), reviewed_at: ts(39) },
    ],
    resources: [
      { id: IDS.res1, teacher_id: IDS.teacher, level_id: null, class_id: null, category: "exercices", title: "تمارين الكسور", description: null, file_path: "x/1.pdf", file_name: "fractions.pdf", mime_type: "application/pdf", file_size: 120_000, created_at: ts(30), updated_at: ts(30) },
      { id: IDS.res2, teacher_id: IDS.teacher, level_id: null, class_id: null, category: "exercices", title: "تمارين المعادلات", description: null, file_path: "x/2.pdf", file_name: "equations.pdf", mime_type: "application/pdf", file_size: 98_000, created_at: ts(29), updated_at: ts(29) },
      { id: IDS.res3, teacher_id: IDS.teacher, level_id: null, class_id: null, category: "cours", title: "درس الهندسة", description: null, file_path: "x/3.pdf", file_name: "geometry.pdf", mime_type: "application/pdf", file_size: 200_000, created_at: ts(28), updated_at: ts(28) },
    ],
    // The student already handed in the homework attached to res-1.
    submissions: [
      { id: "sub-1", resource_id: IDS.res1, student_id: IDS.student, teacher_id: IDS.teacher, class_id: IDS.classA, level_id: null, file_path: "s/1.pdf", file_name: "answer.pdf", mime_type: "application/pdf", file_size: 50_000, grade: null, graded_at: null, created_at: ts(5), updated_at: ts(5) },
    ],
    agenda_events: [
      agenda({ id: "ev-past", event_date: shiftDay(TODAY, -3), title: "واجب سابق (منتهٍ)", description: "لا يُحتسب: تاريخه ماضٍ." }, 0),
      agenda({ id: "ev-today-eval", event_date: TODAY, kind: "evaluation", title: "فرض محروس — الأعداد", description: "تقييم اليوم؛ لا يؤثر في القفز التلقائي." }, 1),
      agenda({ id: "ev-eval", event_date: shiftDay(TODAY, 1), kind: "evaluation", title: "تقييم قصير", description: "تقييم وليس واجباً: يتجاهله القفز التلقائي." }, 2),
      agenda({ id: "ev-hw-done", event_date: shiftDay(TODAY, 2), title: "واجب: الكسور", description: "التلميذ سلّم جوابه على هذا الملف، فهو ليس معلّقاً بالنسبة له — لكنه أول واجب مستقبلي بالنسبة للأستاذ.", resource_id: IDS.res1 }, 3),
      agenda({ id: "ev-hw-pending", event_date: shiftDay(TODAY, 5), title: "واجب: المعادلات", description: "لا يوجد تسليم على هذا الملف بعد → أول واجب معلّق للتلميذ.", resource_id: IDS.res2, link_url: "https://example.com/equations" }, 4),
      agenda({ id: "ev-hw-later", event_date: shiftDay(TODAY, 9), title: "واجب: الهندسة", resource_id: IDS.res3 }, 5),
      agenda({ id: "ev-other-class", event_date: shiftDay(TODAY, 1), class_id: IDS.classB, title: "واجب القسم ب", description: "يظهر للأستاذ فقط (قسم آخر)." }, 6),
    ],
    notifications: [],
  };
}

class Query implements PromiseLike<{ data: Row[] | null; error: PgError | null }> {
  private filters: Filter[] = [];
  private sort: { col: string; asc: boolean } | null = null;
  private max: number | null = null;
  private pending: (() => void) | null = null;
  private columns = "*";

  constructor(
    private db: MockDb,
    private table: string,
  ) {}

  select(cols = "*") {
    this.columns = cols;
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  gt(col: string, v: string) {
    this.filters.push((r) => String(r[col]) > v);
    return this;
  }
  gte(col: string, v: string) {
    this.filters.push((r) => String(r[col]) >= v);
    return this;
  }
  lte(col: string, v: string) {
    this.filters.push((r) => String(r[col]) <= v);
    return this;
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[col]));
    return this;
  }
  or(expr: string) {
    // supports the single "class_id.is.null,class_id.eq.<id>" pattern used by useResourceList
    const parts = expr.split(",");
    this.filters.push((r) =>
      parts.some((p) => {
        const [col, op, val] = p.split(".");
        if (!col) return false;
        if (op === "is" && val === "null") return r[col] === null;
        if (op === "eq") return r[col] === val;
        return false;
      }),
    );
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sort = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  insert(values: Row | Row[]) {
    this.pending = () => {
      const now = new Date().toISOString();
      for (const v of Array.isArray(values) ? values : [values]) {
        this.db.rows(this.table).push({ id: `${this.table}-${Math.random().toString(36).slice(2, 8)}`, created_at: now, updated_at: now, read_at: null, ...v });
      }
    };
    return this;
  }
  update(values: Row) {
    this.pending = () => {
      for (const r of this.matching()) Object.assign(r, values, { updated_at: new Date().toISOString() });
    };
    return this;
  }
  delete() {
    this.pending = () => {
      const keep = this.db.rows(this.table).filter((r) => !this.filters.every((f) => f(r)));
      this.db.tables[this.table] = keep;
    };
    return this;
  }

  private matching() {
    return this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r)));
  }

  private run(): { data: Row[] | null; error: PgError | null } {
    const err = this.db.errorFor(this.table);
    if (err) return { data: null, error: err };
    if (this.pending) {
      this.pending();
      return { data: [], error: null };
    }
    let rows = this.matching();
    if (this.sort) {
      const { col, asc } = this.sort;
      rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    if (this.columns !== "*") {
      const cols = this.columns.split(",").map((c) => c.trim());
      rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    }
    return { data: rows.map((r) => ({ ...r })), error: null };
  }

  then<R1 = unknown, R2 = never>(
    onfulfilled?: ((v: { data: Row[] | null; error: PgError | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return new Promise<{ data: Row[] | null; error: PgError | null }>((resolve) =>
      setTimeout(() => resolve(this.run()), this.db.latency),
    ).then(onfulfilled, onrejected);
  }
}

export class MockDb {
  tables: Tables = baseTables();
  latency = 120;
  /** When true, `agenda_events` behaves like it does on the external DB before the SQL patch. */
  missingAgendaTable = false;
  listeners = new Set<() => void>();

  rows(table: string) {
    return (this.tables[table] ??= []);
  }
  errorFor(table: string): PgError | null {
    if (table === "agenda_events" && this.missingAgendaTable) {
      return {
        code: "PGRST205",
        message: "Could not find the table 'public.agenda_events' in the schema cache",
        details: "",
        hint: "Perhaps you meant the table 'public.notifications'",
      };
    }
    return null;
  }
  reset() {
    this.tables = baseTables();
  }
}

export function createMockClient(db: MockDb): SupabaseClient<Database> {
  const client = {
    from: (table: string) => new Query(db, table),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }),
      }),
    },
  };
  return client as unknown as SupabaseClient<Database>;
}
