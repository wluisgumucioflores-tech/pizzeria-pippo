import Image from "next/image";
import { buildWhatsAppOrderLink, WHATSAPP_NUMBER } from "../constants/landing.constants";
import type { PublicPizza, PublicBranch } from "../types/landing.types";

function PizzaCard({ pizza, branches }: { pizza: PublicPizza; branches: PublicBranch[] }) {
  const branchesWithPhone = branches.filter((b): b is PublicBranch & { phone: string } => Boolean(b.phone));
  const showBranchName = branchesWithPhone.length > 1;

  return (
    <article className="h-full flex flex-col bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <Image
        src={pizza.image_url || "/landing/default.jpg"}
        alt={pizza.name}
        width={400}
        height={240}
        unoptimized
        className="w-full h-40 object-cover"
      />
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-[var(--font-landing-heading)] font-bold text-lg text-[#1c1b1b] mb-1">{pizza.name}</h3>
        {pizza.description && (
          <p className="font-[var(--font-landing-body)] text-sm text-[#5b403b] mb-3">{pizza.description}</p>
        )}
        {pizza.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {pizza.sizes.map((size) => (
              <span
                key={size}
                className="font-[var(--font-landing-body)] text-xs font-semibold text-[#8e1400] bg-[#ffdad3] px-2.5 py-1 rounded-full"
              >
                {size}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          {branchesWithPhone.length > 0 ? (
            branchesWithPhone.map((branch) => (
              <a
                key={branch.id}
                href={buildWhatsAppOrderLink(pizza.name, branch.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-[#1c1b1b] text-white font-[var(--font-landing-body)] font-semibold text-sm py-2.5 rounded-xl hover:bg-[#b62409] transition-colors"
              >
                {showBranchName ? `Pedir por WhatsApp — ${branch.name}` : "Pedir por WhatsApp"}
              </a>
            ))
          ) : (
            <a
              href={buildWhatsAppOrderLink(pizza.name, WHATSAPP_NUMBER)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-[#1c1b1b] text-white font-[var(--font-landing-body)] font-semibold text-sm py-2.5 rounded-xl hover:bg-[#b62409] transition-colors"
            >
              Pedir por WhatsApp
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

interface Props {
  pizzas: PublicPizza[];
  loading: boolean;
  branches: PublicBranch[];
}

export function PizzaSection({ pizzas, loading, branches }: Props) {
  return (
    <section id="pizzas" className="py-20 px-5 md:px-10 bg-[#f6f0ee]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-[var(--font-landing-heading)] font-bold text-3xl text-[#1c1b1b] mb-3">Nuestras pizzas</h2>
          <p className="font-[var(--font-landing-body)] text-[#5b403b]">Elegí la tuya y pedila directo por WhatsApp.</p>
        </div>
        {loading ? (
          <p className="text-center font-[var(--font-landing-body)] text-[#5b403b]">Cargando el menú...</p>
        ) : pizzas.length === 0 ? (
          <p className="text-center font-[var(--font-landing-body)] text-[#5b403b]">
            No hay pizzas disponibles en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {pizzas.map((pizza) => (
              <PizzaCard key={pizza.id} pizza={pizza} branches={branches} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
