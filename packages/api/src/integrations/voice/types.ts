export type VoiceProviderStatus = {
  name: string
  available: boolean
}

export type VoiceAsrSegment = {
  startMs: number
  endMs: number
  text: string
}

export type VoiceTranscriptionResult = {
  provider: string
  language: string
  text: string
  confidence: number
  segments: VoiceAsrSegment[]
}

export type VoiceSynthesisResult = {
  provider: string
  mimeType: string
  audio: Uint8Array
  durationMs: number
}

export type VoiceRealtimeSession = {
  sendAudio(audio: Uint8Array): Promise<void>
  finish(): Promise<void>
}

export type VoiceProvider = {
  listProviders(): Promise<VoiceProviderStatus[]>
  transcribeUpload(input: {
    provider: string
    language: string
    format: string
    audio: Uint8Array
    enablePunctuation: boolean
  }): Promise<VoiceTranscriptionResult>
  synthesize(input: {
    text: string
    language: string
    voice: string
    speed: number
  }): Promise<VoiceSynthesisResult>
  startRealtimeSession(input: {
    language: string
    sampleRate: number
    audioFormat: string
    enableIntermediateResult: boolean
    enablePunctuation: boolean
    enableInverseTextNormalization: boolean
    onPartial(result: { text: string; confidence: number }): void
    onFinal(result: { text: string; confidence: number }): void
  }): Promise<VoiceRealtimeSession>
}
