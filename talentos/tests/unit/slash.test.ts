/**
 * The slash menu and the to-do block.
 *
 * Most of these are about the menu NOT opening: a trigger that fires inside a
 * URL or halfway through a sentence is one people learn to fight.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_QUERY,
  SLASH_COMMANDS,
  activeSlash,
  applySlash,
  asTodo,
  blockText,
  matchCommands,
  readTodo,
  writeTodo,
} from "../../artifact-src/core/slash";

describe("when the menu opens", () => {
  it("opens on a slash that starts a word", () => {
    expect(activeSlash("/", 1)).toEqual({ from: 0, to: 1, query: "" });
    expect(activeSlash("call the manager /ta", 20)?.query).toBe("ta");
  });

  it("stays shut inside a web address or a word", () => {
    // The two places a slash is punctuation rather than a request.
    expect(activeSlash("https://example.com", 19)).toBeNull();
    expect(activeSlash("and/or", 6)).toBeNull();
    expect(activeSlash("24/7", 4)).toBeNull();
  });

  it("gives up once a space or a sentence has gone by", () => {
    expect(activeSlash("/task and then", 14)).toBeNull();
    expect(
      activeSlash(`/${"a".repeat(MAX_QUERY + 1)}`, MAX_QUERY + 2),
    ).toBeNull();
  });

  it("reads the slash the caret is actually behind", () => {
    const text = "/one and /two";
    expect(activeSlash(text, text.length)?.query).toBe("two");
    expect(activeSlash(text, 4)?.query).toBe("one");
  });
});

describe("what the menu offers", () => {
  it("puts the to-do first, because it is the one that goes somewhere", () => {
    expect(matchCommands("")[0].id).toBe("task");
    expect(SLASH_COMMANDS[0].id).toBe("task");
  });

  it("prefers what a query starts with over what it merely contains", () => {
    expect(matchCommands("p").map((c) => c.id)).toEqual(["page", "person"]);
    expect(matchCommands("as")[0].id).toBe("ask");
    expect(matchCommands("to")[0].id).toBe("task");
    expect(matchCommands("zzz")).toEqual([]);
  });

  it("is short enough to read mid-sentence", () => {
    // A slash menu listing everything the software can do is a second
    // navigation, and you are in the middle of a sentence.
    expect(SLASH_COMMANDS.length).toBeLessThanOrEqual(7);
    expect(SLASH_COMMANDS.every((c) => c.icon && c.hint)).toBe(true);
  });

  it("replaces the whole trigger with what the command types", () => {
    const text = "met /pe";
    const trigger = activeSlash(text, text.length)!;
    expect(applySlash(text, trigger, "@")).toEqual({ text: "met @", caret: 5 });
  });
});

describe("a block that is a to-do", () => {
  it("is read as its box, its words and the row it points at", () => {
    const todo = readTodo("[ ] Call the manager ^abc123def");
    expect(todo).toEqual({
      done: false,
      taskId: "abc123def",
      text: "Call the manager",
    });
    expect(readTodo("[x] done thing ^abc123def")?.done).toBe(true);
    expect(readTodo("[X] shouty box")?.done).toBe(true);
    expect(readTodo("an ordinary line")).toBeNull();
  });

  it("round-trips, anchor and all", () => {
    const line = "[x] Chase the CV ^task-9f8e7d";
    expect(writeTodo(readTodo(line)!)).toBe(line);
  });

  it("keeps the words when a line becomes a to-do", () => {
    expect(asTodo("Call the manager", "abc123")).toBe(
      "[ ] Call the manager ^abc123",
    );
    // Doing it twice does not stack boxes, and does not lose the tick.
    expect(asTodo("[x] Call ^abc123", null)).toBe("[x] Call ^abc123");
  });

  it("never shows the anchor to anybody", () => {
    // It is a pointer. On screen it is somebody's punctuation gone wrong.
    expect(blockText("[ ] Call the manager ^abc123def")).toBe(
      "Call the manager",
    );
    expect(blockText("A plain note ^abc123def")).toBe("A plain note");
    expect(blockText("A plain note")).toBe("A plain note");
    // A caret in ordinary prose is not an anchor.
    expect(blockText("2 ^ 8 = 256")).toBe("2 ^ 8 = 256");
  });
});
