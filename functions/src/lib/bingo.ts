export type Pattern = "line" | "fullCard" | "corners" | "x" | "diagonal";

export function generateCard(): number[][] {
  const grid: number[][] = [];
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const nums = shuffle(range(min, max)).slice(0, 5);
    for (let row = 0; row < 5; row++) {
      if (!grid[row]) grid[row] = [];
      grid[row][col] = nums[row];
    }
  }

  grid[2][2] = 0;
  return grid;
}

export function getBingoLetter(num: number): string {
  if (num >= 1 && num <= 15) return "B";
  if (num >= 16 && num <= 30) return "I";
  if (num >= 31 && num <= 45) return "N";
  if (num >= 46 && num <= 60) return "G";
  return "O";
}

export function validatePattern(
  grid: number[][],
  markedNums: number[],
  pattern: Pattern,
): boolean {
  const marked = new Set(markedNums);
  marked.add(0);

  function isMark(row: number, col: number): boolean {
    return marked.has(grid[row][col]);
  }

  switch (pattern) {
    case "line":
      for (let r = 0; r < 5; r++) {
        if ([0, 1, 2, 3, 4].every((c) => isMark(r, c))) return true;
      }
      for (let c = 0; c < 5; c++) {
        if ([0, 1, 2, 3, 4].every((r) => isMark(r, c))) return true;
      }
      return false;
    case "diagonal":
      if ([0, 1, 2, 3, 4].every((i) => isMark(i, i))) return true;
      if ([0, 1, 2, 3, 4].every((i) => isMark(i, 4 - i))) return true;
      return false;
    case "corners":
      return isMark(0, 0) && isMark(0, 4) && isMark(4, 0) && isMark(4, 4);
    case "x":
      return (
        [0, 1, 2, 3, 4].every((i) => isMark(i, i)) &&
        [0, 1, 2, 3, 4].every((i) => isMark(i, 4 - i))
      );
    case "fullCard":
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!isMark(r, c)) return false;
        }
      }
      return true;
    default:
      return false;
  }
}

function range(min: number, max: number): number[] {
  const arr = [];
  for (let i = min; i <= max; i++) arr.push(i);
  return arr;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const COLOR_THEMES = ["gold", "blue", "purple", "red", "green", "silver", "orange", "teal"];
let colorIdx = 0;
export function nextColorTheme(): string {
  return COLOR_THEMES[colorIdx++ % COLOR_THEMES.length];
}
