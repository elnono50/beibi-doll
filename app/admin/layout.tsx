import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s | Panel Beibi Doll" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
