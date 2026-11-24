/**
 * The parameters of every formula this version of the library knows, one type each. Written from the API's
 * parameter schemas (`<Name>Params` in its OpenAPI document): do not edit by hand. A formula that is not here takes
 * its parameters as a plain map, as any formula does.
 *
 * ```ts
 * const params: JobOrderHunterParams = { job_titles: ['Java Developer'], locations: ['London'] };
 * const run = await client.formulas.run('job-order-hunter', params);
 * ```
 */

import type { JSONObject } from './types';

/** A range of whole numbers, both ends included. */
export interface IntRange {
  min: number;
  max: number;
}

/**
 * Account Hiring Check (`account-hiring-check`): Every account in your CRM flagged hiring or not, with its open
 * roles, departments and the roles you care about.
 */
export interface AccountHiringCheckParams {
  /**
   * Accounts: Each account's website domain, as in your CRM (acme.com). Upload a CSV for many. 1 to 100 items.
   * Required.
   */
  accounts: string[];
  /**
   * Roles you care about: Openings whose title holds one of these as a whole word or phrase are counted apart, such
   * as Data Engineer. At most 20 items. Default: [].
   */
  roles_of_interest?: string[];
  /** New within (days): An opening posted in the last this many days counts as new. From 1 to 180. Default: 30. */
  new_within_days?: number;
  /**
   * Hiring at this many openings: An account with at least this many openings is flagged hiring. At least 1.
   * Default: 1.
   */
  hiring_threshold?: number;
  /**
   * Count only tracking-system openings: Counts only openings an applicant tracking system lists. What a careers
   * page's own text shows is counted apart, as unconfirmed. Default: true.
   */
  verified_only?: boolean;
  /** Most rows: One row per account; the run stops at this many, most active first. From 1 to 5000. Default: 1000. */
  max_results?: number;
}

/**
 * Account Research (`account-research`): For each company domain, what its site and company page say, a line of
 * research and a compliment built only from facts.
 */
export interface AccountResearchParams {
  /** Company websites: Each company's domain or website address, typed or from a CSV. 1 to 500 items. Required. */
  domains: string[];
  /**
   * Read their LinkedIn company page: When the site links to one; adds industry, size, headquarters and when it was
   * founded. Default: true.
   */
  read_company_page?: boolean;
  /**
   * Read the technologies of their site: The site's platform, analytics and tools, as its own pages reveal them.
   * Default: true.
   */
  read_technologies?: boolean;
  /** Most rows: The run stops at this many companies. From 1 to 500. Default: 500. */
  max_results?: number;
}

/**
 * Acquisition Universe (`acquisition-universe`): Every business of your acquisition thesis in your metros, off the
 * market from Google Maps and on it from sale listings.
 */
export interface AcquisitionUniverseParams {
  /**
   * Kinds of business: What you would buy, as you would search Google Maps for it, such as HVAC contractor or
   * landscaping company. 1 to 5 items. Required.
   */
  thesis: string[];
  /** Metros: A city or metro for each place, with its state. 1 to 10 items. Required. */
  metros: string[];
  /**
   * States for listings: The US states, by name, whose businesses for sale are read. Empty reads none. At most 10
   * items. Default: [].
   */
  states?: string[];
  /**
   * Words a listing must hold: Whole words a for-sale listing's title or summary must hold, such as HVAC or air
   * conditioning. Empty uses the kinds of business. At most 10 items. Default: [].
   */
  listing_words?: string[];
  /**
   * Places read per search: How many places Google Maps is read for, for each kind of business in each metro. From
   * 10 to 300. Default: 60.
   */
  places_per_search?: number;
  /**
   * Fewest reviews: Places with fewer reviews are left out; a business with none may be too small or not trading.
   * At least 0. Default: 0.
   */
  min_reviews?: number;
  /**
   * Most reviews: Places with more reviews are left out; the largest are rarely owner-run. At least 0. Default:
   * 1000000.
   */
  max_reviews?: number;
  /**
   * Leave out chains: A name found five or more times in the results is taken for a chain and left out. Default:
   * true.
   */
  exclude_chains?: boolean;
  /**
   * Larger companies without their name: BusinessesForSale.com's M&A Vault describes larger companies without
   * naming them, from any country. Default: false.
   */
  include_vault?: boolean;
  /**
   * Read each website for an address: The address each business's own website publishes, checked. Off saves one
   * read a business. Default: true.
   */
  find_email?: boolean;
  /**
   * Show a business again after (days): For a saved formula, how long before a delivered business or listing may
   * come back. From 1 to 365. Default: 180.
   */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many rows, listings first, then the places with the most reviews. From 1 to
   * 5000. Default: 300.
   */
  max_results?: number;
}

/**
 * Ad-Activity Trigger (`ad-activity-trigger`): Companies running ads about your topic on Meta and LinkedIn now,
 * sized up, with their marketing lead to contact.
 */
export interface AdActivityTriggerParams {
  /**
   * What the ads are about: Words the ads say, each searched in each library, such as "payroll software". 1 to 5
   * items. Required.
   */
  keywords: string[];
  /** Countries: Where the ads are shown, as two-letter codes such as US or GB. 1 to 5 items. Default: ["US"]. */
  countries?: string[];
  /**
   * Ad libraries: Meta covers Facebook and Instagram. Each one of "meta", "linkedin". At least 1 item. Default:
   * ["meta", "linkedin"].
   */
  platforms?: Array<'meta' | 'linkedin'>;
  /**
   * Ads started within (days): Meta says when each ad started; older ones are left out. LinkedIn's library does not
   * say, and its ads are kept. From 1 to 365. Default: 90.
   */
  started_within_days?: number;
  /** Ads read per search: How many ads to read for each phrase, country and library. From 5 to 100. Default: 30. */
  ads_per_search?: number;
  /** Least ads: Ads a company needs to be running to be listed. At least 1. Default: 1. */
  min_ads?: number;
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 2, "max": 10000}. */
  company_size?: IntRange;
  /** Companies to leave out: Names or domains, such as your existing customers. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /**
   * Who to contact: The roles a connected people provider looks for at each company. Default: ["Chief Marketing
   * Officer", "VP Marketing", "Head of Marketing", "Marketing Director", "Head of Growth"].
   */
  buyer_titles?: string[];
  /** Contacts per company: 0 keeps one row per company. From 0 to 5. Default: 2. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /** Most rows: The run stops at this many rows, the most active advertisers first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Ad Creative Research (`ad-creative-research`): A competitor's ads on Meta, Google Ads and LinkedIn, with copy,
 * landing page and how long each has run, longest first.
 */
