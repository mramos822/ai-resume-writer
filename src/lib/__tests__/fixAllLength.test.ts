import { lengthQuestion, withLengthAnswer, type ReviewIssue, type ReviewFix } from "@/lib/resumeReview";

const fix = (n: string) => ({ type: n }) as unknown as ReviewFix;
const issue = (id: string, extra: Partial<ReviewIssue> = {}): ReviewIssue => ({ id, title: id, detail: "", impact: "high", fix: fix(`cut-${id}`), ...extra });

describe("Fix all and the length of the resume", () => {
  it("has nothing to ask when none of the fixes has a second way out", () => {
    expect(lengthQuestion([issue("a"), issue("b")])).toBeNull();
  });

  it("asks when one of the fixes can be answered with two pages", () => {
    const length = issue("len", { alt: fix("two-pages") });
    expect(lengthQuestion([issue("a"), length, issue("b")])?.id).toBe("len");
  });

  it("\"one page\" keeps every fix as it is", () => {
    const length = issue("len", { alt: fix("two-pages") });
    const out = withLengthAnswer([issue("a"), length], "len", "one");
    expect(out[1].fix).toEqual(fix("cut-len"));
  });

  it("\"two pages\" swaps only the length fix for its second way out and leaves the others", () => {
    const length = issue("len", { alt: fix("two-pages"), fixes: [fix("x")] });
    const other = issue("a");
    const out = withLengthAnswer([other, length], "len", "two");
    expect(out[0]).toBe(other);
    expect(out[1].fix).toEqual(fix("two-pages"));
    expect(out[1].fixes).toBeUndefined();
  });
});
