/**
 * PDF Parsing Service
 * 
 * Handles PDF file parsing and data extraction for admission documents.
 * 
 * Responsibilities:
 * - Parse PDF files
 * - Extract structured data from PDF text
 * - Validate extracted data
 * - Return structured admission data
 */

import { AppError } from '@shared/middleware/errorHandler';
import { summarizeAdmissionTextWithFallback } from '@domain/ai/services/ai.service';

// Support both legacy function export and v2 class export from pdf-parse.
const pdfParseModule = require('pdf-parse');
const pdfParseFn = typeof pdfParseModule === 'function'
  ? pdfParseModule
  : pdfParseModule?.default;
const PDFParseClass = pdfParseModule?.PDFParse;

/**
 * Extracted data from PDF
 */
export interface ExtractedPDFData {
  title: string;
  degree_level: string;
  deadline: string; // ISO 8601 format
  application_fee: number;
  location: string;
  description: string;
  eligibility?: string | null;
  summary_text?: string;
  highlights?: string[];
  provider?: 'gemini' | 'regex';
  model?: string;
  method?: 'ai' | 'fallback';
  confidence: number; // 0-100 extraction confidence score
  extracted_fields: string[]; // List of fields successfully extracted
}

/**
 * Parse PDF file and extract text
 * 
 * @param buffer - PDF file buffer
 * @returns Extracted text content
 * @throws AppError if parsing fails
 */
export const parsePDF = async (buffer: Buffer): Promise<string> => {
  try {
    // pdf-parse v2.x exposes a class API: new PDFParse({ data }).getText()
    if (typeof PDFParseClass === 'function') {
      const parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
      return result?.text || '';
    }

    // Older pdf-parse versions expose a callable function.
    if (typeof pdfParseFn === 'function') {
      const data = await pdfParseFn(buffer);
      return data?.text || '';
    }

    throw new Error('Unsupported pdf-parse module shape');
  } catch (error: any) {
    throw new AppError(`Failed to parse PDF: ${error.message}`, 400);
  }
};

/**
 * Extract structured data from PDF text
 * 
 * Uses regex patterns and heuristics to extract admission-related fields
 * from the parsed PDF text.
 * 
 * @param text - Extracted text from PDF
 * @returns Structured admission data
 */
