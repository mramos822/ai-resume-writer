import { useEffect } from "react";

/**
 * While the page is on screen, the scrollbar of the whole page is not drawn (the page still scrolls with the wheel, touch or keys).
 * It puts "no-scrollbar" on the <html> element and takes it off when the page goes away, so other pages keep theirs.
 */
export function useHidePageScrollbar() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-scrollbar");
    return () => root.classList.remove("no-scrollbar");
  }, []);
}
