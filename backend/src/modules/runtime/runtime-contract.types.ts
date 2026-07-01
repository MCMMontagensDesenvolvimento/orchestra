import type { z } from 'zod';
import type {
  assistantRuntimeSpecV1Schema,
  runtimeCapabilitiesResponseV1Schema,
  runtimeExecuteRequestV1Schema,
  runtimeExecuteResponseV1Schema,
  runtimeHealthResponseV1Schema,
  runtimeInputAttachmentSchema,
  runtimeNormalizedErrorV1Schema,
  runtimeNormalizedEventV1Schema,
  runtimeRagSourceSchema,
  runtimeToolDescriptorSchema,
} from './runtime-contract.schema';

export type RuntimeInputAttachment = z.infer<typeof runtimeInputAttachmentSchema>;
export type RuntimeRagSource = z.infer<typeof runtimeRagSourceSchema>;
export type RuntimeToolDescriptor = z.infer<typeof runtimeToolDescriptorSchema>;
export type RuntimeNormalizedEventV1 = z.infer<typeof runtimeNormalizedEventV1Schema>;
export type RuntimeNormalizedErrorV1 = z.infer<typeof runtimeNormalizedErrorV1Schema>;
export type AssistantRuntimeSpecV1 = z.infer<typeof assistantRuntimeSpecV1Schema>;
export type RuntimeExecuteRequestV1 = z.infer<typeof runtimeExecuteRequestV1Schema>;
export type RuntimeExecuteResponseV1 = z.infer<typeof runtimeExecuteResponseV1Schema>;
export type RuntimeHealthResponseV1 = z.infer<typeof runtimeHealthResponseV1Schema>;
export type RuntimeCapabilitiesResponseV1 = z.infer<typeof runtimeCapabilitiesResponseV1Schema>;
