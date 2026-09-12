/**
 * Notes as an outline.
 *
 * The parse and the render are a round trip, the edits are the four keystrokes
 * an outliner is, and `reanchor` is the one that earns the design: a zoom link
 * has to survive somebody typing a line above the block it points at.
 */
import { describe, expect, it } from "vitest";
import {
  addChildren,
  fingerprint,
  findBlock,
  flatten,
  indentBlock,
  insertAfter,
  outdentBlock,
  parseOutline,
  reanchor,
  removeBlock,
  renderOutline,
  setText,
  trailTo,
} from "../../artifact-src/core/outline";

const NOTE = `- roots
  - first child
    - grandchild
  - second child
- another root`;

describe("reading a note as a tree", () => {
  it("nests by indentation, to any depth", () => {
    const tree = parseOutline(NOTE);
    expect(tree).toHaveLength(2);
    expect(tree[0].text).toBe("roots");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].children[0].text).toBe("grandchild");
    expect(tree[0].children[0].children[0].depth).toBe(2);
    expect(flatten(tree)).toHaveLength(5);
  });

  it("keeps going past any depth somebody cares to type", () => {
    const deep = Array.from(
      { length: 12 },
      (_, i) => `${"  ".repeat(i)}- level ${i}`,
    ).join("\n");
    const tree = parseOutline(deep);
    expect(flatten(tree)).toHaveLength(12);
    expect(flatten(tree).at(-1)?.depth).toBe(11);
  });

  it("reads a note nobody wrote as an outline as a flat one", () => {
    // Which is what it is. No migration, no import, nothing lost.
    const plain = parseOutline(
      "Call the manager\nChase the CV\n\nBook the room",
    );
    expect(plain).toHaveLength(3);
    expect(plain.every((block) => block.depth === 0)).toBe(true);
  });

  it("pulls an over-indented line up rather than losing it", () => {
    const tree = parseOutline("- one\n      - way over there");
    expect(flatten(tree)).toHaveLength(2);
    expect(tree[0].children[0].text).toBe("way over there");
  });

  it("keeps an empty block, which is the one you are about to type into", () => {
    // The parser dropping these meant every new line vanished the moment it
    // was saved: the render wrote "- " and the next parse threw it away.
    const tree = parseOutline("- one\n- \n- three");
    expect(tree.map((b) => b.text)).toEqual(["one", "", "three"]);
    expect(parseOutline(renderOutline(tree))).toHaveLength(3);
    // A line with no bullet and no words is spacing, not a block.
    expect(parseOutline("one\n\n\ntwo")).toHaveLength(2);
  });

  it("keeps a trailing space, because it is being typed into", () => {
    // The text goes back into the editor on every keystroke. Trimming it makes
    // "met " become "met", so the next character lands as "met@" and every
    // trigger that needs a word boundary silently stops working.
    const tree = parseOutline("- met ");
    expect(tree[0].text).toBe("met ");
    expect(renderOutline(tree)).toBe("- met ");
    expect(parseOutline(renderOutline(tree))[0].text).toBe("met ");
  });

  it("writes back the same tree it read", () => {
    const once = renderOutline(parseOutline(NOTE));
    expect(renderOutline(parseOutline(once))).toBe(once);
    expect(once).toBe(NOTE);
  });

  it("gives every block a path, and can walk back up it", () => {
    const tree = parseOutline(NOTE);
    expect(findBlock(tree, "0.0.0")?.text).toBe("grandchild");
    expect(trailTo(tree, "0.0.0").map((b) => b.text)).toEqual([
      "roots",
      "first child",
      "grandchild",
    ]);
    expect(trailTo(tree, "nope")).toEqual([]);
  });
});

describe("a zoom link after the note has been edited", () => {
  it("follows the path when the path is still right", () => {
    const tree = parseOutline(NOTE);
    expect(reanchor(tree, "0.0.0", fingerprint("grandchild"))).toBe("0.0.0");
  });

  it("finds the block by its words when a line was typed above it", () => {
    // The whole reason a path alone is not enough.
    const edited = parseOutline(`- typed above\n${NOTE}`);
    expect(reanchor(edited, "0.0.0", fingerprint("grandchild"))).toBe("1.0.0");
  });

  it("gives up rather than showing a different block", () => {
    const gone = parseOutline("- something else entirely");
    expect(reanchor(gone, "0.0.0", fingerprint("grandchild"))).toBeNull();
  });

  it("does not care about spacing or case", () => {
    expect(fingerprint("  Grand   Child ")).toBe(fingerprint("grand child"));
  });
});

describe("the four keystrokes", () => {
  it("puts a new block after this one", () => {
    const tree = parseOutline("- one\n- two");
    const after = insertAfter(tree, "0");
    expect(after.blocks.map((b) => b.text)).toEqual(["one", "", "two"]);
    expect(after.focus).toBe("1");
  });

  it("puts it inside when the block has children, where the eye expects it", () => {
    const tree = parseOutline(NOTE);
    const after = insertAfter(tree, "0");
    expect(after.blocks[0].children[0].text).toBe("");
    expect(after.focus).toBe("0.0");
  });

  it("indents under the sibling above, and refuses at the top", () => {
    const tree = parseOutline("- one\n- two");
    const indented = indentBlock(tree, "1");
    expect(indented.blocks).toHaveLength(1);
    expect(indented.blocks[0].children[0].text).toBe("two");
    expect(indented.focus).toBe("0.0");
    // The first line of a note has nothing to become a child of.
    expect(indentBlock(tree, "0").blocks).toEqual(tree);
  });

  it("outdents, bringing what was below it along", () => {
    const tree = parseOutline("- parent\n  - a\n  - b\n  - c");
    const out = outdentBlock(tree, "0.0");
    // `a` becomes the parent's sibling, and b and c become a's children,
    // because they were its younger siblings.
    expect(out.blocks.map((b) => b.text)).toEqual(["parent", "a"]);
    expect(out.blocks[1].children.map((b) => b.text)).toEqual(["b", "c"]);
  });

  it("refuses to outdent a root, which has nowhere to go", () => {
    const tree = parseOutline("- one");
    expect(outdentBlock(tree, "0").blocks).toEqual(tree);
  });

  it("keeps the children of a block it removes", () => {
    // Backspacing an empty parent must not silently take a subtree with it.
    const tree = parseOutline("- parent\n  - kept\n  - also kept");
    const gone = removeBlock(tree, "0");
    expect(gone.blocks.map((b) => b.text)).toEqual(["kept", "also kept"]);
  });

  it("puts an answer under the block that asked", () => {
    const tree = parseOutline("- what should I ask the manager?");
    const answered = addChildren(tree, "0", [
      "🤔 Three things.",
      "— asked a model",
    ]);
    expect(answered[0].children.map((b) => b.text)).toEqual([
      "🤔 Three things.",
      "— asked a model",
    ]);
    expect(answered[0].children[0].depth).toBe(1);
    expect(answered[0].children[0].id).toBe("0.0");
    // A block that is not there is not an error, and nothing is invented.
    expect(addChildren(tree, "nope", ["x"])).toEqual(tree);
  });

  it("changes one block's words and nothing else", () => {
    const tree = parseOutline(NOTE);
    const edited = setText(tree, "0.1", "changed");
    expect(findBlock(edited, "0.1")?.text).toBe("changed");
    expect(renderOutline(edited)).toContain("- changed");
    // The original is untouched: every edit returns a new tree.
    expect(findBlock(tree, "0.1")?.text).toBe("second child");
  });
});
