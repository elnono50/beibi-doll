import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { isDemo } from "@/lib/config";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="login">
      <LoginForm demo={isDemo} />
    </main>
  );
}
