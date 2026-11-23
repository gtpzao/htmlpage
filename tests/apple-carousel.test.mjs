import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const page = readFileSync(new URL("../apple.html", import.meta.url), "utf8");

class ElementFixture {
  constructor(textContent = "") {
    this.textContent = textContent;
    this.hidden = false;
    this.listeners = new Map();
    this.attributes = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  click() {
    for (const listener of this.listeners.get("click") ?? []) listener();
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function createCarouselFixture() {
  const captions = [
    "Cliente — página pública",
    "Pedidos — área administrativa",
    "Cardápio — área administrativa",
    "CRM — área administrativa",
    "Buffet — área administrativa",
    "WhatsApp — área administrativa",
    "Configurações — área administrativa",
  ];
  const slides = captions.map(caption => {
    const slide = new ElementFixture();
    slide.querySelector = selector => selector === "figcaption" ? new ElementFixture(caption) : null;
    return slide;
  });
  const indicators = captions.map(() => new ElementFixture());
  const previous = new ElementFixture();
  const next = new ElementFixture();
  const status = new ElementFixture();
  const carousel = new ElementFixture();

  carousel.querySelectorAll = selector => {
    if (selector === "[data-carousel-slide]") return slides;
    if (selector === "[data-carousel-indicator]") return indicators;
    return [];
  };
  carousel.querySelector = selector => ({
    "[data-carousel-previous]": previous,
    "[data-carousel-next]": next,
    "[data-carousel-status]": status,
  })[selector] ?? null;

  return {
    document: { querySelector: selector => selector === "[data-apple-carousel]" ? carousel : null },
    slides,
    indicators,
    previous,
    next,
    status,
  };
}

function startCarousel(fixture) {
  const script = page.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script, "apple.html exposes its carousel through a page script");
  runInNewContext(script, { document: fixture.document });
}

test("next control shows the next screen and announces its position", () => {
  const fixture = createCarouselFixture();
  startCarousel(fixture);

  fixture.next.click();

  assert.equal(fixture.slides[0].hidden, true);
  assert.equal(fixture.slides[1].hidden, false);
  assert.equal(fixture.indicators[1].getAttribute("aria-current"), "true");
  assert.match(fixture.status.textContent, /2 de 7.*Pedidos/);
});

test("previous control wraps from the first screen to the last", () => {
  const fixture = createCarouselFixture();
  startCarousel(fixture);

  fixture.previous.click();

  assert.equal(fixture.slides[0].hidden, true);
  assert.equal(fixture.slides[6].hidden, false);
  assert.equal(fixture.indicators[6].getAttribute("aria-current"), "true");
  assert.match(fixture.status.textContent, /7 de 7.*Configurações/);
});

test("a selected indicator shows its screen and announces the matching position", () => {
  const fixture = createCarouselFixture();
  startCarousel(fixture);

  fixture.indicators[3].click();

  assert.equal(fixture.slides[0].hidden, true);
  assert.equal(fixture.slides[3].hidden, false);
  assert.equal(fixture.indicators[3].getAttribute("aria-current"), "true");
  assert.match(fixture.status.textContent, /4 de 7.*CRM/);
});
