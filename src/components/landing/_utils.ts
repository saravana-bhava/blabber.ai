export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80);
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 2) return;
  let t0: number | null = null;
  const dur = 540;
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  const step = (ts: number) => {
    if (t0 === null) t0 = ts;
    const p = Math.min(1, (ts - t0) / dur);
    window.scrollTo(0, start + dist * ease(p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
