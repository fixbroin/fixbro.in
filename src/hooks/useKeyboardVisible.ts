import { useState, useEffect } from 'react';

/**
 * Hook that returns true if the on-screen keyboard is likely visible.
 * Works by monitoring the Visual Viewport API and comparing it against the initial height.
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const visualViewport = window.visualViewport;
    // Capture the initial height when the hook mounts
    // We use a reasonably large value as the "unobscured" height
    const initialHeight = window.innerHeight;
    
    const handleResize = () => {
      // If the current visual viewport height is significantly smaller than 
      // the initial innerHeight, the keyboard is likely visible.
      // We use a 150px threshold which is safer than a percentage for various screen sizes.
      const isVisible = visualViewport.height < initialHeight - 150;
      setKeyboardVisible(isVisible);
    };

    visualViewport.addEventListener('resize', handleResize);
    // Also listen to window resize as a fallback
    window.addEventListener('resize', handleResize);
    
    handleResize();

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboardVisible;
}
