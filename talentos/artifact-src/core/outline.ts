/**
 * Notes as an outline, in the manner of Roam's.
 *
 * A note is one text field and always has been. This reads that text as a tree
 * of blocks and writes it back, so an outline needs no table, no migration and
 * no import — a note written before any of this existed opens as a flat
 * outline, which is what it is.
 *
 * **Indentation is the structure.** Two spaces to a level, an optional `-` in
 * front, and a line indented further than the one above it is its child. There
 * is no depth limit: a block can hold blocks holding blocks for as long as
 * somebody keeps pressing Tab.
 *
 * **A block's id is its path** — `0.2.1` is the second child of the third child
 * of the first root. Chosen over a content hash, which changes the moment you
 * edit the block it names, and over an `^anchor` written into the text, which
 * makes every note carry machinery for a feature most notes never use. The
 * cost of a path is that inserting a block above one moves it, so a zoom link
 * would land on the wrong block; `reanchor` handles that by carrying the
 * block's first words along with the path and looking for them when the path
 * no longer matches.
 *
 * One thing this deliberately does not preserve: runs of blank lines. Writing
 * the tree back normalises the spacing of a note the first time it is edited
 * as an outline. That is a real cost and the alternative is worse — empty
 * blocks that exist only to hold a gap, which you then have to delete twice.
 *
 * Nothing here imports anything, so the outline runs in the artifact.
 */

export interface OutlineBlock {
  /** Path from the roots, dot-separated. Stable while nothing above it moves. */
  id: string;
  text: string;
  depth: number;
  children: OutlineBlock[];
}

/** Two spaces to a level. A tab counts as one level, not as its width. */
export const INDENT = "  ";

const LINE = /^([ \t]*)([-*•]\s?)?(.*)$/;

function depthOf(indent: string): number {
  let width = 0;
  for (const character of indent) width += character === "\t" ? 2 : 1;
  return Math.floor(width / INDENT.length);
}

/**
 * Read the text as a tree.
 *
 * A line indented more than one level below its parent is pulled up to
 * parent + 1, because a block cannot be a grandchild of the line above it and
 * pretending otherwise silently loses the line when it is written back.
 */
export function parseOutline(text: string): OutlineBlock[] {
  const roots: OutlineBlock[] = [];
  const stack: OutlineBlock[] = [];

  for (const raw of text.split("\n")) {
    const match = LINE.exec(raw);
    if (!match) continue;
    // NOT trimmed. The text goes back into the editor on every keystroke, so
    // trimming here means a trailing space can never be typed — which quietly
    // breaks every trigger that needs a word boundary in front of it, `@` and
    // `[[` included, and looks like the trigger being broken rather than the
    // parser.
    const body = match[3];
    // A bullet with nothing after it IS a block — the empty one you have just
    // made and are about to type into. Only a line with no bullet and no words
    // is a blank line, and those are spacing rather than structure.
    if (!body.trim() && !match[2]) continue;

    const wanted = depthOf(match[1]);
    const depth = Math.min(wanted, stack.length);
    stack.length = depth;

    const parent = stack[depth - 1];
    const index = parent ? parent.children.length : roots.length;
    const block: OutlineBlock = {
      id: parent ? `${parent.id}.${index}` : String(index),
      text: body,
      depth,
      children: [],
    };
    if (parent) parent.children.push(block);
    else roots.push(block);
    stack.push(block);
  }

  return roots;
}

/** The tree as text. Idempotent: parsing this and rendering it again is the same. */
export function renderOutline(blocks: OutlineBlock[]): string {
  const lines: string[] = [];
  const walk = (list: OutlineBlock[], depth: number) => {
    for (const block of list) {
      lines.push(`${INDENT.repeat(depth)}- ${block.text}`);
      walk(block.children, depth + 1);
    }
  };
  walk(blocks, 0);
  return lines.join("\n");
}

/** Re-index every id after the tree has been changed. */
export function reindex(blocks: OutlineBlock[]): OutlineBlock[] {
  const walk = (
    list: OutlineBlock[],
    prefix: string,
    depth: number,
  ): OutlineBlock[] =>
    list.map((block, index) => {
      const id = prefix ? `${prefix}.${index}` : String(index);
      return {
        ...block,
        id,
        depth,
        children: walk(block.children, id, depth + 1),
      };
    });
  return walk(blocks, "", 0);
}

export function findBlock(
  blocks: OutlineBlock[],
  id: string,
): OutlineBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const found = findBlock(block.children, id);
    if (found) return found;
  }
  return null;
}

/** The chain from a root down to this block, for a breadcrumb. */
export function trailTo(blocks: OutlineBlock[], id: string): OutlineBlock[] {
  for (const block of blocks) {
    if (block.id === id) return [block];
    const below = trailTo(block.children, id);
    if (below.length > 0) return [block, ...below];
  }
  return [];
}

/** Every block, depth first, which is reading order. */
export function flatten(blocks: OutlineBlock[]): OutlineBlock[] {
  return blocks.flatMap((block) => [block, ...flatten(block.children)]);
}

/**
 * The first words of a block, for carrying alongside a path.
 *
 * Enough to recognise it and short enough to sit in a URL. Normalised, so a
 * block whose spacing changed is still the same block.
 */
export function fingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, " ").trim().slice(0, 48);
}

/**
 * Find the block a zoom link meant, after the note has been edited.
 *
 * The path first, because it is right almost always and costs nothing. Then
 * the fingerprint, because inserting a line above a block moves its path but
 * not its words. Null when neither finds anything — at which point the page
 * zooms out and says the block is gone, rather than silently showing a
 * different one, which is the failure worth designing against.
 */
