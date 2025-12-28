(function () {
  let rafId = null;
  let initialized = false;
  let running = true;
  let speed = 220;
  let dir = -1;
  let s = 0;
  let last = 0;
  let homeStage = null;
  let homeTargetS = null;
  let homeTrack = null;
  let freePos = null;
  let docked = false;

  const minSpeed = 80;
  const maxSpeed = 420;

  function initBeetleBot() {
    const hero = document.querySelector('#hero');
    const bot = document.getElementById('beetleBot');
    if (!hero || !bot) return;

    const lines = hero.querySelectorAll('h1, p.tagline, p.slogan');
    if (lines.length < 2) return;

    const padding = 42;
    const R = 36;

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
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const left = u.left - padding + scrollX;
      const top = u.top - padding + scrollY;
      const right = u.right + padding + scrollX;
      const bottom = u.bottom + padding + scrollY;
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

    function getStationPoint() {
      const station = document.getElementById('chargingStation');
      if (!station) return null;
      const r = station.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY };
    }

    function closestSOnTrack(track, target) {
      const steps = 240;
      let bestS = 0;
      let bestD = Infinity;
      for (let i = 0; i <= steps; i += 1) {
        const sTest = (track.L * i) / steps;
        const pose = poseOnRoundedRect(track, sTest);
        const dx = pose.x - target.x;
        const dy = pose.y - target.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          bestS = sTest;
        }
      }
      return bestS;
    }

    function updateRunButton() {
      const btn = document.querySelector('#bot-controls [data-action="run"]');
      if (!btn) return;
      btn.classList.toggle('is-active', running);
      btn.setAttribute('aria-label', running ? 'Pause' : 'Run');
      const icon = btn.querySelector('svg');
      if (!icon) return;
      icon.innerHTML = running
        ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>'
        : '<path d="M8 5l11 7-11 7z"></path>';
    }

    function attachControls() {
      if (initialized) return;
      const controls = document.getElementById('bot-controls');
      if (!controls) {
        initialized = true;
        return;
      }
      controls.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const track = getTrack();
        if (action === 'run') {
          running = !running;
          if (running && docked && track) {
            const station = getStationPoint();
            if (station) {
              homeTrack = track;
              homeTargetS = closestSOnTrack(homeTrack, station);
              s = ((s % homeTrack.L) + homeTrack.L) % homeTrack.L;
              homeStage = 'fromStation';
              freePos = { x: station.x, y: station.y };
              docked = false;
            }
          }
          updateRunButton();
          return;
        }
        if (action === 'turn') {
          dir *= -1;
          running = true;
          updateRunButton();
          return;
        }
        if (action === 'speed-up') {
          speed = Math.min(maxSpeed, speed + 40);
          return;
        }
        if (action === 'speed-down') {
          speed = Math.max(minSpeed, speed - 40);
          return;
        }
        if (action === 'home' && track) {
          const station = getStationPoint();
          if (!station) return;
          homeTrack = track;
          homeTargetS = closestSOnTrack(homeTrack, station);
          s = ((s % homeTrack.L) + homeTrack.L) % homeTrack.L;
          const forwardDist = ((homeTargetS - s) % homeTrack.L + homeTrack.L) % homeTrack.L;
          const backwardDist = homeTrack.L - forwardDist;
          dir = forwardDist <= backwardDist ? 1 : -1;
          homeStage = 'toTrack';
          freePos = null;
          running = true;
          updateRunButton();
        }
      });
      initialized = true;
      updateRunButton();
    }

    attachControls();

    function step(now) {
      const baseRotation = 180;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const liveTrack = getTrack();
      const track = homeStage && homeTrack ? homeTrack : liveTrack;
      if (!track) {
        rafId = requestAnimationFrame(step);
        return;
      }

      if (!running && !homeStage) {
        rafId = requestAnimationFrame(step);
        return;
      }

      let pose = null;
      let heading = 0;

      if (homeStage === 'fromStation') {
        if (!freePos) {
          const station = getStationPoint();
          if (station) freePos = { x: station.x, y: station.y };
        }
        const targetPose = poseOnRoundedRect(track, homeTargetS);
        const dx = targetPose.x - freePos.x;
        const dy = targetPose.y - freePos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed * dt) {
          freePos.x = targetPose.x;
          freePos.y = targetPose.y;
          s = homeTargetS;
          homeStage = null;
        } else {
          freePos.x += (dx / dist) * speed * dt;
          freePos.y += (dy / dist) * speed * dt;
        }
        const br = bot.getBoundingClientRect();
        const px = freePos.x - br.width / 2;
        const py = freePos.y - br.height / 2;
        heading = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + baseRotation;
        bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${heading}deg)`;
        rafId = requestAnimationFrame(step);
        return;
      }

      if (homeStage === 'toTrack') {
        s += dir * speed * dt;
        const distanceToTarget = ((homeTargetS - s) * dir + track.L) % track.L;
        if (distanceToTarget <= speed * dt * 1.2) {
          s = homeTargetS;
          homeStage = 'toStation';
          freePos = null;
        }
        pose = poseOnRoundedRect(track, s);
        heading = pose.ang + 90 + (dir < 0 ? 180 : 0) + baseRotation;
      } else if (homeStage === 'toStation') {
        const station = getStationPoint();
        if (!station) {
          homeStage = null;
          rafId = requestAnimationFrame(step);
          return;
        }
        if (!freePos) {
          const p = poseOnRoundedRect(track, s);
          freePos = { x: p.x, y: p.y };
        }
        const dx = station.x - freePos.x;
        const dy = station.y - freePos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed * dt) {
          freePos.x = station.x;
          freePos.y = station.y;
          homeStage = null;
          running = false;
          docked = true;
          updateRunButton();
        } else {
          freePos.x += (dx / dist) * speed * dt;
          freePos.y += (dy / dist) * speed * dt;
        }
        const br = bot.getBoundingClientRect();
        const px = freePos.x - br.width / 2;
        const py = freePos.y - br.height / 2;
        heading = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + baseRotation;
        bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${heading}deg)`;
        rafId = requestAnimationFrame(step);
        return;
      } else {
        s += dir * speed * dt;
        pose = poseOnRoundedRect(track, s);
        heading = pose.ang + 90 + (dir < 0 ? 180 : 0) + baseRotation;
      }

      const br = bot.getBoundingClientRect();
      const px = pose.x - br.width / 2;
      const py = pose.y - br.height / 2;
      bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${heading}deg)`;
      rafId = requestAnimationFrame(step);
    }

    if (rafId) cancelAnimationFrame(rafId);
    last = performance.now();
    rafId = requestAnimationFrame(step);
  }

  document.addEventListener('DOMContentLoaded', initBeetleBot);
  window.addEventListener('resize', initBeetleBot);
})();
