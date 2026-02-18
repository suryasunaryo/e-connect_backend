const fs = require("fs");
const path = require("path");

const filename = path.join(process.cwd(), "src/config/database.js");
const outfile = path.join(process.cwd(), "debug_depth.txt");

try {
  const content = fs.readFileSync(filename, "utf8");

  const stack = [];
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;

  let line = 1;
  let col = 0;

  const log = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    // Update line/col
    if (char === "\n") {
      line++;
      col = 0;
    } else {
      col++;
    }

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && i + 1 < content.length && content[i + 1] === "/") {
        inBlockComment = false;
        i++;
        col++;
      }
      continue;
    }

    if (inString) {
      if (char === "\\") {
        i++;
        col++;
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    // Check for comments start
    if (char === "/" && i + 1 < content.length) {
      if (content[i + 1] === "/") {
        inLineComment = true;
        i++;
        col++;
        continue;
      }
      if (content[i + 1] === "*") {
        inBlockComment = true;
        i++;
        col++;
        continue;
      }
    }

    if (['"', "'", "`"].includes(char)) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (["{", "[", "("].includes(char)) {
      stack.push({ char, line, col });
    } else if (["}", "]", ")"].includes(char)) {
      if (stack.length === 0) {
        log.push(`EMPTY STACK at line ${line}, col ${col}`);
        break;
      }

      const last = stack.pop();
      // Check depth
      if (stack.length < 2 && line > 64 && line < 1519) {
        log.push(
          `DEPTH DROP to ${stack.length} at line ${line}, col ${col} (closed ${last.char} from ${last.line}:${last.col})`,
        );
      }
    }
  }

  fs.writeFileSync(outfile, log.join("\n"));
  console.log("Done");
} catch (err) {
  fs.writeFileSync(outfile, `Failed: ${err}`);
}
