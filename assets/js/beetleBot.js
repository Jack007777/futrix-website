(function () {
  let rafId = null;
  let initialized = false;

  function initBeetleBot() {
    const hero = document.querySelector('#hero');
    const bot = document.getElementById('beetleBot');
    if (!hero || !bot) return;

    
    const lines = hero.querySelectorAll('h1, p.tagline, p.slogan');
    if (lines.length < 2) return;

    // ===== 你主要调这 3 个 =====
    const padding = 42; // 轨道离文字外框的距离
    const R = 36;       // 圆角半径（所有角相同）
    const speed = 220;  // 机器人沿轨道速度（px/s）
    // ==========================

    // 防止重复初始化（resize 时我们只重算轨道，不重复绑事件）
        let s = 0;
        let dir = -1;
        let last = performance.now();

        if (!initialized) {
        bot.addEventListener('click', (e) => {
            e.stopPropagation();
            dir *= -1;
        });
        initialized = true;
}

    function unionRect(a, b) {
      return {
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      };
    }

    function clamp(v, lo, hi) {
      return Math.max(lo, Math.min(hi, v));
    }

    // 测量文本真实占用宽度（支持换行）
    function getTextRect(el) {
      const range = document.createRange();
      range.selectNodeContents(el);

      const rects = Array.from(range.getClientRects());
      if (!rects.length) return el.getBoundingClientRect();

      return rects.reduce(
        (acc, r) => ({
          left: Math.min(acc.left, r.left),
          top: Math.min(acc.top, r.top),
          right: Math.max(acc.right, r.right),
          bottom: Math.max(acc.bottom, r.bottom),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
      );
    }

    function getTrack() {
      let u = null;
      for (const el of lines) {
        const r0 = getTextRect(el);
        u = u ? unionRect(u, r0) : r0;
      }

      const left = u.left - padding;
      const top = u.top - padding;
      const right = u.right + padding;
      const bottom = u.bottom + padding;

      const w = right - left;
      const h = bottom - top;

      const r = clamp(R, 0, Math.min(w, h) / 2 - 1);
      const ax = Math.max(0, w - 2 * r);
      const ay = Math.max(0, h - 2 * r);
      const L = 2 * (ax + ay) + 2 * Math.PI * r;

      return { left, top, w, h, r, ax, ay, L };
    }

    function poseOnRoundedRect(track, sNow) {
      const { left, top, w, h, r, ax, ay, L } = track;
      let s1 = ((sNow % L) + L) % L;

      const segTop = ax;
      const segArc = (Math.PI / 2) * r;
      const segRight = ay;
      const segBottom = ax;
      const segLeft = ay;

      function arc(cx, cy, a0, u) {
        const a = a0 + u * (Math.PI / 2);
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const ang = (a + Math.PI / 2) * 180 / Math.PI;
        return { x, y, ang };
      }

      if (s1 <= segTop) return { x: left + r + s1, y: top, ang: 0 };
      s1 -= segTop;

      if (s1 <= segArc) return arc(left + w - r, top + r, -Math.PI / 2, s1 / segArc);
      s1 -= segArc;

      if (s1 <= segRight) return { x: left + w, y: top + r + s1, ang: 90 };
      s1 -= segRight;

      if (s1 <= segArc) return arc(left + w - r, top + h - r, 0, s1 / segArc);
      s1 -= segArc;

      if (s1 <= segBottom) return { x: left + w - r - s1, y: top + h, ang: 180 };
      s1 -= segBottom;

      if (s1 <= segArc) return arc(left + r, top + h - r, Math.PI / 2, s1 / segArc);
      s1 -= segArc;

      if (s1 <= segLeft) return { x: left, y: top + h - r - s1, ang: -90 };
      s1 -= segLeft;

      return arc(left + r, top + r, Math.PI, s1 / segArc);
    }

    function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const track = getTrack();
      s += dir * speed * dt;

      const pose = poseOnRoundedRect(track, s);

      const br = bot.getBoundingClientRect();
      const px = pose.x - br.width / 2;
      const py = pose.y - br.height / 2;

      bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${pose.ang + 90}deg)`;
      rafId = requestAnimationFrame(step);
    }

    // ✅ 关键：如果之前有循环，先停掉，再启动一条新的
    if (rafId) cancelAnimationFrame(rafId);
    last = performance.now();
    rafId = requestAnimationFrame(step);
  }

  // ✅ 关键：把监听放在函数外面
  document.addEventListener('DOMContentLoaded', initBeetleBot);
  window.addEventListener('resize', initBeetleBot);
})();
