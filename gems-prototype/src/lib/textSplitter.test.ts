import { describe, expect, test } from "vitest";
import { RecursiveCharacterTextSplitter } from "./textSplitter";

describe("RecursiveCharacterTextSplitter", () => {
  test("段落区切りで分割する", () => {
    const text = "Hello world.\n\nHow are you?\n\nFine thank you.";
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 20,
      chunkOverlap: 0,
    });
    const output = splitter.splitText(text);
    expect(output).toEqual(["Hello world.", "How are you?", "Fine thank you."]);
  });

  test("chunkSizeを超える場合は改行で分割する", () => {
    const text = "Hello world.\nHow are you?\nFine thank you.";
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 20,
      chunkOverlap: 0,
    });
    const output = splitter.splitText(text);
    expect(output.length).toBeGreaterThan(0);
    expect(output.every((chunk) => chunk.length <= 20)).toBe(true);
  });

  test("chunkOverlapが機能する", () => {
    const text = "aaa bbb ccc ddd eee";
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10,
      chunkOverlap: 4,
      separators: [" ", ""],
      keepSeparator: false,
    });
    const output = splitter.splitText(text);
    // keepSeparator:false でスペース区切りの場合、単語単位でオーバーラップする
    // chunkSize=10, overlap=4 → "aaa bbb"(7) → overlap "bbb"(3) → "bbb ccc" ...
    expect(output).toEqual(["aaa bbb", "bbb ccc", "ccc ddd", "ddd eee"]);
  });

  test("空文字列は空配列を返す", () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });
    const output = splitter.splitText("");
    expect(output).toEqual([]);
  });

  test("chunkSize以下のテキストはそのまま返す", () => {
    const text = "Hello world.";
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });
    const output = splitter.splitText(text);
    expect(output).toEqual(["Hello world."]);
  });

  test("chunkOverlap >= chunkSize でエラーをスローする", () => {
    expect(() => new RecursiveCharacterTextSplitter({ chunkSize: 10, chunkOverlap: 10 })).toThrow(
      "Cannot have chunkOverlap >= chunkSize",
    );
  });

  test("カスタムseparatorsを使用できる", () => {
    const text = "foo|bar|baz";
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 5,
      chunkOverlap: 0,
      separators: ["|"],
      keepSeparator: false,
    });
    const output = splitter.splitText(text);
    expect(output).toEqual(["foo", "bar", "baz"]);
  });

  test("カスタムlengthFunctionを使用できる", () => {
    // 各文字を2バイトとして数える
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 5,
      chunkOverlap: 0,
      separators: [" "],
      keepSeparator: false,
      lengthFunction: (text) => text.length * 2,
    });
    const text = "aa bb cc dd";
    const output = splitter.splitText(text);
    // 各単語は2文字→4バイト相当、chunkSize=5 なので1単語ずつになる
    expect(output).toEqual(["aa", "bb", "cc", "dd"]);
  });

  describe("日本語テキスト", () => {
    test("段落区切り（\\n\\n）で日本語テキストを分割する", () => {
      const text =
        "吾輩は猫である。名前はまだない。\n\nどこで生れたかとんと見当がつかぬ。\n\n何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。";
      const splitter = new RecursiveCharacterTextSplitter({
        // chunkSize=40 では最初の2段落（16+18=34文字）がchunkSize内に収まるため結合される
        // 3段落目（38文字）は単独チャンクになる（先頭の\n\nはtrimで除去）
        chunkSize: 40,
        chunkOverlap: 0,
      });
      const output = splitter.splitText(text);
      expect(output).toEqual([
        "吾輩は猫である。名前はまだない。\n\nどこで生れたかとんと見当がつかぬ。",
        "何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。",
      ]);
    });

    test("日本語文字はlength=1として扱われる", () => {
      // 「あいうえお」は5文字、chunkSize=3なら文字単位で分割される
      const text = "あいうえお";
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 3,
        chunkOverlap: 0,
        separators: [""],
      });
      const output = splitter.splitText(text);
      // 空セパレータで1文字ずつに分けてからマージ → 3文字・2文字の2チャンク
      expect(output).toEqual(["あいう", "えお"]);
    });

    test("句点（。）をセパレータにして分割できる", () => {
      const text = "猫が鳴いた。犬が走った。鳥が飛んだ。";
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 15,
        chunkOverlap: 0,
        separators: ["。", ""],
        // keepSeparator: true はlookahead分割のため「。」が次チャンクの先頭に付く
        keepSeparator: true,
      });
      const output = splitter.splitText(text);
      // "猫が鳴いた"(5) + "。犬が走った"(7) = 12 ≤ 15 で結合、
      // "。鳥が飛んだ"(7) + "。"(1) = 8 ≤ 15 で結合
      expect(output).toEqual(["猫が鳴いた。犬が走った", "。鳥が飛んだ。"]);
    });

    test("句点（。）をセパレータにして分割できる（keepSeparator: false）", () => {
      const text = "猫が鳴いた。犬が走った。鳥が飛んだ。";
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 8,
        chunkOverlap: 0,
        separators: ["。", ""],
        keepSeparator: false,
      });
      const output = splitter.splitText(text);
      // keepSeparator: false では句点が除去されてチャンクが作られる
      expect(output).toEqual(["猫が鳴いた", "犬が走った", "鳥が飛んだ"]);
    });

    test("日本語の長い段落はchunkSizeで切り詰められる", () => {
      const text =
        "日本語のテキストは単語の区切りがないため空白では分割できません。そのため文字単位での分割が必要になります。";
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 20,
        chunkOverlap: 0,
      });
      const output = splitter.splitText(text);
      expect(output.length).toBeGreaterThan(0);
      expect(output.every((chunk) => chunk.length <= 20)).toBe(true);
      // 元のテキストが復元できること（オーバーラップなし）
      expect(output.join("")).toBe(text);
    });

    test("日本語テキストでchunkOverlapにより前チャンクの一部が重なる", () => {
      const text = "一二三。\n\n四五六。\n\n七八九。";
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 12,
        chunkOverlap: 6,
      });
      const output = splitter.splitText(text);
      expect(output).toEqual(["一二三。\n\n四五六。", "四五六。\n\n七八九。"]);
    });
  });

  describe("fromLanguage", () => {
    test("markdownのセパレータで分割できる", () => {
      const text = "# Title\n\n## Section 1\n\nContent one.\n\n## Section 2\n\nContent two.";
      const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
        chunkSize: 30,
        chunkOverlap: 0,
      });
      expect(splitter.separators).toEqual(
        RecursiveCharacterTextSplitter.getSeparatorsForLanguage("markdown"),
      );
      const output = splitter.splitText(text);
      expect(output.length).toBeGreaterThan(1);
    });

    test("jsのセパレータで分割できる", () => {
      const text = "function foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}";
      const splitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
        chunkSize: 30,
        chunkOverlap: 0,
      });
      expect(splitter.separators).toEqual(
        RecursiveCharacterTextSplitter.getSeparatorsForLanguage("js"),
      );
      const output = splitter.splitText(text);
      expect(output.length).toBeGreaterThan(1);
    });

    test("未サポートの言語はエラーをスローする", () => {
      expect(() =>
        RecursiveCharacterTextSplitter.fromLanguage(
          // @ts-expect-error intentional invalid language
          "cobol",
        ),
      ).toThrow("Language cobol is not supported.");
    });
  });

  describe("getSeparatorsForLanguage", () => {
    test.each([
      ["cpp", "\nclass "],
      ["go", "\nfunc "],
      ["java", "\nclass "],
      ["js", "\nfunction "],
      ["php", "\nfunction "],
      ["proto", "\nmessage "],
      ["python", "\nclass "],
      ["rst", "\n===\n"],
      ["ruby", "\ndef "],
      ["rust", "\nfn "],
      ["scala", "\nclass "],
      ["swift", "\nfunc "],
      ["markdown", "\n## "],
      ["latex", "\n\\chapter{"],
      ["html", "<body>"],
      ["sol", "\npragma "],
    ] as const)("%s のセパレータが期待どおり返る", (lang, expectedAnchor) => {
      const seps = RecursiveCharacterTextSplitter.getSeparatorsForLanguage(lang);
      expect(Array.isArray(seps)).toBe(true);
      expect(seps.length).toBeGreaterThan(0);
      expect(seps).toContain(expectedAnchor);
      expect(seps.at(-1)).toBe("");
    });
  });
});
