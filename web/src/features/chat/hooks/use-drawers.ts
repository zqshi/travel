import { useState, useCallback } from "react";
import type { BookingItem } from "@/components/booking-drawer";
import type { VoiceBookingItem } from "@/components/voice-booking-drawer";
import type { Message } from "../types";
import { fetchWithAuth } from "@/lib/auth";
import { API_BASE } from "../constants";

export interface BookingRecord {
  orderId: string;
  bookingRef: string;
  platform: string;
  priceThb: number;
  priceCny: number;
}

export function useDrawers(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingItem, setBookingItem] = useState<BookingItem | null>(null);

  const [voiceBookingOpen, setVoiceBookingOpen] = useState(false);
  const [voiceBookingItem, setVoiceBookingItem] = useState<VoiceBookingItem | null>(null);

  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [sourceDrawerUrl, setSourceDrawerUrl] = useState("");
  const [sourceDrawerNotes, setSourceDrawerNotes] = useState("");

  const [bookedItems, setBookedItems] = useState<Set<string>>(new Set());
  const [bookedItemsMap, setBookedItemsMap] = useState<Map<string, BookingRecord>>(new Map());

  const [viewBookingOpen, setViewBookingOpen] = useState(false);
  const [viewBookingName, setViewBookingName] = useState("");

  const closeAllDrawers = useCallback(() => {
    setBookingOpen(false);
    setVoiceBookingOpen(false);
    setSourceDrawerOpen(false);
    setViewBookingOpen(false);
  }, []);

  const resetBookingState = useCallback(() => {
    closeAllDrawers();
    setBookedItems(new Set());
    setBookedItemsMap(new Map());
  }, [closeAllDrawers]);

  const openBooking = useCallback(
    (item: {
      name: string;
      nameLocal?: string;
      platform: string;
      priceThb: number;
      priceCny: number;
      category: string;
      sourceUrl?: string;
      date?: string;
    }) => {
      closeAllDrawers();
      setBookingItem({
        name: item.name,
        nameLocal: item.nameLocal,
        platform: item.platform,
        priceThb: item.priceThb,
        priceCny: item.priceCny,
        category: item.category as BookingItem["category"],
        sourceUrl: item.sourceUrl,
        date: item.date,
      });
      setBookingOpen(true);
    },
    [closeAllDrawers],
  );

  const openVoiceBooking = useCallback(
    (item: {
      name: string;
      platform: string;
      priceThb: number;
      priceCny: number;
      sourceUrl?: string;
      phone?: string;
    }) => {
      closeAllDrawers();
      setVoiceBookingItem({
        name: item.name,
        merchantPhone: item.phone || "+66800000000",
        date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        travelers: 2,
        contactName: "",
        contactPhone: "",
        platform: item.platform,
        priceThb: item.priceThb,
        priceCny: item.priceCny,
      });
      setVoiceBookingOpen(true);
    },
    [closeAllDrawers],
  );

  const completeBooking = useCallback(
    (orderId: string) => {
      const itemName = bookingItem?.name || "";
      setBookedItems((prev) => new Set(prev).add(itemName));
      setBookedItemsMap((prev) => {
        const next = new Map(prev);
        next.set(itemName, {
          orderId,
          bookingRef: "",
          platform: bookingItem?.platform || "",
          priceThb: bookingItem?.priceThb || 0,
          priceCny: bookingItem?.priceCny || 0,
        });
        return next;
      });
      setMessages((prev) => [
        ...prev,
        {
          type: "booking_success" as const,
          orderId,
          itemName,
          platform: bookingItem?.platform || "",
        },
      ]);
    },
    [bookingItem, setMessages],
  );

  const completeVoiceBooking = useCallback(
    (orderId: string, bookingRef: string) => {
      const itemName = voiceBookingItem?.name || "";
      setBookedItems((prev) => new Set(prev).add(itemName));
      setBookedItemsMap((prev) => {
        const next = new Map(prev);
        next.set(itemName, {
          orderId,
          bookingRef,
          platform: voiceBookingItem?.platform || "",
          priceThb: voiceBookingItem?.priceThb || 0,
          priceCny: voiceBookingItem?.priceCny || 0,
        });
        return next;
      });
      setMessages((prev) => [
        ...prev,
        {
          type: "booking_success" as const,
          orderId,
          itemName,
          platform: voiceBookingItem?.platform || "",
        },
      ]);
    },
    [voiceBookingItem, setMessages],
  );

  const openSource = useCallback(
    (url: string, notes?: string) => {
      closeAllDrawers();
      setSourceDrawerUrl(url);
      setSourceDrawerNotes(notes || "");
      setSourceDrawerOpen(true);
    },
    [closeAllDrawers],
  );

  const viewBooking = useCallback(
    (itemName: string) => {
      closeAllDrawers();
      setViewBookingName(itemName);
      setViewBookingOpen(true);
    },
    [closeAllDrawers],
  );

  const cancelBooking = useCallback(
    async (itemName: string) => {
      const booking = bookedItemsMap.get(itemName);
      if (!booking) return;
      try {
        const res = await fetchWithAuth(
          `${API_BASE}/api/v1/booking/${booking.orderId}/cancel`,
          { method: "POST" },
        );
        if (res.ok) {
          setBookedItems((prev) => {
            const next = new Set(prev);
            next.delete(itemName);
            return next;
          });
          setBookedItemsMap((prev) => {
            const next = new Map(prev);
            next.delete(itemName);
            return next;
          });
          setViewBookingOpen(false);
          setMessages((prev) => [
            ...prev,
            { type: "text" as const, content: `已取消「${itemName}」的预定。` },
          ]);
        }
      } catch {}
    },
    [bookedItemsMap, setMessages],
  );

  const anyDrawerOpen = bookingOpen || voiceBookingOpen || sourceDrawerOpen || viewBookingOpen;

  return {
    bookingOpen,
    setBookingOpen,
    bookingItem,
    voiceBookingOpen,
    setVoiceBookingOpen,
    voiceBookingItem,
    sourceDrawerOpen,
    setSourceDrawerOpen,
    sourceDrawerUrl,
    sourceDrawerNotes,
    bookedItems,
    bookedItemsMap,
    viewBookingOpen,
    setViewBookingOpen,
    viewBookingName,
    anyDrawerOpen,
    closeAllDrawers,
    resetBookingState,
    openBooking,
    openVoiceBooking,
    completeBooking,
    completeVoiceBooking,
    openSource,
    viewBooking,
    cancelBooking,
  };
}
