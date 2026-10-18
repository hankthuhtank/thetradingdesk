(() => {
  "use strict";
  const key = "tdesk_learning_v2",
    count = window.TDESK?.SESSIONS?.length || 8;
  const read = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "[]");
      return Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x >= 0 && x < count) : [];
    } catch (_) {
      return [];
    }
  };
  let done = [];
  try {
    done =
      localStorage.getItem(key) !== null
        ? read(key)
        : [...new Set([...read("tdesk_completed"), ...read("tdesk_track_v1")])];
  } catch (_) {}
  window.DeskProgress = {
    get: () => [...done],
    set(values) {
      done = [...new Set(values)]
        .filter((x) => Number.isInteger(x) && x >= 0 && x < count)
        .sort((a, b) => a - b);
      try {
        localStorage.setItem(key, JSON.stringify(done));
      } catch (_) {}
      dispatchEvent(new CustomEvent("desk:progress"));
    },
  };
  try {
    localStorage.setItem(key, JSON.stringify(done));
  } catch (_) {}
  addEventListener("storage", (e) => {
    if (e.key === key) {
      done = read(key);
      dispatchEvent(new CustomEvent("desk:progress"));
    }
  });
})();
