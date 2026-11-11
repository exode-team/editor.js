/**
 * Character offsets inside an editable element (fork: exode-team/editor.js).
 * A text character counts 1, a void element like <br> counts 1, anything else 0.
 */

/**
 * Elements without children that take one position
 */
const VOID_TAGS = new Set(['BR', 'IMG', 'HR', 'WBR']);

/**
 * Passes every position-taking leaf of the subtree in document order
 *
 * @param root - subtree root
 * @param visit - leaf callback, return true to stop
 */
function walkLeaves(root: Node, visit: (leaf: Node, length: number) => boolean): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);

  while (walker.nextNode()) {
    const node = walker.currentNode;

    if (node.nodeType === Node.TEXT_NODE) {
      if (visit(node, (node as Text).data.length)) {
        return;
      }
    } else if (VOID_TAGS.has((node as Element).tagName) && visit(node, 1)) {
      return;
    }
  }
}

/**
 * Returns the number of positions of a subtree
 *
 * @param root - subtree root
 */
function lengthOf(root: Node): number {
  let length = 0;

  walkLeaves(root, (_leaf, leafLength) => {
    length += leafLength;

    return false;
  });

  return length;
}

/**
 * Converts a DOM point to an offset from the start of the element
 *
 * @param root - editable element
 * @param node - point node
 * @param offset - point offset
 */
export function offsetFromPoint(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();

  range.setStart(root, 0);
  range.setEnd(node, offset);

  return lengthOf(range.cloneContents());
}

/**
 * Converts an offset from the start of the element to a DOM point
 *
 * @param root - editable element
 * @param target - offset
 */
export function pointFromOffset(root: HTMLElement, target: number): { node: Node; offset: number } {
  let remaining = target;
  let point: { node: Node; offset: number } | null = null;

  walkLeaves(root, (leaf, length) => {
    if (leaf.nodeType === Node.TEXT_NODE) {
      if (remaining <= length) {
        point = { node: leaf,
          offset: remaining };

        return true;
      }
    } else if (remaining === 0) {
      point = { node: leaf.parentNode,
        offset: Array.from(leaf.parentNode.childNodes).indexOf(leaf as ChildNode) };

      return true;
    }

    remaining -= length;

    return false;
  });

  return point ?? { node: root,
    offset: root.childNodes.length };
}

/**
 * Returns selection offsets of an element or null when the selection is outside of it
 *
 * @param root - editable element
 */
export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
    if (document.activeElement !== root) {
      return null;
    }

    return { start: root.selectionStart ?? 0,
      end: root.selectionEnd ?? 0 };
  }

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
    return null;
  }

  const range = selection.getRangeAt(0);

  return {
    start: offsetFromPoint(root, range.startContainer, range.startOffset),
    end: offsetFromPoint(root, range.endContainer, range.endOffset),
  };
}

/**
 * Sets the selection inside an element, offsets past the end are clamped
 *
 * @param root - editable element
 * @param start - selection start
 * @param end - selection end
 */
export function setSelectionOffsets(root: HTMLElement, start: number, end: number = start): void {
  root.focus({ preventScroll: true });

  if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
    root.setSelectionRange(start, end);

    return;
  }

  const selection = window.getSelection();
  const startPoint = pointFromOffset(root, start);
  const endPoint = pointFromOffset(root, end);

  selection?.setBaseAndExtent(startPoint.node, startPoint.offset, endPoint.node, endPoint.offset);
}
