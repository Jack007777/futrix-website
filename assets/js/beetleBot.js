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
  let headingNow = null;
  let turnStage = null;
  let turnTarget = null;
  let parkedAtLogo = false;
  let departStage = null;
  let departTargetS = null;
  let departHeading = null;
  let departForwardY = null;
  let homeActive = false;
  let stationAligned = false;

  const minSpeed = 80;
  const maxSpeed = 420;
  const homeSpeed = 120;
  const backSpeed = 50;
  const baseTurnSpeed = 90;
  let maxTurnSpeed = baseTurnSpeed;
  const turnThreshold = 3;
  const turnThresholdMobile = 8;
  const logoHexCenterRatio = 0.1285;
  const logoContactRatio = 0.90;

  function initBeetleBot() {
    const hero = document.querySelector('#hero');
    const bot = document.getElementById('beetleBot');
    if (!hero || !bot) return;
    const scan = bot.querySelector('.botScan');

    const lines = hero.querySelectorAll('h1, p.tagline, p.slogan');
    if (lines.length < 2) return;

    const padding = 42;
    const R = 80;
    const baseRotation = 180;
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

    function alignChargingStation() {
      const station = document.getElementById('chargingStation');
      const logoHex = document.querySelector('.logo svg');
      const logoImg = document.querySelector('.logo img');
      if (!station || (!logoHex && !logoImg)) return;
      const logoRect = (logoHex || logoImg).getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const centerX = logoRect.left + logoRect.width * logoHexCenterRatio + scrollX;
      const ratio = window.devicePixelRatio || 1;
      const snappedX = Math.round(centerX * ratio) / ratio;
      station.style.left = `${snappedX}px`;
      station.style.right = 'auto';
      stationAligned = true;
      if (parkedAtLogo && freePos) {
        const logoRect = getLogoRect();
        const center = getLogoCenterX();
        const size = getBotSize();
        if (logoRect && center !== null) {
          const contactY = logoRect.bottom + size.h * (logoContactRatio - 1);
          freePos.x = center;
          freePos.y = contactY + size.h / 2;
        }
      }
    }

    function getLogoRect() {
      const logo = document.querySelector('.logo img');
      if (!logo) return null;
      const r = logo.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      return {
        left: r.left + scrollX,
        top: r.top + scrollY,
        right: r.right + scrollX,
        bottom: r.bottom + scrollY,
      };
    }

    function getLogoCenterX() {
      const logo = document.querySelector('.logo img');
      if (!logo) return null;
      const r = logo.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      return r.left + r.width * logoHexCenterRatio + scrollX;
    }

    function getLogoPoint() {
      const r = getLogoRect();
      if (!r) return null;
      return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
    }

    function rectsOverlap(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function setRadar(on) {
      if (!scan) return;
      scan.style.display = on ? '' : 'none';
    }

    function getBotSize() {
      return {
        w: bot.offsetWidth || 0,
        h: bot.offsetHeight || 0,
      };
    }

    function normalizeAngle(deg) {
      let a = deg % 360;
      if (a > 180) a -= 360;
      if (a < -180) a += 360;
      return a;
    }

    function smoothHeading(target, dt) {
      if (headingNow === null) {
        headingNow = target;
        return target;
      }
      const delta = normalizeAngle(target - headingNow);
      const step = Math.min(Math.abs(delta), maxTurnSpeed * dt);
      headingNow += Math.sign(delta) * step;
      return headingNow;
    }

    function getTurnThreshold() {
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        return turnThresholdMobile;
      }
      return turnThreshold;
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
      const label = btn.querySelector('span');
      if (label) label.textContent = running ? 'Pause' : 'Run';
      const icon = btn.querySelector('svg');
      if (!icon) return;
      icon.innerHTML = running
        ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>'
        : '<path d="M8 5l11 7-11 7z"></path>';
    }

    function updateHomeButton() {
      const btn = document.querySelector('#bot-controls [data-action="home"]');
      if (!btn) return;
      btn.classList.toggle('is-active', homeActive);
    }

    function updateTurnButton() {
      const btn = document.querySelector('#bot-controls [data-action="turn"]');
      if (!btn) return;
      const disabled = parkedAtLogo;
      btn.disabled = disabled;
      btn.classList.toggle('is-disabled', disabled);
    }

    const bindStationAlignment = () => {
      if (stationAligned) alignChargingStation();
      const logoImg = document.querySelector('.logo img');
      if (logoImg && !logoImg.complete) {
        logoImg.addEventListener('load', alignChargingStation, { once: true });
      }
    };
    alignChargingStation();
    document.addEventListener('header:loaded', bindStationAlignment);
    window.addEventListener('load', alignChargingStation);
    window.addEventListener('resize', alignChargingStation);
    window.addEventListener('scroll', alignChargingStation, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', alignChargingStation);
      window.visualViewport.addEventListener('scroll', alignChargingStation, { passive: true });
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
          if (running) setRadar(true);
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
          if (running && parkedAtLogo && track) {
            if (!freePos) {
              const logoPoint = getLogoPoint();
              if (logoPoint) freePos = { x: logoPoint.x, y: logoPoint.y };
            }
            if (freePos) {
              departStage = 'forward';
              departForwardY = freePos.y + 100;
              parkedAtLogo = false;
              updateTurnButton();
            }
          }
          updateRunButton();
          return;
        }
        if (action === 'turn') {
          if (parkedAtLogo) return;
          const liveTrack = getTrack();
          if (!liveTrack) return;
          const trackForTurn = homeStage && homeTrack ? homeTrack : liveTrack;
          let currentHeading = headingNow;
          if (currentHeading === null) {
            const poseNow = poseOnRoundedRect(trackForTurn, s);
            currentHeading = poseNow.ang + 90 + (dir < 0 ? 180 : 0) + baseRotation;
          }
          turnTarget = currentHeading + 180;
          turnStage = 'uTurn';
          running = true;
          setRadar(true);
          updateRunButton();
          return;
        }
        if (action === 'speed-up') {
          speed = Math.min(maxSpeed, speed + 40);
          maxTurnSpeed = baseTurnSpeed * (speed / maxSpeed);
          return;
        }
        if (action === 'speed-down') {
          speed = Math.max(minSpeed, speed - 40);
          maxTurnSpeed = baseTurnSpeed * (speed / maxSpeed);
          return;
        }
        if (action === 'home' && track) {
          const station = getStationPoint();
          if (!station) return;
          homeActive = true;
          updateHomeButton();
          if (departStage) {
            const wasForward = departStage === 'forward';
            departStage = null;
            departTargetS = null;
            departHeading = null;
            departForwardY = null;
            if (wasForward) {
              homeStage = 'backToLogo';
              running = true;
              setRadar(true);
              updateRunButton();
              return;
            }
            homeTrack = track;
            homeStage = 'toStation';
            running = true;
            setRadar(true);
            updateRunButton();
            return;
          }
          homeTrack = track;
          homeTargetS = closestSOnTrack(homeTrack, station);
          s = ((s % homeTrack.L) + homeTrack.L) % homeTrack.L;
          const forwardDist = ((homeTargetS - s) % homeTrack.L + homeTrack.L) % homeTrack.L;
          const backwardDist = homeTrack.L - forwardDist;
          dir = forwardDist <= backwardDist ? 1 : -1;
          homeStage = 'toTrack';
          freePos = null;
          running = true;
          setRadar(true);
          updateRunButton();
        }
      });
      controls.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        if (btn.dataset.action !== 'run') {
          btn.classList.add('is-pressed');
        }
      });
      const clearPressed = (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        btn.classList.remove('is-pressed');
      };
      controls.addEventListener('pointerup', clearPressed);
      controls.addEventListener('pointerleave', clearPressed);
      controls.addEventListener('pointercancel', clearPressed);
      initialized = true;
      updateRunButton();
      updateHomeButton();
      updateTurnButton();
    }

    attachControls();

    function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const liveTrack = getTrack();
      const track = homeStage && homeTrack ? homeTrack : liveTrack;
      if (!track) {
        rafId = requestAnimationFrame(step);
        return;
      }

      if (!running) {
        rafId = requestAnimationFrame(step);
        return;
      }

      let pose = null;
      let heading = 0;

      if (departStage) {
        const size = getBotSize();
        const px = freePos.x - size.w / 2;
        const py = freePos.y - size.h / 2;

        if (departStage === 'forward') {
          const remaining = Math.max(0, departForwardY - freePos.y);
          if (remaining <= homeSpeed * dt) {
            freePos.y = departForwardY;
            departStage = 'turn';
            departTargetS = closestSOnTrack(track, freePos);
            const poseTarget = poseOnRoundedRect(track, departTargetS);
            departHeading = (Math.atan2(poseTarget.y - freePos.y, poseTarget.x - freePos.x) * 180) / Math.PI + 90 + baseRotation;
          } else {
            freePos.y += homeSpeed * dt;
          }
          bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${headingNow ?? baseRotation}deg)`;
          rafId = requestAnimationFrame(step);
          return;
        }

        if (departStage === 'turn') {
          const easedHeading = smoothHeading(departHeading, dt);
          bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
          if (Math.abs(normalizeAngle(departHeading - headingNow)) <= 3) {
            departStage = 'toTrack';
          }
          rafId = requestAnimationFrame(step);
          return;
        }

        if (departStage === 'toTrack') {
          const poseTarget = poseOnRoundedRect(track, departTargetS);
          const dx = poseTarget.x - freePos.x;
          const dy = poseTarget.y - freePos.y;
          const dist = Math.hypot(dx, dy);
          const headingPath = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + baseRotation;
          const easedHeading = smoothHeading(headingPath, dt);
          if (dist <= homeSpeed * dt) {
            freePos.x = poseTarget.x;
            freePos.y = poseTarget.y;
            departStage = 'align';
          } else {
            freePos.x += (dx / dist) * homeSpeed * dt;
            freePos.y += (dy / dist) * homeSpeed * dt;
          }
          bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
          rafId = requestAnimationFrame(step);
          return;
        }

        if (departStage === 'align') {
          const poseTarget = poseOnRoundedRect(track, departTargetS);
          const pathHeading = poseTarget.ang + 90 + (dir < 0 ? 180 : 0) + baseRotation;
          const easedHeading = smoothHeading(pathHeading, dt);
          bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
          if (Math.abs(normalizeAngle(pathHeading - headingNow)) <= 3) {
            s = ((departTargetS % track.L) + track.L) % track.L;
            freePos = null;
            departStage = null;
            departTargetS = null;
            departHeading = null;
            departForwardY = null;
          }
          rafId = requestAnimationFrame(step);
          return;
        }
      }

      if (turnStage === 'uTurn') {
        let x = 0;
        let y = 0;
        if (freePos) {
          x = freePos.x;
          y = freePos.y;
        } else {
          const poseNow = poseOnRoundedRect(track, s);
          x = poseNow.x;
          y = poseNow.y;
        }
        const size = getBotSize();
        const px = x - size.w / 2;
        const py = y - size.h / 2;
        const easedHeading = smoothHeading(turnTarget, dt);
        bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
        if (Math.abs(normalizeAngle(turnTarget - headingNow)) <= 2) {
          turnStage = null;
          turnTarget = null;
          dir *= -1;
        }
        rafId = requestAnimationFrame(step);
        return;
      }

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
        const size = getBotSize();
        const px = freePos.x - size.w / 2;
        const py = freePos.y - size.h / 2;
        const headingPath = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + baseRotation;
        const easedHeading = smoothHeading(headingPath, dt);
        bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
        rafId = requestAnimationFrame(step);
        return;
      }

      if (homeStage === 'toTrack') {
        const sNext = s + dir * speed * dt;
        const poseNext = poseOnRoundedRect(track, sNext);
        const headingPath = poseNext.ang + 90 + (dir < 0 ? 180 : 0) + baseRotation;
        const angleDiff = Math.abs(normalizeAngle(headingPath - (headingNow ?? headingPath)));
        const threshold = getTurnThreshold();
        const turnRatio = Math.min(1, angleDiff / threshold);
        const turnFactor = 1 - turnRatio * turnRatio;
        heading = smoothHeading(headingPath, dt);
        s += dir * speed * dt * turnFactor;
        const distanceToTarget = ((homeTargetS - s) * dir + track.L) % track.L;
        if (distanceToTarget <= speed * dt * 1.2) {
          s = homeTargetS;
          homeStage = 'toStation';
          freePos = null;
        }
        pose = poseOnRoundedRect(track, s);
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
        const headingPath = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + baseRotation;
        const angleDiff = Math.abs(normalizeAngle(headingPath - (headingNow ?? headingPath)));
        if (angleDiff > 4) {
          const size = getBotSize();
          const px = freePos.x - size.w / 2;
          const py = freePos.y - size.h / 2;
          const easedHeading = smoothHeading(headingPath, dt);
          bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
          rafId = requestAnimationFrame(step);
          return;
        }
        const dist = Math.hypot(dx, dy);
        if (dist <= homeSpeed * dt) {
          freePos.x = station.x;
          freePos.y = station.y;
          homeStage = 'backToLogo';
          docked = false;
        } else {
          freePos.x += (dx / dist) * homeSpeed * dt;
          freePos.y += (dy / dist) * homeSpeed * dt;
        }
        const size = getBotSize();
        const px = freePos.x - size.w / 2;
        const py = freePos.y - size.h / 2;
        const easedHeading = smoothHeading(headingPath, dt);
        bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
        rafId = requestAnimationFrame(step);
        return;
      } else if (homeStage === 'backToLogo') {
        if (!freePos) {
          const station = getStationPoint();
          if (station) freePos = { x: station.x, y: station.y };
        }
        const size = getBotSize();
        const px = freePos.x - size.w / 2;
        const py = freePos.y - size.h / 2;
        const headingDown = baseRotation + 180;
        const angleDiff = Math.abs(normalizeAngle(headingDown - (headingNow ?? headingDown)));
        const easedHeading = smoothHeading(headingDown, dt);
        bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
        if (angleDiff > 4) {
          rafId = requestAnimationFrame(step);
          return;
        }
        freePos.y -= backSpeed * dt;
        const logoRect = getLogoRect();
        if (logoRect) {
          const contactY = logoRect.bottom + size.h * (logoContactRatio - 1);
          const targetY = contactY + size.h / 2;
          if (freePos.y - size.h / 2 <= contactY) {
            freePos.y = targetY;
            const snapPy = freePos.y - size.h / 2;
            bot.style.transform = `translate3d(${px}px, ${snapPy}px, 0) rotate(${easedHeading}deg)`;
            homeStage = null;
            running = false;
            updateRunButton();
            setRadar(false);
            parkedAtLogo = true;
            homeActive = false;
            updateHomeButton();
            updateTurnButton();
            rafId = requestAnimationFrame(step);
            return;
          }
        }
        rafId = requestAnimationFrame(step);
        return;
      } else {
        const sNext = s + dir * speed * dt;
        const poseNext = poseOnRoundedRect(track, sNext);
        const headingPath = poseNext.ang + 90 + (dir < 0 ? 180 : 0) + baseRotation;
        const angleDiff = Math.abs(normalizeAngle(headingPath - (headingNow ?? headingPath)));
        const threshold = getTurnThreshold();
        const turnRatio = Math.min(1, angleDiff / threshold);
        const turnFactor = 1 - turnRatio * turnRatio;
        heading = smoothHeading(headingPath, dt);
        s += dir * speed * dt * turnFactor;
        pose = poseOnRoundedRect(track, s);
      }

      const size = getBotSize();
      const px = pose.x - size.w / 2;
      const py = pose.y - size.h / 2;
      const easedHeading = smoothHeading(heading, dt);
      bot.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${easedHeading}deg)`;
      rafId = requestAnimationFrame(step);
    }

    if (rafId) cancelAnimationFrame(rafId);
    last = performance.now();
    rafId = requestAnimationFrame(step);
  }

  document.addEventListener('DOMContentLoaded', initBeetleBot);
  window.addEventListener('resize', initBeetleBot);
})();
