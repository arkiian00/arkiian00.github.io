/* interaction_flow.gif 의 HTML 버전
   interaction.html 을 iframe 으로 불러와, GIF 와 같은 순서로 가상의 손가락 입력을 보내 무한 반복 재생한다.
   단어 → 상세 카드 → Quote → Full text → 요약 → 다시 전문 */
(() => {
  const frame = document.getElementById('stage');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  frame.addEventListener('load', async () => {
    const w = frame.contentWindow;
    const d = frame.contentDocument;
    await d.fonts.ready;

    // 배경 투명 (기기 프레임만 보이게)
    const style = d.createElement('style');
    style.textContent = `
      html, body { background: transparent !important; }
      #__touch {
        position: fixed; z-index: 99999; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border-radius: 50%; background: rgba(40, 40, 40, 0.18); border: 2px solid rgba(255, 255, 255, 0.9);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); pointer-events: none; opacity: 0;
        transition: opacity 0.15s, transform 0.15s;
      }
      #__touch.is-down { opacity: 1; transform: scale(0.85); }
    `;
    d.head.appendChild(style);

    // 손가락 위치 표시 점
    const dot = d.createElement('div');
    dot.id = '__touch';
    d.body.appendChild(dot);

    // 가상 입력은 직접 대상에 보내므로 실제 포인터 캡처는 쓰지 않음
    w.Element.prototype.setPointerCapture = function () {};
    w.Element.prototype.releasePointerCapture = function () {};

    // ── 가상 포인터 ──
    let target = null;
    let downAt = null;
    let pos = { x: 0, y: 0 };

    const fire = (type, el, x, y, buttons) => {
      el.dispatchEvent(new w.PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true,
        clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons,
      }));
    };
    const place = (x, y) => {
      pos = { x, y };
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    };
    const down = (x, y) => {
      place(x, y);
      target = d.elementFromPoint(x, y);
      downAt = { x, y };
      dot.classList.add('is-down');
      fire('pointerdown', target, x, y, 1);
    };
    const move = (x, y) => {
      place(x, y);
      fire('pointermove', target || d.elementFromPoint(x, y), x, y, target ? 1 : 0);
    };
    const up = () => {
      if (!target) return;
      const el = target;
      fire('pointerup', el, pos.x, pos.y, 0);
      if (Math.hypot(pos.x - downAt.x, pos.y - downAt.y) < 5) {
        el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, clientX: pos.x, clientY: pos.y }));
      }
      target = null;
      dot.classList.remove('is-down');
    };
    // 부드러운 드래그 (ease-in-out)
    const drag = async (from, to, ms, steps = 24) => {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
        await sleep(ms / steps);
      }
    };
    const tap = async (p) => { down(p.x, p.y); await sleep(80); up(); };

    // 요소 위치 (기기 축소 비율 k 포함)
    const phone = d.querySelector('.phone');
    const scale = () => phone.getBoundingClientRect().height / phone.offsetHeight || 1;
    const center = (sel, text) => {
      const els = [...d.querySelectorAll(sel)];
      const el = text ? els.find((e) => e.textContent === text) : els[0];
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const tabs = () => [...d.querySelectorAll('.wellow-pill__item')].map((t) => {
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const by = (p, dy) => ({ x: p.x, y: p.y + dy * scale() });

    // 온보딩이 있으면 먼저 Skip 을 눌러 본 화면으로
    const skip = d.querySelector('[data-onboard="skip"]');
    if (skip && !d.getElementById('onboarding').classList.contains('is-gone')) {
      await sleep(1200);
      await tap(center('[data-onboard="skip"]'));
      await sleep(2400); // 언어 목록이 다 펼쳐질 때까지
      await tap(center('[data-onboard="save-from"]')); // 원문 언어: 기본값(Auto) 그대로
      await sleep(4200); // 목록이 Save 로 합쳐진 뒤 번역 언어 목록이 펼쳐질 때까지
      await tap(center('[data-onboard="save-to"]'));   // 번역 언어: 기본값(Auto) 그대로
      await sleep(4200);                                // Dock 안내 화면 (작은 화면 속 Dock 이 움직임)
      await tap(center('[data-onboard="start"]'));      // Get started → 중간 로딩(WE · Follow) → 네비게이션 바 등장
      await sleep(6800);
    }

    // ── GIF 와 같은 순서로 무한 반복 ──
    for (;;) {
      d.getElementById('article').scrollTop = 0;
      await sleep(900);

      // 1) 단어 Press hold → 하이라이트 + 뜻 말풍선
      let p = center('.word', 'revised');
      down(p.x, p.y); await sleep(1400); up();
      await sleep(700);

      // 2) 단어를 누른 채 위로 스와이프 → 하이라이트 페이드아웃 → 상세 카드 덜컹
      p = center('.word', 'revised');
      down(p.x, p.y); await sleep(500);
      await drag(p, by(p, -70), 320, 10);
      up();
      await sleep(2200);
      await tap(by(center('.article'), 160)); // 바깥을 눌러 닫기
      await sleep(1000);

      // 3) Quote → 파란 구 이동 → 문장 Press hold → 하이라이트 + 해석
      await tap(tabs()[0]);
      await sleep(1100);
      p = center('.word', 'replayed');
      down(p.x, p.y); await sleep(2200); up();
      await sleep(900);

      // 4) Full text → 0.8초 뒤 전문 카드 → 본문 드래그 스크롤
      await tap(tabs()[2]);
      await sleep(2200);
      const body = center('#fulltextScroll');
      let a = by(body, 60);
      down(a.x, a.y); await drag(a, by(body, -60), 600, 18); up();
      await sleep(900);
      a = by(body, -40);
      down(a.x, a.y); await drag(a, by(body, 80), 600, 18); up();
      await sleep(900);

      // 5) 전문 카드를 아래로 → summarize 아이콘 → 끝까지 당겨 요약으로 넘김
      p = center('.fulltext__head');
      down(p.x, p.y);
      await drag(p, by(p, 57), 500, 16);
      await sleep(450);
      await drag(by(p, 57), by(p, 190), 700, 20);
      up();
      await sleep(2400);

      // 6) 요약 카드를 위로 → Full text 아이콘 → 끝까지 올려 전문으로 넘김
      p = center('.fulltext__panel--summary .fulltext__head');
      down(p.x, p.y);
      await drag(p, by(p, -58), 500, 16);
      await sleep(450);
      await drag(by(p, -58), by(p, -190), 700, 20);
      up();
      await sleep(2400);

      // 처음 화면(Wellow)으로 돌아가 반복
      await tap(tabs()[1]);
      await sleep(1200);
    }
  });
})();
