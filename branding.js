(() => {
  const STORAGE_KEY = 'seedsBranding';
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { labels: {}, fonts: { nav: 1, heading: 1, column: 1 } };
      const parsed = JSON.parse(raw);
      return {
        labels: (parsed && parsed.labels && typeof parsed.labels === 'object') ? parsed.labels : {},
        fonts: {
          nav: Number(parsed?.fonts?.nav) || 1,
          heading: Number(parsed?.fonts?.heading) || 1,
          column: Number(parsed?.fonts?.column) || 1
        }
      };
    } catch (e) {
      return { labels: {}, fonts: { nav: 1, heading: 1, column: 1 } };
    }
  };
  let current = load();
  const defaults = () => (window.SEEDS_LABEL_DEFAULTS || {});
  const resolve = (key, fallback) => {
    const o = current.labels[key];
    if (typeof o === 'string' && o.trim() !== '') return o;
    const d = defaults()[key];
    if (typeof d === 'string' && d.trim() !== '') return d;
    return fallback != null ? fallback : key;
  };
  const applyFonts = () => {
    const root = document.documentElement;
    root.style.setProperty('--brand-nav-scale', String(current.fonts.nav));
    root.style.setProperty('--brand-heading-scale', String(current.fonts.heading));
    root.style.setProperty('--brand-column-scale', String(current.fonts.column));
  };
  const save = (next) => {
    if (next && next.labels) {
      Object.keys(next.labels).forEach(k => {
        if (typeof next.labels[k] === 'string' && next.labels[k].trim() === '') delete next.labels[k];
      });
      current.labels = Object.assign({}, current.labels, next.labels);
    }
    if (next && next.fonts) current.fonts = Object.assign({}, current.fonts, next.fonts);
    // drop empties
    Object.keys(current.labels).forEach(k => { if (!String(current.labels[k]).trim()) delete current.labels[k]; });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (e) {}
    applyFonts();
  };
  const resetLabels = (keys) => {
    if (keys && keys.length) keys.forEach(k => delete current.labels[k]);
    else current.labels = {};
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (e) {}
  };
  const resetFonts = () => {
    current.fonts = { nav: 1, heading: 1, column: 1 };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (e) {}
    applyFonts();
  };
  const resetAll = () => { current.labels = {}; current.fonts = { nav: 1, heading: 1, column: 1 }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (e) {} applyFonts(); };
  const get = () => ({ labels: Object.assign({}, current.labels), fonts: Object.assign({}, current.fonts) });
  window.SEEDS_BRANDING = { STORAGE_KEY, resolve, applyFonts, save, resetLabels, resetFonts, resetAll, get, reload: () => { current = load(); applyFonts(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyFonts);
  else applyFonts();
})();