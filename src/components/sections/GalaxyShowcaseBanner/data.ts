/**
 * Featured Products Data - Quioscos (sin categoría IM)
 * TODO: Actualizar imágenes de Cloudinary con productos reales de AV/DA/IT
 */

import { FeaturedProduct } from "./types";

export const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    id: 1,
    title: "Neo QLED 4K",
    image:
      "https://res.cloudinary.com/dqsdl9bwv/image/upload/v1759808851/SM-S731BLBKZTO_PC_MO_560x560_eceier.avif",
    href: "/productos/televisores-y-av",
  },
  {
    id: 2,
    title: "Nevera Bespoke AI",
    image:
      "https://res.cloudinary.com/dqsdl9bwv/image/upload/v1759808911/SM-F766BDBJCOO_560x560_zyuipj.avif",
    href: "/productos/electrodomesticos?seccion=neveras",
  },
  {
    id: 3,
    title: "Lavadora AI Ecobubble",
    image:
      "https://res.cloudinary.com/dqsdl9bwv/image/upload/v1759808953/SM-X730NZAHCOO_560x560_olsxrr.avif",
    href: "/productos/electrodomesticos?seccion=lavadoreas-y-secadoras",
  },
  {
    id: 4,
    title: "Monitor Gaming Odyssey",
    image:
      "https://res.cloudinary.com/dqsdl9bwv/image/upload/v1759809004/HOME_Feature-Card_Watch8-Classic_560x560_jrkmrq.avif",
    href: "/productos/monitores",
  },
];
