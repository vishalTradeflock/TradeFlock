-- Magazine-owned honoree directory (JSON), used when articles are incomplete.

alter table public.magazines
  add column if not exists honorees jsonb not null default '[]'::jsonb;

update public.magazines
   set honorees = $honorees$
[
  {
    "name": "Yann A. Meunier, MD",
    "designation": "Director",
    "company": "International Institute of Medicine and Science and Former CEO of Health Connect International, LLC",
    "bio": "An international healthcare executive and physician with 25 years of experience spanning Europe, Asia, Africa, Oceania, and the Americas, he seamlessly bridges frontline tropical medicine with corporate health strategies. Having managed public health operations and served in roles ranging from primary care physician to Chief Medical Officer, he brings a breadth of experience that lends depth and authenticity to every endeavor.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Yann-A.-Meunier-MD.webp",
    "page": 4
  },
  {
    "name": "Dr. Amy Flaster",
    "designation": "Chief Medical Officer",
    "company": "Cigna Healthcare",
    "bio": "With a profound expertise in internal medicine and senior care, Dr Amy Flaster from The Cigna Group serves as CMO. Her leadership at ConcertoCare has strengthened her ability to bridge traditional clinical practice with digital health innovation, offering a unique perspective on technology-driven, value-based, and integrated whole-person healthcare models.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Dr.-Amy-Flaster.webp",
    "page": 6
  },
  {
    "name": "Daniel Gandia",
    "designation": "Senior Medical Director, Oncology",
    "company": "Fortrea",
    "bio": "Senior Medical Director at Fortrea with more than 30 years of experience in clinical oncology and pharmaceutical research, Daniel Gandia specializes in early-phase oncology trials and the evaluation of innovative drugs. Pioneered the European Phase I development of Irinotecan, known for identifying its acute cholinergic syndrome and establishing the high-dose loperamide protocol for managing delayed diarrhea.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Daniel-Gandia.webp",
    "slug": "daniel-gandia-10-best-healthcare-executives-transforming-2026",
    "page": 8
  },
  {
    "name": "Graham Rosenberg",
    "designation": "Founder & CEO",
    "company": "Dentalcorp",
    "bio": "With a deep background in private equity and corporate finance, Graham Rosenberg, a CPA-trained founder and CEO of Dentalcorp, effectively bridges the gap between business scale and clinical autonomy. His innovative approach removes administrative burdens, allowing dentists to concentrate entirely on patient care.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Graham-Rosenberg.webp",
    "page": 10
  },
  {
    "name": "Jerry Creech",
    "designation": "SVP",
    "company": "Flip AI",
    "bio": "Jerry Creech is known for leading strategic healthcare partnerships, drawing on over 20 years of operational and financial expertise to expand Flip’s purpose-built voice AI platform in the healthcare sector. This innovative technology is designed to address common phone-based administrative challenges, recover lost revenue associated with missed patient interactions, and reduce operational costs.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Jerry-Creech.webp",
    "slug": "jerry-creech-10-best-healthcare-executives-transforming-2026",
    "page": 12
  },
  {
    "name": "John Rim",
    "designation": "Board Chair & CEO",
    "company": "Samsung Biologics",
    "bio": "With over 30 years of premier global biopharma expertise stemming from Roche and Genentech, John Rim plays a vital role at Samsung Biologics. His expertise in large-scale biopharmaceutical manufacturing helps address the industry’s manufacturing capacity gap.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/John-Rim.webp",
    "page": 14
  },
  {
    "name": "Justine Paula Nichol",
    "designation": "Clinical Director",
    "company": "Veiros Ltd.",
    "bio": "Clinical doctoral candidate and Advanced Nurse Practitioner with senior leadership in pharmaceutical medical affairs, sales management, and training, Justine Paula Nichol brings deep therapeutic expertise across Oncology, Cardiovascular, and Respiratory sectors.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Justine-Paula-Nichol.webp",
    "slug": "justine-paula-nichol-10-best-healthcare-executives-transforming-2026",
    "page": 16
  },
  {
    "name": "Dr. Majid Al-Fayyadh",
    "designation": "CEO",
    "company": "King Faisal Specialist Hospital and Research Centre (KFSHRC)",
    "bio": "With a passion for advancing pediatric cardiology and electrophysiology, Dr Majid Al-Fayyadh, CEO of KFSHRC, combines his medical expertise with a Master’s in Medical Management. He brings extensive experience in clinical practice and policy advisory roles to actively foster innovation in biotechnology and institutional development.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Dr.-Majid-Al-Fayyadh.webp",
    "page": 18
  },
  {
    "name": "Robert J. White",
    "designation": "President & CEO",
    "company": "Olympus Corporation",
    "bio": "With over 30 years of leadership experience spanning Asia, Europe, and the US, Robert J. White, President and CEO of Olympus, brings a deep understanding of global healthcare and technology. His commitment to building diverse, high-performing teams is matched by a disciplined approach to execution, focused on addressing evolving clinical challenges.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Robert-J.-White.webp",
    "page": 20
  },
  {
    "name": "Sonya Lockyer",
    "designation": "President & CEO",
    "company": "Lifemark Health Group",
    "bio": "From humble beginnings in rural Newfoundland to serving in the military, the President & CEO of Lifemark Health Group has been shaped by leadership. She champions a bold mission, “Movement to a better life”, focused on building Canada’s Connected Health Network.",
    "photo_url": "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Sonya-Lockyer.webp",
    "page": 22
  }
]
$honorees$::jsonb
 where slug = '10-best-healthcare-executives-transforming-2026'
   and (honorees is null or honorees = '[]'::jsonb);

notify pgrst, 'reload schema';
