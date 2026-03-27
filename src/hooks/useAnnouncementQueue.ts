import { useCallback, useEffect, useMemo, useState } from 'react';

export type AnnouncementItem = {
  title: string;
  message: string;
};

export type AnnouncementInput =
  | string
  | AnnouncementItem
  | Array<string | AnnouncementItem>;

const normalizeAnnouncement = (input: string | AnnouncementItem): AnnouncementItem => {
  if (typeof input === 'string') {
    return {
      title: 'Notice',
      message: input,
    };
  }

  return input;
};

export function useAnnouncementQueue(durationMs: number) {
  const [queue, setQueue] = useState<AnnouncementItem[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementItem | null>(null);

  const announce = useCallback((input: AnnouncementInput) => {
    const items = (Array.isArray(input) ? input : [input])
      .map(normalizeAnnouncement)
      .filter((item) => item.message.trim().length > 0);

    if (items.length === 0) return;

    setQueue((prev) => [...prev, ...items]);
  }, []);

  const clearAnnouncements = useCallback(() => {
    setQueue([]);
    setActiveAnnouncement(null);
  }, []);

  useEffect(() => {
    if (activeAnnouncement || queue.length === 0) return;

    setActiveAnnouncement(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [activeAnnouncement, queue]);

  useEffect(() => {
    if (!activeAnnouncement) return;

    const timeout = window.setTimeout(() => {
      setActiveAnnouncement(null);
    }, durationMs);

    return () => window.clearTimeout(timeout);
  }, [activeAnnouncement, durationMs]);

  return useMemo(
    () => ({
      activeAnnouncement,
      announce,
      clearAnnouncements,
    }),
    [activeAnnouncement, announce, clearAnnouncements],
  );
}
