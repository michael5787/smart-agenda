import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GraduationCap, School, TriangleAlert } from "lucide-react";
import { StudentAgenda } from "@/components/agenda/StudentAgenda";
import { TeacherAgenda } from "@/components/agenda/TeacherAgenda";
import { formatDayLabelAr } from "@/components/agenda/AgendaCalendar";
import { shiftDay } from "@/components/agenda/useAgenda";
import { IDS, MockDb, TODAY, createMockClient } from "@/lib/mockAgendaClient";
import type { Database } from "@/integrations/supabase/types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Madauros — المفكرة (Agenda demo)" },
      { name: "description", content: "Student and teacher agenda with automatic jump to the first pending homework date." },
      { property: "og:title", content: "Madauros — المفكرة (Agenda demo)" },
      { property: "og:description", content: "Student and teacher agenda with automatic jump to the first pending homework date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [space, setSpace] = useState<"talameed" | "taleem">("talameed");
  const [missingTable, setMissingTable] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const db = useMemo(() => new MockDb(), []);
  db.missingAgendaTable = missingTable;
  const client = useMemo(() => createMockClient(db), [db]);
  const classes = db.rows("classes") as unknown as ClassRow[];

  const remount = () => setMountKey((k) => k + 1);

  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          <span className="text-brand-blue">mada</span>
          <span className="text-brand-red">uros</span>
          <span className="ms-2 text-base font-normal text-muted-foreground">/ المفكرة</span>
        </h1>
        <nav className="flex gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            className="nav-menu-item flex items-center gap-1"
            data-active={space === "talameed"}
            onClick={() => {
              setSpace("talameed");
              remount();
            }}
          >
            <GraduationCap size={14} /> فضاء التلاميذ
          </button>
          <button
            type="button"
            className="nav-menu-item flex items-center gap-1"
            data-active={space === "taleem"}
            onClick={() => {
              setSpace("taleem");
              remount();
            }}
          >
            <School size={14} /> فضاء التعليم
          </button>
        </nav>
      </header>

      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card/70 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold text-foreground">بيانات تجريبية (اليوم: {formatDayLabelAr(TODAY)})</p>
          <ul className="mt-2 list-disc space-y-1 pe-5 text-muted-foreground">
            <li>{formatDayLabelAr(shiftDay(TODAY, 2))}: واجب «الكسور» — التلميذ سلّمه.</li>
            <li>{formatDayLabelAr(shiftDay(TODAY, 5))}: واجب «المعادلات» — بدون تسليم.</li>
            <li>التلميذ يُنقل تلقائياً إلى الثاني، والأستاذ إلى الأول.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={missingTable}
              onChange={(e) => {
                setMissingTable(e.target.checked);
                remount();
              }}
            />
            <TriangleAlert size={14} className="text-brand-red" />
            محاكاة قاعدة البيانات الخارجية بدون جدول المفكرة
          </label>
          <button type="button" className="btn-text self-start text-xs" onClick={remount}>
            إعادة تحميل المكوّن (يعيد القفز التلقائي)
          </button>
        </div>
      </div>

      {space === "talameed" ? (
        <StudentAgenda key={`s${mountKey}`} client={client} classId={IDS.classA} studentId={IDS.student} />
      ) : (
        <TeacherAgenda key={`t${mountKey}`} client={client} teacherId={IDS.teacher} classes={classes} />
      )}
    </main>
  );
}
