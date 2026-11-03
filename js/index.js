(function () {
  "use strict";

  const app = window.ProsekaApp;
  const startButton = document.querySelector("#start-button");
  const continueButton = document.querySelector("#continue-button");
  const savedStatus = document.querySelector("#saved-status");
  const state = app.loadState();

  if (app.hasProgress(state)) {
    const progress = app.getProgress(state);
    continueButton.hidden = false;
    savedStatus.textContent = `已有進度：${progress.detail}，${progress.label}`;
  } else {
    continueButton.hidden = true;
    savedStatus.textContent = "進度只保存在這台裝置的瀏覽器中";
  }

  startButton.addEventListener("click", () => {
    if (app.hasProgress(state)) {
      const shouldReset = window.confirm("重新開始會清除目前保存在此瀏覽器的排序進度。確定要繼續嗎？");
      if (!shouldReset) return;
    }
    app.resetState();
    window.location.href = "./sorter.html";
  });

  continueButton.addEventListener("click", () => {
    window.location.href = "./sorter.html";
  });
})();
