import { effectiveZoom } from './effective-zoom.mjs';
import { sideMenuOffset } from './side-menu-position.mjs';
import { ref, onBeforeUnmount } from 'vue';
import { reorderBlock } from '../free-template/block-drag.mjs';
import { createBlockHoverDwell } from './block-hover-dwell.mjs';

// Both document editors share Yiitap's six-dot handle. A drag lifts the block
// itself out of the flow, follows the pointer vertically, commits the new position
// live so the surrounding blocks slide with a visible spring, then bounces the
// block into its slot on drop.
//
// ProseMirror treats class/style changes on a content block as a DOM change and
// rebuilds that node, which would drop the lift after the first reorder. The
// dragged block is therefore styled from the editor root (attributes on the root
// are ignored by ProseMirror) through a generated nth-child rule.
const THRESHOLD = 4;
const FLIP_MS = 280;
const SETTLE_MS = 260;
const FLIP_EASE = 'cubic-bezier(.22,.7,.3,1)';
const SCROLL_EDGE = 44;
const SCROLL_STEP = 12;
const HOVER_DWELL_MS = 140;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let dragSequence = 0;

export function useBlockDrag(editor, isDisabled) {
  const dropLine = ref(null);
  const menuOffsets = new WeakMap();
  let stopDrag = () => {};
  let suppressClick = false;
  let hoverMenu = null;
  let hoverEditor = null;
  let anchorTop = null;
  let anchorLeft = null;

  // Yiitap reanchors the menu on mouseover. Hold it on the current block until
  // the pointer has stayed over a different block long enough to select it.
  function visibleMenu(ed, y) {
    const doc = ed.view.dom.ownerDocument;
    const view = ed.view.dom.getBoundingClientRect();
    return [...doc.querySelectorAll('.side-menu')]
      .filter(menu => menu.querySelector('.o-drag-btn')
        && doc.defaultView.getComputedStyle(menu).visibility === 'visible'
        && menu.closest('[data-tippy-root]')?.style.visibility === 'visible')
      .sort((a, b) => {
        const distance = menu => {
          const rect = menu.getBoundingClientRect();
          return Math.abs(rect.right - view.left) + Math.abs((rect.top + rect.bottom) / 2 - y);
        };
        return distance(a) - distance(b);
      })[0] ?? null;
  }

  function positionMenu(ed, menu, top) {
    if (!menu?.isConnected) return;
    const rect = menu.getBoundingClientRect();
    const view = ed.view.dom.getBoundingClientRect();
    const offset = sideMenuOffset({
      rect, view, anchorLeft, anchorTop: top,
      previous: menuOffsets.get(menu) ?? { x: 0, y: 0 },
      menuScale: effectiveZoom(menu), editorScale: effectiveZoom(ed.view.dom),
    });
    menu.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    menuOffsets.set(menu, offset);
  }

  function blockTop(dom, menu) {
    const rect = dom.getBoundingClientRect();
    return rect.top + Math.min(rect.height, 26) / 2 - menu.getBoundingClientRect().height / 2;
  }

  const hoverDwell = createBlockHoverDwell(dom => {
    if (!hoverEditor || !hoverMenu || !dom.isConnected) return;
    anchorTop = blockTop(dom, hoverMenu);
    anchorLeft = dom.getBoundingClientRect().left;
    positionMenu(hoverEditor, hoverMenu, anchorTop);
  }, {delay:HOVER_DWELL_MS});

  function trackBlock(ed, menu, y, sourceNode=null, originalRect=null) {
    if (!menu) return;
    if (menu !== hoverMenu) {
      hoverDwell.reset();
      hoverMenu = menu;
      anchorTop = null;
      anchorLeft = null;
    }
    hoverEditor = ed;
    const items = blocks().filter(item => item.node !== sourceNode
      || (originalRect && y >= originalRect.top && y <= originalRect.bottom));
    const hovered = items.find(item => y >= item.rect.top && y <= item.rect.bottom)
      ?? [...items].sort((a,b) => Math.abs((a.rect.top+a.rect.bottom)/2-y)-Math.abs((b.rect.top+b.rect.bottom)/2-y))[0];
    if (!hovered) return;
    if (anchorLeft === null) anchorLeft = hovered.rect.left;
    hoverDwell.aim(hovered.dom);
    positionMenu(ed, menu, anchorTop ?? menu.getBoundingClientRect().top);
  }

  function handleHover(event) {
    const ed = editor.value;
    if (!ed || ed.isDestroyed || isDisabled() || !ed.view.dom.contains(event.target)) return;
    const menu = visibleMenu(ed, event.clientY);
    trackBlock(ed, menu, event.clientY);
  }

  function handleLeave() { hoverDwell.leave(); }

  function blocks() {
    const ed = editor.value;
    const result = [];
    if (!ed || ed.isDestroyed) return result;
    ed.state.doc.forEach((node, pos) => {
      const dom = ed.view.nodeDOM(pos);
      if (!dom?.getBoundingClientRect) return;
      result.push({ node, pos, dom, rect: dom.getBoundingClientRect() });
    });
    return result;
  }

  function startDrag(event) {
    const handle = event.target.closest?.('.o-drag-btn');
    if (!handle || event.button !== 0 || isDisabled() || !editor.value || editor.value.isDestroyed || !editor.value.isEditable) return;
    stopDrag();
    const ed = editor.value;
    const handleRect = handle.getBoundingClientRect();
    const y = handleRect.top + handleRect.height / 2;
    const items = blocks();
    const source = items.find(item => y >= item.rect.top && y <= item.rect.bottom)
      ?? [...items].sort((a, b) => Math.abs((a.rect.top + a.rect.bottom) / 2 - y) - Math.abs((b.rect.top + b.rect.bottom) / 2 - y))[0];
    if (!source) return;

    // Yiitap's floating handle can lose its HTML drag target on pointer-down in WebKit.
    // Keep its handle/menu, and commit the drop through the same ProseMirror document.
    event.preventDefault();

    const doc = event.target.ownerDocument;
    const win = doc.defaultView ?? window;
    const dragMenu = handle.closest('.side-menu');
    hoverDwell.leave();
    const dragToken = `drag-${++dragSequence}`;
    const sourceNode = source.node;
    const originalIndex = items.indexOf(source);
    const start = { x: event.clientX, y: event.clientY };
    const pointer = { y: start.y };
    const grabOffset = start.y - source.rect.top;

    let started = false;
    let finished = false;
    let moved = false;
    let translateY = 0;
    let styledIndex = -1;
    let lastBoundary = null;
    let lastMoveAt = 0;
    let raf = 0;
    let scrollEl;
    let styleEl = null;

    const scrollAncestor = () => {
      let node = ed.view.dom.parentElement;
      while (node) {
        const style = win.getComputedStyle(node);
        if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
        node = node.parentElement;
      }
      return doc.scrollingElement;
    };

    // Layout position without the element's own translate, so a block that is
    // mid-slide still reports the slot it is moving to.
    const layoutTop = dom => {
      const rect = dom.getBoundingClientRect();
      const transform = win.getComputedStyle(dom).transform;
      if (!transform || transform === 'none') return rect.top;
      try {
        return rect.top - new win.DOMMatrixReadOnly(transform).m42 * effectiveZoom(dom);
      } catch {
        return rect.top;
      }
    };

    // Locate the dragged node in the current document by identity: reorderBlock
    // re-inserts the same node object, so its position survives each move.
    const locate = () => {
      let found = null;
      let index = 0;
      ed.state.doc.forEach((node, pos) => {
        if (found) return;
        if (node === sourceNode) found = { index, pos };
        index++;
      });
      return found;
    };

    const syncRule = index => {
      if (index === styledIndex || !styleEl) return;
      styledIndex = index;
      const target = `[data-block-drag] > :nth-child(${index + 1})`;
      styleEl.textContent = [
        `${target}{position:relative;z-index:40;background:#fff;border-radius:4px;outline:1px solid #d8c6a6;outline-offset:3px;box-shadow:0 18px 38px #2b241a33,0 3px 10px #0000001a;transform:translateY(var(--block-drag-y,0px));will-change:transform;pointer-events:none;transition:box-shadow .18s ease,outline-color .18s ease,background-color .18s ease}`,
        `${target},${target} *{cursor:grabbing!important;pointer-events:none!important}`,
      ].join('');
    };

    // Match the column add control: keep the grab point directly under the pointer.
    const place = () => {
      if (!started || ed.isDestroyed) return;
      const info = locate();
      if (!info) return;
      syncRule(info.index);
      const dom = ed.view.nodeDOM(info.pos);
      if (!dom) return;
      const slotTop = layoutTop(dom);
      translateY = (pointer.y - grabOffset - slotTop) / effectiveZoom(dom);
      ed.view.dom.style.setProperty('--block-drag-y', `${translateY}px`);
      if (!finished) {
        const view = ed.view.dom.getBoundingClientRect();
        dropLine.value = { left: view.left + 30, top: slotTop, width: view.width - 60 };
      }
    };

    const settle = () => {
      for (const item of blocks()) {
        if (item.node === sourceNode) continue;
        for (const animation of item.dom.getAnimations()) animation.cancel();
      }
    };

    // Capture the visible rects first, so a crossing mid-slide continues from
    // where the neighbours actually are instead of snapping to final layout.
    const snapshot = () => new Map(blocks().filter(item => item.node !== sourceNode).map(item => [item.node, item.rect]));

    const flip = before => {
      if (reducedMotion()) return;
      for (const item of blocks()) {
        if (item.node === sourceNode) continue;
        const from = before.get(item.node);
        if (!from) continue;
        const dy = (from.top - item.rect.top) / effectiveZoom(item.dom);
        if (Math.abs(dy) < 0.5) continue;
        const overshoot = -Math.sign(dy) * 5;
        item.dom.animate(
          [
            { transform: `translateY(${dy}px)` },
            { transform: `translateY(${overshoot}px)`, offset: 0.72 },
            { transform: 'translateY(0)' },
          ],
          { duration: FLIP_MS, easing: FLIP_EASE },
        );
      }
    };

    // Drop into the slot directly before the first block whose middle is below
    // the pointer; the source's own old slot is not part of the comparison.
    const retarget = () => {
      if (!started || finished || isDisabled() || ed.isDestroyed) return;
      const info = locate();
      if (!info) return;
      const list = [];
      ed.state.doc.forEach((node, pos) => {
        if (node === sourceNode) return;
        const dom = ed.view.nodeDOM(pos);
        if (!dom?.getBoundingClientRect) return;
        const rect = dom.getBoundingClientRect();
        const top = layoutTop(dom);
        list.push({ pos, top, bottom: top + rect.height });
      });
      const next = list.find(item => pointer.y < (item.top + item.bottom) / 2);
      const boundary = next?.pos ?? ed.state.doc.content.size;
      if (boundary === lastBoundary) return;
      lastBoundary = boundary;
      const closeGroup = Date.now() - lastMoveAt > 500;
      const tr = reorderBlock(ed.state, info.pos, boundary, { closeGroup, scrollIntoView: false });
      if (!tr) return;
      const before = snapshot();
      settle();
      moved = true;
      lastMoveAt = Date.now();
      ed.view.dispatch(tr);
      const movedInfo = locate();
      if (movedInfo) syncRule(movedInfo.index);
      flip(before);
    };

    // Put the block back in its original slot: insert before the block that now
    // occupies that index, or append when it was last.
    const restore = () => {
      if (ed.isDestroyed) return;
      const info = locate();
      if (!info) return;
      const others = [];
      ed.state.doc.forEach((node, pos) => { if (node !== sourceNode) others.push({ pos }); });
      const boundary = originalIndex < others.length ? others[originalIndex].pos : ed.state.doc.content.size;
      const tr = reorderBlock(ed.state, info.pos, boundary, { scrollIntoView: false });
      if (tr) ed.view.dispatch(tr);
      const restored = locate();
      if (restored) syncRule(restored.index);
      place();
    };

    const loop = () => {
      if (!started || finished) return;
      const top = scrollEl === doc.scrollingElement ? 0 : scrollEl.getBoundingClientRect().top;
      const bottom = scrollEl === doc.scrollingElement ? win.innerHeight : scrollEl.getBoundingClientRect().bottom;
      let step = 0;
      if (pointer.y < top + SCROLL_EDGE) step = -SCROLL_STEP;
      else if (pointer.y > bottom - SCROLL_EDGE) step = SCROLL_STEP;
      if (step) scrollEl.scrollBy(0, step);
      if (dragMenu) trackBlock(ed, dragMenu, pointer.y, sourceNode, source.rect);
      place();
      retarget();
      raf = win.requestAnimationFrame(loop);
    };

    const removeListeners = () => {
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
      doc.removeEventListener('keydown', key, true);
      win.removeEventListener('blur', blur);
      win.cancelAnimationFrame(raf);
    };

    // Remove only the root-level drag state. Closing the editor's DOM observer
    // is unnecessary here because ProseMirror ignores attribute changes on root.
    const cleanupLift = () => {
      if (!ed.isDestroyed && ed.view.dom.getAttribute('data-block-drag') === dragToken) {
        ed.view.dom.removeAttribute('data-block-drag');
        ed.view.dom.style.removeProperty('--block-drag-y');
      }
      styleEl?.remove();
    };

    const begin = () => {
      started = true;
      styleEl = doc.createElement('style');
      styleEl.setAttribute('data-block-drag-style', dragToken);
      doc.head.appendChild(styleEl);
      ed.view.dom.setAttribute('data-block-drag', dragToken);
      ed.view.dom.style.setProperty('--block-drag-y', '0px');
      doc.documentElement.classList.add('sorting');
      scrollEl = scrollAncestor();
      place();
      retarget();
      raf = win.requestAnimationFrame(loop);
    };

    const finish = (commit, event) => {
      if (finished) return;
      finished = true;
      removeListeners();
      dropLine.value = null;
      doc.documentElement.classList.remove('sorting');
      if (!started) {
        cleanupLift();
        return;
      }
      const rect = ed.view.dom.getBoundingClientRect();
      const inside = !!event
        && event.clientX >= rect.left - 60 && event.clientX <= rect.right + 30
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      const shouldCommit = commit && inside && !isDisabled() && !ed.isDestroyed && ed.isEditable;
      if (moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
      }
      if (!shouldCommit) restore();
      const info = ed.isDestroyed ? null : locate();
      const settleEl = info ? ed.view.nodeDOM(info.pos) : null;
      if (settleEl && !reducedMotion() && Math.abs(translateY) > 0.5) {
        const from = `translateY(${translateY}px)`;
        const overshoot = -Math.sign(translateY) * 6;
        const settleAnimation = settleEl.animate(
          [
            { transform: from },
            { transform: `translateY(${overshoot}px)`, offset: 0.72 },
            { transform: 'translateY(0)' },
          ],
          { duration: SETTLE_MS, easing: FLIP_EASE },
        );
        settleAnimation.finished.finally(cleanupLift).catch(() => {});
      } else {
        cleanupLift();
      }
      if (shouldCommit) ed.commands.focus();
    };

    const move = e => {
      pointer.y = e.clientY;
      if (dragMenu) trackBlock(ed, dragMenu, e.clientY, sourceNode, source.rect);
      if (!started) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < THRESHOLD) return;
        begin();
        return;
      }
      e.preventDefault();
    };

    const up = e => finish(true, e);
    const key = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false, null);
      }
    };
    const blur = () => finish(false, null);

    stopDrag = () => {
      if (!finished) finish(false, null);
    };

    doc.addEventListener('mousemove', move);
    doc.addEventListener('mouseup', up);
    doc.addEventListener('keydown', key, true);
    win.addEventListener('blur', blur);
  }

  function handleClick(event) {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }

  onBeforeUnmount(() => {
    stopDrag();
    hoverDwell.reset();
    if (hoverMenu) hoverMenu.style.transform = '';
  });

  return { dropLine, startDrag, handleClick, handleHover, handleLeave };
}
