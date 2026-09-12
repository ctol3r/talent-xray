/**
 * The capability ontology: what a person can do, what sits next to it, and the
 * stated reason for every adjacency edge.
 *
 * Ported from Hu (`data/ontology/capabilities.yaml`). Data, not code — every
 * expansion Talent shows a recruiter cites the edge that produced it, so
 * nothing is ever invented at runtime. Adjacency SUPPORTS a match; it never
 * substitutes for the capability actually asked for (see `rank.ts`).
 *
 * `onet` codes are advisory groupings, not authoritative classifications.
 */

export interface OntologyConcept {
  readonly label: string;
  readonly aliases: readonly string[];
  readonly adjacent?: Readonly<
    Record<string, { readonly weight: number; readonly reason: string }>
  >;
  readonly onet?: string;
}

export interface SeniorityBand {
  readonly aliases: readonly string[];
  readonly rank: number;
}

export const CAPABILITIES: Readonly<Record<string, OntologyConcept>> = {
  robotics: {
    label: "Robotics",
    onet: "17-2199.08",
    aliases: [
      "robotics",
      "robot",
      "robotic",
      "robotics engineering",
      "manipulation",
      "motion planning",
      "kinematics",
      "robot arm",
      "mobile robotics",
      "humanoid",
      "teleoperation",
      "ros",
    ],
    adjacent: {
      autonomy: {
        weight: 0.85,
        reason:
          "autonomous systems and robotics share perception, planning and control stacks",
      },
      controls: {
        weight: 0.8,
        reason: "robot motion depends on control-systems engineering",
      },
      embedded_systems: {
        weight: 0.7,
        reason: "robots are embedded real-time systems",
      },
      computer_vision: {
        weight: 0.7,
        reason: "robot perception is predominantly vision-based",
      },
      mechanical_engineering: {
        weight: 0.6,
        reason: "robot hardware is a mechanical design problem",
      },
    },
  },
  autonomy: {
    label: "Autonomous Systems",
    aliases: [
      "autonomy",
      "autonomous vehicles",
      "self-driving",
      "driverless",
      "av",
      "adas",
      "autonomous driving",
      "autonomous systems",
      "unmanned",
      "uav",
      "drone",
    ],
    adjacent: {
      robotics: {
        weight: 0.85,
        reason: "autonomous vehicles are robots operating in public space",
      },
      perception: {
        weight: 0.88,
        reason: "autonomy stacks are built around perception",
      },
      functional_safety: {
        weight: 0.8,
        reason: "autonomous systems require safety-case engineering",
      },
      controls: {
        weight: 0.75,
        reason: "vehicle motion control is a core autonomy discipline",
      },
      automotive: {
        weight: 0.7,
        reason: "most autonomy programmes ship into automotive platforms",
      },
    },
  },
  perception: {
    label: "Perception",
    aliases: [
      "perception",
      "sensor fusion",
      "lidar",
      "radar",
      "point cloud",
      "detection and tracking",
      "object detection",
      "localization",
      "slam",
    ],
    adjacent: {
      computer_vision: {
        weight: 0.9,
        reason: "perception is largely applied computer vision",
      },
      machine_learning: {
        weight: 0.85,
        reason: "modern perception systems are learned, not hand-coded",
      },
      autonomy: {
        weight: 0.88,
        reason: "perception is the front of the autonomy stack",
      },
    },
  },
  computer_vision: {
    label: "Computer Vision",
    aliases: [
      "computer vision",
      "image recognition",
      "visual perception",
      "segmentation",
      "image processing",
      "3d reconstruction",
    ],
    adjacent: {
      machine_learning: {
        weight: 0.88,
        reason: "vision research is a machine-learning discipline",
      },
      perception: {
        weight: 0.9,
        reason: "vision is the dominant perception modality",
      },
    },
  },
  machine_learning: {
    label: "Machine Learning",
    onet: "15-2051.00",
    aliases: [
      "machine learning",
      "ml",
      "deep learning",
      "neural network",
      "neural networks",
      "artificial intelligence",
      "ai",
      "model training",
      "pytorch",
      "tensorflow",
      "transformer",
      "foundation model",
      "llm",
      "reinforcement learning",
    ],
    adjacent: {
      computer_vision: {
        weight: 0.85,
        reason: "vision is a major ML application area",
      },
      perception: {
        weight: 0.85,
        reason: "perception engineering is applied ML",
      },
      data_engineering: {
        weight: 0.6,
        reason: "ML systems depend on data pipelines",
      },
      research_science: {
        weight: 0.7,
        reason: "ML advances are published research",
      },
    },
  },
  controls: {
    label: "Control Systems",
    aliases: [
      "controls",
      "control systems",
      "control theory",
      "feedback control",
      "mpc",
      "model predictive control",
      "state estimation",
      "kalman",
      "guidance navigation",
    ],
    adjacent: {
      robotics: {
        weight: 0.8,
        reason: "control engineering is foundational to robotics",
      },
      aerospace: {
        weight: 0.75,
        reason: "guidance/navigation/control is an aerospace core discipline",
      },
      functional_safety: {
        weight: 0.6,
        reason: "safety-critical control demands safety engineering",
      },
    },
  },
  functional_safety: {
    label: "Functional Safety",
    aliases: [
      "functional safety",
      "iso 26262",
      "asil",
      "safety case",
      "hazard analysis",
      "fmea",
      "hara",
      "do-178",
      "safety critical",
      "sil",
      "systems safety",
    ],
    adjacent: {
      systems_engineering: {
        weight: 0.8,
        reason: "safety cases are produced by systems engineering practice",
      },
      automotive: {
        weight: 0.75,
        reason: "ISO 26262 is the automotive safety standard",
      },
      aerospace: {
        weight: 0.7,
        reason: "DO-178/ARP4754 make aerospace a parallel safety culture",
      },
      autonomy: {
        weight: 0.8,
        reason: "autonomous systems cannot ship without a safety argument",
      },
    },
  },
  systems_engineering: {
    label: "Systems Engineering",
    aliases: [
      "systems engineering",
      "requirements engineering",
      "v-model",
      "verification and validation",
      "system architecture",
      "integration test",
    ],
    adjacent: {
      functional_safety: {
        weight: 0.8,
        reason: "safety engineering is a systems-engineering specialism",
      },
      aerospace: {
        weight: 0.65,
        reason: "aerospace programmes are systems-engineering led",
      },
    },
  },
  embedded_systems: {
    label: "Embedded Systems",
    aliases: [
      "embedded",
      "firmware",
      "rtos",
      "microcontroller",
      "bare metal",
      "device driver",
      "embedded software",
      "real-time systems",
      "can bus",
    ],
    adjacent: {
      robotics: {
        weight: 0.7,
        reason: "robot control runs on embedded targets",
      },
      hardware_engineering: {
        weight: 0.7,
        reason: "firmware is written against specific hardware",
      },
      automotive: {
        weight: 0.6,
        reason: "vehicle ECUs are embedded platforms",
      },
    },
  },
  hardware_engineering: {
    label: "Hardware Engineering",
    aliases: [
      "hardware",
      "electrical engineering",
      "pcb",
      "circuit design",
      "power electronics",
      "analog design",
      "schematic capture",
      "hardware design",
    ],
    adjacent: {
      embedded_systems: {
        weight: 0.7,
        reason: "hardware and firmware are co-designed",
      },
      battery_systems: {
        weight: 0.7,
        reason: "battery packs are power-electronics hardware",
      },
      mechanical_engineering: {
        weight: 0.55,
        reason: "electromechanical products need both",
      },
    },
  },
  mechanical_engineering: {
    label: "Mechanical Engineering",
    aliases: [
      "mechanical engineering",
      "mechanical design",
      "cad",
      "solidworks",
      "dfm",
      "tolerance analysis",
      "structural analysis",
      "fea",
    ],
    adjacent: {
      thermal_engineering: {
        weight: 0.8,
        reason: "thermal design is a mechanical-engineering discipline",
      },
      robotics: {
        weight: 0.6,
        reason: "robot mechanisms are mechanical designs",
      },
    },
  },
  thermal_engineering: {
    label: "Thermal Engineering",
    aliases: [
      "thermal",
      "thermal management",
      "heat transfer",
      "cooling",
      "cfd",
      "computational fluid dynamics",
      "liquid cooling",
      "thermal modeling",
      "thermodynamics",
    ],
    adjacent: {
      battery_systems: {
        weight: 0.88,
        reason: "battery pack safety is dominated by thermal behaviour",
      },
      mechanical_engineering: {
        weight: 0.8,
        reason: "thermal analysis sits within mechanical engineering",
      },
      materials_science: {
        weight: 0.6,
        reason: "thermal performance is a materials property problem",
      },
    },
  },
  battery_systems: {
    label: "Battery Systems",
    aliases: [
      "battery",
      "batteries",
      "cell",
      "lithium-ion",
      "li-ion",
      "battery pack",
      "bms",
      "battery management system",
      "electrochemistry",
      "cell chemistry",
      "energy storage",
      "state of charge",
      "anode",
      "cathode",
      "thermal runaway",
      "propagation",
      "pack design",
    ],
    adjacent: {
      thermal_engineering: {
        weight: 0.88,
        reason: "cell and pack safety is a thermal problem",
      },
      materials_science: {
        weight: 0.75,
        reason: "cell performance is set by electrode materials",
      },
      automotive: {
        weight: 0.7,
        reason: "EV programmes are the largest battery employers",
      },
      functional_safety: {
        weight: 0.65,
        reason: "battery hazards are managed as a safety case",
      },
    },
  },
  materials_science: {
    label: "Materials Science",
    aliases: [
      "materials science",
      "metallurgy",
      "polymer",
      "composites",
      "characterization",
      "microscopy",
      "xrd",
      "crystallography",
      "materials engineering",
    ],
    adjacent: {
      battery_systems: {
        weight: 0.75,
        reason: "battery chemistry is materials science",
      },
      research_science: {
        weight: 0.7,
        reason: "materials work is publication-driven research",
      },
    },
  },
  research_science: {
    label: "Research Science",
    aliases: [
      "research",
      "researcher",
      "publication",
      "peer-reviewed",
      "principal investigator",
      "postdoc",
      "phd",
      "laboratory",
      "dissertation",
      "grant",
      "nsf",
      "nih",
    ],
    adjacent: {
      machine_learning: {
        weight: 0.6,
        reason: "much current research output is ML research",
      },
      materials_science: {
        weight: 0.6,
        reason: "materials work is research-led",
      },
    },
  },
  automotive: {
    label: "Automotive",
    aliases: [
      "automotive",
      "oem",
      "vehicle",
      "powertrain",
      "ev",
      "electric vehicle",
      "tier 1",
      "vehicle integration",
      "chassis",
    ],
    adjacent: {
      autonomy: { weight: 0.7, reason: "autonomy programmes ship on vehicles" },
      battery_systems: {
        weight: 0.7,
        reason: "EV programmes are battery programmes",
      },
    },
  },
  aerospace: {
    label: "Aerospace",
    aliases: [
      "aerospace",
      "aviation",
      "avionics",
      "spacecraft",
      "satellite",
      "launch vehicle",
      "flight software",
      "propulsion",
      "defense",
      "defence",
    ],
    adjacent: {
      controls: { weight: 0.75, reason: "GNC is an aerospace core discipline" },
      functional_safety: {
        weight: 0.7,
        reason: "airworthiness is a safety-case discipline",
      },
      systems_engineering: {
        weight: 0.65,
        reason: "aerospace is systems-engineering led",
      },
    },
  },
  software_engineering: {
    label: "Software Engineering",
    aliases: [
      "software engineering",
      "software engineer",
      "backend",
      "distributed systems",
      "api",
      "microservices",
      "python",
      "cpp",
      "golang",
      "kubernetes",
      "infrastructure",
    ],
    adjacent: {
      data_engineering: {
        weight: 0.65,
        reason: "data platforms are software systems",
      },
      machine_learning: {
        weight: 0.5,
        reason: "ML systems are shipped by software engineers",
      },
    },
  },
  data_engineering: {
    label: "Data Engineering",
    aliases: [
      "data engineering",
      "data pipeline",
      "etl",
      "warehouse",
      "spark",
      "airflow",
      "analytics engineering",
      "dbt",
    ],
    adjacent: {
      software_engineering: {
        weight: 0.65,
        reason: "data platforms are software systems",
      },
      machine_learning: {
        weight: 0.6,
        reason: "training data requires pipelines",
      },
    },
  },
  technical_recruiting: {
    label: "Technical Recruiting",
    onet: "13-1071.00",
    aliases: [
      "technical recruiting",
      "technical recruiter",
      "engineering recruiting",
      "engineering recruiter",
      "technical sourcing",
      "technical sourcer",
      "hired engineers",
      "recruited engineers",
      "engineering hiring",
    ],
    adjacent: {
      talent_sourcing: {
        weight: 0.88,
        reason: "sourcing is the discovery half of technical recruiting",
      },
      executive_search: {
        weight: 0.6,
        reason:
          "the mapping, approach and assessment craft is the same at a different seniority",
      },
      talent_leadership: {
        weight: 0.7,
        reason: "recruiting leaders come from recruiting practice",
      },
    },
  },
  talent_sourcing: {
    label: "Talent Sourcing",
    aliases: [
      "sourcing",
      "sourcer",
      "talent sourcing",
      "candidate sourcing",
      "talent mapping",
      "market mapping",
      "pipeline building",
      "boolean search",
      "outbound sourcing",
      "passive candidates",
      "proactive sourcing",
    ],
    adjacent: {
      technical_recruiting: {
        weight: 0.88,
        reason: "sourcing feeds technical recruiting pipelines",
      },
      talent_intelligence: {
        weight: 0.8,
        reason: "talent mapping is applied talent intelligence",
      },
    },
  },
  talent_intelligence: {
    label: "Talent Intelligence",
    aliases: [
      "talent intelligence",
      "talent market research",
      "workforce analytics",
      "compensation benchmarking",
      "labour market analysis",
      "talent analytics",
      "headcount planning",
    ],
    adjacent: {
      talent_sourcing: {
        weight: 0.8,
        reason: "market mapping is the operational form of talent intelligence",
      },
      talent_leadership: {
        weight: 0.65,
        reason: "TA leaders own workforce planning",
      },
    },
  },
  talent_leadership: {
    label: "Talent Leadership",
    aliases: [
      "head of talent",
      "head of recruiting",
      "director of recruiting",
      "talent acquisition leader",
      "vp talent",
      "recruiting leadership",
      "built the recruiting team",
      "talent acquisition",
    ],
    adjacent: {
      technical_recruiting: {
        weight: 0.7,
        reason: "recruiting leaders are promoted from recruiting",
      },
      people_operations: {
        weight: 0.65,
        reason: "TA sits inside the people function",
      },
    },
  },
  executive_search: {
    label: "Executive Search",
    aliases: [
      "executive search",
      "retained search",
      "headhunter",
      "board search",
      "c-suite search",
      "partner at a search firm",
    ],
    adjacent: {
      technical_recruiting: {
        weight: 0.6,
        reason: "shared search craft at different seniority",
      },
    },
  },
  people_operations: {
    label: "People Operations",
    aliases: [
      "people operations",
      "hr business partner",
      "hrbp",
      "people team",
      "human resources",
      "employee experience",
      "hr operations",
    ],
    adjacent: {
      talent_leadership: {
        weight: 0.65,
        reason: "talent acquisition reports into the people function",
      },
    },
  },
  healthcare_recruiting: {
    label: "Healthcare Recruiting",
    aliases: [
      "physician recruiting",
      "physician sourcing",
      "clinician recruiting",
      "nurse recruiting",
      "healthcare recruiting",
      "provider recruitment",
      "locum tenens",
      "medical staffing",
    ],
    adjacent: {
      talent_sourcing: {
        weight: 0.75,
        reason: "clinical sourcing uses the same proactive search method",
      },
      clinical_practice: {
        weight: 0.55,
        reason: "credible clinician recruiters understand clinical practice",
      },
    },
  },
  clinical_practice: {
    label: "Clinical Practice",
    onet: "29-1215.00",
    aliases: [
      "physician",
      "clinician",
      "attending",
      "resident",
      "nurse practitioner",
      "registered nurse",
      "clinical care",
      "patient care",
      "board certified",
      "hospitalist",
      "cardiology",
      "oncology",
      "emergency medicine",
    ],
    adjacent: {
      research_science: {
        weight: 0.55,
        reason: "academic clinicians publish research",
      },
    },
  },
  enterprise_sales: {
    label: "Enterprise Sales",
    onet: "41-4011.00",
    aliases: [
      "enterprise sales",
      "b2b sales",
      "account executive",
      "quota",
      "bookings",
      "new logo",
      "pipeline generation",
      "saas sales",
      "land and expand",
      "mid-market sales",
      "sales cycle",
    ],
    adjacent: {
      sales_leadership: {
        weight: 0.85,
        reason: "sales leaders are promoted from quota-carrying roles",
      },
      go_to_market: {
        weight: 0.8,
        reason: "sales execution is one arm of go-to-market",
      },
    },
  },
  sales_leadership: {
    label: "Sales Leadership",
    aliases: [
      "vp sales",
      "cro",
      "chief revenue officer",
      "head of sales",
      "sales leader",
      "built the sales team",
      "scaled the sales org",
      "sales management",
      "revenue leader",
    ],
    adjacent: {
      enterprise_sales: {
        weight: 0.85,
        reason: "sales leadership is built on selling experience",
      },
      go_to_market: {
        weight: 0.85,
        reason: "revenue leaders own go-to-market design",
      },
    },
  },
  go_to_market: {
    label: "Go-To-Market",
    aliases: [
      "go-to-market",
      "gtm",
      "market entry",
      "category creation",
      "market building",
      "product marketing",
      "demand generation",
      "first sales hire",
      "market development",
      "new market",
      "category design",
    ],
    adjacent: {
      sales_leadership: {
        weight: 0.85,
        reason: "GTM strategy is executed by revenue leadership",
      },
      enterprise_sales: {
        weight: 0.8,
        reason: "GTM is proven through direct selling",
      },
    },
  },
  financial_leadership: {
    label: "Financial Leadership",
    onet: "11-3031.00",
    aliases: [
      "cfo",
      "chief financial officer",
      "vp finance",
      "head of finance",
      "finance leader",
      "controller",
      "financial planning and analysis",
      "fp&a",
      "financial strategy",
    ],
    adjacent: {
      corporate_finance: {
        weight: 0.85,
        reason: "finance leaders own the corporate finance function",
      },
      operational_finance: {
        weight: 0.85,
        reason: "finance leadership in operating companies is hands-on",
      },
    },
  },
  corporate_finance: {
    label: "Corporate Finance",
    aliases: [
      "corporate finance",
      "fundraising",
      "series a",
      "series b",
      "series c",
      "venture debt",
      "ipo",
      "s-1",
      "mergers and acquisitions",
      "due diligence",
      "cap table",
      "investor relations",
      "equity financing",
    ],
    adjacent: {
      financial_leadership: {
        weight: 0.85,
        reason: "raising and transacting is a CFO responsibility",
      },
    },
  },
  operational_finance: {
    label: "Operational Finance",
    aliases: [
      "unit economics",
      "gross margin",
      "burn rate",
      "runway",
      "forecasting",
      "budgeting",
      "revenue recognition",
      "arr",
      "board reporting",
      "financial model",
      "scaled from",
      "hypergrowth",
    ],
    adjacent: {
      financial_leadership: {
        weight: 0.85,
        reason: "operating finance is the daily work of finance leadership",
      },
      corporate_finance: {
        weight: 0.6,
        reason: "operating results drive financing narratives",
      },
    },
  },
  accessibility_design: {
    label: "Accessibility Design",
    aliases: [
      "accessibility specialist",
      "inclusive design",
      "a11y",
      "accessibility design",
    ],
    adjacent: {
      design_systems: {
        weight: 0.75,
        reason:
          "Fixing contrast and focus behaviour in shared components is the highest-leverage accessibility work in a product org.",
      },
      front_end_development: {
        weight: 0.7,
        reason:
          "Accessibility conformance is proven in the markup, so specialists read and correct front-end code as part of an audit.",
      },
      user_research: {
        weight: 0.65,
        reason:
          "Testing with assistive technology users is a research protocol, run with the same recruitment and moderation discipline.",
      },
      user_experience_design: {
        weight: 0.7,
        reason:
          "Accessibility criteria are written as UX acceptance criteria, so specialists and interface designers review the same flows, states and focus order.",
      },
    },
  },
  accessibility_engineering: {
    label: "Accessibility Engineering",
    aliases: [
      "accessibility engineer",
      "wcag",
      "aria implementation",
      "screen reader testing",
      "assistive technology testing",
      "section 508",
      "accessibility audit",
      "vpat",
      "inclusive design engineering",
      "cpacc",
      "web accessibility specialist",
      "wai aria",
      "accessibility engineering",
    ],
    adjacent: {
      frontend_engineering: {
        weight: 0.8,
        reason:
          "Remediation happens in markup, focus handling and component code on the frontend.",
      },
      quality_engineering: {
        weight: 0.6,
        reason:
          "Conformance is held by automated axe checks plus manual screen-reader scripts in the suite.",
      },
      mobile_engineering: {
        weight: 0.5,
        reason:
          "VoiceOver and TalkBack conformance needs the same specialist reviewing native screens.",
      },
    },
  },
  account_management: {
    label: "Account Management",
    aliases: [
      "account management",
      "account manager",
      "key account management",
      "account director",
      "client servicing",
      "client retention",
      "strategic account planning",
      "upsell and cross sell",
      "named account",
    ],
    adjacent: {
      enterprise_sales: {
        weight: 0.8,
        reason:
          "Growing an existing account is still a sold deal with a business case, a negotiation and a signature at the end.",
      },
      customer_success: {
        weight: 0.8,
        reason:
          "Both own the relationship inside a named account, and hand each other adoption problems and expansion openings.",
      },
      renewals_management: {
        weight: 0.7,
        reason:
          "The renewal is the account manager's most predictable revenue event and is usually theirs to close.",
      },
      channel_sales: {
        weight: 0.55,
        reason:
          "Managing a reseller is account management conducted in margin, stock and enablement rather than end-user seats.",
      },
    },
  },
  acoustic_consulting: {
    label: "Acoustics And Noise Consulting",
    aliases: [
      "acoustic consultant",
      "acoustician",
      "building acoustics",
      "room acoustics",
      "sound insulation testing",
      "environmental noise survey",
      "vibration assessment",
      "room acoustic modelling",
      "acoustics and noise consulting",
    ],
    adjacent: {
      building_physics: {
        weight: 0.7,
        reason:
          "Sound insulation and thermal performance are both fixed by the same wall, floor and glazing build-ups, so the two consultants specify against one construction.",
      },
      building_services_engineering: {
        weight: 0.6,
        reason:
          "Plant noise, duct attenuation and vibration isolation are specified alongside the services design.",
      },
      architecture: {
        weight: 0.55,
        reason:
          "Separating wall build-up, floor construction and room shape are architectural decisions with acoustic consequences.",
      },
      town_planning: {
        weight: 0.5,
        reason:
          "Noise impact assessment is a standard supporting document for a residential planning application.",
      },
    },
  },
  actuarial_practice: {
    label: "Actuarial Practice",
    onet: "15-2011.00",
    aliases: [
      "actuary",
      "actuarial analyst",
      "actuarial valuation",
      "pricing actuary",
      "reserving actuary",
      "actuarial pricing",
      "capital modelling",
      "solvency ii",
      "ifoa",
      "general insurance reserving",
      "life insurance reserving",
      "mortality assumption",
      "actuarial practice",
    ],
    adjacent: {
      insurance_underwriting: {
        weight: 0.8,
        reason:
          "Actuaries set the technical price and reserve that underwriters trade around, working from the same policy and loss data.",
      },
      pension_consulting: {
        weight: 0.75,
        reason:
          "Scheme funding valuations and liability measurement are actuarial calculations, and pension consultancies are staffed by actuaries.",
      },
      reinsurance: {
        weight: 0.7,
        reason:
          "Treaty and catastrophe pricing is actuarial modelling of tail losses, done by actuaries on both the cedant and reinsurer side.",
      },
      quantitative_research: {
        weight: 0.6,
        reason:
          "Both discount uncertain future cash flows with stochastic models, and actuaries move into quantitative finance roles.",
      },
      financial_risk_management: {
        weight: 0.6,
        reason:
          "Solvency capital modelling and regulatory stress testing measure tail loss against capital using shared technique.",
      },
    },
  },
  additive_manufacturing: {
    label: "Additive Manufacturing",
    aliases: [
      "additive manufacturing",
      "3d printing engineer",
      "3d printing technician",
      "selective laser melting",
      "direct metal laser sintering",
      "dmls",
      "fused deposition modelling",
      "stereolithography",
      "powder bed fusion",
    ],
    adjacent: {
      materials_science: {
        weight: 0.7,
        reason:
          "Powder chemistry, melt pool behaviour and post build heat treatment are metallurgy problems.",
      },
      cnc_machining: {
        weight: 0.6,
        reason:
          "Printed parts are finished on a mill or lathe, so the same shop and the same tolerance thinking apply.",
      },
      mechanical_engineering: {
        weight: 0.6,
        reason:
          "Parts are redesigned for the process, so topology and load cases go back to the mechanical designer.",
      },
      manufacturing_engineering: {
        weight: 0.55,
        reason:
          "Taking a printed part into production means qualifying a route and its post processing steps.",
      },
      aerospace: {
        weight: 0.5,
        reason:
          "Flight hardware is a leading user of powder bed fusion, with its own build qualification practice.",
      },
    },
  },
  advanced_nurse_practice: {
    label: "Advanced Nurse Practice",
    onet: "29-1171.00",
    aliases: [
      "advanced nurse practitioner",
      "advanced clinical practitioner",
      "anp",
      "aprn",
      "acnp",
      "dnp",
      "fnp",
      "drop (and drop 'physician assistant'); give them their own concept if they are wanted",
      "physician assistant",
      "independent prescriber",
      "drop 'non medical prescriber'; replace 'independent prescriber' with 'nurse independent prescriber'",
      "nurse led clinic",
      "advanced nurse practice",
    ],
    adjacent: {
      registered_nursing: {
        weight: 0.85,
        reason:
          "Nurse practitioners qualify and practise as registered nurses first, then add assessment, diagnosis and prescribing to the same caseload.",
      },
      general_practice: {
        weight: 0.75,
        reason:
          "Nurse practitioners run same-day and long-term condition clinics in primary care, seeing the same undifferentiated presentations as GPs.",
      },
      emergency_medicine: {
        weight: 0.6,
        reason:
          "Emergency departments staff minors and see-and-treat streams with advanced practitioners working to the same clinical protocols.",
      },
      clinical_practice: {
        weight: 0.85,
        reason:
          "Advanced practice is autonomous clinical practice: history, examination, diagnosis, prescribing and discharge under a clinical licence.",
      },
    },
  },
  agronomy: {
    label: "Agronomy",
    onet: "19-1013.00",
    aliases: [
      "agronomist",
      "agronomy",
      "crop advisor",
      "crop adviser",
      "crop nutrition",
      "crop protection",
      "soil science",
      "soil sampling",
      "precision agriculture",
      "integrated pest management",
      "arable farming",
      "certified crop adviser",
      "basis registered",
    ],
    adjacent: {
      farm_management: {
        weight: 0.8,
        reason:
          "the agronomist writes the crop plan the farm manager budgets, drills and harvests to",
      },
      viticulture: {
        weight: 0.7,
        reason:
          "a vineyard is a perennial crop managed on the same soil, nutrition and pest threshold logic as any other",
      },
      horticulture: {
        weight: 0.65,
        reason:
          "nutrition, pest control and propagation science carry across from field crops to protected cropping",
      },
      food_science: {
        weight: 0.55,
        reason:
          "grain and produce specifications, residue limits and assurance audits are agreed with food technologists",
      },
      research_science: {
        weight: 0.5,
        reason:
          "replicated field trial design and statistical analysis of yield data is applied research work",
      },
    },
  },
  air_traffic_management: {
    label: "Air Traffic Management",
    onet: "53-2021.00",
    aliases: [
      "air traffic controller",
      "air traffic control",
      "atco",
      "aerodrome controller",
      "area controller",
      "approach controller",
      "tower controller",
      "en route controller",
      "radar controller",
      "flight information service officer",
      "air traffic flow management",
      "airspace design",
      "air traffic management",
    ],
    adjacent: {
      aviation_operations: {
        weight: 0.7,
        reason:
          "controllers and airline operations desks negotiate the same slots, holding and flow restrictions in real time",
      },
      functional_safety: {
        weight: 0.6,
        reason:
          "airspace changes go through formal hazard identification and safety assessment before entering service",
      },
      rail_operations: {
        weight: 0.55,
        reason:
          "signalling and air traffic control both keep vehicles separated on a shared network under strict rule-based procedure",
      },
    },
  },
  aircraft_maintenance: {
    label: "Aircraft Maintenance Engineering",
    onet: "49-3011.00",
    aliases: [
      "aircraft maintenance engineer",
      "aircraft technician",
      "licensed aircraft engineer",
      "airframe and powerplant",
      "avionics technician",
      "line maintenance",
      "base maintenance",
      "aircraft inspection",
      "airworthiness",
      "part 145",
      "easa part 66",
      "b1 licence",
      "aircraft maintenance engineering",
    ],
    adjacent: {
      aerospace: {
        weight: 0.75,
        reason:
          "maintenance engineers apply the airframe, powerplant and structural repair knowledge design offices produce",
      },
      aviation_operations: {
        weight: 0.65,
        reason:
          "defect deferral and aircraft swaps are decided together by the engineer on shift and the operations controller",
      },
    },
  },
  anaesthesia: {
    label: "Anaesthesia",
    onet: "29-1211.00",
    aliases: [
      "anaesthetist",
      "anesthesiologist",
      "anaesthesia",
      "anesthesia",
      "frca",
      "drop (move to advanced_nurse_practice)",
      "regional block",
      "epidural",
      "drop (and drop 'epidural'); 'procedural sedation' and 'perioperative medicine' carry the concept",
      "procedural sedation",
      "perioperative medicine",
    ],
    adjacent: {
      surgical_practice: {
        weight: 0.85,
        reason:
          "No operating list runs without both; the pair plan the case, the position and the recovery route together.",
      },
      critical_care_nursing: {
        weight: 0.7,
        reason:
          "Anaesthetists run the intensive care unit in most systems, so ventilation and sedation practice is shared daily.",
      },
      perioperative_nursing: {
        weight: 0.7,
        reason:
          "Induction, transfer and recovery are done as a pair with the anaesthetic practitioner who knows the same kit and drugs.",
      },
      emergency_medicine: {
        weight: 0.6,
        reason:
          "Emergency airway and rapid sequence induction are the same procedure taught to the same standard in both departments.",
      },
    },
  },
  analytical_chemistry: {
    label: "Analytical Chemistry",
    onet: "19-2031.00",
    aliases: [
      "analytical chemistry",
      "analytical chemist",
      "hplc method development",
      "analytical method validation",
      "uplc",
      "mass spectrometry method development",
      "ich stability study",
      "gas chromatography",
      "karl fischer titration",
      "dissolution testing",
      "impurity profiling",
      "qc analytical method",
      "icp ms",
    ],
    adjacent: {
      bioanalysis: {
        weight: 0.8,
        reason:
          "Identical separation and detection craft, run in a biological matrix under its own bioanalytical validation criteria rather than ICH Q2.",
      },
      gmp_quality_assurance: {
        weight: 0.75,
        reason:
          "An out-of-specification result from the lab triggers the formal investigation the quality group owns.",
      },
      regulatory_cmc: {
        weight: 0.75,
        reason:
          "Specifications and method validation summaries written by analytical chemists become the filed control strategy.",
      },
      laboratory_management: {
        weight: 0.65,
        reason:
          "Instrument qualification, calibration schedules and analyst training are the operational side of the same lab.",
      },
      materials_science: {
        weight: 0.55,
        reason:
          "Solid-state characterisation by diffraction and thermal analysis is common ground between the two benches.",
      },
    },
  },
  analytics_engineering: {
    label: "Analytics Engineering",
    aliases: [
      "analytics engineer",
      "dbt model",
      "dimensional modelling",
      "semantic layer",
      "sql transformation",
      "data mart",
      "snowflake modelling",
      "looker modelling",
      "star schema",
      "metric definition",
      "warehouse modelling",
    ],
    adjacent: {
      data_engineering: {
        weight: 0.8,
        reason:
          "Analytics engineers own the transformation half of the same warehouse pipelines.",
      },
      business_intelligence: {
        weight: 0.8,
        reason:
          "Modelled tables exist so dashboards stop each recomputing their own version of a number.",
      },
      data_science: {
        weight: 0.65,
        reason:
          "Both write heavy SQL against the same warehouse and argue over the same metric definitions.",
      },
      data_governance: {
        weight: 0.55,
        reason:
          "The semantic layer is where a governance definition finally becomes machine-enforceable.",
      },
    },
  },
  animation: {
    label: "Animation",
    onet: "27-1014.00",
    aliases: [
      "animator",
      "character animator",
      "2d animator",
      "3d animator",
      "keyframe animation",
      "rigging and animation",
      "stop motion animator",
      "animation director",
      "maya animation",
      "animation",
    ],
    adjacent: {
      three_d_and_cgi: {
        weight: 0.8,
        reason:
          "Animators perform rigs that 3D artists build, and both sit inside one production pipeline with shared review sessions.",
      },
      motion_graphics: {
        weight: 0.8,
        reason:
          "Both crafts are built on timing, spacing and keyframe curves, so animators move into motion design easily.",
      },
      illustration: {
        weight: 0.75,
        reason:
          "Animation begins as drawn keys and layouts, so animators typically have a strong drawing background.",
      },
      games_art: {
        weight: 0.7,
        reason:
          "Game animation uses the same keyframe skills constrained by state machines and blend trees.",
      },
      video_editing: {
        weight: 0.55,
        reason:
          "Animatics are cut and timed in an edit before a frame is finalled, so animators work in editing tools routinely.",
      },
    },
  },
  application_security: {
    label: "Application Security",
    aliases: [
      "application security engineer",
      "appsec",
      "secure code review",
      "sast",
      "dast",
      "owasp top 10",
      "software supply chain security",
      "vulnerability remediation",
      "security champion",
      "bug bounty triage",
      "sdlc security",
      "application security",
    ],
    adjacent: {
      penetration_testing: {
        weight: 0.8,
        reason:
          "Appsec engineers read and reproduce pentest findings, and often did the testing themselves.",
      },
      security_engineering: {
        weight: 0.8,
        reason:
          "Application controls are one layer of the control set a security engineer designs overall.",
      },
      software_engineering: {
        weight: 0.7,
        reason:
          "Spotting injection and broken authorisation in a diff requires fluent day-to-day coding.",
      },
      developer_tooling: {
        weight: 0.5,
        reason:
          "Shifting security left means wiring scanners into build pipelines and pre-commit hooks.",
      },
    },
  },
  arbitration_adr: {
    label: "Arbitration And Mediation",
    onet: "23-1022.00",
    aliases: [
      "international arbitration",
      "commercial arbitration",
      "arbitrator",
      "accredited mediator",
      "alternative dispute resolution",
      "adr practitioner",
      "icc arbitration",
      "lcia arbitration",
      "uncitral rule",
      "arbitral award",
      "expert determination",
      "mciarb",
      "fciarb",
      "arbitration and mediation",
    ],
    adjacent: {
      litigation: {
        weight: 0.8,
        reason:
          "Arbitration counsel are litigators first: pleadings, witness statements and expert evidence are prepared exactly the same way.",
      },
      construction_law: {
        weight: 0.65,
        reason:
          "Construction contracts default to adjudication and arbitration rather than court, so building disputes are a standing source of arbitration work.",
      },
      contract_management: {
        weight: 0.6,
        reason:
          "The dispute clause, seat and governing law are negotiated into the contract years before anything goes wrong.",
      },
      in_house_counsel: {
        weight: 0.55,
        reason:
          "In-house teams pick the forum, instruct the tribunal panel and weigh award economics against settlement.",
      },
    },
  },
  architectural_technology: {
    label: "Architectural Technology",
    onet: "17-3011.00",
    aliases: [
      "architectural technologist",
      "architectural technician",
      "ciat",
      "mciat",
      "architectural cad technician",
      "construction detailing",
      "production information drawing",
      "construction issue drawing",
      "building regulations drawing",
      "architectural technology",
    ],
    adjacent: {
      architecture: {
        weight: 0.85,
        reason:
          "Technologists take the architect's concept and produce the construction information it is built from.",
      },
      bim_coordination: {
        weight: 0.8,
        reason:
          "Production information is now authored inside a federated model, so technologists are the day-to-day modellers.",
      },
      building_control: {
        weight: 0.7,
        reason:
          "Technologists assemble the building regulations submission and answer the inspector's comments on it.",
      },
      building_physics: {
        weight: 0.55,
        reason:
          "Junction detailing decides thermal bridging and airtightness, which building physics then has to verify.",
      },
    },
  },
  architecture: {
    label: "Architecture",
    onet: "17-1011.00",
    aliases: [
      "registered architect",
      "chartered architect",
      "project architect",
      "architectural concept design",
      "architectural practice",
      "riba",
      "arb registered architect",
      "part 3 architect",
      "architectural studio",
      "architecture",
    ],
    adjacent: {
      architectural_technology: {
        weight: 0.85,
        reason:
          "The same drawing set passes from architect to technologist between concept and construction detail.",
      },
      structural_engineering: {
        weight: 0.6,
        reason:
          "An architect's column grid, spans and openings are settled jointly with the structural engineer before the scheme is fixed.",
      },
      urban_design: {
        weight: 0.7,
        reason:
          "Masterplan commissions pull architects into block, street and public realm work at neighbourhood scale.",
      },
      heritage_conservation: {
        weight: 0.65,
        reason:
          "Alterations to listed fabric are designed and argued through consent by architects, with accredited conservation architects leading the most sensitive cases.",
      },
      interior_design: {
        weight: 0.6,
        reason:
          "Fit-out work carries an architect's spatial planning through into finishes, joinery and furniture specification.",
      },
    },
  },
  archive_practice: {
    label: "Archives And Records Practice",
    onet: "25-4011.00",
    aliases: [
      "archivist",
      "records management",
      "digital preservation",
      "archival description",
      "retention schedule",
      "records and information governance",
      "freedom of information request",
      "special collection",
      "records manager",
      "archive cataloguing",
      "manuscript collection",
      "archives and records practice",
    ],
    adjacent: {
      library_practice: {
        weight: 0.8,
        reason:
          "Archivists and librarians share cataloguing standards, reading-room duty and preservation work.",
      },
      local_government_administration: {
        weight: 0.6,
        reason:
          "County record offices and council information governance teams sit inside the local authority.",
      },
      data_engineering: {
        weight: 0.5,
        reason:
          "Digital preservation is format migration, checksum verification and long-term storage design.",
      },
      research_administration: {
        weight: 0.5,
        reason:
          "Institutional archives hold the research records governance teams must retain and disclose.",
      },
    },
  },
  art_direction: {
    label: "Art Direction",
    onet: "27-1011.00",
    aliases: [
      "art director",
      "advertising creative director",
      "associate creative director",
      "campaign art direction",
      "campaign shoot direction",
      "visual direction",
      "art buying",
      "advertising art director",
      "art direction",
    ],
    adjacent: {
      visual_design: {
        weight: 0.75,
        reason:
          "Art directors approve layout, type and image choices every day, which is the graphic designer's craft applied to briefing rather than making.",
      },
      copywriting: {
        weight: 0.8,
        reason:
          "Advertising has paired an art director with a writer for decades, and both pitch the concept together.",
      },
      photography: {
        weight: 0.7,
        reason:
          "Art directors cast, brief and sit on the shoot, so they must speak the photographer's language of lens, light and frame.",
      },
      brand_identity: {
        weight: 0.7,
        reason:
          "Campaign art direction is where an identity system meets real production and gets stress tested.",
      },
      design_strategy: {
        weight: 0.6,
        reason:
          "Both roles argue a creative idea to a client on commercial grounds rather than on taste.",
      },
    },
  },
  assay_development: {
    label: "Assay Development",
    aliases: [
      "assay development",
      "assay scientist",
      "high throughput screening",
      "cell based assay",
      "biochemical assay",
      "assay qualification",
      "screening cascade",
      "high content screening",
      "flow cytometry panel",
      "reporter assay",
      "in vitro pharmacology",
    ],
    adjacent: {
      medicinal_chemistry: {
        weight: 0.75,
        reason:
          "The assay is the readout a chemistry programme steers by, so the two groups iterate compound by compound.",
      },
      bioanalysis: {
        weight: 0.75,
        reason:
          "Both build quantitative biological measurements and qualify them against defined acceptance criteria.",
      },
      translational_science: {
        weight: 0.7,
        reason:
          "Discovery biomarker assays are the ones that have to be carried, fit for purpose, into the first patient study.",
      },
      laboratory_management: {
        weight: 0.6,
        reason:
          "Plate automation, reagent lot control and scheduling decide whether a screening lab can hold its cadence.",
      },
      cell_and_gene_therapy: {
        weight: 0.6,
        reason:
          "Potency assays for a living cell product are the hardest assay development problem in the field.",
      },
    },
  },
  athletic_therapy: {
    label: "Athletic Therapy & Sports Rehabilitation",
    onet: "29-9091.00",
    aliases: [
      "athletic trainer",
      "athletic therapist",
      "sports therapist",
      "sports rehabilitator",
      "sports physiotherapist",
      "sports injury rehabilitation",
      "soft tissue therapist",
      "sports massage therapist",
      "musculoskeletal assessment",
      "return to play",
      "strapping and taping",
      "pitchside care",
      "athletic therapy & sports rehabilitation",
    ],
    adjacent: {
      strength_conditioning: {
        weight: 0.75,
        reason:
          "the end of rehabilitation is a loading programme, so therapists and S&C staff share the same exit criteria",
      },
      clinical_practice: {
        weight: 0.7,
        reason:
          "assessment, differential diagnosis and treatment planning is musculoskeletal clinical practice",
      },
      sports_coaching: {
        weight: 0.6,
        reason:
          "the therapist tells the coach who trains and who does not, every single training day",
      },
      nutrition_practice: {
        weight: 0.5,
        reason:
          "soft tissue healing, bone health and recovery are supported nutritionally alongside rehabilitation",
      },
    },
  },
  audio_engineering: {
    label: "Audio Engineering",
    onet: "27-4011.00",
    aliases: [
      "audio engineer",
      "recording engineer",
      "mixing engineer",
      "mastering engineer",
      "live sound engineer",
      "studio engineer",
      "broadcast audio",
      "front of house engineer",
      "pro tools engineer",
      "audio engineering",
    ],
    adjacent: {
      sound_design: {
        weight: 0.85,
        reason:
          "Both trades are editing and mixing in the same session, and engineers routinely take sound design credits.",
      },
      music_production: {
        weight: 0.85,
        reason:
          "Producers and engineers share the control room, and most producers engineer their own records.",
      },
      electronics_repair: {
        weight: 0.5,
        reason:
          "Studio and live engineers fault-find outboard gear, cabling and desks rather than wait for a technician.",
      },
    },
  },
  aviation_operations: {
    label: "Aviation Operations & Dispatch",
    aliases: [
      "flight dispatcher",
      "aircraft dispatcher",
      "flight operations officer",
      "airline operations control",
      "ground handling",
      "load control",
      "weight and balance",
      "flight planning",
      "crew scheduling",
      "turnaround coordinator",
      "ramp operation",
      "notam",
      "aviation operations & dispatch",
    ],
    adjacent: {
      air_traffic_management: {
        weight: 0.7,
        reason:
          "dispatchers and controllers work the same flight plan, slot and flow restriction in shared standard phraseology",
      },
      aircraft_maintenance: {
        weight: 0.65,
        reason:
          "an ops controller reroutes aircraft around deferred defects, reading the technical log and MEL with engineers",
      },
      freight_forwarding: {
        weight: 0.6,
        reason:
          "belly and freighter capacity is sold and built up to cut-off times the operations desk controls",
      },
      aerospace: {
        weight: 0.55,
        reason:
          "operations staff apply aircraft performance and payload-range data produced by aerospace engineering teams",
      },
    },
  },
  backend_engineering: {
    label: "Backend Engineering",
    onet: "15-1252.00",
    aliases: [
      "backend engineer",
      "back end developer",
      "server side developer",
      "api developer",
      "microservice developer",
      "golang developer",
      "java backend",
      "node.js developer",
      "rest api design",
      "distributed systems engineer",
      "python backend",
      "backend engineering",
    ],
    adjacent: {
      software_engineering: {
        weight: 0.9,
        reason:
          "Server-side work is core software craft, with the same review, testing and refactoring discipline.",
      },
      database_administration: {
        weight: 0.6,
        reason:
          "Backend engineers write the schemas and queries a DBA later tunes, indexes and replicates.",
      },
      integration_engineering: {
        weight: 0.7,
        reason:
          "Backend teams own the APIs and event contracts that integration work stitches between systems.",
      },
      platform_engineering: {
        weight: 0.6,
        reason:
          "Backend engineers are the internal customers of platform teams and frequently move into them.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "Both write batch and streaming jobs and own retries, idempotency and schema evolution.",
      },
    },
  },
  bid_management: {
    label: "Bid & Proposal Management",
    aliases: [
      "bid management",
      "bid manager",
      "proposal management",
      "proposal writer",
      "tender submission",
      "rfp response",
      "rfi response",
      "capture management",
      "apmp",
      "public sector tender",
      "bid & proposal management",
    ],
    adjacent: {
      enterprise_sales: {
        weight: 0.7,
        reason:
          "A public tender is a deal with a fixed deadline and a scoring sheet, and the bid team sits inside the pursuit.",
      },
      sales_engineering: {
        weight: 0.65,
        reason:
          "Technical answers in a submission are drafted by sales engineers and edited by the bid lead to the scoring criteria.",
      },
      pricing_strategy: {
        weight: 0.6,
        reason:
          "A tender price is a costed, approved commercial submission that cannot be revised once the deadline passes.",
      },
      copywriting: {
        weight: 0.5,
        reason:
          "A proposal is persuasive writing to a brief, marked line by line on how clearly each answer reads.",
      },
    },
  },
  bim_coordination: {
    label: "BIM Coordination",
    aliases: [
      "bim",
      "bim coordinator",
      "bim manager",
      "iso 19650",
      "clash detection",
      "navisworks",
      "common data environment",
      "federated model",
      "revit model coordination",
      "cobie",
      "information delivery plan",
      "bim coordination",
    ],
    adjacent: {
      architectural_technology: {
        weight: 0.8,
        reason:
          "Modelling the construction information is the technologist's job, so the two roles are often one person.",
      },
      building_services_engineering: {
        weight: 0.65,
        reason:
          "Most clashes to resolve are services against structure, so coordinators live in the services model.",
      },
      construction_project_management: {
        weight: 0.6,
        reason:
          "Information delivery plans, model handover dates and data drops are run as part of the project.",
      },
      facilities_management: {
        weight: 0.55,
        reason:
          "Asset data handed over from the model is what populates the maintenance system after completion.",
      },
    },
  },
  bioanalysis: {
    label: "Bioanalysis",
    aliases: [
      "bioanalytical scientist",
      "bioanalytical method validation",
      "lc ms bioanalysis",
      "ligand binding assay",
      "immunogenicity assay",
      "anti drug antibody assay",
      "biomarker assay validation",
      "plasma concentration analysis",
      "elisa method",
      "glp bioanalysis",
      "bioanalysis",
    ],
    adjacent: {
      dmpk: {
        weight: 0.85,
        reason:
          "Every curve in a DMPK report is built from concentrations this group measured and defended.",
      },
      analytical_chemistry: {
        weight: 0.8,
        reason:
          "The same chromatography and mass spectrometry skill set, applied to plasma and tissue rather than drug substance.",
      },
      assay_development: {
        weight: 0.75,
        reason:
          "Ligand binding and cell-based readouts are built with the same qualification logic on both benches.",
      },
      clinical_pharmacology: {
        weight: 0.7,
        reason:
          "Clinical PK conclusions are only as sound as the validated assay sitting behind the concentrations.",
      },
    },
  },
  bioinformatics: {
    label: "Bioinformatics",
    onet: "19-1029.01",
    aliases: [
      "bioinformatics",
      "bioinformatician",
      "computational biology",
      "variant annotation pipeline",
      "rna seq analysis",
      "nextflow pipeline",
      "genome assembly",
      "transcriptomic analysis",
      "proteomic analysis",
      "biopython",
      "sequence alignment tool",
    ],
    adjacent: {
      genomics: {
        weight: 0.85,
        reason:
          "Bioinformaticians consume the sequencing lab's output and dictate how libraries must be prepared to be analysable.",
      },
      data_engineering: {
        weight: 0.75,
        reason:
          "Both build and maintain reproducible high-volume pipelines pinned to versioned reference data.",
      },
      machine_learning: {
        weight: 0.7,
        reason:
          "Structure prediction and expression models put working bioinformaticians squarely in applied machine learning.",
      },
      biostatistics: {
        weight: 0.7,
        reason:
          "Multiple-testing correction and mixed models are the shared statistical core of both disciplines.",
      },
      translational_science: {
        weight: 0.65,
        reason:
          "Biomarker discovery from patient omics data is bioinformatics with a clinical endpoint attached.",
      },
    },
  },
  bioprocess_development: {
    label: "Bioprocess Development",
    aliases: [
      "bioprocess development",
      "upstream bioprocessing",
      "cell culture process development",
      "bioreactor scale up",
      "fed batch process",
      "perfusion culture",
      "cell line development",
      "single use bioreactor",
      "titre improvement",
      "cell culture media optimization",
      "fermentation development",
    ],
    adjacent: {
      downstream_processing: {
        weight: 0.85,
        reason:
          "Upstream and downstream sit either side of the harvest step and are usually one department with one yield number.",
      },
      regulatory_cmc: {
        weight: 0.75,
        reason:
          "Process characterisation and design space work exists to justify the filed control strategy.",
      },
      validation_qualification: {
        weight: 0.75,
        reason:
          "Process performance qualification runs are the formal proof that the developed process is reproducible.",
      },
      cell_and_gene_therapy: {
        weight: 0.7,
        reason:
          "Vector and cell manufacture is bioprocessing with a far shorter, more fragile and less forgiving process.",
      },
      pharmaceutical_microbiology: {
        weight: 0.6,
        reason:
          "Contamination control across a bioreactor suite is a daily shared concern with the microbiology group.",
      },
    },
  },
  biostatistics: {
    label: "Biostatistics",
    onet: "15-2041.01",
    aliases: [
      "biostatistics",
      "biostatistician",
      "statistical analysis plan",
      "sample size calculation",
      "survival analysis",
      "mixed effects model",
      "adaptive trial design",
      "interim analysis",
      "bayesian trial design",
      "non inferiority margin",
      "trial statistician",
    ],
    adjacent: {
      statistical_programming: {
        weight: 0.85,
        reason:
          "The statistician specifies the analysis that the programmer implements and independently double programs.",
      },
      clinical_development: {
        weight: 0.8,
        reason:
          "Endpoint definition and powering are negotiated with the development physician before a protocol is final.",
      },
      health_economics: {
        weight: 0.7,
        reason:
          "Both build formal models from trial and registry evidence and defend the assumptions to hostile reviewers.",
      },
      machine_learning: {
        weight: 0.6,
        reason:
          "Both rest on statistical inference and out-of-sample validation, and trial statisticians increasingly fit predictive models.",
      },
      genomics: {
        weight: 0.6,
        reason:
          "Genome-wide association work is a biostatistics problem with multiple-testing correction at its centre.",
      },
    },
  },
  border_and_customs: {
    label: "Border And Customs Practice",
    onet: "33-3021.05",
    aliases: [
      "border force officer",
      "border control",
      "customs officer",
      "customs compliance",
      "customs declaration",
      "customs broker",
      "excise officer",
      "trade compliance",
      "authorised economic operator",
      "tariff classification",
      "freight clearance",
      "border security",
      "border and customs practice",
    ],
    adjacent: {
      intelligence_analysis: {
        weight: 0.7,
        reason:
          "Border targeting is risk profiling built from intelligence and cargo or traveller records.",
      },
      policing_practice: {
        weight: 0.7,
        reason:
          "Border officers exercise powers of search, seizure and interview and build prosecution files.",
      },
      operational_finance: {
        weight: 0.5,
        reason:
          "Customs compliance is duty, tariff and tax accuracy audited like any other financial control.",
      },
      emergency_planning: {
        weight: 0.5,
        reason:
          "Port disruption and cross-border incidents are planned for with local resilience teams.",
      },
    },
  },
  brand_identity: {
    label: "Brand Identity",
    aliases: [
      "brand designer",
      "identity design",
      "logo design",
      "brand guideline",
      "visual identity system",
      "corporate identity",
      "wordmark design",
      "brand identity",
    ],
    adjacent: {
      visual_design: {
        weight: 0.8,
        reason:
          "Identity work is executed with the same layout, colour and composition craft that graphic designers practise daily.",
      },
      typography: {
        weight: 0.8,
        reason:
          "An identity usually stands or falls on its typeface choice and custom lettering, which is typographic judgment.",
      },
      art_direction: {
        weight: 0.7,
        reason:
          "Rolling an identity into campaigns requires directing photographers and illustrators to a consistent visual standard.",
      },
      design_strategy: {
        weight: 0.7,
        reason:
          "Brand positioning work sits upstream of the marks, and identity designers routinely lead those stakeholder sessions.",
      },
      packaging_design: {
        weight: 0.6,
        reason:
          "For consumer businesses the pack is the primary identity surface, so brand designers own its shelf presence.",
      },
    },
  },
  brand_marketing: {
    label: "Brand Marketing",
    onet: "11-2021.00",
    aliases: [
      "brand marketing",
      "brand manager",
      "brand positioning",
      "brand campaign",
      "advertising campaign management",
      "brand tracking study",
      "above the line campaign",
    ],
    adjacent: {
      market_research: {
        weight: 0.7,
        reason:
          "Brand positions are chosen and defended with tracking studies, segmentation and pre-launch creative testing.",
      },
      content_marketing: {
        weight: 0.65,
        reason:
          "A brand platform only becomes visible through published campaigns, films and editorial work carrying it.",
      },
      public_relations: {
        weight: 0.65,
        reason:
          "Reputation and brand perception move together, and a campaign and a press moment are planned to land in the same week.",
      },
      product_marketing: {
        weight: 0.6,
        reason:
          "Both decide what the company claims and how it says it, and share the same approved claim set.",
      },
      event_marketing: {
        weight: 0.55,
        reason:
          "Sponsorship and experiential work is how a brand platform gets expressed in a physical room full of buyers.",
      },
    },
  },
  building_control: {
    label: "Building Control And Regulations Compliance",
    onet: "47-4011.00",
    aliases: [
      "building control surveyor",
      "building control officer",
      "approved inspector",
      "registered building inspector",
      "building regulations compliance",
      "building regulations approval",
      "plan checking",
      "completion certificate",
      "building safety act compliance",
      "building control and regulations compliance",
    ],
    adjacent: {
      building_surveying: {
        weight: 0.7,
        reason:
          "Both assess constructed fabric against regulations and record non-compliance on site.",
      },
      fire_engineering: {
        weight: 0.7,
        reason:
          "Means of escape, compartmentation and external wall build-ups are the hardest items to sign off.",
      },
      architectural_technology: {
        weight: 0.7,
        reason:
          "The regulations submission the technologist draws is exactly what the inspector plan-checks.",
      },
      site_management: {
        weight: 0.5,
        reason:
          "Inspection visits are booked, opened up and closed out by the site team as work proceeds.",
      },
    },
  },
  building_physics: {
    label: "Building Physics",
    aliases: [
      "building physicist",
      "building physics consultant",
      "dynamic thermal simulation",
      "daylight modelling",
      "overheating analysis",
      "condensation risk analysis",
      "u value calculation",
      "passivhaus designer",
      "iesve",
      "part l compliance",
      "building physics",
    ],
    adjacent: {
      sustainability_assessment: {
        weight: 0.8,
        reason:
          "Energy and comfort modelling supplies the evidence a certification assessor scores the building on.",
      },
      building_services_engineering: {
        weight: 0.75,
        reason:
          "Load calculations from the thermal model set the plant capacity the services engineer then specifies.",
      },
      facade_engineering: {
        weight: 0.65,
        reason:
          "U-values, thermal bridging and solar control are decided by the envelope build-up and glazing selection.",
      },
    },
  },
  building_services_engineering: {
    label: "Building Services (MEP) Engineering",
    aliases: [
      "building services engineer",
      "building services design",
      "mep engineer",
      "mep design",
      "hvac design",
      "cibse",
      "public health engineer",
      "electrical services design",
      "ductwork design",
      "plumbing design",
      "building services (mep) engineering",
    ],
    adjacent: {
      building_physics: {
        weight: 0.75,
        reason:
          "Plant sizing follows directly from the heat loss, gain and overheating model the building physicist produces.",
      },
      facilities_management: {
        weight: 0.7,
        reason:
          "The plant and controls the services designer specifies become the maintenance regime the estate team runs.",
      },
      bim_coordination: {
        weight: 0.65,
        reason:
          "Services routing is resolved by clash detection against structure and architecture in a federated model.",
      },
      fire_engineering: {
        weight: 0.6,
        reason:
          "Smoke control, sprinkler and detection systems are services installations sized to the fire strategy.",
      },
      mechanical_engineering: {
        weight: 0.55,
        reason:
          "Chilled water, ductwork and fan selection use the same pump, flow and heat transfer calculations.",
      },
    },
  },
  building_surveying: {
    label: "Building Surveying",
    aliases: [
      "building surveyor",
      "chartered building surveyor",
      "mrics building surveyor",
      "building pathology",
      "dilapidation survey",
      "condition survey",
      "party wall surveyor",
      "schedule of condition",
      "defect diagnosis",
      "reinstatement cost assessment",
      "homebuyer report",
      "building surveying",
    ],
    adjacent: {
      building_control: {
        weight: 0.7,
        reason:
          "Both inspect built fabric against regulations and write up defects and remedial requirements.",
      },
      facilities_management: {
        weight: 0.65,
        reason:
          "Condition surveys and lifecycle replacement plans are what the estate team budgets from.",
      },
      heritage_conservation: {
        weight: 0.6,
        reason:
          "Repair schedules for old fabric are written by surveyors who understand lime, timber and damp behaviour.",
      },
      architecture: {
        weight: 0.5,
        reason:
          "Building surveyors design and administer refurbishment and extension work under the same contracts.",
      },
    },
  },
  business_intelligence: {
    label: "Business Intelligence",
    aliases: [
      "business intelligence",
      "bi developer",
      "power bi",
      "tableau developer",
      "looker studio",
      "dashboard development",
      "qlik",
      "sql reporting",
      "bi analyst",
    ],
    adjacent: {
      analytics_engineering: {
        weight: 0.8,
        reason:
          "BI developers hit the modelling ceiling and move upstream into the transformation layer.",
      },
      data_science: {
        weight: 0.6,
        reason:
          "Both start from the same warehouse; one explains what happened, the other what will.",
      },
      operational_finance: {
        weight: 0.55,
        reason:
          "Month-end packs and budget-versus-actual dashboards are built to FP&A's definitions, so BI developers work to the finance close calendar.",
      },
      data_governance: {
        weight: 0.5,
        reason:
          "A certified dashboard needs an owner, a refresh commitment and documented lineage.",
      },
    },
  },
  calibration_technician: {
    label: "Calibration Technician",
    aliases: [
      "calibration technician",
      "calibration engineer",
      "calibration laboratory",
      "instrument calibration",
      "ukas calibration",
      "measurement uncertainty",
      "torque wrench calibration",
      "pressure calibration",
      "gage calibration",
      "temperature calibration",
    ],
    adjacent: {
      metrology: {
        weight: 0.85,
        reason:
          "Calibration is metrology applied to the instrument rather than the part, using the same uncertainty budgets.",
      },
      instrumentation_technician: {
        weight: 0.75,
        reason:
          "Calibrating transmitters and valves in the field is the instrument technician's routine task.",
      },
      quality_management_systems: {
        weight: 0.6,
        reason:
          "Calibration records and recall schedules are audited clauses of the certified quality system.",
      },
      validation_engineering: {
        weight: 0.55,
        reason:
          "A qualification protocol cannot be signed without calibrated instruments and their certificates attached.",
      },
    },
  },
  carbon_accounting: {
    label: "Carbon Accounting And Sustainability Reporting",
    aliases: [
      "carbon accounting",
      "carbon footprint",
      "greenhouse gas inventory",
      "scope 3 emission",
      "ghg protocol",
      "life cycle assessment",
      "sustainability reporting",
      "csrd",
      "science based target",
      "net zero strategy",
      "carbon reduction plan",
      "esg reporting",
      "carbon accounting and sustainability reporting",
    ],
    adjacent: {
      climate_risk: {
        weight: 0.75,
        reason:
          "The same disclosure frameworks pair an emissions inventory with transition and physical risk narrative.",
      },
      energy_efficiency: {
        weight: 0.65,
        reason:
          "Metered energy savings are the primary evidence behind a claimed reduction.",
      },
      environmental_consulting: {
        weight: 0.6,
        reason:
          "Inventory and assurance work is delivered by consultancies with existing regulator and audit experience.",
      },
      waste_management: {
        weight: 0.55,
        reason:
          "Waste tonnage, treatment route and recovery data are direct inputs to the inventory.",
      },
      corporate_finance: {
        weight: 0.55,
        reason:
          "Sustainability disclosure is prepared on the reporting calendar under finance controls and external assurance.",
      },
    },
  },
  cardiology: {
    label: "Cardiology",
    onet: "29-1212.00",
    aliases: [
      "cardiologist",
      "drop; 'interventional cardiology', 'cardiac electrophysiology' and 'coronary intervention' identify the physician",
      "interventional cardiology",
      "cardiac electrophysiology",
      "coronary intervention",
      "heart failure clinic",
      "cardiac catheterisation",
      "cardiac catheterization",
      "pacemaker implantation",
    ],
    adjacent: {
      sonography: {
        weight: 0.7,
        reason:
          "Echocardiography is the cardiologist's primary imaging tool and is acquired daily by cardiac sonographers beside them.",
      },
      critical_care_nursing: {
        weight: 0.55,
        reason:
          "Coronary care nurses run the arrhythmia and inotrope protocols cardiologists set, and escalate against them overnight.",
      },
      surgical_practice: {
        weight: 0.55,
        reason:
          "Structural and coronary cases are decided in a joint meeting with cardiac surgeons who take the ones not suited to a catheter.",
      },
      general_practice: {
        weight: 0.5,
        reason:
          "Long-term heart failure and rhythm control are shared care, with primary care titrating what the cardiology clinic starts.",
      },
    },
  },
  care_home_management: {
    label: "Care Home Management",
    onet: "11-9111.00",
    aliases: [
      "care home manager",
      "registered manager",
      "nursing home manager",
      "residential care manager",
      "domiciliary care manager",
      "nursing home administrator",
      "assisted living manager",
      "cqc registered manager",
      "deputy care home manager",
      "lnha",
      "care home management",
    ],
    adjacent: {
      community_nursing: {
        weight: 0.75,
        reason:
          "Care home residents are managed jointly with district nursing, and managers are usually recruited from that caseload.",
      },
      registered_nursing: {
        weight: 0.7,
        reason:
          "Nursing home managers are usually registered nurses first, and the role still carries personal responsibility for clinical standards on site. — and on community_nursing→care_home_management: District nurses visit residential home residents and know the standards those homes are inspected against, which is one route into a registered manager post.",
      },
      clinical_governance: {
        weight: 0.65,
        reason:
          "The registered manager personally holds the inspection, audit and incident duties for the whole home.",
      },
      people_operations: {
        weight: 0.5,
        reason:
          "Rota, recruitment, supervision and training for the whole site sit with the manager, which is people operations under a care licence.",
      },
    },
  },
  category_management: {
    label: "Category Management & Buying",
    onet: "13-1022.00",
    aliases: [
      "retail category management",
      "retail category manager",
      "retail buyer",
      "range planning",
      "assortment planning",
      "private label sourcing",
      "buying and merchandising",
      "category plan",
      "trading term negotiation",
      "category management & buying",
    ],
    adjacent: {
      merchandising: {
        weight: 0.85,
        reason:
          "The buyer chooses the range and the terms, and merchandising decides how much of it goes where and when.",
      },
      ecommerce_trading: {
        weight: 0.7,
        reason:
          "The same range and margin plan has to be traded online, where availability and listing quality decide the sale.",
      },
      pricing_strategy: {
        weight: 0.65,
        reason:
          "Retail price, promotion depth and supplier funding are negotiated as one margin plan for the category.",
      },
      channel_sales: {
        weight: 0.5,
        reason:
          "Both sides of a trading negotiation use the same levers: volume commitments, rebates and listing terms.",
      },
    },
  },
  cell_and_gene_therapy: {
    label: "Cell And Gene Therapy",
    aliases: [
      "cell and gene therapy",
      "car t manufacturing",
      "viral vector production",
      "aav process development",
      "lentiviral vector",
      "autologous cell therapy",
      "gene editing therapeutic",
      "crispr therapeutic",
      "viral vector core facility",
      "atmp",
    ],
    adjacent: {
      bioprocess_development: {
        weight: 0.75,
        reason:
          "Vector and cell manufacture is bioprocessing under a much tighter clock and a single-patient batch size.",
      },
      gmp_quality_assurance: {
        weight: 0.75,
        reason:
          "Batch disposition in days rather than weeks makes the quality system the binding constraint on an autologous product.",
      },
      genomics: {
        weight: 0.7,
        reason:
          "Integration sites and editing outcomes are confirmed by sequencing, so both disciplines share the readout.",
      },
      translational_science: {
        weight: 0.7,
        reason:
          "These programmes live or die on carrying a mechanism from animal models into the first treated patients.",
      },
      clinical_development: {
        weight: 0.6,
        reason:
          "Trial design for a one-time durable therapy is unusual enough that developers and manufacturers design it jointly.",
      },
    },
  },
  channel_sales: {
    label: "Channel Sales",
    aliases: [
      "channel partner",
      "channel manager",
      "channel sale",
      "reseller management",
      "distributor management",
      "value added reseller",
      "indirect sale",
      "partner enablement",
      "distribution agreement",
      "msp partnership",
      "channel sales",
    ],
    adjacent: {
      partnership_management: {
        weight: 0.85,
        reason:
          "Recruiting a reseller and signing an alliance use the same commercial motion: terms, enablement and joint pipeline.",
      },
      enterprise_sales: {
        weight: 0.7,
        reason:
          "Selling through a reseller demands the same forecast discipline and negotiation as direct selling, plus a margin structure.",
      },
      sales_leadership: {
        weight: 0.6,
        reason:
          "Channel leaders carry a quota, a territory model and a partner headcount plan like any other sales line.",
      },
      go_to_market: {
        weight: 0.6,
        reason:
          "Distribution coverage and partner margin are the working levers of a route-to-market plan.",
      },
    },
  },
  charity_fundraising: {
    label: "Charity Fundraising",
    onet: "13-1131.00",
    aliases: [
      "charity fundraising",
      "major donor fundraising",
      "trust and foundation fundraising",
      "community fundraising",
      "corporate partnership fundraising",
      "legacy giving",
      "individual giving",
      "donor stewardship",
      "capital campaign",
      "chartered institute of fundraising",
    ],
    adjacent: {
      grant_making: {
        weight: 0.8,
        reason:
          "Fundraisers and funders read the same applications from opposite sides of the table.",
      },
      enterprise_sales: {
        weight: 0.6,
        reason:
          "Major donor and corporate partnership work is relationship selling with a pipeline and a close.",
      },
      public_policy_analysis: {
        weight: 0.5,
        reason:
          "A case for support draws on the same evidence base as the charity's policy and campaign work.",
      },
      financial_leadership: {
        weight: 0.5,
        reason:
          "Income strategy, restricted funds and reserves policy are settled with the finance director.",
      },
    },
  },
  civil_engineering: {
    label: "Civil Engineering",
    onet: "17-2051.00",
    aliases: [
      "civil engineer",
      "chartered civil engineer",
      "civil design engineer",
      "civil engineering design",
      "ceng mice",
      "civil 3d",
      "civil infrastructure design",
      "earthwork design",
      "civil infrastructure engineer",
      "civil engineering",
    ],
    adjacent: {
      structural_engineering: {
        weight: 0.8,
        reason:
          "Both size load-bearing elements to the same concrete and steel codes and share the chartered route.",
      },
      geotechnical_engineering: {
        weight: 0.8,
        reason:
          "Earthworks, retaining structures and site investigation sit on the boundary between the two disciplines.",
      },
      highway_engineering: {
        weight: 0.8,
        reason:
          "Alignment, drainage and pavement design are simply the civil engineering of a road scheme.",
      },
      water_engineering: {
        weight: 0.75,
        reason:
          "Surface water drainage and flood mitigation are core civil infrastructure outputs on every site.",
      },
      construction_project_management: {
        weight: 0.6,
        reason:
          "Design engineers routinely move into contractor and client-side delivery on the schemes they detailed.",
      },
    },
  },
  claims_handling: {
    label: "Claims Handling",
    onet: "13-1031.00",
    aliases: [
      "claims handler",
      "claims adjuster",
      "loss adjuster",
      "claims examiner",
      "insurance claim handling",
      "claims negotiation",
      "subrogation recovery",
      "first notification of loss",
      "claims triage",
      "third party claim",
      "catastrophe claim",
      "claims handling",
    ],
    adjacent: {
      insurance_underwriting: {
        weight: 0.75,
        reason:
          "Handlers apply the policy wording the underwriter wrote and report the loss experience that repricing depends on.",
      },
      actuarial_practice: {
        weight: 0.6,
        reason:
          "Case reserves and settlement patterns set by handlers are the raw data behind actuarial reserving triangles.",
      },
      reinsurance: {
        weight: 0.6,
        reason:
          "Large and catastrophe losses are recovered under treaties, so handlers prepare the reinsurance recovery submission.",
      },
      financial_crime_compliance: {
        weight: 0.55,
        reason:
          "Claims fraud investigation uses the same evidence gathering, referral and reporting practice as financial crime work.",
      },
    },
  },
  classroom_teaching: {
    label: "Classroom Teaching",
    aliases: [
      "classroom teacher",
      "class teacher",
      "primary school teacher",
      "secondary school teacher",
      "subject teacher",
      "qts",
      "pgce",
      "nqt",
      "early career teacher",
      "form tutor",
      "supply teacher",
      "lesson planning",
      "classroom teaching",
    ],
    adjacent: {
      curriculum_design: {
        weight: 0.8,
        reason:
          "A teacher writes schemes of work and assessments, which is curriculum design applied to one class.",
      },
      special_educational_needs: {
        weight: 0.7,
        reason:
          "Class teachers adapt lessons and deliver the support set out in an EHCP alongside specialist staff.",
      },
      school_leadership: {
        weight: 0.7,
        reason:
          "Headship is almost always reached through years in the classroom and a middle leadership post.",
      },
      learning_and_development: {
        weight: 0.6,
        reason:
          "Teachers move into corporate training because both plan a session and check whether learning stuck.",
      },
      safeguarding_practice: {
        weight: 0.6,
        reason:
          "Every teacher is trained to spot and report child protection concerns to the designated lead.",
      },
    },
  },
  climate_risk: {
    label: "Climate Risk",
    aliases: [
      "climate risk",
      "physical climate risk",
      "climate transition risk",
      "climate scenario analysis",
      "climate adaptation",
      "tcfd reporting",
      "climate vulnerability assessment",
      "catastrophe modelling",
      "climate resilience planning",
    ],
    adjacent: {
      carbon_accounting: {
        weight: 0.75,
        reason:
          "Transition risk is quantified from the same emissions inventory and reduction pathway.",
      },
      impact_assessment: {
        weight: 0.6,
        reason:
          "Resilience and adaptation chapters in consent applications use the same downscaled projections.",
      },
      environmental_consulting: {
        weight: 0.55,
        reason:
          "Adaptation studies are commissioned from the consultancies already holding the environmental baseline data.",
      },
      energy_trading: {
        weight: 0.5,
        reason:
          "Weather and policy scenarios that drive risk models also drive forward power and gas curves.",
      },
    },
  },
  clinical_coding: {
    label: "Clinical Coding",
    onet: "29-2072.00",
    aliases: [
      "clinical coding",
      "clinical coder",
      "medical coder",
      "icd 10",
      "icd 11",
      "snomed ct",
      "opcs",
      "cpt coding",
      "drg grouping",
      "hcc coding",
      "casemix",
      "certified coding specialist",
    ],
    adjacent: {
      health_informatics: {
        weight: 0.75,
        reason:
          "Coding sits on the same terminology and record structure that informatics teams build and maintain.",
      },
      clinical_governance: {
        weight: 0.6,
        reason:
          "Audit, mortality review and case mix comparison all rest on coded data being complete and correct.",
      },
      operational_finance: {
        weight: 0.55,
        reason:
          "Coded activity drives reimbursement, so coders work directly with the finance team that bills and reconciles it.",
      },
      data_engineering: {
        weight: 0.5,
        reason:
          "Coded activity is the structured field every downstream pipeline reads, so coders define the data quality and validation rules that engineers then implement.",
      },
    },
  },
  clinical_data_management: {
    label: "Clinical Data Management",
    aliases: [
      "clinical data management",
      "clinical data manager",
      "edc build",
      "data query resolution",
      "clinical database lock",
      "medidata rave",
      "cdisc",
      "sdtm",
      "case report form design",
      "data validation plan",
      "edit check specification",
    ],
    adjacent: {
      statistical_programming: {
        weight: 0.8,
        reason:
          "The clean locked CRF data the data manager delivers is what the programmer maps to SDTM and then to analysis datasets.",
      },
      clinical_trial_management: {
        weight: 0.75,
        reason:
          "Open queries are worked jointly with the trial manager right up to database lock.",
      },
      biostatistics: {
        weight: 0.7,
        reason:
          "The statistician approves the data validation plan and signs the lock before any analysis is unblinded.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "Both build schemas and validated pipelines whose correctness is formally audited rather than assumed.",
      },
    },
  },
  clinical_development: {
    label: "Clinical Development",
    aliases: [
      "clinical development",
      "clinical development plan",
      "clinical protocol design",
      "phase 1 trial",
      "phase 2 trial",
      "phase 3 trial",
      "first in human study",
      "clinical study protocol",
      "drug development plan",
      "endpoint selection",
      "therapeutic area physician",
    ],
    adjacent: {
      clinical_trial_management: {
        weight: 0.8,
        reason:
          "The development plan a physician writes is what the trial manager then has to execute across dozens of sites.",
      },
      biostatistics: {
        weight: 0.8,
        reason:
          "Sample size and primary endpoint are settled jointly with the trial statistician before the protocol is fixed.",
      },
      medical_affairs: {
        weight: 0.7,
        reason:
          "The same physicians typically move between the two, taking an asset from pre-approval to post-approval evidence.",
      },
      clinical_pharmacology: {
        weight: 0.7,
        reason:
          "Dose and schedule for a phase 2 study come straight out of the clinical pharmacology package.",
      },
      clinical_practice: {
        weight: 0.65,
        reason:
          "Development physicians are hired for the specialty they actually treated patients in before moving into industry.",
      },
    },
  },
  clinical_governance: {
    label: "Clinical Governance",
    aliases: [
      "clinical governance",
      "clinical audit",
      "cqc inspection",
      "care quality commission",
      "clinical effectiveness",
      "revalidation",
      "serious incident investigation",
      "clinical risk register",
      "joint commission accreditation",
      "clinical quality improvement",
    ],
    adjacent: {
      patient_safety: {
        weight: 0.85,
        reason:
          "Safety investigation feeds the governance cycle: findings become audit, policy change and board-level assurance.",
      },
      infection_prevention: {
        weight: 0.65,
        reason:
          "Infection rates are a standing board assurance metric, so control teams report through the governance structure.",
      },
      clinical_coding: {
        weight: 0.55,
        reason:
          "Coded activity is the denominator for every clinical audit, so governance leads depend on the coding department's accuracy.",
      },
      clinical_practice: {
        weight: 0.7,
        reason:
          "Governance roles are held by practising clinicians, because judging a case needs someone who has done the work.",
      },
    },
  },
  clinical_monitoring: {
    label: "Clinical Monitoring",
    aliases: [
      "clinical research associate",
      "clinical monitor",
      "site monitoring visit",
      "source data verification",
      "monitoring visit report",
      "risk based clinical monitoring",
      "in house cra",
      "clinical trial monitor",
      "site initiation visit",
      "study close out visit",
      "clinical monitoring",
    ],
    adjacent: {
      clinical_trial_management: {
        weight: 0.85,
        reason:
          "Monitoring is the field half of trial management, and most trial managers were monitors first.",
      },
      clinical_data_management: {
        weight: 0.7,
        reason:
          "Source data verification generates most of the queries that end up sitting in the clinical database.",
      },
      clinical_practice: {
        weight: 0.6,
        reason:
          "Monitors are commonly recruited from nursing and study coordinator roles at the hospitals they later visit.",
      },
      pharmacovigilance: {
        weight: 0.6,
        reason:
          "It is usually the monitor who finds an unreported serious adverse event buried in the source notes.",
      },
    },
  },
  clinical_pharmacology: {
    label: "Clinical Pharmacology",
    aliases: [
      "clinical pharmacology",
      "pharmacokinetic modelling",
      "population pk",
      "exposure response analysis",
      "dose selection rationale",
      "nonmem",
      "pkpd modelling",
      "bioequivalence study",
      "first in human dose",
      "pharmacometrician",
      "phoenix winnonlin",
    ],
    adjacent: {
      dmpk: {
        weight: 0.85,
        reason:
          "Preclinical ADME parameters are what the clinical pharmacologist scales to a safe starting human dose.",
      },
      clinical_development: {
        weight: 0.8,
        reason:
          "Dose, schedule and exposure targets for later trials come out of the clinical pharmacology package.",
      },
      bioanalysis: {
        weight: 0.7,
        reason:
          "Every reported PK parameter is computed from concentrations produced by a validated bioanalytical assay.",
      },
      biostatistics: {
        weight: 0.7,
        reason:
          "Population PK is nonlinear mixed-effects modelling, the same statistical machinery applied to concentration data.",
      },
    },
  },
  clinical_trial_management: {
    label: "Clinical Trial Management",
    onet: "11-9121.01",
    aliases: [
      "clinical trial management",
      "clinical trial manager",
      "clinical trial operations",
      "study start up",
      "clinical site management",
      "ctms",
      "clinical project manager",
      "trial master file",
      "clinical site activation",
      "cro oversight",
      "patient recruitment plan",
    ],
    adjacent: {
      clinical_monitoring: {
        weight: 0.85,
        reason:
          "Monitors report into the trial manager, whose escalation path turns their site findings into corrective action.",
      },
      clinical_development: {
        weight: 0.8,
        reason:
          "The trial manager operationalises the protocol the development physician designed, feasibility included.",
      },
      clinical_data_management: {
        weight: 0.75,
        reason:
          "Database lock is a shared deadline, and the manager chases the sites for the queries the data manager raises.",
      },
      pharmacovigilance: {
        weight: 0.65,
        reason:
          "Serious adverse events from a site must be reconciled between the clinical database and the safety database before lock.",
      },
    },
  },
  cloud_architecture: {
    label: "Cloud Architecture",
    aliases: [
      "cloud architect",
      "aws solutions architect",
      "azure architect",
      "gcp architect",
      "cloud migration",
      "multi cloud",
      "landing zone",
      "well architected review",
      "aws certified solutions architect",
      "cloud cost optimisation",
      "serverless architecture",
      "cloud architecture",
    ],
    adjacent: {
      solution_architecture: {
        weight: 0.8,
        reason:
          "Both turn a stated requirement into a component diagram, a cost model and a build sequence.",
      },
      network_engineering: {
        weight: 0.7,
        reason:
          "Cloud networks are VPCs, subnets, peering and BGP: the same discipline expressed in software.",
      },
      devops: {
        weight: 0.7,
        reason:
          "A cloud design is only real once it exists as reviewed Terraform running in a pipeline.",
      },
      enterprise_architecture: {
        weight: 0.6,
        reason:
          "Cloud target-state designs must sit inside the enterprise reference architecture and its standards.",
      },
    },
  },
  cnc_machining: {
    label: "CNC Machining",
    onet: "51-4041.00",
    aliases: [
      "cnc machinist",
      "cnc programmer",
      "cnc milling",
      "cnc turning",
      "machinist",
      "g code programming",
      "mastercam",
      "lathe operator",
      "surface grinding",
      "5 axis machining",
      "setter operator",
      "cnc machining",
    ],
    adjacent: {
      tool_and_die: {
        weight: 0.8,
        reason:
          "Tool rooms recruit from machinists, because die work is machining held to a few microns.",
      },
      metrology: {
        weight: 0.7,
        reason:
          "Machinists prove a first off with gauges and CMM reports before releasing a batch.",
      },
      manufacturing_engineering: {
        weight: 0.65,
        reason:
          "The route, fixture and cycle time a machinist runs are specified by manufacturing engineering.",
      },
      additive_manufacturing: {
        weight: 0.55,
        reason:
          "Printed metal parts still need machining on critical faces, so shops run both processes on one part.",
      },
      mechanical_engineering: {
        weight: 0.5,
        reason:
          "Reading a tolerance drawing and judging what is actually manufacturable is shared with the mechanical designer.",
      },
    },
  },
  commercial_lending: {
    label: "Commercial Lending",
    onet: "13-2072.00",
    aliases: [
      "commercial lending",
      "corporate banking",
      "commercial banker",
      "loan origination",
      "syndicated lending",
      "asset based lending",
      "trade finance",
      "sme lending",
      "credit facility structuring",
      "loan portfolio monitoring",
      "relationship banking",
    ],
    adjacent: {
      credit_analysis: {
        weight: 0.85,
        reason:
          "Every lending proposal rests on a written credit assessment of the borrower, so bankers underwrite as well as originate.",
      },
      treasury_management: {
        weight: 0.6,
        reason:
          "Bankers negotiate facilities with corporate treasurers and have to read a cash forecast the way the treasurer built it.",
      },
      investment_banking: {
        weight: 0.6,
        reason:
          "Syndicated and leveraged loans are executed jointly by lending and capital markets teams on one transaction.",
      },
      financial_crime_compliance: {
        weight: 0.55,
        reason:
          "Onboarding a corporate borrower requires beneficial ownership, sanctions and due diligence evidence the relationship banker owns.",
      },
    },
  },
  commissioning_management: {
    label: "Commissioning And Start-Up",
    aliases: [
      "commissioning engineer",
      "commissioning manager",
      "pre commissioning",
      "plant start up",
      "loop check",
      "punch list",
      "plant handover",
      "mechanical completion",
      "witness testing",
      "commissioning and start-up",
    ],
    adjacent: {
      process_safety: {
        weight: 0.6,
        reason:
          "Start-up is when a plant is first pressurised, so pre-start safety review and permit control are central.",
      },
      systems_engineering: {
        weight: 0.6,
        reason:
          "Commissioning closes the verification half of the V-model by testing built plant against stated requirements.",
      },
      substation_engineering: {
        weight: 0.6,
        reason:
          "Protection loop checks and energisation procedures are written jointly with the substation designer.",
      },
      energy_efficiency: {
        weight: 0.55,
        reason:
          "Measured performance at handover is what proves or disproves the modelled energy saving.",
      },
    },
  },
  community_management: {
    label: "Community Management",
    aliases: [
      "community management",
      "community manager",
      "community building",
      "forum moderation",
      "ambassador program",
      "user group program",
      "member engagement",
      "discord community",
    ],
    adjacent: {
      social_media_management: {
        weight: 0.8,
        reason:
          "Both hold the public voice of the company in a comment thread and are measured on how conversation there behaves.",
      },
      customer_success: {
        weight: 0.6,
        reason:
          "Both spend their day with existing users, and a good community answer removes support and success load from the same accounts.",
      },
      content_marketing: {
        weight: 0.55,
        reason:
          "Community programmes run on published guides, member stories and event write-ups that have to be written and scheduled.",
      },
      partnership_management: {
        weight: 0.5,
        reason:
          "Ambassador and user group programmes are negotiated and resourced much like small partnerships, with agreed benefits on both sides.",
      },
    },
  },
  community_nursing: {
    label: "Community Nursing",
    aliases: [
      "district nurse",
      "community nurse",
      "health visitor",
      "practice nurse",
      "home health nurse",
      "hospice nurse",
      "palliative care nurse",
      "community matron",
      "school nurse",
      "tissue viability nurse",
      "community nursing",
    ],
    adjacent: {
      registered_nursing: {
        weight: 0.8,
        reason:
          "District nurses hold the same registration and move between hospital wards and community caseloads through a career.",
      },
      care_home_management: {
        weight: 0.7,
        reason:
          "Community nurses supervise care home residents and step into the registered manager role with that caseload experience.",
      },
      general_practice: {
        weight: 0.7,
        reason:
          "Community nursing teams are attached to GP lists and review the same long-term condition patients between appointments.",
      },
      mental_health_practice: {
        weight: 0.5,
        reason:
          "Health visitors and community nurses screen for and refer perinatal and later-life mental illness they meet at home.",
      },
    },
  },
  competition_law: {
    label: "Competition And Antitrust Law",
    onet: "23-1011.00",
    aliases: [
      "competition lawyer",
      "antitrust counsel",
      "antitrust litigation",
      "merger control filing",
      "cartel investigation",
      "dawn raid",
      "abuse of dominance",
      "hart scott rodino filing",
      "cma investigation",
      "state aid advice",
      "competition compliance",
      "article 101 tfeu",
      "competition and antitrust law",
    ],
    adjacent: {
      corporate_ma_law: {
        weight: 0.7,
        reason:
          "Merger control filings are prepared to the deal timetable, so antitrust and transactional lawyers plan conditions together.",
      },
      regulatory_compliance: {
        weight: 0.65,
        reason:
          "Competition programmes, training and monitoring are designed and tested like any other regulatory programme.",
      },
      corporate_investigations: {
        weight: 0.6,
        reason:
          "A cartel inquiry or dawn raid demands immediate document preservation and interviews, the same first response an internal investigation runs.",
      },
      litigation: {
        weight: 0.55,
        reason:
          "Follow-on claims and appeals are fought in court on economic expert evidence and heavy disclosure.",
      },
    },
  },
  composites_manufacturing: {
    label: "Composites Manufacturing",
    aliases: [
      "composite technician",
      "composite laminator",
      "hand layup",
      "prepreg layup",
      "autoclave curing",
      "resin transfer moulding",
      "filament winding",
      "carbon fibre fabrication",
      "carbon fiber fabrication",
      "vacuum bagging",
      "composite repair technician",
      "composites manufacturing",
    ],
    adjacent: {
      aerospace: {
        weight: 0.75,
        reason:
          "Airframe and interior structures are laid up and cured to aerospace process specifications.",
      },
      materials_science: {
        weight: 0.7,
        reason:
          "Resin chemistry, cure schedule and fibre architecture decide the part, so layup is applied materials work.",
      },
      mechanical_engineering: {
        weight: 0.5,
        reason:
          "Laminate stacking and load path decisions sit with the structural engineer the technician builds for.",
      },
    },
  },
  construction_estimating: {
    label: "Construction Estimating",
    onet: "13-1051.00",
    aliases: [
      "construction estimator",
      "chief estimator",
      "preconstruction estimator",
      "estimating manager",
      "quantity takeoff",
      "tender submission pricing",
      "unit rate build up",
      "subcontract quotation analysis",
      "construction bid pricing",
      "construction estimating",
    ],
    adjacent: {
      quantity_surveying: {
        weight: 0.85,
        reason:
          "The estimator's tender build-up becomes the quantity surveyor's cost plan once the job is won.",
      },
      construction_planning: {
        weight: 0.6,
        reason:
          "Tender pricing depends on the programme's durations, plant hire periods and preliminaries.",
      },
      construction_project_management: {
        weight: 0.65,
        reason:
          "Estimators hand the winning price to the delivery team and then defend its assumptions.",
      },
    },
  },
  construction_health_safety: {
    label: "Construction Health And Safety (CDM)",
    onet: "29-9011.00",
    aliases: [
      "cdm regulation",
      "cdm advisor",
      "cdm principal designer",
      "construction health and safety",
      "construction phase plan",
      "site safety adviser",
      "risk assessment method statement",
      "construction health and safety (cdm)",
    ],
    adjacent: {
      site_management: {
        weight: 0.8,
        reason:
          "Inductions, permits and method statements are enforced by the site team the adviser trains.",
      },
      construction_project_management: {
        weight: 0.65,
        reason:
          "Duty holder roles under construction safety regulations sit with the client and contractor project teams.",
      },
      fire_engineering: {
        weight: 0.55,
        reason:
          "Temporary escape routes and hot works control during construction are a shared responsibility.",
      },
    },
  },
  construction_law: {
    label: "Construction Law",
    onet: "23-1011.00",
    aliases: [
      "construction lawyer",
      "construction dispute",
      "construction adjudication",
      "jct contract",
      "fidic contract",
      "delay and disruption claim",
      "extension of time claim",
      "construction defect claim",
      "contentious construction",
      "construction arbitration",
      "construction law",
    ],
    adjacent: {
      arbitration_adr: {
        weight: 0.7,
        reason:
          "Construction disputes are decided in adjudication and arbitration far more often than in court, so the forum skill is identical.",
      },
      real_estate_law: {
        weight: 0.65,
        reason:
          "The building contract sits on top of the site title, leases and consents the property lawyer put in place.",
      },
      contract_management: {
        weight: 0.6,
        reason:
          "Standard-form contracts are administered day to day through notices, variations and payment cycles.",
      },
      litigation: {
        weight: 0.55,
        reason:
          "Delay, defect and quantum claims are proved with expert and documentary evidence exactly as in commercial litigation.",
      },
    },
  },
  construction_planning: {
    label: "Construction Planning And Scheduling",
    aliases: [
      "construction planner",
      "planning engineer",
      "construction project planner",
      "primavera p6",
      "asta powerproject",
      "baseline programme",
      "critical path programme",
      "4d planning",
      "delay analysis",
      "schedule risk analysis",
      "construction programme",
      "construction planning and scheduling",
    ],
    adjacent: {
      construction_project_management: {
        weight: 0.8,
        reason:
          "The baseline programme and its updates are the spine of project reporting and change control.",
      },
      construction_estimating: {
        weight: 0.6,
        reason:
          "Preliminaries, plant hire and staffing costs are priced straight off the tender programme.",
      },
      site_management: {
        weight: 0.6,
        reason:
          "Sequencing and look-ahead decisions are validated with the site team before they are issued.",
      },
      quantity_surveying: {
        weight: 0.5,
        reason:
          "Delay analysis and prolongation claims are argued jointly by the planner and the commercial team.",
      },
    },
  },
  construction_project_management: {
    label: "Construction Project Management",
    onet: "11-9021.00",
    aliases: [
      "construction project manager",
      "nec project manager",
      "jct contract administrator",
      "client side project manager",
      "design and build project manager",
      "construction programme manager",
      "employers agent",
      "construction project management",
    ],
    adjacent: {
      site_management: {
        weight: 0.8,
        reason:
          "The project manager sets the programme and budget the site team then builds to week by week.",
      },
      construction_planning: {
        weight: 0.75,
        reason:
          "Progress reporting, delay claims and recovery all run off the planner's baseline programme.",
      },
      quantity_surveying: {
        weight: 0.7,
        reason:
          "Commercial and delivery roles sit in one team and settle change against the same contract.",
      },
      construction_health_safety: {
        weight: 0.65,
        reason:
          "Duty holder obligations for the construction phase plan fall on whoever runs the project.",
      },
      property_development: {
        weight: 0.55,
        reason:
          "Client-side project director and development director are the same career step for many people.",
      },
    },
  },
  contaminated_land: {
    label: "Contaminated Land And Remediation",
    aliases: [
      "contaminated land",
      "land remediation",
      "phase 1 desk study",
      "phase 2 site investigation",
      "brownfield redevelopment",
      "land remediation strategy",
      "geoenvironmental engineer",
      "contaminated soil sampling",
      "specialist in land condition",
      "contaminated land and remediation",
    ],
    adjacent: {
      hydrogeology: {
        weight: 0.75,
        reason:
          "Contaminant transport is modelled in groundwater by the specialist who also designs the monitoring wells.",
      },
      environmental_consulting: {
        weight: 0.7,
        reason:
          "Land condition reports are produced under the same consultancy appointment and regulator dialogue.",
      },
      geology: {
        weight: 0.6,
        reason:
          "Ground models, soil logging and made ground interpretation come straight out of field geology.",
      },
      waste_management: {
        weight: 0.55,
        reason:
          "Excavated material must be classified, treated or disposed under waste rules before a site can be cleared.",
      },
    },
  },
  content_marketing: {
    label: "Content Marketing",
    aliases: [
      "content marketing",
      "content strategy",
      "editorial calendar",
      "editorial strategy",
      "thought leadership content",
      "long form content production",
      "case study writing",
      "content operations",
      "blog program",
      "content marketer",
    ],
    adjacent: {
      copywriting: {
        weight: 0.85,
        reason:
          "Content leads commission and edit the words, and most have spent years writing them to a brief themselves.",
      },
      search_engine_optimization: {
        weight: 0.8,
        reason:
          "Published pages are how organic rankings are won, so search briefs drive what goes on the editorial calendar.",
      },
      social_media_management: {
        weight: 0.65,
        reason:
          "The same articles, films and studies are cut down for distribution on social channels, usually by one small team.",
      },
      product_marketing: {
        weight: 0.6,
        reason:
          "Case studies, launch pages and thought-leadership pieces are briefed from product marketing's messaging house.",
      },
    },
  },
  contract_management: {
    label: "Contract Management And Negotiation",
    aliases: [
      "contract manager",
      "contract administrator",
      "commercial contract drafting",
      "master services agreement",
      "contract lifecycle management",
      "nda review",
      "statement of work drafting",
      "contract redline",
      "subcontract administration",
      "cccm",
      "contract management and negotiation",
    ],
    adjacent: {
      in_house_counsel: {
        weight: 0.8,
        reason:
          "Contract managers negotiate the same commercial paper as in-house counsel and escalate the drafting they cannot settle.",
      },
      legal_operations: {
        weight: 0.65,
        reason:
          "Contract lifecycle systems, templates and playbooks are implemented as legal operations projects.",
      },
      enterprise_sales: {
        weight: 0.6,
        reason:
          "Deal desks agree pricing, liability and delivery commitments with the sales team before a contract can be signed.",
      },
      third_party_risk_management: {
        weight: 0.6,
        reason:
          "Audit rights, service levels and exit terms only bite if they were negotiated in and then monitored.",
      },
      arbitration_adr: {
        weight: 0.5,
        reason:
          "Escalation ladders, governing law and the dispute clause are drafted up front and relied on when the deal breaks down.",
      },
    },
  },
  copywriting: {
    label: "Copywriting",
    onet: "27-3043.05",
    aliases: [
      "copywriter",
      "advertising copywriter",
      "brand copywriter",
      "ux writer",
      "content designer",
      "conversion copywriter",
      "tone of voice writing",
      "microcopy",
      "copywriting",
    ],
    adjacent: {
      art_direction: {
        weight: 0.8,
        reason:
          "The writer and art director develop the concept as a pair and present it jointly in most agencies.",
      },
      editorial_publishing: {
        weight: 0.7,
        reason:
          "Both trades are structure, cut and headline craft, and writers move between agency and publishing regularly.",
      },
      brand_identity: {
        weight: 0.65,
        reason:
          "Tone of voice is half of an identity, written and documented alongside the visual guidelines.",
      },
      user_experience_design: {
        weight: 0.65,
        reason:
          "UX writing sets button labels, errors and empty states, which is interface design done in words.",
      },
      go_to_market: {
        weight: 0.5,
        reason:
          "Launch messaging and positioning copy are written to the same brief that drives the commercial plan.",
      },
    },
  },
  corporate_governance: {
    label: "Corporate Governance And Company Secretarial",
    aliases: [
      "company secretary",
      "assistant company secretary",
      "corporate governance manager",
      "board minute taking",
      "board pack preparation",
      "chartered governance professional",
      "icsa qualified",
      "companies house filing",
      "legal entity management",
      "annual general meeting administration",
      "board effectiveness review",
      "conflict of interest register",
      "corporate governance and company secretarial",
    ],
    adjacent: {
      in_house_counsel: {
        weight: 0.7,
        reason:
          "Board support, entity management and filings usually sit in the legal department, often held by the same person.",
      },
      corporate_ma_law: {
        weight: 0.6,
        reason:
          "Approvals, share issues and post-completion filings for a transaction are executed as company secretarial work.",
      },
      financial_leadership: {
        weight: 0.6,
        reason:
          "Committee reporting, dividends and statutory accounts are prepared jointly with the finance leadership.",
      },
      enterprise_risk_management: {
        weight: 0.6,
        reason:
          "The board's risk and audit committees are serviced with the register and appetite statement the risk team maintains.",
      },
      internal_audit: {
        weight: 0.55,
        reason:
          "Committee agendas, audit reports and remediation tracking are administered through the governance calendar.",
      },
    },
  },
  corporate_investigations: {
    label: "Corporate Investigations And Forensics",
    onet: "13-2099.04",
    aliases: [
      "internal investigation",
      "corporate investigation",
      "forensic accounting",
      "fraud investigation",
      "whistleblowing investigation",
      "workplace investigation",
      "witness interview",
      "digital forensic examination",
      "fcpa investigation",
      "bribery and corruption investigation",
      "asset tracing",
      "cfe",
      "corporate investigations and forensics",
    ],
    adjacent: {
      financial_crime_compliance: {
        weight: 0.7,
        reason:
          "Escalations from monitoring and whistleblowing lines become investigations, whose findings then rewrite the controls.",
      },
      ediscovery: {
        weight: 0.7,
        reason:
          "Every investigation opens with preservation, collection and keyword review of custodian data.",
      },
      internal_audit: {
        weight: 0.65,
        reason:
          "Both test what actually happened against policy using sampling, walkthroughs and interviews.",
      },
      litigation: {
        weight: 0.65,
        reason:
          "The investigation report and preserved evidence set the ground for any claim or defence that follows.",
      },
      criminal_law: {
        weight: 0.6,
        reason:
          "Bribery and fraud matters can become prosecutions, so investigators work to an evidential standard a court will accept.",
      },
    },
  },
  corporate_ma_law: {
    label: "Corporate And M&A Law",
    onet: "23-1011.00",
    aliases: [
      "corporate lawyer",
      "corporate attorney",
      "m&a lawyer",
      "mergers and acquisitions counsel",
      "share purchase agreement",
      "legal due diligence",
      "shareholder agreement",
      "private equity counsel",
      "securities lawyer",
      "company law",
      "transactional attorney",
      "corporate and m&a law",
    ],
    adjacent: {
      corporate_finance: {
        weight: 0.75,
        reason:
          "Deal counsel and corporate finance work one transaction timetable, from diligence findings to purchase-price adjustment mechanics.",
      },
      in_house_counsel: {
        weight: 0.7,
        reason:
          "In-house teams are commonly led by former transactional lawyers, because acquisitions and financings land on that desk first.",
      },
      corporate_governance: {
        weight: 0.7,
        reason:
          "Completing a deal means board approvals, share registers and statutory filings, which is company secretarial work.",
      },
      competition_law: {
        weight: 0.65,
        reason:
          "Any sizeable acquisition needs merger clearance, so deal lawyers plan filing thresholds and conditions with antitrust counsel.",
      },
      tax_law: {
        weight: 0.6,
        reason:
          "Deal structure is chosen for its tax outcome, so the share-versus-asset decision is taken jointly with tax counsel.",
      },
    },
  },
  credit_analysis: {
    label: "Credit Analysis",
    onet: "13-2041.00",
    aliases: [
      "credit analysis",
      "credit analyst",
      "credit underwriting",
      "credit risk assessment",
      "covenant analysis",
      "credit committee paper",
      "obligor risk rating",
      "credit approval memo",
      "leveraged loan analysis",
      "counterparty credit assessment",
      "borrower financial analysis",
    ],
    adjacent: {
      commercial_lending: {
        weight: 0.85,
        reason:
          "Lenders make the decision the credit analyst underwrites, and analysts commonly move onto the origination side of the same bank.",
      },
      credit_research: {
        weight: 0.7,
        reason:
          "Both judge whether a borrower services its debt through a cycle; one writes for a credit committee, the other for investors.",
      },
      financial_risk_management: {
        weight: 0.7,
        reason:
          "Obligor ratings and default estimates written by analysts are the inputs that portfolio credit risk models are calibrated on.",
      },
      restructuring_advisory: {
        weight: 0.6,
        reason:
          "When a covenant breaks, the existing credit analysis of the borrower is the opening document in a restructuring negotiation.",
      },
    },
  },
  credit_research: {
    label: "Credit Research",
    onet: "13-2051.00",
    aliases: [
      "credit research",
      "fixed income research",
      "corporate bond research",
      "high yield analyst",
      "distressed debt analyst",
      "credit rating analyst",
      "investment grade credit analysis",
      "structured credit analysis",
      "leveraged loan research",
      "recovery rate analysis",
    ],
    adjacent: {
      credit_analysis: {
        weight: 0.8,
        reason:
          "Both assess an issuer's ability to service debt through leverage, coverage and cash conversion, one for investors and one for a lender.",
      },
      portfolio_management: {
        weight: 0.7,
        reason:
          "Fixed income books are constructed from issuer level credit views, so research analysts often move into running credit mandates.",
      },
      restructuring_advisory: {
        weight: 0.65,
        reason:
          "Distressed analysts model recovery through an insolvency process, which is exactly the restructuring adviser's core analysis.",
      },
      equity_research: {
        weight: 0.6,
        reason:
          "Covering an issuer's debt and its equity requires one forecast model and the same sector knowledge.",
      },
    },
  },
  criminal_law: {
    label: "Criminal Practice",
    onet: "23-1011.00",
    aliases: [
      "criminal defence solicitor",
      "criminal defense attorney",
      "criminal barrister",
      "public defender",
      "crown prosecutor",
      "prosecuting attorney",
      "duty solicitor",
      "police station representative",
      "magistrates court advocacy",
      "crown court trial",
      "white collar defence",
      "higher rights of audience",
      "criminal practice",
    ],
    adjacent: {
      corporate_investigations: {
        weight: 0.65,
        reason:
          "White-collar defence and internal investigations use the same interview technique, evidence preservation and regulator engagement.",
      },
      financial_crime_compliance: {
        weight: 0.6,
        reason:
          "Prosecuting or defending under money-laundering and bribery statutes needs the same statutory knowledge compliance teams apply preventively.",
      },
      paralegal_practice: {
        weight: 0.5,
        reason:
          "Case preparation, unused material schedules and court bundles are handled by paralegals in defence practices.",
      },
    },
  },
  critical_care_nursing: {
    label: "Critical Care Nursing",
    onet: "29-1141.03",
    aliases: [
      "critical care nurse",
      "intensive care nurse",
      "icu nurse",
      "itu nurse",
      "ccrn",
      "high dependency unit",
      "critical care outreach",
      "ventilator management",
      "hdu nursing",
      "sedation monitoring",
      "critical care nursing",
    ],
    adjacent: {
      registered_nursing: {
        weight: 0.85,
        reason:
          "Critical care nursing is registered nursing at a one-to-one ratio with invasive monitoring added to the same core skill set.",
      },
      anaesthesia: {
        weight: 0.7,
        reason:
          "Intensive care and anaesthesia share airway, ventilation and sedation practice, and the same consultants often cover both.",
      },
      emergency_medicine: {
        weight: 0.65,
        reason:
          "Resuscitation, arterial lines and vasoactive infusions are run the same way in resus and in the intensive care unit.",
      },
      perioperative_nursing: {
        weight: 0.6,
        reason:
          "Recovery and critical care nurses both manage the unconscious airway and haemodynamic instability immediately after surgery.",
      },
      patient_safety: {
        weight: 0.55,
        reason:
          "Intensive care runs the tightest checklist and bundle discipline in the hospital, which is where safety method is learned.",
      },
    },
  },
  cryptography: {
    label: "Cryptography",
    aliases: [
      "cryptographer",
      "applied cryptography",
      "cryptographic engineer",
      "public key infrastructure",
      "pki",
      "tls implementation",
      "post quantum cryptography",
      "hardware security module",
      "zero knowledge proof",
      "cryptographic protocol design",
      "cryptography",
    ],
    adjacent: {
      security_engineering: {
        weight: 0.75,
        reason:
          "Cryptographic choices are the hardest control to retrofit, so engineers consult cryptographers early.",
      },
      identity_access_management: {
        weight: 0.6,
        reason:
          "Token signing, certificate issuance and trust chains sit squarely between the two roles.",
      },
      research_science: {
        weight: 0.5,
        reason:
          "Protocol design is peer-reviewed work with proofs, closer to research than to delivery.",
      },
      software_engineering: {
        weight: 0.6,
        reason:
          "Cryptographic libraries are written, fuzzed and reviewed as very careful production code.",
      },
    },
  },
  culinary_practice: {
    label: "Culinary Practice",
    onet: "35-1011.00",
    aliases: [
      "head chef",
      "executive chef",
      "sous chef",
      "chef de partie",
      "commis chef",
      "demi chef",
      "chef patron",
      "pastry chef",
      "patissier",
      "kitchen brigade",
      "culinary art",
      "menu development",
      "michelin star",
      "culinary practice",
    ],
    adjacent: {
      food_beverage_management: {
        weight: 0.8,
        reason:
          "kitchen and front of house are costed, rota'd and run as one operation by chefs and F&B managers together",
      },
      food_science: {
        weight: 0.6,
        reason:
          "recipe scale-up, allergen matrices and shelf-life work move chefs into product development technologist roles",
      },
      nutrition_practice: {
        weight: 0.5,
        reason:
          "menu development for hospital, school or performance catering is done with dietitians against nutrient targets",
      },
    },
  },
  curriculum_design: {
    label: "Curriculum Design",
    onet: "25-9031.00",
    aliases: [
      "curriculum design",
      "curriculum development",
      "curriculum mapping",
      "scheme of work",
      "syllabus design",
      "assessment design",
      "national curriculum",
      "qualification development",
      "awarding body standard",
    ],
    adjacent: {
      instructional_design: {
        weight: 0.8,
        reason:
          "Both sequence content against stated outcomes; instructional design does it for digital delivery.",
      },
      classroom_teaching: {
        weight: 0.8,
        reason:
          "Curriculum leads are practising teachers who write the schemes their colleagues then deliver.",
      },
      education_inspection: {
        weight: 0.6,
        reason:
          "Inspection judgements turn on curriculum intent and sequencing, so both use the same vocabulary.",
      },
      learning_and_development: {
        weight: 0.6,
        reason:
          "School and corporate curricula are both built backwards from what a learner must be able to do.",
      },
    },
  },
  customer_success: {
    label: "Customer Success",
    aliases: [
      "customer success",
      "customer success manager",
      "client success",
      "churn prevention",
      "quarterly business review",
      "qbr",
      "net revenue retention",
      "adoption program",
      "gainsight",
    ],
    adjacent: {
      renewals_management: {
        weight: 0.85,
        reason:
          "Adoption work exists to make the renewal conversation easy, and both are measured on revenue actually retained.",
      },
      account_management: {
        weight: 0.8,
        reason:
          "Both hold a named account list and the relationship inside it, differing mainly in whether growth or adoption is the target.",
      },
      customer_support: {
        weight: 0.65,
        reason:
          "Success managers chase and escalate the same tickets, and an ageing support backlog shows up later as a churn risk.",
      },
      lifecycle_marketing: {
        weight: 0.55,
        reason:
          "Both work to keep the same accounts active, one through automated messaging and one through direct contact.",
      },
      revenue_operations: {
        weight: 0.5,
        reason:
          "Health scores, usage reporting and renewal forecasts run on the systems and data model revenue operations maintains.",
      },
    },
  },
  customer_support: {
    label: "Customer Support",
    onet: "43-4051.00",
    aliases: [
      "customer support",
      "help desk",
      "customer service representative",
      "contact centre agent",
      "contact center agent",
      "ticket handling",
      "escalation handling",
      "sla adherence",
      "zendesk",
    ],
    adjacent: {
      service_operations: {
        weight: 0.85,
        reason:
          "Frontline agents work to the staffing, routing and resolution targets that service operations design and monitor.",
      },
      customer_success: {
        weight: 0.65,
        reason:
          "Both hold the relationship after the sale, and an unresolved ticket queue turns into a retention problem.",
      },
      community_management: {
        weight: 0.5,
        reason:
          "A forum answer and a ticket answer are the same explanation written twice, and support staff often move into community roles.",
      },
    },
  },
  data_governance: {
    label: "Data Governance",
    aliases: [
      "data governance",
      "data steward",
      "data quality framework",
      "gdpr data mapping",
      "data lineage",
      "data catalogue",
      "information governance",
      "data classification",
      "master data",
      "collibra",
    ],
    adjacent: {
      data_engineering: {
        weight: 0.6,
        reason:
          "Lineage, retention and access rules are enforced inside the pipelines data engineers run.",
      },
      analytics_engineering: {
        weight: 0.55,
        reason:
          "Governance rules only bite once they are encoded as tests in the transformation layer.",
      },
      database_administration: {
        weight: 0.5,
        reason:
          "Masking, grants and purge jobs are executed by whoever holds the production database.",
      },
      enterprise_architecture: {
        weight: 0.55,
        reason:
          "Deciding which system owns a record is an architecture call the governance forum ratifies.",
      },
    },
  },
  data_protection_privacy: {
    label: "Data Protection And Privacy",
    aliases: [
      "data protection officer",
      "gdpr compliance",
      "ccpa compliance",
      "privacy counsel",
      "privacy impact assessment",
      "dpia",
      "subject access request",
      "cross-border data transfer",
      "data breach notification",
      "privacy programme management",
      "ropa",
      "data protection and privacy",
    ],
    adjacent: {
      regulatory_compliance: {
        weight: 0.7,
        reason:
          "Privacy is run as a compliance programme: policy, records, training, monitoring, audit and regulator engagement.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "Retention, deletion and lineage duties can only be met by someone able to read and change the pipelines that hold the records.",
      },
      in_house_counsel: {
        weight: 0.6,
        reason:
          "Privacy advice is normally given from inside the legal team, on the same contracts and product reviews.",
      },
      software_engineering: {
        weight: 0.55,
        reason:
          "Consent capture, access requests and minimisation become product features that have to be specified and built.",
      },
      ediscovery: {
        weight: 0.55,
        reason:
          "Collections and cross-border reviews must be justified under transfer rules before any disclosure is made.",
      },
    },
  },
  data_science: {
    label: "Data Science",
    onet: "15-2051.00",
    aliases: [
      "data scientist",
      "statistical modelling",
      "experimentation design",
      "a b testing",
      "causal inference",
      "predictive modelling",
      "scikit learn",
      "propensity model",
      "time series forecasting",
      "applied statistician",
      "data science",
    ],
    adjacent: {
      machine_learning: {
        weight: 0.85,
        reason:
          "The modelling toolkit is shared; data science adds inference and experiment design on top.",
      },
      analytics_engineering: {
        weight: 0.65,
        reason:
          "Data scientists write and maintain their own warehouse transformations until an analytics engineer takes them over as modelled, tested tables.",
      },
      research_science: {
        weight: 0.6,
        reason:
          "Both design experiments, control for confounders and defend a result to a sceptical reader.",
      },
      business_intelligence: {
        weight: 0.6,
        reason:
          "Both answer stakeholder questions from the warehouse and must agree on the same definitions.",
      },
    },
  },
  database_administration: {
    label: "Database Administration",
    onet: "15-1242.00",
    aliases: [
      "database administrator",
      "dba",
      "postgresql administration",
      "oracle dba",
      "sql server dba",
      "query tuning",
      "mysql replication",
      "database reliability engineer",
      "index tuning",
      "database backup and recovery",
      "mongodb administration",
      "database administration",
    ],
    adjacent: {
      backend_engineering: {
        weight: 0.6,
        reason:
          "The schema and access patterns a DBA tunes were written by the service team next door.",
      },
      data_engineering: {
        weight: 0.7,
        reason:
          "Partitioning, loading and query tuning are the same skills applied to an analytics warehouse.",
      },
      site_reliability_engineering: {
        weight: 0.6,
        reason:
          "Failover drills, replication lag and restore rehearsals are production reliability work.",
      },
      data_governance: {
        weight: 0.5,
        reason:
          "DBAs implement the retention, masking and grant rules that governance writes down.",
      },
    },
  },
  defence_analysis: {
    label: "Defence And Security Analysis",
    aliases: [
      "defence analyst",
      "defence policy",
      "national security analysis",
      "defence operational analysis",
      "wargaming",
      "capability requirement",
      "defence procurement",
      "geopolitical risk",
      "defence review",
      "defence and security analysis",
    ],
    adjacent: {
      intelligence_analysis: {
        weight: 0.8,
        reason:
          "Both produce assessed judgements on adversary capability and intent for the same customers.",
      },
      aerospace: {
        weight: 0.6,
        reason:
          "Air, space and missile programmes are among the largest defence procurements, so analysts read those capability requirements.",
      },
      systems_engineering: {
        weight: 0.6,
        reason:
          "Capability analysis uses requirements decomposition and trade studies from systems engineering.",
      },
      public_policy_analysis: {
        weight: 0.6,
        reason:
          "A defence review is costed and argued like any other public spending decision.",
      },
    },
  },
  demand_generation: {
    label: "Demand Generation",
    aliases: [
      "demand gen",
      "account based marketing",
      "abm",
      "marketing qualified lead",
      "mql",
      "integrated campaign management",
      "nurture campaign",
      "webinar program",
    ],
    adjacent: {
      marketing_operations: {
        weight: 0.8,
        reason:
          "A demand programme is only as good as the lead routing, scoring and attribution the operations team maintains.",
      },
      performance_marketing: {
        weight: 0.8,
        reason:
          "Paid channels absorb most demand budget, so one person often owns both the pipeline target and the media plan behind it.",
      },
      lifecycle_marketing: {
        weight: 0.75,
        reason:
          "Leads that are not ready to buy are handed to nurture streams, so both teams share one contact database and cadence rules.",
      },
      product_marketing: {
        weight: 0.7,
        reason:
          "Demand campaigns are built on product marketing's messaging and assets, and both are judged on the same pipeline number.",
      },
      revenue_operations: {
        weight: 0.6,
        reason:
          "Both reconcile the funnel from first touch to closed deal and have to agree on stage definitions and source attribution.",
      },
    },
  },
  demand_planning: {
    label: "Demand Planning & S&OP",
    aliases: [
      "demand planner",
      "demand planning",
      "demand manager",
      "forecast analyst",
      "demand forecasting",
      "statistical demand forecasting",
      "consensus forecasting",
      "integrated business planning",
      "kinaxis",
      "blue yonder",
      "sap ibp",
      "demand planning & s&op",
    ],
    adjacent: {
      supply_chain_planning: {
        weight: 0.85,
        reason:
          "demand and supply plans are reconciled in the same monthly cycle, often by the same small planning team",
      },
      procurement_sourcing: {
        weight: 0.6,
        reason:
          "long lead-time buys are committed off the demand forecast, so buyers and demand planners argue over one number",
      },
      machine_learning: {
        weight: 0.6,
        reason:
          "planning systems now ship machine-learned forecast engines, so planners own model selection, parameter settings and accuracy testing against a naive baseline",
      },
      hospitality_revenue_management: {
        weight: 0.55,
        reason:
          "both forecast sellable units weeks ahead and adjust price and allocation against that forecast",
      },
    },
  },
  dentistry: {
    label: "Dentistry",
    onet: "29-1021.00",
    aliases: [
      "dentist",
      "dental surgeon",
      "bds",
      "dds",
      "dmd",
      "gdc registered",
      "endodontic",
      "orthodontic",
      "periodontal",
      "dental hygienist",
      "oral surgery",
      "restorative dentistry",
      "dental nurse",
      "dentistry",
    ],
    adjacent: {
      surgical_practice: {
        weight: 0.6,
        reason:
          "Oral and maxillofacial work spans both trainings, and dual-qualified surgeons operate on the same anatomy under general anaesthesia.",
      },
      infection_prevention: {
        weight: 0.55,
        reason:
          "Dental practices run their own decontamination and instrument sterilisation regimes to inspected standards.",
      },
      clinical_governance: {
        weight: 0.5,
        reason:
          "Dental practices are separately inspected and audited, so the practice owner carries the governance and revalidation load.",
      },
    },
  },
  design_strategy: {
    label: "Design Strategy",
    aliases: [
      "design strategist",
      "creative strategist",
      "brand strategy",
      "design leadership",
      "head of design practice",
      "innovation consultant",
      "design thinking facilitator",
      "design strategy",
    ],
    adjacent: {
      service_design: {
        weight: 0.7,
        reason:
          "Service designers work at the organisational level and strategists supply the framing and stakeholder case for it.",
      },
      brand_identity: {
        weight: 0.7,
        reason:
          "Positioning and territory work sits directly upstream of the identity a brand designer then makes.",
      },
      art_direction: {
        weight: 0.6,
        reason:
          "Creative directors and strategists sell the same idea to the same client, one on craft and one on evidence.",
      },
      go_to_market: {
        weight: 0.6,
        reason:
          "Both roles turn a customer insight into a launch narrative that sales and marketing can actually execute.",
      },
    },
  },
  design_systems: {
    label: "Design Systems",
    aliases: [
      "design systems designer",
      "design token",
      "design system component library",
      "pattern library",
      "designops",
      "atomic design",
      "figma library",
      "design systems",
    ],
    adjacent: {
      product_design: {
        weight: 0.75,
        reason:
          "System maintainers are almost always senior product designers who noticed the same component being rebuilt five times.",
      },
      front_end_development: {
        weight: 0.8,
        reason:
          "Design tokens ship as code, so the system's owner works in the component repo alongside front-end engineers.",
      },
      accessibility_design: {
        weight: 0.75,
        reason:
          "A design system is where accessible focus states and contrast rules get fixed once for the whole product surface.",
      },
      brand_identity: {
        weight: 0.6,
        reason:
          "The system encodes the brand's type scale, colour and spacing, so it is the operational end of identity work.",
      },
    },
  },
  developer_tooling: {
    label: "Developer Tooling",
    aliases: [
      "developer tooling",
      "build system engineer",
      "bazel",
      "monorepo tooling",
      "developer productivity engineer",
      "sdk maintainer",
      "cli tooling",
      "static analysis tooling",
      "ide plugin",
      "toolchain engineer",
    ],
    adjacent: {
      software_engineering: {
        weight: 0.8,
        reason:
          "Tooling authors write software whose users are engineers, needing deep runtime knowledge.",
      },
      devops: {
        weight: 0.6,
        reason:
          "Build caching and CI runner performance are owned jointly with whoever runs the pipelines.",
      },
      technical_writing: {
        weight: 0.5,
        reason:
          "A tool nobody can adopt is an undocumented one, so its owners write the guides themselves.",
      },
    },
  },
  devops: {
    label: "DevOps Engineering",
    aliases: [
      "devops engineer",
      "ci cd pipeline",
      "continuous integration",
      "continuous delivery",
      "jenkins pipeline",
      "github action",
      "gitops",
      "infrastructure as code",
      "ansible automation",
      "release engineering",
      "helm chart",
      "devops engineering",
    ],
    adjacent: {
      platform_engineering: {
        weight: 0.85,
        reason:
          "The pipelines a DevOps engineer maintains become the paved road a platform team then owns.",
      },
      site_reliability_engineering: {
        weight: 0.8,
        reason:
          "Whoever automates the deploy usually carries the pager for the release it produced.",
      },
      cloud_architecture: {
        weight: 0.7,
        reason:
          "Pipelines deploy into the accounts, networks and identity boundaries an architect lays out.",
      },
      developer_tooling: {
        weight: 0.6,
        reason:
          "Build systems and CI runners are developer tooling maintained by the same hands.",
      },
    },
  },
  diagnostic_radiography: {
    label: "Diagnostic Radiography",
    onet: "29-2034.00",
    aliases: [
      "diagnostic radiographer",
      "radiographer",
      "radiography",
      "radiologic technologist",
      "ct radiographer",
      "mri radiographer",
      "mammographer",
      "reporting radiographer",
      "arrt",
      "fluoroscopy",
      "drop; and rewrite the oncology→diagnostic_radiography reason (or drop that edge) since it depends on therapeutic radiographers sitting in this concept",
      "interventional radiography",
      "diagnostic radiography",
    ],
    adjacent: {
      radiology: {
        weight: 0.85,
        reason:
          "Radiographers acquire the study the radiologist reports, and reporting radiographers issue formal reports themselves.",
      },
      sonography: {
        weight: 0.7,
        reason:
          "Most sonographers qualify first as radiographers and cross-train onto ultrasound as a postgraduate route.",
      },
      oncology: {
        weight: 0.55,
        reason:
          "Therapeutic radiographers plan and deliver the radiotherapy fractions the oncologist prescribes, day after day.",
      },
      health_informatics: {
        weight: 0.5,
        reason:
          "Imaging departments run PACS and modality worklists, so radiographers are the clinical owners informatics teams integrate with.",
      },
    },
  },
  dietetics: {
    label: "Dietetics",
    onet: "29-1031.00",
    aliases: [
      "dietitian",
      "dietetic",
      "registered dietitian",
      "rdn",
      "clinical nutrition",
      "enteral feeding",
      "parenteral nutrition",
      "nutrition support team",
      "renal dietitian",
      "nutritional assessment",
      "paediatric dietetic",
      "hcpc dietitian",
      "dietetics",
    ],
    adjacent: {
      speech_language_therapy: {
        weight: 0.6,
        reason:
          "Feeding and swallowing cases are managed jointly, with therapy setting the texture and dietetics setting the intake.",
      },
      general_practice: {
        weight: 0.5,
        reason:
          "Dietitians run the weight and diabetes clinics that primary care refers into, sharing one long-term condition caseload.",
      },
      community_nursing: {
        weight: 0.5,
        reason:
          "Home enteral feeding is supervised jointly by dietitians and district nurses who manage the tube and the site.",
      },
      clinical_practice: {
        weight: 0.7,
        reason:
          "Dietitians prescribe feeds and adjust them against biochemistry, which is clinical decision making with real risk attached.",
      },
    },
  },
  distribution_networks: {
    label: "Distribution Network Engineering",
    aliases: [
      "distribution network",
      "electricity distribution",
      "lv network design",
      "11kv network",
      "dno connection",
      "network reinforcement",
      "fault level assessment",
      "feeder automation",
      "cable jointer",
      "distribution network engineering",
    ],
    adjacent: {
      power_systems: {
        weight: 0.75,
        reason:
          "Feeder planning uses the same load flow, fault level and protection grading methods as transmission study work.",
      },
      substation_engineering: {
        weight: 0.65,
        reason:
          "Primary and secondary substations are the network's main assets, designed and refurbished by the same teams.",
      },
      solar_pv: {
        weight: 0.6,
        reason:
          "Small-scale generation connects at LV and 11kV, so connection assessment is distribution planning work.",
      },
      energy_efficiency: {
        weight: 0.5,
        reason:
          "Heat pump uptake and demand-side response change feeder loading, so planners model efficiency programmes directly.",
      },
    },
  },
  dmpk: {
    label: "Drug Metabolism And Pharmacokinetics",
    aliases: [
      "dmpk",
      "drug metabolism",
      "preclinical pharmacokinetic",
      "adme",
      "microsomal stability",
      "cyp inhibition",
      "in vivo pk study",
      "hepatocyte clearance",
      "drug transporter",
      "permeability assay",
      "metabolite identification",
      "drug metabolism and pharmacokinetics",
    ],
    adjacent: {
      clinical_pharmacology: {
        weight: 0.85,
        reason:
          "The ADME package is handed straight to the clinical pharmacologist to project human exposure and dose.",
      },
      medicinal_chemistry: {
        weight: 0.8,
        reason:
          "Chemists redesign a series around the metabolic soft spots and clearance liabilities DMPK reports back.",
      },
      toxicology: {
        weight: 0.8,
        reason:
          "Safety margins are stated as exposure multiples, computed from PK sampling in the same animal study.",
      },
      bioanalysis: {
        weight: 0.75,
        reason:
          "DMPK depends entirely on the LC-MS assays the bioanalytical group develops and qualifies for each matrix.",
      },
    },
  },
  downstream_processing: {
    label: "Downstream Processing",
    aliases: [
      "downstream bioprocessing",
      "protein purification",
      "chromatography process development",
      "tangential flow filtration",
      "viral clearance study",
      "affinity capture step",
      "buffer exchange",
      "resin screening",
      "purification process scale up",
      "ultrafiltration diafiltration",
      "downstream processing",
    ],
    adjacent: {
      bioprocess_development: {
        weight: 0.85,
        reason:
          "The same development group split at harvest, where purification yield is judged against upstream titre.",
      },
      analytical_chemistry: {
        weight: 0.7,
        reason:
          "Purity, aggregate and host cell protein assays decide whether a purification step is actually working.",
      },
      formulation_development: {
        weight: 0.7,
        reason:
          "The final concentration step delivers protein into the formulation buffer, so both teams specify it together.",
      },
      validation_qualification: {
        weight: 0.7,
        reason:
          "Viral clearance and resin lifetime studies are validation exercises written for a regulatory audience.",
      },
    },
  },
  drilling_engineering: {
    label: "Drilling Engineering",
    aliases: [
      "drilling engineer",
      "well engineer",
      "directional driller",
      "drilling fluid",
      "casing design",
      "well control",
      "iwcf",
      "managed pressure drilling",
      "wellbore stability",
      "drilling supervisor",
      "drilling engineering",
    ],
    adjacent: {
      petroleum_engineering: {
        weight: 0.8,
        reason:
          "Well programmes are written against the reservoir target, so both disciplines plan the same well together.",
      },
      process_safety: {
        weight: 0.65,
        reason:
          "Well control, barrier philosophy and blowout prevention are the sector's central major hazard discipline.",
      },
      geology: {
        weight: 0.65,
        reason:
          "Casing points and mud weight windows come from pore pressure and formation strength prediction.",
      },
      subsea_engineering: {
        weight: 0.6,
        reason:
          "Offshore wells are drilled through subsea wellheads and marine risers handled by subsea engineers.",
      },
    },
  },
  ecommerce_trading: {
    label: "E-Commerce Trading",
    aliases: [
      "ecommerce trading",
      "e commerce trading",
      "online trading manager",
      "site merchandising",
      "marketplace management",
      "amazon seller central",
      "shopify store management",
      "product listing optimisation",
      "online range management",
      "e-commerce trading",
    ],
    adjacent: {
      merchandising: {
        weight: 0.8,
        reason:
          "Ranging, allocation and markdown decisions are the same craft applied to a category page instead of a shop floor.",
      },
      category_management: {
        weight: 0.7,
        reason:
          "Online trading executes the buyer's range and margin plan and feeds back which lines actually sell.",
      },
      performance_marketing: {
        weight: 0.7,
        reason:
          "Online sales targets are hit by buying traffic against margin, so trading and paid media plans are set in one weekly meeting.",
      },
      search_engine_optimization: {
        weight: 0.6,
        reason:
          "Category structure, listing copy and page speed determine both what ranks and what converts on the same pages.",
      },
      pricing_strategy: {
        weight: 0.6,
        reason:
          "Online price and promotion are changed weekly against competitor pricing and a margin target.",
      },
    },
  },
  ediscovery: {
    label: "E-Discovery And Litigation Support",
    aliases: [
      "e-discovery",
      "ediscovery",
      "litigation support",
      "litigation document review",
      "technology assisted review",
      "predictive coding",
      "relativity administrator",
      "legal hold",
      "forensic collection",
      "managed review",
      "disclosure exercise",
      "edrm",
      "e-discovery and litigation support",
    ],
    adjacent: {
      litigation: {
        weight: 0.75,
        reason:
          "The review exists to serve disclosure in a live case, so scope, privilege and relevance calls come from the case team.",
      },
      corporate_investigations: {
        weight: 0.7,
        reason:
          "Investigations open with the same preservation, collection and keyword review over custodian data.",
      },
      data_protection_privacy: {
        weight: 0.6,
        reason:
          "Cross-border collections and privilege screening must satisfy transfer and minimisation rules before review can start.",
      },
      paralegal_practice: {
        weight: 0.55,
        reason:
          "Review teams are largely paralegals coding documents against an agreed protocol and escalating exceptions.",
      },
      data_engineering: {
        weight: 0.5,
        reason:
          "De-duplicating, indexing and loading terabytes of custodian data is a pipeline problem solved with the same tooling instincts.",
      },
    },
  },
  editorial_publishing: {
    label: "Editorial And Publishing",
    onet: "27-3041.00",
    aliases: [
      "commissioning editor",
      "copy editor",
      "sub editor",
      "proofreader",
      "managing editor",
      "editorial director",
      "book publishing",
      "content editor",
      "fact checker",
      "editorial and publishing",
    ],
    adjacent: {
      copywriting: {
        weight: 0.7,
        reason:
          "Editing and writing are the same structural craft seen from opposite sides of the manuscript.",
      },
      journalism: {
        weight: 0.8,
        reason:
          "Newsroom editors commission, cut and legal-check reporters' copy, and most were reporters first.",
      },
      typography: {
        weight: 0.6,
        reason:
          "Editors mark up house style, hyphenation and page furniture, working directly with the typographic setting.",
      },
      translation_and_interpreting: {
        weight: 0.55,
        reason:
          "Publishers commission and edit translated editions, so editors work closely with translators on register and rights.",
      },
    },
  },
  education_inspection: {
    label: "Education Inspection",
    aliases: [
      "ofsted inspector",
      "school inspector",
      "education inspection framework",
      "further education inspection",
      "estyn inspector",
      "education scotland inspector",
      "independent school inspectorate",
      "school improvement partner",
      "education inspection",
    ],
    adjacent: {
      school_leadership: {
        weight: 0.8,
        reason:
          "Inspectors are recruited from serving headteachers and usually return to school leadership.",
      },
      curriculum_design: {
        weight: 0.7,
        reason:
          "An inspection judgement rests on curriculum intent, sequencing and how learning is assessed.",
      },
      safeguarding_practice: {
        weight: 0.7,
        reason:
          "An inspection can be halted on safeguarding grounds, so inspectors audit those records first.",
      },
      local_government_administration: {
        weight: 0.5,
        reason:
          "Inspection of children's services is conducted against the local authority, not a single school.",
      },
    },
  },
  electrical_installation: {
    label: "Electrical Installation",
    onet: "47-2111.00",
    aliases: [
      "electrician",
      "industrial electrician",
      "maintenance electrician",
      "electrical installation",
      "18th edition wiring regulation",
      "bs 7671",
      "control panel wiring",
      "cable termination",
      "electrical inspection and testing",
      "panel builder",
      "journeyman electrician",
    ],
    adjacent: {
      instrumentation_technician: {
        weight: 0.7,
        reason:
          "Instrument wiring and hazardous area work is done to the same codes and testing regime as power installation.",
      },
      industrial_automation: {
        weight: 0.65,
        reason:
          "Panel building and drive wiring are where the automation design meets the installed plant.",
      },
      industrial_maintenance: {
        weight: 0.65,
        reason:
          "Machine breakdowns are isolated, tested and repaired by dual skilled plant electricians.",
      },
      hvac_service: {
        weight: 0.55,
        reason:
          "Plant, controls and interlocks on a ventilation or chiller install are electrical work.",
      },
      plumbing_heating: {
        weight: 0.5,
        reason:
          "Heating controls, pumps, immersion circuits and boiler interlocks all need wiring and testing, so the two trades first fix and second fix the same dwelling and each sign their own compliance certificate at handover.",
      },
    },
  },
  electronics_repair: {
    label: "Audio Electronics Repair",
    aliases: [
      "audio technician",
      "studio maintenance engineer",
      "broadcast maintenance",
      "amplifier repair",
      "av technician",
      "instrument repair technician",
      "audio electronics repair",
    ],
    adjacent: {
      audio_engineering: {
        weight: 0.6,
        reason:
          "Studio and live engineers rely on maintenance techs, and many engineers do their own repairs on the road.",
      },
      hardware_engineering: {
        weight: 0.6,
        reason:
          "Fault-finding at component level uses the same schematic reading and bench instruments as hardware development.",
      },
      embedded_systems: {
        weight: 0.5,
        reason:
          "Modern audio hardware is firmware-driven, so repair work runs into flashing, debugging and serial consoles.",
      },
    },
  },
  emergency_medicine: {
    label: "Emergency Medicine",
    onet: "29-1214.00",
    aliases: [
      "emergency physician",
      "drop (and drop 'accident and emergency')",
      "accident and emergency",
      "frcem",
      "major trauma call",
      "emergency triage",
      "urgent care clinic",
      "abem",
    ],
    adjacent: {
      paramedicine: {
        weight: 0.85,
        reason:
          "Prehospital crews and emergency clinicians run one handover-to-resus pathway and train on the same trauma protocols.",
      },
      critical_care_nursing: {
        weight: 0.7,
        reason:
          "Resus room care is intensive care in miniature: lines, ventilation and vasoactive drugs before the unit takes over.",
      },
      anaesthesia: {
        weight: 0.6,
        reason:
          "Both hold advanced airway competence and share responsibility for rapid sequence induction in the resus room.",
      },
      general_practice: {
        weight: 0.55,
        reason:
          "Urgent care and out-of-hours streams are staffed from both directions, seeing the same undifferentiated same-day presentations.",
      },
      patient_safety: {
        weight: 0.5,
        reason:
          "Crowding, handover and missed diagnosis in emergency care are the classic subjects of hospital safety investigation.",
      },
    },
  },
  emergency_planning: {
    label: "Emergency Planning And Resilience",
    onet: "11-9161.00",
    aliases: [
      "emergency planning officer",
      "resilience officer",
      "civil contingency",
      "eprr",
      "major incident planning",
      "gold command",
      "silver command",
      "local resilience forum",
      "tabletop exercise",
      "emergency planning and resilience",
    ],
    adjacent: {
      fire_and_rescue: {
        weight: 0.7,
        reason:
          "Both plan against the same major-incident scenarios and use the same command structure.",
      },
      local_government_administration: {
        weight: 0.7,
        reason:
          "Emergency planning teams sit in councils, which carry the statutory responder duty.",
      },
      policing_practice: {
        weight: 0.6,
        reason:
          "Multi-agency command at a major incident is trained and exercised with police commanders.",
      },
      defence_analysis: {
        weight: 0.5,
        reason:
          "Resilience planning borrows threat assessment and scenario method from security analysis.",
      },
    },
  },
  employment_law: {
    label: "Employment Law",
    onet: "23-1011.00",
    aliases: [
      "employment lawyer",
      "employment attorney",
      "employment tribunal",
      "unfair dismissal",
      "wrongful termination claim",
      "restrictive covenant",
      "tupe transfer",
      "wage and hour claim",
      "labor and employment",
      "eeoc charge",
      "redundancy consultation",
      "employment law",
    ],
    adjacent: {
      people_operations: {
        weight: 0.75,
        reason:
          "HR partners escalate grievance, dismissal and restructuring questions to employment counsel and turn the advice into policy.",
      },
      litigation: {
        weight: 0.7,
        reason:
          "Tribunal and court claims run on the same pleading, disclosure and witness-preparation discipline as commercial disputes.",
      },
      corporate_investigations: {
        weight: 0.6,
        reason:
          "Workplace grievance and misconduct investigations are held to the same interview and evidence standards as fraud work.",
      },
      immigration_law: {
        weight: 0.55,
        reason:
          "Work authorisation and sponsor duties sit inside the employment relationship, so one adviser is usually asked both questions.",
      },
      in_house_counsel: {
        weight: 0.55,
        reason:
          "Employment advice is a standing in-house workload and is often the first specialist hire a legal team makes.",
      },
    },
  },
  energy_efficiency: {
    label: "Energy Efficiency And Retrofit",
    aliases: [
      "energy efficiency retrofit",
      "energy audit",
      "retrofit coordinator",
      "building energy modelling",
      "energy performance certificate",
      "heat pump design",
      "demand side response",
      "iso 50001",
      "energy manager",
      "pas 2035",
      "energy efficiency and retrofit",
    ],
    adjacent: {
      carbon_accounting: {
        weight: 0.65,
        reason:
          "Metered site energy savings are the primary evidence behind a claimed scope 1 and 2 reduction.",
      },
      thermal_engineering: {
        weight: 0.6,
        reason:
          "Heat pump sizing, insulation specification and heat loss calculation are applied heat transfer.",
      },
      commissioning_management: {
        weight: 0.55,
        reason:
          "A retrofit only delivers the modelled saving if the plant is balanced and properly commissioned afterwards.",
      },
      distribution_networks: {
        weight: 0.5,
        reason:
          "Efficiency and flexibility programmes are procured by network operators to defer feeder reinforcement.",
      },
    },
  },
  energy_trading: {
    label: "Energy Trading",
    aliases: [
      "energy trader",
      "power trading",
      "gas trading",
      "day ahead market",
      "intraday power trading",
      "power purchase agreement",
      "energy risk management",
      "etrm system",
      "balancing mechanism",
      "wholesale power market",
      "energy trading",
    ],
    adjacent: {
      corporate_finance: {
        weight: 0.65,
        reason:
          "Hedging a generation portfolio uses the same derivative pricing, credit and treasury discipline as any trading book.",
      },
      power_systems: {
        weight: 0.6,
        reason:
          "Congestion, constraint payments and balancing prices are set by physical network limits an engineer can explain.",
      },
      carbon_accounting: {
        weight: 0.5,
        reason:
          "Allowance and certificate positions sit on the same desk and must reconcile with reported emissions.",
      },
      climate_risk: {
        weight: 0.5,
        reason:
          "Forward power and gas curves move on weather and transition policy, which is exactly what climate risk teams model.",
      },
    },
  },
  enterprise_architecture: {
    label: "Enterprise Architecture",
    aliases: [
      "enterprise architect",
      "togaf",
      "business capability model",
      "application portfolio rationalisation",
      "archimate",
      "domain architect",
      "architecture review board",
      "enterprise architecture",
    ],
    adjacent: {
      solution_architecture: {
        weight: 0.8,
        reason:
          "Enterprise architects set the standards that every solution design is then reviewed against.",
      },
      erp_implementation: {
        weight: 0.6,
        reason:
          "Core-system replacement is the largest programme an enterprise architect ever shapes.",
      },
      data_governance: {
        weight: 0.55,
        reason:
          "Domain ownership and shared record definitions are architecture decisions before they are policy.",
      },
    },
  },
  enterprise_risk_management: {
    label: "Enterprise Risk Management",
    aliases: [
      "enterprise risk management",
      "enterprise risk register",
      "risk appetite statement",
      "operational risk framework",
      "risk and control self assessment",
      "rcsa",
      "coso framework",
      "iso 31000",
      "business continuity planning",
      "chief risk officer",
      "risk governance framework",
      "key risk indicator",
    ],
    adjacent: {
      internal_audit: {
        weight: 0.75,
        reason:
          "The audit plan is derived from the risk register, and audit findings re-score the residual exposure.",
      },
      regulatory_compliance: {
        weight: 0.7,
        reason:
          "Compliance exposure is one of the registers, scored and reported through the same governance forum.",
      },
      third_party_risk_management: {
        weight: 0.7,
        reason:
          "Supplier and outsourcing exposure is a category in the enterprise framework, assessed with the same scoring method.",
      },
      corporate_governance: {
        weight: 0.65,
        reason:
          "The appetite statement and register are approved and reviewed by the board through committee papers.",
      },
      financial_services_regulation: {
        weight: 0.6,
        reason:
          "Regulated firms must evidence the whole framework to their supervisor as a condition of the licence.",
      },
    },
  },
  environmental_consulting: {
    label: "Environmental Consultancy",
    onet: "19-2041.00",
    aliases: [
      "environmental consultant",
      "environmental scientist",
      "environmental permitting",
      "iema",
      "cieem",
      "ecological survey",
      "environmental due diligence",
      "environmental compliance audit",
      "environmental management system",
      "environmental adviser",
      "environmental consultancy",
    ],
    adjacent: {
      impact_assessment: {
        weight: 0.8,
        reason:
          "Impact assessment is the single largest workstream inside most environmental consultancies.",
      },
      contaminated_land: {
        weight: 0.7,
        reason:
          "Site investigation and remediation design sit in the same team under the same reporting standards.",
      },
      carbon_accounting: {
        weight: 0.6,
        reason:
          "Footprint and disclosure work is now sold by the same consultancies with the same audit habits.",
      },
      hydrogeology: {
        weight: 0.6,
        reason:
          "Groundwater risk assessment underpins permitting opinions and land condition advice.",
      },
      waste_management: {
        weight: 0.55,
        reason:
          "Waste permitting, duty of care audit and material classification are standard consultancy instructions.",
      },
    },
  },
  environmental_law: {
    label: "Environmental And Planning Law",
    onet: "23-1011.00",
    aliases: [
      "environmental lawyer",
      "environmental counsel",
      "planning lawyer",
      "contaminated land liability",
      "planning permission appeal",
      "reach regulation",
      "waste regulation",
      "emissions trading scheme",
      "environmental and planning law",
    ],
    adjacent: {
      regulatory_compliance: {
        weight: 0.7,
        reason:
          "Permits, monitoring and reporting duties are run as a compliance programme with inspections, findings and remediation.",
      },
      real_estate_law: {
        weight: 0.6,
        reason:
          "Contamination liability and planning conditions attach to the site, so property deals carry the environmental analysis.",
      },
      construction_law: {
        weight: 0.55,
        reason:
          "Consents, conditions and site obligations shape the building contract and its programme dates.",
      },
      corporate_ma_law: {
        weight: 0.5,
        reason:
          "Environmental diligence, indemnities and permit transfers decide how an industrial acquisition is documented.",
      },
    },
  },
  equity_research: {
    label: "Equity Research",
    onet: "13-2051.00",
    aliases: [
      "equity research",
      "equity research analyst",
      "equity analyst",
      "sell side analyst",
      "initiating coverage",
      "earnings estimate",
      "stock pitch",
      "research note publication",
      "equity strategist",
      "sector coverage note",
    ],
    adjacent: {
      portfolio_management: {
        weight: 0.75,
        reason:
          "Fund managers buy or reject the analyst's thesis and estimates, and strong sell side analysts routinely move to the buy side.",
      },
      valuation_advisory: {
        weight: 0.65,
        reason:
          "A published price target is a valuation, built with the same multiples and discounted cash flow methods as a formal valuation opinion.",
      },
      investment_banking: {
        weight: 0.6,
        reason:
          "Both cover the same sectors with detailed operating models, and people move between research and coverage banking.",
      },
      credit_research: {
        weight: 0.6,
        reason:
          "Equity and credit analysts model the same issuer from opposite ends of the capital structure off one forecast.",
      },
    },
  },
  erp_implementation: {
    label: "ERP Implementation",
    aliases: [
      "erp implementation",
      "sap consultant",
      "sap s 4hana",
      "oracle netsuite implementation",
      "dynamics 365 consultant",
      "workday implementation",
      "erp functional consultant",
      "business process configuration",
      "cutover planning",
      "erp rollout",
    ],
    adjacent: {
      integration_engineering: {
        weight: 0.7,
        reason:
          "ERP value depends on interfaces to the systems it does not replace, built by integration hands.",
      },
      solution_architecture: {
        weight: 0.6,
        reason:
          "Both hold the end-to-end design across several vendor products at once.",
      },
      operational_finance: {
        weight: 0.6,
        reason:
          "Finance modules encode the chart of accounts and the close calendar, so the two must agree.",
      },
      data_governance: {
        weight: 0.55,
        reason:
          "Master data cleansing is the largest and riskiest workstream in any core-system cutover.",
      },
    },
  },
  event_marketing: {
    label: "Events & Field Marketing",
    onet: "13-1121.00",
    aliases: [
      "event marketing",
      "field marketing",
      "trade show management",
      "conference production",
      "event producer",
      "exhibition management",
      "sponsorship activation",
      "roadshow program",
      "event logistics",
      "delegate acquisition",
      "events & field marketing",
    ],
    adjacent: {
      demand_generation: {
        weight: 0.7,
        reason:
          "Events carry a pipeline target and a cost per opportunity, reported in the same campaign model as every other channel.",
      },
      brand_marketing: {
        weight: 0.55,
        reason:
          "Sponsorship and experiential work is a brand platform staged in a physical room, approved against brand guidelines.",
      },
      community_management: {
        weight: 0.55,
        reason:
          "Meetups and user conferences are where an online community meets in person, usually run by the same programme owner.",
      },
      partnership_management: {
        weight: 0.5,
        reason:
          "Co-hosted events and sponsorships are negotiated contracts with shared cost, branding and lead splits.",
      },
    },
  },
  event_operations: {
    label: "Event Operations",
    onet: "13-1121.00",
    aliases: [
      "event manager",
      "event operation",
      "event coordinator",
      "venue manager",
      "conference producer",
      "exhibition manager",
      "festival operation",
      "banquet operation",
      "crowd management",
      "certified meeting professional",
      "event operations",
    ],
    adjacent: {
      food_beverage_management: {
        weight: 0.7,
        reason:
          "catering volume, bar deployment and service timings are planned with the F&B team for every event",
      },
      hotel_operations: {
        weight: 0.65,
        reason:
          "conference and banqueting revenue is booked against hotel space and staffed by the same operations team",
      },
      facilities_management: {
        weight: 0.6,
        reason:
          "venue power, access, cleaning and reinstatement are estate problems the FM team owns between events",
      },
      transport_fleet_management: {
        weight: 0.5,
        reason:
          "a large event is a logistics problem of load-in windows, vehicle marshalling and timed deliveries",
      },
    },
  },
  exhibition_design: {
    label: "Exhibition Design",
    onet: "27-1027.00",
    aliases: [
      "exhibition designer",
      "museum exhibition design",
      "scenography",
      "set designer",
      "stand design",
      "experiential design",
      "environmental graphic design",
      "wayfinding design",
      "exhibition design",
    ],
    adjacent: {
      interior_design: {
        weight: 0.75,
        reason:
          "Both disciplines plan and detail physical space to a fixed build programme and site constraints.",
      },
      art_direction: {
        weight: 0.65,
        reason:
          "An exhibition needs one visual voice held across graphics, film, light and object, which is art direction in space.",
      },
      visual_design: {
        weight: 0.6,
        reason:
          "Panel graphics, label systems and wayfinding inside an exhibition are typographic and layout work.",
      },
      service_design: {
        weight: 0.5,
        reason:
          "Visitor flow, dwell time and staffing are journey design problems solved with the same blueprint method.",
      },
    },
  },
  external_audit: {
    label: "External Audit",
    onet: "13-2011.00",
    aliases: [
      "external audit",
      "statutory audit",
      "financial statement audit",
      "audit senior",
      "external audit manager",
      "audit partner",
      "group audit",
      "assurance associate",
      "certified public accountant",
      "audit fieldwork",
    ],
    adjacent: {
      technical_accounting: {
        weight: 0.85,
        reason:
          "Signing a statutory account set means arguing IFRS and GAAP treatments with the preparer, so auditors carry the same technical reporting knowledge.",
      },
      internal_audit: {
        weight: 0.75,
        reason:
          "Both test controls and sample transactions against a documented framework, and external auditors routinely move in-house into second and third line assurance.",
      },
      transaction_services: {
        weight: 0.7,
        reason:
          "Deal diligence teams are staffed almost entirely from audit, because reading a set of books quickly for quality of earnings is the audit skill applied commercially.",
      },
      fund_accounting: {
        weight: 0.55,
        reason:
          "Auditing investment funds teaches the net asset value and investor allocation mechanics that fund accountants produce day to day.",
      },
    },
  },
  facade_engineering: {
    label: "Facade Engineering",
    aliases: [
      "facade engineer",
      "facade consultant",
      "curtain wall design",
      "curtain walling",
      "cladding design",
      "building envelope design",
      "rainscreen cladding",
      "glazing design",
      "cladding remediation",
      "facade engineering",
    ],
    adjacent: {
      structural_engineering: {
        weight: 0.7,
        reason:
          "Cladding panels, brackets and movement joints are wind and dead load calculations under a structural code.",
      },
      building_physics: {
        weight: 0.7,
        reason:
          "The envelope decides thermal bridging, condensation risk and solar gain, which facade specification controls.",
      },
      fire_engineering: {
        weight: 0.7,
        reason:
          "External wall build-ups and cavity barriers are assessed for spread of flame under the fire strategy.",
      },
      architecture: {
        weight: 0.65,
        reason:
          "The facade specialist turns an architect's elevation into a buildable, weathertight, tested system.",
      },
    },
  },
  facilities_management: {
    label: "Facilities Management",
    onet: "11-3013.00",
    aliases: [
      "facilities manager",
      "facilities management",
      "hard fm",
      "soft fm",
      "iwfm",
      "planned preventative maintenance",
      "building maintenance manager",
      "building estate management",
      "building operation and maintenance",
      "cafm system",
    ],
    adjacent: {
      building_services_engineering: {
        weight: 0.75,
        reason:
          "The plant, controls and metering the FM team runs were sized and specified by services engineers.",
      },
      building_surveying: {
        weight: 0.6,
        reason:
          "Condition surveys and lifecycle replacement plans set the maintenance budget the FM team spends.",
      },
      sustainability_assessment: {
        weight: 0.55,
        reason:
          "In-use energy ratings come from how the building is actually metered, tuned and operated.",
      },
      construction_health_safety: {
        weight: 0.55,
        reason:
          "Statutory testing, permits to work and contractor control continue for the life of the building.",
      },
    },
  },
  family_law: {
    label: "Family Law",
    onet: "23-1011.00",
    aliases: [
      "family lawyer",
      "family solicitor",
      "divorce attorney",
      "matrimonial finance",
      "financial remedy proceeding",
      "child arrangement order",
      "prenuptial agreement",
      "family mediation",
      "ancillary relief",
      "private children law",
      "collaborative law",
      "family law",
    ],
    adjacent: {
      litigation: {
        weight: 0.6,
        reason:
          "Contested proceedings are run as court advocacy with disclosure, witness statements and hearing preparation.",
      },
      arbitration_adr: {
        weight: 0.6,
        reason:
          "Mediation and arbitration now resolve a large share of separation and finance matters, so practitioners hold both skills.",
      },
      paralegal_practice: {
        weight: 0.55,
        reason:
          "Court forms, financial disclosure schedules and hearing bundles are prepared by paralegals under the fee earner.",
      },
      real_estate_law: {
        weight: 0.5,
        reason:
          "A financial settlement usually has to be implemented by transferring or selling the home, so family and property lawyers hand the same file between them.",
      },
    },
  },
  farm_management: {
    label: "Farm Management",
    onet: "11-9013.00",
    aliases: [
      "farm manager",
      "farm management",
      "agricultural manager",
      "arable manager",
      "farm operation",
      "contract farming",
      "farm business",
      "harvest planning",
      "crop rotation",
      "farm assurance",
      "agricultural business",
      "red tractor",
    ],
    adjacent: {
      agronomy: {
        weight: 0.8,
        reason:
          "the farm manager buys and executes agronomy advice and often holds the crop advisory qualification too",
      },
      livestock_husbandry: {
        weight: 0.75,
        reason:
          "mixed farms are run by one manager budgeting the herd and the arable rotation as a single business",
      },
      horticulture: {
        weight: 0.55,
        reason:
          "diversified holdings add soft fruit, protected cropping or nursery blocks under the same management",
      },
      operational_finance: {
        weight: 0.55,
        reason:
          "farm management is gross-margin budgeting per hectare with cashflow, subsidy and capital planning",
      },
      forestry: {
        weight: 0.5,
        reason:
          "farm woodland and shelterbelts are planted, thinned and felled on the same estate management plan",
      },
    },
  },
  fashion_design: {
    label: "Fashion Design",
    onet: "27-1022.00",
    aliases: [
      "fashion designer",
      "apparel design",
      "garment technologist",
      "pattern cutting",
      "tech pack",
      "menswear design",
      "knitwear design",
      "clo3d",
      "fashion design",
    ],
    adjacent: {
      textile_design: {
        weight: 0.8,
        reason:
          "Fashion designers specify and often develop the fabrics and prints their garments are cut from.",
      },
      industrial_design: {
        weight: 0.55,
        reason:
          "Both turn a drawn concept into a manufacturable spec with a factory, a sample cycle and a cost target.",
      },
      art_direction: {
        weight: 0.55,
        reason:
          "Collections are sold through lookbooks and shows, so designers direct styling, casting and set alongside the campaign team.",
      },
      materials_science: {
        weight: 0.5,
        reason:
          "Performance apparel decisions turn on fibre behaviour, coatings and wash durability, which is applied materials work.",
      },
    },
  },
  field_service_engineering: {
    label: "Field Service Engineering",
    aliases: [
      "field service engineer",
      "field service technician",
      "customer service engineer",
      "installation and commissioning engineer",
      "equipment commissioning",
      "capital equipment service",
      "mobile service engineer",
      "aftersales engineer",
      "on site repair",
      "field service engineering",
    ],
    adjacent: {
      industrial_maintenance: {
        weight: 0.7,
        reason:
          "Same fault diagnosis on the same machines, one from the customer side and one from the supplier side.",
      },
      industrial_automation: {
        weight: 0.6,
        reason:
          "Commissioning a machine on site means loading and adjusting its PLC program in front of the customer.",
      },
      hvac_service: {
        weight: 0.6,
        reason:
          "Refrigeration and building plant service is field service work with its own refrigerant certification.",
      },
      calibration_technician: {
        weight: 0.55,
        reason:
          "A service visit usually ends with verifying and calibrating the instrument before signing the report.",
      },
    },
  },
  financial_crime_compliance: {
    label: "Financial Crime Compliance",
    onet: "13-1041.00",
    aliases: [
      "financial crime compliance",
      "anti money laundering",
      "know your customer",
      "kyc",
      "sanctions screening",
      "transaction monitoring",
      "customer due diligence",
      "enhanced due diligence",
      "suspicious activity report",
      "financial crime investigation",
      "mlro",
    ],
    adjacent: {
      internal_audit: {
        weight: 0.65,
        reason:
          "Anti money laundering programmes are audited against a documented control framework both functions read the same way.",
      },
      commercial_lending: {
        weight: 0.6,
        reason:
          "Corporate onboarding, beneficial ownership and sanctions screening are conditions of lending the banker must clear.",
      },
      wealth_management: {
        weight: 0.6,
        reason:
          "Private client onboarding turns on source of wealth evidence and enhanced due diligence files.",
      },
      claims_handling: {
        weight: 0.55,
        reason:
          "Claims fraud and money laundering investigation share evidence handling, referral and reporting practice.",
      },
    },
  },
  financial_risk_management: {
    label: "Financial Risk Management",
    onet: "13-2054.00",
    aliases: [
      "financial risk management",
      "market risk analyst",
      "credit risk modelling",
      "value at risk",
      "regulatory stress testing",
      "basel iii",
      "icaap",
      "counterparty risk",
      "risk model validation",
      "liquidity risk management",
      "frm",
    ],
    adjacent: {
      credit_analysis: {
        weight: 0.75,
        reason:
          "Ratings, exposures and default estimates written by credit analysts are the inputs portfolio risk models consume.",
      },
      quantitative_research: {
        weight: 0.7,
        reason:
          "Pricing libraries, value at risk models and stress scenarios are built with the same stochastic and statistical methods.",
      },
      treasury_management: {
        weight: 0.65,
        reason:
          "Hedging and liquidity limits are set with risk teams and executed by treasury against the same exposures.",
      },
      internal_audit: {
        weight: 0.6,
        reason:
          "Model governance and limit breaches are a standing audit topic, so risk documentation is written to be tested.",
      },
      actuarial_practice: {
        weight: 0.55,
        reason:
          "Insurance capital modelling and bank stress testing both measure tail loss against capital with shared technique.",
      },
    },
  },
  financial_services_regulation: {
    label: "Financial Services Regulation",
    onet: "13-2061.00",
    aliases: [
      "financial services compliance",
      "fca compliance",
      "sec compliance",
      "finra compliance",
      "prudential regulation",
      "conduct risk framework",
      "mifid ii",
      "smcr",
      "consumer duty",
      "regulatory capital reporting",
      "banking compliance",
      "financial services regulation",
    ],
    adjacent: {
      regulatory_compliance: {
        weight: 0.75,
        reason:
          "It is regulatory compliance specialised to a rulebook, with the same monitoring, training and reporting machinery.",
      },
      financial_crime_compliance: {
        weight: 0.7,
        reason:
          "Money-laundering controls are a supervised requirement, so both answer to the same regulator in the same inspection.",
      },
      enterprise_risk_management: {
        weight: 0.65,
        reason:
          "Prudential and conduct exposure feed the firm-wide appetite statement and capital planning.",
      },
      internal_audit: {
        weight: 0.55,
        reason:
          "The third line independently tests the regulatory controls the compliance function operates.",
      },
      financial_leadership: {
        weight: 0.5,
        reason:
          "Capital and reporting obligations shape the balance sheet decisions the finance leadership owns.",
      },
    },
  },
  fire_and_rescue: {
    label: "Fire And Rescue Practice",
    onet: "33-2011.00",
    aliases: [
      "firefighter",
      "fire safety officer",
      "fire safety inspector",
      "watch manager",
      "fire crew manager",
      "fire investigation",
      "fire risk assessment",
      "fire incident commander",
      "hazardous material response",
      "retained firefighter",
      "institution of fire engineers",
      "fire service operation",
      "fire and rescue practice",
    ],
    adjacent: {
      emergency_planning: {
        weight: 0.8,
        reason:
          "Fire services write and exercise the major-incident plans resilience teams coordinate.",
      },
      policing_practice: {
        weight: 0.5,
        reason:
          "Blue-light services share command doctrine and work the same scene at a major incident.",
      },
      functional_safety: {
        weight: 0.5,
        reason:
          "Fire engineering and safety-case work both argue a hazard is controlled to an accepted level.",
      },
      local_government_administration: {
        weight: 0.5,
        reason:
          "Fire authorities are governed and funded through local government structures and budgets.",
      },
    },
  },
  fire_engineering: {
    label: "Fire Engineering",
    aliases: [
      "fire engineer",
      "fire safety engineer",
      "fire safety strategy",
      "fire risk assessor",
      "smoke control design",
      "means of escape design",
      "approved document b",
      "sprinkler system design",
      "passive fire protection",
      "fire compartmentation",
      "fire engineering",
    ],
    adjacent: {
      building_control: {
        weight: 0.7,
        reason:
          "A performance-based fire strategy has to be accepted by building control before it can be built.",
      },
      facade_engineering: {
        weight: 0.7,
        reason:
          "External wall fire performance and cavity barrier design are argued jointly by fire and facade specialists.",
      },
      building_services_engineering: {
        weight: 0.6,
        reason:
          "Smoke ventilation, sprinkler and alarm design is delivered by the services team to the fire strategy.",
      },
      construction_health_safety: {
        weight: 0.55,
        reason:
          "The fire strategy sets the escape routes and compartmentation that the construction phase plan has to maintain while the building is unfinished.",
      },
      architecture: {
        weight: 0.55,
        reason:
          "Escape distance, compartment size and stair count shape the architect's plan from the first sketch.",
      },
    },
  },
  food_beverage_management: {
    label: "Food & Beverage Management",
    onet: "11-9051.00",
    aliases: [
      "food and beverage manager",
      "f&b manager",
      "restaurant manager",
      "restaurant general manager",
      "bar manager",
      "banqueting manager",
      "catering manager",
      "contract catering",
      "beverage director",
      "hotel food and beverage",
      "menu costing",
      "sommelier",
      "food & beverage management",
    ],
    adjacent: {
      culinary_practice: {
        weight: 0.8,
        reason:
          "the F&B manager sets menu, costing and service standard with the head chef before every service period",
      },
      hotel_operations: {
        weight: 0.75,
        reason:
          "outlet performance is a line in the hotel P&L, and F&B leaders are the usual route to a general manager post",
      },
      event_operations: {
        weight: 0.65,
        reason:
          "banqueting and conference catering is delivered by the F&B brigade against the event running order",
      },
      food_science: {
        weight: 0.5,
        reason:
          "outlet managers own the allergen matrix and HACCP records that food safety auditors come to inspect",
      },
    },
  },
  food_science: {
    label: "Food Science & Safety",
    onet: "19-1012.00",
    aliases: [
      "food technologist",
      "food scientist",
      "food science",
      "food safety manager",
      "food microbiology",
      "sensory science",
      "shelf life testing",
      "allergen management",
      "npd technologist",
      "iso 22000",
      "brcgs",
      "haccp",
      "food science & safety",
    ],
    adjacent: {
      culinary_practice: {
        weight: 0.6,
        reason:
          "chef-led recipes are turned into factory specifications and scaled by the same development team",
      },
      research_science: {
        weight: 0.6,
        reason:
          "shelf-life, microbiology and sensory panel work is designed, replicated and analysed as laboratory research",
      },
      agronomy: {
        weight: 0.55,
        reason:
          "raw material specification, residue limits and grower assurance schemes are set jointly with agronomy",
      },
      livestock_husbandry: {
        weight: 0.55,
        reason:
          "meat and milk specifications and on-farm hygiene standards are written and audited by food safety staff",
      },
      food_beverage_management: {
        weight: 0.55,
        reason:
          "outlet HACCP plans and allergen controls are written by technologists and executed by F&B managers",
      },
    },
  },
  forestry: {
    label: "Forestry & Arboriculture",
    onet: "19-1032.00",
    aliases: [
      "forester",
      "forestry",
      "silviculture",
      "arborist",
      "arboriculture",
      "woodland manager",
      "timber harvesting",
      "forest management plan",
      "forest inventory",
      "harvesting supervisor",
      "tree officer",
      "tree survey",
      "forestry & arboriculture",
    ],
    adjacent: {
      horticulture: {
        weight: 0.6,
        reason:
          "nursery stock, planting technique and tree health diagnosis are shared between foresters and arborists",
      },
      farm_management: {
        weight: 0.55,
        reason:
          "woodland blocks are a long-rotation enterprise budgeted inside the same estate accounts",
      },
      agronomy: {
        weight: 0.5,
        reason:
          "site classification, soil survey and nutrition planning are shared method between foresters and agronomists",
      },
    },
  },
  forklift_plant_operation: {
    label: "Forklift & Plant Operation",
    onet: "53-7051.00",
    aliases: [
      "forklift operator",
      "forklift licence",
      "forklift license",
      "counterbalance forklift",
      "reach truck",
      "telehandler operator",
      "overhead crane operator",
      "slinger signaller",
      "cpcs card",
      "rtitb",
      "ipaf",
      "mobile plant operator",
      "forklift & plant operation",
    ],
    adjacent: {
      industrial_safety: {
        weight: 0.65,
        reason:
          "Licensed operation exists because the equipment is hazardous, so the ticket and the safe system of work are one subject.",
      },
      industrial_maintenance: {
        weight: 0.5,
        reason:
          "Daily pre use checks and defect reports from operators are what the plant maintenance team works from.",
      },
      production_management: {
        weight: 0.5,
        reason:
          "Material movement to and from the line is scheduled and staffed by production leadership.",
      },
    },
  },
  formulation_development: {
    label: "Formulation Development",
    aliases: [
      "formulation development",
      "formulation scientist",
      "drug product development",
      "oral solid dosage",
      "lyophilization cycle development",
      "excipient selection",
      "sterile injectable formulation",
      "prefilled syringe development",
      "tablet formulation",
      "dissolution profile",
      "drug delivery formulation",
    ],
    adjacent: {
      process_chemistry: {
        weight: 0.7,
        reason:
          "The formulator inherits the solid form and particle properties the process chemist chose upstream.",
      },
      analytical_chemistry: {
        weight: 0.75,
        reason:
          "Every formulation prototype lives or dies on stability and dissolution data generated by analytical chemists.",
      },
      regulatory_cmc: {
        weight: 0.7,
        reason:
          "Drug product composition and its justification are filed as part of the manufacturing module.",
      },
      validation_qualification: {
        weight: 0.7,
        reason:
          "A formulation only reaches patients once its fill and finish process is validated at commercial scale.",
      },
      downstream_processing: {
        weight: 0.6,
        reason:
          "For a biologic, formulation starts where purification ends, at the final buffer exchange step both teams specify.",
      },
    },
  },
  foundry_casting: {
    label: "Casting & Foundry",
    aliases: [
      "foundry engineer",
      "foundry technician",
      "die casting technician",
      "investment casting",
      "sand casting",
      "metal casting",
      "gravity die casting",
      "casting defect analysis",
      "foundry pattern maker",
      "furnace operator",
      "melt shop technician",
      "casting & foundry",
    ],
    adjacent: {
      materials_science: {
        weight: 0.7,
        reason:
          "Alloy selection, solidification and porosity control are metallurgy applied at the furnace.",
      },
      tool_and_die: {
        weight: 0.6,
        reason:
          "Casting dies and patterns are built, tried out and repaired in the tool room.",
      },
      process_engineering: {
        weight: 0.55,
        reason:
          "Pour temperature, gating and cycle control are process parameters proven the same way as on any line.",
      },
      welding_fabrication: {
        weight: 0.5,
        reason:
          "Fettling and weld repair of castings put both trades on the same component before machining.",
      },
    },
  },
  freight_forwarding: {
    label: "Freight Forwarding & Customs Brokerage",
    aliases: [
      "freight forwarder",
      "freight forwarding",
      "customs brokerage",
      "customs clearance",
      "export coordinator",
      "air freight",
      "ocean freight",
      "bill of lading",
      "incoterm",
      "fiata",
      "freight forwarding & customs brokerage",
    ],
    adjacent: {
      port_operations: {
        weight: 0.7,
        reason:
          "the forwarder's booking, container release and customs clearance status is what the terminal must have clear before a box moves across the quay",
      },
      transport_fleet_management: {
        weight: 0.65,
        reason:
          "the inland haulage leg of a forwarded consignment is booked, priced and tracked by the same operator",
      },
      aviation_operations: {
        weight: 0.6,
        reason:
          "air freight is sold against airline capacity, ULD build-up rules and cut-off times set by airline operations",
      },
      marine_operations: {
        weight: 0.55,
        reason:
          "forwarders deal daily with the vessel operator over cargo readiness, bill of lading release and demurrage on their consignments",
      },
    },
  },
  front_end_development: {
    label: "Front End Development",
    onet: "15-1254.00",
    aliases: [
      "creative developer",
      "css developer",
      "webgl developer",
      "front end development",
    ],
    adjacent: {
      design_systems: {
        weight: 0.8,
        reason:
          "Front-end engineers build and version the component library that the design system documents.",
      },
      software_engineering: {
        weight: 0.85,
        reason:
          "Front-end work is a specialism inside software engineering with shared version control, testing and review practice.",
      },
      interaction_design: {
        weight: 0.65,
        reason:
          "Implementing animation, gesture and state behaviour makes front-end developers fluent in interaction craft.",
      },
      accessibility_design: {
        weight: 0.7,
        reason:
          "Semantic markup, focus management and ARIA are implemented in front-end code, not in the design file.",
      },
    },
  },
  frontend_engineering: {
    label: "Frontend Engineering",
    onet: "15-1254.00",
    aliases: [
      "front end developer",
      "frontend engineer",
      "react developer",
      "typescript developer",
      "javascript developer",
      "ui engineer",
      "web developer",
      "vue developer",
      "css architecture",
      "react component library",
      "next.js developer",
      "web performance optimisation",
      "frontend engineering",
    ],
    adjacent: {
      accessibility_engineering: {
        weight: 0.8,
        reason:
          "Frontend work is where WCAG conformance is actually implemented, in markup, focus order and ARIA.",
      },
      backend_engineering: {
        weight: 0.7,
        reason:
          "Both sides of a web product share HTTP semantics, API contracts and shared TypeScript types.",
      },
      mobile_engineering: {
        weight: 0.6,
        reason:
          "React Native and web frontend share the JavaScript toolchain, the declarative component model and client-side state handling.",
      },
      software_engineering: {
        weight: 0.9,
        reason:
          "Frontend is a specialisation of general software craft: version control, review, testing, refactoring.",
      },
      quality_engineering: {
        weight: 0.5,
        reason:
          "Browser automation is written against the same components, selectors and async behaviour frontend engineers build, and both hands maintain the suite.",
      },
    },
  },
  fund_accounting: {
    label: "Fund Accounting",
    onet: "13-2011.00",
    aliases: [
      "fund accountant",
      "fund administration",
      "net asset value calculation",
      "nav calculation",
      "capital call processing",
      "distribution waterfall",
      "limited partner reporting",
      "hedge fund accounting",
      "private fund administration",
      "transfer agency",
      "fund financial statement",
      "fund accounting",
    ],
    adjacent: {
      portfolio_management: {
        weight: 0.65,
        reason:
          "Net asset values, valuations and investor reporting are struck directly from the manager's positions and trades.",
      },
      private_equity: {
        weight: 0.65,
        reason:
          "Capital calls, distributions and carried interest allocations are calculated by fund accountants for the fund's investors.",
      },
      technical_accounting: {
        weight: 0.65,
        reason:
          "Fund financial statements are prepared under the same reporting frameworks and go through a statutory audit.",
      },
      external_audit: {
        weight: 0.6,
        reason:
          "Fund audit is a specialism inside audit practices, and fund accountants are commonly former fund auditors.",
      },
    },
  },
  further_education_teaching: {
    label: "Further Education Teaching",
    aliases: [
      "further education lecturer",
      "college lecturer",
      "vocational tutor",
      "apprenticeship assessor",
      "nvq assessor",
      "functional skills tutor",
      "literacy and numeracy tutor",
      "adult education tutor",
      "work based learning assessor",
      "internal quality assurer",
      "iqa",
      "further education teaching",
    ],
    adjacent: {
      classroom_teaching: {
        weight: 0.7,
        reason:
          "Both plan and deliver lessons to a timetable, and FE staff holding QTLS can and do move into school teaching posts.",
      },
      curriculum_design: {
        weight: 0.7,
        reason:
          "College tutors map awarding-body criteria into schemes of work and assessment plans.",
      },
      learning_and_development: {
        weight: 0.7,
        reason:
          "Vocational tutors and corporate trainers both teach adults job skills against occupational standards.",
      },
      higher_education_lecturing: {
        weight: 0.6,
        reason:
          "Colleges deliver HNC and foundation degrees, so staff cross into university-level teaching.",
      },
    },
  },
  game_development: {
    label: "Game Development",
    aliases: [
      "game developer",
      "unity developer",
      "unreal engine",
      "gameplay programmer",
      "level design",
      "godot",
      "game physics programming",
      "multiplayer netcode",
      "c++ gameplay",
      "game development",
    ],
    adjacent: {
      graphics_programming: {
        weight: 0.8,
        reason:
          "Rendering, shaders and a fixed frame budget are the daily constraint inside any engine.",
      },
      software_engineering: {
        weight: 0.75,
        reason:
          "Gameplay code is C++ or C# under hard frame-time limits, with the same engineering discipline.",
      },
      mobile_engineering: {
        weight: 0.55,
        reason:
          "Most commercial titles ship through the two app stores and their build and release rules.",
      },
      computer_vision: {
        weight: 0.5,
        reason:
          "AR titles and camera-driven play rely on tracking pipelines built by vision engineers.",
      },
    },
  },
  games_art: {
    label: "Games Art",
    aliases: [
      "game artist",
      "environment artist",
      "character artist",
      "level art",
      "prop artist",
      "game art director",
      "substance painter",
      "unreal engine artist",
      "real time art",
      "games art",
    ],
    adjacent: {
      three_d_and_cgi: {
        weight: 0.8,
        reason:
          "Game art is 3D modelling, texturing and lighting made to run in real time on a fixed frame budget.",
      },
      technical_artistry: {
        weight: 0.8,
        reason:
          "Game artists work daily with the shader, LOD and performance limits that technical artists own and optimise.",
      },
      illustration: {
        weight: 0.7,
        reason:
          "Every environment and character starts as concept art before anything is modelled.",
      },
      animation: {
        weight: 0.7,
        reason:
          "Art and animation teams share the rig and the engine, so artists must understand how their models deform.",
      },
    },
  },
  general_practice: {
    label: "General Practice",
    onet: "29-1215.00",
    aliases: [
      "general practitioner",
      "drop; 'general practitioner', 'gp surgery', 'gp partner', 'salaried gp' and 'locum gp' already cover the surface forms",
      "mrcgp",
      "primary care physician",
      "gp surgery",
      "gp partner",
      "out of hours clinic",
      "chronic disease review",
      "salaried gp",
      "locum gp",
      "primary care network",
      "abfm",
      "general practice",
    ],
    adjacent: {
      advanced_nurse_practice: {
        weight: 0.75,
        reason:
          "Nurse practitioners hold their own primary care lists and see the same same-day presentations as the doctors.",
      },
      community_nursing: {
        weight: 0.7,
        reason:
          "District and practice nurses run the long-term condition and housebound caseload attached to the same patient list.",
      },
      pharmacy_practice: {
        weight: 0.65,
        reason:
          "Practice pharmacists own repeat prescribing and medication review inside the surgery's own team.",
      },
      psychiatry: {
        weight: 0.5,
        reason:
          "Primary care prescribes most antidepressants and holds the risk, escalating only the complex cases to psychiatry.",
      },
      clinical_practice: {
        weight: 0.85,
        reason:
          "General practice is unsupervised clinical practice across every specialty at first presentation, with the diagnosis undifferentiated.",
      },
    },
  },
  genomics: {
    label: "Genomics",
    onet: "19-1029.03",
    aliases: [
      "genomics",
      "next generation sequencing",
      "ngs library preparation",
      "whole genome sequencing",
      "rna sequencing",
      "single cell rna seq",
      "variant calling",
      "illumina platform",
      "sequencing core",
      "crispr screen",
      "long read sequencing",
    ],
    adjacent: {
      bioinformatics: {
        weight: 0.85,
        reason:
          "Sequencing output is unreadable until it has been aligned, called and annotated computationally.",
      },
      translational_science: {
        weight: 0.75,
        reason:
          "Stratifying patients by molecular subtype is the main route genomics takes into a clinical programme.",
      },
      cell_and_gene_therapy: {
        weight: 0.7,
        reason:
          "Editing efficiency and off-target analysis in a gene therapy are measured by deep sequencing.",
      },
      research_science: {
        weight: 0.65,
        reason:
          "Most sequencing scientists trained in an academic genomics group and are hired on published methods work they still maintain.",
      },
      assay_development: {
        weight: 0.6,
        reason:
          "A sequencing readout still has to be qualified like any other assay before it can drive a decision.",
      },
    },
  },
  geology: {
    label: "Geology",
    onet: "19-2042.00",
    aliases: [
      "geologist",
      "structural geology",
      "sedimentology",
      "stratigraphy",
      "core logging",
      "mine geology",
      "petrology",
      "wellsite geologist",
      "cgeol",
      "geological mapping",
      "geology",
    ],
    adjacent: {
      geophysics: {
        weight: 0.8,
        reason:
          "Both interpret one subsurface volume, one from rock and core, the other from wave and field measurement.",
      },
      hydrogeology: {
        weight: 0.75,
        reason:
          "Hydrogeology is groundwater applied to a geological framework of aquifers and confining layers.",
      },
      petroleum_engineering: {
        weight: 0.65,
        reason:
          "The reservoir model that production forecasts depend on is built by geologists from logs and cores.",
      },
      contaminated_land: {
        weight: 0.6,
        reason:
          "Ground models and soil logging on remediation sites are ordinary field geology under a different standard.",
      },
    },
  },
  geophysics: {
    label: "Geophysics",
    aliases: [
      "geophysicist",
      "seismic interpretation",
      "seismic processing",
      "gravity and magnetic survey",
      "ground penetrating radar",
      "resistivity survey",
      "wireline log interpretation",
      "geophysical survey",
      "microseismic monitoring",
      "geophysics",
    ],
    adjacent: {
      geology: {
        weight: 0.8,
        reason:
          "Seismic sections are only meaningful when tied to stratigraphy and structural interpretation from wells.",
      },
      petroleum_engineering: {
        weight: 0.7,
        reason:
          "Well placement and reserves estimates are argued from seismic volumes the geophysicist processed.",
      },
      offshore_wind: {
        weight: 0.55,
        reason:
          "Seabed characterisation for foundations uses the same marine acquisition and processing workflow.",
      },
      hydrogeology: {
        weight: 0.55,
        reason:
          "Resistivity and seismic refraction survey maps aquifer geometry before any borehole is drilled.",
      },
    },
  },
  geotechnical_engineering: {
    label: "Geotechnical Engineering",
    aliases: [
      "geotechnical engineer",
      "ground engineering",
      "soil mechanics",
      "site investigation",
      "ground investigation",
      "foundation design",
      "slope stability analysis",
      "retaining wall design",
      "engineering geologist",
      "piling design",
      "cone penetration test",
      "geotechnical engineering",
    ],
    adjacent: {
      civil_engineering: {
        weight: 0.8,
        reason:
          "Ground investigation, earthworks and retaining wall design are commissioned and used by the civil design team.",
      },
      structural_engineering: {
        weight: 0.75,
        reason:
          "Bearing capacity and settlement limits set the foundation the structural engineer then details.",
      },
      land_surveying: {
        weight: 0.5,
        reason:
          "Borehole positions, levels and slope profiles are fixed from measured survey control on the same site.",
      },
    },
  },
  gmp_quality_assurance: {
    label: "GMP Quality Assurance",
    aliases: [
      "gmp quality assurance",
      "good manufacturing practice",
      "batch record review",
      "deviation investigation",
      "capa system",
      "qualified person release",
      "pharmaceutical quality system audit",
      "gxp compliance",
      "gmp supplier audit",
      "annual product review",
      "quality agreement",
      "data integrity audit",
    ],
    adjacent: {
      validation_qualification: {
        weight: 0.85,
        reason:
          "Validation protocols and reports are approved by quality, and a failed qualification becomes a deviation to investigate.",
      },
      regulatory_affairs: {
        weight: 0.75,
        reason:
          "An inspection observation is answered to the agency using the investigation and corrective actions quality produced.",
      },
      pharmaceutical_microbiology: {
        weight: 0.7,
        reason:
          "Monitoring excursions and sterility failures are investigated jointly by quality and the microbiology group.",
      },
      laboratory_management: {
        weight: 0.7,
        reason:
          "Analyst qualification, equipment logs and record practices in the QC lab are audited against the same standards.",
      },
      cell_and_gene_therapy: {
        weight: 0.6,
        reason:
          "A product with days of shelf life makes real-time batch disposition a quality problem before a manufacturing one.",
      },
    },
  },
  grant_making: {
    label: "Grant Making",
    aliases: [
      "grant maker",
      "grant making",
      "grant assessor",
      "funding panel",
      "philanthropic funding",
      "foundation funding",
      "grantee reporting",
      "grant round",
      "endowment giving",
      "grant impact measurement",
    ],
    adjacent: {
      charity_fundraising: {
        weight: 0.8,
        reason:
          "Grant makers assess the bids fundraisers write, and staff routinely move between the two.",
      },
      research_funding: {
        weight: 0.7,
        reason:
          "Research funders and charitable trusts run the same peer review, award and monitoring cycle.",
      },
      public_policy_analysis: {
        weight: 0.6,
        reason:
          "Foundations commission and judge policy evidence before deciding what to fund.",
      },
      operational_finance: {
        weight: 0.5,
        reason:
          "Running a grant portfolio is budgeting, payment scheduling and audit of how money was spent.",
      },
    },
  },
  graphics_programming: {
    label: "Graphics Programming",
    aliases: [
      "graphics programmer",
      "rendering engineer",
      "shader programmer",
      "opengl",
      "vulkan",
      "directx",
      "real time rendering",
      "gpu programming",
      "ray tracing",
      "compute shader",
      "webgl",
      "graphics programming",
    ],
    adjacent: {
      game_development: {
        weight: 0.8,
        reason:
          "Engines are where most rendering work happens, and studios hire the two from one pool.",
      },
      computer_vision: {
        weight: 0.65,
        reason:
          "Both work in camera models, projection matrices and GPU kernels over pixel buffers.",
      },
      embedded_systems: {
        weight: 0.5,
        reason:
          "Driver and GPU firmware work sits directly between rendering code and the silicon.",
      },
      software_engineering: {
        weight: 0.7,
        reason:
          "Rendering is performance-obsessed systems programming, profiled instruction by instruction.",
      },
    },
  },
  growth_marketing: {
    label: "Growth Marketing",
    aliases: [
      "growth marketing",
      "growth marketer",
      "growth hacking",
      "user acquisition",
      "product led growth",
      "plg",
      "conversion rate optimisation",
      "conversion rate optimization",
      "growth experimentation",
      "funnel optimisation",
    ],
    adjacent: {
      performance_marketing: {
        weight: 0.8,
        reason:
          "Growth teams buy paid traffic to feed their experiments, so acquisition cost and payback modelling are daily work for both.",
      },
      lifecycle_marketing: {
        weight: 0.7,
        reason:
          "Growth work does not stop at signup: activation and retention loops are built in the same messaging tools lifecycle teams run.",
      },
      product_marketing: {
        weight: 0.65,
        reason:
          "Both shape onboarding and upgrade flows, and share responsibility for how a product explains itself to a new user.",
      },
      data_engineering: {
        weight: 0.55,
        reason:
          "Growth experiments are only trustworthy when event tracking and warehouse models are correct, so growth leads specify and debug that instrumentation.",
      },
      ecommerce_trading: {
        weight: 0.5,
        reason:
          "Both live inside conversion funnels and run structured tests on landing, basket and checkout pages.",
      },
    },
  },
  health_economics: {
    label: "Health Economics And Outcomes Research",
    aliases: [
      "health economics",
      "outcomes research",
      "heor",
      "cost effectiveness model",
      "budget impact model",
      "real world evidence",
      "health technology assessment",
      "patient reported outcome",
      "nice technology appraisal",
      "payer value dossier",
      "markov cohort model",
      "quality adjusted life year",
      "health economics and outcomes research",
    ],
    adjacent: {
      biostatistics: {
        weight: 0.7,
        reason:
          "Both build formal models from trial and observational data and must defend every assumption to a reviewer.",
      },
      medical_affairs: {
        weight: 0.7,
        reason:
          "Value dossiers and evidence generation plans are produced jointly with the medical affairs team.",
      },
      regulatory_affairs: {
        weight: 0.6,
        reason:
          "Approval and reimbursement submissions run in parallel from the same clinical evidence package.",
      },
      clinical_development: {
        weight: 0.6,
        reason:
          "Payer-relevant endpoints must be written into the phase 3 protocol or the evidence simply never exists.",
      },
      data_engineering: {
        weight: 0.55,
        reason:
          "Outcomes work runs on large linked claims and registry datasets that have to be curated before any analysis.",
      },
    },
  },
  health_informatics: {
    label: "Health Informatics",
    aliases: [
      "health informatics",
      "clinical informatics",
      "cmio",
      "epic analyst",
      "cerner analyst",
      "hl7",
      "fhir",
      "ehr implementation",
      "emr implementation",
      "digital health record",
      "nursing informatics",
    ],
    adjacent: {
      clinical_coding: {
        weight: 0.75,
        reason:
          "Coders and informaticians share the same terminology work, since SNOMED and ICD structure what the record can report.",
      },
      data_engineering: {
        weight: 0.65,
        reason:
          "Clinical data warehouses and HL7 or FHIR feeds are ordinary pipeline engineering with clinical semantics layered on.",
      },
      software_engineering: {
        weight: 0.55,
        reason:
          "Record configuration, interface development and integration work are done inside real software delivery teams.",
      },
      radiology: {
        weight: 0.5,
        reason:
          "Imaging was digital first, so PACS and reporting integration is the oldest and deepest informatics territory.",
      },
      patient_safety: {
        weight: 0.5,
        reason:
          "Badly configured order sets and alerts cause harm, so clinical safety cases are signed off by informatics leads.",
      },
    },
  },
  healthcare_compliance: {
    label: "Healthcare Compliance",
    onet: "13-1041.00",
    aliases: [
      "hipaa compliance",
      "hipaa privacy officer",
      "healthcare compliance officer",
      "anti-kickback statute",
      "stark law",
      "false claims act",
      "corporate integrity agreement",
      "medicare billing compliance",
      "coding and billing audit",
      "hitech act",
      "chc certified",
      "chpc",
      "healthcare compliance",
    ],
    adjacent: {
      regulatory_compliance: {
        weight: 0.75,
        reason:
          "The same programme structure — policy, training, monitoring, audit, remediation — applied to healthcare statutes.",
      },
      data_protection_privacy: {
        weight: 0.65,
        reason:
          "Patient record confidentiality is privacy work with a sector-specific statute and breach clock layered on top.",
      },
      internal_audit: {
        weight: 0.6,
        reason:
          "Billing and coding reviews use the same sampling, walkthrough and finding methodology as any internal audit.",
      },
      clinical_practice: {
        weight: 0.55,
        reason:
          "Compliance officers audit the documentation clinicians produce and train them on what a record must show to be billable.",
      },
      healthcare_recruiting: {
        weight: 0.5,
        reason:
          "Both verify licensure, board certification and exclusion listings on the same registries before someone can practise.",
      },
    },
  },
  heritage_conservation: {
    label: "Heritage And Building Conservation",
    aliases: [
      "conservation architect",
      "heritage consultant",
      "historic building conservation",
      "listed building consent",
      "conservation area officer",
      "heritage impact assessment",
      "aabc",
      "scheduled monument consent",
      "lime mortar repair",
      "historic fabric repair",
      "heritage and building conservation",
    ],
    adjacent: {
      architecture: {
        weight: 0.75,
        reason:
          "Accredited architects lead repair and alteration of protected and listed buildings.",
      },
      town_planning: {
        weight: 0.65,
        reason:
          "Listed building and conservation area consent is determined on historic impact evidence.",
      },
      building_surveying: {
        weight: 0.6,
        reason:
          "Fabric condition, damp and timber decay surveys are the basis of any repair specification.",
      },
    },
  },
  high_voltage_transmission: {
    label: "High Voltage Transmission",
    aliases: [
      "high voltage transmission",
      "hvdc",
      "overhead line design",
      "transmission line engineer",
      "insulation coordination",
      "gas insulated switchgear",
      "converter station",
      "extra high voltage cable",
      "live line working",
    ],
    adjacent: {
      substation_engineering: {
        weight: 0.8,
        reason:
          "A transmission circuit terminates in a substation bay, so line and bay design are specified together.",
      },
      power_systems: {
        weight: 0.8,
        reason:
          "Conductor rating, insulation level and converter control are chosen from network stability and fault studies.",
      },
      distribution_networks: {
        weight: 0.6,
        reason:
          "Both plan and build network assets under the same regulated price control and outage booking constraints.",
      },
      offshore_wind: {
        weight: 0.6,
        reason:
          "Offshore export links are currently the largest new HVDC and subsea cable programmes being built.",
      },
    },
  },
  higher_education_lecturing: {
    label: "Higher Education Lecturing",
    aliases: [
      "university lecturer",
      "senior lecturer",
      "associate professor",
      "assistant professor",
      "teaching fellow",
      "fhea",
      "sfhea",
      "module convenor",
      "phd supervision",
      "seminar tutor",
      "course leader",
      "higher education teaching",
      "higher education lecturing",
    ],
    adjacent: {
      research_science: {
        weight: 0.8,
        reason:
          "Academic posts combine teaching with funded investigation, and most lecturers publish their results.",
      },
      research_administration: {
        weight: 0.6,
        reason:
          "Lecturers sit on ethics panels and prepare REF returns, which is the administrative side of the job.",
      },
      curriculum_design: {
        weight: 0.7,
        reason:
          "Validating and revalidating a degree programme is curriculum design at course level.",
      },
      research_funding: {
        weight: 0.7,
        reason:
          "An academic career depends on winning grants, so lecturers write and cost funding bids themselves.",
      },
    },
  },
  highway_engineering: {
    label: "Highway And Transport Infrastructure Engineering",
    onet: "17-2051.01",
    aliases: [
      "highway engineer",
      "highway design",
      "road design",
      "pavement design",
      "junction design",
      "traffic modelling",
      "transport planning engineer",
      "dmrb",
      "active travel scheme design",
      "highway maintenance engineer",
      "highway and transport infrastructure engineering",
    ],
    adjacent: {
      civil_engineering: {
        weight: 0.85,
        reason:
          "Alignment, earthworks and pavement design are chartered civil engineering work on a road scheme.",
      },
      water_engineering: {
        weight: 0.6,
        reason:
          "Carriageway drainage, outfalls and attenuation are designed with the road to the same standard.",
      },
      geotechnical_engineering: {
        weight: 0.6,
        reason:
          "Subgrade strength and embankment stability set the pavement build-up and cutting slopes.",
      },
      town_planning: {
        weight: 0.55,
        reason:
          "Access, junction capacity and transport assessment decide whether a development can be consented.",
      },
    },
  },
  horticulture: {
    label: "Horticulture & Turf Management",
    aliases: [
      "horticulturist",
      "horticulture",
      "plant nursery manager",
      "glasshouse grower",
      "soft fruit grower",
      "protected cropping",
      "plant propagation",
      "amenity horticulture",
      "head gardener",
      "landscape manager",
      "grounds manager",
      "greenkeeper",
      "turf manager",
      "horticulture & turf management",
    ],
    adjacent: {
      agronomy: {
        weight: 0.7,
        reason:
          "soil, nutrition and pest threshold decisions are made on the same evidence as in field crop advisory",
      },
      viticulture: {
        weight: 0.6,
        reason:
          "vine propagation, trellising, canopy work and pruning are perennial horticulture skills",
      },
      forestry: {
        weight: 0.6,
        reason:
          "tree nursery production, planting stock and amenity tree care sit between horticulture and arboriculture",
      },
      farm_management: {
        weight: 0.6,
        reason:
          "growing units are budgeted, labour-planned and marketed like any other production enterprise",
      },
    },
  },
  hospitality_revenue_management: {
    label: "Hospitality Revenue Management",
    aliases: [
      "revenue manager",
      "hotel revenue management",
      "room rate strategy",
      "rate parity",
      "occupancy forecasting",
      "ota distribution",
      "reservation manager",
      "revpar",
      "duetto",
      "hospitality revenue management",
    ],
    adjacent: {
      hotel_operations: {
        weight: 0.75,
        reason:
          "rate and inventory decisions are executed by the front office and reservations team on the same system",
      },
      demand_planning: {
        weight: 0.6,
        reason:
          "both build a statistical forecast of future demand and commit finite capacity and price against it",
      },
      go_to_market: {
        weight: 0.55,
        reason:
          "channel mix, rate fencing and distribution cost decisions are commercial pricing work alongside marketing",
      },
      corporate_finance: {
        weight: 0.5,
        reason:
          "RevPAR and flow-through targets are agreed with finance and defended through the same budget cycle",
      },
    },
  },
  hotel_operations: {
    label: "Hotel Operations",
    onet: "11-9081.00",
    aliases: [
      "hotel manager",
      "hotel operation",
      "rooms division",
      "front office manager",
      "housekeeping manager",
      "guest experience manager",
      "resort manager",
      "hospitality operation",
      "hotel opening",
      "front desk supervisor",
      "night audit",
      "opera pms",
      "hotel operations",
    ],
    adjacent: {
      food_beverage_management: {
        weight: 0.8,
        reason:
          "the hotel general manager carries the restaurant, bar and banqueting P&L, and F&B is one of the two standard routes into that job alongside rooms division",
      },
      hospitality_revenue_management: {
        weight: 0.75,
        reason:
          "rooms division and revenue set rate, occupancy and overbooking together in the weekly commercial meeting",
      },
      facilities_management: {
        weight: 0.6,
        reason:
          "hotel plant, engineering and cleaning contracts are FM work reporting to the operations director",
      },
      event_operations: {
        weight: 0.6,
        reason:
          "conference and banqueting business is event operations run inside the property against the same rooms forecast",
      },
    },
  },
  housing_management: {
    label: "Housing Management",
    aliases: [
      "housing officer",
      "tenancy management",
      "social housing",
      "housing association",
      "neighbourhood housing officer",
      "lettings officer",
      "homelessness prevention",
      "housing options officer",
      "tenancy sustainment",
      "mcih",
      "housing estate management",
      "housing management",
    ],
    adjacent: {
      welfare_benefits_advice: {
        weight: 0.8,
        reason:
          "Rent arrears cases are usually benefit cases, so housing officers advise or refer on entitlement.",
      },
      social_work: {
        weight: 0.6,
        reason:
          "Tenancy breakdown and vulnerable tenants are managed jointly with adult social care.",
      },
      local_government_administration: {
        weight: 0.7,
        reason:
          "Allocation schemes and the homelessness duty are statutory local authority functions.",
      },
      probation_practice: {
        weight: 0.5,
        reason:
          "Housing providers assess and accept referrals from offender managers under shared protocols.",
      },
    },
  },
  hse_management: {
    label: "Health And Safety Management",
    onet: "19-5011.00",
    aliases: [
      "hse manager",
      "health and safety adviser",
      "nebosh",
      "iosh",
      "safety officer",
      "cdm coordinator",
      "iso 45001",
      "safety incident investigation",
      "permit to work",
      "behavioural safety",
      "health and safety management",
    ],
    adjacent: {
      occupational_hygiene: {
        weight: 0.7,
        reason:
          "Hygienists supply the exposure measurement that safety managers act on through controls and health surveillance.",
      },
      process_safety: {
        weight: 0.7,
        reason:
          "On a major hazard site the safety function owns the permit regime the process safety case depends on.",
      },
      environmental_consulting: {
        weight: 0.55,
        reason:
          "Combined roles carry environmental permit and compliance duties alongside occupational safety.",
      },
      radiation_protection: {
        weight: 0.55,
        reason:
          "Radiological controls are administered through the same permit, monitoring and reporting machinery.",
      },
    },
  },
  hvac_service: {
    label: "HVAC Installation & Service",
    onet: "49-9021.00",
    aliases: [
      "hvac",
      "hvac technician",
      "hvac engineer",
      "refrigeration engineer",
      "air conditioning engineer",
      "f gas certification",
      "epa 608",
      "chiller maintenance",
      "air handling unit",
      "heat pump installation",
      "ductwork installation",
      "hvac installation & service",
    ],
    adjacent: {
      plumbing_heating: {
        weight: 0.7,
        reason:
          "Boiler and heat pump plant sits in the heating trade, so wet system design, installation and commissioning are quoted and signed off by the same people on domestic and light commercial jobs.",
      },
      thermal_engineering: {
        weight: 0.6,
        reason:
          "Sizing a system means heat load calculations and refrigeration cycle work, the applied end of thermal engineering.",
      },
      electrical_installation: {
        weight: 0.6,
        reason:
          "Plant controls, isolators and interlocks are wired and tested to electrical standards on every install.",
      },
      industrial_maintenance: {
        weight: 0.6,
        reason:
          "Chillers, compressed air and ventilation are kept running by the plant engineering team.",
      },
      field_service_engineering: {
        weight: 0.55,
        reason:
          "Planned visits, breakdown calls and commissioning are the same mobile service working pattern.",
      },
    },
  },
  hydrogeology: {
    label: "Hydrogeology",
    onet: "19-2043.00",
    aliases: [
      "hydrogeologist",
      "hydrogeology",
      "groundwater modelling",
      "modflow",
      "pumping test",
      "groundwater monitoring",
      "abstraction licence",
      "contaminant transport modelling",
      "wellfield design",
    ],
    adjacent: {
      geology: {
        weight: 0.75,
        reason:
          "Aquifer behaviour is read off the same stratigraphy, structure and lithology a geologist maps.",
      },
      contaminated_land: {
        weight: 0.75,
        reason:
          "Plume delineation and remediation design are the same job seen from the groundwater side.",
      },
      water_engineering: {
        weight: 0.65,
        reason:
          "Public supply schemes need aquifer yield and licence evidence before any treatment works is designed.",
      },
      environmental_consulting: {
        weight: 0.6,
        reason:
          "Groundwater risk assessment is a required section of permitting and due diligence reports.",
      },
    },
  },
  hydropower: {
    label: "Hydropower Engineering",
    aliases: [
      "hydropower",
      "hydroelectric plant",
      "pumped storage",
      "francis turbine",
      "kaplan turbine",
      "penstock design",
      "dam safety",
      "run of river scheme",
      "hydro turbine overhaul",
      "hydropower engineering",
    ],
    adjacent: {
      water_engineering: {
        weight: 0.7,
        reason:
          "Both size flows through hydraulic structures and use the same open channel, surge and spillway analysis.",
      },
      power_systems: {
        weight: 0.7,
        reason:
          "Hydro sets are large synchronous machines providing inertia and frequency response, dispatched by network engineers.",
      },
      mechanical_engineering: {
        weight: 0.6,
        reason:
          "Runner, governor and penstock work is heavy rotating machinery and pressure containment design.",
      },
      geology: {
        weight: 0.55,
        reason:
          "Dam foundations, headrace tunnels and reservoir slopes are assessed from rock mass and ground condition data.",
      },
    },
  },
  identity_access_management: {
    label: "Identity And Access Management",
    aliases: [
      "identity and access management",
      "iam engineer",
      "single sign on",
      "okta administration",
      "saml integration",
      "oauth implementation",
      "active directory administration",
      "privileged access management",
      "role based access control",
      "azure entra",
      "identity governance",
      "keycloak",
    ],
    adjacent: {
      security_engineering: {
        weight: 0.75,
        reason:
          "Who can reach what is the control set every other security decision leans on.",
      },
      cryptography: {
        weight: 0.6,
        reason:
          "Federation runs on signed assertions and certificate lifecycles that must be handled correctly.",
      },
      enterprise_architecture: {
        weight: 0.5,
        reason:
          "Federated identity is decided once for the whole estate, not per application.",
      },
      erp_implementation: {
        weight: 0.5,
        reason:
          "Core-system rollouts stand or fall on role design and segregation-of-duties rules.",
      },
    },
  },
  illustration: {
    label: "Illustration",
    onet: "27-1013.00",
    aliases: [
      "concept artist",
      "character design",
      "editorial illustration",
      "storyboard artist",
      "matte painter",
      "digital painting",
      "childrens book illustration",
      "comic artist",
      "illustration",
    ],
    adjacent: {
      animation: {
        weight: 0.75,
        reason:
          "Character and background art is drawn by illustrators before animators move it, and many people do both jobs.",
      },
      games_art: {
        weight: 0.75,
        reason:
          "Concept art sets the visual target that game art teams model and texture against.",
      },
      art_direction: {
        weight: 0.65,
        reason:
          "Illustrators who prove they can hold a visual world together are the ones handed art direction on a title or campaign.",
      },
      editorial_publishing: {
        weight: 0.6,
        reason:
          "Illustrators are commissioned to a word count, a deadline and a page shape by editors and picture desks.",
      },
    },
  },
  immigration_law: {
    label: "Immigration Practice",
    onet: "23-1011.00",
    aliases: [
      "immigration attorney",
      "immigration solicitor",
      "immigration caseworker",
      "visa petition",
      "work permit application",
      "asylum representation",
      "removal defense",
      "immigration appeal",
      "sponsor licence compliance",
      "oisc accredited",
      "business immigration",
      "global mobility counsel",
      "immigration practice",
    ],
    adjacent: {
      employment_law: {
        weight: 0.6,
        reason:
          "Work authorisation arises inside the employment relationship, so hiring, transfers and sponsor duties are advised together.",
      },
      people_operations: {
        weight: 0.6,
        reason:
          "Mobility programmes are run by HR with immigration counsel, sharing case trackers and start-date planning.",
      },
      paralegal_practice: {
        weight: 0.55,
        reason:
          "Application bundles, evidence checklists and appeal papers are assembled by caseworkers and paralegals.",
      },
      regulatory_compliance: {
        weight: 0.5,
        reason:
          "A sponsor licence carries record-keeping and reporting duties audited exactly like any other regulatory obligation.",
      },
    },
  },
  impact_assessment: {
    label: "Environmental Impact Assessment",
    aliases: [
      "environmental impact assessment",
      "eia report",
      "environmental statement",
      "eia scoping report",
      "strategic environmental assessment",
      "landscape and visual impact assessment",
      "lvia",
      "noise impact assessment",
      "cumulative effect assessment",
      "habitat regulation assessment",
    ],
    adjacent: {
      environmental_consulting: {
        weight: 0.8,
        reason:
          "Assessment chapters are written by the survey and permitting specialists inside the same consultancy.",
      },
      offshore_wind: {
        weight: 0.6,
        reason:
          "Consent for a wind farm is won or lost on the environmental statement and its cumulative effect chapters.",
      },
      climate_risk: {
        weight: 0.55,
        reason:
          "Assessments now require a resilience chapter built from the same downscaled climate projections.",
      },
      water_engineering: {
        weight: 0.5,
        reason:
          "Flood risk and water quality chapters are evidenced with hydraulic and catchment modelling.",
      },
    },
  },
  in_house_counsel: {
    label: "In-House Counsel",
    onet: "23-1011.00",
    aliases: [
      "in-house counsel",
      "general counsel",
      "deputy general counsel",
      "corporate counsel",
      "commercial counsel",
      "chief legal officer",
      "head of legal",
      "group legal counsel",
      "legal business partner",
      "associate general counsel",
      "legal department management",
    ],
    adjacent: {
      contract_management: {
        weight: 0.8,
        reason:
          "Most in-house time goes on negotiating and papering commercial agreements, the same queue contract managers work.",
      },
      corporate_governance: {
        weight: 0.7,
        reason:
          "Board calendar, minutes and entity filings sit in the legal department, often with the general counsel as company secretary.",
      },
      legal_operations: {
        weight: 0.7,
        reason:
          "Budget, panel and matter management sit inside the same department, so legal ops staff work daily against the caseload those lawyers carry.",
      },
      regulatory_compliance: {
        weight: 0.65,
        reason:
          "Compliance frequently reports into the general counsel, and regulatory advice is given from the same desk.",
      },
      corporate_ma_law: {
        weight: 0.6,
        reason:
          "Acquisitions, financings and joint ventures are instructed and supervised in-house by lawyers who once ran them in practice.",
      },
    },
  },
  indirect_tax: {
    label: "Indirect Tax",
    aliases: [
      "indirect tax",
      "vat compliance",
      "vat return",
      "vat advisory",
      "value added tax",
      "sales and use tax",
      "gst compliance",
      "customs duty advisory",
      "excise duty",
      "indirect tax manager",
      "sales tax nexus",
    ],
    adjacent: {
      procurement_finance: {
        weight: 0.6,
        reason:
          "Supplier invoices and purchase to pay data are where value added tax recovery is won or lost, so indirect tax lives in the procurement ledger.",
      },
      technical_accounting: {
        weight: 0.55,
        reason:
          "Indirect tax balances and provisions land in the statutory accounts and must be reconciled and disclosed at close.",
      },
    },
  },
  industrial_automation: {
    label: "Industrial Automation & PLC",
    aliases: [
      "plc programmer",
      "plc programming",
      "scada",
      "hmi",
      "ladder logic",
      "allen bradley",
      "siemens s7",
      "tia portal",
      "rslogix",
      "industrial automation engineer",
      "industrial robot programming",
      "profinet",
      "motion control commissioning",
      "industrial automation & plc",
    ],
    adjacent: {
      instrumentation_technician: {
        weight: 0.75,
        reason:
          "A controller is useless without field instruments, so automation and instrumentation commission a plant together.",
      },
      robotics: {
        weight: 0.75,
        reason:
          "Cell integration means programming the robot and the PLC that sequences it as one machine.",
      },
      controls: {
        weight: 0.7,
        reason:
          "Tuning a PLC loop is applied control theory, using the same PID and stability reasoning.",
      },
      industrial_maintenance: {
        weight: 0.65,
        reason:
          "Automation faults surface first as production downtime handled by the maintenance crew on shift.",
      },
      embedded_systems: {
        weight: 0.55,
        reason:
          "Both write deterministic control code against real hardware, scan times and I/O timing constraints.",
      },
    },
  },
  industrial_design: {
    label: "Industrial Design",
    onet: "27-1021.00",
    aliases: [
      "industrial designer",
      "product form design",
      "consumer product design",
      "cmf design",
      "idsa",
      "hardgood design",
      "furniture design",
      "industrial design",
    ],
    adjacent: {
      mechanical_engineering: {
        weight: 0.8,
        reason:
          "Industrial designers hand surfaces to mechanical engineers and must respect draft, wall thickness and tolerance to be taken seriously.",
      },
      packaging_design: {
        weight: 0.65,
        reason:
          "The pack is often designed alongside the product itself, with the same materials and manufacturing constraints.",
      },
      three_d_and_cgi: {
        weight: 0.6,
        reason:
          "Industrial designers build and render their own CAD surfaces to sell a concept before tooling is committed.",
      },
      hardware_engineering: {
        weight: 0.6,
        reason:
          "Enclosure design forces the industrial designer into board layout, connector placement and thermal decisions with the hardware team.",
      },
      materials_science: {
        weight: 0.6,
        reason:
          "CMF work is a materials decision: finish, polymer choice and durability drive what the form can actually be.",
      },
    },
  },
  industrial_engineering: {
    label: "Industrial Engineering",
    onet: "17-2112.00",
    aliases: [
      "industrial engineer",
      "industrial engineering",
      "time and motion study",
      "time study",
      "work measurement",
      "line balancing",
      "methods engineer",
      "plant layout design",
      "standard time calculation",
      "ergonomic assessment",
      "production throughput analysis",
    ],
    adjacent: {
      lean_manufacturing: {
        weight: 0.8,
        reason:
          "Standard work and value stream analysis are built on the work measurement industrial engineers do.",
      },
      manufacturing_engineering: {
        weight: 0.7,
        reason:
          "One measures the work content of a route, the other changes the method, and both cost the line.",
      },
      production_planning: {
        weight: 0.65,
        reason:
          "Takt, capacity and labour models are the inputs the production schedule is built from.",
      },
      systems_engineering: {
        weight: 0.55,
        reason:
          "University programmes are commonly titled industrial and systems engineering, and both disciplines size constraints and interfaces across a whole operation before changing any one station.",
      },
      industrial_safety: {
        weight: 0.5,
        reason:
          "Workstation ergonomic assessment is done by industrial engineers and acted on by the safety team.",
      },
    },
  },
  industrial_maintenance: {
    label: "Industrial Maintenance",
    onet: "49-9041.00",
    aliases: [
      "maintenance technician",
      "millwright",
      "industrial mechanic",
      "maintenance fitter",
      "mechanical fitter",
      "plant maintenance technician",
      "cmms",
      "preventive maintenance",
      "hydraulic system repair",
      "pneumatic system repair",
      "gearbox overhaul",
      "maintenance engineer",
      "industrial maintenance",
    ],
    adjacent: {
      reliability_engineering: {
        weight: 0.85,
        reason:
          "Technicians execute the planned tasks and capture the failure history the reliability engineer analyses.",
      },
      industrial_automation: {
        weight: 0.65,
        reason:
          "Fault finding on a modern line means reading ladder logic and drive faults, not only mechanical wear.",
      },
      electrical_installation: {
        weight: 0.6,
        reason:
          "Machine faults are as often electrical as mechanical, so plant technicians work to the same isolation, testing and fault finding practice as an industrial electrician, and many sites train them across both tickets.",
      },
      field_service_engineering: {
        weight: 0.6,
        reason:
          "The same diagnostic skill transfers when a technician moves to the equipment maker's mobile service team.",
      },
      hvac_service: {
        weight: 0.5,
        reason:
          "Site services such as chillers, compressed air and ventilation fall to the same plant engineering team.",
      },
    },
  },
  industrial_safety: {
    label: "Industrial Health & Safety",
    onet: "19-5011.00",
    aliases: [
      "ehs manager",
      "hse advisor",
      "health and safety manager",
      "lockout tagout",
      "machine guarding",
      "osha 30",
      "workplace risk assessment",
      "industrial health & safety",
    ],
    adjacent: {
      production_management: {
        weight: 0.65,
        reason:
          "The duty holder for a shift is the person running it, so plant leaders and safety advisors share the same findings.",
      },
      functional_safety: {
        weight: 0.6,
        reason:
          "Guarding, interlocks and stop categories are specified to the machinery safety standards a functional safety engineer works to.",
      },
      industrial_maintenance: {
        weight: 0.6,
        reason:
          "Isolation, permits and confined space entry are written for and carried out by maintenance crews.",
      },
      forklift_plant_operation: {
        weight: 0.6,
        reason:
          "Licensing, refresher training and pedestrian segregation for lift trucks are managed by the safety function.",
      },
      quality_management_systems: {
        weight: 0.5,
        reason:
          "Sites run safety and quality standards through one audit, document control and corrective action process.",
      },
    },
  },
  infection_prevention: {
    label: "Infection Prevention And Control",
    aliases: [
      "infection prevention",
      "infection control",
      "ipc nurse",
      "antimicrobial stewardship",
      "outbreak management",
      "hand hygiene audit",
      "hospital acquired infection",
      "decontamination lead",
      "surgical site infection surveillance",
      "drop; 'ipc nurse', 'antimicrobial stewardship' and 'surgical site infection surveillance' already identify the capability",
      "infection prevention and control",
    ],
    adjacent: {
      registered_nursing: {
        weight: 0.7,
        reason:
          "Infection control teams are staffed almost entirely by senior nurses who audit and coach practice on the wards.",
      },
      clinical_governance: {
        weight: 0.7,
        reason:
          "Infection rates are a reportable assurance measure and outbreaks trigger the same formal investigation process.",
      },
      pharmacy_practice: {
        weight: 0.6,
        reason:
          "Antimicrobial stewardship is run jointly with pharmacy, which controls the restricted antibiotic formulary.",
      },
      perioperative_nursing: {
        weight: 0.55,
        reason:
          "Theatre discipline, instrument decontamination and surgical site surveillance are where control policy is enforced hardest.",
      },
      patient_safety: {
        weight: 0.6,
        reason:
          "A hospital-acquired infection is a preventable harm, investigated with the same tools as any other safety incident.",
      },
    },
  },
  information_retrieval: {
    label: "Search And Information Retrieval",
    aliases: [
      "search engineer",
      "information retrieval",
      "elasticsearch",
      "opensearch",
      "solr",
      "relevance tuning",
      "query understanding",
      "vector search",
      "learning to rank",
      "search relevance engineer",
      "semantic search",
      "faceted search",
      "search and information retrieval",
    ],
    adjacent: {
      machine_learning: {
        weight: 0.7,
        reason:
          "Ranking is a supervised learning problem judged by offline and online relevance metrics.",
      },
      backend_engineering: {
        weight: 0.7,
        reason:
          "A search service is a latency-critical backend with sharding, caching and index build jobs.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "Index building is a batch and streaming pipeline over the same source records.",
      },
    },
  },
  injection_moulding: {
    label: "Injection Moulding",
    onet: "51-4072.00",
    aliases: [
      "injection moulding",
      "injection molding",
      "injection moulding technician",
      "mould setter",
      "mold setter",
      "scientific molding",
      "moldflow",
      "plastics processing",
      "blow moulding",
      "extrusion operator",
      "thermoplastic processing",
    ],
    adjacent: {
      tool_and_die: {
        weight: 0.75,
        reason:
          "A moulding fault is often a tool fault, so setters and mould makers troubleshoot the same tool together.",
      },
      process_engineering: {
        weight: 0.65,
        reason:
          "Scientific moulding is process engineering: a proven window of pressure, temperature and time backed by data.",
      },
      materials_science: {
        weight: 0.6,
        reason:
          "Shrinkage, warp and weld lines are polymer behaviour, so moulders work in applied polymer science.",
      },
      manufacturing_engineering: {
        weight: 0.55,
        reason:
          "Cycle time, part handling and automation around the press are manufacturing engineering decisions.",
      },
      packaging_engineering: {
        weight: 0.5,
        reason:
          "Closures, trays and rigid containers are moulded parts specified by packaging engineers.",
      },
    },
  },
  instructional_design: {
    label: "Instructional Design",
    aliases: [
      "instructional design",
      "instructional designer",
      "learning designer",
      "elearning developer",
      "addie",
      "scorm",
      "articulate storyline",
      "learning experience design",
      "elearning authoring tool",
      "microlearning",
      "lms administration",
      "moodle",
    ],
    adjacent: {
      learning_and_development: {
        weight: 0.8,
        reason:
          "Instructional designers build the courses the L&D team commissions and later evaluates.",
      },
      curriculum_design: {
        weight: 0.8,
        reason:
          "Both work backwards from an outcome to a sequence of activities and a way to assess it.",
      },
      software_engineering: {
        weight: 0.5,
        reason:
          "Custom elearning and LMS integration work runs into HTML, JavaScript and SCORM packaging against a hosting platform.",
      },
      higher_education_lecturing: {
        weight: 0.5,
        reason:
          "Universities pair learning designers with academics to convert modules for online delivery.",
      },
    },
  },
  instrumentation_technician: {
    label: "Instrumentation & Control Technician",
    aliases: [
      "instrumentation technician",
      "instrument technician",
      "electrical and instrumentation technician",
      "process control technician",
      "dcs technician",
      "distributed control system",
      "control valve maintenance",
      "transmitter calibration",
      "hazardous area installation",
      "compex",
      "instrumentation & control technician",
    ],
    adjacent: {
      industrial_automation: {
        weight: 0.75,
        reason:
          "The instrument loop terminates in the PLC or DCS, and both trades commission the plant off the same drawings.",
      },
      calibration_technician: {
        weight: 0.75,
        reason:
          "Loop checks and transmitter calibration are the same instrument work under a different job title.",
      },
      electrical_installation: {
        weight: 0.65,
        reason:
          "Instrument wiring, glanding and hazardous area installation follow electrical codes and inspection practice.",
      },
      process_engineering: {
        weight: 0.55,
        reason:
          "Measuring a process variable well requires understanding the process dynamics behind it.",
      },
    },
  },
  insurance_underwriting: {
    label: "Insurance Underwriting",
    onet: "13-2053.00",
    aliases: [
      "insurance underwriter",
      "insurance underwriting",
      "commercial lines underwriting",
      "personal lines underwriting",
      "specialty lines underwriting",
      "property and casualty underwriting",
      "lloyds syndicate",
      "underwriting authority",
      "binder authority",
      "acii",
      "policy wording",
      "risk selection",
    ],
    adjacent: {
      actuarial_practice: {
        weight: 0.8,
        reason:
          "Underwriters price against an actuarial technical rate and feed back the loss experience reserving actuaries depend on.",
      },
      claims_handling: {
        weight: 0.75,
        reason:
          "Claims outcomes prove or disprove the underwriter's risk selection and wording, so the two review losses together.",
      },
      reinsurance: {
        weight: 0.7,
        reason:
          "Every underwriting portfolio sits behind a reinsurance programme the underwriter helps structure and buy.",
      },
      credit_analysis: {
        weight: 0.5,
        reason:
          "Trade credit and surety underwriting assess a counterparty's ability to pay in exactly the way a credit analyst does.",
      },
    },
  },
  integration_engineering: {
    label: "Integration Engineering",
    aliases: [
      "integration engineer",
      "middleware engineer",
      "api integration",
      "mulesoft",
      "apache kafka integration",
      "event driven architecture",
      "enterprise service bus",
      "ipaas",
      "webhook integration",
      "boomi",
      "integration engineering",
    ],
    adjacent: {
      backend_engineering: {
        weight: 0.7,
        reason:
          "Integration code is backend service code with retries, idempotency and contract tests.",
      },
      erp_implementation: {
        weight: 0.65,
        reason:
          "Every core-system programme needs somebody who can move records to and from the older estate.",
      },
      solution_architecture: {
        weight: 0.7,
        reason:
          "Integration engineers implement the interface decisions a solution design commits to.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "Both move records between systems and own schema drift, ordering and replay.",
      },
    },
  },
  intellectual_property_law: {
    label: "Intellectual Property Law",
    onet: "23-1011.00",
    aliases: [
      "intellectual property lawyer",
      "intellectual property counsel",
      "ip counsel",
      "patent litigation",
      "copyright law",
      "trade secret litigation",
      "ip licensing agreement",
      "ip portfolio management",
      "infringement claim",
      "freedom to operate opinion",
      "intellectual property law",
    ],
    adjacent: {
      patent_prosecution: {
        weight: 0.8,
        reason:
          "Enforcement and portfolio strategy depend on how the claims were drafted, so both sides read the same specification.",
      },
      trademark_brand_protection: {
        weight: 0.8,
        reason:
          "Both protect intangible assets through registries and enforcement actions, and are usually run by one team on one budget.",
      },
      litigation: {
        weight: 0.7,
        reason:
          "Infringement claims are fought in court on expert evidence, so IP disputes work is ordinary litigation with technical subject matter.",
      },
      contract_management: {
        weight: 0.6,
        reason:
          "Licences, assignments and royalty terms are commercial contracts that only work when drafted against the underlying rights.",
      },
    },
  },
  intelligence_analysis: {
    label: "Intelligence Analysis",
    onet: "33-3021.06",
    aliases: [
      "intelligence analyst",
      "all source analysis",
      "osint",
      "sigint",
      "geoint",
      "humint",
      "analytical tradecraft",
      "structured analytic technique",
      "intelligence briefing",
      "link analysis",
      "analyst notebook",
      "counter terrorism analysis",
      "intelligence analysis",
    ],
    adjacent: {
      defence_analysis: {
        weight: 0.8,
        reason:
          "Assessment staff and defence analysts share sources, tradecraft and the same decision makers.",
      },
      policing_practice: {
        weight: 0.7,
        reason:
          "Force intelligence bureaus apply the same tasking, sourcing and grading model to crime.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "0.5 — All-source work means reconciling conflicting datasets and specifying the joins and queries an assessment rests on.",
      },
      border_and_customs: {
        weight: 0.6,
        reason:
          "Targeting cargo and travellers is intelligence work run against risk profiles and watchlists.",
      },
    },
  },
  interaction_design: {
    label: "Interaction Design",
    aliases: [
      "interaction designer",
      "ixd",
      "microinteraction design",
      "interactive prototype",
      "conversational design",
      "hi fi prototype",
      "interaction design",
    ],
    adjacent: {
      user_experience_design: {
        weight: 0.85,
        reason:
          "Interaction design is the screen-behaviour half of the UX craft and the two titles are often interchangeable in job ads.",
      },
      motion_graphics: {
        weight: 0.65,
        reason:
          "Interface transitions and easing curves are motion work, so interaction designers borrow animation timing craft directly.",
      },
      design_systems: {
        weight: 0.7,
        reason:
          "Component states — hover, focus, error, loading — are interaction decisions codified into the system's documentation.",
      },
      front_end_development: {
        weight: 0.65,
        reason:
          "Building a working prototype in code is the fastest way to test a behaviour, so many interaction designers write front-end themselves.",
      },
    },
  },
  interior_design: {
    label: "Interior Design And Fit-Out",
    onet: "27-1025.00",
    aliases: [
      "interior designer",
      "interior architecture",
      "interior fit out",
      "fit out designer",
      "ffe specification",
      "workplace interior design",
      "interior space planning",
      "commercial interior design",
      "residential interior design",
      "furniture and finishes specification",
      "interior design and fit-out",
    ],
    adjacent: {
      architecture: {
        weight: 0.7,
        reason:
          "Interior layouts, partitions and finishes continue the spatial planning the architect started.",
      },
      construction_project_management: {
        weight: 0.55,
        reason:
          "Fit-out contracts run on tight programmes with the same contract and change control mechanics.",
      },
      building_services_engineering: {
        weight: 0.5,
        reason:
          "Lighting, ceiling voids and ventilation terminals must be coordinated with the interior layout.",
      },
      facilities_management: {
        weight: 0.5,
        reason:
          "Workplace layout, occupancy and churn are handled by the same team that runs the building.",
      },
    },
  },
  internal_audit: {
    label: "Internal Audit",
    onet: "13-2011.00",
    aliases: [
      "internal audit",
      "internal auditor",
      "certified internal auditor",
      "sarbanes oxley testing",
      "sox testing",
      "internal control testing",
      "risk based audit plan",
      "audit committee reporting",
      "third line assurance",
      "operational audit",
      "control self assessment",
      "it audit",
    ],
    adjacent: {
      external_audit: {
        weight: 0.75,
        reason:
          "Testing controls, sampling populations and writing findings for an audit committee is the same discipline performed from inside the organisation.",
      },
      financial_risk_management: {
        weight: 0.7,
        reason:
          "Internal audit reviews the risk framework and model governance, so auditors read limits, capital and stress results the way risk teams write them.",
      },
      financial_crime_compliance: {
        weight: 0.65,
        reason:
          "Anti money laundering programmes are one of the most audited control areas, so internal auditors know due diligence and transaction monitoring design.",
      },
      operational_finance: {
        weight: 0.55,
        reason:
          "Process walkthroughs across purchase to pay and record to report give internal auditors a working map of how a finance function actually runs.",
      },
    },
  },
  internal_communications: {
    label: "Internal Communications",
    aliases: [
      "internal communication",
      "employee communication",
      "change communication",
      "executive communication",
      "internal newsletter",
      "town hall program",
      "intranet content",
      "employee engagement campaign",
      "colleague communication",
      "internal communications",
    ],
    adjacent: {
      public_relations: {
        weight: 0.75,
        reason:
          "The staff message and the press message are drafted from one narrative and released within minutes of each other.",
      },
      people_operations: {
        weight: 0.7,
        reason:
          "Restructures, benefits changes and policy rollouts are announced by comms and owned by the people team together.",
      },
      investor_relations: {
        weight: 0.5,
        reason:
          "Staff who hold shares read results announcements too, so internal messaging is drafted to the same disclosure rules.",
      },
      event_marketing: {
        weight: 0.5,
        reason:
          "Town halls and leadership roadshows need the same run-of-show, staging and rehearsal discipline as an external event.",
      },
    },
  },
  investment_banking: {
    label: "Investment Banking",
    aliases: [
      "investment banking",
      "investment banking analyst",
      "investment banking associate",
      "mergers and acquisitions advisory",
      "sell side advisory",
      "equity capital market",
      "debt capital market",
      "ipo execution",
      "pitch book preparation",
      "leveraged finance",
      "coverage banker",
    ],
    adjacent: {
      valuation_advisory: {
        weight: 0.75,
        reason:
          "Pitching and defending a price rests on comparable company, precedent transaction and discounted cash flow work, which is the valuation craft.",
      },
      private_equity: {
        weight: 0.75,
        reason:
          "Buyout funds recruit almost entirely from banking analyst programmes because the modelling and process skills transfer directly.",
      },
      transaction_services: {
        weight: 0.7,
        reason:
          "Sell side and buy side processes run alongside financial due diligence teams sharing one data room and one deal timetable.",
      },
      corporate_finance: {
        weight: 0.7,
        reason:
          "Advising on a raise or a sale uses the same capital structure and cash flow models that in house corporate finance teams maintain.",
      },
      equity_research: {
        weight: 0.55,
        reason:
          "Both build detailed operating models of the same companies, and bankers lean on published research estimates when they pitch.",
      },
    },
  },
  investor_relations: {
    label: "Investor Relations",
    aliases: [
      "investor relation",
      "shareholder communication",
      "earnings call preparation",
      "annual report production",
      "capital markets day",
      "analyst briefing",
      "equity story",
      "financial communication",
      "quarterly result announcement",
    ],
    adjacent: {
      corporate_finance: {
        weight: 0.75,
        reason:
          "Answering an analyst on guidance, cash conversion or segment margin means knowing the reporting model finance builds.",
      },
      public_relations: {
        weight: 0.7,
        reason:
          "Results day is a press event as much as a market one, and both teams rehearse the same lines and questions.",
      },
      financial_leadership: {
        weight: 0.65,
        reason:
          "The finance chief and the investor relations lead prepare one earnings script and field the same questions on the call.",
      },
      internal_communications: {
        weight: 0.5,
        reason:
          "Results and guidance have to be explained to staff without breaching the disclosure rules the market message follows.",
      },
    },
  },
  journalism: {
    label: "Journalism",
    onet: "27-3023.00",
    aliases: [
      "journalist",
      "news reporter",
      "news correspondent",
      "investigative reporter",
      "features writer",
      "staff writer",
      "freelance journalist",
      "news desk",
      "data journalism",
      "nctj",
      "journalism",
    ],
    adjacent: {
      editorial_publishing: {
        weight: 0.8,
        reason:
          "Reporters file to editors and career progression normally runs from the reporting desk into commissioning.",
      },
      photography: {
        weight: 0.6,
        reason:
          "Photojournalists and reporters work the same assignment, and many print journalists now shoot their own stills.",
      },
      videography: {
        weight: 0.6,
        reason:
          "Broadcast and online newsrooms expect reporters to shoot and voice their own packages to deadline.",
      },
    },
  },
  laboratory_management: {
    label: "Laboratory Management",
    aliases: [
      "laboratory manager",
      "lab operations manager",
      "lims implementation",
      "instrument calibration programme",
      "laboratory safety officer",
      "sample logistics",
      "reagent inventory control",
      "core facility manager",
      "laboratory accreditation",
      "iso 17025",
      "laboratory management",
    ],
    adjacent: {
      analytical_chemistry: {
        weight: 0.7,
        reason:
          "Lab managers are usually promoted bench scientists who kept technical ownership of the methods their lab runs.",
      },
      gmp_quality_assurance: {
        weight: 0.7,
        reason:
          "Training records, equipment logs and record practices are precisely what quality inspects when it audits a lab.",
      },
      pharmaceutical_microbiology: {
        weight: 0.6,
        reason:
          "QC chemistry and QC micro labs are usually run by the same operations function under one manager.",
      },
      assay_development: {
        weight: 0.55,
        reason:
          "Automation, plate handling and reagent lot control decide whether a development lab can hold its throughput.",
      },
    },
  },
  land_surveying: {
    label: "Land And Measured Surveying",
    onet: "17-1022.00",
    aliases: [
      "land surveyor",
      "engineering surveyor",
      "geomatics",
      "topographic survey",
      "measured building survey",
      "setting out engineer",
      "total station",
      "gnss survey",
      "laser scanning survey",
      "point cloud survey",
      "boundary survey",
      "utility survey",
      "land and measured surveying",
    ],
    adjacent: {
      civil_engineering: {
        weight: 0.7,
        reason:
          "Topographic survey and control are the base data every infrastructure design is drawn on.",
      },
      site_management: {
        weight: 0.65,
        reason:
          "Setting out grids, levels and as-built checks are a daily site engineering task on any project.",
      },
      bim_coordination: {
        weight: 0.6,
        reason:
          "Laser scan point clouds are registered into the federated model as the existing condition.",
      },
      geotechnical_engineering: {
        weight: 0.5,
        reason:
          "Borehole locations and ground levels are surveyed before any ground model can be built.",
      },
    },
  },
  landscape_architecture: {
    label: "Landscape Architecture",
    onet: "17-1012.00",
    aliases: [
      "landscape architect",
      "landscape designer",
      "cmli",
      "landscape institute",
      "planting design",
      "green infrastructure design",
      "public open space design",
      "hard landscape design",
      "landscape architecture",
    ],
    adjacent: {
      urban_design: {
        weight: 0.7,
        reason:
          "Public realm, streetscape and open space are designed by the same team at masterplan scale.",
      },
      town_planning: {
        weight: 0.6,
        reason:
          "Landscape and visual impact assessment is prepared to support and defend planning applications.",
      },
      water_engineering: {
        weight: 0.55,
        reason:
          "Swales, basins and rain gardens are drainage features delivered as landscape and sized by engineers.",
      },
      architecture: {
        weight: 0.55,
        reason:
          "Site layout, external levels and hard surfacing are resolved with the architect from first sketch.",
      },
    },
  },
  last_mile_operations: {
    label: "Last-Mile Delivery Operations",
    aliases: [
      "last mile delivery",
      "last mile operation",
      "final mile",
      "delivery station manager",
      "delivery hub manager",
      "courier network",
      "courier operation",
      "parcel delivery",
      "same day delivery",
      "delivery dispatcher",
      "last-mile delivery operations",
    ],
    adjacent: {
      transport_fleet_management: {
        weight: 0.8,
        reason:
          "routing, driver hours and vehicle availability are the same daily constraints a transport office manages",
      },
      warehouse_operations: {
        weight: 0.75,
        reason:
          "a delivery station is a cross-dock, planned with the same wave, sortation and shift method as a warehouse",
      },
      people_operations: {
        weight: 0.5,
        reason:
          "delivery networks run on large hourly driver and sorter populations, so scheduling and retention dominate the job",
      },
      autonomy: {
        weight: 0.5,
        reason:
          "sidewalk robot and autonomous van pilots are deployed on live parcel rounds, and the delivery station defines the routes, handover points and exception handling they run on",
      },
    },
  },
  lean_manufacturing: {
    label: "Lean Manufacturing",
    aliases: [
      "lean manufacturing",
      "continuous improvement manager",
      "kaizen",
      "kaizen event",
      "value stream mapping",
      "gemba walk",
      "poka yoke",
      "smed",
      "kanban pull system",
      "toyota production system",
      "lean practitioner",
      "standardized work",
    ],
    adjacent: {
      six_sigma: {
        weight: 0.85,
        reason:
          "The two are taught and certified together as lean six sigma, one removing waste and the other removing variation.",
      },
      production_management: {
        weight: 0.75,
        reason:
          "Improvement only sticks when plant leadership runs the daily tiered meeting and holds the standard.",
      },
      industrial_engineering: {
        weight: 0.7,
        reason:
          "Value stream maps and standard work rest on the work measurement industrial engineering supplies.",
      },
      quality_engineering: {
        weight: 0.6,
        reason:
          "Both attack repeat defects with structured problem solving and the same shop floor data.",
      },
    },
  },
  learning_and_development: {
    label: "Learning And Development",
    onet: "13-1151.00",
    aliases: [
      "learning and development",
      "corporate trainer",
      "training facilitator",
      "training needs analysis",
      "leadership development",
      "blended learning",
      "apprenticeship levy",
      "workshop facilitation",
      "learning pathway",
    ],
    adjacent: {
      instructional_design: {
        weight: 0.8,
        reason:
          "L&D commissions, briefs and signs off the elearning that instructional designers build.",
      },
      people_operations: {
        weight: 0.8,
        reason:
          "L&D usually sits inside HR and works from the same appraisal and capability data.",
      },
      classroom_teaching: {
        weight: 0.6,
        reason:
          "Teachers move into corporate training because both design and deliver sessions to a room.",
      },
      talent_leadership: {
        weight: 0.5,
        reason:
          "Both own the internal capability agenda and argue build-versus-hire at the same table.",
      },
    },
  },
  legal_operations: {
    label: "Legal Operations",
    aliases: [
      "legal operations manager",
      "legal ops",
      "legal project management",
      "matter management",
      "outside counsel management",
      "legal spend management",
      "legal e-billing",
      "law firm panel management",
      "legal technology implementation",
      "legal knowledge management",
      "cloc",
      "legal operations",
    ],
    adjacent: {
      in_house_counsel: {
        weight: 0.7,
        reason:
          "Legal operations exists to run the in-house department, so the work is defined by what those lawyers need to deliver.",
      },
      contract_management: {
        weight: 0.65,
        reason:
          "Contract systems, templates and self-service playbooks are the largest legal operations programme in most companies.",
      },
      ediscovery: {
        weight: 0.55,
        reason:
          "Review platforms, hosting costs and vendor selection are procured and governed by legal operations.",
      },
      operational_finance: {
        weight: 0.55,
        reason:
          "Legal spend, accruals and matter budgets are forecast and closed against the same monthly finance cycle.",
      },
    },
  },
  library_practice: {
    label: "Library And Information Practice",
    onet: "25-4022.00",
    aliases: [
      "librarian",
      "academic librarian",
      "school librarian",
      "subject librarian",
      "cilip",
      "mclip",
      "library cataloguing",
      "metadata cataloguing",
      "information literacy",
      "collection development",
      "library management system",
      "reference enquiry",
      "library and information practice",
    ],
    adjacent: {
      archive_practice: {
        weight: 0.8,
        reason:
          "Both catalogue holdings to a published standard and manage physical and digital storage.",
      },
      data_engineering: {
        weight: 0.5,
        reason:
          "Cataloguing is metadata modelling, controlled vocabularies and record migration between systems.",
      },
      research_administration: {
        weight: 0.6,
        reason:
          "University libraries run the repository and open-access compliance the research office reports on.",
      },
      higher_education_lecturing: {
        weight: 0.5,
        reason:
          "Subject librarians teach information literacy sessions embedded in academic programmes.",
      },
    },
  },
  lifecycle_marketing: {
    label: "Lifecycle Marketing",
    aliases: [
      "lifecycle marketing",
      "crm marketing",
      "email marketing",
      "marketing automation",
      "retention marketing",
      "drip campaign",
      "push notification campaign",
      "email deliverability",
      "marketo",
      "braze",
      "klaviyo",
    ],
    adjacent: {
      demand_generation: {
        weight: 0.75,
        reason:
          "Leads not ready to buy are passed into nurture streams, so both teams work the same contact database and contact frequency rules.",
      },
      marketing_operations: {
        weight: 0.75,
        reason:
          "Both live inside the automation platform, and lifecycle programmes break when consent flags, triggers or data hygiene are wrong.",
      },
      growth_marketing: {
        weight: 0.7,
        reason:
          "Activation, resurrection and referral loops are built and tested in the same messaging tools growth teams use.",
      },
      customer_success: {
        weight: 0.6,
        reason:
          "Both fight churn on the same accounts, one through automated messaging and one through human intervention.",
      },
    },
  },
  litigation: {
    label: "Civil Litigation",
    onet: "23-1011.00",
    aliases: [
      "civil litigation",
      "commercial litigation",
      "litigation attorney",
      "litigation solicitor",
      "litigator",
      "trial attorney",
      "dispute resolution lawyer",
      "motion practice",
      "deposition preparation",
      "commercial barrister",
      "claimant side litigation",
    ],
    adjacent: {
      ediscovery: {
        weight: 0.75,
        reason:
          "The litigator sets the custodians, date ranges and search terms that the e-discovery team then collects and reviews against.",
      },
      paralegal_practice: {
        weight: 0.7,
        reason:
          "Paralegals build the chronologies, court bundles and filings a litigator argues from, so both work the same case file daily.",
      },
      corporate_investigations: {
        weight: 0.6,
        reason:
          "An internal investigation produces the witness evidence and preserved documents that any claim which follows is fought on.",
      },
    },
  },
  livestock_husbandry: {
    label: "Livestock & Animal Husbandry",
    aliases: [
      "livestock manager",
      "animal husbandry",
      "herd manager",
      "dairy herd",
      "herd health",
      "calf rearing",
      "poultry manager",
      "pig unit manager",
      "sheep farming",
      "livestock nutrition",
      "stockperson",
      "livestock & animal husbandry",
    ],
    adjacent: {
      farm_management: {
        weight: 0.75,
        reason:
          "stock numbers, housing and forage budgets are set inside the whole-farm business plan",
      },
      agronomy: {
        weight: 0.6,
        reason:
          "forage, silage and grazing rotations are crop production decisions taken by the stock manager",
      },
      food_science: {
        weight: 0.6,
        reason:
          "carcase specification, milk quality and on-farm assurance audits are set against processor safety standards",
      },
    },
  },
  local_government_administration: {
    label: "Local Government Administration",
    aliases: [
      "local authority officer",
      "local government officer",
      "council officer",
      "democratic service",
      "electoral service",
      "committee administration",
      "town clerk",
      "parish clerk",
      "civic administration",
      "local government administration",
    ],
    adjacent: {
      public_policy_analysis: {
        weight: 0.7,
        reason:
          "Council strategies, scrutiny reports and consultations are policy analysis at local level.",
      },
      housing_management: {
        weight: 0.7,
        reason:
          "Allocations, homelessness and licensing are statutory housing duties discharged by councils.",
      },
      emergency_planning: {
        weight: 0.7,
        reason:
          "Councils are category one responders and staff the local resilience forum year round.",
      },
      social_work: {
        weight: 0.6,
        reason:
          "Children's and adult social care are the largest departments a council runs and funds.",
      },
      archive_practice: {
        weight: 0.5,
        reason:
          "Record offices, information governance and disclosure requests sit in council administration.",
      },
    },
  },
  localisation: {
    label: "Localisation",
    aliases: [
      "localisation manager",
      "localization specialist",
      "l10n",
      "internationalisation",
      "i18n",
      "locale testing",
      "transcreation",
      "localisation engineer",
      "game localisation",
      "localisation",
    ],
    adjacent: {
      translation_and_interpreting: {
        weight: 0.85,
        reason:
          "Localisation managers commission, review and edit the translators who produce the target-language strings.",
      },
      copywriting: {
        weight: 0.6,
        reason:
          "Transcreation rewrites a campaign line for a new market rather than translating it, which is copywriting work.",
      },
      software_engineering: {
        weight: 0.6,
        reason:
          "String extraction, pluralisation rules and locale formatting are code problems handled in the build pipeline.",
      },
      user_experience_design: {
        weight: 0.55,
        reason:
          "Text expansion and right-to-left layout break interfaces, so localisation feeds directly into interface design decisions.",
      },
    },
  },
  management_accounting: {
    label: "Management Accounting",
    onet: "13-2011.00",
    aliases: [
      "management accountant",
      "management accounting",
      "cima",
      "chartered management accountant",
      "cost accounting",
      "standard costing",
      "variance analysis",
      "product costing",
      "contribution margin analysis",
      "overhead allocation",
      "cost controller",
      "management reporting pack",
    ],
    adjacent: {
      operational_finance: {
        weight: 0.8,
        reason:
          "Budgeting, forecasting and variance commentary are the daily work of both, and the two are frequently the same job under two different titles.",
      },
      technical_accounting: {
        weight: 0.6,
        reason:
          "Both run off one ledger and one month end close, so a management accountant already knows how the statutory numbers are assembled.",
      },
      procurement_finance: {
        weight: 0.6,
        reason:
          "Category savings only count once they land in the management accounts, so both roles work the same cost base and supplier spend data.",
      },
      corporate_finance: {
        weight: 0.6,
        reason:
          "Unit and product costing supplies the margin assumptions that investment cases and long range business plans are built on.",
      },
    },
  },
  manufacturing_engineering: {
    label: "Manufacturing Engineering",
    aliases: [
      "manufacturing engineer",
      "manufacturing engineering",
      "production engineer",
      "design for manufacture",
      "design for manufacturability",
      "fixture design",
      "tooling engineer",
      "jig and fixture",
      "manufacturing work instruction",
      "new product introduction engineer",
    ],
    adjacent: {
      process_engineering: {
        weight: 0.8,
        reason:
          "One defines the route and the fixtures, the other tunes the parameters inside it, and the same person often does both.",
      },
      industrial_engineering: {
        weight: 0.7,
        reason:
          "Both cost and time a production route; one measures the work content, the other changes the method.",
      },
      mechanical_engineering: {
        weight: 0.65,
        reason:
          "Design for manufacture puts them in the same tolerance, material and assembly discussions as the mechanical designer.",
      },
      cnc_machining: {
        weight: 0.6,
        reason:
          "Writing a machining route requires knowing what a CNC setup can hold and how long each cut really takes.",
      },
      tool_and_die: {
        weight: 0.6,
        reason:
          "Press tools and fixtures are specified and signed off by manufacturing engineers and built by toolmakers.",
      },
    },
  },
  marine_operations: {
    label: "Ship Management & Marine Surveying",
    aliases: [
      "marine surveyor",
      "marine superintendent",
      "ship manager",
      "vessel operation",
      "master mariner",
      "chief engineer officer",
      "crewing manager",
      "port state control",
      "class survey",
      "hull and machinery survey",
      "dry docking",
      "ism code",
      "stcw",
      "ship management & marine surveying",
    ],
    adjacent: {
      naval_architecture: {
        weight: 0.7,
        reason:
          "damage, condition and stability survey work is read and reported in naval architecture terms",
      },
      port_operations: {
        weight: 0.65,
        reason:
          "superintendents attend their vessels alongside and negotiate berth, cargo and repair windows with the terminal",
      },
      freight_forwarding: {
        weight: 0.5,
        reason:
          "vessel operators and forwarders both work the laytime, demurrage and bill of lading terms that decide who pays for a delayed cargo",
      },
    },
  },
  market_research: {
    label: "Market Research & Insight",
    onet: "13-1161.00",
    aliases: [
      "market research",
      "consumer insight",
      "market insight",
      "focus group moderation",
      "qualitative market research",
      "quantitative market research",
      "conjoint analysis",
      "segmentation study",
      "win loss analysis",
      "brand tracker",
      "market research & insight",
    ],
    adjacent: {
      product_marketing: {
        weight: 0.75,
        reason:
          "Segmentation, buyer interviews and win-loss findings are the raw material a positioning statement is built from.",
      },
      brand_marketing: {
        weight: 0.7,
        reason:
          "Brand owners commission and act on tracking studies, and read the same creative test results before a campaign ships.",
      },
      pricing_strategy: {
        weight: 0.7,
        reason:
          "Willingness-to-pay and conjoint studies are the evidence any defensible price change is built on.",
      },
      research_science: {
        weight: 0.5,
        reason:
          "Both design studies, control for sampling bias and have to defend a conclusion to a sceptical reader.",
      },
      talent_intelligence: {
        weight: 0.5,
        reason:
          "Both build a picture of a market through survey design, sampling and segmentation rather than from one convenient data source.",
      },
    },
  },
  marketing_operations: {
    label: "Marketing Operations",
    aliases: [
      "marketing operation",
      "marketing ops",
      "martech stack",
      "marketing technology administration",
      "lead routing",
      "lead scoring",
      "campaign attribution",
      "attribution modelling",
      "attribution modeling",
      "marketing automation administration",
      "marketing operations",
    ],
    adjacent: {
      revenue_operations: {
        weight: 0.8,
        reason:
          "Both run the same CRM and reporting spine, and the handover point between them is where funnel data usually breaks.",
      },
      demand_generation: {
        weight: 0.8,
        reason:
          "Campaign teams cannot report or route a single lead without the scoring, routing and tracking operations builds.",
      },
      lifecycle_marketing: {
        weight: 0.75,
        reason:
          "Automated journeys are configured, tested and debugged in the same platform, on the same consent and contact data.",
      },
      data_engineering: {
        weight: 0.55,
        reason:
          "Pulling ad platform and web event data into a warehouse raises the same modelling, identity-matching and freshness problems.",
      },
    },
  },
  medical_affairs: {
    label: "Medical Affairs",
    aliases: [
      "medical affair",
      "medical affairs director",
      "medical information enquiry",
      "medical advisory board",
      "investigator initiated study",
      "publication planning",
      "medical strategy",
      "scientific communication plan",
      "promotional material review",
      "field medical team",
      "medical affairs",
    ],
    adjacent: {
      medical_science_liaison: {
        weight: 0.85,
        reason:
          "Liaisons are the field arm of medical affairs and report into the same medical leadership and plan.",
      },
      medical_writing: {
        weight: 0.75,
        reason:
          "The publication plan medical affairs owns is executed by the writers who draft each manuscript and abstract.",
      },
      health_economics: {
        weight: 0.65,
        reason:
          "Payer value dossiers and evidence generation plans are built jointly with outcomes researchers.",
      },
      clinical_practice: {
        weight: 0.6,
        reason:
          "Medical affairs physicians are hired for credibility with specialists, which comes from having practised.",
      },
    },
  },
  medical_science_liaison: {
    label: "Medical Science Liaison",
    aliases: [
      "medical science liaison",
      "field medical",
      "key opinion leader",
      "scientific exchange",
      "therapeutic area expert",
      "field based medical",
      "medical liaison",
      "field medical scientist",
      "scientific liaison",
    ],
    adjacent: {
      medical_affairs: {
        weight: 0.85,
        reason:
          "The liaison role sits inside medical affairs and carries its scientific communication plan into the field.",
      },
      clinical_practice: {
        weight: 0.7,
        reason:
          "Liaisons are recruited from pharmacy, nursing and physician backgrounds precisely for credibility with treating clinicians.",
      },
      medical_writing: {
        weight: 0.55,
        reason:
          "Liaisons brief specialists off the same slide decks and publications the medical writers produce, and feed field questions back into that content.",
      },
    },
  },
  medical_writing: {
    label: "Medical Writing",
    onet: "27-3042.00",
    aliases: [
      "medical writer",
      "clinical study report",
      "regulatory writing",
      "manuscript preparation",
      "protocol writing",
      "common technical document",
      "investigator brochure",
      "scientific writer",
      "publication writing",
      "plain language summary",
      "emwa",
      "medical writing",
    ],
    adjacent: {
      regulatory_affairs: {
        weight: 0.8,
        reason:
          "Study reports and CTD summaries written here are the substance of the submission the regulatory team files.",
      },
      clinical_development: {
        weight: 0.7,
        reason:
          "The writer drafts protocol and study report to the development physician's design and defends every claim in them.",
      },
      medical_affairs: {
        weight: 0.7,
        reason:
          "Manuscripts and congress abstracts are drafted against the publication plan medical affairs sets.",
      },
      biostatistics: {
        weight: 0.65,
        reason:
          "The results section is written straight from the statistician's tables and must match them number for number.",
      },
    },
  },
  medicinal_chemistry: {
    label: "Medicinal Chemistry",
    onet: "19-2031.00",
    aliases: [
      "medicinal chemistry",
      "medicinal chemist",
      "structure activity relationship",
      "small molecule lead optimization",
      "hit to lead",
      "small molecule drug discovery",
      "fragment based drug discovery",
      "scaffold hopping",
      "sar analysis",
      "compound series design",
    ],
    adjacent: {
      process_chemistry: {
        weight: 0.8,
        reason:
          "The discovery route that made milligrams is handed to process chemistry to make kilograms of the same molecule.",
      },
      dmpk: {
        weight: 0.8,
        reason:
          "Potency alone does not make a drug, so each design cycle is steered by the metabolism and permeability data.",
      },
      assay_development: {
        weight: 0.75,
        reason:
          "Every compound made is ranked by a biochemical or cell assay, so the two benches iterate together weekly.",
      },
      analytical_chemistry: {
        weight: 0.7,
        reason:
          "Structure confirmation and purity by NMR and LC-MS is shared craft between the two benches.",
      },
      machine_learning: {
        weight: 0.6,
        reason:
          "QSAR and generative models are now routine tools for proposing the next compounds in a series.",
      },
    },
  },
  mental_health_practice: {
    label: "Mental Health Practice",
    aliases: [
      "mental health nurse",
      "psychiatric nurse",
      "rmn",
      "psychotherapist",
      "cbt therapist",
      "drop; give clinical psychology its own concept (and reconsider 'psychotherapist' and 'amhp' with it)",
      "amhp",
      "crisis resolution team",
      "substance misuse practitioner",
      "inpatient mental health ward",
      "dbt therapist",
      "mental health practice",
    ],
    adjacent: {
      psychiatry: {
        weight: 0.9,
        reason:
          "Nurses, psychologists and psychiatrists staff one multidisciplinary team and share the same caseload and risk decisions.",
      },
      registered_nursing: {
        weight: 0.7,
        reason:
          "Mental health nurses hold the same statutory registration and physical health monitoring duties as general nurses.",
      },
      occupational_therapy: {
        weight: 0.6,
        reason:
          "Occupational therapy is embedded in mental health teams, rebuilding daily function after an acute admission.",
      },
      community_nursing: {
        weight: 0.55,
        reason:
          "Community mental health and district nursing both run home-visit caseloads for people who cannot attend clinic.",
      },
    },
  },
  merchandising: {
    label: "Merchandising",
    aliases: [
      "merchandise planning",
      "merchandiser",
      "planogram",
      "open to buy",
      "stock allocation",
      "markdown management",
      "store layout planning",
      "sell through rate",
      "seasonal range plan",
      "merchandising",
    ],
    adjacent: {
      category_management: {
        weight: 0.85,
        reason:
          "Buying picks the range and terms; merchandising commits the depth, phasing and store grading behind it.",
      },
      ecommerce_trading: {
        weight: 0.75,
        reason:
          "Allocation, markdown and range display carry over directly from the shop floor to a category page online.",
      },
      pricing_strategy: {
        weight: 0.55,
        reason:
          "Markdown depth and timing are margin decisions taken against a sell-through plan and a stock position.",
      },
    },
  },
  metrology: {
    label: "Metrology & Inspection",
    onet: "51-9061.00",
    aliases: [
      "metrology",
      "metrology technician",
      "cmm programmer",
      "coordinate measuring machine",
      "dimensional inspection",
      "first article inspection",
      "geometric dimensioning and tolerancing",
      "gdt",
      "quality inspector",
      "measurement system analysis",
      "optical comparator",
      "metrology & inspection",
    ],
    adjacent: {
      calibration_technician: {
        weight: 0.85,
        reason:
          "Every inspection result depends on instruments kept within a known uncertainty by calibration work.",
      },
      quality_engineering: {
        weight: 0.8,
        reason:
          "Inspection method, sampling plan and gauge capability are decided by the quality engineer the inspector reports to.",
      },
      cnc_machining: {
        weight: 0.65,
        reason:
          "CMM results go straight back to the machinist as tool offsets, and both read the same tolerance drawing.",
      },
      tool_and_die: {
        weight: 0.55,
        reason:
          "Proving a new tool starts with a first article inspection of the parts it produces.",
      },
    },
  },
  midwifery: {
    label: "Midwifery",
    onet: "29-1161.00",
    aliases: [
      "midwife",
      "midwifery",
      "registered midwife",
      "antenatal clinic",
      "intrapartum care",
      "postnatal care",
      "labour ward",
      "obstetric unit",
      "community midwife",
      "perinatal care",
      "cnm",
    ],
    adjacent: {
      registered_nursing: {
        weight: 0.75,
        reason:
          "Midwives share ward-based assessment, drug administration and escalation practice, and many hold dual nursing registration.",
      },
      paediatrics: {
        weight: 0.65,
        reason:
          "Midwives and paediatric teams share newborn resuscitation and early neonatal examination on the same unit.",
      },
      community_nursing: {
        weight: 0.6,
        reason:
          "Community midwives run home visit caseloads and hand over to health visitors, working the same district patch.",
      },
      clinical_practice: {
        weight: 0.8,
        reason:
          "Midwifery is autonomous clinical practice with its own register, caseload and referral thresholds to obstetric teams.",
      },
    },
  },
  mlops: {
    label: "MLOps Engineering",
    aliases: [
      "mlops engineer",
      "model deployment",
      "feature store",
      "model serving",
      "kubeflow",
      "mlflow",
      "model monitoring",
      "vector database",
      "llm inference",
      "model registry",
      "training pipeline",
      "mlops engineering",
    ],
    adjacent: {
      machine_learning: {
        weight: 0.85,
        reason:
          "MLOps engineers productionise the models research teams train, sharing frameworks and metrics.",
      },
      data_engineering: {
        weight: 0.75,
        reason:
          "Feature pipelines are data pipelines with a freshness contract and a training-serving parity rule.",
      },
      platform_engineering: {
        weight: 0.65,
        reason:
          "A model platform is an internal developer platform with accelerators and artefacts attached.",
      },
      site_reliability_engineering: {
        weight: 0.55,
        reason:
          "Serving models at low latency is ordinary production reliability work on unusual hardware.",
      },
    },
  },
  mobile_engineering: {
    label: "Mobile Engineering",
    onet: "15-1252.00",
    aliases: [
      "ios developer",
      "android developer",
      "mobile app developer",
      "swift developer",
      "kotlin developer",
      "swiftui",
      "jetpack compose",
      "react native developer",
      "flutter developer",
      "xcode",
      "objective-c",
      "android sdk",
      "app store release",
      "mobile engineering",
    ],
    adjacent: {
      frontend_engineering: {
        weight: 0.7,
        reason:
          "Mobile and web frontend both build declarative UI against a remote API over an unreliable network.",
      },
      software_engineering: {
        weight: 0.85,
        reason:
          "App code is ordinary production software with review, testing and a shipping cadence.",
      },
      accessibility_engineering: {
        weight: 0.5,
        reason:
          "Native apps carry the same screen-reader duties, met through VoiceOver and TalkBack.",
      },
      quality_engineering: {
        weight: 0.5,
        reason:
          "Handset and OS-version spread forces mobile teams into automated UI testing on device farms.",
      },
    },
  },
  motion_graphics: {
    label: "Motion Graphics",
    onet: "27-1014.00",
    aliases: [
      "motion designer",
      "motion graphics artist",
      "broadcast design",
      "title sequence design",
      "kinetic typography",
      "explainer animation",
      "2d motion design",
      "cinema 4d",
      "motion graphics",
    ],
    adjacent: {
      animation: {
        weight: 0.8,
        reason:
          "Motion graphics and character animation share timing, easing and keyframe craft even when the subject differs.",
      },
      video_editing: {
        weight: 0.75,
        reason:
          "Motion designers deliver into the editor's timeline and re-time their work against every recut, so both sit inside the same post schedule and file handover.",
      },
      three_d_and_cgi: {
        weight: 0.7,
        reason:
          "Broadcast and title work has moved to 3D scenes, so motion designers routinely light and render in a 3D package.",
      },
      interaction_design: {
        weight: 0.6,
        reason:
          "Interface motion is specified by the same easing and duration vocabulary that motion designers use professionally.",
      },
      sound_design: {
        weight: 0.5,
        reason:
          "A title sequence is cut to a track, so motion designers work to audio and often brief the sound designer directly.",
      },
    },
  },
  music_production: {
    label: "Music Production",
    onet: "27-2041.00",
    aliases: [
      "music producer",
      "record producer",
      "music composer",
      "beat maker",
      "music arranger",
      "songwriter",
      "ableton producer",
      "film scoring",
      "soundtrack composer",
      "music production",
    ],
    adjacent: {
      audio_engineering: {
        weight: 0.85,
        reason:
          "Producers track, comp and mix their own sessions, so the engineering craft is part of the job description.",
      },
      sound_design: {
        weight: 0.7,
        reason:
          "Score and effects are designed against the same picture and blended in the final mix.",
      },
      video_editing: {
        weight: 0.5,
        reason:
          "Composers cut to picture and work from the editor's timeline and spotting notes.",
      },
    },
  },
  naval_architecture: {
    label: "Naval Architecture",
    onet: "17-2121.00",
    aliases: [
      "naval architect",
      "naval architecture",
      "ship design",
      "hull design",
      "hull structure",
      "stability calculation",
      "hydrostatics",
      "seakeeping",
      "shipbuilding",
      "mrina",
      "imarest",
    ],
    adjacent: {
      mechanical_engineering: {
        weight: 0.75,
        reason:
          "hull structure, machinery layout and vibration work is mechanical engineering applied to a floating structure",
      },
      marine_operations: {
        weight: 0.7,
        reason:
          "many marine surveyors are naval architects who moved from the design office into condition and damage survey",
      },
      materials_science: {
        weight: 0.55,
        reason:
          "steel grades, coating systems and composite hulls are selected for corrosion and fatigue by the same designer",
      },
      port_operations: {
        weight: 0.5,
        reason:
          "vessel beam, draught and crane outreach from the design office decide which berths a terminal can offer",
      },
    },
  },
  network_engineering: {
    label: "Network Engineering",
    onet: "15-1241.00",
    aliases: [
      "network engineer",
      "ccna",
      "ccnp",
      "ccie",
      "bgp routing",
      "network architect",
      "sd wan",
      "juniper junos",
      "firewall configuration",
      "lan wan",
      "network operations centre",
      "network engineering",
    ],
    adjacent: {
      security_engineering: {
        weight: 0.7,
        reason:
          "Segmentation, firewall policy and zero-trust enforcement are built by network hands.",
      },
      cloud_architecture: {
        weight: 0.7,
        reason:
          "Hybrid estates need somebody fluent in both physical routing and cloud virtual networks.",
      },
      site_reliability_engineering: {
        weight: 0.5,
        reason:
          "Both diagnose latency and packet loss live, under production incident pressure.",
      },
      observability_engineering: {
        weight: 0.5,
        reason:
          "Flow records and SNMP telemetry feed the same dashboards and alerting stack as application metrics.",
      },
    },
  },
  nuclear_engineering: {
    label: "Nuclear Engineering",
    onet: "17-2161.00",
    aliases: [
      "nuclear engineering",
      "reactor physics",
      "neutronics",
      "nuclear fuel cycle",
      "reactor core design",
      "nuclear decommissioning",
      "spent fuel handling",
      "thermal hydraulic analysis",
      "pressurised water reactor",
      "small modular reactor",
    ],
    adjacent: {
      radiation_protection: {
        weight: 0.85,
        reason:
          "Reactor and fuel handling design is constrained throughout by dose limits and shielding calculation.",
      },
      thermal_engineering: {
        weight: 0.7,
        reason:
          "Core cooling, steam cycle efficiency and decay heat removal are heat transfer and fluid flow problems.",
      },
      functional_safety: {
        weight: 0.65,
        reason:
          "Protection systems are graded by safety class using the same fault tree, redundancy and diversity reasoning.",
      },
      process_safety: {
        weight: 0.6,
        reason:
          "A nuclear safety case and a major accident hazard case share hazard identification and risk quantification method.",
      },
      power_systems: {
        weight: 0.55,
        reason:
          "A reactor exists to turn a turbine generator, so the plant electrical and grid interface is designed alongside it.",
      },
    },
  },
  nutrition_practice: {
    label: "Nutrition & Dietetics",
    onet: "29-1031.00",
    aliases: [
      "dietician",
      "nutritionist",
      "sports nutritionist",
      "performance nutrition",
      "dietetic practice",
      "nutrition therapy",
      "public health nutrition",
      "body composition assessment",
      "senr",
      "nutrition & dietetics",
    ],
    adjacent: {
      clinical_practice: {
        weight: 0.7,
        reason:
          "dietitians sit in hospital teams, prescribing feeds and managing patients alongside the treating clinicians",
      },
      strength_conditioning: {
        weight: 0.65,
        reason:
          "fuelling and body composition plans are written against the S&C training block, not separately from it",
      },
      food_science: {
        weight: 0.6,
        reason:
          "nutrient composition, fortification and labelling data all come out of food science work",
      },
      athletic_therapy: {
        weight: 0.5,
        reason:
          "recovery and tissue healing plans are agreed with the rehabilitation staff treating the same athlete",
      },
    },
  },
  observability_engineering: {
    label: "Observability Engineering",
    aliases: [
      "observability engineer",
      "distributed tracing",
      "opentelemetry",
      "prometheus monitoring",
      "grafana dashboard",
      "log pipeline",
      "apm tooling",
      "datadog implementation",
      "telemetry pipeline",
      "alerting rule",
      "monitoring engineer",
      "observability engineering",
    ],
    adjacent: {
      site_reliability_engineering: {
        weight: 0.85,
        reason:
          "Reliability targets are unprovable without the metrics and spans this work collects.",
      },
      devops: {
        weight: 0.6,
        reason:
          "Instrumentation and dashboards ship through the same pipelines as the services they watch.",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "Telemetry is a high-volume streaming pipeline with the same retention and cost problems.",
      },
      security_operations: {
        weight: 0.55,
        reason:
          "Detection rules and service alerts are written against the same collected event stream.",
      },
    },
  },
  occupational_hygiene: {
    label: "Occupational Hygiene",
    aliases: [
      "occupational hygiene",
      "industrial hygiene",
      "cih",
      "occupational exposure monitoring",
      "noise exposure assessment",
      "asbestos survey",
      "coshh assessment",
      "local exhaust ventilation",
      "workplace air sampling",
    ],
    adjacent: {
      hse_management: {
        weight: 0.7,
        reason:
          "Hygiene surveys feed the risk assessments and control plans the safety function has to implement.",
      },
      radiation_protection: {
        weight: 0.6,
        reason:
          "Both compare measured personal exposure against a statutory limit and design controls to reduce it.",
      },
      contaminated_land: {
        weight: 0.55,
        reason:
          "Asbestos, dust and vapour exposure on remediation sites uses the same sampling and limit comparison.",
      },
      environmental_consulting: {
        weight: 0.5,
        reason:
          "Air sampling, noise measurement and control assessment appear in workplace and environmental briefs alike.",
      },
    },
  },
  occupational_therapy: {
    label: "Occupational Therapy",
    onet: "29-1122.00",
    aliases: [
      "occupational therapist",
      "occupational therapy",
      "otr",
      "hand therapy",
      "functional capacity evaluation",
      "adl assessment",
      "home adaptation assessment",
      "assistive technology assessment",
      "vocational rehabilitation",
      "sensory integration therapy",
      "aota",
      "neurorehabilitation",
    ],
    adjacent: {
      physiotherapy: {
        weight: 0.8,
        reason:
          "The two professions co-treat stroke, trauma and frailty caseloads and hand the same patient between them daily.",
      },
      mental_health_practice: {
        weight: 0.6,
        reason:
          "Occupational therapists staff mental health teams, using structured activity to rebuild daily function after acute episodes.",
      },
      speech_language_therapy: {
        weight: 0.6,
        reason:
          "Both sit in the same allied health team and jointly assess communication and self-care needs before discharge home.",
      },
      community_nursing: {
        weight: 0.55,
        reason:
          "Home assessments, equipment provision and carer training are done jointly by community therapists and district nurses.",
      },
    },
  },
  offshore_wind: {
    label: "Offshore Wind",
    aliases: [
      "offshore wind",
      "offshore wind farm",
      "floating offshore wind",
      "monopile installation",
      "jacket foundation",
      "array cable installation",
      "export cable",
      "offshore wind maintenance",
      "wind turbine installation vessel",
      "gwo basic safety training",
      "marine coordination",
    ],
    adjacent: {
      wind_energy: {
        weight: 0.85,
        reason:
          "The turbine itself is the same machine, and rotor, load case and yield work carries over unchanged.",
      },
      subsea_engineering: {
        weight: 0.7,
        reason:
          "Foundation installation, cable burial and vessel-based marine construction are the discipline oil and gas already built.",
      },
      high_voltage_transmission: {
        weight: 0.7,
        reason:
          "Offshore arrays export through subsea cable and HVDC converter platforms specified by transmission engineers.",
      },
      geophysics: {
        weight: 0.55,
        reason:
          "Foundation design begins with marine geophysical and geotechnical survey of the seabed.",
      },
      hse_management: {
        weight: 0.55,
        reason:
          "Offshore work is permit driven, so rescue provision and safe access planning sit inside the delivery role.",
      },
    },
  },
  oncology: {
    label: "Oncology",
    aliases: [
      "oncologist",
      "chemotherapy prescribing",
      "systemic anticancer therapy",
      "tumour board",
      "tumor board",
      "haematology oncology",
      "clinical oncology",
      "cancer mdt",
      "immunotherapy clinic",
    ],
    adjacent: {
      radiology: {
        weight: 0.6,
        reason:
          "Staging and response assessment are radiological, and the radiologist sits in every cancer multidisciplinary meeting.",
      },
      diagnostic_radiography: {
        weight: 0.6,
        reason:
          "Radiotherapy is planned and delivered by therapeutic radiographers working to the oncologist's prescription.",
      },
      pharmacy_practice: {
        weight: 0.6,
        reason:
          "Every cycle is verified and compounded by oncology pharmacy, and dose banding is agreed jointly with the prescriber.",
      },
      research_science: {
        weight: 0.55,
        reason:
          "Oncologists write and recruit to trial protocols, so evidence appraisal and study design are part of the day job.",
      },
      clinical_practice: {
        weight: 0.8,
        reason:
          "Oncology is consultant-led clinical practice with prescribing, toxicity management and treatment decisions carried personally.",
      },
    },
  },
  packaging_design: {
    label: "Packaging Design",
    aliases: [
      "packaging designer",
      "structural packaging",
      "dieline design",
      "label design",
      "carton design",
      "packaging artwork",
      "print production artwork",
      "packaging design",
    ],
    adjacent: {
      visual_design: {
        weight: 0.7,
        reason:
          "Pack artwork is graphic design executed to a dieline, print process and regulatory copy requirement.",
      },
      brand_identity: {
        weight: 0.7,
        reason:
          "For consumer goods the pack carries the identity further than any other surface, so the two briefs arrive together.",
      },
      industrial_design: {
        weight: 0.65,
        reason:
          "Structural packaging is a form and materials problem solved with the same CAD and prototyping methods.",
      },
      typography: {
        weight: 0.55,
        reason:
          "Small-size legibility, ingredient panels and mandated type sizes make packaging an unforgiving typographic exercise.",
      },
    },
  },
  packaging_engineering: {
    label: "Packaging Engineering",
    aliases: [
      "packaging engineer",
      "packaging technologist",
      "packaging development",
      "packaging design engineer",
      "ista testing",
      "distribution packaging",
      "primary packaging",
      "secondary packaging",
      "packaging line engineer",
      "packaging validation",
      "packaging engineering",
    ],
    adjacent: {
      process_engineering: {
        weight: 0.6,
        reason:
          "A packing line is a process with its own capability, changeover time and waste to engineer out.",
      },
      materials_science: {
        weight: 0.6,
        reason:
          "Barrier films, board grades and closure materials are selected on measured material properties.",
      },
      production_management: {
        weight: 0.55,
        reason:
          "Packing is the end of the line, so a packaging change lands directly on the plant's throughput.",
      },
      validation_engineering: {
        weight: 0.5,
        reason:
          "Regulated products need sterile barrier and transit packaging qualified under written protocols.",
      },
    },
  },
  paediatrics: {
    label: "Paediatrics",
    onet: "29-1221.00",
    aliases: [
      "paediatrician",
      "pediatrician",
      "drop (and drop 'pediatric'); 'paediatrician', 'pediatrician' and 'mrcpch' already carry the concept",
      "pediatric",
      "mrcpch",
      "neonatal intensive care",
      "nicu",
      "picu",
      "child health clinic",
      "neonatology",
      "community paediatric",
      "paediatrics",
    ],
    adjacent: {
      midwifery: {
        weight: 0.65,
        reason:
          "Newborn resuscitation and the first examination are shared between midwives and the paediatric team on the same unit.",
      },
      general_practice: {
        weight: 0.6,
        reason:
          "Most childhood illness presents to primary care first, and paediatrics sets the referral and safety-net thresholds it uses.",
      },
      critical_care_nursing: {
        weight: 0.55,
        reason:
          "Neonatal and paediatric intensive care nursing runs the ventilation and infusion protocols the paediatrician prescribes.",
      },
      speech_language_therapy: {
        weight: 0.5,
        reason:
          "Developmental assessment depends on speech therapy input for language delay and infant feeding difficulty.",
      },
    },
  },
  paralegal_practice: {
    label: "Paralegal Practice",
    onet: "23-2011.00",
    aliases: [
      "paralegal",
      "litigation paralegal",
      "corporate paralegal",
      "legal assistant",
      "legal executive",
      "cilex",
      "certified paralegal",
      "court filing",
      "trial bundle preparation",
      "legal secretary",
      "court e-filing",
      "paralegal practice",
    ],
    adjacent: {
      litigation: {
        weight: 0.7,
        reason:
          "Paralegals prepare the bundles, chronologies and filings the litigator then appears on.",
      },
      ediscovery: {
        weight: 0.6,
        reason:
          "Managed document review is staffed by paralegals applying an agreed coding protocol on a review platform.",
      },
      real_estate_law: {
        weight: 0.5,
        reason:
          "Conveyancing files are progressed by paralegals running searches, title packs and registry applications.",
      },
      corporate_ma_law: {
        weight: 0.5,
        reason:
          "Signing and completion mechanics — verification notes, board packs, post-completion filings — are run by corporate paralegals.",
      },
    },
  },
  paramedicine: {
    label: "Paramedicine",
    onet: "29-2043.00",
    aliases: [
      "paramedic",
      "emergency medical technician",
      "emt",
      "nremt",
      "ambulance clinician",
      "prehospital care",
      "hems crew",
      "drop; 'critical care paramedic', 'hems crew' and 'prehospital care' carry the concept",
      "critical care paramedic",
      "emergency care assistant",
      "paramedicine",
    ],
    adjacent: {
      emergency_medicine: {
        weight: 0.85,
        reason:
          "Prehospital and emergency department teams work one continuous resuscitation pathway and share trauma and airway protocols.",
      },
      critical_care_nursing: {
        weight: 0.6,
        reason:
          "Retrieval and transfer work puts paramedics on ventilators and infusions under the same critical care standards.",
      },
      advanced_nurse_practice: {
        weight: 0.55,
        reason:
          "Experienced paramedics convert to advanced clinical practitioner roles in urgent care using the same assessment and prescribing training.",
      },
      clinical_practice: {
        weight: 0.75,
        reason:
          "Paramedics assess, treat and discharge on scene under their own registration, which is unsupervised clinical decision making.",
      },
    },
  },
  parliamentary_practice: {
    label: "Parliamentary And Legislative Practice",
    aliases: [
      "parliamentary researcher",
      "parliamentary adviser",
      "legislative aide",
      "committee clerk",
      "legislative drafting",
      "select committee",
      "constituency casework",
      "public affairs adviser",
      "parliamentary liaison",
      "hansard reporting",
      "bill scrutiny",
      "parliamentary and legislative practice",
    ],
    adjacent: {
      public_policy_analysis: {
        weight: 0.8,
        reason:
          "Committee and bill work is policy analysis written to a legislative timetable.",
      },
      local_government_administration: {
        weight: 0.6,
        reason:
          "Council democratic services run committees and support elected members exactly as a clerk does.",
      },
      welfare_benefits_advice: {
        weight: 0.5,
        reason:
          "Constituency casework is largely benefit and housing problem solving with the same agencies.",
      },
    },
  },
  partnership_management: {
    label: "Partnerships & Alliances",
    aliases: [
      "partnership management",
      "partnership manager",
      "strategic alliance",
      "alliance manager",
      "partner marketing",
      "partner ecosystem",
      "technology partnership",
      "co marketing agreement",
      "isv partnership",
      "referral partnership",
      "partnerships & alliances",
    ],
    adjacent: {
      channel_sales: {
        weight: 0.85,
        reason:
          "A signed alliance only turns into revenue once partner sellers are recruited, enabled and given deal registration terms.",
      },
      go_to_market: {
        weight: 0.7,
        reason:
          "Choosing between direct coverage and a partner route into a segment is one of the central go-to-market decisions.",
      },
      enterprise_sales: {
        weight: 0.65,
        reason:
          "Partner-sourced deals still close in front of the same buying committee, so partner leads run the same qualification, forecast and negotiation motion.",
      },
      community_management: {
        weight: 0.5,
        reason:
          "Ambassador, user group and integration partner programmes are run on the same recruit, enable and reward cycle.",
      },
    },
  },
  patent_prosecution: {
    label: "Patent Prosecution",
    aliases: [
      "patent attorney",
      "patent agent",
      "patent prosecution",
      "european patent attorney",
      "uspto registration",
      "office action response",
      "patent drafting",
      "claim drafting",
      "pct application",
      "prior art search",
      "patentability opinion",
      "cipa",
    ],
    adjacent: {
      intellectual_property_law: {
        weight: 0.8,
        reason:
          "A granted patent is worth only what it can be enforced as, so prosecutors and enforcement counsel work one portfolio.",
      },
      research_science: {
        weight: 0.65,
        reason:
          "Patent attorneys are qualified in a science or engineering discipline and read primary literature and lab records to draft and defend claims.",
      },
      mechanical_engineering: {
        weight: 0.55,
        reason:
          "Drafting and arguing mechanical claims means reading drawings, tolerances and assemblies the way a design engineer does.",
      },
      software_engineering: {
        weight: 0.5,
        reason:
          "Claims over software inventions must be mapped onto a real implementation, which needs someone who can read the architecture.",
      },
    },
  },
  patient_safety: {
    label: "Patient Safety",
    aliases: [
      "patient safety",
      "never event",
      "drop 'root cause analysis', 'safety huddle' and 'safety culture survey'; replace 'incident reporting' with 'clinical incident reporting'",
      "incident reporting",
      "duty of candour",
      "safety huddle",
      "morbidity and mortality review",
      "human factors in healthcare",
      "psirf",
      "safety culture survey",
      "cpps",
    ],
    adjacent: {
      clinical_governance: {
        weight: 0.85,
        reason:
          "Safety findings are the main input to the governance cycle and are reported to the same board committee.",
      },
      infection_prevention: {
        weight: 0.6,
        reason:
          "Preventable infection is counted as avoidable harm and investigated by the same incident process.",
      },
      health_informatics: {
        weight: 0.5,
        reason:
          "Alerting, prescribing decision support and incident reporting systems are configured jointly with safety leads.",
      },
    },
  },
  payroll_administration: {
    label: "Payroll",
    onet: "43-3051.00",
    aliases: [
      "payroll administrator",
      "payroll manager",
      "payroll processing",
      "payroll reconciliation",
      "global payroll",
      "payroll bureau",
      "paye",
      "cipp",
      "payroll implementation",
      "payroll compliance",
      "gross to net calculation",
      "payroll",
    ],
    adjacent: {
      people_operations: {
        weight: 0.75,
        reason:
          "Starters, leavers and reward changes flow from the people team into payroll, and both work one employee record.",
      },
      operational_finance: {
        weight: 0.65,
        reason:
          "Payroll is one of the largest recurring cash outflows and is reconciled to the ledger and the cash forecast on every cycle.",
      },
      pension_consulting: {
        weight: 0.6,
        reason:
          "Pension contributions and auto enrolment assessments are calculated and remitted through the payroll run.",
      },
    },
  },
  penetration_testing: {
    label: "Penetration Testing",
    aliases: [
      "penetration tester",
      "pentester",
      "oscp",
      "red team operator",
      "offensive security",
      "ethical hacker",
      "crest registered",
      "network vulnerability assessment",
      "burp suite",
      "exploit development",
      "purple team exercise",
      "penetration testing",
    ],
    adjacent: {
      application_security: {
        weight: 0.8,
        reason:
          "Testers who tire of writing reports move into fixing the classes of flaw they keep finding.",
      },
      security_operations: {
        weight: 0.6,
        reason:
          "Red team exercises are scored by whether the operations centre detects and contains them.",
      },
      cryptography: {
        weight: 0.5,
        reason:
          "Testers routinely find weak TLS configuration, home-rolled token signing and predictable key material, which is where the two disciplines meet.",
      },
      security_engineering: {
        weight: 0.6,
        reason:
          "Testers see exactly which controls fail, the fastest route into designing better ones.",
      },
    },
  },
  pension_consulting: {
    label: "Pension Consulting",
    aliases: [
      "pension consultant",
      "pension scheme actuary",
      "defined benefit scheme",
      "defined contribution scheme",
      "scheme funding valuation",
      "pension administration",
      "auto enrolment",
      "pension risk transfer",
      "liability driven investment",
      "employee benefit consulting",
      "pension trustee advisory",
      "pension consulting",
    ],
    adjacent: {
      actuarial_practice: {
        weight: 0.8,
        reason:
          "Scheme funding, liability valuation and buyout pricing are actuarial calculations signed by qualified actuaries.",
      },
      wealth_management: {
        weight: 0.6,
        reason:
          "Members take retirement income advice, so consultants and advisers work the same benefit and transfer value questions.",
      },
      payroll_administration: {
        weight: 0.6,
        reason:
          "Contributions and auto enrolment assessments run through payroll, so scheme administration depends on payroll data being right.",
      },
      people_operations: {
        weight: 0.6,
        reason:
          "Benefit design and member communication sit with the reward function, which commissions and manages the consultant.",
      },
    },
  },
  performance_marketing: {
    label: "Performance Marketing",
    aliases: [
      "performance marketing",
      "paid acquisition",
      "paid media buying",
      "media buyer",
      "paid search management",
      "search engine marketing",
      "ppc",
      "pay per click",
      "paid social",
      "roas",
      "return on ad spend",
      "biddable media",
    ],
    adjacent: {
      growth_marketing: {
        weight: 0.8,
        reason:
          "Paid acquisition is the fuel most growth experiments burn, and both are judged on cost per activated user.",
      },
      demand_generation: {
        weight: 0.8,
        reason:
          "Paid channels carry most of the demand budget and are reported against the same pipeline and cost per opportunity targets.",
      },
      search_engine_optimization: {
        weight: 0.7,
        reason:
          "Paid and organic search compete for the same queries, so keyword sets, landing pages and cannibalisation are managed together.",
      },
      ecommerce_trading: {
        weight: 0.6,
        reason:
          "Shopping feeds and retail media are bought by the same people who set the weekly online trading plan.",
      },
      marketing_operations: {
        weight: 0.55,
        reason:
          "Tracking parameters, pixel deployment and conversion feeds must be built and audited before paid spend can be measured at all.",
      },
    },
  },
  perioperative_nursing: {
    label: "Perioperative Nursing",
    aliases: [
      "theatre nurse",
      "scrub nurse",
      "operating room nurse",
      "perioperative nurse",
      "circulating nurse",
      "recovery nurse",
      "odp",
      "operating department practitioner",
      "cnor",
      "anaesthetic nurse",
      "sterile field management",
      "perioperative nursing",
    ],
    adjacent: {
      surgical_practice: {
        weight: 0.85,
        reason:
          "The scrub practitioner anticipates every step of the operation and is judged on knowing the surgeon's procedure as well as the surgeon.",
      },
      anaesthesia: {
        weight: 0.7,
        reason:
          "Anaesthetic nurses and operating department practitioners assist induction, intubation and regional blocks alongside the anaesthetist.",
      },
      registered_nursing: {
        weight: 0.8,
        reason:
          "Scrub and recovery nurses hold the same nursing registration as ward nurses and move between theatre, recovery and ward posts through a career.",
      },
      infection_prevention: {
        weight: 0.6,
        reason:
          "Sterile field discipline, instrument decontamination and surgical site infection rates are owned inside the operating suite.",
      },
    },
  },
  petroleum_engineering: {
    label: "Petroleum Engineering",
    onet: "17-2171.00",
    aliases: [
      "petroleum engineer",
      "reservoir engineer",
      "reservoir simulation",
      "well completion design",
      "artificial lift",
      "enhanced oil recovery",
      "upstream oil and gas",
      "field development plan",
      "well intervention",
      "hydrocarbon production forecasting",
      "petroleum engineering",
    ],
    adjacent: {
      drilling_engineering: {
        weight: 0.8,
        reason:
          "A field development plan is executed as a well programme, so reservoir and drilling engineers size the same well.",
      },
      geology: {
        weight: 0.7,
        reason:
          "Production forecasts rest on a reservoir model built from cores, logs and structural interpretation.",
      },
      subsea_engineering: {
        weight: 0.65,
        reason:
          "Offshore fields are produced through subsea trees, risers and flowlines specified to the reservoir requirement.",
      },
      geophysics: {
        weight: 0.6,
        reason:
          "Reserves booking and well placement come from seismic interpretation of the same subsurface volume.",
      },
      process_safety: {
        weight: 0.55,
        reason:
          "Topside separation and pressure containment fall squarely under major accident hazard control.",
      },
    },
  },
  pharmaceutical_microbiology: {
    label: "Pharmaceutical Microbiology",
    onet: "19-1022.00",
    aliases: [
      "pharmaceutical microbiology",
      "microbiological environmental monitoring",
      "sterility assurance",
      "aseptic processing",
      "bioburden testing",
      "endotoxin testing",
      "microbial identification",
      "contamination control strategy",
      "cleanroom microbiology",
      "aseptic media fill",
    ],
    adjacent: {
      gmp_quality_assurance: {
        weight: 0.8,
        reason:
          "A sterility failure or monitoring excursion becomes a formal deviation with a root cause investigation quality owns.",
      },
      validation_qualification: {
        weight: 0.75,
        reason:
          "Sterilisation cycles, media fills and cleanroom classification are all formal validation exercises.",
      },
      laboratory_management: {
        weight: 0.7,
        reason:
          "Running a QC micro lab is sample logistics, staffing and method control as much as it is microbiology.",
      },
      bioprocess_development: {
        weight: 0.6,
        reason:
          "A contaminated bioreactor campaign is diagnosed and traced by the microbiology group.",
      },
    },
  },
  pharmacovigilance: {
    label: "Pharmacovigilance",
    aliases: [
      "pharmacovigilance",
      "drug safety physician",
      "adverse event reporting",
      "safety signal detection",
      "individual case safety report",
      "psur",
      "pbrer",
      "argus safety",
      "pharmacovigilance risk management plan",
      "aggregate safety report",
      "qppv",
      "drug safety database",
    ],
    adjacent: {
      regulatory_affairs: {
        weight: 0.75,
        reason:
          "Safety reporting obligations are conditions written into the licence the regulatory team maintains.",
      },
      medical_affairs: {
        weight: 0.7,
        reason:
          "Both answer clinical questions about a marketed product, and safety physicians often move across into medical affairs.",
      },
      clinical_trial_management: {
        weight: 0.65,
        reason:
          "Trial site safety reports flow into the same case processing system that handles marketed product reports.",
      },
      clinical_practice: {
        weight: 0.6,
        reason:
          "Causality assessment needs a clinician's judgement about an individual patient's history and concomitant treatment.",
      },
    },
  },
  pharmacy_practice: {
    label: "Pharmacy Practice",
    onet: "29-1051.00",
    aliases: [
      "pharmacist",
      "pharmacy technician",
      "clinical pharmacist",
      "pharmd",
      "mpharm",
      "gphc",
      "rph",
      "drop; 'community pharmacy' and 'aseptic dispensing' already cover dispensing work",
      "medicine reconciliation",
      "formulary review",
      "community pharmacy",
      "aseptic dispensing",
      "antimicrobial pharmacist",
      "pharmacy practice",
    ],
    adjacent: {
      general_practice: {
        weight: 0.7,
        reason:
          "Practice pharmacists run medication reviews and repeat prescribing inside GP surgeries alongside the doctors.",
      },
      infection_prevention: {
        weight: 0.65,
        reason:
          "Antimicrobial stewardship is led by pharmacists and is one half of any hospital infection control programme.",
      },
      patient_safety: {
        weight: 0.6,
        reason:
          "Medication error is the largest single category of hospital harm and pharmacy owns its analysis and prevention.",
      },
      oncology: {
        weight: 0.55,
        reason:
          "Chemotherapy is verified and compounded aseptically by oncology pharmacists before any dose reaches the day unit.",
      },
    },
  },
  photography: {
    label: "Photography",
    onet: "27-4021.00",
    aliases: [
      "photographer",
      "commercial photographer",
      "portrait photographer",
      "photojournalist",
      "studio photographer",
      "retoucher",
      "product photography",
      "fashion photography",
      "picture editor",
      "photography",
    ],
    adjacent: {
      videography: {
        weight: 0.8,
        reason:
          "Stills and motion share lenses, lighting and exposure craft, and most working photographers now shoot both.",
      },
      art_direction: {
        weight: 0.7,
        reason:
          "Photographers deliver to an art director's brief and mood board, and the good ones argue the frame back.",
      },
      visual_design: {
        weight: 0.6,
        reason:
          "Retouching, crop and colour decisions are made against the layout the image has to live inside.",
      },
      journalism: {
        weight: 0.6,
        reason:
          "Photojournalism is reporting with a camera, with the same access, ethics and caption accuracy demands.",
      },
    },
  },
  physiotherapy: {
    label: "Physiotherapy",
    onet: "29-1123.00",
    aliases: [
      "physiotherapist",
      "physical therapist",
      "physiotherapy",
      "musculoskeletal physiotherapy",
      "respiratory physiotherapy",
      "dpt",
      "mcsp",
      "drop; 'musculoskeletal physiotherapy' and 'mcsp' identify the profession",
      "gait retraining",
      "sports physiotherapy",
      "neurological rehabilitation",
    ],
    adjacent: {
      occupational_therapy: {
        weight: 0.8,
        reason:
          "Physio and occupational therapy share a rehabilitation caseload and jointly set the discharge plan for the same patient.",
      },
      speech_language_therapy: {
        weight: 0.55,
        reason:
          "Stroke and head-injury rehabilitation is planned as one programme, with physiotherapy taking posture and mobility while speech therapy takes swallow and communication for the same patient.",
      },
      surgical_practice: {
        weight: 0.5,
        reason:
          "Orthopaedic surgery and physiotherapy share one post-operative pathway and the same functional outcome measures.",
      },
      clinical_practice: {
        weight: 0.75,
        reason:
          "Physiotherapists assess, diagnose movement disorders and treat as first-contact practitioners without medical referral.",
      },
    },
  },
  pipeline_integrity: {
    label: "Pipeline Integrity",
    aliases: [
      "pipeline integrity",
      "asset integrity management",
      "in line pipeline inspection",
      "intelligent pigging",
      "cathodic protection",
      "corrosion engineer",
      "fitness for service",
      "risk based inspection",
      "api 570",
    ],
    adjacent: {
      process_safety: {
        weight: 0.7,
        reason:
          "Loss of containment from a pipeline is a major accident hazard handled in the same risk-based framework.",
      },
      materials_science: {
        weight: 0.65,
        reason:
          "Corrosion mechanism, weld metallurgy and fracture toughness govern every fitness for service decision.",
      },
      subsea_engineering: {
        weight: 0.6,
        reason:
          "Subsea flowlines and risers are the hardest integrity population, inspected with subsea vessels and tooling.",
      },
      petroleum_engineering: {
        weight: 0.55,
        reason:
          "Pipelines carry produced fluids whose composition, water cut and pressure regime come from production engineering.",
      },
    },
  },
  platform_engineering: {
    label: "Platform Engineering",
    aliases: [
      "platform engineer",
      "internal developer platform",
      "infrastructure engineer",
      "kubernetes platform",
      "developer experience engineer",
      "backstage developer portal",
      "terraform module",
      "cloud platform engineer",
      "self service infrastructure",
      "platform engineering",
    ],
    adjacent: {
      devops: {
        weight: 0.85,
        reason:
          "Platform teams productise the automation DevOps engineers first wrote as one-off pipelines.",
      },
      site_reliability_engineering: {
        weight: 0.8,
        reason:
          "Both own the runtime other teams deploy onto, and share the pager when it misbehaves.",
      },
      cloud_architecture: {
        weight: 0.7,
        reason:
          "Platform teams implement, in Terraform, the account and network topology an architect designs.",
      },
      developer_tooling: {
        weight: 0.7,
        reason:
          "An internal platform is mostly developer tooling with a runtime bolted underneath it.",
      },
    },
  },
  plumbing_heating: {
    label: "Plumbing & Heating",
    onet: "47-2152.00",
    aliases: [
      "plumber",
      "plumbing and heating engineer",
      "heating engineer",
      "gas safe registered",
      "domestic gas engineer",
      "commercial gas engineer",
      "boiler installation",
      "pipefitting",
      "underfloor heating installation",
      "drainage installation",
      "journeyman plumber",
      "plumbing & heating",
    ],
    adjacent: {
      hvac_service: {
        weight: 0.7,
        reason:
          "Heat pumps and boiler plant put the heating trade and the ventilation trade on the same system.",
      },
      industrial_maintenance: {
        weight: 0.55,
        reason:
          "Process water, steam and drainage systems in a plant are maintained with the same pipework skills.",
      },
      welding_fabrication: {
        weight: 0.5,
        reason:
          "Larger pipework is welded or brazed, so pipefitting and welding tickets travel together.",
      },
      electrical_installation: {
        weight: 0.5,
        reason:
          "Controls, pumps and immersion circuits need the wiring and testing side of the same install.",
      },
    },
  },
  policing_practice: {
    label: "Policing Practice",
    onet: "33-3051.00",
    aliases: [
      "police constable",
      "detective constable",
      "detective sergeant",
      "senior investigating officer",
      "neighbourhood policing",
      "criminal investigation",
      "custody sergeant",
      "roads policing",
      "police staff investigator",
      "public protection unit",
      "pip2 accredited",
      "response policing",
      "policing practice",
    ],
    adjacent: {
      intelligence_analysis: {
        weight: 0.7,
        reason:
          "Investigations are tasked and directed by intelligence products, and detectives work daily with force analysts on the same operation.",
      },
      probation_practice: {
        weight: 0.7,
        reason:
          "Police and probation jointly manage the highest-risk offenders released into the community.",
      },
      safeguarding_practice: {
        weight: 0.7,
        reason:
          "Child and adult protection investigations are run jointly with social care from first referral.",
      },
      border_and_customs: {
        weight: 0.6,
        reason:
          "Ports policing and customs enforcement share powers of search, seizure and casework.",
      },
      fire_and_rescue: {
        weight: 0.5,
        reason:
          "Blue-light services train, exercise and command together at every major incident.",
      },
    },
  },
  port_operations: {
    label: "Port & Terminal Operations",
    aliases: [
      "port operation",
      "container terminal operation",
      "container terminal",
      "stevedore",
      "stevedoring",
      "harbour master",
      "harbor master",
      "quay crane",
      "vessel planner",
      "yard planner",
      "berth planning",
      "port authority",
      "port & terminal operations",
    ],
    adjacent: {
      freight_forwarding: {
        weight: 0.7,
        reason:
          "the terminal executes the booking, container release and clearance sequence the forwarder set up",
      },
      marine_operations: {
        weight: 0.65,
        reason:
          "berth allocation and cargo operations are agreed vessel by vessel with the ship's superintendent and master",
      },
      warehouse_operations: {
        weight: 0.6,
        reason:
          "a container yard is planned with the same slotting, equipment and shift-planning method as a distribution centre",
      },
      robotics: {
        weight: 0.5,
        reason:
          "automated stacking cranes and driverless horizontal transport mean yard planning is done against a machine fleet's cycle times, so planners work daily with the automation engineers who tune it",
      },
    },
  },
  portfolio_management: {
    label: "Portfolio Management",
    onet: "11-3031.03",
    aliases: [
      "investment portfolio manager",
      "fund manager",
      "asset allocation",
      "discretionary portfolio management",
      "multi asset portfolio",
      "long short equity",
      "fixed income portfolio management",
      "performance attribution",
      "investment mandate",
      "cfa charterholder",
      "buy side investor",
      "portfolio management",
    ],
    adjacent: {
      equity_research: {
        weight: 0.75,
        reason:
          "Portfolio managers consume and challenge research theses daily, and most were analysts before they were given a book to run.",
      },
      quantitative_research: {
        weight: 0.7,
        reason:
          "Factor exposure, risk budgeting and attribution are quantitative outputs a manager uses to build and defend positions.",
      },
      wealth_management: {
        weight: 0.65,
        reason:
          "Private client money is run against model portfolios, so advisers and managers share asset allocation and mandate discipline.",
      },
      credit_research: {
        weight: 0.6,
        reason:
          "Multi asset and fixed income books are assembled from the issuer level credit views research produces.",
      },
      fund_accounting: {
        weight: 0.5,
        reason:
          "Net asset values and investor reporting are struck from the manager's own positions, so the two functions reconcile constantly.",
      },
    },
  },
  power_systems: {
    label: "Power Systems Engineering",
    onet: "17-2071.00",
    aliases: [
      "power system engineer",
      "load flow study",
      "short circuit study",
      "power system protection",
      "grid code compliance",
      "grid connection study",
      "digsilent powerfactory",
      "pscad",
      "power system stability analysis",
      "reactive power compensation",
      "power systems engineering",
    ],
    adjacent: {
      high_voltage_transmission: {
        weight: 0.8,
        reason:
          "Transmission design is where power system studies land as conductor, insulation and converter choices.",
      },
      substation_engineering: {
        weight: 0.75,
        reason:
          "Protection settings and busbar arrangements are the physical output of fault level and load flow studies.",
      },
      distribution_networks: {
        weight: 0.75,
        reason:
          "The same modelling tools are used at 11kV as at 400kV, with different fault levels and constraint rules.",
      },
      solar_pv: {
        weight: 0.6,
        reason:
          "Renewable plants must prove grid code compliance, which is written as a power system study report.",
      },
      energy_trading: {
        weight: 0.55,
        reason:
          "Traders price congestion and balancing actions that only make sense once network constraints are understood.",
      },
    },
  },
  pricing_strategy: {
    label: "Pricing & Monetisation",
    aliases: [
      "pricing strategy",
      "pricing manager",
      "monetisation strategy",
      "monetization strategy",
      "price architecture",
      "packaging and pricing",
      "discount governance",
      "price elasticity analysis",
      "revenue management",
      "yield management",
      "margin optimisation",
      "pricing & monetisation",
    ],
    adjacent: {
      market_research: {
        weight: 0.7,
        reason:
          "Willingness-to-pay work, conjoint studies and price sensitivity testing are what a price move is justified with.",
      },
      corporate_finance: {
        weight: 0.65,
        reason:
          "Any price change is modelled as a margin and revenue case before it is approved and put into the plan.",
      },
      ecommerce_trading: {
        weight: 0.6,
        reason:
          "Online price, promotion depth and competitor matching are traded weekly against a margin target.",
      },
      revenue_operations: {
        weight: 0.55,
        reason:
          "Discount bands and approval rules only bite once the deal desk enforces them in the quoting workflow.",
      },
      product_marketing: {
        weight: 0.55,
        reason:
          "Tiers, packaging and what sits behind an upgrade are decided with the people who write the offer.",
      },
    },
  },
  private_equity: {
    label: "Private Equity",
    aliases: [
      "private equity",
      "private equity associate",
      "leveraged buyout",
      "lbo model",
      "buyout fund",
      "growth equity",
      "portfolio company value creation",
      "deal origination",
      "secondaries investing",
      "mid market buyout",
    ],
    adjacent: {
      investment_banking: {
        weight: 0.8,
        reason:
          "Funds hire from banking analyst programmes, and both run the same modelling, diligence and execution work on a transaction.",
      },
      transaction_services: {
        weight: 0.75,
        reason:
          "Buy side diligence is commissioned by the deal team, who read the quality of earnings report and rebuild their model from it.",
      },
      valuation_advisory: {
        weight: 0.7,
        reason:
          "Entry price, portfolio holding marks and exit analysis are all valuation exercises under the same accepted methods.",
      },
      venture_capital: {
        weight: 0.65,
        reason:
          "Both source, diligence and govern private companies to an exit, differing mainly in stage and in capital structure.",
      },
      corporate_finance: {
        weight: 0.6,
        reason:
          "Portfolio company boards demand the budgeting, capital structure and cash discipline an in house finance team provides.",
      },
    },
  },
  probation_practice: {
    label: "Probation And Offender Management",
    onet: "21-1092.00",
    aliases: [
      "probation officer",
      "probation service officer",
      "offender management",
      "parole officer",
      "community rehabilitation company",
      "prison offender manager",
      "mappa",
      "resettlement worker",
      "sentence planning",
      "risk of serious harm assessment",
      "youth offending worker",
      "probation and offender management",
    ],
    adjacent: {
      social_work: {
        weight: 0.7,
        reason:
          "Probation is statutory casework: assessment, supervision and multi-agency planning to a record.",
      },
      policing_practice: {
        weight: 0.7,
        reason:
          "Police and probation jointly manage the highest-risk offenders under the same arrangements.",
      },
      housing_management: {
        weight: 0.6,
        reason:
          "Resettlement fails without accommodation, so offender managers negotiate with housing providers.",
      },
      safeguarding_practice: {
        weight: 0.6,
        reason:
          "Public protection and safeguarding share the same multi-agency meetings and risk language.",
      },
    },
  },
  process_chemistry: {
    label: "Process Chemistry",
    aliases: [
      "process chemistry",
      "process chemist",
      "api manufacturing",
      "route scouting",
      "kilo lab",
      "scale up synthesis",
      "chemical development",
      "crystallization development",
      "flow chemistry",
      "impurity control strategy",
      "drug substance process",
    ],
    adjacent: {
      medicinal_chemistry: {
        weight: 0.8,
        reason:
          "Process chemists take over the discovery route and rebuild it for cost, safety and impurity control at scale.",
      },
      regulatory_cmc: {
        weight: 0.75,
        reason:
          "The drug substance process and its controls are written up as the manufacturing section of the dossier.",
      },
      analytical_chemistry: {
        weight: 0.75,
        reason:
          "Impurity profiling and in-process controls depend on methods the analytical group develops alongside the route.",
      },
      formulation_development: {
        weight: 0.7,
        reason:
          "Crystal form and particle size delivered by the process chemist decide what the formulator can actually make.",
      },
      materials_science: {
        weight: 0.6,
        reason:
          "Polymorph screening and solid form selection is solid-state materials work applied to an active ingredient.",
      },
    },
  },
  process_engineering: {
    label: "Process Engineering",
    aliases: [
      "process engineer",
      "process engineering",
      "manufacturing process engineer",
      "process development engineer",
      "chemical process engineer",
      "process capability study",
      "cpk",
      "production yield improvement",
      "process window",
    ],
    adjacent: {
      manufacturing_engineering: {
        weight: 0.8,
        reason:
          "Both own how a part is actually made on the line, and people move between the two titles on the same equipment.",
      },
      six_sigma: {
        weight: 0.7,
        reason:
          "Process engineers prove settings with capability studies and designed experiments, which is the core statistical toolkit of six sigma.",
      },
      quality_engineering: {
        weight: 0.65,
        reason:
          "A capability problem and a defect escape are the same failure seen from two sides of the same line.",
      },
      production_management: {
        weight: 0.6,
        reason:
          "Process engineers set the cycle times and yields a plant is then held to, so many step into running the line.",
      },
      materials_science: {
        weight: 0.55,
        reason:
          "Setting a process window means predicting how the material behaves at temperature and pressure, which is applied materials work.",
      },
    },
  },
  process_safety: {
    label: "Process Safety Management",
    aliases: [
      "process safety",
      "hazop",
      "layer of protection analysis",
      "lopa",
      "sil assessment",
      "comah",
      "qra study",
      "bowtie analysis",
      "relief system design",
      "atex compliance",
      "process safety management",
    ],
    adjacent: {
      functional_safety: {
        weight: 0.75,
        reason:
          "SIL determination and safety instrumented system design is the shared method, one in plant and one in product.",
      },
      hse_management: {
        weight: 0.7,
        reason:
          "Both run on hazard identification, permit systems and incident investigation under the same regulator.",
      },
      pipeline_integrity: {
        weight: 0.6,
        reason:
          "Containment failure is the hazard, so inspection intervals are set from the same risk assessment.",
      },
      petroleum_engineering: {
        weight: 0.6,
        reason:
          "Major accident hazard method was written for chemical and hydrocarbon process plant, where most process safety engineers still work.",
      },
      nuclear_engineering: {
        weight: 0.55,
        reason:
          "Nuclear safety cases and chemical major hazard cases share fault tree and consequence modelling technique.",
      },
    },
  },
  procurement_finance: {
    label: "Procurement And Spend",
    onet: "13-1023.00",
    aliases: [
      "procurement manager",
      "strategic sourcing",
      "procurement category management",
      "supplier negotiation",
      "spend analysis",
      "purchase to pay",
      "procure to pay",
      "mcips",
      "cips",
      "supplier contract negotiation",
      "vendor onboarding",
      "procurement and spend",
    ],
    adjacent: {
      operational_finance: {
        weight: 0.75,
        reason:
          "Purchase to pay, accruals and supplier payment terms are jointly owned by procurement and the finance operations team.",
      },
      management_accounting: {
        weight: 0.65,
        reason:
          "Category savings only count once they appear in the management accounts, so both work the same cost base.",
      },
      indirect_tax: {
        weight: 0.55,
        reason:
          "Supplier invoice data and contract terms decide value added tax recovery, and procurement controls both at source.",
      },
    },
  },
  procurement_sourcing: {
    label: "Procurement & Strategic Sourcing",
    onet: "11-3061.00",
    aliases: [
      "procurement category manager",
      "purchasing manager",
      "senior buyer",
      "commodity buyer",
      "supplier relationship management",
      "cpsm",
      "procurement & strategic sourcing",
    ],
    adjacent: {
      supply_chain_planning: {
        weight: 0.75,
        reason:
          "buyers commit volume against the planner's forward requirement and share the same lead-time assumptions",
      },
      freight_forwarding: {
        weight: 0.6,
        reason:
          "freight is a bought category, and running a carrier rate tender is sourcing work done on forwarder terms",
      },
      corporate_finance: {
        weight: 0.6,
        reason:
          "sourcing savings are booked into budget, so category managers negotiate against finance-owned cost baselines",
      },
      facilities_management: {
        weight: 0.55,
        reason:
          "hard and soft FM contracts are tendered and performance-managed with the same category discipline",
      },
    },
  },
  product_design: {
    label: "Product Design",
    onet: "27-1021.00",
    aliases: [
      "product designer",
      "digital product design",
      "ux ui designer",
      "end to end product design",
      "product design lead",
      "app designer",
      "saas product design",
      "product design",
    ],
    adjacent: {
      user_experience_design: {
        weight: 0.9,
        reason:
          "Product designers own the experience end to end, so the two titles cover the same craft at different companies and hiring bars.",
      },
      interaction_design: {
        weight: 0.8,
        reason:
          "Deciding how a screen responds to a tap or a keystroke is the daily detail work inside any product design role.",
      },
      design_systems: {
        weight: 0.75,
        reason:
          "Product designers consume and extend the component library, and the strongest ones end up maintaining its patterns.",
      },
      user_research: {
        weight: 0.7,
        reason:
          "Product designers run their own interviews and usability sessions when there is no dedicated researcher on the team.",
      },
      software_engineering: {
        weight: 0.55,
        reason:
          "Product designers work to the same sprint and repo cadence as engineers and specify the component states and edge cases those engineers implement.",
      },
    },
  },
  product_marketing: {
    label: "Product Marketing",
    onet: "11-2021.00",
    aliases: [
      "product marketer",
      "product marketing manager",
      "pmm",
      "product positioning",
      "product launch management",
      "product messaging",
      "competitive positioning",
      "buyer persona research",
      "messaging framework",
    ],
    adjacent: {
      go_to_market: {
        weight: 0.85,
        reason:
          "The launch narrative, segmentation and pricing story that a go-to-market plan runs on are written by product marketing.",
      },
      market_research: {
        weight: 0.75,
        reason:
          "Positioning only holds up when it rests on win-loss interviews and buyer segmentation studies rather than opinion.",
      },
      demand_generation: {
        weight: 0.7,
        reason:
          "Campaign teams run the messaging, content and audience definitions product marketing hands them, against a shared pipeline number.",
      },
      sales_engineering: {
        weight: 0.6,
        reason:
          "Both turn technical capability into buyer-facing proof, sharing battlecards, demo scripts and objection handling.",
      },
      brand_marketing: {
        weight: 0.6,
        reason:
          "Both decide how the company sounds to a buyer and negotiate over the same claim set and visual system.",
      },
    },
  },
  production_management: {
    label: "Production & Plant Management",
    onet: "11-3051.00",
    aliases: [
      "production manager",
      "plant manager",
      "manufacturing manager",
      "factory manager",
      "production supervisor",
      "shop floor manager",
      "works manager",
      "head of manufacturing",
      "production management",
      "plant operations manager",
      "manufacturing operations manager",
      "production & plant management",
    ],
    adjacent: {
      lean_manufacturing: {
        weight: 0.75,
        reason:
          "Plant leaders are judged on throughput, downtime and inventory turns, the exact metrics a lean programme moves.",
      },
      production_planning: {
        weight: 0.7,
        reason:
          "The schedule and the shop floor are one loop, and the person running the line owns the plan they have to hit.",
      },
      industrial_safety: {
        weight: 0.65,
        reason:
          "The plant manager owns the site risk assessments, permit systems and incident actions that the safety function writes and audits.",
      },
      industrial_engineering: {
        weight: 0.6,
        reason:
          "Line balance, labour standards and layout changes are decided jointly with industrial engineering.",
      },
      quality_management_systems: {
        weight: 0.55,
        reason:
          "Plant leaders host the certification audit and own the site corrective actions it raises.",
      },
    },
  },
  production_planning: {
    label: "Production Planning & Scheduling",
    aliases: [
      "production planner",
      "production scheduler",
      "master production schedule",
      "master scheduler",
      "material requirements planning",
      "mrp",
      "apics",
      "cpim",
      "production capacity planning",
      "sales and operations planning",
      "finite scheduling",
      "production planning & scheduling",
    ],
    adjacent: {
      production_management: {
        weight: 0.7,
        reason:
          "The plan is only as good as the line running it, so planners and plant leaders share the same constraint data daily.",
      },
      industrial_engineering: {
        weight: 0.6,
        reason:
          "Capacity models are built from the cycle times and labour standards industrial engineers measure.",
      },
      lean_manufacturing: {
        weight: 0.6,
        reason:
          "Levelled scheduling and pull systems are planning decisions taken straight out of lean practice.",
      },
      operational_finance: {
        weight: 0.5,
        reason:
          "Inventory cover and standard cost variances fall out of the production plan and are reported by finance each month.",
      },
    },
  },
  property_development: {
    label: "Property Development",
    aliases: [
      "property developer",
      "real estate development",
      "real estate development manager",
      "residual land value appraisal",
      "land acquisition",
      "land assembly",
      "residential development manager",
      "commercial property development",
      "development viability appraisal",
      "property development",
    ],
    adjacent: {
      town_planning: {
        weight: 0.75,
        reason:
          "Securing consent is the largest single value step in a scheme, so developers run the planning strategy.",
      },
      quantity_surveying: {
        weight: 0.6,
        reason:
          "Build cost and contingency in the appraisal come straight from a cost consultant's plan.",
      },
      construction_project_management: {
        weight: 0.6,
        reason:
          "Once a scheme is funded the developer holds the client-side delivery and contract decisions.",
      },
      corporate_finance: {
        weight: 0.55,
        reason:
          "Development appraisals are cash flow models with debt, equity and exit assumptions to defend.",
      },
    },
  },
  psychiatry: {
    label: "Psychiatry",
    onet: "29-1223.00",
    aliases: [
      "psychiatrist",
      "psychiatry",
      "mrcpsych",
      "liaison psychiatry",
      "forensic psychiatry",
      "child and adolescent psychiatry",
      "psychopharmacology",
      "inpatient psychiatric unit",
      "community mental health team",
      "addiction psychiatry",
      "abpn",
    ],
    adjacent: {
      mental_health_practice: {
        weight: 0.9,
        reason:
          "Psychiatrists lead the same multidisciplinary teams as mental health nurses and therapists and share one caseload.",
      },
      general_practice: {
        weight: 0.6,
        reason:
          "Most mental illness is managed in primary care, with psychiatry advising on diagnosis and drug choice for the harder cases.",
      },
      paediatrics: {
        weight: 0.5,
        reason:
          "Child and adolescent services sit between the two, sharing developmental assessment and safeguarding responsibility.",
      },
      clinical_practice: {
        weight: 0.8,
        reason:
          "Psychiatry is clinical practice with statutory detention powers, prescribing and personal responsibility for risk decisions.",
      },
    },
  },
  public_policy_analysis: {
    label: "Public Policy Analysis",
    aliases: [
      "public policy",
      "policy analysis",
      "policy adviser",
      "policy officer",
      "regulatory impact assessment",
      "consultation response",
      "policy evaluation",
      "policy evidence review",
      "think tank",
      "green book appraisal",
      "policy briefing",
      "legislative analysis",
      "public policy analysis",
    ],
    adjacent: {
      parliamentary_practice: {
        weight: 0.8,
        reason:
          "Analysts brief ministers and committees, and staff rotate between department and legislature.",
      },
      local_government_administration: {
        weight: 0.6,
        reason:
          "Councils employ policy officers to write strategies and answer national consultations.",
      },
      defence_analysis: {
        weight: 0.5,
        reason:
          "A defence review is a spending and options case appraised like any other public programme.",
      },
      intelligence_analysis: {
        weight: 0.5,
        reason:
          "Both compress contested evidence into a short assessed judgement for one decision maker.",
      },
    },
  },
  public_relations: {
    label: "Public Relations",
    onet: "27-3031.00",
    aliases: [
      "public relation",
      "media relation",
      "press office",
      "press release writing",
      "corporate communication",
      "crisis communication",
      "media training",
      "earned media",
      "analyst relation",
      "communications manager",
      "public relations",
    ],
    adjacent: {
      internal_communications: {
        weight: 0.75,
        reason:
          "Every external announcement has to reach staff first, so one team drafts both versions of the same message.",
      },
      investor_relations: {
        weight: 0.65,
        reason:
          "Results announcements are written and rehearsed jointly so the market and the press are given one consistent story.",
      },
      brand_marketing: {
        weight: 0.65,
        reason:
          "Reputation and brand perception are tracked together, and a press moment is timed to a campaign beat.",
      },
      social_media_management: {
        weight: 0.6,
        reason:
          "A story that starts in a comment thread becomes a press matter within hours, so both share an escalation rota.",
      },
    },
  },
  quality_engineering: {
    label: "Quality Engineering",
    onet: "15-1253.00",
    aliases: [
      "software quality engineer",
      "test automation engineer",
      "qa engineer",
      "sdet",
      "playwright automation",
      "cypress test",
      "selenium webdriver",
      "test automation strategy",
      "regression suite",
      "istqb",
      "application performance testing",
      "manual tester",
      "quality engineering",
    ],
    adjacent: {
      software_engineering: {
        weight: 0.7,
        reason:
          "A modern suite is production-grade code with its own architecture, review and flakiness budget.",
      },
      frontend_engineering: {
        weight: 0.5,
        reason:
          "Browser automation demands the same DOM, selector and async knowledge as building the UI.",
      },
      devops: {
        weight: 0.6,
        reason:
          "Suites only pay off when they gate every pipeline commit, which the same people wire up.",
      },
      application_security: {
        weight: 0.5,
        reason:
          "Both gate the pipeline with automated checks and share the triage discipline for noisy, flaky findings nobody wants to own.",
      },
    },
  },
  quality_management_systems: {
    label: "Quality Management Systems",
    aliases: [
      "quality management system",
      "qms",
      "iso 9001",
      "iatf 16949",
      "as9100",
      "iso 13485",
      "quality auditor",
      "iso lead auditor",
      "quality systems manager",
      "quality document control",
      "quality system audit",
      "quality management systems",
    ],
    adjacent: {
      quality_engineering: {
        weight: 0.85,
        reason:
          "The system exists to hold the control plans and corrective actions the quality engineer produces.",
      },
      validation_engineering: {
        weight: 0.7,
        reason:
          "On regulated sites the validation protocols sit inside the certified system and are read in the same audit.",
      },
      supplier_quality: {
        weight: 0.7,
        reason:
          "Supplier approval and vendor auditing are clauses of the standard the system owner maintains.",
      },
      industrial_safety: {
        weight: 0.55,
        reason:
          "Sites run safety and quality standards through one audit, document control and corrective action process.",
      },
    },
  },
  quantitative_research: {
    label: "Quantitative Research",
    aliases: [
      "quantitative finance research",
      "quant researcher",
      "quantitative analyst",
      "factor model",
      "alpha signal research",
      "statistical arbitrage",
      "derivatives pricing model",
      "monte carlo pricing",
      "stochastic calculus",
      "quant developer",
      "quantitative research",
    ],
    adjacent: {
      systematic_trading: {
        weight: 0.85,
        reason:
          "A signal is worth only what the execution desk realises, so quants and systematic traders work one strategy from research to fill.",
      },
      machine_learning: {
        weight: 0.75,
        reason:
          "Alpha research uses the same statistical learning, feature construction and out of sample validation discipline as applied machine learning.",
      },
      financial_risk_management: {
        weight: 0.7,
        reason:
          "Pricing libraries, value at risk engines and stress scenarios are built with the same stochastic modelling techniques.",
      },
      portfolio_management: {
        weight: 0.65,
        reason:
          "Optimisation, factor exposure and risk budgeting are what turn a research signal into an actual portfolio.",
      },
      actuarial_practice: {
        weight: 0.55,
        reason:
          "Both price uncertain future cash flows with stochastic models and heavy statistical training, and actuaries move into quantitative finance.",
      },
    },
  },
  quantity_surveying: {
    label: "Quantity Surveying And Cost Management",
    onet: "13-1051.00",
    aliases: [
      "quantity surveyor",
      "mrics quantity surveyor",
      "cost consultant",
      "cost plan",
      "construction final account",
      "interim valuation",
      "construction commercial manager",
      "jct contract administration",
      "tender pricing",
      "quantity surveying and cost management",
    ],
    adjacent: {
      construction_estimating: {
        weight: 0.85,
        reason:
          "Both price work from measured quantities and build unit rates up from labour, plant and material.",
      },
      construction_project_management: {
        weight: 0.7,
        reason:
          "Valuations, variations and final accounts are settled beside the delivery team on the same contract.",
      },
      property_development: {
        weight: 0.6,
        reason:
          "A development appraisal stands on the quantity surveyor's build cost plan and contingency assumptions.",
      },
      operational_finance: {
        weight: 0.5,
        reason:
          "Monthly cost value reconciliation on a contract is the same margin and forecasting discipline.",
      },
    },
  },
  radiation_protection: {
    label: "Radiation Protection",
    aliases: [
      "radiation protection",
      "radiological protection",
      "health physicist",
      "radiation protection adviser",
      "radiation dose assessment",
      "alara",
      "criticality safety",
      "nuclear safety case",
      "radiological contamination monitoring",
      "shielding calculation",
    ],
    adjacent: {
      nuclear_engineering: {
        weight: 0.85,
        reason:
          "Dose and shielding work is carried out against reactor, fuel and waste source terms defined by nuclear engineers.",
      },
      occupational_hygiene: {
        weight: 0.65,
        reason:
          "Both measure worker exposure to a hazardous agent against statutory limits and control it by the same hierarchy.",
      },
      hse_management: {
        weight: 0.6,
        reason:
          "Radiological controls are enforced through permits, monitoring and incident reporting run by the safety function.",
      },
    },
  },
  radiology: {
    label: "Radiology",
    onet: "29-1224.00",
    aliases: [
      "radiologist",
      "diagnostic radiology",
      "interventional radiology",
      "neuroradiology",
      "musculoskeletal radiology",
      "frcr",
      "cross sectional imaging",
      "image reporting",
      "nuclear medicine reporting",
      "teleradiology",
      "breast imaging",
      "radiology",
    ],
    adjacent: {
      diagnostic_radiography: {
        weight: 0.85,
        reason:
          "Radiologists and radiographers work one imaging pathway, with protocolling, acquisition and reporting handed between them.",
      },
      oncology: {
        weight: 0.6,
        reason:
          "Cancer staging and response criteria are read by radiologists and drive the oncologist's next treatment decision.",
      },
      health_informatics: {
        weight: 0.55,
        reason:
          "Radiology was the first fully digital department, so PACS, worklists and reporting systems are a radiologist's daily tooling.",
      },
      machine_learning: {
        weight: 0.5,
        reason:
          "Imaging is where clinical machine learning is deployed first, and radiologists label, validate and sign off those models.",
      },
      sonography: {
        weight: 0.5,
        reason:
          "Radiologists supervise and report ultrasound lists, and set the scanning protocols sonographers follow.",
      },
    },
  },
  rail_operations: {
    label: "Rail Operations & Signalling",
    aliases: [
      "signalling engineer",
      "signaling engineer",
      "railway signaller",
      "rail operation",
      "train operation",
      "train planner",
      "train dispatcher",
      "rolling stock engineer",
      "permanent way",
      "interlocking design",
      "ertms",
      "cbtc",
      "irse",
      "rail operations & signalling",
    ],
    adjacent: {
      functional_safety: {
        weight: 0.7,
        reason:
          "signalling is developed to SIL levels under EN 50128 and 50129, the same safety-integrity practice used in vehicles",
      },
      embedded_systems: {
        weight: 0.6,
        reason:
          "modern interlockings and on-board train protection units are hard real-time embedded computers",
      },
      port_operations: {
        weight: 0.5,
        reason:
          "port rail terminals are pathed and shunted by rail staff moving container trains off the quay",
      },
    },
  },
  real_estate_law: {
    label: "Real Estate And Property Law",
    onet: "23-1011.00",
    aliases: [
      "real estate attorney",
      "property lawyer",
      "conveyancer",
      "licensed conveyancer",
      "commercial property lawyer",
      "residential conveyancing",
      "landlord and tenant law",
      "commercial lease drafting",
      "title examination",
      "land registry application",
      "real estate closing attorney",
      "leasehold enfranchisement",
      "real estate and property law",
    ],
    adjacent: {
      construction_law: {
        weight: 0.65,
        reason:
          "Development sites move from acquisition into building contracts, so property and construction lawyers hand the same site along.",
      },
      corporate_ma_law: {
        weight: 0.55,
        reason:
          "Property-heavy acquisitions turn on title, lease and covenant diligence run by the real estate team inside the deal.",
      },
      contract_management: {
        weight: 0.55,
        reason:
          "Leases and development agreements are long-lived contracts administered through rent reviews, break options and renewals.",
      },
      tax_law: {
        weight: 0.5,
        reason:
          "Transfer taxes and the treatment of a holding structure decide how a property transaction is documented.",
      },
    },
  },
  registered_nursing: {
    label: "Registered Nursing",
    onet: "29-1141.00",
    aliases: [
      "staff nurse",
      "rn",
      "rgn",
      "ward nurse",
      "charge nurse",
      "bsn",
      "nmc registered",
      "med surg nurse",
      "bedside nursing",
      "nursing handover",
      "acute ward nursing",
      "registered nursing",
    ],
    adjacent: {
      clinical_practice: {
        weight: 0.9,
        reason:
          "Ward nursing is direct clinical practice: assessment, medication administration, escalation and documentation at the bedside.",
      },
      critical_care_nursing: {
        weight: 0.8,
        reason:
          "Ward nurses step up to intensive care after a critical care course; the assessment and drug administration base is identical.",
      },
      advanced_nurse_practice: {
        weight: 0.8,
        reason:
          "Advanced practice is the standard progression out of registered nursing, adding diagnosis and prescribing to the same caseload.",
      },
      patient_safety: {
        weight: 0.6,
        reason:
          "Nurses file and investigate most ward incident reports, which is the raw material of hospital patient safety work.",
      },
      healthcare_recruiting: {
        weight: 0.5,
        reason:
          "Former nurses move into nurse recruitment because they can read a nursing CV and judge ward-level competence quickly.",
      },
    },
  },
  regulatory_affairs: {
    label: "Regulatory Affairs",
    onet: "13-1041.07",
    aliases: [
      "regulatory affair",
      "regulatory submission",
      "regulatory strategist",
      "ind filing",
      "new drug application submission",
      "maa submission",
      "marketing authorisation",
      "fda submission",
      "regulatory intelligence",
      "ectd",
      "drug regulatory affair",
      "medical device submission",
      "health authority interaction",
      "regulatory affairs",
    ],
    adjacent: {
      regulatory_cmc: {
        weight: 0.85,
        reason:
          "The CMC writer builds module 3 of the very dossier the regulatory affairs lead files and defends with the agency.",
      },
      clinical_development: {
        weight: 0.75,
        reason:
          "Trial protocols are designed backwards from the evidence the regulatory dossier will have to carry.",
      },
      pharmacovigilance: {
        weight: 0.7,
        reason:
          "Periodic safety reporting is a written condition of the marketing authorisation the regulatory team holds.",
      },
      gmp_quality_assurance: {
        weight: 0.7,
        reason:
          "An inspection observation against the quality system is answered to the agency as a regulatory commitment.",
      },
      medical_writing: {
        weight: 0.65,
        reason:
          "Both assemble the common technical document, one drafting the summaries and the other filing them.",
      },
    },
  },
  regulatory_cmc: {
    label: "CMC Regulatory",
    aliases: [
      "cmc regulatory",
      "chemistry manufacturing and control",
      "cmc dossier",
      "ctd module 3",
      "comparability protocol",
      "post approval change",
      "variation filing",
      "cmc submission",
      "drug substance specification",
      "control strategy justification",
    ],
    adjacent: {
      regulatory_affairs: {
        weight: 0.85,
        reason:
          "CMC is one module of a submission the regulatory affairs lead owns end to end, and the two negotiate commitments together.",
      },
      bioprocess_development: {
        weight: 0.75,
        reason:
          "Process characterisation and design space data is exactly what a CMC section has to justify to the reviewer.",
      },
      analytical_chemistry: {
        weight: 0.7,
        reason:
          "Specifications and method validation reports written by analytical chemists become the filed control strategy.",
      },
      validation_qualification: {
        weight: 0.65,
        reason:
          "Process validation summaries and results are filed in the manufacturing section of the dossier and the full reports defended at inspection.",
      },
    },
  },
  regulatory_compliance: {
    label: "Regulatory Compliance",
    onet: "13-1041.00",
    aliases: [
      "regulatory compliance manager",
      "compliance officer",
      "compliance monitoring",
      "compliance risk assessment",
      "regulatory change management",
      "regulatory inspection readiness",
      "code of conduct programme",
      "compliance training",
      "compliance audit",
      "licensing and permit compliance",
      "regulatory reporting obligation",
      "ccep",
      "regulatory compliance",
    ],
    adjacent: {
      internal_audit: {
        weight: 0.7,
        reason:
          "Audit independently tests the controls compliance designed, so both work from one control matrix and finding log.",
      },
      enterprise_risk_management: {
        weight: 0.7,
        reason:
          "Compliance risk is one register in the enterprise framework, scored and reported on the same cycle.",
      },
      financial_services_regulation: {
        weight: 0.65,
        reason:
          "Sector compliance is this discipline applied to one supervisor's rulebook, returns and inspection regime.",
      },
      corporate_governance: {
        weight: 0.6,
        reason:
          "Compliance reports to the board or audit committee inside the papers the governance team assembles.",
      },
    },
  },
  reinsurance: {
    label: "Reinsurance",
    aliases: [
      "reinsurance",
      "reinsurance broker",
      "treaty reinsurance",
      "facultative reinsurance",
      "excess of loss treaty",
      "catastrophe reinsurance",
      "retrocession",
      "reinsurance pricing",
      "ceded reinsurance",
      "insurance linked security",
      "reinsurance placement",
    ],
    adjacent: {
      insurance_underwriting: {
        weight: 0.8,
        reason:
          "Reinsurance underwriting is the same risk selection and pricing discipline applied to a cedant's portfolio rather than one policy.",
      },
      actuarial_practice: {
        weight: 0.75,
        reason:
          "Treaty and catastrophe pricing is actuarial tail modelling, and reinsurers employ actuaries throughout underwriting.",
      },
      claims_handling: {
        weight: 0.6,
        reason:
          "Recoveries turn on how the cedant reserved and presented the underlying claims under the treaty terms.",
      },
    },
  },
  reliability_engineering: {
    label: "Reliability Engineering",
    aliases: [
      "maintenance and reliability engineer",
      "reliability centred maintenance",
      "reliability centered maintenance",
      "root cause failure analysis",
      "vibration analysis",
      "condition monitoring",
      "cmrp",
      "total productive maintenance",
      "predictive maintenance",
      "mean time between failure",
      "reliability engineering",
    ],
    adjacent: {
      industrial_maintenance: {
        weight: 0.85,
        reason:
          "Reliability engineers write the maintenance strategy the technicians on shift actually execute.",
      },
      functional_safety: {
        weight: 0.6,
        reason:
          "Both put numbers on failure modes and failure rates, and MTBF work feeds safety integrity calculations directly.",
      },
      industrial_automation: {
        weight: 0.6,
        reason:
          "Condition data comes off PLCs, drives and historians, so failure analysis runs through the control system.",
      },
      process_engineering: {
        weight: 0.55,
        reason:
          "Chronic downtime is usually a process problem, so the two investigate the same production losses together.",
      },
      quality_engineering: {
        weight: 0.5,
        reason:
          "FMEA is the shared method, applied to equipment failure in one case and product defects in the other.",
      },
    },
  },
  renewals_management: {
    label: "Renewals Management",
    aliases: [
      "renewal manager",
      "subscription renewal",
      "renewal rate",
      "renewal forecast",
      "renewal negotiation",
      "gross retention rate",
      "renewal desk",
      "multi year renewal",
      "renewal specialist",
      "renewals management",
    ],
    adjacent: {
      customer_success: {
        weight: 0.85,
        reason:
          "A renewal is won months earlier through adoption work, and both roles are judged on retained revenue.",
      },
      account_management: {
        weight: 0.7,
        reason:
          "The same person often negotiates the renewal and the expansion, using one commercial relationship.",
      },
      revenue_operations: {
        weight: 0.6,
        reason:
          "Renewal forecasting depends on clean contract, term and price records held in the CRM and billing systems.",
      },
      pricing_strategy: {
        weight: 0.55,
        reason:
          "Uplift caps, discount recovery and multi-year terms are pricing decisions applied at the renewal point.",
      },
    },
  },
  research_administration: {
    label: "Research Administration",
    aliases: [
      "research administration",
      "research office",
      "research governance",
      "pre award administration",
      "post award administration",
      "research integrity",
      "ethics committee administration",
      "ref submission",
      "research contract negotiation",
      "sponsored research office",
      "principal investigator support",
    ],
    adjacent: {
      research_funding: {
        weight: 0.9,
        reason:
          "Pre-award teams cost and submit the very grants the funding role then manages to closure.",
      },
      research_science: {
        weight: 0.7,
        reason:
          "The role serves investigators and needs enough method literacy to read a protocol critically.",
      },
      higher_education_lecturing: {
        weight: 0.6,
        reason:
          "Research offices work daily with academics on ethics approval, contracts and published outputs.",
      },
      operational_finance: {
        weight: 0.5,
        reason:
          "Post-award work is grant budget control, reconciliation and reporting to a funder's audit.",
      },
    },
  },
  research_funding: {
    label: "Research Funding Management",
    aliases: [
      "research grant management",
      "research grant writing",
      "funding bid",
      "ukri funding",
      "horizon europe",
      "nih grant",
      "full economic costing",
      "research bid writing",
      "funder reporting",
      "grant costing",
      "research funding",
      "research funding management",
    ],
    adjacent: {
      research_administration: {
        weight: 0.9,
        reason:
          "The same office runs costing, submission and post-award reporting on a single grant.",
      },
      grant_making: {
        weight: 0.7,
        reason:
          "Applying for and awarding funds are two sides of one assessment process and people switch sides.",
      },
      research_science: {
        weight: 0.7,
        reason:
          "Writing a competitive bid means understanding and defending the method being proposed.",
      },
      corporate_finance: {
        weight: 0.5,
        reason:
          "Costing a multi-year award is budgeting, forecasting and overhead recovery under rules.",
      },
    },
  },
  restructuring_advisory: {
    label: "Restructuring And Insolvency",
    aliases: [
      "restructuring advisory",
      "corporate restructuring advisory",
      "debt restructuring",
      "insolvency practitioner",
      "turnaround advisory",
      "distressed transaction",
      "chapter 11 advisory",
      "independent business review",
      "creditor negotiation",
      "13 week cash flow",
      "restructuring and insolvency",
    ],
    adjacent: {
      credit_analysis: {
        weight: 0.75,
        reason:
          "A restructuring starts from the lender's credit view of the borrower and is negotiated with those same credit committees.",
      },
      transaction_services: {
        weight: 0.65,
        reason:
          "Independent business reviews and accelerated sales use the same diligence and cash analysis as deal advisory work.",
      },
      credit_research: {
        weight: 0.6,
        reason:
          "Distressed investors and restructuring advisers both model recovery values across the capital structure.",
      },
      corporate_finance: {
        weight: 0.6,
        reason:
          "A turnaround is run on short term cash flow and covenant headroom, the core tools of an in house finance team.",
      },
    },
  },
  revenue_operations: {
    label: "Revenue Operations",
    aliases: [
      "revenue operation",
      "revops",
      "sales operation",
      "deal desk",
      "pipeline forecasting",
      "salesforce administration",
      "territory and quota planning",
      "sales compensation planning",
      "crm administration",
      "funnel reporting",
      "revenue operations",
    ],
    adjacent: {
      marketing_operations: {
        weight: 0.8,
        reason:
          "Both administer the same CRM and automation stack, and a record handed between them must survive one shared data model.",
      },
      go_to_market: {
        weight: 0.75,
        reason:
          "Territory design, quota setting and segment coverage are the operating detail of a go-to-market plan.",
      },
      sales_leadership: {
        weight: 0.7,
        reason:
          "Forecast calls, pipeline reviews and compensation plans are prepared by revenue operations for sales leaders to run.",
      },
      operational_finance: {
        weight: 0.6,
        reason:
          "Bookings, recurring revenue and commission accruals have to tie out to the numbers finance reports.",
      },
      pricing_strategy: {
        weight: 0.55,
        reason:
          "The deal desk applies discount bands and approval thresholds that pricing sets, and feeds back where they break.",
      },
    },
  },
  safeguarding_practice: {
    label: "Safeguarding Practice",
    aliases: [
      "safeguarding lead",
      "designated safeguarding lead",
      "child protection conference",
      "safeguarding adult",
      "multi agency safeguarding hub",
      "lado",
      "safer recruitment",
      "safeguarding audit",
      "safeguarding training delivery",
      "safeguarding practice",
    ],
    adjacent: {
      social_work: {
        weight: 0.9,
        reason:
          "Safeguarding is the core statutory task of children's and adult social care teams.",
      },
      classroom_teaching: {
        weight: 0.6,
        reason:
          "Schools are the largest source of child protection referrals and every teacher is trained to make one.",
      },
      youth_work: {
        weight: 0.7,
        reason:
          "Youth settings must name a designated lead and youth workers do the reporting and recording.",
      },
      policing_practice: {
        weight: 0.6,
        reason:
          "Strategy meetings on a child at risk are held jointly by police and social care.",
      },
    },
  },
  sales_engineering: {
    label: "Sales Engineering & Solutions Consulting",
    onet: "41-9031.00",
    aliases: [
      "sales engineer",
      "solutions engineer",
      "solutions consultant",
      "presales engineer",
      "proof of concept delivery",
      "solution demonstration",
      "technical discovery call",
      "technical rfp response",
      "technical win",
      "sales engineering & solutions consulting",
    ],
    adjacent: {
      enterprise_sales: {
        weight: 0.85,
        reason:
          "The sales engineer and the account executive work one deal together, splitting technical proof from commercial terms.",
      },
      software_engineering: {
        weight: 0.6,
        reason:
          "Building demo environments, integrations and proofs of concept is real development work, and many sales engineers come from a developer job.",
      },
      product_marketing: {
        weight: 0.6,
        reason:
          "Both convert product capability into buyer-facing proof, and share battlecards, demo scripts and objection handling.",
      },
      bid_management: {
        weight: 0.6,
        reason:
          "The technical sections of a tender are drafted by sales engineers against the buyer's published scoring rubric.",
      },
    },
  },
  sanctions_export_controls: {
    label: "Sanctions And Export Controls",
    aliases: [
      "economic sanction",
      "trade sanction",
      "ofac compliance",
      "ofsi licence",
      "export control",
      "itar compliance",
      "eccn classification",
      "dual use licence",
      "denied party screening",
      "restricted party screening",
      "export licence application",
      "trade compliance manager",
      "sanctions and export controls",
    ],
    adjacent: {
      financial_crime_compliance: {
        weight: 0.75,
        reason:
          "Both operate list screening, alert adjudication and mandatory reporting on the same platforms and escalation path.",
      },
      regulatory_compliance: {
        weight: 0.65,
        reason:
          "Licences, record keeping and periodic audits are managed as a compliance programme under the same governance.",
      },
      aerospace: {
        weight: 0.55,
        reason:
          "Defence and space hardware is export-controlled, so those programmes carry a trade compliance function next to engineering.",
      },
      third_party_risk_management: {
        weight: 0.55,
        reason:
          "Onboarding a supplier or distributor includes restricted-party screening and end-use questions before any order is placed.",
      },
    },
  },
  school_leadership: {
    label: "School Leadership",
    onet: "11-9032.00",
    aliases: [
      "headteacher",
      "deputy headteacher",
      "assistant headteacher",
      "executive headteacher",
      "npqh",
      "npqsl",
      "school principal",
      "school improvement lead",
      "head of year",
      "school governance",
      "school leadership",
    ],
    adjacent: {
      classroom_teaching: {
        weight: 0.8,
        reason:
          "School leaders come from the classroom and still observe and model teaching for their staff.",
      },
      education_inspection: {
        weight: 0.7,
        reason:
          "Serving and former heads make up the inspectorate's pool of trained inspectors.",
      },
      people_operations: {
        weight: 0.6,
        reason:
          "A head runs recruitment, appraisal and staff wellbeing for a workforce of a hundred or more.",
      },
      curriculum_design: {
        weight: 0.6,
        reason:
          "Heads own the whole-school curriculum and defend its sequencing to governors and inspectors.",
      },
      local_government_administration: {
        weight: 0.5,
        reason:
          "Maintained schools answer to a local authority for admissions, funding and place planning.",
      },
    },
  },
  search_engine_optimization: {
    label: "Search Engine Optimisation",
    onet: "13-1161.01",
    aliases: [
      "search engine optimisation",
      "search engine optimization",
      "seo",
      "technical seo",
      "on page seo",
      "link building",
      "organic search growth",
      "keyword research",
      "serp analysis",
      "site migration seo",
      "structured data markup",
    ],
    adjacent: {
      content_marketing: {
        weight: 0.8,
        reason:
          "Organic rankings are won with published pages, so search briefs and the editorial calendar are one plan seen twice.",
      },
      performance_marketing: {
        weight: 0.7,
        reason:
          "Paid and organic search bid for the same intent, and the two are planned together to avoid paying for traffic already held.",
      },
      ecommerce_trading: {
        weight: 0.6,
        reason:
          "Category and product page structure decides both what ranks and what actually sells online.",
      },
      software_engineering: {
        weight: 0.55,
        reason:
          "Technical search work is site architecture work: rendering, crawl budget, redirects and page speed are fixed in the codebase alongside developers.",
      },
    },
  },
  security_engineering: {
    label: "Security Engineering",
    onet: "15-1212.00",
    aliases: [
      "security engineer",
      "cissp",
      "zero trust architecture",
      "security architect",
      "threat modelling",
      "cloud security engineer",
      "security control design",
      "hardening baseline",
      "cyber security engineer",
      "security engineering",
    ],
    adjacent: {
      application_security: {
        weight: 0.8,
        reason:
          "Both apply threat modelling; appsec narrows it to the code and its dependency tree.",
      },
      security_operations: {
        weight: 0.8,
        reason:
          "Engineers build the controls and telemetry the operations centre then monitors and responds with.",
      },
      identity_access_management: {
        weight: 0.7,
        reason:
          "Access control design is the single largest control set a security engineer owns.",
      },
      network_engineering: {
        weight: 0.6,
        reason:
          "Most enforcement points are network devices, so the two argue over the same diagrams.",
      },
      cryptography: {
        weight: 0.6,
        reason:
          "Key handling, TLS termination and secret rotation decisions land on the security engineer.",
      },
    },
  },
  security_operations: {
    label: "Security Operations",
    aliases: [
      "security operations centre",
      "soc analyst",
      "security incident response",
      "threat hunting",
      "digital forensic",
      "siem tuning",
      "splunk detection",
      "detection engineering",
      "gcih",
      "malware analysis",
      "blue team",
      "cyber incident handling",
      "security operations",
    ],
    adjacent: {
      security_engineering: {
        weight: 0.8,
        reason:
          "Responders learn which controls would have stopped the intrusion and go on to build them.",
      },
      penetration_testing: {
        weight: 0.6,
        reason:
          "Writing detections requires knowing the attacker tooling and tradecraft first hand.",
      },
      observability_engineering: {
        weight: 0.55,
        reason:
          "Detection rules ride on the same high-volume log and telemetry pipelines as service alerting.",
      },
      identity_access_management: {
        weight: 0.5,
        reason:
          "Credential abuse and token theft are the commonest intrusion path, so responders live in the authentication and session logs IAM teams own.",
      },
    },
  },
  service_design: {
    label: "Service Design",
    aliases: [
      "service designer",
      "service blueprint",
      "customer journey design",
      "touchpoint design",
      "public service design",
      "service design consultant",
      "service design",
    ],
    adjacent: {
      user_experience_design: {
        weight: 0.7,
        reason:
          "Service designers use the same journey and persona artefacts as UX, applied across channels rather than one interface.",
      },
      user_research: {
        weight: 0.75,
        reason:
          "A service blueprint is only credible when it is built on field research with the staff and customers who live the process.",
      },
      design_strategy: {
        weight: 0.7,
        reason:
          "Both roles argue for change at the organisational level rather than at the screen level, using the same evidence.",
      },
    },
  },
  service_operations: {
    label: "Service Operations",
    aliases: [
      "contact centre management",
      "contact center management",
      "call centre operation",
      "call center operation",
      "workforce management scheduling",
      "first contact resolution",
      "csat improvement",
      "omnichannel support design",
      "service operations",
    ],
    adjacent: {
      customer_support: {
        weight: 0.85,
        reason:
          "Service operations design the queues, staffing and targets that frontline agents are measured against every shift.",
      },
      operational_finance: {
        weight: 0.5,
        reason:
          "Cost to serve, contact deflection and headcount modelling are argued in the same budget and unit-cost terms.",
      },
    },
  },
  sheet_metal_work: {
    label: "Sheet Metal Fabrication",
    aliases: [
      "sheet metal worker",
      "sheet metal fabricator",
      "press brake operator",
      "laser cutting operator",
      "cnc punching",
      "brake press setter",
      "ductwork fabrication",
      "flat pattern development",
      "metal forming technician",
      "plasma cutting",
      "sheet metal fabrication",
    ],
    adjacent: {
      welding_fabrication: {
        weight: 0.8,
        reason:
          "Formed panels are joined by welding, and most shops expect one person to do both operations.",
      },
      tool_and_die: {
        weight: 0.65,
        reason:
          "Formed parts only come out right when the press tool is right, so setters and toolmakers work the same problem.",
      },
      hvac_service: {
        weight: 0.55,
        reason:
          "Ductwork is sheet metal work, and duct fabricators often move into ventilation installation.",
      },
      cnc_machining: {
        weight: 0.5,
        reason:
          "Both run CNC setups from the same drawing and tolerance conventions, on punch or on mill.",
      },
    },
  },
  site_management: {
    label: "Construction Site Management",
    onet: "47-1011.00",
    aliases: [
      "construction site manager",
      "site agent",
      "construction manager",
      "construction site supervisor",
      "general foreman",
      "temporary works coordinator",
      "smsts",
      "sssts",
      "construction site management",
    ],
    adjacent: {
      construction_project_management: {
        weight: 0.8,
        reason:
          "Site managers step up to project manager on larger contracts with the same programme and cost duties.",
      },
      construction_health_safety: {
        weight: 0.8,
        reason:
          "The site team issues the inductions, permits and method statements that keep the site legal.",
      },
      construction_planning: {
        weight: 0.6,
        reason:
          "Short-term look-ahead programmes are produced and marked up by the site team every week.",
      },
      land_surveying: {
        weight: 0.5,
        reason:
          "Setting out, level checks and as-built dimensions are taken from site control on the ground.",
      },
    },
  },
  site_reliability_engineering: {
    label: "Site Reliability Engineering",
    aliases: [
      "site reliability engineer",
      "sre",
      "error budget",
      "service level objective",
      "slo",
      "toil reduction",
      "chaos engineering",
      "site reliability engineering",
    ],
    adjacent: {
      observability_engineering: {
        weight: 0.85,
        reason:
          "Reliability targets are unprovable without the metrics and tracing pipelines this work provides.",
      },
      devops: {
        weight: 0.8,
        reason:
          "SREs and DevOps engineers share the deployment automation and the pager for what it ships.",
      },
      security_operations: {
        weight: 0.5,
        reason:
          "Both run structured on-call with severity levels, comms roles and blameless postmortems.",
      },
    },
  },
  six_sigma: {
    label: "Six Sigma",
    aliases: [
      "six sigma",
      "lean six sigma",
      "six sigma black belt",
      "six sigma green belt",
      "master black belt",
      "dmaic",
      "statistical process control",
      "spc",
      "design of experiment",
      "minitab",
      "process capability analysis",
    ],
    adjacent: {
      lean_manufacturing: {
        weight: 0.85,
        reason:
          "Belt certification covers both, because variation reduction and waste removal are run as one improvement programme.",
      },
      quality_engineering: {
        weight: 0.8,
        reason:
          "Control charts, capability indices and FMEA are the quality engineer's daily tools and the belt's syllabus.",
      },
      process_engineering: {
        weight: 0.7,
        reason:
          "Designed experiments are how a process engineer finds the settings that reliably hold a tolerance.",
      },
      industrial_engineering: {
        weight: 0.6,
        reason:
          "Both quantify a process before changing it, and improvement projects are staffed from either group.",
      },
    },
  },
  social_media_management: {
    label: "Social Media Management",
    aliases: [
      "social media management",
      "social media manager",
      "organic social",
      "social content calendar",
      "social media strategy",
      "influencer marketing",
      "creator partnership",
      "social listening",
      "short form video content",
      "paid and organic social",
    ],
    adjacent: {
      community_management: {
        weight: 0.8,
        reason:
          "Both answer people in public under the company name, and social channels are usually where a community first forms.",
      },
      content_marketing: {
        weight: 0.7,
        reason:
          "Social output is mostly the editorial pipeline recut for each channel, planned on the same calendar.",
      },
      brand_marketing: {
        weight: 0.65,
        reason:
          "Social channels are the highest-frequency expression of brand voice, and creative there is approved against brand guidelines.",
      },
      public_relations: {
        weight: 0.6,
        reason:
          "A story breaking on social becomes a press matter within hours, so one duty roster usually covers both.",
      },
    },
  },
  social_work: {
    label: "Social Work",
    onet: "21-1021.00",
    aliases: [
      "social worker",
      "qualified social worker",
      "children's social care",
      "adult social care",
      "approved mental health professional",
      "basw",
      "social work practice educator",
      "asye",
      "child protection social worker",
      "care act assessment",
      "social work england",
      "social work",
    ],
    adjacent: {
      safeguarding_practice: {
        weight: 0.9,
        reason:
          "Statutory social work is safeguarding: assessment, case conference and a protection plan.",
      },
      welfare_benefits_advice: {
        weight: 0.6,
        reason:
          "Social workers check entitlement and refer families into money and debt advice as part of a plan.",
      },
      housing_management: {
        weight: 0.6,
        reason:
          "Tenancy failure, placement and homelessness are worked case by case with housing providers.",
      },
      clinical_practice: {
        weight: 0.6,
        reason:
          "Hospital discharge and mental health work put social workers in the same team as clinicians.",
      },
      youth_work: {
        weight: 0.6,
        reason:
          "Both work face to face with young people and share referral routes and risk language.",
      },
    },
  },
  solar_pv: {
    label: "Solar PV Engineering",
    onet: "17-2199.11",
    aliases: [
      "solar pv",
      "pv system design",
      "utility scale solar",
      "solar farm design",
      "rooftop solar",
      "solar inverter",
      "pv module",
      "solar resource assessment",
      "pvsyst",
      "single axis tracker",
      "solar pv engineering",
    ],
    adjacent: {
      power_systems: {
        weight: 0.7,
        reason:
          "Inverter behaviour under network faults has to be proven with load flow and stability studies before energisation.",
      },
      battery_systems: {
        weight: 0.65,
        reason:
          "New solar plants are built with co-located storage, so yield modelling now includes battery dispatch and degradation.",
      },
      distribution_networks: {
        weight: 0.6,
        reason:
          "Embedded generation connects at 11kV and below, so approval turns on fault level and voltage rise assessment.",
      },
      wind_energy: {
        weight: 0.6,
        reason:
          "Renewable developers run both technologies, and yield uncertainty, offtake structuring and land consent are shared work.",
      },
      energy_efficiency: {
        weight: 0.55,
        reason:
          "Rooftop arrays are sized against a building's measured demand profile, which is the energy assessor's output.",
      },
    },
  },
  solution_architecture: {
    label: "Solution Architecture",
    aliases: [
      "solutions architect (add alongside; keep the singular too)",
      "technical architect",
      "solution design document",
      "pre sales architect",
      "reference architecture",
      "architecture decision record",
      "azure solutions architect expert",
      "technical design authority",
      "solution architecture",
    ],
    adjacent: {
      enterprise_architecture: {
        weight: 0.8,
        reason:
          "Each design must land inside the enterprise target state, and architects move between the two.",
      },
      cloud_architecture: {
        weight: 0.8,
        reason:
          "Nearly every current solution design is a cloud design with a cost and identity model attached.",
      },
      integration_engineering: {
        weight: 0.7,
        reason:
          "Most of a solution design is deciding which system is the source of truth for what.",
      },
      enterprise_sales: {
        weight: 0.5,
        reason:
          "Pre-sales architects sit in the deal team and shape the technical win beside the account lead.",
      },
    },
  },
  sonography: {
    label: "Sonography",
    onet: "29-2032.00",
    aliases: [
      "sonographer",
      "sonography",
      "ultrasound scanning",
      "obstetric ultrasound",
      "vascular ultrasound",
      "echocardiographer",
      "point of care ultrasound",
      "abdominal ultrasound",
      "cardiac sonographer",
      "rdms",
      "ardms",
    ],
    adjacent: {
      diagnostic_radiography: {
        weight: 0.8,
        reason:
          "Ultrasound sits inside the imaging department and most sonographers hold a radiography qualification underneath it.",
      },
      cardiology: {
        weight: 0.7,
        reason:
          "Echocardiography is a cardiology investigation: the sonographer acquires the study the cardiologist acts on.",
      },
      radiology: {
        weight: 0.6,
        reason:
          "Sonographers and radiologists share the same reporting standards and escalate unexpected findings to each other live.",
      },
      midwifery: {
        weight: 0.55,
        reason:
          "Obstetric scanning clinics are staffed jointly by sonographers and midwives working from the same care pathway.",
      },
    },
  },
  sound_design: {
    label: "Sound Design",
    onet: "27-4014.00",
    aliases: [
      "sound designer",
      "foley artist",
      "supervising sound editor",
      "dialogue editor",
      "re recording mixer",
      "game audio designer",
      "field recordist",
      "sound effects editor",
      "wwise implementation",
      "sound design",
    ],
    adjacent: {
      audio_engineering: {
        weight: 0.85,
        reason:
          "Sound designers mix, edit and route in the same DAW and signal chain that audio engineers live in.",
      },
      video_editing: {
        weight: 0.7,
        reason:
          "Sound work begins from the locked picture edit and stays in step with any recut.",
      },
      music_production: {
        weight: 0.7,
        reason:
          "Score and sound design are mixed together and the two roles are often held by the same person on smaller projects.",
      },
    },
  },
  special_educational_needs: {
    label: "Special Educational Needs Practice",
    aliases: [
      "senco",
      "sendco",
      "special educational need",
      "additional learning need",
      "ehcp",
      "education health and care plan",
      "send inclusion lead",
      "learning support assistant",
      "individual education plan",
      "special educational needs practice",
    ],
    adjacent: {
      classroom_teaching: {
        weight: 0.8,
        reason:
          "SENCOs are qualified teachers who still teach and coach colleagues on adapting their lessons.",
      },
      safeguarding_practice: {
        weight: 0.7,
        reason:
          "SENCOs chair EHCP annual reviews and safeguarding leads compile the record for child protection conferences, both multi-agency and minuted.",
      },
      social_work: {
        weight: 0.6,
        reason:
          "Education, health and care plans are written jointly with social care, so the casework overlaps.",
      },
      school_leadership: {
        weight: 0.6,
        reason:
          "The SENCO sits on the senior team in most schools and holds a statutory whole-school remit.",
      },
    },
  },
  speech_language_therapy: {
    label: "Speech And Language Therapy",
    onet: "29-1127.00",
    aliases: [
      "speech and language therapist",
      "speech language pathologist",
      "slp",
      "drop; 'slp' plus the two full job titles carry the concept",
      "dysphagia assessment",
      "swallow assessment",
      "aphasia therapy",
      "augmentative and alternative communication",
      "voice therapy",
      "fluency therapy",
      "asha certified",
      "paediatric speech therapy",
      "speech and language therapy",
    ],
    adjacent: {
      dietetics: {
        weight: 0.6,
        reason:
          "The swallow assessment decides the texture-modified diet or tube feed that the dietitian then prescribes and monitors.",
      },
      occupational_therapy: {
        weight: 0.65,
        reason:
          "Both professions work the same rehabilitation caseload and share goal setting for return to daily function.",
      },
      paediatrics: {
        weight: 0.6,
        reason:
          "Child development clinics depend on speech therapy assessment for language delay and feeding difficulty.",
      },
      clinical_practice: {
        weight: 0.7,
        reason:
          "Speech therapists assess and treat under their own registration and carry clinical risk on unsafe swallow decisions.",
      },
    },
  },
  sports_coaching: {
    label: "Sports Coaching",
    onet: "27-2022.00",
    aliases: [
      "head coach",
      "assistant coach",
      "academy coach",
      "football coach",
      "basketball coach",
      "rugby coach",
      "swim coach",
      "player development",
      "skill acquisition coach",
      "uefa a licence",
      "uefa b licence",
      "sports coaching",
    ],
    adjacent: {
      strength_conditioning: {
        weight: 0.8,
        reason:
          "the coach sets the training week that S&C staff load, and both plan backwards from the fixture list",
      },
      sports_performance_analysis: {
        weight: 0.75,
        reason:
          "session plans and opposition preparation are built from the analyst's clips and match metrics each week",
      },
      athletic_therapy: {
        weight: 0.6,
        reason:
          "availability and return-to-play calls are made jointly by coaching and medical staff every week",
      },
      people_operations: {
        weight: 0.5,
        reason:
          "a head coach line-manages a coaching and support staff and owns selection, discipline and day-to-day welfare decisions across a squad",
      },
    },
  },
  sports_performance_analysis: {
    label: "Sports Performance Analysis",
    aliases: [
      "sports performance analyst",
      "match analyst",
      "video analyst",
      "notational analysis",
      "opposition analysis",
      "athlete monitoring",
      "training load monitoring",
      "opta data",
      "catapult gps",
      "sportscode",
      "wyscout",
      "hudl",
      "sports performance analysis",
    ],
    adjacent: {
      sports_coaching: {
        weight: 0.75,
        reason:
          "the analyst's output only matters if it changes the session plan, so the pair work daily side by side",
      },
      strength_conditioning: {
        weight: 0.6,
        reason:
          "tracking distance and acceleration counts feed straight into how S&C staff set the week's load",
      },
      data_engineering: {
        weight: 0.6,
        reason:
          "analysts build the tracking and event-data pipelines and databases behind their own dashboards",
      },
      computer_vision: {
        weight: 0.55,
        reason:
          "optical tracking and automatic event detection turned video analysis into a computer vision problem",
      },
      machine_learning: {
        weight: 0.55,
        reason:
          "expected-goal and availability-risk models are fitted by analysts on their own tracking data",
      },
    },
  },
  statistical_programming: {
    label: "Statistical Programming",
    aliases: [
      "statistical programmer",
      "sas programmer",
      "adam dataset",
      "sdtm mapping",
      "define xml",
      "clinical sas",
      "table listing and figure",
      "cdisc standard",
      "double programming",
      "submission dataset",
      "statistical programming",
    ],
    adjacent: {
      biostatistics: {
        weight: 0.85,
        reason:
          "Programmers implement the statistical analysis plan and are checked against the statistician's independent output.",
      },
      clinical_data_management: {
        weight: 0.8,
        reason:
          "Analysis datasets are built directly on top of the data manager's clean and locked database.",
      },
      data_engineering: {
        weight: 0.65,
        reason:
          "Both write reproducible version-controlled transformations against a fixed and documented schema contract.",
      },
      regulatory_affairs: {
        weight: 0.6,
        reason:
          "Analysis datasets and define files ship inside the electronic submission package the regulatory team files.",
      },
    },
  },
  strength_conditioning: {
    label: "Strength & Conditioning",
    onet: "39-9031.00",
    aliases: [
      "strength and conditioning coach",
      "strength coach",
      "athletic development coach",
      "olympic weightlifting coach",
      "resistance training programme",
      "conditioning programme",
      "personal trainer",
      "level 3 personal trainer",
      "certified strength and conditioning specialist",
      "uksca",
      "nsca",
      "strength & conditioning",
    ],
    adjacent: {
      sports_coaching: {
        weight: 0.8,
        reason:
          "training load is negotiated session by session with the coach against the fixture and travel calendar",
      },
      athletic_therapy: {
        weight: 0.75,
        reason:
          "late-stage rehabilitation is delivered as strength programming, so the two roles hand athletes back and forth",
      },
      nutrition_practice: {
        weight: 0.65,
        reason:
          "training load, body composition and recovery targets are set with the performance nutritionist",
      },
      sports_performance_analysis: {
        weight: 0.6,
        reason:
          "GPS and load-monitoring data is collected and interpreted by S&C staff before it reaches the coach",
      },
    },
  },
  structural_engineering: {
    label: "Structural Engineering",
    aliases: [
      "structural engineer",
      "chartered structural engineer",
      "istructe",
      "structural calculation",
      "reinforced concrete design",
      "steel frame design",
      "temporary works design",
      "structural detailing",
      "etabs",
      "tekla",
      "structural engineering",
    ],
    adjacent: {
      civil_engineering: {
        weight: 0.8,
        reason:
          "Civil and structural engineers train on the same codes and swap between bridge, frame and foundation work.",
      },
      geotechnical_engineering: {
        weight: 0.75,
        reason:
          "Foundation sizing needs the ground model, so structural and geotechnical engineers settle bearing and settlement together.",
      },
      facade_engineering: {
        weight: 0.65,
        reason:
          "Cladding support brackets and movement joints are structural calculations done to a facade specification.",
      },
      architecture: {
        weight: 0.6,
        reason:
          "Structural engineers spend their week resolving spans and stability against an architect's spatial intent.",
      },
      mechanical_engineering: {
        weight: 0.55,
        reason:
          "Both resolve load paths and check stress, deflection and fatigue with finite element analysis.",
      },
    },
  },
  subsea_engineering: {
    label: "Subsea Engineering",
    aliases: [
      "subsea engineer",
      "subsea production system",
      "riser analysis",
      "flow assurance",
      "subsea umbilical",
      "rov operation",
      "offshore installation engineer",
      "mooring analysis",
      "orcaflex",
      "subsea engineering",
    ],
    adjacent: {
      petroleum_engineering: {
        weight: 0.7,
        reason:
          "Subsea hardware is sized to the production profile and fluid composition set by reservoir engineers.",
      },
      pipeline_integrity: {
        weight: 0.65,
        reason:
          "Flowlines and risers are inspected, corrosion managed and fitness assessed by integrity engineers.",
      },
      offshore_wind: {
        weight: 0.65,
        reason:
          "Cable lay, mooring and vessel-based installation methods transferred straight into offshore renewables.",
      },
      mechanical_engineering: {
        weight: 0.6,
        reason:
          "Riser, mooring and connector work is fatigue and pressure containment design in a marine environment.",
      },
    },
  },
  substation_engineering: {
    label: "Substation Design",
    aliases: [
      "substation design",
      "substation primary design",
      "protection and control design",
      "relay setting",
      "busbar arrangement",
      "switchgear design",
      "earthing study",
      "substation commissioning",
      "iec 61850",
    ],
    adjacent: {
      high_voltage_transmission: {
        weight: 0.8,
        reason:
          "Bay layout, clearance and insulation level follow directly from the transmission circuit it terminates.",
      },
      power_systems: {
        weight: 0.75,
        reason:
          "Relay settings and equipment ratings are derived from fault level and load flow study results.",
      },
      distribution_networks: {
        weight: 0.65,
        reason:
          "Primary substations are the backbone asset of a distribution network and are designed by the same teams.",
      },
      commissioning_management: {
        weight: 0.65,
        reason:
          "No bay is energised until protection loop checks and functional tests are witnessed and signed off.",
      },
    },
  },
  supplier_quality: {
    label: "Supplier Quality",
    aliases: [
      "supplier quality engineer",
      "supplier quality",
      "ppap",
      "apqp",
      "supplier development engineer",
      "supplier audit",
      "incoming inspection",
      "vendor quality engineer",
      "part submission warrant",
      "supplier corrective action",
    ],
    adjacent: {
      quality_engineering: {
        weight: 0.8,
        reason:
          "Same failure analysis and same corrective action discipline, applied one factory upstream.",
      },
      quality_management_systems: {
        weight: 0.7,
        reason:
          "Supplier approval, audit schedules and vendor scorecards are maintained inside the certified system.",
      },
      metrology: {
        weight: 0.6,
        reason:
          "Judging a submitted part means reading the supplier's dimensional report and repeating the measurement in house.",
      },
      manufacturing_engineering: {
        weight: 0.55,
        reason:
          "Approving a part submission means reading the supplier's process flow and tooling, the documents a manufacturing engineer writes.",
      },
    },
  },
  supply_chain_planning: {
    label: "Supply Chain Planning",
    onet: "13-1081.00",
    aliases: [
      "supply chain planner",
      "supply chain manager",
      "supply chain analyst",
      "supply planner",
      "material planner",
      "mrp controller",
      "inventory planner",
      "stock controller",
      "scor model",
      "supply chain planning",
    ],
    adjacent: {
      demand_planning: {
        weight: 0.85,
        reason:
          "the demand forecast is the input a supply planner turns into production and replenishment orders every cycle",
      },
      procurement_sourcing: {
        weight: 0.75,
        reason:
          "purchase requisitions and supplier lead times live in the same ERP module the planner works in daily",
      },
      warehouse_operations: {
        weight: 0.7,
        reason:
          "planners set the stock a site must hold and hear first when a distribution centre runs out of pick face",
      },
      transport_fleet_management: {
        weight: 0.6,
        reason:
          "whoever sizes replenishment orders decides how many vehicle loads the transport desk has to cover each week",
      },
      data_engineering: {
        weight: 0.55,
        reason:
          "planning runs on ERP and warehouse extracts, so planners live in SQL and BI tools and usually specify the tables their planning reports sit on",
      },
    },
  },
  surgical_practice: {
    label: "Surgical Practice",
    onet: "29-1248.00",
    aliases: [
      "surgeon",
      "general surgery",
      "orthopaedic surgery",
      "orthopedic surgery",
      "laparoscopic surgery",
      "frcs",
      "mrcs",
      "surgical registrar",
      "colorectal surgery",
      "trauma surgery",
      "vascular surgery",
      "robotic surgery",
      "surgical practice",
    ],
    adjacent: {
      anaesthesia: {
        weight: 0.85,
        reason:
          "Surgeon and anaesthetist plan and run every case as a pair and are jointly accountable for the patient on the table.",
      },
      perioperative_nursing: {
        weight: 0.8,
        reason:
          "The scrub team knows the steps and instruments of the operation as well as the surgeon and anticipates each one.",
      },
      emergency_medicine: {
        weight: 0.6,
        reason:
          "Trauma and acute abdomen cases are handed straight from the resus room to the on-call surgical team.",
      },
    },
  },
  sustainability_assessment: {
    label: "Building Sustainability Assessment",
    onet: "13-1199.05",
    aliases: [
      "breeam",
      "breeam assessor",
      "leed",
      "leed ap",
      "whole life carbon assessment",
      "embodied carbon assessment",
      "green building certification",
      "epc assessor",
      "net zero carbon design",
      "building life cycle assessment",
      "building sustainability consultant",
      "building sustainability assessment",
    ],
    adjacent: {
      building_physics: {
        weight: 0.8,
        reason:
          "Credits for energy, comfort and daylight are earned through the modelling a building physicist runs.",
      },
      building_services_engineering: {
        weight: 0.6,
        reason:
          "Energy, metering and refrigerant credits are scored directly on the heating, cooling and controls the services engineer specifies.",
      },
      property_development: {
        weight: 0.55,
        reason:
          "Developers commission certification early because ratings affect lettability, funding and consent.",
      },
      facilities_management: {
        weight: 0.55,
        reason:
          "In-use ratings depend on how the operations team meters, tunes and maintains the building after handover.",
      },
    },
  },
  systematic_trading: {
    label: "Systematic Trading",
    aliases: [
      "systematic trading",
      "algorithmic trading",
      "quantitative trading",
      "proprietary trading",
      "high frequency trading",
      "market making",
      "options market making",
      "execution algorithm",
      "low latency trading",
      "trading strategy backtest",
    ],
    adjacent: {
      quantitative_research: {
        weight: 0.85,
        reason:
          "Traders run the strategies quants research, and both work from the same signal, transaction cost and slippage models.",
      },
      software_engineering: {
        weight: 0.7,
        reason:
          "Execution and market data stacks are latency sensitive production software, so systematic traders live in real code every day.",
      },
      financial_risk_management: {
        weight: 0.65,
        reason:
          "Position limits, margin and intraday exposure monitoring govern every trading book and are set jointly with risk.",
      },
      portfolio_management: {
        weight: 0.6,
        reason:
          "Both size positions against expected return and risk; a systematic book is a portfolio with much faster turnover.",
      },
    },
  },
  tax_advisory: {
    label: "Tax Advisory",
    aliases: [
      "tax advisor",
      "tax adviser",
      "corporate tax",
      "international tax",
      "tax structuring",
      "tax planning",
      "tax due diligence",
      "chartered tax adviser",
      "corporation tax return",
      "tax compliance manager",
      "research and development tax relief",
      "adit",
      "tax advisory",
    ],
    adjacent: {
      transfer_pricing: {
        weight: 0.75,
        reason:
          "Cross border structuring and intercompany pricing are advised inside one tax practice, and a corporate tax adviser has to read the transfer pricing documentation to sign off a group's effective tax rate.",
      },
      indirect_tax: {
        weight: 0.65,
        reason:
          "Any transaction advised for corporate tax also carries a value added tax consequence, so both specialisms sit inside one tax practice.",
      },
      transaction_services: {
        weight: 0.65,
        reason:
          "Tax due diligence runs alongside the financial workstream on every deal, sharing the same data room, target and timetable.",
      },
      technical_accounting: {
        weight: 0.6,
        reason:
          "Current and deferred tax provisions in the statutory accounts are prepared by tax and signed off with the reporting accountants.",
      },
    },
  },
  tax_law: {
    label: "Tax Law",
    onet: "23-1011.00",
    aliases: [
      "tax lawyer",
      "tax attorney",
      "tax counsel",
      "corporate tax advisory",
      "indirect tax advisory",
      "tax controversy",
      "hmrc enquiry",
      "irs audit defense",
      "double taxation treaty",
      "tax law",
    ],
    adjacent: {
      corporate_ma_law: {
        weight: 0.65,
        reason:
          "Deal structure, warranties and indemnities are drafted around the tax analysis, so both sit on the same transaction.",
      },
      corporate_finance: {
        weight: 0.6,
        reason:
          "Financing structures, group reorganisations and repatriation plans are modelled by finance and tested by tax counsel.",
      },
      operational_finance: {
        weight: 0.55,
        reason:
          "Filing positions, provisions and enquiries land on the same ledger the finance team closes each period.",
      },
      internal_audit: {
        weight: 0.5,
        reason:
          "Tax controls and filing accuracy are tested inside the same control framework audit walks through.",
      },
    },
  },
  technical_accounting: {
    label: "Technical Accounting",
    onet: "13-2011.00",
    aliases: [
      "technical accounting",
      "financial reporting manager",
      "statutory reporting",
      "ifrs conversion",
      "gaap conversion",
      "lease accounting",
      "group consolidation",
      "accounting policy",
      "group reporting accountant",
      "financial statement preparation",
    ],
    adjacent: {
      external_audit: {
        weight: 0.85,
        reason:
          "Preparer and auditor argue the same standards over the same numbers, and technical accountants are usually former auditors who moved to the reporting side.",
      },
      management_accounting: {
        weight: 0.6,
        reason:
          "Statutory and management numbers reconcile to one ledger and one month end close, so each role already knows how the other's figures are built.",
      },
      corporate_finance: {
        weight: 0.6,
        reason:
          "Accounting treatment of an acquisition, a lease or a financial instrument drives the reported earnings that corporate finance models and defends.",
      },
      fund_accounting: {
        weight: 0.55,
        reason:
          "Fund financial statements are prepared under the same reporting frameworks, so technical accountants pick up fund reporting quickly.",
      },
    },
  },
  technical_artistry: {
    label: "Technical Artistry",
    aliases: [
      "technical artist",
      "tech artist",
      "shader artist",
      "real time rendering artist",
      "pipeline td",
      "houdini td",
      "tools artist",
      "rigging td",
      "technical artistry",
    ],
    adjacent: {
      games_art: {
        weight: 0.8,
        reason:
          "Technical artists exist to unblock game artists, so they know the modelling and texturing workflow from the inside.",
      },
      three_d_and_cgi: {
        weight: 0.8,
        reason:
          "Shader authoring, rigging and pipeline scripting all sit inside the 3D production toolchain.",
      },
      software_engineering: {
        weight: 0.7,
        reason:
          "Tools and pipeline work is real software: version control, code review and performance profiling apply in full.",
      },
    },
  },
  technical_writing: {
    label: "Technical Writing",
    onet: "27-3042.00",
    aliases: [
      "technical writer",
      "technical author",
      "documentation engineer",
      "api documentation",
      "docs as code",
      "developer documentation",
      "structured authoring",
      "user manual",
      "style guide maintenance",
      "technical writing",
    ],
    adjacent: {
      developer_tooling: {
        weight: 0.55,
        reason:
          "Reference docs are generated from the same source the tooling team maintains.",
      },
      software_engineering: {
        weight: 0.5,
        reason:
          "Credible developer docs require reading the source and running the samples, not just editing prose.",
      },
    },
  },
  textile_design: {
    label: "Textile Design",
    aliases: [
      "textile designer",
      "surface pattern design",
      "textile print design",
      "weave designer",
      "knit designer",
      "repeat pattern",
      "cad textile design",
      "woven textile",
      "textile design",
    ],
    adjacent: {
      fashion_design: {
        weight: 0.8,
        reason:
          "Textile designers develop the prints and cloths that apparel collections are built from, season by season.",
      },
      interior_design: {
        weight: 0.6,
        reason:
          "Upholstery, curtain and rug specification puts textile designers directly into interiors projects.",
      },
      illustration: {
        weight: 0.6,
        reason:
          "Surface pattern begins as drawn or painted motifs before it is put into repeat.",
      },
      materials_science: {
        weight: 0.5,
        reason:
          "Fibre content, weave structure and finish determine drape and wear, so the craft rests on materials knowledge.",
      },
    },
  },
  third_party_risk_management: {
    label: "Third-Party And Vendor Risk",
    aliases: [
      "third party risk management",
      "vendor risk assessment",
      "supplier due diligence",
      "tprm",
      "vendor onboarding review",
      "outsourcing risk assessment",
      "soc 2 report review",
      "security questionnaire review",
      "supplier code of conduct",
      "supply chain due diligence",
      "modern slavery statement",
      "contract risk review",
      "third-party and vendor risk",
    ],
    adjacent: {
      enterprise_risk_management: {
        weight: 0.75,
        reason:
          "Vendor exposure is assessed, scored and escalated using the enterprise framework's own methodology and thresholds.",
      },
      contract_management: {
        weight: 0.65,
        reason:
          "Audit rights, service levels and exit provisions are only enforceable because they were negotiated into the agreement.",
      },
      regulatory_compliance: {
        weight: 0.6,
        reason:
          "Outsourcing and supply chain duties are regulated obligations tested through the same monitoring plan.",
      },
      internal_audit: {
        weight: 0.55,
        reason:
          "Supplier assurance reviews are conducted with audit sampling, evidence requests and finding tracking.",
      },
      sanctions_export_controls: {
        weight: 0.55,
        reason:
          "Onboarding a counterparty includes restricted-party screening and end-use checks before the first order.",
      },
    },
  },
  three_d_and_cgi: {
    label: "3D And CGI",
    onet: "27-1014.00",
    aliases: [
      "3d artist",
      "cgi artist",
      "3d modeller",
      "cgi generalist",
      "texture artist",
      "lookdev artist",
      "houdini artist",
      "blender artist",
      "vfx artist",
      "lighting artist",
      "rigging artist",
      "3d and cgi",
    ],
    adjacent: {
      animation: {
        weight: 0.8,
        reason:
          "3D artists rig and light the assets that animators then perform, and the pipeline puts them in the same review.",
      },
      games_art: {
        weight: 0.8,
        reason:
          "Game art is 3D modelling and texturing under a real-time polygon and shader budget.",
      },
      technical_artistry: {
        weight: 0.8,
        reason:
          "Technical artists come out of the 3D pipeline once they start writing the tools and shaders the artists need.",
      },
      motion_graphics: {
        weight: 0.7,
        reason:
          "Broadcast graphics are largely rendered in 3D now, so the two crafts share software and freelancers.",
      },
      industrial_design: {
        weight: 0.6,
        reason:
          "Product visuals for launch and catalogue are built from the same CAD surfaces industrial designers author.",
      },
    },
  },
  tool_and_die: {
    label: "Tool & Die Making",
    onet: "51-4111.00",
    aliases: [
      "tool and die maker",
      "toolmaker",
      "die maker",
      "press tool design",
      "progressive die",
      "mould maker",
      "mold maker",
      "jig and fixture making",
      "die setter",
      "tool room machinist",
      "die repair",
      "tool & die making",
    ],
    adjacent: {
      cnc_machining: {
        weight: 0.8,
        reason:
          "Toolmakers cut their own inserts and electrodes, so they are machinists working to tighter tolerances.",
      },
      injection_moulding: {
        weight: 0.75,
        reason:
          "The moulder and the mould maker debug the same tool when a part flashes or comes out short.",
      },
      sheet_metal_work: {
        weight: 0.65,
        reason:
          "Press tools are built for the stamping and forming presses that sheet metal shops run every day.",
      },
      manufacturing_engineering: {
        weight: 0.6,
        reason:
          "Tooling design and sign off is shared between the tool room and manufacturing engineering.",
      },
      metrology: {
        weight: 0.55,
        reason:
          "Tool proving is settled by measuring the parts, so toolmakers work from inspection reports.",
      },
    },
  },
  town_planning: {
    label: "Town Planning And Development Control",
    onet: "19-3051.00",
    aliases: [
      "town planner",
      "town planning consultant",
      "rtpi",
      "mrtpi",
      "town planning officer",
      "development control",
      "development management planning",
      "planning application",
      "section 106 agreement",
      "local plan policy",
      "planning appeal",
      "urban planner",
      "town planning and development control",
    ],
    adjacent: {
      urban_design: {
        weight: 0.75,
        reason:
          "Planners assess and negotiate the layout, density and street design that urban designers draw.",
      },
      property_development: {
        weight: 0.75,
        reason:
          "A scheme's value turns on consent, so planners and developers work the same application together.",
      },
      heritage_conservation: {
        weight: 0.6,
        reason:
          "Applications in conservation areas are decided on historic impact grounds by the same officers.",
      },
      architecture: {
        weight: 0.55,
        reason:
          "Planning submissions are drawn by architects and negotiated condition by condition with the planner.",
      },
      landscape_architecture: {
        weight: 0.55,
        reason:
          "Landscape and visual impact evidence is a standard requirement of a major planning application.",
      },
    },
  },
  toxicology: {
    label: "Toxicology",
    aliases: [
      "toxicologist",
      "nonclinical safety",
      "preclinical toxicology",
      "glp toxicology study",
      "genotoxicity",
      "safety pharmacology",
      "histopathology review",
      "dose range finding study",
      "regulatory toxicology",
      "carcinogenicity study",
      "toxicology",
    ],
    adjacent: {
      dmpk: {
        weight: 0.8,
        reason:
          "A toxicology finding only means something once expressed as an exposure margin from the DMPK measurements.",
      },
      regulatory_affairs: {
        weight: 0.7,
        reason:
          "The nonclinical safety package is a filed module and is what gates permission to dose the first human.",
      },
      clinical_pharmacology: {
        weight: 0.65,
        reason:
          "The human starting dose is derived from the no-observed-adverse-effect level in the tox species.",
      },
      pharmacovigilance: {
        weight: 0.6,
        reason:
          "Both reason about causality between a compound and an organ finding, one in animals and one in patients.",
      },
    },
  },
  trademark_brand_protection: {
    label: "Trademark And Brand Protection",
    aliases: [
      "trademark attorney",
      "trade mark attorney",
      "trademark prosecution",
      "trademark opposition",
      "brand protection counsel",
      "anti-counterfeiting",
      "domain name dispute",
      "udrp complaint",
      "madrid protocol",
      "trademark clearance search",
      "passing off claim",
      "citma",
      "trademark and brand protection",
    ],
    adjacent: {
      intellectual_property_law: {
        weight: 0.8,
        reason:
          "Clearance, opposition and enforcement decisions are taken alongside the rest of the rights portfolio, not in isolation.",
      },
      litigation: {
        weight: 0.55,
        reason:
          "Infringement and passing-off actions end in court, so brand enforcement leans on injunction and evidence practice.",
      },
      contract_management: {
        weight: 0.5,
        reason:
          "Licensing, co-existence and distribution agreements are drafted to the exact limits of the registered right.",
      },
    },
  },
  transaction_services: {
    label: "Transaction Services",
    aliases: [
      "financial due diligence",
      "quality of earnings analysis",
      "deal advisory",
      "transaction advisory",
      "vendor due diligence",
      "buy side due diligence",
      "completion account",
      "sale and purchase agreement advisory",
      "carve out financial statement",
      "transaction services",
    ],
    adjacent: {
      external_audit: {
        weight: 0.8,
        reason:
          "Diligence teams are staffed from audit and apply the same fast reading of a ledger to a target's numbers.",
      },
      private_equity: {
        weight: 0.75,
        reason:
          "Sponsors are the main client, so diligence practitioners know the buyout model and what a fund needs proven before signing.",
      },
      valuation_advisory: {
        weight: 0.7,
        reason:
          "Valuation and diligence are two workstreams of one deal advisory practice, sharing normalised earnings and working capital analysis.",
      },
      investment_banking: {
        weight: 0.65,
        reason:
          "Diligence runs to the banker's transaction timetable and feeds the same sale and purchase agreement mechanics.",
      },
      tax_advisory: {
        weight: 0.55,
        reason:
          "Tax due diligence and structuring run in parallel with the financial workstream on the same target.",
      },
    },
  },
  transfer_pricing: {
    label: "Transfer Pricing",
    aliases: [
      "transfer pricing",
      "intercompany pricing",
      "arms length pricing",
      "transfer pricing documentation",
      "country by country reporting",
      "advance pricing agreement",
      "oecd transfer pricing",
      "intercompany transaction pricing",
      "transfer pricing benchmarking",
      "beps compliance",
    ],
    adjacent: {
      tax_advisory: {
        weight: 0.8,
        reason:
          "Transfer pricing is a corporate tax specialism whose practitioners share the treaty knowledge and client base of the wider tax practice.",
      },
      valuation_advisory: {
        weight: 0.65,
        reason:
          "Pricing an intercompany transaction or migrating intangible property needs the same discounted cash flow and comparable analysis as a formal valuation.",
      },
      technical_accounting: {
        weight: 0.55,
        reason:
          "Intercompany charges have to eliminate cleanly on consolidation, which is a group reporting problem as much as a tax one.",
      },
    },
  },
  translation_and_interpreting: {
    label: "Translation And Interpreting",
    onet: "27-3091.00",
    aliases: [
      "translator",
      "public service interpreter",
      "conference interpreter",
      "simultaneous interpreting",
      "subtitler",
      "literary translator",
      "sworn translator",
      "diptrans",
      "mciol",
      "cat tool",
      "post editing machine translation",
      "translation and interpreting",
    ],
    adjacent: {
      localisation: {
        weight: 0.85,
        reason:
          "Translators supply the target-language content that localisation programmes manage, test and ship.",
      },
      editorial_publishing: {
        weight: 0.6,
        reason:
          "Literary translation is commissioned and edited by publishers with the same manuscript and copy-edit cycle.",
      },
      video_editing: {
        weight: 0.5,
        reason:
          "Subtitling and dubbing are timed to the cut and delivered as timecoded files into the post pipeline.",
      },
      journalism: {
        weight: 0.5,
        reason:
          "Foreign desks rely on translators and fixers for source material, and both jobs are judged on faithful, checkable rendering.",
      },
    },
  },
  translational_science: {
    label: "Translational Science",
    onet: "19-1042.00",
    aliases: [
      "translational science",
      "translational medicine",
      "biomarker strategy",
      "patient stratification",
      "bench to bedside",
      "translational research scientist",
      "mechanism of action study",
      "ex vivo patient sample",
      "companion diagnostic development",
      "proof of mechanism study",
    ],
    adjacent: {
      clinical_development: {
        weight: 0.8,
        reason:
          "The biomarker and mechanism evidence produced here is what a phase 2 design and its go decision rest on.",
      },
      assay_development: {
        weight: 0.75,
        reason:
          "Every translational biomarker needs a fit-for-purpose assay before it can be written into a protocol.",
      },
      genomics: {
        weight: 0.7,
        reason:
          "Molecular stratification of a trial population is usually built from sequencing of banked patient samples.",
      },
      research_science: {
        weight: 0.7,
        reason:
          "Translational scientists are recruited out of academic labs and keep publishing alongside the clinical programme.",
      },
      bioinformatics: {
        weight: 0.65,
        reason:
          "Analysis of patient sample omics data is the computational half of the same biomarker question.",
      },
    },
  },
  transport_fleet_management: {
    label: "Transport & Fleet Management",
    aliases: [
      "transport manager",
      "transport planner",
      "fleet manager",
      "fleet operation",
      "transport manager cpc",
      "delivery route planning",
      "driver scheduling",
      "vehicle maintenance",
      "tachograph",
      "fleet telematics",
      "haulage",
      "hgv",
      "cilt",
      "transport & fleet management",
    ],
    adjacent: {
      last_mile_operations: {
        weight: 0.8,
        reason:
          "a parcel network is a fleet with a route plan, so transport managers move straight into delivery network roles",
      },
      warehouse_operations: {
        weight: 0.7,
        reason:
          "vehicle scheduling only works against the site's loading plan, so both desks sit in the same daily meeting",
      },
      freight_forwarding: {
        weight: 0.6,
        reason:
          "forwarders subcontract road legs, and the transport office prices and covers them on the same lanes",
      },
      automotive: {
        weight: 0.55,
        reason:
          "fleet engineers write vehicle and drivetrain specifications, manage warranty and recall with manufacturers, and set workshop maintenance schedules against them",
      },
    },
  },
  treasury_management: {
    label: "Corporate Treasury",
    onet: "11-3031.01",
    aliases: [
      "corporate treasury",
      "treasury analyst",
      "treasury operation",
      "treasury cash management",
      "liquidity management",
      "cash flow forecasting",
      "foreign exchange hedging",
      "fx hedging",
      "interest rate hedging",
      "cash pooling",
      "bank relationship management",
      "amct",
    ],
    adjacent: {
      corporate_finance: {
        weight: 0.75,
        reason:
          "Debt facilities, covenants and funding plans are negotiated by treasury and modelled by corporate finance off the same cash forecast.",
      },
      financial_risk_management: {
        weight: 0.7,
        reason:
          "Hedging currency and rate exposure uses the same instrument pricing and exposure measurement that market risk teams apply to a trading book.",
      },
      commercial_lending: {
        weight: 0.6,
        reason:
          "Treasurers sit on the borrower side of the facilities corporate bankers originate, and people move between the two sides of that table.",
      },
      operational_finance: {
        weight: 0.6,
        reason:
          "Cash forecasting depends on receivables and payables discipline, so treasury and finance operations share one working capital target.",
      },
    },
  },
  typography: {
    label: "Typography",
    aliases: [
      "typographer",
      "type design",
      "typeface design",
      "lettering artist",
      "font development",
      "calligraphy",
      "variable font",
      "type foundry",
      "kerning",
      "typography",
    ],
    adjacent: {
      visual_design: {
        weight: 0.85,
        reason:
          "Every layout is a typographic decision first, so typographers and graphic designers share portfolios and clients.",
      },
      brand_identity: {
        weight: 0.8,
        reason:
          "Custom typefaces and logotypes are commissioned as the backbone of an identity system.",
      },
      editorial_publishing: {
        weight: 0.7,
        reason:
          "Book and magazine setting demands the hyphenation, leading and footnote judgment that typographers specialise in.",
      },
      illustration: {
        weight: 0.55,
        reason:
          "Lettering artists draw letterforms by hand, which is a drawing discipline as much as a typographic one.",
      },
    },
  },
  urban_design: {
    label: "Urban Design",
    aliases: [
      "urban designer",
      "masterplanner",
      "masterplanning",
      "public realm design",
      "streetscape design",
      "placemaking",
      "design code preparation",
      "urban regeneration",
      "townscape assessment",
      "urban design",
    ],
    adjacent: {
      town_planning: {
        weight: 0.75,
        reason:
          "Design codes, masterplans and site allocations are adopted through the planning system.",
      },
      architecture: {
        weight: 0.7,
        reason:
          "Most urban designers trained as architects and move between building and block scale work.",
      },
      landscape_architecture: {
        weight: 0.7,
        reason:
          "Streets, squares and open space are drawn jointly with landscape architects on every masterplan.",
      },
      property_development: {
        weight: 0.55,
        reason:
          "Masterplan layout decides plot yield and phasing, the developer's core appraisal input.",
      },
    },
  },
  user_experience_design: {
    label: "User Experience Design",
    onet: "15-1255.00",
    aliases: [
      "ux designer",
      "user experience design",
      "ux practitioner",
      "experience designer",
      "ux consultant",
      "usability design",
      "ux lead",
    ],
    adjacent: {
      user_research: {
        weight: 0.85,
        reason:
          "UX designers are trained in the same research methods and frequently move into a full-time research post mid-career.",
      },
      interaction_design: {
        weight: 0.85,
        reason:
          "Interaction design is the screen-level discipline that UX practitioners apply once the flow and structure are settled.",
      },
      service_design: {
        weight: 0.7,
        reason:
          "Service design applies the same journey-mapping method to staff, channels and back office rather than to one screen.",
      },
      accessibility_design: {
        weight: 0.7,
        reason:
          "Meeting WCAG criteria is a UX deliverable, so experienced UX designers already reason in focus order and contrast ratios.",
      },
      product_design: {
        weight: 0.85,
        reason:
          "UX and product design job specs list the same portfolio expectations and the same tooling in most companies.",
      },
    },
  },
  user_research: {
    label: "User Research",
    onet: "15-1255.01",
    aliases: [
      "user researcher",
      "ux research",
      "usability testing",
      "design research",
      "contextual inquiry",
      "diary study",
      "usability researcher",
      "design ethnography",
      "user research",
    ],
    adjacent: {
      user_experience_design: {
        weight: 0.85,
        reason:
          "Researchers hand findings straight to UX designers and many have designed screens themselves before specialising.",
      },
      service_design: {
        weight: 0.7,
        reason:
          "Service designers depend on field research with frontline staff, which is the same observational method researchers use.",
      },
      research_science: {
        weight: 0.6,
        reason:
          "Study design, sampling and the discipline of not leading a participant transfer directly from academic research training.",
      },
    },
  },
  validation_engineering: {
    label: "Validation & Qualification Engineering",
    aliases: [
      "process validation engineer",
      "commissioning qualification and validation",
      "installation qualification",
      "operational qualification",
      "performance qualification",
      "process validation protocol",
      "gmp",
      "cleanroom qualification",
      "validation & qualification engineering",
    ],
    adjacent: {
      quality_management_systems: {
        weight: 0.75,
        reason:
          "Validation protocols and their reports are controlled documents inside the site quality system and read in every audit.",
      },
      quality_engineering: {
        weight: 0.7,
        reason:
          "Both prove with documented evidence that a process holds its limits before any product is released.",
      },
      calibration_technician: {
        weight: 0.6,
        reason:
          "Qualification runs depend on calibrated instruments, and the certificates are attached to the signed protocol.",
      },
      process_engineering: {
        weight: 0.6,
        reason:
          "A validated process window is ordinary capability work, written to a protocol and formally signed off.",
      },
    },
  },
  validation_qualification: {
    label: "Validation And Qualification",
    aliases: [
      "cqv engineer",
      "process validation",
      "cleaning validation",
      "equipment qualification",
      "iq oq pq",
      "computer system validation",
      "commissioning and qualification",
      "validation master plan",
      "aseptic process simulation",
      "gamp 5",
      "validation and qualification",
    ],
    adjacent: {
      gmp_quality_assurance: {
        weight: 0.85,
        reason:
          "Every validation protocol is written to satisfy the quality system and is approved and closed by quality.",
      },
      bioprocess_development: {
        weight: 0.7,
        reason:
          "Performance qualification is where a developed process is proved reproducible at full commercial scale.",
      },
      laboratory_management: {
        weight: 0.65,
        reason:
          "Instrument qualification and calibration programmes in a lab follow exactly the same installation and performance logic.",
      },
      pharmaceutical_microbiology: {
        weight: 0.6,
        reason:
          "Media fills and sterilisation cycle validation are designed and executed jointly with the microbiology group.",
      },
      systems_engineering: {
        weight: 0.55,
        reason:
          "Both work from a written requirements specification down to documented evidence that each requirement was verified.",
      },
    },
  },
  valuation_advisory: {
    label: "Valuation Advisory",
    aliases: [
      "valuation advisory",
      "business valuation",
      "purchase price allocation",
      "discounted cash flow valuation",
      "fair value measurement",
      "intangible asset valuation",
      "share option valuation",
      "409a valuation",
      "valuation modelling",
      "impairment testing",
    ],
    adjacent: {
      transaction_services: {
        weight: 0.75,
        reason:
          "Valuation and financial due diligence are two workstreams of one deal advisory practice built on the same normalised earnings.",
      },
      technical_accounting: {
        weight: 0.7,
        reason:
          "Purchase price allocation and impairment testing are valuations performed to satisfy an accounting standard and an auditor.",
      },
      investment_banking: {
        weight: 0.7,
        reason:
          "Comparable company, precedent transaction and discounted cash flow analysis is the shared toolkit of bankers and valuers.",
      },
      private_equity: {
        weight: 0.6,
        reason:
          "Fund holding values are marked with the same methods, so valuers move into portfolio valuation roles inside funds.",
      },
    },
  },
  venture_capital: {
    label: "Venture Capital",
    aliases: [
      "venture capital",
      "venture investor",
      "vc associate",
      "seed investing",
      "series a investment",
      "early stage investing",
      "cap table modelling",
      "term sheet negotiation",
      "angel investing",
      "venture partner",
      "deal flow sourcing",
    ],
    adjacent: {
      private_equity: {
        weight: 0.7,
        reason:
          "Both invest private capital, take board seats and manage a fund to an exit, and investors move between the stages.",
      },
      valuation_advisory: {
        weight: 0.6,
        reason:
          "Option grants, preference stacks and 409a marks on a venture portfolio are valued with option pricing and backsolve methods, which is the valuation specialist's own toolkit.",
      },
      investment_banking: {
        weight: 0.55,
        reason:
          "Growth rounds and secondary sales are executed with bankers using shared process and modelling conventions.",
      },
    },
  },
  veterinary_practice: {
    label: "Veterinary Practice",
    onet: "29-1131.00",
    aliases: [
      "veterinary surgeon",
      "veterinarian",
      "mrcvs",
      "dvm",
      "bvsc",
      "vmd",
      "small animal practice",
      "equine practice",
      "veterinary nurse",
      "rvn",
      "farm animal practice",
      "veterinary anaesthesia",
      "veterinary practice",
    ],
    adjacent: {
      surgical_practice: {
        weight: 0.6,
        reason:
          "Vets perform sterile operative work single-handed, with the same aseptic and anaesthetic discipline as a human theatre team.",
      },
      anaesthesia: {
        weight: 0.55,
        reason:
          "Veterinary anaesthesia uses the same agents, monitoring and airway techniques, scaled across very different body weights.",
      },
      pharmacy_practice: {
        weight: 0.5,
        reason:
          "Vets dispense and hold controlled drugs on their own premises under the same custody and record-keeping duties.",
      },
      research_science: {
        weight: 0.5,
        reason:
          "Vets move into preclinical study oversight, where in vivo protocol design and welfare review need a clinician's judgement.",
      },
    },
  },
  video_editing: {
    label: "Film And Video Editing",
    onet: "27-4032.00",
    aliases: [
      "video editor",
      "film editor",
      "offline editor",
      "online conform editor",
      "post production editor",
      "colourist",
      "avid media composer",
      "davinci resolve",
      "premiere pro editor",
      "assistant film editor",
      "film and video editing",
    ],
    adjacent: {
      videography: {
        weight: 0.8,
        reason:
          "Editors and camera crews work to the same shot list, and editors who have shot know what coverage they can ask for.",
      },
      motion_graphics: {
        weight: 0.75,
        reason:
          "Titles, lower thirds and clean-ups are cut into the timeline, so editors and motion designers share tools and files.",
      },
      sound_design: {
        weight: 0.7,
        reason:
          "An offline edit is locked with a temp mix, and the editor hands the timeline straight to the sound department.",
      },
      animation: {
        weight: 0.5,
        reason:
          "Animatics and previs are assembled and re-timed in an edit before animation is committed.",
      },
    },
  },
  videography: {
    label: "Cinematography And Videography",
    onet: "27-4031.00",
    aliases: [
      "cinematographer",
      "director of photography",
      "videographer",
      "camera operator",
      "gaffer",
      "lighting camera operator",
      "documentary filmmaker",
      "steadicam operator",
      "cinematography and videography",
    ],
    adjacent: {
      video_editing: {
        weight: 0.8,
        reason:
          "Shooting decisions are made for the cut, and small crews have the same person shoot and edit the piece.",
      },
      photography: {
        weight: 0.8,
        reason:
          "Lighting, lens and exposure craft is identical, and many DoPs began as stills photographers.",
      },
      sound_design: {
        weight: 0.6,
        reason:
          "Location sound is captured on the same shoot and a DoP has to plan around boom placement and room tone.",
      },
      art_direction: {
        weight: 0.6,
        reason:
          "Commercials pair the director of photography with an art director to hold one look across the frame and the set.",
      },
    },
  },
  visual_design: {
    label: "Visual Design",
    onet: "27-1024.00",
    aliases: [
      "graphic designer",
      "visual designer",
      "layout designer",
      "artworker",
      "print designer",
      "communication design",
      "graphic design lead",
      "adobe indesign",
      "visual identity design",
      "visual design",
    ],
    adjacent: {
      typography: {
        weight: 0.85,
        reason:
          "Setting type well is the largest single component of a graphic designer's daily output and the fastest tell of skill.",
      },
      brand_identity: {
        weight: 0.8,
        reason:
          "Graphic designers apply the identity across collateral and often grow into the strategist who defines it.",
      },
      art_direction: {
        weight: 0.75,
        reason:
          "Art directors set the visual standard that graphic designers execute, and both judge the same layout, type and image decisions from opposite sides of the brief.",
      },
      packaging_design: {
        weight: 0.65,
        reason:
          "Packaging is graphic design constrained by a dieline and print process, so the layout and type skills carry over.",
      },
      editorial_publishing: {
        weight: 0.6,
        reason:
          "Graphic designers are commissioned by publishers for jackets, series design and layout, working to the editor's page plan, copy fit and house style.",
      },
    },
  },
  viticulture: {
    label: "Viticulture & Winemaking",
    aliases: [
      "viticulturist",
      "viticulture",
      "vineyard manager",
      "grape grower",
      "winemaker",
      "winemaking",
      "oenologist",
      "oenology",
      "cellar hand",
      "cellar master",
      "canopy management",
      "wine production",
      "wset",
      "viticulture & winemaking",
    ],
    adjacent: {
      agronomy: {
        weight: 0.75,
        reason:
          "vine nutrition, disease pressure and rootstock choice are crop production decisions on a perennial crop",
      },
      horticulture: {
        weight: 0.65,
        reason:
          "pruning, training and propagation of vines is skilled perennial horticulture work",
      },
      food_science: {
        weight: 0.6,
        reason:
          "fermentation control, microbiology and analytical chemistry in the cellar is food science practice",
      },
      food_beverage_management: {
        weight: 0.55,
        reason:
          "winemakers present their vintages at trade tastings and work with buyers and list owners on which wines a venue takes",
      },
    },
  },
  warehouse_operations: {
    label: "Warehouse & Distribution Operations",
    onet: "11-3071.00",
    aliases: [
      "warehouse manager",
      "warehouse operation",
      "warehouse supervisor",
      "distribution centre manager",
      "distribution center manager",
      "fulfilment centre",
      "fulfillment center",
      "third party logistics",
      "depot manager",
      "inventory control",
      "pick and pack",
      "3pl",
      "wms",
      "warehouse & distribution operations",
    ],
    adjacent: {
      last_mile_operations: {
        weight: 0.75,
        reason:
          "outbound waves leaving the distribution centre are the loads a delivery station sorts the next morning",
      },
      supply_chain_planning: {
        weight: 0.7,
        reason:
          "stock cover, slotting and space constraints are negotiated between the site and the planning team weekly",
      },
      transport_fleet_management: {
        weight: 0.7,
        reason:
          "loading bays, yard moves and vehicle scheduling are run jointly by the warehouse and transport desks on one site",
      },
      robotics: {
        weight: 0.55,
        reason:
          "goods-to-person and mobile robot fleets sit on the pick floor, so site managers own their throughput, exception handling and uptime alongside the vendor's engineers",
      },
      people_operations: {
        weight: 0.5,
        reason:
          "a distribution centre is a large shift-based workforce, so the job is largely rota, hiring and retention work",
      },
    },
  },
  waste_management: {
    label: "Waste And Circular Economy",
    aliases: [
      "waste management",
      "resource recovery",
      "material recovery facility",
      "anaerobic digestion",
      "energy from waste",
      "landfill engineering",
      "circular economy",
      "recycling operation",
      "hazardous waste compliance",
      "waste permitting",
      "waste and circular economy",
    ],
    adjacent: {
      environmental_consulting: {
        weight: 0.6,
        reason:
          "Permit applications, duty of care audits and site compliance reporting are written by the same specialists.",
      },
      carbon_accounting: {
        weight: 0.6,
        reason:
          "Diversion rates and disposal routes feed straight into scope 3 emissions reporting.",
      },
      water_engineering: {
        weight: 0.55,
        reason:
          "Leachate and sludge treatment plants are designed with the same biological and hydraulic process knowledge.",
      },
      materials_science: {
        weight: 0.5,
        reason:
          "Recyclate quality is a polymer and metallurgical question before it is a logistics one.",
      },
    },
  },
  water_engineering: {
    label: "Water And Wastewater Engineering",
    onet: "17-2081.00",
    aliases: [
      "water engineer",
      "wastewater treatment",
      "water treatment plant",
      "drainage design",
      "sewerage network modelling",
      "activated sludge",
      "hydraulic modelling",
      "flood risk assessment",
      "potable water network",
      "sludge treatment",
      "water and wastewater engineering",
    ],
    adjacent: {
      hydrogeology: {
        weight: 0.65,
        reason:
          "Water resource schemes stand on aquifer yield estimates and abstraction licence evidence.",
      },
      waste_management: {
        weight: 0.6,
        reason:
          "Sludge digestion, drying and reuse straddles wastewater treatment and the waste and recovery sector.",
      },
      environmental_consulting: {
        weight: 0.6,
        reason:
          "Discharge permits, water quality modelling and catchment work are shared instructions.",
      },
      hydropower: {
        weight: 0.55,
        reason:
          "Both size flows through hydraulic structures and share surge, weir and fish passage design.",
      },
    },
  },
  wealth_management: {
    label: "Wealth Management",
    onet: "13-2052.00",
    aliases: [
      "wealth manager",
      "wealth management",
      "private banking",
      "private client adviser",
      "financial adviser",
      "independent financial adviser",
      "chartered financial planner",
      "certified financial planner",
      "retirement income planning",
      "estate planning advice",
      "high net worth advisory",
      "investment adviser representative",
    ],
    adjacent: {
      portfolio_management: {
        weight: 0.7,
        reason:
          "Client money is invested against model portfolios and asset allocation frameworks that portfolio managers construct.",
      },
      pension_consulting: {
        weight: 0.65,
        reason:
          "Retirement income advice requires reading scheme benefits and transfer values that pension specialists calculate.",
      },
      tax_advisory: {
        weight: 0.6,
        reason:
          "Advice on wrappers, trusts and estates is tax driven, so advisers work the same client alongside tax specialists.",
      },
      financial_crime_compliance: {
        weight: 0.55,
        reason:
          "Onboarding private clients demands source of wealth and enhanced due diligence evidence to a high standard.",
      },
    },
  },
  welding_fabrication: {
    label: "Welding & Fabrication",
    onet: "51-4121.00",
    aliases: [
      "welder",
      "coded welder",
      "tig welding",
      "mig welding",
      "gtaw",
      "gmaw",
      "smaw",
      "structural steel fabricator",
      "certified welding inspector",
      "cswip",
      "weld procedure specification",
      "pipefitter",
      "welding & fabrication",
    ],
    adjacent: {
      sheet_metal_work: {
        weight: 0.8,
        reason:
          "Fabrication shops cut, form and weld the same job, and welders commonly set the press brake too.",
      },
      industrial_maintenance: {
        weight: 0.6,
        reason:
          "Plant repairs need on site welding, so maintenance teams keep coded welders on the crew.",
      },
      plumbing_heating: {
        weight: 0.55,
        reason:
          "Pipe welding and brazing skills carry straight into heating and process pipework installation.",
      },
      foundry_casting: {
        weight: 0.5,
        reason:
          "Weld repair and fettling of castings put both trades on the same component.",
      },
    },
  },
  welfare_benefits_advice: {
    label: "Welfare And Benefits Advice",
    aliases: [
      "welfare rights adviser",
      "benefit caseworker",
      "welfare benefit adviser",
      "universal credit",
      "money advice",
      "debt adviser",
      "advice caseworker",
      "benefit tribunal representation",
      "benefit appeal",
      "housing benefit",
      "welfare and benefits advice",
    ],
    adjacent: {
      housing_management: {
        weight: 0.8,
        reason:
          "Most advice casework concerns rent, arrears and a tenancy threatened by a benefit decision.",
      },
      social_work: {
        weight: 0.6,
        reason:
          "Social workers refer families for entitlement checks and appeal support inside a care plan.",
      },
      local_government_administration: {
        weight: 0.6,
        reason:
          "Councils administer housing benefit and council tax support, which advisers challenge on appeal.",
      },
      public_policy_analysis: {
        weight: 0.5,
        reason:
          "Advice services publish caseload evidence that feeds welfare consultations and reform submissions.",
      },
    },
  },
  wind_energy: {
    label: "Wind Energy Engineering",
    onet: "17-2199.10",
    aliases: [
      "wind energy",
      "onshore wind",
      "wind turbine engineer",
      "wind farm design",
      "wind farm layout",
      "wind resource assessment",
      "wind turbine blade design",
      "wind power plant",
      "aeroelastic load simulation",
      "wind energy engineering",
    ],
    adjacent: {
      offshore_wind: {
        weight: 0.85,
        reason:
          "Onshore and offshore machines share rotor aerodynamics, drivetrain and load cases, so turbine engineers move between the two.",
      },
      mechanical_engineering: {
        weight: 0.7,
        reason:
          "Gearbox, bearing and tower fatigue calculation is ordinary mechanical design work applied to a rotor.",
      },
      power_systems: {
        weight: 0.65,
        reason:
          "A wind farm cannot energise until it proves grid code compliance, so turbine electrical behaviour is specified against network connection studies.",
      },
      controls: {
        weight: 0.6,
        reason:
          "Pitch and yaw regulation is a closed-loop control problem tuned against turbine load models.",
      },
      wind_turbine_maintenance: {
        weight: 0.6,
        reason:
          "Choices about blade access and nacelle layout are set by what a service technician can physically do up tower.",
      },
    },
  },
  wind_turbine_maintenance: {
    label: "Wind Turbine Technician",
    onet: "49-9081.00",
    aliases: [
      "wind turbine technician",
      "wind turbine service technician",
      "turbine blade repair",
      "wind turbine blade inspection",
      "pitch system repair",
      "wind turbine gearbox overhaul",
      "irata rope access",
      "gwo working at height",
    ],
    adjacent: {
      wind_energy: {
        weight: 0.7,
        reason:
          "Technicians diagnose in the field the same drivetrain and pitch systems that wind engineers design and model.",
      },
      offshore_wind: {
        weight: 0.7,
        reason:
          "Offshore service crews come from the same technician pool with added marine survival and transfer training.",
      },
      commissioning_management: {
        weight: 0.6,
        reason:
          "Turbine handover uses the same functional testing and punch list closure as any plant commissioning.",
      },
      hse_management: {
        weight: 0.55,
        reason:
          "Working at height and high voltage isolation makes permit and rescue competence part of the daily job.",
      },
    },
  },
  youth_work: {
    label: "Youth Work",
    aliases: [
      "youth worker",
      "detached youth work",
      "youth support worker",
      "jnc qualified",
      "national youth agency",
      "youth participation",
      "informal education",
      "youth club",
      "outreach youth work",
      "youth engagement worker",
      "youth work",
    ],
    adjacent: {
      social_work: {
        weight: 0.7,
        reason:
          "Both hold cases about young people and share assessment, referral and safeguarding routes.",
      },
      safeguarding_practice: {
        weight: 0.8,
        reason:
          "Youth workers hold safeguarding responsibility for every young person in their setting.",
      },
      probation_practice: {
        weight: 0.6,
        reason:
          "Youth offending teams pair youth work method with statutory supervision of young people.",
      },
      charity_fundraising: {
        weight: 0.5,
        reason:
          "Youth provision runs on grants, so senior youth workers write bids and report on outcomes.",
      },
    },
  },
};

/** Company-context signals. Not capabilities, but they shape a shortlist. */
export const ENVIRONMENTS: Readonly<Record<string, OntologyConcept>> = {
  high_growth: {
    label: "High-Growth Company",
    aliases: [
      "high-growth",
      "hypergrowth",
      "scaled from",
      "grew from",
      "series a",
      "series b",
      "series c",
      "startup",
      "early-stage",
      "seed stage",
      "10x",
      "doubled headcount",
      "first 50 employees",
      "founding team",
      "scale-up",
    ],
  },
  large_enterprise: {
    label: "Large Enterprise",
    aliases: [
      "fortune 500",
      "global enterprise",
      "publicly traded",
      "nasdaq",
      "nyse",
      "multinational",
      "10,000 employees",
    ],
  },
  academic: {
    label: "Academic / Research Institution",
    aliases: [
      "university",
      "laboratory",
      "institute",
      "faculty",
      "department of",
      "principal investigator",
      "tenure-track",
    ],
  },
  agency: {
    label: "Agency / Staffing Firm",
    aliases: [
      "staffing agency",
      "recruitment agency",
      "rpo",
      "search firm",
      "consultancy",
      "agency recruiter",
      "contingency",
    ],
  },
};

/** Seniority ladders, used for career-scope scoring. */
export const SENIORITY: Readonly<Record<string, SeniorityBand>> = {
  executive: {
    rank: 5,
    aliases: [
      "chief",
      "cxo",
      "ceo",
      "cto",
      "cfo",
      "cro",
      "chro",
      "president",
      "svp",
      "senior vice president",
      "executive vice president",
      "evp",
      "partner",
      "head of",
    ],
  },
  senior_leader: {
    rank: 4,
    aliases: ["vp", "vice president", "director", "senior director"],
  },
  manager: {
    rank: 3,
    aliases: ["manager", "lead", "head", "team lead", "principal", "staff"],
  },
  senior_ic: { rank: 2, aliases: ["senior", "sr", "ii", "iii", "specialist"] },
  ic: {
    rank: 1,
    aliases: [
      "associate",
      "junior",
      "analyst",
      "coordinator",
      "assistant",
      "intern",
    ],
  },
};

/**
 * Professional-geography gazetteer. Sourcers write locations in prose ("in the
 * Bay Area"), not as `loc:` filters, so places have to be recognised in free
 * text. Deliberately small and inspectable rather than a full gazetteer: an
 * unlisted place still works as a keyword, it just does not activate location
 * scoring.
 */
export const LOCATIONS: Readonly<Record<string, OntologyConcept>> = {
  bay_area: {
    label: "San Francisco Bay Area",
    aliases: [
      "bay area",
      "san francisco bay area",
      "sf bay area",
      "silicon valley",
      "san francisco",
      "palo alto",
      "mountain view",
      "san jose",
      "oakland",
      "berkeley",
    ],
  },
  new_york: {
    label: "New York",
    aliases: ["new york", "new york city", "nyc", "manhattan", "brooklyn"],
  },
  boston: {
    label: "Boston",
    aliases: ["boston", "cambridge massachusetts", "greater boston"],
  },
  seattle: { label: "Seattle", aliases: ["seattle", "bellevue", "redmond"] },
  austin: { label: "Austin", aliases: ["austin", "austin texas"] },
  detroit: { label: "Detroit", aliases: ["detroit", "ann arbor", "michigan"] },
  london: { label: "London", aliases: ["london", "greater london"] },
  edinburgh: { label: "Edinburgh", aliases: ["edinburgh", "scotland"] },
  bristol: { label: "Bristol", aliases: ["bristol"] },
  manchester: {
    label: "Manchester",
    aliases: ["manchester", "greater manchester"],
  },
  sheffield: { label: "Sheffield", aliases: ["sheffield", "south yorkshire"] },
  cambridge_uk: {
    label: "Cambridge",
    aliases: ["cambridge", "cambridgeshire"],
  },
  berlin: { label: "Berlin", aliases: ["berlin"] },
  munich: { label: "Munich", aliases: ["munich", "muenchen", "bavaria"] },
  zurich: { label: "Zurich", aliases: ["zurich", "zuerich"] },
  paris: { label: "Paris", aliases: ["paris", "ile de france"] },
  amsterdam: { label: "Amsterdam", aliases: ["amsterdam", "randstad"] },
  stockholm: { label: "Stockholm", aliases: ["stockholm"] },
  gothenburg: { label: "Gothenburg", aliases: ["gothenburg", "goteborg"] },
  trondheim: { label: "Trondheim", aliases: ["trondheim"] },
  warsaw: { label: "Warsaw", aliases: ["warsaw", "warszawa"] },
  singapore: { label: "Singapore", aliases: ["singapore"] },
  bangalore: { label: "Bangalore", aliases: ["bangalore", "bengaluru"] },
  tokyo: { label: "Tokyo", aliases: ["tokyo"] },
  sydney: { label: "Sydney", aliases: ["sydney", "new south wales"] },
  hobart: { label: "Hobart", aliases: ["hobart", "tasmania"] },
  accra: { label: "Accra", aliases: ["accra"] },
  lagos: { label: "Lagos", aliases: ["lagos"] },
  toronto: { label: "Toronto", aliases: ["toronto", "ontario"] },
  united_kingdom: {
    label: "United Kingdom",
    aliases: [
      "united kingdom",
      "uk",
      "britain",
      "great britain",
      "england",
      "wales",
    ],
  },
  united_states: {
    label: "United States",
    aliases: ["united states", "usa", "us", "america"],
  },
  germany: { label: "Germany", aliases: ["germany", "deutschland"] },
  sweden: { label: "Sweden", aliases: ["sweden"] },
  norway: { label: "Norway", aliases: ["norway"] },
  poland: { label: "Poland", aliases: ["poland"] },
  australia: { label: "Australia", aliases: ["australia"] },
  ghana: { label: "Ghana", aliases: ["ghana"] },
  nigeria: { label: "Nigeria", aliases: ["nigeria"] },
  japan: { label: "Japan", aliases: ["japan"] },
  india: { label: "India", aliases: ["india"] },
  canada: { label: "Canada", aliases: ["canada"] },
  switzerland: { label: "Switzerland", aliases: ["switzerland"] },
  netherlands: { label: "Netherlands", aliases: ["netherlands", "holland"] },
  france: { label: "France", aliases: ["france"] },
  aarhus: { label: "Aarhus", aliases: ["aarhus", "arhus"] },
  aberdeen: { label: "Aberdeen", aliases: ["aberdeen", "aberdeenshire"] },
  abidjan: { label: "Abidjan", aliases: ["abidjan"] },
  abu_dhabi: { label: "Abu Dhabi", aliases: ["abu dhabi", "abudhabi"] },
  abuja: { label: "Abuja", aliases: ["abuja"] },
  addis_ababa: {
    label: "Addis Ababa",
    aliases: [
      "addis ababa",
      "addis abeba",
      "drop ('addis ababa' and 'addis abeba' carry the coverage)",
    ],
  },
  adelaide: {
    label: "Adelaide",
    aliases: [
      'drop bare "adelaide"; keep "adelaide australia" and "adelaide south australia", add "adelaide sa"',
      "adelaide australia",
      "adelaide south australia",
    ],
  },
  africa: { label: "Africa", aliases: ["africa"] },
  ahmedabad: { label: "Ahmedabad", aliases: ["ahmedabad", "amdavad"] },
  alexandria_egypt: {
    label: "Alexandria, Egypt",
    aliases: ["alexandria egypt"],
  },
  algeria: { label: "Algeria", aliases: ["algeria"] },
  algiers: { label: "Algiers", aliases: ["algiers"] },
  amman: { label: "Amman", aliases: ["amman"] },
  ankara: { label: "Ankara", aliases: ["ankara turkiye", "ankara turkey"] },
  antwerp: { label: "Antwerp", aliases: ["antwerp", "antwerpen"] },
  apac: {
    label: "APAC",
    aliases: [
      'drop bare "apac" from person-base scanning (keep "asia pacific" / "asia pacific region" for briefs only), or qualify as "based in apac"',
      "asia pacific",
      "asia pacific region",
    ],
  },
  argentina: { label: "Argentina", aliases: ["argentina"] },
  asuncion: { label: "Asunción, Paraguay", aliases: ["asuncion paraguay"] },
  athens: {
    label: "Athens",
    aliases: ["athina", "athens greece", "athens attica", "athens attiki"],
  },
  atlanta: {
    label: "Atlanta",
    aliases: ["atlanta", "metro atlanta", "atlanta georgia"],
  },
  auckland: {
    label: "Auckland",
    aliases: [
      'drop bare "auckland"; keep "auckland new zealand", add "auckland nz"',
      "auckland new zealand",
    ],
  },
  austria: {
    label: "Austria",
    aliases: ["austria", "osterreich", "oesterreich"],
  },
  bahrain: { label: "Bahrain", aliases: ["bahrain"] },
  baltics: {
    label: "The Baltics",
    aliases: ["baltics", "baltic states", "baltic countries"],
  },
  baltimore: {
    label: "Baltimore",
    aliases: ["baltimore", "greater baltimore", "baltimore maryland"],
  },
  bangkok: { label: "Bangkok", aliases: ["bangkok", "krung thep"] },
  bangladesh: { label: "Bangladesh", aliases: ["bangladesh"] },
  barcelona: {
    label: "Barcelona",
    aliases: [
      "keep 'barcelona' (it is genuinely dominant) but register 'barcelona anzoategui' and 'barcelona venezuela' as longer blocking phrases, exactly as the valencia note's logic requires.",
      "barcelona catalonia",
      "barcelona catalunya",
    ],
  },
  basel: { label: "Basel", aliases: ["basel", "basle", "basel stadt"] },
  bath_uk: {
    label: "Bath",
    aliases: ["bath somerset", "bath uk", "bath england"],
  },
  beijing: { label: "Beijing", aliases: ["beijing", "beijing china"] },
  beirut: { label: "Beirut", aliases: ["beirut"] },
  belfast: { label: "Belfast", aliases: ["belfast", "greater belfast"] },
  belgium: {
    label: "Belgium",
    aliases: ["belgium", "belgie", "belgique", "belgien"],
  },
  belgrade: { label: "Belgrade", aliases: ["belgrade", "beograd"] },
  belo_horizonte: { label: "Belo Horizonte", aliases: ["belo horizonte"] },
  benelux: { label: "Benelux", aliases: ["benelux"] },
  bergen: {
    label: "Bergen",
    aliases: [
      "bergen norway",
      "bergen norge",
      "bergen vestland",
      "bergen hordaland",
    ],
  },
  bilbao: { label: "Bilbao", aliases: ["bilbao", "bilbao bizkaia"] },
  birmingham_uk: {
    label: "Birmingham",
    aliases: [
      "birmingham uk",
      "birmingham england",
      "birmingham west midlands",
    ],
  },
  bogota: { label: "Bogotá", aliases: ["bogota"] },
  bologna: {
    label: "Bologna",
    aliases: ["bologna italy", "bologna italia", "bologna emilia romagna"],
  },
  bordeaux: {
    label: "Bordeaux",
    aliases: [
      "drop bare 'bordeaux'; keep 'bordeaux france' and add 'bordeaux gironde', 'bordeaux metropole', 'bordeaux nouvelle aquitaine'.",
      "bordeaux france",
    ],
  },
  botswana: { label: "Botswana", aliases: ["botswana"] },
  brasilia: { label: "Brasília", aliases: ["brasilia"] },
  bratislava: { label: "Bratislava", aliases: ["bratislava"] },
  brazil: { label: "Brazil", aliases: ["brazil", "brasil"] },
  brighton_uk: {
    label: "Brighton",
    aliases: [
      "brighton uk",
      "brighton england",
      "brighton and hove",
      "brighton east sussex",
      "hove",
    ],
  },
  brisbane: {
    label: "Brisbane",
    aliases: [
      'drop bare "brisbane"; keep "brisbane queensland" and "brisbane australia", add "brisbane qld"',
      "brisbane queensland",
      "brisbane australia",
    ],
  },
  brno: { label: "Brno", aliases: ["brno", "brno czechia"] },
  brussels: {
    label: "Brussels",
    aliases: [
      "keep 'brussels', but register 'brussels sprouts' (and 'brussel sprouts') as a longer no-op phrase so longest-first consumes it before the city alias fires.",
      "brussel",
      "bruxelles",
    ],
  },
  bucharest: { label: "Bucharest", aliases: ["bucharest", "bucuresti"] },
  budapest: { label: "Budapest", aliases: ["budapest"] },
  buenos_aires: { label: "Buenos Aires", aliases: ["buenos aires"] },
  bulgaria: { label: "Bulgaria", aliases: ["bulgaria"] },
  busan: { label: "Busan", aliases: ["busan", "pusan"] },
  cairo: {
    label: "Cairo",
    aliases: [
      "cairo egypt (keep 'greater cairo' and 'al qahirah'; district folds giza/maadi/new cairo retain metro coverage)",
      "greater cairo",
      "al qahirah",
    ],
  },
  calgary: { label: "Calgary", aliases: ["calgary", "calgary alberta"] },
  canberra: { label: "Canberra", aliases: ["canberra", "canberra act"] },
  cape_town: { label: "Cape Town", aliases: ["cape town", "kaapstad"] },
  caracas: { label: "Caracas", aliases: ["caracas"] },
  cardiff: { label: "Cardiff", aliases: ["cardiff", "caerdydd"] },
  casablanca: { label: "Casablanca", aliases: ["casablanca"] },
  cebu: { label: "Cebu", aliases: ["cebu", "cebu city"] },
  charlotte: {
    label: "Charlotte",
    aliases: ["charlotte north carolina", "charlotte nc"],
  },
  chennai: {
    label: "Chennai",
    aliases: ["chennai", "chennai india", "chennai tamil nadu"],
  },
  chicago: {
    label: "Chicago",
    aliases: ["chicago", "chicagoland", "greater chicago"],
  },
  chile: {
    label: "Chile",
    aliases: [
      "drop bare 'chile' unless 'green chile', 'chile relleno', 'chile powder' and 'chile con carne' are gazetted as longest-first exclusions; santiago_chile carries the professional coverage either way",
    ],
  },
  china: {
    label: "China",
    aliases: [
      'drop bare "china"; keep "mainland china" and "peoples republic of china" (every chinese city alias already carries "... china")',
      "mainland china",
      "peoples republic of china",
    ],
  },
  christchurch: {
    label: "Christchurch",
    aliases: [
      'drop bare "christchurch"; keep "christchurch new zealand", add "christchurch nz"',
      "christchurch new zealand",
    ],
  },
  cincinnati: {
    label: "Cincinnati",
    aliases: ["cincinnati", "greater cincinnati", "cincy"],
  },
  cleveland: {
    label: "Cleveland",
    aliases: ["cleveland", "cleveland ohio", "northeast ohio"],
  },
  cluj_napoca: { label: "Cluj-Napoca", aliases: ["cluj napoca", "cluj"] },
  cologne: {
    label: "Cologne",
    aliases: [
      "koeln",
      "koln",
      "cologne germany",
      "cologne nrw",
      "cologne north rhine westphalia",
    ],
  },
  colombia: { label: "Colombia", aliases: ["colombia"] },
  colombo: {
    label: "Colombo",
    aliases: [
      'drop bare "colombo"; keep "colombo sri lanka"',
      "colombo sri lanka",
    ],
  },
  columbus_ohio: {
    label: "Columbus, Ohio",
    aliases: ["columbus ohio", "central ohio"],
  },
  copenhagen: {
    label: "Copenhagen",
    aliases: ["copenhagen", "kobenhavn", "koebenhavn", "greater copenhagen"],
  },
  cordoba_argentina: {
    label: "Córdoba, Argentina",
    aliases: ["cordoba argentina"],
  },
  cork: { label: "Cork", aliases: ["cork munster"] },
  cork_ie: {
    label: "Cork",
    aliases: ["cork ireland", "county cork", "co cork", "corcaigh"],
  },
  costa_rica: { label: "Costa Rica", aliases: ["costa rica"] },
  coventry: { label: "Coventry", aliases: ["coventry"] },
  croatia: { label: "Croatia", aliases: ["croatia", "hrvatska"] },
  curitiba: { label: "Curitiba", aliases: ["curitiba"] },
  czechia: {
    label: "Czechia",
    aliases: ["czechia", "czech republic", "cesko", "ceska republika"],
  },
  dach_region: {
    label: "DACH Region",
    aliases: ["dach region", "dach market", "dach area"],
  },
  dakar: { label: "Dakar", aliases: ["dakar"] },
  dallas_fort_worth: {
    label: "Dallas-Fort Worth",
    aliases: [
      "dallas",
      "dallas fort worth",
      "dallas ft worth",
      "fort worth",
      "dfw metroplex",
    ],
  },
  dammam: {
    label: "Dammam",
    aliases: ["dammam", "al khobar", "khobar", "dhahran"],
  },
  dar_es_salaam: {
    label: "Dar es Salaam",
    aliases: ["dar es salaam", "dar es salam"],
  },
  delhi_ncr: {
    label: "Delhi NCR",
    aliases: [
      "delhi",
      "new delhi",
      "delhi ncr",
      "delhi national capital region",
    ],
  },
  denmark: { label: "Denmark", aliases: ["denmark", "danmark"] },
  denver: {
    label: "Denver",
    aliases: [
      "denver",
      "denver colorado",
      "denver metro",
      "front range colorado",
    ],
  },
  derby_uk: {
    label: "Derby",
    aliases: ["derby uk", "derby england", "derbyshire"],
  },
  dhaka: { label: "Dhaka", aliases: ["dhaka", "dacca"] },
  doha: {
    label: "Doha",
    aliases: [
      "keep 'doha' but gazette 'doha round', 'doha declaration' and 'doha development agenda' as longest-first exclusions",
    ],
  },
  dresden: { label: "Dresden", aliases: ["dresden", "dresden germany"] },
  dubai: { label: "Dubai", aliases: ["dubai"] },
  dublin: { label: "Dublin", aliases: ["dublin leinster"] },
  dublin_ie: {
    label: "Dublin",
    aliases: [
      "dublin ireland",
      "county dublin",
      "co dublin",
      "baile atha cliath",
      "greater dublin",
    ],
  },
  dundee: { label: "Dundee", aliases: ["dundee"] },
  durban: { label: "Durban", aliases: ["durban", "ethekwini"] },
  dusseldorf: {
    label: "Düsseldorf",
    aliases: ["dusseldorf", "duesseldorf", "dusseldorf germany"],
  },
  east_midlands: { label: "East Midlands", aliases: ["east midlands"] },
  ecuador: { label: "Ecuador", aliases: ["ecuador"] },
  edmonton: { label: "Edmonton", aliases: ["edmonton", "edmonton alberta"] },
  egypt: { label: "Egypt", aliases: ["egypt"] },
  eindhoven: {
    label: "Eindhoven",
    aliases: ["eindhoven", "brainport eindhoven"],
  },
  england: {
    label: "England",
    aliases: ["england uk", "england united kingdom"],
  },
  espoo: { label: "Espoo", aliases: ["espoo"] },
  estonia: { label: "Estonia", aliases: ["estonia", "eesti"] },
  ethiopia: { label: "Ethiopia", aliases: ["ethiopia"] },
  finland: { label: "Finland", aliases: ["finland", "suomi"] },
  florence: {
    label: "Florence",
    aliases: [
      "firenze",
      "florence italy",
      "florence tuscany",
      "florence toscana",
    ],
  },
  florianopolis: {
    label: "Florianópolis",
    aliases: ["florianopolis", "floripa"],
  },
  frankfurt: {
    label: "Frankfurt",
    aliases: [
      "keep 'frankfurt', but register 'frankfurt oder' and 'frankfurt an der oder' as longer blocking phrases so they are consumed first.",
      "frankfurt am main",
      "rhein main",
      "rhine main",
    ],
  },
  fukuoka: { label: "Fukuoka", aliases: ["fukuoka", "fukuoka japan"] },
  gaborone: { label: "Gaborone", aliases: ["gaborone"] },
  galway: { label: "Galway", aliases: ["galway", "gaillimh"] },
  gdansk: {
    label: "Gdansk",
    aliases: ["gdansk", "trojmiasto", "gdansk poland"],
  },
  geneva: {
    label: "Geneva",
    aliases: [
      "drop bare 'geneva'; keep 'geneve', 'genf', 'geneva switzerland' and add 'canton of geneva', 'grand geneve'.",
      "geneve",
      "genf",
      "geneva switzerland",
    ],
  },
  ghent: {
    label: "Ghent",
    aliases: ["ghent", "gent belgium", "gent oost vlaanderen"],
  },
  glasgow: { label: "Glasgow", aliases: ["glasgow", "greater glasgow"] },
  graz: { label: "Graz", aliases: ["graz", "graz styria", "graz steiermark"] },
  greece: {
    label: "Greece",
    aliases: [
      "greece",
      "drop 'hellas'; keep 'greece', 'ellada' and add 'elliniki dimokratia'.",
      "ellada",
    ],
  },
  grenoble: { label: "Grenoble", aliases: ["grenoble"] },
  guadalajara: {
    label: "Guadalajara",
    aliases: [
      "guadalajara mexico (plus 'guadalajara jalisco'; the zapopan fold retains metro coverage)",
    ],
  },
  guangzhou: { label: "Guangzhou", aliases: ["guangzhou", "guangzhou china"] },
  gurugram: { label: "Gurugram", aliases: ["gurugram", "gurgaon"] },
  haifa: { label: "Haifa", aliases: ["haifa"] },
  halifax: {
    label: "Halifax, Nova Scotia",
    aliases: ["halifax nova scotia", "halifax ns"],
  },
  hamburg: { label: "Hamburg", aliases: ["hamburg", "hamburg germany"] },
  hangzhou: { label: "Hangzhou", aliases: ["hangzhou"] },
  hanoi: { label: "Hanoi", aliases: ["hanoi", "ha noi"] },
  harare: { label: "Harare", aliases: ["harare"] },
  helsinki: {
    label: "Helsinki",
    aliases: ["helsinki", "helsingfors", "greater helsinki"],
  },
  ho_chi_minh_city: {
    label: "Ho Chi Minh City",
    aliases: [
      "ho chi minh city",
      'drop "ho chi minh"; "ho chi minh city", "hcmc" and "saigon" already cover the city',
      "hcmc",
      "saigon",
    ],
  },
  hong_kong: {
    label: "Hong Kong",
    aliases: ["hong kong", "hongkong", "hong kong sar"],
  },
  houston: {
    label: "Houston",
    aliases: ["houston", "houston texas", "greater houston"],
  },
  hsinchu: { label: "Hsinchu", aliases: ["hsinchu", "hsinchu science park"] },
  hungary: { label: "Hungary", aliases: ["hungary", "magyarorszag"] },
  hyderabad: {
    label: "Hyderabad",
    aliases: [
      'drop bare "hyderabad"; keep "hyderabad india" and "hyderabad telangana"',
      "hyderabad india",
      "hyderabad telangana",
    ],
  },
  indonesia: { label: "Indonesia", aliases: ["indonesia"] },
  ireland: {
    label: "Ireland",
    aliases: [
      "ship 'northern ireland' as a united_kingdom alias in the same change; if that cannot be done here, drop bare 'ireland' and keep only 'republic of ireland', 'eire', 'ireland republic'.",
      "republic of ireland",
      "eire",
    ],
  },
  islamabad: { label: "Islamabad", aliases: ["islamabad"] },
  israel: {
    label: "Israel",
    aliases: [
      "state of israel (bare form drop; tel_aviv, haifa and jerusalem carry the practical coverage, exactly as amman was made to carry jordan)",
    ],
  },
  istanbul: { label: "Istanbul", aliases: ["istanbul", "istanbul turkiye"] },
  italy: { label: "Italy", aliases: ["italy", "italia"] },
  ivory_coast: {
    label: "Ivory Coast",
    aliases: ["ivory coast", "cote d ivoire", "cote divoire"],
  },
  jakarta: {
    label: "Jakarta",
    aliases: ["jakarta", "dki jakarta", "jabodetabek"],
  },
  jeddah: { label: "Jeddah", aliases: ["jeddah", "jiddah"] },
  jerusalem: {
    label: "Jerusalem",
    aliases: [
      "keep 'jerusalem' but gazette 'jerusalem artichoke' and 'new jerusalem' as longest-first exclusion phrases, and delete the note, which asserts a protection that does not exist",
    ],
  },
  johannesburg: {
    label: "Johannesburg",
    aliases: ["johannesburg", "joburg", "jozi"],
  },
  jordan: { label: "Jordan", aliases: ["hashemite kingdom of jordan"] },
  kampala: { label: "Kampala", aliases: ["kampala"] },
  kansas_city: {
    label: "Kansas City",
    aliases: ["kansas city", "greater kansas city", "kansas city missouri"],
  },
  karachi: { label: "Karachi", aliases: ["karachi"] },
  kenya: { label: "Kenya", aliases: ["kenya"] },
  kigali: { label: "Kigali", aliases: ["kigali"] },
  kingston_jamaica: {
    label: "Kingston, Jamaica",
    aliases: ["kingston jamaica"],
  },
  kolkata: { label: "Kolkata", aliases: ["kolkata", "calcutta"] },
  krakow: { label: "Krakow", aliases: ["krakow", "cracow"] },
  kuala_lumpur: {
    label: "Kuala Lumpur",
    aliases: ["kuala lumpur", "klang valley"],
  },
  kumasi: { label: "Kumasi", aliases: ["kumasi"] },
  kuwait: { label: "Kuwait", aliases: ["kuwait"] },
  kuwait_city: { label: "Kuwait City", aliases: ["kuwait city"] },
  kyiv: { label: "Kyiv", aliases: ["kyiv", "kiev", "kyiv ukraine"] },
  kyoto: {
    label: "Kyoto",
    aliases: [
      'drop bare "kyoto"; keep "kyoto japan" and add "kyoto city"',
      "kyoto japan",
    ],
  },
  lahore: { label: "Lahore", aliases: ["lahore"] },
  las_vegas: {
    label: "Las Vegas",
    aliases: ["las vegas", "vegas", "las vegas nevada", "southern nevada"],
  },
  latin_america: {
    label: "Latin America",
    aliases: [
      "latin america",
      "america latina",
      "keep 'latam' only with 'latam airlines' gazetted as a longest-first exclusion; otherwise drop for consistency with 'emirates'",
    ],
  },
  latvia: { label: "Latvia", aliases: ["latvia", "latvija"] },
  lausanne: { label: "Lausanne", aliases: ["lausanne"] },
  lebanon: {
    label: "Lebanon",
    aliases: [
      "drop bare 'lebanon' (beirut carries the coverage, exactly as amman was made to carry jordan)",
    ],
  },
  leeds: { label: "Leeds", aliases: ["leeds"] },
  leicester: { label: "Leicester", aliases: ["leicester", "leicestershire"] },
  leipzig: { label: "Leipzig", aliases: ["leipzig", "leipzig germany"] },
  leuven: { label: "Leuven", aliases: ["leuven", "leuven belgium"] },
  lille: {
    label: "Lille",
    aliases: [
      "drop bare 'lille'; keep 'lille france' and add 'lille hauts de france', 'metropole europeenne de lille', 'lille nord'.",
      "lille france",
    ],
  },
  lima_peru: { label: "Lima, Peru", aliases: ["lima peru"] },
  limerick_ie: {
    label: "Limerick",
    aliases: [
      "limerick ireland",
      "county limerick",
      "co limerick",
      "luimneach",
    ],
  },
  lisbon: { label: "Lisbon", aliases: ["lisbon", "lisboa", "greater lisbon"] },
  lithuania: { label: "Lithuania", aliases: ["lithuania", "lietuva"] },
  liverpool: { label: "Liverpool", aliases: ["liverpool"] },
  ljubljana: { label: "Ljubljana", aliases: ["ljubljana"] },
  los_angeles: {
    label: "Los Angeles",
    aliases: [
      "los angeles",
      "greater los angeles",
      "los angeles county",
      "silicon beach",
    ],
  },
  lusaka: { label: "Lusaka", aliases: ["lusaka"] },
  luxembourg: {
    label: "Luxembourg",
    aliases: ["luxembourg", "luxemburg", "luxembourg city", "letzebuerg"],
  },
  lviv: { label: "Lviv", aliases: ["lviv", "lviv ukraine"] },
  lyon: {
    label: "Lyon",
    aliases: [
      "drop bare 'lyon'; keep 'lyon france' and add 'grand lyon', 'lyon rhone', 'lyon auvergne rhone alpes'.",
      "lyon france",
    ],
  },
  madrid: { label: "Madrid", aliases: ["madrid", "comunidad de madrid"] },
  malaga: {
    label: "Malaga",
    aliases: ["malaga", "malaga andalusia", "malaga andalucia"],
  },
  malaysia: { label: "Malaysia", aliases: ["malaysia"] },
  malmo: { label: "Malmö", aliases: ["malmo", "malmoe"] },
  manama: { label: "Manama", aliases: ["manama"] },
  manila: {
    label: "Manila",
    aliases: [
      'drop bare "manila"; keep "metro manila" and "manila philippines" only',
      "metro manila",
      "manila philippines",
    ],
  },
  marseille: {
    label: "Marseille",
    aliases: ["marseille", "marseilles", "aix marseille"],
  },
  medellin: { label: "Medellín", aliases: ["medellin"] },
  melbourne: {
    label: "Melbourne",
    aliases: ["melbourne australia", "melbourne victoria", "melbourne vic"],
  },
  mexico: {
    label: "Mexico",
    aliases: [
      "drop bare 'mexico' until a new_mexico entry and a 'gulf of mexico' exclusion phrase ship in the same change",
    ],
  },
  mexico_city: {
    label: "Mexico City",
    aliases: ["mexico city", "ciudad de mexico", "cdmx"],
  },
  miami: {
    label: "Miami",
    aliases: ["miami", "miami florida", "south florida", "greater miami"],
  },
  middle_east: {
    label: "Middle East",
    aliases: ["middle east", "mena region"],
  },
  milan: {
    label: "Milan",
    aliases: [
      "milano",
      "milan italy",
      "milan italia",
      "milan lombardy",
      "milan lombardia",
    ],
  },
  milton_keynes: { label: "Milton Keynes", aliases: ["milton keynes"] },
  monterrey: { label: "Monterrey", aliases: ["monterrey"] },
  montevideo: { label: "Montevideo", aliases: ["montevideo"] },
  montreal: {
    label: "Montreal",
    aliases: ["montreal", "montreal quebec", "greater montreal"],
  },
  morocco: { label: "Morocco", aliases: ["morocco", "maroc"] },
  mumbai: {
    label: "Mumbai",
    aliases: [
      "mumbai",
      'drop "bombay"; keep "mumbai" and "mumbai india" (use "bombay india" / "bombay maharashtra" if the old form is needed at all)',
      "mumbai india",
    ],
  },
  muscat: { label: "Muscat", aliases: ["muscat oman"] },
  nagoya: { label: "Nagoya", aliases: ["nagoya", "nagoya japan"] },
  nairobi: { label: "Nairobi", aliases: ["nairobi"] },
  namibia: { label: "Namibia", aliases: ["namibia"] },
  nantes: { label: "Nantes", aliases: ["nantes", "nantes france"] },
  naples: {
    label: "Naples",
    aliases: ["napoli", "naples italy", "naples campania"],
  },
  nashville: {
    label: "Nashville",
    aliases: ["nashville", "nashville tennessee", "middle tennessee"],
  },
  new_mexico: {
    label: "New Mexico",
    aliases: ["new mexico", "albuquerque", "santa fe new mexico"],
  },
  new_orleans: {
    label: "New Orleans",
    aliases: ["new orleans", "new orleans louisiana", "nola"],
  },
  new_zealand: { label: "New Zealand", aliases: ["new zealand", "aotearoa"] },
  newcastle_uk: {
    label: "Newcastle upon Tyne",
    aliases: [
      "newcastle upon tyne",
      "newcastle uk",
      "newcastle england",
      "tyneside",
    ],
  },
  nice: {
    label: "Nice",
    aliases: [
      "nice france",
      "nice provence",
      "nice cote d azur",
      "nice alpes maritimes",
    ],
  },
  noida: { label: "Noida", aliases: ["noida", "greater noida"] },
  nordics: {
    label: "The Nordics",
    aliases: ["nordics", "nordic countries", "nordic region", "scandinavia"],
  },
  north_east_england: {
    label: "North East England",
    aliases: ["north east england"],
  },
  north_west_england: {
    label: "North West England",
    aliases: ["north west england"],
  },
  northern_ireland: {
    label: "Northern Ireland",
    aliases: ["northern ireland"],
  },
  nottingham: {
    label: "Nottingham",
    aliases: ["nottingham", "nottinghamshire"],
  },
  novi_sad: { label: "Novi Sad", aliases: ["novi sad"] },
  nuremberg: {
    label: "Nuremberg",
    aliases: ["nuremberg", "nurnberg", "nuernberg"],
  },
  oman: { label: "Oman", aliases: ["oman"] },
  orange_county: {
    label: "Orange County",
    aliases: ["orange county", "orange county california"],
  },
  orlando: {
    label: "Orlando",
    aliases: ["orlando florida", "orlando fl", "central florida"],
  },
  osaka: { label: "Osaka", aliases: ["osaka", "osaka japan"] },
  oslo: { label: "Oslo", aliases: ["oslo", "oslo norway", "oslo norge"] },
  ottawa: {
    label: "Ottawa",
    aliases: ["ottawa", "ottawa gatineau", "gatineau"],
  },
  oxford: { label: "Oxford", aliases: ["oxford", "oxfordshire"] },
  pakistan: { label: "Pakistan", aliases: ["pakistan"] },
  panama: {
    label: "Panama",
    aliases: [
      "drop bare 'panama' unless 'panama papers', 'panama canal' and 'panama hat' ship as longest-first exclusions; panama_city plus 'republic of panama' carry the rest",
    ],
  },
  panama_city: {
    label: "Panama City",
    aliases: [
      "panama city panama (keep 'ciudad de panama')",
      "ciudad de panama",
    ],
  },
  paraguay: { label: "Paraguay", aliases: ["paraguay"] },
  perth: {
    label: "Perth",
    aliases: ["perth australia", "perth western australia", "perth wa"],
  },
  peru: { label: "Peru", aliases: ["peru"] },
  philadelphia: {
    label: "Philadelphia",
    aliases: [
      "philadelphia",
      "philly",
      "greater philadelphia",
      "philadelphia pennsylvania",
    ],
  },
  philippines: {
    label: "Philippines",
    aliases: ["philippines", "the philippines", "pilipinas"],
  },
  phoenix: {
    label: "Phoenix",
    aliases: [
      "phoenix arizona",
      "phoenix az",
      "greater phoenix",
      "valley of the sun",
    ],
  },
  pittsburgh: {
    label: "Pittsburgh",
    aliases: ["pittsburgh", "pittsburgh pennsylvania", "greater pittsburgh"],
  },
  portland_oregon: {
    label: "Portland, Oregon",
    aliases: ["portland oregon", "portland ore"],
  },
  porto: {
    label: "Porto",
    aliases: ["porto portugal", "oporto", "porto metropolitan area"],
  },
  porto_alegre: { label: "Porto Alegre", aliases: ["porto alegre"] },
  portsmouth_uk: {
    label: "Portsmouth",
    aliases: ["portsmouth uk", "portsmouth england", "portsmouth hampshire"],
  },
  portugal: { label: "Portugal", aliases: ["portugal"] },
  poznan: { label: "Poznan", aliases: ["poznan"] },
  prague: { label: "Prague", aliases: ["prague", "praha", "prague czechia"] },
  pretoria: { label: "Pretoria", aliases: ["pretoria", "tshwane"] },
  puerto_rico: { label: "Puerto Rico", aliases: ["puerto rico"] },
  pune: { label: "Pune", aliases: ["pune", "poona"] },
  qatar: { label: "Qatar", aliases: ["qatar"] },
  quebec_city: {
    label: "Quebec City",
    aliases: ["quebec city", "ville de quebec"],
  },
  quito: { label: "Quito", aliases: ["quito", "quito ecuador"] },
  rabat: { label: "Rabat", aliases: ["rabat morocco (plus 'rabat maroc')"] },
  randstad: {
    label: "The Randstad",
    aliases: [
      "the randstad",
      "de randstad",
      "randstad netherlands",
      "randstad area",
    ],
  },
  reading_uk: {
    label: "Reading",
    aliases: ["reading berkshire", "reading uk", "reading england"],
  },
  recife: { label: "Recife", aliases: ["recife"] },
  research_triangle: {
    label: "Raleigh-Durham",
    aliases: [
      "research triangle",
      "research triangle park",
      "raleigh durham",
      "raleigh",
      "durham north carolina",
      "durham nc",
    ],
  },
  riga: { label: "Riga", aliases: ["riga", "riga latvia"] },
  rio_de_janeiro: { label: "Rio de Janeiro", aliases: ["rio de janeiro"] },
  riyadh: { label: "Riyadh", aliases: ["riyadh", "ar riyadh"] },
  romania: { label: "Romania", aliases: ["romania"] },
  rome: {
    label: "Rome",
    aliases: [
      "rome italy",
      "roma italy",
      "roma italia",
      "rome lazio",
      "drop 'roma lazio'; keep 'roma italia', 'roma italy', 'rome lazio', 'rome italy' and drop the near-useless 'rome latium'.",
      "rome latium",
    ],
  },
  rotterdam: { label: "Rotterdam", aliases: ["rotterdam"] },
  ruhr_area: {
    label: "Ruhr Area",
    aliases: ["ruhrgebiet", "ruhr area", "ruhr region", "ruhr valley"],
  },
  rwanda: { label: "Rwanda", aliases: ["rwanda"] },
  sacramento: {
    label: "Sacramento",
    aliases: ["sacramento", "sacramento california", "greater sacramento"],
  },
  salt_lake_city: {
    label: "Salt Lake City",
    aliases: ["salt lake city", "salt lake", "silicon slopes", "wasatch front"],
  },
  san_antonio: {
    label: "San Antonio",
    aliases: ["san antonio", "san antonio texas"],
  },
  san_diego: {
    label: "San Diego",
    aliases: ["san diego", "san diego california", "greater san diego"],
  },
  san_jose_costa_rica: {
    label: "San José, Costa Rica",
    aliases: ["san jose costa rica"],
  },
  san_juan_puerto_rico: {
    label: "San Juan, Puerto Rico",
    aliases: ["san juan puerto rico", "san juan pr"],
  },
  santiago_chile: {
    label: "Santiago, Chile",
    aliases: ["santiago chile", "santiago de chile"],
  },
  sao_paulo: { label: "São Paulo", aliases: ["sao paulo"] },
  saudi_arabia: {
    label: "Saudi Arabia",
    aliases: [
      "saudi arabia",
      "drop ('saudi arabia' and 'ksa' carry the coverage)",
      "ksa",
    ],
  },
  senegal: { label: "Senegal", aliases: ["senegal"] },
  seoul: {
    label: "Seoul",
    aliases: ["seoul", "seoul korea", "seoul capital area"],
  },
  serbia: { label: "Serbia", aliases: ["serbia", "srbija"] },
  seville: {
    label: "Seville",
    aliases: ["seville", "sevilla", "seville andalusia"],
  },
  shanghai: {
    label: "Shanghai",
    aliases: [
      'drop bare "shanghai"; keep "shanghai china" (add "shanghai municipality" if recall matters)',
      "shanghai china",
    ],
  },
  sharjah: { label: "Sharjah", aliases: ["sharjah"] },
  shenzhen: { label: "Shenzhen", aliases: ["shenzhen", "shenzhen china"] },
  slovakia: {
    label: "Slovakia",
    aliases: ["slovakia", "slovensko", "slovak republic"],
  },
  slovenia: { label: "Slovenia", aliases: ["slovenia", "slovenija"] },
  sofia: {
    label: "Sofia",
    aliases: ["sofia bulgaria", "sofia city", "sofia oblast"],
  },
  south_africa: {
    label: "South Africa",
    aliases: ["south africa", "republic of south africa"],
  },
  south_korea: {
    label: "South Korea",
    aliases: [
      "south korea",
      'drop bare "korea"; keep "south korea" and "republic of korea", add "korea south"',
      "republic of korea",
    ],
  },
  southampton: { label: "Southampton", aliases: ["southampton"] },
  southeast_asia: {
    label: "Southeast Asia",
    aliases: [
      "southeast asia",
      "south east asia",
      'drop "asean"; keep "southeast asia" and "south east asia"',
    ],
  },
  spain: { label: "Spain", aliases: ["spain", "espana"] },
  sri_lanka: { label: "Sri Lanka", aliases: ["sri lanka"] },
  st_louis: {
    label: "St. Louis",
    aliases: [
      "st louis",
      "saint louis",
      "st louis missouri",
      "greater st louis",
    ],
  },
  stavanger: { label: "Stavanger", aliases: ["stavanger", "stavanger norway"] },
  stuttgart: {
    label: "Stuttgart",
    aliases: ["stuttgart", "stuttgart germany"],
  },
  swansea: { label: "Swansea", aliases: ["swansea", "abertawe"] },
  taipei: {
    label: "Taipei",
    aliases: ["taipei", "taipei city", "taipei taiwan"],
  },
  taiwan: { label: "Taiwan", aliases: ["taiwan"] },
  tallinn: { label: "Tallinn", aliases: ["tallinn"] },
  tampa: { label: "Tampa", aliases: ["tampa", "tampa bay", "tampa florida"] },
  tampere: { label: "Tampere", aliases: ["tampere"] },
  tanzania: { label: "Tanzania", aliases: ["tanzania"] },
  tel_aviv: {
    label: "Tel Aviv",
    aliases: ["tel aviv", "tel aviv yafo", "tel aviv jaffa"],
  },
  thailand: { label: "Thailand", aliases: ["thailand"] },
  thames_valley: {
    label: "Thames Valley",
    aliases: ["thames valley", "m4 corridor"],
  },
  the_hague: {
    label: "The Hague",
    aliases: ["the hague", "den haag", "s gravenhage", "hague netherlands"],
  },
  thessaloniki: {
    label: "Thessaloniki",
    aliases: ["thessaloniki", "salonika"],
  },
  timisoara: { label: "Timisoara", aliases: ["timisoara"] },
  toulouse: { label: "Toulouse", aliases: ["toulouse", "toulouse occitanie"] },
  tunis: { label: "Tunis", aliases: ["tunis"] },
  tunisia: { label: "Tunisia", aliases: ["tunisia"] },
  turin: {
    label: "Turin",
    aliases: ["turin", "torino", "turin piedmont", "torino piemonte"],
  },
  turkiye: { label: "Türkiye", aliases: ["turkiye", "republic of turkiye"] },
  twin_cities: {
    label: "Minneapolis-Saint Paul",
    aliases: [
      "twin cities",
      "minneapolis",
      "minneapolis st paul",
      "saint paul minnesota",
      "st paul minnesota",
    ],
  },
  uganda: { label: "Uganda", aliases: ["uganda"] },
  ukraine: { label: "Ukraine", aliases: ["ukraine", "ukraina"] },
  united_arab_emirates: {
    label: "United Arab Emirates",
    aliases: ["united arab emirates", "uae"],
  },
  uppsala: { label: "Uppsala", aliases: ["uppsala"] },
  uruguay: { label: "Uruguay", aliases: ["uruguay"] },
  utrecht: { label: "Utrecht", aliases: ["utrecht"] },
  valencia: {
    label: "Valencia",
    aliases: [
      "valencia spain",
      "valencia espana",
      "valencia comunidad valenciana",
      "valencia valencian community",
    ],
  },
  vancouver: {
    label: "Vancouver",
    aliases: [
      "vancouver",
      "vancouver bc",
      "vancouver british columbia",
      "metro vancouver",
      "greater vancouver",
    ],
  },
  venezuela: { label: "Venezuela", aliases: ["venezuela"] },
  vienna: { label: "Vienna", aliases: ["wien", "vienna austria"] },
  vietnam: {
    label: "Vietnam",
    aliases: [
      'drop bare "vietnam" unless a real stop-phrase table ships; keep "viet nam" plus the city concepts hanoi and ho chi minh city',
      "viet nam",
    ],
  },
  vilnius: { label: "Vilnius", aliases: ["vilnius"] },
  wales: {
    label: "Wales",
    aliases: ["cymru", "wales uk", "wales united kingdom", "north wales"],
  },
  washington_dc: {
    label: "Washington DC",
    aliases: [
      "washington dc",
      "washington d c",
      "district of columbia",
      "northern virginia",
      "greater washington",
    ],
  },
  waterloo_ontario: {
    label: "Waterloo, Ontario",
    aliases: [
      "waterloo ontario",
      "kitchener waterloo",
      "waterloo region",
      "region of waterloo",
    ],
  },
  wellington: {
    label: "Wellington",
    aliases: ["wellington new zealand", "wellington nz"],
  },
  west_midlands: { label: "West Midlands", aliases: ["west midlands"] },
  windhoek: { label: "Windhoek", aliases: ["windhoek"] },
  winnipeg: { label: "Winnipeg", aliases: ["winnipeg", "winnipeg manitoba"] },
  wroclaw: { label: "Wroclaw", aliases: ["wroclaw"] },
  york_uk: {
    label: "York",
    aliases: ["york uk", "york england", "north yorkshire"],
  },
  yorkshire: { label: "Yorkshire", aliases: ["yorkshire"] },
  zagreb: { label: "Zagreb", aliases: ["zagreb"] },
  zambia: { label: "Zambia", aliases: ["zambia"] },
  zimbabwe: { label: "Zimbabwe", aliases: ["zimbabwe"] },
};
