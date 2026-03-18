'use client';

import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';

export function useCookieConsent() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setAccepted(localStorage.getItem('cookie-consent-accepted') === 'true');

    const handler = () => {
      setAccepted(localStorage.getItem('cookie-consent-accepted') === 'true');
    };
    window.addEventListener('cookie-consent-changed', handler);
    return () => window.removeEventListener('cookie-consent-changed', handler);
  }, []);

  return accepted;
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já aceitou os cookies
    const hasAcceptedCookies = localStorage.getItem('cookie-consent-accepted');
    if (!hasAcceptedCookies) {
      // Aguarda um pouco para não aparecer muito rápido
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent-accepted', 'true');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    window.dispatchEvent(new Event('cookie-consent-changed'));
    setIsAnimatingOut(true);
    setTimeout(() => setIsVisible(false), 300);
  };

  const handleReject = () => {
    localStorage.setItem('cookie-consent-rejected', 'true');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    window.dispatchEvent(new Event('cookie-consent-changed'));
    setIsAnimatingOut(true);
    setTimeout(() => setIsVisible(false), 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
        isAnimatingOut ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

      {/* Banner Content */}
      <div className="relative bg-white border-t-2 border-[#1ea58c] shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Text Content */}
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[#155b79] mb-2">
                🍪 Política de Cookies
              </h3>
              <p className="text-xs text-[#7b8d97] leading-relaxed max-w-2xl">
                Utilizamos cookies para melhorar sua experiência na plataforma OmniNote. 
                Cookies funcionais são essenciais para autenticação e segurança. 
                Ao continuar navegando, você concorda com nossa{' '}
                <a 
                  href="#" 
                  className="text-[#1ea58c] font-semibold hover:text-[#155b79] transition"
                >
                  política de privacidade
                </a>
                .
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleReject}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border-2 border-[#cfe0e8] text-[#155b79] text-xs font-bold hover:bg-[#f3f7f9] transition duration-200"
                aria-label="Rejeitar cookies"
              >
                Rejeitar
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-[#1ea58c] text-white text-xs font-bold hover:bg-[#18956e] transition duration-200 flex items-center justify-center gap-2"
                aria-label="Aceitar cookies"
              >
                <Check size={16} />
                Aceitar
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleReject}
            className="absolute top-4 right-4 text-[#7b8d97] hover:text-[#155b79] transition opacity-50 hover:opacity-100"
            aria-label="Fechar aviso de cookies"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
