import { prisma } from './prisma'
import { embedText } from './voyage'

export function chunkText(text, chunkSize = 512, overlap = 50) {
    const words = text.split(/\s+/)
    const chunks = []

    let i = 0
    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ')
        if (chunk.trim()) chunks.push(chunk)
        i += chunkSize - overlap
    }

    return chunks
}

export async function processAndStoreDocument(documentId, text) {
    const chunks = chunkText(text)

    const batchSize = 10
    let chunkIndex = 0

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        const embeddings = await embedText(batch)

        for (let j = 0; j < batch.length; j++) {
            await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (id, content, embedding, "chunkIndex", "documentId", "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${batch[j]},
          ${JSON.stringify(embeddings[j])}::vector,
          ${chunkIndex},
          ${documentId},
          NOW()
        )
      `
            chunkIndex++
        }
    }

    return chunkIndex
}

export async function retrieveRelevantChunks(query, userId, selectedDocumentIds = [], topK = 5) {
    const [queryEmbedding] = await embedText([query])

    // If specific documents selected, filter to those only
    // Otherwise fall back to all user documents
    const documentFilter = selectedDocumentIds.length > 0
        ? selectedDocumentIds
        : null

    if (documentFilter) {
        const chunks = await prisma.$queryRaw`
      SELECT 
        dc.content,
        dc."documentId",
        d.name as "documentName",
        1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM "DocumentChunk" dc
      JOIN "Document" d ON d.id = dc."documentId"
      WHERE d."userId" = ${userId}
        AND dc."documentId" = ANY(${documentFilter}::text[])
      ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `
        return chunks
    }

    const chunks = await prisma.$queryRaw`
    SELECT 
      dc.content,
      dc."documentId",
      d.name as "documentName",
      1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    WHERE d."userId" = ${userId}
    ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${topK}
  `
    return chunks
}