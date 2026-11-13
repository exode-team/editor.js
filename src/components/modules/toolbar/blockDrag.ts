import type Block from '../../block';
import type { EditorModules } from '../../../types-internal/editor-modules';

/**
 * exode: dragging a Block by the Block Tunes toggler (⠿), sortable as in dnd-kit.
 *
 * A press without a move is a click: the settings open as before. A move of a few pixels starts the drag:
 * a copy of the Block follows the pointer, the Block itself stays as a faded placeholder, the other Blocks
 * slide apart to open the gap where it drops, the scroll container scrolls near its edges. The drop moves the
 * Block by BlockManager.move (so the 'block-moved' event and the collaborative order go as for the menu) and the
 * Block glides from the copy into its place. Pointer events: a mouse and a finger alike; Escape cancels.
 */
export default class BlockDrag {
  /**
   * CSS classes
   */
  public static readonly CSS = {
    dragging: 'ce-block--dragging',
    shifting: 'ce-block--drag-shifting',
    ghost: 'ce-block-drag-ghost',
    editorDragging: 'codex-editor--dragging-block',
  };

  /**
   * Pixels the pointer moves before a press becomes a drag
   */
  private static readonly threshold = 4;

  /**
   * Distance from the edge of the scroll container where it starts to scroll, and the top speed per frame
   */
  private static readonly scrollZone = 56;
  private static readonly scrollSpeed = 18;

  /**
   * The glide of the dropped Block into its place, ms
   */
  private static readonly dropDuration = 180;

  /**
   * Whether a Block is being dragged now: the toolbar does not follow the hovered Blocks meanwhile
   */
  public get active(): boolean {
    return this.dragging;
  }

  private dragging = false;

  private block: Block | null = null;

  private handle: HTMLElement | null = null;

  private pointerId: number | null = null;

  private startX = 0;

  private startY = 0;

  private lastY = 0;

  /**
   * Index the Block drops before (0..length), null — the drop keeps it in place
   */
  private targetIndex: number | null = null;

  /**
   * The copy that follows the pointer and where it started
   */
  private ghost: HTMLElement | null = null;

  private ghostTop = 0;

  /**
   * The height the Block takes in the flow: the other Blocks slide by it
   */
  private slotHeight = 0;

  private scrollFrame: number | null = null;

  /**
   * @param getEditor - Editor modules, read on use: the modules object is replaced after the toolbar is made
   * @param toolbar - the actions of the toolbar (a module gets the other modules, not itself)
   * @param toolbar.onClick - a press without a drag: opens the settings
   * @param toolbar.closeToolbox - closes the toolbox when a drag starts
   * @param toolbar.moveAndOpen - shows the toolbar at the dropped Block
   */
  constructor(
    private readonly getEditor: () => EditorModules,
    private readonly toolbar: {
      onClick: () => void;
      closeToolbox: () => void;
      moveAndOpen: (block: Block) => void;
    }
  ) {}

  /**
   * Editor modules
   */
  private get editor(): EditorModules {
    return this.getEditor();
  }

  /**
   * A press on the handle
   *
   * @param event - pointerdown
   * @param handle - the toggler
   * @param block - the Block of the toolbar
   */
  public press(event: PointerEvent, handle: HTMLElement, block: Block | undefined): void {
    if (event.button !== 0 || block === undefined || this.pointerId !== null) {
      return;
    }

    this.block = block;
    this.handle = handle;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.lastY = event.clientY;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /** A pointer gone already: the up event cleans up */
    }

