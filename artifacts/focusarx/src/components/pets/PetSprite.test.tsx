import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PetSprite } from "./PetSprite";

describe("PetSprite", () => {
  it("renders the animated sprite, hidden from AT, with a reserved box", () => {
    const { container } = render(<PetSprite src="https://sprites.example/pikachu.gif" glyph="⚡" size={56} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://sprites.example/pikachu.gif");
    // Decorative — the card's text carries the name.
    expect(img!.getAttribute("alt")).toBe("");
    expect(img!.getAttribute("aria-hidden")).toBe("true");
    // CLS guard: the box is reserved before the GIF arrives.
    expect(img!.getAttribute("width")).toBe("56");
    expect(img!.getAttribute("height")).toBe("56");
  });

  it("falls back to the glyph when there is no sprite", () => {
    const { container } = render(<PetSprite src={null} glyph="🦉" size={56} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("🦉");
  });

  it("falls back to the glyph when the sprite fails to load", () => {
    const { container } = render(<PetSprite src="https://sprites.example/dead.gif" glyph="👻" size={56} />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("👻");
  });
});
