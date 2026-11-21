// Sets the numbers in a sentence ("10M+ records", "40%", "1,200+") in the
// monospace figure face, so the measurable parts of the work stand out.

const FIGURE = /(\d[\d,.]*(?:M\+|K\+|TB\+|%|\+)?)/;

export function Figures({ text }: { text: string }) {
  return (
    <>
      {text.split(FIGURE).map((part, i) =>
        // split() with a capture group puts the matches at odd indexes
        i % 2 ? (
          <span key={i} className="fig">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
