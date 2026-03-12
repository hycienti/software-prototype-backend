import { test } from '@japa/runner'
import { processVoiceMessageValidator } from '#validators/voice_validator'

test.group('Voice validator', () => {
  test('accepts payload with transcript only', async ({ assert }) => {
    const payload = await processVoiceMessageValidator.validate({
      transcript: 'Hello world',
      language: 'en',
    })
    assert.equal(payload.transcript, 'Hello world')
    assert.equal(payload.language, 'en')
    assert.isUndefined(payload.audioData)
  })

  test('accepts payload with audioData only (legacy)', async ({ assert }) => {
    const payload = await processVoiceMessageValidator.validate({
      audioData: 'base64encodedaudiodata',
      audioFormat: 'm4a',
      language: 'en',
    })
    assert.equal(payload.audioData, 'base64encodedaudiodata')
    assert.equal(payload.audioFormat, 'm4a')
  })

  test('validator allows optional fields only (controller enforces at least one of transcript/audioData)', async ({
    assert,
  }) => {
    const payload = await processVoiceMessageValidator.validate({
      language: 'en',
    })
    assert.isUndefined(payload.audioData)
    assert.isUndefined(payload.transcript)
    assert.equal(payload.language, 'en')
  })
})
