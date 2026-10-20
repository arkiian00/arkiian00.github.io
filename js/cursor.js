/**
 * Glass cursor (Figma 187:460 "Mouse")
 *
 * property:
 *   default — 12px glass dot only (현재 사용)
 *   click   — dot + "Click" 라벨   (Figma: mouse-click)
 *   scroll  — dot + "Scroll" 라벨  (Figma: Scroll)
 *   view    — dot + "View" 라벨    (Figma: view)
 *
 * 사용법 (필요할 때 연결):
 *   GlassCursor.set('view')       // 직접 전환
 *   <a data-cursor="view">…</a>   // 요소 hover 시 자동 전환
 */
(function () {
  const LABELS = { click: "Click", scroll: "Scroll", view: "View" };
  const DOT_CENTER = 16; // padding 10 + dot 12/2

  const el = document.getElementById("cursor");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!el || !finePointer) {
    window.GlassCursor = { set() {}, mouse: null };
    return;
  }
  document.body.classList.add("has-cursor");

  const text = el.querySelector(".cursor__text");
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
  const pos = { x: mouse.x, y: mouse.y };
  let state = "default";

  function set(next) {
    next = LABELS[next] ? next : "default";
    if (next === state) return;
    state = next;
    el.dataset.state = next;
    if (LABELS[next]) text.textContent = LABELS[next];
  }

  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!mouse.inside) {
      mouse.inside = true;
      pos.x = mouse.x;
      pos.y = mouse.y;
      el.classList.add("is-visible");
    }
  }, { passive: true });

  document.addEventListener("pointerleave", () => {
    mouse.inside = false;
    el.classList.remove("is-visible");
  });
  addEventListener("blur", () => el.classList.remove("is-visible"));
  addEventListener("pointerdown", () => el.classList.add("is-pressed"));
  addEventListener("pointerup", () => el.classList.remove("is-pressed"));

  // data-cursor 속성을 가진 요소 위에서 자동 전환
  //  처음 화면(히어로 · 프로젝트 · About)에서는 기본 모양(동그란 방울)만 — 상세 페이지에서만 Click/View 등으로 바뀜
  //  상세 페이지 푸터(Next 목록 · 올리브 푸터)에서도 기본 모양만
  const FOOT = "#nextGroup, #foot";
  const inFoot = (t) => document.body.classList.contains("foot-down") || !!(t && t.closest && t.closest(FOOT));
  document.addEventListener("pointerover", (e) => {
    if (!document.body.classList.contains("is-detail") || inFoot(e.target)) { set("default"); return; }
    const target = e.target.closest && e.target.closest("[data-cursor]");
    set(target ? target.dataset.cursor : "default");
  });

  // 커서를 움직이지 않아도 푸터가 덮이면 바로 기본 모양으로
  new MutationObserver(() => { if (document.body.classList.contains("foot-down")) set("default"); })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // background.js 보다 먼저 등록되므로 매 프레임 WebGL 굴절보다 먼저 위치가 갱신됨
  function update() {
    requestAnimationFrame(update);
    pos.x += (mouse.x - pos.x) * 0.35;
    pos.y += (mouse.y - pos.y) * 0.35;
    el.style.transform = `translate3d(${pos.x - DOT_CENTER}px, ${pos.y - DOT_CENTER}px, 0)`;
  }

  requestAnimationFrame(update);
  window.GlassCursor = { set, mouse, get state() { return state; } };
})();
