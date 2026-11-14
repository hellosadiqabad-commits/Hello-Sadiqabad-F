import React, { useEffect, useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isAppInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function InstallAppButton() {
  const { lang } = useI18n();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isAppInstalled);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    };
    const onDisplayModeChange = () => {
      if (isAppInstalled()) setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    displayMode.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayMode.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  if (installed) return null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setInstallPrompt(null);
      } else {
        setInstallPrompt(null);
      }
      return;
    }
    if (isIos) setShowIosHelp((visible) => !visible);
  };

  if (!installPrompt && !isIos) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleInstall}
        className="w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors"
      >
        {isIos ? <Share className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        <span>{lang === 'ur' ? 'ایپ انسٹال کریں' : 'Install App'}</span>
        <Smartphone className="w-4 h-4 opacity-80" />
      </button>

      {showIosHelp && (
        <div className="max-w-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-xs text-on-surface shadow-sm">
          {lang === 'ur' ? (
            <p className="font-urdu leading-8" dir="rtl">
              Safari میں نیچے Share بٹن دبائیں، پھر “Add to Home Screen” منتخب کریں اور Add دبائیں۔ انسٹال ہونے کے بعد ایپ ہوم اسکرین سے کھولیں۔
            </p>
          ) : (
            <p className="leading-relaxed">
              In Safari, tap the Share button, choose “Add to Home Screen”, then tap “Add”. Open Hello Sadiqabad from your Home Screen after installation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
