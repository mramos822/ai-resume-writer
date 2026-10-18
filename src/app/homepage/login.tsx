"use client";

import { useAuth } from "@/context/authContext";
import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { LoginForm } from "@/components/forms/loginForm";
import { XIcon } from "lucide-react";
import { useT } from "@/i18n/provider";

interface LoginProps {
  onClose: () => void;
}

export default function Login({ onClose }: LoginProps) {
  const { tr } = useT();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/home");
    }
  }, [user, loading, router]);

  if (loading) {
    return null;
  }

  return (
    <div className="absolute right-4 top-16 z-50">
      <div className="login-popover bg-white border border-gray-200 rounded-lg shadow-lg w-80 p-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label={tr("Close")}
        >
          <XIcon className="w-5 h-5" />
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-4">{tr("Sign In")}</h1>

        {/* NO onForgotPassword */}
        <LoginForm
          onLogin={() => router.push("/home")}
        />

        <p className="text-sm text-gray-600 mt-4 text-center">{tr("Need help or want to create an account?")}{" "}
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/home");
            }}
            className="text-blue-500 hover:underline"
          >{tr("More options")}</button>
        </p>
      </div>
    </div>
  );
}