export function reanchor(
  blocks: OutlineBlock[],
  id: string,
  mark?: string,
): string | null {
  const byPath = findBlock(blocks, id);
  if (byPath && (!mark || fingerprint(byPath.text) === mark)) return byPath.id;
  if (!mark) return byPath ? byPath.id : null;
  const byText = flatten(blocks).find(
    (block) => fingerprint(block.text) === mark,
  );
  return byText ? byText.id : null;
}

// ---------------------------------------------------------------------------
// editing

interface Located {
  siblings: OutlineBlock[];
  index: number;
  parentId: string | null;
}

function locate(
  blocks: OutlineBlock[],
  id: string,
  parentId: string | null = null,
): Located | null {
  const index = blocks.findIndex((block) => block.id === id);
  if (index !== -1) return { siblings: blocks, index, parentId };
  for (const block of blocks) {
    const found = locate(block.children, id, block.id);
    if (found) return found;
  }
  return null;
}

/** A deep copy, so every edit returns a new tree and nothing mutates in place. */
function clone(blocks: OutlineBlock[]): OutlineBlock[] {
  return blocks.map((block) => ({ ...block, children: clone(block.children) }));
}

/**
 * Put blocks underneath one, in order.
 *
 * Used by anything that answers a block rather than replacing it — the model's
 * answer goes under the question, where it is obviously a reply and obviously
 * not something you wrote.
 */
export function addChildren(
  blocks: OutlineBlock[],
  id: string,
  lines: string[],
): OutlineBlock[] {
  const next = clone(blocks);
  const parent = findBlock(next, id);
  if (!parent) return blocks;
  parent.children.push(
    ...lines.map((text) => ({
      id: "",
      text,
      depth: parent.depth + 1,
      children: [],
    })),
  );
  return reindex(next);
}

export function setText(
  blocks: OutlineBlock[],
  id: string,
  text: string,
): OutlineBlock[] {
  const next = clone(blocks);
  const found = findBlock(next, id);
  if (found) found.text = text;
  return next;
}

export interface Edit {
  blocks: OutlineBlock[];
  /** Where the caret should go afterwards. Null when nothing moved. */
  focus: string | null;
}

/**
 * A new block after this one.
 *
 * As a child when the block has children, because that is where the eye
 * expects the next line to land — pressing Enter on a parent and having the
 * new line appear below its whole subtree reads as a jump.
 */
export function insertAfter(blocks: OutlineBlock[], id: string): Edit {
  const next = clone(blocks);
  const found = findBlock(next, id);
  if (!found) return { blocks, focus: null };

  const fresh: OutlineBlock = { id: "", text: "", depth: 0, children: [] };
  if (found.children.length > 0) {
    found.children.unshift(fresh);
  } else {
    const where = locate(next, id);
    if (!where) return { blocks, focus: null };
    where.siblings.splice(where.index + 1, 0, fresh);
  }
  const reindexed = reindex(next);
  // The new block is wherever re-indexing put it: the only empty one, and the
  // first empty one in reading order if the note already had others.
  const empty = flatten(reindexed).find((block) => block.text === "");
  return { blocks: reindexed, focus: empty ? empty.id : null };
}

/** One level in: becomes the last child of the sibling above it. */
export function indentBlock(blocks: OutlineBlock[], id: string): Edit {
  const next = clone(blocks);
  const where = locate(next, id);
  // Nothing above it at this level means nothing to become a child of. The
  // first line of a note cannot be indented, and that is correct rather than
  // a limitation.
  if (!where || where.index === 0) return { blocks, focus: id };
  const [moved] = where.siblings.splice(where.index, 1);
  where.siblings[where.index - 1].children.push(moved);
  const reindexed = reindex(next);
  const landed = flatten(reindexed).find(
    (block) => block.text === moved.text && block.depth === moved.depth + 1,
  );
  return { blocks: reindexed, focus: landed ? landed.id : null };
}

/** One level out: becomes the next sibling of its parent. */
export function outdentBlock(blocks: OutlineBlock[], id: string): Edit {
  const next = clone(blocks);
  const where = locate(next, id);
  if (!where || where.parentId === null) return { blocks, focus: id };
  const parentWhere = locate(next, where.parentId);
  if (!parentWhere) return { blocks, focus: id };

  const [moved] = where.siblings.splice(where.index, 1);
  // Everything that was below it under the same parent comes with it, because
  // those blocks were its younger siblings and are now its children — which is
  // what every outliner does and what anybody pressing Shift-Tab expects.
  const following = where.siblings.splice(where.index);
  moved.children.push(...following);
  parentWhere.siblings.splice(parentWhere.index + 1, 0, moved);

  const reindexed = reindex(next);
  const landed = flatten(reindexed).find((block) => block.text === moved.text);
  return { blocks: reindexed, focus: landed ? landed.id : null };
}

/**
 * Remove a block, keeping its children.
 *
 * They are pulled up into its place rather than deleted with it: backspacing
 * an empty parent should not silently take a subtree with it, and an outliner
 * that loses work on one keystroke is one nobody trusts.
 */
export function removeBlock(blocks: OutlineBlock[], id: string): Edit {
  const next = clone(blocks);
  const where = locate(next, id);
  if (!where) return { blocks, focus: null };
  const [gone] = where.siblings.splice(where.index, 1);
  where.siblings.splice(where.index, 0, ...gone.children);

  const reindexed = reindex(next);
  const order = flatten(reindexed);
  // Focus the block before where this one was, which is where a caret goes
  // when a line disappears from under it.
  const before = order.filter(
    (block) => block.id < id || block.id.startsWith(`${id}.`),
  );
  const previous = order[Math.max(0, order.findIndex((b) => b.id === id) - 1)];
  return {
    blocks: reindexed,
    focus: previous ? previous.id : (before.at(-1)?.id ?? null),
  };
}
