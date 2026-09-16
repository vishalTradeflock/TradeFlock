import type { MagazineHonoree } from "@/lib/types";

const USA_JULY = "https://www.tradeflockusa.com/wp-content/uploads/2026/07";
const USA_AUG = "https://www.tradeflockusa.com/wp-content/uploads/2026/08";

export const HEALTHCARE_EDITION_SLUG = "10-best-healthcare-executives-transforming-2026";

export const HEALTHCARE_2026_HONOREES: MagazineHonoree[] = [
  {
    name: "Yann A. Meunier, MD",
    designation: "Director, International Institute of Medicine and Science",
    company: "International Institute of Medicine and Science",
    bio: "An international healthcare executive and physician with 25 years of experience spanning Europe, Asia, Africa, Oceania, and the Americas, he seamlessly bridges frontline tropical medicine with corporate health strategies. Having managed public health operations and served in roles ranging from primary care physician to Chief Medical Officer, he brings a breadth of experience that lends depth and authenticity to every endeavor.",
    photo_url: `${USA_JULY}/Yann-A.-Meunier-MD.webp`,
    page: 4,
    magazine_page: 4,
  },
  {
    name: "Dr. Amy Flaster",
    designation: "Chief Medical Officer, ConcertoCare",
    company: "ConcertoCare",
    bio: "With a profound expertise in internal medicine and senior care, Dr Amy Flaster from The Cigna Group serves as CMO. Her leadership at ConcertoCare has strengthened her ability to bridge traditional clinical practice with digital health innovation, offering a unique perspective on technology-driven, value-based, and integrated whole-person healthcare models.",
    photo_url: `${USA_JULY}/Dr.-Amy-Flaster.webp`,
    page: 6,
    magazine_page: 6,
  },
  {
    name: "Daniel Gandia",
    designation: "Senior Medical Director, Oncology, Fortrea",
    company: "Fortrea",
    bio: "Senior Medical Director at Fortrea with more than 30 years of experience in clinical oncology and pharmaceutical research, Daniel Gandia specializes in early-phase oncology trials and the evaluation of innovative drugs.",
    photo_url: `${USA_JULY}/Daniel-Gandia.webp`,
    slug: "daniel-gandia-10-best-healthcare-executives-transforming-2026",
    page: 8,
    magazine_page: 8,
  },
  {
    name: "Graham Rosenberg",
    designation: "Founder & CEO, Dentalcorp",
    company: "Dentalcorp",
    bio: "With a deep background in private equity and corporate finance, Graham Rosenberg, a CPA-trained founder and CEO of Dentalcorp, effectively bridges the gap between business scale and clinical autonomy. His innovative approach removes administrative burdens, allowing dentists to concentrate entirely on patient care.",
    photo_url: `${USA_JULY}/Graham-Rosenberg.webp`,
    page: 10,
    magazine_page: 10,
  },
  {
    name: "Jerry Creech",
    designation: "Chief Executive Officer",
    company: "Flip AI",
    bio: "Jerry Creech is known for leading strategic healthcare partnerships, drawing on over 20 years of operational and financial expertise to expand Flip’s purpose-built voice AI platform in the healthcare sector.",
    photo_url: `${USA_JULY}/Jerry-Creech.webp`,
    slug: "jerry-creech-10-best-healthcare-executives-transforming-2026",
    page: 12,
    magazine_page: 12,
  },
  {
    name: "Justine Paula Nichol",
    designation: "Managing Director",
    company: "Veiros Ltd.",
    bio: "Clinical doctoral candidate and Advanced Nurse Practitioner with senior leadership in pharmaceutical medical affairs, sales management, and training, Justine Paula Nichol brings deep therapeutic expertise across Oncology, Cardiovascular, and Respiratory sectors.",
    photo_url: `${USA_JULY}/Justine-Paula-Nichol.webp`,
    slug: "justine-paula-nichol-10-best-healthcare-executives-transforming-2026",
    page: 14,
    magazine_page: 14,
  },
  {
    name: "Charlotte Murphy",
    designation: "Healthcare Strategy Executive",
    bio: "Charlotte Murphy works with health systems on strategy, access, and care-delivery transformation, helping organizations turn clinical insight into durable operating models.",
    photo_url: `${USA_AUG}/Charlotte-Murphy.webp`,
    page: 16,
    magazine_page: 16,
  },
  {
    name: "Ken Peterson",
    designation: "Vice President of Clinical Operations",
    bio: "Ken Peterson focuses on clinical operations, care-team performance, and the systems that keep patient pathways moving from intake through follow-up.",
    photo_url: `${USA_AUG}/Ken-Peterson.webp`,
    page: 18,
    magazine_page: 18,
  },
  {
    name: "Juno Ramacha",
    designation: "Healthcare Innovation Leader",
    bio: "Juno Ramacha leads healthcare innovation work at the intersection of people, process, and technology, helping organizations adopt new models of care without losing the human core of the enterprise.",
    photo_url: `${USA_AUG}/Juno-Ramacha.webp`,
    page: 20,
    magazine_page: 20,
  },
  {
    name: "Victoria Tzareva",
    designation: "Senior Director, Health Systems",
    bio: "Victoria Tzareva partners with health systems on operating discipline, capital, and scale, building the financial and organizational foundation that lets clinical programs grow.",
    photo_url: `${USA_AUG}/Victoria-Tzareva.webp`,
    page: 22,
    magazine_page: 22,
  },
];

export const SEED_ISSUE_HONOREES: Record<string, MagazineHonoree[]> = {
  [HEALTHCARE_EDITION_SLUG]: HEALTHCARE_2026_HONOREES,
};
