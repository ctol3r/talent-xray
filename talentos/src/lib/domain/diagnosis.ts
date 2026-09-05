/**
 * Pipeline diagnosis — rule-based failure-mode analysis with suggested
 * experiments. Rules only fire above minimum sample sizes; below them the
 * module says so instead of extrapolating (NO FAKE DATA rule applies to
 * inferences too).
 */

export interface DiagnosisInput {
  identified: number;
  contacted: number;
  responded: number;
  screens: number;
  hmApprovals: number;
  interviews: number;
  finals: number;
  offers: number;
  accepts: number;
}

export interface Diagnosis {
  id: string;
  symptom: string;
  possibleCauses: string[];
  experiments: string[];
}

export interface DiagnosisResult {
  findings: Diagnosis[];
  insufficientData: string[];
}

export function diagnosePipeline(input: DiagnosisInput): DiagnosisResult {
  const findings: Diagnosis[] = [];
  const insufficientData: string[] = [];

  // High outreach, low response.
  if (input.contacted >= 15) {
    const rate = input.responded / input.contacted;
    if (rate < 0.12) {
      findings.push({
        id: "low_response",
        symptom: `High outreach, low response (${input.responded}/${input.contacted} ≈ ${Math.round(rate * 100)}%).`,
        possibleCauses: [
          "Wrong candidate population for the role",
          "Weak or unclear employer value proposition",
          "Generic outreach without evidence-based personalization",
          "Compensation positioned below market",
          "Market saturation — population is heavily recruited",
        ],
        experiments: [
          "Rewrite the top sequence to cite one specific piece of the candidate's work in sentence one",
          "Test one adjacent population (20 sends) and compare response rate",
          "A/B two subject-line variants across the next 30 sends",
          "Validate compensation positioning against market intelligence before more volume",
        ],
      });
    }
  } else if (input.contacted > 0) {
    insufficientData.push(
      `Response-rate analysis needs ≥15 contacted (have ${input.contacted}).`,
    );
  }

  // Screens pass, HM rejects.
  if (input.screens >= 5) {
    const rate = input.hmApprovals / input.screens;
    if (rate < 0.4) {
      findings.push({
        id: "hm_rejection",
        symptom: `Candidates pass the recruiter screen but stall at hiring-manager review (${input.hmApprovals}/${input.screens} advance).`,
        possibleCauses: [
          "Intake calibration is off — the HM's real bar differs from the captured one",
          "Recruiter screen is not testing the differentiating requirements",
          "Search is broader than the actual target profile",
          "A hidden requirement exists that was never made explicit",
        ],
        experiments: [
          "Review the last 3 HM rejections with the HM and write down the actual reasons",
          "Re-run intake playback: 'What did I get wrong?'",
          "Add the top rejection reason as an explicit screen question",
        ],
      });
    }
  } else if (input.screens > 0) {
    insufficientData.push(
      `HM-approval analysis needs ≥5 screens (have ${input.screens}).`,
    );
  }

  // Interviews happen but finals don't.
  if (input.interviews >= 4) {
    const rate = input.finals / input.interviews;
    if (rate < 0.35) {
      findings.push({
        id: "interview_dropoff",
        symptom: `Interview-to-final conversion is low (${input.finals}/${input.interviews}).`,
        possibleCauses: [
          "Interview stages duplicate each other instead of covering distinct competencies",
          "Candidates are withdrawing mid-process (speed or experience problem)",
          "Panel calibration differs from the success profile",
        ],
        experiments: [
          "Audit the interview plan for duplicated competencies across stages",
          "Measure days between stages; compress anything > 7 days",
          "Ask the last 2 withdrawn candidates why they exited",
        ],
      });
    }
  }

  // Offers decline.
  if (input.offers >= 2) {
    const rate = input.accepts / input.offers;
    if (rate < 0.5) {
      findings.push({
        id: "offer_declines",
        symptom: `Offers are declining (${input.accepts}/${input.offers} accepted).`,
        possibleCauses: [
          "Compensation below competing offers",
          "Competing employers closing faster or stronger",
          "Process too slow — candidates commit elsewhere first",
          "Hiring-manager concerns leaking into late stages",
          "Candidate motivations never captured, so the close pitch is generic",
        ],
        experiments: [
          "Start the close plan at the screen stage, not at offer time",
          "Capture competing-process status at every touchpoint",
          "Pre-close before extending: confirm the number that gets a yes",
          "Involve the hiring manager in a pre-offer sell conversation",
        ],
      });
    }
  } else if (input.offers > 0) {
    insufficientData.push(
      `Offer-acceptance analysis needs ≥2 offers (have ${input.offers}).`,
    );
  }

  // Plenty identified, little contacted — throughput, not market.
  if (input.identified >= 20 && input.contacted / input.identified < 0.3) {
    findings.push({
      id: "outreach_throughput",
      symptom: `Sourcing outpaces outreach (${input.contacted}/${input.identified} contacted).`,
      possibleCauses: [
        "Review queue is the bottleneck",
        "Outreach drafting is slower than discovery",
      ],
      experiments: [
        "Batch evidence alignment on the current review queue",
        "Generate sequences for the top 10 reviewed candidates in one session",
      ],
    });
  }

  return { findings, insufficientData };
}
