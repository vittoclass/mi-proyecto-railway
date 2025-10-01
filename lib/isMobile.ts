import { useEffect, useState } from 'react';

// CORRECCIÓN: Se renombra a 'useIsMobile' para cumplir con la regla de React Hooks.
export const useIsMobile = () => {
  // Nota: Renombrada la variable interna a 'isMobileDevice' para mayor claridad.
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobile = Boolean(
      userAgent.match(
        /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i
      )
    );
    setIsMobileDevice(mobile);
  }, []);

  return isMobileDevice;
};