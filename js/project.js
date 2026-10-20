/**
 * Project 클릭 → 프로젝트 화면 (Figma 187:520 → 187:308)
 *  1) Project 바가 가운데로 커지며 이동 (309.5 → 402, 20px → 26px = 1.3배 균일 확대)
 *     나머지(AHYUN·About·portfoilo)는 흐려지며 가라앉음
 *  2) 0.3초 유지
 *  3) Project 바는 화면 맨 위 가운데로 올라가고, 바 아래에 작은 물방울이 맺혔다가
 *     목이 조여들며 '도잉' 떨어져 출렁이면서 목록 패널 모양으로 부풀어 오름 (메타볼 모핑)
 *     모핑 동안 바·방울 몸체는 #projGoo 액체 레이어가 그리고, 다 되면 실제 유리 패널로 교체
 *  프로젝트 화면은 디자인 영역(축소·세로 가운데) 밖의 고정 레이어 — 화면 맨 위 가운데, 폭 300~360px (360 미만에서는 전체 비율 축소)
 *  모든 움직임은 transform + requestAnimationFrame
 */
(function () {
  const stage = document.getElementById("stage");
  const barTop = document.getElementById("barTop");
  const proj = document.getElementById("proj");
  const pbar = document.getElementById("pbar");
  const plist = document.getElementById("plist");
  const goo = proj.querySelector(".proj__goo");
  const col = proj.querySelector(".proj__col");

  // 폭 300~402: 402 미만이면 높이·글자·카드까지 같은 비율로 축소 (Figma 187:325 — 바 402 × 52)
  const COL_W = 402, COL_MIN = 300;
  let ps = 1;
  // Hello 바와 같은 폭: 처음 화면(1200 디자인)과 같은 배율로 바·목록을 함께 축소, 바는 GNB 90 안 가운데
  function fit() {
    ps = Math.min(1, (innerWidth - 60) / 402);           // 폭 402 고정, 좁으면 좌우 30 여백으로 비율 축소
    col.style.setProperty("--ps", ps.toFixed(4));
    col.style.setProperty("--py", `${(45 - 45 * ps).toFixed(2)}px`);
  }
  addEventListener("resize", fit);
  fit();
  const blobBar = document.getElementById("pBlobBar");
  const blobList = document.getElementById("pBlobList");
  const LIST_H = 480;   // 카드 5개 (Figma 187:308)
  const HOLD_MS = 300;        // 가운데에서 머무는 시간

  const GROW = { stiffness: 0.05, damping: 0.3, mass: 1.2 };   // 가운데로 커지며 이동
  const RISE = { stiffness: 0.04, damping: 0.26, mass: 1.2 };  // 위로 올라감 (살짝 넘침)
  // 물방울 모핑: 맺힘(BEAD) → 떨어짐·출렁(DROP) → 패널로 부풂(SWELL)
  const BEAD_MS = 380;                                              // 바 아래에 맺혀 있는 시간
  const DROP = { stiffness: 0.05, damping: 0.14, mass: 1.1 };      // 아래로 '도잉' 떨어져 출렁
  const SWELL = { stiffness: 0.04, damping: 0.2, mass: 1.3 };      // 동그란 방울 → 패널 모양으로 부풂

  const step1D = (s, target, P) => {
    s.v += (P.stiffness * (target - s.x) - P.damping * s.v) / P.mass;
    s.x += s.v;
  };
  const setT = (el, t) => { if (el._t !== t) { el.style.transform = t; el._t = t; } };

  // ---- 목록이 나올 때 Project 글자 회전: 위로 굴러 같은 글자로 (세로 늘어남·왜곡). 버튼 몸체는 회전하지 않음 ----
  const SPIN_MS = 750;
  const spinEase = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let spinAt = null;
  const pbarLabel = pbar.querySelector(".pbar__label");
  function startSpin() {
    spinAt = performance.now();
    pbarLabel.style.transformOrigin = "50% 50% -10px";
    pbarLabel.style.filter = "url(#warpText)";
  }
  function endSpin() {
    if (spinAt === null) return;
    spinAt = null;
    setT(pbarLabel, "none");
    pbarLabel.style.filter = "";
    pbarLabel.style.transformOrigin = "";
    document.getElementById("warpDisp").setAttribute("scale", "0");
  }
  // 매 프레임: 글자를 돌리고, 몸체 방울에 덧붙일 회전을 돌려줌
  function spinTick(now) {
    if (spinAt === null) return "";
    const r = Math.min(Math.max((now - spinAt) / SPIN_MS, 0), 1);
    const e = spinEase(r);
    const bend = Math.sin(Math.PI * e);
    const settle = Math.sin(Math.PI * Math.min(Math.max((r - 0.72) / 0.28, 0), 1)) * (1 - r) * 4;
    const sy = 1 + 0.55 * bend;
    const pa = e < 0.5 ? 180 * e : -(180 * (1 - e) - 10 * settle);   // 위로 넘어갔다가 아래에서 같은 글자로
    setT(pbarLabel, `perspective(90px) rotateX(${pa.toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
    document.getElementById("warpDisp").setAttribute("scale", (22 * bend).toFixed(2));
    if (r >= 1) endSpin();
    return "";                                                       // 버튼 몸체는 회전하지 않음 (글자만)
  }

  let started = false;
  let state = "busy";          // "list" | "menu" | "busy" — Project 바 클릭으로 목록 ↔ About·Home 전환

  function go(e) {
    e.preventDefault();
    if (started) return;
    started = true;
    window.glassLock && window.glassLock(true);          // 목록이 나오는 동안 호버 효과 꺼 둠

    proj.hidden = false;
    // 모든 위치는 pbar 의 최종 자리(화면 맨 위 가운데) 기준 transform 값
    setT(pbar, "none");
    const home = pbar.getBoundingClientRect();
    const from = barTop.getBoundingClientRect();          // 분리된 Project 바의 현재 화면 위치
    // 화면 px → 컬럼 안쪽 단위 (컬럼이 ps 배로 축소돼 있으므로 나눔)
    const fromX = (from.left - home.left) / ps;
    const fromY = (from.top - home.top) / ps;
    const fromS = from.width / home.width;                // 축소된 디자인 영역의 바 → 실제 크기
    const centerY = (innerHeight / 2 - home.height / 2 - home.top) / ps; // 187:520: 화면 가운데
    const LIST_W = plist.offsetWidth;
    setT(pbar, `translate3d(${fromX.toFixed(2)}px, ${fromY.toFixed(2)}px, 0) scale(${fromS.toFixed(4)})`);   // 첫 프레임 깜빡임 방지
    pbar.classList.add("is-from-split");
    stage.classList.add("is-project");
    window.IntroClose && window.IntroClose();            // AHYUN 은 푸터처럼 되감기로 물속에 가라앉으며 사라짐
    requestAnimationFrame(() => pbar.classList.remove("is-from-split"));   // 채움 60% → 20%

    const p = { x: 0, v: 0 };          // 0 → 1 : 분리 바 → 가운데 바
    const rise = { x: 0, v: 0 };       // 0 → 1 : 가운데 → 위
    const size = { x: 0, v: 0 };       // 방울 지름 (px): 0 → 56(맺힘) → 패널
    const pos = { x: -44, v: 0 };      // 패널 위쪽 기준 방울 위치 (px): 바 밑에 붙음 → 0
    const swell = { x: 0, v: 0 };        // 0 → 1 : 동그란 방울 → 패널
    let phase = 1, phaseAt = performance.now(), dripping = false, dripAt = 0, listed = false;

    function frame(now) {
      const t = (now - phaseAt) / 1000;

      if (phase === 1) {
        step1D(p, 1, GROW);
        if (t > 0.9 && Math.abs(p.v) < 0.002) { p.x = 1; phase = 2; phaseAt = now; }
      } else if (phase === 2) {
        if (now - phaseAt >= HOLD_MS) { phase = 3; phaseAt = now; }
      } else if (phase === 3) {
        step1D(rise, 1, RISE);
        if (!dripping && rise.x > 0.82) {   // 거의 올라왔을 때 바 아래에 방울이 맺히기 시작
          dripping = true;
          dripAt = now;
          startSpin();                                      // 목록이 떨어지기 시작할 때 Project 버튼이 회전
          pbar.classList.add("is-liquid");
          plist.classList.add("is-liquid");
          goo.classList.add("is-on");
        }
      }

      // Project 바
      const k = p.x;
      const x = fromX * (1 - k);
      const y = fromY * (1 - k) + centerY * k - centerY * rise.x;
      const s = fromS + (1 - fromS) * k;
      const squash = Math.min(Math.abs(rise.v) * 0.25 + Math.abs(p.v) * 0.2, 0.08);  // 빠르게 움직일 때 세로로 늘어남
      setT(pbar, `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(s * (1 - squash * 0.5)).toFixed(4)}, ${(s * (1 + squash)).toFixed(4)})`);

      // ---- 물방울 모핑 (액체 레이어) ----
      if (dripping) {
        const dt = now - dripAt;
        const follow = (1 - rise.x) * centerY;                 // 바가 넘쳤다 돌아오는 만큼 같이 움직임
        // 바 몸체: pbar 와 같은 변형
        setT(blobBar, `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)${spinTick(now)}`);

        if (dt < BEAD_MS) {
          step1D(size, 56, SWELL);                             // 바 밑에 동그랗게 맺힘
          step1D(pos, -44, DROP);
        } else {
          step1D(pos, 0, DROP);                                // 툭 떨어져 출렁 → 목이 조여 끊어짐
          if (dt > BEAD_MS + 160) step1D(swell, 1, SWELL);     // 떨어지면서 패널 모양으로 부풂
          step1D(size, 56, SWELL);
        }
        const k = Math.max(swell.x, 0);
        // 떨어지는 속도만큼 세로로 늘어나는 물방울
        const fall = Math.max(Math.min(pos.v * 0.03, 0.35), -0.2) * (1 - Math.min(k, 1));
        const d = Math.max(size.x, 0);
        const w = d + (LIST_W - d) * k, h = d + (LIST_H - d) * k;
        const sx = (w / LIST_W) * (1 - fall * 0.5), sy = (h / LIST_H) * (1 + fall);
        const r = d / 2 + (20 - d / 2) * Math.min(k, 1);          // 원 → 둥근 사각형
        blobList.style.borderRadius = `${(r / sx).toFixed(1)}px / ${(r / sy).toFixed(1)}px`;
        // 가로 가운데 정렬 유지 (transform-origin: 50% 0)
        setT(blobList, `translate3d(0, ${(pos.x + follow).toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`);

        if (!listed && k > 0.97 && Math.abs(swell.v) < 0.004) {   // 출렁임이 거의 멈춘 뒤
          // 실제 유리 패널·카드로 교체
          listed = true;
          endSpin();
          setT(plist, `translate3d(0, ${follow.toFixed(2)}px, 0)`);
          plist.classList.remove("is-liquid");
          pbar.classList.remove("is-liquid");
          goo.classList.remove("is-on");
          plist.classList.add("is-in");
        }
        if (listed) setT(plist, `translate3d(0, ${follow.toFixed(2)}px, 0)`);
      }

      const settled = phase === 3 && listed &&
        Math.abs(rise.v) + Math.abs(swell.v) + Math.abs(pos.v) < 0.001 &&
        Math.abs(1 - rise.x) + Math.abs(1 - swell.x) + Math.abs(pos.x) < 0.01;
      if (settled) {
        setT(pbar, "none");
        setT(plist, "none");
        state = "list";
        window.glassLock && window.glassLock(false);
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  barTop.addEventListener("click", go);

  // ---- Figma 33:737: Project 바 클릭 → 목록이 사라지고 Hello 분리와 같은 효과로 Project → About → Home 이 갈라져 나옴 ----
  const pabout = document.getElementById("pabout");
  const phome = document.getElementById("phome");
  const SWAP_MS = 380;                                   // 목록·메뉴 페이드 시간 (CSS 와 맞춤)
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  // ===== Hello → Project/About 분리(split.js)와 같은 효과 (Figma 33:737) =====
  //  - 두 바가 액체 레이어(#gooFilter — 끊어진 뒤 12px 간격에서 다시 붙어 보이지 않도록 블러가 작은 필터)로
  //    목이 생겼다가 끊어지며 위아래로 분리
  //    쥬욱: 붙은 채 위 바는 위로, 아래 바는 아래로 무겁게 늘어남(세로로 길어짐) · 목이 가늘어짐
  //    도잉: 목이 끊어지는 순간 두 바가 튕기며 제자리, 끊어진 꼬리가 각 바로 빨려 들어가며 출렁
  //  - 글자: 상하 축 회전(rotateX) 중 세로로 늘어나며 물결치는(#warpText) 전환
  //  - Project → About 분리, 이어서 About → Home 분리
  //  이 인터랙션 동안 호버 유리 효과는 꺼 둠 (glassLock)
  const STEP = 72;                                                  // 바 52 + 간격 20
  const BAR_H = 52;
  // split.js 와 같은 값
  const SP_STRETCH = { stiffness: 0.018, damping: 0.3, mass: 1.8 };  // 쥬욱 — 끈적하게 천천히
  // 도잉: 끊어진 두 바가 서로 반대로 튕겨 제자리 — 서로 쪽으로는 넘치지 않게(다시 붙어 보이지 않게) 임계 감쇠,
  // 튕기는 느낌은 몸체가 속도만큼 늘었다 줄었다 하는 출렁임으로
  const SP_SNAP = { stiffness: 0.07, damping: 0.5, mass: 1.1 };
  const SP_TAIL = { stiffness: 0.06, damping: 0.16, mass: 1 };       // 끊어진 꼬리
  // 물방울 하나 → 둘: 아래 방울이 제자리보다 더 내려가 매달린 채 목이 실처럼 가늘어지다 끊어지고, 끊어지면 제자리로 튕겨 돌아옴
  const SP_UP = -8, SP_OVER = 16, SP_BREAK = 24;                      // 위 바가 끌려 올라가는 거리 · 아래 바가 더 내려가는 거리 · 목이 끊어지는 틈
  // 분리와 글자 회전이 동시에: 늘어나기 시작할 때 글자가 돌기 시작해 목이 끊어질 즈음 다 돎 (몸체는 회전 없이 도잉만)
  const SP_ROLL_DUR = 0.75;                                         // 초
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (v) => clamp(v, 0, 1);
  const warpDisp = document.getElementById("warpDisp");

  // 바에 지금 보이는 글자 (회전 글자면 펼쳐져 있는 쪽)
  function shownText(bar) {
    const roll = bar.querySelector(".roll");
    if (!roll) return bar.textContent.trim();
    const [a, b] = roll.children;
    return a.getBoundingClientRect().height >= b.getBoundingClientRect().height ? a.textContent : b.textContent;
  }

  // 한 쌍: 위 바(parent)와 아래 바(child)가 같은 자리에서 위아래로 갈라짐 — 좌표는 split.js 와 같이
  // top.y: 위 바(0 = 제자리), bot.y: 아래 바(0 = 위 바와 겹침, STEP = 제자리)
  function splitPair(o) {
    const { W, parentBlob, parentBar, childBlob, childBar, neck, tailT, tailB } = o;
    // 맨 위 바만 살짝 끌려 올라감 — 두 번째 분열의 위 바(About)는 바로 위 바(Project)와 다시 붙어 보이지 않게 제자리
    const pull = o.first ? SP_UP : 0;
    const NECK_CX = 60 + W / 2;                                     // 액체 레이어 안 바 가운데
    const NECK_CY = parentBlob.offsetTop + BAR_H / 2;
    const top = { y: 0, v: 0 }, bot = { y: 0, v: 0 };
    const tails = [{ off: 0, v: 0 }, { off: 0, v: 0 }];
    const [oldW, newW] = childBar.querySelector(".roll").children;
    // 위 바 글자도 같은 박자로 위로 굴러 한 바퀴 (같은 글자가 다시 나타남) — Hello 분리에서 두 글자가 함께 회전하듯
    const pLabel = parentBar.querySelector(".pbar__label") || parentBar.querySelector(".roll").parentElement;
    pLabel.style.transformOrigin = "50% 50% -10px";
    pLabel.style.filter = "url(#warpText)";
    // 아래 바 글자(About · Home)도 자기 글자 그대로, 위 바와 반대 방향(아래로)으로 같은 박자에 회전
    const cLabel = childBar.querySelector(".pbar__label");
    cLabel.style.transformOrigin = "50% 50% -10px";
    cLabel.style.filter = "url(#warpText)";
    const start = performance.now();
    let phase = "stretch", neckK = 1, bodyDone = false, rollDone = false, released = false, handed = false, snapAt = 0;
    for (const el of [parentBlob, childBlob, parentBar, childBar]) el.style.transformOrigin = "50% 50%";
    oldW.style.opacity = "0";                                       // 겹쳐 있을 땐 위 바 글자 하나로 보이도록

    function step(now) {
      const t = (now - start) / 1000;
      if (!bodyDone) {
        // ---- 물방울 분리: 쥬욱 늘어남 → 목 끊어짐 → 도잉 ----
        const snapped = phase === "snap";
        const P = snapped ? SP_SNAP : SP_STRETCH;
        for (const [b, target] of [[top, snapped ? 0 : pull], [bot, snapped ? STEP : STEP + SP_OVER]]) {
          b.v += (P.stiffness * (target - b.y) - P.damping * b.v) / P.mass;
          b.y += b.v;
        }
        if (released) { bot.y = STEP; bot.v = 0; }
        const gap = bot.y - top.y;                                  // 겹침 기준 거리 (0 = 한 방울)
        const g = gap - BAR_H;                                      // 두 몸체 사이 실제 틈 (음수 = 아직 한 덩어리)
        oldW.style.opacity = clamp01(gap / 30).toFixed(2);
        if (!snapped && (g >= SP_BREAK || t > 1.3)) {
          // 목이 끊어지는 순간: 각 바에 꼬리가 남아 가운데 쪽으로 늘어져 있음
          phase = "snap"; snapAt = now;
          tails[0].off = Math.max(g, 8) * 0.6;                      // 위 바의 꼬리는 아래로
          tails[1].off = -Math.max(g, 8) * 0.6;                     // 아래 바의 꼬리는 위로
        }
        // 목: 두 몸체가 벌어질수록 실처럼 가늘어지고(물방울이 떨어지기 직전), 끊어지면 순식간에 사라짐
        neckK = phase === "snap" ? neckK * 0.7 : 1 - 0.85 * clamp01(g / SP_BREAK);
        const nw = g <= -6 ? 0 : W * 0.6 * neckK, nh = Math.max(g, 0) + 30;
        const cy = NECK_CY + top.y + BAR_H / 2 + Math.max(g, 0) / 2;
        setT(neck, nw < 0.5 ? "scale(0)"
          : `translate3d(${(NECK_CX - 50).toFixed(1)}px, ${(cy - 50).toFixed(1)}px, 0) scale(${(nw / 100).toFixed(3)}, ${(nh / 100).toFixed(3)})`);
        // 꼬리: 끊어진 자리에서 바 쪽으로 빨려 들어가며 출렁
        for (const [i, b, el, edge] of [[0, top, tailT, BAR_H / 2], [1, bot, tailB, -BAR_H / 2]]) {
          const T = tails[i];
          if (phase === "snap") {
            T.v += (SP_TAIL.stiffness * (0 - T.off) - SP_TAIL.damping * T.v) / SP_TAIL.mass;
            T.off += T.v;
          }
          const r = phase === "snap" ? Math.min(6 + Math.abs(T.off) * 0.9, 22) * clamp01(Math.abs(T.off) / 2) : 0;
          const ty = NECK_CY + b.y + edge * 0.7 + T.off;
          setT(el, r < 0.5 ? "scale(0)"
            : `translate3d(${(NECK_CX - 50).toFixed(1)}px, ${(ty - 50).toFixed(1)}px, 0) scale(${(r / 50).toFixed(3)}, ${(r * 1.25 / 50).toFixed(3)})`);
        }
        // 바 몸체: 늘어날 땐 세로로 길어지고(쥬욱), 튕길 땐 속도만큼 늘었다 줄었다(도잉)
        for (const [b, blob, bar, base, sign] of [[top, parentBlob, parentBar, 0, -1], [bot, childBlob, childBar, -STEP, 1]]) {
          if (b === bot && released) continue;                      // 다음 쌍이 이어받은 아래 바는 건드리지 않음
          let sx, sy;
          if (phase === "snap") {
            // 끊어진 직후 말랑하게 출렁 (가로로 퍼졌다 세로로 모였다) — 세로로는 적게 늘어 틈이 좁아지지 않게
            const tau = (now - snapAt) / 1000;
            const w = 0.12 * Math.cos(tau * 18) * Math.exp(-tau * 3.5);
            sx = 1 + w * 0.5; sy = 1 - w * 0.35;
          } else {
            const sv = (b === top && !o.first) ? 0 : 0.08 * clamp01(gap / (STEP + SP_OVER));   // 쥬욱: 매달린 채 세로로 길어짐
            sx = 1 - sv * 0.5; sy = 1 + sv;
          }
          const tr = `translate3d(0, ${(b.y + base).toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
          // 몸체(물방울)는 회전하지 않고 늘어남·끊어짐·출렁임(도잉)만 — 회전은 글자만
          setT(blob, tr);
          setT(bar, tr);
        }
        // 아래 바가 거의 자리 잡으면 그 바에서 다음 분리를 시작
        if (!handed && phase === "snap" && now - snapAt > 220 && Math.abs(bot.v) < 0.8 && Math.abs(bot.y - STEP) < 4) {
          handed = true;
          if (o.next) {
            released = true;
            setT(childBlob, "translate3d(0, 0, 0)");
            setT(childBar, "translate3d(0, 0, 0)");
            o.next();
          }
        }
        if (phase === "snap" && now - snapAt > 900 && Math.abs(top.v) + Math.abs(bot.v) + Math.abs(tails[0].v) + Math.abs(tails[1].v) < 0.03 &&
            Math.abs(top.y) + Math.abs(bot.y - STEP) < 0.3) {
          setT(parentBlob, "translate3d(0, 0, 0)");
          setT(parentBar, "translate3d(0, 0, 0)");
          if (!released) { setT(childBlob, "translate3d(0, 0, 0)"); setT(childBar, "translate3d(0, 0, 0)"); }
          setT(neck, "scale(0)"); setT(tailT, "scale(0)"); setT(tailB, "scale(0)");
          bodyDone = true;
        }
      }
      // ---- 글자 전환: 상하 회전 + 세로 늘어남 + 왜곡 (아래 바는 아래로 굴러감) ----
      if (!rollDone) {
        const r = clamp01(t / SP_ROLL_DUR);
        const e = easeIO(r);
        const bend = Math.sin(Math.PI * e);                         // 회전 중간에 가장 크게 왜곡
        const settle = Math.sin(Math.PI * clamp01((r - 0.72) / 0.28)) * (1 - r) * 4;   // 제자리 직전 살짝 넘침
        const sy = 1 + 0.55 * bend;
        // 위 바: 위로 넘어가며 사라졌다가(0 → 90°) 아래에서 같은 글자로 올라옴(-90° → 0)
        const pa = e < 0.5 ? 180 * e : -(180 * (1 - e) - 10 * settle);
        setT(pLabel, `perspective(90px) rotateX(${pa.toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
        // 아래 바: 반대로 — 아래로 넘어가며 사라졌다가(0 → -90°) 위에서 같은 글자로 내려옴(90° → 0)
        setT(cLabel, `perspective(90px) rotateX(${(-pa).toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
        warpDisp.setAttribute("scale", (22 * bend).toFixed(2));
        if (r >= 1) {
          setT(oldW, "rotateX(90deg)");
          setT(newW, "none");
          for (const l of [pLabel, cLabel]) { setT(l, "none"); l.style.filter = ""; l.style.transformOrigin = ""; }
          warpDisp.setAttribute("scale", "0");
          rollDone = true;
        }
      }
      if (bodyDone && rollDone) { o.done && o.done(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // items: [{ blob, bar }] 위에서부터 — 첫 바는 맨 위 바(liquidBar)에서, 다음 바는 바로 위 바에서 갈라짐
  // necks: 쌍마다 [목, 위 꼬리, 아래 꼬리]
  function splitMenu({ goo: g, barBlob, liquidBar, liquidClass, items, necks, W, done }) {
    window.glassLock && window.glassLock(true);                     // 이 인터랙션 동안 호버 효과 꺼 둠
    // 같은 액체 레이어에 남아 있는 다른 몸체(처음 목록이 떨어질 때의 목록 패널 등)는 숨김 — 큰 박스로 보이지 않게
    const used = new Set([barBlob, ...items.map((it) => it.blob), ...necks.flat()]);
    for (const el of g.querySelectorAll(".proj__blob, .proj__neck")) {
      if (!used.has(el)) { setT(el, "scale(0)"); el.style.borderRadius = ""; }
    }
    for (const it of items) {
      setT(it.blob, "scale(0)");
      it.blob.style.borderRadius = "";
      it.bar.classList.remove("is-in");
      it.bar.classList.add("is-splitting");
      it.bar.style.visibility = "hidden";
      it.text = it.bar.dataset.label;
      const [oldW, newW] = it.bar.querySelector(".roll").children;
      for (const w of [oldW, newW]) { w.style.transform = ""; w._t = undefined; w.style.opacity = ""; }
      newW.textContent = it.text;
      const label = it.bar.querySelector(".pbar__label");
      label.style.opacity = "";
    }
    for (const n of necks.flat()) setT(n, "scale(0)");
    barBlob.style.borderRadius = "";
    setT(barBlob, "translate3d(0, 0, 0)");
    g.classList.add("is-on", "is-split");
    liquidBar.classList.add(liquidClass);

    let left = items.length;
    const fin = () => {
      if (--left) return;
      g.classList.remove("is-on", "is-split");
      liquidBar.classList.remove(liquidClass);
      for (const it of items) {
        it.bar.classList.remove("is-splitting");
        it.bar.classList.add("is-in");
        it.bar.style.transformOrigin = "";
        it.bar.style.transform = ""; it.bar._t = undefined;
        // 다음을 위해 글자 정리 (Home 은 돌아갈 때 Hello 로 굴러야 하므로 data-roll-next)
        const [oldW, newW] = it.bar.querySelector(".roll").children;
        oldW.textContent = it.text;
        for (const w of [oldW, newW]) { w.style.transform = ""; w._t = undefined; w.style.opacity = ""; }
        newW.textContent = it.bar.dataset.rollNext || it.text;
      }
      liquidBar.style.transformOrigin = "";
      liquidBar.style.transform = ""; liquidBar._t = undefined;
      window.glassLock && window.glassLock(false);
      done && done();
    };

    const run = (i) => {
      const it = items[i];
      const parent = i === 0 ? { blob: barBlob, bar: liquidBar } : items[i - 1];
      it.bar.querySelector(".roll").children[0].textContent = it.text;   // 자기 글자 그대로 회전
      setT(it.blob, `translate3d(0, ${-STEP}px, 0)`);              // 바로 위 바와 같은 자리에서 시작
      setT(it.bar, `translate3d(0, ${-STEP}px, 0)`);
      it.bar.style.visibility = "";
      splitPair({
        W, parentBlob: parent.blob, parentBar: parent.bar, childBlob: it.blob, childBar: it.bar,
        neck: necks[i][0], tailT: necks[i][1], tailB: necks[i][2], first: i === 0,
        next: i + 1 < items.length ? () => run(i + 1) : null,
        done: fin,
      });
    };
    run(0);
  }
  window.DripMenu = splitMenu;

  // Project 바를 눌러도 메뉴(About · Home)는 나오지 않음 — 링크 이동만 막음
  pbar.addEventListener("click", (e) => e.preventDefault());
  // ---- Home: Home 바가 글자를 왜곡 회전하며(Home → Hello) 천천히 처음의 Hello 자리·크기로 돌아감 ----
  // 다 돌아오면 같은 모습의 처음 화면으로 교체 (인트로·분리·목록 상태를 모두 처음으로, 새로고침 없음)
  const nav = document.getElementById("nav");
  const warp = document.getElementById("warpDisp");
  const HOME_MS = 2000;                                           // 천천히 돌아감
  const HOME_ROLL_DELAY = 0.25, HOME_ROLL_DUR = 1.6;              // 초
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // bar: 날아갈 Home 바 (transform-origin 0 0, 안에 .pbar__label > .roll), unit: 조상 축소 배율,
  // from: 바의 화면 위치(변형 전), onLand: 처음 Hello 자리에 닿은 순간 (같은 프레임에 화면 교체)
  function flyHome(bar, unit, from, onLand) {
    const label = bar.querySelector(".pbar__label");
    const roll = bar.querySelector(".roll");
    bar.style.background = "var(--glass-fill)";                 // 처음 Hello 의 채움(60%)
    const sr = stage.getBoundingClientRect();
    const s = sr.width / 1200;
    // 처음 화면의 Hello 자리 (스크롤 전 가운데 399, 374 — 열린 상태의 맨 위 자리가 아니라)
    const k1 = Math.min(1, (innerWidth - 60) / 402);           // 처음 Hello 의 보이는 배율 (402 고정 · 좁으면 축소)
    const tw = 402 * k1, th = 52 * k1;
    const tx = sr.left + 600 * s - tw / 2, ty = sr.top + 400 * s - th / 2;
    const dx = (tx - from.x) / unit, dy = (ty - from.y) / unit, sxT = tw / from.w, syT = th / from.h;
    const FONT0 = 26 * unit, FONT1 = 26 * k1, RAD0 = 20 * unit, RAD1 = 20 * k1;

    const [oldW, newW] = roll.children;
    const t0 = performance.now();
    let rollDone = false;

    function frame(now) {
      const t = (now - t0) / 1000;
      const q = clamp((now - t0) / HOME_MS, 0, 1);
      const k = easeInOut(q);
      const sx = 1 + (sxT - 1) * k, sy = 1 + (syT - 1) * k;
      setT(bar, `translate3d(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`);
      // 바는 가로세로 비율이 달라지므로 글자·모서리는 반대로 보정해 찌그러지지 않게
      const font = FONT0 + (FONT1 - FONT0) * k, rad = RAD0 + (RAD1 - RAD0) * k;
      setT(label, `scale(${(font / (FONT0 * sx)).toFixed(4)}, ${(font / (FONT0 * sy)).toFixed(4)})`);
      bar.style.borderRadius = `${(rad / (unit * sx)).toFixed(2)}px / ${(rad / (unit * sy)).toFixed(2)}px`;

      // 글자: Home 이 아래로 굴러 사라지고 Hello 가 위에서 굴러 들어옴 (회전 + 세로 늘어남 + 왜곡)
      if (!rollDone) {
        const r = clamp((t - HOME_ROLL_DELAY) / HOME_ROLL_DUR, 0, 1);
        const e = easeInOut(r);
        const bend = Math.sin(Math.PI * e);
        const settle = Math.sin(Math.PI * clamp((r - 0.72) / 0.28, 0, 1)) * (1 - r) * 4;
        const st = 1 + 0.55 * bend;
        setT(oldW, `rotateX(${(-90 * e).toFixed(2)}deg) scaleY(${st.toFixed(3)})`);
        setT(newW, `rotateX(${(90 * (1 - e) - 10 * settle).toFixed(2)}deg) scaleY(${st.toFixed(3)})`);
        warp.setAttribute("scale", (22 * bend).toFixed(2));
        if (r >= 1) {
          setT(oldW, "rotateX(90deg)");
          setT(newW, "none");
          warp.setAttribute("scale", "0");
          rollDone = true;
        }
      }

      if (rollDone && q >= 1) {
        onLand();
        // 날아온 바는 원래대로 (같은 작업 안에서 숨겨지므로 보이지 않음)
        for (const el of [bar, label, oldW, newW]) { el.style.transform = ""; el._t = undefined; }
        bar.style.background = "";
        bar.style.borderRadius = "";
        delete bar.dataset.noGlass;
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // 처음 화면의 모든 상태(인트로·분리·프로젝트 화면)를 처음으로
  function resetMain() {
    window.IntroReset && window.IntroReset();
    window.SplitNav && window.SplitNav.reset();
    resetProject();
  }


  // 상세 페이지에서 Project 를 누르면: 처음 화면을 거치지 않고 프로젝트 목록 화면을 바로 펼쳐 둠
  function showListDirect() {
    started = true;
    scrubOn = true;
    window.HeroToEnd && window.HeroToEnd();            // 스크롤 장면도 끝(프로젝트 화면)으로 — 위로 스크롤하면 되감김
    stage.classList.add("is-project");
    nav.style.opacity = "0";
    nav.style.pointerEvents = "none";
    proj.hidden = false;
    setT(pbar, "none");
    setT(plist, "none");
    pbar.classList.remove("is-liquid", "is-from-split");
    plist.classList.remove("is-liquid");
    // 목록이 툭 나타나지 않고, 스크롤로 나올 때와 같은 흐름을 한 번에 재생 (바 밑에 방울이 맺혀 '도잉' 떨어지고
    //  패널로 부풀어 → 실제 유리 패널 · 카드가 차례로 내려옴) — listPart(q) 의 q 0.3 → 1 을 시간으로
    plist.classList.remove("is-in");
    plist.style.transition = "none";
    for (const c of cards) c.style.transition = "none";
    plist.style.pointerEvents = "none";
    state = "busy";
    const t0 = performance.now(), DUR = 1300, Q0 = 0.3;
    let lastQ = Q0;
    const my = (showListDirect.gen = (showListDirect.gen || 0) + 1);
    listPart(Q0);
    const step = (now) => {
      if (my !== showListDirect.gen) return;
      const k = clamp01((now - t0) / DUR);
      const q = Q0 + (1 - Q0) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);   // 천천히 시작해 천천히 멈춤
      listPart(q, q - lastQ);
      lastQ = q;
      plist.style.pointerEvents = q >= LIST_LIVE ? "" : "none";
      if (k < 1) { requestAnimationFrame(step); return; }
      listPart(1);
      plist.style.transition = "";
      for (const c of cards) c.style.transition = "";
      plist.style.pointerEvents = "";
      state = "list";
    };
    requestAnimationFrame(step);
  }

  // ===== 스크롤 진행에 맞춰 프로젝트 화면이 나옴 / 거꾸로 들어감 (js/hero.js 가 q 를 줌) =====
  //  q 0 → 0.3   Hello 바 자리 → 프로젝트 바 자리, 글자는 위로 넘어가며 세로로 늘어나고 물결 왜곡(#warpText) → 'Project' 로 돌아옴
  //  q 0.3 → 0.85 바 밑에 방울이 맺혀(BEAD) '도잉' 떨어지고(DROP) 목록 패널 모양으로 부풂(SWELL) — 원래 목록 등장과 같은 모양
  //  q 0.85 → 1  실제 유리 패널로 바뀌고 카드가 차례로 내려옴
  //  모든 값이 q 로 정해져 스크롤 속도만큼 빠르게/느리게, 거꾸로 스크롤하면 그대로 되감김. v(q/프레임)는 떨어질 때 늘어나는 정도에만.
  const cards = [...plist.querySelectorAll(".pcard")];
  let scrubOn = false, from0 = null, home0 = null, aboutA = 0;
  const LIST_LIVE = 0.9;                                  // 이만큼 펼쳐지면 카드 클릭 가능
  const backOut = (t, c = 1.4) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  // ---- 3D 원통 글자: 두 단어를 가로 띠 여러 장으로 잘라 원통 둘레에 붙이고 원통을 돌림 ----
  //  띠마다 원통 위 각도에 맞춰 위치·깊이·기울기가 달라 위·아래로 갈수록 눌리고 멀어지는 원통 왜곡이 생김.
  //  Hello 는 앞면(0°), Project 는 아래 면(90°)에 있고 원통이 0 → 90° 돌면 Project 가 앞으로.
  const CYL_N = 16;                          // 단어당 띠 수
  const ARC = (Math.PI * 2) / 3;             // 단어 하나가 감기는 각도 (120°) — 클수록 더 둥글게 휨
  let cyl = null;
  function cylOn(words = ["Hello", "Project"]) {
    const key = words.join("|");
    if (cyl && cyl.key === key) return cyl;
    if (cyl) cylOff(words[0]);
    const H = pbarLabel.offsetHeight || 27;  // 26px 글자 한 줄 높이 (line-height normal)
    pbarLabel.textContent = "";
    const box = document.createElement("span");
    box.className = "cyl";
    const strips = [];
    for (const [w, word] of words.entries()) {
      for (let j = 0; j < CYL_N; j++) {
        const el = document.createElement("span");
        el.className = "cyl__strip";
        el.textContent = word;
        const top = (j / CYL_N) * H, bot = ((j + 1) / CYL_N) * H;
        el.style.clipPath = `inset(${(top - 0.4).toFixed(2)}px -20px ${(H - bot - 0.4).toFixed(2)}px -20px)`;
        el.style.transformOrigin = `50% ${((top + bot) / 2).toFixed(2)}px`;
        box.appendChild(el);
        strips.push({ el, w, y: (top + bot) / 2 - H / 2 });
      }
    }
    // 자리 잡기용(보이지 않는) 글자 — 바 안 크기 유지
    const ghost = document.createElement("span");
    ghost.className = "cyl__ghost";
    ghost.textContent = words.reduce((a, b) => (b.length > a.length ? b : a));
    pbarLabel.append(ghost, box);
    cyl = { strips, R: H / ARC, box, key };        // 단어 하나가 원통 둘레의 ARC 만큼 — 크게 휘어 감김
    box.style.filter = "url(#warpText)";    // 넘어가는 동안 물결 왜곡도 함께
    return cyl;
  }
  function cylSet(e, words) {
    const { strips, R } = cylOn(words);
    const rho = ARC * e;                      // 원통 회전 (Hello 면 → Project 면)
    const bend = Math.sin(Math.PI * e);       // 넘어가는 한가운데서 가장 세게
    warpDisp.setAttribute("scale", (14 * bend).toFixed(2));
    for (const s of strips) {
      const th = s.y / R + (s.w ? ARC : 0) - rho;           // 이 띠의 원통 위 각도 (0 = 정면, + = 아래쪽)
      if (Math.abs(th) >= Math.PI / 2) { if (s.vis !== false) { s.el.style.opacity = "0"; s.vis = false; } continue; }
      // 정면에서 멀어질수록 어둡고 흐리게 (원통 음영)
      const lit = Math.cos(th);
      s.el.style.opacity = (0.25 + 0.75 * lit).toFixed(3);
      s.vis = true;
      const y = R * Math.sin(th) - s.y, z = R * Math.cos(th) - R;
      // 원통 둘레를 따라 세로로 눌리고(rotateX) 가까운 면은 커지고 먼 면은 작아짐(perspective) + 가운데 띠는 살짝 부풂
      const bulge = 1 + 0.12 * bend * lit;
      s.el.style.transform = `translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${(-th * 180 / Math.PI).toFixed(2)}deg) scale(${bulge.toFixed(3)}, 1)`;
    }
  }
  function cylOff(word) {
    if (cyl) { cyl = null; pbarLabel.textContent = word; warpDisp.setAttribute("scale", "0"); }
    else if (pbarLabel.textContent !== word) pbarLabel.textContent = word;
  }

  // 목록 부분만 (q 0.3 → 0.85 물방울, 0.85 → 1 패널·카드) — About 으로 넘어갈 때 거꾸로 걷어 올릴 때도 씀
  function listPart(q, v = 0) {
    // 2) 물방울 목록 (액체 레이어)
    const u = clamp01((q - 0.3) / 0.55);
    const liquid = u > 0.002 && q < 0.85;                                 // 부동소수 찌꺼기로 액체 레이어가 켜져 있지 않게
    goo.classList.toggle("is-on", liquid);
    pbar.classList.toggle("is-liquid", liquid);
    plist.classList.toggle("is-liquid", q < 0.85);
    if (liquid) {
      for (const el of goo.querySelectorAll(".proj__blob, .proj__neck")) {
        if (el !== blobBar && el !== blobList) setT(el, "scale(0)");
      }
      setT(blobBar, "translate3d(0, 0, 0)");
      const LIST_W = plist.offsetWidth;
      const d = 56 * easeOut3(clamp01(u / 0.3));                          // 바 밑에 동그랗게 맺힘
      const du = clamp01((u - 0.35) / 0.35);
      const pos = -44 * (1 - backOut(du));                                  // 툭 떨어져 출렁
      const k = Math.max(backOut(clamp01((u - 0.45) / 0.55), 1.1), 0);     // 떨어지면서 패널 모양으로 부풂
      const posV = v * 44 / (0.35 * 0.55);
      const fall = clamp(posV * 0.03, -0.2, 0.35) * (1 - Math.min(k, 1));   // 떨어지는 속도만큼 세로로 늘어남
      const w = d + (LIST_W - d) * k, h = d + (LIST_H - d) * k;
      const sx = (w / LIST_W) * (1 - fall * 0.5), sy = (h / LIST_H) * (1 + fall);
      const rr = d / 2 + (20 - d / 2) * Math.min(k, 1);
      blobList.style.borderRadius = `${(rr / Math.max(sx, 0.001)).toFixed(1)}px / ${(rr / Math.max(sy, 0.001)).toFixed(1)}px`;
      setT(blobList, `translate3d(0, ${pos.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`);
    }

    // 3) 실제 유리 패널 + 카드가 차례로 내려옴
    plist.classList.toggle("is-in", q >= 0.85);
    const c = clamp01((q - 0.85) / 0.15);
    cards.forEach((card, i) => {
      if (q >= 1) { card.style.opacity = card.style.transform = ""; return; }
      const ci = clamp01(c * 1.6 - i * 0.15);
      card.style.opacity = ci.toFixed(3);
      card.style.transform = `translateY(${(-10 * (1 - backOut(ci, 1.56))).toFixed(2)}px)`;
    });
  }

  function scrub(q, v = 0) {
    if (aboutA > 0) return;                                          // About 으로 넘어가는 중이면 About 쪽이 바·목록을 그림
    if (started && state !== "list" && state !== "scrub") return;   // 메뉴(About·Home)·이동 중에는 건드리지 않음
    if (q <= 0) {
      if (scrubOn) resetProject();
      return;
    }
    if (!scrubOn) {
      scrubOn = true;
      started = true;
      proj.hidden = false;
      setT(pbar, "none");
      home0 = pbar.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      from0 = { x: (n.left - home0.left) / ps, y: (n.top - home0.top) / ps, s: n.width / home0.width };
      nav.style.visibility = "hidden";                 // 같은 자리의 프로젝트 바가 이어받음
    }
    state = q >= 1 ? "list" : "scrub";
    // 다 펼쳐지면 원래 전환(메뉴 열고 닫을 때 페이드)을 되살림, 스크롤 중엔 끔
    const tr = q >= 1 ? "" : "none";
    if (plist.style.transition !== tr) { plist.style.transition = tr; for (const c of cards) c.style.transition = tr; }
    stage.classList.toggle("is-project", q >= 1);
    // 카드가 눈에 보이게 다 내려왔으면(끝 조금 전) 바로 누를 수 있게 — 스크롤을 끝 직전에 멈춰도 클릭됨
    plist.style.pointerEvents = q >= LIST_LIVE ? "" : "none";

    // 1) 바: Hello 자리 → 맨 위 프로젝트 바 자리 (화면 축소 배율 차이만큼)
    const m = easeIO(clamp01(q / 0.3));
    const s = from0.s + (1 - from0.s) * m;
    setT(pbar, `translate3d(${(from0.x * (1 - m)).toFixed(2)}px, ${(from0.y * (1 - m)).toFixed(2)}px, 0) scale(${s.toFixed(4)})`);

    // 글자: 3D 원통 — Hello 가 원통 면을 따라 위로 굴러 넘어가고, 아래 면의 Project 가 굴러 올라옴
    const r = clamp01(q / 0.45);
    if (r > 0 && r < 1) cylSet(easeIO(r));
    else cylOff(r >= 1 ? "Project" : "Hello");

    listPart(q, v);

    if (q >= 1) {
      setT(pbar, "none");
      setT(plist, "none");
    }
  }
  const easeOut3 = (t) => 1 - Math.pow(1 - t, 3);
  window.ProjectScrub = scrub;
  // 스크롤로 되감아도 되는 상태인지 (목록이 펼쳐져 있거나 스크롤 중일 때만 — 메뉴·이동 중엔 아님)
  window.ProjectScrollable = () => !started || state === "list" || state === "scrub" || state === "about";

  // ===== 프로젝트 → About (Figma 292:6742): 스크롤 진행 a(0 → 1) 그대로, 거꾸로 스크롤하면 되감김 =====
  //  a 0 → 0.45  카드가 걷히고 목록 패널이 물방울로 줄어들며 바 속으로 빨려 들어감 (목록 등장의 역재생)
  //  a 0.35 → 0.8 바 글자: Hello → Project 때와 같은 3D 원통 + 물결 왜곡으로 Project → About
  function toAbout(a) {
    if (!scrubOn || (state !== "list" && state !== "about")) return;
    if (a <= 0) {
      if (aboutA > 0) {
        aboutA = 0;
        cylOff("Project");
        state = "list";
        listPart(1);
        plist.style.pointerEvents = "";
      }
      return;
    }
    if (aboutA === 0) { plist.style.transition = "none"; for (const c of cards) c.style.transition = "none"; }
    aboutA = a;
    state = "about";
    const lq = 1 - 0.7 * easeIO(clamp01(a / 0.45));
    plist.style.pointerEvents = lq >= LIST_LIVE ? "" : "none";   // 카드가 아직 보이는 동안은 계속 누를 수 있게
    listPart(lq);
    const r = clamp01((a - 0.35) / 0.45);
    if (r > 0 && r < 1) cylSet(easeIO(r), ["Project", "About"]);
    else cylOff(r >= 1 ? "About" : "Project");
  }
  window.ProjectAbout = toAbout;
  window.ShowProjectList = showListDirect;

  // 상세 페이지의 Home 에서도 사용
  window.FlyHome = (bar, from, onLand) => flyHome(bar, 1, from, onLand);
  window.ResetMain = resetMain;

  // 프로젝트 화면을 처음(열리기 전) 상태로
  function resetProject() {
    started = false;
    state = "busy";
    scrubOn = false;
    aboutA = 0;
    nav.style.opacity = nav.style.pointerEvents = nav.style.visibility = "";
    cylOff("Project");
    plist.style.transition = "";
    for (const c of cards) { c.style.opacity = c.style.transform = c.style.transition = ""; }
    stage.classList.remove("is-project");
    proj.hidden = true;
    proj.classList.remove("is-home");
    for (const el of [pbar, plist, blobBar, blobList]) {
      el.style.transform = "";
      el._t = undefined;
    }
    pbar.classList.remove("is-liquid", "is-from-split");
    plist.classList.remove("is-in", "is-liquid");
    plist.style.pointerEvents = "";
    goo.classList.remove("is-on");
    blobList.style.borderRadius = "";
    for (const b of [pabout, phome]) b.classList.remove("is-in", "is-liquid");
  }

})();
