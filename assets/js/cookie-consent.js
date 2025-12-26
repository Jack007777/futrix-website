(function () {
  const KEY = "cookieConsent"; // 只用这一个 key：all | necessary

  function initCookieConsent() {
    const banner = document.getElementById("cookie-banner");
    const acceptBtn = document.getElementById("cookie-accept");
    const rejectBtn = document.getElementById("cookie-reject");

    // footer 还没注入进来时，banner 可能不存在
    if (!banner || !acceptBtn) return;

    // 1) 如果已经同意/拒绝过，就不显示
    const consent = localStorage.getItem(KEY);
    if (consent === "all" || consent === "necessary") {
      banner.style.display = "none";
    } else {
      banner.style.display = "flex";
    }

    // 2) 只绑定一次点击事件（避免重复绑定导致异常）
    if (!acceptBtn.dataset.bound) {
      acceptBtn.addEventListener("click", () => {
        localStorage.setItem(KEY, "all");
        banner.style.display = "none";
      });
      acceptBtn.dataset.bound = "1";
    }

    if (rejectBtn && !rejectBtn.dataset.bound) {
      rejectBtn.addEventListener("click", () => {
        localStorage.setItem(KEY, "necessary");
        banner.style.display = "none";
      });
      rejectBtn.dataset.bound = "1";
    }
  }

  // 暴露出来：footer 注入后可以手动调用
  window.initCookieConsent = initCookieConsent;

  // 页面加载时也尝试初始化一次
  document.addEventListener("DOMContentLoaded", initCookieConsent);
})();
