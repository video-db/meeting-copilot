import type { AppRouter } from '../../main/server/trpc/router';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

export type AuthRegisterInput = RouterInput['auth']['register'];
export type AuthRegisterOutput = RouterOutput['auth']['register'];

export type ConfigGetOutput = RouterOutput['config']['get'];

export type TokenGenerateInput = RouterInput['token']['generate'];
export type TokenGenerateOutput = RouterOutput['token']['generate'];

export type CaptureCreateSessionInput = RouterInput['capture']['createSession'];
export type CaptureCreateSessionOutput = RouterOutput['capture']['createSession'];

export type RecordingsListOutput = RouterOutput['recordings']['list'];
export type RecordingsStartInput = RouterInput['recordings']['start'];
export type RecordingsStartOutput = RouterOutput['recordings']['start'];
export type RecordingsStopInput = RouterInput['recordings']['stop'];
export type RecordingsStopOutput = RouterOutput['recordings']['stop'];
export type RecordingsGetInput = RouterInput['recordings']['get'];
export type RecordingsGetOutput = RouterOutput['recordings']['get'];

export type TranscriptionStartInput = RouterInput['transcription']['start'];
export type TranscriptionStartOutput = RouterOutput['transcription']['start'];

export type TunnelStatusOutput = RouterOutput['tunnel']['status'];
