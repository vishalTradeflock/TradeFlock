import type { MagazineHonoree } from "@/lib/types";

const PHOTO = "https://www.tradeflockusa.com/wp-content/uploads/2026/07";

export const HEALTHCARE_2026_HONOREES: MagazineHonoree[] = [
  {
    name: "Yann A. Meunier, MD",
    designation: "Director - International Institute of Medicine and Science",
    company: "Health Connect International, LLC",
    bio: "An international healthcare executive and physician with 25 years of experience spanning Europe, Asia, Africa, Oceania, and the Americas, he seamlessly bridges frontline tropical medicine with corporate health strategies. Having managed public health operations and served in roles ranging from primary care physician to Chief Medical Officer, he brings a breadth of experience that lends depth and authenticity to every endeavor.",
    photo_url: `${PHOTO}/Yann-A.-Meunier-MD.webp`,
    page: 4,
    magazine_page: 4,
  },
  {
    name: "Dr. Amy Flaster",
    designation: "Chief Medical Officer, ConcertoCare",
    company: "Cigna Healthcare",
    bio: "With a profound expertise in internal medicine and senior care, Dr Amy Flaster from The Cigna Group serves as CMO. Her leadership at ConcertoCare has strengthened her ability to bridge traditional clinical practice with digital health innovation, offering a unique perspective on technology-driven, value-based, and integrated whole-person healthcare models.",
    photo_url: `${PHOTO}/Dr.-Amy-Flaster.webp`,
    page: 6,
    magazine_page: 6,
  },
  {
    name: "Daniel Gandia",
    designation: "Senior Medical Director, Oncology, Fortrea",
    company: "Fortrea",
    bio: "Senior Medical Director at Fortrea with more than 30 years of experience in clinical oncology and pharmaceutical research, Daniel Gandia specializes in early-phase oncology trials and the evaluation of innovative drugs.",
    photo_url: `${PHOTO}/Daniel-Gandia.webp`,
    slug: "daniel-gandia-10-best-healthcare-executives-transforming-2026",
    page: 8,
    magazine_page: 8,
  },
  {
    name: "Graham Rosenberg",
    designation: "Founder & CEO, Dentalcorp",
    company: "Dentalcorp",
    bio: "With a deep background in private equity and corporate finance, Graham Rosenberg, a CPA-trained founder and CEO of Dentalcorp, effectively bridges the gap between business scale and clinical autonomy. His innovative approach removes administrative burdens, allowing dentists to concentrate entirely on patient care.",
    photo_url: `${PHOTO}/Graham-Rosenberg.webp`,
    page: 10,
    magazine_page: 10,
  },
  {
    name: "Jerry Creech",
    designation: "Healthcare Executive",
    company: "Flip AI",
    bio: "Jerry Creech is known for leading strategic healthcare partnerships, drawing on over 20 years of operational and financial expertise to expand Flip’s purpose-built voice AI platform in the healthcare sector.",
    photo_url: `${PHOTO}/Jerry-Creech.webp`,
    slug: "jerry-creech-10-best-healthcare-executives-transforming-2026",
    page: 12,
    magazine_page: 12,
  },
  {
    name: "Justine Paula Nichol",
    designation: "Managing Director",
    company: "Veiros Ltd.",
    bio: "Clinical doctoral candidate and Advanced Nurse Practitioner with senior leadership in pharmaceutical medical affairs, sales management, and training, Justine Paula Nichol brings deep therapeutic expertise across Oncology, Cardiovascular, and Respiratory sectors.",
    photo_url: `${PHOTO}/Justine-Paula-Nichol.webp`,
    slug: "justine-paula-nichol-10-best-healthcare-executives-transforming-2026",
    page: 14,
    magazine_page: 14,
  },
  {
    name: "John Rim",
    designation: "Board Chair & CEO, Samsung Biologics",
    company: "Samsung Biologics",
    bio: "With over 30 years of premier global biopharma expertise stemming from Roche and Genentech, John Rim plays a vital role at Samsung Biologics, helping close the industry’s manufacturing capacity gap.",
    photo_url: `${PHOTO}/John-Rim.webp`,
    page: 16,
    magazine_page: 16,
  },
  {
    name: "Dr. Majid Al-Fayyadh",
    designation: "CEO, King Faisal Specialist Hospital and Research Centre",
    company: "KFSHRC",
    bio: "Dr Majid Al-Fayyadh, CEO of KFSHRC, combines pediatric cardiology expertise with a Master’s in Medical Management and a mandate to foster biotechnology innovation aligned with Saudi Vision 2030.",
    photo_url: `${PHOTO}/Dr.-Majid-Al-Fayyadh.webp`,
    page: 18,
    magazine_page: 18,
  },
  {
    name: "Robert J. White",
    designation: "President & CEO, Olympus Corporation",
    company: "Olympus Corporation",
    bio: "With over 30 years of leadership spanning Asia, Europe, and the US, Robert J. White brings a disciplined, global approach to clinical technology and high-performing teams.",
    photo_url: `${PHOTO}/Robert-J.-White.webp`,
    page: 20,
    magazine_page: 20,
  },
  {
    name: "Sonya Lockyer",
    designation: "President & CEO, Lifemark Health Group",
    company: "Lifemark Health Group",
    bio: "The President & CEO of Lifemark Health Group champions “Movement to a better life,” building Canada’s Connected Health Network and expanding access to compassionate care.",
    photo_url: `${PHOTO}/Sonya-Lockyer.webp`,
    page: 22,
    magazine_page: 22,
  },
];

export const SEED_ISSUE_HONOREES: Record<string, MagazineHonoree[]> = {
  "10-best-healthcare-executives-transforming-2026": HEALTHCARE_2026_HONOREES,
};

export const HEALTHCARE_EDITION_SLUG = "10-best-healthcare-executives-transforming-2026";
