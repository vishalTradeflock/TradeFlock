import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type CategoryRow = { id: string; slug: string; name: string };
type AuthorRow = { id: string; slug: string; name: string };

type Story = {
  categorySlug: string;
  authorSlug: string;
  title: string;
  dek: string;
  excerpt: string;
  paragraphs: [string, string, string];
  imageAlt: string;
};

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const text = readFileSync(envPath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

function shortHash() {
  return Math.random().toString(36).slice(2, 8);
}

const IMAGES = [
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526304640173-94cb2232017e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b973223fbd?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1497436072909-60f360e1d4b0?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80",
];

const CATEGORIES = [
  {
    name: "Tech",
    slug: "tech",
    description: "Silicon Valley, semiconductors, cloud, and the platforms that run the economy.",
  },
  {
    name: "Markets",
    slug: "markets",
    description: "Equities, rates, commodities, and the tape that moves boardrooms.",
  },
  {
    name: "Finance",
    slug: "finance",
    description: "Banking, private credit, regulation, and the plumbing of American capital.",
  },
  {
    name: "Leadership",
    slug: "leadership",
    description: "CEOs, boards, labor, and the people who set corporate direction.",
  },
  {
    name: "AI & Chips",
    slug: "ai-chips",
    description: "Foundries, lithography, accelerators, and the AI hardware race.",
  },
  {
    name: "Energy",
    slug: "energy",
    description: "Power markets, grids, nuclear, and the energy bill for data centers.",
  },
];

const AUTHORS = [
  {
    name: "James Whitaker",
    slug: "james-whitaker",
    title: "Technology Editor",
    bio: "Reports on semiconductors, cloud infrastructure, and the industrial politics of AI.",
  },
  {
    name: "Elena Vasquez",
    slug: "elena-vasquez",
    title: "Senior Markets Correspondent",
    bio: "Covers Treasuries, the dollar, and the policy signals that reprice risk assets.",
  },
  {
    name: "Priya Nair",
    slug: "priya-nair",
    title: "Finance Reporter",
    bio: "Writes on banks, private credit, and the regulatory perimeter around nonbank lenders.",
  },
  {
    name: "Marcus Vance",
    slug: "marcus-vance",
    title: "Leadership & Policy Correspondent",
    bio: "Follows Fortune 500 succession, boards, and the labor bargains reshaping corporate America.",
  },
  {
    name: "David Chen",
    slug: "david-chen",
    title: "Energy and Infrastructure Correspondent",
    bio: "Covers power markets, nuclear restarts, and the grid constraints around AI campuses.",
  },
];

const STORIES: Story[] = [
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "ASML's High-NA queue stretches into 2028 as U.S. logic fabs bid for scarce tools",
    dek: "The lithography bottleneck is no longer a rumor. It is a delivery calendar.",
    excerpt:
      "U.S. logic customers are locking multi-year High-NA EUV slots as ASML warns that service crews, not just scanners, now set the pace of the advanced-node race.",
    paragraphs: [
      "SAN JOSE, Calif. — Chipmakers racing toward 2-nanometer-class logic are discovering that the scarce asset is not a design library or a GPU allocation. It is calendar time on ASML's High-NA EUV tools, and the queue now stretches into 2028 for several U.S. customers.",
      "Two supplier executives said installation crews, not factory floors, have become the binding constraint. Each High-NA scanner requires a specialized team that can spend months aligning optics after the crate lands. That labor pool does not grow as fast as capital budgets in Arizona, Texas, and New York.",
      "The commercial implication is blunt. Foundries that miss a slot do not merely delay a process node; they delay the entire AI accelerator tape-out that their hyperscale customers have already booked as 2027 revenue. Procurement teams are treating lithography reservations the way airlines treat takeoff slots: hoard them, trade them, and never let them go unused.",
    ],
    imageAlt: "Semiconductor cleanroom equipment",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "TSMC's Arizona ramp hinges on specialty chemicals, not just concrete and visas",
    dek: "A fab is a chemistry plant that happens to print transistors.",
    excerpt:
      "Phoenix's advanced-node build is running into a quieter bottleneck: photoresists, gases, and the domestic plants that have to qualify them before wafers can move.",
    paragraphs: [
      "PHOENIX — TSMC's Arizona campus has become a national-industrial talking point. The operational story is smaller and more chemical. Photoresists, ultra-pure gases, and wet-process chemicals still travel long routes, and U.S. qualification clocks are measured in quarters, not press releases.",
      "Plant managers at two specialty-chemical firms said they are adding U.S. capacity specifically for the Arizona line, but customer audits remain the long pole. A drum that is acceptable in Tainan is not automatically acceptable in Phoenix. The paperwork is the product.",
      "That is why the next earnings tell may not be wafer starts. It will be whether a handful of mid-cap chemical suppliers report their first meaningful U.S. volume. If those shipments slip, the most expensive buildings in the desert will wait on liquids.",
    ],
    imageAlt: "Industrial cleanroom corridor",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "Advanced packaging, not the GPU die, is the new limiter for AI accelerators",
    dek: "CoWoS capacity has become a second foundry war.",
    excerpt:
      "Hyperscalers are discovering that an allocated HBM stack and a finished GPU die still sit idle if the packaging line is booked out two quarters.",
    paragraphs: [
      "HSINCHU, Taiwan — The AI hardware shortage has a new address. It is not only the leading-edge wafer. It is the advanced packaging line that stitches high-bandwidth memory to a logic die, and those lines are booked as tightly as any EUV bay.",
      "Packaging houses said customers are now dual-sourcing interposers and quoting 2026 capacity as if it were a commodity future. A missed CoWoS window can strand a GPU that already cost tens of thousands of dollars to fabricate.",
      "Design teams are responding by simplifying stacks and accepting slightly lower bandwidth rather than missing a cloud-launch window. The market is pricing packaging vendors like mini-foundries, because for this cycle they are.",
    ],
    imageAlt: "Close-up of semiconductor wafer processing",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "HBM allocations become a board-level item as memory makers ration 2026 output",
    dek: "High-bandwidth memory is being treated like a strategic metal.",
    excerpt:
      "SK Hynix, Samsung, and Micron are allocating 2026 HBM like a scarce feedstock, forcing AI-chip customers to bring CFOs into every memory meeting.",
    paragraphs: [
      "SEOUL — Memory executives used to brief product managers. This quarter they are briefing boards. High-bandwidth memory for AI accelerators is being allocated in tightly written 2026 contracts, with take-or-pay language that looks more like LNG than DRAM.",
      "Buyers said the conversation has shifted from price per gigabyte to guaranteed stacked-die supply. A hyperscaler that under-orders now risks a 2027 training cluster that cannot be populated. Over-ordering ties up cash in a part that has few alternative uses.",
      "That rationing is already showing up in accelerator road maps. Some chip designers are delaying wider memory buses not because the controller is late, but because the stacks they were promised have been reassigned to a larger customer.",
    ],
    imageAlt: "Memory and server hardware close-up",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "david-chen",
    title: "Dutch export licenses, not engineering, now set the tempo for China-bound tools",
    dek: "The paperwork has become the product cycle.",
    excerpt:
      "Equipment makers say allied-fab demand is firm, but the weekly cadence of export licenses is doing more to shape order books than any new process node.",
    paragraphs: [
      "THE HAGUE — Semiconductor equipment executives have a new ritual: they check license dockets before they check factory yields. Tools bound for Japan, South Korea, and the Netherlands are moving. Tools that might have a China nexus wait.",
      "Two unnamed supplier executives said order books firmed after customers locked multi-year slots for lithography and deposition gear. No dollar total was disclosed. What was disclosed, in tone if not in tables, is that allied demand is real and the China question is a legal one.",
      "Investors who still model this industry as a simple capex cycle are missing the administrative layer. A denied license does not show up as a cancelled purchase order on day one. It shows up as a tool that sits in inventory while lawyers argue about end use.",
    ],
    imageAlt: "Precision manufacturing floor",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "Intel's 18A customers want process data, not slogans, before they tape out",
    dek: "Foundry trust is earned in yield slides.",
    excerpt:
      "Potential 18A customers are asking for defect-density histories and multi-quarter yield bands before they move a single high-volume chip off TSMC.",
    paragraphs: [
      "HILLSBORO, Ore. — Intel's foundry pitch has matured from a national-strategy speech into a data room. Prospective 18A customers want defect densities, via yields, and a boring calendar of process-of-record freezes. They have heard the slogans.",
      "A senior designer at a U.S. fabless firm said the question is no longer whether Intel can print a transistor. It is whether Intel can print the same transistor 50 million times a week without a surprise excursion that wrecks a product ramp.",
      "That standard is brutal and fair. TSMC won the last decade by being dull in the best sense. Intel will win back volume only when its weekly yield reports look equally dull.",
    ],
    imageAlt: "Chip fabrication plant exterior",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "EUV pellicles and mask shops emerge as the unglamorous chokepoint",
    dek: "Photomasks do not trend on earnings calls. They cancel them.",
    excerpt:
      "A shortage of high-end mask-writing capacity and EUV pellicles is stretching tape-out calendars even at customers who already have scanner time reserved.",
    paragraphs: [
      "SANTA CLARA, Calif. — The industry can talk for hours about EUV scanners and still trip over a pellicle. Mask shops that write the most advanced layers are as congested as any lithography bay, and a late reticle can idle a tool that costs more than a regional airport.",
      "Vendors said customers are now ordering safety-stock masks for critical layers, a practice that would have looked wasteful two years ago. The alternative is missing a GPU or networking-chip launch because one layer could not be written in time.",
      "This is the part of the semiconductor story that rarely makes a keynote. It is also the part that decides whether a design team's 18-month effort becomes a product or a postmortem.",
    ],
    imageAlt: "Laboratory optics and cleanroom tools",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "james-whitaker",
    title: "U.S. equipment makers report a jump in allied-fab export licenses",
    dek: "Allied demand is showing up in the license log before it shows up in the 10-K.",
    excerpt:
      "Commerce briefings and supplier checks point to a rise in licenses for lithography, deposition, and etch tools bound for Japan, the Netherlands, and South Korea.",
    paragraphs: [
      "WASHINGTON — Commerce officials said licenses for lithography tools and deposition gear bound for Japan, the Netherlands, and South Korea rose in the latest quarter. Two unnamed supplier executives said order books firmed after customers locked multi-year tool slots.",
      "No dollar total was disclosed. Rival Chinese toolmakers were not named in the briefing. The signal that mattered to public-market investors was simpler: allied fabs are still buying, and they are buying with paperwork that clears.",
      "For U.S. equipment names, that is the difference between a narrative about export controls and a narrative about backlog. The first is political. The second prints revenue.",
    ],
    imageAlt: "Circuit board under inspection lighting",
  },
  {
    categorySlug: "ai-chips",
    authorSlug: "david-chen",
    title: "Silicon carbide lines stay sold out as EV and grid inverters compete for wafers",
    dek: "Power chips are having their own allocation fight.",
    excerpt:
      "SiC wafer makers say auto and data-center inverter customers are now competing for the same 2026 lots, keeping specialty fabs at allocation even as EV headlines cool.",
    paragraphs: [
      "DURHAM, N.C. — The electric-vehicle slowdown did not free the silicon-carbide line. Grid-scale inverters and AI-campus power shelves absorbed the slack, and wafer suppliers said 2026 lots are still allocated.",
      "Auto purchasing managers who expected to renegotiate from a position of weakness found data-center customers willing to take the wafers instead. That is a new kind of competition in a market that used to have one dominant end market.",
      "The investment case for SiC has therefore split. It is no longer a pure EV-penetration story. It is a power-electronics story that happens to include cars, substations, and the unglamorous shelves that keep GPUs from brownout.",
    ],
    imageAlt: "Power electronics manufacturing",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Amazon, Microsoft, and Google lock multi-year GPU campuses before power arrives",
    dek: "The cluster is sold. The substation is not.",
    excerpt:
      "Hyperscalers are signing accelerator and land deals years ahead of interconnection, turning AI capex into a real-estate and power-queue problem.",
    paragraphs: [
      "SEATTLE — The three largest cloud companies are behaving like developers who pre-lease a tower before the elevator shaft is poured. GPU campuses are being contracted against power interconnection dates that sit two and three years out.",
      "Finance chiefs said the alternative — waiting for a firm megawatt date before ordering accelerators — is worse, because the accelerators themselves have queues. Capital is being asked to sit in land, deposits, and long-lead electrical gear.",
      "That is why cloud capex guidance keeps surprising to the upside even when utilization on last year's clusters looks merely fine. The spend is not about last year's model. It is about not missing 2028.",
    ],
    imageAlt: "Data center server racks",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Enterprise AI budgets shift from pilots to reserved cloud capacity",
    dek: "The proof-of-concept era is ending in procurement.",
    excerpt:
      "CIOs at large U.S. firms are converting scattered model pilots into reserved GPU and token contracts, a quieter but larger second wave of AI spending.",
    paragraphs: [
      "NEW YORK — The first year of generative AI in the enterprise was a thousand demos. The second is a line item. CIOs said they are consolidating vendor sprawl into two or three cloud contracts with reserved capacity, because on-demand inference has become a budget surprise.",
      "That shift favors the hyperscalers that can promise both a model catalog and a power-backed cluster. It punishes startups that sold a clever wrapper without a capacity story.",
      "Consultants who made a living standing up pilots are being asked a harder question: which workflows survive a 2026 budget review. The ones that do will look less like magic and more like a unit-cost spreadsheet.",
    ],
    imageAlt: "Office workers at multiple monitors",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Microsoft's AI capex is now a power-purchase story as much as a GPU story",
    dek: "Azure's constraint is increasingly measured in megawatts.",
    excerpt:
      "Microsoft is pairing accelerator orders with long-dated electricity contracts, a sign that cloud growth is being gated by interconnects rather than software demand.",
    paragraphs: [
      "REDMOND, Wash. — Microsoft's latest capacity plan reads like an energy filing. Alongside GPU purchase commitments, the company is stacking power-purchase agreements and behind-the-meter deals that would have looked exotic on a software-company slide five years ago.",
      "Azure customers already feel the result as region-level GPU scarcity. Product managers can ship a model. They cannot ship a region that does not have a substation date.",
      "Investors who still treat Microsoft as a high-margin software residual are being asked to underwrite an industrial build. The stock can handle that if utilization arrives. It cannot handle stranded campuses.",
    ],
    imageAlt: "Cloud infrastructure hallway of servers",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Oracle's AI cloud wins force a rethink of who counts as a hyperscaler",
    dek: "Reserved clusters are minting a fourth cloud in practice.",
    excerpt:
      "Large training customers are signing multi-year Oracle GPU contracts, pulling a one-time database company into the same capex conversation as Amazon and Microsoft.",
    paragraphs: [
      "AUSTIN, Texas — Oracle's cloud story used to be a conversion narrative: move the database, keep the customer. It is now a cluster narrative. Training customers that could not get timely capacity elsewhere are signing multi-year GPU reservations.",
      "That does not make Oracle Amazon. It does make Oracle a swing producer of AI compute, which is enough to change how software multiples get argued on earnings calls.",
      "The risk is concentration. A handful of huge training deals can flatter revenue and still leave the company exposed if those customers build their own campuses two years later. The next test is renewal, not announcement.",
    ],
    imageAlt: "Server room with blue lighting",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Networking silicon, not GPUs, is the hidden bill in every AI cluster",
    dek: "A rack that cannot talk is a very expensive space heater.",
    excerpt:
      "InfiniBand, Ethernet, and optical vendors are seeing order books swell as customers discover that scale-out fabrics now rival accelerator spend.",
    paragraphs: [
      "SANTA CLARA, Calif. — The public conversation about AI hardware still begins and ends with the GPU. The private conversation begins with the switch. Scale-out training jobs die in the fabric long before they die in the math.",
      "Networking vendors said customers who under-bought optics last year are over-correcting this year, pulling in 800G and 1.6T ports on timelines that would have seemed reckless in the last cloud cycle.",
      "That spend does not photograph well. It also does not go away when a cheaper accelerator arrives. Every new chip generation still has to move gradients across a hall.",
    ],
    imageAlt: "Network cables in a data center",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "On-device inference keeps Apple suppliers in an AI cycle Wall Street still underweights",
    dek: "Not every model has to live in a rented cluster.",
    excerpt:
      "Memory and custom-silicon suppliers to Apple say 2026 builds assume thicker on-device models, a quieter AI cycle than the GPU campus boom.",
    paragraphs: [
      "CUPERTINO, Calif. — Apple's on-device intelligence stack is less a consumer spectacle than a procurement memo. Memory makers and the mid-tier firms that assemble camera and sensor modules are being asked to ship parts that run hotter, store more, and fail less.",
      "The strategic bet is familiar: keep inference close to the user. What is new is the bill of materials. Executives at two suppliers said 2026 volume guidance now assumes higher-density NAND and a thicker mix of Apple-designed co-processors.",
      "Wall Street still treats Apple's AI story as a services attach-rate question. The more immediate tell is in the supplier base — who gets a larger wafer allocation, and who is told that last year's forecast was a ceiling.",
    ],
    imageAlt: "Consumer electronics manufacturing line",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Sovereign AI clouds in Europe bid against U.S. hyperscalers for the same racks",
    dek: "Industrial policy is showing up as a purchase order.",
    excerpt:
      "National AI cloud projects in Europe are competing with U.S. hyperscalers for accelerators, generators, and the contractors who know how to stand them up.",
    paragraphs: [
      "PARIS — Europe's sovereign-cloud projects have moved from white papers to competing bid packages. The problem is that they are bidding for the same physical racks as Amazon, Microsoft, and Google.",
      "Contractors said generator sets, liquid-cooling skids, and installation crews are being reserved by whoever signs first. A ministry that waits for a perfect tender document may win the politics and lose the hardware.",
      "That is an awkward collision of industrial policy and a global shortage. It will produce some local clusters. It will also produce some very expensive waiting rooms.",
    ],
    imageAlt: "Modern data hall under construction",
  },
  {
    categorySlug: "tech",
    authorSlug: "david-chen",
    title: "Liquid cooling goes from niche to spec as 2026 AI halls abandon air",
    dek: "The rear door is no longer enough.",
    excerpt:
      "Colocation operators said new AI halls are being designed around liquid loops first, with air as the backup, reversing a decade of raised-floor orthodoxy.",
    paragraphs: [
      "ASHBURN, Va. — For a decade, U.S. data centers were air-conditioned warehouses with expensive electricity. The 2026 AI hall is a plumbing project. Operators said new builds assume rear-door heat exchangers at minimum and direct-to-chip loops for the densest racks.",
      "That rewrite hits every subcontractor. Chillers, CDUs, and leak-detection vendors that used to live on the edge of a data-center bill are now on the critical path.",
      "Landlords who cannot offer liquid will not merely lose a tenant. They will lose the only tenant class still paying 2021-style rents.",
    ],
    imageAlt: "Cooling infrastructure in a server facility",
  },
  {
    categorySlug: "tech",
    authorSlug: "james-whitaker",
    title: "Open-source models push enterprises to buy inference, not just training clusters",
    dek: "The cheap model still needs an expensive socket.",
    excerpt:
      "As capable open weights proliferate, CIOs are shifting spend toward inference throughput and evaluation tooling rather than exclusive foundation-model licenses.",
    paragraphs: [
      "SAN FRANCISCO — The enterprise AI stack is splitting in two. Training remains a hyperscale sport. Inference is becoming a capacity-and-evaluation problem that a competent IT shop can shop around.",
      "Vendors that sold exclusive model access are being asked to compete with open weights wrapped in a safety and logging layer. The moat, buyers said, is now latency, eval harnesses, and the ability to prove a model did not roam into the wrong data.",
      "That is not a smaller market. It is a different one. It rewards the clouds and chipmakers who can serve a billion cheap tokens without lighting the CFO on fire.",
    ],
    imageAlt: "Developer workstation with code on screen",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Treasury yields climb as traders price a slower path to rate cuts",
    dek: "The bond market is done pretending the first cut is the last word.",
    excerpt:
      "A backup in long yields is forcing a rewrite of the 2026 easing path as sticky services inflation and heavy Treasury supply share the same calendar.",
    paragraphs: [
      "NEW YORK — The Treasury market spent the early part of the year behaving as if a first rate cut would reopen the easy-money decade. It is not behaving that way now. Long yields have climbed as traders mark a slower, bumpier path for the federal funds rate.",
      "Two forces are doing the work. Services inflation has not rolled over as cleanly as goods prices did, and the Treasury must still issue a mountain of coupons into a world where foreign official buyers are less automatic.",
      "Equity investors who treated bond volatility as background noise are being reminded that discount rates are a product, not a vibe. Duration is earning its keep again, which is another way of saying it is hurting.",
    ],
    imageAlt: "Trading floor terminals with market data",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Fed officials split over whether financial conditions are tight enough",
    dek: "The statement is unified. The speeches are not.",
    excerpt:
      "A cluster of regional Fed speeches this week showed a live debate over whether equity multiples and credit spreads are undoing some of the work of higher rates.",
    paragraphs: [
      "WASHINGTON — Officially, the Federal Reserve is data-dependent. Unofficially, it is argument-dependent. Regional presidents spent the week offering incompatible readings of the same financial-conditions indexes.",
      "One camp sees still-restrictive real rates and a labor market that is cooling in an orderly way. The other sees a stock market that has decided the cutting cycle is a birthright and a credit market that is once again funding speculative stories.",
      "Markets do not need the argument resolved this month. They need to know it exists. Option prices in rates already do.",
    ],
    imageAlt: "Federal-style columns and financial district",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Investment-grade spreads stay tight even as issuance floods the window",
    dek: "Demand is winning, for now.",
    excerpt:
      "U.S. companies are printing bonds into a bid that refuses to widen, a sign that cash on the sidelines still outruns the supply calendar.",
    paragraphs: [
      "NEW YORK — Corporate bond desks described a familiar scramble: a large issuer announces a multi-tranche deal at breakfast and is done by lunch, concessions measured in single digits. Spreads are not behaving like a market that fears the cycle.",
      "That tightness is a gift to CFOs and a warning to anyone who thinks credit is cheap insurance. When spreads have little room to tighten, they have a lot of room to do something else.",
      "Real-money buyers said they are still adding, but they are adding with shorter spread duration and a livelier hedge. The bid is real. The complacency is optional.",
    ],
    imageAlt: "Bond trading screens with yield charts",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "The dollar's quiet rally is squeezing emerging-market borrowers again",
    dek: "A strong dollar is a global tax.",
    excerpt:
      "A firmer dollar and higher U.S. real yields are lifting hedging costs for EM corporates that borrowed in dollars when the world felt cheaper.",
    paragraphs: [
      "NEW YORK — The dollar has not needed a crisis to rise. It has needed a U.S. real-yield advantage and a world that still invoices in one currency. Emerging-market borrowers are feeling that combination as a refinancing tax.",
      "Treasurers who swapped into dollars in 2021 to shave coupons are now staring at hedge costs that erase the original savings. Some will term out in local currency. Some will simply pay.",
      "This is how a U.S. rates story becomes a Jakarta and São Paulo story without anyone in Washington intending it. Capital is global. The invoice is not.",
    ],
    imageAlt: "Global city skyline at dusk",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Oil holds near $82 as OPEC+ discipline collides with soft China demand",
    dek: "The tape is a compromise between a cartel and a factory.",
    excerpt:
      "Crude is stuck in a narrow range as OPEC+ defends the floor and Chinese industrial prints refuse to deliver the upside hedge funds wanted.",
    paragraphs: [
      "HOUSTON — Oil is not crashing and it is not escaping. Traders said the market is pinned near $82 as OPEC+ production discipline offsets a China demand tape that keeps disappointing the bulls.",
      "Refiners in the U.S. Gulf are running hard enough to keep products from blowing out, which removes one source of crude strength. The other source — geopolitical risk premia — remains, but it is no longer a one-way bid.",
      "For equity investors, that range is almost worse than a trend. Energy cash-flow models like direction. They do not like a six-month argument conducted in a $4 band.",
    ],
    imageAlt: "Industrial energy and skyline",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Basis trades and coupon supply keep 10-year volatility in the tape",
    dek: "The plumbing is loud again.",
    excerpt:
      "A mix of Treasury coupon heaviness and leveraged basis positioning is keeping 10-year vol elevated even on days when the Fed narrative barely moves.",
    paragraphs: [
      "NEW YORK — Rate volatility is not waiting for a Fed surprise. It is being produced in the plumbing: large coupon auctions, dealer balance-sheet limits, and a basis-trade community that has to adjust when repo and futures disagree.",
      "Desks said the 10-year is the battlefield because it is where duration, mortgage hedging, and foreign official flows still meet. A two-basis-point cheapening in the auction can become a ten-basis-point story in futures by the close.",
      "Portfolio managers who bought bonds for ballast are being paid to remember that ballast can slosh. The hedge is working. It is also moving.",
    ],
    imageAlt: "Financial district trading screens",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Mortgage spreads refuse to tighten as originators wait for a real rate path",
    dek: "Housing finance is still a rates market, not a housing market.",
    excerpt:
      "Agency MBS spreads remain wide to Treasuries as originators and money managers refuse to fade volatility that has already burned them twice.",
    paragraphs: [
      "NEW YORK — The mortgage basis looks cheap on a spreadsheet and expensive in a scar. Money managers said they have been offered this trade before, and both times a rates backup turned convexity into a cost center.",
      "Originators are not in a hurry either. A tighter spread that is immediately given back in a 20-basis-point yield spike does not help the lock desk. They would rather stay short convexity than be heroes.",
      "That standoff keeps mortgage rates higher than a simple funds-rate story would imply. The Fed can cut. The homebuyer still needs the basis to behave.",
    ],
    imageAlt: "Suburban housing and city finance contrast",
  },
  {
    categorySlug: "markets",
    authorSlug: "elena-vasquez",
    title: "Gold holds bid as real yields rise, breaking a relationship desks trusted",
    dek: "The old hedge is ignoring the textbook.",
    excerpt:
      "Bullion has stayed bid even as U.S. real yields climbed, a break with the post-crisis playbook that is forcing commodity desks to rewrite their factor models.",
    paragraphs: [
      "LONDON — Gold is supposed to dislike rising real yields. It has not received the memo. Desks said official buying and a persistent geopolitical bid are overpowering the real-rate relationship that structured a decade of commodity textbooks.",
      "That does not make gold a perpetual motion machine. It does make it a worse short for anyone whose only thesis is a 10-year TIPS yield.",
      "Equity cross-asset teams are treating bullion as a third policy variable, alongside the Fed and the dollar. That is a more honest model than the one they retired this quarter.",
    ],
    imageAlt: "Bullion and financial charts",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "Private credit stress tests arrive as regulators ask who holds the second-lien risk",
    dek: "The shadow bank is being asked to turn on the lights.",
    excerpt:
      "U.S. regulators are pressing banks and business-development companies for a clearer map of private-credit exposures after a year of quiet covenant relief.",
    paragraphs: [
      "WASHINGTON — The private-credit boom was sold as a cleaner banking system: risky loans live somewhere else. Supervisors are now asking the obvious follow-up. Where is somewhere else, and what happens to the banks that still warehouse, subscribe, or lend against those funds?",
      "Firms said the first stress-test templates look crude, which is how every useful regulatory exercise begins. The useful part is the request for look-through on second-lien and NAV-loan structures that have multiplied since 2022.",
      "Managers who can produce that map will keep gathering assets. Managers who treated opacity as a feature will discover that it was a product cycle.",
    ],
    imageAlt: "Legal documents and financial office",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "Venture-debt lenders tighten after a cluster of AI-adjacent missed covenants",
    dek: "The second check is no longer automatic.",
    excerpt:
      "Specialty lenders that financed growth companies through 2021 are rewriting covenants after several AI-adjacent borrowers missed interest-coverage tests.",
    paragraphs: [
      "SAN FRANCISCO — Venture debt had a long run pretending to be cheap equity with a coupon. That run is over for any borrower whose AI revenue is still a slide. Lenders said a small cluster of missed coverage tests was enough to reprice the whole book.",
      "New term sheets feature tighter cash sweeps, shorter interest-only periods, and a livelier debate about warrants. Founders who treated the facility as non-dilutive working capital are being asked to remember that it is debt.",
      "The healthy companies will refinance. The others will learn that a GPU bill is not collateral.",
    ],
    imageAlt: "Startup office and laptops",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "Fintech M&A reopens around payments infrastructure, not consumer apps",
    dek: "The acquirers want pipes.",
    excerpt:
      "Strategic buyers are back in the market for licensed payment processors and card-rail specialists, while consumer-fintech names still wait for a bid.",
    paragraphs: [
      "NEW YORK — The first fintech boom sold brands. The second is buying licenses, settlement connectivity, and the unglamorous right to sit on a payment rail. Bank and processor acquirers said they will pay for infrastructure and they will not pay for a growth story that is mostly customer-acquisition cost.",
      "That preference is already visible in the deals that clear. Targets with bank charters, money-transmitter coverage, or issuer-processor contracts are in process. Wallet apps with a celebrity seed round are not.",
      "For venture backers, this is a sorting. The companies that became utilities will exit. The companies that became advertisements will raise at a discount or not at all.",
    ],
    imageAlt: "Contactless payment and retail checkout",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "Regional banks rebuild capital, but CRE still shadows earnings",
    dek: "The recap worked. The offices did not disappear.",
    excerpt:
      "U.S. regional banks have thickened CET1 ratios since 2023, yet commercial-real-estate concentrations continue to cap how far investors will re-rate the group.",
    paragraphs: [
      "CHARLOTTE, N.C. — The emergency recapitalizations of 2023 did their job. Regional banks are better funded, better marked, and less casually run. They are still landlords of last resort to a lot of office buildings.",
      "Credit officers said the office book is being worked, not ignored. Extensions, recapitalizations with sponsors, and the occasional sale at a clearing price are all on the table. None of that is a one-quarter story.",
      "Equity investors will pay for a clean deposit franchise. They will not pay a premium multiple until the CRE footnote stops reading like a novella.",
    ],
    imageAlt: "Bank headquarters and city offices",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "The IPO window cracks open for fintech, but valuations remain a hard sell",
    dek: "Public markets will take the company. They will not take the 2021 deck.",
    excerpt:
      "Bankers said a handful of profitable payments and infrastructure names could list, provided they abandon last-cycle revenue multiples.",
    paragraphs: [
      "NEW YORK — Equity capital markets desks are making calls again. That is news. The calls are not, however, an invitation to relitigate 2021. Buyers want rule-of-40 arithmetic, not a total-addressable-market poem.",
      "Fintech issuers that already print cash can have a conversation. Issuers that need the IPO to become profitable will be told to wait or to sell privately.",
      "The window is a crack, not a gate. A couple of well-priced deals will widen it. A single overreached roadshow will slam it.",
    ],
    imageAlt: "Stock exchange and city skyline",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "Private equity dry powder meets a rate path that no longer does the model a favor",
    dek: "Leverage is a choice again.",
    excerpt:
      "Sponsors are sitting on committed capital that is harder to put to work as financing costs stay high and sellers still remember 2021 marks.",
    paragraphs: [
      "NEW YORK — Private equity does not lack money. It lacks a clearing price. Limited partners want deployments. Sellers want last-cycle marks. Lenders want covenants that would have been laughed out of a 2021 credit committee.",
      "The result is a lot of continuation vehicles, dividend recaps of the companies that can bear them, and a smaller number of true new-platform deals. Dry powder is not the same thing as dry conviction.",
      "Firms that underwrite operations rather than multiple expansion will still close. Firms that underwrite the Fed will wait longer than their fundraising pitch implied.",
    ],
    imageAlt: "Executive conference room",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "NAV loans draw scrutiny as LPs ask who sits behind the fund-level facility",
    dek: "Liquidity at the fund is still leverage.",
    excerpt:
      "Limited partners are pressing general partners for fuller disclosure of NAV facilities after a year in which the product quietly became standard equipment.",
    paragraphs: [
      "BOSTON — The NAV loan was sold as plumbing: a way to avoid a fire sale or an untimely capital call. It is still plumbing. It is also leverage on a portfolio that already has leverage underneath it, and LPs have started to ask for the diagram.",
      "GPs said the better facilities are modest, well-disclosed, and used as a bridge. The worse ones look like a way to manufacture distributions. Those will not survive a credit event and a committee meeting in the same quarter.",
      "The industry can keep the tool. It cannot keep the shrug.",
    ],
    imageAlt: "Fund managers reviewing documents",
  },
  {
    categorySlug: "finance",
    authorSlug: "priya-nair",
    title: "Card-network fee fights migrate from politics to merchant litigation",
    dek: "Interchange is a business model and a lawsuit.",
    excerpt:
      "Large merchants are pairing lobbying with fresh litigation as they try to reopen the economics of swipe fees after a year of public pressure.",
    paragraphs: [
      "NEW YORK — The swipe-fee argument used to live in Washington. It now also lives in court. Merchants said they will keep lobbying, but they are no longer waiting for a statute to change the routing and fee stack.",
      "Networks and banks argue that the rails are a two-sided market and that merchants are shopping a political discount. Merchants argue that a fee that compounds on every latte is not a law of nature.",
      "Investors should treat this as a multi-year margin debate, not a headline. A 10-basis-point change in interchange is a rounding error to a shopper and a thesis to a payments stock.",
    ],
    imageAlt: "Retail point-of-sale terminal",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Hyperscalers sign long-term power pacts with nuclear operators",
    dek: "The data center has found a baseload religion.",
    excerpt:
      "Amazon, Microsoft, and other large compute buyers are contracting nuclear output years forward as grid interconnection queues refuse to shrink.",
    paragraphs: [
      "CHICAGO — The AI campus has become a nuclear customer. Hyperscalers are signing long-dated offtake with operators of existing plants and, in a few cases, with developers of small modular designs that have not yet poured first concrete.",
      "The logic is not romantic. Interconnection queues for new gas and renewables stretch far enough that a plant already running looks like the only megawatts that exist in this decade.",
      "Communities and regulators will have opinions about wrapping a civilian reactor in a cloud contract. The companies have already decided that the alternative is a dark rack.",
    ],
    imageAlt: "Nuclear cooling towers and power lines",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "PJM capacity prices jump as data-center load collides with retirements",
    dek: "The capacity market finally noticed the GPUs.",
    excerpt:
      "A sharp reset in PJM capacity pricing is the first clean public signal that AI load and plant retirements are no longer a consulting-slide problem.",
    paragraphs: [
      "VALLEY FORGE, Pa. — PJM's capacity auction did what white papers could not: it printed a number large enough to get CFOs on a call. Data-center load, delayed transmission, and scheduled retirements arrived in the same season.",
      "Developers said the print will pull some gas peakers and life-extensions over the line. It will also make some AI campus pro formas look less clever than they did when power was treated as a utility footnote.",
      "This is how an internet story becomes a rate-base story. Customers in the mid-Atlantic will see it on bills. Hyperscalers will see it in IRR.",
    ],
    imageAlt: "High-voltage transmission lines",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Texas grid operators warn that AI campuses need dispatchable backup, not just wind",
    dek: "ERCOT can host the load. It cannot host the fantasy.",
    excerpt:
      "ERCOT officials and large developers are telling AI tenants that interconnection without on-site or contracted dispatchable power is no longer a serious plan.",
    paragraphs: [
      "AUSTIN, Texas — Texas remains the easiest large U.S. market in which to dream about a data center. It is not the easiest in which to keep one on through an August evening. Grid officials said new large loads will be judged on their backup story, not their press release.",
      "That is pushing campuses toward behind-the-meter gas, storage, and in a few cases nuclear partnerships that would have sounded satirical in 2019.",
      "The companies that treat ERCOT as a cheap power buffet will learn what every industrial user already knows. The buffet has a cover charge, and it is paid in firm capacity.",
    ],
    imageAlt: "Wind turbines and transmission corridor",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Utility-scale batteries win the interconnection race that solar lost",
    dek: "The queue prefers a four-hour asset.",
    excerpt:
      "Storage projects are clearing interconnection faster than standalone solar in several U.S. markets, because they can be sold as a grid tool rather than a net-load problem.",
    paragraphs: [
      "LOS ANGELES — Solar still wants to be built. Batteries are being allowed to connect. Developers said standalone storage is winning staff time at ISOs because it can be described as flexibility, whereas another midday solar farm can be described as a duck curve.",
      "That does not end the solar build. It changes the pairing. Hybrid projects that show up with a battery are being taken seriously. Bare solar is waiting in a longer line.",
      "For capital, this is a product-mix shift. The next two years of U.S. clean-energy IRRs will have more lithium and less unclipped photovoltaic optimism.",
    ],
    imageAlt: "Utility-scale battery containers",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Copper and transformer shortages stretch U.S. transmission projects into 2028",
    dek: "The grid is waiting on a factory, not a permit.",
    excerpt:
      "Developers said high-voltage transformers and conductor are now longer-lead than many environmental reviews, delaying lines that AI load already assumes exist.",
    paragraphs: [
      "PITTSBURGH — Ask a transmission developer about permitting and you will get a speech. Ask about transformers and you will get a date. Large U.S. transformers are being quoted into 2028, and copper-intensive conductor is not far behind.",
      "That industrial constraint is now as important as any courtroom fight over a right of way. A permitted line without a transformer is a drawing.",
      "Policy makers who want to electrify data centers, factories, and cars in the same decade will have to talk about factory incentives for boring electrical gear. The romance is in the generation. The delay is in the iron.",
    ],
    imageAlt: "Electrical substation at dusk",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Behind-the-meter gas turbines return to AI campuses as a bridging fuel",
    dek: "The transition is keeping a turbine in the parking lot.",
    excerpt:
      "Campus developers are installing or contracting on-site gas generation to bridge multi-year interconnection delays, a pragmatic retreat from all-renewable site plans.",
    paragraphs: [
      "COLUMBUS, Ohio — The cleanest AI campus on a rendering is arriving with a gas turbine in the site plan. Developers said they still want a renewable and storage end state. They also want to turn the lights on before 2029.",
      "That bridging fuel is already drawing local opposition and investor-relations questions. It is also the only way several announced campuses can keep their hyperscale tenants.",
      "The honest framing is a two-stage project: gas now, cleaner electrons when the queue moves. The dishonest framing is a net-zero campus that happens to have a smokestack.",
    ],
    imageAlt: "Industrial power plant and sky",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Small modular reactors attract offtake letters, but construction risk stays with vendors",
    dek: "A letter is not a pour.",
    excerpt:
      "Tech and utility buyers are signing SMR offtake letters that push first-of-a-kind construction and licensing risk back onto developers and their investors.",
    paragraphs: [
      "IDAHO FALLS, Idaho — Small modular reactors have offtake. They do not yet have a fleet. Buyers said they will contract for electrons if someone else eats the first-of-a-kind construction risk, a sentence that sounds cooperative and is in fact a refusal.",
      "Vendors can live with that if the letters help them raise. They cannot live with it if every delay in licensing becomes a renegotiation.",
      "The next 24 months will sort the firms that can pour concrete from the firms that can pour PDFs. Equity should not confuse the two.",
    ],
    imageAlt: "Nuclear facility and security fencing",
  },
  {
    categorySlug: "energy",
    authorSlug: "david-chen",
    title: "Corporate PPAs get shorter as buyers refuse to lock 15-year solar prices",
    dek: "The 15-year green contract is losing friends.",
    excerpt:
      "Large energy buyers are pushing power-purchase agreements toward 7- to 10-year tenors as they wait out equipment costs and a more volatile wholesale tape.",
    paragraphs: [
      "DENVER — The 15-year corporate PPA was a gift to project finance. It is becoming a hard sell. Treasurers said they will still buy clean power. They will not lock a mid-2010s-style price for a decade and a half while panel, rate, and load assumptions keep moving.",
      "Developers are answering with merchant tails, collars, and hybrid storage that can be re-contracted. The capital stack is getting more creative because the offtake is getting less obedient.",
      "That is healthier than a market built on one kind of contract. It is also slower. Some projects will wait. Some will not be built.",
    ],
    imageAlt: "Solar farm at sunset",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "Why Fortune 500 boards are splitting the chair and CEO roles — again",
    dek: "Governance fashion has a long memory and a short cycle.",
    excerpt:
      "A new wave of U.S. boards is separating chair and chief executive after a run of activist campaigns and messy successions, reversing a decade of combined-role orthodoxy.",
    paragraphs: [
      "NEW YORK — Combined chair-and-CEO was sold as accountability with a single throat to choke. Boards that have lived through an activist letter and a failed heir apparent are less sentimental. They want a chair who can fire the CEO without first firing themselves.",
      "Companies moving first tend to be those that have already had a public fight. Prevention, in governance as in medicine, is easier to sell after the first hospitalization.",
      "CEOs are not always pleased. A combined role is a status good. Investors who vote the split should be honest that they are buying a process, not a personality upgrade.",
    ],
    imageAlt: "Boardroom table and empty chairs",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "FTC's app-store remedy begins to bite as platforms recalculate fees",
    dek: "The remedy is no longer theoretical.",
    excerpt:
      "Developers and advertisers said fee and steering changes on major app platforms are starting to show up in actual contracts, not just in court PDFs.",
    paragraphs: [
      "WASHINGTON — For two years the app-store fight was a legal narrative. It is becoming a price narrative. Developers said new steering rules and fee experiments are appearing in contract addenda, which is how a remedy becomes a P&L.",
      "Platforms argue that they still provide the distribution, the payment risk, and the refund desk. Developers argue that a 30 percent starting point was a monopoly souvenir.",
      "Wall Street should model a range, not a cliff. A few points of take-rate matter enormously at platform scale and barely at all in a keynote.",
    ],
    imageAlt: "Smartphone apps and city office",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "Antitrust staff put vertical AI deals on a longer clock than buyers budgeted",
    dek: "The second request is the new close date.",
    excerpt:
      "Deal lawyers said AI-related vertical acquisitions are drawing extended reviews as agencies test whether model, data, and cloud bundles entrench a platform.",
    paragraphs: [
      "WASHINGTON — The easy AI acquisition is over. Counsel said vertical deals that pair a model shop with a cloud, a data exhaust, or a workplace suite are being put on clocks that wreck a 90-day close plan.",
      "Buyers still announce. They also now announce with a longer outside date and a weaker reverse-breakup number, which is how you can tell their lawyers won a meeting.",
      "This will not stop M&A. It will change which assets get bought. Talent raids and licensing will substitute for some closings that would have been straightforward in 2018.",
    ],
    imageAlt: "Government building and legal district",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "Activist funds target bloated AI budgets instead of the usual buyback fight",
    dek: "The letter is about capex, not the dividend.",
    excerpt:
      "A new activist script asks boards to prove that multi-billion-dollar AI programs have unit economics, not just a keynote and a cloud bill.",
    paragraphs: [
      "NEW YORK — Activists have a seasonal calendar: find a company with a messy conglomerate, demand a split, demand a buyback. This season they have a new exhibit. It is the AI line item.",
      "Letters seen by TradeFlock USA ask for cohort-level returns on copilots, reserved GPU spend, and the headcount that was hired to babysit models. Boards that cannot answer will be accused of fashion.",
      "Some of those programs will survive the scrutiny because they print. The ones that were a panic response to a competitor's demo will not.",
    ],
    imageAlt: "Investor presentation in a glass office",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "Chief AI officers last 18 months unless they own a P&L",
    dek: "A title without a budget is a press release.",
    excerpt:
      "Companies that created CAIO roles in 2024 are already rewriting the job, folding it into product, security, or a line-of-business seat with actual revenue.",
    paragraphs: [
      "CHICAGO — The chief AI officer was 2024's favorite box on the org chart. It is 2026's first consolidation. Boards said the role survives when it owns a product or a cost takeout. It dies when it owns a slide.",
      "The work is being folded into product management, security, and the CFO's productivity agenda. That is less glamorous and more likely to persist.",
      "Executives who took the title as a destination rather than a bridge are updating their LinkedIn. The ones who took it as a license to ship are updating their operating reviews.",
    ],
    imageAlt: "Executive walking through an office lobby",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "Labor deals at U.S. automakers now include language on AI shop-floor tools",
    dek: "The next contract is about software in the plant.",
    excerpt:
      "UAW and company bargainers are writing AI-assistance and data-collection clauses into local agreements, a sign that the factory software stack is now a labor issue.",
    paragraphs: [
      "DETROIT — The last big Detroit contracts were about wages and the EV transition. The next local agreements are about cameras, copilots, and who owns the data that a wrench-turning job produces.",
      "Union bargainers said they are not trying to ban tools that keep people out of harm. They are trying to stop a quiet rewrite of job content without a bargaining table.",
      "Companies that treat this as IT procurement will get a grievance. Companies that treat it as industrial relations will get a pilot.",
    ],
    imageAlt: "Factory floor and industrial workers",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "Boards demand tabletop exercises after a year of AI-assisted fraud attempts",
    dek: "The deepfake is now a controls issue.",
    excerpt:
      "Audit committees are adding payment-fraud and voice-clone scenarios to annual tabletop drills after a string of near-misses at mid-cap U.S. firms.",
    paragraphs: [
      "NEW YORK — The most useful AI conversation in many board packets is not about copilots. It is about a voice that almost moved a wire. Audit chairs said they want tabletops that include a cloned CFO and a weekend payment request.",
      "Banks have been living this longer than corporates. The corporates are catching up because the tools got cheaper and the processes stayed polite.",
      "A company that still treats dual-control as a policy PDF rather than a rehearsed habit is volunteering to be a case study.",
    ],
    imageAlt: "Cybersecurity operations center",
  },
  {
    categorySlug: "leadership",
    authorSlug: "marcus-vance",
    title: "CEO pay fights return as investors refuse to treat AI transformation as a blank check",
    dek: "The special grant needs a special result.",
    excerpt:
      "Compensation committees are facing sharper votes against mega-grants justified as AI-transformation awards without disclosed operating milestones.",
    paragraphs: [
      "WILMINGTON, Del. — Shareholders will still pay for a transformation they can see. They are less willing to pay for a transformation that is a word on a proxy. Mega-grants tied to 'AI leadership' without revenue, margin, or product milestones are drawing against votes that compensation consultants had filed under last decade.",
      "Committees are responding with tighter scorecards and longer cliffs. That is not virtue. It is arithmetic after a few highly visible grants aged poorly.",
      "CEOs who want the grant will have to live with the milestone. That is the oldest bargain in American corporate life, briefly forgotten.",
    ],
    imageAlt: "Annual meeting and shareholder materials",
  },
];

