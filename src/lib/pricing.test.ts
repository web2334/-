import { describe, expect, it } from "vitest";
import { estimate, unitPrice, roundMoney } from "./pricing";
import { DEFAULT_SETTINGS } from "./settings-schema";

const P = DEFAULT_SETTINGS.pricing; // sofa_3 4200, minOrder 2500, dirty 30%, side 60%, trip 700

describe("формула", () => {
  it("округляет до 10 ₽", () => {
    expect(roundMoney(1234)).toBe(1230);
    expect(roundMoney(1235)).toBe(1240);
  });
  it("проценты складываются и применяются к базе", () => {
    // 3000 × (100+30+60)% = 5700
    expect(unitPrice(3000, P, true, true)).toBe(5700);
    // 350 × 130% = 455 → 460
    expect(unitPrice(350, P, true, false)).toBe(460);
  });
  it("количество умножает цену за штуку после округления", () => {
    const e = estimate([{ category: "chair", variant: "chair_seat", qty: 3, dirty: true, secondSide: false }], P, false);
    expect(e.lines[0].unitPrice).toBe(460);
    expect(e.lines[0].total).toBe(1380);
  });
});

describe("минимальный заказ", () => {
  it("доплачивает до минимума только чистку, выезд сверху", () => {
    const e = estimate([{ category: "chair", variant: "chair_seat", qty: 2, dirty: false, secondSide: false }], P, true);
    expect(e.knownSubtotal).toBe(700);
    expect(e.minTopUp).toBe(1800);
    expect(e.tripFee).toBe(700);
    expect(e.total).toBe(2500 + 700);
  });
  it("не применяется, если сумма выше", () => {
    const e = estimate([{ category: "sofa", variant: "sofa_3", qty: 1, dirty: false, secondSide: false }], P, false);
    expect(e.minTopUp).toBe(0);
    expect(e.total).toBe(4200);
  });
});

describe("смешанный заказ", () => {
  it("не показывает неизвестную цену как ноль", () => {
    const e = estimate(
      [
        { category: "chair", variant: "chair_seat", qty: 1, dirty: false, secondSide: false },
        { category: "other", variant: null, qty: 1, dirty: false, secondSide: false, description: "Пуф" },
      ],
      P,
      false,
    );
    expect(e.total).toBeNull();
    expect(e.manualCount).toBe(1);
    expect(e.knownSubtotal).toBe(350);
    expect(e.minTopUp).toBe(0);
    expect(e.floor).toBe(2500);
    expect(e.lines[1].total).toBeNull();
  });
  it("вторая сторона только для матраса", () => {
    const e = estimate([{ category: "sofa", variant: "sofa_2", qty: 1, dirty: false, secondSide: true }], P, false);
    expect(e.lines[0].unitPrice).toBe(3200);
  });
});
