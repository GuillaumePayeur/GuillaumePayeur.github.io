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

  // Subtle custom lens cursor. Native cursor remains intact for usability.
  if (finePointer && !prefersReducedMotion) {
    const lensCursor = document.querySelector(".cursor-lens");
    const coreCursor = document.querySelector(".cursor-core");
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let lensX = pointerX;
    let lensY = pointerY;

    document.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      coreCursor.style.transform = `translate(${pointerX}px, ${pointerY}px) translate(-50%, -50%)`;
      document.body.classList.add("cursor-active");
    });

    document.addEventListener("pointerleave", () => document.body.classList.remove("cursor-active"));

    document.querySelectorAll("a, button, .research-item, .paper-visual").forEach((element) => {
      element.addEventListener("pointerenter", () => document.body.classList.add("cursor-hover"));
      element.addEventListener("pointerleave", () => document.body.classList.remove("cursor-hover"));
    });

    const animateCursor = () => {
      lensX += (pointerX - lensX) * 0.13;
      lensY += (pointerY - lensY) * 0.13;
      lensCursor.style.transform = `translate(${lensX}px, ${lensY}px) translate(-50%, -50%)`;
      requestAnimationFrame(animateCursor);
    };
    animateCursor();
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
  let pointer = { x: 0, y: 0 };
  let targetPointer = { x: 0, y: 0 };
  let canvasVisible = true;

  function hash(value) {
    return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1;
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

  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    targetPointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    targetPointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  });

  stage.addEventListener("pointerleave", () => {
    targetPointer.x = 0;
    targetPointer.y = 0;
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeCanvas).observe(stage);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  if ("IntersectionObserver" in window) {
    const canvasObserver = new IntersectionObserver((entries) => {
      canvasVisible = entries[0].isIntersecting;
    });
    canvasObserver.observe(stage);
  }

  function drawBackground(time) {
    const background = context.createRadialGradient(
      width * (0.47 + pointer.x * 0.025),
      height * (0.43 + pointer.y * 0.025),
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

  function drawSource(time, centerX, centerY, scale) {
    const orbit = Math.sin(time * 0.00034) * scale * 0.025;
    const sourceX = centerX + scale * (0.27 + pointer.x * 0.055) + orbit;
    const sourceY = centerY - scale * (0.2 - pointer.y * 0.045);
    const sourceGlow = context.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, scale * 0.1);
    sourceGlow.addColorStop(0, "rgba(215, 245, 255, 0.98)");
    sourceGlow.addColorStop(0.18, "rgba(113, 201, 255, 0.9)");
    sourceGlow.addColorStop(0.55, "rgba(23, 105, 194, 0.34)");
    sourceGlow.addColorStop(1, "rgba(23, 105, 194, 0)");
    context.fillStyle = sourceGlow;
    context.beginPath();
    context.arc(sourceX, sourceY, scale * 0.1, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(sourceX, sourceY);
    context.rotate(time * 0.0001);
    context.scale(1, 0.43);
    context.strokeStyle = "rgba(180, 230, 255, 0.85)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(0, 0, scale * 0.037, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawEinsteinRing(time, centerX, centerY, scale) {
    const radius = scale * (0.285 + Math.sin(time * 0.0007) * 0.004);
    const angleShift = time * 0.000055 + pointer.x * 0.05;
    const arcs = [
      { start: -0.28, end: 1.14, width: 0.021, alpha: 0.92 },
      { start: 1.52, end: 2.72, width: 0.014, alpha: 0.68 },
      { start: 3.02, end: 4.28, width: 0.023, alpha: 0.9 },
      { start: 4.73, end: 5.74, width: 0.012, alpha: 0.58 },
    ];

    context.save();
    context.translate(centerX, centerY);
    context.rotate(pointer.x * 0.08 - pointer.y * 0.035);

    arcs.forEach((arc, index) => {
      context.save();
      context.rotate(angleShift * (index % 2 === 0 ? 1 : -0.6));
      context.shadowColor = "rgba(69, 174, 255, 0.95)";
      context.shadowBlur = scale * 0.055;
      context.strokeStyle = `rgba(113, 201, 255, ${arc.alpha})`;
      context.lineWidth = Math.max(2.5, scale * arc.width);
      context.lineCap = "round";
      context.beginPath();
      context.ellipse(0, 0, radius * (1 + pointer.x * 0.02), radius * 0.88, 0, arc.start, arc.end);
      context.stroke();

      context.shadowBlur = scale * 0.016;
      context.strokeStyle = `rgba(220, 246, 255, ${Math.min(1, arc.alpha + 0.08)})`;
      context.lineWidth = Math.max(0.8, scale * arc.width * 0.18);
      context.beginPath();
      context.ellipse(0, 0, radius * (1 + pointer.x * 0.02), radius * 0.88, 0, arc.start, arc.end);
      context.stroke();
      context.restore();
    });
    context.restore();
  }

  function drawLens(time, centerX, centerY, scale) {
    const breathe = 1 + Math.sin(time * 0.0008) * 0.018;
    const lensX = centerX + pointer.x * scale * 0.022;
    const lensY = centerY + pointer.y * scale * 0.022;

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
    context.rotate(-0.32 + pointer.x * 0.06);
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
    context.rotate(-0.22 + pointer.x * 0.04);
    [0.13, 0.18, 0.23].forEach((radius, index) => {
      context.beginPath();
      context.ellipse(0, 0, scale * radius, scale * radius * 0.74, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255, 179, 111, ${0.17 - index * 0.035})`;
      context.lineWidth = 1;
      context.stroke();
    });
    context.restore();
  }

  function render(time = 0) {
    if (canvasVisible || prefersReducedMotion) {
      pointer.x += (targetPointer.x - pointer.x) * 0.045;
      pointer.y += (targetPointer.y - pointer.y) * 0.045;

      const scale = Math.min(width, height);
      const centerX = width * 0.5;
      const centerY = height * 0.5;

      context.clearRect(0, 0, width, height);
      drawBackground(time);
      drawSource(time, centerX, centerY, scale);
      drawEinsteinRing(time, centerX, centerY, scale);
      drawContours(centerX, centerY, scale);
      drawLens(time, centerX, centerY, scale);
    }

    if (!prefersReducedMotion) requestAnimationFrame(render);
  }

  resizeCanvas();
  render(0);

  const yearNode = document.querySelector("[data-current-year]");
  if (yearNode) yearNode.textContent = new Date().getFullYear();
})();
