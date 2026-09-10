import type { ArticleWithRelations, Author, Category } from "../types";

export const SEED_CATEGORIES: Category[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Tech",
    slug: "tech",
    description: "Silicon Valley, semiconductors, cloud, and the platforms that run the economy.",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Markets",
    slug: "markets",
    description: "Equities, rates, commodities, and the tape that moves boardrooms.",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Leadership",
    slug: "leadership",
    description: "CEOs, boards, labor, and the people who set corporate direction.",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Finance",
    slug: "finance",
    description: "Banking, private credit, regulation, and the plumbing of American capital.",
  },
];

export const SEED_AUTHORS: Author[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    name: "Elena Vasquez",
    slug: "elena-vasquez",
    title: "Senior Markets Correspondent",
    bio: "Covers Treasuries, the dollar, and the policy signals that reprice risk assets.",
    avatar_url: null,
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    name: "James Whitaker",
    slug: "james-whitaker",
    title: "Technology Editor",
    bio: "Reports on semiconductors, cloud infrastructure, and the industrial politics of AI.",
    avatar_url: null,
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
    name: "Priya Nair",
    slug: "priya-nair",
    title: "Finance Reporter",
    bio: "Writes on banks, private credit, and the regulatory perimeter around nonbank lenders.",
    avatar_url: null,
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
    name: "Marcus Chen",
    slug: "marcus-chen",
    title: "Leadership & Policy Correspondent",
    bio: "Follows Fortune 500 succession, boards, and the labor bargains reshaping corporate America.",
    avatar_url: null,
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
    name: "Sophia Brennan",
    slug: "sophia-brennan",
    title: "Wall Street Correspondent",
    bio: "Covers IPOs, buybacks, and the capital-markets calendar out of New York.",
    avatar_url: null,
  },
];

const categoryById = Object.fromEntries(SEED_CATEGORIES.map((c) => [c.id, c]));
const authorById = Object.fromEntries(SEED_AUTHORS.map((a) => [a.id, a]));

type SeedArticleInput = Omit<ArticleWithRelations, "category" | "author">;

