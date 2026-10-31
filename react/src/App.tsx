import { Component, type ReactNode } from "react";
import {
  AppProvider,
  useApp,
  useTrial,
  type Location,
} from "./state/AppContext";
import type { State } from "./domain/types";
import { BottomNav, Header, Brand } from "./components/UI";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { BookPage, SourcePage } from "./pages/BookPage";
import { ReaderPage } from "./pages/ReaderPage";
import { AuthPage } from "./pages/AuthPages";
import { SetupPage, PreferencesPage, GoalsPage } from "./pages/SetupPages";
import { LibraryPage, HighlightsPage } from "./pages/LibraryPage";
import { CalendarPage } from "./pages/CalendarPage";
import {
  TrialDonePage,
  CompletionPage,
  DiscoverPage,
} from "./pages/CompletionPages";
import { SettingsPage, AboutPage } from "./pages/SettingsPage";
const auth = new Set([
  "login",
  "signup",
  "email",
  "code",
  "signup-password",
  "recover",
  "recover-sent",
]);
function AppContent() {
  const { location, notice, storageError } = useApp();
  useTrial();
  const page = location.page;
  const content = auth.has(page) ? (
    <AuthPage key={page} />
  ) : (
    {
      home: <HomePage />,
      search: <SearchPage />,
      book: <BookPage />,
      reader: <ReaderPage />,
      setup: <SetupPage />,
      preferences: <PreferencesPage />,
      goals: <GoalsPage />,
      library: <LibraryPage />,
      highlights: <HighlightsPage />,
      calendar: <CalendarPage />,
      "trial-done": <TrialDonePage />,
      complete: <CompletionPage />,
      discover: <DiscoverPage />,
      settings: <SettingsPage />,
      source: <SourcePage />,
      about: <AboutPage />,
      trial: (
        <div className="loading-page">
          <Brand />
          <p>첫 두 페이지를 펼치고 있어요.</p>
        </div>
      ),
      index: (
        <div className="loading-page">
          <Brand />
          <p>이야기를 펼치는 중이에요.</p>
        </div>
      ),
    }[
      page as Exclude<
        typeof page,
        | "login"
        | "signup"
        | "email"
        | "code"
        | "signup-password"
        | "recover"
        | "recover-sent"
      >
    ]
  );
  const showHeader =
      !auth.has(page) && !["reader", "trial", "index"].includes(page),
    showNav = [
      "home",
      "search",
      "library",
      "settings",
      "highlights",
      "book",
      "complete",
      "discover",
    ].includes(page);
  return (
    <div className={"app-shell " + (page === "reader" ? "reading" : "")}>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      {showHeader && <Header />}
      {storageError && (
        <p className="storage-warning" role="alert">
          저장된 기록을 불러오거나 새 기록을 저장하는 데 문제가 있어요. 기존
          데이터는 보관했어요.
        </p>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          auth.has(page)
            ? "auth-main"
            : showNav
              ? "content with-nav"
              : "content"
        }
      >
        {content}
      </main>
      {showNav && <BottomNav />}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="error-page">
        <h1>화면을 다시 열어주세요.</h1>
        <p>저장한 독서 기록은 그대로 남아 있어요.</p>
        <button onClick={() => (window.location.href = "home.html")}>
          오늘 읽기로
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export function App({
  initialLocation,
  initialState,
}: {
  initialLocation?: Location;
  initialState?: State;
}) {
  return (
    <ErrorBoundary>
      <AppProvider
        initialLocation={initialLocation}
        initialState={initialState}
      >
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
