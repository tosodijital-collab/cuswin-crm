import { describe, expect, it } from "vitest";
import { coordsOf, whatsappChatHref, whatsappNumberOf, withWhatsapp } from "@/lib/domain/contact-info";

const clinic = { phone: "0312 427 48 48", contacts: [] as { id: string; name: string; role?: string; phone?: string }[] };

describe("WhatsApp numarası", () => {
  it("rehbere kaydetmeden sohbet açar; sabit hat da olabilir", () => {
    expect(whatsappChatHref("0532 111 22 33", "Merhaba")).toBe("https://wa.me/905321112233?text=Merhaba");
    expect(whatsappChatHref("0312 427 48 48", "a b")).toBe("https://wa.me/903124274848?text=a%20b");
    expect(whatsappChatHref("123", "x")).toBeUndefined();
  });

  it("önce kişilerdeki cep numarasını seçer, sabit hattı seçmez", () => {
    expect(whatsappNumberOf(clinic)).toBeUndefined();
    expect(whatsappNumberOf({ ...clinic, contacts: [{ id: "1", name: "WhatsApp", phone: "0532 111 22 33" }] })).toBe("+905321112233");
    expect(whatsappNumberOf({ phone: "05321112233", contacts: [] })).toBe("+905321112233");
  });

  it("yeni numarayı kişilere ekler, bilineni tekrar eklemez", () => {
    const added = withWhatsapp(clinic, "+90 532 111 22 33");
    expect(added).toHaveLength(1);
    expect(added?.[0].phone).toBe("0532 111 22 33");
    expect(withWhatsapp(clinic, "03124274848")).toBeUndefined();
    expect(withWhatsapp({ ...clinic, contacts: added! }, "05321112233")).toBeUndefined();
    expect(withWhatsapp(clinic, "12")).toBeUndefined();
  });
});

describe("haritada konum", () => {
  it("Google Maps bağlantısından enlem/boylam okur", () => {
    expect(coordsOf("https://www.google.com/maps/place/X/data=!4m7!3m6!1s0x1:0x2!8m2!3d39.9194409!4d32.85956!16s")).toEqual({ lat: 39.9194409, lng: 32.85956 });
    expect(coordsOf("https://www.google.com/maps/@39.91,32.85,15z")).toEqual({ lat: 39.91, lng: 32.85 });
    expect(coordsOf("https://www.google.com/maps/search/?api=1&query=x")).toBeUndefined();
    expect(coordsOf(undefined)).toBeUndefined();
  });
});