const articles: SeedArticleInput[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "apple-on-device-ai-suppliers-recalibrate",
    title: "Apple's on-device AI push forces a recalibration across Silicon Valley suppliers",
    dek: "A quieter Siri overhaul is becoming a supply-chain story — and a margin story — for the firms that feed Cupertino.",
    excerpt:
      "Apple's decision to run more generative features on the iPhone is redrawing orders for memory, custom silicon, and on-device models, leaving suppliers to reprice a cycle they thought they understood.",
    body: `<p>CUPERTINO, Calif. — Apple's latest on-device intelligence stack is less a consumer spectacle than a procurement memo. Memory makers, foundry partners, and the mid-tier firms that assemble camera and sensor modules are being asked to ship parts that run hotter, store more, and fail less — without the cover of a single, easily marketed "AI iPhone" supercycle.</p>
<p>The strategic bet is familiar to anyone who has watched Apple's privacy messaging for a decade: keep inference close to the user, send as little as possible to the cloud, and turn that constraint into a product claim. What is new is the bill of materials. Executives at two suppliers, speaking on the condition of anonymity because the contracts are still being finalized, said 2026 volume guidance now assumes higher-density NAND and a thicker mix of Apple-designed co-processors than last year's plan.</p>
<p>That shift collides with a broader industry narrative in which every major platform company is racing to rent Nvidia clusters by the acre. Apple is not opting out of the data-center build. It is refusing to let the phone become a thin client for someone else's model. The result is a two-track capital cycle: hyperscalers pouring concrete for training, and a handset giant squeezing more intelligence into a device that still has to survive a day on one battery.</p>
<p>Wall Street has been slow to model the second track. Several sell-side notes this month still treat Apple's AI story as a services attach-rate question. The more immediate tell is in the supplier base — who gets a larger wafer allocation, who is being asked to requalify parts, and who is quietly being told that last year's forecast was a ceiling, not a floor.</p>
<p>"This is not a software overlay," said a veteran hardware analyst in San Francisco. "It is a tax on the physical iPhone, paid in silicon and thermals. The companies that collect that tax will show it in gross margin before Apple ever puts a new Siri demo on a keynote stage."</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Close-up of a semiconductor circuit board",
    category_id: "11111111-1111-1111-1111-111111111111",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    is_featured: true,
    is_breaking: true,
    view_count: 18420,
    published_at: "2026-09-10T10:15:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    slug: "microsoft-azure-backlog-multi-year-cloud-contracts",
    title: "Microsoft's Azure backlog hits a record as enterprises lock in multi-year cloud contracts",
    dek: "CIOs are trading flexibility for capacity — a tell that the AI buildout is no longer optional capex.",
    excerpt:
      "Azure's contracted backlog has swollen as large customers reserve GPU-backed capacity years in advance, turning the cloud price war into a rationing story.",
    body: `<p>REDMOND, Wash. — Microsoft's cloud business is starting to look less like a utility and more like a shipyard with a waitlist. People familiar with the company's enterprise pipeline said Azure's remaining performance obligations climbed again in the quarter, driven by multi-year deals that bundle ordinary software seats with scarce GPU capacity.</p>
<p>The shift is a reversal of the early-cloud playbook, when vendors competed to make switching cheap and commitments short. Today the constraint is not demand. It is transformers, land, and the ability to stand up clusters before a rival does. CIOs who spent 2023 and 2024 experimenting with copilots are now being told, politely, that the interesting SKUs are allocated.</p>
<p>That dynamic is a gift to Microsoft's sales force and a headache for finance chiefs who liked the idea of cloud as opex with an exit ramp. Several Fortune 100 technology officers described being offered better unit pricing in exchange for four- and five-year minimums — terms that would have been laughed out of a 2019 procurement review.</p>
<p>Competitors are not idle. Amazon and Google are writing similar contracts, and a handful of neoclouds are pitching themselves as overflow valves. But Microsoft's installed base of Office and security products gives it a bundling advantage that is difficult to unwind in a single RFP. The backlog, in other words, is not just compute. It is distribution.</p>
<p>Investors should watch two numbers that will not show up in a keynote: how much of the backlog is GPU-tied versus general-purpose compute, and how often customers are allowed to re-slide those commitments if model architectures change. The first tells you about scarcity. The second tells you about lock-in.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Earth viewed from orbit at night with city lights",
    category_id: "11111111-1111-1111-1111-111111111111",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    is_featured: false,
    is_breaking: false,
    view_count: 12680,
    published_at: "2026-09-09T18:40:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    slug: "nvidia-custom-silicon-hyperscalers-gpu-narrative",
    title: "Nvidia faces a new test as custom silicon deals dilute the GPU monopoly narrative",
    dek: "Hyperscalers are not abandoning CUDA. They are hedging it — and Wall Street is arguing about what that hedge is worth.",
    excerpt:
      "Amazon, Google, and Microsoft are expanding in-house accelerators even as they remain Nvidia's largest customers, complicating the clean monopoly story that powered the stock.",
    body: `<p>SANTA CLARA, Calif. — For two years the market treated Nvidia as a toll booth on the only road that mattered. That story is getting a footnote. Custom accelerators designed inside Amazon, Google, and Microsoft are moving from science projects to procurement line items, not as replacements for Blackwell-class GPUs but as a second source for inference and a bargaining chip in every supply meeting.</p>
<p>Nvidia's response has been to sell the full stack — networking, software, and the argument that time-to-train still belongs to CUDA. That argument is still largely true for frontier training runs. It is less decisive for the high-volume inference jobs that will, if the bulls are right, become the cash register of the next decade.</p>
<p>The political economy is awkward. The same companies writing nine-figure purchase orders to Nvidia are briefing their own boards on silicon that reduces that bill. None of them can afford to be wrong about supply. All of them would prefer not to be a captive buyer.</p>
<p>"This is what a healthy customer looks like when the vendor has 80 percent share," said a semiconductor banker in Menlo Park. "You do not storm the castle. You build a side door and keep paying rent until the door works."</p>
<p>The near-term risk to Nvidia is not lost revenue. It is multiple compression if investors decide the monopoly is a phase rather than a permanent feature of the industry. The company's networking and software moat is real. So is the incentive, inside every hyperscaler, to make sure it is not the only moat that exists.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Abstract visualization of artificial intelligence networks",
    category_id: "11111111-1111-1111-1111-111111111111",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    is_featured: false,
    is_breaking: true,
    view_count: 15310,
    published_at: "2026-09-09T14:05:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    slug: "ftc-app-store-remedy-platform-fees",
    title: "The FTC's app store remedy begins to bite — and Wall Street is recalculating platform fees",
    dek: "A long-running fight over in-app payments is turning into a line-item risk for Apple and Google's services margins.",
    excerpt:
      "Developers are steering more checkout off the official stores, and analysts are cutting the fee streams that once looked like digital rent.",
    body: `<p>WASHINGTON — The legal war over app stores was supposed to be a spectacle. It is becoming arithmetic. In the months since the latest FTC and court remedies took hold, several large developers have begun routing a meaningful share of subscriptions and digital goods through web checkouts and alternative billing — still a minority of gross bookings, but large enough to show up in the platforms' services commentary.</p>
<p>Apple and Google continue to argue that a store is not a pipe: it is review, distribution, fraud control, and a business model that subsidizes a free-to-download catalog. Developers counter that a 15 to 30 percent tax on software that never touches a warehouse is a relic of a less competitive era. The courts, incrementally, have sided with the latter on process even when they leave the former's architecture standing.</p>
<p>For investors, the question is not whether the stores vanish. It is how much of the take-rate survives once steering is legal and consumers are trained to expect it. Media and gaming companies with direct relationships to fans will move first. Utilities and one-tap consumer apps will move last.</p>
<p>A New York media analyst put the sensitivity simply: every 100 basis points of take-rate compression is a services-margin event, not a hardware event. That is why the stock reaction has been uneven. Hardware cycles can be narrated. Fee erosion is a slow leak, and leaks are how quality businesses become merely good ones.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "People working with laptops in a modern office",
    category_id: "11111111-1111-1111-1111-111111111111",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    is_featured: false,
    is_breaking: false,
    view_count: 7420,
    published_at: "2026-09-08T16:20:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    slug: "treasury-yields-climb-slower-rate-cuts",
    title: "Treasury yields climb as traders price a slower path to rate cuts into year-end",
    dek: "A resilient labor print and sticky services inflation have pulled the 10-year back toward levels that squeeze housing and leveraged balance sheets.",
    excerpt:
      "Futures markets have pared bets on 2026 easing after a hot jobs report, sending the 10-year Treasury higher and forcing a rethink of the soft-landing script.",
    body: `<p>NEW YORK — The bond market spent the summer rehearsing a gentle landing. This week it is rewriting the script. After a stronger-than-expected employment report and another sticky reading on services inflation, traders reduced the number of Federal Reserve cuts priced into December and pushed the 10-year Treasury yield back toward a range that makes chief financial officers sit up in their chairs.</p>
<p>The move is not a panic. It is a repricing of patience. Fed officials have been careful not to declare victory over inflation that has been "mostly done" for two years running, and the futures strip had, in the view of several rates strategists, gotten ahead of that caution. Housing-sensitive names and highly leveraged private-market vehicles felt it first.</p>
<p>For the Treasury, higher yields are also a fiscal fact. Coupon costs on new issuance remain politically invisible until they are not. Debt-management officials have leeway on maturity mix; they do not have leeway on the stock of debt that must be rolled.</p>
<p>"The cut cycle is not canceled," said Elena Vasquez, TradeFlock's markets correspondent, summarizing the desk consensus. "It is being asked to show more ID. Equities can live with that. Duration-heavy products and anyone who borrowed against a 2024 rate dream cannot."</p>
<p>Watch the 2s10s curve and investment-grade issuance calendars into October. If corporates rush the window, they believe this backup is a gift. If they wait, they believe it is a trend.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Financial candlestick chart on a trading screen",
    category_id: "22222222-2222-2222-2222-222222222222",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    is_featured: false,
    is_breaking: true,
    view_count: 21105,
    published_at: "2026-09-10T11:50:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    slug: "oil-holds-82-opec-china-demand",
    title: "Oil holds near $82 as OPEC+ discipline collides with soft China demand",
    dek: "Producers are defending the floor. The ceiling, for now, is a Chinese factory park running below last year's pulse.",
    excerpt:
      "Brent has settled into a tight band as supply restraint from OPEC+ offsets a weaker Chinese industrial complex and a still-cautious U.S. consumer.",
    body: `<p>HOUSTON — Crude has become a market of small numbers. Brent hovering near $82 a barrel is not a crisis and not a boom. It is a standoff. OPEC+ has shown it can still withhold barrels. China has shown it can still disappoint the demand forecasts that oil desks recycle each spring.</p>
<p>U.S. shale, once the swing producer of folklore, is behaving more like a cash-flow machine than a growth engine. Public independents remain under orders from shareholders to return capital, not to out-drill Riyadh. That discipline supports prices. It also means the United States is less able to flood the market if geopolitics tightens the Strait of Hormuz for a week.</p>
<p>Refiners are the quiet winners of the range. Crack spreads have been respectable without inviting a political backlash at the pump, and inventory draws have been orderly. The risk case is a cold Northern Hemisphere winter overlapping with another OPEC+ surprise. The base case is more of this: a price that is high enough to fund budgets and low enough to keep Washington from giving speeches about it.</p>
<p>Energy equities have noticed. The sector is no longer priced as a relic, nor as a moonshot. It is priced as a cash business with a geopolitical option attached — which, for a U.S. business desk, is the honest description.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1497436072909-60f360e1d4b0?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Offshore oil platform on the horizon",
    category_id: "22222222-2222-2222-2222-222222222222",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    is_featured: false,
    is_breaking: false,
    view_count: 6340,
    published_at: "2026-09-08T12:10:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000007",
    slug: "dollar-rally-squeezes-emerging-market-borrowers",
    title: "The dollar's quiet rally is squeezing emerging-market borrowers again",
    dek: "A stronger greenback is not a headline crisis. For dollar-debt issuers from Ankara to Johannesburg, it is a working-capital problem.",
    excerpt:
      "The U.S. dollar has firmed on relative growth and rate differentials, lifting the real burden of dollar-denominated corporate and sovereign debt.",
    body: `<p>NEW YORK — The dollar does not need a crisis to cause one elsewhere. A grinding rally, fed by relative U.S. growth and the slower Fed path now in the price, is lifting the local-currency cost of dollar bills for companies and governments that borrowed when money was cheaper and the greenback was less loved.</p>
<p>This is not 2013 and it is not 2018. External balances in several large emerging markets are healthier, and local-currency markets are deeper. What has not changed is the original sin of global finance: a great deal of trade and a great deal of leverage still clear in dollars. When the DXY firms, working-capital lines get shorter even if nothing "broke" in New York.</p>
<p>U.S. multinationals feel a milder version of the same math in translation. A strong dollar trims overseas earnings when they are brought home, which is why a handful of S&amp;P names with heavy European and Latin American exposure have started to talk about hedging costs on their calls again.</p>
<p>The policy implication is unglamorous. Emerging-market central banks that had hoped to ease in sympathy with the Fed may have to keep real rates higher than domestic politics would like. That, in turn, caps the growth impulse that global equity bulls need from outside the United States. A U.S. business publication can treat that as someone else's story only until it shows up in a supplier's delayed invoice.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1526304640173-94cb2232017e?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "World currency notes and coins",
    category_id: "22222222-2222-2222-2222-222222222222",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    is_featured: false,
    is_breaking: false,
    view_count: 8910,
    published_at: "2026-09-07T19:30:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    slug: "ipo-window-fintech-valuations",
    title: "The IPO window cracks open for fintech, but valuations remain a hard sell",
    dek: "Bankers are back on the road. Buyers are still asking to be paid for 2021's hangover.",
    excerpt:
      "A handful of payments and lending names are testing public markets again, only to discover that growth without a path to durable returns still does not clear.",
    body: `<p>NEW YORK — Equity capital markets desks have spent two years promising that the window would reopen. In a narrow sense, it has. A cluster of fintech issuers has filed, priced, or circled bankers for autumn slots, and the calendar no longer looks like a ghost town. In a broader sense, the market is still a skeptical buyer of stories that last traded on private marks from 2021.</p>
<p>The companies that are getting traction share a boring virtue: they make money, or can show a plausible year in which they will. Payments infrastructure and certain embedded-finance rails are easier to underwrite than consumer apps whose primary asset was a CAC curve. Lenders with real credit boxes are easier than lenders with a growth narrative and a rising charge-off ratio.</p>
<p>Valuation is the argument that will not die. Mutual-fund PMs who were burned holding leftover private rounds are demanding IPO discounts that founders describe as punitive and public investors describe as tuition. The compromise, when it happens, is a smaller primary raise and a lot of lockup theater.</p>
<p>"There is demand for scarcity," said a senior ECM banker. "There is not demand for a reset of the entire venture-backed middle class. If your last round implied you were a public mega-cap, you are not going to like this tape."</p>
<p>That is a healthier market than a closed one. It is also a reminder that going public is not a reward for surviving. It is a price discovery event, and discovery has a habit of being rude.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Laptop displaying charts and graphs on a wooden desk",
    category_id: "22222222-2222-2222-2222-222222222222",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
    is_featured: false,
    is_breaking: false,
    view_count: 10140,
    published_at: "2026-09-07T15:00:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000009",
    slug: "fortune-500-boards-split-chair-ceo",
    title: "Why Fortune 500 boards are splitting the chair and CEO roles — again",
    dek: "Governance fashion is cyclical. This cycle is being driven by investors who no longer trust a single office to police itself.",
    excerpt:
      "A new wave of large U.S. companies is separating the chairmanship from the chief executive, reversing a decade in which combined roles were sold as efficiency.",
    body: `<p>NEW YORK — American corporate governance has a short memory and a long pendulum. After a decade in which combining the chair and CEO jobs was sold as clarity — one leader, one throat to choke — a growing roster of Fortune 500 boards is splitting the roles again. The catalyst is not a single scandal. It is a stack of them, plus a shareholder base that has learned to vote the proxy.</p>
<p>Independent chairs are being pitched as adult supervision: someone who can run an executive session without the CEO setting the agenda, and someone who can manage succession before it becomes a crisis. Critics call it ceremonial, a title that looks good in an ISS report and changes little about the real power map. Both things can be true depending on the person in the seat.</p>
<p>What has changed is the labor market for directors. After a period of quiet, several high-profile chairs have been recruited from outside the usual alumni network — former operators, not just former bankers — and given mandates that include culture and risk, not only the calendar of the board dinner.</p>
<p>CEOs are not always pleased. A combined role is a status good as well as a management structure. But the companies moving first tend to be those that have already had a messy succession or a public fight with an activist. Prevention, in governance as in medicine, is easier to sell after the first hospitalization.</p>
<p>Investors should treat the split as a signal, not a solution. A weak independent chair is expensive stationery. A strong one is the cheapest risk control a board can buy.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1521737711867-e3b973223fbd?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Executives collaborating around a conference table",
    category_id: "33333333-3333-3333-3333-333333333333",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
    is_featured: false,
    is_breaking: false,
    view_count: 11270,
    published_at: "2026-09-06T17:45:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000010",
    slug: "talent-war-ai-safety-officers",
    title: "Inside the talent war for AI safety officers, a job that barely existed two years ago",
    dek: "Companies are hiring people to tell them what not to ship — and paying as if that were a revenue role.",
    excerpt:
      "A new C-suite adjacent title is drawing six- and seven-figure packages as regulators, insurers, and enterprise buyers demand a named adult in the room.",
    body: `<p>SAN FRANCISCO — Two years ago, "AI safety officer" was a punch line or a conference badge. This autumn it is a line in the budget. Large U.S. companies — not only model labs — are hiring officials whose job is to slow a product, document a risk, and take the call when a customer or a regulator asks who is in charge. Compensation, recruiters say, now rivals product leadership in a handful of searches.</p>
<p>The demand is coming from three directions. Regulators want a named human. Insurers want a control function they can underwrite. Enterprise procurement teams, especially in health, finance, and the federal contractor universe, want someone to sit across the table who does not report into the growth number.</p>
<p>That last point is the cultural fight. Safety roles that report into the CEO or the general counsel behave differently from those that report into the CMO. Several candidates described walking away from searches where the mandate was "enable the launch." They are looking for the authority to delay it.</p>
<p>Whether the title becomes a profession or a fad will be decided by the first serious incident that a company survives — or does not. Until then, the labor market is doing what it always does at the birth of a function: overpaying for scarce people and hoping the org chart catches up.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Team discussion in a glass-walled office",
    category_id: "33333333-3333-3333-3333-333333333333",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
    is_featured: false,
    is_breaking: false,
    view_count: 9680,
    published_at: "2026-09-06T13:25:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000011",
    slug: "starbucks-new-chief-labor-smaller-stores",
    title: "Starbucks' new chief bets on labor peace and a smaller, faster store footprint",
    dek: "The coffee giant is trading square footage for throughput — and trying to end a union fight that became a brand problem.",
    excerpt:
      "A turnaround plan centered on compact stores, shorter menus, and a more durable labor settlement is the first real test of Starbucks' post-founding era.",
    body: `<p>SEATTLE — Starbucks does not have a coffee problem so much as a complexity problem. The new chief executive is treating both the store and the workforce as systems that got baroque: too many SKUs, too much square footage in the wrong places, and a labor conflict that turned a morning habit into a political identity.</p>
<p>The operational bet is almost industrial. Smaller stores, more pickup, fewer customized bottlenecks, and equipment that does not require a barista to be a short-order savant at 8:12 a.m. Franchisees and company-store managers have heard versions of this speech before. What is different is the willingness to close or shrink locations that look good on a real-estate map and bad on a ticket-time dashboard.</p>
<p>Labor is the slower variable. National bargaining has been stop-start, and a generation of workers learned to organize on the same app that used to order a latte. A durable settlement would not just take lawyers off the P&amp;L. It would take a boycott narrative off the brand. That is worth more than a 50-basis-point labor-cost swing, even if it photographs as a concession.</p>
<p>Rivals at the value end and the third-wave end will keep nibbling. Starbucks still has the most valuable morning real estate in American retail. The question is whether it can run that real estate like a network instead of a collection of stages.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Coffee bar with espresso machine in a busy cafe",
    category_id: "33333333-3333-3333-3333-333333333333",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
    is_featured: false,
    is_breaking: false,
    view_count: 8450,
    published_at: "2026-09-05T20:15:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    slug: "private-credit-stress-tests-regulators",
    title: "Private credit's $1.7 trillion moment: regulators want stress tests, lenders want time",
    dek: "A market that grew up in the cracks of banking is being asked to behave like one — without the deposit base or the public tape.",
    excerpt:
      "U.S. regulators are pressing nonbank lenders for more disclosure and scenario analysis as private credit becomes systemically large and still largely opaque.",
    body: `<p>WASHINGTON — Private credit is no longer a cottage industry with good lawyers. At an estimated $1.7 trillion in the United States, it is a parallel banking system that funds software roll-ups, healthcare practices, and the sort of mid-market company that used to live on a regional bank's book. Regulators have noticed. They want stress tests, or something that looks enough like stress tests to put in a speech.</p>
<p>The industry's objection is partly philosophical and partly practical. These vehicles are not deposit-taking banks. Their investors are pensions and insurers that signed up for illiquidity. Forcing bank-like liquidity assumptions onto locked-up capital, managers argue, would raise the cost of credit for exactly the borrowers banks have already stepped away from.</p>
<p>The official sector's counter is simpler: size plus opacity plus leverage, even if the leverage sits one entity over, is how the last few crises were dressed when they arrived. They are not asking for a replica of CCAR on day one. They are asking for the right to see the same loan sitting in three different funds without playing detective.</p>
<p>For corporate borrowers, the near-term effect of a heavier hand would be slower origination and slightly wider spreads — a nuisance, not a freeze. The longer-term effect is political. If private credit wants to remain the spare tire of American finance, it will have to accept that spare tires get inspected after they become the wheels.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Calculator, charts, and financial documents on a desk",
    category_id: "44444444-4444-4444-4444-444444444444",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
    is_featured: false,
    is_breaking: false,
    view_count: 16790,
    published_at: "2026-09-09T21:00:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000013",
    slug: "regional-banks-cre-capital-rebuild",
    title: "Regional banks rebuild capital, but commercial real estate still shadows earnings",
    dek: "The emergency of 2023 is over. The hangover in office loans is not.",
    excerpt:
      "U.S. regionals have thickened their capital ratios, yet office and some multifamily books continue to cap returns and keep M&A talk theoretical.",
    body: `<p>CHARLOTTE, N.C. — Regional banks have done the unglamorous work. Capital ratios are higher, deposit mixes are less skittish, and the existential headlines of 2023 have receded into case studies. What has not receded is commercial real estate, particularly office, which continues to throw off provisions, workouts, and the sort of management commentary that makes investors reach for a second cup of coffee.</p>
<p>The map is local. Sun Belt servicing economies and industrial-heavy books look like businesses. Central business district office in a handful of large metros still looks like a hope. Banks have extended, modified, and occasionally taken keys. They have not, in aggregate, marked a full cycle of distress through the income statement, because the cycle is taking its time.</p>
<p>That time is the enemy of a clean earnings multiple. Until the CRE overhang is either written down or grown out of, regional-bank stocks will trade as balance-sheet puzzles rather than as operating companies. Would-be acquirers know it. So do the boards that would rather not sell at a CRE discount.</p>
<p>Washington's mood is watchful rather than panicked. Supervisors want higher capital on the books that deserve it and fewer surprises in shared-national-credit reviews. They are not, for the moment, writing obituaries. That is progress. It is not a green light.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Downtown office towers against a clear sky",
    category_id: "44444444-4444-4444-4444-444444444444",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
    is_featured: false,
    is_breaking: false,
    view_count: 13220,
    published_at: "2026-09-08T09:35:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    slug: "irs-direct-file-tax-prep-oligopoly",
    title: "The IRS's Direct File expansion is a quiet threat to the tax-prep oligopoly",
    dek: "A government product that actually works is the scenario Intuit spent years lobbying to prevent.",
    excerpt:
      "Direct File's broader 2026 footprint is still a sliver of returns — but enough to force a political and pricing response from the private tax-prep duopoly.",
    body: `<p>WASHINGTON — The most subversive thing a government can do to a cozy industry is ship software that does not make people angry. The IRS Direct File program, expanded again for the 2026 filing season, remains a minority channel. It is also a proof of concept, and proof of concept is how oligopolies lose their pricing power — slowly, then in a hearing.</p>
<p>Intuit and H&amp;R Block still own the customer relationship for the complicated American return, the one with equity compensation, a side LLC, and a child in two states. Direct File is not hunting that customer yet. It is hunting the W-2 filer who was upsold into a product they did not need. That is a large population, and it is the one that generated both the fees and the political backlash.</p>
<p>The industry's counter is that paid software catches errors, offers audit defense, and funds a free file ecosystem that, critics say, was designed not to be found. The agency's counter is that filing a return is a civic obligation, not a retail category. Both arguments will be tested in the next appropriations cycle as much as in the next product release.</p>
<p>For investors, Direct File is not an extinction event. It is a ceiling on take-rate and a reminder that some American "markets" exist because the public option was not allowed to exist. When that condition changes, multiples should too.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Person paying at a counter with a card reader",
    category_id: "44444444-4444-4444-4444-444444444444",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
    is_featured: false,
    is_breaking: false,
    view_count: 5790,
    published_at: "2026-09-05T15:50:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000015",
    slug: "buyback-boom-cfos-2027-capex",
    title: "The buyback boom returns, even as CFOs whisper about a 2027 capex cycle",
    dek: "Companies are retiring stock with one hand and warning that the next factory — or the next data hall — will need the other.",
    excerpt:
      "S&P 500 repurchase authorizations have reaccelerated in 2026, even as finance chiefs begin to sketch a heavier capital-expenditure year just beyond the horizon.",
    body: `<p>NEW YORK — Share repurchases are back in fashion, which is another way of saying corporate America is still more confident in its own stock than in its next factory. Authorization announcements have picked up through 2026, concentrated in technology, financials, and the parts of healthcare that generate more cash than ideas. The political noise around buybacks has not disappeared. It has been priced in as a cost of doing capital allocation in public.</p>
<p>The tension sits in the 2027 sketches that CFOs keep attaching to their prepared remarks. AI-related data-center power, grid interconnects, semiconductor tools, and a delayed industrial refresh are all being described as "visible but not this year's problem." That is a polite way of saying the board would like the stock higher before the capex cycle makes free cash flow look worse.</p>
<p>There is nothing inherently cynical about that sequence. There is something fragile about it. If the cost of capital stays higher for longer, the same companies will be asked why they retired equity instead of pre-funding a build they now describe as strategic. If the cycle slips, they will be praised for discipline. Timing, as ever, is the entire job.</p>
<p>Investors should separate mechanical buybacks — offsetting dilution from compensation — from the large, discretionary programs that are a bet on multiple. The first is hygiene. The second is a house view on 2027. TradeFlock will be watching which CFOs still sound casual about that view once the first transformer lead times show up in the 10-K.</p>`,
    cover_image_url:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1600&q=80",
    cover_image_alt: "Stock market data on a digital display",
    category_id: "44444444-4444-4444-4444-444444444444",
    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
    is_featured: false,
    is_breaking: false,
    view_count: 14880,
    published_at: "2026-09-04T18:05:00.000Z",
  },
];

export const SEED_ARTICLES: ArticleWithRelations[] = articles.map((article) => ({
  ...article,
  category: categoryById[article.category_id],
  author: authorById[article.author_id],
}));
