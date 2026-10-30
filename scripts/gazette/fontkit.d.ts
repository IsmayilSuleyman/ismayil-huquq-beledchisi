// fontkit ships no types; this declares the part issue-pdf.tsx uses to
// measure text the way react-pdf (which lays text out with fontkit) does.
declare module "fontkit" {
  export interface Font {
    unitsPerEm: number;
    layout(text: string): { advanceWidth: number };
  }
  export function openSync(filename: string): Font;
}