    handle.addEventListener('pointermove', this.onMove);
    handle.addEventListener('pointerup', this.onUp);
    handle.addEventListener('pointercancel', this.onCancel);
    document.addEventListener('keydown', this.onKeyDown, true);
  }

  /**
   * Stops a drag without a drop (the editor is destroyed or set read-only)
   */
  public cancel(): void {
    this.finish(false);
  }

  private onMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    this.lastY = event.clientY;

    if (!this.dragging) {
      const distance = Math.hypot(event.clientX - this.startX, event.clientY - this.startY);

      if (distance < BlockDrag.threshold) {
        return;
      }

      this.begin();
    }

    event.preventDefault();
    this.moveGhost();
    this.updateTarget();
  };

  private onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    if (!this.dragging) {
      this.finish(false);
      this.toolbar.onClick();

      return;
    }

    this.finish(true);
  };

  private onCancel = (): void => {
    this.finish(false);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.dragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.finish(false);
  };

  /**
   * The press became a drag: the copy of the Block, the placeholder, the scroll loop
   */
  private begin(): void {
    const { BlockSettings, BlockManager, UI } = this.editor;
    const holder = this.block!.holder;
    const index = BlockManager.blocks.indexOf(this.block!);
    const next = BlockManager.blocks[index + 1];
    const rect = holder.getBoundingClientRect();

    this.dragging = true;

    if (BlockSettings.opened) {
      BlockSettings.close();
    }

    this.toolbar.closeToolbox();

    this.slotHeight = next !== undefined ? next.holder.offsetTop - holder.offsetTop : holder.offsetHeight;

    this.ghost = holder.cloneNode(true) as HTMLElement;
    this.ghost.classList.add(BlockDrag.CSS.ghost);
    this.ghost.removeAttribute('data-id');
    this.ghost.querySelectorAll('[contenteditable]').forEach((node) => node.setAttribute('contenteditable', 'false'));
    this.ghost.style.left = `${rect.left}px`;
    this.ghost.style.top = `${rect.top}px`;
    this.ghost.style.width = `${rect.width}px`;
    this.ghostTop = rect.top;
    UI.nodes.wrapper.appendChild(this.ghost);

    holder.classList.add(BlockDrag.CSS.dragging);
    UI.nodes.wrapper.classList.add(BlockDrag.CSS.editorDragging);

    BlockManager.blocks.forEach((block) => {
      if (block !== this.block) {
        block.holder.classList.add(BlockDrag.CSS.shifting);
      }
    });

    this.scrollFrame = window.requestAnimationFrame(this.autoScroll);
  }

  /**
   * The copy follows the pointer
   */
  private moveGhost(): void {
    if (this.ghost === null) {
      return;
    }

    this.ghost.style.transform = `translateY(${this.lastY - this.startY}px)`;
  }

  /**
   * The index the Block drops before, by the middles of the Blocks in their places before the drag
   * (offsetTop ignores the slides), and the slides that open the gap there
   */
  private updateTarget(): void {
    const { BlockManager, UI } = this.editor;
    const { blocks } = BlockManager;
    const fromIndex = blocks.indexOf(this.block!);
    const wrapperTop = UI.nodes.wrapper.getBoundingClientRect().top;

    let index = blocks.findIndex((block) => {
      const middle = wrapperTop + block.holder.offsetTop + block.holder.offsetHeight / 2;

      return this.lastY < middle;
    });

    if (index === -1) {
      index = blocks.length;
    }

    const keepsPlace = index === fromIndex || index === fromIndex + 1;

    this.targetIndex = keepsPlace ? null : index;

    blocks.forEach((block, blockIndex) => {
      if (block === this.block) {
        return;
      }

      let shift = 0;

      if (!keepsPlace && fromIndex < index && blockIndex > fromIndex && blockIndex < index) {
        shift = -this.slotHeight;
      } else if (!keepsPlace && index < fromIndex && blockIndex >= index && blockIndex < fromIndex) {
        shift = this.slotHeight;
      }

      block.holder.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;
    });
  }

  /**
   * Scrolls the scroll container of the editor while the pointer is near its edge
   */
  private autoScroll = (): void => {
    if (!this.dragging) {
      return;
    }

    const container = this.findScrollContainer();
    const viewport = {
      top: 0,
      bottom: window.innerHeight,
    };
    const rect = container === null ? viewport : container.getBoundingClientRect();

    const fromTop = this.lastY - rect.top;
    const fromBottom = rect.bottom - this.lastY;

    let delta = 0;

    if (fromTop < BlockDrag.scrollZone) {
      delta = -BlockDrag.scrollSpeed * (1 - Math.max(fromTop, 0) / BlockDrag.scrollZone);
    } else if (fromBottom < BlockDrag.scrollZone) {
      delta = BlockDrag.scrollSpeed * (1 - Math.max(fromBottom, 0) / BlockDrag.scrollZone);
    }

    if (delta !== 0) {
      if (container === null) {
        window.scrollBy(0, delta);
      } else {
        container.scrollTop += delta;
      }

      this.updateTarget();
    }

    this.scrollFrame = window.requestAnimationFrame(this.autoScroll);
  };

  /**
   * The nearest scrollable ancestor of the editor, null — the page itself
   */
  private findScrollContainer(): HTMLElement | null {
    let node = this.editor.UI.nodes.wrapper.parentElement;

    while (node !== null && node !== document.body && node !== document.documentElement) {
      const { overflowY } = window.getComputedStyle(node);

      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  /**
   * Ends the press: drops the Block when asked, removes the drag state; the Block glides from the copy
   * into its place (the new one on a drop, the old one on a cancel)
   *
   * @param drop - move the Block to the target
   */
  private finish(drop: boolean): void {
    const { BlockManager, UI } = this.editor;
    const block = this.block;
    const target = this.targetIndex;
    const wasDragging = this.dragging;
    const ghostTop = this.ghostTop + (this.lastY - this.startY);

    if (this.handle !== null) {
      this.handle.removeEventListener('pointermove', this.onMove);
      this.handle.removeEventListener('pointerup', this.onUp);
      this.handle.removeEventListener('pointercancel', this.onCancel);

      if (this.pointerId !== null && this.handle.hasPointerCapture?.(this.pointerId)) {
        this.handle.releasePointerCapture(this.pointerId);
      }
    }

    document.removeEventListener('keydown', this.onKeyDown, true);

    if (this.scrollFrame !== null) {
      window.cancelAnimationFrame(this.scrollFrame);
    }

    this.ghost?.remove();

    /** The slides are dropped at once: after the move the Blocks stand where they slid to */
    BlockManager.blocks.forEach(({ holder }) => {
      holder.classList.remove(BlockDrag.CSS.shifting);
      holder.style.transform = '';
    });

    block?.holder.classList.remove(BlockDrag.CSS.dragging);
    UI.nodes.wrapper.classList.remove(BlockDrag.CSS.editorDragging);

    this.dragging = false;
    this.block = null;
    this.handle = null;
    this.pointerId = null;
    this.targetIndex = null;
    this.ghost = null;
    this.scrollFrame = null;

    if (!wasDragging || block === null) {
      return;
    }

    const fromIndex = BlockManager.blocks.indexOf(block);

    if (drop && target !== null && fromIndex !== -1) {
      BlockManager.move(target > fromIndex ? target - 1 : target, fromIndex);
      this.toolbar.moveAndOpen(block);
    }

    this.glide(block.holder, ghostTop);
  }

  /**
   * FLIP: the Block starts where the copy was released and slides into its place
   *
   * @param holder - of the Block
   * @param fromTop - viewport top of the released copy
   */
  private glide(holder: HTMLElement, fromTop: number): void {
    const offset = fromTop - holder.getBoundingClientRect().top;

    if (Math.abs(offset) < 1) {
      return;
    }

    holder.style.transition = 'none';
    holder.style.transform = `translateY(${offset}px)`;

    window.requestAnimationFrame(() => {
      holder.style.transition = `transform ${BlockDrag.dropDuration}ms cubic-bezier(0.2, 0, 0, 1)`;
      holder.style.transform = '';

      window.setTimeout(() => {
        holder.style.transition = '';
      }, BlockDrag.dropDuration);
    });
  }
}
