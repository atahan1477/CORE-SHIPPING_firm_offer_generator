// Shared configuration extracted from the original single-file app.
// Future tools can import this file and stay aligned with the same vessel list,
// defaults, and term behavior.

export const config = {
      vesselOptions: ["CORE TBN", "MV ATA 1", "MV ANUBIS", "MV ANUNNAKI", "MV ADMIRAL DE RIBAS", "MV MUSTAFA K", "MV GOLDY SEVEN", "MV HORUS", "MV AST RISING", "M/V LDR SAKINE", "MV AST MALTA", "MV AST ECO", "MV FORESTER", "MV LILIBET"],
      vesselSpecs: {"CORE TBN": "", "MV ATA 1": "GENERAL CARGO / BOX SHAPED\nBUILT 2006 – IMO 9378010\nPANAMA FLAG / BULGARIAN CLASS\n6,555 DWAT ON 6.2 M SSWD\nGRT/NRT 4655/2306 T\nLOA 118.60 M / BEAM 16.20 M / DEPTH 7.80 M / LBP 109.19 M\n3 HO / HA – GRAIN BALE – 8285.12 CBM\nGEARLESS – PONTOON HA COVERS GANTRY CRANE", "MV ANUBIS": "IMO 9226695 / Built 2000\nDWT 8504 on 8.023 mtr\nLOA 117.92 m\nBeam 19.40 m\nNRT / GRT 3116 / 6272\nG/B 10500 cbm\n2HOHA\nGeared 2 x 150t SWL\nContainer fitted\nADA", "MV ANUNNAKI": "IMO 9210713 / Built 2001\nDWT 9002 on 7.6 mtr\nLOA 126.42 m\nBeam 19.40 m\nGRT / NRT 7091 / 3492\nG/B 11357 cbm\n2HOHA\nGeared 2 x 60t SWL\nADA", "MV ADMIRAL DE RIBAS": "3,680 MTS DWT ON 5.5 M SSW\n1994 BUILT SLOVENIA – DOUBLE SKINNED\nFULLY BOX / PHRS CLASS / PALAU FLAG\n1 HO/HA – 56.55 x 10.02 x 8.12 m\nGRAIN / BALE 164,213 / 163,153 CBFT\nGRT 2,446 / NRT 957\nTEU HOLD/DECK 108 / 68\nBOW THRUSTER / APP.B FITTED / 2 MOVEABLE BULKHEADS\nTHOMAS MILLER P&I / H&M CEE SPECIALTY\nADA", "MV MUSTAFA K": "7,165 DWT | 1990 Built\nGeared 2 x 25t SWL\nGrain / Bale 9701 cbm / 8903 cbm\nLOA 106.86 m\nSummer Draft 6.8 m", "MV GOLDY SEVEN": "BLT 1996\nFLAG ZANZIBAR / HOMEPORT TANZANIA / IMO 9135731\nDWCC SUMMER 4000 MTS / WINTER 3850 MTS\nLOA 89.77 M / BEAM 13.17 M / DRAFT SSW 5.66 M\nGRAIN CAPACITY 192359 CBFT / GT 2844 / NT 1568\nDRAFT IN BALLAST 3.52 M\nHO/HA 1/1\nHOLD 59.50 x 11.00 x 8.43 m\nHATCH 62.50 x 11.00 m\nHATCH TYPE Coops & Nieborg\nGEARLESS", "MV HORUS": "9,500 DWCC | 1993 Built\nGeared 2 x 40t SWL\nGrain / Bale 342,694 / 1387,048 CBFT\nGT / NT 7366 / 3614\nLOA 122.33 m\nSummer Draft 8.85 m", "MV AST RISING": "FLAG MARSHALL ISLAND / CLASS KOREAN REGISTER / ICE CLASS\nTYPE GENERAL CARGO / HULL STEEL\nBUILT 2009\nGT / NT 4109 / 2332\nDEADWEIGHT 6088.32 MT\nLOA 99.89 M / LBP 94.72 M\nBREADTH 16.60 M / DEPTH 8.40 M\nSUMMER DRAFT 6.70 M\n2 CRANES IHI-WM 30 MT\nCONTAINER ON DECK FITTED\n2 CARGO HOLDS / SINGLE DECK / DOUBLE HULL\nGRAIN CAPACITY 7835.65 M3\nHATCH COVERS HYDRAULIC SINGLE PULL TYPE\nADA", "M/V LDR SAKINE": "6445 DWT ON 7.25 METERS\nG/C – SID\nBLT 1993 / DOUBLE SKIN / BOX / IMO & GRAIN FITTED\nFLAG PANAMA / CLASS PRS\nLOA 111.10 M / BEAM 16 M / DRAFT 7.25 M\nGRT / NRT 4193 / 2168\nHO/HA 3/3 / GRAIN-BALE 249735 / 246681 CUFT\nGEARLESS / LONDON P&I / CONTAINER FITTED\nIMO 1 FITTED\nADA-WOG", "MV AST MALTA": "OPEN HATCH / BOX / GLESS / SID\nBUILT 1998 / KR(IACS) / PALAU FLAG / ICE CLASS 1A\n5,001 / 4,650 DWAT / DWCC\nLOA 99.63 M / DRAFT 6.18 M / BEAM 16.90 M\nGT / NT 3415 / 1661\nFOLDING TYPE (KVAERNER) HATCH COVERS\nEQUIPPED FOR DANGEROUS GOODS\n2HO / 3HA / GR-BL 205,000 / 201,000 CBFT\nAPP B / IMO CARGO / CONTAINER FITTED / REEFER PLUGS\nABOUT 260 TEU / FULL LASHINGS ON BOARD\nADA WOG", "MV AST ECO": "FLAG MARSHALL ISLAND\nBUILT 2007\nCLASS KR(IACS)\nP&I THE LONDON P&I CLUB\nSHIP TYPE GENERAL CARGO\nGT 1972 / NT 1271\nDWT 3327 MT\nDRAFT 5.5 M\nLOA / LBP 81 / 76 M\nBEAM 13.6 M / DEPTH 6.8 M\nELECTRIC SINGLE PULL MACGREGOR HATCH COVERS\nHATCH SIZE NO.1 18.6 x 9.0 / NO.2 18.6 x 9.0\nGRAIN 4541 M / BALE 4468 M", "MV FORESTER": "1990 GERMAN BLT / SID / GLESS / BOX\nOPEN HATCH / TANZANIA FLAG / LONDON P&I / PRS CLASS\nIMO FITTED / BOW THRUSTER FITTED\nDWT 4902 / GRT 2827 / NRT 1595 / GR-BL 200,000 CBFT\nLOA 88.20 M / BEAM 13.60 M / LBP 84.93 M / DEPTH 7.70 M\nSUMMER DRAFT 6.60 M / AIR DRAFT 26.70 M\n1 HO / 1 HA\nHOLD 58.20 x 11.10 x 8.80\nHATCH 56.40 x 11.10 x 2.45\n2 MOVEABLE BULKHEADS FITTED\nIMO 1 / ITF FITTED\nADA WOG", "MV LILIBET": "IMO 8649993\nTANZANIA FLAG / BUILT 2005\nINMB CLASS / 4500 DWCC ON 5.7 M SW\nLOA / LBP / BEAM / DEPTH 96.08 / 89.90 / 14.20 / 7.20 M\nGRT / NRT 2994 / 1676\nGRAIN / BALE 214,684 / 214,684 CBFT\n2HO / 2HA OPEN HATCH"},
      underDeckOptions: ["Under deck", "Under/On deck", "Under/On deck in OO", "On deck", "BB items under deck / containers on deck"],
      cargoStackableOptions: ["Cargo fully stackable", "Cargo partly stackable", "Cargo not stackable", "Cargo not stackable except containers"],
      currencyOptions: ["USD", "EURO"],
      freightTermsOptions: ["pmt", "lumpsum", "per cbm"],
      termsOptions: ["Free In Free Out", "Free In Liner Out", "Liner In Free Out", "Liner In Liner Out"],
      laytimeTermsOptions: ["sshinc", "shinc", "fshinc", "sshex", "shex", "fshex"],
      agentOptions: ["TBA", "Reba Shipping", "Supermaritime", "New Marine", "Hull Blyth Shipping", "AGL", "OBT"],
      defaults: {
        vessel: "CORE TBN",
        underDeck: "Under deck",
        cargoStackable: "Cargo fully stackable",
        currency: "USD",
        freightTerms: "pmt",
        terms: "Free In Free Out",
        loadingTerms: "sshinc",
        dischargingTerms: "sshinc",
        agentLoad: "TBA",
        agentDischarge: "TBA"
      }
    };

export const TERM_BEHAVIOR = {
      "Free In Free Out": {
        mode: "laytime",
        meaning: "Free In Free Out = Loading and discharging on free in / free out basis.",
        structure: "Selected structure: day-based loading / discharging laytime fields for both ends."
      },
      "Free In Liner Out": {
        mode: "laytime",
        meaning: "Free In Liner Out = Loading on free in basis and discharging on liner out basis.",
        structure: "Selected structure: day-based loading / discharging laytime fields matched to the selected term."
      },
      "Liner In Free Out": {
        mode: "laytime",
        meaning: "Liner In Free Out = Loading on liner in basis and discharging on free out basis.",
        structure: "Selected structure: day-based loading / discharging laytime fields matched to the selected term."
      },
      "Liner In Liner Out": {
        mode: "laytime",
        meaning: "Liner In Liner Out = Loading and discharging on liner in / liner out basis.",
        structure: "Selected structure: day-based loading / discharging laytime fields for both ends."
      }
    };
