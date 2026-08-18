import { useEffect, useRef } from 'react';

interface GoogleSignInButtonProps {
  onSuccess: (credential: { email: string; name: string; googleId?: string }) => void;
  onError: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleSignInButton({ onSuccess, onError, text = 'continue_with' }: GoogleSignInButtonProps) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return; // Wait for valid client ID in env

    const handleCredentialResponse = (response: any) => {
      try {
        if (response.credential) {
          const base64Url = response.credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          onSuccess({
            email: payload.email,
            name: payload.name || payload.given_name || 'Google User',
            googleId: payload.sub,
          });
        }
      } catch {
        onError('Google Sign-In parsing failed');
      }
    };

    const initializeGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            text: text,
            width: 320,
            shape: 'pill',
          });
        }
      }
    };

    if (!window.google?.accounts?.id) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGsi;
      document.body.appendChild(script);
    } else {
      initializeGsi();
    }
  }, [clientId, onSuccess, onError, text]);

  if (!clientId) {
    return null; // Don't render broken Google OAuth button if client ID isn't configured in Vercel env
  }

  return (
    <div className="flex justify-center w-full my-2">
      <div ref={googleButtonRef} />
    </div>
  );
}
