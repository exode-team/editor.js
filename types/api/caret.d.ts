import { BlockAPI } from "./block";

/**
 * Caret position by block, input and character offsets (fork: exode-team/editor.js).
 * A text character counts 1, a void element like <br> counts 1.
 */
export interface CaretPosition {
  blockId: string;
  inputIndex: number;
  start: number;
  end?: number;
}

/**
 * Describes Editor`s caret API
 */
export interface Caret {
  /**
   * Returns the caret position or null when the caret is outside of the Editor's inputs
   */
  getPosition(): CaretPosition | null;

  /**
   * Sets the caret by a position got from getPosition()
   *
   * @return {boolean}
   */
  setPosition(position: CaretPosition): boolean;


  /**
   * Sets caret to the first Block
   *
   * @param {string} position - position where to set caret
   * @param {number} offset - caret offset
   *
   * @return {boolean}
   */
  setToFirstBlock(position?: 'end'|'start'|'default', offset?: number): boolean;

  /**
   * Sets caret to the last Block
   *
   * @param {string} position - position where to set caret
   * @param {number} offset - caret offset
   *
   * @return {boolean}
   */
  setToLastBlock(position?: 'end'|'start'|'default', offset?: number): boolean;

  /**
   * Sets caret to the previous Block
   *
   * @param {string} position - position where to set caret
   * @param {number} offset - caret offset
   *
   * @return {boolean}
   */
  setToPreviousBlock(position?: 'end'|'start'|'default', offset?: number): boolean;

  /**
   * Sets caret to the next Block
   *
   * @param {string} position - position where to set caret
   * @param {number} offset - caret offset
   *
   * @return {boolean}
   */
  setToNextBlock(position?: 'end'|'start'|'default', offset?: number): boolean;

  /**
   * Sets caret to the Block by passed index
   *
   * @param blockOrIdOrIndex - BlockAPI or Block id or Block index
   * @param position - position where to set caret
   * @param offset - caret offset
   *
   * @return {boolean}
   */
  setToBlock(blockOrIdOrIndex: BlockAPI | BlockAPI['id'] | number, position?: 'end'|'start'|'default', offset?: number): boolean;

  /**
   * Sets caret to the Editor
   *
   * @param {boolean} atEnd - if true, set Caret to the end of the Editor
   *
   * @return {boolean}
   */
  focus(atEnd?: boolean): boolean;
}
