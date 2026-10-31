import { useEffect, useRef, useState, type ReactNode } from "react";
import { byId, availableBooks } from "../domain/catalog";
import { addHighlight, readPages } from "../domain/reading";
import { useApp, useReadingClock } from "../state/AppContext";
import { Button, Empty, Icon } from "../components/UI";
import type { Highlight } from "../domain/types";
export function ReaderPage() {
  const {
      state,
      update,
      next,
      pause,
      go,
      start,
      resume,
      ready,
      location,
      notify,
    } = useApp(),
    a = state.active,
    b = a && byId.get(a.id),
    textRef = useRef<HTMLDivElement>(null),
    [draft, setDraft] = useState<Highlight | null>(null);
  useReadingClock();
  useEffect(() => {
    setDraft(null);
    if (a?.scrollY) window.scrollTo(0, a.scrollY);
  }, [a?.id, a?.cursor]);
  useEffect(() => {
    if (!ready || location.page !== "reader") return;
    const chosen = byId.get(location.book || "");
    if (chosen?.available && state.active?.id !== chosen.id) {
      if (state.progress[chosen.id] && !state.progress[chosen.id].completed)
        resume(chosen.id);
      else start(chosen.id, 0, "book");
    }
  }, [ready, location.book]);
  useEffect(() => {
    if (!a) return;
    let timer: ReturnType<typeof setTimeout>;
    const savePosition = () => {
      const y = window.scrollY;
      update((s) => {
        if (!s.active) return s;
        const current = { ...s.active, scrollY: y };
        return {
          ...s,
          active: current,
          progress: { ...s.progress, [current.id]: current },
        };
      });
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(savePosition, 160);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", savePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [a?.id, a?.cursor]);
  if (!a || !b?.available)
    return (
      <Empty title="책 한 장을 펼쳐볼까요?">
        <Button onClick={() => start(availableBooks[0].id, 0)}>
          첫 페이지 읽기
        </Button>
      </Empty>
    );
  const text = b.parts[a.cursor],
    marks = state.highlights
      .filter(
        (h) =>
          h.bookId === b.id &&
          h.edition === b.edition &&
          h.index === a.cursor &&
          text.slice(h.start, h.end) === h.text,
      )
      .sort((x, y) => x.start - y.start);
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const mark of marks) {
    nodes.push(
      text.slice(offset, mark.start),
      <mark key={mark.id} title="저장한 문장">
        {mark.text}
      </mark>,
    );
    offset = mark.end;
  }
  nodes.push(text.slice(offset));
  const select = () => {
    const selection = window.getSelection(),
      root = textRef.current;
    if (!selection?.rangeCount || selection.isCollapsed || !root) {
      setDraft(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      setDraft(null);
      return;
    }
    const before = range.cloneRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const startOffset = before.toString().length,
      end = startOffset + range.toString().length,
      selected = text.slice(startOffset, end);
    setDraft(
      selected.trim()
        ? {
            id: crypto.randomUUID(),
            bookId: b.id,
            edition: b.edition,
            index: a.cursor,
            start: startOffset,
            end,
            text: selected,
          }
        : null,
    );
  };
  const saveMark = () => {
    if (!draft) return;
    const updated = addHighlight(state, draft);
    update(() => updated);
    setDraft(null);
    window.getSelection()?.removeAllRanges();
    notify(
      updated === state
        ? "이미 표시한 문장과 겹쳐요."
        : "문장을 책장에 담았어요.",
    );
  };
  return (
    <section className={"reader-page" + (state.fontLarge ? " large-type" : "")}>
      <div className="reader-top">
        <button
          className="icon-button"
          onClick={a.mode === "trial" ? () => go("login") : pause}
          aria-label={
            a.mode === "trial" ? "로그인" : "읽던 위치 저장하고 나가기"
          }
        >
          <Icon name={a.mode === "trial" ? "user" : "back"} />
        </button>
        <div>
          <strong>{b.book}</strong>
          <small>
            {a.mode === "trial"
              ? "먼저 두 페이지"
              : `${a.cursor - a.start + 1} / ${a.end - a.start} 페이지`}
          </small>
        </div>
        <button
          className="icon-button"
          aria-label="본문 글자 크기 바꾸기"
          aria-pressed={state.fontLarge}
          onClick={() => update((s) => ({ ...s, fontLarge: !s.fontLarge }))}
        >
          <Icon name="type" />
        </button>
      </div>
      <div className="reader-meta">
        <span>
          {b.author} · {b.editionLabel}
        </span>
        <span>
          {a.cursor + 1} / {b.totalPages}쪽
        </span>
      </div>
      <article
        className="reader-paper"
        aria-label={`${b.book} ${a.cursor + 1}쪽`}
      >
        <div
          className="reader-text"
          tabIndex={0}
          ref={textRef}
          onPointerUp={select}
          onKeyUp={select}
        >
          {nodes}
        </div>
        <span className="page-number">{a.cursor + 1}</span>
      </article>
      <div className="reader-bottom">
        <p className="tiny muted">
          마음에 남는 문장을 선택해 형광펜으로 표시하세요.
        </p>
        <button className="text-button" onClick={() => go("source", b.id)}>
          판본과 출처 보기 ↗
        </button>
        <Button
          onClick={() => {
            setDraft(null);
            next();
          }}
        >
          {a.cursor + 1 === a.end
            ? a.mode === "trial"
              ? "첫 두 장을 읽었어요"
              : "오늘 분량 읽었어요"
            : "읽고 다음 페이지"}
          <Icon name="arrow" />
        </Button>
        <p className="reading-note">
          읽은 페이지 {readPages(state, b).size} / {b.totalPages}
        </p>
        {a.mode !== "trial" && (
          <button className="text-button centered" onClick={pause}>
            읽던 곳 저장하고 나가기
          </button>
        )}
      </div>
      {draft && (
        <div
          className="selection-toolbar"
          role="toolbar"
          aria-label="선택한 문장"
        >
          <button onPointerDown={(e) => e.preventDefault()} onClick={saveMark}>
            <Icon name="highlight" />
            형광펜
          </button>
          <button aria-label="문장 선택 닫기" onClick={() => setDraft(null)}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </section>
  );
}
