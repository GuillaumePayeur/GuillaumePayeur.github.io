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
  // One galaxy portrait supplies both the source and its distorted images.
  const galaxyPortrait = createGalaxyPortrait();
  const sourceTexture = document.createElement("canvas");
  sourceTexture.width = galaxyPortrait.width;
  sourceTexture.height = galaxyPortrait.height;
  const sourceTextureContext = sourceTexture.getContext("2d", { willReadFrequently: true });
  const arcLayer = document.createElement("canvas");
  const arcContext = arcLayer.getContext("2d");
  let arcPixels;
  let arcSamples = [];
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

  function createGalaxyPortrait() {
    const portrait = document.createElement("canvas");
    portrait.width = 256;
    portrait.height = 256;
    const paint = portrait.getContext("2d");
    paint.translate(128, 128);
    paint.rotate(0.38);
    paint.scale(1, 0.7);

    function glow(x, y, radius, color, alpha) {
      const gradient = paint.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
      gradient.addColorStop(0.35, `rgba(${color}, ${alpha * 0.48})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      paint.fillStyle = gradient;
      paint.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    glow(0, 0, 110, "45, 114, 217", 0.55);
    glow(0, 0, 80, "65, 132, 218", 0.4);
    // Broad, irregular arms rather than outlines: these become the arc texture.
    for (let arm = 0; arm < 2; arm += 1) {
      for (let step = 0; step < 100; step += 1) {
        const fraction = step / 99;
        const angle = arm * Math.PI + fraction * 5.2;
        const radius = 14 + fraction * 78;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        glow(x, y, 9 + fraction * 4, "75, 166, 255", 0.08 + (1 - fraction) * 0.05);
      }
    }

    // The deterministic clumps repeat in every image of this same source.
    for (let index = 0; index < 70; index += 1) {
      const fraction = hash(index * 3.71 + 6);
      const angle = (index % 2) * Math.PI + fraction * 5.2;
      const radius = 14 + fraction * 78;
      const x = Math.cos(angle) * radius + (hash(index + 2) - 0.5) * 12;
      const y = Math.sin(angle) * radius + (hash(index + 8) - 0.5) * 12;
      glow(x, y, 1.4 + hash(index + 15) * 4, "141, 213, 255", 0.25 + hash(index + 5) * 0.45);
    }

    // Three unequal star-forming regions make the repeated morphology legible.
    glow(52, 29, 19, "170, 225, 255", 0.98);
    glow(52, 29, 8, "235, 249, 255", 1);
    glow(-42, -40, 12, "114, 178, 255", 0.95);
    glow(-42, -40, 6, "211, 234, 255", 1);
    glow(-57, 42, 10, "184, 178, 255", 0.82);
    glow(0, 0, 40, "129, 201, 255", 0.95);
    glow(0, 0, 23, "230, 246, 255", 1);
    glow(0, 0, 10, "255, 254, 247", 1);
    return portrait;
  }

  function updateSourceTexture(time) {
    const size = sourceTexture.width;
    sourceTextureContext.clearRect(0, 0, size, size);
    sourceTextureContext.save();
    sourceTextureContext.translate(size / 2, size / 2);
    sourceTextureContext.rotate(time * 0.00006);
    sourceTextureContext.drawImage(galaxyPortrait, -size / 2, -size / 2);
    sourceTextureContext.restore();
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
    // Cache the inverse polar map for just the annulus where images can occur.
    // A bounded raster keeps the cost predictable on phones and high-DPI screens.
    const resolution = Math.min(480, Math.max(280, Math.round(Math.min(width, height) * dpr)));
    arcLayer.width = resolution;
    arcLayer.height = resolution;
    arcPixels = arcContext.createImageData(resolution, resolution);
    arcSamples = [];
    const rotationCosine = Math.cos(0.08);
    const rotationSine = Math.sin(0.08);
    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        const offsetX = (x + 0.5) / resolution - 0.5;
        const offsetY = (y + 0.5) / resolution - 0.5;
        const localX = offsetX * rotationCosine - offsetY * rotationSine;
        const localY = (offsetX * rotationSine + offsetY * rotationCosine) / 0.88;
        const radius = Math.hypot(localX, localY);
        if (radius > 0.13 && radius < 0.45) {
          arcSamples.push({ index: (y * resolution + x) * 4, radius, angle: Math.atan2(localY, localX) });
        }
      }
    }
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

  function drawSourceGalaxy(sourceX, sourceY, scale, opacity) {
    const size = scale * 0.17;
    context.save();
    context.globalAlpha = opacity;
    context.drawImage(sourceTexture, sourceX - size / 2, sourceY - size / 2, size, size);
    context.restore();
  }

  function drawSourceReference(scale) {
    // A small unwarped reference makes the matching knots easy to compare even
    // while the moving source itself is hidden behind the foreground light.
    const size = scale * 0.15;
    const x = Math.max(scale * 0.055, 55 - size / 2);
    const y = scale * 0.115;
    context.drawImage(sourceTexture, x, y, size, size);
    context.save();
    context.font = '12px "DM Sans", sans-serif';
    context.fillStyle = "rgba(190, 220, 255, 0.7)";
    context.textAlign = "center";
    context.fillText("Unlensed source", x + size / 2, y + size + 9);
    context.restore();
  }

  function drawWarpedGalaxy(texture, radius, angle, halfSpan, thickness, opacity, mirrored) {
    if (opacity <= 0.005) return;
    const size = sourceTexture.width;
    const output = arcPixels.data;
    const parity = mirrored ? -1 : 1;

    // Look up each image pixel in the shared source portrait. Bilinear sampling
    // preserves its knots and arms without seams between stretched strips.
    for (const sample of arcSamples) {
      const sourceY = (0.5 + ((sample.radius - radius) / thickness) * parity) * (size - 1);
      if (sourceY < 0 || sourceY >= size - 1) continue;
      let delta = sample.angle - angle;
      delta -= Math.round(delta / (Math.PI * 2)) * Math.PI * 2;
      if (Math.abs(delta) >= halfSpan) continue;
      const sourceX = (0.5 + delta / (halfSpan * 2)) * (size - 1);
      const x = Math.floor(sourceX);
      const y = Math.floor(sourceY);
      const fractionX = sourceX - x;
      const fractionY = sourceY - y;
      const topLeft = (y * size + x) * 4;
      const bottomLeft = topLeft + size * 4;
      const weightA = (1 - fractionX) * (1 - fractionY);
      const weightB = fractionX * (1 - fractionY);
      const weightC = (1 - fractionX) * fractionY;
      const weightD = fractionX * fractionY;
      const alpha = (texture[topLeft + 3] * weightA + texture[topLeft + 7] * weightB
        + texture[bottomLeft + 3] * weightC + texture[bottomLeft + 7] * weightD) / 255 * opacity;
      if (alpha < 0.003) continue;
      const index = sample.index;
      const existingAlpha = output[index + 3] / 255;
      const combinedAlpha = alpha + existingAlpha * (1 - alpha);
      for (let channel = 0; channel < 3; channel += 1) {
        const color = texture[topLeft + channel] * weightA + texture[topLeft + 4 + channel] * weightB
          + texture[bottomLeft + channel] * weightC + texture[bottomLeft + 4 + channel] * weightD;
        output[index + channel] = (color * alpha + output[index + channel] * existingAlpha * (1 - alpha)) / combinedAlpha;
      }
      output[index + 3] = combinedAlpha * 255;
    }
  }

  function drawLensedImages(centerX, centerY, scale, sourceOffsetX, sourceOffsetY, alignment) {
    if (alignment <= 0.08) return;

    const separation = Math.hypot(sourceOffsetX, sourceOffsetY);
    const einsteinRadius = scale * 0.285;
    const ringBlend = 1 - smoothstep(scale * 0.018, scale * 0.075, separation);
    const lensingStrength = smoothstep(0.08, 1, alignment);
    const sourceAngle = separation > 0.01 ? Math.atan2(sourceOffsetY / 0.88, sourceOffsetX) : 0;
    const halfSpan = (0.55 + lensingStrength * 1.5) * (1 - ringBlend) + 2.8 * ringBlend;
    const outerRadius = (einsteinRadius + separation * 0.22 * (1 - ringBlend)) / scale;
    const innerRadius = (einsteinRadius - separation * 0.18 * (1 - ringBlend)) / scale;
    const thickness = 0.11 + lensingStrength * 0.08;

    arcPixels.data.fill(0);
    const texture = sourceTextureContext.getImageData(0, 0, sourceTexture.width, sourceTexture.height).data;
    drawWarpedGalaxy(texture, outerRadius, sourceAngle, halfSpan, thickness, lensingStrength, false);
    drawWarpedGalaxy(texture, innerRadius, sourceAngle + Math.PI, halfSpan, thickness * 0.88,
      lensingStrength * (0.68 + ringBlend * 0.25), true);
    arcContext.putImageData(arcPixels, 0, 0);

    // Glow is applied once to the completed images; no white stroke obscures them.
    context.save();
    context.shadowColor = "rgba(65, 160, 255, 0.65)";
    context.shadowBlur = scale * 0.018;
    context.drawImage(arcLayer, centerX - scale / 2, centerY - scale / 2, scale, scale);
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
      const sourceOpacity = Math.max(0.48, 1 - alignment * 0.52);

      context.clearRect(0, 0, width, height);
      updateSourceTexture(time);
      drawBackground(time);
      drawSourceGalaxy(sourceX, sourceY, scale, sourceOpacity);
      drawContours(centerX, centerY, scale);
      drawLensedImages(centerX, centerY, scale, sourceOffsetX, sourceOffsetY, alignment);
      drawLens(time, centerX, centerY, scale);
      drawSourceReference(scale);
      updateStageMessage(alignment, separation, scale);
    }

    if (!prefersReducedMotion) requestAnimationFrame(render);
  }

  resizeCanvas();
  render(0);

  const yearNode = document.querySelector("[data-current-year]");
  if (yearNode) yearNode.textContent = new Date().getFullYear();
})();
