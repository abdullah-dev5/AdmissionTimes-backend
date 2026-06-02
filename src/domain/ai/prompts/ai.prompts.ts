// ─── Intent + filter extraction (structured JSON, low temperature) ───────────

const EXTRACTION_SCHEMA = `{
  "intent": "search_admissions" | "guidance" | "clarification" | "unsupported",
  "search": "<keyword or null>",
  "degree_level": "<bachelor|master|phd|diploma or null>",
  "field_of_study": "<e.g. Computer Science or null>",
  "location": "<city or country or null>",
  "program_type": "<e.g. BS, MS, BBA or null>",
  "delivery_mode": "<online|on-campus|hybrid or null>",
  "deadline_within_days": "<number or null — use for ranges like 'this week', NOT for a specific calendar day>",
  "deadline_on": "<YYYY-MM-DD or null — when user names a specific closing date e.g. 26 June 2026>",
  "clarification_question": "<one short question only when intent=clarification, else null>",
  "refusal_reason": "<one sentence only when intent=unsupported, else null>"
}`;

const INTENT_RULES_STUDENT = `
INTENT RULES for student:
- "search_admissions" → user wants to FIND or LIST programs (e.g. "CS admissions in Karachi", "bachelor programs closing this month").
- "guidance" → user asks HOW TO USE the platform or wants an EXPLANATION (e.g. "how do I compare?", "what is watchlist?", "enable alerts", "what does Verified mean?", "remove expired"). Return intent="guidance" — do NOT return search filters.
- "clarification" → ONLY if you cannot even guess a topic from the message AND there is no conversation history. This should almost never fire.
- "unsupported" → completely off-topic (coding help, weather, medical advice, etc.). NOT for platform questions.
`.trim();

const INTENT_RULES_UNIVERSITY = `
INTENT RULES for university admin:
- "guidance" → user asks about WORKFLOW, STATUS EXPLANATIONS, HOW-TO, POLICIES, CHECKLISTS (e.g. "how do I publish?", "what is Pending Audit?", "explain rejected status", "system verification policy", "how to resubmit?", "upload guide"). Return intent="guidance" — do NOT return search filters.
- "search_admissions" → user wants to LIST or VIEW specific admission records (e.g. "show my verified admissions", "list pending programs").
- "clarification" → almost never; only if truly no context at all.
- "unsupported" → completely off-topic (not any admission / platform topic).
`.trim();

export const isUniversityContext = (context: string | undefined): boolean => {
  const ctx = (context || '').toLowerCase();
  return ctx.includes('university') || ctx.includes('manage admission') || ctx.includes('verification center');
};

export const buildChatExtractionPrompt = (message: string, context?: string): string => {
  const uniCtx = isUniversityContext(context);
  const intentRules = uniCtx ? INTENT_RULES_UNIVERSITY : INTENT_RULES_STUDENT;

  return [
    'You are an intent classifier for AdmissionTimes, a university admissions platform.',
    intentRules,
    'OUTPUT: Return valid JSON only, no markdown fences, matching this schema:',
    EXTRACTION_SCHEMA,
    `Conversation context: ${context || 'none'}`,
    `User message: "${message}"`,
  ].join('\n\n');
};

// ─── Guidance answer (free text, higher temperature) ─────────────────────────

export const buildGuidanceAnswerPrompt = (message: string, context: string | undefined, uniCtx: boolean): string => {
  const roleDesc = uniCtx
    ? `You are an AI assistant for UNIVERSITY ADMINISTRATORS on AdmissionTimes.
You help with: publishing admissions, PDF upload & auto-extraction, verification workflow, status meanings (Pending Audit = waiting for admin review; Verified = approved and visible; Rejected = failed checks; Under Review = being actively checked), resubmission steps, eligibility field guidance, and platform best practices.`
    : `You are an AI assistant for STUDENTS on AdmissionTimes.
You help with: finding and filtering admission programs, comparing universities by fee/deadline/location, managing watchlist (save programs, enable deadline alerts, remove expired), understanding status labels (Verified = admin-approved listing, Pending = not yet reviewed), and using platform features.`;

  return [
    roleDesc,
    'Answer in a clear, concise way: 2-5 bullet points OR 3 short sentences maximum. Be direct and practical — no filler phrases.',
    `Platform context: ${context || 'unknown'}`,
    `User question: ${message}`,
  ].join('\n\n');
};

const SUMMARY_SCHEMA = `Return JSON only with this exact schema:\n{\n  "title": string | null,\n  "degree_level": string | null,\n  "location": string | null,\n  "application_fee": number | null,\n  "deadline": string | null,\n  "description": string | null,\n  "eligibility": string | null,\n  "summary_text": string,\n  "highlights": string[],\n  "extracted_fields": string[],\n  "confidence": number\n}`;

export const buildSummarizationPrompt = (rawText: string): string => {
  return [
    'You are an AI admissions summarizer for AdmissionTimes.',
    'Extract only information grounded in the provided admission text.',
    'Do not invent missing facts.',
    'If a field is missing, return null.',
    'deadline must be ISO-8601 only if clearly inferable, otherwise null.',
    'summary_text must be a concise 2-4 sentence admissions summary.',
    'highlights must be short bullet-like strings.',
    SUMMARY_SCHEMA,
    'Admission text:',
    rawText,
  ].join('\n\n');
};

const COMPARE_SCHEMA = `Return JSON only:\n{\n  "summary": string,\n  "highlights": string[]\n}`;

export const buildCompareProgramsPrompt = (
  programs: Array<{
    title: string;
    university_name: string;
    degree_level: string | null;
    field_of_study: string | null;
    location: string | null;
    fee_display: string | null;
    deadline: string | null;
    days_remaining: number | null;
    delivery_mode: string | null;
    program_type: string | null;
    description: string | null;
    eligibility_text: string | null;
    verification_status: string;
  }>,
  focus?: string
): string => {
  const payload = programs.map((p, index) => ({
    index: index + 1,
    university: p.university_name,
    program: p.title,
    degree_level: p.degree_level,
    field_of_study: p.field_of_study,
    location: p.location,
    fee: p.fee_display,
    deadline: p.deadline,
    days_remaining: p.days_remaining,
    delivery_mode: p.delivery_mode,
    program_type: p.program_type,
    verification_status: p.verification_status,
    description: p.description?.slice(0, 600) || null,
    eligibility: p.eligibility_text?.slice(0, 400) || null,
  }));

  return [
    'You are an admissions comparison expert for AdmissionTimes (Pakistan university admissions).',
    'Compare ONLY the programs in the JSON below. Use their fields — do not invent universities, fees, or deadlines.',
    'Consider: application fee, deadline urgency, degree/field fit, location, delivery mode, eligibility differences, and verification status.',
    'summary: 2-3 sentences with the overall recommendation framing (no generic filler).',
    'highlights: 4-6 concise bullet strings. Each bullet must name specific universities/programs and a concrete difference.',
    focus ? `Student focus for this comparison: ${focus}` : '',
    COMPARE_SCHEMA,
    'Programs JSON:',
    JSON.stringify(payload, null, 2),
  ]
    .filter(Boolean)
    .join('\n\n');
};
