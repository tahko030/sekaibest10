(function () {
  "use strict";

  const app = window.ProsekaApp;
  let state = app.loadState();
  const ranked = app.getRankedSongs(state);
  const topTenGrid = document.querySelector("#top-ten-grid");
  const rankingList = document.querySelector("#ranking-list");
  const continueButton = document.querySelector("#continue-sorting");
  const nicknameInput = document.querySelector("#nickname-input");
  const restartButton = document.querySelector("#restart-button");
  const exportButton = document.querySelector("#export-button");
  const exportStatus = document.querySelector("#export-status");
  const emptyState = document.querySelector("#empty-state");
  const resultContent = document.querySelector("#result-content");
  const nicknameStorageKey = "proseka-song-sorter-nickname";

  nicknameInput.value = localStorage.getItem(nicknameStorageKey) || "";
  nicknameInput.addEventListener("input", () => {
    localStorage.setItem(nicknameStorageKey, nicknameInput.value);
  });

  if (!app.hasProgress(state)) {
    resultContent.hidden = true;
    emptyState.hidden = false;
  } else {
    renderResults();
  }

  function renderResults() {
    ranked.slice(0, 10).forEach((song, index) => {
      const card = document.createElement("article");
      card.className = "rank-card";

      const imageWrap = document.createElement("div");
      imageWrap.className = "rank-image-wrap";
      const image = document.createElement("img");
      image.className = "rank-image";
      image.alt = `${song.title} 的 YouTube 影片縮圖`;
      image.loading = index < 3 ? "eager" : "lazy";
      app.setThumbnailFallback(image, app.videoIdFor(song));
      imageWrap.appendChild(image);

      const copy = document.createElement("div");
      copy.className = "rank-copy";
      const number = document.createElement("span");
      number.className = "rank-number";
      number.textContent = `#${index + 1}`;
      const title = document.createElement("h3");
      title.className = "rank-title";
      title.textContent = song.title;
      const creator = document.createElement("p");
      creator.className = "rank-creator";
      creator.textContent = song.creator;
      const unit = document.createElement("p");
      unit.className = "rank-unit";
      unit.textContent = song.unit;
      copy.append(number, title, creator, unit);
      card.append(imageWrap, copy);
      topTenGrid.appendChild(card);
    });

    ranked.slice(10).forEach((song, index) => {
      const item = document.createElement("li");
      item.className = "ranking-item";
      const position = document.createElement("span");
      position.className = "ranking-position";
      position.textContent = String(index + 11).padStart(3, "0");
      const details = document.createElement("div");
      details.className = "ranking-details";
      const title = document.createElement("span");
      title.className = "ranking-name";
      title.textContent = song.title;
      const creator = document.createElement("span");
      creator.className = "ranking-creator";
      creator.textContent = song.creator;
      details.append(title, creator);
      item.append(position, details);
      rankingList.appendChild(item);
    });
  }

  function loadThumbnail(videoId) {
    const candidates = app.thumbnailUrls(videoId);
    return new Promise((resolve, reject) => {
      let index = 0;
      const tryNext = () => {
        if (index >= candidates.length) {
          reject(new Error(`縮圖載入失敗：${videoId}`));
          return;
        }
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const isTinyPlaceholder = image.naturalWidth <= 120 || image.naturalHeight <= 90;
          if (isTinyPlaceholder && index < candidates.length - 1) {
            index += 1;
            tryNext();
            return;
          }
          resolve(image);
        };
        image.onerror = () => {
          index += 1;
          tryNext();
        };
        image.src = candidates[index];
      };
      tryNext();
    });
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawCoverImage(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  function fitText(ctx, text, maxWidth, font) {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
      result = result.slice(0, -1);
    }
    return `${result}…`;
  }

  async function exportImage() {
    exportButton.disabled = true;
    exportStatus.textContent = "正在載入前十名縮圖並製作圖片…";

    try {
      if (document.fonts && typeof document.fonts.load === "function") {
        await Promise.all([
          document.fonts.load('400 88px "Klee One"'),
          document.fonts.load('400 24px "Klee One"'),
          document.fonts.load('700 44px "Klee One"'),
          document.fonts.load('700 72px "Klee One"'),
          document.fonts.ready,
        ]);
      }
      const topTen = ranked.slice(0, 10);
      const images = await Promise.all(topTen.map((song) => loadThumbnail(app.videoIdFor(song))));
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");

      const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
      gradient.addColorStop(0, "#07101f");
      gradient.addColorStop(0.52, "#10254a");
      gradient.addColorStop(1, "#17142f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);

      const glowA = ctx.createRadialGradient(150, 150, 20, 150, 150, 500);
      glowA.addColorStop(0, "rgba(53,226,236,0.28)");
      glowA.addColorStop(1, "rgba(53,226,236,0)");
      ctx.fillStyle = glowA;
      ctx.fillRect(0, 0, 650, 650);
      const glowB = ctx.createRadialGradient(940, 240, 10, 940, 240, 460);
      glowB.addColorStop(0, "rgba(255,95,162,0.24)");
      glowB.addColorStop(1, "rgba(255,95,162,0)");
      ctx.fillStyle = glowB;
      ctx.fillRect(500, 0, 580, 700);

      const nickname = nicknameInput.value.trim();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      if (nickname) {
        const nicknameLine = `${nickname}的`;
        ctx.font = '700 44px "Klee One", cursive';
        ctx.fillText(fitText(ctx, nicknameLine, 960, '700 44px "Klee One", cursive'), 540, 82);
      }
      ctx.font = '700 72px "Klee One", cursive';
      ctx.fillText("プロセカ書下曲 TOP 10", 540, nickname ? 180 : 142);
      ctx.textAlign = "start";

      const first = topTen[0];
      roundedRect(ctx, 50, 280, 980, 390, 28);
      ctx.fillStyle = "rgba(17,34,62,0.94)";
      ctx.fill();
      drawCoverImage(ctx, images[0], 74, 304, 588, 331);
      ctx.fillStyle = "#35e2ec";
      ctx.font = '400 64px "Klee One", cursive';
      ctx.fillText("#1", 702, 382);
      ctx.fillStyle = "#ffffff";
      const firstTitle = fitText(ctx, first.title, 280, '400 46px "Klee One", cursive');
      ctx.font = '400 46px "Klee One", cursive';
      ctx.fillText(firstTitle, 702, 454);
      ctx.fillStyle = "#ffffff";
      ctx.font = '400 22px "Klee One", cursive';
      const firstCreator = fitText(ctx, first.creator, 280, '400 22px "Klee One", cursive');
      ctx.fillText(firstCreator, 702, 506);
      ctx.fillStyle = "#a9b6cf";
      ctx.font = '400 20px "Klee One", cursive';
      const firstUnit = fitText(ctx, first.unit, 280, '400 20px "Klee One", cursive');
      ctx.fillText(firstUnit, 702, 546);

      const cardWidth = 306;
      const cardHeight = 350;
      const gap = 20;
      const startX = 61;
      const startY = 700;

      for (let index = 1; index < 10; index += 1) {
        const gridIndex = index - 1;
        const column = gridIndex % 3;
        const row = Math.floor(gridIndex / 3);
        const x = startX + column * (cardWidth + gap);
        const y = startY + row * (cardHeight + gap);
        const song = topTen[index];

        roundedRect(ctx, x, y, cardWidth, cardHeight, 20);
        ctx.fillStyle = "rgba(17,34,62,0.94)";
        ctx.fill();
        drawCoverImage(ctx, images[index], x + 14, y + 14, cardWidth - 28, 156);
        ctx.fillStyle = "#35e2ec";
        ctx.font = '400 30px "Klee One", cursive';
        ctx.fillText(`#${index + 1}`, x + 18, y + 218);
        ctx.fillStyle = "#ffffff";
        const title = fitText(ctx, song.title, cardWidth - 36, '400 28px "Klee One", cursive');
        ctx.font = '400 28px "Klee One", cursive';
        ctx.fillText(title, x + 18, y + 258);
        const creator = fitText(ctx, song.creator, cardWidth - 36, '400 18px "Klee One", cursive');
        ctx.font = '400 18px "Klee One", cursive';
        ctx.fillText(creator, x + 18, y + 296);
        ctx.fillStyle = "#a9b6cf";
        const unit = fitText(ctx, song.unit, cardWidth - 36, '400 16px "Klee One", cursive');
        ctx.font = '400 16px "Klee One", cursive';
        ctx.fillText(unit, x + 18, y + 326);
      }

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = '400 18px "Klee One", cursive';
      ctx.textAlign = "center";
      ctx.fillText("Video thumbnails from YouTube · Personal result", 540, 1870);
      ctx.textAlign = "start";

      const blob = await new Promise((resolve, reject) => {
        try {
          canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("PNG 產生失敗"))), "image/png");
        } catch (error) {
          reject(error);
        }
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeNickname = nickname.replace(/[\\/:*?"<>|]/g, "-").slice(0, 24);
      link.download = safeNickname
        ? `proseka-${safeNickname}-top10.png`
        : "proseka-my-top10.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      exportStatus.textContent = "已產生 1080 × 1920 PNG。";
    } catch (error) {
      console.error(error);
      exportStatus.textContent = "圖片輸出失敗。請確認網路連線後重試；部分瀏覽器可能會阻擋外部縮圖。";
    } finally {
      exportButton.disabled = false;
    }
  }

  continueButton.addEventListener("click", () => {
    if (state.complete) state = app.extendSorting(state);
    window.location.href = "./sorter.html";
  });

  restartButton.addEventListener("click", () => {
    const confirmed = window.confirm("這會清除目前保存在此瀏覽器的全部排序結果。確定重新開始嗎？");
    if (!confirmed) return;
    state = app.resetState();
    window.location.href = "./sorter.html";
  });

  exportButton.addEventListener("click", exportImage);
})();
