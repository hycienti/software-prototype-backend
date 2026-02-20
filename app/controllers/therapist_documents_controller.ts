import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import TherapistService from '#services/therapist_service'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

const therapistService = new TherapistService()

const DOCUMENT_TYPES = ['license', 'identity'] as const
type DocumentType = (typeof DOCUMENT_TYPES)[number]

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && DOCUMENT_TYPES.includes(value as DocumentType)
}

export default class TherapistDocumentsController {
  /**
   * POST /therapist/auth/documents/upload
   * Multipart: file (required), type (required, 'license' | 'identity')
   * Stores file in R2 at therapists/{therapistId}/{type}.{ext}, updates therapist record, returns URL.
   */
  async upload(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const request = ctx.request

    const typeInput = request.body().type
    if (!isDocumentType(typeInput)) {
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Invalid or missing document type. Use "license" or "identity".',
        400
      )
    }

    const file = request.file('file', {
      size: '10mb',
      extnames: ['pdf', 'jpg', 'jpeg', 'png'],
    })

    if (!file || !file.isValid) {
      const message =
        file?.errors?.[0]?.message ??
        'No file provided or invalid file. Allowed: PDF, JPG, JPEG, PNG; max 10MB.'
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, message, 400)
    }

    const ext = file.extname || (file.type && file.type.split('/')[1]) || 'pdf'
    const key = `therapists/${therapist.id}/${typeInput}.${ext}`

    try {
      const disk = drive.use()
      await disk.copyFromFs(file.tmpPath!, key, {
        visibility: 'public',
        contentType: file.type ?? (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      })

      let url: string
      try {
        url = await disk.getUrl(key)
      } catch {
        url = await disk.getSignedUrl(key, { expiresIn: '7d' })
      }

      const payload = typeInput === 'license' ? { licenseUrl: url } : { identityUrl: url }
      const updated = await therapistService.updateMe(therapist.id, payload)

      return successResponse(ctx, {
        ...payload,
        therapist: updated,
      })
    } catch (err) {
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        err instanceof Error ? err.message : 'Upload failed',
        500
      )
    }
  }
}
