import { useCallback, useLayoutEffect, useRef } from "react";

const DEFAULT_DURATION = 280;
const DEFAULT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Subtle FLIP animation for list reordering.
 *
 * Measures every registered item's layout box after each commit; when the order
 * key changed *and* the reorder was marked for animation, each item is
 * translated back to where it used to be and eased to its new position. Items
 * that did not move are skipped, so the effect is limited to the cards that
 * actually shifted.
 *
 * `orderKey` is any string that changes when the order changes (e.g. the ids
 * joined). `animateRef` is a ref set to true by the reorder that should be
 * animated; it self-clears on the next commit so unrelated order changes
 * (deletes, drag-and-drop) stay unanimated.
 *
 * Returns a ref callback to spread onto each item element.
 */
export function useFlipReorder(
  orderKey,
  animateRef,
  { duration = DEFAULT_DURATION, easing = DEFAULT_EASING } = {},
) {
  const nodesRef = useRef(new Map());
  const prevOrderRef = useRef("");
  const prevPosRef = useRef(new Map());
  const runningRef = useRef(new Set());

  const registerItem = useCallback((id, element) => {
    if (element) nodesRef.current.set(id, element);
    else nodesRef.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const nodes = nodesRef.current;
    const orderChanged = Boolean(prevOrderRef.current) && prevOrderRef.current !== orderKey;
    const shouldAnimate = orderChanged && Boolean(animateRef && animateRef.current);

    if (animateRef) animateRef.current = false;

    // A reorder landed while an animation was still running. Leave the stored
    // baseline untouched so we never read a transformed box as a resting one;
    // the pending reorder is picked up on the next commit.
    if (runningRef.current.size > 0) return;

    const nextPos = new Map();
    nodes.forEach((element, id) => {
      nextPos.set(id, { top: element.offsetTop, left: element.offsetLeft });
    });

    const prevPos = prevPosRef.current;
    prevPosRef.current = nextPos;
    prevOrderRef.current = orderKey;

    if (!shouldAnimate) return;
    if (typeof window === "undefined") return;
    if (typeof Element.prototype.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    nextPos.forEach((last, id) => {
      const first = prevPos.get(id);
      const element = nodes.get(id);
      if (!first || !element) return;

      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const anim = element.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        { duration, easing },
      );
      runningRef.current.add(anim);
      const forget = () => runningRef.current.delete(anim);
      anim.finished.then(forget, forget);
    });
  });

  return registerItem;
}
