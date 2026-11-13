import { describe, expect, it } from "vitest";
import { distanceMeters, formatDistance, mapPoints, nearest } from "@/lib/domain/map-points";
import type { Appointment, Business } from "@/lib/domain/types";

const biz = (id: string, lat: number | undefined, extra: Partial<Business> = {}): Business => ({
  id,
  name: id,
  categories: ["estetik"],
  source: "google_maps",
  foundAt: "2026-11-01T00:00:00Z",
  contacts: [],
  callStatus: "aranacak",
  salesStage: "yeni_aday",
  failedStreak: 0,
  mapsUrl: lat === undefined ? undefined : `https://www.google.com/maps/place/x/data=!3d${lat}!4d32.85`,
  ...extra,
});

describe("saha haritası", () => {
  const now = new Date("2026-11-13T09:00:00Z");
  const appt = (businessId: string, startsAt: string, status: Appointment["status"] = "planlandi") =>
    ({ id: `a-${businessId}`, businessId, startsAt, meetingType: "yuz_yuze", status, reminderMinutes: 30 }) as Appointment;

  it("konumu olmayanları sayar, durumları renklendirir", () => {
    const contacts = new Map([["z", { lastVisit: { id: "v", businessId: "z", at: now.toISOString(), type: "ziyaret" } as never }]]);
    const { points, missing } = mapPoints(
      [
        biz("a", 39.9),
        biz("r", 39.91),
        biz("eski", 39.92),
        biz("z", 39.93),
        biz("x", 39.94, { callStatus: "ilgilenmiyor" }),
        biz("m", 39.95, { salesStage: "musteri_oldu" }),
        biz("yok", undefined),
      ],
      [appt("r", "2026-11-14T11:00:00Z"), appt("eski", "2026-11-12T11:00:00Z")],
      contacts,
      now,
    );
    expect(missing).toBe(1);
    expect(Object.fromEntries(points.map((p) => [p.business.id, p.status]))).toEqual({
      a: "aranacak",
      r: "randevu",
      eski: "aranacak",
      z: "ziyaret",
      x: "kapali",
      m: "musteri",
    });
  });

  it("en yakından uzağa sıralar, ilgilenmeyenleri göstermez", () => {
    const { points } = mapPoints([biz("uzak", 39.95), biz("yakin", 39.901), biz("x", 39.9, { callStatus: "ilgilenmiyor" })], [], new Map(), now);
    const list = nearest(points, { lat: 39.9, lng: 32.85 }, 5);
    expect(list.map((l) => l.point.business.id)).toEqual(["yakin", "uzak"]);
    expect(Math.round(list[0].meters)).toBeGreaterThan(100);
    expect(Math.round(distanceMeters({ lat: 39.9, lng: 32.85 }, { lat: 39.9, lng: 32.85 }))).toBe(0);
    expect(formatDistance(184)).toBe("180 m");
    expect(formatDistance(1250)).toBe("1,3 km");
  });
});
