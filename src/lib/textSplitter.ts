export interface TextSplitterParams {
  chunkSize: number;
  chunkOverlap: number;
  keepSeparator: boolean;
  lengthFunction?: (text: string) => number;
}

abstract class TextSplitter implements TextSplitterParams {
  chunkSize = 1000;
  chunkOverlap = 200;
  keepSeparator = false;
  lengthFunction: (text: string) => number;

  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize;
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap;
    this.keepSeparator = fields?.keepSeparator ?? this.keepSeparator;
    this.lengthFunction = fields?.lengthFunction ?? ((text: string) => text.length);
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error("Cannot have chunkOverlap >= chunkSize");
    }
  }

  abstract splitText(text: string): string[];

  protected splitOnSeparator(text: string, separator: string): string[] {
    let splits: string[];
    if (separator) {
      if (this.keepSeparator) {
        const regexEscapedSeparator = separator.replace(
          /[/\-\\^$*+?.()|[\]{}]/g,
          "\\$&"
        );
        splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`));
      } else {
        splits = text.split(separator);
      }
    } else {
      splits = text.split("");
    }
    return splits.filter((s) => s !== "");
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;
    for (const d of splits) {
      const _len = this.lengthFunction(d);
      if (total + _len + currentDoc.length * separator.length > this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(
            `Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`
          );
        }
        if (currentDoc.length > 0) {
          const doc = this._joinDocs(currentDoc, separator);
          if (doc !== null) {
            docs.push(doc);
          }
          while (
            total > this.chunkOverlap ||
            (total + _len + currentDoc.length * separator.length > this.chunkSize &&
              total > 0)
          ) {
            total -= this.lengthFunction(currentDoc[0]);
            currentDoc.shift();
          }
        }
      }
      currentDoc.push(d);
      total += _len;
    }
    const doc = this._joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
    return docs;
  }

  private _joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }
}

export interface RecursiveCharacterTextSplitterParams extends TextSplitterParams {
  separators: string[];
}

export const SupportedTextSplitterLanguages = [
  "cpp",
  "go",
  "java",
  "js",
  "php",
  "proto",
  "python",
  "rst",
  "ruby",
  "rust",
  "scala",
  "swift",
  "markdown",
  "latex",
  "html",
  "sol",
] as const;

export type SupportedTextSplitterLanguage =
  (typeof SupportedTextSplitterLanguages)[number];

export class RecursiveCharacterTextSplitter
  extends TextSplitter
  implements RecursiveCharacterTextSplitterParams
{
  separators: string[] = ["\n\n", "\n", " ", ""];

  constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
    super(fields);
    this.separators = fields?.separators ?? this.separators;
    this.keepSeparator = fields?.keepSeparator ?? true;
  }

  private _splitText(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    let separator: string = separators[separators.length - 1];
    let newSeparators: string[] | undefined;
    for (let i = 0; i < separators.length; i += 1) {
      const s = separators[i];
      if (s === "") {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = this.splitOnSeparator(text, separator);

    let goodSplits: string[] = [];
    const _separator = this.keepSeparator ? "" : separator;
    for (const s of splits) {
      if (this.lengthFunction(s) < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length) {
          const mergedText = this.mergeSplits(goodSplits, _separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        if (!newSeparators) {
          finalChunks.push(s);
        } else {
          const otherInfo = this._splitText(s, newSeparators);
          finalChunks.push(...otherInfo);
        }
      }
    }
    if (goodSplits.length) {
      const mergedText = this.mergeSplits(goodSplits, _separator);
      finalChunks.push(...mergedText);
    }
    return finalChunks;
  }

  splitText(text: string): string[] {
    return this._splitText(text, this.separators);
  }

  static fromLanguage(
    language: SupportedTextSplitterLanguage,
    options?: Partial<RecursiveCharacterTextSplitterParams>
  ) {
    return new RecursiveCharacterTextSplitter({
      ...options,
      separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage(language),
    });
  }

  static getSeparatorsForLanguage(language: SupportedTextSplitterLanguage): string[] {
    if (language === "cpp") {
      return [
        "\nclass ",
        "\nvoid ",
        "\nint ",
        "\nfloat ",
        "\ndouble ",
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nswitch ",
        "\ncase ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "go") {
      return [
        "\nfunc ",
        "\nvar ",
        "\nconst ",
        "\ntype ",
        "\nif ",
        "\nfor ",
        "\nswitch ",
        "\ncase ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "java") {
      return [
        "\nclass ",
        "\npublic ",
        "\nprotected ",
        "\nprivate ",
        "\nstatic ",
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nswitch ",
        "\ncase ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "js") {
      return [
        "\nfunction ",
        "\nconst ",
        "\nlet ",
        "\nvar ",
        "\nclass ",
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nswitch ",
        "\ncase ",
        "\ndefault ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "php") {
      return [
        "\nfunction ",
        "\nclass ",
        "\nif ",
        "\nforeach ",
        "\nwhile ",
        "\ndo ",
        "\nswitch ",
        "\ncase ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "proto") {
      return [
        "\nmessage ",
        "\nservice ",
        "\nenum ",
        "\noption ",
        "\nimport ",
        "\nsyntax ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "python") {
      return [
        "\nclass ",
        "\ndef ",
        "\n\tdef ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "rst") {
      return [
        "\n===\n",
        "\n---\n",
        "\n***\n",
        "\n.. ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "ruby") {
      return [
        "\ndef ",
        "\nclass ",
        "\nif ",
        "\nunless ",
        "\nwhile ",
        "\nfor ",
        "\ndo ",
        "\nbegin ",
        "\nrescue ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "rust") {
      return [
        "\nfn ",
        "\nconst ",
        "\nlet ",
        "\nif ",
        "\nwhile ",
        "\nfor ",
        "\nloop ",
        "\nmatch ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "scala") {
      return [
        "\nclass ",
        "\nobject ",
        "\ndef ",
        "\nval ",
        "\nvar ",
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nmatch ",
        "\ncase ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "swift") {
      return [
        "\nfunc ",
        "\nclass ",
        "\nstruct ",
        "\nenum ",
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\ndo ",
        "\nswitch ",
        "\ncase ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "markdown") {
      return [
        "\n## ",
        "\n### ",
        "\n#### ",
        "\n##### ",
        "\n###### ",
        "```\n\n",
        "\n\n***\n\n",
        "\n\n---\n\n",
        "\n\n___\n\n",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "latex") {
      return [
        "\n\\chapter{",
        "\n\\section{",
        "\n\\subsection{",
        "\n\\subsubsection{",
        "\n\\begin{enumerate}",
        "\n\\begin{itemize}",
        "\n\\begin{description}",
        "\n\\begin{list}",
        "\n\\begin{quote}",
        "\n\\begin{quotation}",
        "\n\\begin{verse}",
        "\n\\begin{verbatim}",
        "\n\\begin{align}",
        "$$",
        "$",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else if (language === "html") {
      return [
        "<body>",
        "<div>",
        "<p>",
        "<br>",
        "<li>",
        "<h1>",
        "<h2>",
        "<h3>",
        "<h4>",
        "<h5>",
        "<h6>",
        "<span>",
        "<table>",
        "<tr>",
        "<td>",
        "<th>",
        "<ul>",
        "<ol>",
        "<header>",
        "<footer>",
        "<nav>",
        "<head>",
        "<style>",
        "<script>",
        "<meta>",
        "<title>",
        " ",
        "",
      ];
    } else if (language === "sol") {
      return [
        "\npragma ",
        "\nusing ",
        "\ncontract ",
        "\ninterface ",
        "\nlibrary ",
        "\nconstructor ",
        "\ntype ",
        "\nfunction ",
        "\nevent ",
        "\nmodifier ",
        "\nerror ",
        "\nstruct ",
        "\nenum ",
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\ndo while ",
        "\nassembly ",
        "\n\n",
        "\n",
        " ",
        "",
      ];
    } else {
      throw new Error(`Language ${language} is not supported.`);
    }
  }
}
