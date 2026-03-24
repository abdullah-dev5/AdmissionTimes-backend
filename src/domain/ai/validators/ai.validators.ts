import Joi from 'joi';

export const chatRequestSchema = Joi.object({
  message: Joi.string().trim().min(2).max(1000).required(),
  conversation_context: Joi.string().trim().max(3000).optional(),
  conversation_history: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant', 'ai').required(),
        text: Joi.string().trim().min(1).max(500).required(),
      })
    )
    .max(8)
    .optional(),
});

export const summarizeRequestSchema = Joi.object({
  raw_text: Joi.string().trim().min(20).max(20000).required(),
  source_type: Joi.string().valid('pdf', 'manual').optional(),
  admission_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).optional(),
});
