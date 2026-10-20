/**
 * 비밀번호로 잠근 프로젝트 (Figma 333:8060 loding page) — RealWorld X Catch Teenieping
 *
 *  로딩 화면에서 바가 가운데로 내려오면(js/detail.js) 상세 페이지로 가기 전에 여기로:
 *   1) 바가 Hello 분리(js/archive/split-hello.js)와 같은 모션으로 위 · 아래 두 바로 갈라짐
 *      — 붙은 채 쥬욱 늘어나다 목이 끊어지며 도잉 (몸체는 액체 레이어 #splitGoo 가 그림)
 *      — 글자: 위 바 RealWorld X Catch Teenieping → 같은 이름, 아래 바 → 자물쇠 아이콘 (상하 회전 + 물결 왜곡)
 *   2) 갈라지면 누르지 않아도 위 바 왼쪽에서 화살표 방울이 끈적하게 떨어져 나옴 (상세 페이지 되돌아가기 방울과 같은 모양)
 *      — 화면 폭 462 미만(바가 비율로 줄어드는 구간)에서는 바가 328 로 줄며 같은 402 자리 안에서 갈라짐
 *   3) 자물쇠 바를 누르면 비밀번호 입력 → 맞으면 두 바 · 방울이 다시 하나로 합쳐지고 원래대로 상세 페이지로
 *      화살표를 누르면 프로젝트 목록으로 돌아감
 *  주의: 브라우저 안에서 확인하는 잠금이라 진짜 보안은 아님 (페이지 파일 자체는 서버에서 그대로 받을 수 있음)
 */
