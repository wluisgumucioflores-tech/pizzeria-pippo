import { redirect } from "next/navigation";

// La landing pública (src/features/landing/) queda sin usar por ahora, no
// borrada — no tiene sentido como página única en un contexto multitenant
// (es un solo negocio hardcodeado). "/" pasa a ser directo al login.
export default function RootPage() {
  redirect("/login");
}
