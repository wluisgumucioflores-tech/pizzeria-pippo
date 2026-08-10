import Image from "next/image";
import { CONTACT_EMAIL, FACEBOOK_URL, TIKTOK_URL, toWhatsAppDigits } from "../constants/landing.constants";

interface Props {
  phone: string;
}

export function LandingFooter({ phone }: Props) {
  return (
    <footer className="bg-[#1c1b1b] text-white/70 py-10 px-5 md:px-10">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Pippo Pizza" width={32} height={32} className="rounded-full object-cover" />
          <span className="font-[var(--font-landing-heading)] font-bold text-white">Pippo Pizza</span>
        </div>
        <div className="font-[var(--font-landing-body)] text-sm text-center">
          <p>WhatsApp: +{toWhatsAppDigits(phone)} · {CONTACT_EMAIL}</p>
          <p className="mt-1">
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Facebook
            </a>
            {" · "}
            <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              TikTok
            </a>
          </p>
        </div>
        <p className="font-[var(--font-landing-body)] text-xs">© {new Date().getFullYear()} Pippo Pizza</p>
      </div>
    </footer>
  );
}