export interface AdCreativeResearchParams {
  /**
   * Competitors: Each competitor's name as it advertises, such as Canva or HubSpot. Ads are kept where the
   * advertiser's name holds it as a whole word. 1 to 10 items. Required.
   */
  competitors: string[];
  /**
   * Their websites: The competitors' websites, such as canva.com. Google Ads are found by the website they lead to,
   * so Google Ads is searched only when you give one. At most 10 items. Default: [].
   */
  domains?: string[];
  /**
   * Ad libraries: Meta covers Facebook, Instagram, Messenger and Threads; Google Ads covers Search, YouTube and the
   * display network. Each one of "meta", "google", "linkedin". At least 1 item. Default: ["meta", "google",
   * "linkedin"].
   */
  libraries?: Array<'meta' | 'google' | 'linkedin'>;
  /**
   * Country: Only ads shown in this country, as a two-letter code such as US or DE. Leave empty for every country.
   * Default: "".
   */
  country?: string;
  /**
   * Only ads running now: Leaves out ads that have stopped. Off, a stopped ad still shows how long an angle lasted.
   * Default: false.
   */
  running_only?: boolean;
  /**
   * Least days running: Only ads that have run at least this many days; 30 keeps the angles an advertiser kept
   * paying for. From 0 to 3650. Default: 0.
   */
  min_days_running?: number;
  /**
   * Facebook Page ids: For an exact Meta search, the competitor's Page id (the number after view_all_page_id= in
   * the Ad Library's address). Every ad of the Page is read. At most 10 items. Default: [].
   */
  facebook_page_ids?: string[];
  /**
   * Ads read per search: The most ads read for each competitor in each library. Each ad read is one unit. From 5 to
   * 120. Default: 30.
   */
  ads_per_search?: number;
  /**
   * Read each LinkedIn ad's page: LinkedIn's search shows no dates or landing page; each ad's own page has them,
   * for one unit an ad. Default: true.
   */
  linkedin_ad_pages?: boolean;
  /** Most rows: The run stops at this many ads, longest running first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Agency Ad Mining (`agency-ad-mining`): Jobs competing agencies advertise, what they say about the client, and the
 * employers posting the same job directly.
 */
export interface AgencyAdMiningParams {
  /** Job titles: The roles you work, each searched as you type it. 1 to 10 items. Required. */
  job_titles: string[];
  /** Locations: A city, region or country for each market you watch. 1 to 10 items. Required. */
  locations: string[];
  /** Posted within (days): Only postings from the last this many days. From 1 to 30. Default: 7. */
  posted_within_days?: number;
  /**
   * Only these agencies: Names of the competing agencies to watch. Leave empty for every agency. At most 50 items.
   * Default: [].
   */
  agencies?: string[];
  /**
   * Job boards: Which boards to search. Reed and Dice say who placed a posting; Reed and Totaljobs cover the UK,
   * Dice technology roles in the US. Each one of "linkedin", "indeed", "reed", "totaljobs", "dice". At least 1
   * item. Default: ["linkedin", "reed", "dice"].
   */
  sources?: Array<'linkedin' | 'indeed' | 'reed' | 'totaljobs' | 'dice'>;
  /**
   * Jobs read per search: How many postings to read for each title, place and board, agencies' and employers'
   * alike. From 5 to 200. Default: 50.
   */
  results_per_search?: number;
  /**
   * Agency postings read in full: The newest agency postings whose full text is read for what they say about the
   * client. From 5 to 300. Default: 60.
   */
  postings_read?: number;
  /**
   * Words that describe the client: The first of these a posting uses is quoted with the sentence around it.
   * Default: ["our client", "my client", "on behalf of", "client is", "client based in", "working with a", "a
   * leading", "well-established"].
   */
  client_phrases?: string[];
  /** Most rows: The run stops at this many rows, best first. From 1 to 2000. Default: 100. */
  max_results?: number;
}

/**
 * Agency Lists (`agency-lists`): Agencies by service and place with size, age, rates, minimum project, services and
 * reviews, for partnering or buying.
 */
export interface AgencyListsParams {
  /**
   * Clutch directories: Each as in its address on clutch.co, the service then the place: agencies/seo,
   * web-developers/new-york, uk/agencies/digital-marketing/london, or the whole address. 1 to 10 items. Required.
   */
  directories: string[];
  /**
   * Pages to read: Pages of each directory to read; a page lists about 50 to 80 agencies. From 1 to 10. Default: 2.
   */
  pages?: number;
  /**
   * What the list is for: Partner ranks agencies by rating, reviews and a published email. Acquisition ranks
   * established agencies first: ten years or more in business, 10 to 249 staff, and a body of reviews. One of
   * "partner", "acquisition". Default: "partner".
   */
  purpose?: 'partner' | 'acquisition';
  /**
   * Head count: Agencies whose head count on Clutch falls outside this range are left out; an agency that does not
   * say is kept. Default: {"min": 2, "max": 1000}.
   */
  employees?: IntRange;
  /**
   * Founded in or before: Only agencies founded in this year or earlier, such as 2015 for ten years in business.
   * Empty for any. From 1900 to 2100. Default: null.
   */
  founded_before?: JSONObject;
  /**
   * Highest hourly rate (USD): Agencies whose lowest hourly rate is above this are left out. 0 for any. From 0 to
   * 1000. Default: 0.
   */
  max_hourly_rate?: number;
  /**
   * Largest minimum project (USD): Agencies that take no project smaller than this are left out. 0 for any. From 0
   * to 10000000. Default: 0.
   */
  max_min_project?: number;
  /**
   * Sells one of these services: Words from Clutch's service names, such as SEO, Pay Per Click or Web Development.
   * Leave empty for any. At most 20 items. Default: [].
   */
  services?: string[];
  /**
   * Office in these countries: Two-letter country codes (GB, US). A directory of a place also lists sponsors based
   * elsewhere; this leaves them out. At most 50 items. Default: [].
   */
  countries?: string[];
  /** Lowest rating: Agencies rated below this on Clutch are left out. From 0 to 5. Default: 0. */
  min_rating?: number;
  /** Fewest reviews: Agencies with fewer Clutch reviews are left out. At least 0. Default: 0. */
  min_reviews?: number;
  /**
   * Only agencies with an email: Keeps the agencies whose own website publishes an email address that passes the
   * check. Default: false.
   */
  require_email?: boolean;
  /**
   * Agencies to leave out: Names or domains, such as agencies you already work with. At most 5000 items. Default:
   * [].
   */
  exclude_companies?: string[];
  /**
   * Most rows: The run stops at this many agencies, best first. Each agency's profile and website are read, so this
   * sets the cost. From 1 to 2000. Default: 100.
   */
  max_results?: number;
}

/**
 * Funding and Announcement Trigger (`announcement-trigger`): Companies that just announced funding, an expansion, a
 * launch or a senior hire, with who to contact and the fact.
 */
export interface AnnouncementTriggerParams {
  /**
   * Kinds of news: Which announcements to look for. Each one of "funding", "expansion", "product_launch",
   * "executive_hire", "acquisition". At least 1 item. Required.
   */
  event_types: Array<'funding' | 'expansion' | 'product_launch' | 'executive_hire' | 'acquisition'>;
  /**
   * Words in the news: Only releases that hold one of these words, such as fintech or healthcare. Leave empty for
   * any. At most 5 items. Default: [].
   */
  keywords?: string[];
  /** Published within (days): Only releases from the last this many days. From 1 to 30. Default: 3. */
  published_within_days?: number;
  /**
   * News sources: The press-release wires, and Google News for stories as well as releases. Each one of
   * "prnewswire", "globenewswire", "google_news". At least 1 item. Default: ["prnewswire", "globenewswire"].
   */
  sources?: Array<'prnewswire' | 'globenewswire' | 'google_news'>;
  /**
   * Releases read in full: How many of the newest matching releases are opened to read who, how much and who
   * invested. From 5 to 200. Default: 60.
   */
  releases_to_read?: number;
  /**
   * Places: Countries, states or cities the company or the release is from. Leave empty for anywhere. Default: [].
   */
  regions?: string[];
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 1, "max": 10000}. */
  company_size?: IntRange;
  /** Only these industries: Leave empty for any. Default: []. */
  industries_include?: string[];
  /** Companies to leave out: Names or domains, such as customers. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /**
   * Who to contact: The roles of the people to find at each company. Default: ["Chief Executive Officer",
   * "Founder", "VP Sales"].
   */
  buyer_titles?: string[];
  /**
   * Contact the new executive: For a senior hire, look for the person in the new role rather than the roles above.
   * Default: false.
   */
  contact_new_executive?: boolean;
  /** Contacts per company: 0 turns contacts off. From 0 to 5. Default: 1. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /** Most rows: The run stops at this many rows, newest first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * App Intelligence (`app-intelligence`): Ratings, versions, release notes and chart ranks of apps on the App Store
 * and Google Play, with what changed since last run.
 */
export interface AppIntelligenceParams {
  /**
   * Apps: App Store apps by their number (the digits after id in the app's address) or their App Store link; Google
   * Play apps by their package name, such as com.spotify.music. 1 to 100 items. Required.
   */
  apps: string[];
  /**
   * Search words: Also the apps that rank in the stores' search for these words, such as habit tracker. At most 10
   * items. Default: [].
   */
  search_terms?: string[];
  /**
   * Top chart: Also the top apps of this category's chart, with their rank. An app you named gets its rank when it
   * is on the chart. One of "none", "all", "books", "business", "education", "entertainment", "finance",
   * "food_and_drink", "games", "health_and_fitness", "lifestyle", "medical", "music", "navigation", "news",
   * "photo_and_video", "productivity", "shopping", "social_networking", "sports", "travel", "utilities", "weather".
   * Default: "none".
   */
  chart_category?: 'none' | 'all' | 'books' | 'business' | 'education' | 'entertainment' | 'finance' | 'food_and_drink' | 'games' | 'health_and_fitness' | 'lifestyle' | 'medical' | 'music' | 'navigation' | 'news' | 'photo_and_video' | 'productivity' | 'shopping' | 'social_networking' | 'sports' | 'travel' | 'utilities' | 'weather';
  /**
   * Stores: The stores searched and charted. Apps you name are read in their own store. Each one of "app_store",
   * "google_play". At least 1 item. Default: ["app_store", "google_play"].
   */
  stores?: Array<'app_store' | 'google_play'>;
  /** Chart: Top free, top paid or top grossing. One of "free", "paid", "grossing". Default: "free". */
  chart?: 'free' | 'paid' | 'grossing';
  /** Chart places read: How many of the chart's top apps are read in each store. From 5 to 100. Default: 25. */
  chart_size?: number;
  /**
   * Apps read per search: How many of the top results of each search word are read in each store. From 1 to 50.
   * Default: 10.
   */
  apps_per_search?: number;
  /**
   * Store country: The country's store, as a two-letter code such as us, gb or de. Ratings and charts differ by
   * country. Default: "us".
   */
  country?: string;
  /** Lowest rating: Leaves out apps rated below this. Apps you name are always kept. From 0 to 5. Default: 0. */
  min_rating?: number;
  /**
   * Recent reviews read per app: Reads this many of each app's newest reviews for its recent rating and the share
   * of one- and two-star reviews. Each review read is one unit; 0 turns it off. From 0 to 100. Default: 0.
   */
  recent_reviews?: number;
  /**
   * Most rows: The run stops at this many apps, those with the biggest changes first. From 1 to 1000. Default: 200.
   */
  max_results?: number;
}

/**
 * Award Teaming Leads (`award-teaming`): Companies that just won government contracts in your field, with what they
 * won, their website and the email they publish.
 */
export interface AwardTeamingParams {
  /**
   * NAICS codes: The industry codes of the work, 2 to 6 digits, such as 541512 (computer systems design). Each is
   * searched on its own. At most 10 items. Default: [].
   */
  naics_codes?: string[];
  /**
   * Words: Words in the award's description, such as cybersecurity or janitorial. Each is searched on its own. At
   * most 10 items. Default: [].
   */
  keywords?: string[];
  /**
   * Awarding departments: US departments by their full name, such as Department of Defense or Department of
   * Veterans Affairs. At most 5 items. Default: [].
   */
  agencies?: string[];
  /**
   * Awarded within (days): Awards whose work started, or whose notice was published, in the last this many days.
   * Recently signed work that starts later is kept. From 7 to 364. Default: 30.
   */
  awarded_within_days?: number;
  /**
   * Where awards are read: USAspending.gov (US federal contracts), SAM.gov award notices where offered, and TED (EU
   * contract awards). Each one of "usaspending", "sam_gov", "ted". At least 1 item. Default: ["usaspending",
   * "sam_gov"].
   */
  sources?: Array<'usaspending' | 'sam_gov' | 'ted'>;
  /**
   * Places of performance: Only US awards for work done in these states, as two letters, such as VA or TX. At most
   * 10 items. Default: [].
   */
  us_states?: string[];
  /**
   * Buyers' countries (TED): Only EU awards made by buyers in these countries, as three letters, such as DEU or
   * FRA. At most 10 items. Default: [].
   */
  countries?: string[];
  /**
   * Smallest award: Awards below this amount, in the award's currency, are left out. An award that states no amount
   * is kept. At least 0. Default: 100000.
   */
  min_award_amount?: number;
  /**
   * Winner's size: Small businesses or large primes, as USAspending records them. A winner it has no record of is
   * kept only for any. One of "any", "small_business", "other_than_small". Default: "any".
   */
  winner_size?: 'any' | 'small_business' | 'other_than_small';
  /**
   * Companies to leave out: Names, such as your competitors or the partners you already have. At most 1000 items.
   * Default: [].
   */
  exclude_companies?: string[];
  /**
   * Only companies with an email: Keeps the companies whose own website publishes an email address that passes the
   * check. Default: true.
   */
  require_email?: boolean;
  /**
   * Pages read per search: Each page is the next 100 awards, newest first. Raise it for a busy code or a long
   * window. From 1 to 5. Default: 2.
   */
  pages_per_search?: number;
  /** Most rows: The run stops at this many companies, the biggest winners first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Broken Link Prospects (`broken-link-prospects`): Resource pages on your topic that link to pages or sites that
 * are gone, each with the dead link and the site's email.
 */
export interface BrokenLinkProspectsParams {
  /**
   * Topic: The subject of the resource pages, as people search for it, such as genealogy or home schooling.
   * Required.
   */
  topic: string;
  /**
   * Footprints: Words searched beside the topic to find resource pages, each its own search. Quote a phrase to find
   * it exactly. 1 to 12 items. Default: ["\"useful links\"", "\"helpful resources\"", "\"recommended resources\"",
   * "\"helpful links\"", "\"resource list\"", "resources"].
   */
  footprints?: string[];
  /**
   * Resource pages to check: How many resource pages are read and have their links checked, one page per site, best
   * placed first. From 1 to 30. Default: 10.
   */
  pages_to_read?: number;
  /**
   * Links looked at per page: The first this many links of each page are looked at, and those to other sites are
   * checked, one unit each. From 10 to 100. Default: 80.
   */
  links_per_page?: number;
  /**
   * Results pages per search: How many pages of results to read for each footprint, about ten results a page. From
   * 1 to 3. Default: 1.
   */
  search_pages?: number;
  /**
   * Sites to leave out: Domains whose pages are not read and whose links are not checked, such as social networks
   * and share buttons. At most 2000 items. Default: a list of 22 values, which `get` on the formula shows.
   */
  exclude_domains?: string[];
  /** Search country: The two-letter country whose search results are read, such as us, gb or de. Default: "us". */
  country?: string;
  /** Search language: The language of the results, such as en or de. Default: "en". */
  language?: string;
  /**
   * Only sites with an email: Keeps the pages whose site publishes an email address that passes the check. Default:
   * false.
   */
  require_email?: boolean;
  /**
   * Show a broken link again after (days): For a saved formula, how long before a delivered broken link may come
   * back. From 1 to 365. Default: 90.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many broken links, gone sites first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Broker Directory (`broker-directory`): The business brokers of your states, one row for each firm, with
 * specialties, designations and their current listings.
 */
export interface BrokerDirectoryParams {
  /**
   * States: US states or Canadian provinces, by name or two-letter code. Listings are read for US states only. 1 to
   * 10 items. Required.
   */
  states: string[];
  /**
   * Specialties: IBBA brokers who list one of these industries. Empty keeps every broker. Each one of
   * "accommodations", "agriculture", "arts", "auto-related-business", "business-services", "construction",
   * "ecommerce", "education-services", "entertainment-recreation", "finance-insurance", "food-beverage",
   * "health-care-social-assistance", "industrial-services", "information", "logistics", "manufacturing",
   * "print-and-media", "public-administration", "real-estate-rental-leasing", "retail-trade", "technical-services",
   * "transportation", "waste-management", "wholesale-trade". Default: [].
   */
  specialties?: Array<'accommodations' | 'agriculture' | 'arts' | 'auto-related-business' | 'business-services' | 'construction' | 'ecommerce' | 'education-services' | 'entertainment-recreation' | 'finance-insurance' | 'food-beverage' | 'health-care-social-assistance' | 'industrial-services' | 'information' | 'logistics' | 'manufacturing' | 'print-and-media' | 'public-administration' | 'real-estate-rental-leasing' | 'retail-trade' | 'technical-services' | 'transportation' | 'waste-management' | 'wholesale-trade'>;
  /**
   * Designation: IBBA brokers holding this designation, such as CBI (Certified Business Intermediary) or M&AMI. One
   * of "any", "cbi", "mami", "master_cbi", "cbi_or_mami". Default: "any".
   */
  certification?: 'any' | 'cbi' | 'mami' | 'master_cbi' | 'cbi_or_mami';
  /**
   * Add the firms selling businesses now: Reads the state's businesses for sale on BusinessesForSale.com, and each
   * brokered one's page for its firm. Default: true.
   */
  include_listings?: boolean;
  /** Listing pages read a state: BusinessesForSale.com's pages of 25, newest first. From 1 to 4. Default: 2. */
  listing_pages?: number;
  /**
   * Fewest listings now: Keep firms with at least this many of the listings read. 0 keeps every broker. At least 0.
   * Default: 0.
   */
  min_listings?: number;
  /** Only brokers who name a firm: Leaves out IBBA members whose profile names no firm. Default: false. */
  firms_only?: boolean;
  /**
   * Read each website for an address: The address each firm's own website publishes, checked. Off saves one read a
   * firm. Default: true.
   */
  find_email?: boolean;
  /**
   * Show a firm again after (days): For a saved formula, how long before a delivered firm may come back. From 1 to
   * 365. Default: 180.
   */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many firms, those with the most listings and brokers first. From 1 to 2000.
   * Default: 200.
   */
  max_results?: number;
}

/**
 * Business-for-Sale Alerts (`business-for-sale-alerts`): Businesses newly listed for sale in your states and
 * sectors, with asking price, revenue, cash flow, sector and broker.
 */
export interface BusinessForSaleAlertsParams {
  /** States: US states, by name, such as Texas or North Carolina. 1 to 10 items. Required. */
  states: string[];
  /**
   * Kinds of business: Words a listing's title or summary must hold as whole words, such as laundromat or HVAC.
   * Empty keeps every kind. At most 10 items. Default: [].
   */
  keywords?: string[];
  /**
   * Least cash flow ($): The yearly cash flow or net profit a listing must state. 0 keeps every listing. At least
   * 0. Default: 0.
   */
  min_cash_flow?: number;
  /** Highest asking price ($): Listings asking more are left out. 0 sets no limit. At least 0. Default: 0. */
  max_asking_price?: number;
  /** Lowest asking price ($): Listings asking less are left out. At least 0. Default: 0. */
  min_asking_price?: number;
  /** Least revenue ($): The yearly revenue a listing must state. 0 keeps every listing. At least 0. Default: 0. */
  min_revenue?: number;
  /**
   * Keep listings that withhold a figure: A listing whose cash flow, revenue or price is on request is kept rather
   * than judged by a number it does not give. Default: true.
   */
  keep_undisclosed?: boolean;
  /**
   * Sold by: Every listing, only those a broker sells, or only those the owner sells. One of "any", "broker",
   * "owner". Default: "any".
   */
  seller?: 'any' | 'broker' | 'owner';
  /**
   * Marketplaces: BusinessesForSale.com and BusinessBroker.net. Each one of "businessesforsale", "businessbroker".
   * At least 1 item. Default: ["businessesforsale", "businessbroker"].
   */
  sources?: Array<'businessesforsale' | 'businessbroker'>;
  /**
   * Pages read a state: BusinessesForSale.com's pages of 25, newest first; BusinessBroker.net's first page of about
   * 30 is read either way. From 1 to 4. Default: 2.
   */
  pages?: number;
  /**
   * Larger companies without their name: BusinessesForSale.com's M&A Vault describes larger companies without
   * naming them, from any country, among a state's listings. Default: false.
   */
  include_vault?: boolean;
  /**
   * Read each listing's page: For the sector, employees, year founded, premises, reason for selling and the broker.
   * Off saves one read a listing. Default: true.
   */
  read_listings?: boolean;
  /**
   * Show a listing again after (days): For a saved formula, how long before a delivered listing may come back. From
   * 1 to 365. Default: 365.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many listings, highest cash flow first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Candidate Reverse Marketing (`candidate-reverse-marketing`): Companies hiring for what your best candidate does,
 * with the skills they ask for, who decides, and an opening line.
 */
export interface CandidateReverseMarketingParams {
  /**
   * Roles the candidate fits: The job titles your candidate would be hired as, each searched as you type it. 1 to 5
   * items. Required.
   */
  candidate_titles: string[];
  /**
   * The candidate's skills: Tools, methods or certificates the candidate has. A posting is kept when it asks for
   * enough of them. 1 to 15 items. Required.
   */
  skills: string[];
  /**
   * Where they will work: A city, region or country for each place the candidate would work. 1 to 5 items.
   * Required.
   */
  locations: string[];
  /**
   * Posted within (days): Only postings from the last this many days; a fresh posting is still unfilled. From 1 to
   * 30. Default: 7.
   */
  posted_within_days?: number;
  /**
   * Job boards: Which boards to search. Reed and Totaljobs cover the UK; Dice is technology roles in the US. Each
   * one of "linkedin", "indeed", "reed", "totaljobs", "dice". At least 1 item. Default: ["linkedin", "indeed"].
   */
  sources?: Array<'linkedin' | 'indeed' | 'reed' | 'totaljobs' | 'dice'>;
  /** Jobs read per search: How many postings to read for each role, place and board. From 5 to 100. Default: 25. */
  results_per_search?: number;
  /**
   * Least skills a posting must ask for: Of the candidate's skills, how many a posting has to name to be kept. From
   * 1 to 10. Default: 2.
   */
  min_skills_matched?: number;
  /**
   * Postings read in full: The newest postings whose full text is read to match skills; each costs a unit when the
   * board gave only a summary. From 10 to 300. Default: 80.
   */
  postings_read?: number;
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 11, "max": 10000}. */
  company_size?: IntRange;
  /**
   * Companies to leave out: Names or domains, such as the candidate's current employer or companies they already
   * applied to. At most 5000 items. Default: [].
   */
  exclude_companies?: string[];
  /** Words to leave out of titles: For example junior or intern. Default: []. */
  title_exclude_keywords?: string[];
  /**
   * Who to contact: Leave empty to look for whoever decides on that kind of hire, such as the VP Engineering for a
   * developer. Default: [].
   */
  contact_titles?: string[];
  /** Contacts per company: 0 turns contacts off. From 0 to 5. Default: 1. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /** Most rows: The run stops at this many rows, best first. From 1 to 1000. Default: 50. */
  max_results?: number;
}

/**
 * Champion Tracker (`champion-tracker`): People who held your champions' roles at your accounts and moved on, found
 * at their new company, with contact details.
 */
export interface ChampionTrackerParams {
  /**
   * Accounts: The website domains of the accounts where your champions work or worked, such as your customers. 1 to
   * 100 items. Required.
   */
  accounts: string[];
  /** Champion roles: The roles your champions held, such as VP Sales. 1 to 10 items. Required. */
  champion_titles: string[];
  /**
   * Who to find: moved: people who held these roles at the account and left, where they are now. successor: who
   * holds them at the account today. One of "moved", "successor". Default: "moved".
   */
  track?: 'moved' | 'successor';
  /**
   * Least employees at the new company: Only follow people to companies at least this big. 1 follows everyone. At
   * least 1. Default: 1.
   */
  min_employees?: number;
  /**
   * New companies to leave out: Domains of companies not to follow people to, such as competitors or customers
   * already won. At most 5000 items. Default: [].
   */
  exclude_companies?: string[];
  /** People per account: The most people to find for each account. From 1 to 10. Default: 3. */
  people_per_account?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /**
   * Show a person again after (days): For a saved formula, how long before a person already delivered may come
   * back. From 1 to 365. Default: 180.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many people, best first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Company Diligence (`company-diligence`): Each company you name checked on its register, in adverse news, reviews
 * and complaints, and its website, with red flags.
 */
export interface CompanyDiligenceParams {
  /**
   * Companies: Each company by its name, its register number (a UK company number such as 09446231, a Swedish
   * organisation number such as 556703-7485) or its website's domain. A name is searched as written, in the news
   * too, so give the name the company is known by (Thames Water, not Thames Water Utilities Limited); a domain also
   * lets its reviews and website be read. 1 to 200 items. Required.
   */
  companies: string[];
  /**
   * Country: Where the companies are registered. The UK and Sweden have their register read; the US and Canada have
   * the Better Business Bureau read. The news, reviews and website checks run everywhere. One of "GB", "US", "CA",
   * "SE", "IE", "AU", "other". Default: "GB".
   */
  country?: 'GB' | 'US' | 'CA' | 'SE' | 'IE' | 'AU' | 'other';
  /**
   * Place, for the Better Business Bureau: The city or state the companies trade in (Austin, TX). Only used in the
   * US and Canada, to find the right business. Default: "".
   */
  location?: string;
  /**
   * Checks: Which checks to run. Each costs about one unit a company; finding a company's website from its name
   * costs a few more. Each one of "register", "news", "press_releases", "reviews", "website". At least 1 item.
   * Default: ["register", "news", "press_releases", "reviews", "website"].
   */
  checks?: Array<'register' | 'news' | 'press_releases' | 'reviews' | 'website'>;
  /**
   * Adverse words: The news is searched for the company together with these words, and a headline that holds one is
   * counted as adverse. 1 to 30 items. Default: a list of 18 values, which `get` on the formula shows.
   */
  adverse_words?: string[];
  /**
   * What the check is for: Counterparty weighs the register and adverse news most. Acquisition also weighs customer
   * reviews and complaints, which say most about a small business a buyer is about to take on. One of
   * "counterparty", "acquisition". Default: "counterparty".
   */
  focus?: 'counterparty' | 'acquisition';
  /** News within (days): How far back the news and the press releases are read. From 30 to 1825. Default: 365. */
  window_days?: number;
  /** Most rows: The run stops at this many companies, riskiest first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Competitor Price Tracker (`competitor-price-tracker`): Every product and price of competitors' Shopify stores and
 * Amazon listings, read on a schedule, with what changed since last time.
 */
export interface CompetitorPriceTrackerParams {
  /**
   * Competitor stores: Shopify stores by domain, such as allbirds.com. Each store's whole catalogue is read. At
   * most 20 items. Required.
   */
  stores: string[];
  /** Amazon listings: Competitors' Amazon products by ASIN, read one by one. At most 100 items. Default: []. */
  asins?: string[];
  /**
   * Only products about: Keep products whose title or type holds one of these. Empty keeps every product. At most
   * 20 items. Default: [].
   */
  keywords?: string[];
  /**
   * Store collection: Read only this collection of each store, by its handle (the name in /collections/<handle>).
   * Empty reads the whole catalogue. Default: "".
   */
  collection?: string;
  /**
   * Products read per store: A store's catalogue is read 250 products at a time; this many are read. From 10 to
   * 250. Default: 250.
   */
  products_per_store?: number;
  /**
   * Amazon marketplace: Which Amazon the listings are on. One of "us", "uk", "de", "fr", "it", "es", "ca". Default:
   * "us".
   */
  amazon_marketplace?: 'us' | 'uk' | 'de' | 'fr' | 'it' | 'es' | 'ca';
  /**
   * Only what changed: Show only products that are new or whose price, compare-at price or stock changed since the
   * last run. Default: false.
   */
  only_changes?: boolean;
  /** Most rows: The run stops at this many products, changes first. From 1 to 5000. Default: 1000. */
  max_results?: number;
}

/**
 * Competitor Review Mining (`competitor-review-mining`): Your competitors' newest one- and two-star reviews, each
 * with what went wrong, to sell against and to win their customers.
 */
export interface CompetitorReviewMiningParams {
  /**
   * Competitors: Each competitor's website domain, as Trustpilot lists it, such as gusto.com. 1 to 20 items.
   * Required.
   */
  competitors: string[];
  /** Stars: Which reviews to read, by their stars. At least 1 item. Default: [1, 2]. */
  stars?: number[];
  /**
   * Phrases to look for: Words you can answer, such as "customer service" or "hidden fees"; each match is quoted.
   * At most 30 items. Default: [].
   */
  phrases?: string[];
  /** Written within (days): Only reviews written in the last this many days. From 1 to 730. Default: 180. */
  published_within_days?: number;
  /** Pages per competitor: Twenty reviews a page, newest first. From 1 to 3. Default: 2. */
  pages_per_competitor?: number;
  /** Only reviews with a phrase: Keeps only the reviews that contain one of your phrases. Default: false. */
  only_matching?: boolean;
  /**
   * Show a review again after (days): For a saved formula, a review once delivered is not delivered again before
   * this. From 1 to 365. Default: 365.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many reviews, the best matches first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Compound Signal Score (`compound-signal-score`): Your target accounts scored by what they are doing now: hiring,
 * raising, new leaders, expanding and advertising.
 */
export interface CompoundSignalScoreParams {
  /**
   * Accounts: The companies to score, by name, by domain, or both as Rippling (rippling.com); a domain given needs
   * no search to match. 1 to 50 items. Required.
   */
  accounts: string[];
  /** Look back (days): How recent news, postings and ads must be to count. From 7 to 180. Default: 30. */
  window_days?: number;
  /**
   * Signals to read: What to read for each account. Each costs units for every account. Each one of "hiring",
   * "announcements", "ads". At least 1 item. Default: ["hiring", "announcements", "ads"].
   */
  signals?: Array<'hiring' | 'announcements' | 'ads'>;
  /**
   * Weight of hiring: Points for open roles on its careers page, in full at ten roles or more. From 0 to 100.
   * Default: 30.
   */
  weight_hiring?: number;
  /** Weight of funding: Points for a funding announcement in the window. From 0 to 100. Default: 25. */
  weight_funding?: number;
  /** Weight of a senior hire: Points for an announced executive hire in the window. From 0 to 100. Default: 15. */
  weight_executive?: number;
  /**
   * Weight of an expansion: Points for an announced expansion or new office in the window. From 0 to 100. Default:
   * 10.
   */
  weight_expansion?: number;
  /** Weight of a launch: Points for an announced product launch in the window. From 0 to 100. Default: 5. */
  weight_launch?: number;
  /** Weight of advertising: Points for ads shown in the window. From 0 to 100. Default: 15. */
  weight_ads?: number;
  /**
   * Most open roles: Leave out accounts with more open roles than this, to find those that will hire before they
   * post. At least 0. Default: 100000.
   */
  max_open_roles?: number;
  /**
   * Ads read per account: How many of an account's newest ads are read; each costs a unit. From 1 to 40. Default:
   * 10.
   */
  ads_read?: number;
  /** Least score: Accounts scoring below this are left out. At least 0. Default: 0. */
  min_score?: number;
  /** Most rows: The run stops at this many accounts, best first. From 1 to 50. Default: 50. */
  max_results?: number;
}

/**
 * Contractor Licence Watch (`contractor-license-watch`): Contractor businesses whose licence, bond or insurance
 * expires in the next weeks, from official state and city registers.
 */
export interface ContractorLicenseWatchParams {
  /**
   * Register: Washington L&I, Texas TDLR, Oregon CCB (with bond and insurance dates), Chicago home repair, Buffalo,
   * or New York's mold and elevator contractors. One of "washington", "texas", "oregon", "chicago", "buffalo",
   * "new_york_mold", "new_york_elevator". Required.
   */
  register: 'washington' | 'texas' | 'oregon' | 'chicago' | 'buffalo' | 'new_york_mold' | 'new_york_elevator';
  /**
   * Expiring within (days): Licences that run out between today and this many days from now. From 1 to 180.
   * Default: 30.
   */
  expiring_within_days?: number;
  /**
   * Trades: Words in the licence's type or trade, such as electrical, plumbing or roofing. Each is one search.
   * Empty reads every trade. At most 8 items. Default: [].
   */
  trades?: string[];
  /**
   * Only licences in good standing: Leave out licences the register shows as suspended, revoked, cancelled or
   * expired. Default: true.
   */
  active_only?: boolean;
  /**
   * Licences read per search: The register is read up to this many licences for each trade word. From 10 to 200.
   * Default: 200.
   */
  licences_to_read?: number;
  /**
   * Show a licence again after (days): For a saved formula, how long before the same licence and expiry date may
   * come back. From 1 to 365. Default: 300.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many licences, soonest expiry first. From 1 to 2000. Default: 500. */
  max_results?: number;
}

/**
 * Crowdfunding Leads (`crowdfunding-leads`): Kickstarter and Indiegogo projects with traction, each with funding,
 * backers, the creator's website and the email it publishes.
 */
export interface CrowdfundingLeadsParams {
  /**
   * Keywords: What the projects make or are about, each searched on each platform, such as e-bike or tabletop game.
   * 1 to 10 items. Required.
   */
  keywords: string[];
  /**
   * Campaign stage: Live campaigns, campaigns that ended funded (the ones that now have to make and ship), or both.
   * One of "live", "funded", "any". Default: "live".
   */
  stage?: 'live' | 'funded' | 'any';
  /**
   * Platforms: Where to search. Each one of "kickstarter", "indiegogo". At least 1 item. Default: ["kickstarter",
   * "indiegogo"].
   */
  platforms?: Array<'kickstarter' | 'indiegogo'>;
  /** Fewest backers: Projects with fewer backers are left out. At least 0. Default: 10. */
  min_backers?: number;
  /**
   * Least funded (% of goal): 100 keeps the projects that reached their goal. A project that states no goal is
   * kept. From 0 to 100000. Default: 0.
   */
  min_percent_funded?: number;
  /**
   * Ended within (days): For funded projects, how recently the campaign ended. Live campaigns always pass. From 1
   * to 3650. Default: 120.
   */
  ended_within_days?: number;
  /**
   * Only these categories: The platform's categories or tags, or part of them, such as 3D Printing, Product Design
   * or Home. Leave empty for any. At most 30 items. Default: [].
   */
  categories?: string[];
  /**
   * Only these countries (Kickstarter): Two-letter codes such as US or GB. Kickstarter states a project's country;
   * Indiegogo does not, so its projects are kept. At most 50 items. Default: [].
   */
  countries?: string[];
  /**
   * Pages read per keyword: Each page holds about 12 Kickstarter or 24 Indiegogo projects. From 1 to 5. Default: 2.
   */
  pages?: number;
  /**
   * Only creators with an email: Keeps the projects whose creator's own website publishes an email address that
   * passes the check. Default: true.
   */
  require_email?: boolean;
  /**
   * Most projects: How many projects, best backed first, are matched to a website; with Only creators with an
   * email, fewer rows may remain. From 1 to 500. Default: 100.
   */
  max_results?: number;
}

/**
 * Deal-Site Monitor (`deal-site-monitor`): New Slickdeals posts for your words, matched to Amazon, with the deal's
 * price against Amazon's and the resale margin.
 */
export interface DealSiteMonitorParams {
  /**
   * Words to watch: Products, brands or stores, such as lego, airpods or costco. Each is one search, newest deals
   * first. 1 to 10 items. Required.
   */
  queries: string[];
  /**
   * Only deals at: Store names as Slickdeals shows them, such as Walmart or Target. Empty keeps every store. At
   * most 30 items. Default: [].
   */
  stores?: string[];
  /** Least deal score: The community's votes on the deal. From -50 to 1000. Default: 0. */
  min_score?: number;
  /** Compare with Amazon: Read each deal's page and find the product on Amazon. Two reads a deal. Default: true. */
  compare_on_amazon?: boolean;
  /** Amazon referral fee (%). From 0 to 50. Default: 15. */
  referral_fee_pct?: number;
  /** Fulfilment and shipping a unit (USD). From 0 to 100. Default: 5. */
  fulfilment_cost?: number;
  /** Show a deal again after (days). From 1 to 365. Default: 365. */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many deals, newest first. Each is two reads when compared with Amazon. From 1
   * to 500. Default: 40.
   */
  max_results?: number;
}

/**
 * Directory to Leads (`directory-to-leads`): The businesses a directory lists, each with its website and the email
 * that site publishes, checked.
 */
export interface DirectoryToLeadsParams {
  /**
   * Directory: Which directory to read; a web page is any directory page of your own, such as a chamber of
   * commerce's members. One of "bbb", "gelbeseiten", "checkatrade", "clutch", "web_page". Required.
   */
  directory: 'bbb' | 'gelbeseiten' | 'checkatrade' | 'clutch' | 'web_page';
  /**
   * Kind of business: As the directory names it: plumber on BBB or Checkatrade, Zahnarzt on Gelbe Seiten, a Clutch
   * directory with its place such as web-developers/london, or the address of the directory page. Required.
   */
  what: string;
  /**
   * Place: A town, city or postcode. Not needed for Clutch, whose place is in its directory, or for a web page.
   * Default: "".
   */
  where?: string;
  /**
   * Pages to read: How many pages of the directory to read; for a web page, how many of its pages to follow. From 1
   * to 10. Default: 3.
   */
  pages?: number;
  /**
   * Only businesses with an email: Keeps the businesses whose own website publishes an email address that passes
   * the check. Default: true.
   */
  require_email?: boolean;
  /** Only named addresses: Leaves out shared inboxes such as info@. Default: false. */
  exclude_role_addresses?: boolean;
  /** Fewest reviews: Businesses with fewer reviews on the directory are left out. At least 0. Default: 0. */
  min_reviews?: number;
  /** Businesses to leave out: Names or domains, such as your existing customers. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /**
   * Show a business again after (days): For a saved formula, how long before a delivered business may come back.
   * From 1 to 365. Default: 180.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many businesses. From 1 to 5000. Default: 200. */
  max_results?: number;
}

/**
 * E-commerce Panel (`ecommerce-panel`): A brand's listings on Amazon, Walmart and Target, with price, stock, rating
 * and ratings count, and what changed since the last run.
 */
export interface EcommercePanelParams {
  /**
   * Brands or products: Each is searched on every retailer you choose, as you type it, such as a brand or a brand
   * and a product line. 1 to 20 items. Required.
   */
  queries: string[];
  /**
   * Only these brands: Keeps the listings whose brand or title names one of these, so that other brands a search
   * shows are left out. Leave empty to keep every listing. At most 20 items. Default: [].
   */
  brands?: string[];
  /**
   * Retailers: Where to search. Walmart and Target are their US stores. Each one of "amazon", "walmart", "target".
   * At least 1 item. Default: ["amazon", "walmart", "target"].
   */
  retailers?: Array<'amazon' | 'walmart' | 'target'>;
  /**
   * Listings per search: How many listings to read from the top of each retailer's results for each brand or
   * product. From 1 to 40. Default: 20.
   */
  results_per_search?: number;
  /**
   * Include sponsored listings: Paid placements are left out by default, so that a position is the retailer's own
   * ranking. Default: false.
   */
  include_sponsored?: boolean;
  /**
   * Amazon marketplace: Which Amazon store to read. One of "us", "uk", "de", "ca", "it", "es", "nl", "jp", "au",
   * "mx", "br", "in", "ae". Default: "us".
   */
  amazon_marketplace?: 'us' | 'uk' | 'de' | 'ca' | 'it' | 'es' | 'nl' | 'jp' | 'au' | 'mx' | 'br' | 'in' | 'ae';
  /**
   * Amazon Best Sellers lists: Categories as their Best Sellers address names them, such as kitchen, beauty or
   * electronics/172456. A listing in their top 100 gets its rank, and a best seller of your brands is added. At
   * most 10 items. Default: [].
   */
  amazon_bestseller_categories?: string[];
  /**
   * Check stock on Amazon and Target: Their search results do not say whether a product is in stock, so each Amazon
   * and Target listing's page is read, one unit a listing. Default: true.
   */
  check_stock?: boolean;
  /** Most rows: The run stops at this many listings, the biggest changes first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Enterprise ATS Sweep (`enterprise-ats-sweep`): The new openings at your target companies, read from their own
 * careers pages, with the companies hiring hardest flagged P1.
 */
export interface EnterpriseAtsSweepParams {
  /** Target companies: A domain (acme.com) or a careers page address for each company. 1 to 100 items. Required. */
  target_companies: string[];
  /**
   * Job keywords: Openings whose title holds one of these as a whole word or phrase. Leave empty for every opening.
   * At most 20 items. Default: [].
   */
  job_keywords?: string[];
  /**
   * Locations: Openings in one of these places; remote openings are kept too. Leave empty for anywhere. At most 20
   * items. Default: [].
   */
  locations?: string[];
  /**
   * Posted within (days): Only openings posted in the last this many days. An opening with no date is kept. From 1
   * to 365. Default: 30.
   */
  posted_within_days?: number;
  /** Words to leave out of titles: For example intern or graduate. Default: []. */
  exclude_keywords?: string[];
  /**
   * Only openings from the tracking system: Leaves out what was read from a careers page's own text, where a
   * heading or a name can pass for an opening. Off reads those too. Default: true.
   */
  verified_only?: boolean;
  /** Least matching openings: A company with fewer matching openings is left out. At least 1. Default: 1. */
  min_matching_roles?: number;
  /**
   * P1 at this many recent openings: A company with at least this many matching openings posted in the P1 window is
   * flagged P1. At least 1. Default: 5.
   */
  p1_min_roles?: number;
  /** P1 window (days): How recent an opening must be to count towards P1. From 1 to 90. Default: 7. */
  p1_within_days?: number;
  /**
   * Show an opening again after (days): For a saved formula, how long before a delivered opening may come back.
   * From 1 to 365. Default: 30.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many rows, best first. From 1 to 5000. Default: 500. */
  max_results?: number;
}

/**
 * Event Organizer Leads (`event-organizer-leads`): The groups and organisers running events on your topics in a
 * city, from Meetup and Eventbrite, busiest first.
 */
export interface EventOrganizerLeadsParams {
  /**
   * Topics: What the events are about, as you would search for them, such as startup, python or yoga. 1 to 8 items.
   * Required.
   */
  topics: string[];
  /** City: One city, by its name alone. Required. */
  city: string;
  /**
   * State or province: For a city in the United States or Canada, its state or province in two letters, which both
   * sites need there; leave it empty elsewhere. Required.
   */
  region: string;
  /** Country: The country, in two letters, such as US, GB or DE. Default: "US". */
  country?: string;
  /**
   * Where to look: Meetup's groups and Eventbrite's organisers. Each one of "meetup", "eventbrite". At least 1
   * item. Default: ["meetup", "eventbrite"].
   */
  sources?: Array<'meetup' | 'eventbrite'>;
  /**
   * Eventbrite's name for the place: Outside the United States and Canada, the place as Eventbrite's addresses
   * write it, such as united-kingdom--london. Empty there leaves Eventbrite out. Default: "".
   */
  eventbrite_place?: string;
  /** Events within (days): Only events starting in the next this many days count. From 1 to 365. Default: 90. */
  within_days?: number;
  /**
   * Fewest group members: Meetup groups with fewer members are left out. Eventbrite does not count followers, so
   * its organisers are kept. At least 0. Default: 0.
   */
  min_members?: number;
  /** Fewest events found: Organisers with fewer of the events found are left out. At least 1. Default: 1. */
  min_events?: number;
  /**
   * Show an organiser again after (days): For a saved formula, how long before a delivered organiser may come back.
   * From 1 to 365. Default: 90.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many organisers, best first. From 1 to 1000. Default: 200. */
  max_results?: number;
}

/**
 * Exhibitor Prospects (`exhibitor-prospects`): The companies exhibiting at the trade shows you name, with booth,
 * website, location, categories and contact address.
 */
export interface ExhibitorProspectsParams {
  /**
   * Shows: The address of each show's exhibitor list or floor plan on its a2z site (a2zinc.net), as your browser
   * shows it. 1 to 10 items. Required.
   */
  event_urls: string[];
  /**
   * Categories or words: Keep exhibitors whose categories, products, brands or description name one of these, as
   * whole words. Empty keeps every exhibitor. At most 20 items. Default: [].
   */
  keywords?: string[];
  /**
   * Your show: The a2z address of your own show. Its exhibitors are left out, to find the companies that exhibit
   * elsewhere but not with you. Default: "".
   */
  your_event_url?: string;
  /**
   * Countries: Keep exhibitors from these countries, in words as the shows write them, such as United States or
   * Canada. Empty keeps all. At most 50 items. Default: [].
   */
  countries?: string[];
  /**
   * Only upgraded listings: Keep exhibitors who paid the show for an enhanced listing, a sign of a bigger
   * exhibiting budget. Default: false.
   */
  enhanced_only?: boolean;
  /**
   * Fewest shows: With several shows, keep companies that exhibit at least at this many of them. From 1 to 10.
   * Default: 1.
   */
  min_shows?: number;
  /**
   * Your accounts: Company names or domains from your CRM, matched against each exhibitor's name and website. At
   * most 5000 items. Default: [].
   */
  crm_companies?: string[];
  /**
   * Your accounts are: Use your accounts to keep only those exhibiting, or to leave them out and see only new
   * companies. One of "ignore", "only_accounts", "leave_out_accounts". Default: "ignore".
   */
  crm_match?: 'ignore' | 'only_accounts' | 'leave_out_accounts';
  /**
   * Read each website for an address: The address the company's own website publishes, checked. Off saves one read
   * a company. Default: true.
   */
  include_site_contact?: boolean;
  /**
   * Show a company again after (days): For a saved formula, how long before a delivered company may come back. From
   * 1 to 365. Default: 120.
   */
  resurface_after_days?: number;
  /**
   * Most exhibitors read: The exhibitors whose show pages are read, most shows and upgraded listings first; words
   * and countries then keep those that match. A show page and a website are one read each. From 1 to 1000. Default:
   * 100.
   */
  max_results?: number;
}

/**
 * Footprint Prospects (`footprint-prospects`): Sites on your topic that take guest posts or keep resource pages,
 * found by search footprints, each with its email.
 */
export interface FootprintProspectsParams {
  /** Topic: The subject, as people search for it, such as gardening or personal finance. Required. */
  topic: string;
  /**
   * Footprints: Words searched beside the topic, each its own search. Quote a phrase to find it exactly. Search
   * operators such as intitle: work too. 1 to 20 items. Default: ["\"write for us\"", "\"guest post guidelines\"",
   * "\"submit a guest post\"", "\"become a contributor\"", "\"accepting guest posts\"", "\"contribute an
   * article\""].
   */
  footprints?: string[];
  /**
   * Results pages per search: How many pages of results to read for each footprint, about ten results a page. From
   * 1 to 3. Default: 1.
   */
  search_pages?: number;
  /**
   * Sites to leave out: Domains never shown, such as social networks, marketplaces and your own sites. At most 2000
   * items. Default: a list of 21 values, which `get` on the formula shows.
   */
  exclude_domains?: string[];
  /** Search country: The two-letter country whose search results are read, such as us, gb or de. Default: "us". */
  country?: string;
  /** Search language: The language of the results, such as en or de. Default: "en". */
  language?: string;
  /**
   * Read each page for its author: Reads each page found as an article, for its author and the day it was
   * published. Default: false.
   */
  read_articles?: boolean;
  /**
   * Only pages with a named author: When pages are read, keeps the sites whose page names who wrote it. Default:
   * false.
   */
  require_author?: boolean;
  /**
   * Only sites with an email: Keeps the sites whose own website publishes an email address that passes the check.
   * Default: false.
   */
  require_email?: boolean;
  /**
   * Show a site again after (days): For a saved formula, how long before a delivered site may come back. From 1 to
   * 365. Default: 90.
   */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many sites, those matching the most footprints first. From 1 to 1000. Default:
   * 100.
   */
  max_results?: number;
}

/**
 * Freelance Gig Feed (`freelance-gig-feed`): New projects on Upwork and Freelancer that match your skills, with
 * budget and applicants, only the ones you have not seen.
 */
export interface FreelanceGigFeedParams {
  /**
   * Keywords: The skills or kinds of project to look for. Each is searched, and a project must mention one of them.
   * 1 to 10 items. Required.
   */
  keywords: string[];
  /** Posted within (days): Only projects posted in the last this many days. From 1 to 30. Default: 2. */
  posted_within_days?: number;
  /**
   * Least fixed budget: A fixed-price project must offer at least this much, in its own currency. A project with no
   * budget shown is kept. At least 0. Default: 0.
   */
  min_fixed_budget?: number;
  /**
   * Least hourly rate: An hourly project must offer up to at least this much an hour, in its own currency. One with
   * no rate shown is kept. At least 0. Default: 0.
   */
  min_hourly_rate?: number;
  /**
   * Marketplaces: Where to look. Each one of "upwork", "freelancer". At least 1 item. Default: ["upwork",
   * "freelancer"].
   */
  platforms?: Array<'upwork' | 'freelancer'>;
  /** How it pays: Fixed price, hourly, or leave empty for both. Each one of "fixed", "hourly". Default: []. */
  payment_types?: Array<'fixed' | 'hourly'>;
  /**
   * Words to leave out: A project whose title or description holds one of these is left out, such as wordpress or
   * unpaid. Default: [].
   */
  exclude_keywords?: string[];
  /**
   * Most bids so far: Leave out a project with more bids than this, where the count is known. 0 for any. At least
   * 0. Default: 0.
   */
  max_applicants?: number;
  /**
   * Show a project again after (days): For a saved formula, how long before a delivered project may come back. From
   * 1 to 365. Default: 30.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many rows, best first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Funded and Hiring (`funded-and-hiring`): Companies that just raised a round and are hiring on their own careers
 * page, with the founder or talent lead to contact.
 */
export interface FundedAndHiringParams {
  /**
   * Industry words: Keep announcements whose headline or text holds one of these words. Leave empty for any. At
   * most 20 items. Default: [].
   */
  industries?: string[];
  /** Announced within (days): Only rounds announced in the last this many days. From 1 to 60. Default: 14. */
  published_within_days?: number;
  /**
   * Least open roles: Openings the company's careers page must list. 0 keeps companies with none. At least 0.
   * Default: 1.
   */
  min_open_roles?: number;
  /**
   * Count openings no tracking system confirms: Many young companies list jobs on a plain careers page. Those count
   * towards the least open roles, and are shown apart. Default: true.
   */
  count_unconfirmed?: boolean;
  /**
   * Searches: The words each wire is searched for. Each search reads the newest 50 releases that hold them. 1 to 8
   * items. Default: ["raises Series A", "seed funding", "raises Series B", "funding round"].
   */
  search_terms?: string[];
  /**
   * Newswires: Which newswires to read. Each one of "prnewswire", "globenewswire". At least 1 item. Default:
   * ["prnewswire", "globenewswire"].
   */
  wires?: Array<'prnewswire' | 'globenewswire'>;
  /** Releases read: How many of the newest likely funding releases are read in full. From 5 to 100. Default: 50. */
  releases_read?: number;
  /**
   * Who to contact: The roles of the people to find at each company. Default: ["Founder", "CEO", "Head of Talent",
   * "Head of People"].
   */
  contact_titles?: string[];
  /** Contacts per company: 0 turns contacts off. From 0 to 5. Default: 2. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /**
   * Show a company again after (days): For a saved formula, how long before a delivered company may come back. From
   * 1 to 365. Default: 90.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many rows, best first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Hiring-Signal Outbound (`hiring-signal-outbound`): Companies whose job posts reveal a need for what you sell,
 * with the decision-maker and a true line to open with.
 */
export interface HiringSignalOutboundParams {
  /**
   * Roles, tools or phrases: What the postings must name. Each is searched on the boards and looked for in the
   * posting's text. 1 to 10 items. Required.
   */
  signal_terms: string[];
  /** Locations: A city, region or country for each place to search. 1 to 10 items. Required. */
  locations: string[];
  /**
   * Signal: role: companies hiring these roles. technology: postings that name these tools. pain: postings that
   * describe these problems. growth: a department hiring several people. One of "role", "technology", "pain",
   * "growth". Default: "technology".
   */
  signal_type?: 'role' | 'technology' | 'pain' | 'growth';
  /** Posted within (days): Only postings from the last this many days. From 1 to 30. Default: 7. */
  posted_within_days?: number;
  /**
   * Job boards: Which boards to search. Reed and Totaljobs cover the UK; Dice is technology roles. Each one of
   * "linkedin", "indeed", "dice", "reed", "totaljobs". At least 1 item. Default: ["linkedin", "indeed"].
   */
  sources?: Array<'linkedin' | 'indeed' | 'dice' | 'reed' | 'totaljobs'>;
  /**
   * Postings read per search: How many postings to read for each term, place and board. From 5 to 100. Default: 25.
   */
  results_per_search?: number;
  /**
   * Postings read in full: How many of the newest postings are opened to read their whole text, where the search
   * gave only a title. From 5 to 300. Default: 60.
   */
  postings_to_read?: number;
  /**
   * Postings for growth: For the growth signal, how many postings one department of a company needs in the window.
   * From 2 to 50. Default: 3.
   */
  growth_min_postings?: number;
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 11, "max": 5000}. */
  company_size?: IntRange;
  /** Only these industries: Leave empty for any. Default: []. */
  industries_include?: string[];
  /** Not these industries: Companies in these industries are left out. Default: []. */
  industries_exclude?: string[];
  /** Companies to leave out: Names or domains, such as customers and open deals. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /**
   * Who to contact: The roles of the people to find. Leave empty to look for whoever decides for the role being
   * hired, such as the VP Sales for an SDR. Default: [].
   */
  buyer_titles?: string[];
  /**
   * Contact seniority: How senior the people to find should be. Each one of "manager", "director", "vp", "c_level".
   * Default: ["director", "vp", "c_level"].
   */
  contact_seniority?: Array<'manager' | 'director' | 'vp' | 'c_level'>;
  /** Contacts per company: 0 turns contacts off. From 0 to 5. Default: 1. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /**
   * Show a company again after (days): For a saved formula, how long before a company already delivered may come
   * back. From 1 to 365. Default: 90.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many rows, best first. From 1 to 2000. Default: 100. */
  max_results?: number;
}

/**
 * Hiring Velocity (`hiring-velocity`): Open roles at the companies you watch, counted by department from their own
 * careers sites, with the change since the last run.
 */
export interface HiringVelocityParams {
  /**
   * Companies: Each company as a stock ticker in capitals (DUOL), a domain (janestreet.com), or the address of its
   * careers page or job board (https://boards.greenhouse.io/wehrtyou). A job board address is the most exact. 1 to
   * 100 items. Required.
   */
  companies: string[];
  /**
   * Recent means posted within (days): A role posted in the last this many days counts as a recent role. From 1 to
   * 90. Default: 30.
   */
  recent_days?: number;
  /**
   * Only these departments: Leave empty for every department. Each one of "engineering", "data", "research",
   * "trading", "investments", "risk", "product", "design", "sales", "marketing", "customer_support", "finance",
   * "legal", "people", "it", "operations", "healthcare", "education", "skilled_trades", "retail_hospitality",
   * "other". Default: [].
   */
  departments?: Array<'engineering' | 'data' | 'research' | 'trading' | 'investments' | 'risk' | 'product' | 'design' | 'sales' | 'marketing' | 'customer_support' | 'finance' | 'legal' | 'people' | 'it' | 'operations' | 'healthcare' | 'education' | 'skilled_trades' | 'retail_hospitality' | 'other'>;
  /** Fewest open roles: A department with fewer open roles than this is left out. From 1 to 1000. Default: 1. */
  min_open_roles?: number;
  /**
   * Postings to leave out: Postings whose title holds one of these words are not counted; by default, evergreen
   * talent lists and recruiting events, which are not roles. At most 50 items. Default: a list of 12 values, which
   * `get` on the formula shows.
   */
  exclude_title_words?: string[];
  /**
   * Count jobs read from the careers page itself: Off: only jobs from the company's applicant tracking system are
   * counted, which is exact. On: jobs read from the text of a careers page that has none are counted too; such a
   * page can list things that are not jobs, or show only some. Default: false.
   */
  include_page_reads?: boolean;
  /** Most rows: The run stops at this many departments, biggest movers first. From 1 to 5000. Default: 500. */
  max_results?: number;
}

/**
 * Home-Services Pros (`home-services-pros`): The plumbers, electricians or cleaners of a place, with ratings,
 * licences, years in business and an email.
 */
export interface HomeServicesProsParams {
  /**
   * Trade: The trade in the plural, as the sites write it, such as plumbers, electricians or house cleaning.
   * Required.
   */
  trade: string;
  /** Town or city: One town or city. Required. */
  city: string;
  /**
   * State or county: For the United States, the two-letter state, which Thumbtack needs. For the United Kingdom,
   * leave empty or give the county. Default: "".
   */
  region?: string;
  /**
   * Country: The United States or the United Kingdom; the marketplaces read depend on it. One of "US", "GB".
   * Default: "US".
   */
  country?: 'US' | 'GB';
  /**
   * Where to look: Each is read only for the country it covers. Each one of "thumbtack", "bbb", "checkatrade",
   * "google_maps". At least 1 item. Default: ["thumbtack", "bbb", "checkatrade", "google_maps"].
   */
  sources?: Array<'thumbtack' | 'bbb' | 'checkatrade' | 'google_maps'>;
  /**
   * Lowest rating: Out of 5 on most sites and of 10 on Checkatrade; 0 keeps those with no rating. From 0 to 10.
   * Default: 0.
   */
  min_rating?: number;
  /** Fewest reviews: Businesses with fewer reviews are left out. At least 0. Default: 0. */
  min_reviews?: number;
  /**
   * Only businesses with an email: Keeps the businesses whose own website publishes an email address that passes
   * the check. Default: false.
   */
  require_email?: boolean;
  /**
   * Read each marketplace profile: Years in business, licences and background checks on Thumbtack; website and
   * accreditations on Checkatrade. Default: true.
   */
  read_profiles?: boolean;
  /**
   * Show a business again after (days): For a saved formula, how long before a delivered business may come back.
   * From 1 to 365. Default: 120.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many businesses, most reviewed first. From 1 to 2000. Default: 150. */
  max_results?: number;
}

/**
 * Hotel Rate Shop (`hotel-rate-shop`): What your competing hotels charge a night for the same stays, from Google
 * Hotels, Booking.com and MakeMyTrip, with each change.
 */
export interface HotelRateShopParams {
  /**
   * Hotels: Each hotel's name as Google Hotels shows it. Its rate there is read when the first hotel Google Hotels
   * finds has that name. 1 to 20 items. Required.
   */
  hotels: string[];
  /**
   * Town: The town the hotels are in, added to each name when it is searched, such as London. Leave empty when the
   * names say it. Default: "".
   */
  city?: string;
  /**
   * Stays starting in (days): How many days after each run the stays begin. A saved formula asks the same distances
   * every time it runs. 1 to 6 items. Default: [7, 14, 30].
   */
  days_ahead?: number[];
  /**
   * Booking.com pages: The hotels' pages on Booking.com, such as
   * https://www.booking.com/hotel/gb/strandpalace.html, to read their room prices there too. At most 20 items.
   * Default: [].
   */
  booking_pages?: string[];
  /**
   * MakeMyTrip hotels: The hotels' pages on MakeMyTrip, or their hotel ids there, to read their rates in rupees
   * too. At most 20 items. Default: [].
   */
  makemytrip_hotels?: string[];
  /** Nights: How long each stay is. Prices are shown a night. From 1 to 14. Default: 1. */
  nights?: number;
  /**
   * Guests: Adults in one room. On Booking.com only the offers for at least this many guests count. From 1 to 8.
   * Default: 2.
   */
  adults?: number;
  /**
   * Currency: The currency of the Google Hotels and Booking.com prices. MakeMyTrip prices are in rupees. One of
   * "USD", "EUR", "GBP", "AED", "INR", "AUD", "CAD", "JPY", "CHF", "SGD". Default: "USD".
   */
  currency?: 'USD' | 'EUR' | 'GBP' | 'AED' | 'INR' | 'AUD' | 'CAD' | 'JPY' | 'CHF' | 'SGD';
  /** Most rows: The run stops at this many rates, changes and sold-out hotels first. From 1 to 2000. Default: 500. */
  max_results?: number;
}

/**
 * Influencer Discovery (`influencer-discovery`): Creators who make videos about your topic, with followers, views,
 * engagement, their links and a published business email.
 */
export interface InfluencerDiscoveryParams {
  /**
   * Topics: What the creators make videos about, as a viewer would search it, such as home espresso. A hashtag
   * works too. 1 to 10 items. Required.
   */
  topics: string[];
  /** Subscribers: The size of creator to keep, by YouTube subscribers. Default: {"min": 10000, "max": 1000000}. */
  subscribers?: IntRange;
  /**
   * Countries: Only creators whose channel states one of these countries, as YouTube writes it (United States,
   * Germany). Leave empty for any; a channel that states none is then kept. At most 20 items. Default: [].
   */
  countries?: string[];
  /**
   * Least videos on the topic: How many of a creator's videos must turn up in the topic searches; 2 or more keeps
   * creators who cover it regularly. From 1 to 10. Default: 1.
   */
  min_topic_videos?: number;
  /**
   * Creators to leave out: Handles (@name) or channel ids of creators you already work with. At most 1000 items.
   * Default: [].
   */
  exclude_channels?: string[];
  /**
   * Videos read per topic: How many of each topic's videos are read to find creators. Each video read is one unit.
   * From 10 to 100. Default: 40.
   */
  videos_per_topic?: number;
  /**
   * Creators read: How many creators' channels are read, the most on topic first; each channel, profile and website
   * read is one unit. From 5 to 200. Default: 40.
   */
  max_creators?: number;
  /**
   * Also read: The creator's Instagram and TikTok accounts, where their channel links to them. Each one of
   * "instagram", "tiktok". Default: ["instagram", "tiktok"].
   */
  other_platforms?: Array<'instagram' | 'tiktok'>;
  /**
   * Business email from their website: Reads the creator's own website, where their channel links to one, for the
   * business address it publishes. Default: true.
   */
  website_email?: boolean;
  /** Most rows: The run stops at this many creators, best fit first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Job Order Hunter (`job-order-hunter`): Companies newly hiring for your roles and places, qualified by size and
 * industry, with the person to contact.
 */
export interface JobOrderHunterParams {
  /** Job titles: The roles you recruit for, each searched as you type it. 1 to 10 items. Required. */
  job_titles: string[];
  /** Locations: A city, region or country for each place you cover. 1 to 10 items. Required. */
  locations: string[];
  /** Posted within (days): Only jobs posted in the last this many days. From 1 to 30. Default: 1. */
  posted_within_days?: number;
  /**
   * Job boards: Which boards to search. The careers pages of target companies are read when you choose them and
   * name the companies. Each one of "linkedin", "indeed", "google_jobs", "dice", "reed", "totaljobs", "stepstone",
   * "seek", "simplyhired", "wellfound", "xing", "irishjobs", "ycombinator", "ats_boards". At least 1 item. Default:
   * ["linkedin", "indeed", "google_jobs"].
   */
  sources?: Array<'linkedin' | 'indeed' | 'google_jobs' | 'dice' | 'reed' | 'totaljobs' | 'stepstone' | 'seek' | 'simplyhired' | 'wellfound' | 'xing' | 'irishjobs' | 'ycombinator' | 'ats_boards'>;
  /**
   * Search other names of the same job: Also searches the names the same job is often advertised under, such as RN
   * for Registered Nurse. Default: false.
   */
  title_synonyms?: boolean;
  /**
   * Target companies: Domains or careers pages whose own openings are read when Careers pages is chosen as a board.
   * At most 100 items. Default: [].
   */
  target_companies?: string[];
  /** Jobs read per search: How many jobs to read for each title, place and board. From 5 to 200. Default: 50. */
  results_per_search?: number;
  /**
   * Employment types: Leave empty for any. Each one of "full_time", "part_time", "contract", "temporary". Default:
   * [].
   */
  employment_types?: Array<'full_time' | 'part_time' | 'contract' | 'temporary'>;
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 11, "max": 5000}. */
  company_size?: IntRange;
  /** Only these industries: Leave empty for any. Default: []. */
  industries_include?: string[];
  /** Not these industries: Companies in these industries are left out. Default: []. */
  industries_exclude?: string[];
  /** Leave out staffing agencies: Recruiters' own postings are rarely a job order. Default: true. */
  exclude_staffing_agencies?: boolean;
  /** Companies to leave out: Names or domains, such as your existing clients. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /** Least open roles: Matching roles a company needs to have open. At least 1. Default: 1. */
  min_open_roles?: number;
  /** Words to leave out of titles: For example intern or unpaid. Default: []. */
  title_exclude_keywords?: string[];
  /**
   * Check their careers pages: Reads the careers page of the companies with the most matching roles; a role listed
   * there ranks higher. Default: true.
   */
  check_careers_pages?: boolean;
  /**
   * Careers pages to read: How many companies' careers pages to read, those with the most matching roles first.
   * From 1 to 100. Default: 25.
   */
  careers_pages_max?: number;
  /**
   * Who to contact: The roles of the people to find at each company. Default: ["Talent Acquisition", "HR Manager",
   * "Hiring Manager"].
   */
  contact_titles?: string[];
  /**
   * Contact seniority: How senior the people to find should be. Each one of "manager", "director", "vp", "c_level".
   * Default: ["manager", "director", "vp", "c_level"].
   */
  contact_seniority?: Array<'manager' | 'director' | 'vp' | 'c_level'>;
  /** Contacts per company: 0 turns contacts off. From 0 to 5. Default: 2. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /**
   * Show a company again after (days): For a saved formula, how long before a delivered row may come back. From 1
   * to 365. Default: 45.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many rows, best first. From 1 to 5000. Default: 200. */
  max_results?: number;
}

/**
 * Job Seeker Targets (`job-seeker-targets`): Employers hiring now for the job you want, with the person who
 * decides, their address and a first line to send.
 */
export interface JobSeekerTargetsParams {
  /** Jobs you want: The job titles you are applying for, each searched as you type it. 1 to 5 items. Required. */
  target_titles: string[];
  /** Where: A city, region or country for each place you would work, or Remote. 1 to 5 items. Required. */
  locations: string[];
  /**
   * Posted within (days): Only postings from the last this many days, while the role is still open. From 1 to 30.
   * Default: 3.
   */
  posted_within_days?: number;
  /**
   * Job boards: Which boards to search. Reed and Totaljobs cover the UK; Dice is technology roles in the US. Each
   * one of "linkedin", "indeed", "reed", "totaljobs", "dice". At least 1 item. Default: ["linkedin", "indeed"].
   */
  sources?: Array<'linkedin' | 'indeed' | 'reed' | 'totaljobs' | 'dice'>;
  /** Jobs read per search: How many postings to read for each job, place and board. From 5 to 100. Default: 25. */
  results_per_search?: number;
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 1, "max": 100000}. */
  company_size?: IntRange;
  /** Only these industries: Leave empty for any. Default: []. */
  industries_include?: string[];
  /**
   * Employers to leave out: Names or domains, such as your current employer or places you already applied to. At
   * most 2000 items. Default: [].
   */
  exclude_companies?: string[];
  /**
   * Only titles that name the job: Keeps postings whose title names one of your jobs as whole words; boards also
   * return near matches. Default: true.
   */
  title_must_match?: boolean;
  /** Words to leave out of titles: For example intern, senior or contract. Default: []. */
  title_exclude_keywords?: string[];
  /**
   * Who to write to: Leave empty to look for whoever decides on that kind of hire, such as the CTO for a developer.
   * Default: [].
   */
  contact_titles?: string[];
  /** People per employer: 0 turns contacts off. From 0 to 3. Default: 1. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /** Most rows: The run stops at this many rows, newest postings first. From 1 to 500. Default: 50. */
  max_results?: number;
}

/**
 * Knowledge Base Crawl (`knowledge-base-crawl`): A site's or docs' pages as clean Markdown, one row a page; saved,
 * it returns only the pages that are new, changed or gone.
 */
export interface KnowledgeBaseCrawlParams {
  /**
   * Start address: The address of the site or the documentation, such as https://docs.example.com/guide/. Only
   * pages of the same site are read. Required.
   */
  start_url: string;
  /**
   * Most pages read: Each page read is one unit. Following links reads at most 100 pages a run; with a sitemap, up
   * to 2000. From 1 to 2000. Default: 50.
   */
  max_pages?: number;
  /**
   * Only these sections: Read only pages whose path starts with one of these, such as /docs/. Leave empty for the
   * whole site below the start address. At most 20 items. Default: [].
   */
  include_paths?: string[];
  /**
   * Sitemap: To read the pages a sitemap lists instead of following links, its address
   * (https://example.com/sitemap.xml) or the site's bare address. Only listed pages under the start address are
   * read. Default: "".
   */
  sitemap_url?: string;
  /**
   * Leave out these sections: Pages whose path starts with one of these are not read, such as /blog/ or
   * /changelog/. At most 20 items. Default: [].
   */
  exclude_paths?: string[];
  /**
   * Link depth: How many links away from the start address a page may be when links are followed. From 0 to 10.
   * Default: 3.
   */
  max_depth?: number;
  /**
   * Keep menus, headers and footers: Off, each page's Markdown is its main content only, which is what an index
   * wants. Default: false.
   */
  whole_page?: boolean;
  /**
   * Least words on a page: Leaves out near-empty pages, such as redirects and section stubs. From 0 to 5000.
   * Default: 20.
   */
  min_words?: number;
  /**
   * Report pages that are gone: A saved formula also returns the pages the last run read that this one did not
   * find. Turn it off when the site has more pages than a run reads. Default: true.
   */
  report_removed?: boolean;
  /** Most rows: The run stops at this many pages, changed ones first. From 1 to 2000. Default: 500. */
  max_results?: number;
}

/**
 * Letting Agent Leads (UK) (`landlord-agent-leads`): The letting agents and letting businesses with the most
 * rentals on Rightmove and OnTheMarket in a UK area, with their branch phone.
 */
export interface LandlordAgentLeadsParams {
  /** Places: UK towns, areas or postcodes, such as Manchester, Leeds or SW11. 1 to 10 items. Required. */
  locations: string[];
  /**
   * Least rentals on the market: Only agents advertising at least this many of the rentals read. From 1 to 100.
   * Default: 1.
   */
  min_listings?: number;
  /**
   * Portals: Where to read the rentals. Each one of "rightmove", "onthemarket". At least 1 item. Default:
   * ["rightmove", "onthemarket"].
   */
  portals?: Array<'rightmove' | 'onthemarket'>;
  /**
   * Result pages read: Which pages of each portal's results to read for each place, about 25 rentals a page. Each
   * one of 1, 2, 3, 4, 5. At least 1 item. Default: [1, 2, 3].
   */
  pages?: Array<1 | 2 | 3 | 4 | 5>;
  /** Radius (miles): Also read rentals this far around each place. One of 0, 0.25, 0.5, 1, 3, 5, 10. Default: 0. */
  radius_miles?: 0 | 0.25 | 0.5 | 1 | 3 | 5 | 10;
  /** Most rent a month (GBP): 0 for no ceiling. At least 0. Default: 0. */
  max_rent?: number;
  /**
   * Agents to leave out: Agents you already work with, by the name the portal shows. At most 2000 items. Default:
   * [].
   */
  exclude_agents?: string[];
  /**
   * Show an agent again after (days): For a saved formula, how long before a delivered agent may come back. From 1
   * to 365. Default: 60.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many agents, most rentals first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Launch and Batch Lists (`launch-batch-lists`): The startups of a Y Combinator batch, newest launches first, with
 * their founders and a way to reach each one.
 */
export interface LaunchBatchListsParams {
  /** Batch: As Y Combinator writes it, such as Fall 2026 or F26. Required. */
  batch: string;
  /** Industry: As the directory names it, such as Fintech, Healthcare or B2B. Leave empty for every industry. */
  industry?: string;
  /** Only companies that are hiring: Keeps the companies the directory marks as hiring. Default: false. */
  hiring_only?: boolean;
  /** Companies to leave out: Names or domains, such as your existing customers. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /** Largest team: Companies with a bigger team are left out. At least 1. Default: 500. */
  max_team_size?: number;
  /**
   * Who to contact: The roles a connected people provider looks for at each company. Default: ["Founder",
   * "Co-Founder", "CEO"].
   */
  contact_titles?: string[];
  /**
   * Contacts per company: People a connected provider finds at each company. 0 keeps one row per company. From 0 to
   * 5. Default: 1.
   */
  contacts_per_company?: number;
  /** Most companies: How many companies of the batch to read, newest launches first. From 1 to 500. Default: 100. */
  max_results?: number;
}

/**
 * Link Intersect (`link-intersect`): Sites that link to two or more of your competitors but not to you, each with
 * the page and the email the site publishes.
 */
export interface LinkIntersectParams {
  /** Your domain: Your site's domain, such as example.com. Pages that already link to it are left out. Required. */
  your_domain: string;
  /**
   * Competitors' domains: Two to six domains, such as rival.com. Every pair of them is searched for, so each one
   * added costs more. 2 to 6 items. Required.
   */
  competitors: string[];
  /**
   * Topic words: Words added to every search to keep it on your subject, such as crm. Leave empty to search the
   * domains alone. Default: "".
   */
  topic?: string;
  /**
   * Competitors linked, at least: A page must link to at least this many of your competitors. With 1, each
   * competitor is also searched for alone. From 1 to 6. Default: 2.
   */
  min_competitors?: number;
  /**
   * Count a competitor named without a link: A page that writes a competitor's domain in its text without linking
   * to it counts toward the least number. Default: true.
   */
  count_named?: boolean;
  /**
   * Results pages per search: How many pages of results to read for each search, about ten results a page. From 1
   * to 3. Default: 1.
   */
  search_pages?: number;
  /**
   * Pages to check: How many of the pages found are read to see whom they link to, those found by the most searches
   * first; never more than the most rows. From 5 to 100. Default: 30.
   */
  pages_to_read?: number;
  /**
   * Sites to leave out: Domains never shown, such as social networks and review sites where no editor can add your
   * link. At most 2000 items. Default: a list of 19 values, which `get` on the formula shows.
   */
  exclude_domains?: string[];
  /** Search country: The two-letter country whose search results are read, such as us, gb or de. Default: "us". */
  country?: string;
  /** Search language: The language of the results, such as en or de. Default: "en". */
  language?: string;
  /**
   * Only sites with an email: Keeps the sites whose own website publishes an email address that passes the check.
   * Default: false.
   */
  require_email?: boolean;
  /**
   * Show a site again after (days): For a saved formula, how long before a delivered site may come back. From 1 to
   * 365. Default: 90.
   */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many sites, those linking to the most competitors first. From 1 to 1000.
   * Default: 100.
   */
  max_results?: number;
}

/**
 * Listing Compliance (`listing-compliance`): Your Amazon listings checked against your own content rules (brand,
 * title words, images, bullets, Buy Box seller), with changes.
 */
export interface ListingComplianceParams {
  /** Your listings: The ASINs to check. 1 to 200 items. Required. */
  asins: string[];
  /** Brand the listing must show: As your brand is written, such as JBL. Empty skips the check. Default: "". */
  brand?: string;
  /** Words every title must hold: Such as your brand or the product line. At most 20 items. Default: []. */
  required_title_words?: string[];
  /** Amazon marketplace. One of "us", "uk", "de", "fr", "it", "es", "ca". Default: "us". */
  marketplace?: 'us' | 'uk' | 'de' | 'fr' | 'it' | 'es' | 'ca';
  /**
   * Words no title may hold. At most 30 items. Default: ["refurbished", "renewed", "used", "replica", "compatible
   * with", "generic", "unbranded"].
   */
  forbidden_words?: string[];
  /** Least images. From 0 to 20. Default: 6. */
  min_images?: number;
  /** Least bullet points. From 0 to 10. Default: 5. */
  min_bullets?: number;
  /** Longest title (characters). From 50 to 500. Default: 200. */
  max_title_length?: number;
  /**
   * Sellers who may hold the Buy Box: Such as Amazon.com and your own storefront. Empty skips the check. At most
   * 100 items. Default: [].
   */
  buy_box_sellers?: string[];
  /** Only listings with a breach or a change. Default: false. */
  only_breaches?: boolean;
  /** Most rows: The run stops at this many listings, most breaches first. From 1 to 500. Default: 200. */
  max_results?: number;
}

/**
 * Literature Sweep (`literature-sweep`): New papers on your subject from PubMed, arXiv and Crossref, each paper
 * once, with its abstract, DOI and free full text.
 */
export interface LiteratureSweepParams {
  /**
   * Subject: Words that describe the subject; every word must appear in a paper's listing. PubMed also reads its
   * own field tags, such as review[pt], when the words are not searched as one phrase. Required.
   */
  query: string;
  /**
   * Search the words as one phrase: Finds protein language model only where those words stand together, as a term
   * of the field. Crossref reads the words alone either way. Default: false.
   */
  exact_phrase?: boolean;
  /**
   * Published within (days): Only papers that appeared in the last this many days; 0 for any date. PubMed counts
   * the day a paper was added to it. From 0 to 3650. Default: 30.
   */
  published_within_days?: number;
  /**
   * Where to search: PubMed for medicine and life sciences, arXiv for preprints in physics, maths and computing,
   * Crossref for journals of every field. Each one of "pubmed", "arxiv", "crossref", "openalex", "semanticscholar".
   * At least 1 item. Default: ["pubmed", "arxiv", "crossref"].
   */
  sources?: Array<'pubmed' | 'arxiv' | 'crossref' | 'openalex' | 'semanticscholar'>;
  /**
   * Only papers by these authors: A surname, or a name as papers print it (Doudna, Liu DR). Leave empty for any
   * author. At most 50 items. Default: [].
   */
  authors?: string[];
  /**
   * Only these journals: Part of a journal's or server's name; Nature also keeps Nature Methods. Leave empty for
   * any. At most 50 items. Default: [].
   */
  journals?: string[];
  /** Include preprints: Papers not yet peer reviewed, from arXiv, bioRxiv and medRxiv. Default: true. */
  include_preprints?: boolean;
  /** Only papers free to read: Keeps the papers with a link to free full text. Default: false. */
  open_access_only?: boolean;
  /**
   * Pages read per source: Each page is the 100 newest (Crossref, the 100 best matching) papers of one source;
   * raise it for a busy subject or a long window. From 1 to 3. Default: 1.
   */
  pages?: number;
  /**
   * Read PubMed abstracts: PubMed lists papers without their abstracts; this reads each PubMed paper's own page for
   * its abstract and the day it went online. Default: true.
   */
  read_abstracts?: boolean;
  /** Most rows: The run stops at this many papers, best matching first. From 1 to 500. Default: 100. */
  max_results?: number;
}

/**
 * Local Business Leads (`local-business-leads`): Businesses of a kind in your places, with the email their own
 * website publishes and facts to open with.
 */
export interface LocalBusinessLeadsParams {
  /**
   * Kinds of business: What to search for, as you would type it into Google Maps, such as roofer or vegan
   * restaurant. 1 to 10 items. Required.
   */
  business_types: string[];
  /**
   * Places: A city, district or region for each place, with its state or country when the name is common. 1 to 10
   * items. Required.
   */
  locations: string[];
  /**
   * Search each neighbourhood too: Searches again in the neighbourhoods and postcodes the first search found, to
   * reach past its few hundred results. Default: true.
   */
  expand_locations?: boolean;
  /**
   * Neighbourhoods per search: How many neighbourhoods or postcodes to search again, those with the most places
   * first. From 1 to 40. Default: 8.
   */
  max_sub_areas?: number;
  /** Places read per search: How many places to read from each search. From 10 to 300. Default: 60. */
  places_per_search?: number;
  /**
   * Website: Keep every business, only those with a website, or only those without one. One of "any", "has",
   * "missing". Default: "any".
   */
  website?: 'any' | 'has' | 'missing';
  /**
   * Lowest rating: Businesses rated below this are left out. 0 keeps those with no rating. From 0 to 5. Default: 0.
   */
  min_rating?: number;
  /** Highest rating: Businesses rated above this are left out. From 0 to 5. Default: 5. */
  max_rating?: number;
  /** Fewest reviews: Businesses with fewer reviews are left out. At least 0. Default: 0. */
  min_reviews?: number;
  /** Most reviews: Businesses with more reviews are left out. At least 0. Default: 1000000. */
  max_reviews?: number;
  /**
   * Leave out chains: A name found five or more times in the results is taken for a chain and left out. Default:
   * true.
   */
  exclude_chains?: boolean;
  /**
   * Only businesses with an email: Keeps the businesses whose own website publishes an email address that passes
   * the check. Default: true.
   */
  require_email?: boolean;
  /**
   * Only named addresses: Leaves out shared inboxes such as info@ and keeps addresses that passed every check.
   * Default: false.
   */
  exclude_role_addresses?: boolean;
  /**
   * Only businesses with social profiles: Keeps the businesses whose website links to at least one social profile.
   * Default: false.
   */
  require_socials?: boolean;
  /** Site facts: What each website is built on, and its speed score on a phone. Default: false. */
  include_site_facts?: boolean;
  /**
   * Slowest site score kept: With site facts, keeps the sites scoring this or less; 50 keeps the slow ones. From 0
   * to 100. Default: 100.
   */
  max_speed_score?: number;
  /**
   * Company facts: Industry and size from the company's LinkedIn page, when its website links to one. Default:
   * false.
   */
  include_firmographics?: boolean;
  /**
   * Show a business again after (days): For a saved formula, how long before a delivered business may come back.
   * From 1 to 365. Default: 180.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many businesses, most reviewed first. From 1 to 5000. Default: 500. */
  max_results?: number;
}

/**
 * Long-Open Roles (`long-open-roles`): Jobs open for a month or more at companies that are struggling to fill them,
 * with who decides on the hire.
 */
export interface LongOpenRolesParams {
  /** Job titles: The roles you place, each searched as you type it. 1 to 10 items. Required. */
  job_titles: string[];
  /** Locations: A city, region or country for each place you cover. 1 to 10 items. Required. */
  locations: string[];
  /** Open at least (days): Only jobs that have been posted at least this many days. From 7 to 180. Default: 30. */
  min_days_open?: number;
  /**
   * Open at most (days): Older postings are often forgotten rather than open; they are left out. From 14 to 365.
   * Default: 120.
   */
  max_days_open?: number;
  /**
   * Job boards: Which boards to search. Indeed lists jobs of the last 30 days only. Reed and Totaljobs cover the
   * UK; Dice is technology roles in the US. Each one of "linkedin", "indeed", "reed", "totaljobs", "dice". At least
   * 1 item. Default: ["linkedin", "indeed"].
   */
  sources?: Array<'linkedin' | 'indeed' | 'reed' | 'totaljobs' | 'dice'>;
  /**
   * Jobs read per search: How many postings to read for each title, place and board; most are newer than you want,
   * so read more. From 5 to 200. Default: 50.
   */
  results_per_search?: number;
  /** Company size (employees): Companies whose size is not known are kept. Default: {"min": 11, "max": 10000}. */
  company_size?: IntRange;
  /** Companies to leave out: Names or domains, such as your existing clients. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /** Words to leave out of titles: For example intern or volunteer. Default: []. */
  title_exclude_keywords?: string[];
  /**
   * Who to contact: Leave empty to look for whoever decides on that kind of hire, such as the Director of Nursing
   * for a nurse. Default: [].
   */
  contact_titles?: string[];
  /** Contacts per company: 0 turns contacts off. From 0 to 5. Default: 1. */
  contacts_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /** Most rows: The run stops at this many rows, the longest-open first. From 1 to 2000. Default: 100. */
  max_results?: number;
}

/**
 * Lookalike Companies (`lookalike-companies`): Startups like the accounts you won, found where the Y Combinator
 * directory files them, with the people to contact.
 */
export interface LookalikeCompaniesParams {
  /** Accounts you won: Company names as the Y Combinator directory lists them. 1 to 20 items. Required. */
  seed_companies: string[];
  /**
   * Places: As the directory names them, such as United States of America or Europe. Leave empty for anywhere.
   * Default: [].
   */
  regions?: string[];
  /** Team size: Companies whose size is not known are kept. Default: {"min": 2, "max": 1000}. */
  team_size?: IntRange;
  /**
   * Only active companies: Leaves out companies the directory marks as acquired, public or inactive. Default: true.
   */
  active_only?: boolean;
  /**
   * Companies read per account: How many companies to read from the directory for each account you won. From 5 to
   * 100. Default: 40.
   */
  peers_per_account?: number;
  /** Companies to leave out: Names or domains, such as your existing customers. At most 5000 items. Default: []. */
  exclude_companies?: string[];
  /**
   * Who to contact: The roles a connected people provider looks for at each company. Default: ["CEO", "Founder",
   * "VP Sales", "Head of Operations"].
   */
  buyer_titles?: string[];
  /** Contacts per company: 0 keeps one row per company. From 0 to 5. Default: 1. */
  contacts_per_company?: number;
  /** Most companies: The run stops at this many companies, the most alike first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Amazon Marketplace Flips (Europe) (`marketplace-flips`): Products cheaper on one European Amazon than another, by
 * the same ASIN, with the price gap and margin in euros.
 */
export interface MarketplaceFlipsParams {
  /**
   * Search words: Searched on the Amazon you buy from, such as lego technic. Not needed when ASINs are given. At
   * most 10 items. Required.
   */
  queries: string[];
  /** Buy on: The Amazon you buy from (amazon.de, .it, .es or .nl). One of "de", "it", "es", "nl". Default: "de". */
  buy_marketplace?: 'de' | 'it' | 'es' | 'nl';
  /**
   * Sell on: The Amazons whose price is compared. The one you buy on is skipped. Each one of "de", "fr", "it",
   * "es", "nl". At least 1 item. Default: ["fr", "it", "es"].
   */
  sell_marketplaces?: Array<'de' | 'fr' | 'it' | 'es' | 'nl'>;
  /** ASINs: Products to compare, instead of a search. At most 50 items. Default: []. */
  asins?: string[];
  /**
   * Least price gap (%): The selling price above the buying price, as a share of the buying price. From 0 to 500.
   * Default: 15.
   */
  min_gap_pct?: number;
  /** Referral fee (%): The share of the sale price Amazon keeps. From 0 to 50. Default: 15. */
  referral_fee_pct?: number;
  /**
   * Fulfilment and shipping a unit (EUR): Your fulfilment fee and the cost of moving a unit between countries. From
   * 0 to 100. Default: 4.
   */
  fulfilment_cost?: number;
  /** Products per search: How many products of each search are compared. From 1 to 48. Default: 15. */
  results_per_search?: number;
  /** Most rows: The run stops at this many pairs, widest gap first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Menu Price Tracker (`menu-price-tracker`): Every dish and price on the menus of the restaurants you watch, on
 * Uber Eats, TheFork and Zomato, with each price change.
 */
export interface MenuPriceTrackerParams {
  /**
   * Restaurants: The restaurants' pages on Uber Eats, TheFork or Zomato, one address each. 1 to 50 items. Required.
   */
  restaurants: string[];
  /**
   * Only these menu sections: Words of the sections to keep, such as Mains or Pizza. Leave empty for the whole
   * menu. At most 30 items. Default: [].
   */
  sections?: string[];
  /**
   * Only dishes named with: Keeps the dishes whose name holds one of these words, such as burger or margherita.
   * Leave empty for every dish. At most 30 items. Default: [].
   */
  dish_words?: string[];
  /** Include set menus: TheFork's set menus and their prices, beside the à la carte dishes. Default: true. */
  include_set_menus?: boolean;
  /**
   * Most dishes per restaurant: The first this many dishes of each menu, in the menu's own order. From 1 to 500.
   * Default: 300.
   */
  max_items_per_restaurant?: number;
  /** Most rows: The run stops at this many dishes, price changes first. From 1 to 10000. Default: 2000. */
  max_results?: number;
}

/**
 * Out-of-Stock Opportunity (`out-of-stock-opportunity`): Amazon best sellers that are out of stock on Amazon, and
 * the US retailers that have the same product in stock now.
 */
export interface OutOfStockOpportunityParams {
  /**
   * Best Sellers categories: As the list's address names them, such as toys-and-games, electronics, kitchen, or
   * electronics/172456 for a category further down. 1 to 10 items. Required.
   */
  categories: string[];
  /**
   * Retailers: Where to look for stock. Walmart often answers automated visits with a check, so its products may be
   * missing. Each one of "target", "bestbuy", "newegg", "walmart". At least 1 item. Default: ["target", "bestbuy"].
   */
  retailers?: Array<'target' | 'bestbuy' | 'newegg' | 'walmart'>;
  /**
   * List pages: Page 1 is ranks 1 to 50, page 2 ranks 51 to 100. Each one of 1, 2. At least 1 item. Default: [1,
   * 2].
   */
  pages?: Array<1 | 2>;
  /** Results compared per retailer. From 1 to 5. Default: 2. */
  candidates_per_retailer?: number;
  /**
   * Most rows: The run stops at this many product and retailer pairs, best rank first. From 1 to 500. Default: 100.
   */
  max_results?: number;
}

/**
 * People List with Openers (`people-list-with-openers`): The people in the roles you sell to at your target
 * companies, with checked addresses and a line from their own site.
 */
export interface PeopleListWithOpenersParams {
  /** Companies: The website domains of the companies to find people at. 1 to 500 items. Required. */
  companies: string[];
  /** Roles: The roles of the people to find. 1 to 10 items. Required. */
  titles: string[];
  /**
   * Seniority: How senior the people should be. Each one of "manager", "director", "vp", "c_level". Default:
   * ["director", "vp", "c_level"].
   */
  seniority?: Array<'manager' | 'director' | 'vp' | 'c_level'>;
  /** People per company: The most people to find at each company. From 1 to 10. Default: 2. */
  people_per_company?: number;
  /**
   * Only addresses that pass the check: Keeps addresses whose domain takes mail, and those a verification provider
   * confirmed. Default: true.
   */
  require_verified_email?: boolean;
  /** Most rows: The run stops at this many people. From 1 to 5000. Default: 500. */
  max_results?: number;
}

/**
 * Permit Status Watch (`permit-status-watch`): Building permits in a US city read again on a schedule, with each
 * status change and each newly issued permit.
 */
export interface PermitStatusWatchParams {
  /**
   * City: The US city or county whose permits are watched. One of "austin", "chicago", "new_york", "los_angeles",
   * "san_francisco", "seattle", "dallas", "new_orleans", "cincinnati", "baton_rouge", "montgomery_county_md",
   * "prince_georges_county_md", "norfolk", "buffalo", "orlando", "mesa", "raleigh", "washington_dc", "minneapolis",
   * "detroit". Required.
   */
  city: 'austin' | 'chicago' | 'new_york' | 'los_angeles' | 'san_francisco' | 'seattle' | 'dallas' | 'new_orleans' | 'cincinnati' | 'baton_rouge' | 'montgomery_county_md' | 'prince_georges_county_md' | 'norfolk' | 'buffalo' | 'orlando' | 'mesa' | 'raleigh' | 'washington_dc' | 'minneapolis' | 'detroit';
  /**
   * Permit numbers: The permits to watch, by their number at the city. Leave empty to watch the permits issued in
   * an area instead. At most 50 items. Default: [].
   */
  permit_numbers?: string[];
  /**
   * Address holds: Without permit numbers, only permits whose address holds this text, such as a street name. Empty
   * watches the whole city. Default: "".
   */
  address_contains?: string;
  /**
   * Issued within (days): Without permit numbers, the permits issued in the last this many days are watched. From 1
   * to 365. Default: 30.
   */
  within_days?: number;
  /**
   * Work words: Without permit numbers, only permits whose type, work or description holds this, such as ROOF or
   * SOLAR. Default: "".
   */
  keyword?: string;
  /**
   * Permits read: Without permit numbers, the newest this many permits of the area are read on each run. From 10 to
   * 200. Default: 200.
   */
  permits_to_read?: number;
  /**
   * Only what changed: On a saved formula's later runs, show only permits that are new or whose status changed. The
   * first run shows every permit. Default: true.
   */
  only_changes?: boolean;
  /** Most rows: The run stops at this many permits, changes first. From 1 to 1000. Default: 200. */
  max_results?: number;
}

/**
 * Permit Trade Leads (`permit-trade-leads`): Building permits just issued for your trades in a US city, with each
 * job's contractor, or the busiest contractors ranked.
 */
export interface PermitTradeLeadsParams {
  /**
   * City: The US city or county whose permits are read. Contractor names are published by Austin, Seattle, New
   * York, Dallas, Cincinnati, Baton Rouge, Orlando, Mesa, Raleigh and Chicago. One of "austin", "chicago",
   * "new_york", "los_angeles", "san_francisco", "seattle", "dallas", "new_orleans", "cincinnati", "baton_rouge",
   * "montgomery_county_md", "prince_georges_county_md", "norfolk", "buffalo", "orlando", "mesa", "raleigh",
   * "washington_dc", "minneapolis", "detroit". Required.
   */
  city: 'austin' | 'chicago' | 'new_york' | 'los_angeles' | 'san_francisco' | 'seattle' | 'dallas' | 'new_orleans' | 'cincinnati' | 'baton_rouge' | 'montgomery_county_md' | 'prince_georges_county_md' | 'norfolk' | 'buffalo' | 'orlando' | 'mesa' | 'raleigh' | 'washington_dc' | 'minneapolis' | 'detroit';
  /**
   * Trades: Words in a permit's type, work or description, such as roof, solar, hvac, deck or addition. Each is one
   * search. 1 to 8 items. Required.
   */
  trades: string[];
  /** Issued within (days): Only permits issued in the last this many days. From 1 to 365. Default: 30. */
  issued_within_days?: number;
  /**
   * Rows are: One row a permit, or one row a contractor with how many permits it pulled. One of "permits",
   * "contractors". Default: "permits".
   */
  view?: 'permits' | 'contractors';
  /**
   * Least job value (USD): Only permits whose declared value is at least this. Permits with no value are kept when
   * this is 0. At least 0. Default: 0.
   */
  min_value?: number;
  /**
   * Only permits that name a contractor: Leave out permits the city published without a contractor. Default: false.
   */
  require_contractor?: boolean;
  /**
   * Contractors to leave out: Names of contractors, such as your own business or current customers. At most 2000
   * items. Default: [].
   */
  exclude_contractors?: string[];
  /**
   * Permits read per trade: The newest this many permits are read for each trade word. From 10 to 200. Default:
   * 200.
   */
  permits_per_trade?: number;
  /**
   * Show a row again after (days): For a saved formula, how long before a delivered permit or contractor may come
   * back. From 1 to 365. Default: 90.
   */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many rows, newest permits or busiest contractors first. From 1 to 2000.
   * Default: 300.
   */
  max_results?: number;
}

/**
 * Price and Seller Watch (`price-seller-watch`): Who sells each of your products on Amazon, Best Buy, Target and
 * Newegg, at what price, what changed, and who is under your minimum.
 */
export interface PriceSellerWatchParams {
  /**
   * Products: One product an entry: its name as shoppers search it, and where you have them its UPC or EAN (code),
   * Amazon ASIN, brand, model and minimum advertised price (min_price). 1 to 50 items. Required.
   */
  products: JSONObject[];
  /**
   * Marketplaces: Where to look. Walmart often answers automated visits with a check, so its listings may be
   * missing from a run. Each one of "amazon", "bestbuy", "target", "newegg", "walmart". At least 1 item. Default:
   * ["amazon", "bestbuy", "target"].
   */
  marketplaces?: Array<'amazon' | 'bestbuy' | 'target' | 'newegg' | 'walmart'>;
  /**
   * Authorised sellers: Seller names as the marketplaces show them, such as Amazon.com or Best Buy. Empty treats
   * every seller as authorised. At most 500 items. Default: [].
   */
  authorised_sellers?: string[];
  /**
   * Price change worth an alert (%): A price that moved by at least this much since the last run raises an alert.
   * From 0 to 100. Default: 5.
   */
  price_change_pct?: number;
  /**
   * Amazon marketplace: Which Amazon to read. Best Buy, Target, Newegg and Walmart are read in the United States.
   * One of "us", "uk", "de", "fr", "it", "es", "ca". Default: "us".
   */
  amazon_marketplace?: 'us' | 'uk' | 'de' | 'fr' | 'it' | 'es' | 'ca';
  /**
   * Listings compared per marketplace: How many search results of each marketplace are checked against each
   * product. From 1 to 5. Default: 2.
   */
  candidates_per_marketplace?: number;
  /** Only rows with an alert: Leave out the offers that raise no alert. Default: false. */
  alerts_only?: boolean;
  /** Most rows: The run stops at this many offers, alerts first. From 1 to 2000. Default: 500. */
  max_results?: number;
}

/**
 * Property Comps (`property-comps`): Recently sold and listed homes like yours in a US area, with sale price, price
 * per square foot and the ZIP code average.
 */
export interface PropertyCompsParams {
  /**
   * Places: ZIP codes, cities with their state ("Austin, TX") or neighbourhoods, as Zillow names them. 1 to 10
   * items. Required.
   */
  locations: string[];
  /**
   * Kinds of home: The kinds of home that count as comparable. Each one of "house", "condo", "townhouse",
   * "multi_family", "manufactured". Default: ["house"].
   */
  home_types?: Array<'house' | 'condo' | 'townhouse' | 'multi_family' | 'manufactured'>;
  /** Least bedrooms: 0 for any. From 0 to 5. Default: 0. */
  min_beds?: number;
  /**
   * Living area (sq ft): The size range of a comparable home, such as 1200 to 1800 for a 1500 sq ft home. Default:
   * {"min": 0, "max": 20000}.
   */
  living_area?: IntRange;
  /** Show homes for sale too: The matching homes on the market now, as the competition. Default: true. */
  include_for_sale?: boolean;
  /** Sold within (days): Only homes sold in the last this many days. From 7 to 730. Default: 180. */
  sold_within_days?: number;
  /**
   * Homes read per place and kind: Zillow's first page of each place is read, up to this many homes, for sold and
   * for sale each. From 5 to 41. Default: 41.
   */
  homes_per_place?: number;
  /**
   * Most rows: The run stops at this many homes, newest sales first. Each sold home's page is read for its price.
   * From 1 to 500. Default: 60.
   */
  max_results?: number;
}

/**
 * Property Distress Signals (`property-distress-signals`): Properties in a US city with recent code violations,
 * distress permits or a stale listing, stacked by address and ranked.
 */
export interface PropertyDistressSignalsParams {
  /**
   * City: The US city or county whose open data is read. These publish both code cases and permits. One of
   * "austin", "chicago", "new_york", "los_angeles", "seattle", "new_orleans", "cincinnati", "montgomery_county_md",
   * "norfolk", "buffalo". Required.
   */
  city: 'austin' | 'chicago' | 'new_york' | 'los_angeles' | 'seattle' | 'new_orleans' | 'cincinnati' | 'montgomery_county_md' | 'norfolk' | 'buffalo';
  /**
   * Opened or issued within (days): Only cases opened, and permits issued, in the last this many days. From 1 to
   * 365. Default: 60.
   */
  within_days?: number;
  /**
   * Least lists a property is on: 2 keeps only properties on two lists or more (a code case and a distress permit,
   * or either and a listing). From 1 to 3. Default: 1.
   */
  min_lists?: number;
  /**
   * Case words: Only cases whose type or description holds one of these, such as structure, vacant or abatement.
   * Each word is one search; empty reads the newest cases of any kind. At most 8 items. Default: [].
   */
  case_keywords?: string[];
  /** Only cases still open: Leave out cases the city has closed. Default: false. */
  open_cases_only?: boolean;
  /**
   * Distress permit words: Permits whose type, work or description holds one of these are a signal. Each word is
   * one search. Empty leaves permits out. At most 8 items. Default: ["demoli", "fire damage", "vacant", "unsafe"].
   */
  permit_keywords?: string[];
  /** Cases read: The newest this many code cases are read. From 10 to 200. Default: 200. */
  cases_to_read?: number;
  /**
   * Permits read per word: The newest this many permits are read for each permit word. From 10 to 200. Default:
   * 100.
   */
  permits_per_word?: number;
  /**
   * Check each property on Zillow: Whether the home is listed, how long and at what price, with its size and value
   * estimate. One lookup a property. Default: true.
   */
  check_listings?: boolean;
  /**
   * Show a property again after (days): For a saved formula, how long before a delivered property may come back.
   * From 1 to 365. Default: 30.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many properties, most signals first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Rank Tracker (`rank-tracker`): Your domain's and your competitors' Google Search positions for each keyword, with
 * the top results and what moved since last run.
 */
export interface RankTrackerParams {
  /** Keywords: The searches to track, each as people type it. 1 to 100 items. Required. */
  keywords: string[];
  /** Your domain: Your site's domain, such as example.com; its subdomains count as it. Required. */
  your_domain: string;
  /**
   * Competitors' domains: Up to ten domains, such as rival.com, each tracked for every keyword. At most 10 items.
   * Default: [].
   */
  competitors?: string[];
  /** Country: The two-letter country whose results are read, such as us, gb or de. Default: "us". */
  country?: string;
  /**
   * Results pages read: 1 reads the top 10 results of each keyword, 2 the top 20, 3 the top 30; each page is one
   * search. From 1 to 3. Default: 1.
   */
  pages?: number;
  /** Language: The language of the results, such as en or de. Default: "en". */
  language?: string;
  /**
   * Top results shown: How many of the domains at the top of each keyword's results are listed on its rows. From 0
   * to 10. Default: 3.
   */
  top_results?: number;
  /** Most rows: The run stops at this many rows, one for each keyword and domain. From 1 to 1100. Default: 500. */
  max_results?: number;
}

/**
 * Reverse Sourcing (`reverse-sourcing`): Products that sell on Amazon for more than Target, Best Buy, Newegg or
 * Walmart charge, with profit and ROI after your fees.
 */
export interface ReverseSourcingParams {
  /**
   * Search words: Searched on Amazon (reverse, without ASINs) or on each retailer (forward), such as lego duplo or
   * air fryer. At most 10 items. Required.
   */
  queries: string[];
  /**
   * Start from: reverse starts from Amazon products and looks for them at the retailers; forward starts from the
   * retailers' search and looks for each product on Amazon. One of "reverse", "forward". Default: "reverse".
   */
  mode?: 'reverse' | 'forward';
  /**
   * Amazon products: For reverse, the ASINs to source. Leave empty to search Amazon for the words below instead. At
   * most 50 items. Default: [].
   */
  asins?: string[];
  /**
   * Retailers: Where to buy. Walmart often answers automated visits with a check, so its products may be missing
   * from a run. Each one of "target", "bestbuy", "newegg", "walmart". At least 1 item. Default: ["target",
   * "bestbuy"].
   */
  retailers?: Array<'target' | 'bestbuy' | 'newegg' | 'walmart'>;
  /**
   * Amazon referral fee (%): The share of the sale price Amazon keeps; 15% in most categories, 8% in some. From 0
   * to 50. Default: 15.
   */
  referral_fee_pct?: number;
  /**
   * Fulfilment and shipping a unit (USD): Your FBA fee, prep and inbound shipping for one unit. From 0 to 100.
   * Default: 5.
   */
  fulfilment_cost?: number;
  /** Least return on cost (%): Profit as a share of the retailer's price. From -100 to 1000. Default: 15. */
  min_roi_pct?: number;
  /** Least profit a unit (USD): Profit after the referral fee and fulfilment cost. At least -1000. Default: 2. */
  min_profit?: number;
  /**
   * Best Buy order: For forward, the order of Best Buy's results; best_discount reads its deepest reductions first.
   * One of "best_match", "best_discount", "best_selling". Default: "best_match".
   */
  bestbuy_sort?: 'best_match' | 'best_discount' | 'best_selling';
  /**
   * Results compared per search: How many search results are checked against each product. From 1 to 5. Default: 2.
   */
  candidates_per_retailer?: number;
  /**
   * Amazon products per search: For reverse without ASINs, how many products of each Amazon search are sourced.
   * From 1 to 48. Default: 10.
   */
  amazon_results?: number;
  /**
   * Retailer products per search: For forward, how many products of each retailer search are looked up on Amazon.
   * From 1 to 48. Default: 12.
   */
  retailer_results?: number;
  /** Most rows: The run stops at this many pairs, best return first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Review Mining (`review-mining`): The complaints in your products' or competitors' reviews on Target, Walmart and
 * Amazon, by topic, with the buyer's own words.
 */
export interface ReviewMiningParams {
  /**
   * Product pages: The address of each product's page on Target, Walmart, or an Amazon outside the US
   * (amazon.co.uk, .de, .ca ...). 1 to 30 items. Required.
   */
  products: string[];
  /**
   * Topics: Phrases to look for, matched as words and their forms ("broke" also finds "broken"). 1 to 40 items.
   * Default: a list of 20 values, which `get` on the formula shows.
   */
  topics?: string[];
  /** Most stars: Only reviews of this many stars or fewer. 5 reads every review. From 1 to 5. Default: 3. */
  max_stars?: number;
  /**
   * Reviews read first: Target and Walmart read their reviews in this order; Amazon reads the page's own. One of
   * "lowest_rating", "newest", "most_helpful". Default: "lowest_rating".
   */
  order?: 'lowest_rating' | 'newest' | 'most_helpful';
  /** Only reviews that mention a topic. Default: true. */
  only_with_topics?: boolean;
  /** Most rows: The run stops at this many reviews, the most topics first. From 1 to 2000. Default: 300. */
  max_results?: number;
}

/**
 * Review Velocity (`review-velocity`): Ratings and reviews of the apps, companies and games you follow, with how
 * many were added since the last run and per day.
 */
export interface ReviewVelocityParams {
  /**
   * Apps: An App Store app's address or its number (368677368 for Uber), or a Google Play app's package name, as
   * its address shows it after id= (com.ubercab). An app on both stores is given twice, once for each. At most 50
   * items. Required.
   */
  apps: string[];
  /**
   * Companies on Trustpilot: The company's website domain, such as chewy.com, for its Trustpilot reviews. At most
   * 50 items. Default: [].
   */
  companies?: string[];
  /**
   * Games on Steam: A Steam game's number or its store address, such as 1091500 for Cyberpunk 2077. At most 50
   * items. Default: [].
   */
  games?: string[];
  /**
   * Store country: The country whose App Store, Google Play and Steam store are read, as a two-letter code. Their
   * counts and ratings are per country. Default: "us".
   */
  country?: string;
  /** Most rows: The run stops at this many rows, the biggest moves first. From 1 to 200. Default: 200. */
  max_results?: number;
}

/**
 * Salary Benchmark (`salary-benchmark`): The pay employers advertise for a job in each place, as yearly ranges per
 * place, with every posting behind them.
 */
export interface SalaryBenchmarkParams {
  /** Job: The job to benchmark, and up to two other names it is advertised under. 1 to 3 items. Required. */
  job_titles: string[];
  /** Places: Each city, region or country to compare. 1 to 10 items. Required. */
  locations: string[];
  /**
   * Posted within (days): Only postings from the last this many days, so the figures are today's. From 1 to 60.
   * Default: 30.
   */
  posted_within_days?: number;
  /**
   * Job boards: Which boards to read. Reed and Totaljobs cover the UK (Reed states pay on most postings), Dice
   * technology roles in the US, Seek Australia, StepStone Germany. Each one of "indeed", "linkedin", "reed",
   * "totaljobs", "dice", "seek", "stepstone". At least 1 item. Default: ["indeed", "linkedin"].
   */
  sources?: Array<'indeed' | 'linkedin' | 'reed' | 'totaljobs' | 'dice' | 'seek' | 'stepstone'>;
  /**
   * Jobs read per search: How many postings to read for each job name, place and board; many do not state pay. From
   * 5 to 200. Default: 50.
   */
  results_per_search?: number;
  /**
   * Only titles that name the job: Keeps postings whose title names the job as whole words; boards also return near
   * matches, which would blur the figures. Default: true.
   */
  title_must_match?: boolean;
  /**
   * Leave out agencies' postings: Agencies often advertise a wide range; leave them out to see only what employers
   * state. Default: false.
   */
  exclude_agencies?: boolean;
  /**
   * Companies to add from Levels.fyi: Company names as Levels.fyi writes them; their pay for the job is added by
   * level, from what people reported. At most 20 items. Default: [].
   */
  levels_companies?: string[];
  /**
   * The job as Levels.fyi names it: Such as Software Engineer or Data Scientist. Empty uses the first job name.
   * Default: "".
   */
  levels_role?: string;
  /** Most rows: The run stops at this many rows, best paid first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * SEC Filing Monitor (`sec-filing-monitor`): New SEC filings of the companies you follow, insider trades, 8-Ks and
 * activist stakes first, each linked to the filing.
 */
export interface SecFilingMonitorParams {
  /**
   * Companies: Tickers (AAPL, BRK-B) or EDGAR's CIK numbers; a fund or a person who files is named by CIK. 1 to 100
   * items. Required.
   */
  companies: string[];
  /**
   * Form types: The forms to watch, as EDGAR writes them. Leave empty for every form. At most 20 items. Default: a
   * list of 10 values, which `get` on the formula shows.
   */
  forms?: string[];
  /** Filed within (days): Only filings made in the last this many days. From 1 to 90. Default: 7. */
  filed_within_days?: number;
  /**
   * Only 8-Ks reporting these items: For example 5.02 (officers leaving or joining) or 1.01 (a material agreement).
   * Leave empty for every 8-K. Default: [].
   */
  eight_k_items?: string[];
  /** Include amendments: Amended filings, whose form ends in /A. Default: true. */
  include_amendments?: boolean;
  /**
   * Filings read per company: The newest filings read for each company; raise it for a long window on a company
   * that files often. From 1 to 100. Default: 40.
   */
  per_company?: number;
  /** Most rows: The run stops at this many filings, most significant first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Seller Identity (`seller-identity`): The legal business behind each marketplace seller of your products, with its
 * address, website, domain record and register entry.
 */
export interface SellerIdentityParams {
  /**
   * Your products on Amazon: ASINs whose sellers to identify. Every seller with an offer on them is read. At most
   * 30 items. Required.
   */
  asins: string[];
  /**
   * Amazon seller ids: Sellers to identify directly, by the id in their storefront's address (seller=...). At most
   * 100 items. Default: [].
   */
  seller_ids?: string[];
  /** Walmart sellers: Walmart Marketplace sellers by id or storefront address. At most 100 items. Default: []. */
  walmart_sellers?: string[];
  /**
   * Amazon marketplace: Which Amazon the products and sellers are on. One of "us", "uk", "de", "fr", "it", "es",
   * "ca". Default: "us".
   */
  marketplace?: 'us' | 'uk' | 'de' | 'fr' | 'it' | 'es' | 'ca';
  /**
   * Authorised sellers: Storefront names to leave out, such as your own and your distributors'. At most 500 items.
   * Default: ["Amazon.com", "Amazon"].
   */
  authorised_sellers?: string[];
  /**
   * Find each business's website and its domain record: Looks the business up by name, and reads the registration
   * of the domain it finds. Default: true.
   */
  find_website?: boolean;
  /** Look UK businesses up at Companies House: For a seller whose address is in the United Kingdom. Default: true. */
  check_company_register?: boolean;
  /** Most rows: The run stops at this many sellers, the most identified first. From 1 to 500. Default: 100. */
  max_results?: number;
}

/**
 * Shopify Niche Research (`shopify-niche-research`): The products of a niche's Shopify stores, with price, newness
 * and reductions, and similar products on AliExpress with the margin.
 */
export interface ShopifyNicheResearchParams {
  /** Shopify stores: The stores of the niche, by domain. 1 to 20 items. Required. */
  stores: string[];
  /**
   * Niche words: Keep products whose title, type or tags hold one of these. Empty keeps every product. At most 20
   * items. Default: [].
   */
  niche_words?: string[];
  /**
   * Collection: A collection to read in each store, by its handle, such as best-sellers. Empty reads the catalogue.
   * Default: "".
   */
  collection?: string;
  /** Look for similar products on AliExpress: One search a product. Default: true. */
  find_suppliers?: boolean;
  /** Products read per store. From 10 to 250. Default: 250. */
  products_per_store?: number;
  /**
   * Most rows: The run stops at this many products, newest and reduced first. Each is one AliExpress search. From 1
   * to 500. Default: 30.
   */
  max_results?: number;
}

/**
 * Social Sentiment (`social-sentiment`): How often the tickers and brands you follow are mentioned on social
 * sources, in what tone, and how both moved since the last run.
 */
export interface SocialSentimentParams {
  /**
   * Tickers or brands: Each is searched as you type it and counted where a post names it as a whole word, such as
   * Nvidia or $NVDA. Mastodon is searched by hashtag, so only one-word terms are read there. 1 to 10 items.
   * Required.
   */
  terms: string[];
  /**
   * Sources: Where to look. Telegram, X and Bluesky are read through the channels and accounts named below. Each
   * one of "hackernews", "mastodon", "youtube", "telegram", "x", "bluesky", "stackoverflow". At least 1 item.
   * Default: ["hackernews", "mastodon", "youtube", "telegram", "x", "bluesky"].
   */
  sources?: Array<'hackernews' | 'mastodon' | 'youtube' | 'telegram' | 'x' | 'bluesky' | 'stackoverflow'>;
  /**
   * Mentions of the last (days): Only mentions posted in the last this many days are counted. YouTube comments
   * carry no date and are not cut. From 1 to 30. Default: 7.
   */
  window_days?: number;
  /**
   * Posts read per term on Mastodon and Telegram: The most posts read for one term on Mastodon and in each Telegram
   * channel, newest first. Hacker News and Stack Overflow are read 100 deep. From 5 to 100. Default: 40.
   */
  per_source_limit?: number;
  /**
   * Telegram channels: Public channels whose posts are searched for each term, by name (WatcherGuru) or address. At
   * most 10 items. Default: ["WatcherGuru", "financialjuice"].
   */
  telegram_channels?: string[];
  /**
   * X accounts: Accounts whose latest posts (X shows the newest five of each) are read for mentions. At most 20
   * items. Default: ["DeItaone", "unusual_whales", "zerohedge", "StockMKTNewz", "WatcherGuru"].
   */
  x_accounts?: string[];
  /**
   * Bluesky accounts: Accounts by handle, such as reuters.com, whose latest posts are read for mentions. At most 20
   * items. Default: ["bloomberg.com", "reuters.com", "wsj.com"].
   */
  bluesky_accounts?: string[];
  /** Bluesky posts read per account: The newest posts read from each Bluesky account. From 5 to 100. Default: 30. */
  posts_per_account?: number;
  /**
   * YouTube videos per term: How many of the videos a YouTube search for the term finds first have their comments
   * read. From 1 to 5. Default: 2.
   */
  videos_per_term?: number;
  /** Comments read per video: The newest comments read on each video. From 5 to 100. Default: 20. */
  comments_per_video?: number;
  /**
   * Mastodon server: The server whose view of a hashtag is read; a large one sees the posts of many others.
   * Default: "mastodon.social".
   */
  mastodon_server?: string;
  /**
   * Positive words: A mention that uses one of these as a whole word, and none of the negative ones, counts as
   * positive. At most 100 items. Default: a list of 44 values, which `get` on the formula shows.
   */
  positive_words?: string[];
  /**
   * Negative words: A mention that uses one of these as a whole word, and none of the positive ones, counts as
   * negative. At most 100 items. Default: a list of 52 values, which `get` on the formula shows.
   */
  negative_words?: string[];
  /** Most rows: The run stops at this many rows, the biggest moves first. From 1 to 100. Default: 100. */
  max_results?: number;
}

/**
 * Stale Listings (`stale-listings`): Homes for sale that have sat on Zillow for months or been cut in price, with
 * list price, Zestimate and the listing agent.
 */
export interface StaleListingsParams {
  /**
   * Places: Cities with their state ("Austin, TX"), ZIP codes or counties, as Zillow names them. 1 to 20 items.
   * Required.
   */
  locations: string[];
  /**
   * Least days on Zillow: Homes listed at least this long. A home with a price cut is kept sooner when the next
   * option is on. From 1 to 730. Default: 90.
   */
  min_days_on_market?: number;
  /**
   * A price cut makes a listing stale too: Keep a home whose price was cut, however long it has been listed.
   * Default: true.
   */
  price_cut_counts?: boolean;
  /**
   * Kinds of home: Which kinds of home to search. Each one of "house", "condo", "townhouse", "multi_family",
   * "manufactured", "land". Default: ["house", "townhouse", "multi_family"].
   */
  home_types?: Array<'house' | 'condo' | 'townhouse' | 'multi_family' | 'manufactured' | 'land'>;
  /** Least price (USD): 0 for no floor. At least 0. Default: 0. */
  min_price?: number;
  /** Most price (USD): 0 for no ceiling. At least 0. Default: 0. */
  max_price?: number;
  /**
   * Listings read per place: Zillow's first page of each place is read, up to this many homes. From 5 to 41.
   * Default: 41.
   */
  listings_per_place?: number;
  /**
   * Read each listing's agent and history: The listing agent and brokerage, the Zestimate and the price history.
   * One page a listing. Default: true.
   */
  with_agent?: boolean;
  /**
   * Show a listing again after (days): For a saved formula, how long before a delivered listing may come back. From
   * 1 to 365. Default: 30.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many listings, longest listed first. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Storefront Research (`storefront-research`): What a competing Amazon seller sells in your niche, its prices and
 * Buy Box, the sellers it competes with, and where to source it.
 */
export interface StorefrontResearchParams {
  /** Competitors' seller ids: The id in a storefront's address (seller=...). 1 to 10 items. Required. */
  seller_ids: string[];
  /**
   * Niche search words: Searched on Amazon; the listings found are checked for the competitor's offers. At most 10
   * items. Required.
   */
  queries: string[];
  /**
   * Best-seller lists: Also check the products of these Best Sellers lists, such as toys-and-games. At most 5
   * items. Default: [].
   */
  categories?: string[];
  /** Listings per search: Each listing is one read of its offers. From 1 to 48. Default: 20. */
  results_per_search?: number;
  /** Look for each product at Target and Best Buy. Default: true. */
  source_at_retailers?: boolean;
  /** Amazon referral fee (%). From 0 to 50. Default: 15. */
  referral_fee_pct?: number;
  /** Fulfilment and shipping a unit (USD). From 0 to 100. Default: 5. */
  fulfilment_cost?: number;
  /** Most rows: The run stops at this many products, Buy Box first. From 1 to 500. Default: 100. */
  max_results?: number;
}

/**
 * Short-Term Rental Comps (`str-underwriting`): Airbnb and Vrbo rentals in an area for your dates, with nightly
 * rate, rating, reviews and the area's average rate.
 */
export interface StrUnderwritingParams {
  /**
   * Place: Where, as you would type it into Airbnb, with the country, such as "Nashville, Tennessee, United
   * States". Required.
   */
  location: string;
  /** Check-in: The first night, YYYY-MM-DD. Rates are for this stay. Required. */
  checkin: string;
  /** Check-out: The day of departure, YYYY-MM-DD. Required. */
  checkout: string;
  /** Guests: Adults staying; rentals too small for them are not offered. From 1 to 16. Default: 2. */
  guests?: number;
  /** Platforms: Where to look. Each one of "airbnb", "vrbo". At least 1 item. Default: ["airbnb", "vrbo"]. */
  platforms?: Array<'airbnb' | 'vrbo'>;
  /**
   * Airbnb currency: The currency Airbnb shows prices in. Vrbo shows the destination's own. One of "USD", "EUR",
   * "GBP", "CAD", "AUD". Default: "USD".
   */
  currency?: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
  /** Least reviews: Leave out rentals with fewer reviews, such as new listings. At least 0. Default: 0. */
  min_reviews?: number;
  /** Most rows: The run stops at this many rentals, most reviewed first. From 1 to 500. Default: 150. */
  max_results?: number;
}

/**
 * Supplier Discovery (`supplier-discovery`): Suppliers of a product from IndiaMART, Google Maps, Gelbe Seiten and
 * ThomasNet, each with location, website and email.
 */
export interface SupplierDiscoveryParams {
  /**
   * Products: What you buy, as a supplier would list it, such as CNC machined parts or corrugated boxes. Each is
   * searched on its own. 1 to 5 items. Required.
   */
  products: string[];
  /**
   * Places: Towns or regions to find suppliers in on Google Maps and Gelbe Seiten, such as Cleveland, OH or
   * Stuttgart. IndiaMART is searched across India whatever is given here. At most 5 items. Default: [].
   */
  places?: string[];
  /**
   * Directories: IndiaMART (India), Google Maps (anywhere, by place), Gelbe Seiten (Germany, by town) and ThomasNet
   * (the profiles you give). Each one of "indiamart", "google_maps", "gelbeseiten", "thomasnet". At least 1 item.
   * Default: ["indiamart", "google_maps"].
   */
  sources?: Array<'indiamart' | 'google_maps' | 'gelbeseiten' | 'thomasnet'>;
  /**
   * ThomasNet profiles: The links or ids of ThomasNet supplier profiles you have shortlisted, read in full when
   * ThomasNet is chosen. At most 50 items. Default: [].
   */
  thomasnet_profiles?: string[];
  /**
   * Map listings per search: How many Google Maps listings are read for each product and place. From 5 to 60.
   * Default: 20.
   */
  per_search?: number;
  /**
   * Only verified IndiaMART sellers: Keeps the IndiaMART sellers it shows as verified or holding its TrustSEAL.
   * Default: false.
   */
  verified_only?: boolean;
  /**
   * Lowest rating: Leaves out suppliers rated lower by their buyers or reviewers. A supplier with no rating is
   * kept. From 0 to 5. Default: 0.
   */
  min_rating?: number;
  /** Suppliers to leave out: Names, such as the suppliers you already buy from. At most 1000 items. Default: []. */
  exclude_companies?: string[];
  /**
   * Websites to leave out: Domains, such as acme.com, of the suppliers you already buy from. At most 1000 items.
   * Default: [].
   */
  exclude_domains?: string[];
  /**
   * Read each IndiaMART product page: Adds the supplier's town and business type, such as manufacturer or exporter.
   * One unit for each IndiaMART supplier. Default: true.
   */
  indiamart_details?: boolean;
  /**
   * Only suppliers with an email: Keeps the suppliers whose own website publishes an email address that passes the
   * check. Default: false.
   */
  require_email?: boolean;
  /** Most rows: The run stops at this many suppliers. From 1 to 1000. Default: 100. */
  max_results?: number;
}

/**
 * Talent Sourcing (`talent-sourcing`): People who posted that they want to be hired, or show their work, in your
 * role and place, scored on the skills you need.
 */
export interface TalentSourcingParams {
  /** Job title: The role you are hiring for, as people would write it about themselves. Required. */
  job_title: string;
  /** Location: The city, region or country the people should be in. Write Remote for anywhere. Required. */
  location: string;
  /**
   * Skills: What the role asks for. They score each person, and pick the GitHub projects to look through. At most
   * 10 items. Default: [].
   */
  skills?: string[];
  /**
   * Where to look: GitHub finds only developers whose profile gives the place, and is searched only when skills are
   * given. Each one of "hackernews", "github". At least 1 item. Default: ["hackernews"].
   */
  sources?: Array<'hackernews' | 'github'>;
  /**
   * Read more posts: Reads the newest 300 posts that name the place instead of 200, reaching further back. Default:
   * false.
   */
  more_results?: boolean;
  /**
   * Posted within (days): Only posts from the last this many days; an older post may no longer be true. From 7 to
   * 730. Default: 365.
   */
  posted_within_days?: number;
  /**
   * GitHub profiles to read: How many developers' profiles to open, from the projects that use the skills. From 1
   * to 50. Default: 15.
   */
  github_profiles?: number;
  /** Least skills named: Leave out a person who names fewer of the skills than this. From 0 to 10. Default: 0. */
  min_skills?: number;
  /**
   * Show a person again after (days): For a saved formula, how long before a delivered person may come back. From 1
   * to 365. Default: 90.
   */
  resurface_after_days?: number;
  /** Most rows: The run stops at this many people, best first. From 1 to 500. Default: 50. */
  max_results?: number;
}

/**
 * Tender Alerts (`tender-alerts`): New public tenders that match your words and codes, from the EU, UK and US, with
 * buyer, deadline, value and link.
 */
export interface TenderAlertsParams {
  /**
   * Words: What you sell, as a buyer would write it, such as cybersecurity or road resurfacing. Each is searched on
   * its own. Leave empty to take every notice of the window, or to match on CPV codes alone. At most 10 items.
   * Default: [].
   */
  keywords?: string[];
  /**
   * Notice boards: TED (European Union), Find a Tender and Contracts Finder (United Kingdom), Grants.gov, New York
   * City's City Record, Chicago's and the MTA's contracts (awards only), and SAM.gov, which is read where it is
   * offered. Each one of "ted", "find_a_tender", "contracts_finder", "grants_gov", "new_york_city", "chicago",
   * "ny_mta", "sam_gov". At least 1 item. Default: ["ted", "find_a_tender", "contracts_finder", "grants_gov",
   * "new_york_city", "sam_gov"].
   */
  sources?: Array<'ted' | 'find_a_tender' | 'contracts_finder' | 'grants_gov' | 'new_york_city' | 'chicago' | 'ny_mta' | 'sam_gov'>;
  /**
   * Notice stages: Pre-RFP notices (prior information, sources sought, presolicitation, forecasted grants and UK
   * notices of planned procurements), open tenders, or awards. Each one of "planning", "tender", "award". At least
   * 1 item. Default: ["tender"].
   */
  notice_types?: Array<'planning' | 'tender' | 'award'>;
  /**
   * Published within (days): Only notices published in the last this many days, today included. Run daily, 3 covers
   * a weekend. From 1 to 30. Default: 3.
   */
  published_within_days?: number;
  /**
   * CPV codes: Eight-digit CPV codes, such as 72000000 for IT services. TED is searched by them; a UK notice is
   * kept when its main code is one of them. A notice matching your words or your codes is kept. At most 10 items.
   * Default: [].
   */
  cpv_codes?: string[];
  /**
   * Buyers' countries: Three-letter codes, such as DEU, FRA, GBR or USA. Leave empty for every country of the
   * boards you chose. At most 30 items. Default: [].
   */
  countries?: string[];
  /**
   * NAICS codes (SAM.gov): Only SAM.gov notices in these industry codes, 2 to 6 digits, such as 541512. At most 10
   * items. Default: [].
   */
  naics_codes?: string[];
  /**
   * Set-asides (SAM.gov): Only SAM.gov notices set aside for these, by SAM.gov's codes, such as SBA, 8A, HZC,
   * SDVOSBC or WOSB. At most 10 items. Default: [].
   */
  set_asides?: string[];
  /**
   * Places of performance (SAM.gov): Only SAM.gov notices for work in these US states, as two letters. At most 10
   * items. Default: [].
   */
  us_states?: string[];
  /**
   * At least this many days to respond: Leaves out notices due sooner. A notice past its deadline is always left
   * out; one that states no deadline is kept. From 0 to 365. Default: 0.
   */
  min_days_left?: number;
  /**
   * Due within (days): Only notices due within this many days. 0 keeps every deadline, and notices that state none.
   * From 0 to 730. Default: 0.
   */
  due_within_days?: number;
  /**
   * Leave out titles with: Notices whose title holds one of these words are left out, such as cleaning or catering.
   * At most 30 items. Default: [].
   */
  exclude_words?: string[];
  /**
   * Read each grant in full: Adds a Grants.gov opportunity's funding, largest award, eligibility and description.
   * One more unit for each grant. Default: true.
   */
  grant_details?: boolean;
  /** Most rows: The run stops at this many notices, best matches first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Tender Change Watch (`tender-change-watch`): The tenders, grants and awards you watch, read again each run, with
 * a row only when a deadline, status or value changed.
 */
export interface TenderChangeWatchParams {
  /**
   * Notices to watch: A Grants.gov opportunity's id or link, a USAspending.gov award's id or link, or a UK
   * procurement's Open Contracting id (ocds-…, shown on its Find a Tender or Contracts Finder notice). Anything
   * else is left out. 1 to 150 items. Required.
   */
  watch: string[];
  /**
   * UK notices read (days): For UK procurements, how many days of new notices are read for their updates. Run
   * daily, 3 is enough. From 1 to 30. Default: 7.
   */
  uk_days?: number;
  /** Most rows: The run stops at this many changed notices. From 1 to 1000. Default: 200. */
  max_results?: number;
}

/**
 * Unlinked Mentions (`unlinked-mentions`): Pages that name your brand but do not link to your site, each read to be
 * sure, with the email the site publishes.
 */
export interface UnlinkedMentionsParams {
  /**
   * Brand name: The name as people write it. A name that is also a common word finds pages using the word as well.
   * Required.
   */
  brand: string;
  /** Your domain: The domain a link should lead to, such as example.com. Pages on it are left out. Required. */
  brand_domain: string;
  /**
   * Searches: Words searched with the name, each its own search; an empty one searches the name alone. 1 to 10
   * items. Default: ["", "review", "alternatives", "pricing", "integration"].
   */
  search_terms?: string[];
  /** Include news stories: Also reads the stories the news search lists for the name. Default: true. */
  include_news?: boolean;
  /**
   * Your other domains: Other domains of yours; a link to any of them counts as a link, and pages on them are left
   * out. At most 20 items. Default: [].
   */
  other_domains?: string[];
  /**
   * Pages to read: How many of the pages found are read, news first, then the best placed in search. From 5 to 150.
   * Default: 40.
   */
  pages_to_read?: number;
  /**
   * Results pages per search: How many pages of results to read for each search, about ten results a page. From 1
   * to 3. Default: 1.
   */
  search_pages?: number;
  /**
   * Sites to leave out: Domains never shown, such as social networks and review sites where no editor adds links.
   * At most 2000 items. Default: a list of 22 values, which `get` on the formula shows.
   */
  exclude_domains?: string[];
  /** Search country: The two-letter country whose search results are read, such as us, gb or de. Default: "us". */
  country?: string;
  /** Search language: The language of the results, such as en or de. Default: "en". */
  language?: string;
  /**
   * Only sites with an email: Keeps the pages whose site publishes an email address that passes the check. Default:
   * false.
   */
  require_email?: boolean;
  /**
   * Show a page again after (days): For a saved formula, how long before a delivered page may come back. From 1 to
   * 365. Default: 180.
   */
  resurface_after_days?: number;
  /**
   * Most rows: The run stops at this many pages, news and pages naming the brand in their title first. From 1 to
   * 1000. Default: 100.
   */
  max_results?: number;
}

/**
 * Used-Car Arbitrage (`used-car-arbitrage`): Copart lots selling well below what the same make, model and year
 * fetch at retail near you, ranked by the spread, with bid moves.
 */
export interface UsedCarArbitrageParams {
  /** Make: The make, such as Toyota or Ford. Required. */
  make: string;
  /** Models: The models of that make, named as Copart names them, such as Camry or RAV4. 1 to 10 items. Required. */
  models: string[];
  /** Your ZIP code: Where you would sell the cars. Retail comparables are the listings around it. Required. */
  zip: string;
  /**
   * Model years: The model years to search. Each year of each model is one search for retail comparables. Default:
   * {"min": 2018, "max": 2022}.
   */
  years?: IntRange;
  /**
   * Lots to watch: Copart lot numbers or lot pages you follow, read on every run whether or not a search finds
   * them. At most 50 items. Default: [].
   */
  watch_lots?: string[];
  /**
   * Yard states: Two-letter codes of the states whose yards you buy from, such as TX. Leave empty for all. At most
   * 60 items. Default: [].
   */
  states?: string[];
  /**
   * Most miles: Lots with more miles on the odometer are left out. 0 for any mileage. From 0 to 500000. Default: 0.
   */
  max_odometer?: number;
  /**
   * Leave out titles: Words of the titles to leave out. By default the cars that can never be titled for the road
   * again, which no retail price fits. At most 20 items. Default: ["NON-REPAIRABLE", "DESTRUCTION", "SCRAP",
   * "JUNK", "PARTS ONLY"].
   */
  exclude_titles?: string[];
  /** Clean titles only: Leaves out salvage and other branded titles. Default: false. */
  clean_title_only?: boolean;
  /** Runs and drives only: Keeps the lots Copart marks as running and driving. Default: false. */
  runs_and_drives_only?: boolean;
  /**
   * Leave out damage: Words of the main damage to leave out, such as FLOOD, BURN or ALL OVER. At most 20 items.
   * Default: [].
   */
  exclude_damage?: string[];
  /**
   * Least current bid ($): Leaves out lots whose bidding has barely begun, whose spread on a first small bid says
   * little. A lot with a buy-it-now price is kept. 0 keeps every lot. From 0 to 100000. Default: 1000.
   */
  min_bid?: number;
  /**
   * A bid that counts (% of retail): A lot whose current bid is under this share of its retail median ranks after
   * the others, since bidding usually goes well past it. A buy-it-now price always counts. From 0 to 90. Default:
   * 25.
   */
  serious_bid_pct?: number;
  /**
   * Include lots selling today: Lots whose sale is on the day of the run, which may be over when the rows arrive.
   * Days are whole calendar days (UTC). A lot you watch is kept on its sale day. Default: false.
   */
  include_sale_day?: boolean;
  /**
   * Lots read per model: How many of Copart's lots to read for each model, the soonest sales first. One of 20, 50,
   * 100. Default: 100.
   */
  lots_per_model?: 20 | 50 | 100;
  /**
   * Least spread ($): Lots whose retail median is less than this above their price are left out. From 0 to 100000.
   * Default: 2000.
   */
  min_spread?: number;
  /**
   * Retail comparables from: The sites whose dealer listings price each lot. A car listed on both counts once. Each
   * one of "cargurus", "autotrader". At least 1 item. Default: ["cargurus", "autotrader"].
   */
  comp_sources?: Array<'cargurus' | 'autotrader'>;
  /**
   * Comparables within (miles): How far from your ZIP code a retail listing may be. One of 25, 50, 75, 100, 200,
   * 500. Default: 100.
   */
  radius?: 25 | 50 | 75 | 100 | 200 | 500;
  /**
   * Similar mileage (miles either way): Comparables within this many miles of the lot's odometer are preferred. 0
   * compares every mileage. From 0 to 100000. Default: 30000.
   */
  mileage_band?: number;
  /**
   * Price on any mileage when few are similar: When too few comparables have a similar mileage, price the lot on
   * every mileage instead of leaving it out. A lot with far more miles than most listings then looks better than it
   * is. Default: false.
   */
  any_mileage_fallback?: boolean;
  /** Least comparables: A lot priced on fewer retail listings than this is left out. From 1 to 20. Default: 3. */
  min_comps?: number;
  /**
   * Comparables searches: The most retail searches for each site, one for each make, model and year found. From 1
   * to 100. Default: 40.
   */
  comp_searches?: number;
  /** Most rows: The run stops at this many lots, widest spread first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * VC Deal Sourcing (`vc-deal-sourcing`): Young startups gaining traction on GitHub, Hacker News and Y Combinator,
 * one row each with its signals and website.
 */
export interface VcDealSourcingParams {
  /**
   * Topics: What you invest in, as words a startup would describe itself with (agents, database, robotics). Leave
   * empty for everything. At most 10 items. Default: [].
   */
  topics?: string[];
  /**
   * Within the last (days): How new a repository, a Show HN or a Y Combinator launch may be. From 1 to 90. Default:
   * 30.
   */
  within_days?: number;
  /**
   * Where to look: GitHub's new and trending repositories, Show HN on Hacker News, and Y Combinator's directory.
   * Each one of "github", "hacker_news", "ycombinator". At least 1 item. Default: ["github", "hacker_news",
   * "ycombinator"].
   */
  sources?: Array<'github' | 'hacker_news' | 'ycombinator'>;
  /** Fewest GitHub stars: A repository with fewer stars is left out. From 0 to 100000. Default: 200. */
  min_stars?: number;
  /** Fewest Show HN points: A Show HN with fewer points is left out. From 0 to 10000. Default: 50. */
  min_hn_points?: number;
  /**
   * Leave out: GitHub accounts, domains or company names to leave out; by default, large companies whose
   * repositories trend. At most 1000 items. Default: a list of 47 values, which `get` on the formula shows.
   */
  exclude?: string[];
  /**
   * Results read per search: How many repositories, Show HN posts and Y Combinator companies to read for each
   * topic. From 5 to 100. Default: 30.
   */
  results_per_search?: number;
  /** Most rows: The run stops at this many startups, strongest signals first. From 1 to 2000. Default: 200. */
  max_results?: number;
}

/**
 * Web Rank Tracker (`web-rank-tracker`): Where the websites you follow rank in Similarweb's most-visited rankings,
 * by country and category, and how they moved since last run.
 */
export interface WebRankTrackerParams {
  /** Websites: The domains to follow, such as etsy.com. 1 to 30 items. Required. */
  domains: string[];
  /**
   * Countries: The countries whose rankings to read, or worldwide. Each one of "worldwide", "US", "GB", "DE", "FR",
   * "CA", "AU", "JP", "IN", "BR", "MX", "IT", "ES", "NL", "SE", "CH", "KR", "SG", "AE", "SA", "ZA", "TR", "PL",
   * "ID", "PH", "TH", "VN", "IL", "IE", "NZ". 1 to 4 items. Default: ["US"].
   */
  countries?: Array<'worldwide' | 'US' | 'GB' | 'DE' | 'FR' | 'CA' | 'AU' | 'JP' | 'IN' | 'BR' | 'MX' | 'IT' | 'ES' | 'NL' | 'SE' | 'CH' | 'KR' | 'SG' | 'AE' | 'SA' | 'ZA' | 'TR' | 'PL' | 'ID' | 'PH' | 'TH' | 'VN' | 'IL' | 'IE' | 'NZ'>;
  /**
   * Categories: The rankings to read in each country. All is the ranking of every category together, 50 places
   * deep; a category's ranking shows 50 places worldwide and 5 in one country. Each one of "all",
   * "ai-chatbots-and-tools", "arts-and-entertainment", "business-and-consumer-services", "community-and-society",
   * "computers-electronics-and-technology", "crypto-and-blockchain", "e-commerce-and-shopping", "finance",
   * "food-and-drink", "gambling", "games", "health", "heavy-industry-and-engineering", "hobbies-and-leisure",
   * "home-and-garden", "jobs-and-career", "law-and-government", "lifestyle", "news-and-media", "pets-and-animals",
   * "reference-materials", "science-and-education", "sports", "travel-and-tourism", "vehicles". 1 to 4 items.
   * Default: ["all"].
   */
  categories?: Array<'all' | 'ai-chatbots-and-tools' | 'arts-and-entertainment' | 'business-and-consumer-services' | 'community-and-society' | 'computers-electronics-and-technology' | 'crypto-and-blockchain' | 'e-commerce-and-shopping' | 'finance' | 'food-and-drink' | 'gambling' | 'games' | 'health' | 'heavy-industry-and-engineering' | 'hobbies-and-leisure' | 'home-and-garden' | 'jobs-and-career' | 'law-and-government' | 'lifestyle' | 'news-and-media' | 'pets-and-animals' | 'reference-materials' | 'science-and-education' | 'sports' | 'travel-and-tourism' | 'vehicles'>;
  /** Most rows: The run stops at this many rows, the biggest moves first. From 1 to 500. Default: 500. */
  max_results?: number;
}

/**
 * Wholesale Catalogue Check (`wholesale-catalog-check`): Your supplier's price list checked against Amazon line by
 * line, with Amazon's price, reviews and your margin after fees.
 */
export interface WholesaleCatalogCheckParams {
  /**
   * Supplier catalogue: One line a product, from the supplier's sheet - its UPC or EAN (code), your cost, the name,
   * and the case pack when the cost is for a case. 1 to 500 items. Required.
   */
  catalog: JSONObject[];
  /** Amazon marketplace: Where you sell. One of "us", "uk", "de", "it", "es", "ca". Default: "us". */
  marketplace?: 'us' | 'uk' | 'de' | 'it' | 'es' | 'ca';
  /**
   * Currency of your costs: Costs are compared only with Amazon prices in this currency. One of "USD", "GBP",
   * "EUR", "CAD". Default: "USD".
   */
  cost_currency?: 'USD' | 'GBP' | 'EUR' | 'CAD';
  /**
   * Least return on cost (%): Lines below this are left out. 0 keeps every line that makes money; -100 keeps every
   * line found. From -100 to 1000. Default: 0.
   */
  min_roi_pct?: number;
  /** Amazon referral fee (%): The share of the sale price Amazon keeps. From 0 to 50. Default: 15. */
  referral_fee_pct?: number;
  /**
   * Fulfilment and shipping a unit: Your FBA fee, prep and inbound shipping for one unit, in the currency of your
   * costs. From 0 to 100. Default: 4.
   */
  fulfilment_cost?: number;
  /**
   * Read each listing's page: Its Buy Box price, whether Amazon sells it, and stock. One page a line found.
   * Default: true.
   */
  check_offer?: boolean;
  /** Most rows: The run stops at this many lines, best return first. From 1 to 500. Default: 500. */
  max_results?: number;
}

/** Each formula this version of the library knows, by id, with the type of its parameters. */
export interface FormulaParamsById {
  'account-hiring-check': AccountHiringCheckParams;
  'account-research': AccountResearchParams;
  'acquisition-universe': AcquisitionUniverseParams;
  'ad-activity-trigger': AdActivityTriggerParams;
  'ad-creative-research': AdCreativeResearchParams;
  'agency-ad-mining': AgencyAdMiningParams;
  'agency-lists': AgencyListsParams;
  'announcement-trigger': AnnouncementTriggerParams;
  'app-intelligence': AppIntelligenceParams;
  'award-teaming': AwardTeamingParams;
  'broken-link-prospects': BrokenLinkProspectsParams;
  'broker-directory': BrokerDirectoryParams;
  'business-for-sale-alerts': BusinessForSaleAlertsParams;
  'candidate-reverse-marketing': CandidateReverseMarketingParams;
  'champion-tracker': ChampionTrackerParams;
  'company-diligence': CompanyDiligenceParams;
  'competitor-price-tracker': CompetitorPriceTrackerParams;
  'competitor-review-mining': CompetitorReviewMiningParams;
  'compound-signal-score': CompoundSignalScoreParams;
  'contractor-license-watch': ContractorLicenseWatchParams;
  'crowdfunding-leads': CrowdfundingLeadsParams;
  'deal-site-monitor': DealSiteMonitorParams;
  'directory-to-leads': DirectoryToLeadsParams;
  'ecommerce-panel': EcommercePanelParams;
  'enterprise-ats-sweep': EnterpriseAtsSweepParams;
  'event-organizer-leads': EventOrganizerLeadsParams;
  'exhibitor-prospects': ExhibitorProspectsParams;
  'footprint-prospects': FootprintProspectsParams;
  'freelance-gig-feed': FreelanceGigFeedParams;
  'funded-and-hiring': FundedAndHiringParams;
  'hiring-signal-outbound': HiringSignalOutboundParams;
  'hiring-velocity': HiringVelocityParams;
  'home-services-pros': HomeServicesProsParams;
  'hotel-rate-shop': HotelRateShopParams;
  'influencer-discovery': InfluencerDiscoveryParams;
  'job-order-hunter': JobOrderHunterParams;
  'job-seeker-targets': JobSeekerTargetsParams;
  'knowledge-base-crawl': KnowledgeBaseCrawlParams;
  'landlord-agent-leads': LandlordAgentLeadsParams;
  'launch-batch-lists': LaunchBatchListsParams;
  'link-intersect': LinkIntersectParams;
  'listing-compliance': ListingComplianceParams;
  'literature-sweep': LiteratureSweepParams;
  'local-business-leads': LocalBusinessLeadsParams;
  'long-open-roles': LongOpenRolesParams;
  'lookalike-companies': LookalikeCompaniesParams;
  'marketplace-flips': MarketplaceFlipsParams;
  'menu-price-tracker': MenuPriceTrackerParams;
  'out-of-stock-opportunity': OutOfStockOpportunityParams;
  'people-list-with-openers': PeopleListWithOpenersParams;
  'permit-status-watch': PermitStatusWatchParams;
  'permit-trade-leads': PermitTradeLeadsParams;
  'price-seller-watch': PriceSellerWatchParams;
  'property-comps': PropertyCompsParams;
  'property-distress-signals': PropertyDistressSignalsParams;
  'rank-tracker': RankTrackerParams;
  'reverse-sourcing': ReverseSourcingParams;
  'review-mining': ReviewMiningParams;
  'review-velocity': ReviewVelocityParams;
  'salary-benchmark': SalaryBenchmarkParams;
  'sec-filing-monitor': SecFilingMonitorParams;
  'seller-identity': SellerIdentityParams;
  'shopify-niche-research': ShopifyNicheResearchParams;
  'social-sentiment': SocialSentimentParams;
  'stale-listings': StaleListingsParams;
  'storefront-research': StorefrontResearchParams;
  'str-underwriting': StrUnderwritingParams;
  'supplier-discovery': SupplierDiscoveryParams;
  'talent-sourcing': TalentSourcingParams;
  'tender-alerts': TenderAlertsParams;
  'tender-change-watch': TenderChangeWatchParams;
  'unlinked-mentions': UnlinkedMentionsParams;
  'used-car-arbitrage': UsedCarArbitrageParams;
  'vc-deal-sourcing': VcDealSourcingParams;
  'web-rank-tracker': WebRankTrackerParams;
  'wholesale-catalog-check': WholesaleCatalogCheckParams;
}

/** The id of a formula this version of the library has a parameter type for. */
export type FormulaId = keyof FormulaParamsById;

/** Every formula id this version of the library has a parameter type for. */
export const FORMULA_IDS: readonly FormulaId[] = [
  'account-hiring-check',
  'account-research',
  'acquisition-universe',
  'ad-activity-trigger',
  'ad-creative-research',
  'agency-ad-mining',
  'agency-lists',
  'announcement-trigger',
  'app-intelligence',
  'award-teaming',
  'broken-link-prospects',
  'broker-directory',
  'business-for-sale-alerts',
  'candidate-reverse-marketing',
  'champion-tracker',
  'company-diligence',
  'competitor-price-tracker',
  'competitor-review-mining',
  'compound-signal-score',
  'contractor-license-watch',
  'crowdfunding-leads',
  'deal-site-monitor',
  'directory-to-leads',
  'ecommerce-panel',
  'enterprise-ats-sweep',
  'event-organizer-leads',
  'exhibitor-prospects',
  'footprint-prospects',
  'freelance-gig-feed',
  'funded-and-hiring',
  'hiring-signal-outbound',
  'hiring-velocity',
  'home-services-pros',
  'hotel-rate-shop',
  'influencer-discovery',
  'job-order-hunter',
  'job-seeker-targets',
  'knowledge-base-crawl',
  'landlord-agent-leads',
  'launch-batch-lists',
  'link-intersect',
  'listing-compliance',
  'literature-sweep',
  'local-business-leads',
  'long-open-roles',
  'lookalike-companies',
  'marketplace-flips',
  'menu-price-tracker',
  'out-of-stock-opportunity',
  'people-list-with-openers',
  'permit-status-watch',
  'permit-trade-leads',
  'price-seller-watch',
  'property-comps',
  'property-distress-signals',
  'rank-tracker',
  'reverse-sourcing',
  'review-mining',
  'review-velocity',
  'salary-benchmark',
  'sec-filing-monitor',
  'seller-identity',
  'shopify-niche-research',
  'social-sentiment',
  'stale-listings',
  'storefront-research',
  'str-underwriting',
  'supplier-discovery',
  'talent-sourcing',
  'tender-alerts',
  'tender-change-watch',
  'unlinked-mentions',
  'used-car-arbitrage',
  'vc-deal-sourcing',
  'web-rank-tracker',
  'wholesale-catalog-check',
];

/** The parameters of formula `F`: its own type when this library knows it, any JSON object otherwise. */
export type FormulaParams<F extends string> = F extends FormulaId ? FormulaParamsById[F] : JSONObject;
