import type { Metadata } from "next";
import PrivacyNotice from "@/components/PrivacyNotice";

export const metadata: Metadata = { title: "Privacidade | AgroSat" };

export default function Page() {
  return <PrivacyNotice />;
}
