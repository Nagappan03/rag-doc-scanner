import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processAndStoreDocument } from '@/lib/rag'

export async function POST(req) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get('file')

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const allowedTypes = ['application/pdf', 'text/markdown', 'text/plain']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Only PDF, Markdown and text files are supported' },
                { status: 400 }
            )
        }

        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File size must be under 10MB' },
                { status: 400 }
            )
        }

        // Extract text based on file type
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        let text = ''

        if (file.type === 'application/pdf') {
            const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
            const pdfData = await pdfParse(buffer)
            text = pdfData.text
        } else {
            // markdown or plain text
            text = buffer.toString('utf-8')
        }

        if (!text.trim()) {
            return NextResponse.json(
                { error: 'Could not extract text from file' },
                { status: 400 }
            )
        }

        // Save document record
        const document = await prisma.document.create({
            data: {
                name: file.name,
                type: file.type,
                size: file.size,
                userId: session.user.id,
            },
        })

        // Process and store chunks + embeddings
        const chunkCount = await processAndStoreDocument(document.id, text)

        return NextResponse.json({
            message: 'Document processed successfully',
            document: {
                id: document.id,
                name: document.name,
                chunkCount,
            },
        })
    } catch (error) {
        console.error('Document upload error:', error)
        return NextResponse.json(
            { error: 'Failed to process document' },
            { status: 500 }
        )
    }
}

export async function GET(req) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const documents = await prisma.document.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                type: true,
                size: true,
                createdAt: true,
                _count: { select: { chunks: true } },
            },
        })

        return NextResponse.json({ documents })
    } catch (error) {
        console.error('Fetch documents error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch documents' },
            { status: 500 }
        )
    }
}

export async function DELETE(req) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const documentId = searchParams.get('id')

        if (!documentId) {
            return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
        }

        // Verify ownership
        const document = await prisma.document.findFirst({
            where: { id: documentId, userId: session.user.id },
        })

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        await prisma.document.delete({ where: { id: documentId } })

        return NextResponse.json({ message: 'Document deleted successfully' })
    } catch (error) {
        console.error('Delete document error:', error)
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        )
    }
}