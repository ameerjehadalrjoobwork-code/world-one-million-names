import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const GRID_SIZE = 100;
const CELLS_PER_PAGE = GRID_SIZE * GRID_SIZE;

const CELL_SIZE = 54;
const CELL_GAP = 8;
const CELL_STEP = CELL_SIZE + CELL_GAP;

const BOARD_SIZE = GRID_SIZE * CELL_STEP - CELL_GAP;

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 2.6;

const FAR_ONLY_ZOOM = 0.32;
const CELLS_ONLY_ZOOM = 0.5;

const BOARD_PADDING = 28;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getCellNumber(page, row, col) {
  return (page - 1) * CELLS_PER_PAGE + row * GRID_SIZE + col + 1;
}

function getRowColFromCellId(cellId) {
  const localIndex = (cellId - 1) % CELLS_PER_PAGE;

  return {
    row: Math.floor(localIndex / GRID_SIZE),
    col: localIndex % GRID_SIZE,
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h) {
  const imageRatio = img.width / img.height;
  const boxRatio = w / h;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imageRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

const PixelCanvas = forwardRef(function PixelCanvas(
  { currentPage, soldCells, onCellClick, onCameraChange },
  ref
) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
const touchRef = useRef({
  mode: "none",
  lastX: 0,
  lastY: 0,
  startDistance: 0,
  startCenterX: 0,
  startCenterY: 0,
  startCamera: null,
  anchorX: 0,
  anchorY: 0,
});
  const imageCacheRef = useRef({});
  const rafRef = useRef(null);
  const animationRef = useRef(null);
  const drawRef = useRef(null);
  const hoverCellRef = useRef(null);

  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
  });

  const [camera, setCamera] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });

  const cameraRef = useRef(camera);

  const dragRef = useRef({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const requestDraw = useCallback(() => {
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current?.();
    });
  }, []);

  function commitCamera(nextCamera) {
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
    onCameraChange?.(nextCamera);
    requestDraw();
  }

  function cancelCameraAnimation() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }

  useEffect(() => {
    cameraRef.current = camera;
    requestDraw();
  }, [camera, requestDraw]);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(wrapperRef.current);

    return () => observer.disconnect();
  }, []);

  const clampCamera = useCallback(
    (nextCamera) => {
      const safeScale = clamp(nextCamera.scale, MIN_ZOOM, MAX_ZOOM);

      const usableWidth = Math.max(1, viewport.width - BOARD_PADDING * 2);
      const usableHeight = Math.max(1, viewport.height - BOARD_PADDING * 2);

      const visibleWidth = usableWidth / safeScale;
      const visibleHeight = usableHeight / safeScale;

      const maxX = Math.max(0, BOARD_SIZE - visibleWidth);
      const maxY = Math.max(0, BOARD_SIZE - visibleHeight);

      return {
        scale: safeScale,
        x: clamp(nextCamera.x, 0, maxX),
        y: clamp(nextCamera.y, 0, maxY),
      };
    },
    [viewport.width, viewport.height]
  );

  function setSafeCamera(nextCamera) {
    cancelCameraAnimation();
    commitCamera(clampCamera(nextCamera));
  }

  function animateToCamera(targetCamera, duration = 260) {
    cancelCameraAnimation();

    const startCamera = cameraRef.current;
    const target = clampCamera(targetCamera);
    const startTime = performance.now();

    function step(now) {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = easeOutCubic(progress);

      const next = clampCamera({
        x: startCamera.x + (target.x - startCamera.x) * eased,
        y: startCamera.y + (target.y - startCamera.y) * eased,
        scale: startCamera.scale + (target.scale - startCamera.scale) * eased,
      });

      commitCamera(next);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null;
        commitCamera(target);
      }
    }

    animationRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    commitCamera(clampCamera(cameraRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.width, viewport.height]);

  function getImage(imageUrl) {
    if (!imageUrl) return null;

    if (imageCacheRef.current[imageUrl]) {
      return imageCacheRef.current[imageUrl];
    }

    const img = new Image();
    img.src = imageUrl;
    img.onload = requestDraw;

    imageCacheRef.current[imageUrl] = img;

    return img;
  }

  function getCellFromPoint(clientX, clientY) {
    if (!wrapperRef.current) return null;

    const rect = wrapperRef.current.getBoundingClientRect();
    const cam = cameraRef.current;

    const px = clientX - rect.left;
    const py = clientY - rect.top;

    if (
      px < BOARD_PADDING ||
      py < BOARD_PADDING ||
      px > rect.width - BOARD_PADDING ||
      py > rect.height - BOARD_PADDING
    ) {
      return null;
    }

    const fromRight = rect.width - px - BOARD_PADDING;

    const contentX = cam.x + fromRight / cam.scale;
    const contentY = cam.y + (py - BOARD_PADDING) / cam.scale;

    const col = Math.floor(contentX / CELL_STEP);
    const row = Math.floor(contentY / CELL_STEP);

    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return null;
    }

    return {
      row,
      col,
      id: getCellNumber(currentPage, row, col),
    };
  }

  function drawBackground(ctx, width, height, cam) {
    ctx.fillStyle = "#f8f5ef";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = "rgba(0,0,0,0.045)";
    ctx.lineWidth = 1;

    const bgStep = 34;
    const bgOffsetX = -((cam.x * cam.scale) % bgStep);
    const bgOffsetY = -((cam.y * cam.scale) % bgStep);

    for (let x = bgOffsetX; x < width; x += bgStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = bgOffsetY; y < height; y += bgStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFarMode(ctx, width, height, cam) {
    const zone = 10;
    const zoneStep = zone * CELL_STEP;
    const zoneSize = zone * CELL_STEP - CELL_GAP;
    const zonesPerPage = 100;

    const usableWidth = Math.max(1, width - BOARD_PADDING * 2);
    const usableHeight = Math.max(1, height - BOARD_PADDING * 2);

    const startCol = clamp(Math.floor(cam.x / zoneStep) * zone, 0, GRID_SIZE - 1);
    const endCol = clamp(
      Math.ceil((cam.x + usableWidth / cam.scale) / zoneStep) * zone,
      0,
      GRID_SIZE - 1
    );

    const startRow = clamp(Math.floor(cam.y / zoneStep) * zone, 0, GRID_SIZE - 1);
    const endRow = clamp(
      Math.ceil((cam.y + usableHeight / cam.scale) / zoneStep) * zone,
      0,
      GRID_SIZE - 1
    );

    for (let row = startRow; row <= endRow; row += zone) {
      for (let col = startCol; col <= endCol; col += zone) {
        const zoneRow = Math.floor(row / zone);
        const zoneCol = Math.floor(col / zone);

        const localZoneNumber = zoneRow * 10 + zoneCol + 1;
        const zoneNumber = (currentPage - 1) * zonesPerPage + localZoneNumber;

        const x =
          width -
          BOARD_PADDING -
          (col * CELL_STEP - cam.x) * cam.scale -
          zoneSize * cam.scale;

        const y = BOARD_PADDING + (row * CELL_STEP - cam.y) * cam.scale;

        const size = zoneSize * cam.scale;

        if (x > width || x + size < 0 || y > height || y + size < 0) continue;

        let reservedCount = 0;

        for (let r = row; r < Math.min(row + zone, GRID_SIZE); r++) {
          for (let c = col; c < Math.min(col + zone, GRID_SIZE); c++) {
            const id = getCellNumber(currentPage, r, c);
            if (soldCells[id]) reservedCount++;
          }
        }

        ctx.save();

        roundedRect(ctx, x, y, size, size, Math.max(6, 14 * cam.scale));

        ctx.fillStyle = reservedCount > 0 ? "#111" : "#fbf8f2";
        ctx.fill();

        ctx.lineWidth = Math.max(1, 1.5 * cam.scale);
        ctx.strokeStyle = reservedCount > 0 ? "#00d084" : "#ddd3c6";
        ctx.stroke();

        ctx.fillStyle = reservedCount > 0 ? "#fff" : "#111";
        ctx.font = `900 ${Math.max(18, 44 * cam.scale)}px Cairo, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(zoneNumber), x + size / 2, y + size / 2);

        ctx.fillStyle = reservedCount > 0 ? "#00d084" : "#8e8376";
        ctx.font = `800 ${Math.max(9, 13 * cam.scale)}px Cairo, Arial`;
        ctx.fillText(
          "منطقة",
          x + size / 2,
          y + size / 2 + Math.max(18, 28 * cam.scale)
        );

        if (reservedCount > 0) {
          const badgeW = Math.max(34, 48 * cam.scale);
          const badgeH = Math.max(18, 24 * cam.scale);
          const badgeX = x + size - badgeW - Math.max(6, 9 * cam.scale);
          const badgeY = y + Math.max(6, 9 * cam.scale);

          roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 999);
          ctx.fillStyle = "#00d084";
          ctx.fill();

          ctx.fillStyle = "#06140d";
          ctx.font = `900 ${Math.max(9, 12 * cam.scale)}px Cairo, Arial`;
          ctx.fillText(String(reservedCount), badgeX + badgeW / 2, badgeY + badgeH / 2);
        }

        ctx.restore();
      }
    }
  }

  function drawCellsMode(ctx, width, height, cam) {
    const overscan = 3;

    const usableWidth = Math.max(1, width - BOARD_PADDING * 2);
    const usableHeight = Math.max(1, height - BOARD_PADDING * 2);

    const startCol = clamp(
      Math.floor(cam.x / CELL_STEP) - overscan,
      0,
      GRID_SIZE - 1
    );

    const endCol = clamp(
      Math.ceil((cam.x + usableWidth / cam.scale) / CELL_STEP) + overscan,
      0,
      GRID_SIZE - 1
    );

    const startRow = clamp(
      Math.floor(cam.y / CELL_STEP) - overscan,
      0,
      GRID_SIZE - 1
    );

    const endRow = clamp(
      Math.ceil((cam.y + usableHeight / cam.scale) / CELL_STEP) + overscan,
      0,
      GRID_SIZE - 1
    );

    const showNumbers = cam.scale >= 0.62;
    const showPlus = cam.scale >= 0.82;
    const showImages = cam.scale >= 0.95;
    const showNames = cam.scale >= 1.1;

    const cellSize = CELL_SIZE * cam.scale;
    const radius = Math.max(3, 10 * cam.scale);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const id = getCellNumber(currentPage, row, col);
        const data = soldCells[id];

        const x =
          width -
          BOARD_PADDING -
          (col * CELL_STEP - cam.x) * cam.scale -
          cellSize;

        const y = BOARD_PADDING + (row * CELL_STEP - cam.y) * cam.scale;

        if (x > width || x + cellSize < 0 || y > height || y + cellSize < 0) {
          continue;
        }

        ctx.save();

        if (data?.status === "pending" || data?.status === "pending_payment") {
          roundedRect(ctx, x, y, cellSize, cellSize, radius);

          ctx.fillStyle = "#fff7ed";
          ctx.fill();

          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = Math.max(1, 2 * cam.scale);
          ctx.stroke();

          if (showNumbers) {
            const label = `#${id}`;

            ctx.fillStyle = "#92400e";
            ctx.font = `900 ${Math.max(7, 8 * cam.scale)}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x + cellSize / 2, y + cellSize * 0.35);
          }

          if (cellSize > 22) {
            ctx.fillStyle = "#92400e";
            ctx.font = `900 ${Math.max(7, 8 * cam.scale)}px Cairo, Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.direction = "rtl";
            ctx.fillText("قيد المراجعة", x + cellSize / 2, y + cellSize * 0.62, cellSize - 4);
          }

          if (hoverCellRef.current === id) {
            roundedRect(ctx, x - 2, y - 2, cellSize + 4, cellSize + 4, radius + 2);
            ctx.lineWidth = Math.max(2, 2.5 * cam.scale);
            ctx.strokeStyle = "#f59e0b";
            ctx.stroke();
          }

          ctx.restore();
          continue;
        }

        if (data) {
          roundedRect(ctx, x, y, cellSize, cellSize, radius);
          ctx.fillStyle = "#111";
          ctx.fill();

          if (showImages) {
            const padding = Math.max(1, 2 * cam.scale);
            const imageH = showNames ? cellSize * 0.72 : cellSize - padding * 2;

            const img = getImage(data.imageUrl);

            ctx.save();

            roundedRect(
              ctx,
              x + padding,
              y + padding,
              cellSize - padding * 2,
              imageH - padding,
              Math.max(2, 8 * cam.scale)
            );

            ctx.clip();

            if (img && img.complete && img.naturalWidth > 0) {
              drawImageCover(
                ctx,
                img,
                x + padding,
                y + padding,
                cellSize - padding * 2,
                imageH - padding
              );
            } else {
              ctx.fillStyle = "#00d084";
              ctx.fillRect(x + padding, y + padding, cellSize - padding * 2, imageH);
            }

            ctx.restore();

            if (showNames) {
              ctx.fillStyle = "#fff";
              ctx.font = `900 ${Math.max(9, 9 * cam.scale)}px Cairo, Arial`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.direction = "rtl";

              const name = data.ownerName || "محجوز";
              ctx.fillText(name, x + cellSize / 2, y + cellSize * 0.87, cellSize - 4);
            }
          } else {
            ctx.fillStyle = "#00d084";
            ctx.beginPath();
            ctx.arc(
              x + cellSize / 2,
              y + cellSize / 2,
              Math.max(3, cellSize * 0.16),
              0,
              Math.PI * 2
            );
            ctx.fill();
          }

          roundedRect(ctx, x, y, cellSize, cellSize, radius);
          ctx.lineWidth = Math.max(1, 1.5 * cam.scale);
          ctx.strokeStyle = "#111";
          ctx.stroke();
        } else {
          roundedRect(ctx, x, y, cellSize, cellSize, radius);
          ctx.fillStyle = "#fbf8f2";
          ctx.fill();

          ctx.setLineDash([Math.max(2, 4 * cam.scale), Math.max(2, 4 * cam.scale)]);
          ctx.lineWidth = Math.max(1, 1 * cam.scale);
          ctx.strokeStyle = "#d4cabd";
          ctx.stroke();
          ctx.setLineDash([]);

          if (showPlus) {
            ctx.fillStyle = "#c3b8a8";
            ctx.font = `900 ${Math.max(12, 18 * cam.scale)}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("+", x + cellSize / 2, y + cellSize / 2 + 1);
          }
        }

        if (showNumbers) {
          const label = `#${id}`;
          const tagHeight = Math.max(12, 13 * cam.scale);
          const tagWidth = Math.min(
            cellSize - 6,
            Math.max(28, label.length * 5.4 * cam.scale)
          );

          const tagX = x + cellSize - tagWidth - Math.max(3, 4 * cam.scale);
          const tagY = y + Math.max(3, 4 * cam.scale);

          roundedRect(ctx, tagX, tagY, tagWidth, tagHeight, 999);
          ctx.fillStyle = data ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.82)";
          ctx.fill();

          ctx.fillStyle = "#111";
          ctx.font = `900 ${Math.max(7, 8 * cam.scale)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, tagX + tagWidth / 2, tagY + tagHeight / 2 + 0.5);
        }

        if (hoverCellRef.current === id) {
          roundedRect(ctx, x - 2, y - 2, cellSize + 4, cellSize + 4, radius + 2);
          ctx.lineWidth = Math.max(2, 2.5 * cam.scale);
          ctx.strokeStyle = "#00d084";
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport.width || !viewport.height) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const physicalWidth = Math.floor(viewport.width * dpr);
    const physicalHeight = Math.floor(viewport.height * dpr);

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
    }

    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    const cam = cameraRef.current;

    drawBackground(ctx, viewport.width, viewport.height, cam);

    if (cam.scale <= FAR_ONLY_ZOOM) {
      drawFarMode(ctx, viewport.width, viewport.height, cam);
    } else if (cam.scale < CELLS_ONLY_ZOOM) {
      const t = clamp(
        (cam.scale - FAR_ONLY_ZOOM) / (CELLS_ONLY_ZOOM - FAR_ONLY_ZOOM),
        0,
        1
      );

      ctx.save();
      ctx.globalAlpha = 1 - t;
      drawFarMode(ctx, viewport.width, viewport.height, cam);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = t;
      drawCellsMode(ctx, viewport.width, viewport.height, cam);
      ctx.restore();
    } else {
      drawCellsMode(ctx, viewport.width, viewport.height, cam);
    }
  }, [viewport, currentPage, soldCells]);

  useEffect(() => {
    drawRef.current = draw;
    requestDraw();
  }, [draw, requestDraw]);

  function zoomAt(clientX, clientY, nextScale, shouldAnimate = false) {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const cam = cameraRef.current;

    const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);

    const fromRight = rect.right - clientX - BOARD_PADDING;
    const fromTop = clientY - rect.top - BOARD_PADDING;

    const contentX = cam.x + fromRight / cam.scale;
    const contentY = cam.y + fromTop / cam.scale;

    const nextCamera = {
      scale,
      x: contentX - fromRight / scale,
      y: contentY - fromTop / scale,
    };

    if (shouldAnimate) {
      animateToCamera(nextCamera);
    } else {
      setSafeCamera(nextCamera);
    }
  }

  function zoomCenter(factor) {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();

    zoomAt(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      cameraRef.current.scale * factor,
      true
    );
  }

  useImperativeHandle(ref, () => ({
    zoomIn() {
      zoomCenter(1.22);
    },

    zoomOut() {
      zoomCenter(0.82);
    },

    reset() {
      animateToCamera({
        x: 0,
        y: 0,
        scale: 1,
      });
    },

    goToCell(cellId) {
      const { row, col } = getRowColFromCellId(cellId);

      const nextScale = 1.25;

      const usableWidth = Math.max(1, viewport.width - BOARD_PADDING * 2);
      const usableHeight = Math.max(1, viewport.height - BOARD_PADDING * 2);

      const visibleWidth = usableWidth / nextScale;
      const visibleHeight = usableHeight / nextScale;

      animateToCamera({
        scale: nextScale,
        x: col * CELL_STEP - visibleWidth / 2 + CELL_SIZE / 2,
        y: row * CELL_STEP - visibleHeight / 2 + CELL_SIZE / 2,
      });
    },
  }));

  function handleWheel(e) {
    e.preventDefault();

    const cam = cameraRef.current;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;

    zoomAt(e.clientX, e.clientY, cam.scale * factor, false);
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;

    cancelCameraAnimation();

    const cam = cameraRef.current;

    dragRef.current = {
      isDragging: true,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: cam.x,
      originY: cam.y,
    };

    wrapperRef.current?.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;

    if (drag.isDragging) {
      const cam = cameraRef.current;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        drag.hasMoved = true;
      }

      setSafeCamera({
        ...cam,
        x: drag.originX + dx / cam.scale,
        y: drag.originY - dy / cam.scale,
      });

      hoverCellRef.current = null;
      requestDraw();
      return;
    }

    const hovered = getCellFromPoint(e.clientX, e.clientY);
    hoverCellRef.current = hovered?.id || null;
    requestDraw();
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    const moved = drag.hasMoved;

    drag.isDragging = false;

    wrapperRef.current?.releasePointerCapture?.(e.pointerId);

    if (!moved) {
      const cell = getCellFromPoint(e.clientX, e.clientY);

      if (cell) {
        onCellClick?.(cell.id);
      }
    }

    setTimeout(() => {
      drag.hasMoved = false;
    }, 80);
  }

  function handlePointerLeave() {
    hoverCellRef.current = null;
    requestDraw();
  }
useEffect(() => {
  const el = wrapperRef.current;
  if (!el) return;

  function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getCenter(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }

  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];

      touchRef.current = {
        ...touchRef.current,
        mode: "pan",
        lastX: touch.clientX,
        lastY: touch.clientY,
      };

      cancelCameraAnimation?.();
      return;
    }

    if (e.touches.length === 2) {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const center = getCenter(t1, t2);
      const startCamera = cameraRef.current;

      const localCenterX = center.x - rect.left;
      const localCenterY = center.y - rect.top;

      const fromRight = rect.width - localCenterX - BOARD_PADDING;
      const fromTop = localCenterY - BOARD_PADDING;

      const anchorX = startCamera.x + fromRight / startCamera.scale;
      const anchorY = startCamera.y + fromTop / startCamera.scale;

      touchRef.current = {
        ...touchRef.current,
        mode: "pinch",
        startDistance: getDistance(t1, t2),
        startCenterX: center.x,
        startCenterY: center.y,
        startCamera,
        anchorX,
        anchorY,
      };

      cancelCameraAnimation?.();
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 1 && touchRef.current.mode === "pan") {
      e.preventDefault();

      const touch = e.touches[0];
      const cam = cameraRef.current;

      const dx = touch.clientX - touchRef.current.lastX;
      const dy = touch.clientY - touchRef.current.lastY;

      touchRef.current.lastX = touch.clientX;
      touchRef.current.lastY = touch.clientY;

      setSafeCamera({
        ...cam,
        x: cam.x + dx / cam.scale,
        y: cam.y - dy / cam.scale,
      });

      return;
    }

    if (e.touches.length === 2 && touchRef.current.mode === "pinch") {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const distance = getDistance(t1, t2);
      const center = getCenter(t1, t2);

      const startCamera = touchRef.current.startCamera;
      if (!startCamera || !touchRef.current.startDistance) return;

      const scaleFactor = distance / touchRef.current.startDistance;
      const nextScale = clamp(
        startCamera.scale * scaleFactor,
        MIN_ZOOM,
        MAX_ZOOM
      );

      const localCenterX = center.x - rect.left;
      const localCenterY = center.y - rect.top;

      const fromRight = rect.width - localCenterX - BOARD_PADDING;
      const fromTop = localCenterY - BOARD_PADDING;

      setSafeCamera({
        scale: nextScale,
        x: touchRef.current.anchorX - fromRight / nextScale,
        y: touchRef.current.anchorY - fromTop / nextScale,
      });
    }
  }

  function handleTouchEnd(e) {
  if (e.touches.length === 0) {
    touchRef.current.mode = "none";
    touchRef.current.startCamera = null;
  }

  if (e.touches.length === 1) {
    const touch = e.touches[0];

    touchRef.current.mode = "pan";
    touchRef.current.lastX = touch.clientX;
    touchRef.current.lastY = touch.clientY;
    touchRef.current.startCamera = null;
  }
}

  el.addEventListener("touchstart", handleTouchStart, { passive: false });
  el.addEventListener("touchmove", handleTouchMove, { passive: false });
  el.addEventListener("touchend", handleTouchEnd, { passive: false });
  el.addEventListener("touchcancel", handleTouchEnd, { passive: false });

  return () => {
    el.removeEventListener("touchstart", handleTouchStart);
    el.removeEventListener("touchmove", handleTouchMove);
    el.removeEventListener("touchend", handleTouchEnd);
    el.removeEventListener("touchcancel", handleTouchEnd);
  };
}, [setSafeCamera]);

  return (
    <div
      ref={wrapperRef}
      className="canvasViewport"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <canvas ref={canvasRef} className="pixelCanvas" />
    </div>
  );
});

export default PixelCanvas;