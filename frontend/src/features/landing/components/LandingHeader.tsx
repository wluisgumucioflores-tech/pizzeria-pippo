import Image from "next/image";
import { buildWhatsAppGeneralLink } from "../constants/landing.constants";

const NAV_LINKS = [
  { href: "#inicio", label: "Inicio" },
  { href: "#pizzas", label: "Pizzas" },
  { href: "#ubicacion", label: "Ubicación" },
  { href: "#acerca", label: "Acerca de nosotros" },
];

interface Props {
  phone: string;
}

export function LandingHeader({ phone }: Props) {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#fcf9f8]/90 backdrop-blur-md border-b border-black/5">
      <nav className="max-w-6xl mx-auto flex justify-between items-center px-5 md:px-10 py-3">
        <a href="#inicio" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Pippo Pizza" width={40} height={40} className="rounded-full object-cover" />
          <span className="font-[var(--font-landing-heading)] font-extrabold text-lg text-[#b62409]">
            Pippo Pizza
          </span>
        </a>
        <ul className="hidden md:flex gap-8 items-center font-[var(--font-landing-body)] text-sm font-semibold text-[#5b403b]">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="hover:text-[#b62409] transition-colors">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href={buildWhatsAppGeneralLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#b62409] text-white font-[var(--font-landing-body)] font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-[#93000a] transition-colors"
        >
          Pedir por WhatsApp
        </a>
      </nav>
    </header>
  );
}
