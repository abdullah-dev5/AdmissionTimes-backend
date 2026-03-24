import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@shared/utils/response';
import { UserContext } from '@domain/admissions/types/admissions.types';
import * as aiService from '../services/ai.service';
import { ChatRequestDTO, SummarizeRequestDTO } from '../types/ai.types';

export const chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.validated as ChatRequestDTO;
    const userContext = req.user as UserContext | undefined;

    const result = await aiService.chatWithAdmissionsAssistant(
      data.message,
      data.conversation_context,
      data.conversation_history,
      { userContext }
    );

    sendSuccess(res, result, 'AI chat response generated successfully');
  } catch (error) {
    next(error);
  }
};

export const summarize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.validated as SummarizeRequestDTO;
    const result = await aiService.summarizeAdmissionText(data.raw_text);
    sendSuccess(res, result, 'AI summary generated successfully');
  } catch (error) {
    next(error);
  }
};

export const health = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = aiService.getAiHealth();
    sendSuccess(res, result, 'AI health retrieved successfully');
  } catch (error) {
    next(error);
  }
};
