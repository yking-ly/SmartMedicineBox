"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  UserCredential,
} from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { firebaseApp } from "../../lib/firebase";
import { Button, Container, Typography, Box, CircularProgress } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

export default function LoginPage() {
  const router = useRouter();
  const auth = getAuth(firebaseApp);
  const db = getDatabase(firebaseApp);

  const [loading, setLoading] = useState(false);

  // Handle redirect result on page load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const result: UserCredential | null = await getRedirectResult(auth).catch(() => null);
        if (result && mounted) {
          await handlePostSignIn(result);
        }
      } catch (err) {
        console.error("Redirect result handling error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared post-sign-in logic (whitelist check + redirect)
  const handlePostSignIn = async (credential: UserCredential) => {
    const user = credential.user;
    if (!user) {
      console.warn("No user returned from credential.");
      await auth.signOut();
      return;
    }

    const email = user.email;
    if (!email) {
      alert("No email present in account. Sign-in cancelled.");
      await auth.signOut();
      return;
    }

    // Convert email to Firebase-safe key
    const safeEmail = email.replace(/\./g, ",");

    try {
      const snapshot = await get(ref(db, "allowedDoctors/" + safeEmail));
      if (!snapshot.exists()) {
        alert("Access denied: you are not an authorized caregiver.");
        console.warn("Unauthorized login attempt:", email);
        await auth.signOut();
        return;
      }

      console.log("✅ Caregiver signed in:", email);
      router.push("/dashboard");
    } catch (err) {
      console.error("Whitelist check failed:", err);
      alert("Sign-in succeeded but whitelist check failed. See console.");
      await auth.signOut();
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      // Try popup first (fast & UX-friendly)
      const result = await signInWithPopup(auth, provider);
      await handlePostSignIn(result);
    } catch (error: any) {
      console.warn("Popup sign-in failed:", error?.code || error?.message || error);

      // If popup is blocked or closed, fallback to redirect
      // Common popup errors: 'auth/popup-closed-by-user', 'auth/cancelled-popup-request',
      // or browser blocking/COOP issues.
      try {
        console.log("Falling back to signInWithRedirect...");
        await signInWithRedirect(auth, provider);
        // NOTE: signInWithRedirect will redirect away; after user completes sign-in,
        // getRedirectResult() (above) will run and call handlePostSignIn.
      } catch (redirErr) {
        console.error("Redirect fallback failed:", redirErr);
        alert("Sign-in failed. Try again in incognito or disable extensions.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 10 }}>
      <Box
        sx={{
          p: 4,
          borderRadius: 3,
          bgcolor: "background.paper",
          boxShadow: 4,
        }}
      >
        <Typography variant="h4" gutterBottom>
          Caregiver Login
        </Typography>
        <Typography variant="body1" gutterBottom>
          Sign in with your Google account to access the Smart Medicine Box dashboard.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<GoogleIcon />}
          onClick={handleLogin}
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? <CircularProgress color="inherit" size={20} /> : "Sign in with Google"}
        </Button>
      </Box>
    </Container>
  );
}