function publishedAtForIndex(index: number, total: number) {
  const spanMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const offset = total === 1 ? 0 : (index / (total - 1)) * spanMs;
  const date = new Date(now - offset);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

async function upsertFoundations(supabase: ReturnType<typeof createClient>) {
  console.log("Upserting categories...");
  const { error: categoryError } = await supabase
    .from("categories")
    .upsert(CATEGORIES, { onConflict: "slug" });
  if (categoryError) throw new Error(`Category upsert failed: ${categoryError.message}`);

  console.log("Upserting authors...");
  const { error: authorError } = await supabase
    .from("authors")
    .upsert(AUTHORS, { onConflict: "slug" });
  if (authorError) throw new Error(`Author upsert failed: ${authorError.message}`);

  const [{ data: categories, error: catSelectError }, { data: authors, error: authorSelectError }] =
    await Promise.all([
      supabase.from("categories").select("id, slug, name"),
      supabase.from("authors").select("id, slug, name"),
    ]);

  if (catSelectError || !categories?.length) {
    throw new Error(catSelectError?.message ?? "No categories returned after upsert");
  }
  if (authorSelectError || !authors?.length) {
    throw new Error(authorSelectError?.message ?? "No authors returned after upsert");
  }

  return {
    categories: categories as CategoryRow[],
    authors: authors as AuthorRow[],
  };
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or key in .env.local");
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Inserts may fail under RLS if only an anon key is available.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Preparing ${STORIES.length} unique articles...`);
  const { categories, authors } = await upsertFoundations(supabase);
  const categoryBySlug = new Map(categories.map((row) => [row.slug, row]));
  const authorBySlug = new Map(authors.map((row) => [row.slug, row]));

  const missingCategories = [...new Set(STORIES.map((story) => story.categorySlug))].filter(
    (slug) => !categoryBySlug.has(slug),
  );
  const missingAuthors = [...new Set(STORIES.map((story) => story.authorSlug))].filter(
    (slug) => !authorBySlug.has(slug),
  );
  if (missingCategories.length) {
    throw new Error(`Missing categories after upsert: ${missingCategories.join(", ")}`);
  }
  if (missingAuthors.length) {
    throw new Error(`Missing authors after upsert: ${missingAuthors.join(", ")}`);
  }

  const rows = STORIES.map((story, index) => {
    const category = categoryBySlug.get(story.categorySlug)!;
    const author = authorBySlug.get(story.authorSlug)!;
    const hash = shortHash();
    const publishedAt = publishedAtForIndex(index, STORIES.length);
    return {
      title: story.title,
      slug: `${slugify(story.title)}-${hash}`,
      dek: story.dek,
      excerpt: story.excerpt,
      body: story.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join(""),
      cover_image_url: IMAGES[index % IMAGES.length],
      cover_image_alt: story.imageAlt,
      category_id: category.id,
      author_id: author.id,
      is_featured: index % 11 === 0,
      is_breaking: index < 3,
      view_count: 120 + ((index * 137) % 4800),
      status: "published" as const,
      published_at: publishedAt,
    };
  });

  const batchSize = 10;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNumber = i / batchSize + 1;
    const batch = rows.slice(i, i + batchSize);
    process.stdout.write(`Inserting batch ${batchNumber} (${batch.length} articles)... `);

    const firstTry = await supabase.from("articles").insert(batch);
    if (firstTry.error?.message.toLowerCase().includes("status")) {
      const withoutStatus = batch.map(({ status: _status, ...rest }) => rest);
      const retry = await supabase.from("articles").insert(withoutStatus);
      if (retry.error) throw new Error(`Batch ${batchNumber} failed: ${retry.error.message}`);
    } else if (firstTry.error) {
      throw new Error(`Batch ${batchNumber} failed: ${firstTry.error.message}`);
    }

    inserted += batch.length;
    console.log(`ok (${inserted}/${rows.length})`);
  }

  console.log(`Finished. Inserted ${inserted} articles.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