export const extractFields = async (text: string): Promise<ExtractedPDFData> => {
  const extractedFields: string[] = [];
  let confidence = 0;

  // Extract title/program name
  // Look for patterns like "Program:", "Course:", "Title:", or first line
  const titleMatch = text.match(/(?:Program|Course|Title|Admission)[:\s]+([^\n]+)/i) ||
                     text.match(/^([^\n]{10,100})/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Program';
  if (title !== 'Untitled Program') {
    extractedFields.push('title');
    confidence += 15;
  }

  // Extract degree level
  // Look for patterns like "Bachelor", "Master", "PhD", "BS", "MS", etc.
  const degreeLevelMatch = text.match(/\b(?:Bachelor|Master|PhD|BS|MS|MBA|BBA|MD|MPhil|Doctorate|Graduate|Undergraduate)\b/i);
  const degreeLevel = degreeLevelMatch ? degreeLevelMatch[0].toLowerCase() : 'bachelor';
  if (degreeLevelMatch) {
    extractedFields.push('degree_level');
    confidence += 10;
  }

  // Extract deadline
  // Look for date patterns: "Deadline:", "Application Deadline:", dates in various formats
  const deadlinePatterns = [
    /(?:Deadline|Application Deadline|Last Date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
    /(?:Deadline|Application Deadline)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
  ];
  
  let deadline = '';
  for (const pattern of deadlinePatterns) {
    const match = text.match(pattern);
    if (match) {
      deadline = match[1];
      extractedFields.push('deadline');
      confidence += 15;
      break;
    }
  }

  // If no deadline found, set a default (6 months from now)
  if (!deadline) {
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() + 6);
    deadline = defaultDate.toISOString();
  } else {
    // Try to parse and format the deadline
    try {
      const parsedDate = new Date(deadline);
      if (!isNaN(parsedDate.getTime())) {
        deadline = parsedDate.toISOString();
      }
    } catch {
      // If parsing fails, use default
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 6);
      deadline = defaultDate.toISOString();
    }
  }

  // Extract application fee
  // Look for patterns like "Fee:", "Application Fee:", amounts with currency
  const feePatterns = [
    /(?:Application Fee|Fee|Application Cost)[:\s]+(?:Rs\.?|PKR|USD|\$)?\s*([\d,]+)/i,
    /(?:Fee|Cost)[:\s]+(?:Rs\.?|PKR|USD|\$)?\s*([\d,]+)/i,
    /(?:Rs\.?|PKR|USD|\$)\s*([\d,]+)/i,
  ];
  
  let applicationFee = 0;
  for (const pattern of feePatterns) {
    const match = text.match(pattern);
    if (match) {
      applicationFee = parseInt(match[1].replace(/,/g, ''), 10);
      if (applicationFee > 0) {
        extractedFields.push('application_fee');
        confidence += 15;
        break;
      }
    }
  }

  // Extract location
  // Look for patterns like "Location:", "Campus:", city names, addresses
  const locationPatterns = [
    /(?:Location|Campus|Address)[:\s]+([^\n]+)/i,
    /\b(?:Islamabad|Karachi|Lahore|Peshawar|Quetta|Faisalabad|Rawalpindi|Multan|Hyderabad|Sialkot)\b/i,
  ];
  
  let location = '';
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = match[1] ? match[1].trim() : match[0];
      if (location.length > 0 && location.length < 200) {
        extractedFields.push('location');
        confidence += 10;
        break;
      }
    }
  }

  // If no location found, use default
  if (!location) {
    location = 'Pakistan';
  }

  // Extract description
  // Use first substantial paragraph (50+ characters) that's not the title
  const descriptionMatch = text.match(/(?:Description|Overview|About|Details)[:\s]+([^\n]{50,500})/i);
  const descriptionLine = text.split('\n').find(line => line.length > 50 && !line.includes(title));
  const description = descriptionMatch ? 
    (descriptionMatch[1] || '').trim() :
    (descriptionLine ? descriptionLine.trim() : text.substring(0, 500).trim());
  
  if (description.length > 50) {
    extractedFields.push('description');
    confidence += 10;
  }

  // Calculate final confidence (cap at 100)
  confidence = Math.min(confidence, 100);

  return {
    title,
    degree_level: degreeLevel,
    deadline,
    application_fee: applicationFee,
    location,
    description,
    confidence,
    extracted_fields: extractedFields,
  };
};

/**
 * Parse PDF and extract structured admission data
 * 
 * Main entry point for PDF parsing. Combines PDF parsing and field extraction.
 * 
 * @param buffer - PDF file buffer
 * @returns Extracted structured data
 * @throws AppError if parsing or extraction fails
 */
export const parsePDFAndExtract = async (buffer: Buffer): Promise<ExtractedPDFData> => {
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (buffer.length > maxSize) {
    throw new AppError('PDF file too large. Maximum size is 10MB.', 400);
  }

  // Validate PDF format (basic check - PDF files start with %PDF)
  if (!buffer.toString('utf8', 0, 4).includes('%PDF')) {
    throw new AppError('Invalid PDF format', 400);
  }

  // Parse PDF
  const text = await parsePDF(buffer);

  // Extract fields
  const extractedData = await extractFields(text);

  const aiSummary = await summarizeAdmissionTextWithFallback(text, extractedData);

  return {
    title: aiSummary.title || extractedData.title,
    degree_level: aiSummary.degree_level || extractedData.degree_level,
    deadline: aiSummary.deadline || extractedData.deadline,
    application_fee: aiSummary.application_fee ?? extractedData.application_fee,
    location: aiSummary.location || extractedData.location,
    description: aiSummary.description || extractedData.description,
    eligibility: aiSummary.eligibility || null,
    summary_text: aiSummary.summary_text,
    highlights: aiSummary.highlights,
    provider: aiSummary.provider,
    model: aiSummary.model,
    method: aiSummary.method,
    confidence: Math.max(extractedData.confidence, aiSummary.confidence),
    extracted_fields: Array.from(new Set([...(extractedData.extracted_fields || []), ...(aiSummary.extracted_fields || [])])),
  };
};
