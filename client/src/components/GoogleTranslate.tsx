import { useEffect } from 'react';

declare global {
  interface Window {
    google: {
      translate: {
        TranslateElement: {
          new (
            config: {
              pageLanguage: string;
              includedLanguages: string;
              layout: number;
              autoDisplay: boolean;
            },
            elementId: string
          ): void;
          InlineLayout: {
            SIMPLE: number;
          };
        };
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

export const GoogleTranslate = () => {
  useEffect(() => {
    // Add Google Translate script
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);

    // Initialize the widget
    window.googleTranslateElementInit = function() {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'ar,zh-CN,fr,de,hi,it,ja,ko,pt,ru,es',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        'google_translate_element'
      );

      // Add custom styles to hide the top bar and customize appearance
        const style = document.createElement('style');
        style.textContent = `
          .goog-te-gadget {
            font-size: 0 !important;
          }
          .goog-te-gadget .goog-logo-link {
            display: none !important;
          }
          .goog-te-gadget .goog-te-combo {
            margin: 0 !important;
            padding: 8px !important;
            border: 1px solid #4a4a4a !important;
            border-radius: 4px !important;
            background-color: transparent !important;
            color: #e5e5e5 !important;
            font-size: 14px !important;
            cursor: pointer !important;
          }
          .goog-te-banner-frame {
            display: none !important;
          }
          body {
            top: 0 !important;
            position: static !important;
          }
          .skiptranslate {
            display: none !important;
          }
          .goog-tooltip {
            display: none !important;
          }
          .goog-tooltip:hover {
            display: none !important;
          }
          .goog-text-highlight {
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
        `;
      document.head.appendChild(style);
    };

    return () => {
      // Cleanup
      document.body.removeChild(script);
      delete window.googleTranslateElementInit;
    };
  }, []);

  return (
    <div 
      id="google_translate_element" 
      className="fixed top-4 right-4 z-50"
    />
  );
};