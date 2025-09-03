import { LoginForm } from "@/components/login-form";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState, type FormEventHandler } from "react";
import { useNavigate, useLocation } from "react-router";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, login, error: authError } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state;
  const from = state?.from?.pathname || "/";

  // Navigate when user is authenticated (handles login success AND already logged in)
  useEffect(() => {
    if (user) {
      console.log("🔍 User is authenticated, navigating to:", from);
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    console.log("🔍 Form submission started");
    e.preventDefault();
    e.stopPropagation();

    const formData = new FormData(e.currentTarget);
    const credentials = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    console.log("🔍 Credentials:", credentials);
    setIsSubmitting(true);

    try {
      console.log("🔍 About to call login...");
      await login(credentials);
      console.log("✅ Login call completed successfully");
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err) {
      console.error("❌ Login failed:", err);
    } finally {
      console.log("🔍 Finally block - setting isSubmitting to false");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="text-primary flex size-6 items-center justify-center rounded-md">
              <svg
                width="393"
                height="393"
                viewBox="0 0 393 393"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M196.5 0C305.024 0 393 87.976 393 196.5C393 305.024 305.024 393 196.5 393C87.976 393 0 305.024 0 196.5C0 87.976 87.976 0 196.5 0ZM196.5 30C109.089 30 37.4139 97.3582 30.542 183H195.101C194.602 176.866 192.962 172 190.764 168.08C187.175 161.68 181.392 156.558 173.765 152.586C165.796 148.436 156.436 145.879 147.201 144.502C141.483 153.799 131.216 160 119.5 160C101.551 160 87 145.449 87 127.5C87 109.551 101.551 95 119.5 95C133.237 95 144.983 103.522 149.74 115.568C162.19 117.267 175.368 120.723 187.16 126.864C198.478 132.759 209.064 141.425 216.058 153.896C220.827 162.401 223.608 172.119 224.153 183H285.463C290.493 173.485 300.488 167 312 167C328.569 167 342 180.431 342 197C342 213.569 328.569 227 312 227C300.488 227 290.493 220.515 285.463 211H222.54C222.591 229.464 229.897 240.793 238.609 248.105C243.789 252.452 249.802 255.633 255.808 257.854C260.366 253.019 266.83 250 274 250C287.807 250 299 261.193 299 275C299 288.807 287.807 300 274 300C264.614 300 256.438 294.827 252.163 287.178C241.385 284.018 229.937 278.688 219.966 270.319C204.474 257.317 193.608 237.822 193.546 211H30.624C37.9713 296.166 109.43 363 196.5 363C288.455 363 363 288.455 363 196.5C363 104.545 288.455 30 196.5 30Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            Tether
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block"></div>
    </div>
  );
}

export default LoginPage;
