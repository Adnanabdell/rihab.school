// Fix: Define types for grounding chunks to resolve errors from placeholder content.
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}
