import test from "node:test";
import assert from "node:assert/strict";
import {
  availableBooks,
  byId,
  nextRelations,
  searchBooks,
} from "../src/domain/catalog";
import {
  addHighlight,
  advance,
  calendarRecords,
  defaults,
  goalStats,
  migrate,
  readPages,
  resume,
  resumeBook,
  startSession,
  streak,
  uniqueBooks,
  validDay,
} from "../src/domain/reading";

const book = byId.get("spring-spring")!;
const day = "2026-10-31";
function readFive() {
  let state = startSession({ ...defaults(), pageCount: 5 }, book.id, {
    start: 0,
    now: 1,
  });
  for (let i = 0; i < 5; i++) state = advance(state, day);
  return state;
}
test("five completed pages resume at page six, including after a reload", () => {
  const state = migrate(JSON.parse(JSON.stringify(readFive())));
  assert.equal(state.active, null);
  assert.equal(readPages(state, book).size, 5);
  assert.equal(resume(state, book.id)?.cursor, 5);
  const next = resumeBook(state, book.id);
  assert.equal(next.active?.start, 5);
  assert.equal(next.active?.end, 10);
  assert.equal(book.parts[next.active!.cursor], book.parts[5]);
});
test("pause/reload preserves the exact unread page and scroll position", () => {
  let state = advance(startSession(defaults(), book.id, { start: 2 }), day);
  const current = { ...state.active!, scrollY: 419 };
  state = { ...state, active: null, progress: { [book.id]: current } };
  const restored = resumeBook(migrate(state), book.id);
  assert.equal(restored.active?.cursor, 3);
  assert.equal(restored.active?.scrollY, 419);
  assert.equal(restored.active?.token, current.token);
});
test("trial resume does not restart its two-page allowance", () => {
  const state = advance(
    startSession(defaults(), book.id, { start: 0, mode: "trial" }),
    day,
  );
  const restored = resumeBook(migrate(state), book.id);
  assert.equal(restored.active?.cursor, 1);
  assert.equal(restored.active?.end, 2);
  assert.equal(advance(restored, day).intro?.status, "done");
});
test("re-reading does not duplicate a shelf book or inflate daily page count", () => {
  const first = readFive();
  let again = startSession(first, book.id, { start: 0 });
  for (let i = 0; i < 5; i++) again = advance(again, day);
  assert.deepEqual(uniqueBooks(again), [book.id]);
  assert.equal(readPages(again, book).size, 5);
  assert.equal(goalStats(again, day).current, 5);
  assert.equal(advance(again, day), again);
});
test("finishing an excerpt is not a full-book completion", () => {
  const state = readFive();
  assert.notEqual(readPages(state, book).size, book.totalPages);
  let all = startSession({ ...state, pageCount: 10 }, book.id, { start: 5 });
  while (all.active) all = advance(all, day);
  assert.equal(readPages(all, book).size, book.totalPages);
  assert.equal(resume(all, book.id), null);
});
test("new Korean editions archive foreign cursors without losing history or legacy attendance", () => {
  const b = byId.get("waiting")!,
    previous = Object.keys(b.legacyEditions)[0];
  const old = {
    ...startSession(defaults(), b.id, { start: 0 }).active!,
    edition: previous,
  };
  const migrated = migrate({
    ...defaults(),
    active: old,
    progress: { [b.id]: old },
    readLog: [{ id: b.id, edition: previous, index: 0, day }],
    completedDays: ["2026-10-20", day, "wrong"],
  });
  assert.equal(migrated.active, null);
  assert.equal(migrated.progress[b.id], undefined);
  assert.ok(migrated.editionArchive[`${b.id}:${previous}`]);
  assert.equal(migrated.readLog.length, 1);
  assert.equal(readPages(migrated, b).size, 0);
  assert.deepEqual(migrated.completedDays, ["2026-10-20", day]);
});
test("invalid persisted dates and counters cannot crash the record screen", () => {
  assert.equal(validDay("2026-99-99"), false);
  assert.equal(validDay("2026-02-30"), false);
  const restored = migrate({
    readLog: [null, { id: book.id, index: 0, day: "2026-99-99" }],
    readingSeconds: { [day]: -30 },
    completedDays: [4, null, "x"],
  });
  assert.equal(restored.readLog.length, 0);
  assert.equal(goalStats(restored, day).current, 0);
});
test("contrasting recommendations never cycle back through the same reading chain", () => {
  for (const initial of availableBooks) {
    let state = defaults(),
      from = initial.id;
    const seen = new Set<string>();
    while (true) {
      assert.ok(!seen.has(from), `Repeated ${from}`);
      const trail = [...seen];
      seen.add(from);
      state = startSession(state, from, { trail });
      const relations = nextRelations(state, from);
      assert.ok(relations.every((r) => !seen.has(r.target)));
      if (!relations.length) break;
      from = relations[0].target;
      assert.ok(seen.size <= availableBooks.length);
    }
  }
});
test("highlight offsets must point to exact text and cannot overlap", () => {
  const h = {
    id: "one",
    bookId: book.id,
    edition: book.edition,
    index: 0,
    start: 0,
    end: 12,
    text: book.parts[0].slice(0, 12),
  };
  const state = addHighlight(defaults(), h);
  assert.equal(state.highlights.length, 1);
  assert.equal(addHighlight(state, { ...h, id: "two" }), state);
  assert.equal(
    addHighlight(state, { ...h, id: "three", text: "made up" }),
    state,
  );
});
test("presentation calendar has fifteen October days and six consecutive days without changing real state", () => {
  const state = readFive(),
    original = JSON.stringify(state);
  const records = calendarRecords(state, "2026-10", day);
  const days = [...new Set(records.map((r) => r.day))];
  assert.equal(days.length, 15);
  assert.equal(streak(days, day), 6);
  assert.equal(JSON.stringify(state), original);
  assert.equal(calendarRecords(state, "2026-11", day).length, 0);
  assert.equal(
    calendarRecords({ ...state, calendarDemo: false }, "2026-10", day).length,
    5,
  );
});
test("search results use Korean title order and time goals count full minutes", () => {
  const names = searchBooks("").map((b) => b.book);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, "ko", { numeric: true })),
  );
  const state = {
    ...defaults(),
    goal: { unit: "minutes" as const, value: 3 },
    readingSeconds: { [day]: 179 },
  };
  assert.equal(goalStats(state, day).done, false);
  assert.equal(
    goalStats({ ...state, readingSeconds: { [day]: 180 } }, day).done,
    true,
  );
});

test("after a final-page excerpt, remaining unread opening pages are still reachable", () => {
  let state = startSession(defaults(), book.id, { start: book.totalPages - 1 });
  state = advance(state, day);
  assert.equal(resume(state, book.id)?.cursor, 0);
  assert.equal(readPages(state, book).size, 1);
});
