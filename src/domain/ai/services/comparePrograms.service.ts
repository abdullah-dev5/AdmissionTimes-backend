import * as admissionsService from '@domain/admissions/services/admissions.service';
import { Admission } from '@domain/admissions/types/admissions.types';
import { UserContext } from '@domain/admissions/types/admissions.types';
import { AppError } from '@shared/middleware/errorHandler';
import { buildCompareProgramsPrompt } from '../prompts/ai.prompts';
import {
  CompareProgramInput,
  CompareProgramsResponse,
} from '../types/ai.types';
import { generateJson, getGeminiUsageMetadata, isGeminiConfigured } from './gemini.client';

const resolveBackendAdmissionId = (id: string): string => id.split('::program::')[0].trim();

const formatFee = (admission: Admission & Record<string, unknown>): string => {
  const feeDisplay = admission.fee_display as string | undefined;
  if (feeDisplay?.trim()) return feeDisplay.trim();
  if (admission.application_fee != null) return `PKR ${admission.application_fee}`;
  return 'Not specified';
};

const formatDeadlineLabel = (deadline: string | null): string => {
  if (!deadline) return 'Not specified';
  try {
    return new Date(deadline).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return deadline;
  }
};

const daysUntilDeadline = (admission: Admission): number | null => {
  if (!admission.deadline) return null;
  const ms = new Date(admission.deadline).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const admissionToCompareInput = (admission: Admission & Record<string, unknown>): CompareProgramInput => {
  const universityName =
    (admission.university_name as string | undefined) ||
    (admission.title ? String(admission.title) : 'University');

  return {
    id: admission.id,
    title: admission.title,
    university_name: universityName,
    degree_level: admission.degree_level,
    field_of_study: admission.field_of_study,
    location: admission.location,
    application_fee: admission.application_fee,
    fee_display: formatFee(admission),
    deadline: admission.deadline,
    delivery_mode: admission.delivery_mode,
    program_type: admission.program_type,
    description: admission.description,
    eligibility_text: admission.eligibility_text || null,
    verification_status: admission.verification_status,
    days_remaining: daysUntilDeadline(admission),
  };
};

export const buildRuleBasedProgramComparison = (programs: CompareProgramInput[]): CompareProgramsResponse => {
  if (programs.length < 2) {
    return {
      summary: 'Select at least two programs to compare.',
      highlights: [],
      method: 'fallback',
      provider: 'rules',
    };
  }

  const withFee = programs.filter((p) => p.application_fee != null && p.application_fee >= 0);
  const withDeadline = programs.filter((p) => p.deadline);

  const highlights: string[] = [];

  if (withFee.length >= 2) {
    const lowest = withFee.reduce((min, p) =>
      (p.application_fee ?? Number.MAX_SAFE_INTEGER) < (min.application_fee ?? Number.MAX_SAFE_INTEGER) ? p : min
    );
    highlights.push(
      `${lowest.university_name} — ${lowest.title} has the lowest application fee (${lowest.fee_display}).`
    );
  }

  if (withDeadline.length >= 2) {
    const earliest = withDeadline.reduce((earliest, p) => {
      const current = new Date(p.deadline || 0).getTime();
      const prev = new Date(earliest.deadline || 0).getTime();
      return current < prev ? p : earliest;
    });
    const days = earliest.days_remaining;
    highlights.push(
      `${earliest.university_name} — ${earliest.title} has the earliest deadline (${formatDeadlineLabel(earliest.deadline)}${
        days != null ? `, ${days} day${days === 1 ? '' : 's'} left` : ''
      }).`
    );
  }

  const degrees = new Set(programs.map((p) => p.degree_level).filter(Boolean));
  if (degrees.size > 1) {
    highlights.push(`Degree levels differ across programs: ${Array.from(degrees).join(', ')}.`);
  }

  const fields = new Set(programs.map((p) => p.field_of_study).filter(Boolean));
  if (fields.size > 1) {
    highlights.push(`Fields of study differ: ${Array.from(fields).join(', ')}.`);
  }

  const locations = new Set(programs.map((p) => p.location).filter(Boolean));
  if (locations.size > 1) {
    highlights.push(`Locations differ — compare commute, housing, and campus facilities (${Array.from(locations).join(' vs ')}).`);
  }

  const deliveryModes = new Set(programs.map((p) => p.delivery_mode).filter(Boolean));
  if (deliveryModes.size > 1) {
    highlights.push(`Delivery modes differ: ${Array.from(deliveryModes).join(', ')}.`);
  }

  if (highlights.length < 4) {
    programs.forEach((program) => {
      if (highlights.length >= 6) return;
      const eligibility = program.eligibility_text?.trim();
      if (eligibility) {
        highlights.push(`${program.university_name}: eligibility — ${eligibility.slice(0, 160)}${eligibility.length > 160 ? '…' : ''}`);
      }
    });
  }

  if (highlights.length === 0) {
    highlights.push('Programs share similar fees and deadlines in the data we have. Review each card for full descriptions and eligibility.');
  }

  const summary = `Compared ${programs.length} programs using available listing data. Use the highlights below for fee, deadline, and program differences.`;

  return {
    summary,
    highlights: highlights.slice(0, 6),
    method: 'fallback',
    provider: 'rules',
  };
};

const loadProgramsForCompare = async (
  admissionIds: string[],
  userContext?: UserContext
): Promise<CompareProgramInput[]> => {
  const uniqueIds = [...new Set(admissionIds.map(resolveBackendAdmissionId))];
  const loaded: CompareProgramInput[] = [];

  for (const id of uniqueIds) {
    try {
      const admission = await admissionsService.getById(id, userContext);
      loaded.push(admissionToCompareInput(admission as Admission & Record<string, unknown>));
    } catch {
      // skip inaccessible or missing ids
    }
  }

  return loaded;
};

export const compareProgramsWithGemini = async (
  programs: CompareProgramInput[],
  focus?: string
): Promise<CompareProgramsResponse> => {
  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }

  const extraction = await generateJson<{ summary: string; highlights: string[] }>({
    prompt: buildCompareProgramsPrompt(programs, focus),
    temperature: 0.35,
  });

  const metadata = getGeminiUsageMetadata();
  const highlights = Array.isArray(extraction.highlights)
    ? extraction.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    summary: extraction.summary?.trim() || 'AI comparison generated from the selected programs.',
    highlights: highlights.length > 0 ? highlights : buildRuleBasedProgramComparison(programs).highlights,
    method: 'ai',
    provider: metadata.provider,
    model: metadata.model,
  };
};

export const compareProgramsWithFallback = async (
  admissionIds: string[],
  userContext?: UserContext,
  focus?: string
): Promise<CompareProgramsResponse> => {
  const programs = await loadProgramsForCompare(admissionIds, userContext);

  if (programs.length < 2) {
    throw new AppError('At least two valid admissions are required for comparison', 400);
  }

  try {
    return await compareProgramsWithGemini(programs, focus);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 503) {
      return buildRuleBasedProgramComparison(programs);
    }

    console.warn('[AI Compare] Gemini failed, using rule-based fallback:', error);
    const fallback = buildRuleBasedProgramComparison(programs);
    return {
      ...fallback,
      summary: `${fallback.summary} (AI was temporarily unavailable — showing a data-driven comparison.)`,
    };
  }
};
