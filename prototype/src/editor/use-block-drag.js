// 【学习09】六点手柄排序；对照指南第 7.9 节。use 开头表示复用状态/行为的 Vue composable。
// Yiitap 提供手柄 UI；此处用鼠标坐标/动画做交互，reorderBlock 用 PM 事务改真实块顺序。
// 当前这条路径监听鼠标事件，不等于另一套 pointer-sort 对触摸/手写笔的支持。
import { effectiveZoom } from './effective-zoom.mjs';
import { sideMenuAnchorTop, sideMenuOffset } from './side-menu-position.mjs';
import { ref, onBeforeUnmount } from 'vue';
import { affectedDragBlocks, dragTargetAt, reorderBlock } from '../free-template/block-drag.mjs';
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
  // dropLine 是需要 Vue 重绘的插入线；其余会话变量只供事件回调使用，不都需要 ref。
  // editor 是 shallowRef，isDisabled 是读取最新只读状态的函数，避免初始化后取值过期。
  const dropLine = ref(null);
  const menuOffsets = new WeakMap();
  let stopDrag = () => {};
  let suppressClick = false;
  let activeDrag = false;
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
    // 屏幕 rect 已受 zoom 影响，CSS transform 在元素自身坐标中应用，必须换算缩放。
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
    return sideMenuAnchorTop({ rect, menuHeight:menu.getBoundingClientRect().height, editorScale:effectiveZoom(dom) });
  }

  const hoverDwell = createBlockHoverDwell(dom => {
    // 跨块悬停够时长才换菜单锚点；在同一块内上下移动不让手柄一直追着鼠标抖动。
    if (!hoverEditor || !hoverMenu || !dom.isConnected) return;
    anchorTop = blockTop(dom, hoverMenu);
    anchorLeft = dom.getBoundingClientRect().left;
    positionMenu(hoverEditor, hoverMenu, anchorTop);
  }, {delay:HOVER_DWELL_MS});

  function hoveredBlock(items, y, sourceNode=null, originalRect=null) {
    const candidates = items.filter(item => item.node !== sourceNode
      || (originalRect && y >= originalRect.top && y <= originalRect.bottom));
    const top = item => item.top ?? item.rect.top;
    const bottom = item => item.bottom ?? item.rect.bottom;
    return candidates.find(item => y >= top(item) && y <= bottom(item))
      ?? [...candidates].sort((a,b) => Math.abs((top(a)+bottom(a))/2-y)-Math.abs((top(b)+bottom(b))/2-y))[0];
  }

  function trackBlock(ed, menu, y, items, sourceNode=null, originalRect=null) {
    if (!menu) return;
    if (menu !== hoverMenu) {
      hoverDwell.reset();
      hoverMenu = menu;
      anchorTop = null;
      anchorLeft = null;
    }
    hoverEditor = ed;
    const hovered = hoveredBlock(items, y, sourceNode, originalRect);
    if (!hovered) return;
    if (anchorLeft === null) anchorLeft = hovered.rect.left;
    hoverDwell.aim(hovered.dom);
    positionMenu(ed, menu, anchorTop ?? menu.getBoundingClientRect().top);
  }

  function trackDragHover(ed, menu, y, items, sourceNode, originalRect) {
    if (!menu) return;
    if (menu !== hoverMenu) {
      hoverDwell.reset();
      hoverMenu = menu;
      anchorTop = null;
      anchorLeft = null;
    }
    hoverEditor = ed;
    const hovered = hoveredBlock(items, y, sourceNode, originalRect);
    if (hovered) hoverDwell.aim(hovered.dom);
  }

  function handleHover(event) {
    const ed = editor.value;
    if (activeDrag || !ed || ed.isDestroyed || isDisabled() || !ed.view.dom.contains(event.target)) return;
    const menu = visibleMenu(ed, event.clientY);
    trackBlock(ed, menu, event.clientY, blocks());
  }

  function handleLeave() { hoverDwell.leave(); }

  function blocks() {
    // state.doc.forEach 只遍历顶层块；nodeDOM 将文档 pos 对回可测量的 DOM。
    // 分栏内的段落不是这里独立排序的顶层项，整组分栏作为一个块移动。
    const ed = editor.value;
    const result = [];
    if (!ed || ed.isDestroyed) return result;
    let index = 0;
    ed.state.doc.forEach((node, pos) => {
      const currentIndex = index++;
      const dom = ed.view.nodeDOM(pos);
      if (!dom?.getBoundingClientRect) return;
      result.push({ node, pos, index:currentIndex, dom, rect: dom.getBoundingClientRect() });
    });
    return result;
  }

  function startDrag(event) {
    // 捕获阶段识别 Yiitap 六点按钮；只有左键且可编辑才接管，不改变普通文字拖选。
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
    let lastMoveAt = 0;
    let raf = 0;
    let scrollEl;
    let styleEl = null;
    let geometry = [];
    let edgeTop = 0;
    let edgeBottom = win.innerHeight;
    const dragScale = effectiveZoom(source.dom);
    const editorRect = ed.view.dom.getBoundingClientRect();

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
    const layoutTop = (dom, rect) => {
      const transform = win.getComputedStyle(dom).transform;
      if (!transform || transform === 'none') return rect.top;
      try {
        return rect.top - new win.DOMMatrixReadOnly(transform).m42 * effectiveZoom(dom);
      } catch {
        return rect.top;
      }
    };

    const measureGeometry = () => blocks().map(item => {
      const top = layoutTop(item.dom, item.rect);
      return { ...item, top, bottom:top + item.rect.height };
    });

    const positionDragMenuAnchor = () => {
      if (!dragMenu || hoverMenu !== dragMenu) return;
      const dom = hoverDwell.current();
      const item = geometry.find(item => item.dom === dom);
      if (!item) return;
      anchorTop = blockTop(item.dom, dragMenu);
      anchorLeft = item.rect.left;
      positionMenu(ed, dragMenu, anchorTop);
    };

    // Locate the dragged node in the current document by identity: reorderBlock
    // re-inserts the same node object, so its position survives each move.
    // 节点被重排后旧 pos 就失效；按同一个节点对象在新 state.doc 中重新找位置。
    const locate = () => {
      const item = geometry.find(item => item.node === sourceNode);
      return item ? { index:item.index, pos:item.pos } : null;
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
    // “原块跟手”只负责视觉位移；真正顺序由 retarget 提交的文档事务决定。
    // grabOffset 保留初始抓取点，除 effectiveZoom 将屏幕位移转为 CSS 位移。
    const place = () => {
      if (!started || ed.isDestroyed) return;
      const item = geometry.find(item => item.node === sourceNode);
      if (!item) return;
      syncRule(item.index);
      translateY = (pointer.y - grabOffset - item.top) / dragScale;
      ed.view.dom.style.setProperty('--block-drag-y', `${translateY}px`);
      if (!finished) {
        const next = { left:editorRect.left + 30, top:item.top, width:editorRect.width - 60 };
        const current = dropLine.value;
        if (!current || current.left !== next.left || current.top !== next.top || current.width !== next.width) dropLine.value = next;
      }
    };

    const settle = items => {
      for (const item of items) for (const animation of item.dom.getAnimations()) animation.cancel();
    };

    // Capture the visible rects first, so a crossing mid-slide continues from
    // where the neighbours actually are instead of snapping to final layout.
    const snapshot = items => new Map(items.map(item => [item.node, item.dom.getBoundingClientRect()]));

    // FLIP：记录排序前矩形，用新矩形算偏移，再从偏移量动画到 0；不修改正文 JSON。
    const flip = (before, after, affected) => {
      if (reducedMotion()) return;
      const affectedNodes = new Set(affected.map(item => item.node));
      for (const item of after) {
        if (!affectedNodes.has(item.node)) continue;
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
      const target = dragTargetAt(geometry, pointer.y, sourceNode);
      if (target.index === info.index) return;
      const affected = affectedDragBlocks(geometry, sourceNode, target.index);
      const boundary = target.before?.pos ?? ed.state.doc.content.size;
      // 连续跨位尽量沿用历史组；暂停超过阈值会切组，因此长拖动不保证总是一步撤销。
      const closeGroup = Date.now() - lastMoveAt > 500;
      const tr = reorderBlock(ed.state, info.pos, boundary, { closeGroup, scrollIntoView: false });
      if (!tr) return;
      const before = snapshot(affected);
      settle(affected);
      moved = true;
      lastMoveAt = Date.now();
      ed.view.dispatch(tr);
      syncRule(target.index);
      geometry = measureGeometry();
      positionDragMenuAnchor();
      flip(before, geometry, affected);
    };

    // Put the block back in its original slot: insert before the block that now
    // occupies that index, or append when it was last.
    // 取消时也用事务恢复节点顺序，而不只是把 transform 清零；否则保存/打印仍会是新顺序。
    const restore = () => {
      if (ed.isDestroyed) return;
      const info = locate();
      if (!info) return;
      const others = [];
      ed.state.doc.forEach((node, pos) => { if (node !== sourceNode) others.push({ pos }); });
      const boundary = originalIndex < others.length ? others[originalIndex].pos : ed.state.doc.content.size;
      const tr = reorderBlock(ed.state, info.pos, boundary, { scrollIntoView: false });
      if (tr) {
        ed.view.dispatch(tr);
        syncRule(originalIndex);
        geometry = measureGeometry();
      }
      const restored = locate();
      if (restored) syncRule(restored.index);
      place();
    };

    // 每帧只用缓存命中与更新跟手位置；只有滚动、换序或缩放时重新测量布局。
    const loop = () => {
      if (!started || finished) return;
      let step = 0;
      if (pointer.y < edgeTop + SCROLL_EDGE) step = -SCROLL_STEP;
      else if (pointer.y > edgeBottom - SCROLL_EDGE) step = SCROLL_STEP;
      const previousScrollTop = scrollEl.scrollTop;
      if (step) scrollEl.scrollBy(0, step);
      if (scrollEl.scrollTop !== previousScrollTop) {
        geometry = measureGeometry();
        positionDragMenuAnchor();
      }
      if (dragMenu) trackDragHover(ed, dragMenu, pointer.y, geometry, sourceNode, source.rect);
      retarget();
      place();
      raf = win.requestAnimationFrame(loop);
    };

    const resize = () => {
      if (!started || finished) return;
      if (scrollEl === doc.scrollingElement) {
        edgeTop = 0;
        edgeBottom = win.innerHeight;
      } else {
        const rect = scrollEl.getBoundingClientRect();
        edgeTop = rect.top;
        edgeBottom = rect.bottom;
      }
      geometry = measureGeometry();
      positionDragMenuAnchor();
      retarget();
      place();
    };

    const removeListeners = () => {
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
      doc.removeEventListener('keydown', key, true);
      win.removeEventListener('blur', blur);
      win.removeEventListener('resize', resize);
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
      activeDrag = true;
      styleEl = doc.createElement('style');
      styleEl.setAttribute('data-block-drag-style', dragToken);
      doc.head.appendChild(styleEl);
      ed.view.dom.setAttribute('data-block-drag', dragToken);
      ed.view.dom.style.setProperty('--block-drag-y', '0px');
      doc.documentElement.classList.add('sorting');
      scrollEl = scrollAncestor();
      if (scrollEl === doc.scrollingElement) {
        edgeTop = 0;
        edgeBottom = win.innerHeight;
      } else {
        const rect = scrollEl.getBoundingClientRect();
        edgeTop = rect.top;
        edgeBottom = rect.bottom;
      }
      syncRule(originalIndex);
      geometry = measureGeometry();
      positionDragMenuAnchor();
      retarget();
      place();
      raf = win.requestAnimationFrame(loop);
    };

    // mouseup 并不必然提交：还需判断落点、是否仍可编辑；Esc/失焦走恢复路径。
    const finish = (commit, event) => {
      if (finished) return;
      finished = true;
      activeDrag = false;
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
    win.addEventListener('resize', resize);
  }

  function handleClick(event) {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }

  onBeforeUnmount(() => {
    // Vue 组件卸载也要结束拖动并清理，避免全局 mousemove 和临时 CSS 遗留。
    stopDrag();
    hoverDwell.reset();
    if (hoverMenu) hoverMenu.style.transform = '';
  });

  return { dropLine, startDrag, handleClick, handleHover, handleLeave };
}
