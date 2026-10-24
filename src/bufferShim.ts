import { Buffer } from "buffer";

const environnementAvecBuffer = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
};
environnementAvecBuffer.Buffer ??= Buffer;