(() => {
  const PASSWORD = "lia";
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const bez = (x1, y1, x2, y2) => (t) => {
    let u = t;
    for (let i = 0; i < 6; i++) {
      const cx = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3 - t;
      const dx = 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u * u;
      if (Math.abs(dx) < 1e-6) break;
      u = Math.min(Math.max(u - cx / dx, 0), 1);
    }
    return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
  };
  const easeOutGoo = bez(0.22, 1, 0.36, 1);
  const setT = (el, t) => { if (el._t !== t) { el.style.transform = t; el._t = t; } };

  // split-hello 와 같은 값 (위 바는 위로, 아래 바는 아래로 — 두 바 묶음이 화면 가운데: 52 + 10 + 52)
  const BAR_W = 402, BAR_H = 52, GAP_Y = 10;
  const TOP_Y = -(BAR_H + GAP_Y) / 2, BOTTOM_Y = (BAR_H + GAP_Y) / 2;
  const STRETCH = { stiffness: 0.018, damping: 0.3, mass: 1.8 };
  const SNAP = { stiffness: 0.07, damping: 0.14, mass: 1.1 };
  const TAIL = { stiffness: 0.06, damping: 0.16, mass: 1 };
  const STRETCH_TOP = -4, STRETCH_BOTTOM = 14, SNAP_GAP = 26;
  const ROLL_DELAY = 0.12, ROLL_DUR = 1.0;
  // 화살표 방울 (상세 페이지 되돌아가기 방울과 같은 값)
  const BUB_W = 54, BUB_GAP = 20, BUB_START = 20, OUT_MS = 550, NECK_MS = 240;
  const PAD = 120;                                   // 액체 레이어 여백

  // 기업 협업 자료라 들어갈 때마다 묻기 (한 번 맞혀도 기억하지 않음)
  const ok = () => false;
  // 그림자 multiply 색: 잠금 화면 배경(프로젝트 대표 색) × #C1C1C1 — 바 그림자 · 액체 몸체 그림자 모두
  const mulOf = (hex) => { const n = parseInt(hex.slice(1), 16), m = (v) => Math.round((v * 193) / 255); return `${m(n >> 16)} ${m((n >> 8) & 255)} ${m(n & 255)}`; };
  // 액체 몸체 필터: #splitGoo 를 복제해 그림자 색만 이 화면의 multiply 색으로
  function gooFilter(mul) {
    let f = document.getElementById("lockGoo");
    if (!f) {
      const src = document.getElementById("splitGoo");
      if (!src) return "url(#splitGoo)";
      f = src.cloneNode(true);
      f.id = "lockGoo";
      src.parentNode.appendChild(f);
    }
    for (const fl of f.querySelectorAll("feFlood")) if (/shadow-mul/.test(fl.getAttribute("style") || "") || fl.dataset.mul) { fl.dataset.mul = "1"; fl.setAttribute("style", `flood-color: rgb(${mul})`); }
    return "url(#lockGoo)";
  }

  let gate = null;

  function build(title, color) {
    const wrap = document.createElement("div");
    wrap.className = "lockgate";
    wrap.style.color = color;
    wrap.innerHTML = `
      <div class="lockgate__box">
        <div class="lockgate__goo" aria-hidden="true">
          <div class="lockgate__blob" data-b="top"></div>
          <div class="lockgate__blob" data-b="bot"></div>
          <div class="lockgate__blob lockgate__blob--bub" data-b="bub"></div>
          <div class="lockgate__neck" data-n="v"></div>
          <div class="lockgate__neck" data-n="t1"></div>
          <div class="lockgate__neck" data-n="t2"></div>
          <div class="lockgate__neck" data-n="h"></div>
        </div>
        <div class="lockgate__bar is-liquid" data-bar="top"><span class="lockgate__label"><span class="roll" data-dir="-1"><span class="roll__w roll__old"></span><span class="roll__w roll__new"></span></span></span></div>
        <button class="lockgate__bar is-liquid" type="button" data-bar="bot" aria-label="비밀번호 입력">
          <span class="lockgate__label"><span class="roll" data-dir="1"><span class="roll__w roll__old"></span><span class="roll__w roll__new"><span class="lockgate__lock" aria-hidden="true"></span></span></span></span>
          <input class="lockgate__input" type="password" autocomplete="off" spellcheck="false" placeholder="Password" aria-label="비밀번호" tabindex="-1">
        </button>
        <a class="lockgate__bub is-liquid" href="#back" aria-label="프로젝트 목록으로"><span class="lockgate__arrow"><span class="lockgate__ico"></span></span></a>
      </div>`;
    const $ = (s) => wrap.querySelector(s);
    const g = {
      wrap, box: $(".lockgate__box"), goo: $(".lockgate__goo"),
      bTop: $('[data-b="top"]'), bBot: $('[data-b="bot"]'), bBub: $('[data-b="bub"]'),
      nV: $('[data-n="v"]'), t1: $('[data-n="t1"]'), t2: $('[data-n="t2"]'), nH: $('[data-n="h"]'),
      top: $('[data-bar="top"]'), bot: $('[data-bar="bot"]'), bub: $(".lockgate__bub"), input: $(".lockgate__input"),
    };
    g.top.querySelector(".roll__old").textContent = title;
    g.top.querySelector(".roll__new").textContent = title;
    g.bot.querySelector(".roll__old").textContent = title;
    return g;
  }

  // 화면 폭 462 미만이면 바가 줄어드는 구간 — 방울은 같은 402 자리 안에서 (바 → 328)
  const narrow = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dk")) || 1) < 1;

  // 바 · 방울 자리 (상자 기준) — y: 바 가운데 위치, topW: 위 바 폭 (오른쪽 끝 고정)
  function place(g, s) {
    const goo = (el, x, y, w, sx = 1, sy = 1) => setT(el, `translate3d(${(PAD + x).toFixed(2)}px, ${(PAD + y).toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`) || (el.style.width = `${w.toFixed(2)}px`);
    const left = BAR_W - s.topW;
    goo(g.bTop, left, s.yTop, s.topW, s.tsx, s.tsy);
    goo(g.bBot, 0, s.yBot, BAR_W, s.bsx, s.bsy);
    goo(g.bBub, s.bx, s.yTop, BUB_W, 1 + s.bsq, 1 - s.bsq * 0.5);
    setT(g.top, `translate3d(${left.toFixed(2)}px, ${s.yTop.toFixed(2)}px, 0) scale(${s.tsx.toFixed(4)}, ${s.tsy.toFixed(4)})`);
    g.top.style.width = `${s.topW.toFixed(2)}px`;
    setT(g.bot, `translate3d(0, ${s.yBot.toFixed(2)}px, 0) scale(${s.bsx.toFixed(4)}, ${s.bsy.toFixed(4)})`);
    setT(g.bub, `translate3d(${s.bx.toFixed(2)}px, ${s.yTop.toFixed(2)}px, 0) scale(${(1 + s.bsq).toFixed(4)}, ${(1 - s.bsq * 0.5).toFixed(4)})`);
  }
  // 목 · 꼬리: 지름 100 원을 scale 로 (split-hello 와 같은 방식)
  function blobAt(el, cx, cy, w, h) {
    setT(el, w < 0.5 || h < 0.5 ? "scale(0)"
      : `translate3d(${(PAD + cx - 50).toFixed(1)}px, ${(PAD + cy - 50).toFixed(1)}px, 0) scale(${(w / 100).toFixed(3)}, ${(h / 100).toFixed(3)})`);
  }

  function show({ bar, title, color, bg, onUnlock, onBack }) {
    if (ok()) { onUnlock(); return; }
    const g = (gate = build(title, color || getComputedStyle(bar).color));
    if (bg) { const mul = mulOf(bg); g.wrap.style.setProperty("--lg-mul", mul); g.goo.style.filter = gooFilter(mul); }
    document.body.appendChild(g.wrap);
    bar.style.visibility = "hidden";                   // 같은 자리 · 모양의 위 바가 이어받음
    const NR = narrow();
    g.box.classList.toggle("is-narrow", NR);               // 좁은 화면: 위 바가 328 로 줄어드는 만큼 이름 글자도 맞춰 줄임
    const s = { yTop: 0, yBot: 0, topW: BAR_W, tsx: 1, tsy: 1, bsx: 1, bsy: 1, bx: BUB_START, bsq: 0 };
    place(g, s);
    const top = { y: 0, v: 0 }, bot = { y: 0, v: 0 };
    const tails = [{ off: 0, v: 0 }, { off: 0, v: 0 }];
    let phase = "stretch", neckK = 1, bodyDone = false, rollDone = false;
    let bubAt = 0, bubSnap = false, bubK = 1, tN = 0;
    const FINAL_X = NR ? 0 : -(BUB_GAP + BUB_W), TOP_W1 = NR ? BAR_W - BUB_GAP - BUB_W : BAR_W;
    const rolls = [g.top.querySelector(".roll"), g.bot.querySelector(".roll")];
    const warp = document.getElementById("warpDisp");
    const t0 = performance.now();
    g.bBub.style.opacity = "0";

    function step(now) {
      if (gate !== g) return;
      const t = (now - t0) / 1000;
      // ---- 1) 위 · 아래로 갈라짐 (split-hello) ----
      if (!bodyDone) {
        const snapped = phase === "snap";
        const P = snapped ? SNAP : STRETCH;
        for (const [b, target] of [[top, snapped ? TOP_Y : STRETCH_TOP], [bot, snapped ? BOTTOM_Y : STRETCH_BOTTOM]]) {
          b.v += (P.stiffness * (target - b.y) - P.damping * b.v) / P.mass;
          b.y += b.v;
        }
        const gap = bot.y - top.y;
        if (!snapped && (gap >= SNAP_GAP || t > 0.75)) {
          phase = "snap";
          tails[0].off = gap * 0.45; tails[1].off = -gap * 0.45;
        }
        neckK = phase === "snap" ? neckK * 0.72 : 1 - 0.65 * clamp01(gap / SNAP_GAP);
        blobAt(g.nV, BAR_W / 2, BAR_H / 2 + (top.y + bot.y) / 2, BAR_W * 0.62 * neckK, gap + 34);
        for (const [i, b, el, edge] of [[0, top, g.t1, BAR_H / 2], [1, bot, g.t2, -BAR_H / 2]]) {
          const T = tails[i];
          if (phase === "snap") { T.v += (TAIL.stiffness * (0 - T.off) - TAIL.damping * T.v) / TAIL.mass; T.off += T.v; }
          const r = phase === "snap" ? Math.min(6 + Math.abs(T.off) * 0.9, 22) * clamp01(Math.abs(T.off) / 2) : 0;
          blobAt(el, BAR_W / 2, BAR_H / 2 + b.y + edge * 0.7 + T.off, r, r * 1.25);
        }
        const sq = (b) => phase === "snap" ? Math.max(Math.min(b.v * Math.sign(b.y) * 0.02, 0.14), -0.1) : 0.08 * clamp01(gap / SNAP_GAP);
        const st = sq(top), sb = sq(bot);
        s.yTop = top.y; s.yBot = bot.y; s.tsx = 1 - st * 0.5; s.tsy = 1 + st; s.bsx = 1 - sb * 0.5; s.bsy = 1 + sb;
        if (phase === "snap" && t > 1.2 && Math.abs(top.v) + Math.abs(bot.v) + Math.abs(tails[0].v) + Math.abs(tails[1].v) < 0.03 &&
            Math.abs(top.y - TOP_Y) + Math.abs(bot.y - BOTTOM_Y) < 0.3) {
          s.yTop = TOP_Y; s.yBot = BOTTOM_Y; s.tsx = s.tsy = s.bsx = s.bsy = 1;
          blobAt(g.nV, 0, 0, 0, 0); blobAt(g.t1, 0, 0, 0, 0); blobAt(g.t2, 0, 0, 0, 0);
          g.bot.classList.remove("is-liquid");
          bodyDone = true;
        }
        // 갈라지는 끝 무렵(목이 끊긴 뒤) 누르지 않아도 방울이 나오기 시작
        if (phase === "snap" && !bubAt && t > 1.0) { bubAt = now; g.bBub.style.opacity = ""; }
      }
      // ---- 2) 화살표 방울: 위 바 왼쪽 안쪽에서 끈적하게 끌려 나옴 (좁은 화면은 바가 328 로 줄며 그 자리에서) ----
      if (bubAt) {
        const k = clamp01((now - bubAt) / OUT_MS), e = easeOutGoo(k);
        s.bx = BUB_START + (FINAL_X - BUB_START) * e;
        s.topW = BAR_W + (TOP_W1 - BAR_W) * e;
        s.bsq = k < 1 ? 0.12 * Math.sin(Math.PI * k) : 0;
        const gapH = (BAR_W - s.topW) - (s.bx + BUB_W);             // 위 바 왼쪽 끝 ~ 방울 오른쪽 끝
        if (!bubSnap) {
          if (gapH >= 0 && !tN) tN = now;
          bubK = tN ? 1 - clamp01((now - tN) / NECK_MS) : 1;
          if (bubK <= 0) { bubSnap = true; g.bub.classList.add("is-arrow"); }
        }
        const nw = Math.max(gapH, 0) + 28, nh = BAR_H * (bubSnap ? 0 : 0.35 + 0.55 * bubK);
        blobAt(g.nH, s.bx + BUB_W + Math.max(gapH, 0) / 2, s.yTop + BAR_H / 2, bubSnap ? 0 : nw, nh);
        if (k >= 1 && bubSnap && bodyDone) {
          g.top.classList.remove("is-liquid");
          g.bub.classList.remove("is-liquid");
          g.goo.classList.add("is-done");
          g.ready = true;
        }
      }
      place(g, s);
      // ---- 글자: 상하 회전 + 물결 왜곡 (위 바 이름 → 같은 이름, 아래 바 이름 → 자물쇠) ----
      if (!rollDone) {
        const r = clamp01((t - ROLL_DELAY) / ROLL_DUR), e = easeInOut(r), bend = Math.sin(Math.PI * e);
        const settle = Math.sin(Math.PI * clamp01((r - 0.72) / 0.28)) * (1 - r) * 4;
        for (const roll of rolls) {
          const sgn = roll.dataset.dir === "-1" ? 1 : -1;
          const [oldW, newW] = roll.children;
          const sy = 1 + 0.55 * bend;
          setT(oldW, `rotateX(${(sgn * 90 * e).toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
          setT(newW, `rotateX(${(-sgn * (90 * (1 - e) - 10 * settle)).toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
        }
        if (warp) warp.setAttribute("scale", (22 * bend).toFixed(2));
        if (r >= 1) {
          for (const roll of rolls) { setT(roll.children[0], "rotateX(90deg)"); setT(roll.children[1], "none"); }
          if (warp) warp.setAttribute("scale", "0");
          rollDone = true;
        }
      }
      if (!(g.ready && rollDone)) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    // 자물쇠 바 → 비밀번호 입력
    g.bot.addEventListener("click", () => {
      if (!g.ready || g.busy) return;
      g.bot.classList.add("is-typing");
      g.input.tabIndex = 0;
      g.input.value = "";
      g.input.focus();
    });
    g.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { g.bot.classList.remove("is-typing"); g.input.blur(); return; }
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (g.input.value.trim().toLowerCase() === PASSWORD) {
        g.busy = true;
        g.input.blur();
        g.bot.classList.add("is-open");
        merge(g, s, () => { bar.style.visibility = ""; finish(g); onUnlock(); });
      } else {
        g.bot.animate([{ translate: "0 0" }, { translate: "-8px 0" }, { translate: "7px 0" }, { translate: "-4px 0" }, { translate: "0 0" }],
          { duration: 380, easing: "ease-out" });
        g.input.value = "";
      }
    });
    // 화살표 → 프로젝트 목록
    g.bub.addEventListener("click", (e) => {
      e.preventDefault();
      if (!g.ready || g.busy) return;
      g.busy = true;
      g.wrap.classList.add("is-leaving");
      setTimeout(() => finish(g), 450);
      onBack();
    });
  }

  // 맞으면: 방울 · 아래 바가 다시 위 바 하나로 합쳐짐 (액체 레이어로) → 가운데 원래 자리에서 로딩 바가 이어받음
  function merge(g, s, done) {
    for (const el of [g.top, g.bot, g.bub]) el.classList.add("is-liquid");
    g.top.classList.add("is-merging");                      // 이름 글자도 원래 크기로 (로딩 바와 같은 모습으로 이어받게)
    g.bub.classList.remove("is-arrow");
    g.bot.classList.remove("is-typing");
    g.goo.classList.remove("is-done");
    const from = { ...s }, t0 = performance.now(), MS = 700;
    const step = (now) => {
      const k = clamp01((now - t0) / MS), e = easeInOut(k);
      s.yTop = from.yTop * (1 - e); s.yBot = from.yBot * (1 - e);
      s.bx = from.bx + (BUB_START - from.bx) * e;
      s.topW = from.topW + (BAR_W - from.topW) * e;
      const sw = Math.sin(Math.PI * k) * 0.06;                  // 합쳐지며 살짝 출렁
      s.tsx = s.bsx = 1 + sw * 0.5; s.tsy = s.bsy = 1 - sw;
      blobAt(g.nV, BAR_W / 2, BAR_H / 2 + (s.yTop + s.yBot) / 2, BAR_W * 0.62 * e, Math.max(s.yBot - s.yTop, 0) + 34);
      g.bot.style.opacity = (1 - e).toFixed(3);
      g.bub.style.opacity = (1 - e).toFixed(3);
      place(g, s);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }
  function finish(g) {
    if (gate === g) gate = null;
    g.wrap.remove();
  }

  window.LockGate = { show, unlocked: ok };
})();
