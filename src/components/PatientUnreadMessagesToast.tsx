'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface PatientUnreadMessagesToastProps {
  unreadCount: number;
  latestUnreadMessageId?: string;
  latestUnreadMessageTitle?: string;
}

const DISMISS_STORAGE_KEY = 'patient_messages_toast_last_dismissed_message_id';
const EXIT_ANIMATION_MS = 220;

export default function PatientUnreadMessagesToast({
  unreadCount,
  latestUnreadMessageId,
  latestUnreadMessageTitle,
}: PatientUnreadMessagesToastProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldRender = useMemo(() => unreadCount > 0, [unreadCount]);

  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (!shouldRender) {
      setIsVisible(false);
      hideTimeoutRef.current = setTimeout(() => {
        setIsMounted(false);
      }, EXIT_ANIMATION_MS);
      return;
    }

    const dismissedForMessageId = window.localStorage.getItem(DISMISS_STORAGE_KEY);

    if (latestUnreadMessageId && dismissedForMessageId === latestUnreadMessageId) {
      setIsVisible(false);
      setIsMounted(false);
      return;
    }

    setIsMounted(true);
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [latestUnreadMessageId, shouldRender]);

  const handleClose = () => {
    if (latestUnreadMessageId) {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, latestUnreadMessageId);
    }

    setIsVisible(false);
    hideTimeoutRef.current = setTimeout(() => {
      setIsMounted(false);
    }, EXIT_ANIMATION_MS);
  };

  if (!shouldRender || !isMounted) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-[#f1d69a] bg-[#fff8e8] p-4 shadow-lg transition-all duration-200 ease-out ${
        isVisible
          ? 'translate-y-0 scale-100 opacity-100'
          : 'translate-y-2 scale-[0.98] opacity-0'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9a640b]">Nova mensagem</p>
          <p className="mt-1 text-sm font-semibold text-[#7a4b00]">
            Você tem {unreadCount} mensagem(ns) não lida(s).
          </p>
          {latestUnreadMessageTitle && (
            <p className="mt-1 text-xs text-[#8b5c12] line-clamp-2">{latestUnreadMessageTitle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="rounded-md px-2 py-1 text-sm font-semibold text-[#8b5c12] hover:bg-[#f8e7bf]"
          aria-label="Fechar aviso"
        >
          ×
        </button>
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          href="/paciente/mensagens"
          onClick={handleClose}
          className="inline-flex items-center rounded-md bg-[#a16508] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8d5707]"
        >
          Abrir mensagens
        </Link>
      </div>
    </div>
  );
}
