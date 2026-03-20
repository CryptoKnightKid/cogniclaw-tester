const { z } = require('zod');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { config } = require('../config/env');
const { createId, nowIso, sanitizeFileName } = require('../lib/utils');

const uploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(3).max(150),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024)
});

const completeSchema = z.object({
  fileId: z.string().min(4),
  etag: z.string().optional(),
  sizeBytes: z.number().int().positive().optional()
});

const downloadSchema = z.object({
  fileId: z.string().min(4)
});

class FileService {
  constructor(store, usageService, auditService) {
    this.store = store;
    this.usageService = usageService;
    this.auditService = auditService;
    this.s3Client = new S3Client({ region: config.aws.region });
  }

  bucketEnabled() {
    return Boolean(config.aws.s3Bucket);
  }

  async createUploadUrl(tenantId, userId, rawInput) {
    const input = uploadSchema.parse(rawInput);
    const fileId = createId('fil');
    const key = `${tenantId}/${new Date().toISOString().slice(0, 10)}/${fileId}-${sanitizeFileName(input.fileName)}`;

    const record = this.store.insert('tenant_files', {
      id: fileId,
      tenantId,
      storageKey: key,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: 'pending_upload',
      metadata: {
        retentionDays: 30
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null
    });

    let uploadUrl = `https://mock-storage.local/upload/${encodeURIComponent(key)}`;

    if (this.bucketEnabled()) {
      uploadUrl = await getSignedUrl(
        this.s3Client,
        new PutObjectCommand({
          Bucket: config.aws.s3Bucket,
          Key: key,
          ContentType: input.contentType
        }),
        { expiresIn: 60 * 15 }
      );
    }

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'file.upload_url.created',
      resourceType: 'tenant_files',
      resourceId: fileId,
      metadata: { key, bucketMode: this.bucketEnabled() ? 's3' : 'mock' }
    });

    return {
      fileId: record.id,
      uploadUrl,
      method: 'PUT',
      expiresInSeconds: 900,
      key: record.storageKey
    };
  }

  completeUpload(tenantId, userId, rawInput) {
    const input = completeSchema.parse(rawInput);
    const file = this.store.findById('tenant_files', input.fileId);

    if (!file || file.tenantId !== tenantId) {
      const error = new Error('File not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = this.store.update('tenant_files', file.id, {
      status: 'uploaded',
      sizeBytes: input.sizeBytes || file.sizeBytes,
      completedAt: nowIso(),
      metadata: {
        ...file.metadata,
        etag: input.etag || file.metadata?.etag || null
      }
    });

    const deltaMb = Number(updated.sizeBytes || 0) / (1024 * 1024);
    this.usageService.recordStorage(tenantId, Number(deltaMb.toFixed(4)), { fileId: updated.id });

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'file.upload.completed',
      resourceType: 'tenant_files',
      resourceId: file.id,
      metadata: { sizeBytes: updated.sizeBytes }
    });

    return updated;
  }

  listFiles(tenantId, { limit = 50 } = {}) {
    const files = this.store
      .list('tenant_files', (file) => file.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return files.slice(0, Math.max(1, Math.min(500, Number(limit) || 50)));
  }

  async createDownloadUrl(tenantId, userId, rawInput) {
    const input = downloadSchema.parse(rawInput);
    const file = this.store.findById('tenant_files', input.fileId);

    if (!file || file.tenantId !== tenantId || file.status !== 'uploaded') {
      const error = new Error('Uploaded file not found');
      error.statusCode = 404;
      throw error;
    }

    let downloadUrl = `https://mock-storage.local/download/${encodeURIComponent(file.storageKey)}`;

    if (this.bucketEnabled()) {
      downloadUrl = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({
          Bucket: config.aws.s3Bucket,
          Key: file.storageKey
        }),
        { expiresIn: 60 * 10 }
      );
    }

    this.auditService.write({
      tenantId,
      actorUserId: userId,
      action: 'file.download_url.created',
      resourceType: 'tenant_files',
      resourceId: file.id,
      metadata: { bucketMode: this.bucketEnabled() ? 's3' : 'mock' }
    });

    return {
      fileId: file.id,
      downloadUrl,
      expiresInSeconds: 600
    };
  }
}

module.exports = { FileService };
