(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  // Scroll progress
  const progress = document.querySelector(".scroll-progress");
  const updateScrollProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const value = scrollable > 0 ? window.scrollY / scrollable : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, value))})`;
  };
  updateScrollProgress();
  window.addEventListener("scroll", updateScrollProgress, { passive: true });

  // Mobile navigation
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".nav-links");

  const closeMenu = () => {
    navigation.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  menuButton.addEventListener("click", () => {
    const willOpen = !navigation.classList.contains("open");
    navigation.classList.toggle("open", willOpen);
    menuButton.setAttribute("aria-expanded", String(willOpen));
    document.body.style.overflow = willOpen ? "hidden" : "";
  });

  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  // Viewport reveals
  const revealElements = document.querySelectorAll(".reveal");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("in-view"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7%" },
    );
    revealElements.forEach((element) => revealObserver.observe(element));
  }

  // Magnetic movement is intentionally small so buttons still feel precise.
  if (finePointer && !prefersReducedMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((element) => {
      element.addEventListener("pointermove", (event) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        element.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
      });
      element.addEventListener("pointerleave", () => {
        element.style.transform = "translate(0, 0)";
      });
    });
  }

  // Interactive galaxy-galaxy lens illustration.
  const canvas = document.querySelector("#lens-canvas");
  const stage = document.querySelector(".lens-stage");
  const stageInstruction = stage.querySelector(".stage-instruction");
  const context = canvas.getContext("2d");
  const stars = Array.from({ length: 95 }, (_, index) => ({
    x: hash(index * 1.73),
    y: hash(index * 3.11 + 4),
    radius: 0.35 + hash(index * 4.89 + 9) * 1.25,
    alpha: 0.12 + hash(index * 7.41 + 2) * 0.5,
    warm: hash(index * 2.37 + 12) > 0.84,
  }));

  let width = 0;
  let height = 0;
  let dpr = 1;
  let sourcePosition = { x: 0.2, y: -0.1 };
  let targetSourcePosition = { x: 0, y: 0 };
  let pointerInsideStage = false;
  let stageMessage = "";

  function hash(value) {
    return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function smoothstep(edgeStart, edgeEnd, value) {
    const amount = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);
    return amount * amount * (3 - 2 * amount);
  }

  function resizeCanvas() {
    const bounds = stage.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (prefersReducedMotion && width > 0 && height > 0) {
      requestAnimationFrame(() => render(0));
    }
  }

  stage.addEventListener("pointerenter", () => {
    pointerInsideStage = true;
  });

  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    targetSourcePosition.x = clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -0.95, 0.95);
    targetSourcePosition.y = clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -0.95, 0.95);
    if (prefersReducedMotion) {
      sourcePosition.x = targetSourcePosition.x;
      sourcePosition.y = targetSourcePosition.y;
      requestAnimationFrame(() => render(0));
    }
  });

  stage.addEventListener("pointerleave", () => {
    pointerInsideStage = false;
    if (prefersReducedMotion) {
      targetSourcePosition.x = 0.2;
      targetSourcePosition.y = -0.1;
      sourcePosition.x = targetSourcePosition.x;
      sourcePosition.y = targetSourcePosition.y;
      requestAnimationFrame(() => render(0));
    }
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeCanvas).observe(stage);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  function drawBackground(time) {
    const background = context.createRadialGradient(
      width * 0.48,
      height * 0.46,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78,
    );
    background.addColorStop(0, "#1c2850");
    background.addColorStop(0.44, "#101936");
    background.addColorStop(1, "#090d1f");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    stars.forEach((star, index) => {
      const twinkle = 0.7 + Math.sin(time * 0.001 + index) * 0.3;
      context.beginPath();
      context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
      context.fillStyle = star.warm
        ? `rgba(255, 179, 111, ${star.alpha * twinkle})`
        : `rgba(205, 229, 255, ${star.alpha * twinkle})`;
      context.fill();
    });
  }

  function drawSourceGalaxy(time, sourceX, sourceY, scale, opacity) {
    const radius = scale * 0.055;
    const sourceGlow = context.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, scale * 0.115);
    sourceGlow.addColorStop(0, `rgba(220, 247, 255, ${0.92 * opacity})`);
    sourceGlow.addColorStop(0.16, `rgba(113, 201, 255, ${0.78 * opacity})`);
    sourceGlow.addColorStop(0.52, `rgba(23, 105, 194, ${0.3 * opacity})`);
    sourceGlow.addColorStop(1, "rgba(23, 105, 194, 0)");
    context.fillStyle = sourceGlow;
    context.beginPath();
    context.arc(sourceX, sourceY, scale * 0.115, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.globalAlpha = opacity;
    context.translate(sourceX, sourceY);
    context.rotate(0.38 + time * 0.00006);
    context.scale(1, 0.58);

    const galaxyBody = context.createRadialGradient(-radius * 0.12, -radius * 0.08, 0, 0, 0, radius);
    galaxyBody.addColorStop(0, "rgba(238, 252, 255, 1)");
    galaxyBody.addColorStop(0.18, "rgba(142, 218, 255, 0.94)");
    galaxyBody.addColorStop(0.6, "rgba(50, 136, 221, 0.48)");
    galaxyBody.addColorStop(1, "rgba(23, 105, 194, 0)");
    context.fillStyle = galaxyBody;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();

    context.lineCap = "round";
    context.lineWidth = Math.max(0.8, scale * 0.0022);
    context.shadowColor = "rgba(113, 201, 255, 0.8)";
    context.shadowBlur = scale * 0.012;
    for (let arm = 0; arm < 2; arm += 1) {
      context.beginPath();
      for (let step = 0; step <= 38; step += 1) {
        const angle = arm * Math.PI + step * 0.17;
        const armRadius = radius * (0.12 + (step / 38) * 0.84);
        const x = Math.cos(angle) * armRadius;
        const y = Math.sin(angle) * armRadius;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = "rgba(207, 241, 255, 0.72)";
      context.stroke();
    }

    context.shadowBlur = scale * 0.018;
    context.fillStyle = "rgba(240, 252, 255, 0.95)";
    context.beginPath();
    context.arc(0, 0, radius * 0.13, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function strokeLensedArc(radiusX, radiusY, angle, halfSpan, width, opacity, scale) {
    if (opacity <= 0.005) return;

    context.save();
    context.shadowColor = "rgba(69, 174, 255, 0.98)";
    context.shadowBlur = scale * 0.05;
    context.strokeStyle = `rgba(113, 201, 255, ${opacity})`;
    context.lineWidth = width;
    context.lineCap = "round";
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, -0.08, angle - halfSpan, angle + halfSpan);
    context.stroke();

    context.shadowBlur = scale * 0.012;
    context.strokeStyle = `rgba(226, 248, 255, ${Math.min(1, opacity + 0.12)})`;
    context.lineWidth = Math.max(0.85, width * 0.16);
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, -0.08, angle - halfSpan, angle + halfSpan);
    context.stroke();
    context.restore();
  }

  function drawLensedImages(centerX, centerY, scale, sourceOffsetX, sourceOffsetY, alignment) {
    if (alignment <= 0.08) return;

    const separation = Math.hypot(sourceOffsetX, sourceOffsetY);
    const einsteinRadius = scale * 0.285;
    const ringBlend = 1 - smoothstep(scale * 0.018, scale * 0.075, separation);
    const lensingStrength = smoothstep(0.08, 1, alignment);
    const sourceAngle = separation > 0.01 ? Math.atan2(sourceOffsetY / 0.88, sourceOffsetX) : 0;

    context.save();
    context.translate(centerX, centerY);

    if (ringBlend > 0.005) {
      strokeLensedArc(
        einsteinRadius,
        einsteinRadius * 0.88,
        0,
        Math.PI,
        Math.max(3, scale * 0.014),
        ringBlend * 0.94,
        scale,
      );
    }

    const arcOpacity = lensingStrength * (1 - ringBlend * 0.78);
    const halfSpan = 0.2 + lensingStrength * 1.18;
    const outerRadius = einsteinRadius + separation * 0.22;
    const innerRadius = Math.max(einsteinRadius * 0.66, einsteinRadius - separation * 0.18);
    const outerWidth = Math.max(2.2, scale * (0.007 + lensingStrength * 0.011));
    const innerWidth = outerWidth * 0.76;

    strokeLensedArc(
      outerRadius,
      outerRadius * 0.88,
      sourceAngle,
      halfSpan,
      outerWidth,
      arcOpacity * 0.96,
      scale,
    );
    strokeLensedArc(
      innerRadius,
      innerRadius * 0.88,
      sourceAngle + Math.PI,
      halfSpan * 0.9,
      innerWidth,
      arcOpacity * (0.48 + lensingStrength * 0.42),
      scale,
    );
    context.restore();
  }

  function drawLens(time, centerX, centerY, scale) {
    const breathe = 1 + Math.sin(time * 0.0008) * 0.012;
    const lensX = centerX;
    const lensY = centerY;

    const halo = context.createRadialGradient(lensX, lensY, scale * 0.015, lensX, lensY, scale * 0.25);
    halo.addColorStop(0, "rgba(255, 225, 190, 0.98)");
    halo.addColorStop(0.11, "rgba(255, 179, 111, 0.94)");
    halo.addColorStop(0.33, "rgba(240, 120, 53, 0.52)");
    halo.addColorStop(0.7, "rgba(240, 120, 53, 0.08)");
    halo.addColorStop(1, "rgba(240, 120, 53, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(lensX, lensY, scale * 0.25 * breathe, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(lensX, lensY);
    context.rotate(-0.32);
    context.scale(1, 0.72);
    const core = context.createRadialGradient(-scale * 0.018, -scale * 0.018, 0, 0, 0, scale * 0.085);
    core.addColorStop(0, "#fff8eb");
    core.addColorStop(0.16, "#ffc481");
    core.addColorStop(0.55, "#e97131");
    core.addColorStop(1, "rgba(128, 47, 21, 0.12)");
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, scale * 0.085 * breathe, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawContours(centerX, centerY, scale) {
    context.save();
    context.translate(centerX, centerY);
    context.rotate(-0.22);
    [0.13, 0.18, 0.23].forEach((radius, index) => {
      context.beginPath();
      context.ellipse(0, 0, scale * radius, scale * radius * 0.74, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255, 179, 111, ${0.17 - index * 0.035})`;
      context.lineWidth = 1;
      context.stroke();
    });
    context.restore();
  }

  function updateStageMessage(alignment, separation, scale) {
    let nextMessage = "Align source with lens";
    if (separation < scale * 0.055 && alignment > 0.9) {
      nextMessage = "Aligned · Einstein ring";
    } else if (alignment > 0.08) {
      nextMessage = "Near alignment · twin arcs";
    } else if (pointerInsideStage) {
      nextMessage = "Move source toward lens";
    }

    if (nextMessage !== stageMessage) {
      stageInstruction.textContent = nextMessage;
      stageMessage = nextMessage;
    }
  }

  function render(time = 0) {
    if (width > 0 && height > 0) {
      if (!pointerInsideStage) {
        targetSourcePosition.x = Math.sin(time * 0.00022) * 0.28;
        targetSourcePosition.y = Math.sin(time * 0.00031) * 0.18;
      }

      const followSpeed = pointerInsideStage ? 0.12 : 0.035;
      sourcePosition.x += (targetSourcePosition.x - sourcePosition.x) * followSpeed;
      sourcePosition.y += (targetSourcePosition.y - sourcePosition.y) * followSpeed;

      const scale = Math.min(width, height);
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const maximumSourceOffset = scale * 0.39;
      const sourceOffsetX = sourcePosition.x * maximumSourceOffset;
      const sourceOffsetY = sourcePosition.y * maximumSourceOffset;
      const sourceX = centerX + sourceOffsetX;
      const sourceY = centerY + sourceOffsetY;
      const separation = Math.hypot(sourceOffsetX, sourceOffsetY);
      const alignment = 1 - smoothstep(scale * 0.045, scale * 0.23, separation);
      const sourceOpacity = Math.max(0.12, 1 - alignment * 0.86);

      context.clearRect(0, 0, width, height);
      drawBackground(time);
      drawSourceGalaxy(time, sourceX, sourceY, scale, sourceOpacity);
      drawContours(centerX, centerY, scale);
      drawLensedImages(centerX, centerY, scale, sourceOffsetX, sourceOffsetY, alignment);
      drawLens(time, centerX, centerY, scale);
      updateStageMessage(alignment, separation, scale);
    }

    if (!prefersReducedMotion) requestAnimationFrame(render);
  }

  resizeCanvas();
  render(0);

  const yearNode = document.querySelector("[data-current-year]");
  if (yearNode) yearNode.textContent = new Date().getFullYear();
})();
