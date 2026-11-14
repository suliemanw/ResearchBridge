import { z } from 'zod';
const text = z.string().min(1).max(3000);
const strings = z.array(text).max(20);
export const source = z.object({ page: z.number().int().positive(), quote: z.string().min(1).max(600) });
export const topic = z.object({ name: text, reason: text, sources: z.array(source).min(1).max(3) });
export const analysisSchema = z.object({ title: text, topics: z.array(topic).min(1).max(8), prerequisites: z.array(topic).max(10), mathematical_requirements: strings, academic_terms: strings, research_demands: strings });
export const profileSchema = z.object({ bachelor_major: z.string().max(200), target_course: z.string().max(200), previous_courses: strings, studied_topics: strings, self_reported_confidence: z.array(z.object({topic:text,confidence:z.enum(['low','medium','high','unknown'])})).max(20), demonstrated_knowledge: z.array(z.object({topic:text,level:z.enum(['emerging','developing','strong','unassessed']),evidence:z.string().max(2000)})).max(20), potential_knowledge_gaps: strings, learning_preferences: strings, uncertainties: strings });
export const questionSchema = z.object({ question: text, topic: text, kind: z.enum(['background','experience','confidence','diagnostic','preferences']), sources: z.array(source).max(3) });
export const interviewSchema = z.object({ profile: profileSchema, feedback: z.string().max(3000), sufficient: z.boolean(), next_question: questionSchema });
const foundation = z.object({ topic: text, objective: text, why: text, sources: z.array(source).min(1).max(3) });
export const planSchema = z.object({ title: text, overview: text, assumptions: strings, knowledge_foundations: z.array(foundation).min(1).max(8), academic_language: z.array(foundation).min(1).max(6), research_reasoning: z.array(foundation).min(1).max(6), days: z.array(z.object({ day: z.number().int().min(1).max(7), topic: text, objective: text, duration_minutes: z.number().int().min(5).max(120), importance: z.enum(['essential','recommended','stretch']), sources: z.array(source).min(1).max(3) })).length(7) });
export const simplificationSchema = z.object({ explanation: text, terms: z.array(z.object({ term: text, definition: text })).max(10), example: text, formal: text, qualifications: text, sources: z.array(source).max(4) });
export const diagnosticSchema = z.object({ question: text, topic: text, expected_reasoning: text, sources: z.array(source).min(1).max(3) });
export const evaluationSchema = z.object({ accuracy: z.number().int().min(0).max(4), assumptions: z.number().int().min(0).max(4), explanation: z.number().int().min(0).max(4), independence: z.number().int().min(0).max(4), feedback: text, next_step: text });
export const chatSchema = z.object({ answer: text, sources: z.array(source).max(5) });
export function jsonSchema(schema) { return z.toJSONSchema(schema); }
