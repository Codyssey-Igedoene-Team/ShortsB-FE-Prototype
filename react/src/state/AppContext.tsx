import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { byId, availableBooks } from "../domain/catalog";
import {
  defaults,
  startSession,
  resumeBook,
  advance,
  dayKey,
} from "../domain/reading";
import { restore, persist } from "../domain/storage";
import type { Session, State } from "../domain/types";
export const routes = {
  index: "시작",
  home: "오늘 읽기",
  trial: "첫 독서",
  "trial-done": "첫 독서 완료",
  login: "로그인",
  signup: "회원가입",
  email: "이메일 입력",
  code: "인증번호",
  "signup-password": "비밀번호 설정",
  recover: "비밀번호 찾기",
  "recover-sent": "메일 안내",
  setup: "추천 설정",
  search: "책 찾기",
  book: "책 정보",
  reader: "독서",
  complete: "독서 완료",
  discover: "다른 관점",
  library: "나의 책장",
  calendar: "독서 기록",
  goals: "하루 목표",
  preferences: "취향 선택",
  highlights: "표시한 문장",
  settings: "설정",
  source: "본문 출처",
  about: "앱 안내",
} as const;
export type Route = keyof typeof routes;
export type Location = { page: Route; book?: string };
export function readLocation(): Location {
  const hashParts = window.location.hash.slice(1).split("?");
  const hash = hashParts[0],
    q = new URLSearchParams(
      hash in routes
        ? hashParts[1] || window.location.search
        : window.location.search,
    );
  const file =
    window.location.pathname
      .split("/")
      .pop()
      ?.replace(/\.html$/, "") || "index";
  const page = hash in routes ? hash : file;
  return {
    page: page in routes ? (page as Route) : "index",
    book: q.get("book") || undefined,
  };
}
type Context = {
  state: State;
  update: (fn: (s: State) => State) => void;
  location: Location;
  go: (page: Route, book?: string, replace?: boolean) => void;
  notify: (text: string) => void;
  notice: string;
  storageError: boolean;
  ready: boolean;
  start: (
    id: string,
    start?: number,
    mode?: Session["mode"],
    trail?: string[],
  ) => void;
  resume: (id: string) => void;
  next: () => void;
  pause: () => void;
  previewAccount: () => void;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({
  children,
  initialLocation = { page: "index" },
  initialState = defaults(),
}: {
  children: ReactNode;
  initialLocation?: Location;
  initialState?: State;
}) {
  const [state, setState] = useState(initialState),
    [location, setLocation] = useState(initialLocation),
    [notice, setNotice] = useState(""),
    [storageError, setStorageError] = useState(false),
    [ready, setReady] = useState(false);
  const stateRef = useRef(state),
    canWrite = useRef(false);
  stateRef.current = state;
  const update = (fn: (s: State) => State) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    if (canWrite.current) setStorageError(!persist(localStorage, next));
  };
  const go = (page: Route, book?: string, replace = false) => {
    setNotice("");
    const loc = { page, book };
    setLocation(loc);
    if (typeof window !== "undefined") {
      const url = new URL(page + ".html", window.location.href);
      if (book) url.searchParams.set("book", book);
      const target =
        window.location.protocol === "file:"
          ? "#" + page + (book ? "?book=" + encodeURIComponent(book) : "")
          : url;
      window.history[replace ? "replaceState" : "pushState"]({}, "", target);
      window.scrollTo(0, 0);
    }
  };
  useEffect(() => {
    let restored = initialState;
    try {
      const loaded = restore(localStorage);
      restored = loaded.state;
      canWrite.current = loaded.canWrite;
      setStorageError(loaded.warning);
      if (loaded.canWrite && !persist(localStorage, restored))
        setStorageError(true);
    } catch {
      setStorageError(true);
    }
    stateRef.current = restored;
    setState(restored);
    const loc = readLocation();
    if (loc.page === "index") {
      if (
        restored.setupCompleted ||
        restored.profile ||
        restored.saved.length ||
        restored.history.length
      )
        go("home", undefined, true);
      else if (restored.demoAccountComplete) go("setup", undefined, true);
      else if (restored.intro?.status === "done")
        go("trial-done", undefined, true);
      else go("trial", undefined, true);
    } else setLocation(loc);
    setReady(true);
    const onPop = () => {
      setLocation(readLocation());
      setNotice("");
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
    // Bootstrap once. Subsequent navigation is state-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    document.title = `shortB · ${routes[location.page]}`;
    document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
  }, [location.page]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(t);
  }, [notice]);
  const start: Context["start"] = (id, offset, mode = "excerpt", trail) => {
    if (!byId.get(id)?.available) {
      setNotice("한국어 전문을 준비하고 있어요.");
      return;
    }
    update((s) => startSession(s, id, { start: offset, mode, trail }));
    go("reader", id);
  };
  const resume: Context["resume"] = (id) => {
    const next = resumeBook(stateRef.current, id);
    if (!next.active) {
      go("book", id);
      return;
    }
    update(() => next);
    go("reader", id);
  };
  const next = () => {
    const previous = stateRef.current.active;
    if (!previous) return;
    const result = advance(stateRef.current);
    update(() => result);
    window.scrollTo(0, 0);
    if (!result.active)
      go(previous.mode === "trial" ? "trial-done" : "complete", previous.id);
  };
  const pause = () => {
    update((s) => {
      if (!s.active) return s;
      const a = { ...s.active, scrollY: window.scrollY, updatedAt: Date.now() };
      return { ...s, active: null, progress: { ...s.progress, [a.id]: a } };
    });
    go("home");
    setNotice("읽던 위치를 저장했어요.");
  };
  const previewAccount = () => {
    update((s) => ({ ...s, demoAccountComplete: true }));
    go(stateRef.current.setupCompleted ? "home" : "setup");
  };
  return (
    <AppContext.Provider
      value={{
        state,
        update,
        location,
        go,
        notify: setNotice,
        notice,
        storageError,
        ready,
        start,
        resume,
        next,
        pause,
        previewAccount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw Error("AppProvider is required");
  return c;
}
export function useReadingClock() {
  const { location, state, update } = useApp(),
    id = state.active?.id;
  useEffect(() => {
    if (location.page !== "reader" || !id) return;
    let last = Date.now(),
      lastActivity = Date.now(),
      eligible = document.visibilityState === "visible" && document.hasFocus(),
      day = dayKey();
    const activity = () => {
      lastActivity = Date.now();
    };
    const tick = () => {
      const now = Date.now(),
        nextDay = dayKey(),
        active =
          document.visibilityState === "visible" &&
          document.hasFocus() &&
          now - lastActivity < 120000;
      const seconds =
        eligible && active && nextDay === day
          ? Math.min(10, Math.max(0, Math.floor((now - last) / 1000)))
          : 0;
      if (seconds)
        update((s) => ({
          ...s,
          readingSeconds: {
            ...s.readingSeconds,
            [day]: (s.readingSeconds[day] || 0) + seconds,
          },
          goalDays: { ...s.goalDays, [day]: s.goalDays[day] || s.goal },
        }));
      last = now;
      day = nextDay;
      eligible = active;
    };
    const timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("blur", tick);
    window.addEventListener("focus", tick);
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true }),
    );
    return () => {
      clearInterval(timer);
      tick();
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("blur", tick);
      window.removeEventListener("focus", tick);
      events.forEach((e) => window.removeEventListener(e, activity));
    };
  }, [location.page, id]);
}
export function useTrial() {
  const { state, ready, start, resume, go, location } = useApp();
  useEffect(() => {
    if (!ready || location.page !== "trial") return;
    if (state.intro?.status === "done") {
      go("trial-done", undefined, true);
      return;
    }
    const b =
      byId.get(state.intro?.bookId || "") ||
      availableBooks[Math.floor(Math.random() * availableBooks.length)];
    const previous = state.progress[b.id];
    if (previous?.mode === "trial" && !previous.completed) resume(b.id);
    else start(b.id, 0, "trial");
  }, [ready, location.page]);
}
