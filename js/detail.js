/**
 * 프로젝트 상세 페이지 (ShuttleFIT · Wellow · Framer · The North Face · RealWorld X Catch Teenieping)
 *  1) 프로젝트 목록 또는 상세 페이지 끝 Next 목록의 카드 클릭 → 로딩 (Figma 191:602)
 *     위 바(Project / Next)가 화면 가운데로 내려옴(컴포넌트는 회전 없음) · 글자만 왜곡 회전해 프로젝트 이름으로 ·
 *     동시에 프로젝트 대표 색 프레임(radius 40)이 위에서 아래로 슬라이드인
 *  2) 상세 페이지로 전환 — 바가 다시 맨 위로 올라가는 동안 상세 페이지가 radius 40 프레임으로 아래에서 위로 슬라이드인,
 *     표지는 그 안에서 아래에서 스케일업하며 튀어 오름
 *  3) 프레임: 아래에서 위로 슬라이드하며 등장 + 스크롤 damping 으로 떠 있음
 *  4) 맨 위 고정 Project 바 → 페이지 끝 스크롤만큼 Next 로 회전 전환, 목록이 물방울로 늘어남
 *  카드에 data-project="shuttlefit|wello" 가 있으면 클릭 시 해당 프로젝트로 이동
 */
(function () {
  const load = document.getElementById("load");
  const detail = document.getElementById("detail");
  if (!load || !detail) return;

  // 프로젝트별 페이지·로딩 화면 (로딩 = 카드 색 + 대표 이미지 + 40px 제목)
  const PROJECTS = {
    shuttlefit: { page: "shuttlefit.html", bg: "#bb5a5b", img: "assets/shuttlefit/592ea.jpg", title: "ShuttleFIT", color: "#fff" },
    wello: { page: "wello.html", bg: "#faf4ea", img: "assets/wello/cover.webp", title: "Wellow", color: "#000" },
    framer: { page: "framer.html", bg: "#ffffff", img: "assets/framer/hero.jpg", title: "Framer", color: "#000" },
    northface: { page: "northface.html", bg: "#2c2c2c", img: "assets/northface/hero.jpg", title: "The North Face Rebranding", color: "#fff" },   // Figma 232:3596
    realworld: { page: "realworld.html", bg: "#fbb5bd", img: "assets/realworld/hero.jpg", title: "RealWorld X Catch Teenieping", color: "#fff", lock: true },   // Figma 214:739 · 기업 협업 — 비밀번호로 잠금 (js/lock.js)
  };
  const loadFill = load.querySelector(".load__fill");
  const loadBar = load.querySelector(".load__bar");
  const loadLabel = load.querySelector(".load__label");
  const warpDisp = document.getElementById("warpDisp");

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

  // ---------- 상세 페이지 크기 ----------
  //  본문(1200)은 화면이 1240(좌우 20 + 1200 + 20)보다 좁을 때만 비율 축소 — CSS zoom (스크롤 길이·고정 위치가 그대로 맞음)
  //  맨 위 바(프로젝트 이름 · Next)와 Next 목록은 402 고정, 화면이 462(좌우 30 + 402 + 30)보다 좁을 때만 축소
  function fitDetailSize() {
    // 스크롤바를 뺀 실제 보이는 폭 기준 — 좌우 여백이 정확히 20 (스크롤바 폭만큼 줄어들지 않게)
    const vw = document.documentElement.clientWidth || innerWidth;
    const dz = Math.min(1, (vw - 40) / 1200);
    // 위 바 · Next 목록은 처음 화면(프로젝트 화면)의 바와 똑같은 자리·크기가 되도록 '창 전체 폭' 기준 (스크롤바 폭 무시)
    //  — 상세 페이지에만 스크롤바가 있어 그만큼 가운데가 어긋나 돌아갈 때 바가 옆으로 움직이던 문제
    // 스크롤바 폭: 창 폭 − 보이는 폭. 모바일에서 페이지가 잠깐 화면보다 넓어지면 브라우저가 레이아웃 뷰포트를 키워 innerWidth 가
    //  몇 배로 커지므로(그러면 바가 옆으로 밀리고 줄지 않음) 실제 스크롤바 폭(24 미만)일 때만 인정
    const sbRaw = innerWidth - vw, sbFull = sbRaw > 0 && sbRaw < 24 ? sbRaw : 0;
    const dk = Math.min(1, (vw + sbFull - 60) / 402);
    const sbw = sbFull / 2;                                  // 스크롤바 폭의 절반 — 이만큼 오른쪽으로 옮겨 창 가운데에 맞춤
    const st = document.documentElement.style;
    st.setProperty("--dz", dz.toFixed(4));
    st.setProperty("--dk", dk.toFixed(4));
    st.setProperty("--dgz", (dk / dz).toFixed(4));            // 본문 zoom 안에서 바가 402 × dk 가 되도록
    st.setProperty("--dtop", `${((45 - 45 * dk) / dk).toFixed(2)}px`);   // 줄어든 바가 GNB 90 의 세로 가운데 (zoom 이 곱해지므로 나눠 둠)
    st.setProperty("--dsbw", `${(sbw / dk).toFixed(2)}px`);              // zoom(dk) 이 곱해지므로 나눠 둠
    if (!detail.hidden && typeof fitCover === "function") fitCover();    // 표지 높이도 같은 배율로 다시
  }
  fitDetailSize();
  addEventListener("resize", fitDetailSize);
  // 상세 페이지가 열리고 닫히면 스크롤바가 생기거나 없어져 보이는 폭이 바뀜 → 다시 맞춤
  new ResizeObserver(fitDetailSize).observe(document.documentElement);
  const step1D = (s, target, P) => {
    s.v += (P.stiffness * (target - s.x) - P.damping * s.v) / P.mass;
    s.x += s.v;
  };
  const setT = (el, t) => { if (el._t !== t) { el.style.transform = t; el._t = t; } };
  let gen = 0;                               // 페이지가 바뀌면 이전 페이지의 루프를 멈추기 위한 세대 번호
  let nextShown = () => false;               // 위 바가 지금 Next 로 바뀌어 있는지 (initNext 가 연결)
  let nextReplay = () => {};                 // Next 목록을 처음처럼 물방울로 다시 떨어뜨림 (initNext 가 연결)
  let nextHome = null;                       // 푸터에서 Home 으로: 목록 · AHYUN · Find me 를 역재생으로 걷고 끝나면 콜백 (initNext 가 연결)

  // ---------- 1) 로딩 (Figma 191:602) ----------
  const DOWN_MS = 1200;                      // 바가 가운데로 내려옴 (컴포넌트는 회전하지 않고 이동만)
  const UP_MS = 1200;                        // 다시 맨 위로
  const ROLL_MS = 1000;                       // 글자 왜곡 회전 (Project/Next → 프로젝트 이름)
  const FILL_MS = DOWN_MS;                   // 대표 색 프레임: 바가 내려오는 동안 함께 위에서 아래로 슬라이드인
  const HOLD_MS = 450;                       // 색이 다 찬 뒤 잠깐 머묾
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const pages = {};
  function fetchPage(key) {
    // 수정 후에도 예전 파일이 캐시에서 나오지 않도록 매번 서버에 새 버전 확인 (바뀌지 않았으면 304 로 가볍게)
    if (!pages[key]) pages[key] = fetch(PROJECTS[key].page, { cache: "no-cache" }).then((r) => r.text());
    return pages[key];
  }

  // 회전 글자가 지금 보여 주는 쪽
  function shownText(bar) {
    const roll = bar.querySelector(".roll");
    if (!roll) return bar.textContent.trim();
    const [a, b] = roll.children;
    return a.getBoundingClientRect().height >= b.getBoundingClientRect().height ? a.textContent : b.textContent;
  }
  // 대표 색 × #C1C1C1 (multiply) 50% — 바탕이 단색이라 미리 곱한 색이 곧 multiply
  function mulShadow(hex) {
    const n = parseInt(hex.slice(1), 16);
    const m = (v) => Math.round((v * 193) / 255);
    return `rgba(${m(n >> 16)}, ${m((n >> 8) & 255)}, ${m(n & 255)}, 0.5)`;
  }

  let busy = false;
  function open(key, fromDetail) {
    if (busy || !PROJECTS[key]) return;
    busy = true;
    const P = PROJECTS[key];
    const page = fetchPage(key);
    window.glassLock && window.glassLock(true);

    // 출발: 지금 화면의 위 바 (상세 페이지면 이름/Next 바, 아니면 프로젝트 목록의 Project 바)
    const src = (fromDetail && document.getElementById("gnbBar")) || document.getElementById("pbar");
    const r = src.getBoundingClientRect();
    const oldText = shownText(src);
    src.style.visibility = "hidden";

    loadFill.style.background = P.bg;
    load.style.setProperty("--load-shadow", mulShadow(P.bg));
    loadBar.style.color = P.color;
    // 글자만 회전: 처음 화면 Hello → Project 와 같은 3D 원통 왜곡 회전 (옛 글자 → 프로젝트 이름) + 물결 왜곡
    loadLabel.textContent = "";
    const ghost = document.createElement("span");
    ghost.className = "cyl__ghost";
    ghost.textContent = P.title.length > oldText.length ? P.title : oldText;   // 바 안 한 줄 높이 유지
    loadLabel.appendChild(ghost);
    const face = (t) => { const f = document.createElement("span"); f.textContent = t; return f; };
    let lcyl = null;                           // 바가 보인 뒤에 만듦 (숨겨진 동안은 글자 높이를 잴 수 없음)
    const H = innerHeight;
    setT(loadFill, `translate3d(0, ${-(H + 80)}px, 0)`);      // 화면 위에 숨겨 둔 색 프레임
    // 도착 크기 · 자리: 상세 페이지 위 바와 똑같이 (화면 462 미만이면 402 × dk 로 줄고 GNB 90 의 세로 가운데)
    const DK = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dk")) || 1;
    const TOP_TO = 45 - 26 * DK;
    const center = H / 2 - 26 * DK;
    const y0 = r.top, s0 = r.width / 402;
    const y = { x: y0 }, sc = { x: s0 };
    const place = () => setT(loadBar, `translate3d(0, ${y.x.toFixed(2)}px, 0) scale(${sc.x.toFixed(4)})`);
    place();
    load.hidden = false;
    lcyl = makeCyl(loadLabel, [face(oldText), face(P.title)], "x", ghost.offsetHeight || 27);
    lcyl.box.classList.add("bk-cyl--label");
    lcyl.box.style.filter = "url(#warpText)";
    lcyl.set(0);

    const t0 = performance.now();
    let phase = "down", upAt = 0;

    // 글자만 상하로 굴러 바뀜 (split.js 와 같은 값): 회전 중간에 세로로 늘어나며 가장 크게 왜곡, 제자리 직전 살짝 넘침
    function roll(now) {
      const k = clamp01((now - t0) / ROLL_MS);
      const e = easeInOut(k);
      lcyl.set(e);
      if (k >= 1) { warpDisp.setAttribute("scale", "0"); return true; }
      warpDisp.setAttribute("scale", (14 * Math.sin(Math.PI * e)).toFixed(2));   // 처음 화면 원통과 같은 세기
      return false;
    }

    // 잠금 화면에서 화살표: 색 프레임이 들어온 곡선을 거꾸로 위로 걷히며 프로젝트 목록이 다시 보임
    function backToList() {
      const tb = performance.now(), MS = 700;
      const back = (now) => {
        const u = easeInOut(clamp01((now - tb) / MS));
        setT(loadFill, `translate3d(0, ${(-(H + 80) * u).toFixed(1)}px, 0)`);
        if (u < 1) { requestAnimationFrame(back); return; }
        load.hidden = true;
        loadBar.style.visibility = "";
        src.style.visibility = "";
        window.glassLock && window.glassLock(false);
        busy = false;
      };
      requestAnimationFrame(back);
    }

    async function toDetail() {
      if (fromDetail) src.style.visibility = "";
      await showDetail(key);
      // 새 상세 페이지의 위 바는 로딩 바가 올라가 닿을 때까지 숨김
      const gnb = document.getElementById("gnbBar");
      if (gnb) gnb.style.visibility = "hidden";
      // 상세 페이지를 색 프레임 위·로딩 바 아래로 올려 화면 아래에 둠 (radius 40 프레임으로 슬라이드인)
      detail.style.zIndex = "25";
      detail.style.clipPath = "inset(0 round 40px)";
      setT(detail, `translate3d(0, ${H}px, 0)`);
      phase = "up";
      upAt = performance.now();
      requestAnimationFrame(frame);
    }

    function frame(now) {
      if (phase === "down") {
        // 1) 바가 가운데로 내려오며 (이동만) 글자가 굴러 프로젝트 이름으로
        const d = easeInOut(clamp01((now - t0) / DOWN_MS));
        y.x = y0 + (center - y0) * d;
        sc.x = s0 + (DK - s0) * d;
        place();
        const rolled = roll(now);
        // 2) 내려오기 시작함과 동시에 대표 색 프레임(radius 40)이 위에서 아래로 슬라이드인
        {
          const p = easeInOut(clamp01((now - t0) / FILL_MS));
          setT(loadFill, p >= 1 ? "none" : `translate3d(0, ${(-(H + 80) * (1 - p)).toFixed(1)}px, 0)`);
          if (p >= 1 && rolled && d >= 1) {
            phase = "wait";
            const go = () => { const ready = performance.now() + HOLD_MS; page.then(() => setTimeout(toDetail, Math.max(ready - performance.now(), 0))); };
            // 잠근 프로젝트: 가운데 바가 갈라지며 자물쇠 · 화살표 (Figma 333:8060) — 맞으면 이어서 상세 페이지, 화살표면 목록으로
            if (P.lock && window.LockGate && !window.LockGate.unlocked()) {
              window.LockGate.show({ bar: loadBar, title: P.title, color: getComputedStyle(loadBar).color, bg: P.bg, onUnlock: go, onBack: backToList });
              return;
            }
            go();
            return;
          }
        }
      } else if (phase === "up") {
        // 3) 바가 맨 위로 올라가는 동안 상세 페이지가 radius 40 프레임으로 아래에서 위로 슬라이드인
        //    (안에서 표지가 아래에서 스케일업하며 튀어 오름) — 다 올라오면 모서리가 펴짐
        const u = easeInOut(clamp01((now - upAt) / UP_MS));
        y.x = center + (TOP_TO - center) * u;
        place();
        setT(detail, u >= 1 ? "" : `translate3d(0, ${(H * (1 - u)).toFixed(1)}px, 0)`);
        detail.style.clipPath = `inset(0 round ${(40 * clamp01((1 - u) / 0.15)).toFixed(1)}px)`;
        if (u >= 1) {
          const gnb = document.getElementById("gnbBar");
          if (gnb) gnb.style.visibility = "";
          if (!fromDetail) src.style.visibility = "";
          load.hidden = true;
          detail.style.zIndex = detail.style.clipPath = "";
          window.glassLock && window.glassLock(false);
          busy = false;
          return;
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // 프로젝트 목록 카드 · Next 목록 카드 (data-project)
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-project]");
    if (!el) return;
    e.preventDefault();
    open(el.dataset.project, !!el.closest("#detail"));
  });

  // ---------- 2) 상세 페이지로 전환 ----------
  // ---------- 푸터 (Figma 256:4453): 상세 페이지 안으로 옮겨 쓰고, 페이지를 바꾸기 전엔 밖에 보관 ----------
  const foot = document.getElementById("foot");
  const footFrame = document.getElementById("footFrame");
  const footFind = document.getElementById("footFind");
  // 푸터 AHYUN 그림자 = 올리브 × #C1C1C1 (multiply) — 필터는 intro.js 가 만든 뒤에 생기므로 쓸 때 찾아 씀
  const FOOT_MUL = "139 152 102";
  function footShadow() {
    const fl = document.querySelector("#ahyunGoo-f feFlood");
    if (fl) fl.style.floodColor = "rgb(139, 152, 102)";
    document.body.style.setProperty("--foot-mul", FOOT_MUL);
  }
  // 푸터가 걷히는 동안 스크롤 잠금 — 걷힌 뒤 보이는 화면이 '푸터 바로 위 프레임'이 되도록 그 자리에 붙잡아 둠
  let scrollLock = null;                     // 잠긴 scrollY (null = 풀림)
  const blockScroll = (e) => { if (scrollLock !== null) e.preventDefault(); };
  addEventListener("wheel", blockScroll, { passive: false });
  addEventListener("touchmove", blockScroll, { passive: false });
  addEventListener("keydown", (e) => {
    if (scrollLock !== null && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) e.preventDefault();
  });
  function parkFoot() {
    scrollLock = null;
    document.body.classList.remove("foot-down");
    if (!foot) return;
    if (foot.parentNode !== document.body) document.body.appendChild(foot);
    foot.hidden = true;
    setT(footFrame, "");
    footFrame.style.borderRadius = "";
    footFrame._r = "";
    if (window.FootAhyun) { window.FootAhyun.setWobble(0); window.FootAhyun.reset(); }
    if (footFind) { window.HeroInk && window.HeroInk(footFind, 0); footFind.classList.remove("is-on"); }
  }
  // 화면이 낮으면 AHYUN 만 비율 축소 (Figma: 목록 아래 80, 화면 바닥 위 40 — 915 기준)
  function fitFoot() { if (foot) foot.style.setProperty("--fs", Math.min(1, innerHeight / 915).toFixed(4)); }
  addEventListener("resize", fitFoot);
  fitFoot();

  async function showDetail(key) {
    const html = await fetchPage(key);
    document.body.classList.remove("cursor-away");
    gen++;                                    // 이전 페이지의 스크롤·Next 루프 정지
    parkFoot();
    closeMenu(true);
    detail.innerHTML = html;
    detail.dataset.current = key;      // data-project 로 두면 상세 페이지 아무 곳 클릭도 카드 클릭으로 잡힘
    detail.hidden = false;
    document.body.classList.add("is-detail");
    window.scrollTo(0, 0);
    // 위 바: "Project" 대신 이 프로젝트 이름 (스크롤 끝에서는 Next 로 바뀜)
    const gnbOld = detail.querySelector("#gnbBar .roll__old");
    if (gnbOld) gnbOld.textContent = PROJECTS[key].title;
    initFrames();
    initNext();
    detailGlass(document.getElementById("gnbBar"));
    detailGlass(document.getElementById("nextList"));
    initWire();
    initMidfi();
    initEmbeds();
    initDomino();
    initPager();
    initBack();
    fitCover();
    unclipShadows();
  }

  // ---------- 차례로 슬라이드 업 (North Face 3D 렌더 1 2 3 / 4 5 6 · RealWorld Work Flow) ----------
  //  상세 페이지 프레임이 스크롤하면 나오는 움직임(initFrames 의 RISE · REVEAL 스프링 · 나타남)을 그대로 카드마다 차례로
  //  묶음 윗부분이 화면 아래 88% 에 닿으면 시작 — 한 줄 안에서 차례로, 줄이 바뀌면 한 박자 쉬고
  const TILE_RISE = 120;
  const TILE_REVEAL = { stiffness: 0.012, damping: 0.22, mass: 1.6 };
  function initDomino() {
    const groups = [...detail.querySelectorAll(".domino")].map((g) => ({
      g, per: +g.dataset.dominoRows || 3, at: null,
      tiles: [...g.querySelectorAll(".domino__tile")].map((el) => ({ el, r: { x: 0, v: 0 }, done: false, t: "", o: "" })),
    }));
    if (!groups.length) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const G of groups) for (const T of G.tiles) T.el.classList.add("is-up");
      return;
    }
    const myGen = gen;
    function tick(now) {
      if (myGen !== gen) return;
      groups.forEach((G, gi) => {
        // 위로 다시 올라가 묶음이 화면 아래로 완전히 내려가면 처음 상태로 — 다시 내려오면 또 차례로 슬라이드 업
        if (G.at !== null && G.g.getBoundingClientRect().top > innerHeight + 10) {
          G.at = null;
          for (const T of G.tiles) {
            T.done = false; T.r.x = 0; T.r.v = 0;
            T.el.classList.remove("is-up");
            T.el.style.transform = T.el.style.opacity = ""; T.t = T.o = "";
          }
        }
        if (G.at === null) {
          if (G.g.getBoundingClientRect().top < innerHeight * 0.88) {
            G.at = now;
            // 같은 섹션의 앞 묶음이 아직 나오는 중이면 그 뒤에 이어서 (Work Flow: 위 4장 → 아래 3장)
            const P = groups[gi - 1];
            if (P && P.at !== null && P.g.parentElement === G.g.parentElement) {
              G.at = Math.max(now, P.at + P.tiles.length * 140 + Math.floor((P.tiles.length - 1) / P.per) * 200 + 200);
            }
          } else return;
        }
        G.tiles.forEach((T, i) => {
          if (T.done) return;
          const delay = i * 140 + Math.floor(i / G.per) * 200;
          if (now - G.at < delay) return;
          const S = TILE_REVEAL;
          T.r.v += (S.stiffness * (1 - T.r.x) - S.damping * T.r.v) / S.mass;
          T.r.x += T.r.v;
          if (Math.abs(1 - T.r.x) < 0.001 && Math.abs(T.r.v) < 0.0005) {
            T.done = true;
            T.el.style.transform = T.el.style.opacity = "";
            T.el.classList.add("is-up");
            return;
          }
          const t = `translate3d(0, ${((1 - T.r.x) * TILE_RISE).toFixed(2)}px, 0)`;
          // 페이드 인: 떠오르는 내내 천천히 또렷해짐 (프레임보다 은은하게 — 다 올라와 멈출 즈음 완전히 보임)
          const o = Math.pow(Math.min(Math.max(T.r.x, 0), 1), 1.6).toFixed(3);
          if (t !== T.t) { T.el.style.transform = t; T.t = t; }
          if (o !== T.o) { T.el.style.opacity = o; T.o = o; }
        });
      });
      // 다시 올라갔다 내려올 때도 나오도록 페이지가 열려 있는 동안 계속 봄 (다 나와 있으면 위치만 확인)
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }


  // ---------- 되돌아가기 방울 (Figma 33:743) ----------
  //  위 바를 누르면: Hello → Project/About 분리(js/archive/split-hello.js)를 가로로 — 바 왼쪽 끝에서 방울이 붙은 채
  //  끈적하게 늘어나다(쥬욱) 목이 끊어지며 '도잉' 튕겨 바 왼쪽 20 자리에 섬 (액체 레이어 #gooFilter 가 몸체·목·꼬리를 그림)
  //  · 방울 안 화살표: 세로축으로 도는 3D 구 표면을 따라 왜곡되며 돌아 나옴
  //  · 바 글자: 처음 화면 Hello → Project 와 같은 3D 원통 — 프로젝트 이름 → Project (Next 상태면 Next → Home)
  //  화살표를 누르면 처음 화면 배경이 위에서 슬라이드인으로 덮고 → Project: 프로젝트 목록 / Home: 처음 화면
  //  바를 다시 누르거나 다른 곳을 누르면 방울이 바 속으로 되돌아 들어가고 글자도 되감김
  const bk = { state: "closed" };
  const BK_W = 54, BK_GAP = 20, BK_PAD = 40;
  const BK_STRETCH = { stiffness: 0.018, damping: 0.3, mass: 1.8 };   // 쥬욱 (split-hello 와 같은 값)
  const BK_SNAP = { stiffness: 0.07, damping: 0.14, mass: 1.1 };      // 도잉
  const BK_TAIL = { stiffness: 0.06, damping: 0.16, mass: 1 };
  const BK_BACK = { stiffness: 0.05, damping: 0.32, mass: 1.2 };      // 되돌아 들어감
  const easeIO3 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // 원통/구 글자·그림: 띠로 잘라 축 둘레에 붙여 돌림 (axis "x" = 위아래로 구름(원통), "y" = 옆으로 돎(구))
  function makeCyl(host, faces, axis, H, W) {
    const N = 16, ARC = (Math.PI * 2) / 3;
    const box = document.createElement("span");
    box.className = "bk-cyl";
    const strips = [];
    faces.forEach((face, w) => {
      for (let j = 0; j < N; j++) {
        const el = face.cloneNode(true);
        el.classList.add("bk-cyl__strip");
        const a0 = (j / N) * (axis === "x" ? H : W), a1 = ((j + 1) / N) * (axis === "x" ? H : W);
        if (axis === "x") {
          el.style.clipPath = `inset(${(a0 - 0.4).toFixed(2)}px -40px ${(H - a1 - 0.4).toFixed(2)}px -40px)`;
          el.style.transformOrigin = `50% ${((a0 + a1) / 2).toFixed(2)}px`;
        } else {
          el.style.clipPath = `inset(-10px ${(W - a1 - 0.3).toFixed(2)}px -10px ${(a0 - 0.3).toFixed(2)}px)`;
          el.style.transformOrigin = `${((a0 + a1) / 2).toFixed(2)}px 50%`;
        }
        box.appendChild(el);
        strips.push({ el, w, c: (a0 + a1) / 2 - (axis === "x" ? H : W) / 2 });
      }
    });
    host.appendChild(box);
    const R = (axis === "x" ? H : W) / ARC;
    return {
      box,
      set(e) {                                    // e 0 → 1: 첫 면 → 둘째 면 (면이 하나면 뒤에서 앞으로)
        const rho = ARC * e;
        const bend = Math.sin(Math.PI * e);
        for (const s of strips) {
          // 면 둘: 첫 면(0) → 둘째 면(ARC) / 면 하나: 옆(ARC)에서 돌아 정면으로
          // 처음·끝에는 휨이 0 이 되어 반듯한 글자와 똑같은 모습 (멈출 때 뚝 끊기지 않게) — 도는 동안만 원통으로 휨
          const curve = Math.pow(bend, 0.6);
          const th = faces.length > 1 ? (s.c / R) * curve + (s.w ? ARC : 0) - rho : (s.c / R) * curve + ARC * (1 - e);
          if (Math.abs(th) >= Math.PI / 2) { s.el.style.opacity = "0"; continue; }
          const lit = Math.cos(th);
          s.el.style.opacity = (0.25 + 0.75 * lit).toFixed(3);
          // 휨이 0 일 때 각 띠가 제자리(평면)에 오도록: 원통 위 위치와 평면 위 위치를 휨 정도로 섞음
          const onCyl = R * Math.sin(th) - s.c;
          const flat = R * Math.sin(th - (s.c / R) * curve) ;            // 원통 회전만 반영한 평면 이동
          const d = curve * onCyl + (1 - curve) * flat, z = (R * lit - R) * curve + (1 - curve) * (R * Math.cos(th - (s.c / R) * curve) - R);
          if (axis === "x") {
            s.el.style.transform = `translate3d(0, ${d.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${(-th * 57.2958).toFixed(2)}deg) scale(${(1 + 0.12 * bend * lit).toFixed(3)}, 1)`;
          } else {
            // 구: 옆으로 돌며 가장자리로 갈수록 위아래도 오므라듦
            s.el.style.transform = `translate3d(${d.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${(th * 57.2958).toFixed(2)}deg) scale(1, ${(0.62 + 0.38 * lit).toFixed(3)})`;
          }
        }
      },
      remove() { box.remove(); },
    };
  }

  function initBack() {
    bk.state = "closed";
    const bar = document.getElementById("gnbBar");
    const gnb = detail.querySelector(".detail__gnb");
    if (!bar || !gnb) return;
    const Lb = bar.offsetLeft, Tb = bar.offsetTop, Wb = bar.offsetWidth, Hb = bar.offsetHeight;
    const FINAL = Lb - BK_GAP - BK_W;                    // 방울 제자리 (바 왼쪽 20)
    const START = Lb + 20;                               // 처음: 바 왼쪽 안쪽(20)에 완전히 포개져 한 덩어리
    // 물방울 버튼: 바와 같은 유리 컴포넌트 (채움 · 안쪽 빛 · 굴절 흐림 · multiply 그림자 — 바에서 그대로 복제)
    const btn = document.createElement("a");
    btn.id = "dback";
    btn.className = "dback";
    btn.href = "#back";
    btn.setAttribute("aria-label", "돌아가기");
    btn.style.cssText = `left:${FINAL}px; top:${Tb}px; width:${BK_W}px; height:${Hb}px;`;
    for (const c of bar.children) {
      if (c.matches('[aria-hidden="true"]:not(.optic), .pointer-events-none:not(.optic)') && !c.querySelector("p")) btn.appendChild(c.cloneNode(true));
    }
    btn.insertAdjacentHTML("beforeend", '<span class="dback__arrow"><span class="dback__ico"></span></span>');
    // 통유리: 목이 이어져 있는 동안 바 · 목 · 물방울을 하나의 닫힌 외곽선으로 그리는 유리 (끊긴 뒤에는 실제 바 · 물방울 둘)
    const uni = document.createElement("div");
    uni.className = "dback__uni";
    uni.innerHTML = '<svg class="dback__uni-light" overflow="visible"><path fill-rule="evenodd" fill="rgba(255,245,181,.5)" transform="translate(2 3)" filter="url(#dbackUniLight)"/></svg>';
    gnb.appendChild(uni);
    gnb.appendChild(btn);
    Object.assign(bk, { bar, gnb, btn, uni, Lb, Tb, Wb, Hb, FINAL, START, OFF: START - FINAL, W1: Wb, barW: Wb, narrow: false, dx: START - FINAL, sq: 0, wob: 0, neckK: 0, label: null, cyl: null, gen: (bk.gen || 0) + 1 });
    detailGlass(btn);
    uniInit();
    setDrop(bk.OFF);
  }
  // 물방울을 제자리에서 dx 만큼 오른쪽에 둠
  function setDrop(dx, sq = 0) {
    bk.dx = dx; bk.sq = sq;
    bk.btn.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0) scale(${(1 + sq).toFixed(3)}, ${(1 - sq * 0.5).toFixed(3)})`;
    updNeck();
  }
  // 바도 같이 일렁임: wob > 0 이면 물방울 쪽(왼쪽)으로 끌려 늘어나고, 끊긴 뒤에는 출렁이며 제자리
  function setBarWob(wob) {
    bk.wob = wob;
    bk.bar.style.transform = Math.abs(wob) < 0.0005 ? "" : `translateZ(0) scale(${(1 + wob).toFixed(4)}, ${(1 - wob * 0.7).toFixed(4)})`;
    updNeck();
  }
  // 화면이 좁을 때(462 미만 — 바가 비율로 줄어드는 구간, Figma 331:7915): 물방울이 바 왼쪽 밖으로 튀어나오지 않고
  //  같은 402 자리 안에서 갈라짐 — 바는 오른쪽 끝을 그대로 둔 채 328 로 줄고, 물방울(54)은 바의 왼쪽 끝 자리에 (사이 20)
  function bkLayout() {
    const narrow = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dk")) || 1) < 1;   // 바가 줄어드는 구간과 같은 기준
    if (narrow === bk.narrow && bk.btn.style.left) return;
    bk.narrow = narrow;
    bk.FINAL = narrow ? bk.Lb : bk.Lb - BK_GAP - BK_W;
    bk.OFF = bk.START - bk.FINAL;
    bk.W1 = narrow ? bk.Wb - BK_GAP - BK_W : bk.Wb;
    bk.btn.style.left = `${bk.FINAL}px`;
    setDrop(bk.OFF);
  }
  // 바 폭 (오른쪽 끝 고정): 줄어든 만큼 왼쪽 여백으로 채워 가운데 정렬 자리가 그대로
  function setBarW(w) {
    bk.barW = w;
    if (Math.abs(w - bk.Wb) < 0.01) { bk.bar.style.width = bk.bar.style.marginLeft = ""; return; }
    bk.bar.style.width = `${w.toFixed(2)}px`;
    bk.bar.style.marginLeft = `${(bk.Wb - w).toFixed(2)}px`;
  }
  // 바 왼쪽 끝 ~ 물방울 오른쪽 끝 (wx: 바가 끌려 늘어난 정도)
  const barGap = (dx, wx = 0) => (bk.Lb + bk.Wb - bk.barW * (1 + wx)) - (bk.FINAL + BK_W + dx);
  const NECK_SNAP = 16, NECK_R = 20, NECK_MS = 240;   // 목이 가늘어지다 끊기기까지 (떨어져 나온 뒤)

  // ---------- 통유리 (Single Unified Path) ----------
  //  모양: 세로 가운데 대칭이라 x 마다 '반 두께' = max(물방울, 목, 바) → 위 외곽선(왼→오) + 아래 외곽선(오→왼) 하나의 닫힌 경로
  //   [물방울 왼쪽 둥근 호 → 목 위 오목 곡선 → 바 위 · 오른쪽 · 아래 → 목 아래 오목 곡선 → 물방울 아래 호]
  //  같은 경로 하나에: 반투명 채움 · 굴절(이 외곽선만 테두리로 삼은 변위 맵) · 흐림 · 연노랑 50% 안쪽 빛(inset 2 3 7) · multiply 그림자
  const U_MAG = 0.035, U_RIM = 10, U_BEZEL = 24;           // js/glass.js 의 둥근 사각형 유리 맵과 같은 값
  const uk = { cv: null };
  function uniInit() {
    if (!uk.f) {
      uk.f = document.createElementNS(NS, "filter");
      uk.f.id = "dbackUniGlass";
      for (const [k, v] of Object.entries({ x: 0, y: 0, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" })) uk.f.setAttribute(k, v);
      uk.im = document.createElementNS(NS, "feImage");
      for (const [k, v] of Object.entries({ x: 0, y: 0, preserveAspectRatio: "none", result: "map" })) uk.im.setAttribute(k, v);
      uk.dm = document.createElementNS(NS, "feDisplacementMap");
      for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "map", xChannelSelector: "R", yChannelSelector: "G", result: "bent" })) uk.dm.setAttribute(k, v);
      const bl = document.createElementNS(NS, "feGaussianBlur");
      bl.setAttribute("in", "bent");
      bl.setAttribute("stdDeviation", GLASS_BLUR);
      const lf = document.createElementNS(NS, "filter");     // 안쪽 빛 흐림 (inset 7px → σ 3.5)
      lf.id = "dbackUniLight";
      for (const [k, v] of Object.entries({ x: "-20%", y: "-50%", width: "140%", height: "200%" })) lf.setAttribute(k, v);
      lf.innerHTML = '<feGaussianBlur stdDeviation="3.5"/>';
      uk.f.append(uk.im, uk.dm, bl);
      glassDefs.append(uk.f, lf);
    }
    uk.S = Math.ceil((U_MAG * bk.Wb / 2 + U_RIM) * 2 + 4);   // 바 맵과 같은 부호화 범위
    uk.dm.setAttribute("scale", uk.S * 1.6);
    uk.light = bk.uni.querySelector("path");
    // 그림자 (화면 맨 위 multiply 레이어) — 몸체 밖에만
    if (uk.sh) uk.sh.remove();
    uk.sh = document.createElementNS(NS, "svg");
    uk.sh.setAttribute("class", "dback__uni-shadow");
    uk.sh.setAttribute("overflow", "visible");
    uk.sh.innerHTML = '<defs><filter id="dbackUniSh" filterUnits="userSpaceOnUse" x="-60" y="-60" width="2000" height="300"><feGaussianBlur stdDeviation="4"/></filter>' +
      '<mask id="dbackUniShM" maskUnits="userSpaceOnUse" x="-100" y="-100" width="2200" height="400"><path class="m" fill="#fff" fill-rule="evenodd"/></mask></defs>' +
      '<g mask="url(#dbackUniShM)"><path class="s" fill="rgba(193,193,193,.5)" stroke="rgba(193,193,193,.5)" stroke-width="6" stroke-linejoin="round" transform="translate(5 8)" filter="url(#dbackUniSh)"/></g>';
    uk.sh.style.display = "none";
    // 그림자 전용 multiply 레이어 — 푸터가 덮여 일반 그림자 레이어(.mul-shadows)가 꺼진 동안에도 통유리 그림자는 그대로
    if (!uk.layer) {
      uk.layer = document.createElement("div");
      uk.layer.className = "dback-sh-layer";
      uk.layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(uk.layer);
    }
    uk.layer.appendChild(uk.sh);
    uniOff();
  }
  function uniOff() {
    if (!bk.uni) return;
    bk.uni.style.display = "none";
    if (uk.sh) uk.sh.style.display = "none";
    bk.bar.classList.remove("is-unified");
    bk.btn.classList.remove("is-unified");
    bk.uniOn = false;
  }
  // 현재 상태의 모양 (목 상자 좌표 = gnb 안 px)
  function uniShape() {
    const { Lb, Wb, Hb, FINAL } = bk, R = NECK_R, C = Hb / 2;
    const bubR = FINAL + BK_W + bk.dx, bubW = BK_W * (1 + bk.sq), bubL = bubR - bubW, bubH = C * (1 - bk.sq * 0.5);
    const barR = Lb + Wb, barW = bk.barW * (1 + bk.wob), barL = barR - barW, barH = C * (1 - bk.wob * 0.7);
    const g = barL - bubR;
    const n0 = bubR - R, n1 = barL + R;                      // 목: 물방울 위 평평한 끝 → 바 위 평평한 시작
    // 허리 잘록함: 늘어날수록 부드럽게(smoothstep) 조이되 최소 두께(≈ 8px)는 남김 — 끊기기 직전 얇은 실 모양에서 픽셀이 튀지 않게
    const tight = 1 - bk.neckK, ease = tight * tight * (3 - 2 * tight);
    const sag = n1 > n0 ? Hb * 0.84 * ease * clamp01(g / 2) : 0;
    return { R, C, bubL, bubR, bubH, barL, barR, barH, n0, n1, sag, L: Math.min(bubL, barL), Rt: barR };
  }
  const rrHalf = (x, a, b, half, R) => {                     // 둥근 사각형의 x 에서 반 두께 (밖이면 −1)
    if (x < a || x > b) return -1;
    const e = Math.min(x - a, b - x);
    return e >= R ? half : half - R + Math.sqrt(Math.max(R * R - (R - e) * (R - e), 0));
  };
  // 부드러운 합집합 (smooth max): 목과 몸체가 만나는 곳에 꺾인 모서리(장력이 몰려 픽셀이 튀는 곳) 대신 둥근 이음
  const SMAX_K = 6;
  const smax = (a, b, k = SMAX_K) => {
    if (a < 0) return b; if (b < 0) return a;
    const h = clamp01(0.5 + 0.5 * (a - b) / k);
    return b + (a - b) * h + k * h * (1 - h) * 0.5;
  };
  // 목의 바탕 두께: 원래 높이(C)가 아니라 지금 눌려 있는 물방울 → 바 두께를 이어 줌
  //  (바 · 물방울이 출렁이며 세로로 줄어든 동안 목만 원래 높이로 남아 위아래로 직사각형처럼 튀어나오지 않게)
  const neckBase = (sh, u) => sh.bubH + (sh.barH - sh.bubH) * u;
  function uniHalf(sh, x) {
    const hb = rrHalf(x, sh.bubL, sh.bubR, sh.bubH, sh.R), hr = rrHalf(x, sh.barL, sh.barR, sh.barH, sh.R);
    let h = smax(hb, hr), lim = Math.max(hb, hr);
    if (x >= sh.n0 && x <= sh.n1 && sh.n1 > sh.n0) {
      const u = (x - sh.n0) / (sh.n1 - sh.n0), nb = neckBase(sh, u);
      h = smax(h, nb - 2 * u * (1 - u) * sh.sag);
      lim = Math.max(lim, nb);
    }
    return Math.min(h, lim);                                   // 둥근 이음이 몸체 · 목의 외곽보다 바깥으로 부풀지 않게 — 하나의 외곽선 안
  }
  // 하나의 닫힌 외곽선 (uni 상자 기준 좌표): 위 (왼 → 오) + 아래 (오 → 왼)
  function uniPath(sh) {
    const xs = [];
    const W = sh.Rt - sh.L;
    for (let x = 0; x <= W + 1e-6; x += 0.5) xs.push(Math.min(x, W));
    const fine = (e0) => { for (let x = e0; x < e0 + 2; x += 0.1) xs.push(x); };   // 양 끝 세로 호는 촘촘히
    fine(0); fine(W - 2);
    xs.sort((p, q) => p - q);
    const top = [];
    for (const x of xs) {
      const h = uniHalf(sh, sh.L + x);
      if (h < 0) continue;
      const y = sh.C - h;
      const n = top.length;
      if (n >= 2 && Math.abs(top[n - 1][1] - y) < 0.01 && Math.abs(top[n - 2][1] - y) < 0.01) top[n - 1][0] = x;   // 평평한 구간은 한 줄
      else top.push([x, y]);
    }
    const f = (v) => v.toFixed(2);
    let d = `M${f(top[0][0])},${f(sh.C)} `;
    for (const [x, y] of top) d += `L${f(x)},${f(y)} `;
    d += `L${f(top[top.length - 1][0])},${f(sh.C)} `;
    for (let i = top.length - 1; i >= 0; i--) d += `L${f(top[i][0])},${f(2 * sh.C - top[i][1])} `;
    return d + "Z";
  }
  // 굴절 맵: 이 외곽선만 테두리로 — 각 몸체(물방울 · 목 · 바) 깊이 중 가장 깊은 값 (합집합 안쪽 이음매엔 테두리가 생기지 않음)
  //  가운데 확대는 물방울 → 바 중심으로 목을 따라 부드럽게 이어짐
  function uniMap(sh, W, H) {
    const MW = Math.max(2, Math.ceil(W)), MH = Math.ceil(H);    // 원래 해상도 (반 해상도는 가장자리 굴절이 계단처럼 보임)
    if (!uk.cv) uk.cv = document.createElement("canvas");
    const cv = uk.cv;
    cv.width = MW; cv.height = MH;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(MW, MH), d = img.data, S = uk.S;
    const cBub = (sh.bubL + sh.bubR) / 2, cBar = (sh.barL + sh.barR) / 2;
    const rr = (x, y, a, b, half, R, o) => {
      const px = x - (a + b) / 2, py = y - sh.C, hw = (b - a) / 2;
      const qx = Math.abs(px) - (hw - R), qy = Math.abs(py) - (half - R);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), out = Math.hypot(ox, oy);
      const depth = R - out - Math.min(Math.max(qx, qy), 0);
      if (depth <= o.d) return;
      o.d = depth;
      if (out > 0) { o.nx = Math.sign(px) * ox / out; o.ny = Math.sign(py) * oy / out; }
      else if (qx > qy) { o.nx = Math.sign(px); o.ny = 0; }
      else { o.nx = 0; o.ny = Math.sign(py); }
    };
    const o = { d: 0, nx: 0, ny: 0 };
    const span = sh.n1 - sh.n0;
    for (let j = 0; j < MW; j++) {
      const x = sh.L + (j + 0.5) * W / MW;
      let nh = -1, nsl = 0;
      if (span > 0 && x >= sh.n0 && x <= sh.n1) {
        const u = (x - sh.n0) / span;
        nh = neckBase(sh, u) - 2 * u * (1 - u) * sh.sag;
        nsl = -(2 * sh.sag * (1 - 2 * u)) / span;            // 반 두께의 기울기
      }
      const sm = span > 0 ? clamp01((x - sh.n0) / span) : (x < (sh.n0 + sh.n1) / 2 ? 0 : 1);
      const cx = cBub + (cBar - cBub) * sm * sm * (3 - 2 * sm);
      for (let i = 0; i < MH; i++) {
        const y = (i + 0.5) * H / MH;
        o.d = -1e9;
        rr(x, y, sh.bubL, sh.bubR, sh.bubH, sh.R, o);
        rr(x, y, sh.barL, sh.barR, sh.barH, sh.R, o);
        if (nh > 0) {
          const py = y - sh.C, ln = Math.hypot(nsl, 1), dep = (nh - Math.abs(py)) / ln;
          if (dep > o.d) { o.d = dep; o.nx = -nsl / ln * 1; o.ny = Math.sign(py || 1) / ln; }
        }
        let dx = -(x - cx) * U_MAG, dy = -(y - sh.C) * U_MAG;
        if (o.d > 0 && o.d < U_BEZEL) {
          const t = 1 - o.d / U_BEZEL, k = U_RIM * t * t;
          dx -= o.nx * k; dy -= o.ny * k;
        }
        const q = (i * MW + j) * 4;
        d[q] = Math.min(255, Math.max(0, Math.round(255 * (dx / S + 0.5))));
        d[q + 1] = Math.min(255, Math.max(0, Math.round(255 * (dy / S + 0.5))));
        d[q + 2] = 128; d[q + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }
  function updNeck() {
    const { btn, uni, Hb, Tb } = bk;
    if (!uni) return;
    const on = btn.classList.contains("is-shown") && bk.neckK > 0;
    if (!on) { if (bk.uniOn) uniOff(); return; }
    if (!bk.uniOn) {
      bk.uniOn = true;
      bk.bar.classList.add("is-unified");                  // 실제 바 · 물방울은 글자 · 화살표만 (유리 몸체는 통유리가)
      btn.classList.add("is-unified");
      uni.style.display = "block";
    }
    const sh = uniShape(), W = sh.Rt - sh.L, H = Hb;
    const path = uniPath(sh);
    uni.style.left = `${sh.L.toFixed(2)}px`;
    uni.style.top = `${Tb}px`;
    uni.style.width = `${W.toFixed(2)}px`;
    uni.style.height = `${H}px`;
    uni.style.clipPath = `path('${path}')`;
    // 실제 바에 남아 있는 호버 변형(떠오름 · 커짐 · 기울기 — js/glass.js)을 통유리에도 같은 기준점(바 오른쪽 가운데)으로 —
    //  호버 중에 눌러도 통유리 외곽이 실제 바와 어긋나 튀어나오지 않고, 끊길 때 실제 바로 바뀌어도 자리가 그대로
    const bs = bk.bar.style;
    if (uni._tr !== bs.translate + bs.rotate + bs.scale) {
      uni._tr = bs.translate + bs.rotate + bs.scale;
      uni.style.translate = bs.translate; uni.style.rotate = bs.rotate; uni.style.scale = bs.scale;
    }
    uni.style.transformOrigin = `${(bk.Lb + bk.Wb - sh.L).toFixed(2)}px ${H / 2}px`;
    // 굴절 맵: 새 맵이 디코드된 뒤에 크기와 함께 한 번에 바꿈 (디코드 전 빈 맵이 한 프레임 끼어 가장자리 픽셀이 튀지 않게)
    const url = uniMap(sh, W, H), seq = (uk.seq = (uk.seq || 0) + 1);
    const swap = () => {
      if (seq < (uk.shown || 0)) return;
      uk.shown = seq;
      uk.f.setAttribute("width", W.toFixed(2)); uk.f.setAttribute("height", H);
      uk.im.setAttribute("width", W.toFixed(2)); uk.im.setAttribute("height", H);
      uk.im.setAttribute("href", url);
    };
    if (!uk.im.getAttribute("href")) swap();
    else { const pre = new Image(); pre.src = url; pre.decode().then(swap, swap); }
    uni.style.backdropFilter = "url(#dbackUniGlass)";
    uni.style.webkitBackdropFilter = `blur(${GLASS_BLUR * 2}px)`;
    // 안쪽 빛: 바깥(큰 사각형 − 경로)을 오른쪽 아래 2 · 3 으로 밀어 흐린 것 → 경로 안 테두리를 따라서만 맺힘
    uk.light.setAttribute("d", `M-60,-60 H${(W + 60).toFixed(2)} V${H + 60} H-60 Z ${path}`);
    // 그림자: GNB 상자 기준으로 자리를 잡음 (통유리 상자의 호버 변형 · 반올림에 흔들리지 않게) — 소수점 그대로
    const gr = bk.gnb.getBoundingClientRect();
    if (gr.width) {
      const z = gr.width / bk.gnb.offsetWidth;
      uk.sh.style.cssText = `display:block; position:absolute; left:0; top:0; width:${W.toFixed(2)}px; height:${H}px; overflow:visible; ` +
        `transform:translate3d(${(gr.left + sh.L * z).toFixed(2)}px, ${(gr.top + Tb * z).toFixed(2)}px, 0) scale(${z.toFixed(4)}); transform-origin:0 0;`;
      uk.sh.querySelector(".s").setAttribute("d", path);
      uk.sh.querySelector(".m").setAttribute("d", `M-100,-100 H${(W + 100).toFixed(2)} V${H + 100} H-100 Z ${path}`);
    }
  }
  function morph() {}

  // 바 글자 원통: 지금 보이는 글자 → 새 글자 (돌아갈 때는 거꾸로)
  function labelCyl(from, to) {
    const p = bk.bar.querySelector("p");
    if (bk.label) { bk.label.remove(); bk.label = null; }
    const roll = p.querySelector(".roll");
    const H = p.offsetHeight || 31;
    if (bk.cyl) bk.cyl.remove();
    roll.style.visibility = "hidden";
    const mkFace = (t) => { const s = document.createElement("span"); s.textContent = t; return s; };
    bk.cyl = makeCyl(p, [mkFace(from), mkFace(to)], "x", H);
    bk.cyl.box.classList.add("bk-cyl--label");
    bk.cyl.box.style.filter = "url(#warpText)";
  }
  function labelStatic(text) {
    if (bk.cyl) { bk.cyl.remove(); bk.cyl = null; }
    const lab = document.createElement("span");
    lab.className = "bk-label";
    lab.textContent = text;
    bk.bar.querySelector("p").appendChild(lab);
    bk.label = lab;
  }

  function backToggle() {
    if (!bk.bar) return;
    if (bk.state === "closed") backOpen();
    else if (bk.state === "open") backClose();
  }

  // 바 속(왼쪽 안쪽)에 포개져 있던 물방울이 0.55초 cubic-bezier(0.22, 1, 0.36, 1) 로 왼쪽으로 끌려 나오며
  // Gooey 목이 끈적하게 늘어났다 '톡' 끊김 — 바도 물방울 쪽으로 끌려 늘어났다가 끊기는 순간 출렁이며 제자리
  // 끊기는 즈음 화살표가 opacity 0 · scale .5 · −180° → 1 · 1 · 0° 로 돌며 나타남 (CSS transition)
  const OUT_MS = 550;
  const bez = (x1, y1, x2, y2) => (t) => {                // CSS cubic-bezier 와 같은 곡선
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
  const WOB = { stiffness: 0.09, damping: 0.11, mass: 1 };    // 바 출렁임 (덜 감쇠 — 여러 번 일렁임)
  function backOpen() {
    const my = ++bk.gen;
    bk.state = "opening";
    window.glassLock && window.glassLock(true);
    const isNext = nextShown();
    bk.btn.classList.toggle("is-next", isNext);                       // Next 상태(푸터 위)에서는 화살표 흰색
    const shown = isNext ? "Next" : (bk.bar.querySelector(".roll__old")?.textContent || "").trim();
    bk.to = isNext ? "Home" : "Project";
    bk.from = shown;
    labelCyl(shown, bk.to);
    bkLayout();
    bk.btn.classList.add("is-shown");
    bk.btn.classList.remove("is-arrow");
    morph(true);
    bk.bar.style.transformOrigin = "100% 50%";   // 왼쪽 끝이 물방울 쪽으로 늘어남
    const w = { x: 0, v: 0 };
    let snapped = false, tSnap = 0, tN = 0;
    bk.neckK = 1;
    const t0 = performance.now();
    function step(now) {
      if (my !== bk.gen) return;
      const t = (now - t0) / 1000;
      const k = clamp01((now - t0) / OUT_MS), e = easeOutGoo(k);
      const dx = bk.OFF * (1 - e);
      setBarW(bk.Wb + (bk.W1 - bk.Wb) * e);                           // 좁은 화면: 바가 같은 곡선으로 328 까지 줄며 물방울 자리를 내줌
      // 바: 물방울이 붙어 있는 동안(목이 이어진 동안) 그쪽으로 끌려 늘어나고, 끊기면 튕기며 출렁
      const gap = barGap(dx);                                          // 바 왼쪽 끝 ~ 물방울 오른쪽 끝
      // 목: 물방울이 바 밖으로 나온 뒤 NECK_MS 동안 끈적하게 가늘어지다 끊김
      if (!snapped) { if (barGap(dx, w.x) >= 0 && !tN) tN = now;   // 실제 틈 (바가 끌려 늘어난 만큼 뺌)
        bk.neckK = tN ? 1 - clamp01((now - tN) / NECK_MS) : 1; }
      else bk.neckK = 0;
      setDrop(dx, k < 1 ? 0.12 * Math.sin(Math.PI * k) : 0);         // 끌려가는 동안 가로로 늘어남
      if (!snapped && bk.neckK <= 0) { snapped = true; tSnap = now; bk.btn.classList.add("is-arrow"); w.v -= 0.012; }
      const pull = snapped ? 0 : 0.045 * clamp01((gap + BK_W * 0.6) / (BK_W * 0.6 + 16)) * bk.neckK ** 0.6;   // 목이 가늘어지는 만큼 바가 놓아줌 → 틈이 벌어지며 목이 늘어남
      w.v += (WOB.stiffness * (pull - w.x) - WOB.damping * w.v) / WOB.mass;
      w.x += w.v;
      setBarWob(w.x);
      const rl = clamp01((t - 0.05) / 1.0), el = easeIO3(rl);
      bk.cyl.set(el);
      warpDisp.setAttribute("scale", (14 * Math.sin(Math.PI * el)).toFixed(2));
      const done = k >= 1 && snapped && now - tSnap > 400 && Math.abs(w.x) < 0.0008 && Math.abs(w.v) < 0.0004 && rl >= 1;
      if (!done) { requestAnimationFrame(step); return; }
      setDrop(0); setBarWob(0);
      bk.btn.style.transform = "";
      bk.bar.style.transformOrigin = "";
      warpDisp.setAttribute("scale", "0");
      labelStatic(bk.to);
      morph(false);
      if (bk.narrow) detailGlass(bk.bar);                             // 줄어든 폭에 맞는 굴절 맵
      bk.state = "open";
      window.glassLock && window.glassLock(false);
    }
    requestAnimationFrame(step);
  }

  // 되돌아 들어감 (역재생): 화살표가 거꾸로 돌아 사라지고 → 물방울이 바 쪽으로 끌려가 Gooey 목으로 다시 붙어 바 속에 포개짐
  //   붙는 순간 바도 출렁. keepLabel: 바 글자(Project · Home)는 그대로 — 화살표를 눌러 떠날 때
  function backClose(instant, keepLabel, after) {
    if (!bk.bar || bk.state === "closed") return;
    const my = ++bk.gen;
    const finish = () => {
      bk.neckK = 0;
      const wasNarrow = bk.barW !== bk.Wb;
      setBarW(bk.Wb);
      setDrop(bk.OFF); setBarWob(0);
      if (wasNarrow) detailGlass(bk.bar);
      bk.bar.style.transformOrigin = "";
      morph(false);
      bk.btn.classList.remove("is-shown", "is-arrow");
      bk.btn.style.transform = "";
      warpDisp.setAttribute("scale", "0");
      if (!keepLabel) {
        if (bk.cyl) { bk.cyl.remove(); bk.cyl = null; }
        if (bk.label) { bk.label.remove(); bk.label = null; }
        const roll = bk.bar.querySelector(".roll"); if (roll) roll.style.visibility = "";
      }
      bk.state = keepLabel ? "merged" : "closed";
      window.glassLock && window.glassLock(false);
      after && after();
    };
    if (instant) { finish(); return; }
    bk.state = "closing";
    window.glassLock && window.glassLock(true);
    bk.btn.classList.remove("is-arrow");
    morph(true);
    bk.bar.style.transformOrigin = "100% 50%";
    if (!keepLabel) labelCyl(bk.to, bk.from);
    const w = { x: 0, v: 0 };
    let joined = false, tN = 0;
    bk.neckK = 0;
    const t0 = performance.now(), DELAY = 160;
    function step(now) {
      if (my !== bk.gen) return;
      const t = (now - t0) / 1000;
      const k = clamp01((now - t0 - DELAY) / OUT_MS), e = easeOutGoo(k);
      const dx = bk.OFF * e;
      setBarW(bk.W1 + (bk.Wb - bk.W1) * e);                           // 좁은 화면: 바가 다시 402 로 늘며 물방울을 품음
      const gap = barGap(dx);
      // 목: 가까워지면 가는 실로 맺혀 굵어지며 하나로 이어짐
      if (barGap(dx, w.x) < NECK_SNAP) { if (!tN) tN = now; bk.neckK = clamp01((now - tN) / 160); } else bk.neckK = 0;
      setDrop(dx, k > 0 && k < 1 ? 0.1 * Math.sin(Math.PI * k) : 0);
      if (!joined && gap < 12) { joined = true; w.v += 0.014; }          // 다시 붙는 순간 바가 '출렁'
      w.v += (WOB.stiffness * (0 - w.x) - WOB.damping * w.v) / WOB.mass;
      w.x += w.v;
      setBarWob(w.x);
      let rl = 1;
      if (!keepLabel && bk.cyl) {
        rl = clamp01(t / 0.9);
        const el = easeIO3(rl);
        bk.cyl.set(el);
        warpDisp.setAttribute("scale", (14 * Math.sin(Math.PI * el)).toFixed(2));
      }
      if (k >= 1 && rl >= 1 && Math.abs(w.x) < 0.0008 && Math.abs(w.v) < 0.0004) { finish(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // 화살표: 방울이 바 속으로 되돌아 하나로 합쳐진 뒤(역재생) → 처음 화면 배경이 위에서 바 '뒤로' 슬라이드인으로 덮고
  //         → Project 면 프로젝트 목록(같은 자리의 Project 바로 이어짐), Home 이면 처음 화면
  function backGo() {
    if (bk.state !== "open") return;
    bk.state = "leaving";
    const toHome = bk.to === "Home";
    if (toHome && nextHome) {
      // 푸터(Next) → Home: 방울이 바 속으로 합쳐지고 → 목록 · AHYUN · Find me 역재생 → 바가 처음 화면 Hello 자리로 (글자 Home → Hello 3D 원통)
      backClose(false, true, () => nextHome(flyBackHome));
      return;
    }
    backClose(false, true, () => {
      const cover = document.createElement("div");
      cover.className = "dback-cover";
      detail.appendChild(cover);                          // 상세 페이지 안 — 위 바(z 15) 뒤, 본문 위
      document.body.classList.add("dback-going");          // 본문 그림자 레이어 숨김 (바 그림자는 바 자체로)
      const a = cover.animate([
        { transform: "translate3d(0, calc(-100% - 40px), 0)", borderRadius: "0 0 40px 40px" },
        { transform: "translate3d(0, 0, 0)", borderRadius: "0 0 0 0" },
      ], { duration: 950, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
      a.onfinish = () => {
        backClose(true);
        leaveDetail();
        if (!toHome) window.ShowProjectList();
        clearDetail();
        document.body.classList.remove("dback-going");
      };
    });
  }

  // 바(Home)가 처음 화면 Hello 자리로 날아가며 글자는 Hello → Project 와 같은 3D 원통으로 Home → Hello, 닿으면 실제 Hello 로 교체
  //  상세 페이지(올리브 푸터가 덮은 모습)는 그대로 고정해 두고, 그 아래에 처음 화면을 준비 — 처음 화면도 올리브라 이어짐
  const FLY_MS = 1100;
  function flyBackHome() {
    const bar = bk.bar;
    window.glassLock && window.glassLock(true);
    leaveDetail();                                        // 상세 페이지를 지금 모습 그대로 고정 · 처음 화면을 처음 상태로
    const nav = document.getElementById("nav");
    nav.style.opacity = "0";                              // 날아온 바가 닿을 때까지 숨김
    const stage = document.getElementById("stage");
    const sr = stage.getBoundingClientRect(), s = sr.width / 1200;
    const k1 = Math.min(1, (innerWidth - 60) / 402);
    const tw = 402 * k1, th = 52 * k1;
    const tx = sr.left + 600 * s - tw / 2, ty = sr.top + 400 * s - th / 2;
    const r1 = bar.getBoundingClientRect();               // 고정된 뒤의 자리 (같아야 함)
    const z = r1.width / bar.offsetWidth;                 // 바가 받는 zoom
    const dx = (tx - r1.left) / z, dy = (ty - r1.top) / z, sc = tw / r1.width;
    bar.style.transformOrigin = "0 0";
    bar.style.translate = bar.style.scale = bar.style.rotate = "";
    if (bk.label) { bk.label.remove(); bk.label = null; }
    labelCyl("Home", "Hello");
    bk.cyl.set(0);
    const t0 = performance.now();
    const step = (now) => {
      const u = clamp01((now - t0) / FLY_MS), k = easeIO3(u);
      setT(bar, `translate3d(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px, 0) scale(${(1 + (sc - 1) * k).toFixed(4)})`);
      const rl = clamp01((now - t0 - 80) / 700), el = easeIO3(rl);   // 원통 회전 0.7초
      bk.cyl.set(el);
      warpDisp.setAttribute("scale", (14 * Math.sin(Math.PI * el)).toFixed(2));
      if (u < 1 || rl < 1) { requestAnimationFrame(step); return; }
      warpDisp.setAttribute("scale", "0");
      nav.style.opacity = "";                             // 같은 자리 · 모양의 처음 Hello 로 교체
      clearDetail();
      bk.state = "closed";
      window.glassLock && window.glassLock(false);
    };
    requestAnimationFrame(step);
  }

  // ---------- 상세 페이지 페이지 표시 (Figma 122:933): Overview · Strategy · Execution ----------
  //  표지 아래 끝이 화면 세로 가운데보다 40 더 올라가면 왼쪽 30 · 세로 가운데에 하나씩 '뽀용' 나타남, 다시 올라가면 거꾸로 들어감
  //  섹션 = 40px 제목(font-wood) 순서대로 3개 (Framer · RealWorld 는 Strategy 와 같은 양식의 제목 프레임들)
  //  섹션 제목이 화면 가운데를 지나면 그 칸이 Onpage — 메인 페이지와 같은 움직임 (방울이 맺혀 퍼짐 / 빠르게 10 으로 줄며 Default 색)
  const dpager = document.getElementById("dpager");
  let DP_ITEMS = dpager ? [...dpager.querySelectorAll(".pager__item")] : [];
  const DP_POP = [
    { opacity: 0, transform: "scale(0.3, 0.55)", filter: "blur(1.6px)" },
    { opacity: 1, transform: "scale(0.34, 1.08)", filter: "blur(0.6px)", offset: 0.3 },
    { opacity: 1, transform: "scale(0.7, 1.02)", filter: "blur(0.2px)", offset: 0.58 },
    { opacity: 1, transform: "scale(1.02, 0.97)", filter: "blur(0px)", offset: 0.85 },
    { opacity: 1, transform: "scale(1, 1)", filter: "blur(0px)" },
  ];
  const DP_SHRINK = [{ opacity: 1, transform: "scaleX(1)" }, { opacity: 0, transform: "scaleX(0.5)" }];
  const DP_DOT_SHRINK = [{ opacity: 0, transform: "scaleX(2)" }, { opacity: 0.6, transform: "scaleX(1)" }];
  const DP_DOT_OUT = [{ opacity: 0.6, transform: "scaleX(1)" }, { opacity: 0, transform: "scaleX(1.8)" }];
  const DP_IN = [                                           // 칸 하나가 나타날 때 (물방울이 맺혀 부풂)
    { opacity: 0, transform: "scale(0.2, 0.4)", filter: "blur(1.4px)" },
    { opacity: 1, transform: "scale(1.08, 1.12)", filter: "blur(0.3px)", offset: 0.6 },
    { opacity: 1, transform: "scale(1, 1)", filter: "blur(0px)" },
  ];
  let dpOn = -1, dpShown = false;
  function dpSet(idx, instant) {
    if (idx === dpOn) return;
    const prev = dpOn;
    dpOn = idx;
    DP_ITEMS.forEach((b, i) => {
      const on = i === idx, was = i === prev;
      b.setAttribute("aria-current", on ? "true" : "false");
      if (!on && !was) return;
      const drop = b.querySelector(".pager__drop"), dot = b.querySelector(".pager__dot");
      drop.getAnimations().forEach((a) => a.cancel());
      dot.getAnimations().forEach((a) => a.cancel());
      if (instant) { drop.style.opacity = on ? "1" : "0"; dot.style.opacity = on ? "0" : "0.6"; return; }
      drop.style.opacity = dot.style.opacity = "";
      if (on) {
        drop.animate(DP_POP, { duration: 1200, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
        dot.animate(DP_DOT_OUT, { duration: 500, easing: "ease-out", fill: "both" });
      } else {
        const o = { duration: 320, easing: "cubic-bezier(.3,0,.2,1)", fill: "both" };
        drop.animate(DP_SHRINK, o);
        dot.animate(DP_DOT_SHRINK, o);
      }
    });
  }
  function dpShow(show) {
    if (show === dpShown) return;
    dpShown = show;
    DP_ITEMS.forEach((b, i) => {
      b.getAnimations().forEach((a) => a.cancel());
      if (show) {
        b.animate(DP_IN, { duration: 700, delay: i * 90, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" });
      } else {
        // 사라질 때: 나타날 때(DP_IN)의 역재생 — 같은 길이 · 거꾸로 된 곡선, 아래 칸부터 차례로
        b.animate(DP_IN, { duration: 700, delay: (DP_ITEMS.length - 1 - i) * 90, easing: "cubic-bezier(.3,.7,.3,1)", direction: "reverse", fill: "both" });
      }
    });
  }
  function initPager() {
    if (!dpager) return;
    const root = detail.querySelector(".detail__root");
    const cover = root && [...root.children].find((el) => !el.matches(".detail__gnb, .detail__tail, .detail__end"));
    const all = root ? [...root.querySelectorAll(".font-wood.text-\\[40px\\]")] : [];
    // 프로젝트마다 표시할 섹션 (제목 글자로 찾음) — 목록에 없는 페이지(RealWorld)는 같은 양식의 제목 프레임 앞에서부터 3개
    const SECS = {
      wello: ["Overview", "Strategy", "Design", "Execution"],
      northface: ["Overview", "Strategy", "Execution"],
      shuttlefit: ["Overview", "Strategy", "Execution"],
      framer: ["Overview", "METABALLTEXT", "Grid 3x2 Cube gallery", "Wave Liquid Hover"],   // Figma 234:3780 — 표지 · Overview 가 생겨 4칸
    }[detail.dataset.current];
    const named = SECS ? SECS.map((n) => all.find((h) => h.textContent.trim().toLowerCase() === n.toLowerCase())).filter(Boolean) : [];
    const heads = SECS && named.length === SECS.length ? named : all.slice(0, 3);
    // 칸 수를 섹션 수에 맞춤 (Wellow 4칸)
    while (DP_ITEMS.length < heads.length) {
      const b = DP_ITEMS[0].cloneNode(true);
      dpager.appendChild(b);
      DP_ITEMS.push(b);
    }
    DP_ITEMS.forEach((b, i) => { b.dataset.sec = i; b.setAttribute("aria-label", heads[i] ? heads[i].textContent.trim() : ""); });
    // 섹션 범위: 그 제목 프레임 위 ~ 다음 섹션 제목 프레임 위 (마지막은 본문 끝 = 끝 여유 구간 위)
    const frameOf = (h) => h.closest(".detail__frame") || h;
    const tail = detail.querySelector(".detail__tail");
    dpager.hidden = !(cover && heads.length);
    if (dpager.hidden) return;
    DP_ITEMS.forEach((b, i) => { b.style.display = i < heads.length ? "" : "none"; b.getAnimations().forEach((a) => a.cancel()); });
    dpShown = false;                                              // 처음엔 들어가 있는 상태 그대로 (깜빡이지 않게 바로)
    DP_ITEMS.forEach((b) => b.animate(DP_IN, { duration: 0, direction: "reverse", fill: "both" }));
    dpOn = 0; dpSet(-1, true);                                    // 처음엔 모두 Default
    DP_ITEMS.forEach((b, i) => {
      b.onclick = () => {
        const h = heads[i];
        if (!h) return;
        const frame = h.closest(".detail__frame") || h;
        scrollTo({ top: frame.getBoundingClientRect().top + scrollY - 110, behavior: "smooth" });
      };
    });
    const myGen = gen;
    (function tick() {
      if (myGen !== gen) return;
      requestAnimationFrame(tick);
      const vh = innerHeight;
      // 표지가 화면 가운데 + 40 을 지나면 나타나고, 푸터(끝 여유 구간 — Next 목록이 나오기 시작)에 들어가면 역재생으로 사라짐
      const show = cover.getBoundingClientRect().bottom < vh / 2 - 40 && !(tail && tail.getBoundingClientRect().top < vh);
      dpShow(show);
      if (!show) { if (dpOn !== -1) dpSet(-1, true); return; }     // 숨어 있는 동안은 모두 Default
      // 화면 가운데가 어느 섹션 범위 안에 있으면 그 칸만 Onpage, 어느 섹션에도 없으면(첫 섹션 전 · 마지막 섹션 뒤) 모두 Default
      const mid = vh / 2;
      const tops = heads.map((h) => frameOf(h).getBoundingClientRect().top);
      const end = tail ? tail.getBoundingClientRect().top : Infinity;
      let idx = -1;
      for (let i = 0; i < heads.length; i++) {
        const top = tops[i], bottom = i + 1 < heads.length ? tops[i + 1] : end;
        if (mid >= top && mid < bottom) { idx = i; break; }
      }
      dpSet(idx);
    })();
  }

  // ---------- 표지(1번 프레임): 화면(viewport) 높이에 맞춤 — 모든 상세 페이지 (Framer 도 표지가 생김), 화면 폭이 바뀌어도 늘 화면 높이 ----------
  //  본문은 zoom 으로 축소되므로 높이 = 화면 높이 / 축소 배율. 안의 절대 배치 요소: 가득 찬 것은 높이 100%,
  //  가운데에 놓인 것은 가운데 그대로, 아래쪽에 놓인 것은 아래에서의 거리 그대로
  const COVER_TOP = 30, COVER_BOTTOM = 20;
  function fitCover() {
    const root = detail.querySelector(".detail__root");
    const cover = root && [...root.children].find((el) => !el.matches(".detail__gnb, .detail__tail, .detail__end"));
    if (!cover) return;
    if (cover.dataset.cover === undefined) {
      const H0 = cover.offsetHeight;
      cover.dataset.cover = H0;
      for (const c of cover.children) {
        if (getComputedStyle(c).position !== "absolute") continue;
        const t = c.offsetTop, h = c.offsetHeight;
        if (Math.abs(h - H0) < 3 && t < 3) { c.style.top = "0"; c.style.height = "100%"; }
        else if (Math.abs(t + h / 2 - H0 / 2) < 6) { c.style.top = `calc(50% - ${(h / 2).toFixed(2)}px)`; }
        else if (t > H0 / 2) { c.style.bottom = `${(H0 - t - h).toFixed(2)}px`; c.style.top = "auto"; }
      }
      for (const img of cover.querySelectorAll(":scope > img")) img.style.height = "100%";
    }
    // 화면(뷰포트) 기준 여백 위 30 · 아래 20: 표지 = 화면 높이 − 50, 위로 30 띄움 (본문 zoom 만큼 나눠 둠)
    //  높이는 JS 의 innerHeight 대신 CSS 뷰포트 단위로 — 모바일에서 페이지가 잠깐 화면보다 넓어지면 브라우저가 레이아웃 뷰포트를
    //  키워 innerHeight 가 몇 배로 커지는 일이 있음. svh = 주소창이 보이는 상태의 화면 높이 (지원 안 하면 vh)
    const VH = CSS.supports("height", "100svh") ? "100svh" : "100vh";
    cover.style.height = `calc((${VH} - ${COVER_TOP + COVER_BOTTOM}px) / var(--dz, 1))`;
    cover.style.marginTop = `calc(${COVER_TOP}px / var(--dz, 1))`;
  }
  addEventListener("resize", () => { if (!detail.hidden) fitCover(); });

  // ---------- 그림자 잘림 풀기: 그림자를 가진 요소가 overflow 로 잘리는 조상 안에 있으면 그 조상의 잘림을 풀어 줌 ----------
  //  (이미지·둥근 모서리를 자르는 상자는 그대로 — 그림자가 있는 자식이 있는 상자만)
  function unclipShadows() {
    const root = detail.querySelector(".detail__root");
    if (!root) return;
    const outerShadow = (cs) => {
      if (/drop-shadow/.test(cs.filter)) return true;
      if (!cs.boxShadow || cs.boxShadow === "none") return false;
      return cs.boxShadow.split(/,(?![^(]*\))/).some((l) => !/inset/.test(l) && !/rgba\([^)]*,\s*0\)/.test(l));
    };
    for (const el of root.querySelectorAll("*")) {
      if (!outerShadow(getComputedStyle(el))) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === "visible" && ps.overflowY === "visible") continue;
        // 그림자(오른쪽·아래로 약 20, 왼쪽·위로 약 6)가 이 상자 밖으로 나가 잘릴 때만 풀어 줌
        const pr = p.getBoundingClientRect();
        if (r.right + 20 > pr.right || r.bottom + 20 > pr.bottom || r.left - 6 < pr.left || r.top - 6 < pr.top) {
          p.style.overflow = "visible";
          p.dataset.unclipped = "";
        }
      }
    }
  }

  // ---------- 3) 프레임: 아래에서 위로 슬라이드하며 등장 + 스크롤 damping 으로 떠 있음 ----------
  function initFrames() {
    const root = detail.querySelector(".detail__root");
    // 고정 바·스크롤 여유·바닥에 붙는 끝 프레임은 제외
    const frames = [...root.children].filter((el) =>
      !el.matches(".detail__gnb, .detail__tail, .detail__end") && el.offsetHeight > 0);
    frames.forEach((el) => el.classList.add("detail__frame"));
    const RISE = 120;                                       // 등장 시작 위치 (아래로 120px)
    const REVEAL = { stiffness: 0.012, damping: 0.22, mass: 1.6 };  // 아주 천천히 떠올라 부드럽게 멈춤 (약 1.6초)
    const FLOAT = { stiffness: 0.025, damping: 0.2, mass: 1.4 };    // 스크롤에 늦게 따라왔다 천천히 복귀
    const state = frames.map((el, i) => ({
      el, y: 0, v: 0, lag: 0.16 + (i % 3) * 0.05,
      shown: false, r: { x: 0, v: 0 },                     // r: 0 → 1 등장 진행
      cover: i === 0,                                      // 표지: 화면 아래에서 스케일업하며 올라옴 (로딩 바가 올라가는 동안)
      t: "", o: "",
    }));
    if (state[0]) state[0].el.style.transformOrigin = "50% 100%";
    const COVER_RISE = innerHeight * 0.45, COVER_S0 = 0.2;   // 표지 시작: 화면 높이 45% 아래, 20% 크기
    // 표지: 넘치지 않고 커지기만 함 — 0.8초 동안 부드럽게 감속하며 원래 크기(100%)에 닿고 끝
    const POP_UP = 0.8;
    function popAt(t) {                                          // t: 초 → 진행값 (1 = 원래 크기)
      if (t <= 0) return 0;
      if (t >= POP_UP) return 1;
      return 1 - Math.pow(1 - t / POP_UP, 3);                    // easeOutCubic
    }
    const COVER_AT = performance.now() + 550;                         // 배경색이 아래에서 절반쯤 올라온 뒤 튀어 오름
    let lastY = scrollY;
    const myGen = gen;

    function tick() {
      if (myGen !== gen) return;               // 다른 페이지로 바뀌면 정지
      requestAnimationFrame(tick);
      const dy = scrollY - lastY;
      lastY = scrollY;
      const vh = innerHeight;
      for (const s of state) {
        const box = s.el.getBoundingClientRect();
        const near = box.bottom > -200 && box.top < vh + 200;
        // 화면 아래 88% 지점에 닿으면 등장 시작
        // 표지는 위치와 상관없이 시간으로 (작게 화면 아래에 있어 위치 판정에 걸리지 않음)
        if (!s.shown && (s.cover ? performance.now() >= COVER_AT : box.top < vh * 0.88)) s.shown = true;
        // 위로 다시 올라가 이 프레임이 화면 아래로 완전히 내려가면 처음 상태로 — 다시 내려오면 또 슬라이드 업
        if (s.shown && !s.cover && box.top > vh + 10) { s.shown = false; s.r.x = 0; s.r.v = 0; }
        if (s.shown && s.cover && s.r.x !== 1) {
          s.r.x = popAt((performance.now() - COVER_AT) / 1000);
        } else if (s.shown && s.r.x !== 1) {   // 넘쳤다 돌아오는 출렁임까지 끝날 때까지
          const S = REVEAL;
          s.r.v += (S.stiffness * (1 - s.r.x) - S.damping * s.r.v) / S.mass;
          s.r.x += s.r.v;
          if (Math.abs(1 - s.r.x) < 0.001 && Math.abs(s.r.v) < 0.0005) s.r.x = 1;
        }
        if (near) {
          s.y += dy * s.lag;                               // 스크롤 반대 방향으로 살짝 밀렸다가
          s.y = Math.max(Math.min(s.y, 36), -36);
          s.v += (FLOAT.stiffness * (0 - s.y) - FLOAT.damping * s.v) / FLOAT.mass;
          s.y += s.v;                                       // 스프링으로 제자리
        } else {
          s.y = 0; s.v = 0;
        }
        const ty = s.y + (1 - s.r.x) * (s.cover ? COVER_RISE : RISE);
        const sc = s.cover ? COVER_S0 + (1 - COVER_S0) * s.r.x : 1;
        const t = Math.abs(ty) < 0.05 && Math.abs(sc - 1) < 0.0005 ? ""
          : `translate3d(0, ${ty.toFixed(2)}px, 0)${sc !== 1 ? ` scale(${sc.toFixed(4)})` : ""}`;
        const o = s.r.x >= 1 ? "" : Math.min(Math.max(s.r.x * 1.6, 0), 1).toFixed(3);
        if (t !== s.t) { s.el.style.transform = t; s.t = t; }
        if (o !== s.o) { s.el.style.opacity = o; s.o = o; }
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- 4) 마지막 Next: 스크롤 진행만큼 Project → Next, 목록이 물방울로 늘어남 ----------
  // 페이지 끝의 여유 구간(.detail__tail)을 스크롤하는 비율 p (0 → 1)로 진행, 위로 올리면 되돌아감
  function initNext() {
    const group = document.getElementById("nextGroup");
    const bar = document.getElementById("gnbBar");
    const list = document.getElementById("nextList");
    const tail = detail.querySelector(".detail__tail");
    if (!group || !bar || !list || !tail) return;
    detail.appendChild(group);                 // 변형되는 프레임 밖으로 — 화면 위 고정이 깨지지 않게
    const roll = bar.querySelector(".roll");
    const [oldW, newW] = roll.children;
    const warp = document.getElementById("warpDisp");
    const goo = group.querySelector(".next__goo");
    const blobBar = document.getElementById("nBlobBar");
    const blobList = document.getElementById("nBlobList");
    const LIST_W = list.offsetWidth, LIST_H = list.offsetHeight;
    blobList.style.height = `${LIST_H}px`;
    setT(blobBar, "none");

    // 푸터: 목록이 나오기 시작하면 함께 위에서 내려옴 → 다 내려오면 AHYUN 이 처음 화면처럼 수면 위로 떠오름
    //       목록에 마우스가 있으면 H 가로획 바가 물방울처럼 일렁임
    if (foot) {
      detail.appendChild(foot);
      foot.hidden = false;
      footShadow();
      window.FootAhyun && window.FootAhyun.reset();
    }
    // 올리브 배경: 로딩 화면의 색 프레임처럼 화면 가득(폭 제한 없음) 위에서 슬라이드인 (1.2초, 천천히 시작해 천천히 멈춤)
    //            위로 다시 스크롤하면 등장의 역재생 — AHYUN 이 거꾸로 가라앉은 뒤 배경이 같은 곡선을 거꾸로 올라감
    const FRAME_MS = 1200;                     // 들어올 때
    const FRAME_OUT_MS = 550;                  // 나갈 때 (빠르게 빠짐)
    let footT = 0, footAt = performance.now();
    let findK = 0;                             // Find me 스며 오름 (0 → 1, AHYUN 과 동시에)
    const FIND_MS = 900;
    const WOB = { stiffness: 0.03, damping: 0.3, mass: 1 };
    const wob = { x: 0, v: 0 };
    let listHover = false;
    let exiting = false, downY = 0;            // 나가는 중(되감기) · 다 내려온 뒤 가장 아래까지 내린 scrollY
    list.addEventListener("mouseenter", () => { listHover = true; });
    list.addEventListener("mouseleave", () => { listHover = false; });

    const ROLL_END = 0.25;                     // p 0 ~ 0.25 : 회전 전환
    const DROP = { stiffness: 0.05, damping: 0.16, mass: 1.1 };
    const SWELL = { stiffness: 0.045, damping: 0.22, mass: 1.3 };
    const ROLL = { stiffness: 0.08, damping: 0.4, mass: 1 };
    const rollS = { x: 0, v: 0 }, size = { x: 0, v: 0 }, pos = { x: -38, v: 0 }, swell = { x: 0, v: 0 };
    let listed = false, liquid = false;
    let nCyl = null;                           // 이름 → Next 원통 (도는 동안만)
    const nFace = (t) => { const f = document.createElement("span"); f.textContent = t; return f; };
    const myGen = gen;
    let lastWarp = 0;
    // Next 를 다시 누르면 목록이 처음처럼 '맺힘 → 떨어짐 → 부풂' 으로 다시 나옴 + Next 글자가 위로 굴러 같은 글자로
    let replayAt = null;
    const REPLAY_MS = 1000, SPIN_MS = 750;
    const label = roll.parentElement;
    nextShown = () => rollS.x > 0.5;
    // 푸터 → Home: 목록이 물방울로 줄어 바 속으로 되돌아 들어가고(등장의 역재생) AHYUN 은 가라앉고 Find me 는 마름 — 올리브 배경은 그대로
    const HOME_LIST_MS = 900;
    let homeAt = 0, homeQ = 1, homeCb = null, curQ = 0;
    nextHome = (cb) => { homeAt = performance.now(); homeQ = curQ; homeCb = cb; };
    nextReplay = () => {
      replayAt = performance.now();
      size.x = size.v = 0; pos.x = -38; pos.v = 0; swell.x = swell.v = 0;
      listed = false; list.classList.remove("is-in");
      label.style.transformOrigin = "50% 50% -10px";
      label.style.filter = "url(#warpText)";
    };

    function tick() {
      if (myGen !== gen) return;               // 다른 페이지로 바뀌면 정지
      requestAnimationFrame(tick);
      // 화면 기준 위치·높이 (본문이 zoom 으로 축소돼도 scrollY 와 같은 단위)
      const tr = tail.getBoundingClientRect();
      const tailTop = tr.top + scrollY;
      const start = tailTop - innerHeight;                  // 여유 구간이 화면 아래에 닿을 때부터
      const p = clamp01((scrollY - start) / Math.max(tr.height - innerHeight * 0.1, 1));

      // 회전 전환 (스크롤 목표를 스프링으로 따라감)
      step1D(rollS, clamp01(p / ROLL_END), ROLL);
      const r = clamp01(rollS.x);
      const bend = Math.sin(Math.PI * r);
      // 끝(0 · 1)에서는 원래 글자 그대로, 도는 동안만 처음 화면 Hello → Project 와 같은 3D 원통 왜곡 회전
      setT(oldW, r < 0.5 ? "none" : "rotateX(90deg)");
      setT(newW, r < 0.5 ? "rotateX(-90deg)" : "none");
      const turning = r > 0.001 && r < 0.999 && bk.state === "closed" && replayAt === null;
      if (turning) {
        if (!nCyl) {
          const p = roll.parentElement;
          nCyl = makeCyl(p, [nFace(oldW.textContent), nFace(newW.textContent)], "x", p.offsetHeight || 31);
          nCyl.box.classList.add("bk-cyl--label");
          nCyl.box.style.filter = "url(#warpText)";
          roll.style.visibility = "hidden";
        }
        nCyl.set(r);
      } else if (nCyl) {
        nCyl.remove(); nCyl = null;
        if (bk.state === "closed") roll.style.visibility = "";
      }
      // 왜곡은 이 회전이 움직일 때만 씀 — 멈춰 있을 때 매 프레임 0 을 쓰면 About · Home 분리 때의 글자 왜곡을 지워 버림
      const wv = turning ? 14 * bend : 0;
      if (Math.abs(wv - lastWarp) > 0.01) { warp.setAttribute("scale", wv.toFixed(2)); lastWarp = wv; }

      // 물방울: 맺힘(q 0~0.3) → 떨어짐(0.3~) → 패널로 부풂(0.45~1)
      let q = clamp01((p - ROLL_END) / (1 - ROLL_END));
      if (homeAt) {
        const e = clamp01((performance.now() - homeAt) / HOME_LIST_MS);
        q = Math.min(q, homeQ * (1 - e * e * (3 - 2 * e)));
      }
      curQ = q;
      if (replayAt !== null) {
        const now = performance.now();
        q = Math.min(q, clamp01((now - replayAt) / REPLAY_MS));   // 다시 나올 때는 시간에 따라 처음부터
        const r2 = clamp01((now - replayAt) / SPIN_MS);
        const e2 = r2 < 0.5 ? 4 * r2 * r2 * r2 : 1 - Math.pow(-2 * r2 + 2, 3) / 2;
        const b2 = Math.sin(Math.PI * e2);
        const st = Math.sin(Math.PI * clamp01((r2 - 0.72) / 0.28)) * (1 - r2) * 4;
        const pa = e2 < 0.5 ? 180 * e2 : -(180 * (1 - e2) - 10 * st);
        if (r2 < 1) {
          setT(label, `perspective(90px) rotateX(${pa.toFixed(2)}deg) scaleY(${(1 + 0.55 * b2).toFixed(3)})`);
          warp.setAttribute("scale", (22 * b2).toFixed(2)); lastWarp = 22 * b2;
        } else if (label._t !== "none") {
          setT(label, "none"); label.style.filter = ""; label.style.transformOrigin = "";
          warp.setAttribute("scale", "0"); lastWarp = 0;
        }
        if (now - replayAt > Math.max(REPLAY_MS, SPIN_MS)) replayAt = null;
      }
      step1D(size, q > 0.02 ? 56 : 0, SWELL);
      step1D(pos, q < 0.3 ? -38 : 0, DROP);
      step1D(swell, clamp01((q - 0.45) / 0.55), SWELL);
      const k = Math.max(swell.x, 0);
      const fall = Math.max(Math.min(pos.v * 0.03, 0.35), -0.2) * (1 - Math.min(k, 1));
      const d = Math.max(size.x, 0);
      const w = d + (LIST_W - d) * k, h = d + (LIST_H - d) * k;
      const sx = (w / LIST_W) * (1 - fall * 0.5), syl = (h / LIST_H) * (1 + fall);
      const rad = d / 2 + (20 - d / 2) * Math.min(k, 1);
      if (sx > 0.001 && syl > 0.001) {
        blobList.style.borderRadius = `${(rad / sx).toFixed(1)}px / ${(rad / syl).toFixed(1)}px`;
        setT(blobList, `translate3d(0, ${pos.x.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${syl.toFixed(4)})`);
      } else {
        setT(blobList, "scale(0)");
      }

      // 다 부풀면 실제 유리 목록, 덜 부풀었으면 액체 몸체
      const full = k > 0.97 && Math.abs(swell.v) < 0.004;
      const wet = !full && d > 0.5;
      if (full !== listed) { listed = full; list.classList.toggle("is-in", full); }

      // 푸터 프레임 (목록과 동시에, 스프링으로 끝까지 내려옴 · 목록이 들어가면 다시 올라감)
      if (foot) {
        const nowF = performance.now(), dtF = Math.min(nowF - footAt, 50);
        footAt = nowF;
        const FA = window.FootAhyun;
        const st = FA ? FA.state() : "hidden";
        // 다 내려온 상태에서 위로 조금(40px)만 올려도 나가기 시작 → 올리브가 화면을 덮고 있는 동안 '푸터 바로 위 프레임'
        // (끝 여유 구간 바로 위, 마지막 프레임 아래가 화면 바닥) 자리로 옮겨 두고, 다 걷힐 때까지 스크롤을 잠금
        if (!exiting && footT >= 1 && st === "open") {
          if (scrollY > downY) downY = scrollY;
          if (scrollY < downY - 40) {
            exiting = true;
            scrollLock = Math.max(tailTop - innerHeight, 0);
            window.scrollTo(0, scrollLock);
          }
        } else if (footT < 1 && !exiting) downY = scrollY;
        if (scrollLock !== null && Math.abs(scrollY - scrollLock) > 1) window.scrollTo(0, scrollLock);   // 스크롤바를 끌어도 그 자리
        if (exiting && footT <= 0 && st === "hidden") { exiting = false; scrollLock = null; downY = scrollY; }
        if (q > 0.02 && !exiting && !homeAt) {
          // 들어올 때: 올리브 배경이 위에서 화면 가득 슬라이드인 → 다 덮으면 AHYUN 이 떠오름
          // 들어올 때: 목록이 나오기 시작하면 AHYUN 도 같이 떠오름 (배경이 다 덮기를 기다리지 않음)
          footT = clamp01(footT + dtF / FRAME_MS);
          if (FA && (st === "hidden" || st === "sinking")) FA.open();
        } else if (FA && (st === "open" || st === "rising")) {
          FA.close();                                                // 나갈 때: 먼저 AHYUN 이 거꾸로 '슈룩' 가라앉고
        } else if (st === "hidden" && !homeAt) {
          footT = clamp01(footT - dtF / FRAME_OUT_MS);               // 다 가라앉은 뒤 배경이 같은 곡선을 거꾸로, 빠르게 올라감
        }
        const fe = footT < 0.5 ? 2 * footT * footT : 1 - Math.pow(-2 * footT + 2, 2) / 2;
        setT(footFrame, footT >= 1 ? "none" : `translate3d(0, calc(${(-(1 - fe) * 100).toFixed(3)}% - ${(40 * (1 - fe)).toFixed(2)}px), 0)`);
        // 배경이므로 다 덮을 때 아래 모서리도 펴짐 (마지막 15% 동안 40 → 0, 나갈 때는 거꾸로)
        const fr = `0 0 ${(40 * clamp01((1 - fe) / 0.15)).toFixed(1)}px ${(40 * clamp01((1 - fe) / 0.15)).toFixed(1)}px`;
        if (footFrame._r !== fr) { footFrame.style.borderRadius = fr; footFrame._r = fr; }
        // 다 덮으면 뒤가 단색 올리브 → 진짜 multiply 그림자 레이어(mulshadow) 대신 미리 곱한 색 그림자로 (화면 전체 blend 비용 제거)
        const down = footT >= 1;
        if (down !== document.body.classList.contains("foot-down")) document.body.classList.toggle("foot-down", down);
        // Find me: AHYUN 이 떠오르는 동안 같이 스며 오르고, 가라앉으면 거꾸로 마름 (히어로와 같은 번짐)
        if (footFind) {
          const up = FA && (FA.state() === "open" || FA.state() === "rising");
          const nk = clamp01(findK + (up ? 1 : -1.6) * dtF / FIND_MS);
          if (nk !== findK) { findK = nk; window.HeroInk && window.HeroInk(footFind, findK); }
          footFind.classList.toggle("is-on", findK >= 1);
        }
        // H 가로획(AHYUN 글자): 목록 호버 동안 일렁일렁 — 세기만 스프링으로 넘김
        step1D(wob, listHover && listed ? 1 : 0, WOB);
        if (FA) FA.setWobble(Math.max(wob.x, 0));
      }
      if (wet !== liquid) {
        liquid = wet;
        bar.classList.toggle("is-liquid", wet);
        goo.classList.toggle("is-on", wet);
      }
      // Home 으로: 목록이 다 들어가고 AHYUN · Find me 가 다 사라지면 다음 단계(바가 Hello 자리로)
      if (homeCb && d < 0.5 && k < 0.02 && (!window.FootAhyun || window.FootAhyun.state() === "hidden") && findK <= 0) {
        const cb = homeCb; homeCb = null; cb();
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- 5) 위 Project/Next 바 클릭 → About · Home (Figma 33:737) ----------
  // 프로젝트 화면과 같은 바 · 같은 페이드. Home 은 글자가 Hello 로 왜곡 회전하며 처음 화면의 Hello 자리로 천천히 돌아감
  const dmenu = document.getElementById("dmenu");
  const dproj = document.getElementById("dproj");
  const dabout = document.getElementById("dabout");
  const dhome = document.getElementById("dhome");
  const MENU_MS = 380;
  let menu = "closed";                        // "closed" | "open" | "busy"

  const dGoo = dmenu.querySelector(".dmenu__goo");
  const dBlobBar = document.getElementById("dBlobBar");
  const dBlobProj = document.getElementById("dBlobProj");
  const dBlobAbout = document.getElementById("dBlobAbout");
  const dBlobHome = document.getElementById("dBlobHome");
  const NECKS = [["dBlobNeck1", "dTail1a", "dTail1b"], ["dBlobNeck2", "dTail2a", "dTail2b"], ["dBlobNeck3", "dTail3a", "dTail3b"]]
    .map((ids) => ids.map((id) => document.getElementById(id)));
  let menuAsNext = false;                      // 이번 메뉴가 Next 상태에서 열렸는지

  // 위 바에서 Hello 분리와 같은 효과로 About → Home 이 갈라져 나옴 (프로젝트 화면과 같은 움직임, 그동안 호버 효과 꺼 둠)
  // 위 바(프로젝트 이름 또는 Next) → Project → About → Home (간격 20px)
  function openMenu() {
    menu = "busy";
    window.glassLock && window.glassLock(true);
    menuAsNext = nextShown();
    dmenu.hidden = false;
    detail.classList.add("menu-open");         // 페이지 끝 Next 목록과 겹치지 않게 잠시 숨김
    const bar = document.getElementById("gnbBar");
    const items = [[dBlobProj, dproj], [dBlobAbout, dabout], [dBlobHome, dhome]]
      .map(([blob, b], i) => {
        b.style.top = `${19 + 72 * (i + 1)}px`;                   // 바 자리 (바 52 + 간격 20)
        blob.style.top = `${68.5 + 72 * (i + 1)}px`;              // 액체 레이어 안 같은 자리
        return { blob, bar: b };
      });
    for (const it of items) detailGlass(it.bar);
    window.DripMenu({
      goo: dGoo, barBlob: dBlobBar, liquidBar: bar, liquidClass: "is-drip", W: dmenu.offsetWidth,
      items, necks: NECKS.slice(0, items.length),
      done: () => setTimeout(() => { if (menu === "busy") menu = "open"; }, MENU_MS),
    });
  }
  function closeMenu(instant) {
    dproj.classList.remove("is-in");
    dabout.classList.remove("is-in");
    dhome.classList.remove("is-in");
    detail.classList.remove("menu-open");
    if (instant) { dmenu.hidden = true; menu = "closed"; return; }
    menu = "busy";
    setTimeout(() => { if (menu === "busy") { dmenu.hidden = true; menu = "closed"; } }, MENU_MS + 100);
  }

  // 위 바: 처음 누르면 Project · About · Home, 메뉴가 열린 상태에서 다시 누르면 메뉴를 닫음 (Next 상태면 Next 목록이 다시 나옴)
  // 메뉴가 열린 채 다른 곳을 누르면 메뉴만 닫힘
  // 위 바(프로젝트 이름 · Next)를 누르면 왼쪽에 화살표 방울이 갈라져 나옴 (Figma 33:743) — js 아래 '되돌아가기 방울'
  document.addEventListener("click", (e) => {
    if (detail.hidden) return;
    if (e.target.closest("#gnbBar")) { e.preventDefault(); backToggle(); return; }
    if (e.target.closest("#dback")) { e.preventDefault(); backGo(); return; }
    if (bk.state === "open") backClose();                 // 다른 곳을 누르면 방울이 다시 바로 들어감
  });
  // 메뉴의 Project → 프로젝트 목록 화면으로
  dproj.addEventListener("click", (e) => {
    e.preventDefault();
    if (menu === "open") toList();
  });

  // 상세 페이지를 지금 모습 그대로 화면에 고정하고(서서히 사라짐) 그 아래에 처음 화면 쪽을 준비
  function leaveDetail() {
    const y = scrollY;
    gen++;                                      // 프레임·Next 루프 정지
    Object.assign(detail.style, { position: "fixed", left: "0", right: "0", top: `${-y}px` });
    document.body.classList.remove("is-detail");
    window.scrollTo(0, 0);
    window.ResetMain();                          // 인트로·분리·프로젝트 화면 모두 처음 상태
  }
  function clearDetail() {
    parkFoot();
    dmenu.hidden = true;
    dmenu.classList.remove("is-home");
    dproj.classList.remove("is-in");
    dabout.classList.remove("is-in");
    dhome.classList.remove("is-in");
    detail.hidden = true;
    detail.innerHTML = "";
    detail.removeAttribute("style");
    detail.classList.remove("is-leaving", "menu-open");
    delete detail.dataset.current;
    menu = "closed";
  }

  // Project → 프로젝트 목록 화면: 상세 페이지가 서서히 사라지며 그 아래 목록이 드러남
  function toList() {
    menu = "busy";
    dproj.classList.remove("is-in");
    dabout.classList.remove("is-in");
    dhome.classList.remove("is-in");
    leaveDetail();
    window.ShowProjectList();
    requestAnimationFrame(() => detail.classList.add("is-leaving"));
    setTimeout(clearDetail, 850);
  }
  dabout.addEventListener("click", (e) => e.preventDefault());   // About 페이지는 아직 없음

  dhome.addEventListener("click", (e) => {
    e.preventDefault();
    if (menu !== "open" || !window.FlyHome) return;
    menu = "busy";
    window.glassRelease && window.glassRelease(dhome);
    dmenu.classList.add("is-home");
    const r = dhome.getBoundingClientRect();
    const from = { x: r.left, y: r.top, w: r.width, h: r.height };

    // 상세 페이지를 지금 보이는 모습 그대로 화면에 고정하고, 처음 화면을 그 아래에 준비
    leaveDetail();
    const nav = document.getElementById("nav");
    nav.style.opacity = "0";                     // 날아온 Home 바가 닿을 때까지 숨김
    requestAnimationFrame(() => detail.classList.add("is-leaving"));   // 상세 페이지가 서서히 사라짐

    window.FlyHome(dhome, from, () => {
      nav.style.opacity = "";                    // 같은 자리·모양의 처음 Hello 로 교체
      clearDetail();
    });
  });

  // ---------- 6) 상세 페이지 컴포넌트 유리: 첫 화면처럼 뒤 배경을 가장자리에서 굴절시키고 흐리게 ----------
  // 첫 화면은 WebGL 배경이 유리를 그리지만 상세 페이지는 배경이 HTML 이라, 같은 굴절 맵 + 흐림을 backdrop-filter 로
  // 크기별 SVG 필터 1개 (같은 크기 바는 공유)
  const NS = "http://www.w3.org/2000/svg";
  const glassDefs = document.querySelector("svg.defs");
  const glassFilters = {};
  const GLASS_BLUR = 7;                       // 첫 화면 유리의 흐림 정도에 맞춤
  function detailGlass(el) {
    if (!el || !window.glassMap) return;
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20;
    const key = `${w}x${h}x${r}`;
    if (!glassFilters[key]) {
      const map = window.glassMap(w, h, Math.min(r, h / 2));
      const id = `detailGlass${Object.keys(glassFilters).length + 1}`;
      const f = document.createElementNS(NS, "filter");
      f.id = id;
      for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse",
        primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" })) f.setAttribute(k, v);
      const im = document.createElementNS(NS, "feImage");
      for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" })) im.setAttribute(k, v);
      im.setAttribute("href", map.url);
      const dm = document.createElementNS(NS, "feDisplacementMap");
      for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "map", scale: map.S * 1.6, xChannelSelector: "R", yChannelSelector: "G", result: "bent" })) dm.setAttribute(k, v);
      const bl = document.createElementNS(NS, "feGaussianBlur");
      bl.setAttribute("in", "bent");
      bl.setAttribute("stdDeviation", GLASS_BLUR);
      f.append(im, dm, bl);
      glassDefs.appendChild(f);
      glassFilters[key] = id;
    }
    el.style.backdropFilter = `url(#${glassFilters[key]})`;
    el.style.webkitBackdropFilter = `blur(${GLASS_BLUR * 2}px)`;   // url() 을 못 쓰는 브라우저는 흐림만
  }
  window.DetailGlass = detailGlass;

  // ---------- 7) 가로 스크롤 영역: 트랙패드·가로 휠은 그대로, 마우스는 끌어서(놓으면 관성으로 미끄러짐) ----------
  // 반환값의 shift(d): 끄는 중에 스크롤 위치를 바꿔야 할 때(반복 되돌림) 기준점도 같이 옮김
  function dragScroll(el) {
    let down = false, x0 = 0, s0 = 0, lastX = 0, lastT = 0, v = 0, glide = 0, moved = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false;
      x0 = lastX = e.clientX; s0 = el.scrollLeft; lastT = performance.now(); v = 0;
      cancelAnimationFrame(glide);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* 포인터를 놓친 경우 무시 */ }
      el.classList.add("is-drag");
    });
    el.addEventListener("pointermove", (e) => {
      if (!down) return;
      const now = performance.now();
      el.scrollLeft = s0 - (e.clientX - x0);
      if (Math.abs(e.clientX - x0) > 3) moved = true;
      const dt = Math.max(now - lastT, 1);
      v = v * 0.6 + ((e.clientX - lastX) / dt) * 0.4;             // px/ms, 부드럽게
      lastX = e.clientX; lastT = now;
    });
    const up = () => {
      if (!down) return;
      down = false;
      el.classList.remove("is-drag");
      let vel = v * 16;                                            // px/frame
      const step = () => {
        if (Math.abs(vel) < 0.3) return;
        el.scrollLeft -= vel;
        vel *= 0.93;
        glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    // 끌고 난 뒤의 클릭은 무시 (메뉴 닫힘 등)
    el.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
    return { shift: (d) => { s0 += d; } };
  }

  // Wireframe 줄 (Figma 165:7252)
  function initWire() {
    for (const row of detail.querySelectorAll(".wire__row")) {
      const drag = dragScroll(row);
      // 처음 보이는 자리: 2번째 줄은 Figma 처럼 가운데 화면들, 나머지는 첫 화면이 x 56
      const startAt = row.dataset.start === "center" ? (row.scrollWidth - row.clientWidth) / 2 : 0;
      if (!("loop" in row.dataset)) {
        requestAnimationFrame(() => { row.scrollLeft = startAt; });
        continue;
      }
      // 끝없이 반복: 줄의 화면 한 벌을 앞뒤로 한 벌씩 더 놓고, 한 주기(한 벌 폭 + 간격 40)를 넘어가면 그만큼 되돌림
      // — 같은 화면이라 되돌려도 티 나지 않음
      const track = row.querySelector(".wire__track");
      const items = [...track.children];
      const first = items[0], last = items[items.length - 1];
      const period = last.offsetLeft + last.offsetWidth - first.offsetLeft + 40;
      const copy = () => items.map((n) => {
        const c = n.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        if (c.tagName === "IMG") c.alt = "";
        return c;
      });
      track.prepend(...copy());
      track.append(...copy());
      requestAnimationFrame(() => { row.scrollLeft = period + startAt; });   // 가운데 벌이 원래 자리에서 시작
      row.addEventListener("scroll", () => {
        let shift = 0;
        if (row.scrollLeft < period * 0.5) shift = period;
        else if (row.scrollLeft > period * 1.5) shift = -period;
        if (shift) { row.scrollLeft += shift; drag.shift(shift); }
      }, { passive: true });
    }
  }

  // ---------- 8) Mid-fi 파란 패널 (Figma 171:9581): 화면들 가로 스크롤 + 스크롤바가 함께 움직임 ----------
  // 스크롤바 막대를 끌거나 빈 곳을 눌러도 이동
  function initMidfi() {
    for (const panel of detail.querySelectorAll(".midfi")) {
      const sc = panel.querySelector(".midfi__scroll");
      const bar = panel.querySelector(".midfi__bar");
      const thumb = panel.querySelector(".midfi__thumb");
      dragScroll(sc);
      const range = () => Math.max(sc.scrollWidth - sc.clientWidth, 1);   // 스크롤할 수 있는 거리
      const room = () => bar.clientWidth - thumb.offsetWidth;            // 막대가 움직일 수 있는 거리
      const sync = () => setT(thumb, `translate3d(${(sc.scrollLeft / range() * room()).toFixed(1)}px, 0, 0)`);
      sc.addEventListener("scroll", sync, { passive: true });
      sync();
      // 막대 끌기 · 빈 곳 누르면 그 자리로
      let dragging = false, px0 = 0, sl0 = 0;
      bar.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (e.target !== thumb) {
          const x = e.clientX - bar.getBoundingClientRect().left - thumb.offsetWidth / 2;
          sc.scrollLeft = Math.min(Math.max(x / room(), 0), 1) * range();
        }
        dragging = true; px0 = e.clientX; sl0 = sc.scrollLeft;
        try { bar.setPointerCapture(e.pointerId); } catch (_) { /* 포인터를 놓친 경우 무시 */ }
      });
      bar.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        sc.scrollLeft = sl0 + (e.clientX - px0) * (range() / room());
      });
      const stop = () => { dragging = false; };
      bar.addEventListener("pointerup", stop);
      bar.addEventListener("pointercancel", stop);
    }
  }

  // ---------- 9) 다른 사이트를 그대로 넣은 프레임 (Framer 데모) ----------
  // 높이 = 폭 × 지금 브라우저 화면 비율 → 그 사이트를 이 화면에서 전체 화면으로 연 것과 같은 비율
  // (data-ratio 가 있는 프레임은 그 사이트 내용의 고정 비율)
  // 데모 안에서는 페이지 커스텀 커서를 숨김 (iframe 안의 마우스 움직임은 이 페이지가 받지 못하므로)
  function initEmbeds() {
    const frames = [...detail.querySelectorAll(".framer-embed")];
    if (!frames.length) return;
    const myGen = gen;
    const fit = () => {
      if (myGen !== gen) { removeEventListener("resize", fit); return; }
      for (const f of frames) {
        if ("fixed" in f.dataset) continue;          // Figma 크기 그대로인 임베드 (Wellow full view)
        // data-ratio 가 있으면 그 사이트 내용(이미지)의 고정 비율에 맞춤 — 내림해서 내용이 프레임보다 살짝이라도 커 여백이 안 보이게
        const r = parseFloat(f.dataset.ratio);
        f.style.height = r ? `${Math.floor(f.offsetWidth / r)}px` : `${Math.round(f.offsetWidth * innerHeight / innerWidth)}px`;
      }
    };
    fit();
    addEventListener("resize", fit);
    for (const f of frames) {
      f.addEventListener("mouseenter", () => document.body.classList.add("cursor-away"));
      f.addEventListener("mouseleave", () => document.body.classList.remove("cursor-away"));
    }
  }
})();
