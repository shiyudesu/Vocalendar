import type { VoiceProvider } from './types.js'

export const mockVoiceProvider: VoiceProvider = {
  async listProviders() {
    return [
      {
        name: 'aliyun',
        available: true,
      },
    ]
  },

  async transcribeUpload(input) {
    return {
      provider: input.provider,
      language: input.language,
      text: '明天下午三点和张总开会',
      confidence: 0.97,
      segments: [],
    }
  },

  async synthesize(input) {
    return {
      provider: 'aliyun',
      mimeType: 'audio/mpeg',
      audio: Buffer.from(input.text),
      durationMs: Math.max(input.text.length * 120, 800),
    }
  },

  async startRealtimeSession(input) {
    input.onPartial({
      text: '明天下午三点',
      confidence: 0.96,
    })

    return {
      async sendAudio() {},
      async finish() {
        input.onFinal({
          text: '明天下午三点和张总开会',
          confidence: 0.97,
        })
      },
    }
  },
}
