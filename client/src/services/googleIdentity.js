
const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let scriptLoadPromise = null;
let initializedClientId = null;
let activeCredentialHandler = null;

function loadGoogleIdentityServices() {
  if (typeof window !== "undefined" && window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.resumatchGoogleIdentity = "true";

    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google);
      } else {
        scriptLoadPromise = null;
        reject(
          new Error("Google Identity Services loaded without its sign-in API.")
        );
      }
    };

    script.onerror = () => {
      scriptLoadPromise = null;
      reject(
        new Error(
          "Could not load Google Sign-In. Check your internet connection and refresh the page."
        )
      );
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export async function mountGoogleSignInButton(
  container,
  { clientId, onCredential }
) {
  if (!container) {
    throw new Error("Google sign-in button container is unavailable.");
  }

  if (!clientId || typeof clientId !== "string") {
    throw new Error(
      "Google OAuth Client ID is missing. Set VITE_GOOGLE_CLIENT_ID in client/.env."
    );
  }

  const google = await loadGoogleIdentityServices();

  activeCredentialHandler = onCredential;

  if (initializedClientId !== clientId) {
    google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,

      callback: (response) => {
        const credential = response?.credential;

        if (credential) {
          activeCredentialHandler?.(credential);
        }
      },
    });

    initializedClientId = clientId;
  }

  const measuredWidth = Math.floor(
    container.getBoundingClientRect().width || 360
  );

  const buttonWidth = Math.max(
    220,
    Math.min(400, measuredWidth)
  );

  container.replaceChildren();

  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: buttonWidth,
  });
}


export function unmountGoogleSignInButton(container, onCredential) {
  // Do not let an older React effect remove a newer Google button.
  if (activeCredentialHandler !== onCredential) {
    return;
  }

  activeCredentialHandler = null;
  container?.replaceChildren();
}


export function disableGoogleAutoSelect() {
  try {
    window.google?.accounts?.id?.disableAutoSelect?.();
  } catch {
    // Sign-out must still complete if Google Identity Services is unavailable.
  }
}
