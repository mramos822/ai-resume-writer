import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/provider";
import PageLengthPicker from "@/components/pageLengthPicker";

const show = (value: "one" | "two" | "any", template: string, onChange = jest.fn(), locale: "en" | "es" = "en") => {
  render(
    <LocaleProvider locale={locale}>
      <PageLengthPicker value={value} template={template} onChange={onChange} />
    </LocaleProvider>
  );
  return onChange;
};

describe("PageLengthPicker", () => {
  it("offers one page, two pages and 'let Kaizo decide', with the chosen one marked", () => {
    show("two", "classic");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /^Two pages/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^One page/ })).toHaveAttribute("aria-checked", "false");
  });

  it("reports what the person picks", () => {
    const onChange = show("one", "classic");
    fireEvent.click(screen.getByRole("radio", { name: /Let Kaizo decide/ }));
    expect(onChange).toHaveBeenCalledWith("any");
  });

  it("warns that a look made for one page cannot do two", () => {
    show("two", "modern");
    expect(screen.getByText(/always one page/)).toBeInTheDocument();
  });

  it("says nothing extra when the look can do two pages, or when one page is chosen", () => {
    const { unmount } = render(
      <LocaleProvider locale="en">
        <PageLengthPicker value="two" template="ats" onChange={jest.fn()} />
      </LocaleProvider>
    );
    expect(screen.queryByText(/always one page/)).toBeNull();
    unmount();
    show("one", "modern");
    expect(screen.queryByText(/always one page/)).toBeNull();
  });

  it("is in Spanish on the Spanish site", () => {
    show("one", "classic", jest.fn(), "es");
    expect(screen.getByRole("radio", { name: /^Una página/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Que Kaizo decida/ })).toBeInTheDocument();
  });
});
