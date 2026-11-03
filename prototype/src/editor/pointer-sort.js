// Shared pointer reordering for the template grid and binding rows.
// A grip drag lifts a floating ghost, turns the source slot into a dashed
// placeholder, and commits order changes live so neighbours can slide (FLIP).
const THRESHOLD = 4;
const FLIP_MS = 160;
const FLIP_EASE = 'cubic-bezier(.22,.7,.3,1)';
const SCROLL_EDGE = 44;
const SCROLL_STEP = 12;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function startPointerSort({ event, container, itemSelector, sourceId, ghostHost, onReorder, onCancel, onDrop, isDisabled }) {
  if (!event || event.button !== 0 || isDisabled?.()) return null;
  const doc = event.currentTarget?.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  const items = () => [...container.querySelectorAll(itemSelector)].filter(el => el.dataset.sortId);
  const find = id => items().find(el => el.dataset.sortId === id);
  if (!find(sourceId)) return null;

  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const grab = { x: 0, y: 0 };
  const pointer = { x: startX, y: startY };
  let started = false;
  let finished = false;
  let changed = false;
  let pending = null;
  let busy = false;
  let ghost = null;
  let logical = [];
  let raf = 0;
  let lastScroll = null;
  let scrollEl = doc.scrollingElement;

  const measure = () => items().map(el => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.sortId, el, top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  });

  const scrollAncestor = () => {
    let node = container.parentElement;
    while (node) {
      const style = win.getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
      node = node.parentElement;
    }
    return doc.scrollingElement;
  };

  const syncPlaceholder = () => {
    const el = find(sourceId);
    if (el && !el.classList.contains('sort-placeholder')) el.classList.add('sort-placeholder');
    return el;
  };

  const settle = () => {
    for (const el of items()) for (const animation of el.getAnimations()) animation.cancel();
  };

  const animate = (before, after) => {
    if (reducedMotion()) return;
    const previous = new Map(before.map(item => [item.id, item]));
    for (const item of after) {
      const from = previous.get(item.id);
      if (!from) continue;
      const dx = from.left - item.left;
      const dy = from.top - item.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      item.el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: FLIP_MS, easing: FLIP_EASE },
      );
    }
  };

  const enqueue = async target => {
    if (target === sourceId || finished) return;
    pending = target;
    if (busy) return;
    busy = true;
    try {
      while (pending && !finished) {
        const to = pending;
        pending = null;
        if (to === sourceId) continue;
        settle();
        const before = measure();
        await onReorder(sourceId, to);
        changed = true;
        if (finished) break;
        syncPlaceholder();
        const after = measure();
        logical = after;
        animate(before, after);
      }
    } finally {
      busy = false;
    }
  };

  const targetAt = (x, y) => {
    for (const item of logical) if (x >= item.left && x <= item.right && y >= item.top && y <= item.bottom) return item.id;
    if (!logical.length) return null;
    const bounds = container.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right) return null;
    if (y < Math.min(...logical.map(item => item.top))) return logical[0].id;
    if (y > Math.max(...logical.map(item => item.bottom))) return logical[logical.length - 1].id;
    return null;
  };

  const hit = () => {
    if (!started) return;
    const target = targetAt(pointer.x, pointer.y);
    if (target && target !== sourceId) void enqueue(target);
  };

  const placeGhost = () => {
    if (ghost) ghost.style.transform = `translate3d(${pointer.x - grab.x}px, ${pointer.y - grab.y}px, 0)`;
  };

  const loop = () => {
    if (!started || finished) return;
    const scroller = scrollEl;
    const top = scroller === doc.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
    const bottom = scroller === doc.scrollingElement ? win.innerHeight : scroller.getBoundingClientRect().bottom;
    const scrollTop = scroller.scrollTop ?? win.scrollY;
    if (lastScroll !== null && scrollTop !== lastScroll) {
      const delta = scrollTop - lastScroll;
      logical = logical.map(item => ({ ...item, top: item.top - delta, bottom: item.bottom - delta }));
    }
    lastScroll = scrollTop;
    let step = 0;
    if (pointer.y < top + SCROLL_EDGE) step = -SCROLL_STEP;
    else if (pointer.y > bottom - SCROLL_EDGE) step = SCROLL_STEP;
    if (step) {
      scroller.scrollBy(0, step);
      const next = scroller.scrollTop ?? win.scrollY;
      const delta = next - scrollTop;
      lastScroll = next;
      if (delta) logical = logical.map(item => ({ ...item, top: item.top - delta, bottom: item.bottom - delta }));
      hit();
    }
    raf = win.requestAnimationFrame(loop);
  };

  const begin = () => {
    const el = find(sourceId);
    if (!el) return;
    started = true;
    const rect = el.getBoundingClientRect();
    grab.x = startX - rect.left;
    grab.y = startY - rect.top;
    el.classList.add('sort-placeholder');
    ghost = el.cloneNode(true);
    ghost.removeAttribute('data-sort-id');
    ghost.classList.remove('sort-placeholder');
    ghost.querySelectorAll('[data-sort-id]').forEach(node => node.removeAttribute('data-sort-id'));
    ghost.querySelectorAll('button,input,select,textarea').forEach(node => node.tabIndex = -1);
    ghost.classList.add('sort-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    (ghostHost ?? doc.body).appendChild(ghost);
    logical = measure();
    scrollEl = scrollAncestor();
    lastScroll = null;
    doc.documentElement.classList.add('sorting');
    raf = win.requestAnimationFrame(loop);
  };

  const removeListeners = () => {
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerup', up);
    doc.removeEventListener('pointercancel', cancelEvent);
    doc.removeEventListener('keydown', key, true);
    win.removeEventListener('blur', blur);
    win.cancelAnimationFrame(raf);
  };

  const finish = async allowed => {
    if (finished) return;
    finished = true;
    removeListeners();
    if (!started) return;
    doc.documentElement.classList.remove('sorting');
    const bounds = container.getBoundingClientRect();
    const inside = pointer.x >= bounds.left - 24 && pointer.x <= bounds.right + 24
      && pointer.y >= bounds.top - 24 && pointer.y <= bounds.bottom + 24;
    if (!allowed || !inside || !changed) {
      ghost?.remove();
      ghost = null;
      if (changed) {
        try { await onCancel?.(); } catch { /* restoring is best effort */ }
      }
      find(sourceId)?.classList.remove('sort-placeholder');
      return;
    }
    const el = find(sourceId);
    const target = el?.getBoundingClientRect();
    if (ghost && target && !reducedMotion()) {
      const lifted = ghost;
      ghost = null;
      try {
        await lifted.animate(
          [{ transform: lifted.style.transform, opacity: 1 }, { transform: `translate3d(${target.left}px, ${target.top}px, 0)`, opacity: 0.15 }],
          { duration: 150, easing: FLIP_EASE },
        ).finished;
      } catch { /* the ghost is discarded below */ }
      lifted.remove();
    } else {
      ghost?.remove();
      ghost = null;
    }
    el?.classList.remove('sort-placeholder');
    onDrop?.();
  };

  const move = event => {
    if (event.pointerId !== pointerId) return;
    if (!started) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < THRESHOLD) return;
      begin();
    }
    if (!started) return;
    event.preventDefault();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    placeGhost();
    hit();
  };

  const up = event => {
    if (event.pointerId !== pointerId) return;
    void finish(true);
  };

  const cancelEvent = event => {
    if (event.pointerId !== pointerId) return;
    void finish(false);
  };

  const key = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      void finish(false);
    }
  };

  const blur = () => { void finish(false); };

  event.preventDefault();
  doc.addEventListener('pointermove', move, { passive: false });
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', cancelEvent);
  doc.addEventListener('keydown', key, true);
  win.addEventListener('blur', blur);

  return { cancel: () => finish(false) };
}
