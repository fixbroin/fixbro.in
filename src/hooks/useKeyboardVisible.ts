import { useState, useEffect } from 'react';

/**
 * Hook that returns true if the on-screen keyboard is likely visible.
 * Works by monitoring the Visual Viewport API which changes when the keyboard appears on most mobile browsers.
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Only run on client-side and if Visual Viewport API is supported
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const visualViewport = window.visualViewport;
    
    const handleResize = () => {
      // If the visual viewport height is significantly smaller than the window height,
      // the keyboard is likely visible.
      // Using 85% as a threshold to avoid false positives from browser chrome.
      const isVisible = visualViewport.height < window.innerHeight * 0.85;
      setKeyboardVisible(isVisible);
    };

    visualViewport.addEventListener('resize', handleResize);
    
    // Initial check
    handleResize();

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboardVisible;
}
